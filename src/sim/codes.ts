// Numeric codes used inside the sim (coding-standards 1.2: `as const` objects, no enums).
// Data strings (archetype, trigger, action, ...) are mapped to these codes once in sim-data.ts.

export const Archetype = {
  BoltExplode: 0,
  Projectile: 1,
  Arc: 2,
  Orbit: 3,
  Chain: 4,
  Boomerang: 5,
  RingEcho: 6,
  Coin: 7,
} as const;
export type Archetype = (typeof Archetype)[keyof typeof Archetype];

export const ARCHETYPE_CODES: Readonly<Record<string, Archetype>> = {
  bolt_explode: Archetype.BoltExplode,
  projectile: Archetype.Projectile,
  arc: Archetype.Arc,
  orbit: Archetype.Orbit,
  chain: Archetype.Chain,
  boomerang: Archetype.Boomerang,
  ring_echo: Archetype.RingEcho,
  coin: Archetype.Coin,
};

/** AI behaviors (enemies.csv behavior). Unknown behaviors fall back to Chase. */
export const Behavior = {
  Chase: 0,
  Charger: 1,
  Shooter: 2,
  WardenHound: 3,
  Boss: 4,
  Exploder: 5,
  Summoner: 6,
  WardenChoir: 7,
  Lobber: 8,
  WardenBulwark: 9,
} as const;
export type Behavior = (typeof Behavior)[keyof typeof Behavior];

export const BEHAVIOR_CODES: Readonly<Record<string, Behavior>> = {
  swarmer: Behavior.Chase,
  tank: Behavior.Chase,
  mote: Behavior.Chase,
  charger: Behavior.Charger,
  shooter: Behavior.Shooter,
  warden_hound: Behavior.WardenHound,
  exploder: Behavior.Exploder,
  summoner: Behavior.Summoner,
  warden_choir: Behavior.WardenChoir,
  lobber: Behavior.Lobber,
  warden_bulwark: Behavior.WardenBulwark,
  boss_lantern: Behavior.Boss,
  boss_bell: Behavior.Boss,
  boss_vine: Behavior.Boss,
};

/** EnemyPoolView.aiState values (render reads them for animation and telegraph visuals). */
export const AiState = {
  Idle: 0,
  Move: 1,
  Windup: 2,
  Attack: 3,
  Recover: 4,
  /** Boss phase transition: still and invulnerable. */
  Transition: 5,
  /** Boss stage telegraph before the boss emerges. */
  Emerging: 6,
} as const;
export type AiState = (typeof AiState)[keyof typeof AiState];

export const Trigger = {
  Passive: 0,
  OnHit: 1,
  OnCrit: 2,
  OnKill: 3,
  OnHurt: 4,
  OnBlock: 5,
  OnDodge: 6,
  OnPickup: 7,
  OnRite: 8,
  OnArea: 9,
  OnProjectileEnd: 10,
  Periodic: 11,
  OnDistance: 12,
  OnPulseStart: 13,
  OnPulseEnd: 14,
  OnShopStart: 15,
} as const;
export type Trigger = (typeof Trigger)[keyof typeof Trigger];
export const TRIGGER_COUNT = 16;

export const TRIGGER_CODES: Readonly<Record<string, Trigger>> = {
  passive: Trigger.Passive,
  on_hit: Trigger.OnHit,
  on_crit: Trigger.OnCrit,
  on_kill: Trigger.OnKill,
  on_hurt: Trigger.OnHurt,
  on_block: Trigger.OnBlock,
  on_dodge: Trigger.OnDodge,
  on_pickup: Trigger.OnPickup,
  on_rite: Trigger.OnRite,
  on_area: Trigger.OnArea,
  on_projectile_end: Trigger.OnProjectileEnd,
  periodic: Trigger.Periodic,
  on_distance: Trigger.OnDistance,
  on_pulse_start: Trigger.OnPulseStart,
  on_pulse_end: Trigger.OnPulseEnd,
  on_shop_start: Trigger.OnShopStart,
};

export const Cond = {
  SourceTag: 0,
  SourceKind: 1,
  SourceWeapon: 2,
  TargetHasStatus: 3,
  TargetWithin: 4,
  TargetHpBelow: 5,
  TargetHpFull: 6,
  TargetIs: 7,
  EveryNth: 8,
  PlayerHpBelow: 9,
  TimeSinceHurt: 10,
  HasBarrier: 11,
  HeldGlintAtLeast: 12,
  KilledByCrit: 13,
  UnhurtThisPulse: 14,
} as const;
export type Cond = (typeof Cond)[keyof typeof Cond];

