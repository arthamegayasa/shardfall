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

/** One frame. `phase` (turns) sways the tendrils so idle frames differ only below the cage. */
function grid(phase: number): string[] {
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
      const d = dist((x - cx) / 19, (y - ey) / 15);
      if (d <= 1) set(x, y, d <= 0.32 ? 'p' : d <= 0.55 ? 'm' : 'v');
    }
  // Cage ribs over the core (body colour bars).
  for (const off of [-12, -4, 4, 12]) {
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
  for (const [x, y] of eyes) {
    set(x, y, 'R');
    set(x + 1, y, 'R');
  }
  // Tendrils rows 63..81. Sway = 1.5 px sine; t * 0.6 rad per row converted to turns.
  for (let i = 0; i < 7; i++) {
    const baseX = cx - 24 + i * 8;
    const len = 12 + ((i * 5) % 7);
    for (let t = 0; t < len; t++) {
      const x = Math.round(baseX + sinTurns((t * 0.6 + i) / TAU + phase) * 1.5);
      set(x, 63 + t, 'u');
      if (t < len - 4) set(x + 1, 63 + t, 'u');
    }
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
  status: 'placeholder',
  note: 'boss_lantern. Giant caged lantern on a hook. Wrong: its flame is a hole that drinks light; red eyes scattered unevenly; tendrils sway.',
  animations: { idle: { ticksPerFrame: 24, loop: true, frames: [grid(0), grid(0.25)] } },
};

export default sprite;
