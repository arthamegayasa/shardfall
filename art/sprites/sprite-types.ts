// Sprite source format (Art Director). Spec: docs/art-pipeline.md section 3.
// Re-export only: the canonical SpriteSheetDef lives in src/core/contracts/sprite.ts (LP, architecture.md 10),
// so generators keep importing from here and never drift from the runtime type.
// M2: also holds the pure grid helpers shared by generators (ESLint lets generators import only this file
// and src/core/math). The loaders skip *-types.ts, so this module is never mistaken for a sprite.

export type {
  Faction,
  SpriteAnimation,
  SpriteClass,
  SpriteSheetDef,
} from '../../src/core/contracts/sprite.ts';

/** A frame as rows of legend characters (art-pipeline 3.2). */
export type Rows = readonly string[];

/** Blank grid of w x h transparent pixels. */
export function blank(w: number, h: number): string[] {
  return new Array<string>(h).fill('.'.repeat(w));
}

/** Pad rows to w columns and h rows: extra columns centred (left gets the floor), extra rows on top. */
export function fit(rows: Rows, w: number, h: number): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const left = Math.floor((w - r.length) / 2);
    out.push('.'.repeat(Math.max(0, left)) + r + '.'.repeat(Math.max(0, w - r.length - left)));
  }
  while (out.length < h) out.unshift('.'.repeat(w));
  return out;
}

/** Copy of rows moved by (dx, dy) inside the same box; pixels pushed out are lost. */
export function shift(rows: Rows, dx: number, dy: number): string[] {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const out = blank(w, h).map((r) => r.split(''));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = rows[y]?.[x] ?? '.';
      if (c === '.') continue;
      const nx = x + dx;
      const ny = y + dy;
      const row = out[ny];
      if (row !== undefined && nx >= 0 && nx < w) row[nx] = c;
    }
  return out.map((r) => r.join(''));
}

/**
 * Paste a patch at (x, y). '.' in the patch keeps the base pixel; ' ' (space) clears it.
 * Lets one base drawing make every frame with small overlays (legs, arms, eyes).
 */
export function paste(rows: Rows, patch: Rows, x: number, y: number): string[] {
  const out = rows.map((r) => r.split(''));
  patch.forEach((pr, py) => {
    const row = out[y + py];
    if (row === undefined) return;
    for (let px = 0; px < pr.length; px++) {
      const c = pr[px] ?? '.';
      const tx = x + px;
      if (c === '.' || tx < 0 || tx >= row.length) continue;
      row[tx] = c === ' ' ? '.' : c;
    }
  });
  return out.map((r) => r.join(''));
}

/** Replace characters by a map (recolour a frame, e.g. eyes lit during a windup). */
export function recolor(rows: Rows, map: Readonly<Record<string, string>>): string[] {
  return rows.map((r) =>
    r
      .split('')
      .map((c) => map[c] ?? c)
      .join(''),
  );
}

/** Horizontal mirror of a full frame (rows read right to left). */
export function flipX(rows: Rows): string[] {
  return rows.map((r) => r.split('').reverse().join(''));
}

/** Rows from (y0) to (y1, exclusive) replaced by `lower` stacked at y0 (used to swap a leg block). */
export function replaceRows(rows: Rows, y0: number, lower: Rows): string[] {
  const out = [...rows];
  lower.forEach((r, i) => {
    if (y0 + i < out.length) out[y0 + i] = r;
  });
  return out;
}

/** Fill pixels where `inside(x, y)` holds with c (generator primitive for discs and blobs). */
export function fillWhere(
  rows: Rows,
  c: string,
  inside: (x: number, y: number) => boolean,
): string[] {
  return rows.map((r, y) =>
    r
      .split('')
      .map((old, x) => (inside(x, y) ? c : old))
      .join(''),
  );
}
