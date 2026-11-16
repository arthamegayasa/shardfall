// UI icon atlas (AD, M2-03): icons and portraits are sprites of class `icon` or `portrait`
// (art/sprites/icon-*.json). Pure: packs them with the runtime packer into one RGBA atlas plus a JSON
// manifest, and cuts ImageData-compatible pixels per icon. The DOM wrapper (canvas, data URL) is
// src/ui's job or src/render/sprites/icons.ts; this file has no DOM so UI, render, and tools share it.

import type { PaletteDef } from '../contracts/palette.ts';
import type { SpriteSheetDef } from '../contracts/sprite.ts';
import { packAtlas } from './atlas-pack.ts';
import { compileSprite } from './rasterize.ts';

/** Icon kinds and their id prefix: icon-<kind>-<data id in kebab-case>. */
export type IconKind = 'weapon' | 'memento' | 'rite' | 'stat' | 'tag' | 'portrait';

/** Sprite id for a data row: iconSpriteId('weapon', 'lantern_bolt') = 'icon-weapon-lantern-bolt'. */
export function iconSpriteId(kind: IconKind, dataId: string): string {
  return `icon-${kind}-${dataId.replaceAll('_', '-')}`;
}

/** True for UI art (class icon or portrait). The game atlas skips these. */
export function isUiArt(src: { readonly class: string }): boolean {
  return src.class === 'icon' || src.class === 'portrait';
}

export interface IconEntry {
  /** Trimmed rect in the atlas. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Square frame size in px (8, 16, or 48). Draw the icon centred in a size x size box. */
  readonly size: number;
  /** Top-left of the trimmed rect inside the frame box (centred). */
  readonly ox: number;
  readonly oy: number;
}

export interface IconManifest {
  readonly version: 1;
  readonly image: 'icons-atlas.png';
  readonly width: number;
  readonly height: number;
  readonly filter: 'nearest';
  readonly icons: Readonly<Record<string, IconEntry>>;
}

export interface IconAtlas {
  readonly width: number;
  readonly height: number;
  /** RGBA8, row-major, top row first. */
  readonly pixels: Uint8Array;
  readonly manifest: IconManifest;
}

/** ImageData-compatible pixels: `new ImageData(img.data, img.width, img.height)`. */
export interface IconImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Pack the first frame of every icon and portrait sprite. Non-UI sprites in the list are ignored,
 * so callers can pass RenderAssets.sprites as is.
 */
export function buildIconAtlas(sprites: readonly SpriteSheetDef[], palette: PaletteDef): IconAtlas {
  const ui = sprites.filter(isUiArt).map((s) => {
    const first = Object.entries(s.animations)[0];
    const one: SpriteSheetDef = {
      ...s,
      animations:
        first === undefined ? {} : { icon: { ...first[1], frames: first[1].frames.slice(0, 1) } },
    };
    return compileSprite(one, palette);
  });
  const packed = packAtlas(ui, palette, { width: 256 });
  const icons: Record<string, IconEntry> = {};
  for (const [id, entry] of Object.entries(packed.manifest.sprites)) {
    const f = entry.animations['icon']?.frames[0];
    if (f === undefined) continue;
    const size = Math.max(entry.frameW, entry.frameH);
    icons[id] = {
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      size,
      ox: Math.floor((size - f.w) / 2),
      oy: Math.floor((size - f.h) / 2),
    };
  }
  return {
    width: packed.width,
    height: packed.height,
    pixels: packed.pixels,
    manifest: {
      version: 1,
      image: 'icons-atlas.png',
      width: packed.width,
      height: packed.height,
      filter: 'nearest',
      icons,
    },
  };
}

/**
 * Pixels of one icon in its full square frame (transparent margin, icon centred), scaled by an
 * integer factor (nearest). null when the id is not in the atlas.
 */
export function iconImage(atlas: IconAtlas, id: string, scale = 1): IconImage | null {
  const e = atlas.manifest.icons[id];
  if (e === undefined) return null;
  const k = Math.max(1, Math.floor(scale));
  const size = e.size * k;
  const data = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
  for (let y = 0; y < e.h; y++)
    for (let x = 0; x < e.w; x++) {
      const s = ((e.y + y) * atlas.width + e.x + x) * 4;
      if ((atlas.pixels[s + 3] ?? 0) === 0) continue;
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++) {
          const d = (((e.oy + y) * k + dy) * size + (e.ox + x) * k + dx) * 4;
          data[d] = atlas.pixels[s] ?? 0;
          data[d + 1] = atlas.pixels[s + 1] ?? 0;
          data[d + 2] = atlas.pixels[s + 2] ?? 0;
          data[d + 3] = 255;
        }
    }
  return { width: size, height: size, data };
}
