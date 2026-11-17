// Keyboard scrolling of a focusable list that does not fit its panel (run end build, CD M3 10).
// Pure: the screen passes the element's scroll metrics and applies the result.

export interface ScrollMetrics {
  readonly top: number;
  readonly client: number;
  readonly height: number;
}

/** Sub-pixel slack of scrollHeight and scrollTop (zoom, DPR 1.25 and 1.5). */
const SLACK = 1;

/** True when the content is taller than the box (the list needs a scroll mark). */
export function overflows(m: ScrollMetrics): boolean {
  return m.height > m.client + SLACK;
}

export function moreAbove(m: ScrollMetrics): boolean {
  return overflows(m) && m.top > SLACK;
}

export function moreBelow(m: ScrollMetrics): boolean {
  return overflows(m) && m.top + m.client < m.height - SLACK;
}

/**
 * New scrollTop after one arrow step (dir -1 up, 1 down), clamped to the content, or null when the
 * list is already at that edge: the arrow then moves focus out of the list as usual.
 */
export function scrollStep(m: ScrollMetrics, dir: -1 | 1, step: number): number | null {
  if (dir < 0 ? !moreAbove(m) : !moreBelow(m)) return null;
  const max = Math.max(0, m.height - m.client);
  return Math.min(max, Math.max(0, m.top + dir * step));
}
