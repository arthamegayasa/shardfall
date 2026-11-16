// boss_lantern (biome 1 boss), generated procedurally. Output uses the same grid format as JSON sprites.
// Silhouette: a huge caged lantern hanging from a hook, tendrils below.
// Wrong trait: the lantern's flame is a hole that drinks light; red eyes scattered unevenly around it.
// Deterministic on every engine (architecture.md 10): only + - * /, Math.sqrt, Math.round and
// src/core/math sinTurns, never Math.sin or Math.hypot.

import { sinTurns, TAU } from '../../src/core/math/index.ts';
import type { SpriteSheetDef } from './sprite-types.ts';

const W = 72;
const H = 82;

const dist = (dx: number, dy: number): number => Math.sqrt(dx * dx + dy * dy);

/**
 * One frame. `phase` (turns) sways the tendrils. `stage` 2 is the second boss phase: the cage cracks
 * (two ribs gone, a jagged break in the rim), the hole widens and red eyes multiply, tendrils grow.
 * `flare` is the attack windup: the hole's rings brighten one step toward the pale core.
 */
function grid(phase: number, stage: 1 | 2 = 1, flare = false): string[] {
  const g: string[] = new Array<string>(W * H).fill('.');
  const set = (x: number, y: number, c: string): void => {
    if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = c;
  };
  const at = (x: number, y: number): string => g[y * W + x] ?? '.';
  const cx = W / 2 - 0.5;
  // Hook ring (rows 0..7)
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < W; x++) {
      const d = dist(x - cx, (y - 4) * 1.1);
      if (d >= 2.5 && d <= 4.5) set(x, y, 'u');
    }
  // Cap: trapezoid rows 8..15
  for (let y = 8; y < 16; y++) {
    const half = 8 + (y - 8) * 2.6;
    for (let x = 0; x < W; x++) if (Math.abs(x - cx) <= half) set(x, y, 'u');
  }
  // Cage body: ellipse rows 14..64
  const ey = 39;
  const rx = 33;
  const ry = 25;
  for (let y = 14; y < 66; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - ey) / ry;
      if (dx * dx + dy * dy <= 1) set(x, y, 'u');
    }
  // Hollow core: violet window with magenta ring and pale centre.
  for (let y = 14; y < 66; y++)
    for (let x = 0; x < W; x++) {
      const d = dist((x - cx) / (stage === 2 ? 22 : 19), (y - ey) / (stage === 2 ? 18 : 15));
      const core = flare ? 0.5 : 0.32;
      const ring = flare ? 0.75 : 0.55;
      if (d <= 1) set(x, y, d <= core ? 'p' : d <= ring ? 'm' : 'v');
    }
  // Cage ribs over the core (body colour bars).
  for (const off of stage === 2 ? [-12, 12] : [-12, -4, 4, 12]) {
    const x = Math.round(cx + off);
    for (let y = 22; y < 57; y++) if (at(x, y) === 'v' || at(x, y) === 'm') set(x, y, 'u');
  }
  // Uneven red eyes around the core.
  const eyes: readonly (readonly [number, number])[] = [
    [14, 30],
    [57, 26],
    [20, 52],
    [53, 49],
    [44, 18],
    [9, 41],
  ];
  const extra: readonly (readonly [number, number])[] =
    stage === 2 ? [[30, 60], [62, 37], [24, 21], [48, 58]] : [];
  for (const [x, y] of [...eyes, ...extra]) {
    set(x, y, 'R');
    set(x + 1, y, 'R');
  }
  // Tendrils rows 63..81. Sway = 1.5 px sine; t * 0.6 rad per row converted to turns.
  for (let i = 0; i < 7; i++) {
    const baseX = cx - 24 + i * 8;
    const len = Math.min(H - 63, 12 + ((i * 5) % 7) + (stage === 2 ? 4 : 0));
    for (let t = 0; t < len; t++) {
      const amp = stage === 2 ? 2.5 : 1.5;
      const x = Math.round(baseX + sinTurns((t * 0.6 + i) / TAU + phase) * amp);
      set(x, 63 + t, 'u');
      if (t < len - 4) set(x + 1, 63 + t, 'u');
    }
  }
  // Stage 2 crack: a jagged notch through the upper right of the cage rim into the hole.
  if (stage === 2)
    for (let k = 0; k < 9; k++) {
      const x = 50 + k + (k % 2);
      const y = 16 + k * 2;
      set(x, y, '.');
      set(x + 1, y, '.');
      set(x, y + 1, '.');
    }
  const rows: string[] = [];
  for (let y = 0; y < H; y++) rows.push(g.slice(y * W, y * W + W).join(''));
  return rows;
}

const sprite: SpriteSheetDef = {
  id: 'boss-lantern',
  class: 'boss',
  faction: 'unlit',
  frameW: 128,
  frameH: 128,
  anchor: { x: 64, y: 127 },
  outline: 'ink',
  emissive: ['danger-magenta', 'danger-violet'],
  status: 'final',
  note: 'boss_lantern (Paper Sun). Giant caged lantern on a hook. Wrong: its flame is a hole that drinks light; red eyes scattered unevenly. Phase 2: cracked cage, wider hole, more eyes.',
  animations: {
    idle: { ticksPerFrame: 24, loop: true, frames: [grid(0), grid(0.25)] },
    idle2: { ticksPerFrame: 14, loop: true, frames: [grid(0, 2), grid(0.33, 2), grid(0.66, 2)] },
    windup: { ticksPerFrame: 6, loop: true, frames: [grid(0, 1, true), grid(0.25, 1)] },
    windup2: { ticksPerFrame: 5, loop: true, frames: [grid(0, 2, true), grid(0.5, 2)] },
  },
};

export default sprite;
