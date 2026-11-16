// Danger layer legibility rules (CD M1 review K3, style-guide 1.8). LP. Pure, mirrored in GLSL.
// 1. Stacked telegraph fills read as one fill: combined fill opacity is capped at 35%. The danger
//    target holds premultiplied colour; pixels below full alpha are fill-only and get scaled down.
//    Edges, cracks, and enemy shots are opaque (alpha 1) and never touched.
// 2. When a telegraph fill or an enemy shot covers the player, a see-through player silhouette
//    (1 px outline plus foot ring) is drawn above the danger layer. playerCoveredByDanger decides it.

import { AreaShape, DEPTH_PX_PER_U, PX_PER_U } from '../../core/index.ts';
import type { WorldView } from '../../core/index.ts';

/** Max combined opacity of overlapping telegraph fills (style-guide 1.8). */
export const STACKED_FILL_MAX_ALPHA = 0.35;
/** Alpha at or above this is treated as opaque (edges, sprites), not as a stacked fill. */
export const OPAQUE_ALPHA = 0.999;

/** Cap a premultiplied danger pixel. Returns the scale applied to rgb and alpha. */
export function stackedFillScale(alpha: number): number {
  if (alpha >= OPAQUE_ALPHA || alpha <= STACKED_FILL_MAX_ALPHA) return 1;
  return STACKED_FILL_MAX_ALPHA / alpha;
}

/** Player sprite box above the feet, in world u: half width and height on screen (20 px tall). */
const PLAYER_HALF_W_U = 8 / PX_PER_U;
const PLAYER_SCREEN_H_PX = 22;
/** Enemy shot sprites are 7 px: half size in u across and in floor depth. */
const SHOT_HALF_X_U = 4 / PX_PER_U;
const SHOT_HALF_Y_U = 4 / DEPTH_PX_PER_U;

/**
 * True when any live danger fill, spawn mark, or enemy shot overlaps the player's sprite on screen.
 * The sprite stands up from the feet, so it covers floor depth [y - 22 px / 10, y]. Bounding boxes
 * are conservative: a false positive only draws a harmless outline.
 */
export function playerCoveredByDanger(view: WorldView, px: number, py: number): boolean {
  const x0 = px - PLAYER_HALF_W_U;
  const x1 = px + PLAYER_HALF_W_U;
  const y0 = py - PLAYER_SCREEN_H_PX / DEPTH_PX_PER_U;
  const y1 = py;
  const overlaps = (ax0: number, ay0: number, ax1: number, ay1: number): boolean =>
    ax0 <= x1 && ax1 >= x0 && ay0 <= y1 && ay1 >= y0;

  const da = view.dangerAreas;
  for (let i = 0; i < da.highWater; i++) {
    if (da.alive[i] === 0) continue;
    const x = da.x[i] ?? 0;
    const y = da.y[i] ?? 0;
    if ((da.shape[i] ?? 0) === AreaShape.Line) {
      const hw = da.p0[i] ?? 0;
      const xb = da.x2[i] ?? 0;
      const yb = da.y2[i] ?? 0;
      if (
        overlaps(
          Math.min(x, xb) - hw,
          Math.min(y, yb) - hw,
          Math.max(x, xb) + hw,
          Math.max(y, yb) + hw,
        )
      )
        return true;
    } else {
      const r = da.radius[i] ?? 0;
      if (!overlaps(x - r, y - r, x + r, y + r)) continue;
      // Circle and cone: the nearest point of the player box must lie within the radius.
      const nx = Math.min(Math.max(x, x0), x1);
      const ny = Math.min(Math.max(y, y0), y1);
      if ((nx - x) * (nx - x) + (ny - y) * (ny - y) <= r * r) return true;
    }
  }
  const sm = view.spawnMarks;
  for (let i = 0; i < sm.highWater; i++) {
    if (sm.alive[i] === 0) continue;
    const r = sm.radius[i] ?? 0;
    const x = sm.x[i] ?? 0;
    const y = sm.y[i] ?? 0;
    if (overlaps(x - r, y - r, x + r, y + r)) return true;
  }
  const es = view.enemyShots;
  for (let i = 0; i < es.highWater; i++) {
    if (es.alive[i] === 0) continue;
    const x = es.x[i] ?? 0;
    const y = es.y[i] ?? 0;
    if (overlaps(x - SHOT_HALF_X_U, y - SHOT_HALF_Y_U * 2, x + SHOT_HALF_X_U, y)) return true;
  }
  return false;
}
