// Table definitions on top of the column DSL (architecture.md 9.3).
// Two shapes: row tables (one CSV row = one record) and key-value tables (config.csv, shop.csv).

import type { AnyColumn, OutKey, OutOf, RawOf } from './columns.ts';

export type Schema = Readonly<Record<string, AnyColumn>>;

/** Raw JSON row: CSV column names, data units. */
export type RowRaw<S extends Schema> = { readonly [K in keyof S & string]: RawOf<S[K]> };

/** GameData row: camelCase keys with unit suffixes, converted values. */
export type RowOut<S extends Schema> = {
  readonly [K in keyof S & string as OutKey<K, S[K]>]: OutOf<S[K]>;
};

export interface TableDef<S extends Schema = Schema> {
  readonly kind: 'rows';
  /** CSV file name without extension: content/data/<name>.csv. */
  readonly name: string;
  readonly columns: S;
  /**
   * Columns forming the unique key. Default: ['id'] when an `id` column exists, else none.
   * Ref columns pointing at this table resolve against keyColumns[0].
   */
  readonly key: readonly (keyof S & string)[];
  /**
   * Required for the M1 run (data-schema 2). A missing required table is a warning in
   * data:check until GD fills it, never an error; the build still succeeds.
   */
  readonly required: boolean;
}

export interface KvTableDef<S extends Schema = Schema> {
  readonly kind: 'kv';
  readonly name: string;
  /** Declared keys with their value types. Unknown keys are errors (architecture 9.2). */
  readonly keys: S;
  readonly required: boolean;
}

export type AnyTableDef = TableDef | KvTableDef;

export function defineTable<const S extends Schema>(def: {
  readonly name: string;
  readonly columns: S;
  readonly key?: readonly (keyof S & string)[];
  readonly required: boolean;
}): TableDef<S> {
  return {
    kind: 'rows',
    name: def.name,
    columns: def.columns,
    key: def.key ?? ('id' in def.columns ? ['id'] : []),
    required: def.required,
  };
}

export function defineKvTable<const S extends Schema>(def: {
  readonly name: string;
  readonly keys: S;
  readonly required: boolean;
}): KvTableDef<S> {
  return { kind: 'kv', name: def.name, keys: def.keys, required: def.required };
}

/** Columns every row table accepts and ignores (designer comments). */
export const IGNORED_COLUMNS: readonly string[] = ['notes'];
