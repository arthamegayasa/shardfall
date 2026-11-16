// kept-lantern: the Lamplighter (class `lantern`), final M2 sprite. Generator so every frame is the
// same base drawing with small, reviewable overlays (art-pipeline 3.4, 3.5).
// Silhouette key: wide flat brim. Accent gold. Faces right with a hand lantern; runtime flips for left.
// Animations: idle 4 (breath + flame flicker), walk 4 (legs, bob, lantern swing), cast 2 (Rite: lantern
// raised overhead, then a flare burst), hit 2 (recoil away from facing, eyes squeezed shut).

import { paste, shift } from './sprite-types.ts';
import type { Rows, SpriteSheetDef } from './sprite-types.ts';

/** 16 columns, 18 rows. Legs are the last two rows. */
const BASE: Rows = [
  '......bbbb......',
  '.....bBBBBb.....',
  '.....gggggg.....',
  '..bbBBBBBBBBbb..',
  '.bBBBBBBBBBBBBb.',
  '....beeeeeeb....',
  '....beekeekb....',
  '....beeeeeeb....',
  '.....bggggb.....',
  '....bBBggBBb....',
  '...gBBBccBBBg...',
  '...ebggggggbe...',
  '...eBBBggBBBe...',
  '....bBBccBBb.k..',
  '....bBcggcBb.wg.',
  '....bgccccgb.gw.',
  '.....hh..hh.....',
  '.....hh..hh.....',
];

const LEGS = {
  stand: ['.....hh..hh.....', '.....hh..hh.....'],
  strideA: ['....hh....hh....', '...hh......hh...'],
  strideB: ['.....hh...hh....', '....hh.....hh...'],
} as const;

const FLAME_SWAP: Rows = ['.gw.', '.wg.'];

/** Body (rows 0..15) over a leg block. lift adds one leg row so the body rises a pixel (passing pose). */
function body(rows: Rows, lift: boolean, legs: Rows): string[] {
  const top = rows.slice(0, 16);
  return lift ? [...top, ...legs.slice(0, 1), ...legs] : [...top, ...legs];
}

const flicker = (rows: Rows): string[] => paste(rows, FLAME_SWAP, 12, 14);

/** Breathing frame: everything above the legs sinks one row (head and coat squash into the legs row). */
function breathe(rows: Rows): string[] {
  const top = rows.slice(0, 16);
  return ['.'.repeat(16), ...top.slice(0, 15), top[15] ?? '', ...LEGS.stand.slice(1)];
}

const idle: string[][] = [
  [...BASE],
  flicker(BASE),
  breathe(BASE),
  breathe(flicker(BASE)),
];

/** Lantern swung back one column and up one row (mid stride). */
function swing(rows: Rows): string[] {
  const cleared = paste(rows, ['   ', '   ', '   '], 12, 13);
  return paste(cleared, ['.k.', 'gw.', 'wg.'], 12, 12);
}

const walk: string[][] = [
  body(BASE, false, LEGS.strideA),
  body(swing(BASE), true, LEGS.stand),
  body(flicker(BASE), false, LEGS.strideB),
  body(swing(flicker(BASE)), true, LEGS.stand),
];

/** Rite pose: the lantern leaves the hand and rises overhead on a raised arm (two extra rows on top). */
function castFrame(burst: boolean): string[] {
  const low = paste(BASE, ['   ', '   ', '   ', '   ', '   '], 12, 11);
  const grown = ['.'.repeat(16), '.'.repeat(16), ...low];
  // Arm up the right side: hidden behind the brim (rows 5, 6), sleeve joint at the shoulder.
  const arm = paste(grown, ['e', '.', '.', 'e', 'e', 'e', 'e', 'e', 'e', 'B'], 13, 4);
  const lantern = burst
    ? ['.w.y.', 'ywgwy', '.gwg.', 'ywgwy', '.y.w.']
    : ['..k..', '.gwg.', '.wyw.', '.gwg.', '.....'];
  return paste(arm, lantern, 11, 0);
}

const cast: string[][] = [castFrame(false), castFrame(true)];

/** Hit: eyes squeezed into dashes; frame 0 recoils one column back (left, away from facing). */
function hurt(rows: Rows): string[] {
  return paste(rows, ['bekkekkb'], 4, 6);
}

const hit: string[][] = [shift(hurt(BASE), -1, 0), hurt(flicker(BASE))];

const sprite: SpriteSheetDef = {
  id: 'kept-lantern',
  class: 'kept',
  faction: 'kept',
  frameW: 24,
  frameH: 24,
  anchor: { x: 12, y: 23 },
  outline: 'ink',
  status: 'final',
  note: 'Class lantern (Lamplighter). Silhouette: wide flat brim. Accent gold. Faces right with a hand lantern; runtime flips for left. Rite raises the lantern overhead.',
  animations: {
    idle: { ticksPerFrame: 16, loop: true, frames: idle },
    walk: { ticksPerFrame: 7, loop: true, frames: walk },
    cast: { ticksPerFrame: 9, loop: false, frames: cast },
    hit: { ticksPerFrame: 4, loop: false, frames: hit },
  },
};

export default sprite;
