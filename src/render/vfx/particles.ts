// Sprite particles (AD; art-direction 8.2, 8.3). Fixed-capacity SoA pool, no allocation per frame.
// A particle sits on a world floor point (x, y) and moves in SCREEN pixels from there (dx right,
// dy up), so motion is whole-pixel and independent of the floor projection. Frame = progress through
// its animation over its life (one-shot) or a loop. When the pool is full the oldest particle is
// replaced. Deterministic: callers pass their own pseudo-random values (hash01), never Math.random.

import type { AtlasFrameRect } from '../../core/index.ts';
import type { SpriteBatch } from '../sprites/sprite-batch.ts';
import { frameIndexForProgress } from '../sprites/frame-select.ts';

/** A particle look: frames from one atlas animation plus its anchor. Resolved once at creation. */
export interface ParticleLook {
  readonly frames: readonly AtlasFrameRect[];
  readonly anchorX: number;
  readonly anchorY: number;
  /** true: cycle frames every `ticks` render ticks; false: frames follow life progress. */
  readonly loop: boolean;
  readonly ticks: number;
}

export interface ParticleSpawn {
  /** World floor point. */
  x: number;
  y: number;
  /** Start offset in px (y up). */
  dx: number;
  dy: number;
  /** Velocity px/s (y up) and gravity px/s^2 (positive pulls down). */
  vx: number;
  vy: number;
  gravity: number;
  /** Seconds. */
  life: number;
  /** Fade over the last share of the life (0 = never fades, 1 = fades from birth). */
  fade: number;
  /** Optional tint flash (linear rgb, amount); amount 0 keeps palette colours. */
  r: number;
  g: number;
  b: number;
  tint: number;
}

export interface Particles {
  /** Spawn using the reusable `spec` object (fill it, then call). Returns the slot. */
  spawn(look: number, timeSec: number, spec: ParticleSpawn): number;
  draw(batch: SpriteBatch, timeSec: number): void;
  /** Live particles (debug, tests). */
  count(timeSec: number): number;
  clear(): void;
  /** Multiplier on spawn counts (reduce effects): callers read it to scale bursts. */
  readonly capacity: number;
}

/** Deterministic hash to [0, 1) from two integers (particle scatter without Math.random). */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Reusable spawn spec with neutral defaults. */
export function particleSpec(): ParticleSpawn {
  return {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    vx: 0,
    vy: 0,
    gravity: 0,
    life: 0.3,
    fade: 0.4,
    r: 0,
    g: 0,
    b: 0,
    tint: 0,
  };
}

export function createParticles(looks: readonly ParticleLook[], capacity: number): Particles {
  const look = new Int16Array(capacity).fill(-1);
  const px = new Float32Array(capacity);
  const py = new Float32Array(capacity);
  const ox = new Float32Array(capacity);
  const oy = new Float32Array(capacity);
  const vx = new Float32Array(capacity);
  const vy = new Float32Array(capacity);
  const grav = new Float32Array(capacity);
  const born = new Float64Array(capacity);
  const life = new Float32Array(capacity);
  const fade = new Float32Array(capacity);
  const tint = new Float32Array(capacity * 4);
  let next = 0;

  return {
    capacity,
    spawn(l, timeSec, s) {
      const i = next;
      next = (next + 1) % capacity;
      look[i] = l;
      px[i] = s.x;
      py[i] = s.y;
      ox[i] = s.dx;
      oy[i] = s.dy;
      vx[i] = s.vx;
      vy[i] = s.vy;
      grav[i] = s.gravity;
      born[i] = timeSec;
      life[i] = s.life;
      fade[i] = s.fade;
      tint[i * 4] = s.r;
      tint[i * 4 + 1] = s.g;
      tint[i * 4 + 2] = s.b;
      tint[i * 4 + 3] = s.tint;
      return i;
    },
    draw(batch, timeSec) {
      for (let i = 0; i < capacity; i++) {
        const li = look[i] ?? -1;
        if (li < 0) continue;
        const L = looks[li];
        const age = timeSec - (born[i] ?? 0);
        const lf = life[i] ?? 0;
        if (L === undefined || age < 0 || age >= lf) {
          look[i] = -1;
          continue;
        }
        const t = age / lf;
        const fi = L.loop
          ? Math.floor((age * 60) / Math.max(1, L.ticks)) % Math.max(1, L.frames.length)
          : frameIndexForProgress(L.frames.length, t);
        const rect = L.frames[fi];
        if (rect === undefined) continue;
        const f = fade[i] ?? 0;
        const alpha = f <= 0 || t < 1 - f ? 1 : Math.max(0, (1 - t) / f);
        const dx = (ox[i] ?? 0) + (vx[i] ?? 0) * age;
        const dy = (oy[i] ?? 0) + (vy[i] ?? 0) * age - 0.5 * (grav[i] ?? 0) * age * age;
        batch.push(
          px[i] ?? 0,
          py[i] ?? 0,
          0,
          rect,
          L.anchorX,
          L.anchorY,
          1,
          Math.round(dx),
          Math.round(dy),
          tint[i * 4] ?? 0,
          tint[i * 4 + 1] ?? 0,
          tint[i * 4 + 2] ?? 0,
          tint[i * 4 + 3] ?? 0,
          alpha,
        );
      }
    },
    count(timeSec) {
      let n = 0;
      for (let i = 0; i < capacity; i++)
        if ((look[i] ?? -1) >= 0 && timeSec - (born[i] ?? 0) < (life[i] ?? 0)) n++;
      return n;
    },
    clear() {
      look.fill(-1);
    },
  };
}
