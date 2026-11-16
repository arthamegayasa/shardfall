// Shared sim context: world, data, RNG streams, event buffer, and the run state that is not part of
// the WorldView. Systems are plain functions taking this context (coding-standards 3.7).

import type { EventBuffer, Rng, RngStreamName } from '../core/index.ts';
import type { ConfigValues, DifficultyDef, GameData, PulseSlotDef } from '../content/index.ts';
import type { ArenaGeom } from './arena.ts';
import {
  PENDING_ACTION_CAPACITY,
  PER_TARGET_COUNTER_EFFECTS,
  SCHEDULE_CAPACITY,
} from './capacity.ts';
import { createPendingPool } from './pools.ts';
import type { PendingPool } from './pools.ts';
import type { SimData } from './sim-data.ts';
import type { SpatialHash } from './spatial-hash.ts';
import type { ShotSpec } from './systems/projectiles.ts';
import type { World } from './world.ts';

/** Offer state kept by the sim (the view is rebuilt from it on every shop change). */
export interface OfferState {
  /** OfferKind */
  kind: number;
  defIndex: number;
  tier: number;
  locked: boolean;
  /** For Taken offers: the kind that was bought (save keeps its id). Equals kind otherwise. */
  boughtKind: number;
}

export interface CardChoice {
  readonly cardIndex: number;
  readonly rarity: number;
  readonly value: number;
}

/** Hooks set by the effect engine so combat and pickups can raise triggers without import cycles. */
export interface EffectHooks {
  /** Steps 2 to 4 of effect-primitives 6.1 (force crit, crit roll, hit_mod sums) on ctx.hit. */
  preHit(ctx: SimCtx): void;
  /** Step 7 (on_hit, on_crit). */
  postHit(ctx: SimCtx): void;
  /** Step 8 (on_kill). */
  onKill(ctx: SimCtx): void;
  onPlayerEvent(ctx: SimCtx, trigger: number, sourceRef: number, amount: number): void;
  onArea(
    ctx: SimCtx,
    x: number,
    y: number,
    radius: number,
    dmg: number,
    tagMask: number,
    procDepth: number,
  ): void;
  onProjectileEnd(ctx: SimCtx, slot: number): void;
  onRite(ctx: SimCtx, x: number, y: number): void;
}

