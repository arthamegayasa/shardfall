// Preview sheet: every sprite frame in colour, as a flat ink silhouette, and in grayscale (art-pipeline 8).
// RGBA8 images, rasterized with the runtime functions in src/core/sprite so the sheet shows game pixels.

import { frameToRgba, tokenRgb } from '../../../src/core/index.ts';
import type { CompiledSprite, PaletteDef, Rgb } from '../../../src/core/index.ts';

export interface Image8 {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
}

export function createImage(w: number, h: number, rgb: Rgb): Image8 {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { w, h, data };
}

function fillRect(img: Image8, x0: number, y0: number, w: number, h: number, rgb: Rgb): void {
  for (let y = Math.max(0, y0); y < Math.min(img.h, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(img.w, x0 + w); x++) {
      const i = (y * img.w + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
}

/** Copy opaque pixels (alpha 255) of src onto dst at (x0, y0). */
export function blit(dst: Image8, src: Image8, x0: number, y0: number): void {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const s = (y * src.w + x) * 4;
      if ((src.data[s + 3] ?? 0) === 0) continue;
      const dx = x0 + x;
      const dy = y0 + y;
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
      const d = (dy * dst.w + dx) * 4;
      for (let k = 0; k < 4; k++) dst.data[d + k] = src.data[s + k] ?? 0;
    }
}

export function upscale(img: Image8, k: number): Image8 {
  const out = new Uint8Array(img.w * k * img.h * k * 4);
  const w = img.w * k;
  for (let y = 0; y < img.h * k; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4;
      const d = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[d + c] = img.data[s + c] ?? 0;
    }
  return { w, h: img.h * k, data: out };
}

/** Display gray from WCAG luminance, re-encoded to sRGB (same rule as the M0 sheet). */
function toGray(img: Image8): Image8 {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const data = img.data.slice();
  for (let i = 0; i < data.length; i += 4) {
    const l =
      0.2126 * lin(data[i] ?? 0) + 0.7152 * lin(data[i + 1] ?? 0) + 0.0722 * lin(data[i + 2] ?? 0);
    const s = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
    const g = Math.round(Math.max(0, Math.min(1, s)) * 255);
    data[i] = g;
    data[i + 1] = g;
    data[i + 2] = g;
  }
  return { w: img.w, h: img.h, data };
}

type Row = 'color' | 'silhouette' | 'gray';

/** One cell per frame of every animation, three rows, bottom-centre in each frame box, upscaled x scale. */
export function renderSheet(
  compiled: readonly CompiledSprite[],
  palette: PaletteDef,
  scale = 4,
  gap = 4,
): Image8 {
  const rows: readonly Row[] = ['color', 'silhouette', 'gray'];
  const bg: Record<Row, Rgb> = {
    color: tokenRgb(palette, 'floor-mid'),
    silhouette: tokenRgb(palette, 'bone'),
    gray: tokenRgb(palette, 'floor-mid'),
  };
  const ink = tokenRgb(palette, 'ink');
  const cells = compiled.flatMap((c) =>
    Object.values(c.anims).flatMap((a) => a.frames.map((f) => ({ c, f }))),
  );
  const rowH = Math.max(...cells.map((x) => x.c.src.frameH));
  const width = gap + cells.reduce((s, x) => s + x.c.src.frameW + gap, 0);
  const height = gap + rows.length * (rowH + gap);
  const sheet = createImage(width, height, tokenRgb(palette, 'night'));
  rows.forEach((kind, ri) => {
    const y0 = gap + ri * (rowH + gap);
    let x = gap;
    for (const { c, f } of cells) {
      const fw = c.src.frameW;
      const fh = c.src.frameH;
      fillRect(sheet, x, y0 + rowH - fh, fw, fh, bg[kind]);
      let img: Image8 = {
        w: f.w,
        h: f.h,
        data: frameToRgba(f, palette, kind === 'silhouette' ? ink : undefined),
      };
      if (kind === 'gray') img = toGray(img);
      blit(sheet, img, x + Math.floor((fw - f.w) / 2), y0 + rowH - f.h);
      x += fw + gap;
    }
  });
  return upscale(sheet, scale);
}
