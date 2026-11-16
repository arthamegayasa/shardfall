// Test helpers for src/render (AD): the real art set packed with the runtime packer, and a fake event reader.

import { compileSprite, packAtlas } from '../../src/core/index.ts';
import type { AtlasManifest, PaletteDef } from '../../src/core/index.ts';
import { loadAllSprites, loadPalette } from '../../tools/art/lib/load.ts';

export interface ArtFixture {
  readonly palette: PaletteDef;
  readonly manifest: AtlasManifest;
}

export async function loadArtFixture(): Promise<ArtFixture> {
  const palette = loadPalette();
  const sprites = (await loadAllSprites()).filter((s) => !s.tile).map((s) => s.src);
  const packed = packAtlas(
    sprites.map((s) => compileSprite(s, palette)),
    palette,
  );
  return { palette, manifest: packed.manifest };
}

export { NO_EVENTS } from './fake-scene.ts';
