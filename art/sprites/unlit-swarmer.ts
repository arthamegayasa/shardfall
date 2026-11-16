// unlit-swarmer (Lampmoth), final M2 sprite. Low wide dome on too many legs.
// Wrong trait: three red eyes in a row (art-direction 5.1). Rows hold the left half (mirror 'odd').
// walk 4: the legs ripple in two phases; windup 2: the dome rears up and the eyes go pale before contact.

import { paste, recolor } from './sprite-types.ts';
import type { Rows, SpriteSheetDef } from './sprite-types.ts';

const DOME: Rows = ['....uu', '..uuuu', '.uuuuu', '.uRuuR', 'uuuuuu', 'uuuuuu'];
const LEGS: readonly Rows[] = [
  ['.u.u.u', '.u.u.u'],
  ['u.u.u.', 'u.u.u.'],
  ['.u.u.u', 'u.u.u.'],
  ['u.u.u.', '.u.u.u'],
];

const frame = (legs: Rows): string[] => [...DOME, ...legs];
/** Rear: dome lifted one row on stretched legs, eyes lit pale (danger-core). */
const rear = (legs: Rows): string[] =>
  recolor([...DOME, ...paste(['......'], ['u.u.u.'], 0, 0), ...legs], { R: 'p' });

const sprite: SpriteSheetDef = {
  id: 'unlit-swarmer',
  class: 'unlit-small',
  faction: 'unlit',
  frameW: 16,
  frameH: 16,
  anchor: { x: 8, y: 15 },
  outline: 'ink',
  mirror: 'odd',
  status: 'final',
  note: 'Role swarmer (Lampmoth). Low wide dome on many legs. Wrong: three red eyes in a row.',
  animations: {
    idle: { ticksPerFrame: 10, loop: true, frames: [frame(LEGS[0] ?? []), frame(LEGS[1] ?? [])] },
    walk: { ticksPerFrame: 4, loop: true, frames: LEGS.map(frame) },
    windup: { ticksPerFrame: 5, loop: true, frames: [rear(LEGS[0] ?? []), rear(LEGS[1] ?? [])] },
  },
};

export default sprite;
