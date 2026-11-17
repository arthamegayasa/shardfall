// Player weapon readability (redesign 1.1 section 4). AD. Render only: reads WorldView shots and frame
// events, never sim state, hitboxes, or RNG.
//
// Owner report after 1.0: "after buying weapons it looks like nothing changed in my hero's attack". The sim
// fired every weapon, but shots were 4 to 5 px cyan specks in a busy lit arena and melee, chain, and ring
// weapons drew nothing of their own. This module gives every weapon a visible identity:
// - Shots draw at PLAYER_SHOT_SCALE (whole-number scale, so texels stay crisp) with a halo copy behind them
//   and a three-dot tail, all in the weapon's light: the colour of its first tag (flame amber, shard cyan,
//   edge white, echo blue, ward pale stone, trade gold), the far tail dots in its second tag's colour. The
//   shot body is tinted toward the light in HDR so it blooms.
// - Each WeaponFired event draws a short spark at the hero's hand in the weapon's light (muzzle flash).
//   Reduce effects drops it (flicker); sizes, halos, and tails stay.
// - Arc weapons (Arc Blade) show their real sweep as a fading cone, aimed at the hit this frame; chain
//   weapons draw a line per jump; ring weapons (Echo Bell) draw a ring growing to their radius.
// Fixed pools, typed arrays, reusable style objects: no allocation per frame.

import {
  AreaShape,
  DAMAGE_HIT_KIND_SHIFT,
  HitKind,
  SimEventType,
  SourceKind,
  sourceIndexOf,
  sourceKindOf,
} from '../../core/index.ts';
import type {
  AtlasFrameRect,
  AtlasManifest,
  AtlasSpriteEntry,
  PaletteDef,
  SimEventReader,
} from '../../core/index.ts';
import type { SpriteBatch } from '../sprites/sprite-batch.ts';
import type { AreaBatch, AreaStyle } from './area-batch.ts';
import { linearRgb } from './telegraph-style.ts';

/** Whole-number render scale of every player shot (1.0 drew them at 1). Sim radius is unchanged. */
export const PLAYER_SHOT_SCALE = 2;
/** Halo: a copy of the shot sprite one scale step larger, fully in the weapon light, behind the shot. */
export const SHOT_HALO_SCALE = PLAYER_SHOT_SCALE + 1;
export const SHOT_HALO_ALPHA = 0.3;
/** Share of the weapon light mixed into the shot body, and its HDR gain (times the emissive gain). */
export const SHOT_TINT = 0.45;
export const SHOT_CORE_HDR = 2.2;
/** Tail dots: HDR gain on the weapon light (times the emissive gain) so they bloom with bloom on. */
export const TAIL_HDR = 1.6;
/** Render ticks of travel between tail dots. */
export const TAIL_STEP_TICKS = 1.5;
/** Shots slower than this (u per tick) draw no tail. */
export const TAIL_MIN_SPEED = 0.03;

export interface TailDot {
  /** fx-trail frame: 0 = 2 x 2 dot, 1 = 1 x 1 dot. */
  readonly frame: 0 | 1;
  readonly scale: number;
  readonly alpha: number;
  /** 'core' = the weapon's first-tag light, 'tail' = its second-tag light. */
  readonly light: 'core' | 'tail';
}

/** Nearest dot first. */
export const SHOT_TAIL: readonly TailDot[] = [
  { frame: 0, scale: 2, alpha: 0.95, light: 'core' },
  { frame: 1, scale: 2, alpha: 0.75, light: 'tail' },
  { frame: 1, scale: 1, alpha: 0.55, light: 'tail' },
];

/** Palette token of each tag's light (same hues as the UI tag colours, src/ui/css/base.css --tag-*). */
export const TAG_LIGHT_TOKENS: Readonly<Record<string, string>> = {
  flame: 'kept-gold',
  shard: 'kept-cyan',
  edge: 'kept-white',
  echo: 'kept-blue',
  ward: 'rarity-plain',
  trade: 'glint',
};
/** Light for shots without a weapon row or tags (the 1.0 player shot colour). */
export const DEFAULT_LIGHT_TOKEN = 'kept-cyan';

/** [core, tail] palette tokens for a weapon's tags: first tag, then second tag (or the first again). */
export function weaponLightTokens(tags: readonly string[] | undefined): readonly [string, string] {
  const first = tags?.[0] !== undefined ? TAG_LIGHT_TOKENS[tags[0]] : undefined;
  const core = first ?? DEFAULT_LIGHT_TOKEN;
  const second = tags?.[1] !== undefined ? TAG_LIGHT_TOKENS[tags[1]] : undefined;
  return [core, second ?? core];
}

