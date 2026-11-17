// Runtime sprite atlas: rasterize every game sprite with src/core/sprite and upload one DataTexture
// (nearest, no mipmaps; architecture.md 7.6, 10). LP + AD.
// M2 (AD): UI icons and portraits (class icon, portrait) are left out: the UI builds its own icon
// atlas (src/core/sprite/icons.ts). Emissive texels (palette emissive tokens plus the sprite's own
// `emissive` list) are written with alpha EMISSIVE_ALPHA_BYTE so the sprite shader can glow them
// without a second texture (art-pipeline 5.3, cheaper stand-in for the indexed atlas).

import { DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';
import { compileSprite, isUiArt, packAtlas } from '../../core/index.ts';
import type {
  AtlasManifest,
  CompiledSprite,
  PaletteDef,
  SpriteSheetDef,
} from '../../core/index.ts';
import { EMISSIVE_ALPHA_BYTE } from '../shaders/index.ts';

export interface SpriteAtlas {
  readonly texture: DataTexture;
  readonly manifest: AtlasManifest;
  /** Issues reported by the rasterizer (sprites still render; art:check is the gate). */
  readonly issues: readonly string[];
}

/**
 * Mark emissive texels in a packed RGBA atlas (in place). Pure; exported for tests.
 * Returns the number of texels marked.
 */
export function markEmissive(
  pixels: Uint8Array,
  width: number,
  compiled: readonly CompiledSprite[],
  manifest: AtlasManifest,
  palette: PaletteDef,
): number {
  let n = 0;
  for (const c of compiled) {
    const glow = new Set([...palette.emissive, ...(c.src.emissive ?? [])]);
    const entry = manifest.sprites[c.src.id];
    if (entry === undefined) continue;
    for (const [name, anim] of Object.entries(c.anims)) {
      const rects = entry.animations[name]?.frames ?? [];
      anim.frames.forEach((f, fi) => {
        const r = rects[fi];
        if (r === undefined) return;
        for (let y = 0; y < f.h; y++)
          for (let x = 0; x < f.w; x++) {
            const t = f.px[y * f.w + x];
            if (t === null || t === undefined || !glow.has(t)) continue;
            pixels[((r.y + y) * width + r.x + x) * 4 + 3] = EMISSIVE_ALPHA_BYTE;
            n++;
          }
      });
    }
  }
  return n;
}

/** Rasterize and pack every game sprite with a palette (layout depends on sprite sizes only). */
function rasterize(
  sprites: readonly SpriteSheetDef[],
  palette: PaletteDef,
): {
  pixels: Uint8Array;
  width: number;
  height: number;
  manifest: AtlasManifest;
  issues: string[];
} {
  const compiled = sprites.filter((s) => !isUiArt(s)).map((s) => compileSprite(s, palette));
  const packed = packAtlas(compiled, palette);
  markEmissive(packed.pixels, packed.width, compiled, packed.manifest, palette);
  return { ...packed, issues: compiled.flatMap((c) => c.issues) };
}

/**
 * Re-rasterize the atlas with another palette into the same texture (BUG-016: colour vision modes).
 * Palettes differ in colours only, so the layout is identical; a different layout throws, because the
 * manifest every batch holds would no longer match the pixels.
 */
export function recolorSpriteAtlas(
  atlas: SpriteAtlas,
  sprites: readonly SpriteSheetDef[],
  palette: PaletteDef,
): void {
  const r = rasterize(sprites, palette);
  const img = atlas.texture.image as { data: Uint8Array; width: number; height: number };
  if (r.width !== img.width || r.height !== img.height || r.pixels.length !== img.data.length)
    throw new Error('render: recoloured atlas changed size');
  img.data.set(r.pixels);
  atlas.texture.needsUpdate = true;
}

export function createSpriteAtlas(
  sprites: readonly SpriteSheetDef[],
  palette: PaletteDef,
): SpriteAtlas {
  const packed = rasterize(sprites, palette);
  const texture = new DataTexture(
    packed.pixels,
    packed.width,
    packed.height,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  // Row 0 of the pixel buffer is the top of the atlas; keep it at v = 0 and flip in the UVs.
  texture.flipY = false;
  texture.needsUpdate = true;
  return { texture, manifest: packed.manifest, issues: packed.issues };
}
