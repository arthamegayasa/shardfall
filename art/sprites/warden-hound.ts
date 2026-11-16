// warden-hound: Brass Collar, the Thrice-Leaping (Warden of biome 1), final M2 sprite. Faces right.
// Silhouette: giant hound with a ridge of spines. Wrong: three magenta eyes, legs with double knees.
// walk 4: diagonal leg pairs step; windup 2: crouch with the eyes flaring pale (leap telegraph);
// attack 2: legs tucked mid leap (the renderer adds the hop height).

import { paste, recolor, shift } from './sprite-types.ts';
import type { Rows, SpriteSheetDef } from './sprite-types.ts';

const BODY: Rows = [
  '................................u...u.....',
  '................................uu..uu....',
  '........u...u...u...u...u......uuuuuuuuu..',
  'u.......uu..uu..uu..uu..uu.....uuuuuuuuu..',
  'uu.....uuu.uuu.uuu.uuu.uuu.uuuuuuumuumuu..',
  '.uu.....uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
  '..uu.uuuuuuuuuuuuuuuuuuuuuuuuuuuuuumuuuuuu',
  '....uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
  '....uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu....',
  '....uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu.',
  '....uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu........',
  '....uuuuuuuuuuuuuuuuuuuuuuuuuuuuu.........',
  '....uuuuuuuuuuuuuuuuuuuuuuuuuuu...........',
  '....uuuuuuuuuuuuuuuuuuuuuuuuuuu...........',
];
const LEGS: Rows = [
  '......uu...uuuuuuuuuuuuuuu...uu...........',
  '......uu....uu.........uu....uu...........',
  '......uu....uu.........uu....uu...........',
  '......uu....uu.........uu....uu...........',
  '....uuuu..uuuu.........uuuu..uuuu.........',
  '....uu....uu.............uu....uu.........',
  '....uu....uu.............uu....uu.........',
  '....uu....uu.............uu....uu.........',
  '....uuuu..uuuu.........uuuu..uuuu.........',
  '......uu....uu.........uu....uu...........',
  '......uu....uu.........uu....uu...........',
  '......uu....uu.........uu....uu...........',
  '....uuuu..uuuu.........uuuu..uuuu.........',
  '....uu....uu.............uu....uu.........',
  '....uu....uu.............uu....uu.........',
  '...RuuR..RuuR...........RuuR..RuuR........',
];

const W = 42;
const empty = (n: number): string[] => new Array<string>(n).fill('.'.repeat(W));

/** Leg block split in back (x < 18) and front pairs, each moved by its own dx. */
function legs(backDx: number, frontDx: number, rows: Rows = LEGS): string[] {
  const back = rows.map((r) => r.slice(0, 18) + '.'.repeat(W - 18));
  const front = rows.map((r) => '.'.repeat(18) + r.slice(18));
  const out = empty(rows.length);
  return paste(paste(out, shift(back, backDx, 0), 0, 0), shift(front, frontDx, 0), 0, 0);
}

const walk = [
  [...BODY, ...legs(0, 0)],
  [...BODY, ...legs(1, -1)],
  [...BODY, ...legs(0, 0)],
  [...BODY, ...legs(-1, 1)],
];

/** Crouch: body pressed down by dropping the upper knee section of the legs (4 rows shorter). */
function crouch(lit: boolean): string[] {
  const short = [...LEGS.slice(0, 2), ...LEGS.slice(6)];
  const g = [...BODY, ...legs(-1, 1, short)];
  return lit ? recolor(g, { m: 'p' }) : g;
}

/** Leap: legs folded (every other leg row), back legs pushed behind, front legs reaching. */
function leap(f: number): string[] {
  const folded = LEGS.filter((_, i) => i % 2 === 0);
  return [...BODY, ...legs(-2 - f, 2 + f, folded)];
}

const sprite: SpriteSheetDef = {
  id: 'warden-hound',
  class: 'warden',
  faction: 'unlit',
  frameW: 48,
  frameH: 48,
  anchor: { x: 24, y: 47 },
  outline: 'ink',
  emissive: ['danger-magenta', 'danger-core'],
  status: 'final',
  note: 'warden_hound (Brass Collar). Giant hound with spines. Wrong: three magenta eyes, double-kneed legs. Faces right.',
  animations: {
    idle: { ticksPerFrame: 20, loop: true, frames: [walk[0] ?? []] },
    walk: { ticksPerFrame: 7, loop: true, frames: walk },
    windup: { ticksPerFrame: 5, loop: true, frames: [crouch(false), crouch(true)] },
    attack: { ticksPerFrame: 6, loop: false, frames: [leap(0), leap(1)] },
  },
};

export default sprite;
