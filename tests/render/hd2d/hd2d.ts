// HD-2D render preview (LP, M2-02): the real sim, real data, and the real renderer on arena_market,
// driven by tests/render/hd2d/capture.ts for screenshots and an indicative frame-time measurement.
// Browser only (served by Vite in mode "test"); not part of the game bundle.

import { createEventBuffer, createInputFrame, TICK_RATE } from '../../../src/core/index.ts';
import type { Command, Settings, WorldView } from '../../../src/core/index.ts';
import { buildGameData } from '../../../src/content/index.ts';
import type { RawGameData } from '../../../src/content/index.ts';
import { loadArtAssets } from '../../../src/app/assets.ts';
import { defaultSettings } from '../../../src/app/settings.ts';
import { createSim, stressCommands } from '../../../src/sim/index.ts';
import { createRenderer } from '../../../src/render/index.ts';
import type { RendererDebug } from '../../../src/render/pipeline/renderer.ts';
import raw from '../../../content/generated/game-data.json';

export interface Hd2dOptions {
  readonly quality?: Settings['graphics']['quality'];
  readonly reduceEffects?: boolean;
  readonly arenaId?: string;
  readonly seed?: number;
}

declare global {
  interface Window {
    __hd2d?: {
      setup(o: Hd2dOptions): void;
      /** Step the sim n ticks (player circles the centre) and render one frame. */
      step(n: number): void;
      scene(name: 'calm' | 'peak' | 'peak120' | 'boss' | 'danger' | 'k3' | 'occlude'): void;
      counts(): {
        phase: string;
        hp: number;
        enemies: number;
        enemyShots: number;
        playerShots: number;
        danger: number;
      };
      perf(seconds: number): Promise<{
        enemiesMin: number;
        avg: number;
        p95: number;
        p99: number;
        max: number;
        frames: number;
        drawCalls: number;
        triangles: number;
        enemies: number;
      }>;
      stats(): { drawCalls: number; triangles: number };
      override(o: Record<string, unknown> | null): void;
    };
  }
}

const data = buildGameData(raw as unknown as RawGameData);
const canvas = document.querySelector<HTMLCanvasElement>('canvas#game');
if (canvas === null) throw new Error('canvas missing');
const renderer = createRenderer(canvas, loadArtAssets(), data);
const dpr = window.devicePixelRatio;
renderer.resize(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr));
const events = createEventBuffer(8192);
let sim = createSim({ data, debugCommands: true });
const input = createInputFrame();
let t = 0;

const send = (c: Command): void => {
  sim.enqueue(c);
};
const tick = (): void => {
  t++;
  // Slow circle around the centre so the player walks (walk cycle, facing).
  const a = (t / TICK_RATE) * 0.9;
  input.moveX = Math.round(Math.cos(a) * 90);
  input.moveY = Math.round(Math.sin(a) * 90);
  sim.step(input);
  events.appendFrom(sim.events, sim.view.tick);
};
let override: ((v: WorldView) => WorldView) | null = null;
const frame = (): void => {
  const view = override === null ? sim.view : override(sim.view);
  renderer.render({ view, alpha: 1, events, timeSec: sim.view.tick / TICK_RATE });
  events.clear();
};

/** LD 9 check: the largest live foe stands just in front of the player (copied pools, sim untouched). */
function occludeView(v: WorldView): WorldView {
  const e = v.enemies;
  let best = -1;
  for (let i = 0; i < e.highWater; i++)
    if (e.alive[i] !== 0 && (best < 0 || (e.rank[i] ?? 0) > (e.rank[best] ?? 0))) best = i;
  if (best < 0) return v;
  const x = Float64Array.from(e.x);
  const y = Float64Array.from(e.y);
  x[best] = v.player.x;
  y[best] = v.player.y + 0.6;
  return { ...v, enemies: { ...e, x, y, prevX: x, prevY: y } };
}

/** K3 check: stacked telegraph fills and an enemy shot right on the player (CD M1 review K3). */
function k3View(v: WorldView): WorldView {
  const n = 8;
  const f = (): Float64Array => new Float64Array(n);
  const px = v.player.x;
  const py = v.player.y;
  const circles: readonly (readonly [number, number, number])[] = [
    [px - 0.6, py - 0.3, 1.6],
    [px + 0.5, py - 0.5, 1.4],
    [px, py + 0.4, 1.2],
  ];
  const areas = {
    capacity: n,
    highWater: circles.length + 1,
    alive: new Uint8Array(n).fill(1, 0, circles.length + 1),
    serial: new Uint32Array(n),
    x: f(),
    y: f(),
    prevX: f(),
    prevY: f(),
    radius: f(),
    shape: new Uint8Array(n),
    kind: new Uint8Array(n),
    sourceRef: new Uint32Array(n),
    x2: f(),
    y2: f(),
    p0: f(),
    p1: f(),
    p2: f(),
    ticksLeft: new Float64Array(n).fill(12),
    ticksTotal: new Float64Array(n).fill(40),
  };
  circles.forEach(([x, y, r], i) => {
    areas.x[i] = x;
    areas.y[i] = y;
    areas.prevX[i] = x;
    areas.prevY[i] = y;
    areas.radius[i] = r;
    areas.kind[i] = 2;
  });
  const li = circles.length;
  areas.shape[li] = 2;
  areas.x[li] = px - 4;
  areas.y[li] = py - 1;
  areas.x2[li] = px + 4;
  areas.y2[li] = py + 0.5;
  areas.p0[li] = 0.5;
  areas.kind[li] = 2;
  return { ...v, dangerAreas: areas };
}
/** Keep the 120-enemy budget scene alive during perf runs: player HP and enemy count topped up. */
const topUp = (): void => {
  send({ type: 'debug.setHp', hp: 99999 });
  const ids = data.enemies
    .filter((e) => e.sizeClass !== 'boss' && e.sizeClass !== 'warden')
    .map((e) => e.id);
  const missing = 120 - count(sim.view.enemies);
  for (let k = 0; k < missing; k++) {
    const a = ((k + t) / 37) * Math.PI * 2;
    send({
      type: 'debug.spawn',
      enemyId: ids[k % ids.length] ?? 'swarmer',
      x: Math.cos(a) * 12,
      y: Math.sin(a) * 7,
      count: 1,
    });
  }
};
const count = (pool: { highWater: number; alive: ArrayLike<number> }): number => {
  let n = 0;
  for (let i = 0; i < pool.highWater; i++) if (pool.alive[i] !== 0) n++;
  return n;
};

