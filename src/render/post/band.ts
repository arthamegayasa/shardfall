// Tilt-shift DoF band math (architecture.md 7.3, art-direction 7). LP. Pure, mirrored in GLSL.
// The band is defined in reference frame rows (640 x 360 frame), never in screen percent:
// rows 54..324 are always sharp (whole arena plus lip), blur rises with smoothstep to the edges.

import { DOF_SHARP_BOTTOM_PX, DOF_SHARP_TOP_PX, REF_FRAME_H } from '../../core/index.ts';

/** Max blur radius at the screen edge, in virtual px (art-direction 7: 2 px virtual = 6 px at 1080p). */
export const DOF_MAX_RADIUS_PX = 2;
/** Top band height (rows 0..53) and bottom band height (rows 325..360). */
export const DOF_TOP_BAND_PX = DOF_SHARP_TOP_PX;
export const DOF_BOTTOM_BAND_PX = REF_FRAME_H - DOF_SHARP_BOTTOM_PX;

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Blur weight 0..1 for a reference frame row (integer row index, 0 = top of the 640 x 360 frame).
 * Exactly 0 for every row in [54, 324]: the sharp area is read with texelFetch and never mixed.
 * Rows outside the reference frame (tall or ultrawide virtual frames) clamp to full blur.
 */
export function tiltShiftWeight(refRow: number): number {
  if (refRow < DOF_SHARP_TOP_PX) return smooth01((DOF_SHARP_TOP_PX - refRow) / DOF_TOP_BAND_PX);
  if (refRow > DOF_SHARP_BOTTOM_PX)
    return smooth01((refRow - DOF_SHARP_BOTTOM_PX) / DOF_BOTTOM_BAND_PX);
  return 0;
}

/** Blur radius in virtual px for a reference frame row. */
export function tiltShiftRadius(refRow: number): number {
  return tiltShiftWeight(refRow) * DOF_MAX_RADIUS_PX;
}

/**
 * Reference frame row of a render target row. Render targets have row 0 at the bottom (GL), the
 * reference frame has row 0 at the top and starts at originY inside the virtual frame.
 */
export function refRowOfTargetRow(
  targetRow: number,
  virtualHeight: number,
  originY: number,
): number {
  return virtualHeight - 1 - targetRow - originY;
}
