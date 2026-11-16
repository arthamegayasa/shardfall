// UI icon atlas (AD, M2-03): every required icon is packed, centred in its square frame, and cut into
// ImageData-compatible pixels at integer scales. Emissive texels are flagged in the game atlas alpha.

import { describe, expect, it } from 'vitest';
import {
  buildIconAtlas,
  compileSprite,
  iconImage,
  iconSpriteId,
  isUiArt,
  packAtlas,
} from '../../src/core/index.ts';
import { EMISSIVE_ALPHA_BYTE } from '../../src/render/shaders/index.ts';
import { markEmissive } from '../../src/render/sprites/atlas-texture.ts';
import { loadAllSprites, loadPalette } from '../../tools/art/lib/load.ts';

const palette = loadPalette();
const sprites = (await loadAllSprites()).map((s) => s.src);
const atlas = buildIconAtlas(sprites, palette);

describe('icon atlas', () => {
  it('packs only icons and portraits', () => {
    const ids = Object.keys(atlas.manifest.icons);
    expect(ids.length).toBe(sprites.filter(isUiArt).length);
    expect(ids.every((id) => id.startsWith('icon-'))).toBe(true);
  });

  it('covers the Tier A slice icons the UI asks for', () => {
    const need = [
      iconSpriteId('weapon', 'lantern_bolt'),
      iconSpriteId('weapon', 'returning_glaive'),
      iconSpriteId('memento', 'headsman_hook'),
      iconSpriteId('rite', 'flare_lantern'),
      iconSpriteId('stat', 'max_hp'),
      iconSpriteId('tag', 'flame'),
      'icon-glint',
      'icon-silt',
      'icon-portrait-glazier',
    ];
    for (const id of need) expect(atlas.manifest.icons[id], id).toBeDefined();
  });

  it('cuts a centred, scaled square image', () => {
    const id = iconSpriteId('weapon', 'lantern_bolt');
    const e = atlas.manifest.icons[id];
    const img = iconImage(atlas, id, 2);
    expect(e?.size).toBe(16);
    expect(img?.width).toBe(32);
    expect(img?.height).toBe(32);
    expect(img?.data.length).toBe(32 * 32 * 4);
    // Some opaque pixels, transparent margin where the icon does not reach.
    const alpha = Array.from({ length: 32 * 32 }, (_, i) => img?.data[i * 4 + 3] ?? 0);
    expect(alpha.some((a) => a === 255)).toBe(true);
    expect(alpha.every((a) => a === 0 || a === 255)).toBe(true);
    expect(iconImage(atlas, 'icon-nope')).toBeNull();
  });

  it('portrait is 48 px', () => {
    expect(atlas.manifest.icons['icon-portrait-glazier']?.size).toBe(48);
  });
});

describe('game atlas emissive flag', () => {
  it('marks emissive tokens with the emissive alpha and leaves others opaque', () => {
    const compiled = sprites.filter((s) => !isUiArt(s)).map((s) => compileSprite(s, palette));
    const packed = packAtlas(compiled, palette);
    const n = markEmissive(packed.pixels, packed.width, compiled, packed.manifest, palette);
    expect(n).toBeGreaterThan(0);
    // The enemy shot core (danger-core, palette emissive) glows; tile and Unlit body do not.
    const shot = packed.manifest.sprites['fx-shot-danger']?.animations['idle']?.frames[0];
    expect(shot).toBeDefined();
    if (shot === undefined) return;
    const cx = shot.x + Math.floor(shot.w / 2);
    const cy = shot.y + Math.floor(shot.h / 2);
    expect(packed.pixels[(cy * packed.width + cx) * 4 + 3]).toBe(EMISSIVE_ALPHA_BYTE);
    const alphas = new Set<number>();
    for (let i = 3; i < packed.pixels.length; i += 4) alphas.add(packed.pixels[i] ?? 0);
    expect([...alphas].sort((a, b) => a - b)).toEqual([0, EMISSIVE_ALPHA_BYTE, 255]);
  });
});
