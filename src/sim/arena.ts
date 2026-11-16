// Arena geometry for the sim: convex boundary tests and clamps, shapes, spawn sectors
// (architecture.md 6.10, 8.3; arena-design 4.2, 5.2). Built once per arena, allocation-free queries.

import type { ArenaDef, Rng, Shape } from '../core/index.ts';
import { SHAPE_SAMPLE_ATTEMPTS, SPAWN_BAND_INNER_U, SPAWN_BAND_OUTER_U } from './capacity.ts';

export interface Point {
  x: number;
  y: number;
}

export interface ArenaGeom {
  readonly def: ArenaDef;
  readonly n: number;
  readonly ax: Float64Array;
  readonly ay: Float64Array;
  /** Inward unit normal of edge i (from vertex i to i+1). */
  readonly nx: Float64Array;
  readonly ny: Float64Array;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly cx: number;
  readonly cy: number;
  readonly projectileMargin: number;
  /** Spawn zone shape per sector id (n, s, e, w, ne, se, sw, nw); synthesized when the JSON has none. */
  readonly sectors: Readonly<Record<string, Shape>>;
}

export const SECTOR_IDS = ['n', 's', 'e', 'w', 'ne', 'se', 'sw', 'nw'] as const;

function fallbackSectors(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): Record<string, Shape> {
  const i0 = SPAWN_BAND_INNER_U;
  const i1 = SPAWN_BAND_OUTER_U;
  const w = maxX - minX;
  const h = maxY - minY;
  const qx = w * 0.25;
  const qy = h * 0.25;
  const rect = (x0: number, y0: number, x1: number, y1: number): Shape => ({
    type: 'rect',
    min: [Math.min(x0, x1), Math.min(y0, y1)],
    max: [Math.max(x0, x1), Math.max(y0, y1)],
  });
  return {
    n: rect(minX + qx, minY + i0, maxX - qx, minY + i1),
    s: rect(minX + qx, maxY - i1, maxX - qx, maxY - i0),
    e: rect(maxX - i1, minY + qy, maxX - i0, maxY - qy),
    w: rect(minX + i0, minY + qy, minX + i1, maxY - qy),
    ne: rect(maxX - qx, minY + i1, maxX - i1, minY + qy),
    se: rect(maxX - qx, maxY - qy, maxX - i1, maxY - i1),
    sw: rect(minX + i1, maxY - qy, minX + qx, maxY - i1),
    nw: rect(minX + i1, minY + i1, minX + qx, minY + qy),
  };
}

export function createArenaGeom(def: ArenaDef): ArenaGeom {
  const pts = def.arena.boundary;
  const n = pts.length;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const x = p?.[0] ?? 0;
    const y = p?.[1] ?? 0;
    ax[i] = x;
    ay[i] = y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    cx += x;
    cy += y;
  }
  if (n > 0) {
    cx /= n;
    cy /= n;
  }
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = (ax[j] ?? 0) - (ax[i] ?? 0);
    const ey = (ay[j] ?? 0) - (ay[i] ?? 0);
    const len = Math.sqrt(ex * ex + ey * ey);
    let vx = len > 0 ? -ey / len : 0;
    let vy = len > 0 ? ex / len : 0;
    // Point the normal toward the centroid (convex polygon, any winding).
    if ((cx - (ax[i] ?? 0)) * vx + (cy - (ay[i] ?? 0)) * vy < 0) {
      vx = -vx;
      vy = -vy;
    }
    nx[i] = vx;
    ny[i] = vy;
  }
  const sectors: Record<string, Shape> = fallbackSectors(minX, maxX, minY, maxY);
  for (const z of def.spawn.zones) sectors[z.id] = z.shape;
  return {
    def,
    n,
    ax,
    ay,
    nx,
    ny,
    minX,
    maxX,
    minY,
    maxY,
    cx,
    cy,
    projectileMargin: def.arena.projectileMargin,
    sectors,
  };
}

