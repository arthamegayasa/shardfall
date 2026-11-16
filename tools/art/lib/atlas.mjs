// Deterministic shelf packer and atlas manifest (docs/art-pipeline.md section 5).
// The runtime rasterizer is expected to produce the same layout at boot; this tool version exports it as PNG + JSON for review.
import { createImage, composite } from './image.mjs';
import { frameToImage } from './sprite.mjs';

const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

/**
 * @param {Array} compiled compileSprite() results
 * @param {{ width?: number, padding?: number }} opts
 * @returns {{ image, manifest }}
 */
export function packAtlas(compiled, opts = {}) {
  const width = opts.width ?? 512;
  const pad = opts.padding ?? 1;
  const items = [];
  for (const c of compiled)
    for (const [anim, a] of Object.entries(c.anims))
      a.frames.forEach((f, i) => items.push({ id: c.src.id, anim, i, f, c }));
  // Tallest first, then id, anim, index: stable and deterministic.
  items.sort((p, q) => q.f.h - p.f.h || p.id.localeCompare(q.id) || p.anim.localeCompare(q.anim) || p.i - q.i);
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
  const image = createImage(width, height, [0, 0, 0, 0]);
  const sprites = {};
  for (const c of compiled) {
    sprites[c.src.id] = {
      class: c.src.class,
      faction: c.src.faction,
      frameW: c.src.frameW,
      frameH: c.src.frameH,
      anchor: c.src.anchor,
      animations: Object.fromEntries(
        Object.entries(c.anims).map(([k, a]) => [k, { ticksPerFrame: a.ticksPerFrame, loop: a.loop, frames: [] }]),
      ),
    };
  }
  for (const it of items) {
    composite(image, frameToImage(it.f), it.x, it.y);
    // ox, oy: where the trimmed rect sits inside the frame box (bottom centre).
    const ox = Math.floor((it.c.src.frameW - it.f.w) / 2);
    const oy = it.c.src.frameH - it.f.h;
    sprites[it.id].animations[it.anim].frames[it.i] = { x: it.x, y: it.y, w: it.f.w, h: it.f.h, ox, oy };
  }
  const manifest = { version: 1, image: 'atlas.png', width, height, padding: pad, filter: 'nearest', sprites };
  return { image, manifest };
}
