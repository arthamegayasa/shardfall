// Art data loader (architecture.md 5, 10): the only importer of art/**, through import.meta.glob.
// Sprites are data (JSON grids or TS generators), rasterized at boot by src/core/sprite.

import { assert } from '../core/index.ts';
import type { PaletteDef, SpriteSheetDef } from '../core/index.ts';
import type { RenderAssets } from '../core/dom.ts';

const paletteModules = import.meta.glob('../../art/palette.json', {
  eager: true,
  import: 'default',
});
const spriteJson = import.meta.glob('../../art/sprites/*.json', { eager: true, import: 'default' });
const spriteGenerators = import.meta.glob(
  ['../../art/sprites/*.ts', '!../../art/sprites/*-types.ts'],
  {
    eager: true,
    import: 'default',
  },
);
const tileJson = import.meta.glob('../../art/tiles/*.json', { eager: true, import: 'default' });

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Boundary check: AD data is trusted for detail (art:check validates it) but must have the basic shape. */
function asSprite(path: string, v: unknown): SpriteSheetDef {
  assert(
    isRecord(v) &&
      typeof v['id'] === 'string' &&
      isRecord(v['animations']) &&
      typeof v['frameW'] === 'number',
    `${path}: not a SpriteSheetDef`,
  );
  return v as unknown as SpriteSheetDef;
}

function asPalette(v: unknown): PaletteDef {
  assert(
    isRecord(v) && isRecord(v['core']) && isRecord(v['groups']) && Array.isArray(v['biomes']),
    'art/palette.json: bad shape',
  );
  return v as unknown as PaletteDef;
}

function sorted(mods: Record<string, unknown>): [string, unknown][] {
  return Object.entries(mods).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function loadArtAssets(): RenderAssets {
  const palette = asPalette(Object.values(paletteModules)[0]);
  const sprites = [...sorted(spriteJson), ...sorted(spriteGenerators)].map(([p, v]) =>
    asSprite(p, v),
  );
  const tiles = sorted(tileJson).map(([p, v]) => asSprite(p, v));
  return { palette, sprites, tiles };
}