/** What a weapon shows when it fires, from its archetype (weapons.csv). */
export const WeaponFxKind = { Shot: 0, Orbit: 1, Arc: 2, Chain: 3, Ring: 4 } as const;
export type WeaponFxKind = (typeof WeaponFxKind)[keyof typeof WeaponFxKind];

export function weaponFxKindOf(archetype: unknown): WeaponFxKind {
  if (archetype === 'orbit') return WeaponFxKind.Orbit;
  if (archetype === 'arc') return WeaponFxKind.Arc;
  if (archetype === 'chain') return WeaponFxKind.Chain;
  if (archetype === 'ring_echo') return WeaponFxKind.Ring;
  return WeaponFxKind.Shot;
}

/** Muzzle flash life (s) and height above the feet / reach toward the facing (px). */
export const MUZZLE_FLASH_SEC = 0.1;
export const MUZZLE_DY_PX = 11;
export const MUZZLE_DX_PX = 8;
/** At most this many muzzle flashes start per frame (many weapons firing on one frame). */
export const MUZZLE_PER_FRAME = 4;

/** Muzzle flash alpha at an age (s): full, then fading over its second half; 0 with reduce effects. */
export function muzzleFlashAlpha(age: number, reduced: boolean): number {
  if (reduced || age < 0 || age >= MUZZLE_FLASH_SEC) return 0;
  const p = age / MUZZLE_FLASH_SEC;
  return p < 0.5 ? 1 : (1 - p) * 2;
}

/** Arc sweep, chain jump, and ring lives (s). */
export const ARC_SWEEP_SEC = 0.18;
export const CHAIN_LINK_SEC = 0.16;
export const RING_SEC = 0.28;
/** Chain line half width (u): about 1.5 px across the floor. */
export const CHAIN_HALF_WIDTH_U = 0.05;
/** Arc sweep half angle (turns) when the row has no arc_deg (weapons.csv arc_blade: 120 degrees). */
export const ARC_HALF_TURNS_DEFAULT = 1 / 6;

/** Ease-out fade 1 -> 0 over a life (1 - p^2), 0 outside it. */
export function fadeOut(age: number, life: number): number {
  if (age < 0 || age >= life || life <= 0) return 0;
  const p = age / life;
  return 1 - p * p;
}

/** The fields of a weapon row this module reads (GameData.weapons). */
export interface WeaponLookRow {
  readonly id: string;
  readonly tags?: readonly string[];
  readonly archetype?: string;
  readonly radius?: number | null;
  readonly params?: unknown;
}

