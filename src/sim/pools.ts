// Fixed-capacity SoA pools with stable slots and a LIFO free list (architecture.md 8.1).
// Pools implement the matching *PoolView of the WorldView directly, so the view needs no copies.
// Columns beyond the view are sim-internal (architecture 8.2: GP adjusts outside the view).

import { AFFIX_TIMER_STRIDE, BURN_STACK_SLOTS, PIERCE_MEMORY } from './capacity.ts';

export interface PoolCore {
  readonly capacity: number;
  highWater: number;
  /** Live entities. */
  count: number;
  readonly alive: Uint8Array;
  readonly serial: Uint32Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  readonly radius: Float64Array;
  readonly freeList: Int32Array;
  freeTop: number;
}

function createCore(capacity: number): PoolCore {
  const freeList = new Int32Array(capacity);
  for (let i = 0; i < capacity; i++) freeList[i] = capacity - 1 - i;
  return {
    capacity,
    highWater: 0,
    count: 0,
    alive: new Uint8Array(capacity),
    serial: new Uint32Array(capacity),
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    prevX: new Float64Array(capacity),
    prevY: new Float64Array(capacity),
    radius: new Float64Array(capacity),
    freeList,
    freeTop: capacity,
  };
}

/** Take the lowest free slot of the canonical order. Returns -1 when full. Columns are not cleared. */
export function allocSlot(p: PoolCore): number {
  if (p.freeTop === 0) return -1;
  p.freeTop--;
  const i = p.freeList[p.freeTop] ?? -1;
  p.alive[i] = 1;
  p.serial[i] = ((p.serial[i] ?? 0) + 1) >>> 0;
  p.count++;
  if (i + 1 > p.highWater) p.highWater = i + 1;
  return i;
}

export function freeSlot(p: PoolCore, i: number): void {
  if (p.alive[i] === 0) return;
  p.alive[i] = 0;
  p.count--;
  p.freeList[p.freeTop] = i;
  p.freeTop++;
}

/** Canonical reset (architecture 8.1): empty, highWater 0, free list back to its initial order. */
export function resetPool(p: PoolCore): void {
  for (let i = 0; i < p.capacity; i++) {
    p.alive[i] = 0;
    p.freeList[i] = p.capacity - 1 - i;
  }
  p.freeTop = p.capacity;
  p.highWater = 0;
  p.count = 0;
}

export interface EnemyPool extends PoolCore {
  readonly typeIndex: Int32Array;
  readonly rank: Uint8Array;
  readonly hp: Float64Array;
  readonly maxHp: Float64Array;
  readonly shield: Float64Array;
  readonly aiState: Uint8Array;
  readonly aiStateTicks: Int32Array;
  readonly facing: Int8Array;
  readonly hitFlashTicks: Int32Array;
  readonly statusMask: Uint8Array;
  readonly ageTicks: Int32Array;
  // internal
  readonly aiTimer: Int32Array;
  readonly aiCounter: Int32Array;
  readonly dirX: Float64Array;
  readonly dirY: Float64Array;
  readonly kbX: Float64Array;
  readonly kbY: Float64Array;
  readonly kbTicks: Int32Array;
  readonly burnDps: Float64Array;
  readonly burnStacks: Uint8Array;
  readonly burnTicks: Int32Array;
  readonly burnTickTimer: Int32Array;
  readonly slowPct: Float64Array;
  readonly slowTicks: Int32Array;
  readonly markTicks: Int32Array;
  readonly markPct: Float64Array;
  readonly dmgScale: Float64Array;
  readonly speedMult: Float64Array;
  /** 1 when counted toward alive_cap. */
  readonly counted: Uint8Array;
  /** 1 when this Unlit already dealt its charge hit in the current charge. */
  readonly chargeHit: Uint8Array;
  readonly affixMask: Int32Array;
  /** Orbit re-contact cooldown per weapon slot: index slot * weaponSlots + weaponSlot. */
  readonly orbitTimer: Int32Array;
  /** Affix timers, AFFIX_TIMER_STRIDE per slot indexed by AffixIndex (blinking, brood, pulsing, tar). */
  readonly affixTimer: Int32Array;
  /** Blink destination and ticks until the blink lands (0 = none). */
  readonly blinkX: Float64Array;
  readonly blinkY: Float64Array;
  readonly blinkTicks: Int32Array;
  /** Veiled: ticks until the shell regrows (counts down after damage). */
  readonly shellRegrow: Int32Array;
  /** Summoner and brood: summons alive owned by this slot are counted from summonOwner. */
  readonly summonOwner: Int32Array;
  readonly summonOwnerSerial: Uint32Array;
  /** Extra guard from affixes (bulwark), added to the enemies.csv guard. */
  readonly guardAdd: Float64Array;
  /** 1 when immune to knockback (affix bulwark). */
  readonly kbImmune: Uint8Array;
}

