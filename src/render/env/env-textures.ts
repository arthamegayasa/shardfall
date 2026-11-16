// Procedural pixel textures for the diorama (LP; art-direction 10, LD 7.2). Pure: palette in, RGBA out.
// One atlas of 32 x 32 texel swatches, colours only from the biome env tokens (fallback b1, then core
// stone), value-only shading so hue and saturation stay those of the palette. Texel density on meshes is
// 16 texels per u (P3-b). Alpha carries the emissive mask: 255 = plain, lower = glows (1 - a).

import type { PaletteDef } from '../../core/index.ts';

export const SWATCH = 32;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
export const ENV_ATLAS_W = SWATCH * ATLAS_COLS;
export const ENV_ATLAS_H = SWATCH * ATLAS_ROWS;

/** Material swatches, value = slot in the atlas (row-major). */
export const EnvMat = {
  wood: 0,
  woodDark: 1,
  crate: 2,
  barrel: 3,
  clothStripeA: 4,
  clothStripeB: 5,
  clothIndigo: 6,
  clothOchre: 7,
  rope: 8,
  paper: 9,
  flame: 10,
  sack: 11,
  roofTile: 12,
  plaster: 13,
  window: 14,
  stone: 15,
  glass: 16,
  ground: 17,
  goods: 18,
  paperDim: 19,
  clothMoss: 20,
  stoneDark: 21,
} as const;
export type EnvMat = (typeof EnvMat)[keyof typeof EnvMat];

/** Role -> env token candidates, first found in the biome wins (b2 and b3 lack market tokens). */
const ROLE_TOKENS: Readonly<Record<string, readonly string[]>> = {
  wood: ['wood', 'vine-wood', 'stone', 'banner'],
  woodDark: ['wood-dark', 'charred', 'stone-dark'],
  indigo: ['cloth-indigo', 'banner', 'leaf-dry'],
  ochre: ['cloth-ochre', 'banner', 'leaf-dead'],
  moss: ['cloth-moss', 'moss', 'leaf-dry'],
  rope: ['rope', 'trellis', 'banner'],
  paper: ['paper', 'candle', 'ember'],
  flame: ['flame', 'ember'],
  curb: ['curb'],
  floorDark: ['floor-dark'],
  floorLight: ['floor-light'],
  glass: ['glass'],
  void: ['void'],
};

export type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB 0..255 colour of a role for a biome id (b1, b2, b3). */
export function roleColor(palette: PaletteDef, biomeId: string, role: string): Rgb {
  const biome = palette.biomes.find((b) => b.id === biomeId) ?? palette.biomes[0];
  const b1 = palette.biomes.find((b) => b.id === 'b1');
  for (const t of ROLE_TOKENS[role] ?? [role]) {
    const hex = biome?.env[t];
    if (hex !== undefined) return parseHex(hex);
  }
  for (const t of ROLE_TOKENS[role] ?? [role]) {
    const hex = b1?.env[t];
    if (hex !== undefined) return parseHex(hex);
  }
  return parseHex(palette.core['stone'] ?? '#8A817A');
}

