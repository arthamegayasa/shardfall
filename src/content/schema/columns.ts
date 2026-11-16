// Column DSL for CSV tables (architecture.md 9.3). No zod: a few typed builders.
// Each column parses one CSV cell into its raw JSON value (data units, e.g. seconds) and converts
// the raw value into the GameData value at load (e.g. seconds to ticks). GameData keys are derived
// from the CSV column name: snake_case to camelCase, unit suffix stripped, code unit suffix added
// (cooldown -> cooldownTicks, duration_s -> durationTicks, speed -> speedUPerTick, range -> rangeU).

import { TICK_RATE } from '../../core/index.ts';

export type Unit = 'none' | 'seconds' | 'uPerSec' | 'perSec' | 'u' | 'deg';

export type ColumnKind =
  | 'id'
  | 'token'
  | 'key'
  | 'str'
  | 'int'
  | 'float'
  | 'bool'
  | 'enum'
  | 'ref'
  | 'list'
  | 'params'
  | 'conditions'
  | 'contentTier';

/** Thrown by parseCell with a message that the pipeline prefixes with file:line:col. */
export class CellError extends Error {
  override readonly name = 'CellError';
}

export type ParamValue = number | string;
export type ParamsRaw = Readonly<Record<string, ParamValue>>;
export interface Condition {
  readonly name: string;
  readonly value: string;
}

/**
 * One column. Method syntax on purpose: methods are bivariant, so a Column<number, ...> is
 * assignable to Column<unknown, ...> inside a schema record.
 */
export interface Column<TRaw, TOut, U extends Unit, As extends string | undefined> {
  readonly kind: ColumnKind;
  readonly unit: U;
  /** Explicit GameData key, overriding the derived one. */
  readonly as: As;
  /** Empty cell gives null. */
  readonly optional: boolean;
  /** Empty cell gives defaultValue (when hasDefault). */
  readonly hasDefault: boolean;
  readonly defaultValue: TRaw | undefined;
  /** Target table for ref columns (and lists of refs). */
  readonly ref: string | undefined;
  readonly enumValues: readonly string[] | undefined;
  /** params: name of the discriminator column used by the params registry (archetype, behavior, action). */
  readonly paramsBy: string | undefined;
  /** Parse a non-empty, trimmed cell. Throws CellError. */
  parseCell(cell: string): TRaw;
  /** Raw JSON value to GameData value. */
  toGame(v: TRaw): TOut;
  /** Human description for error messages and docs. */
  readonly describe: string;
}

// The `never` / `unknown` placement keeps every concrete column assignable to AnyColumn.
export type AnyColumn = Column<unknown, unknown, Unit, string | undefined>;
export type RawOf<C> = C extends Column<infer R, unknown, Unit, string | undefined> ? R : never;
export type OutOf<C> = C extends Column<unknown, infer O, Unit, string | undefined> ? O : never;

type SuffixOf<U extends Unit> = U extends 'seconds'
  ? 'Ticks'
  : U extends 'uPerSec'
    ? 'UPerTick'
    : U extends 'perSec'
      ? 'PerTick'
      : U extends 'u'
        ? 'U'
        : U extends 'deg'
          ? 'Turns'
          : '';

type StripUnit<K extends string, U extends Unit> = U extends 'seconds'
  ? K extends `${infer B}_s`
    ? B
    : K
  : U extends 'deg'
    ? K extends `${infer B}_deg`
      ? B
      : K
    : U extends 'perSec'
      ? K extends `${infer B}_per_s`
        ? B
        : K
      : K;

