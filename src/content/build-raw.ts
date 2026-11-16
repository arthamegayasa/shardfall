// Data build (architecture.md 9.1 to 9.4): CSV + level JSON + strings -> raw game-data JSON.
// Pure: file contents in, JSON and a report out. tools/data/build-data.ts does the file IO.
// Errors fail the build (file:line:col message). Missing tables are warnings (required) or info.

import type { ArenaDef } from '../core/index.ts';
import { ARENA_MAX_HALF_D_U, ARENA_MAX_HALF_W_U, fnv1aString, toHex8 } from '../core/index.ts';
import { parseCsv } from './csv.ts';
import { PARAMS_REGISTRY } from './params-registry.ts';
import type { ParamsRegistry } from './params-registry.ts';
import { CellError, IGNORED_COLUMNS } from './schema/index.ts';
import type { AnyColumn, AnyTableDef, KvTableDef, ParamsRaw, TableDef } from './schema/index.ts';
import { TABLES } from './tables/index.ts';
import type { ContentTier } from './tables/index.ts';

export const GAME_DATA_FORMAT = 'shardfall-game-data';
export const GAME_DATA_SCHEMA_VERSION = 1;

export type RawRow = Readonly<Record<string, unknown>>;

export interface RawPulseSlot extends RawRow {
  readonly spawns: readonly RawRow[];
}

/** content/generated/game-data.json */
export interface RawGameData {
  readonly format: typeof GAME_DATA_FORMAT;
  readonly schemaVersion: number;
  readonly contentTier: ContentTier;
  /** FNV-1a hex of the canonical JSON of everything below. */
  readonly contentHash: string;
  /** Tables without a CSV file at build time (sorted). */
  readonly missingTables: readonly string[];
  /** Row tables as arrays in CSV row order; key-value tables as objects. weapon_tiers is merged into weapons. */
  readonly tables: Readonly<Record<string, readonly RawRow[] | RawRow>>;
  /** waves.csv joined with wave_spawns.csv, per profile in pulse order. */
  readonly profiles: Readonly<Record<string, readonly RawPulseSlot[]>>;
  readonly arenas: readonly ArenaDef[];
}

export interface BuildInput {
  /** Table name -> CSV text. Absent = table missing. */
  readonly csv: Readonly<Record<string, string>>;
  /** Level file name without extension -> file text. */
  readonly levels: Readonly<Record<string, string>>;
  /** content/strings/en.json text, or null when absent. */
  readonly strings: string | null;
  readonly contentTier: ContentTier;
  /** Override for tests; defaults to the shared registry. */
  readonly paramsRegistry?: ParamsRegistry;
  /** Override for tests; defaults to TABLES. */
  readonly tables?: readonly AnyTableDef[];
}

export interface BuildReport {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly infos: readonly string[];
}

export interface BuildOutput {
  readonly ok: boolean;
  readonly data: RawGameData;
  readonly strings: Readonly<Record<string, string>>;
  readonly report: BuildReport;
}

const TIER_ORDER: Record<ContentTier, number> = { A: 0, B: 1, C: 2 };

/** JSON with object keys sorted, so the same data always gives the same text and hash. */
export function canonicalJson(value: unknown, indent?: number): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(value), null, indent);
}

interface ParsedTable {
  readonly def: TableDef;
  /** All rows (every tier). */
  readonly rows: RawRow[];
  readonly lines: number[];
  /** Indices of rows kept after tier filtering and cascade. */
  kept: boolean[];
}

class Reporter {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];
  readonly infos: string[] = [];
  error(file: string, line: number, col: number, msg: string): void {
    this.errors.push(`${file}:${line}:${col} ${msg}`);
  }
}

function emptyCellValue(column: AnyColumn): { ok: true; value: unknown } | { ok: false } {
  if (column.optional) return { ok: true, value: null };
  if (column.hasDefault) return { ok: true, value: column.defaultValue };
  return { ok: false };
}