/** Integer hash to [0, 1): deterministic texture noise (never Math.random, coding-standards 4.2). */
export function hash3(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface EnvAtlas {
  readonly width: number;
  readonly height: number;
  /** RGBA8, sRGB colour, alpha = 255 - emissive mask. Row 0 is the top (flipY false). */
  readonly data: Uint8Array;
}

/** Swatch origin in texels, for building UV regions. */
export function swatchOrigin(mat: EnvMat): { x: number; y: number } {
  return { x: (mat % ATLAS_COLS) * SWATCH, y: Math.floor(mat / ATLAS_COLS) * SWATCH };
}

type Texel = (x: number, y: number) => readonly [Rgb, number, number];

export function buildEnvAtlas(palette: PaletteDef, biomeId: string): EnvAtlas {
  const c = (role: string): Rgb => roleColor(palette, biomeId, role);
  const wood = c('wood');
  const woodDark = c('woodDark');
  const indigo = c('indigo');
  const ochre = c('ochre');
  const moss = c('moss');
  const rope = c('rope');
  const paper = c('paper');
  const flame = c('flame');
  const curb = c('curb');
  const floorDark = c('floorDark');
  const floorLight = c('floorLight');
  const glass = c('glass');
  const voidC = c('void');
  const n = (x: number, y: number, s: number, amp: number): number =>
    1 + (hash3(x, y, s) - 0.5) * 2 * amp;
  const PLAIN = 255;

  // Each recipe returns [colour, value multiplier, alpha].
  const recipes: Readonly<Record<number, Texel>> = {
    [EnvMat.wood]: (x, y) => {
      const plank = Math.floor(y / 8);
      if (y % 8 === 7) return [woodDark, 1, PLAIN];
      return [wood, n(plank, 0, 3, 0.05) * n(x >> 2, y, 4, 0.04), PLAIN];
    },
    [EnvMat.woodDark]: (x, y) => [woodDark, n(x, y >> 3, 5, 0.06), PLAIN],
    [EnvMat.crate]: (x, y) => {
      const edge = x < 3 || y < 3 || x > 28 || y > 28;
      const brace = Math.abs(x - y) < 2;
      if (edge || brace) return [woodDark, n(x, y, 6, 0.04), PLAIN];
      return [wood, (y % 7 === 6 ? 0.85 : 1) * n(x >> 2, y, 7, 0.04), PLAIN];
    },
    [EnvMat.barrel]: (x, y) => {
      if ((y >= 4 && y <= 5) || (y >= 26 && y <= 27)) return [woodDark, 0.8, PLAIN];
      return [wood, n(x >> 2, 0, 8, 0.06) * n(x, y, 9, 0.03), PLAIN];
    },
    [EnvMat.clothStripeA]: (x, y) => [
      (x >> 2) % 2 === 0 ? indigo : ochre,
      n(x, y, 10, 0.04),
      PLAIN,
    ],
    [EnvMat.clothStripeB]: (x, y) => [(x >> 2) % 2 === 0 ? moss : ochre, n(x, y, 11, 0.04), PLAIN],
    [EnvMat.clothIndigo]: (x, y) => [indigo, n(x, y, 12, 0.05), PLAIN],
    [EnvMat.clothOchre]: (x, y) => [ochre, n(x, y, 13, 0.05), PLAIN],
    [EnvMat.clothMoss]: (x, y) => [moss, n(x, y, 23, 0.05), PLAIN],
    [EnvMat.rope]: (x, y) => [rope, (x + y) % 3 === 0 ? 0.8 : n(x, y, 14, 0.04), PLAIN],
    // Lantern paper glows (alpha 0 = full emissive); ribs are darker and glow a little less.
    [EnvMat.paper]: (x, y) => [
      paper,
      x % 8 === 0 ? 0.82 : n(x, y, 15, 0.03),
      x % 8 === 0 ? 120 : 0,
    ],
    [EnvMat.flame]: (x, y) => [flame, n(x, y, 16, 0.03), 0],
    [EnvMat.paperDim]: (x, y) => [paper, n(x, y, 24, 0.05) * (y % 6 === 0 ? 0.9 : 1), PLAIN],
    [EnvMat.sack]: (x, y) => [ochre, 0.85 * n(x, y, 17, 0.07) * (y === 6 ? 0.8 : 1), PLAIN],
    [EnvMat.roofTile]: (x, y) => {
      const row = Math.floor(y / 4);
      const gap = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 0;
      return [gap ? voidC : woodDark, gap ? 1 : n(row, x >> 3, 18, 0.07), PLAIN];
    },
    [EnvMat.plaster]: (x, y) => {
      if (y < 3) return [woodDark, 1, PLAIN];
      return [hash3(x >> 1, y >> 1, 19) < 0.5 ? curb : floorDark, n(x, y, 20, 0.04), PLAIN];
    },
    // Facade with a lit paper window (glows faintly through the top-band blur).
    [EnvMat.window]: (x, y) => {
      const inWin = x >= 10 && x <= 21 && y >= 9 && y <= 23;
      const frame = inWin && (x === 10 || x === 21 || y === 9 || y === 23 || x === 15 || x === 16);
      if (frame) return [woodDark, 1, PLAIN];
      if (inWin) return [paper, 0.7, 150];
      if (y < 3) return [woodDark, 1, PLAIN];
      return [hash3(x >> 1, y >> 1, 21) < 0.5 ? curb : floorDark, n(x, y, 22, 0.04), PLAIN];
    },
    [EnvMat.stone]: (x, y) => {
      const bx = Math.floor((x + (Math.floor(y / 8) % 2) * 4) / 8);
      const seam = y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 4) % 8 === 7;
      return [seam ? floorDark : floorLight, seam ? 0.9 : n(bx, y >> 3, 25, 0.05), PLAIN];
    },
    [EnvMat.stoneDark]: (x, y) => [floorDark, n(x >> 1, y >> 1, 26, 0.06), PLAIN],
    // Glass: pale with a diagonal sheen; sheen texels glow slightly (catches lantern light).
    [EnvMat.glass]: (x, y) => {
      const sheen = (x + y) % 11 === 0;
      return [glass, sheen ? 1.12 : n(x, y, 27, 0.04) * 0.92, sheen ? 170 : PLAIN];
    },
    [EnvMat.ground]: (x, y) => [curb, n(x, y, 28, 0.06), PLAIN],
    [EnvMat.goods]: (x, y) => {
      const k = Math.floor(hash3(x >> 2, y >> 2, 29) * 5);
      const pick = [rope, moss, wood, ochre, paper][k] ?? wood;
      return [pick, (k === 4 ? 0.75 : 1) * n(x, y, 30, 0.05), PLAIN];
    },
  };

  const data = new Uint8Array(ENV_ATLAS_W * ENV_ATLAS_H * 4);
  for (const [key, recipe] of Object.entries(recipes)) {
    const mat = Number(key) as EnvMat;
    const o = swatchOrigin(mat);
    for (let y = 0; y < SWATCH; y++) {
      for (let x = 0; x < SWATCH; x++) {
        const [rgb, k, a] = recipe(x, y);
        const i = ((o.y + y) * ENV_ATLAS_W + o.x + x) * 4;
        data[i] = Math.min(255, Math.round(rgb[0] * k));
        data[i + 1] = Math.min(255, Math.round(rgb[1] * k));
        data[i + 2] = Math.min(255, Math.round(rgb[2] * k));
        data[i + 3] = a;
      }
    }
  }
  return { width: ENV_ATLAS_W, height: ENV_ATLAS_H, data };
}
