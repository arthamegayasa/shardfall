// Pure sprite compiler and validator (architecture.md 10, art-pipeline 3).
// Ported from tools/art/lib/sprite.mjs (AD) with identical behaviour: mirror, Unlit rim, 4 or 8
// neighbour ink outline, trim, faction palette check, size and highlight checks. The palette is a
// parameter (no JSON import), so render, UI, tools, and tests share this one implementation.

import type { PaletteDef } from '../contracts/palette.ts';
import type { SpriteSheetDef } from '../contracts/sprite.ts';

/** Default character legend. Sprites may override or extend via `legend`. */
export const DEFAULT_LEGEND: Readonly<Record<string, string | null>> = {
  '.': null,
  k: 'ink',
  n: 'night',
  h: 'shadow',
  f: 'floor-mid',
  l: 'floor-lit',
  t: 'stone',
  d: 'dust',
  e: 'bone',
  B: 'kept-blue',
  b: 'kept-blue-deep',
  c: 'kept-cyan',
  w: 'kept-white',
  g: 'kept-gold',
  y: 'glint',
  u: 'unlit-body',
  r: 'unlit-rim',
  R: 'danger-red',
  m: 'danger-magenta',
  v: 'danger-violet',
  p: 'danger-core',
};

/** Height ranges in px, outline included (art-direction 3). */
export const HEIGHT_RANGE: Readonly<Record<string, readonly [number, number]>> = {
  kept: [18, 22],
  'unlit-small': [10, 14],
  'unlit-medium': [14, 18],
  'unlit-large': [20, 26],
  warden: [28, 36],
  boss: [64, 96],
  glint: [3, 5],
  'projectile-danger': [5, 7],
  'projectile-kept': [3, 6],
  portrait: [40, 48],
};

export type Rgb = readonly [number, number, number];

/** One compiled frame: trimmed token raster plus which pixels are auto outline. */
export interface CompiledFrame {
  readonly w: number;
  readonly h: number;
  /** Palette token per pixel, row-major, null = transparent. */
  readonly px: readonly (string | null)[];
  readonly outlineMask: Uint8Array;
}

export interface CompiledAnimation {
  readonly ticksPerFrame: number;
  readonly loop: boolean;
  readonly frames: readonly CompiledFrame[];
}

export interface CompiledSprite {
  readonly src: SpriteSheetDef;
  readonly anims: Readonly<Record<string, CompiledAnimation>>;
  /** Validation issues, de-duplicated, in discovery order. Empty = valid. */
  readonly issues: readonly string[];
  readonly stats: { readonly height: number; readonly highlightRatio: number };
}

function parseHex(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Resolve a token name (core, or biome env such as `b1.wood`) to 8-bit RGB. Throws on unknown tokens. */
export function tokenRgb(palette: PaletteDef, token: string): Rgb {
  const core = palette.core[token];
  if (core !== undefined) return parseHex(core);
  const m = /^(b[123])\.(.+)$/.exec(token);
  if (m !== null) {
    const biome = palette.biomes.find((x) => x.id === m[1]);
    const env = m[2] === undefined ? undefined : biome?.env[m[2]];
    if (env !== undefined) return parseHex(env);
  }
  throw new Error(`Unknown palette token "${token}"`);
}

function allowedFor(
  palette: PaletteDef,
  faction: SpriteSheetDef['faction'],
  token: string,
): boolean {
  const g = palette.groups;
  if (faction === 'kept') return g.neutral.includes(token) || g.kept.includes(token);
  if (faction === 'unlit') return g.unlit.includes(token);
  // neutral and env: environment, props, tiles, UI chrome. No team colours at all.
  return g.neutral.includes(token) || /^b[123]\./.test(token);
}

function expandMirror(row: string, mirror: SpriteSheetDef['mirror']): string {
  if (mirror === undefined || mirror === false) return row;
  // Sprite rows are ASCII legend chars, so code units equal code points (same result as AD's [...row]).
  let rev = '';
  for (let i = row.length - 1; i >= 0; i--) rev += row[i] ?? '';
  return mirror === 'odd' ? row + rev.slice(1) : row + rev;
}

/** Compile one grid into a token raster. Outline grows the raster by 1 px on every side, then trims. */
function compileGrid(
  src: SpriteSheetDef,
  rows: readonly string[],
  legend: Readonly<Record<string, string | null>>,
  issues: string[],
  where: string,
): CompiledFrame {
  const expanded = rows.map((r) => expandMirror(r, src.mirror));
  const gw = Math.max(...expanded.map((r) => r.length));
  if (expanded.some((r) => r.length !== gw)) issues.push(`${where}: rows have unequal length`);
  const outline = src.outline === 'ink';
  const pad = outline ? 1 : 0;
  const w = gw + pad * 2;
  const h = expanded.length + pad * 2;
  const px: (string | null)[] = new Array<string | null>(w * h).fill(null);
  const outlineMask = new Uint8Array(w * h);
  expanded.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] ?? '';
      if (!(ch in legend)) {
        issues.push(`${where}: unknown char "${ch}" at ${x},${y}`);
        continue;
      }
      px[(y + pad) * w + x + pad] = legend[ch] ?? null;
    }
  });
  // Unlit rim: top inner edge of unlit-body pixels (automatic for outlined Unlit).
  if (outline && src.faction === 'unlit') {
    const copy = px.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (copy[i] === 'unlit-body' && (y === 0 || copy[i - w] === null)) px[i] = 'unlit-rim';
      }
  }
  // Auto outline. Default 4-neighbour (keeps thin limbs readable); outlineMode 8 fills diagonals.
  if (outline) {
    const eight = src.outlineMode === 8;
    const copy = px.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (copy[i] !== null) continue;
        let n = false;
        for (let dy = -1; dy <= 1 && !n; dy++)
          for (let dx = -1; dx <= 1 && !n; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (!eight && dx !== 0 && dy !== 0) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && copy[yy * w + xx] !== null) n = true;
          }
        if (n) {
          px[i] = 'ink';
          outlineMask[i] = 1;
        }
      }
  }
  // Trim fully transparent border rows/cols so size checks measure the visible sprite.
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[y * w + x] !== null) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return { w: 0, h: 0, px: [], outlineMask: new Uint8Array(0) };
  const tw = x1 - x0 + 1;
  const th = y1 - y0 + 1;
  const tpx = new Array<string | null>(tw * th);
  const tmask = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      tpx[y * tw + x] = px[(y + y0) * w + x + x0] ?? null;
      tmask[y * tw + x] = outlineMask[(y + y0) * w + x + x0] ?? 0;
    }
  return { w: tw, h: th, px: tpx, outlineMask: tmask };
}