function parseRowTable(def: TableDef, text: string, rep: Reporter): ParsedTable | null {
  const file = `content/data/${def.name}.csv`;
  const csv = parseCsv(text);
  if (!csv.ok) {
    for (const i of csv.issues) rep.error(file, i.line, i.col, i.message);
    return null;
  }
  const { header, headerLine, rows } = csv.table;
  const colNames = Object.keys(def.columns);
  let headerOk = true;
  header.forEach((h, ci) => {
    if (!(h in def.columns) && !IGNORED_COLUMNS.includes(h)) {
      rep.error(
        file,
        headerLine,
        ci + 1,
        `unknown column "${h}" (declared: ${colNames.join(', ')})`,
      );
      headerOk = false;
    }
  });
  for (const name of colNames) {
    const column = def.columns[name];
    if (column === undefined || header.includes(name)) continue;
    if (!emptyCellValue(column).ok) {
      rep.error(file, headerLine, 0, `missing required column "${name}"`);
      headerOk = false;
    }
  }
  if (!headerOk) return null;
  const out: RawRow[] = [];
  const lines: number[] = [];
  for (const row of rows) {
    const rec: Record<string, unknown> = {};
    let rowOk = true;
    for (const name of colNames) {
      const column = def.columns[name];
      if (column === undefined) continue;
      const ci = header.indexOf(name);
      const cell = ci === -1 ? '' : (row.cells[ci] ?? '');
      if (cell === '') {
        const e = emptyCellValue(column);
        if (!e.ok) {
          rep.error(file, row.line, ci + 1, `"${name}" needs a value (${column.describe})`);
          rowOk = false;
        } else {
          rec[name] = e.value;
        }
        continue;
      }
      try {
        rec[name] = column.parseCell(cell);
      } catch (err) {
        if (!(err instanceof CellError)) throw err;
        rep.error(file, row.line, ci + 1, `${name}: ${err.message}`);
        rowOk = false;
      }
    }
    if (rowOk) {
      out.push(rec);
      lines.push(row.line);
    }
  }
  return { def, rows: out, lines, kept: out.map(() => true) };
}

function parseKvTable(def: KvTableDef, text: string, rep: Reporter): RawRow | null {
  const file = `content/data/${def.name}.csv`;
  const csv = parseCsv(text);
  if (!csv.ok) {
    for (const i of csv.issues) rep.error(file, i.line, i.col, i.message);
    return null;
  }
  const { header, headerLine, rows } = csv.table;
  const ki = header.indexOf('key');
  const vi = header.indexOf('value');
  if (ki === -1 || vi === -1) {
    rep.error(
      file,
      headerLine,
      0,
      'key-value table needs columns "key" and "value" (and optional "notes")',
    );
    return null;
  }
  header.forEach((h, ci) => {
    if (h !== 'key' && h !== 'value' && h !== 'notes')
      rep.error(file, headerLine, ci + 1, `unknown column "${h}"`);
  });
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.cells[ki] ?? '';
    const cell = row.cells[vi] ?? '';
    const column = def.keys[key];
    if (column === undefined) {
      rep.error(file, row.line, ki + 1, `unknown key "${key}" (declare it in src/content/tables)`);
      continue;
    }
    if (key in out) {
      rep.error(file, row.line, ki + 1, `duplicate key "${key}"`);
      continue;
    }
    if (cell === '') {
      const e = emptyCellValue(column);
      if (e.ok) out[key] = e.value;
      else rep.error(file, row.line, vi + 1, `"${key}" needs a value (${column.describe})`);
      continue;
    }
    try {
      out[key] = column.parseCell(cell);
    } catch (err) {
      if (!(err instanceof CellError)) throw err;
      rep.error(file, row.line, vi + 1, `${key}: ${err.message}`);
    }
  }
  for (const key of Object.keys(def.keys)) {
    if (key in out) continue;
    const column = def.keys[key];
    if (column === undefined) continue;
    const e = emptyCellValue(column);
    if (e.ok) out[key] = e.value;
    else rep.error(file, headerLine, 0, `missing key "${key}" (${column.describe})`);
  }
  return out;
}

function keyOf(row: RawRow, cols: readonly string[]): string {
  return cols.map((c) => String(row[c])).join('|');
}

/** Ids per table for ref checks: kept ids and all ids (to tell tier-filtered refs from typos). */
function idSets(
  parsed: ReadonlyMap<string, ParsedTable>,
  arenaIds: ReadonlySet<string>,
): { kept: Map<string, Set<string>>; all: Map<string, Set<string>> } {
  const kept = new Map<string, Set<string>>();
  const all = new Map<string, Set<string>>();
  for (const [name, t] of parsed) {
    const k = t.def.key[0];
    if (k === undefined) continue;
    const ks = new Set<string>();
    const as = new Set<string>();
    t.rows.forEach((r, i) => {
      as.add(String(r[k]));
      if (t.kept[i] === true) ks.add(String(r[k]));
    });
    kept.set(name, ks);
    all.set(name, as);
  }
  kept.set('arenas', new Set(arenaIds));
  all.set('arenas', new Set(arenaIds));
  return { kept, all };
}

