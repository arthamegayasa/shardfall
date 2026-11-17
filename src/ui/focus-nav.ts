// Pure spatial focus navigation (ui-spec 8.2). Arrows move inside the focus group first and cross
// to a neighbouring group only at its edge. Tab cycles groups. Tested without DOM.
//
// Visual order (QA A-07, BUG-010): a candidate in line with the focus (its box overlaps the focus
// on the cross axis, the "beam") always wins over one off to the side, and reversing a move that
// left a group returns to the control it came from.

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

/** The last move that left a focus group: reversing it from `to` goes back to `from`. */
export interface NavMemory {
  readonly from: number;
  readonly to: number;
  readonly dir: Dir;
}

/** Secondary-axis offset weighs more than distance, so moves stay in a row or column. */
const CROSS_AXIS_WEIGHT = 2;
/** Overlap allowed at an edge (sub-pixel layout rounding). */
const EDGE_TOLERANCE = 1;

export function opposite(dir: Dir): Dir {
  if (dir === Dir.Up) return Dir.Down;
  if (dir === Dir.Down) return Dir.Up;
  return dir === Dir.Left ? Dir.Right : Dir.Left;
}

/** A hidden control (display none, hidden attribute) has an empty box and is never a target. */
function hasBox(r: NavRect): boolean {
  return r.w > 0 && r.h > 0;
}

/** True when r lies fully past cur's edge in dir (no overlap on the main axis). */
function isPast(cur: NavRect, r: NavRect, dir: Dir): boolean {
  if (dir === Dir.Right) return r.x >= cur.x + cur.w - EDGE_TOLERANCE;
  if (dir === Dir.Left) return r.x + r.w <= cur.x + EDGE_TOLERANCE;
  if (dir === Dir.Down) return r.y >= cur.y + cur.h - EDGE_TOLERANCE;
  return r.y + r.h <= cur.y + EDGE_TOLERANCE;
}

/** True when r overlaps cur on the cross axis of dir (r is in line with the focus). */
function inBeam(cur: NavRect, r: NavRect, dir: Dir): boolean {
  if (dir === Dir.Left || dir === Dir.Right)
    return r.y < cur.y + cur.h - EDGE_TOLERANCE && r.y + r.h > cur.y + EDGE_TOLERANCE;
  return r.x < cur.x + cur.w - EDGE_TOLERANCE && r.x + r.w > cur.x + EDGE_TOLERANCE;
}

function bestIn(rects: readonly NavRect[], current: number, dir: Dir, sameGroup: boolean): number {
  const cur = rects[current];
  if (cur === undefined) return -1;
  const cx = cur.x + cur.w * 0.5;
  const cy = cur.y + cur.h * 0.5;
  const horizontal = dir === Dir.Left || dir === Dir.Right;
  let best = -1;
  let bestBeam = false;
  let bestScore = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r === undefined || i === current || !hasBox(r)) continue;
    if (sameGroup !== (r.group === cur.group)) continue;
    if (!isPast(cur, r, dir)) continue;
    const rx = r.x + r.w * 0.5;
    const ry = r.y + r.h * 0.5;
    const main = horizontal ? Math.abs(rx - cx) : Math.abs(ry - cy);
    const cross = horizontal ? Math.abs(ry - cy) : Math.abs(rx - cx);
    const score = main + cross * CROSS_AXIS_WEIGHT;
    const beam = inBeam(cur, r, dir);
    if ((beam && !bestBeam) || (beam === bestBeam && score < bestScore)) {
      best = i;
      bestBeam = beam;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Index of the item to focus when moving in dir, or -1 when nothing lies that way. memory: the
 * last move that left a group; reversing it from where it landed goes back to its origin.
 */
export function findNeighbor(
  rects: readonly NavRect[],
  current: number,
  dir: Dir,
  memory: NavMemory | null = null,
): number {
  if (rects.length === 0) return -1;
  if (current < 0 || current >= rects.length) return 0;
  const inGroup = bestIn(rects, current, dir, true);
  if (inGroup >= 0) return inGroup;
  const cur = rects[current];
  const back = memory === null ? undefined : rects[memory.from];
  if (
    memory !== null &&
    cur !== undefined &&
    back !== undefined &&
    memory.to === current &&
    dir === opposite(memory.dir) &&
    back.group !== cur.group &&
    hasBox(back) &&
    isPast(cur, back, dir)
  ) {
    return memory.from;
  }
  return bestIn(rects, current, dir, false);
}

/** First item of the next (delta 1) or previous (delta -1) group, cycling. -1 when empty. */
export function nextGroupIndex(rects: readonly NavRect[], current: number, delta: 1 | -1): number {
  if (rects.length === 0) return -1;
  const visible = rects.filter(hasBox);
  const groups = [...new Set(visible.map((r) => r.group))].sort((a, b) => a - b);
  const curGroup = rects[current]?.group ?? groups[0] ?? 0;
  const gi = groups.indexOf(curGroup);
  const target = groups[(gi + delta + groups.length) % groups.length] ?? curGroup;
  return rects.findIndex((r) => r.group === target && hasBox(r));
}