export function createEnemyPool(capacity: number, weaponSlots: number): EnemyPool {
  return {
    ...createCore(capacity),
    typeIndex: new Int32Array(capacity),
    rank: new Uint8Array(capacity),
    hp: new Float64Array(capacity),
    maxHp: new Float64Array(capacity),
    shield: new Float64Array(capacity),
    aiState: new Uint8Array(capacity),
    aiStateTicks: new Int32Array(capacity),
    facing: new Int8Array(capacity),
    hitFlashTicks: new Int32Array(capacity),
    statusMask: new Uint8Array(capacity),
    ageTicks: new Int32Array(capacity),
    aiTimer: new Int32Array(capacity),
    aiCounter: new Int32Array(capacity),
    dirX: new Float64Array(capacity),
    dirY: new Float64Array(capacity),
    kbX: new Float64Array(capacity),
    kbY: new Float64Array(capacity),
    kbTicks: new Int32Array(capacity),
    burnDps: new Float64Array(capacity * BURN_STACK_SLOTS),
    burnStacks: new Uint8Array(capacity),
    burnTicks: new Int32Array(capacity),
    burnTickTimer: new Int32Array(capacity),
    slowPct: new Float64Array(capacity),
    slowTicks: new Int32Array(capacity),
    markTicks: new Int32Array(capacity),
    markPct: new Float64Array(capacity),
    dmgScale: new Float64Array(capacity),
    speedMult: new Float64Array(capacity),
    counted: new Uint8Array(capacity),
    chargeHit: new Uint8Array(capacity),
    affixMask: new Int32Array(capacity),
    orbitTimer: new Int32Array(capacity * Math.max(1, weaponSlots)),
    affixTimer: new Int32Array(capacity * AFFIX_TIMER_STRIDE),
    blinkX: new Float64Array(capacity),
    blinkY: new Float64Array(capacity),
    blinkTicks: new Int32Array(capacity),
    shellRegrow: new Int32Array(capacity),
    summonOwner: new Int32Array(capacity),
    summonOwnerSerial: new Uint32Array(capacity),
    guardAdd: new Float64Array(capacity),
    kbImmune: new Uint8Array(capacity),
  };
}

export interface PlayerShotPool extends PoolCore {
  readonly sourceRef: Int32Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  // internal
  readonly mode: Uint8Array;
  readonly dmg: Float64Array;
  /** Bolt explosion damage, or Lob explosion damage. */
  readonly dmg2: Float64Array;
  readonly areaRadius: Float64Array;
  readonly tagMask: Int32Array;
  readonly hitKind: Uint8Array;
  readonly procDepth: Uint8Array;
  readonly isRite: Uint8Array;
  readonly pierceLeft: Int32Array;
  readonly rangeLeft: Float64Array;
  readonly weaponIndex: Int32Array;
  readonly weaponSlot: Int32Array;
  readonly tier: Uint8Array;
  readonly knockback: Float64Array;
  /** Countdown for Lob flight, or orbit period position for Orbit. */
  readonly timer: Int32Array;
  readonly targetX: Float64Array;
  readonly targetY: Float64Array;
  /** Boomerang: 0 outbound, 1 returning. Orbit: shard index. */
  readonly phase: Int32Array;
  readonly hitSerials: Uint32Array;
  readonly hitSlots: Int32Array;
  readonly hitCount: Uint8Array;
  /** 1 for proc projectiles (soft cap PROC_SHOT_SOFT_CAP). */
  readonly isProc: Uint8Array;
  /** Blast extras: status applied (-1 none), fire zone radius and ticks, zone slow and tick interval. */
  readonly blastStatus: Int8Array;
  readonly zoneRadius: Float64Array;
  readonly zoneTicks: Int32Array;
  readonly zoneSlow: Float64Array;
  readonly zoneTick: Int32Array;
  /** Coin: bounces left (tier IV bounce). */
  readonly bounceLeft: Int32Array;
}

