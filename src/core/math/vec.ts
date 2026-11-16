// Small allocation-free vector helpers for the sim (architecture.md 4.2: only Math.sqrt for roots).

export interface MutableVec2 {
  x: number;
  y: number;
}

export function length2(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Normalise (x, y) into out. Zero vectors give (0, 0). */
export function normalizeInto(x: number, y: number, out: MutableVec2): void {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) {
    out.x = 0;
    out.y = 0;
    return;
  }
  out.x = x / len;
  out.y = y / len;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
