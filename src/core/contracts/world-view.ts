// Read-only live view of sim state (architecture.md 6.4). [Frozen M1]
// State lives in typed arrays exposed as ArrayLike<number> without copies. Valid until the next step().

export type RunPhase =
  'idle' | 'pulse' | 'pulseClear' | 'reward' | 'levelUp' | 'shop' | 'victory' | 'defeat';

/** Numeric phase codes for event payloads (PhaseChanged.a and .b). */
export const RunPhaseCode = {
  idle: 0,
  pulse: 1,
  pulseClear: 2,
  reward: 3,
  levelUp: 4,
  shop: 5,
  victory: 6,
  defeat: 7,
} as const satisfies Record<RunPhase, number>;
export type RunPhaseCode = (typeof RunPhaseCode)[keyof typeof RunPhaseCode];

/** Inverse of RunPhaseCode, index = code. */
export const RUN_PHASES: readonly RunPhase[] = [
  'idle',
  'pulse',
  'pulseClear',
  'reward',
  'levelUp',
  'shop',
  'victory',
  'defeat',
];

/** Common SoA layout of a fixed-capacity pool with stable slots. Positions in world u. */
export interface PoolView {
  readonly capacity: number;
  /** Iterate 0..highWater-1 and skip where alive[i] === 0. */
  readonly highWater: number;
  readonly alive: ArrayLike<number>;
  /** Increments whenever a slot is reused. Render resets per-slot animation on change. Not hashed. */
  readonly serial: ArrayLike<number>;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly prevX: ArrayLike<number>;
  readonly prevY: ArrayLike<number>;
  readonly radius: ArrayLike<number>;
}

export const EnemyRank = { Normal: 0, Warden: 1, Boss: 2 } as const;
export type EnemyRank = (typeof EnemyRank)[keyof typeof EnemyRank];

export const StatusBit = { Burn: 1, Slow: 2, Mark: 4 } as const;

export interface EnemyPoolView extends PoolView {
  /** EnemyTypeIndex */
  readonly typeIndex: ArrayLike<number>;
  /** EnemyRank */
  readonly rank: ArrayLike<number>;
  readonly hp: ArrayLike<number>;
  readonly maxHp: ArrayLike<number>;
  /** Shell from affix veiled, 0 when none. */
  readonly shield: ArrayLike<number>;
  /** AI state code (idle, move, windup, attack, recover, ...) for animation and telegraph visuals. */
  readonly aiState: ArrayLike<number>;
  readonly aiStateTicks: ArrayLike<number>;
  /** -1 left, 1 right. */
  readonly facing: ArrayLike<number>;
  readonly hitFlashTicks: ArrayLike<number>;
  /** StatusBit */
  readonly statusMask: ArrayLike<number>;
  /** Ticks since spawn, for emerge animation and contact grace. */
  readonly ageTicks: ArrayLike<number>;
}

export interface ProjectilePoolView extends PoolView {
  /** encodeSource(...), picks sprite and VFX. */
  readonly sourceRef: ArrayLike<number>;
  /** u per tick, for 8-direction sprite choice. */
  readonly vx: ArrayLike<number>;
  readonly vy: ArrayLike<number>;
}

export const PickupKind = { Glint: 0 } as const;

export interface PickupPoolView extends PoolView {
  readonly kind: ArrayLike<number>;
  readonly amount: ArrayLike<number>;
  readonly magnetized: ArrayLike<number>;
  /**
   * Ticks since the piece started flying to the player (0 on the floor). Pickup animation state for
   * render (stretch, trail). Speed is (x - prevX, y - prevY). M2-05, additive.
   */
  readonly flyTicks?: ArrayLike<number>;
}

export const AreaShape = { Circle: 0, Ring: 1, Line: 2, Cone: 3 } as const;
export type AreaShape = (typeof AreaShape)[keyof typeof AreaShape];

export const TelegraphKind = {
  Projectile: 1,
  Charge: 2,
  Area: 3,
  BossArea: 4,
  Ring: 5,
  Lane: 6,
  Cone: 7,
} as const;
export type TelegraphKind = (typeof TelegraphKind)[keyof typeof TelegraphKind];

/**
 * Ground areas. Two pools share this layout: dangerAreas (telegraphs, enemy zones, layer L4)
 * and playerZones (fire zones, embers, auras, layer L3).
 * Shape params: Circle: radius. Ring: radius = outer, p0 = inner radius, p1 = gap centre (turns),
 * p2 = gap half width (turns, 0 = no gap). Line: (x2, y2) end point, p0 = half width.
 * Cone: (x2, y2) direction point, p0 = half angle (turns).
 */
export interface AreaPoolView extends PoolView {
  /** AreaShape */
  readonly shape: ArrayLike<number>;
  /** TelegraphKind for danger, 0 for player zones. */
  readonly kind: ArrayLike<number>;
  readonly sourceRef: ArrayLike<number>;
  readonly x2: ArrayLike<number>;
  readonly y2: ArrayLike<number>;
  readonly p0: ArrayLike<number>;
  readonly p1: ArrayLike<number>;
  readonly p2: ArrayLike<number>;
  readonly ticksLeft: ArrayLike<number>;
  /** Fill progress = 1 - ticksLeft / ticksTotal. */
  readonly ticksTotal: ArrayLike<number>;
}