export interface RunState {
  started: boolean;
  seed: number;
  classIndex: number;
  classId: string;
  profile: string;
  slots: readonly PulseSlotDef[];
  difficulty: number;
  diff: DifficultyDef | null;
  // Current Pulse scaling (GDD 5.2, 5.3, 5.5).
  threat: number;
  hpScale: number;
  dmgScale: number;
  procScale: number;
  pulseTick: number;
  // Weapons, slot order (GDD 4.4).
  readonly weaponIndex: Int32Array;
  readonly weaponTier: Uint8Array;
  readonly weaponCd: Int32Array;
  readonly weaponShots: Int32Array;
  readonly weaponTimer: Int32Array;
  // Mementos in acquisition order (effect order, effect-primitives 6.1).
  mementoOrder: number[];
  readonly mementoCount: Int32Array;
  // Level-up.
  levelUpPicks: { readonly cardIndex: number; readonly rarity: number }[];
  readonly statCardAdd: Float64Array;
  pendingLevelUps: number;
  levelsThisPulse: number;
  levelChoices: CardChoice[];
  // Reward.
  rewardPending: boolean;
  rewardChoices: number[];
  rewardSourceType: number;
  // Shop.
  offers: OfferState[];
  rerollCount: number;
  freeRerollsUsed: number;
  // Sequencing timers (-1 = inactive).
  clearTicks: number;
  deathTicks: number;
  victoryTicks: number;
  pendingOutcome: number;
  // Warden.
  wardenType: number;
  wardenSpawnTick: number;
  wardenSlot: number;
  wardenSpawned: boolean;
  wardenKilled: boolean;
  overtimeTicks: number;
  hasteApplied: boolean;
  // Boss.
  bossType: number;
  bossSlot: number;
  bossEntryTicks: number;
  bossPhase: number;
  bossCyclePos: number;
  bossGapTicks: number;
  bossTransitionTicks: number;
  bossFightTicks: number;
  bossEnraged: boolean;
  bossTrickleTicks: number;
  bossKilled: boolean;
  bossPatternIndex: number;
  bossPatternTicks: number;
  bossPatternStep: number;
  /** Duration of the running boss pattern (ticks), for its timed steps. */
  bossPatternTotal: number;
  /** Boss HP cannot drop below this while a phase transition is pending (GDD 16). 0 = none. */
  bossHpFloor: number;
  // Player and effect state.
  unhurtThisPulse: boolean;
  lastHurtTick: number;
  distanceAcc: number;
  critForcedHits: number;
  critForcedTicks: number;
  barrierTimer: number;
  riteTimer: number;
  leechWindowTick: number;
  leechHealed: number;
  glintStreak: number;
  lastPickupTick: number;
  statsDirty: boolean;
  passiveMask: number;
  /** Last emitted PlayerHpLowChanged and MusicPressureChanged states (events only, not hashed). */
  lowHpSignal: boolean;
  pressureSignal: boolean;
  /** A held_glint convert is active: Glint changes dirty the stats. */
  glintConvert: boolean;
  /** Per effect: next tick the effect may fire (icd), fires this Pulse, periodic timer. */
  readonly effectNextTick: Int32Array;
  readonly effectFires: Int32Array;
  readonly effectTimer: Int32Array;
  readonly effectCounter: Int32Array;
  /** Per effect: floor distance walked toward the next on_distance trigger (u). */
  readonly effectDist: Float64Array;
  /** Per effect x weapon slot every_nth counters. */
  readonly effectWeaponCounter: Int32Array;
  /** per_target counters: counter slot x enemy slot, with the enemy serial seen. */
  readonly targetCounter: Int32Array;
  readonly targetCounterSerial: Uint32Array;
  /** Buff stacks and remaining ticks per effect. */
  readonly buffStacks: Int32Array;
  readonly buffTicks: Int32Array;
  /** Heal rate window per effect: start tick and amount healed in the window. */
  readonly healWindowTick: Int32Array;
  readonly healAmount: Float64Array;
  // Rules from passive effects (status_rule, shop_mod), recomputed with stats.
  burnDmgMult: number;
  burnSpreadChance: number;
  burnSpreadRange: number;
  burnAddMark: number;
  knockbackAddMark: number;
  shopSlotsAdd: number;
  shopPriceMult: number;
  shopRerollDelta: number;
  shopFreeRerolls: number;
  // Spawn schedule of the current Pulse (GDD 3.2), SoA in time order.
  scheduleCount: number;
  scheduleNext: number;
  readonly schedTick: Int32Array;
  readonly schedType: Int32Array;
  readonly schedSize: Int32Array;
  readonly schedSector: Int32Array;
  /** FIFO of schedule entries waiting for room under alive_cap. */
  queueHead: number;
  queueTail: number;
  readonly queue: Int32Array;
  pendingSeq: number;
  /** Synergy thresholds currently active, bit per synergy row index. */
  synergyMask: number;
  /** Silt from killed Wardens and bosses (enemies.csv silt column), content tiers B and C. */
  siltKills: number;
  /**
   * Meta unlock ids owned when the run started (run.start, kept in the save), data order. LP M2-09.
   * weaponOpen / mementoOpen: 1 when the shop and chests may offer the weapon or Memento.
   */
  unlocked: readonly string[];
  weaponOpen: Uint8Array;
  mementoOpen: Uint8Array;
  /** Per effect: per_target counter slot (assigned to active effects in order), -1 none (MAYOR M1-19). */
  readonly targetSlotOf: Int32Array;
  /** Per weapon slot: Glint dropped by coin kills this Pulse (tithe_coin cap, GDD 4.1). */
  readonly coinGlint: Int32Array;
  /** Per weapon slot: ticks until the next orbit lunge, and ticks left in the current lunge. */
  readonly lungeTimer: Int32Array;
  readonly lungeTicks: Int32Array;
  // Boss pattern execution state (multi-step patterns: spiral, cone repeats, blink, charge, summon).
  bossPatX: number;
  bossPatY: number;
  bossPatDirX: number;
  bossPatDirY: number;
  bossPatAngle: number;
  bossPatHit: boolean;
  /** Slow on the player from enemy zones (affix tar_trail, GDD 5.4), strongest wins. */
  playerSlowPct: number;
  playerSlowTicks: number;
}

