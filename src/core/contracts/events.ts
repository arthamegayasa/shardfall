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
} as const;
export type SimEventType = (typeof SimEventType)[keyof typeof SimEventType];

export const RunOutcome = { Defeat: 0, Victory: 1, Abandon: 2 } as const;
export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome];

/** EnemyDamaged.b bit layout: bit 0 crit, bit 1 proc, bits 2-3 EnemyRank, bits 4-6 HitKind. */
export const DamageFlag = { Crit: 1, Proc: 2 } as const;
export const DAMAGE_RANK_SHIFT = 2;
export const DAMAGE_HIT_KIND_SHIFT = 4;

export function packDamageFlags(
  crit: boolean,
  proc: boolean,
  rank: number,
  hitKind: number,
): number {
  return (
    (crit ? 1 : 0) |
    (proc ? 2 : 0) |
    ((rank & 3) << DAMAGE_RANK_SHIFT) |
    ((hitKind & 7) << DAMAGE_HIT_KIND_SHIFT)
  );
}

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
