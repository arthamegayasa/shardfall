// Load art sources for the Node tools (architecture.md 5: tools read art/ JSON with fs, TS generators by import).
// Same file set and order as src/app/assets.ts: art/sprites/*.json, then art/sprites/*.ts generators, then tiles.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PaletteDef, SpriteSheetDef } from '../../../src/core/index.ts';

export const ROOT = resolve(import.meta.dirname, '..', '..', '..');

export interface LoadedSprite {
  readonly file: string;
  readonly src: SpriteSheetDef;
  /** true for art/tiles. */
  readonly tile: boolean;
}

export function loadPalette(): PaletteDef {
  return JSON.parse(readFileSync(join(ROOT, 'art', 'palette.json'), 'utf8')) as PaletteDef;
}

function list(dir: string, ext: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(ext) && !e.name.endsWith('-types.ts'))
    .map((e) => join(dir, e.name))
    .sort();
}

function isGenerator(v: unknown): v is { default: SpriteSheetDef } {
  return typeof v === 'object' && v !== null && 'default' in v;
}

export async function loadAllSprites(): Promise<LoadedSprite[]> {
  const spriteDir = join(ROOT, 'art', 'sprites');
  const tileDir = join(ROOT, 'art', 'tiles');
  const out: LoadedSprite[] = [];
  for (const f of list(spriteDir, '.json'))
    out.push({ file: f, src: JSON.parse(readFileSync(f, 'utf8')) as SpriteSheetDef, tile: false });
  for (const f of list(spriteDir, '.ts')) {
    const mod: unknown = await import(pathToFileURL(f).href);
    if (!isGenerator(mod)) throw new Error(`${f}: generator has no default export`);
    out.push({ file: f, src: mod.default, tile: false });
  }
  for (const f of list(tileDir, '.json'))
    out.push({ file: f, src: JSON.parse(readFileSync(f, 'utf8')) as SpriteSheetDef, tile: true });
  return out;
}
