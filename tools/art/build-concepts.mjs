#!/usr/bin/env node
// Generate the M0 mood concepts in art/concept/ from the palette and sprite data.
// Usage: node tools/art/build-concepts.mjs
// Outputs:
//   01-palette-biomes.svg       core palette, three biome palettes, lights, floor under light
//   02-actor-lineup.png         actors in colour / flat silhouette / grayscale (4x) plus a scale lineup at game scale (3x)
//   03-arena-lantern-market.png arena composition, biome 1, 1920x1080 (1 sprite px = 3 screen px)
//   04-biome-moods.png          same arena under the three biome palettes, 1280x720 each, stacked
//   05-readability-check.png    biome 1 arena in grayscale and as a three-value map (P2-b)
//   measurements.json           contrast and saturation measured on the rendered images (P2-c, style-guide 1.9)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadAllSprites, compileSprite, frameToImage, tokenColor, ROOT, CORE, BIOMES } from './lib/sprite.mjs';
import { renderSheet, grayOf } from './lib/preview.mjs';
import { renderScene, measure, litColor, LOW_W, LOW_H } from './lib/scene.mjs';
import {
  createImage, composite, upscaleNearest, savePng, fillRect, hex, toHex, saturation, contrast, luminance,
} from './lib/image.mjs';

const OUT = join(ROOT, 'art', 'concept');
mkdirSync(OUT, { recursive: true });

const loaded = await loadAllSprites();
const S = {};
for (const { src } of loaded) {
  const c = compileSprite(src);
  if (c.issues.length) throw new Error(`Sprite ${src.id} invalid:\n${c.issues.join('\n')}`);
  S[src.id] = c;
}

