// Mutable sim state that is also the read-only WorldView (architecture.md 6.4). Same object every
// tick; pools are SoA typed arrays exposed without copies.

import type {
  BigFoeView,
  InventorySlotView,
  LevelUpView,
  RewardView,
  RunPhase,
  ShopOfferView,
  WorldView,
} from '../core/index.ts';
import {
  DANGER_AREA_CAPACITY,
  ENEMY_CAPACITY,
  ENEMY_SHOT_CAPACITY,
  PICKUP_CAPACITY,
  PLAYER_SHOT_CAPACITY,
  PLAYER_ZONE_CAPACITY,
  SPAWN_MARK_CAPACITY,
} from './capacity.ts';
import {
  createAreaPool,
  createEnemyPool,
  createEnemyShotPool,
  createPickupPool,
  createPlayerShotPool,
  createSpawnMarkPool,
} from './pools.ts';
import type {
  AreaPool,
  EnemyPool,
  EnemyShotPool,
  PickupPool,
  PlayerShotPool,
  SpawnMarkPool,
} from './pools.ts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface PlayerState {
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
  readonly stats: Float64Array;
}

export type BigFoeState = Mutable<BigFoeView>;

export interface PulseState {
  index: number;
  count: number;
  kind: 0 | 1 | 2;
  threat: number;
  ticksLeft: number;
  ticksTotal: number;
  isBoss: boolean;
  overtime: boolean;
  wardenAlive: boolean;
  readonly warden: BigFoeState;
  readonly boss: BigFoeState;
}

export interface ShopState {
  revision: number;
  offers: ShopOfferView[];
  rerollPrice: number;
  freeRerolls: number;
  inventory: InventorySlotView[];
  mementos: { readonly mementoIndex: number; readonly count: number }[];
  readonly tagCounts: Float64Array;
}

export type LevelUpState = Mutable<LevelUpView>;
export type RewardState = Mutable<RewardView>;

export interface RunStatsState {
  kills: number;
  glintEarned: number;
  glintSpent: number;
  pulsesCleared: number;
  runTicks: number;
  silt: number;
  killedBy: number;
  difficulty: number;
}

export interface World extends WorldView {
  tick: number;
  phase: RunPhase;
  phaseRevision: number;
  arenaIndex: number;
  readonly pulse: PulseState;
  readonly player: PlayerState;
  readonly enemies: EnemyPool;
  readonly enemyShots: EnemyShotPool;
  readonly playerShots: PlayerShotPool;
  readonly pickups: PickupPool;
  readonly dangerAreas: AreaPool;
  readonly playerZones: AreaPool;
  readonly spawnMarks: SpawnMarkPool;
  readonly shop: ShopState;
  readonly levelUp: LevelUpState;
  readonly reward: RewardState;
  readonly runStats: RunStatsState;
}

function foe(): BigFoeState {
  return { active: false, typeIndex: -1, hp: 0, maxHp: 0, shield: 0, phase: 0, enraged: false };
}

export function createWorld(statCount: number, tagCount: number, weaponSlots: number): World {
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
      warden: foe(),
      boss: foe(),
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
    enemies: createEnemyPool(ENEMY_CAPACITY, weaponSlots),
    enemyShots: createEnemyShotPool(ENEMY_SHOT_CAPACITY),
    playerShots: createPlayerShotPool(PLAYER_SHOT_CAPACITY),
    pickups: createPickupPool(PICKUP_CAPACITY),
    dangerAreas: createAreaPool(DANGER_AREA_CAPACITY),
    playerZones: createAreaPool(PLAYER_ZONE_CAPACITY),
    spawnMarks: createSpawnMarkPool(SPAWN_MARK_CAPACITY),
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
