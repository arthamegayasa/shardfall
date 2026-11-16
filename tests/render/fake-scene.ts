// A busy M1 arena moment built on tests/fixtures/fake-world.ts (AD, M1-05). Browser-safe: no Node APIs.
// Used by tests/render/entity-layers.test.ts and the visual preview (tests/render/preview/).
// Enemy type indices follow PREVIEW_DATA.enemies; weapon indices follow PREVIEW_DATA.weapons.

import {
  AreaShape,
  encodeSource,
  EnemyRank,
  SimEventType,
  SourceKind,
  StatusBit,
  TelegraphKind,
} from '../../src/core/index.ts';
import type {
  AreaPoolView,
  PlayerView,
  SimEventReader,
  SpawnMarkPoolView,
} from '../../src/core/index.ts';
import type { GameData } from '../../src/content/index.ts';
import { createFakeWorld } from '../fixtures/fake-world.ts';
import type { FakeWorld } from '../fixtures/fake-world.ts';

/** Only the fields the renderer reads (class, enemy, weapon ids). Tier A ids from GDD 2.3. */
export const PREVIEW_DATA = {
  classes: [{ id: 'lantern' }],
  enemies: [
    { id: 'swarmer', role: 'swarmer', behavior: 'swarmer', sizeClass: 'small' },
    { id: 'charger', role: 'charger', behavior: 'charger', sizeClass: 'medium' },
    { id: 'shooter', role: 'shooter', behavior: 'shooter', sizeClass: 'medium' },
    { id: 'tank', role: 'tank', behavior: 'tank', sizeClass: 'large' },
    { id: 'warden_hound', role: 'warden', behavior: 'warden_hound', sizeClass: 'warden' },
    { id: 'boss_lantern', role: 'boss', behavior: 'boss_lantern', sizeClass: 'boss' },
  ],
  weapons: [
    { id: 'lantern_bolt' },
    { id: 'splinter_shot' },
    { id: 'arc_blade' },
    { id: 'orbit_shards' },
    { id: 'chain_spark' },
    { id: 'returning_glaive' },
  ],
} as unknown as GameData;

export const E = { swarmer: 0, charger: 1, shooter: 2, tank: 3, warden: 4, boss: 5 } as const;
export const W = { bolt: 0, splinter: 1, arc: 2, orbit: 3, spark: 4, glaive: 5 } as const;

function areas(n: number): AreaPoolView {
  return {
    capacity: n,
    highWater: 0,
    alive: new Uint8Array(n),
    serial: new Uint32Array(n),
    x: new Float64Array(n),
    y: new Float64Array(n),
    prevX: new Float64Array(n),
    prevY: new Float64Array(n),
    radius: new Float64Array(n),
    shape: new Uint8Array(n),
    kind: new Uint8Array(n),
    sourceRef: new Int32Array(n),
    x2: new Float64Array(n),
    y2: new Float64Array(n),
    p0: new Float64Array(n),
    p1: new Float64Array(n),
    p2: new Float64Array(n),
    ticksLeft: new Int32Array(n),
    ticksTotal: new Int32Array(n),
  };
}

type MutablePool = { highWater: number } & Record<string, unknown>;
const col = (pool: object, name: string): Float64Array =>
  (pool as Record<string, Float64Array>)[name] as Float64Array;

/** Write one slot of any pool: every key of `values` is a column name. */
function put(pool: object, i: number, values: Readonly<Record<string, number>>): void {
  for (const [k, v] of Object.entries(values)) col(pool, k)[i] = v;
  col(pool, 'alive')[i] = 1;
  const p = pool as MutablePool;
  p.highWater = Math.max(p.highWater, i + 1);
}

/** Slot that moved by (dx, dy) this tick: prev = position - delta. */
function at(x: number, y: number, dx = 0, dy = 0): Record<string, number> {
  return { x, y, prevX: x - dx, prevY: y - dy };
}

type MutablePlayer = { -readonly [K in keyof PlayerView]: PlayerView[K] };

/** Writable player of a fake world (FakeWorld's intersection type leaves the fields readonly). */
export function playerOf(world: FakeWorld): MutablePlayer {
  const player: MutablePlayer = world.player;
  return player;
}

export const NO_EVENTS: SimEventReader = {
  count: 0,
  type: [],
  x: [],
  y: [],
  a: [],
  b: [],
  c: [],
};

export interface PreviewScene {
  readonly world: FakeWorld;
  /** Damage events for two frames: older hits first, fresh hits second (one crit). */
  readonly events: readonly [SimEventReader, SimEventReader];
}

