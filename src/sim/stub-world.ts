// STUB owned by GP: an empty, mutable WorldView backing the placeholder sim. Replace in M1-03.
// Pools have capacity 0 here; the real sim allocates SoA pools from src/sim/capacity.ts.

import type {
  AreaPoolView,
  BigFoeView,
  EnemyPoolView,
  PickupPoolView,
  ProjectilePoolView,
  RunPhase,
  SpawnMarkPoolView,
  WorldView,
} from '../core/index.ts';

const EMPTY = new Float64Array(0);

export interface StubPlayer {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  radius: number;
  facing: number;
  classIndex: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  glint: number;
  riteIndex: number;
  riteCooldownTicks: number;
  riteCooldownMaxTicks: number;
  riteCharges: number;
  riteChargesMax: number;
  barrier: number;
  barrierMax: number;
  invulnTicks: number;
  hitFlashTicks: number;
  stats: Float64Array;
}

export interface StubWorld extends WorldView {
  tick: number;
  phase: RunPhase;
  phaseRevision: number;
  readonly player: StubPlayer;
}

const pool = {
  capacity: 0,
  highWater: 0,
  alive: EMPTY,
  serial: EMPTY,
  x: EMPTY,
  y: EMPTY,
  prevX: EMPTY,
  prevY: EMPTY,
  radius: EMPTY,
};

const enemies: EnemyPoolView = {
  ...pool,
  typeIndex: EMPTY,
  rank: EMPTY,
  hp: EMPTY,
  maxHp: EMPTY,
  shield: EMPTY,
  aiState: EMPTY,
  aiStateTicks: EMPTY,
  facing: EMPTY,
  hitFlashTicks: EMPTY,
  statusMask: EMPTY,
  ageTicks: EMPTY,
};
const shots: ProjectilePoolView = { ...pool, sourceRef: EMPTY, vx: EMPTY, vy: EMPTY };
const pickups: PickupPoolView = { ...pool, kind: EMPTY, amount: EMPTY, magnetized: EMPTY };
const areas: AreaPoolView = {
  ...pool,
  shape: EMPTY,
  kind: EMPTY,
  sourceRef: EMPTY,
  x2: EMPTY,
  y2: EMPTY,
  p0: EMPTY,
  p1: EMPTY,
  p2: EMPTY,
  ticksLeft: EMPTY,
  ticksTotal: EMPTY,
};
const marks: SpawnMarkPoolView = { ...pool, typeIndex: EMPTY, ticksLeft: EMPTY, ticksTotal: EMPTY };
const noFoe: BigFoeView = {
  active: false,
  typeIndex: -1,
  hp: 0,
  maxHp: 0,
  shield: 0,
  phase: 0,
  enraged: false,
};

export function createStubWorld(statCount: number, tagCount: number): StubWorld {
  return {
    tick: 0,
    phase: 'idle',
    phaseRevision: 0,
    arenaIndex: 0,
    pulse: {
      index: 0,
      count: 0,
      kind: 0,
      threat: 0,
      ticksLeft: 0,
      ticksTotal: 0,
      isBoss: false,
      overtime: false,
      wardenAlive: false,
      warden: noFoe,
      boss: noFoe,
    },
    player: {
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      radius: 0,
      facing: 1,
      classIndex: 0,
      hp: 0,
      maxHp: 0,
      level: 1,
      xp: 0,
      xpToNext: 0,
      glint: 0,
      riteIndex: 0,
      riteCooldownTicks: 0,
      riteCooldownMaxTicks: 0,
      riteCharges: 0,
      riteChargesMax: 0,
      barrier: 0,
      barrierMax: 0,
      invulnTicks: 0,
      hitFlashTicks: 0,
      stats: new Float64Array(statCount),
    },
    enemies,
    enemyShots: shots,
    playerShots: shots,
    pickups,
    dangerAreas: areas,
    playerZones: areas,
    spawnMarks: marks,
    shop: {
      revision: 0,
      offers: [],
      rerollPrice: 0,
      freeRerolls: 0,
      inventory: [],
      mementos: [],
      tagCounts: new Float64Array(tagCount),
    },
    levelUp: { revision: 0, pending: 0, total: 0, choices: [] },
    reward: { revision: 0, sourceTypeIndex: -1, choices: [] },
    runStats: {
      kills: 0,
      glintEarned: 0,
      glintSpent: 0,
      pulsesCleared: 0,
      runTicks: 0,
      silt: 0,
      killedBy: 0,
      difficulty: 0,
    },
  };
}
