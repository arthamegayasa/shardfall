// Params key registry (architecture.md 9.3): which `params` keys each archetype, behavior, pattern
// archetype, and effect action accepts. Written by GP together with each implementation, reviewed by LP.
// A discriminator value without an entry accepts any keys (so data can be written before the code);
// data:check lists those as info so nothing stays unchecked silently.

export type ParamType = 'number' | 'int' | 'string' | 'bool';

export interface ParamSpec {
  readonly type: ParamType;
  readonly min?: number;
  readonly max?: number;
  /** Allowed string values. */
  readonly values?: readonly string[];
}

/** table name -> discriminator value -> key -> spec. */
export type ParamsRegistry = Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, ParamSpec>>>>>
>;

// TODO(GP, M1-03): add entries as archetypes are implemented, e.g.
// weapons: { projectile: { fan_every_n: { type: 'int', min: 1 }, fan_count: { type: 'int', min: 1 } } }
export const PARAMS_REGISTRY: ParamsRegistry = {
  weapons: {},
  rites: {},
  enemies: {},
  boss_patterns: {},
  effects: {},
};
