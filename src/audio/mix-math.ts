// Small pure mix formulas shared by the engine and tests (architecture 6.8, 11; audio-direction 8.6, 8.7).

import type { ArenaDef } from '../core/index.ts';

/** Fader value 0..100 to linear gain: (v / 100) ^ 2, 0 = full mute. */
export function volumeToGain(v: number): number {
  const x = Math.min(100, Math.max(0, v)) / 100;
  return x * x;
}

export interface PanBounds {
  readonly centerX: number;
  readonly halfWidth: number;
}

/** Final arena is 32 u wide, centred on 0 (architecture 11), used until setArena is called. */
export const DEFAULT_PAN_BOUNDS: PanBounds = { centerX: 0, halfWidth: 16 };

/** Horizontal extent of the arena boundary polygon. */
export function panBoundsOf(arena: ArenaDef): PanBounds {
  let min = Infinity;
  let max = -Infinity;
  for (const p of arena.arena.boundary) {
    if (p[0] < min) min = p[0];
    if (p[0] > max) max = p[0];
  }
  if (!(max > min)) return DEFAULT_PAN_BOUNDS;
  return { centerX: (min + max) / 2, halfWidth: (max - min) / 2 };
}

/** pan = clamp((x - cx) / halfWidth, -1, 1) * 0.6 (audio-direction 8.6). */
export function panForX(x: number, b: PanBounds): number {
  const v = (x - b.centerX) / b.halfWidth;
  return Math.min(1, Math.max(-1, v)) * 0.6;
}

/** Coalesced triggers sound bigger, not more: +1 dB per doubling, capped (audio-direction 8.4). */
export function coalesceBoostDb(count: number, maxBoostDb: number): number {
  if (count <= 1 || maxBoostDb <= 0) return 0;
  return Math.min(maxBoostDb, Math.log2(count));
}
