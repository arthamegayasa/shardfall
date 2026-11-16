// 2D floor geometry for the arena legibility checker (LD, arena-design.md 11).
// Floor points are [x, y] with +y toward the camera (down the screen), the same as ArenaDef.
// "Clockwise on screen" therefore means a positive cross product in these coordinates.

import type { Shape, Vec2 } from '../../../src/core/index.ts';

const EPS = 1e-9;

/** A shape resolved for distance math: convex polygon (clockwise on screen) or circle. */
export type Region =
  | { readonly kind: 'poly'; readonly pts: readonly Vec2[] }
  | { readonly kind: 'circle'; readonly c: Vec2; readonly r: number };

function at<T>(arr: readonly T[], i: number): T {
  const v = arr[((i % arr.length) + arr.length) % arr.length];
  if (v === undefined) throw new Error('empty point list');
  return v;
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Null when the polygon is convex and clockwise on screen, else the reason. */
export function convexClockwiseError(pts: readonly Vec2[]): string | null {
  if (pts.length < 3) return 'needs at least 3 points';
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = cross(at(pts, i), at(pts, i + 1), at(pts, i + 2));
    if (Math.abs(c) < EPS) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return 'must be convex';
  }
  if (sign === 0) return 'is degenerate (all points on one line)';
  if (sign < 0) return 'must be clockwise on screen (counter-clockwise given)';
  return null;
}

/** Absolute polygon area (shoelace). */
export function polygonArea(pts: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = at(pts, i);
    const b = at(pts, i + 1);
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** Rect corners clockwise on screen: top-left, top-right, bottom-right, bottom-left. */
export function rectPoints(min: Vec2, max: Vec2): Vec2[] {
  return [
    [min[0], min[1]],
    [max[0], min[1]],
    [max[0], max[1]],
    [min[0], max[1]],
  ];
}

/** Decor footprint: rectangle of half sizes [hx, hy] around pos, rotated by rotYDeg. */
export function footprintPoints(pos: Vec2, half: Vec2, rotYDeg: number): Vec2[] {
  const t = (rotYDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const local: Vec2[] = rectPoints([-half[0], -half[1]], [half[0], half[1]]);
  return local.map(([x, y]) => [pos[0] + x * c - y * s, pos[1] + x * s + y * c] as const);
}

export function regionOf(shape: Shape): Region {
  switch (shape.type) {
    case 'rect':
      return { kind: 'poly', pts: rectPoints(shape.min, shape.max) };
    case 'polygon':
      return { kind: 'poly', pts: shape.points };
    case 'circle':
      return { kind: 'circle', c: shape.center, r: shape.radius };
  }
}

export function regionArea(r: Region): number {
  return r.kind === 'poly' ? polygonArea(r.pts) : Math.PI * r.r * r.r;
}

export function pointInConvex(poly: readonly Vec2[], p: Vec2): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (cross(at(poly, i), at(poly, i + 1), p) < -EPS) return false;
  }
  return true;
}

export function distPointSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Distance from p to the polygon outline (inside or outside). */
export function distToEdges(poly: readonly Vec2[], p: Vec2): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++)
    d = Math.min(d, distPointSeg(p, at(poly, i), at(poly, i + 1)));
  return d;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  )
    return true;
  return (
    (Math.abs(d1) <= EPS && distPointSeg(a, c, d) <= EPS) ||
    (Math.abs(d2) <= EPS && distPointSeg(b, c, d) <= EPS) ||
    (Math.abs(d3) <= EPS && distPointSeg(c, a, b) <= EPS) ||
    (Math.abs(d4) <= EPS && distPointSeg(d, a, b) <= EPS)
  );
}

function polyPolyDistance(a: readonly Vec2[], b: readonly Vec2[]): number {
  if (a.some((p) => pointInConvex(b, p)) || b.some((p) => pointInConvex(a, p))) return 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(at(a, i), at(a, i + 1), at(b, j), at(b, j + 1))) return 0;
    }
  }
  let d = Infinity;
  for (const p of a) d = Math.min(d, distToEdges(b, p));
  for (const p of b) d = Math.min(d, distToEdges(a, p));
  return d;
}

/** Edge-to-edge distance between two regions; 0 when they touch or overlap. */
export function regionDistance(a: Region, b: Region): number {
  if (a.kind === 'circle' && b.kind === 'circle')
    return Math.max(0, Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) - a.r - b.r);
  if (a.kind === 'circle' && b.kind === 'poly')
    return Math.max(0, (pointInConvex(b.pts, a.c) ? 0 : distToEdges(b.pts, a.c)) - a.r);
  if (a.kind === 'poly' && b.kind === 'circle') return regionDistance(b, a);
  if (a.kind === 'poly' && b.kind === 'poly') return polyPolyDistance(a.pts, b.pts);
  return 0;
}

/**
 * Clearance of a region inside a convex boundary: smallest distance from the region to the outline.
 * Negative when part of the region is outside. For a convex region, distance to the outline of a
 * convex boundary is concave, so its minimum sits on a vertex.
 */
export function clearanceInside(boundary: readonly Vec2[], r: Region): number {
  if (r.kind === 'circle') {
    const d = distToEdges(boundary, r.c);
    return pointInConvex(boundary, r.c) ? d - r.r : -d - r.r;
  }
  let min = Infinity;
  for (const p of r.pts) {
    const d = distToEdges(boundary, p);
    min = Math.min(min, pointInConvex(boundary, p) ? d : -d);
  }
  return min;
}

/** Grid sample points inside a region (step in u), plus its vertices. */
export function samplePoints(r: Region, step: number): Vec2[] {
  const out: Vec2[] = [];
  const pts: readonly Vec2[] =
    r.kind === 'poly'
      ? r.pts
      : [
          [r.c[0] - r.r, r.c[1] - r.r],
          [r.c[0] + r.r, r.c[1] + r.r],
        ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const inside = (p: Vec2): boolean =>
    r.kind === 'poly'
      ? pointInConvex(r.pts, p)
      : Math.hypot(p[0] - r.c[0], p[1] - r.c[1]) <= r.r + EPS;
  for (let x = Math.min(...xs); x <= Math.max(...xs) + EPS; x += step) {
    for (let y = Math.min(...ys); y <= Math.max(...ys) + EPS; y += step) {
      const p: Vec2 = [x, y];
      if (inside(p)) out.push(p);
    }
  }
  if (r.kind === 'poly') out.push(...r.pts);
  return out;
}

/** Axis-aligned bounds [minX, minY, maxX, maxY]. */
export function regionBounds(r: Region): readonly [number, number, number, number] {
  if (r.kind === 'circle') return [r.c[0] - r.r, r.c[1] - r.r, r.c[0] + r.r, r.c[1] + r.r];
  const xs = r.pts.map((p) => p[0]);
  const ys = r.pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
