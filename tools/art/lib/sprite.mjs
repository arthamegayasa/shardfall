// Sprite compiler and validator. Format spec: docs/art-pipeline.md section 3.
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import PALETTE from '../../../art/palette.json' with { type: 'json' };
import { hex } from './image.mjs';

export { PALETTE };
export const CORE = PALETTE.core;
export const BIOMES = PALETTE.biomes;
const { neutral: NEUTRAL_TOKENS, kept: KEPT_TOKENS, keptHighlight: KEPT_HIGHLIGHT_TOKENS, unlit: UNLIT_TOKENS } = PALETTE.groups;

export const ROOT = resolve(import.meta.dirname, '../../..');

/** Default character legend. Sprites may override or extend via `palette`. */
export const DEFAULT_LEGEND = {
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

/** Height ranges in px, outline included (docs/art-direction.md section 3). */
export const HEIGHT_RANGE = {
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

/** Resolve a token name (core or `b1.wood`) to an rgb triple. */
export function tokenColor(token) {
  if (token in CORE) return hex(CORE[token]);
  const m = /^(b[123])\.(.+)$/.exec(token);
  if (m) {
    const b = BIOMES.find((x) => x.id === m[1]);
    if (b && b.env[m[2]]) return hex(b.env[m[2]]);
  }
  throw new Error(`Unknown palette token "${token}"`);
}

function allowedFor(faction, token) {
  if (faction === 'kept') return NEUTRAL_TOKENS.includes(token) || KEPT_TOKENS.includes(token);
  if (faction === 'unlit') return UNLIT_TOKENS.includes(token);
  // neutral and env: environment, props, tiles, UI chrome. No team colours at all.
  return NEUTRAL_TOKENS.includes(token) || /^b[123]\./.test(token);
}

function expandMirror(row, mirror) {
  if (!mirror) return row;
  const rev = [...row].reverse().join('');
  return mirror === 'odd' ? row + rev.slice(1) : row + rev;
}

/**
 * Compile one grid into a token raster. Returns { w, h, px: (token|null)[] , outlineMask }.
 * Outline grows the raster by 1 px on every side.
 */
function compileGrid(src, rows, legend, issues, where) {
  const expanded = rows.map((r) => expandMirror(r, src.mirror));
  const gw = Math.max(...expanded.map((r) => r.length));
  if (expanded.some((r) => r.length !== gw)) issues.push(`${where}: rows have unequal length`);
  const outline = src.outline === 'ink';
  const pad = outline ? 1 : 0;
  const w = gw + pad * 2;
  const h = expanded.length + pad * 2;
  const px = new Array(w * h).fill(null);
  const outlineMask = new Uint8Array(w * h);
  expanded.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!(ch in legend)) {
        issues.push(`${where}: unknown char "${ch}" at ${x},${y}`);
        return;
      }
      px[(y + pad) * w + x + pad] = legend[ch];
    });
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
  // Auto outline. Default 4-neighbour (keeps thin limbs readable in silhouette); `outlineMode: 8` fills diagonals.
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
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[y * w + x] !== null) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  if (x1 < 0) return { w: 0, h: 0, px: [], outlineMask: new Uint8Array(0) };
  const tw = x1 - x0 + 1;
  const th = y1 - y0 + 1;
  const tpx = new Array(tw * th);
  const tmask = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      tpx[y * tw + x] = px[(y + y0) * w + x + x0];
      tmask[y * tw + x] = outlineMask[(y + y0) * w + x + x0];
    }
  return { w: tw, h: th, px: tpx, outlineMask: tmask };
}

/** Compile a SpriteSheetDef. Returns { src, anims: { name: { fps, loop, frames } }, issues, stats }. */
export function compileSprite(src) {
  const issues = [];
  const legend = { ...DEFAULT_LEGEND, ...(src.legend ?? {}) };
  const anims = {};
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
        try { tokenColor(t); } catch (e) { issues.push(`${where}: ${e.message}`); continue; }
        if (!allowedFor(src.faction, t)) issues.push(`${where}: token "${t}" not allowed for faction ${src.faction}`);
        opaque++;
        if (KEPT_HIGHLIGHT_TOKENS.includes(t)) highlight++;
      }
      return g;
    });
    anims[name] = { ticksPerFrame: anim.ticksPerFrame, loop: anim.loop, frames };
  }
  const range = HEIGHT_RANGE[src.class];
  if (range && (maxH < range[0] || maxH > range[1]))
    issues.push(`${src.id}: height ${maxH}px outside ${range[0]}-${range[1]} for class ${src.class}`);
  const highlightRatio = opaque ? highlight / opaque : 0;
  if (src.faction === 'kept' && src.class === 'kept' && highlightRatio < 0.15)
    issues.push(`${src.id}: highlight ratio ${(highlightRatio * 100).toFixed(1)}% < 15% (style-guide 1.3)`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(src.id)) issues.push(`${src.id}: id must be kebab-case`);
  return { src, anims, issues: [...new Set(issues)], stats: { height: maxH, highlightRatio } };
}

/** Rasterise a compiled frame to a float RGBA image, optionally as a flat silhouette colour. */
export function frameToImage(frame, { silhouette = null } = {}) {
  const data = new Float32Array(frame.w * frame.h * 4);
  frame.px.forEach((t, i) => {
    if (t === null) return;
    const c = silhouette ?? tokenColor(t);
    data.set([...c, 1], i * 4);
  });
  return { w: frame.w, h: frame.h, data };
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json') || (e.name.endsWith('.ts') && !e.name.endsWith('-types.ts'))) out.push(p);
  }
  return out;
}

/** Load every sprite source: art/sprites and art/tiles, JSON (hand-authored) or TS (procedural generator). */
export async function loadAllSprites() {
  const files = [...walk(join(ROOT, 'art', 'sprites')), ...walk(join(ROOT, 'art', 'tiles'))].sort();
  const out = [];
  for (const f of files) {
    const url = pathToFileURL(f).href;
    const mod = f.endsWith('.json') ? await import(url, { with: { type: 'json' } }) : await import(url);
    out.push({ file: f, src: mod.default });
  }
  return out;
}