export function createPlayerShotPool(capacity: number): PlayerShotPool {
  return {
    ...createCore(capacity),
    sourceRef: new Int32Array(capacity),
    vx: new Float64Array(capacity),
    vy: new Float64Array(capacity),
    mode: new Uint8Array(capacity),
    dmg: new Float64Array(capacity),
    dmg2: new Float64Array(capacity),
    areaRadius: new Float64Array(capacity),
    tagMask: new Int32Array(capacity),
    hitKind: new Uint8Array(capacity),
    procDepth: new Uint8Array(capacity),
    isRite: new Uint8Array(capacity),
    pierceLeft: new Int32Array(capacity),
    rangeLeft: new Float64Array(capacity),
    weaponIndex: new Int32Array(capacity),
    weaponSlot: new Int32Array(capacity),
    tier: new Uint8Array(capacity),
    knockback: new Float64Array(capacity),
    timer: new Int32Array(capacity),
    targetX: new Float64Array(capacity),
    targetY: new Float64Array(capacity),
    phase: new Int32Array(capacity),
    hitSerials: new Uint32Array(capacity * PIERCE_MEMORY),
    hitSlots: new Int32Array(capacity * PIERCE_MEMORY),
    hitCount: new Uint8Array(capacity),
    isProc: new Uint8Array(capacity),
    blastStatus: new Int8Array(capacity),
    zoneRadius: new Float64Array(capacity),
    zoneTicks: new Int32Array(capacity),
    zoneSlow: new Float64Array(capacity),
    zoneTick: new Int32Array(capacity),
    bounceLeft: new Int32Array(capacity),
  };
}

export interface EnemyShotPool extends PoolCore {
  readonly sourceRef: Int32Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly dmg: Float64Array;
  readonly lifeTicks: Int32Array;
}

export function createEnemyShotPool(capacity: number): EnemyShotPool {
  return {
    ...createCore(capacity),
    sourceRef: new Int32Array(capacity),
    vx: new Float64Array(capacity),
    vy: new Float64Array(capacity),
    dmg: new Float64Array(capacity),
    lifeTicks: new Int32Array(capacity),
  };
}

export interface PickupPool extends PoolCore {
  readonly kind: Uint8Array;
  readonly amount: Float64Array;
  readonly magnetized: Uint8Array;
  readonly dropTick: Int32Array;
  /** Ticks since magnetized (view flyTicks) and current fly speed in u/tick. */
  readonly flyTicks: Int32Array;
  readonly flySpeed: Float64Array;
}

export function createPickupPool(capacity: number): PickupPool {
  return {
    ...createCore(capacity),
    kind: new Uint8Array(capacity),
    amount: new Float64Array(capacity),
    magnetized: new Uint8Array(capacity),
    dropTick: new Int32Array(capacity),
    flyTicks: new Int32Array(capacity),
    flySpeed: new Float64Array(capacity),
  };
}

