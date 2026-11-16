// Shared enum values for table schemas (data-schema.md v2, effect-primitives.md). Content owned by GD.

/** Tag ids in GameData.tags order (data-schema 3.11). */
export const TAGS = ['flame', 'shard', 'edge', 'echo', 'ward', 'trade'] as const;
export type TagId = (typeof TAGS)[number];

export const CONTENT_TIERS = ['A', 'B', 'C'] as const;
export type ContentTier = (typeof CONTENT_TIERS)[number];

export const ACCENTS = ['blue', 'cyan', 'gold'] as const;

/** Attack shape, same order and meaning as HitKind (architecture 6.1). */
export const SOURCE_KINDS = [
  'projectile',
  'melee',
  'area',
  'chain',
  'contact',
  'zone',
  'dot',
] as const;

export const WEAPON_ARCHETYPES = [
  'bolt_explode',
  'projectile',
  'arc',
  'orbit',
  'chain',
  'boomerang',
  'ring_echo',
  'coin',
] as const;
export const WEAPON_TARGETING = ['nearest', 'self', 'nearest_dir'] as const;
export const RITE_ARCHETYPES = ['throw_zone', 'ring', 'dash'] as const;

export const ENEMY_ROLES = [
  'swarmer',
  'charger',
  'shooter',
  'tank',
  'exploder',
  'summoner',
  'mote',
  'lobber',
  'warden',
  'boss',
] as const;
export const SIZE_CLASSES = ['small', 'medium', 'large', 'warden', 'boss'] as const;

export const STATUS_IDS = ['burn', 'slow', 'mark', 'knockback'] as const;
export const STAT_UNITS = ['flat', 'pct', 'u', 'u_per_s', 'per_s', 's'] as const;

export const BOSS_PATTERN_ARCHETYPES = [
  'target_circles',
  'ring_gap',
  'summon',
  'lanes',
  'spiral',
  'blink_slam',
  'lines',
  'cone',
  'charge_lane',
] as const;

export const RUN_PROFILES = ['run_a_m1', 'run_a', 'run_b', 'run_c'] as const;
export const PULSE_KINDS = ['normal', 'warden', 'boss'] as const;
export const SPAWN_SECTORS = ['n', 's', 'e', 'w', 'ne', 'se', 'sw', 'nw'] as const;
export const META_UNLOCK_KINDS = ['class', 'weapon', 'memento_pack'] as const;

export const EFFECT_TRIGGERS = [
  'passive',
  'on_hit',
  'on_crit',
  'on_kill',
  'on_hurt',
  'on_block',
  'on_dodge',
  'on_pickup',
  'on_rite',
  'on_area',
  'on_projectile_end',
  'periodic',
  'on_distance',
  'on_pulse_start',
  'on_pulse_end',
  'on_shop_start',
] as const;

export const EFFECT_CONDITIONS = [
  'source_tag',
  'source_kind',
  'source_weapon',
  'target_has_status',
  'target_within',
  'target_hp_below',
  'target_hp_full',
  'target_is',
  'every_nth',
  'player_hp_below',
  'time_since_hurt',
  'has_barrier',
  'held_glint_at_least',
  'killed_by_crit',
  'unhurt_this_pulse',
] as const;

export const EFFECT_ACTIONS = [
  'stat_mod',
  'buff',
  'hit_mod',
  'apply_status',
  'status_rule',
  'spawn_projectile',
  'spawn_area',
  'spawn_zone',
  'execute',
  'heal',
  'gain_barrier',
  'gain_glint',
  'repeat',
  'trigger_weapons',
  'shop_mod',
  'convert',
] as const;

export const STACK_MODES = ['value', 'chance', 'none'] as const;
