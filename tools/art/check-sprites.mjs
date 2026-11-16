#!/usr/bin/env node
// Validate every sprite and tile source, then write the preview sheet and a review atlas.
// Usage: node tools/art/check-sprites.mjs [--no-preview]
// Checks: palette side per faction (P2-d), size range per class, Kept highlight ratio >= 15%, unknown chars,
// unequal rows, frame fit, kebab-case and unique ids. Exit code 1 when any sprite fails.
// Outputs: art/atlas/preview/sprites.png (colour, silhouette, grayscale), art/atlas/preview/atlas.png + atlas.json.
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadAllSprites, compileSprite, ROOT } from './lib/sprite.mjs';
import { renderSheet } from './lib/preview.mjs';
import { packAtlas } from './lib/atlas.mjs';
import { savePng } from './lib/image.mjs';

const all = await loadAllSprites();
const ids = new Set();
let failed = 0;
const compiled = [];
for (const { file, src } of all) {
  const c = compileSprite(src);
  if (ids.has(src.id)) c.issues.push(`${src.id}: duplicate id`);
  ids.add(src.id);
  compiled.push(c);
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const hl = src.faction === 'kept' ? ` highlight ${(c.stats.highlightRatio * 100).toFixed(1)}%` : '';
  if (c.issues.length) {
    failed++;
    console.log(`FAIL ${src.id} (${rel})`);
    for (const i of c.issues) console.log(`  - ${i}`);
  } else {
    console.log(`ok   ${src.id.padEnd(20)} ${src.class.padEnd(18)} h=${String(c.stats.height).padStart(3)}px${hl}`);
  }
}

if (!process.argv.includes('--no-preview') && failed === 0) {
  const dir = join(ROOT, 'art', 'atlas', 'preview');
  const actors = compiled.filter((c) => c.src.class !== 'tile' && c.src.class !== 'boss');
  savePng(join(dir, 'sprites.png'), renderSheet(actors, { scale: 4, frames: 'all' }));
  const { image, manifest } = packAtlas(compiled.filter((c) => c.src.class !== 'tile'));
  savePng(join(dir, 'atlas.png'), image);
  writeFileSync(join(dir, 'atlas.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`preview: art/atlas/preview/ (sprites.png, atlas.png ${manifest.width}x${manifest.height}, atlas.json)`);
}

console.log(`${compiled.length} sprites, ${failed} failing`);
process.exit(failed ? 1 : 0);
