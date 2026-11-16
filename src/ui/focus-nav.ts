// Pure spatial focus navigation (ui-spec 8.2). Arrows move inside the focus group first and cross
// to a neighbouring group only at its edge. Tab cycles groups. Tested without DOM.

export const Dir = { Up: 0, Down: 1, Left: 2, Right: 3 } as const;
export type Dir = (typeof Dir)[keyof typeof Dir];

/** Item box in any consistent coordinate space (CSS px from getBoundingClientRect). */
export interface NavRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly group: number;
}

/** Secondary-axis offset weighs more than distance, so moves stay in a row or column. */
const CROSS_AXIS_WEIGHT = 2;
/** Overlap allowed at an edge (sub-pixel layout rounding). */
const EDGE_TOLERANCE = 1;

function bestIn(rects: readonly NavRect[], current: number, dir: Dir, sameGroup: boolean): number {
  const cur = rects[current];
  if (cur === undefined) return -1;
  const cx = cur.x + cur.w * 0.5;
  const cy = cur.y + cur.h * 0.5;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r === undefined || i === current) continue;
    if (sameGroup !== (r.group === cur.group)) continue;
    // A candidate must lie fully past the current item's edge in that direction (no overlap).
    let main: number;
    let cross: number;
    if (dir === Dir.Right) {
      if (r.x < cur.x + cur.w - EDGE_TOLERANCE) continue;
      main = r.x + r.w * 0.5 - cx;
      cross = Math.abs(r.y + r.h * 0.5 - cy);
    } else if (dir === Dir.Left) {
      if (r.x + r.w > cur.x + EDGE_TOLERANCE) continue;
      main = cx - (r.x + r.w * 0.5);
      cross = Math.abs(r.y + r.h * 0.5 - cy);
    } else if (dir === Dir.Down) {
      if (r.y < cur.y + cur.h - EDGE_TOLERANCE) continue;
      main = r.y + r.h * 0.5 - cy;
      cross = Math.abs(r.x + r.w * 0.5 - cx);
    } else {
      if (r.y + r.h > cur.y + EDGE_TOLERANCE) continue;
      main = cy - (r.y + r.h * 0.5);
      cross = Math.abs(r.x + r.w * 0.5 - cx);
    }
    const score = main + cross * CROSS_AXIS_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Index of the item to focus when moving in dir, or -1 when nothing lies that way. */
export function findNeighbor(rects: readonly NavRect[], current: number, dir: Dir): number {
  if (rects.length === 0) return -1;
  if (current < 0 || current >= rects.length) return 0;
  const inGroup = bestIn(rects, current, dir, true);
  return inGroup >= 0 ? inGroup : bestIn(rects, current, dir, false);
}

/** First item of the next (delta 1) or previous (delta -1) group, cycling. -1 when empty. */
export function nextGroupIndex(rects: readonly NavRect[], current: number, delta: 1 | -1): number {
  if (rects.length === 0) return -1;
  const groups = [...new Set(rects.map((r) => r.group))].sort((a, b) => a - b);
  const curGroup = rects[current]?.group ?? groups[0] ?? 0;
  const gi = groups.indexOf(curGroup);
  const target = groups[(gi + delta + groups.length) % groups.length] ?? curGroup;
  return rects.findIndex((r) => r.group === target);
}
