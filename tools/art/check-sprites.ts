#!/usr/bin/env node
// Validate every sprite and tile source with the runtime rasterizer (src/core/sprite), then write the
// preview sheet and a review atlas. Usage: node tools/art/check-sprites.ts [--no-preview]
// Checks: palette side per faction (P2-d), size range per class, Kept highlight ratio >= 15%, unknown
// chars, unequal rows, frame fit, kebab-case and unique ids, and the M1 sprite set (art-pipeline 2.1).
// Outputs: art/atlas/preview/sprites.png (colour, silhouette, grayscale), atlas.png + atlas.json.

import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { compileSprite, packAtlas } from '../../src/core/index.ts';
import type { CompiledSprite } from '../../src/core/index.ts';
import { loadAllSprites, loadPalette, ROOT } from './lib/load.ts';
import { writePng } from './lib/png.ts';
import { renderSheet } from './lib/preview.ts';

/** Sprites the M1 renderer needs (art-pipeline 2.1). A missing id fails the check. */
const REQUIRED_M1: readonly string[] = [
  'kept-lantern',
  'unlit-swarmer',
  'unlit-charger',
  'unlit-shooter',
  'unlit-tank',
  'warden-hound',
  'boss-lantern',
  'fx-shot-kept',
  'fx-shot-lantern-bolt',
  'fx-shot-splinter-shot',
  'fx-shot-arc-blade',
  'fx-shot-orbit-shards',
  'fx-shot-chain-spark',
  'fx-shot-returning-glaive',
  'fx-shot-danger',
  'fx-glint',
  'fx-burn',
  'fx-spawn-crack',
  'fx-digits',
  'tile-floor',
];

/** Animations the renderer looks up by name (src/render/sprites). */
const REQUIRED_ANIMS: Readonly<Record<string, readonly string[]>> = {
  'kept-lantern': ['idle', 'walk'],
  'fx-digits': ['normal', 'crit'],
  'fx-spawn-crack': ['grow'],
};

const palette = loadPalette();
const all = await loadAllSprites();
const ids = new Set<string>();
let failed = 0;
const compiled: { c: CompiledSprite; tile: boolean }[] = [];
for (const { file, src, tile } of all) {
  const c = compileSprite(src, palette);
  const issues = [...c.issues];
  if (ids.has(src.id)) issues.push(`${src.id}: duplicate id`);
  ids.add(src.id);
  const fileId = file.replaceAll('\\', '/').split('/').pop()?.replace(/\.(json|ts)$/, '');
  if (fileId !== src.id) issues.push(`${src.id}: file name must equal id (${fileId ?? ''})`);
  for (const a of REQUIRED_ANIMS[src.id] ?? [])
    if (src.animations[a] === undefined) issues.push(`${src.id}: missing animation "${a}"`);
  compiled.push({ c, tile });
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const hl =
    src.faction === 'kept' ? ` highlight ${(c.stats.highlightRatio * 100).toFixed(1)}%` : '';
  if (issues.length > 0) {
    failed++;
    console.log(`FAIL ${src.id} (${rel})`);
    for (const i of issues) console.log(`  - ${i}`);
  } else {
    const frames = Object.values(src.animations).reduce((n, a) => n + a.frames.length, 0);
    console.log(
      `ok   ${src.id.padEnd(26)} ${src.class.padEnd(18)} h=${String(c.stats.height).padStart(3)}px f=${String(frames).padStart(2)}${hl}`,
    );
  }
}
for (const id of REQUIRED_M1)
  if (!ids.has(id)) {
    failed++;
    console.log(`FAIL missing M1 sprite "${id}"`);
  }

if (!process.argv.includes('--no-preview') && failed === 0) {
  const dir = join(ROOT, 'art', 'atlas', 'preview');
  const actors = compiled
    .filter((x) => !x.tile && x.c.src.class !== 'boss')
    .map((x) => x.c);
  const sheet = renderSheet(actors, palette);
  writePng(join(dir, 'sprites.png'), sheet.w, sheet.h, sheet.data);
  const packed = packAtlas(
    compiled.filter((x) => !x.tile).map((x) => x.c),
    palette,
  );
  writePng(join(dir, 'atlas.png'), packed.width, packed.height, packed.pixels);
  writeFileSync(join(dir, 'atlas.json'), JSON.stringify(packed.manifest, null, 1) + '\n');
  console.log(
    `preview: art/atlas/preview/ (sprites.png, atlas.png ${packed.width}x${packed.height}, atlas.json)`,
  );
}

console.log(`${compiled.length} sprites, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