/** Smallest signed distance from (x, y) to the boundary edges (positive inside). */
export function insideDistance(g: ArenaGeom, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < g.n; i++) {
    const d = (x - (g.ax[i] ?? 0)) * (g.nx[i] ?? 0) + (y - (g.ay[i] ?? 0)) * (g.ny[i] ?? 0);
    if (d < best) best = d;
  }
  return best;
}

/** Push (x, y) inside the boundary by at least inset. Two passes settle convex corners. */
export function clampInside(g: ArenaGeom, x: number, y: number, inset: number, out: Point): void {
  let px = x;
  let py = y;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < g.n; i++) {
      const nxi = g.nx[i] ?? 0;
      const nyi = g.ny[i] ?? 0;
      const d = (px - (g.ax[i] ?? 0)) * nxi + (py - (g.ay[i] ?? 0)) * nyi;
      if (d < inset) {
        px += (inset - d) * nxi;
        py += (inset - d) * nyi;
      }
    }
  }
  out.x = px;
  out.y = py;
}

export function pointInShape(s: Shape, x: number, y: number): boolean {
  switch (s.type) {
    case 'rect':
      return x >= s.min[0] && x <= s.max[0] && y >= s.min[1] && y <= s.max[1];
    case 'circle': {
      const dx = x - s.center[0];
      const dy = y - s.center[1];
      return dx * dx + dy * dy <= s.radius * s.radius;
    }
    case 'polygon': {
      // Convex polygon: same side of every edge.
      let sign = 0;
      const pts = s.points;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (a === undefined || b === undefined) continue;
        const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        if (cr !== 0) {
          const sg = cr > 0 ? 1 : -1;
          if (sign === 0) sign = sg;
          else if (sg !== sign) return false;
        }
      }
      return true;
    }
  }
}

function shapeBounds(s: Shape, out: { x0: number; y0: number; x1: number; y1: number }): void {
  switch (s.type) {
    case 'rect':
      out.x0 = s.min[0];
      out.y0 = s.min[1];
      out.x1 = s.max[0];
      out.y1 = s.max[1];
      return;
    case 'circle':
      out.x0 = s.center[0] - s.radius;
      out.y0 = s.center[1] - s.radius;
      out.x1 = s.center[0] + s.radius;
      out.y1 = s.center[1] + s.radius;
      return;
    case 'polygon': {
      out.x0 = Infinity;
      out.y0 = Infinity;
      out.x1 = -Infinity;
      out.y1 = -Infinity;
      for (const p of s.points) {
        out.x0 = Math.min(out.x0, p[0]);
        out.y0 = Math.min(out.y0, p[1]);
        out.x1 = Math.max(out.x1, p[0]);
        out.y1 = Math.max(out.y1, p[1]);
      }
    }
  }
}

const bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };

/** Uniform random point inside a shape (rejection sampling in its bounds, fixed attempt count). */
export function randomPointInShape(s: Shape, rng: Rng, out: Point): void {
  shapeBounds(s, bounds);
  for (let i = 0; i < SHAPE_SAMPLE_ATTEMPTS; i++) {
    const x = rng.range(bounds.x0, bounds.x1);
    const y = rng.range(bounds.y0, bounds.y1);
    if (pointInShape(s, x, y)) {
      out.x = x;
      out.y = y;
      return;
    }
  }
  out.x = (bounds.x0 + bounds.x1) * 0.5;
  out.y = (bounds.y0 + bounds.y1) * 0.5;
}

/** Centre of a shape's bounds (boss stage centre, sector centre). */
export function shapeCenter(s: Shape, out: Point): void {
  if (s.type === 'circle') {
    out.x = s.center[0];
    out.y = s.center[1];
    return;
  }
  shapeBounds(s, bounds);
  out.x = (bounds.x0 + bounds.x1) * 0.5;
  out.y = (bounds.y0 + bounds.y1) * 0.5;
}

export function shapeRadius(s: Shape): number {
  if (s.type === 'circle') return s.radius;
  shapeBounds(s, bounds);
  return Math.min(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0) * 0.5;
}
