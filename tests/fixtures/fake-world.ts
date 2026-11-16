// Fake WorldView for UI and render work before the real sim lands (architecture.md 5, 16).
// Mutable on purpose: tests and dev harnesses set fields, then pass it as a read-only WorldView.

import type {
  AreaPoolView,
  BigFoeView,
  EnemyPoolView,
  PickupPoolView,
  ProjectilePoolView,
  PulseView,
  RunPhase,
  SpawnMarkPoolView,
  WorldView,
} from '../../src/core/index.ts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface FakeWorldOptions {
  readonly phase?: RunPhase;
  readonly enemies?: number;
  readonly enemyShots?: number;
  readonly playerShots?: number;
  readonly pickups?: number;
  readonly statCount?: number;
  readonly tagCount?: number;
}

function pool(n: number): {
  capacity: number;
  highWater: number;
  alive: Uint8Array;
  serial: Uint32Array;
  x: Float64Array;
  y: Float64Array;
  prevX: Float64Array;
  prevY: Float64Array;
  radius: Float64Array;
} {
  const alive = new Uint8Array(n).fill(1);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  // Spread entities on a ring inside the 32 x 20 u arena, deterministic.
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    x[i] = Math.cos(a) * 10;
    y[i] = Math.sin(a) * 6;
  }
  return {
    capacity: n,
    highWater: n,
    alive,
    serial: new Uint32Array(n),
    x,
    y,
    prevX: x.slice(),
    prevY: y.slice(),
    radius: new Float64Array(n).fill(0.4),
  };
}

const foe = (): Mutable<BigFoeView> => ({
  active: false,
  typeIndex: -1,
  hp: 0,
  maxHp: 0,
  shield: 0,
  phase: 0,
  enraged: false,
});

/**
 * Omit first: an intersection with the read-only WorldView members would keep pulse and player
 * fields read-only, so tests could not write w.pulse.index or w.player.hp directly (LP, M1-09a).
 */
export type FakeWorld = Omit<Mutable<WorldView>, 'pulse' | 'player'> & {
  pulse: Mutable<PulseView>;
  player: Mutable<WorldView['player']>;
};

export function createFakeWorld(opts: FakeWorldOptions = {}): FakeWorld {
  const n = (k: number | undefined): number => k ?? 0;
  const enemies: EnemyPoolView = {
    ...pool(n(opts.enemies)),
    typeIndex: new Int32Array(n(opts.enemies)),
    rank: new Uint8Array(n(opts.enemies)),
    hp: new Float64Array(n(opts.enemies)).fill(10),
    maxHp: new Float64Array(n(opts.enemies)).fill(10),
    shield: new Float64Array(n(opts.enemies)),
    aiState: new Uint8Array(n(opts.enemies)),
    aiStateTicks: new Int32Array(n(opts.enemies)),
    facing: new Int8Array(n(opts.enemies)).fill(1),
    hitFlashTicks: new Int32Array(n(opts.enemies)),
    statusMask: new Uint8Array(n(opts.enemies)),
    ageTicks: new Int32Array(n(opts.enemies)),
  };
  const shots = (k: number): ProjectilePoolView => ({
    ...pool(k),
    sourceRef: new Int32Array(k),
    vx: new Float64Array(k),
    vy: new Float64Array(k),
  });
  const pickups: PickupPoolView = {
    ...pool(n(opts.pickups)),
    kind: new Uint8Array(n(opts.pickups)),
    amount: new Float64Array(n(opts.pickups)).fill(1),
    magnetized: new Uint8Array(n(opts.pickups)),
  };
  const areas = (): AreaPoolView => ({
    ...pool(0),
    shape: new Uint8Array(0),
    kind: new Uint8Array(0),
    sourceRef: new Int32Array(0),
    x2: new Float64Array(0),
    y2: new Float64Array(0),
    p0: new Float64Array(0),
    p1: new Float64Array(0),
    p2: new Float64Array(0),
    ticksLeft: new Int32Array(0),
    ticksTotal: new Int32Array(0),
  });
  const marks: SpawnMarkPoolView = {
    ...pool(0),
    typeIndex: new Int32Array(0),
    ticksLeft: new Int32Array(0),
    ticksTotal: new Int32Array(0),
  };
  return {
    tick: 0,
    phase: opts.phase ?? 'pulse',
    phaseRevision: 1,
    arenaIndex: 0,
    pulse: {
      index: 0,
      count: 10,
      kind: 0,
      threat: 1,
      ticksLeft: 1200,
      ticksTotal: 1200,
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
      radius: 0.35,
      facing: 1,
      classIndex: 0,
      hp: 30,
      maxHp: 30,
      level: 1,
      xp: 0,
      xpToNext: 15,
      glint: 0,
      riteIndex: 0,
      riteCooldownTicks: 0,
      riteCooldownMaxTicks: 720,
      riteCharges: 1,
      riteChargesMax: 1,
      barrier: 0,
      barrierMax: 0,
      invulnTicks: 0,
      hitFlashTicks: 0,
      stats: new Float64Array(opts.statCount ?? 0),
    },
    enemies,
    enemyShots: shots(n(opts.enemyShots)),
    playerShots: shots(n(opts.playerShots)),
    pickups,
    dangerAreas: areas(),
    playerZones: areas(),
    spawnMarks: marks,
    shop: {
      revision: 0,
      offers: [],
      rerollPrice: 0,
      freeRerolls: 0,
      inventory: [],
      mementos: [],
      tagCounts: new Float64Array(opts.tagCount ?? 6),
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
