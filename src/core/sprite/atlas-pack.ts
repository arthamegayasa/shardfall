// Deterministic shelf packer and atlas manifest (architecture.md 7.6, art-pipeline 5).
// Ported from tools/art/lib/atlas.mjs (AD): same order (tallest first, then id, animation, index),
// same 1 px padding, same manifest. Output is RGBA8 for a three.js DataTexture (nearest, no mipmaps).
// Difference: ids and animation names compare by UTF-16 code unit instead of localeCompare, so the
// layout never depends on the browser locale. For kebab-case ids and lowercase names the order is equal.

import type { PaletteDef } from '../contracts/palette.ts';
import type { SpriteClass, Faction } from '../contracts/sprite.ts';
import { tokenRgb } from './rasterize.ts';
import type { CompiledFrame, CompiledSprite } from './rasterize.ts';

export interface AtlasFrameRect {
  /** Rect in the atlas. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Top-left of the trimmed rect inside the frame box (bottom centre aligned). */
  readonly ox: number;
  readonly oy: number;
}

export interface AtlasSpriteEntry {
  readonly class: SpriteClass;
  readonly faction: Faction;
  readonly frameW: number;
  readonly frameH: number;
  readonly anchor: { readonly x: number; readonly y: number };
  readonly animations: Readonly<
    Record<
      string,
      {
        readonly ticksPerFrame: number;
        readonly loop: boolean;
        readonly frames: readonly AtlasFrameRect[];
      }
    >
  >;
}

export interface AtlasManifest {
  readonly version: 1;
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly filter: 'nearest';
  readonly sprites: Readonly<Record<string, AtlasSpriteEntry>>;
}

export interface PackedAtlas {
  readonly width: number;
  readonly height: number;
  /** RGBA8, row-major, top row first. */
  readonly pixels: Uint8Array;
  readonly manifest: AtlasManifest;
}

export interface PackOptions {
  readonly width?: number;
  readonly padding?: number;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface Item {
  readonly id: string;
  readonly anim: string;
  readonly i: number;
  readonly f: CompiledFrame;
  readonly c: CompiledSprite;
  x: number;
  y: number;
}

export function packAtlas(
  compiled: readonly CompiledSprite[],
  palette: PaletteDef,
  opts: PackOptions = {},
): PackedAtlas {
  const width = opts.width ?? 512;
  const pad = opts.padding ?? 1;
  const items: Item[] = [];
  for (const c of compiled)
    for (const [anim, a] of Object.entries(c.anims))
      a.frames.forEach((f, i) => items.push({ id: c.src.id, anim, i, f, c, x: 0, y: 0 }));
  // Tallest first, then id, anim, index: stable and deterministic.
  items.sort((p, q) => q.f.h - p.f.h || cmp(p.id, q.id) || cmp(p.anim, q.anim) || p.i - q.i);
  let x = pad;
  let y = pad;
  let shelfH = 0;
  for (const it of items) {
    if (x + it.f.w + pad > width) {
      x = pad;
      y += shelfH + pad;
      shelfH = 0;
    }
    it.x = x;
    it.y = y;
    x += it.f.w + pad;
    shelfH = Math.max(shelfH, it.f.h);
  }
  const height = nextPow2(y + shelfH + pad);
  const pixels = new Uint8Array(width * height * 4);
  const frames = new Map<string, Map<string, AtlasFrameRect[]>>();
  for (const it of items) {
    for (let fy = 0; fy < it.f.h; fy++)
      for (let fx = 0; fx < it.f.w; fx++) {
        const t = it.f.px[fy * it.f.w + fx];
        if (t === null || t === undefined) continue;
        const ax = it.x + fx;
        const ay = it.y + fy;
        if (ax < 0 || ay < 0 || ax >= width || ay >= height) continue;
        const [r, g, b] = tokenRgb(palette, t);
        const o = (ay * width + ax) * 4;
        pixels[o] = r;
        pixels[o + 1] = g;
        pixels[o + 2] = b;
        pixels[o + 3] = 255;
      }
    const ox = Math.floor((it.c.src.frameW - it.f.w) / 2);
    const oy = it.c.src.frameH - it.f.h;
    let byAnim = frames.get(it.id);
    if (byAnim === undefined) frames.set(it.id, (byAnim = new Map<string, AtlasFrameRect[]>()));
    let list = byAnim.get(it.anim);
    if (list === undefined) byAnim.set(it.anim, (list = []));
    list[it.i] = { x: it.x, y: it.y, w: it.f.w, h: it.f.h, ox, oy };
  }
  const sprites: Record<string, AtlasSpriteEntry> = {};
  for (const c of compiled) {
    const animations: Record<
      string,
      { ticksPerFrame: number; loop: boolean; frames: AtlasFrameRect[] }
    > = {};
    for (const [k, a] of Object.entries(c.anims)) {
      animations[k] = {
        ticksPerFrame: a.ticksPerFrame,
        loop: a.loop,
        frames: frames.get(c.src.id)?.get(k) ?? [],
      };
    }
    sprites[c.src.id] = {
      class: c.src.class,
      faction: c.src.faction,
      frameW: c.src.frameW,
      frameH: c.src.frameH,
      anchor: c.src.anchor,
      animations,
    };
  }
  const manifest: AtlasManifest = {
    version: 1,
    image: 'atlas.png',
    width,
    height,
    padding: pad,
    filter: 'nearest',
    sprites,
  };
  return { width, height, pixels, manifest };
}
