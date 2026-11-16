// Params key registry (architecture.md 9.3): which `params` keys each archetype, behavior, pattern
// archetype, and effect action accepts. Sources: GP spec gp-core-loop.md 3 (keys the sim reads),
// data-schema.md 5 (keys the data uses), effect-primitives.md 5 (effect actions). Filled by LP in
// M1-09a from those tables; GP keeps it in step with new archetypes, LP reviews.
// A discriminator value without an entry accepts any keys (so data can be written before the code);
// data:check lists those as info so nothing stays unchecked silently. Keys are optional: a missing
// key turns the behavior off in the sim, it is never replaced by a number in code.

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

type Spec = Readonly<Record<string, ParamSpec>>;

/** Non-negative number (seconds, u, u/s, degrees, fractions, percentage points). */
const n: ParamSpec = { type: 'number', min: 0 };
const frac: ParamSpec = { type: 'number', min: 0, max: 1 };
const int: ParamSpec = { type: 'int', min: 0 };
const bool: ParamSpec = { type: 'bool' };
const str: ParamSpec = { type: 'string' };
const oneOf = (...values: string[]): ParamSpec => ({ type: 'string', values });

const STATUSES = oneOf('burn', 'slow', 'mark', 'knockback');
const ORIGINS = oneOf('player', 'target', 'point');

/** Enemy keys shared by every behavior (gp-core-loop 3: drop_count on all enemies). */
const enemyCommon: Spec = { drop_count: int };
const chargerKeys: Spec = {
  trigger_range: n,
  charge_speed: n,
  charge_s: n,
  recover_s: n,
  cooldown: n,
};

export const PARAMS_REGISTRY: ParamsRegistry = {
  weapons: {
    bolt_explode: { explode_status: STATUSES },
    // Tier keys the sim also reads from base params (gp-core-loop 3).
    projectile: { fan_every_n: int, fan_count: int },
    arc: { arc_deg: n },
    orbit: { rev_s: n },
    chain: { jumps: int, jump_range: n, burn_chance: frac },
    boomerang: { hit_out: bool, hit_back: bool },
    ring_echo: { echo_delay: n, echo_frac: frac, echo_count: int },
    coin: { glint_per_kill: n, glint_cap_base: n, glint_cap_per_tier: n },
  },
  rites: {
    throw_zone: {
      max_range: n,
      flight_s: n,
      zone_radius: n,
      zone_s: n,
      zone_tick: n,
      slow: n,
      status: STATUSES,
    },
    ring: { knockback: n, slow: n, slow_s: n },
    dash: { dash_dist: n, dash_s: n, iframes_s: n, crit_hits: int, crit_window_s: n },
  },
  enemies: {
    swarmer: { ...enemyCommon, weave_amp: n, weave_hz: n },
    charger: { ...enemyCommon, ...chargerKeys },
    shooter: {
      ...enemyCommon,
      keep_min: n,
      keep_max: n,
      shot_speed: n,
      shot_life: n,
      cooldown: n,
    },
    tank: enemyCommon,
    mote: enemyCommon,
    exploder: {
      ...enemyCommon,
      trigger_range: n,
      fuse_s: n,
      blast_radius: n,
      fuse_move_mult: n,
      enemy_dmg: n,
    },
    summoner: {
      ...enemyCommon,
      keep_min: n,
      keep_max: n,
      summon_every: n,
      summon_count: int,
      max_summons: int,
      summon_id: str,
    },
    lobber: { ...enemyCommon, keep_min: n, keep_max: n, cooldown: n, zone_radius: n },
    warden_hound: { ...enemyCommon, ...chargerKeys, charges: int, charge_gap_s: n, rest_s: n },
    warden_choir: {
      ...enemyCommon,
      keep_min: n,
      keep_max: n,
      fan_count: int,
      fan_deg: n,
      shot_speed: n,
      shot_life: n,
      cooldown: n,
    },
    warden_bulwark: { ...enemyCommon, slam_every: n, slam_radius: n },
    boss_lantern: enemyCommon,
    boss_bell: enemyCommon,
    boss_vine: enemyCommon,
  },
  boss_patterns: {
    target_circles: { count: int, radius: n, spread: n, first_on_player: bool },
    ring_gap: {
      rings: int,
      ring_gap_s: n,
      thickness: n,
      speed: n,
      max_radius: n,
      gap_deg: n,
      min_gap_diff_deg: n,
    },
    lanes: {
      count: int,
      width: n,
      y_min: { type: 'number' },
      y_max: { type: 'number' },
      min_sep: n,
      spacing: n,
      speed: n,
    },
    summon: { count: int, enemy_id: str },
    spiral: { arms: int, duration: n, rate: n, speed: n },
    blink_slam: { radius: n },
    lines: { count: int, width: n, fan_count: int, fan_deg: n, fan_dmg: n, fan_speed: n },
    cone: { count: int, fan_deg: n, speed: n, repeats: int, repeat_gap_s: n },
    charge_lane: { width: n, speed: n },
  },
  effects: {
    stat_mod: { stat: str, op: oneOf('add', 'mult', 'min'), value: { type: 'number' } },
    buff: { stats: str, duration: n, max_stacks: int, refresh: bool },
    hit_mod: {
      mode: oneOf('bonus', 'vuln', 'force_crit', 'crit_mult_add'),
      value: { type: 'number' },
    },
    apply_status: { status: STATUSES, stacks: int, duration: n, value: n, dps: n },
    status_rule: {
      status: STATUSES,
      rule: oneOf('dmg_mult', 'spread_chance', 'spread_range', 'add_mark'),
      value: n,
    },
    spawn_projectile: {
      pattern: oneOf('aimed', 'seek_other', 'ring', 'fan', 'split', 'toughest'),
      count: int,
      dmg: n,
      dmg_frac: n,
      speed: n,
      range: n,
      pierce: int,
      origin: ORIGINS,
      tags: str,
      kind: str,
      seek_range: n,
      interval: n,
      distance: n,
    },
    spawn_area: {
      shape: oneOf('circle', 'ring'),
      radius: n,
      dmg: n,
      dmg_frac: n,
      delay: n,
      status: STATUSES,
      knockback: n,
      origin: ORIGINS,
      interval: n,
      distance: n,
    },
    spawn_zone: {
      radius: n,
      duration: n,
      tick: n,
      dmg: n,
      status: STATUSES,
      origin: ORIGINS,
      max_alive: int,
      interval: n,
      distance: n,
    },
    execute: {},
    heal: { amount: n, max_per_sec: n },
    gain_barrier: { charges: int },
    gain_glint: {
      mode: oneOf('direct', 'drop', 'same', 'interest', 'formula'),
      amount: n,
      div: n,
      cap: n,
      base: n,
      per_t: n,
    },
    repeat: {
      what: oneOf('area', 'rite', 'hit'),
      delay: n,
      power: n,
      target: oneOf('same', 'nearest_other'),
      range: n,
    },
    trigger_weapons: { scope: str, power: n, interval: n },
    shop_mod: {
      field: oneOf('slots', 'price_mult', 'reroll_delta', 'free_rerolls'),
      value: { type: 'number' },
    },
    convert: { from: str, to: str, ratio: n, cap: n },
  },
};
