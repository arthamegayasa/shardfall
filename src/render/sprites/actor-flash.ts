// Unlit hit flash and windup telegraph look (AD, M4-01; style-guide 1.3 sections 1.4 and 1.8, CD M3 polish 1,
// BUG-007). Pure helpers used by entity-layers.ts.
//
// Hit flash: a partial `bone` tint (0.5 normal Unlit, 0.35 Warden and boss), never a full replacement, so
// a hit Unlit never becomes the brightest thing on screen. Periodic damage (zone ticks, Burn) never
// flashes: the sim sets hitFlashTicks for every applyHit, including zone ticks, so render decides which
// hits flash by matching this frame's EnemyDamaged events (HitKind Zone and Dot excluded) to the nearest
// slot that the sim marked as hit. Render may not import sim, so the matching lives here.
//
// Windup: the body keeps its dark `unlit-body` value (three value layers) and the 1 px ink outline turns
// bright danger magenta, pulsing toward the pale danger core. The outline stays well above the floor in
// grayscale (P10 1.5:1 per actor, BUG-007) instead of the old dark-red body tint (1.0:1).

import { DAMAGE_HIT_KIND_SHIFT, EnemyRank, HitKind, SimEventType } from '../../core/index.ts';
import type { SimEventReader } from '../../core/index.ts';

/** Unlit hit flash strength by rank (style-guide 1.4: bone tint max 50%, Warden and boss 35%). */
export const UNLIT_HIT_FLASH_ALPHA = 0.5;
export const BIG_FOE_HIT_FLASH_ALPHA = 0.35;
/** Event to slot match radius (u). Events carry the target's position at hit time. */
export const HIT_MATCH_RADIUS_U = 1;

export function unlitFlashAlpha(rank: number): number {
  return rank === EnemyRank.Warden || rank === EnemyRank.Boss
    ? BIG_FOE_HIT_FLASH_ALPHA
    : UNLIT_HIT_FLASH_ALPHA;
}

/** Hit kinds that never flash: periodic damage from zones and Burn ticks. */
export function isPeriodicHit(damageFlags: number): boolean {
  const kind = (damageFlags >> DAMAGE_HIT_KIND_SHIFT) & 7;
  return kind === HitKind.Zone || kind === HitKind.Dot;
}

/** Enemy pool columns the tracker reads (subset of EnemyPoolView). */
export interface FlashPoolView {
  readonly highWater: number;
  readonly alive: ArrayLike<number>;
  readonly serial: ArrayLike<number>;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly hitFlashTicks: ArrayLike<number>;
}

export interface HitFlashTracker {
  /** Read this frame's events against the pool. Call once per rendered frame before flashing(). */
  update(events: SimEventReader, pool: FlashPoolView): void;
  /** True while the slot shows a hit flash (an impact hit landed and the sim flash still runs). */
  flashing(slot: number): boolean;
  clear(): void;
}

/**
 * A slot is armed by a non-periodic EnemyDamaged event matched to it (nearest slot with
 * hitFlashTicks > 0 within HIT_MATCH_RADIUS_U) and disarmed when the sim flash ends or the slot is
 * reused. Fixed arrays grown on first use; no allocation per frame afterwards.
 */
export function createHitFlashTracker(): HitFlashTracker {
  let cap = 0;
  let armed = new Uint8Array(0);
  let armedSerial = new Uint32Array(0);
  const r2 = HIT_MATCH_RADIUS_U * HIT_MATCH_RADIUS_U;

  return {
    update(ev, pool) {
      const n = pool.highWater;
      if (n > cap) {
        const nextArmed = new Uint8Array(n);
        nextArmed.set(armed);
        const nextSerial = new Uint32Array(n);
        nextSerial.set(armedSerial);
        armed = nextArmed;
        armedSerial = nextSerial;
        cap = n;
      }
      // Disarm finished flashes and reused slots.
      for (let s = 0; s < cap; s++) {
        if (armed[s] === 0) continue;
        if (
          s >= n ||
          pool.alive[s] === 0 ||
          (pool.hitFlashTicks[s] ?? 0) <= 0 ||
          pool.serial[s] !== armedSerial[s]
        )
          armed[s] = 0;
      }
      for (let e = 0; e < ev.count; e++) {
        if (ev.type[e] !== SimEventType.EnemyDamaged) continue;
        if (isPeriodicHit(ev.b[e] ?? 0)) continue;
        const ex = ev.x[e] ?? 0;
        const ey = ev.y[e] ?? 0;
        let best = -1;
        let bestD = r2;
        for (let s = 0; s < n; s++) {
          if (pool.alive[s] === 0 || (pool.hitFlashTicks[s] ?? 0) <= 0) continue;
          const dx = (pool.x[s] ?? 0) - ex;
          const dy = (pool.y[s] ?? 0) - ey;
          const d = dx * dx + dy * dy;
          if (d <= bestD) {
            bestD = d;
            best = s;
          }
        }
        if (best >= 0) {
          armed[best] = 1;
          armedSerial[best] = pool.serial[best] ?? 0;
        }
      }
    },
    flashing(slot) {
      return slot < cap && armed[slot] === 1;
    },
    clear() {
      armed.fill(0);
    },
  };
}

/** Windup outline pulse: ticks per half period (on magenta, then toward the pale core). */
export const WINDUP_OUTLINE_TICKS = 4;
/** Share of danger-core mixed into the bright half of the pulse. */
export const WINDUP_OUTLINE_CORE_MIX = 0.5;

/** Windup outline colour (linear rgb) for a clock: magenta, then magenta mixed toward the pale core. */
export function windupOutline(
  clock: number,
  magenta: readonly [number, number, number],
  core: readonly [number, number, number],
  out: [number, number, number],
): [number, number, number] {
  const bright = Math.floor(clock / WINDUP_OUTLINE_TICKS) % 2 === 1;
  const k = bright ? WINDUP_OUTLINE_CORE_MIX : 0;
  out[0] = magenta[0] + (core[0] - magenta[0]) * k;
  out[1] = magenta[1] + (core[1] - magenta[1]) * k;
  out[2] = magenta[2] + (core[2] - magenta[2]) * k;
  return out;
}

/** WCAG relative luminance of a linear rgb colour. */
export function relativeLuminance(rgb: readonly [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** WCAG contrast ratio of two linear rgb colours (>= 1). */
export function contrastRatio(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
