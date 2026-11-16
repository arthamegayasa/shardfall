// unlit-charger (Market Cur), final M2 sprite. Long horizontal quadruped, head forward, faces right.
// Wrong trait: every leg has one knee too many (zigzag legs). walk 4 alternates diagonal leg pairs;
// windup 2 crouches low with the head down and the eye flaring pale (charge telegraph, GDD).

import { paste, recolor, shift } from './sprite-types.ts';
import type { Rows, SpriteSheetDef } from './sprite-types.ts';

const BODY: Rows = [
  '...............u.u..',
  '..............uuuu..',
  '.............uuRuuuu',
  '.uu.........uuuuuuu.',
  'uuuuuuuuuuuuuuuuu...',
  '.uuuuuuuuuuuuuuu....',
  '..uuuuuuuuuuuuu.....',
];
/** Legs with an extra knee: 7 rows, front pair at x 12, back pair at x 2. */
const LEG_A: Rows = ['uu.uu', 'u...u', 'uu..uu', '.u...u', 'uu..uu', 'u...u', 'uu..uu'];
const LEG_B: Rows = ['.uu.uu', '.u...u', '.uu..uu', '..u...u', '.uu..uu', '.u...u', 'uu..uu.'];

function frame(back: Rows, front: Rows, bob: number): string[] {
  let g = [...BODY, ...new Array<string>(7).fill('.'.repeat(20))];
  g = paste(g, back, 2, 7);
  g = paste(g, front, 12, 7);
  return bob === 0 ? g : shift(g, 0, bob);
}

const walk = [
  frame(LEG_A, LEG_A, 0),
  frame(LEG_B, LEG_A, 0),
  frame(LEG_B, LEG_B, 0),
  frame(LEG_A, LEG_B, 0),
];

/** Crouch: body pressed down one row onto shortened legs, head lowered, eye pale on frame 1. */
function crouch(lit: boolean): string[] {
  const legs: Rows = ['uu.uu', 'u...u', 'uu..uu', '.u...u', 'uu..uu', 'u...u'];
  let g = [
    '.'.repeat(20),
    ...BODY.slice(0, 2).map((r) => '.' + r.slice(0, 19)),
    ...BODY.slice(2),
    ...new Array<string>(6).fill('.'.repeat(20)),
  ];
  g = paste(g, legs, 2, 8);
  g = paste(g, legs, 12, 8);
  return lit ? recolor(g, { R: 'p' }) : g;
}

const sprite: SpriteSheetDef = {
  id: 'unlit-charger',
  class: 'unlit-medium',
  faction: 'unlit',
  frameW: 24,
  frameH: 24,
  anchor: { x: 12, y: 23 },
  outline: 'ink',
  status: 'final',
  note: 'Role charger (Market Cur). Long horizontal quadruped, head forward. Wrong: legs with extra knees. Faces right, runtime flips.',
  animations: {
    idle: { ticksPerFrame: 10, loop: true, frames: [walk[0] ?? [], walk[0] ?? []] },
    walk: { ticksPerFrame: 6, loop: true, frames: walk },
    windup: { ticksPerFrame: 5, loop: true, frames: [crouch(false), crouch(true)] },
  },
};

export default sprite;