/** One frame of arbitrary events (type, x, y, a, b). */
export function eventsOf(
  list: readonly (readonly [number, number, number, number, number])[],
): SimEventReader {
  return events(list);
}

function events(
  list: readonly (readonly [number, number, number, number, number])[],
): SimEventReader {
  return {
    count: list.length,
    type: list.map((e) => e[0]),
    x: list.map((e) => e[1]),
    y: list.map((e) => e[2]),
    a: list.map((e) => e[3]),
    b: list.map((e) => e[4]),
    c: list.map(() => encodeSource(SourceKind.Weapon, W.bolt)),
  };
}

export function createPreviewScene(): PreviewScene {
  const world = createFakeWorld({ enemies: 24, enemyShots: 8, playerShots: 16, pickups: 10 });
  const player = playerOf(world);
  player.x = 0;
  player.y = 1;
  player.prevX = -0.07;
  player.prevY = 1;
  player.facing = -1;

  const en = world.enemies;
  (en as unknown as MutablePool).highWater = 0;
  col(en, 'alive').fill(0);
  let k = 0;
  /** extra: pool columns, plus dx / dy = motion this tick (not columns). */
  const enemy = (
    type: number,
    rank: number,
    x: number,
    y: number,
    extra: Record<string, number> = {},
  ): void => {
    const { dx = 0, dy = 0, ...columns } = extra;
    put(en, k++, {
      ...at(x, y, dx, dy),
      typeIndex: type,
      rank,
      facing: x < 0 ? 1 : -1,
      // Long alive, so the emerge dissolve (first 18 ticks) is over.
      ageTicks: 600,
      ...columns,
    });
  };
  // Swarmer pack moving right toward the player.
  const pack: readonly (readonly [number, number])[] = [
    [-9, -3],
    [-8, -4],
    [-7.5, -2.4],
    [-9.6, -1.6],
    [-8.4, -1],
    [-10.4, -3.4],
  ];
  pack.forEach(([x, y], i) => {
    enemy(E.swarmer, EnemyRank.Normal, x, y, { dx: 0.04, hitFlashTicks: i === 2 ? 2 : 0 });
  });
  // Charger winding up its charge (AiState Windup = 2) at the start of the charge telegraph line.
  enemy(E.charger, EnemyRank.Normal, 6, -5, { dx: 0, aiState: 2 });
  enemy(E.charger, EnemyRank.Normal, 9.5, -2, { dx: -0.03, statusMask: StatusBit.Burn });
  enemy(E.shooter, EnemyRank.Normal, -11, 5);
  enemy(E.shooter, EnemyRank.Normal, 11.5, 6);
  enemy(E.tank, EnemyRank.Normal, -4, 6.5, {
    dx: 0.02,
    statusMask: StatusBit.Burn,
    hitFlashTicks: 1,
  });
  enemy(E.warden, EnemyRank.Warden, 6, 4.5, { dx: -0.03 });
  enemy(E.boss, EnemyRank.Boss, 0, -6.5);

  // Glint scattered where Unlit fell.
  const pk = world.pickups;
  (pk as unknown as MutablePool).highWater = 0;
  col(pk, 'alive').fill(0);
  const glints: readonly (readonly [number, number])[] = [
    [-5, -1],
    [-4.4, -0.6],
    [-5.6, -0.2],
    [2.5, 5],
    [3, 5.6],
    [-2, 3],
    [7.5, -3.5],
    [-12, 0.5],
  ];
  glints.forEach(([x, y], i) => {
    put(pk, i, { ...at(x, y), kind: 0, amount: 1 });
  });
  // Two Glint already pulled toward the player (magnetized, moving fast): they draw a gold tail.
  put(pk, glints.length, { ...at(-1.2, 1.6, 0.12, -0.06), kind: 0, amount: 1, magnetized: 1 });
  put(pk, glints.length + 1, { ...at(1.4, 2.2, -0.1, -0.1), kind: 0, amount: 1, magnetized: 1 });

  // Player shots: one or more per Tier A weapon.
  const ps = world.playerShots;
  (ps as unknown as MutablePool).highWater = 0;
  col(ps, 'alive').fill(0);
  let s = 0;
  const shot = (w: number, x: number, y: number, vx: number, vy: number): void => {
    put(ps, s++, { ...at(x, y, vx, vy), sourceRef: encodeSource(SourceKind.Weapon, w), vx, vy });
  };
  shot(W.bolt, 2.2, 0.2, 0.13, -0.05);
  shot(W.splinter, -2, 0.4, -0.23, -0.05);
  shot(W.splinter, -1.4, -1.5, -0.16, -0.26);
  shot(W.splinter, 0.3, -2.2, 0, -0.23);
  shot(W.splinter, 2.3, -1.4, 0.16, -0.26);
  shot(W.arc, -1.4, 1.2, -0.01, 0);
  shot(W.orbit, 1.6, 1.6, 0, 0.05);
  shot(W.orbit, -1.3, 0.2, 0, -0.05);
  shot(W.spark, 7.8, -2.6, 0.2, 0);
  shot(W.glaive, 3.6, 3.4, 0.15, 0.12);

  // Enemy shots from the shooters toward the player.
  const es = world.enemyShots;
  (es as unknown as MutablePool).highWater = 0;
  col(es, 'alive').fill(0);
  const eshots: readonly (readonly [number, number])[] = [
    [-7.5, 3.9],
    [-4.6, 2.9],
    [8.3, 4.5],
    [5.2, 3.4],
  ];
  eshots.forEach(([x, y], i) => {
    put(es, i, { ...at(x, y), sourceRef: encodeSource(SourceKind.EnemyAttack, E.shooter) });
  });

  // Telegraphs (L4): exploder-style circle, charge line, boss ring with a gap, Warden cone.
  const da = areas(8);
  put(da, 0, {
    ...at(-6.5, 2.5),
    shape: AreaShape.Circle,
    kind: TelegraphKind.Area,
    radius: 1.8,
    ticksLeft: 24,
    ticksTotal: 60,
  });
  put(da, 1, {
    ...at(6, -5),
    shape: AreaShape.Line,
    kind: TelegraphKind.Charge,
    x2: 1.6,
    y2: -1.2,
    p0: 0.45,
    ticksLeft: 22,
    ticksTotal: 36,
  });
  put(da, 2, {
    ...at(0, -6.5),
    shape: AreaShape.Ring,
    kind: TelegraphKind.BossArea,
    radius: 5.2,
    p0: 4.5,
    p1: 0.25,
    p2: 0.05,
    ticksLeft: 30,
    ticksTotal: 60,
  });
  put(da, 3, {
    ...at(6, 4.5),
    shape: AreaShape.Cone,
    kind: TelegraphKind.Cone,
    x2: 3,
    y2: 3.5,
    radius: 3,
    p0: 0.08,
    ticksLeft: 10,
    ticksTotal: 40,
  });
  world.dangerAreas = da;

  // Player zones (L3): a Smolder-style trail patch (no edge) and the Festival Flare Rite zone.
  const pz = areas(4);
  put(pz, 0, {
    ...at(3.4, 1.8),
    shape: AreaShape.Circle,
    radius: 1.3,
    sourceRef: encodeSource(SourceKind.Effect, 0),
    ticksLeft: 30,
    ticksTotal: 60,
  });
  put(pz, 1, {
    ...at(-3, -3.4),
    shape: AreaShape.Circle,
    radius: 3,
    sourceRef: encodeSource(SourceKind.Rite, 0),
    ticksLeft: 200,
    ticksTotal: 240,
  });
  world.playerZones = pz;

  // Spawn cracks in the edge band at three stages of growth.
  const sm: SpawnMarkPoolView = {
    capacity: 4,
    highWater: 0,
    alive: new Uint8Array(4),
    serial: new Uint32Array(4),
    x: new Float64Array(4),
    y: new Float64Array(4),
    prevX: new Float64Array(4),
    prevY: new Float64Array(4),
    radius: new Float64Array(4),
    typeIndex: new Int32Array(4),
    ticksLeft: new Int32Array(4),
    ticksTotal: new Int32Array(4),
  };
  put(sm, 0, { ...at(-14, -2), radius: 0.8, typeIndex: E.swarmer, ticksLeft: 40, ticksTotal: 48 });
  put(sm, 1, { ...at(14, 1), radius: 0.8, typeIndex: E.charger, ticksLeft: 20, ticksTotal: 48 });
  put(sm, 2, { ...at(2, 8.4), radius: 0.8, typeIndex: E.tank, ticksLeft: 2, ticksTotal: 48 });
  world.spawnMarks = sm;

  const D = SimEventType.EnemyDamaged;
  return {
    world,
    events: [
      events([
        [D, -8.4, -1, 6, 0],
        [D, -4, 6.5, 14, 0],
        [D, 9.5, -2, 8, 0],
      ]),
      events([
        [D, -7.5, -2.4, 6, 0],
        [D, 6, 4.5, 23, 1],
        [D, 0, -6.5, 112, 0],
      ]),
    ],
  };
}
