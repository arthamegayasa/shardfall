// Icons and portraits for UI (ui-spec 6.1, 12.4). AD pixel art arrives as SpriteSheetDefs in
// UiDeps.art (art/sprites/icon-*.json, class 'icon' or 'portrait'). The UI finds them with AD's id
// helper (iconSpriteId) plus a looser fallback, and cuts pixels from AD's icon atlas (buildIconAtlas,
// iconImage in src/core/sprite) so every icon keeps its square frame. Until a sprite exists the UI
// draws a monogram fallback, so screens never wait for art.

import {
  buildIconAtlas,
  compileSprite,
  frameToRgba,
  iconImage,
  iconSpriteId,
} from '../core/index.ts';
import type { RenderAssets } from '../core/dom.ts';
import type { IconAtlas, SpriteSheetDef } from '../core/index.ts';

export type IconKind = 'weapon' | 'memento' | 'stat' | 'rite' | 'tag';

export interface IconRef {
  readonly kind: IconKind;
  /** Data id (lantern_bolt, max_hp, flame, flare_lantern). */
  readonly id: string;
}

/** snake_case or camelCase data id to the kebab-case used by sprite ids (art-pipeline 3). */
export function kebab(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/** Sprite ids tried in order for one icon. Temper cards use the stat id. */
export function iconCandidates(ref: IconRef): string[] {
  const k = kebab(ref.id);
  const primary = iconSpriteId(ref.kind, k);
  if (ref.kind === 'stat') return [primary, `icon-card-${k}`, `icon-${k}`];
  return [primary, `icon-${k}`];
}

/**
 * Icon sprite for a data id, or null. Exact candidate ids first, then any class 'icon' sprite whose
 * id ends with the kebab id (AD may group icons differently, e.g. icon-arms-lantern-bolt).
 */
export function findIconSprite(
  sprites: readonly SpriteSheetDef[],
  ref: IconRef,
): SpriteSheetDef | null {
  for (const id of iconCandidates(ref)) {
    const hit = sprites.find((s) => s.id === id);
    if (hit !== undefined) return hit;
  }
  const tail = `-${kebab(ref.id)}`;
  return sprites.find((s) => s.class === 'icon' && s.id.endsWith(tail)) ?? null;
}

/** Portrait sprite (class 'portrait') whose id names the character, e.g. portrait-glazier. */
export function findPortraitSprite(
  sprites: readonly SpriteSheetDef[],
  name: string,
): SpriteSheetDef | null {
  const k = kebab(name);
  return (
    sprites.find((s) => s.id === `portrait-${k}` || s.id === `icon-portrait-${k}`) ??
    sprites.find((s) => s.class === 'portrait' && s.id.includes(k)) ??
    null
  );
}

/**
 * Two-letter monogram fallback from a display name: initials of the first two words
 * ("Lantern Bolt" -> "LB"), or the first two letters of a single word ("Whetstone" -> "Wh").
 */
export function monogram(name: string): string {
  const words = name.split(/[\s-]+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const first = words[0];
  if (first === undefined) return '';
  const second = words[1];
  if (second !== undefined) return (firstChar(first) + firstChar(second)).toUpperCase();
  const letters = first.replace(/[^A-Za-z0-9]/g, '');
  return (letters.charAt(0).toUpperCase() + letters.charAt(1).toLowerCase()).trim();
}

function firstChar(word: string): string {
  return word.replace(/[^A-Za-z0-9]/g, '').charAt(0);
}

/** Largest integer scale so a w x h sprite fits a box of `box` UI units (at least 1). */
export function fitScale(w: number, h: number, box: number): number {
  const big = Math.max(1, w, h);
  return Math.max(1, Math.floor(box / big));
}

interface Raster {
  readonly w: number;
  readonly h: number;
  readonly rgba: Uint8ClampedArray;
}

/** Rasterizes art sprites once per id; DOM canvases are cheap copies of the cached pixels. */
export interface IconArt {
  /** Canvas with the sprite at an integer scale inside a box of `box` UI units, or null. */
  icon(doc: Document, ref: IconRef, box: number): HTMLCanvasElement | null;
  portrait(doc: Document, name: string, box: number): HTMLCanvasElement | null;
  /** Any sprite by exact id (icon-glint, icon-silt), or null. */
  sprite(doc: Document, id: string, box: number): HTMLCanvasElement | null;
}

export function createIconArt(art: RenderAssets): IconArt {
  const cache = new Map<string, Raster | null>();
  let atlas: IconAtlas | null | undefined;

  /** AD's packed icon atlas, built on first use (null when the art cannot be packed). */
  const getAtlas = (): IconAtlas | null => {
    if (atlas === undefined) {
      try {
        atlas = buildIconAtlas(art.sprites, art.palette);
      } catch {
        atlas = null;
      }
    }
    return atlas;
  };

  const raster = (def: SpriteSheetDef): Raster | null => {
    const hit = cache.get(def.id);
    if (hit !== undefined) return hit;
    let out: Raster | null = null;
    const a = getAtlas();
    const img = a === null ? null : iconImage(a, def.id, 1);
    if (img !== null) {
      out = { w: img.width, h: img.height, rgba: img.data };
      cache.set(def.id, out);
      return out;
    }
    try {
      const compiled = compileSprite(def, art.palette);
      const anim = Object.values(compiled.anims)[0];
      const frame = anim?.frames[0];
      if (frame !== undefined && frame.w > 0 && frame.h > 0) {
        out = {
          w: frame.w,
          h: frame.h,
          rgba: new Uint8ClampedArray(frameToRgba(frame, art.palette)),
        };
      }
    } catch {
      // Broken or unfinished art falls back to the monogram (art:check reports the sprite).
      out = null;
    }
    cache.set(def.id, out);
    return out;
  };

  const toCanvas = (doc: Document, def: SpriteSheetDef | null, box: number) => {
    if (def === null) return null;
    const r = raster(def);
    if (r === null) return null;
    const c = doc.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    const g = c.getContext('2d');
    if (g === null) return null;
    g.putImageData(new ImageData(new Uint8ClampedArray(r.rgba), r.w, r.h), 0, 0);
    const k = fitScale(r.w, r.h, box);
    c.className = 'px-art';
    c.style.width = `calc(var(--u) * ${String(r.w * k)})`;
    c.style.height = `calc(var(--u) * ${String(r.h * k)})`;
    c.setAttribute('aria-hidden', 'true');
    return c;
  };

  return {
    icon: (doc, ref, box) => toCanvas(doc, findIconSprite(art.sprites, ref), box),
    portrait: (doc, name, box) => toCanvas(doc, findPortraitSprite(art.sprites, name), box),
    sprite: (doc, id, box) => toCanvas(doc, art.sprites.find((s) => s.id === id) ?? null, box),
  };
}
