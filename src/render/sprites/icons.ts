// UI icon provider (AD, M2-03): DOM wrapper over the pure icon atlas in src/core/sprite/icons.ts.
// getIcon(id) returns a fresh <canvas> (image-rendering: pixelated, integer scale) and getIconDataUrl
// a cached PNG data URL for CSS backgrounds. Built once from RenderAssets (UiDeps.art).
//
// Note on module rules: src/ui may not import src/render (eslint, architecture 5). The UI can either
// receive this provider from src/app, or call the same pure core functions itself:
//   const atlas = buildIconAtlas(deps.art.sprites, deps.art.palette);   // once
//   const img = iconImage(atlas, iconSpriteId('weapon', 'lantern_bolt'), 2);
//   if (img) ctx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);

import { buildIconAtlas, iconImage, iconSpriteId } from '../../core/index.ts';
import type { IconKind, IconManifest } from '../../core/index.ts';
import type { RenderAssets } from '../../core/dom.ts';

export interface IconProvider {
  readonly manifest: IconManifest;
  has(id: string): boolean;
  /** New canvas of the icon (size x scale square), or null when the id has no icon. */
  getIcon(id: string, scale?: number): HTMLCanvasElement | null;
  /** Cached PNG data URL of the icon at scale, or null. */
  getIconDataUrl(id: string, scale?: number): string | null;
  /** Convenience: icon of a data row, e.g. iconFor('memento', 'coal_locket'). */
  iconFor(kind: IconKind, dataId: string, scale?: number): HTMLCanvasElement | null;
}

export function createIconProvider(assets: RenderAssets, doc: Document = document): IconProvider {
  const atlas = buildIconAtlas(assets.sprites, assets.palette);
  const urls = new Map<string, string>();

  const getIcon = (id: string, scale = 1): HTMLCanvasElement | null => {
    const img = iconImage(atlas, id, scale);
    if (img === null) return null;
    const canvas = doc.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d');
    if (ctx !== null) ctx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    return canvas;
  };

  return {
    manifest: atlas.manifest,
    has: (id) => atlas.manifest.icons[id] !== undefined,
    getIcon,
    getIconDataUrl(id, scale = 1) {
      const key = `${id}@${Math.max(1, Math.floor(scale))}`;
      const hit = urls.get(key);
      if (hit !== undefined) return hit;
      const c = getIcon(id, scale);
      if (c === null) return null;
      const url = c.toDataURL('image/png');
      urls.set(key, url);
      return url;
    },
    iconFor: (kind, dataId, scale) => getIcon(iconSpriteId(kind, dataId), scale),
  };
}
