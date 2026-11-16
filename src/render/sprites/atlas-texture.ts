// Runtime sprite atlas: rasterize every sprite with src/core/sprite and upload one DataTexture
// (nearest, no mipmaps; architecture.md 7.6, 10). LP + AD.

import { DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';
import { compileSprite, packAtlas } from '../../core/index.ts';
import type { AtlasManifest, PaletteDef, SpriteSheetDef } from '../../core/index.ts';

export interface SpriteAtlas {
  readonly texture: DataTexture;
  readonly manifest: AtlasManifest;
  /** Issues reported by the rasterizer (sprites still render; art:check is the gate). */
  readonly issues: readonly string[];
}

export function createSpriteAtlas(
  sprites: readonly SpriteSheetDef[],
  palette: PaletteDef,
): SpriteAtlas {
  const compiled = sprites.map((s) => compileSprite(s, palette));
  const packed = packAtlas(compiled, palette);
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
  return { texture, manifest: packed.manifest, issues: compiled.flatMap((c) => c.issues) };
}