/** Spawn cracks on the floor (no damage), drawn on L4 per arena-design 5.3. */
export interface SpawnMarkPoolView extends PoolView {
  readonly typeIndex: ArrayLike<number>;
  readonly ticksLeft: ArrayLike<number>;
  readonly ticksTotal: ArrayLike<number>;
}

export interface PlayerView {
  readonly x: number;
  readonly y: number;
  readonly prevX: number;
  readonly prevY: number;
  readonly radius: number;
  readonly facing: number;
  readonly classIndex: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number;
  readonly glint: number;
  readonly riteIndex: number;
  readonly riteCooldownTicks: number;
  readonly riteCooldownMaxTicks: number;
  readonly riteCharges: number;
  readonly riteChargesMax: number;
  readonly barrier: number;
  readonly barrierMax: number;
  readonly invulnTicks: number;
  readonly hitFlashTicks: number;
  /** Final stat values, indexed by StatIndex. */
  readonly stats: ArrayLike<number>;
}

/** Single big foe for HUD bars: the Warden of a Warden Pulse, or the boss of a boss Pulse. */
export interface BigFoeView {
  readonly active: boolean;
  readonly typeIndex: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly shield: number;
  /** Boss: 1, 2, 3. Warden: 1. */
  readonly phase: number;
  /** Boss enraged, or Warden hasted in overtime. */
  readonly enraged: boolean;
}

export const PulseKindCode = { Normal: 0, Warden: 1, Boss: 2 } as const;

export interface PulseView {
  /** 0-based. */
  readonly index: number;
  /** Total Pulses in this run profile. */
  readonly count: number;
  /** 0 normal, 1 warden, 2 boss. */
  readonly kind: 0 | 1 | 2;
  readonly threat: number;
  /** 0 and 0 for untimed boss Pulses. */
  readonly ticksLeft: number;
  readonly ticksTotal: number;
  readonly isBoss: boolean;
  /** Timer at 0 but a Warden is still alive (GDD 3.3). */
  readonly overtime: boolean;
  readonly wardenAlive: boolean;
  /** HP bar while the Warden holds the timer (CD review, UI K5). */
  readonly warden: BigFoeView;
  readonly boss: BigFoeView;
}

export const OfferKind = { Empty: 0, Weapon: 1, Memento: 2, Taken: 3 } as const;
export type OfferKind = (typeof OfferKind)[keyof typeof OfferKind];

export interface ShopOfferView {
  /** OfferKind */
  readonly kind: number;
  /** WeaponIndex or MementoIndex. */
  readonly defIndex: number;
  /** Weapon tier 1..4, or Memento rarity order + 1. */
  readonly tier: number;
  readonly price: number;
  readonly locked: boolean;
  readonly affordable: boolean;
  /** Inventory slot that would merge on purchase, -1 when none. */
  readonly mergeSlot: number;
  readonly mergeToTier: number;
  /** True when no free slot and no merge is possible. */
  readonly blockedNoSlot: boolean;
  /** True when this id is not owned yet, so buying raises each of its tag counts by 1 (GDD 8.1). */
  readonly isNewId: boolean;
}

export interface InventorySlotView {
  /** -1 when empty. */
  readonly weaponIndex: number;
  readonly tier: number;
  readonly sellPrice: number;
  /** Another slot holds the same id and tier. */
  readonly canMerge: boolean;
}

export interface ShopView {
  /** Increments on every change. UI rebuilds DOM only when this changes. */
  readonly revision: number;
  readonly offers: readonly ShopOfferView[];
  readonly rerollPrice: number;
  readonly freeRerolls: number;
  /** Length = weapon slots. */
  readonly inventory: readonly InventorySlotView[];
  /** Acquisition order. */
  readonly mementos: readonly { readonly mementoIndex: number; readonly count: number }[];
  /** Indexed by TagIndex. */
  readonly tagCounts: ArrayLike<number>;
}

export interface LevelUpView {
  readonly revision: number;
  /** Levels still to pick, including the current one. */
  readonly pending: number;
  /** Levels gained this Pulse (for "1 of 2"). */
  readonly total: number;
  readonly choices: readonly {
    readonly cardIndex: number;
    readonly rarity: number;
    readonly value: number;
  }[];
}

export interface RewardView {
  readonly revision: number;
  /** EnemyTypeIndex of the Warden or boss. */
  readonly sourceTypeIndex: number;
  readonly choices: readonly { readonly mementoIndex: number; readonly rarity: number }[];
}

export interface RunStatsView {
  readonly kills: number;
  readonly glintEarned: number;
  readonly glintSpent: number;
  readonly pulsesCleared: number;
  readonly runTicks: number;
  /** Computed at run end. */
  readonly silt: number;
  /** SourceRef of the killing hit, 0 while alive (UI "Felled by", K4). */
  readonly killedBy: number;
  readonly difficulty: number;
}

export interface WorldView {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly phaseRevision: number;
  readonly arenaIndex: number;
  readonly pulse: PulseView;
  readonly player: PlayerView;
  readonly enemies: EnemyPoolView;
  readonly enemyShots: ProjectilePoolView;
  readonly playerShots: ProjectilePoolView;
  readonly pickups: PickupPoolView;
  readonly dangerAreas: AreaPoolView;
  readonly playerZones: AreaPoolView;
  readonly spawnMarks: SpawnMarkPoolView;
  readonly shop: ShopView;
  readonly levelUp: LevelUpView;
  readonly reward: RewardView;
  readonly runStats: RunStatsView;
}
