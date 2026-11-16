// Event-driven VFX (AD; art-direction 8.2, CD M2 brief 1.3, M1-cd 4 AD items 2 to 5).
// Maps frame events to sprite particles (L3), Rite flights, ground rings (L1/L3 decals), dying Unlit
// ghosts (dissolve plus dark shards and motes), and short player flashes the entity layer reads.
// Colour code (style-guide 1.3): player effects blue/cyan/gold/white, Unlit remains are their own dark
// violet. All effects live under the danger layer L4, so they never cover telegraphs or enemy shots.
// Fixed capacities, no allocation per frame. Reduce effects scales bursts to 30% (art-direction 8.3).

import {
  DAMAGE_HIT_KIND_SHIFT,
  DamageFlag,
  EnemyRank,
  HitKind,
  SimEventType,
} from '../../core/index.ts';
import type {
  AtlasManifest,
  AtlasSpriteEntry,
  PaletteDef,
  SimEventReader,
} from '../../core/index.ts';
import type { SpriteBatch } from '../sprites/sprite-batch.ts';
import type { AtlasFrameRect } from '../../core/index.ts';
import type { AreaBatch, AreaStyle } from './area-batch.ts';
import { createParticles, hash01, particleSpec } from './particles.ts';
import type { ParticleLook } from './particles.ts';
import { linearRgb } from './telegraph-style.ts';

/** Look indices into the particle look table. */
const LOOK = {
  spark: 0,
  trail: 1,
  glintTrail: 2,
  mote: 3,
  shard: 4,
  glassShard: 5,
  flare: 6,
  ember: 7,
  rise: 8,
  star: 9,
} as const;
const LOOK_IDS: readonly string[] = [
  'fx-spark',
  'fx-trail',
  'fx-glint-trail',
  'fx-mote',
  'fx-shard',
  'fx-glass-shard',
  'fx-flare',
  'fx-ember',
  'fx-rise',
  'fx-star',
];

/** Rite flight time when the data row has no flight_s (rites.csv flare_lantern: 0.35 s). */
export const RITE_FLIGHT_SEC = 0.35;
/** Rite zone radius fallback (rites.csv flare_lantern zone_radius 3). */
const RITE_ZONE_U = 3;
/** Player flash lengths (s). */
export const LEVEL_FLASH_SEC = 0.18;
export const MEMENTO_FLASH_SEC = 0.22;
export const RITE_CAST_SEC = 0.3;
/** Dying Unlit dissolve length per rank (s): normal under 0.3 s (art-direction 8.2). */
const GHOST_LIFE: readonly number[] = [0.28, 0.6, 1.4];
const GHOST_SHARDS: readonly number[] = [4, 10, 26];
const GHOST_MOTES: readonly number[] = [3, 8, 22];
/** Sparks per frame cap, so a 40-Unlit volley does not flood L3. */
const SPARKS_PER_FRAME = 36;
const SPARK_PX_ABOVE_FEET = 8;

export interface VfxPlayerState {
  /** Render time when the current Rite cast pose ends (0 = none). */
  castUntil: number;
  castFrom: number;
  /** Flash colour and end time for level-up (gold) or Memento (white). */
  flashUntil: number;
  flashR: number;
  flashG: number;
  flashB: number;
  /** Render time of the player's death (dissolve start), -1 while alive. */
  deadAt: number;
}

export interface VfxSystem {
  readonly player: VfxPlayerState;
  /** Read this frame's events. playerX/Y = interpolated player feet (u). */
  ingest(events: SimEventReader, timeSec: number, playerX: number, playerY: number): void;
  /** A slot of the enemy pool just died or vanished: dissolve its last frame where it stood. */
  ghost(
    rect: AtlasFrameRect,
    anchorX: number,
    anchorY: number,
    flip: number,
    x: number,
    y: number,
    rank: number,
    timeSec: number,
  ): void;
  /** One Rite zone ember (called by the zone pass a few times per second). */
  ember(x: number, y: number, seed: number, timeSec: number): void;
  drawSprites(batch: SpriteBatch, timeSec: number): void;
  drawAreas(areas: AreaBatch, timeSec: number): void;
  setReduced(on: boolean): void;
  clear(): void;
}