function paramOf(row: WeaponLookRow, key: string): number | null {
  const p = row.params;
  if (p === null || typeof p !== 'object') return null;
  const v = (p as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : null;
}

export interface WeaponFx {
  /** Weapon light per weapon index (linear rgb x3); index n = shots without a weapon. */
  readonly core: Float32Array;
  readonly tail: Float32Array;
  readonly kinds: Uint8Array;
  /** Read this frame's events. px/py = interpolated hero feet, facing = sim facing toward the target. */
  ingest(events: SimEventReader, timeSec: number, px: number, py: number, facing: number): void;
  /**
   * One player shot: tail (when moving), halo, then the scaled body. wi = weapon index or -1.
   * gain = the shared emissive gain (1, or the bloom gain).
   */
  pushShot(
    batch: SpriteBatch,
    rect: AtlasFrameRect,
    anchorX: number,
    anchorY: number,
    flip: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    wi: number,
    gain: number,
  ): void;
  /** Muzzle flashes, following the hero (px, py). */
  drawSprites(batch: SpriteBatch, timeSec: number, px: number, py: number, gain: number): void;
  /** Arc sweeps, chain jumps, ring pulses. */
  drawAreas(areas: AreaBatch, timeSec: number): void;
  setReduced(on: boolean): void;
  clear(): void;
}

interface MutableStyle {
  fill: [number, number, number, number];
  edge: [number, number, number, number];
  dashed: boolean;
}

function firstAnim(entry: AtlasSpriteEntry | undefined): readonly AtlasFrameRect[] {
  const anim = entry === undefined ? undefined : Object.values(entry.animations)[0];
  return anim?.frames ?? [];
}

export function createWeaponFx(
  manifest: AtlasManifest,
  palette: PaletteDef,
  weapons: readonly WeaponLookRow[],
): WeaponFx {
  const n = weapons.length;
  const core = new Float32Array((n + 1) * 3);
  const tail = new Float32Array((n + 1) * 3);
  const kinds = new Uint8Array(n + 1);
  const radius = new Float32Array(n + 1);
  const halfArc = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const row = weapons[i];
    const [ct, tt] = weaponLightTokens(row?.tags);
    core.set(linearRgb(palette, ct), i * 3);
    tail.set(linearRgb(palette, tt), i * 3);
    kinds[i] = row === undefined ? WeaponFxKind.Shot : weaponFxKindOf(row.archetype);
    radius[i] = row?.radius ?? 0;
    const deg = row === undefined ? null : paramOf(row, 'arc_deg');
    halfArc[i] = deg === null ? ARC_HALF_TURNS_DEFAULT : deg / 360 / 2;
  }
  const light = (wi: number): number => (wi >= 0 && wi < n ? wi : n) * 3;

  const trailEntry = manifest.sprites['fx-trail'];
  const trailFrames = firstAnim(trailEntry);
  const trailAx = trailEntry?.anchor.x ?? 0;
  const trailAy = (trailEntry?.anchor.y ?? 0) - 2;
  const sparkEntry = manifest.sprites['fx-spark'];
  const sparkFrames = firstAnim(sparkEntry);
  const sparkAx = sparkEntry?.anchor.x ?? 0;
  const sparkAy = sparkEntry?.anchor.y ?? 0;

  let reduced = false;

  // ---- Muzzle flashes: relative to the hero, so they ride along for their 0.1 s. ----
  const FLASHES = 12;
  const mDx = new Int16Array(FLASHES);
  const mDy = new Int16Array(FLASHES);
  const mBorn = new Float64Array(FLASHES).fill(-1);
  const mLight = new Int16Array(FLASHES);
  let mNext = 0;

  // ---- Arc sweeps (cone), chain jumps (line), ring pulses (circle edge). ----
  const CONES = 8;
  const cX = new Float32Array(CONES);
  const cY = new Float32Array(CONES);
  const cAx = new Float32Array(CONES);
  const cAy = new Float32Array(CONES);
  const cR = new Float32Array(CONES);
  const cHalf = new Float32Array(CONES);
  const cBorn = new Float64Array(CONES).fill(-1);
  const cLight = new Int16Array(CONES);
  let cNext = 0;
  const LINKS = 24;
  const lX0 = new Float32Array(LINKS);
  const lY0 = new Float32Array(LINKS);
  const lX1 = new Float32Array(LINKS);
  const lY1 = new Float32Array(LINKS);
  const lBorn = new Float64Array(LINKS).fill(-1);
  const lLight = new Int16Array(LINKS);
  let lNext = 0;
  const RINGS = 8;
  const gX = new Float32Array(RINGS);
  const gY = new Float32Array(RINGS);
  const gR = new Float32Array(RINGS);
  const gBorn = new Float64Array(RINGS).fill(-1);
  const gLight = new Int16Array(RINGS);
  let gNext = 0;

  // Per-frame scratch per weapon: last hit this frame (arc aim) and the open chain end.
  const hitSet = new Uint8Array(n + 1);
  const hitX = new Float32Array(n + 1);
  const hitY = new Float32Array(n + 1);
  const chainOpen = new Uint8Array(n + 1);
  const chainX = new Float32Array(n + 1);
  const chainY = new Float32Array(n + 1);

  const style: MutableStyle = { fill: [0, 0, 0, 0], edge: [0, 0, 0, 0], dashed: false };
  const styleOf = style as unknown as AreaStyle;
  const setStyle = (li: number, fillA: number, edgeA: number): void => {
    const r = core[li] ?? 1;
    const g = core[li + 1] ?? 1;
    const b = core[li + 2] ?? 1;
    style.fill[0] = r;
    style.fill[1] = g;
    style.fill[2] = b;
    style.fill[3] = fillA;
    style.edge[0] = r;
    style.edge[1] = g;
    style.edge[2] = b;
    style.edge[3] = edgeA;
  };

  const link = (wi: number, x0: number, y0: number, x1: number, y1: number, t: number): void => {
    const i = lNext;
    lNext = (lNext + 1) % LINKS;
    lX0[i] = x0;
    lY0[i] = y0;
    lX1[i] = x1;
    lY1[i] = y1;
    lBorn[i] = t;
    lLight[i] = light(wi);
  };

  return {
    core,
    tail,
    kinds,
    ingest(ev, t, px, py, facing) {
      hitSet.fill(0);
      chainOpen.fill(0);
      let flashes = 0;
      for (let e = 0; e < ev.count; e++) {
        const type = ev.type[e];
        if (type === SimEventType.EnemyDamaged) {
          const src = ev.c[e] ?? 0;
          if (sourceKindOf(src) !== SourceKind.Weapon) continue;
          const wi = sourceIndexOf(src);
          if (wi >= n) continue;
          const hk = ((ev.b[e] ?? 0) >> DAMAGE_HIT_KIND_SHIFT) & 7;
          if (hk === HitKind.Dot || hk === HitKind.Zone) continue;
          const x = ev.x[e] ?? 0;
          const y = ev.y[e] ?? 0;
          hitSet[wi] = 1;
          hitX[wi] = x;
          hitY[wi] = y;
          if (hk === HitKind.Chain && kinds[wi] === WeaponFxKind.Chain) {
            if (chainOpen[wi] === 1) link(wi, chainX[wi] ?? px, chainY[wi] ?? py, x, y, t);
            else link(wi, px, py, x, y, t);
            chainOpen[wi] = 1;
            chainX[wi] = x;
            chainY[wi] = y;
          }
        } else if (type === SimEventType.WeaponFired) {
          const wi = ev.a[e] ?? -1;
          if (wi < 0 || wi >= n) continue;
          const x = ev.x[e] ?? px;
          const y = ev.y[e] ?? py;
          const kind = kinds[wi];
          if (kind === WeaponFxKind.Arc) {
            const i = cNext;
            cNext = (cNext + 1) % CONES;
            let ax = facing < 0 ? -1 : 1;
            let ay = 0;
            if (hitSet[wi] === 1) {
              const dx = (hitX[wi] ?? 0) - x;
              const dy = (hitY[wi] ?? 0) - y;
              if (dx * dx + dy * dy > 1e-6) {
                ax = dx;
                ay = dy;
              }
            }
            cX[i] = x;
            cY[i] = y;
            cAx[i] = x + ax;
            cAy[i] = y + ay;
            cR[i] = (radius[wi] ?? 0) > 0 ? (radius[wi] ?? 0) : 2;
            cHalf[i] = halfArc[wi] ?? ARC_HALF_TURNS_DEFAULT;
            cBorn[i] = t;
            cLight[i] = light(wi);
          } else if (kind === WeaponFxKind.Ring) {
            const i = gNext;
            gNext = (gNext + 1) % RINGS;
            gX[i] = x;
            gY[i] = y;
            gR[i] = (radius[wi] ?? 0) > 0 ? (radius[wi] ?? 0) : 2;
            gBorn[i] = t;
            gLight[i] = light(wi);
          } else if (kind === WeaponFxKind.Chain) {
            chainOpen[wi] = 0;
          }
          hitSet[wi] = 0;
          if (reduced || flashes >= MUZZLE_PER_FRAME) continue;
          const slot = ev.c[e] ?? 0;
          const i = mNext;
          mNext = (mNext + 1) % FLASHES;
          mDx[i] = (facing < 0 ? -1 : 1) * MUZZLE_DX_PX;
          // Copies firing close together sit 2 px apart so both flashes read.
          mDy[i] = MUZZLE_DY_PX + (slot % 3) * 2;
          mBorn[i] = t;
          mLight[i] = light(wi);
          flashes++;
        }
      }
    },
    pushShot(batch, rect, ax, ay, flip, x, y, vx, vy, wi, gain) {
      const li = light(wi);
      const cr = core[li] ?? 1;
      const cg = core[li + 1] ?? 1;
      const cb = core[li + 2] ?? 1;
      if (vx * vx + vy * vy > TAIL_MIN_SPEED * TAIL_MIN_SPEED) {
        const tg = gain * TAIL_HDR;
        for (let k = SHOT_TAIL.length - 1; k >= 0; k--) {
          const dot = SHOT_TAIL[k];
          const tr = dot === undefined ? undefined : trailFrames[dot.frame];
          if (dot === undefined || tr === undefined) continue;
          const src = dot.light === 'core' ? core : tail;
          const d = (k + 1) * TAIL_STEP_TICKS;
          batch.push(
            x - vx * d,
            y - vy * d,
            0,
            tr,
            trailAx,
            trailAy,
            1,
            0,
            0,
            (src[li] ?? 1) * tg,
            (src[li + 1] ?? 1) * tg,
            (src[li + 2] ?? 1) * tg,
            1,
            dot.alpha,
            0,
            0,
            0,
            0,
            0,
            0,
            dot.scale,
          );
        }
      }
      const hg = gain * SHOT_CORE_HDR * 0.6;
      batch.push(
        x,
        y,
        0,
        rect,
        ax,
        ay,
        flip,
        0,
        0,
        cr * hg,
        cg * hg,
        cb * hg,
        1,
        SHOT_HALO_ALPHA,
        0,
        0,
        0,
        0,
        0,
        0,
        SHOT_HALO_SCALE,
      );
      const sg = gain * SHOT_CORE_HDR;
      batch.push(
        x,
        y,
        0,
        rect,
        ax,
        ay,
        flip,
        0,
        0,
        cr * sg,
        cg * sg,
        cb * sg,
        SHOT_TINT,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        PLAYER_SHOT_SCALE,
      );
    },
    drawSprites(batch, t, px, py, gain) {
      const g = gain * SHOT_CORE_HDR;
      for (let i = 0; i < FLASHES; i++) {
        const born = mBorn[i] ?? -1;
        if (born < 0) continue;
        const age = t - born;
        const a = muzzleFlashAlpha(age, reduced);
        if (a <= 0) {
          if (age >= MUZZLE_FLASH_SEC || reduced) mBorn[i] = -1;
          continue;
        }
        const fi = Math.min(
          sparkFrames.length - 1,
          Math.floor((age / MUZZLE_FLASH_SEC) * sparkFrames.length),
        );
        const rect = sparkFrames[fi];
        if (rect === undefined) continue;
        const li = mLight[i] ?? 0;
        batch.push(
          px,
          py,
          0,
          rect,
          sparkAx,
          sparkAy,
          1,
          mDx[i] ?? 0,
          mDy[i] ?? 0,
          (core[li] ?? 1) * g,
          (core[li + 1] ?? 1) * g,
          (core[li + 2] ?? 1) * g,
          0.7,
          a,
          0,
          0,
          0,
          0,
          0,
          0,
          2,
        );
      }
    },
    drawAreas(areas, t) {
      for (let i = 0; i < CONES; i++) {
        const born = cBorn[i] ?? -1;
        if (born < 0) continue;
        const f = fadeOut(t - born, ARC_SWEEP_SEC);
        if (f <= 0) {
          if (t - born >= ARC_SWEEP_SEC) cBorn[i] = -1;
          continue;
        }
        setStyle(cLight[i] ?? 0, 0.22 * f, 0.9 * f);
        areas.push(
          AreaShape.Cone,
          cX[i] ?? 0,
          cY[i] ?? 0,
          cAx[i] ?? 0,
          cAy[i] ?? 0,
          cR[i] ?? 0,
          cHalf[i] ?? 0,
          0,
          0,
          1,
          styleOf,
        );
      }
      for (let i = 0; i < LINKS; i++) {
        const born = lBorn[i] ?? -1;
        if (born < 0) continue;
        const f = fadeOut(t - born, CHAIN_LINK_SEC);
        if (f <= 0) {
          if (t - born >= CHAIN_LINK_SEC) lBorn[i] = -1;
          continue;
        }
        setStyle(lLight[i] ?? 0, 0.95 * f, 0.95 * f);
        areas.push(
          AreaShape.Line,
          lX0[i] ?? 0,
          lY0[i] ?? 0,
          lX1[i] ?? 0,
          lY1[i] ?? 0,
          0,
          CHAIN_HALF_WIDTH_U,
          0,
          0,
          1,
          styleOf,
        );
      }
      for (let i = 0; i < RINGS; i++) {
        const born = gBorn[i] ?? -1;
        if (born < 0) continue;
        const age = t - born;
        const f = fadeOut(age, RING_SEC);
        if (f <= 0) {
          if (age >= RING_SEC) gBorn[i] = -1;
          continue;
        }
        const p = Math.min(1, age / RING_SEC);
        const ease = 1 - (1 - p) * (1 - p);
        const r = 0.3 + ((gR[i] ?? 0) - 0.3) * ease;
        setStyle(gLight[i] ?? 0, 0.1 * f, 0.95 * f);
        areas.push(AreaShape.Circle, gX[i] ?? 0, gY[i] ?? 0, 0, 0, r, 0, 0, 0, 1, styleOf);
      }
    },
    setReduced(on) {
      reduced = on;
    },
    clear() {
      mBorn.fill(-1);
      cBorn.fill(-1);
      lBorn.fill(-1);
      gBorn.fill(-1);
      hitSet.fill(0);
      chainOpen.fill(0);
    },
  };
}
