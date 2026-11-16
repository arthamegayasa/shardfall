// Public API of src/content (architecture.md 5): schema DSL, CSV parser, data build, GameData, rules.

export { parseCsv } from './csv.ts';
export type { CsvIssue, CsvResult, CsvRow, CsvTable } from './csv.ts';
export {
  buildRaw,
  canonicalJson,
  GAME_DATA_FORMAT,
  GAME_DATA_SCHEMA_VERSION,
} from './build-raw.ts';
export type {
  BuildInput,
  BuildOutput,
  BuildReport,
  RawGameData,
  RawPulseSlot,
  RawRow,
} from './build-raw.ts';
export * from './game-data.ts';
export { PARAMS_REGISTRY } from './params-registry.ts';
export type { ParamSpec, ParamsRegistry, ParamType } from './params-registry.ts';
export * from './schema/index.ts';
export * from './tables/index.ts';
export { formatString } from './strings.ts';
export type { FormatOptions } from './strings.ts';
export * from './rules/index.ts';