export interface HitCtx {
  target: number;
  targetSerial: number;
  sourceRef: number;
  weaponIndex: number;
  weaponSlot: number;
  tagMask: number;
  hitKind: number;
  procDepth: number;
  isRite: boolean;
  base: number;
  crit: boolean;
  forceCrit: boolean;
  bonus: number;
  vuln: number;
  critMultAdd: number;
  /** hit after bonus and vulnerability, before crit and guard (Burn base, effect-primitives 6.6). */
  preCrit: number;
  final: number;
  hpBefore: number;
  killed: boolean;
  executed: boolean;
  x: number;
  y: number;
  /** Event radius (on_area) and amount (on_pickup, on_hurt): trigger payloads kept per hit level. */
  radius: number;
  amount: number;
  knockback: number;
  /** Status to apply from the source itself (Lantern Bolt blast: burn), -1 none. */
  status: number;
  /** Burn chance from the source (Chain Spark burn_chance), 0 none. */
  statusChance: number;
  noLeech: boolean;
}

/**
 * Effects of the current owners in evaluation order (effect-primitives 6.1): class passive, Mementos
 * in acquisition order, synergies by tag order and ascending threshold. Rebuilt on inventory change.
 */
export interface ActiveEffects {
  count: number;
  readonly effect: Int32Array;
  readonly copies: Int32Array;
  /** Entries grouped by trigger: entries of trigger t are order[start[t] .. start[t + 1]). */
  readonly order: Int32Array;
  readonly start: Int32Array;
}

export interface SimCtx {
  readonly active: ActiveEffects;
  readonly data: GameData;
  readonly sd: SimData;
  readonly cfg: ConfigValues;
  readonly world: World;
  readonly rng: Readonly<Record<RngStreamName, Rng>>;
  readonly events: EventBuffer;
  readonly debug: boolean;
  arena: ArenaGeom | null;
  grid: SpatialHash | null;
  readonly scratch: Int32Array;
  readonly scratch2: Int32Array;
  /** One spatial query buffer per hit nesting depth (area hits can nest through on_kill). */
  readonly queryBufs: readonly Int32Array[];
  readonly pending: PendingPool;
  run: RunState;
  /** Hit context stack (procDepth nesting). hits[depth] is the current hit at that nesting level. */
  readonly hits: HitCtx[];
  hitDepth: number;
  fx: EffectHooks;
  /** Reusable projectile spawn description. */
  readonly shot: ShotSpec;
  /** Pool overflow counter (architecture 8.1, getPerf().poolOverflow is read by app). */
  poolOverflow: number;
  /** Live proc projectiles, recounted at the start of each pulse tick and raised per proc spawn. */
  procLive: number;
}

export function createHitCtx(): HitCtx {
  return {
    target: -1,
    targetSerial: 0,
    sourceRef: 0,
    weaponIndex: -1,
    weaponSlot: -1,
    tagMask: 0,
    hitKind: 0,
    procDepth: 0,
    isRite: false,
    base: 0,
    crit: false,
    forceCrit: false,
    bonus: 0,
    vuln: 0,
    critMultAdd: 0,
    preCrit: 0,
    final: 0,
    hpBefore: 0,
    killed: false,
    executed: false,
    x: 0,
    y: 0,
    radius: 0,
    amount: 0,
    knockback: 0,
    status: -1,
    statusChance: 0,
    noLeech: false,
  };
}