/** Compile and validate a SpriteSheetDef against the palette. */
export function compileSprite(src: SpriteSheetDef, palette: PaletteDef): CompiledSprite {
  const issues: string[] = [];
  const legend: Readonly<Record<string, string | null>> = {
    ...DEFAULT_LEGEND,
    ...(src.legend ?? {}),
  };
  const anims: Record<string, CompiledAnimation> = {};
  let highlight = 0;
  let opaque = 0;
  let maxH = 0;
  for (const [name, anim] of Object.entries(src.animations)) {
    const frames = anim.frames.map((rows, fi) => {
      const where = `${src.id}/${name}/${fi}`;
      const g = compileGrid(src, rows, legend, issues, where);
      if (g.w > src.frameW || g.h > src.frameH)
        issues.push(`${where}: ${g.w}x${g.h} does not fit frame ${src.frameW}x${src.frameH}`);
      maxH = Math.max(maxH, g.h);
      for (const t of g.px) {
        if (t === null) continue;
        try {
          tokenRgb(palette, t);
        } catch (e) {
          issues.push(`${where}: ${(e as Error).message}`);
          continue;
        }
        if (!allowedFor(palette, src.faction, t))
          issues.push(`${where}: token "${t}" not allowed for faction ${src.faction}`);
        opaque++;
        if (palette.groups.keptHighlight.includes(t)) highlight++;
      }
      return g;
    });
    anims[name] = { ticksPerFrame: anim.ticksPerFrame, loop: anim.loop, frames };
  }
  const range = HEIGHT_RANGE[src.class];
  if (range !== undefined && (maxH < range[0] || maxH > range[1]))
    issues.push(
      `${src.id}: height ${maxH}px outside ${range[0]}-${range[1]} for class ${src.class}`,
    );
  const highlightRatio = opaque > 0 ? highlight / opaque : 0;
  if (src.faction === 'kept' && src.class === 'kept' && highlightRatio < 0.15)
    issues.push(
      `${src.id}: highlight ratio ${(highlightRatio * 100).toFixed(1)}% < 15% (style-guide 1.3)`,
    );
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(src.id)) issues.push(`${src.id}: id must be kebab-case`);
  return { src, anims, issues: [...new Set(issues)], stats: { height: maxH, highlightRatio } };
}

/** Rasterise a compiled frame to RGBA8 (row-major). silhouette paints every opaque pixel one colour. */
export function frameToRgba(
  frame: CompiledFrame,
  palette: PaletteDef,
  silhouette?: Rgb,
): Uint8Array {
  const out = new Uint8Array(frame.w * frame.h * 4);
  frame.px.forEach((t, i) => {
    if (t === null) return;
    const c = silhouette ?? tokenRgb(palette, t);
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = 255;
  });
  return out;
}