export interface AreaPool extends PoolCore {
  readonly shape: Uint8Array;
  readonly kind: Uint8Array;
  readonly sourceRef: Int32Array;
  readonly x2: Float64Array;
  readonly y2: Float64Array;
  readonly p0: Float64Array;
  readonly p1: Float64Array;
  readonly p2: Float64Array;
  readonly ticksLeft: Int32Array;
  readonly ticksTotal: Int32Array;
  // internal
  readonly mode: Uint8Array;
  readonly dmg: Float64Array;
  /** Enemy slot whose position the area follows (-1 none), with its serial. */
  readonly owner: Int32Array;
  readonly ownerSerial: Uint32Array;
  /** Expanding ring speed (u/tick) and max radius; lane shot speed. */
  readonly speed: Float64Array;
  readonly maxRadius: Float64Array;
  /** Player zones: damage tick interval and timer. */
  readonly tickEvery: Int32Array;
  readonly tickTimer: Int32Array;
  readonly burnDps: Float64Array;
  readonly slowPct: Float64Array;
  readonly procDepth: Uint8Array;
  readonly tagMask: Int32Array;
  /** 1 once the player was hit by this area (ring, strike). */
  readonly done: Uint8Array;
}

export function createAreaPool(capacity: number): AreaPool {
  return {
    ...createCore(capacity),
    shape: new Uint8Array(capacity),
    kind: new Uint8Array(capacity),
    sourceRef: new Int32Array(capacity),
    x2: new Float64Array(capacity),
    y2: new Float64Array(capacity),
    p0: new Float64Array(capacity),
    p1: new Float64Array(capacity),
    p2: new Float64Array(capacity),
    ticksLeft: new Int32Array(capacity),
    ticksTotal: new Int32Array(capacity),
    mode: new Uint8Array(capacity),
    dmg: new Float64Array(capacity),
    owner: new Int32Array(capacity),
    ownerSerial: new Uint32Array(capacity),
    speed: new Float64Array(capacity),
    maxRadius: new Float64Array(capacity),
    tickEvery: new Int32Array(capacity),
    tickTimer: new Int32Array(capacity),
    burnDps: new Float64Array(capacity),
    slowPct: new Float64Array(capacity),
    procDepth: new Uint8Array(capacity),
    tagMask: new Int32Array(capacity),
    done: new Uint8Array(capacity),
  };
}

export interface SpawnMarkPool extends PoolCore {
  readonly typeIndex: Int32Array;
  readonly ticksLeft: Int32Array;
  readonly ticksTotal: Int32Array;
  // internal
  readonly members: Int32Array;
  readonly counted: Uint8Array;
  /** Enemy slot that summoned this group (summoner, brood), with its serial; -1 none. */
  readonly owner: Int32Array;
  readonly ownerSerial: Uint32Array;
}

export function createSpawnMarkPool(capacity: number): SpawnMarkPool {
  return {
    ...createCore(capacity),
    typeIndex: new Int32Array(capacity),
    ticksLeft: new Int32Array(capacity),
    ticksTotal: new Int32Array(capacity),
    members: new Int32Array(capacity),
    counted: new Uint8Array(capacity),
    owner: new Int32Array(capacity),
    ownerSerial: new Uint32Array(capacity),
  };
}

/** Delayed actions (repeat, echoes, delayed areas), processed by due tick then insertion order. */
export interface PendingPool extends PoolCore {
  readonly kind: Uint8Array;
  readonly dueTick: Int32Array;
  readonly seq: Int32Array;
  readonly effect: Int32Array;
  readonly dmg: Float64Array;
  readonly power: Float64Array;
  readonly procDepth: Uint8Array;
  readonly tagMask: Int32Array;
  readonly target: Int32Array;
  readonly targetSerial: Uint32Array;
  readonly sourceRef: Int32Array;
  readonly weaponSlot: Int32Array;
}

export function createPendingPool(capacity: number): PendingPool {
  return {
    ...createCore(capacity),
    kind: new Uint8Array(capacity),
    dueTick: new Int32Array(capacity),
    seq: new Int32Array(capacity),
    effect: new Int32Array(capacity),
    dmg: new Float64Array(capacity),
    power: new Float64Array(capacity),
    procDepth: new Uint8Array(capacity),
    tagMask: new Int32Array(capacity),
    target: new Int32Array(capacity),
    targetSerial: new Uint32Array(capacity),
    sourceRef: new Int32Array(capacity),
    weaponSlot: new Int32Array(capacity),
  };
}
