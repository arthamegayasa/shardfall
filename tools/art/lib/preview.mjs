// Preview sheet renderer: each sprite frame drawn in colour, as a flat silhouette, and in grayscale.
import { createImage, fillRect, composite, upscaleNearest, hex, luminance } from './image.mjs';
import { frameToImage, CORE } from './sprite.mjs';

const BG = {
  color: hex(CORE['floor-mid']),
  silhouette: hex(CORE.bone),
  gray: hex(CORE['floor-mid']),
};

function grayOf(img) {
  const out = { w: img.w, h: img.h, data: new Float32Array(img.data) };
  for (let i = 0; i < out.data.length; i += 4) {
    // Display gray: perceptual lightness from WCAG luminance, re-encoded to sRGB.
    const L = luminance([out.data[i], out.data[i + 1], out.data[i + 2]]);
    const s = L <= 0.0031308 ? L * 12.92 : 1.055 * L ** (1 / 2.4) - 0.055;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = s;
  }
  return out;
}

/**
 * @param {Array} compiled list of compileSprite() results
 * @param {{ scale?: number, gap?: number, rows?: string[], frames?: 'first'|'all' }} opts
 */
export function renderSheet(compiled, opts = {}) {
  const scale = opts.scale ?? 4;
  const gap = opts.gap ?? 4;
  const rows = opts.rows ?? ['color', 'silhouette', 'gray'];
  const cells = [];
  for (const c of compiled)
    for (const anim of Object.values(c.anims)) {
      const frames = opts.frames === 'all' ? anim.frames : anim.frames.slice(0, 1);
      for (const f of frames) cells.push({ c, f });
    }
  const cellW = (cell) => cell.c.src.frameW;
  const rowH = Math.max(...cells.map((x) => x.c.src.frameH));
  const width = gap + cells.reduce((s, x) => s + cellW(x) + gap, 0);
  const height = gap + rows.length * (rowH + gap);
  const sheet = createImage(width, height, [...hex(CORE.night), 1]);
  rows.forEach((kind, ri) => {
    const y0 = gap + ri * (rowH + gap);
    let x = gap;
    for (const cell of cells) {
      const fw = cell.c.src.frameW;
      const fh = cell.c.src.frameH;
      fillRect(sheet, x, y0 + rowH - fh, fw, fh, BG[kind]);
      let img = frameToImage(cell.f, { silhouette: kind === 'silhouette' ? hex(CORE.ink) : null });
      if (kind === 'gray') img = grayOf(img);
      // bottom-centre in the frame box, frame box bottom-aligned in the row
      const ox = x + Math.floor((fw - cell.f.w) / 2);
      const oy = y0 + rowH - cell.f.h;
      composite(sheet, img, ox, oy);
      x += fw + gap;
    }
  });
  return upscaleNearest(sheet, scale);
}

export { grayOf };