interface RingStyle {
  fill: [number, number, number, number];
  edge: [number, number, number, number];
  dashed: boolean;
}

function lookOf(entry: AtlasSpriteEntry | undefined): ParticleLook {
  const anim = entry === undefined ? undefined : Object.values(entry.animations)[0];
  return {
    frames: anim?.frames ?? [],
    anchorX: entry?.anchor.x ?? 0,
    anchorY: entry?.anchor.y ?? 0,
    loop: anim?.loop ?? false,
    ticks: Math.max(1, anim?.ticksPerFrame ?? 1),
  };
}

/** Optional numeric field of a data row's params (GameData params are typed per archetype). */
function paramOf(row: unknown, key: string): number | null {
  if (row === null || typeof row !== 'object') return null;
  const params = (row as { params?: unknown }).params;
  if (params === null || typeof params !== 'object') return null;
  const v = (params as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : null;
}

export function createVfx(
  manifest: AtlasManifest,
  palette: PaletteDef,
  rites: readonly unknown[],
  particleCapacity = 600,
): VfxSystem {
  const looks = LOOK_IDS.map((id) => lookOf(manifest.sprites[id]));
  const parts = createParticles(looks, particleCapacity);
  const spec = particleSpec();
  const [bR, bG, bB] = linearRgb(palette, 'bone');
  const [rimR, rimG, rimB] = linearRgb(palette, 'unlit-rim');
  const cyan = linearRgb(palette, 'kept-cyan');
  const gold = linearRgb(palette, 'kept-gold');
  const white = linearRgb(palette, 'kept-white');
  const blue = linearRgb(palette, 'kept-blue');
  const flareFrames = looks[LOOK.flare]?.frames ?? [];
  const flareAnchor = looks[LOOK.flare] ?? lookOf(undefined);
  const trailFrames = looks[LOOK.trail]?.frames ?? [];
  const trailAnchor = looks[LOOK.trail] ?? lookOf(undefined);

  const player: VfxPlayerState = {
    castUntil: 0,
    castFrom: 0,
    flashUntil: 0,
    flashR: 0,
    flashG: 0,
    flashB: 0,
    deadAt: -1,
  };
  let reduced = false;
  let serial = 0;
  const burst = (n: number): number => (reduced ? Math.max(1, Math.round(n * 0.3)) : n);

  // ---- Rite flights: lantern arcs from the player to the aim point, landing burst on arrival. ----
  const FLIGHTS = 8;
  const fx0 = new Float32Array(FLIGHTS);
  const fy0 = new Float32Array(FLIGHTS);
  const fx1 = new Float32Array(FLIGHTS);
  const fy1 = new Float32Array(FLIGHTS);
  const fBorn = new Float64Array(FLIGHTS);
  const fDur = new Float32Array(FLIGHTS);
  const fZone = new Float32Array(FLIGHTS);
  const fLive = new Uint8Array(FLIGHTS);
  let fNext = 0;

  // ---- Ground rings: expanding 1 px edges with an optional faint fill. ----
  const RINGS = 32;
  const rx = new Float32Array(RINGS);
  const ry = new Float32Array(RINGS);
  const r0 = new Float32Array(RINGS);
  const r1 = new Float32Array(RINGS);
  const rBorn = new Float64Array(RINGS);
  const rLife = new Float32Array(RINGS);
  const rCol = new Float32Array(RINGS * 3);
  const rEdgeA = new Float32Array(RINGS);
  const rFillA = new Float32Array(RINGS);
  const rLive = new Uint8Array(RINGS);
  let rNext = 0;
  const ringStyle: RingStyle = { fill: [0, 0, 0, 0], edge: [0, 0, 0, 0], dashed: false };

  // ---- Ghosts: the last frame of a dying Unlit, dissolving in whole texels. ----
  const GHOSTS = 128;
  const gRect: (AtlasFrameRect | null)[] = new Array<AtlasFrameRect | null>(GHOSTS).fill(null);
  const gAx = new Int16Array(GHOSTS);
  const gAy = new Int16Array(GHOSTS);
  const gFlip = new Int8Array(GHOSTS);
  const gX = new Float32Array(GHOSTS);
  const gY = new Float32Array(GHOSTS);
  const gBorn = new Float64Array(GHOSTS);
  const gLife = new Float32Array(GHOSTS);
  let gNext = 0;

  function ring(
    x: number,
    y: number,
    from: number,
    to: number,
    life: number,
    col: readonly [number, number, number],
    edgeA: number,
    fillA: number,
    t: number,
  ): void {
    const i = rNext;
    rNext = (rNext + 1) % RINGS;
    rx[i] = x;
    ry[i] = y;
    r0[i] = from;
    r1[i] = to;
    rBorn[i] = t;
    rLife[i] = life;
    rCol[i * 3] = col[0];
    rCol[i * 3 + 1] = col[1];
    rCol[i * 3 + 2] = col[2];
    rEdgeA[i] = edgeA;
    rFillA[i] = fillA;
    rLive[i] = 1;
  }

  function radial(
    look: number,
    n: number,
    x: number,
    y: number,
    dy: number,
    speed: number,
    spread: number,
    up: number,
    gravity: number,
    life: number,
    t: number,
  ): void {
    for (let k = 0; k < n; k++) {
      serial++;
      const a = (k + hash01(serial, 7) * 0.8) / n;
      const s = speed * (0.6 + hash01(serial, 11) * 0.8);
      const ang = a * Math.PI * 2;
      spec.x = x;
      spec.y = y;
      spec.dx = Math.cos(ang) * spread;
      spec.dy = dy + Math.sin(ang) * spread * 0.6;
      spec.vx = Math.cos(ang) * s;
      spec.vy = Math.sin(ang) * s * 0.7 + up;
      spec.gravity = gravity;
      spec.life = life * (0.75 + hash01(serial, 13) * 0.5);
      spec.fade = 0.5;
      spec.tint = 0;
      parts.spawn(look, t, spec);
    }
  }

  function riteLanding(i: number, t: number): void {
    const x = fx1[i] ?? 0;
    const y = fy1[i] ?? 0;
    const zr = fZone[i] ?? RITE_ZONE_U;
    spec.x = x;
    spec.y = y;
    spec.dx = 0;
    spec.dy = 6;
    spec.vx = 0;
    spec.vy = 0;
    spec.gravity = 0;
    spec.life = 0.3;
    spec.fade = 0.3;
    spec.tint = 0;
    parts.spawn(LOOK.flare, t, spec);
    ring(x, y, 0.3, zr * 1.08, 0.28, cyan, 1, 0.12, t);
    ring(x, y, 0.2, zr * 0.6, 0.2, white, 0.9, 0, t);
    radial(LOOK.spark, burst(10), x, y, 6, 90, 4, 20, 0, 0.22, t);
    radial(LOOK.ember, burst(8), x, y, 2, 30, zr * 6, 28, 0, 0.6, t);
  }

  return {
    player,
    ingest(ev, t, px, py) {
      let sparks = 0;
      for (let e = 0; e < ev.count; e++) {
        const type = ev.type[e];
        const x = ev.x[e] ?? 0;
        const y = ev.y[e] ?? 0;
        if (type === SimEventType.EnemyDamaged) {
          const b = ev.b[e] ?? 0;
          const kind = (b >> DAMAGE_HIT_KIND_SHIFT) & 7;
          if (kind === HitKind.Dot || kind === HitKind.Zone) continue;
          const n = (b & DamageFlag.Crit) !== 0 ? 5 : 3;
          if (sparks + n > SPARKS_PER_FRAME) continue;
          sparks += n;
          radial(LOOK.spark, burst(n), x, y, SPARK_PX_ABOVE_FEET, 70, 1, 0, 0, 0.15, t);
        } else if (type === SimEventType.RiteCast) {
          const row = rites[ev.a[e] ?? 0];
          const i = fNext;
          fNext = (fNext + 1) % FLIGHTS;
          fx0[i] = px;
          fy0[i] = py;
          fx1[i] = x;
          fy1[i] = y;
          fBorn[i] = t;
          fDur[i] = paramOf(row, 'flight_s') ?? RITE_FLIGHT_SEC;
          fZone[i] = paramOf(row, 'zone_radius') ?? RITE_ZONE_U;
          fLive[i] = 1;
          player.castFrom = t;
          player.castUntil = t + RITE_CAST_SEC;
          // Release flash at the raised lantern plus a small cyan ring at the feet.
          spec.x = px;
          spec.y = py;
          spec.dx = 3;
          spec.dy = 24;
          spec.vx = 0;
          spec.vy = 0;
          spec.gravity = 0;
          spec.life = 0.24;
          spec.fade = 0.4;
          spec.tint = 0;
          parts.spawn(LOOK.flare, t, spec);
          ring(px, py, 0.2, 1.2, 0.22, cyan, 0.9, 0, t);
        } else if (type === SimEventType.PlayerLeveledUp) {
          ring(px, py, 0.1, 1.7, 0.5, gold, 1, 0.1, t);
          for (let k = 0; k < burst(8); k++) {
            serial++;
            spec.x = px;
            spec.y = py;
            spec.dx = Math.round((hash01(serial, 3) - 0.5) * 16);
            spec.dy = 2 + hash01(serial, 5) * 10;
            spec.vx = 0;
            spec.vy = 22 + hash01(serial, 9) * 20;
            spec.gravity = 0;
            spec.life = 0.6;
            spec.fade = 0.4;
            spec.tint = 0;
            parts.spawn(LOOK.rise, t, spec);
          }
          player.flashUntil = t + LEVEL_FLASH_SEC;
          [player.flashR, player.flashG, player.flashB] = gold;
        } else if (type === SimEventType.MementoAcquired) {
          ring(px, py, 0.1, 2.2, 0.45, cyan, 1, 0.08, t);
          ring(px, py, 0.1, 1.4, 0.35, white, 0.9, 0, t + 0.08);
          radial(LOOK.star, burst(6), px, py, 12, 40, 6, 10, 0, 0.5, t);
          player.flashUntil = t + MEMENTO_FLASH_SEC;
          [player.flashR, player.flashG, player.flashB] = white;
        } else if (type === SimEventType.PlayerDied) {
          if (player.deadAt < 0) player.deadAt = t;
          radial(LOOK.glassShard, burst(16), px, py, 10, 80, 3, 60, 240, 0.8, t);
          ring(px, py, 0.2, 2.6, 0.6, blue, 1, 0.1, t);
        } else if (type === SimEventType.GlintCollected) {
          serial++;
          spec.x = px;
          spec.y = py;
          spec.dx = Math.round((hash01(serial, 2) - 0.5) * 10);
          spec.dy = 8 + hash01(serial, 4) * 8;
          spec.vx = 0;
          spec.vy = 30;
          spec.gravity = 0;
          spec.life = 0.22;
          spec.fade = 0.5;
          spec.tint = 0;
          parts.spawn(LOOK.rise, t, spec);
        } else if (type === SimEventType.PhaseChanged && (ev.a[e] ?? 0) === 1) {
          // New Pulse: a revived player is no longer dissolving.
          player.deadAt = -1;
        }
      }
    },
    ghost(rect, ax, ay, flip, x, y, rank, t) {
      const i = gNext;
      gNext = (gNext + 1) % GHOSTS;
      const rk = rank === EnemyRank.Boss ? 2 : rank === EnemyRank.Warden ? 1 : 0;
      gRect[i] = rect;
      gAx[i] = ax;
      gAy[i] = ay;
      gFlip[i] = flip < 0 ? -1 : 1;
      gX[i] = x;
      gY[i] = y;
      gBorn[i] = t;
      gLife[i] = GHOST_LIFE[rk] ?? 0.3;
      const mid = Math.round(rect.h / 2);
      const spread = Math.max(2, Math.round(rect.w / 3));
      radial(
        LOOK.shard,
        burst(GHOST_SHARDS[rk] ?? 4),
        x,
        y,
        mid,
        55 + rk * 20,
        spread,
        25,
        160,
        0.4 + rk * 0.2,
        t,
      );
      radial(
        LOOK.mote,
        burst(GHOST_MOTES[rk] ?? 3),
        x,
        y,
        mid,
        18,
        spread,
        30,
        0,
        0.28 + rk * 0.3,
        t,
      );
    },
    ember(x, y, seed, t) {
      if (reduced && seed % 3 !== 0) return;
      spec.x = x;
      spec.y = y;
      spec.dx = 0;
      spec.dy = 1;
      spec.vx = (hash01(seed, 21) - 0.5) * 6;
      spec.vy = 14 + hash01(seed, 23) * 10;
      spec.gravity = 0;
      spec.life = 0.7;
      spec.fade = 0.6;
      spec.tint = 0;
      parts.spawn(LOOK.ember, t, spec);
    },
    drawSprites(batch, t) {
      // Ghosts first so their shards draw over them.
      for (let i = 0; i < GHOSTS; i++) {
        const rect = gRect[i];
        if (rect === null || rect === undefined) continue;
        const age = t - (gBorn[i] ?? 0);
        const life = gLife[i] ?? 0.3;
        if (age < 0 || age >= life) {
          gRect[i] = null;
          continue;
        }
        const p = age / life;
        // 0 to 15%: white hit flash; then the body breaks up in whole texels with a rim-coloured edge.
        const flash = p < 0.15;
        const dissolve = flash ? 0 : Math.min(1, (p - 0.15) / 0.85);
        batch.push(
          gX[i] ?? 0,
          gY[i] ?? 0,
          0,
          rect,
          gAx[i] ?? 0,
          gAy[i] ?? 0,
          gFlip[i] ?? 1,
          0,
          0,
          flash ? bR : rimR,
          flash ? bG : rimG,
          flash ? bB : rimB,
          flash ? 1 : 0,
          1,
          dissolve,
          1,
        );
      }
      // Rite flights: lantern arc with a short cyan tail; landing burst when it arrives.
      for (let i = 0; i < FLIGHTS; i++) {
        if (fLive[i] === 0) continue;
        const age = t - (fBorn[i] ?? 0);
        const dur = fDur[i] ?? RITE_FLIGHT_SEC;
        if (age >= dur) {
          fLive[i] = 0;
          riteLanding(i, t);
          continue;
        }
        if (age < 0) continue;
        for (let k = 3; k >= 0; k--) {
          const tt = Math.max(0, age - k * 0.03) / dur;
          const x = (fx0[i] ?? 0) + ((fx1[i] ?? 0) - (fx0[i] ?? 0)) * tt;
          const y = (fy0[i] ?? 0) + ((fy1[i] ?? 0) - (fy0[i] ?? 0)) * tt;
          const h = Math.round(22 * (1 - tt) + 30 * tt * (1 - tt) * 4 * 0.5);
          const rect = k === 0 ? flareFrames[0] : trailFrames[k > 1 ? 1 : 0];
          const L = k === 0 ? flareAnchor : trailAnchor;
          if (rect !== undefined)
            batch.push(x, y, 0, rect, L.anchorX, L.anchorY, 1, 0, h, 0, 0, 0, 0, k === 0 ? 1 : 0.8);
        }
      }
      parts.draw(batch, t);
    },
    drawAreas(areas, t) {
      const s = ringStyle as unknown as AreaStyle;
      for (let i = 0; i < RINGS; i++) {
        if (rLive[i] === 0) continue;
        const age = t - (rBorn[i] ?? 0);
        const life = rLife[i] ?? 0.3;
        if (age >= life) {
          rLive[i] = 0;
          continue;
        }
        if (age < 0) continue;
        const p = age / life;
        const ease = 1 - (1 - p) * (1 - p);
        const r = (r0[i] ?? 0) + ((r1[i] ?? 0) - (r0[i] ?? 0)) * ease;
        const fade = 1 - p * p;
        ringStyle.edge[0] = rCol[i * 3] ?? 1;
        ringStyle.edge[1] = rCol[i * 3 + 1] ?? 1;
        ringStyle.edge[2] = rCol[i * 3 + 2] ?? 1;
        ringStyle.edge[3] = (rEdgeA[i] ?? 1) * fade;
        ringStyle.fill[0] = ringStyle.edge[0];
        ringStyle.fill[1] = ringStyle.edge[1];
        ringStyle.fill[2] = ringStyle.edge[2];
        ringStyle.fill[3] = (rFillA[i] ?? 0) * fade;
        areas.push(0, rx[i] ?? 0, ry[i] ?? 0, 0, 0, r, 0, 0, 0, 1, s);
      }
    },
    setReduced(on) {
      reduced = on;
    },
    clear() {
      parts.clear();
      fLive.fill(0);
      rLive.fill(0);
      gRect.fill(null);
      player.castUntil = 0;
      player.flashUntil = 0;
      player.deadAt = -1;
    },
  };
}
