// Equivalence of the runtime rasterizer and packer (src/core/sprite) with AD's tool (tools/art/lib),
// over every sprite in art/ (architecture.md 10: "identical behaviour"; M0 review LP item 2).

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileSprite, frameToRgba, packAtlas } from '../../../src/core/index.ts';
import type { PaletteDef, SpriteSheetDef } from '../../../src/core/index.ts';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');

interface ToolFrame {
  readonly w: number;
  readonly h: number;
  readonly px: readonly (string | null)[];
  readonly outlineMask: Uint8Array;
}
interface ToolCompiled {
  readonly src: SpriteSheetDef;
  readonly anims: Record<string, { readonly frames: readonly ToolFrame[] }>;
  readonly issues: readonly string[];
  readonly stats: { readonly height: number; readonly highlightRatio: number };
}
interface ToolSpriteLib {
  readonly PALETTE: PaletteDef;
  compileSprite(src: SpriteSheetDef): ToolCompiled;
  frameToImage(f: ToolFrame): { w: number; h: number; data: Float32Array };
  loadAllSprites(): Promise<{ file: string; src: SpriteSheetDef }[]>;
}
interface ToolAtlasLib {
  packAtlas(compiled: readonly ToolCompiled[]): {
    image: { w: number; h: number; data: Float32Array };
    manifest: unknown;
  };
}

// Non-literal specifiers keep tsc from resolving the untyped .mjs tool modules.
const toolPath = (rel: string): string => pathToFileURL(join(ROOT, rel)).href;
const spriteLib = (await import(toolPath('tools/art/lib/sprite.mjs'))) as ToolSpriteLib;
const atlasLib = (await import(toolPath('tools/art/lib/atlas.mjs'))) as ToolAtlasLib;
const palette = spriteLib.PALETTE;
const sources = await spriteLib.loadAllSprites();

describe('sprite rasterizer port', () => {
  it('finds the AD sprite set', () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(readdirSync(join(ROOT, 'art', 'sprites')).length).toBeGreaterThan(0);
  });

  it.each(sources.map((s) => [s.src.id, s.src] as const))(
    'compiles %s exactly like the AD tool',
    (_id, src) => {
      const ours = compileSprite(src, palette);
      const theirs = spriteLib.compileSprite(src);
      expect(ours.issues).toEqual(theirs.issues);
      expect(ours.stats).toEqual(theirs.stats);
      expect(Object.keys(ours.anims)).toEqual(Object.keys(theirs.anims));
      for (const [name, anim] of Object.entries(ours.anims)) {
        const other = theirs.anims[name];
        expect(other).toBeDefined();
        anim.frames.forEach((f, i) => {
          const t = other?.frames[i];
          expect(t).toBeDefined();
          if (t === undefined) return;
          expect([f.w, f.h]).toEqual([t.w, t.h]);
          expect(f.px).toEqual(t.px);
          expect([...f.outlineMask]).toEqual([...t.outlineMask]);
          const img = spriteLib.frameToImage(t);
          const bytes = Array.from(img.data, (v) => Math.round(v * 255));
          expect([...frameToRgba(f, palette)]).toEqual(bytes);
        });
      }
    },
  );

  it('packs the atlas with the same layout, manifest, and pixels as the AD tool', () => {
    const notTiles = sources.filter((s) => s.src.class !== 'tile').map((s) => s.src);
    const ours = packAtlas(
      notTiles.map((s) => compileSprite(s, palette)),
      palette,
    );
    const theirs = atlasLib.packAtlas(notTiles.map((s) => spriteLib.compileSprite(s)));
    expect(JSON.parse(JSON.stringify(ours.manifest))).toEqual(theirs.manifest);
    expect([ours.width, ours.height]).toEqual([theirs.image.w, theirs.image.h]);
    const bytes = Array.from(theirs.image.data, (v) => Math.round(v * 255));
    expect([...ours.pixels]).toEqual(bytes);
  });
});
