// unlit-tank (Porter), final M2 sprite. Wide block, small head, heavy fists. Rows hold the left half
// (mirror true). Wrong trait: no face, the eye sits in the chest. walk 4: heavy sway on alternating legs;
// windup 2: both fists raised over the head, chest eye flaring pale.

import { paste, recolor } from './sprite-types.ts';
import type { Rows, SpriteSheetDef } from './sprite-types.ts';

const TORSO: Rows = [
  '......uuu',
  '.....uuuu',
  '.....uuuu',
  '......uuu',
  '..uuuuuuu',
  '.uuuuuuuu',
  'uuuuuuuuu',
  'uuuuuuuuR',
  'uuuuuuuRp',
  'uuuuuuuuR',
  'uuu.uuuuu',
  'uuu.uuuuu',
  'uuu.uuuuu',
  'uuu.uuuuu',
  'uuuu.uuuu',
  'uuuu.uuuu',
];
const LEGS: Rows = ['....uuuu.', '....uuu..', '....uuu..', '...uuuu..', '...uuuu..', '..uuuuu..'];
const LEGS_STEP: Rows = [
  '....uuuu.',
  '....uuu..',
  '....uuu..',
  '....uuu..',
  '...uuuu..',
  '...uuuu..',
];

const stand = (legs: Rows): string[] => [...TORSO, ...legs];
/** Sway: the head and shoulders lean one row down (heavy step). */
const sway = (legs: Rows): string[] => ['.'.repeat(9), ...TORSO.slice(0, 15), ...legs];

/** Fists up: the hanging arms leave the sides and rise above the shoulders. */
function raised(lit: boolean): string[] {
  const noArms = paste(stand(LEGS), ['    ', '    ', '    ', '    ', '    ', '    '], 0, 10);
  const g = ['.'.repeat(9), ...noArms];
  const fists = paste(g, ['uuu', 'uuu', '.uu', '.uu', '.uu', '..u'], 0, 0);
  const body = paste(fists, ['.uuu', '.uuu', '.uuu', '.uuu', '..uu', '..uu'], 0, 11);
  return lit ? recolor(body, { R: 'p' }) : body;
}

const sprite: SpriteSheetDef = {
  id: 'unlit-tank',
  class: 'unlit-large',
  faction: 'unlit',
  frameW: 32,
  frameH: 32,
  anchor: { x: 16, y: 31 },
  outline: 'ink',
  mirror: true,
  status: 'final',
  note: 'Role tank (Porter). Wide block, small head, heavy fists. Wrong: no face, the eye is in the chest.',
  animations: {
    idle: { ticksPerFrame: 24, loop: true, frames: [stand(LEGS), sway(LEGS)] },
    walk: {
      ticksPerFrame: 10,
      loop: true,
      frames: [stand(LEGS), sway(LEGS_STEP), stand(LEGS), sway(LEGS)],
    },
    windup: { ticksPerFrame: 6, loop: true, frames: [raised(false), raised(true)] },
  },
};

export default sprite;
