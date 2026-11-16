// Sim events: data, not callbacks (architecture.md 6.5). [Frozen M1]
// Payload meaning per type is the table in architecture 6.5 (empty column = 0). x, y = world u.

export const SimEventType = {
  // run and phase
  PhaseChanged: 1,
  PulseStarted: 2,
  PulseEnded: 3,
  RunEnded: 4,
  // player
  PlayerDamaged: 10,
  PlayerHealed: 11,
  PlayerDied: 12,
  PlayerHpLowChanged: 13,
  DamageBlocked: 14,
  WeaponFired: 15,
  RiteCast: 16,
  RiteReady: 17,
  RiteRejected: 18,
  PlayerLeveledUp: 19,
  MementoAcquired: 20,
  SynergyActivated: 21,
  PlayerDodged: 22,
  BarrierGained: 23,
  BuffMaxed: 24,
  // enemies and danger
  EnemySpawned: 30,
  EnemyDamaged: 31,
  EnemyKilled: 32,
  EnemyProjectileFired: 33,
  TelegraphStarted: 34,
  TelegraphResolved: 35,
  WardenSpawned: 36,
  WardenKilled: 37,
  BossSpawned: 38,
  BossPhaseChanged: 39,
  BossSummoned: 40,
  BossKilled: 41,
  BossEnraged: 42,
  AffixApplied: 43,
  SpawnMarked: 44,
  // pickups
  GlintDropped: 50,
  GlintCollected: 51,
  MementoOfferSpawned: 52,
  GlintSwept: 53,
  // effects
  ProcTriggered: 55,
  // shop, level-up, reward
  LevelUpCardsShown: 60,
  LevelUpCardChosen: 61,
  ItemBought: 62,
  ItemSold: 63,
  ItemMerged: 64,
  ItemLocked: 65,
  ShopRerolled: 66,
  CommandRejected: 67,
  RewardShown: 68,
  RewardChosen: 69,
  // adaptive music (M1-09a, additive)
  MusicPressureChanged: 70,
  // feel and impact (M2-05, additive; payloads in architecture 6.5 and docs/specs/gp-m2-slice.md)
  RiteLanded: 71,
  HitStop: 72,
  EnemyKnockedBack: 73,
  EnemyDissolved: 74,
  AffixTriggered: 75,
  BossPatternStarted: 76,
  EnemyExploded: 77,
  GlintPulled: 78,
} as const;
export type SimEventType = (typeof SimEventType)[keyof typeof SimEventType];

export const RunOutcome = { Defeat: 0, Victory: 1, Abandon: 2 } as const;
export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome];

/**
 * EnemyDamaged.b bit layout: bit 0 crit, bit 1 proc, bits 2-3 EnemyRank, bits 4-6 HitKind,
 * bits 7-8 impact (M2-05, additive): 0 light, 1 medium, 2 heavy, 3 crushing, by damage relative to
 * the target's max HP (see ImpactTier). Read with `(b >> DAMAGE_IMPACT_SHIFT) & 3`.
 */
export const DamageFlag = { Crit: 1, Proc: 2 } as const;
export const DAMAGE_RANK_SHIFT = 2;
export const DAMAGE_HIT_KIND_SHIFT = 4;
export const DAMAGE_IMPACT_SHIFT = 7;

/** Impact tiers of EnemyDamaged bits 7-8 (presentation only: VFX size, hit flash, audio weight). */
export const ImpactTier = { Light: 0, Medium: 1, Heavy: 2, Crushing: 3 } as const;
export type ImpactTier = (typeof ImpactTier)[keyof typeof ImpactTier];

export function packDamageFlags(
  crit: boolean,
  proc: boolean,
  rank: number,
  hitKind: number,
  impact = 0,
): number {
  return (
    (crit ? 1 : 0) |
    (proc ? 2 : 0) |
    ((rank & 3) << DAMAGE_RANK_SHIFT) |
    ((hitKind & 7) << DAMAGE_HIT_KIND_SHIFT) |
    ((impact & 3) << DAMAGE_IMPACT_SHIFT)
  );
}

/** HitStop.a: suggested freeze strength. Render and app choose the duration (and skip it under reduced effects). */
export const HitStopStrength = { Small: 1, Medium: 2, Large: 3 } as const;
export type HitStopStrength = (typeof HitStopStrength)[keyof typeof HitStopStrength];

/** HitStop.b: what caused it. */
export const HitStopReason = {
  RiteLanded: 1,
  PlayerHurt: 2,
  WardenKilled: 3,
  BossPhase: 4,
  BossKilled: 5,
  PlayerDied: 6,
  ExecuteKill: 7,
} as const;
export type HitStopReason = (typeof HitStopReason)[keyof typeof HitStopReason];

/** AffixTriggered.b: what the affix did. */
export const AffixAction = {
  /** veiled: shell regrew (x, y = enemy). */
  ShellUp: 1,
  /** veiled: shell broke. */
  ShellBroken: 2,
  /** blinking: enemy teleported (x, y = arrival). */
  Blink: 3,
  /** brood: summoned (c = count). */
  Brood: 4,
  /** pulsing: shockwave released. */
  Pulse: 5,
  /** tar_trail: puddle dropped (x, y = puddle). */
  Tar: 6,
  /** hasted: haste applied in overtime. */
  Haste: 7,
} as const;
export type AffixAction = (typeof AffixAction)[keyof typeof AffixAction];

/** Read side shared by sim events (one tick) and frame events (all ticks of a frame). */
export interface SimEventReader {
  readonly count: number;
  /** SimEventType */
  readonly type: ArrayLike<number>;
  /** World u (0 when not applicable). */
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  /** Payload, meaning per type (architecture 6.5). */
  readonly a: ArrayLike<number>;
  readonly b: ArrayLike<number>;
  /** Usually a SourceRef (encodeSource). */
  readonly c: ArrayLike<number>;
}

/** Frame events: all ticks stepped in one rendered frame, with the tick of each event. */
export interface FrameEventReader extends SimEventReader {
  readonly tick: ArrayLike<number>;
}