export const COND_CODES: Readonly<Record<string, Cond>> = {
  source_tag: Cond.SourceTag,
  source_kind: Cond.SourceKind,
  source_weapon: Cond.SourceWeapon,
  target_has_status: Cond.TargetHasStatus,
  target_within: Cond.TargetWithin,
  target_hp_below: Cond.TargetHpBelow,
  target_hp_full: Cond.TargetHpFull,
  target_is: Cond.TargetIs,
  every_nth: Cond.EveryNth,
  player_hp_below: Cond.PlayerHpBelow,
  time_since_hurt: Cond.TimeSinceHurt,
  has_barrier: Cond.HasBarrier,
  held_glint_at_least: Cond.HeldGlintAtLeast,
  killed_by_crit: Cond.KilledByCrit,
  unhurt_this_pulse: Cond.UnhurtThisPulse,
};

export const Action = {
  StatMod: 0,
  Buff: 1,
  HitMod: 2,
  ApplyStatus: 3,
  StatusRule: 4,
  SpawnProjectile: 5,
  SpawnArea: 6,
  SpawnZone: 7,
  Execute: 8,
  Heal: 9,
  GainBarrier: 10,
  GainGlint: 11,
  Repeat: 12,
  TriggerWeapons: 13,
  ShopMod: 14,
  Convert: 15,
} as const;
export type Action = (typeof Action)[keyof typeof Action];

export const ACTION_CODES: Readonly<Record<string, Action>> = {
  stat_mod: Action.StatMod,
  buff: Action.Buff,
  hit_mod: Action.HitMod,
  apply_status: Action.ApplyStatus,
  status_rule: Action.StatusRule,
  spawn_projectile: Action.SpawnProjectile,
  spawn_area: Action.SpawnArea,
  spawn_zone: Action.SpawnZone,
  execute: Action.Execute,
  heal: Action.Heal,
  gain_barrier: Action.GainBarrier,
  gain_glint: Action.GainGlint,
  repeat: Action.Repeat,
  trigger_weapons: Action.TriggerWeapons,
  shop_mod: Action.ShopMod,
  convert: Action.Convert,
};

export const StackMode = { Value: 0, Chance: 1, None: 2 } as const;
export type StackMode = (typeof StackMode)[keyof typeof StackMode];

/** Status ids as used by effects (apply_status status=...). */
export const Status = { Burn: 0, Slow: 1, Mark: 2, Knockback: 3 } as const;
export type Status = (typeof Status)[keyof typeof Status];
/** SourceRef index of leech heals (SourceKind.Status, outside the Status codes; LP review M1). */
export const SOURCE_INDEX_LEECH = 100;

export const STATUS_CODES: Readonly<Record<string, Status>> = {
  burn: Status.Burn,
  slow: Status.Slow,
  mark: Status.Mark,
  knockback: Status.Knockback,
};

/** Hit kinds by data name (same order as HitKind and SOURCE_KINDS). */
export const HIT_KIND_CODES: Readonly<Record<string, number>> = {
  projectile: 0,
  melee: 1,
  area: 2,
  chain: 3,
  contact: 4,
  zone: 5,
  dot: 6,
};

/** Player projectile movement modes. */
export const ShotMode = {
  Straight: 0,
  /** Lantern Bolt: impact then explosion. */
  Bolt: 1,
  /** Returning Glaive: out, then back to the player. */
  Boomerang: 2,
  /** Rite Flare: lobbed to a point, explodes on landing, no collisions in flight. */
  Lob: 3,
  /** Orbit Shards shard: circles the player. */
  Orbit: 4,
} as const;
export type ShotMode = (typeof ShotMode)[keyof typeof ShotMode];

/** Danger area resolve behaviour. */
export const DangerMode = {
  /** Visual only (charge line, shooter windup, spawn stage). */
  Visual: 0,
  /** Damages the player once if inside when ticksLeft reaches 0. */
  Strike: 1,
  /** Expanding ring (Snuff Ring): damages while the band passes the player, outside the gap. */
  ExpandingRing: 2,
  /** Lane: when filled, launches a row of enemy shots along the line. */
  Lane: 3,
  /** Burst: when filled, fires a ring of enemy shots from its centre (affix volley). */
  Burst: 4,
  /** Lingering enemy zone that slows the player while inside (affix tar_trail). No damage. */
  Tar: 5,
  /** Exploder blast: Strike on the player plus enemy_dmg (p1) to other Unlit inside (GDD 14.2). */
  Blast: 6,
  /** Fan: when filled, fires a fan of enemy shots toward (x2, y2) (boss cone, Warden choir). */
  Fan: 7,
} as const;
export type DangerMode = (typeof DangerMode)[keyof typeof DangerMode];

/** Pending (delayed) action kinds (architecture 8.5). */
export const Pending = {
  Area: 0,
  Rite: 1,
  Hit: 2,
  WeaponEcho: 3,
} as const;
export type Pending = (typeof Pending)[keyof typeof Pending];
