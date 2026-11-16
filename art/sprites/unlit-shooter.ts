// unlit-shooter (Hawker), final M2 sprite. Round lantern head on a thin stalk. Rows hold the left half.
// Wrong trait: its light is a magenta hole that fires. walk 2: stalk feet step; windup 2: the hole widens
// and the pale core swells for 0.4 s before the shot (GDD telegraph).

import { recolor } from './sprite-types.ts';
import type { Rows, SpriteSheetDef } from './sprite-types.ts';

const HEAD: Rows = ['....u', '..uuu', '.uumm', '.umpp', '.umpp', '.uumm', '..uuu', '...uu', '....u'];
const NECK_LOW: Rows = ['....u', '..uuu', '.uu.u', '.u..u', '.u.uu', '...u.', '..uu.'];
const NECK_HIGH: Rows = ['..uuu', '.uu.u', '.u..u', '.u.uu', '...u.', '..uu.'];
const STEP_A: Rows = ['....u', '..uuu', '.uu.u', '.u..u', '.u.uu', '...uu', '...u.'];
const STEP_B: Rows = ['....u', '..uuu', '.uu.u', '.u..u', '..uuu', '..uu.', '.uu..'];

/** Windup head: the hole eats the rim (wider magenta), core grows to the whole centre. */
const HEAD_OPEN: Rows = ['...uu', '..umm', '.ummp', '.umpp', '.umpp', '.ummp', '..umm', '...uu', '....u'];
const HEAD_FLARE: Rows = recolor(HEAD_OPEN, { m: 'p' }).map((r, i) => (i === 3 || i === 4 ? '.mppp' : r));

const sprite: SpriteSheetDef = {
  id: 'unlit-shooter',
  class: 'unlit-medium',
  faction: 'unlit',
  frameW: 24,
  frameH: 24,
  anchor: { x: 12, y: 23 },
  outline: 'ink',
  mirror: 'odd',
  emissive: ['danger-core', 'danger-magenta'],
  status: 'final',
  note: 'Role shooter (Hawker). Round lantern head on a thin stalk. Wrong: its light is a magenta hole that fires.',
  animations: {
    idle: {
      ticksPerFrame: 18,
      loop: true,
      frames: [
        [...HEAD, ...NECK_LOW],
        [...HEAD, ...NECK_HIGH],
      ],
    },
    walk: {
      ticksPerFrame: 9,
      loop: true,
      frames: [
        [...HEAD, ...STEP_A],
        [...HEAD, ...STEP_B],
      ],
    },
    windup: {
      ticksPerFrame: 6,
      loop: true,
      frames: [
        [...HEAD_OPEN, ...NECK_LOW],
        [...HEAD_FLARE, ...NECK_LOW],
      ],
    },
  },
};

export default sprite;