function refValues(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

function validateParams(
  t: ParsedTable,
  registry: ParamsRegistry,
  rep: Reporter,
  unchecked: Set<string>,
): void {
  const file = `content/data/${t.def.name}.csv`;
  for (const [name, column] of Object.entries(t.def.columns)) {
    if (column.kind !== 'params' || column.paramsBy === undefined) continue;
    const by = column.paramsBy;
    const tableReg = registry[t.def.name] ?? {};
    t.rows.forEach((row, i) => {
      if (t.kept[i] !== true) return;
      const disc = String(row[by]);
      const spec = tableReg[disc];
      if (spec === undefined) {
        unchecked.add(`${t.def.name}.${by}=${disc}`);
        return;
      }
      const params = row[name] as ParamsRaw;
      for (const [k, v] of Object.entries(params)) {
        const s = spec[k];
        const line = t.lines[i] ?? 0;
        if (s === undefined) {
          rep.error(file, line, 0, `${name}: key "${k}" is not known for ${by}=${disc}`);
          continue;
        }
        if (s.type === 'string' || s.type === 'bool') {
          if (s.type === 'bool' && v !== 0 && v !== 1)
            rep.error(file, line, 0, `${name}.${k} must be 0 or 1`);
          if (s.values !== undefined && !s.values.includes(String(v)))
            rep.error(file, line, 0, `${name}.${k} must be one of ${s.values.join(', ')}`);
          continue;
        }
        if (typeof v !== 'number') {
          rep.error(file, line, 0, `${name}.${k} must be a number`);
          continue;
        }
        if (s.type === 'int' && !Number.isInteger(v))
          rep.error(file, line, 0, `${name}.${k} must be an integer`);
        if (s.min !== undefined && v < s.min)
          rep.error(file, line, 0, `${name}.${k} below minimum ${s.min}`);
        if (s.max !== undefined && v > s.max)
          rep.error(file, line, 0, `${name}.${k} above maximum ${s.max}`);
      }
    });
  }
}

function checkConvexClockwise(points: readonly (readonly [number, number])[]): string | null {
  if (points.length < 3) return 'needs at least 3 points';
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    if (a === undefined || b === undefined || c === undefined) return 'bad point';
    // Screen space: +y points down, so a clockwise-on-screen polygon has positive cross products here.
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return 'must be convex';
  }
  if (sign < 0) return 'must be clockwise on screen';
  return null;
}

function isVec2(v: unknown): v is readonly [number, number] {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
}

/** Structural arena checks. TODO(LP, M1-07): full LD-T01 and LD-T10 rules (architecture 9.6). */
function parseArena(name: string, text: string, rep: Reporter): ArenaDef | null {
  const file = `content/levels/${name}.json`;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    rep.error(file, 1, 0, `invalid JSON: ${(err as Error).message}`);
    return null;
  }
  if (json === null || typeof json !== 'object') {
    rep.error(file, 1, 0, 'arena must be a JSON object');
    return null;
  }
  const a = json as Record<string, unknown>;
  // Object flag: closures assign it, so a plain `let` would be narrowed to `true` by the linter.
  const state = { ok: true };
  const fail = (msg: string): void => {
    rep.error(file, 1, 0, msg);
    state.ok = false;
  };
  if (a['schemaVersion'] !== 1) fail('schemaVersion must be 1');
  if (a['id'] !== name) fail(`id must equal the file name "${name}"`);
  if (!/^[a-z][a-z0-9_]*$/.test(name)) fail('file name must be snake_case');
  const arena = a['arena'] as Record<string, unknown> | undefined;
  const boundary = arena?.['boundary'];
  if (!Array.isArray(boundary) || !boundary.every(isVec2)) {
    fail('arena.boundary must be an array of [x, y] points');
  } else {
    const shapeErr = checkConvexClockwise(boundary);
    if (shapeErr !== null) fail(`arena.boundary ${shapeErr}`);
    for (const [x, y] of boundary) {
      if (Math.abs(x) > ARENA_MAX_HALF_W_U || Math.abs(y) > ARENA_MAX_HALF_D_U)
        fail(`arena.boundary point [${x}, ${y}] is outside the 32 x 20 u limit (architecture 7.3)`);
    }
  }
  const ps = a['playerStart'] as Record<string, unknown> | undefined;
  if (ps === undefined || !isVec2(ps['default']) || !isVec2(ps['boss']))
    fail('playerStart.default and .boss must be [x, y]');
  if (!isVec2(a['pulseOrigin'])) fail('pulseOrigin must be [x, y]');
  // The rest of the shape is trusted here and typed by ArenaDef; the full validator lands with LD's arena.
  return state.ok ? (json as ArenaDef) : null;
}