export function createRunState(
  weaponSlots: number,
  mementoCount: number,
  statCount: number,
  effectCount: number,
  enemyCapacity: number,
): RunState {
  const slots = Math.max(1, weaponSlots);
  return {
    started: false,
    seed: 0,
    classIndex: 0,
    classId: '',
    profile: '',
    slots: [],
    difficulty: 0,
    diff: null,
    threat: 1,
    hpScale: 1,
    dmgScale: 1,
    procScale: 1,
    pulseTick: 0,
    weaponIndex: new Int32Array(slots).fill(-1),
    weaponTier: new Uint8Array(slots),
    weaponCd: new Int32Array(slots),
    weaponShots: new Int32Array(slots),
    weaponTimer: new Int32Array(slots),
    mementoOrder: [],
    mementoCount: new Int32Array(mementoCount),
    levelUpPicks: [],
    statCardAdd: new Float64Array(statCount),
    pendingLevelUps: 0,
    levelsThisPulse: 0,
    levelChoices: [],
    rewardPending: false,
    rewardChoices: [],
    rewardSourceType: -1,
    offers: [],
    rerollCount: 0,
    freeRerollsUsed: 0,
    clearTicks: -1,
    deathTicks: -1,
    victoryTicks: -1,
    pendingOutcome: -1,
    wardenType: -1,
    wardenSpawnTick: -1,
    wardenSlot: -1,
    wardenSpawned: false,
    wardenKilled: false,
    overtimeTicks: 0,
    hasteApplied: false,
    bossType: -1,
    bossSlot: -1,
    bossEntryTicks: -1,
    bossPhase: 0,
    bossCyclePos: 0,
    bossGapTicks: 0,
    bossTransitionTicks: 0,
    bossFightTicks: 0,
    bossEnraged: false,
    bossTrickleTicks: 0,
    bossKilled: false,
    bossPatternIndex: -1,
    bossPatternTicks: 0,
    bossPatternStep: 0,
    bossPatternTotal: 0,
    bossHpFloor: 0,
    unhurtThisPulse: true,
    lastHurtTick: 0,
    distanceAcc: 0,
    critForcedHits: 0,
    critForcedTicks: 0,
    barrierTimer: 0,
    riteTimer: 0,
    leechWindowTick: 0,
    leechHealed: 0,
    glintStreak: 0,
    lastPickupTick: 0,
    statsDirty: true,
    passiveMask: 0,
    lowHpSignal: false,
    pressureSignal: false,
    glintConvert: false,
    effectNextTick: new Int32Array(effectCount),
    effectFires: new Int32Array(effectCount),
    effectTimer: new Int32Array(effectCount),
    effectCounter: new Int32Array(effectCount),
    effectDist: new Float64Array(effectCount),
    effectWeaponCounter: new Int32Array(effectCount * slots),
    targetCounter: new Int32Array(PER_TARGET_COUNTER_EFFECTS * enemyCapacity),
    targetCounterSerial: new Uint32Array(PER_TARGET_COUNTER_EFFECTS * enemyCapacity),
    buffStacks: new Int32Array(effectCount),
    buffTicks: new Int32Array(effectCount),
    healWindowTick: new Int32Array(effectCount),
    healAmount: new Float64Array(effectCount),
    burnDmgMult: 1,
    burnSpreadChance: 0,
    burnSpreadRange: 0,
    burnAddMark: 0,
    knockbackAddMark: 0,
    shopSlotsAdd: 0,
    shopPriceMult: 1,
    shopRerollDelta: 0,
    shopFreeRerolls: 0,
    scheduleCount: 0,
    scheduleNext: 0,
    schedTick: new Int32Array(SCHEDULE_CAPACITY),
    schedType: new Int32Array(SCHEDULE_CAPACITY),
    schedSize: new Int32Array(SCHEDULE_CAPACITY),
    schedSector: new Int32Array(SCHEDULE_CAPACITY),
    queueHead: 0,
    queueTail: 0,
    queue: new Int32Array(SCHEDULE_CAPACITY),
    pendingSeq: 0,
    synergyMask: 0,
    siltKills: 0,
    unlocked: [],
    weaponOpen: new Uint8Array(0),
    mementoOpen: new Uint8Array(0),
    targetSlotOf: new Int32Array(effectCount).fill(-1),
    coinGlint: new Int32Array(slots),
    lungeTimer: new Int32Array(slots),
    lungeTicks: new Int32Array(slots),
    bossPatX: 0,
    bossPatY: 0,
    bossPatDirX: 0,
    bossPatDirY: 0,
    bossPatAngle: 0,
    bossPatHit: false,
    playerSlowPct: 0,
    playerSlowTicks: 0,
  };
}

export function createPending(): PendingPool {
  return createPendingPool(PENDING_ACTION_CAPACITY);
}

/** Read a stat's final value; missing stats read as `neutral`. */
export function statOf(ctx: SimCtx, slot: number, neutral: number): number {
  if (slot < 0) return neutral;
  return ctx.world.player.stats[slot] ?? neutral;
}