window.__hd2d = {
  setup(o) {
    const s = defaultSettings(false);
    renderer.applySettings({
      ...s,
      graphics: { ...s.graphics, quality: o.quality ?? 'high' },
      access: { ...s.access, reduceEffects: o.reduceEffects ?? false },
    });
    const arena = data.arenas.find((a) => a.id === (o.arenaId ?? 'arena_market')) ?? data.arenas[0];
    if (arena === undefined) throw new Error('no arena');
    renderer.setArena(arena, 'biome_market');
    sim = createSim({ data, debugCommands: true });
    override = null;
    t = 0;
    send({
      type: 'run.start',
      seed: o.seed ?? 7,
      classId: 'lantern',
      profile: 'run_a',
      difficulty: 0,
    });
  },
  step(n) {
    for (let i = 0; i < n; i++) tick();
    frame();
  },
  scene(name) {
    if (name === 'calm') {
      for (let i = 0; i < 150; i++) tick();
    } else if (name === 'peak' || name === 'peak120' || name === 'danger') {
      for (let i = 0; i < 30; i++) tick();
      for (const c of stressCommands(data, 'peak')) send(c);
      if (name === 'peak120') {
        // Top up to the 120-enemy budget scene (architecture 13) with the first Unlit types.
        const ids = data.enemies
          .filter((e) => e.sizeClass !== 'boss' && e.sizeClass !== 'warden')
          .map((e) => e.id);
        for (let k = 0; k < 120; k++) {
          const a = (k / 120) * Math.PI * 2;
          send({
            type: 'debug.spawn',
            enemyId: ids[k % ids.length] ?? 'swarmer',
            x: Math.cos(a) * 12,
            y: Math.sin(a) * 7,
            count: 1,
          });
        }
      }
      for (let i = 0; i < (name === 'danger' ? 150 : 120); i++) tick();
    } else if (name === 'occlude') {
      for (let i = 0; i < 30; i++) tick();
      for (const c of stressCommands(data, 'peak-boss')) send(c);
      for (let i = 0; i < 240; i++) tick();
      override = occludeView;
    } else if (name === 'k3') {
      for (let i = 0; i < 30; i++) tick();
      for (const c of stressCommands(data, 'peak')) send(c);
      for (let i = 0; i < 200; i++) tick();
      override = k3View;
    } else {
      for (let i = 0; i < 30; i++) tick();
      for (const c of stressCommands(data, 'peak-boss')) send(c);
      for (let i = 0; i < 240; i++) tick();
    }
    frame();
  },
  counts() {
    const v = sim.view;
    return {
      phase: v.phase,
      hp: v.player.hp,
      enemies: count(v.enemies),
      enemyShots: count(v.enemyShots),
      playerShots: count(v.playerShots),
      danger: count(v.dangerAreas),
    };
  },
  stats() {
    return renderer.stats();
  },
  override(o) {
    (renderer as unknown as { debug: RendererDebug }).debug.overrideQuality(o);
    frame();
  },
  perf(seconds) {
    return new Promise((resolve) => {
      const times: number[] = [];
      let last = 0;
      let acc = 0;
      const start = performance.now();
      let minEnemies = count(sim.view.enemies);
      const loop = (now: number): void => {
        if (last !== 0) {
          const dt = now - last;
          times.push(dt);
          acc += dt;
          while (acc >= 1000 / TICK_RATE) {
            tick();
            acc -= 1000 / TICK_RATE;
            if (t % 30 === 0) topUp();
          }
        }
        last = now;
        minEnemies = Math.min(minEnemies, count(sim.view.enemies));
        frame();
        if (now - start < seconds * 1000) requestAnimationFrame(loop);
        else {
          const s = [...times].sort((a, b) => a - b);
          const pct = (p: number): number =>
            s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] ?? 0;
          const st = renderer.stats();
          resolve({
            enemiesMin: minEnemies,
            avg: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length),
            p95: pct(0.95),
            p99: pct(0.99),
            max: s[s.length - 1] ?? 0,
            frames: s.length,
            drawCalls: st.drawCalls,
            triangles: st.triangles,
            enemies: count(sim.view.enemies),
          });
        }
      };
      requestAnimationFrame(loop);
    });
  },
};