// ---------- 01 palette sheet (SVG) ----------
function paletteSvg() {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const parts = [];
  const W = 1680;
  let y = 0;
  const text = (x, yy, s, size = 14, fill = CORE.bone, weight = 'normal') =>
    parts.push(`<text x="${x}" y="${yy}" font-family="Consolas, 'Courier New', monospace" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(s)}</text>`);
  const sw = (x, yy, w, h, c, stroke = null) =>
    parts.push(`<rect x="${x}" y="${yy}" width="${w}" height="${h}" fill="${c}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ''}/>`);

  text(32, 44, 'SHARDFALL  palette and light (M0 concept, Art Director)', 22, CORE.bone, 'bold');
  text(32, 70, 'Core palette from style-guide 1.2. Biome palettes and lights from art-direction.md. Source of truth: art/palette.json.', 13, CORE.dust);
  y = 100;
  const groups = [
    ['Neutral', ['ink', 'night', 'shadow', 'floor-mid', 'floor-lit', 'stone', 'dust', 'bone']],
    ['Kept (player): blue, cyan, gold', ['kept-blue', 'kept-blue-deep', 'kept-cyan', 'kept-white', 'kept-gold', 'glint']],
    ['Unlit (danger): red, magenta, violet', ['unlit-body', 'unlit-rim', 'danger-red', 'danger-magenta', 'danger-violet', 'danger-core']],
    ['Rarity (UI frames)', ['rarity-plain', 'rarity-fine', 'rarity-rare', 'rarity-fabled']],
  ];
  for (const [title, toks] of groups) {
    text(32, y + 16, title, 15, CORE.bone, 'bold');
    toks.forEach((t, i) => {
      const x = 32 + i * 200;
      sw(x, y + 26, 56, 40, CORE[t], CORE.shadow);
      text(x + 66, y + 42, t, 13);
      text(x + 66, y + 60, CORE[t], 13, CORE.dust);
    });
    y += 84;
  }
  y += 10;
  const colW = (W - 64) / 3;
  const top = y;
  BIOMES.forEach((b, bi) => {
    const x0 = 32 + bi * colW;
    let yy = top;
    parts.push(`<rect x="${x0 - 8}" y="${yy - 8}" width="${colW - 16}" height="660" fill="${b.env.void}" stroke="${CORE.shadow}"/>`);
    text(x0 + 4, yy + 18, `${b.id.toUpperCase()}  ${b.workingName} (${b.contentId}, working name)`, 15, CORE.bone, 'bold');
    yy += 36;
    const envKeys = Object.keys(b.env);
    envKeys.forEach((k, i) => {
      const cx = x0 + 4 + (i % 2) * ((colW - 32) / 2);
      const cy = yy + Math.floor(i / 2) * 44;
      sw(cx, cy, 44, 34, b.env[k], CORE.shadow);
      text(cx + 52, cy + 14, `${b.id}.${k}${b.emissive.includes(k) ? ' *' : ''}`, 12);
      text(cx + 52, cy + 30, b.env[k], 12, CORE.dust);
    });
    yy += Math.ceil(envKeys.length / 2) * 44 + 10;
    text(x0 + 4, yy + 12, '* emissive (bloom, not lit)', 11, CORE.dust);
    yy += 30;
    const lights = [
      ['key', b.key, `az ${b.key.azimuthDeg} el ${b.key.elevationDeg} I ${b.key.intensity}`],
      ['fill', b.fill, `az ${b.fill.azimuthDeg} el ${b.fill.elevationDeg} I ${b.fill.intensity}`],
      ['point', b.point, `range ${b.point.rangeU} u I ${b.point.intensity} flicker ${b.point.flicker}`],
    ];
    for (const [name, L, desc] of lights) {
      sw(x0 + 4, yy, 44, 34, L.color, CORE.shadow);
      text(x0 + 56, yy + 14, `${name} ${L.color}  sat ${(saturation(hex(L.color)) * 100).toFixed(0)}%`, 12);
      text(x0 + 56, yy + 30, desc, 12, CORE.dust);
      yy += 44;
    }
    yy += 6;
    text(x0 + 4, yy + 12, 'floor under key + fill (centre)', 12, CORE.bone);
    yy += 20;
    for (const k of ['floor-dark', 'floor-light']) {
      const lit = toHex(litColor(b, b.env[k]));
      sw(x0 + 4, yy, 44, 34, b.env[k], CORE.shadow);
      sw(x0 + 48, yy, 44, 34, lit, CORE.shadow);
      text(x0 + 100, yy + 14, `${k}: ${b.env[k]} -> ${lit}`, 12);
      text(x0 + 100, yy + 30, `danger-core ${contrast(hex(CORE['danger-core']), hex(lit)).toFixed(1)}:1  cyan ${contrast(hex(CORE['kept-cyan']), hex(lit)).toFixed(1)}:1  unlit ${contrast(hex(CORE['unlit-body']), hex(lit)).toFixed(1)}:1`, 11, CORE.dust);
      yy += 44;
    }
    yy += 8;
    // Readability strip: floor with a Kept accent, an Unlit body and an enemy shot on it.
    const lit = toHex(litColor(b, b.env['floor-light']));
    sw(x0 + 4, yy, colW - 40, 40, lit);
    sw(x0 + 20, yy + 8, 24, 24, CORE['kept-blue']);
    sw(x0 + 26, yy + 14, 12, 12, CORE['kept-cyan']);
    sw(x0 + 64, yy + 8, 24, 24, CORE['unlit-body']);
    sw(x0 + 64, yy + 8, 24, 3, CORE['unlit-rim']);
    sw(x0 + 72, yy + 16, 3, 3, CORE['danger-red']);
    sw(x0 + 79, yy + 16, 3, 3, CORE['danger-red']);
    parts.push(`<circle cx="${x0 + 120}" cy="${yy + 20}" r="9" fill="${CORE['danger-magenta']}" stroke="${CORE.ink}" stroke-width="2"/>`);
    parts.push(`<circle cx="${x0 + 120}" cy="${yy + 20}" r="4" fill="${CORE['danger-core']}"/>`);
    sw(x0 + 144, yy + 16, 6, 6, CORE.glint, CORE.ink);
  });
  const H = top + 680;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<rect width="${W}" height="${H}" fill="${CORE.night}"/>\n${parts.join('\n')}\n</svg>\n`;
}
writeFileSync(join(OUT, '01-palette-biomes.svg'), paletteSvg());

// ---------- 02 actor lineup ----------
function mirrorX(img) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w >> 1; x++) {
      const a = (y * img.w + x) * 4;
      const b = (y * img.w + img.w - 1 - x) * 4;
      for (let c = 0; c < 4; c++) [img.data[a + c], img.data[b + c]] = [img.data[b + c], img.data[a + c]];
    }
}
const order = [
  'kept-lantern', 'kept-bell', 'kept-blade',
  'unlit-swarmer', 'unlit-charger', 'unlit-shooter', 'unlit-tank', 'unlit-exploder', 'unlit-summoner',
  'warden-hound', 'warden-choir', 'fx-glint', 'fx-shot-kept', 'fx-shot-danger',
];
const sheet = renderSheet(order.map((id) => S[id]), { scale: 4, gap: 6 });
// Scale lineup at game scale (3x) on the biome 1 floor tile.
const lineupIds = ['kept-lantern', 'unlit-swarmer', 'unlit-shooter', 'unlit-tank', 'warden-hound', 'boss-lantern'];
const LW = 380;
const LH = 112;
const lineup = createImage(LW, LH, [...hex(CORE.night), 1]);
const tile = S['tile-floor'].anims.variants.frames[0];
for (let y = 92; y < LH; y++)
  for (let x = 0; x < LW; x++) {
    const t = tile.px[(y % tile.h) * tile.w + (x % tile.w)];
    fillRect(lineup, x, y, 1, 1, tokenColor(t));
  }
let lx = 16;
for (const id of lineupIds) {
  const f = S[id].anims.idle.frames[0];
  const flip = id === 'warden-hound';
  const img = frameToImage(f);
  if (flip) mirrorX(img);
  composite(lineup, img, lx, 98 - f.h);
  lx += f.w + 18;
}
const lineupBig = upscaleNearest(lineup, 3);
const W2 = Math.max(sheet.w, lineupBig.w);
const sheetOut = createImage(W2, sheet.h + lineupBig.h + 24, [...hex(CORE.night), 1]);
composite(sheetOut, sheet, 0, 0);
composite(sheetOut, lineupBig, 0, sheet.h + 24);
savePng(join(OUT, '02-actor-lineup.png'), sheetOut);

// ---------- 03 / 04 / 05 arena ----------
const b1 = renderScene(BIOMES[0], S, { scale: 3, seed: 7 });
savePng(join(OUT, '03-arena-lantern-market.png'), b1.full);

const measurements = {};
const moods = createImage(LOW_W * 2, LOW_H * 2 * 3, [0, 0, 0, 1]);
for (const [i, b] of BIOMES.entries()) {
  const r = renderScene(b, S, { scale: 2, seed: 7 });
  composite(moods, r.full, 0, i * LOW_H * 2);
  measurements[b.id] = measure(r);
}
savePng(join(OUT, '04-biome-moods.png'), moods);

// Readability: post-processed frame sampled back to native resolution, then grayscale and a three-value map.
const native = createImage(LOW_W, LOW_H);
for (let y = 0; y < LOW_H; y++)
  for (let x = 0; x < LOW_W; x++) {
    const i = ((y * 3 + 1) * b1.full.w + x * 3 + 1) * 4;
    native.data.set([b1.full.data[i], b1.full.data[i + 1], b1.full.data[i + 2], 1], (y * LOW_W + x) * 4);
  }
const gray = grayOf(native);
const floorL = measurements.b1.floorLuminanceMedian;
const bands = createImage(LOW_W, LOW_H);
const light = hex(CORE.bone);
const midC = hex(CORE.stone);
const dark = hex(CORE.ink);
for (let i = 0; i < LOW_W * LOW_H; i++) {
  const p = [native.data[i * 4], native.data[i * 4 + 1], native.data[i * 4 + 2]];
  const L = luminance(p);
  const c = (L + 0.05) / (floorL + 0.05);
  const col = c >= 2.0 ? light : c <= 1 / 1.6 ? dark : midC;
  bands.data.set([...col, 1], i * 4);
}
const read = createImage(LOW_W * 2 + 8, LOW_H, [...hex(CORE.night), 1]);
composite(read, gray, 0, 0);
composite(read, bands, LOW_W + 8, 0);
savePng(join(OUT, '05-readability-check.png'), upscaleNearest(read, 2));

measurements.note =
  'Measured on concept renders (tools/art/lib/scene.mjs), not on the game. Ratios use WCAG luminance, sprite pixel vs median of nearby floor pixels in the final post-processed image. Re-run on real screenshots in M2 (P2-c).';
writeFileSync(join(OUT, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
console.log(JSON.stringify(measurements, null, 2));
console.log('concepts written to art/concept/');