export function buildRaw(input: BuildInput): BuildOutput {
  const rep = new Reporter();
  const tables = input.tables ?? TABLES;
  const registry = input.paramsRegistry ?? PARAMS_REGISTRY;
  const tier = TIER_ORDER[input.contentTier];
  const missing: string[] = [];
  const parsed = new Map<string, ParsedTable>();
  const kv = new Map<string, RawRow>();

  for (const def of tables) {
    const text = input.csv[def.name];
    if (text === undefined) {
      missing.push(def.name);
      const msg = `content/data/${def.name}.csv missing`;
      if (def.required) rep.warnings.push(`${msg} (required for M1, GD M1-02)`);
      else rep.infos.push(`${msg} (optional)`);
      if (def.kind === 'kv') kv.set(def.name, {});
      continue;
    }
    if (def.kind === 'kv') {
      const r = parseKvTable(def, text, rep);
      kv.set(def.name, r ?? {});
    } else {
      const r = parseRowTable(def, text, rep);
      if (r !== null) parsed.set(def.name, r);
    }
  }
  for (const name of Object.keys(input.csv)) {
    if (!tables.some((t) => t.name === name)) {
      rep.errors.push(
        `content/data/${name}.csv:1:0 no schema for table "${name}" (add it to src/content/tables)`,
      );
    }
  }

  // Arenas (content/levels).
  const arenas: ArenaDef[] = [];
  for (const name of Object.keys(input.levels).sort()) {
    const a = parseArena(name, input.levels[name] ?? '', rep);
    if (a !== null) arenas.push(a);
  }
  const arenaIds = new Set(arenas.map((a) => a.id));

  // Tier filter.
  for (const t of parsed.values()) {
    if (!('content_tier' in t.def.columns)) continue;
    t.rows.forEach((r, i) => {
      if (TIER_ORDER[r['content_tier'] as ContentTier] > tier) t.kept[i] = false;
    });
  }

  // References, with cascade: a row in a table without its own content_tier is dropped when the row it
  // needs was filtered out by tier. A tiered row pointing at a higher-tier row is an error.
  for (let pass = 0; pass < 8; pass++) {
    const ids = idSets(parsed, arenaIds);
    const pass_ = { changed: false };
    for (const t of parsed.values()) {
      if ('content_tier' in t.def.columns) continue;
      for (const [name, column] of Object.entries(t.def.columns)) {
        if (column.ref === undefined) continue;
        const keptIds = ids.kept.get(column.ref);
        const allIds = ids.all.get(column.ref);
        if (keptIds === undefined || allIds === undefined) continue;
        t.rows.forEach((row, i) => {
          if (t.kept[i] !== true) return;
          const v = refValues(row[name]).find((x) => !keptIds.has(x) && allIds.has(x));
          if (v === undefined) return;
          t.kept[i] = false;
          pass_.changed = true;
          rep.infos.push(
            `content/data/${t.def.name}.csv:${t.lines[i] ?? 0} dropped: ${name} "${v}" is above content tier ${input.contentTier}`,
          );
        });
      }
    }
    if (!pass_.changed) break;
  }
  {
    const ids = idSets(parsed, arenaIds);
    for (const t of parsed.values()) {
      const file = `content/data/${t.def.name}.csv`;
      for (const [name, column] of Object.entries(t.def.columns)) {
        if (column.ref === undefined) continue;
        const target = column.ref;
        const keptIds = ids.kept.get(target);
        const allIds = ids.all.get(target);
        if (
          keptIds === undefined ||
          allIds === undefined ||
          (target === 'arenas' && arenas.length === 0)
        ) {
          if (t.rows.some((r, i) => t.kept[i] === true && refValues(r[name]).length > 0)) {
            rep.warnings.push(
              `${file}: ${name} refers to ${target}, which is missing; references not checked`,
            );
          }
          continue;
        }
        t.rows.forEach((row, i) => {
          if (t.kept[i] !== true) return;
          for (const v of refValues(row[name])) {
            if (keptIds.has(v)) continue;
            rep.error(
              file,
              t.lines[i] ?? 0,
              0,
              allIds.has(v)
                ? `${name} "${v}" is above content tier ${input.contentTier}`
                : `${name} "${v}" not found in ${target}`,
            );
          }
        });
      }
    }
  }

  // References inside key-value tables (shop.csv rarity ids).
  {
    const ids = idSets(parsed, arenaIds);
    for (const def of tables) {
      if (def.kind !== 'kv') continue;
      const obj = kv.get(def.name) ?? {};
      for (const [key, column] of Object.entries(def.keys)) {
        if (column.ref === undefined || !(key in obj)) continue;
        const keptIds = ids.kept.get(column.ref);
        if (keptIds === undefined) continue;
        for (const v of refValues(obj[key])) {
          if (!keptIds.has(v))
            rep.errors.push(
              `content/data/${def.name}.csv:0:0 ${key} "${v}" not found in ${column.ref}`,
            );
        }
      }
    }
  }

  // Unique keys among kept rows.
  for (const t of parsed.values()) {
    if (t.def.key.length === 0) continue;
    const file = `content/data/${t.def.name}.csv`;
    const seen = new Map<string, number>();
    t.rows.forEach((row, i) => {
      if (t.kept[i] !== true) return;
      const k = keyOf(row, t.def.key);
      const line = t.lines[i] ?? 0;
      const prev = seen.get(k);
      if (prev !== undefined)
        rep.error(
          file,
          line,
          0,
          `duplicate ${t.def.key.join(', ')} "${k}" (first on line ${prev})`,
        );
      else seen.set(k, line);
    });
  }

  // Params registry.
  const unchecked = new Set<string>();
  for (const t of parsed.values()) validateParams(t, registry, rep, unchecked);
  if (unchecked.size > 0) {
    rep.infos.push(
      `params without a registry entry yet (any key accepted): ${[...unchecked].sort().join(', ')}`,
    );
  }

  const keptRows = (name: string): RawRow[] => {
    const t = parsed.get(name);
    return t === undefined ? [] : t.rows.filter((_r, i) => t.kept[i] === true);
  };
  const keptLines = (name: string): number[] => {
    const t = parsed.get(name);
    return t === undefined ? [] : t.lines.filter((_l, i) => t.kept[i] === true);
  };

  runTableChecks(parsed, kv, keptRows, keptLines, rep);

  // Joins.
  const outTables: Record<string, readonly RawRow[] | RawRow> = {};
  for (const def of tables) {
    if (def.kind === 'kv') outTables[def.name] = kv.get(def.name) ?? {};
    else if (def.name !== 'weapon_tiers' && def.name !== 'waves' && def.name !== 'wave_spawns') {
      outTables[def.name] = keptRows(def.name);
    }
  }
  outTables['weapons'] = joinWeaponTiers(
    keptRows('weapons'),
    keptRows('weapon_tiers'),
    parsed.has('weapon_tiers'),
    rep,
  );
  const profiles = joinProfiles(
    keptRows('waves'),
    keptRows('wave_spawns'),
    keptLines('wave_spawns'),
    rep,
  );

  // Strings.
  let strings: Record<string, string> = {};
  if (input.strings === null) {
    rep.infos.push('content/strings/en.json missing (WR, M1-08)');
  } else {
    try {
      const s: unknown = JSON.parse(input.strings);
      if (s === null || typeof s !== 'object' || Array.isArray(s))
        throw new Error('must be a flat JSON object');
      for (const [k, v] of Object.entries(s)) {
        if (typeof v !== 'string')
          rep.error('content/strings/en.json', 1, 0, `value of "${k}" must be a string`);
        else strings[k] = v;
      }
      strings = Object.fromEntries(
        Object.entries(strings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    } catch (err) {
      rep.error('content/strings/en.json', 1, 0, (err as Error).message);
    }
  }

  const body = {
    format: GAME_DATA_FORMAT,
    schemaVersion: GAME_DATA_SCHEMA_VERSION,
    contentTier: input.contentTier,
    missingTables: [...missing].sort(),
    tables: outTables,
    profiles,
    arenas,
  } as const;
  const contentHash = toHex8(fnv1aString(canonicalJson(body)));
  const data: RawGameData = { ...body, contentHash };
  return {
    ok: rep.errors.length === 0,
    data,
    strings,
    report: { errors: rep.errors, warnings: rep.warnings, infos: rep.infos },
  };
}

function joinWeaponTiers(
  weapons: readonly RawRow[],
  tiers: readonly RawRow[],
  tiersPresent: boolean,
  rep: Reporter,
): RawRow[] {
  return weapons.map((w) => {
    const id = w['id'];
    const own = tiers.filter((t) => t['weapon_id'] === id);
    const out: RawRow[] = [{ tier: 1, params: {}, effects: [] }];
    for (let tier = 2; tier <= 4; tier++) {
      const row = own.find((t) => t['tier'] === tier);
      if (row === undefined) {
        if (tiersPresent)
          rep.warnings.push(
            `content/data/weapon_tiers.csv: weapon "${String(id)}" has no tier ${tier} row`,
          );
        out.push({ tier, params: {}, effects: [] });
      } else {
        out.push({ tier, params: row['params'], effects: row['effects'] });
      }
    }
    return { ...w, tiers: out };
  });
}

function joinProfiles(
  waves: readonly RawRow[],
  spawns: readonly RawRow[],
  spawnLines: readonly number[],
  rep: Reporter,
): Record<string, RawPulseSlot[]> {
  const profiles: Record<string, RawPulseSlot[]> = {};
  for (const w of waves) {
    const p = String(w['profile']);
    const list = profiles[p] ?? (profiles[p] = []);
    list.push({
      ...w,
      spawns: spawns.filter((s) => s['profile'] === w['profile'] && s['pulse'] === w['pulse']),
    });
  }
  for (const list of Object.values(profiles))
    list.sort((a, b) => Number(a['pulse']) - Number(b['pulse']));
  spawns.forEach((s, i) => {
    if (!waves.some((w) => w['profile'] === s['profile'] && w['pulse'] === s['pulse'])) {
      rep.error(
        'content/data/wave_spawns.csv',
        spawnLines[i] ?? 0,
        0,
        `(profile, pulse) = (${String(s['profile'])}, ${String(s['pulse'])}) not found in waves.csv`,
      );
    }
  });
  return profiles;
}

/** content_tier cell as text; empty means A (data-schema 0.1). */
function tierText(v: unknown): string {
  return typeof v === 'string' && v !== '' ? v : 'A';
}

/** Cross-table rules from data-schema 1 (validation list) that the column DSL cannot express. */
function runTableChecks(
  parsed: ReadonlyMap<string, ParsedTable>,
  kv: ReadonlyMap<string, RawRow>,
  keptRows: (name: string) => RawRow[],
  keptLines: (name: string) => number[],
  rep: Reporter,
): void {
  // Effect owners: Memento, class, or synergy owner.
  if (parsed.has('effects')) {
    const owners = new Set<string>([
      ...keptRows('mementos').map((r) => String(r['id'])),
      ...keptRows('classes').map((r) => String(r['id'])),
      ...keptRows('synergies').map((r) => String(r['owner'])),
    ]);
    const known = ['mementos', 'classes', 'synergies'].every((n) => parsed.has(n));
    const lines = keptLines('effects');
    keptRows('effects').forEach((r, i) => {
      const owner = String(r['owner']);
      if (owners.has(owner)) return;
      const msg = `owner "${owner}" is not a Memento, class, or synergy owner`;
      if (known) rep.error('content/data/effects.csv', lines[i] ?? 0, 0, msg);
      else
        rep.warnings.push(
          `content/data/effects.csv:${lines[i] ?? 0} ${msg} (owner tables incomplete)`,
        );
    });
  }
  // Memento unlock: default or a meta_unlocks id.
  if (parsed.has('mementos')) {
    const unlocks = new Set(keptRows('meta_unlocks').map((r) => String(r['id'])));
    const lines = keptLines('mementos');
    keptRows('mementos').forEach((r, i) => {
      const u = String(r['unlock']);
      if (u === 'default' || unlocks.has(u)) return;
      rep.error(
        'content/data/mementos.csv',
        lines[i] ?? 0,
        0,
        `unlock "${u}" is not "default" or a meta_unlocks id`,
      );
    });
    // P1-a report.
    const pool = keptRows('mementos');
    if (pool.length > 0) {
      const flat = pool.filter((r) => r['is_flat'] === true).length;
      rep.infos.push(
        `P1-a: ${flat} of ${pool.length} Mementos are flat (${Math.round((flat / pool.length) * 100)}%)`,
      );
    }
  }
  // Waves: kind needs its foe; at most one final Pulse per profile.
  if (parsed.has('waves')) {
    const lines = keptLines('waves');
    const finals = new Map<string, number>();
    keptRows('waves').forEach((r, i) => {
      const line = lines[i] ?? 0;
      if (r['kind'] === 'warden' && r['warden_id'] === null)
        rep.error('content/data/waves.csv', line, 0, 'warden Pulse needs warden_id');
      if (r['kind'] === 'boss' && r['boss_id'] === null)
        rep.error('content/data/waves.csv', line, 0, 'boss Pulse needs boss_id');
      if (r['kind'] !== 'boss' && r['duration_s'] === 0)
        rep.error('content/data/waves.csv', line, 0, 'timed Pulse needs duration_s');
      if (r['final'] === true)
        finals.set(String(r['profile']), (finals.get(String(r['profile'])) ?? 0) + 1);
    });
    for (const [p, n] of finals)
      if (n > 1) rep.errors.push(`content/data/waves.csv:0:0 profile "${p}" has ${n} final Pulses`);
    // The foe must have the matching role: a boss_id that is not a boss never dies as a boss, so
    // the untimed boss Pulse would never end (LP review M1-09a).
    const roleOf = new Map<string, string>();
    for (const e of keptRows('enemies')) roleOf.set(String(e['id']), String(e['role']));
    keptRows('waves').forEach((r, i) => {
      const line = lines[i] ?? 0;
      const w = typeof r['warden_id'] === 'string' ? r['warden_id'] : null;
      const b = typeof r['boss_id'] === 'string' ? r['boss_id'] : null;
      if (r['kind'] === 'warden' && w !== null && roleOf.get(w) !== 'warden')
        rep.error('content/data/waves.csv', line, 0, `warden_id "${w}" is not a warden`);
      if (r['kind'] === 'boss' && b !== null && roleOf.get(b) !== 'boss')
        rep.error('content/data/waves.csv', line, 0, `boss_id "${b}" is not a boss`);
    });
    // wave_spawns rows share the content_tier of their waves row; otherwise a tier build silently
    // drops a Pulse's spawns (or reports a confusing missing key).
    const wavesT = parsed.get('waves');
    const spawnsT = parsed.get('wave_spawns');
    if (wavesT !== undefined && spawnsT !== undefined) {
      const tierOf = new Map<string, string>();
      for (const r of wavesT.rows)
        tierOf.set(`${String(r['profile'])}#${String(r['pulse'])}`, tierText(r['content_tier']));
      spawnsT.rows.forEach((r, i) => {
        const want = tierOf.get(`${String(r['profile'])}#${String(r['pulse'])}`);
        const have = tierText(r['content_tier']);
        if (want !== undefined && want !== have)
          rep.error(
            'content/data/wave_spawns.csv',
            spawnsT.lines[i] ?? 0,
            0,
            `content_tier ${have} differs from its waves.csv row (${want})`,
          );
      });
    }
  }
  // P2-e: boss pattern telegraphs above the minimum (cone uses the charge minimum).
  const config = kv.get('config');
  if (
    parsed.has('boss_patterns') &&
    config !== undefined &&
    typeof config['telegraph_min_boss_s'] === 'number'
  ) {
    const lines = keptLines('boss_patterns');
    keptRows('boss_patterns').forEach((r, i) => {
      const minKey = r['archetype'] === 'cone' ? 'telegraph_min_charge_s' : 'telegraph_min_boss_s';
      const min = config[minKey];
      if (typeof min === 'number' && Number(r['telegraph_s']) < min) {
        rep.error(
          'content/data/boss_patterns.csv',
          lines[i] ?? 0,
          0,
          `telegraph_s below ${minKey} (${min}) (P2-e)`,
        );
      }
    });
  }
  // TODO(LP, M1-02): stat ranges for stat_mods (data-schema 1.4), convert cycles (1.8),
  // enemy and affix telegraph minimums once GD maps each to a telegraph_min_* key.
}
