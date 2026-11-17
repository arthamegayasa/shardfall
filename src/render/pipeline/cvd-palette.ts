// Colour vision palettes for the game world (BUG-016, accessibility A-04, art-direction 8.3). LP.
// The Settings option Color Vision used to swap only UI tokens. The world now swaps too: the renderer
// rasterizes the sprite atlas from a per-mode palette (enemy eyes, enemy shot rings, Warden eyes) and
// builds telegraph, spawn, aura, and windup outline colours from it. Only danger tokens move; player
// tokens never change, so the player's look is the same in every mode (faction rule, style-guide 1.3:
// danger stays in the red, magenta, violet family, never blue, cyan, or gold).
//
// Values were picked with the Machado 2009 simulation (severity 1.0, linear RGB; same matrices as QA's
// tests/e2e/support/m5_cvd.py) to raise the smallest CIEDE2000 distance between each danger token and
// every player token (kept-blue, kept-blue-deep, kept-cyan, kept-white, kept-gold, glint) in that
// mode's simulation, while keeping or raising contrast against the floor. [Asumsi] Hex values are LP's
// proposal; AD owns the final palette and may move them into art/palette.json.
//
// Hue alone cannot carry the code for protan and deutan viewers: their red, magenta, and violet all
// fall on the same axis as the player's gold and blue. So every colour vision mode also turns on the
// hazard pattern for danger ground areas (shaders/area.ts): a 2 px edge striped pale core and danger
// colour, and diagonal stripes in the fill. Player zones stay solid, so the stripes alone say "danger".

import type { ColorVisionMode, HexColor, PaletteDef } from '../../core/index.ts';

/** Danger tokens a colour vision mode may replace. Player and neutral tokens are never touched. */
export const CVD_DANGER_TOKENS = ['danger-red', 'danger-magenta', 'danger-violet'] as const;
export type CvdDangerToken = (typeof CVD_DANGER_TOKENS)[number];

/**
 * Per mode overrides of the core palette. Simulated in the matching mode (QA method), against the base
 * palette's weakest pair:
 * - protan: danger-violet vs kept-blue 5.0 -> 15.5, danger-magenta vs kept-cyan 21.3 and kept-blue 25.8 (#F47C94, BUG-017),
 *   danger-red contrast on floor-mid 1.52 -> 2.36 (red stays salmon red, about 27 from every player token).
 * - deutan: danger-red vs kept-gold 18.2 -> 28.0 (the olive telegraph of BUG-016), telegraph fill vs a
 *   Rite zone 7.1 -> 15.0, danger-violet vs kept-blue 2.6 -> 18.0, danger-magenta 21.4 -> 26.2.
 * - tritan: the base palette is already at the best distance from kept-gold (about 27); danger-violet
 *   moves to magenta (art-direction 8.3) so it leaves kept-blue further behind (43 -> 61).
 */
export const CVD_OVERRIDES: Readonly<
  Record<ColorVisionMode, Readonly<Partial<Record<CvdDangerToken, HexColor>>>>
> = {
  off: {},
  protan: { 'danger-red': '#FF7381', 'danger-magenta': '#F47C94', 'danger-violet': '#E68CC4' },
  deutan: { 'danger-red': '#E65087', 'danger-magenta': '#F2368C', 'danger-violet': '#CC70A0' },
  tritan: { 'danger-violet': '#E600D6' },
};

/** Palette for a colour vision mode: the base palette with that mode's danger overrides. */
export function cvdPalette(base: PaletteDef, mode: ColorVisionMode): PaletteDef {
  const over = CVD_OVERRIDES[mode];
  if (Object.keys(over).length === 0) return base;
  return { ...base, core: { ...base.core, ...over } };
}

/** True when danger ground areas draw the hazard pattern (striped edge and fill): every CVD mode. */
export function hazardPatternFor(mode: ColorVisionMode): boolean {
  return mode !== 'off';
}