export type CamelCase<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<CamelCase<T>>}`
  : S;

/** GameData key of column K (mirrors outKeyOf at runtime). */
export type OutKey<K extends string, C> =
  C extends Column<unknown, unknown, infer U, infer As>
    ? As extends string
      ? As
      : `${CamelCase<StripUnit<K, U>>}${SuffixOf<U>}`
    : never;

const SUFFIX: Record<Unit, string> = {
  none: '',
  seconds: 'Ticks',
  uPerSec: 'UPerTick',
  perSec: 'PerTick',
  u: 'U',
  deg: 'Turns',
};

const STRIP: Record<Unit, string> = {
  none: '',
  seconds: '_s',
  uPerSec: '',
  perSec: '_per_s',
  u: '',
  deg: '_deg',
};

export function camelCase(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/** Runtime twin of OutKey. */
export function outKeyOf(name: string, column: AnyColumn): string {
  if (column.as !== undefined) return column.as;
  const strip = STRIP[column.unit];
  const base = strip !== '' && name.endsWith(strip) ? name.slice(0, -strip.length) : name;
  return camelCase(base) + SUFFIX[column.unit];
}

// ---------------------------------------------------------------------------------------------
// Builders

interface NumOpts<A extends string | undefined> {
  readonly min?: number;
  readonly max?: number;
  readonly default?: number;
  readonly as?: A;
}

const ID_RE = /^[a-z][a-z0-9_]*$/;
const KEY_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const NUM_RE = /^-?(\d+\.?\d*|\.\d+)$/;

function parseNumber(cell: string): number {
  if (!NUM_RE.test(cell)) throw new CellError(`expected a number with "." decimals, got "${cell}"`);
  return Number(cell);
}

function checkRange(v: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && v < min) throw new CellError(`value ${v} is below the minimum ${min}`);
  if (max !== undefined && v > max) throw new CellError(`value ${v} is above the maximum ${max}`);
  return v;
}

function base<TRaw, TOut, U extends Unit, A extends string | undefined>(
  kind: ColumnKind,
  unit: U,
  as: A,
  describe: string,
  parseCell: (cell: string) => TRaw,
  toGame: (v: TRaw) => TOut,
  extra: {
    readonly defaultValue?: TRaw | undefined;
    readonly ref?: string;
    readonly enumValues?: readonly string[];
    readonly paramsBy?: string;
  } = {},
): Column<TRaw, TOut, U, A> {
  return {
    kind,
    unit,
    as,
    optional: false,
    hasDefault: extra.defaultValue !== undefined,
    defaultValue: extra.defaultValue,
    ref: extra.ref,
    enumValues: extra.enumValues,
    paramsBy: extra.paramsBy,
    parseCell,
    toGame,
    describe,
  };
}

const same = <T>(v: T): T => v;

function numeric<U extends Unit, A extends string | undefined>(
  kind: 'int' | 'float',
  unit: U,
  opts: NumOpts<A>,
  toGame: (v: number) => number,
  describe: string,
): Column<number, number, U, A> {
  return base(
    kind,
    unit,
    opts.as as A,
    describe,
    (cell) => {
      const v = parseNumber(cell);
      if (kind === 'int' && !Number.isInteger(v))
        throw new CellError(`expected an integer, got "${cell}"`);
      return checkRange(v, opts.min, opts.max);
    },
    toGame,
    { defaultValue: opts.default },
  );
}

export const col = {
  /** Unique snake_case row id. */
  id<const A extends string | undefined = undefined>(
    opts: { readonly as?: A } = {},
  ): Column<string, string, 'none', NoInfer<A>> {
    return base(
      'id',
      'none',
      opts.as as A,
      'snake_case id',
      (cell) => {
        if (!ID_RE.test(cell)) throw new CellError(`id "${cell}" must be snake_case`);
        return cell;
      },
      same,
    );
  },
  /** snake_case identifier owned elsewhere (AI behavior, music id, effect owner). Not checked against a table. */
  token<const A extends string | undefined = undefined>(
    opts: { readonly as?: A; readonly default?: string } = {},
  ): Column<string, string, 'none', NoInfer<A>> {
    return base(
      'token',
      'none',
      opts.as as A,
      'snake_case token',
      (cell) => {
        if (!ID_RE.test(cell)) throw new CellError(`"${cell}" must be snake_case`);
        return cell;
      },
      same,
      { defaultValue: opts.default },
    );
  },
  /** String table key (dotted snake_case). Checked against strings by check-strings (QA DV-3). */
  key<const A extends string | undefined = undefined>(
    opts: { readonly as?: A } = {},
  ): Column<string, string, 'none', NoInfer<A>> {
    return base(
      'key',
      'none',
      opts.as as A,
      'string table key',
      (cell) => {
        if (!KEY_RE.test(cell))
          throw new CellError(`string key "${cell}" must be dotted snake_case`);
        return cell;
      },
      same,
    );
  },
  /** Free string (palette token, notes). */
  str<const A extends string | undefined = undefined>(
    opts: { readonly as?: A; readonly default?: string } = {},
  ): Column<string, string, 'none', NoInfer<A>> {
    return base('str', 'none', opts.as as A, 'string', same, same, { defaultValue: opts.default });
  },
  int<const A extends string | undefined = undefined>(
    opts: NumOpts<A> = {},
  ): Column<number, number, 'none', NoInfer<A>> {
    return numeric('int', 'none', opts, same, 'integer');
  },
  float<const A extends string | undefined = undefined>(
    opts: NumOpts<A> = {},
  ): Column<number, number, 'none', NoInfer<A>> {
    return numeric('float', 'none', opts, same, 'number');
  },
  /** Seconds in data, ticks in GameData: Math.round(sec * 60). */
  seconds<const A extends string | undefined = undefined>(
    opts: NumOpts<A> = {},
  ): Column<number, number, 'seconds', NoInfer<A>> {
    return numeric(
      'float',
      'seconds',
      { min: 0, ...opts },
      (s) => Math.round(s * TICK_RATE),
      'seconds',
    );
  },
  /** u/s in data, u/tick in GameData. */
  uPerSec<const A extends string | undefined = undefined>(
    opts: NumOpts<A> = {},
  ): Column<number, number, 'uPerSec', NoInfer<A>> {
    return numeric('float', 'uPerSec', opts, (v) => v / TICK_RATE, 'u/s');
  },
  /** Amount per second in data, per tick in GameData. */
  perSec<const A extends string | undefined = undefined>(
    opts: NumOpts<A> = {},
  ): Column<number, number, 'perSec', NoInfer<A>> {
    return numeric('float', 'perSec', opts, (v) => v / TICK_RATE, 'per second');
  },
  /** World units (1 u = 16 px). No conversion, key gets the U suffix. */
  u<const A extends string | undefined = undefined>(
    opts: NumOpts<A> = {},
  ): Column<number, number, 'u', NoInfer<A>> {
    return numeric('float', 'u', opts, same, 'u');
  },
  /** Degrees in data, turns in GameData. */
  deg<const A extends string | undefined = undefined>(
    opts: NumOpts<A> = {},
  ): Column<number, number, 'deg', NoInfer<A>> {
    return numeric('float', 'deg', opts, (d) => d / 360, 'degrees');
  },
  bool<const A extends string | undefined = undefined>(
    opts: { readonly default?: boolean; readonly as?: A } = {},
  ): Column<boolean, boolean, 'none', NoInfer<A>> {
    return base(
      'bool',
      'none',
      opts.as as A,
      '0 or 1',
      (cell) => {
        if (cell === '0') return false;
        if (cell === '1') return true;
        throw new CellError(`expected 0 or 1, got "${cell}"`);
      },
      same,
      { defaultValue: opts.default },
    );
  },
  enumOf<const V extends readonly string[], const A extends string | undefined = undefined>(
    values: V,
    opts: { readonly default?: V[number]; readonly as?: A } = {},
  ): Column<V[number], V[number], 'none', NoInfer<A>> {
    return base(
      'enum',
      'none',
      opts.as as A,
      `one of ${values.join(', ')}`,
      (cell) => {
        if (!values.includes(cell))
          throw new CellError(`"${cell}" is not one of ${values.join(', ')}`);
        return cell;
      },
      same,
      { defaultValue: opts.default, enumValues: values },
    );
  },
  /** Content tier column: rows above the build tier are dropped at build time. */
  contentTier(): Column<'A' | 'B' | 'C', 'A' | 'B' | 'C', 'none', undefined> {
    return base(
      'contentTier',
      'none',
      undefined,
      'A, B or C',
      (cell) => {
        if (cell !== 'A' && cell !== 'B' && cell !== 'C')
          throw new CellError(`content_tier must be A, B or C, got "${cell}"`);
        return cell;
      },
      same,
    );
  },
  /** Id of a row in another table (or 'arenas' for content/levels). Checked after tier filtering. */
  ref<const A extends string | undefined = undefined>(
    table: string,
    opts: { readonly as?: A } = {},
  ): Column<string, string, 'none', NoInfer<A>> {
    return base(
      'ref',
      'none',
      opts.as as A,
      `id from ${table}`,
      (cell) => {
        if (!ID_RE.test(cell)) throw new CellError(`reference "${cell}" must be a snake_case id`);
        return cell;
      },
      same,
      { ref: table },
    );
  },
  /** `|` separated list. Empty cell = [] unless min > 0. */
  list<TR, TO, const A extends string | undefined = undefined>(
    item: Column<TR, TO, Unit, string | undefined>,
    opts: { readonly min?: number; readonly as?: A } = {},
  ): Column<readonly TR[], readonly TO[], 'none', NoInfer<A>> {
    const min = opts.min ?? 0;
    const col: Column<readonly TR[], readonly TO[], 'none', A> = base(
      'list',
      'none',
      opts.as as A,
      `list of ${item.describe} separated by |`,
      (cell) => {
        const parts = cell.split('|').map((p) => p.trim());
        if (parts.some((p) => p === '')) throw new CellError('empty list item');
        if (parts.length < min) throw new CellError(`needs at least ${min} item(s)`);
        return parts.map((p) => item.parseCell(p));
      },
      (v) => v.map((x) => item.toGame(x)),
      {
        ...(min === 0 ? { defaultValue: [] as readonly TR[] } : {}),
        ...(item.ref !== undefined ? { ref: item.ref } : {}),
        ...(item.enumValues !== undefined ? { enumValues: item.enumValues } : {}),
      },
    );
    return col;
  },
  /** `key=value;key=value`. Numbers become numbers. Keys are validated by the params registry. */
  params<const A extends string | undefined = undefined>(
    opts: { readonly by?: string; readonly as?: A } = {},
  ): Column<ParamsRaw, ParamsRaw, 'none', NoInfer<A>> {
    return base(
      'params',
      'none',
      opts.as as A,
      'key=value;key=value',
      (cell) => {
        const out: Record<string, ParamValue> = {};
        for (const part of cell.split(';')) {
          const p = part.trim();
          if (p === '') continue;
          const eq = p.indexOf('=');
          if (eq <= 0) throw new CellError(`param "${p}" must be key=value`);
          const k = p.slice(0, eq).trim();
          const v = p.slice(eq + 1).trim();
          if (!ID_RE.test(k)) throw new CellError(`param key "${k}" must be snake_case`);
          if (k in out) throw new CellError(`duplicate param key "${k}"`);
          out[k] = NUM_RE.test(v) ? Number(v) : v;
        }
        return out;
      },
      same,
      { defaultValue: {}, ...(opts.by !== undefined ? { paramsBy: opts.by } : {}) },
    );
  },
  /** Effect conditions: `name:value` separated by `|` (effect-primitives 4). */
  conditions<const A extends string | undefined = undefined>(
    names: readonly string[],
    opts: { readonly as?: A } = {},
  ): Column<readonly Condition[], readonly Condition[], 'none', NoInfer<A>> {
    return base(
      'conditions',
      'none',
      opts.as as A,
      'name:value separated by |',
      (cell) =>
        cell.split('|').map((part) => {
          const p = part.trim();
          const i = p.indexOf(':');
          if (i <= 0) throw new CellError(`condition "${p}" must be name:value`);
          const name = p.slice(0, i);
          if (!names.includes(name)) throw new CellError(`unknown condition "${name}"`);
          return { name, value: p.slice(i + 1) };
        }),
      same,
      { defaultValue: [], enumValues: names },
    );
  },
  /** Empty cell gives null instead of an error. */
  optional<TR, TO, U extends Unit, A extends string | undefined>(
    inner: Column<TR, TO, U, A>,
  ): Column<TR | null, TO | null, U, NoInfer<A>> {
    return {
      ...inner,
      optional: true,
      hasDefault: false,
      defaultValue: undefined,
      parseCell: (cell) => inner.parseCell(cell),
      toGame: (v) => (v === null ? null : inner.toGame(v)),
    };
  },
};
