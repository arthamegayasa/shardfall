#!/usr/bin/env node
// Validate every sprite and tile source with the runtime rasterizer (src/core/sprite), then write the
// preview sheets and review atlases. Usage: node tools/art/check-sprites.ts [--no-preview]
// Checks: palette side per faction (P2-d), size range per class, Kept highlight ratio >= 15%, unknown
// chars, unequal rows, frame fit, kebab-case and unique ids, the M2 sprite and animation set
// (art-pipeline 2.1), and the UI icon set derived from content/data (art-pipeline 12).
// Outputs in art/atlas/preview/: sprites.png (actors and effects: colour, silhouette, grayscale),
// boss.png, icons.png (icons and portrait at 4x), atlas.png + atlas.json (game atlas, icons excluded),
// icons-atlas.png + icons-atlas.json (UI icon atlas, same packer as src/core/sprite/icons.ts).
// --icons: validate only UI icons and always write icons.png (for icon work while actors are in flux).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildIconAtlas, compileSprite, isUiArt, packAtlas } from '../../src/core/index.ts';
import type { CompiledSprite, SpriteSheetDef } from '../../src/core/index.ts';
import { loadAllSprites, loadPalette, ROOT } from './lib/load.ts';
import { writePng } from './lib/png.ts';
import { renderSheet } from './lib/preview.ts';

/** Sprites the renderer needs (art-pipeline 2.1). A missing id fails the check. */
const REQUIRED: readonly string[] = [
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
  // M2 VFX (src/render/vfx).
  'fx-spark',
  'fx-trail',
  'fx-glint-trail',
  'fx-mote',
  'fx-shard',
  'fx-glass-shard',
  'fx-flare',
  'fx-ember',
  'fx-rise',
  'fx-star',
  'tile-floor',
];

/** Animations the renderer looks up by name (src/render/sprites). */
const REQUIRED_ANIMS: Readonly<Record<string, readonly string[]>> = {
  'kept-lantern': ['idle', 'walk', 'cast', 'hit'],
  'unlit-swarmer': ['idle', 'walk', 'windup'],
  'unlit-charger': ['idle', 'walk', 'windup'],
  'unlit-shooter': ['idle', 'walk', 'windup'],
  'unlit-tank': ['idle', 'walk', 'windup'],
  'warden-hound': ['idle', 'walk', 'windup', 'attack'],
  'boss-lantern': ['idle', 'idle2', 'windup', 'windup2'],
  'fx-digits': ['normal', 'crit'],
  'fx-spawn-crack': ['grow'],
};

/** Minimum frames per animation for the final M2 actors (m2-creative-brief 2). */
const MIN_FRAMES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'kept-lantern': { idle: 2, walk: 4, cast: 2, hit: 2 },
  'unlit-swarmer': { walk: 2, windup: 2 },
  'unlit-charger': { walk: 2, windup: 2 },
  'unlit-shooter': { walk: 2, windup: 2 },
  'unlit-tank': { walk: 2, windup: 2 },
  'warden-hound': { walk: 4, windup: 2 },
};

// ---- UI icons (art-pipeline 12): ids derived from content/data so new rows cannot go missing. ----

interface CsvRows {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

function readCsv(name: string): CsvRows {
  const lines = readFileSync(join(ROOT, 'content', 'data', name), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));
  const [head, ...rest] = lines;
  return { header: (head ?? '').split(','), rows: rest.map((l) => l.split(',')) };
}

function column(csv: CsvRows, name: string, tiers: readonly string[]): string[] {
  const ci = csv.header.indexOf(name);
  const ti = csv.header.indexOf('content_tier');
  const out: string[] = [];
  for (const r of csv.rows) {
    const v = r[ci];
    if (v === undefined || v === '') continue;
    if (ti >= 0 && !tiers.includes(r[ti] ?? '')) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const kebab = (s: string): string => s.replaceAll('_', '-');

/** Required icon ids and their expected frame (16 = card icon, 8 = inline icon, 48 = portrait). */
function requiredIcons(): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of column(readCsv('weapons.csv'), 'id', ['A', 'B']))
    m.set(`icon-weapon-${kebab(id)}`, 16);
  for (const id of column(readCsv('mementos.csv'), 'id', ['A', 'B']))
    m.set(`icon-memento-${kebab(id)}`, 16);
  for (const id of column(readCsv('rites.csv'), 'id', ['A', 'B'])) m.set(`icon-rite-${kebab(id)}`, 16);
  for (const id of column(readCsv('levelup.csv'), 'stat', ['A']))
    m.set(`icon-stat-${kebab(id)}`, 16);
  for (const id of column(readCsv('synergies.csv'), 'tag', ['A', 'B', 'C']))
    m.set(`icon-tag-${kebab(id)}`, 8);
  m.set('icon-glint', 8);
  m.set('icon-silt', 8);
  m.set('icon-portrait-glazier', 48);
  return m;
}

/** Icon rules: frame 16 (visible 12..16 px) or 8 (visible 5..8), portrait 48; ink outline; no team red. */
function iconIssues(src: SpriteSheetDef, c: CompiledSprite, expected: number | undefined): string[] {
  const out: string[] = [];
  if (src.outline !== 'ink') out.push(`${src.id}: icons use the ink outline`);
  if (src.faction !== 'kept' && src.faction !== 'neutral')
    out.push(`${src.id}: icon faction must be kept or neutral`);
  if (src.frameW !== src.frameH) out.push(`${src.id}: icon frame must be square`);
  if (expected !== undefined && src.frameW !== expected)
    out.push(`${src.id}: frame ${src.frameW} but this icon kind uses ${expected}`);
  const lo = src.frameW >= 48 ? 40 : src.frameW >= 16 ? 12 : 5;
  for (const [name, a] of Object.entries(c.anims))
    a.frames.forEach((f, i) => {
      if (Math.max(f.w, f.h) < lo)
        out.push(`${src.id}/${name}/${i}: visible ${f.w}x${f.h} is too small (min ${lo})`);
    });
  return out;
}

const iconsOnly = process.argv.includes('--icons');
const palette = loadPalette();
const all = (await loadAllSprites()).filter((s) => !iconsOnly || isUiArt(s.src));
const ids = new Set<string>();
const icons = requiredIcons();
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
  for (const [a, n] of Object.entries(MIN_FRAMES[src.id] ?? {})) {
    const got = src.animations[a]?.frames.length ?? 0;
    if (got < n) issues.push(`${src.id}: animation "${a}" has ${got} frames, needs ${n}`);
  }
  if (isUiArt(src)) issues.push(...iconIssues(src, c, icons.get(src.id)));
  else if (src.id.startsWith('icon-')) issues.push(`${src.id}: icon- ids use class icon or portrait`);
  compiled.push({ c, tile });
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const hl =
    src.faction === 'kept' && src.class === 'kept'
      ? ` highlight ${(c.stats.highlightRatio * 100).toFixed(1)}%`
      : '';
  if (issues.length > 0) {
    failed++;
    console.log(`FAIL ${src.id} (${rel})`);
    for (const i of issues) console.log(`  - ${i}`);
  } else {
    const frames = Object.values(src.animations).reduce((n, a) => n + a.frames.length, 0);
    console.log(
      `ok   ${src.id.padEnd(30)} ${src.class.padEnd(18)} h=${String(c.stats.height).padStart(3)}px f=${String(frames).padStart(2)}${hl}`,
    );
  }
}
for (const id of iconsOnly ? [] : REQUIRED)
  if (!ids.has(id)) {
    failed++;
    console.log(`FAIL missing sprite "${id}"`);
  }
for (const id of icons.keys())
  if (!ids.has(id)) {
    failed++;
    console.log(`FAIL missing UI icon "${id}"`);
  }

if (iconsOnly) {
  const ui = compiled.map((x) => x.c);
  const sheet = renderSheet(ui, palette, 4, 4, 12);
  writePng(join(ROOT, 'art', 'atlas', 'preview', 'icons.png'), sheet.w, sheet.h, sheet.data);
  console.log('preview: art/atlas/preview/icons.png');
} else if (!process.argv.includes('--no-preview') && failed === 0) {
  const dir = join(ROOT, 'art', 'atlas', 'preview');
  const game = compiled.filter((x) => !x.tile && !isUiArt(x.c.src)).map((x) => x.c);
  const sheet = renderSheet(
    game.filter((c) => c.src.class !== 'boss'),
    palette,
  );
  writePng(join(dir, 'sprites.png'), sheet.w, sheet.h, sheet.data);
  const boss = renderSheet(
    game.filter((c) => c.src.class === 'boss'),
    palette,
    2,
  );
  writePng(join(dir, 'boss.png'), boss.w, boss.h, boss.data);
  const ui = compiled.filter((x) => isUiArt(x.c.src)).map((x) => x.c);
  if (ui.length > 0) {
    const iconSheet = renderSheet(ui, palette, 4, 4, 12);
    writePng(join(dir, 'icons.png'), iconSheet.w, iconSheet.h, iconSheet.data);
  }
  const packed = packAtlas(game, palette);
  writePng(join(dir, 'atlas.png'), packed.width, packed.height, packed.pixels);
  writeFileSync(join(dir, 'atlas.json'), JSON.stringify(packed.manifest, null, 1) + '\n');
  const iconAtlas = buildIconAtlas(
    compiled.map((x) => x.c.src),
    palette,
  );
  writePng(join(dir, 'icons-atlas.png'), iconAtlas.width, iconAtlas.height, iconAtlas.pixels);
  writeFileSync(
    join(dir, 'icons-atlas.json'),
    JSON.stringify(iconAtlas.manifest, null, 1) + '\n',
  );
  console.log(
    `preview: art/atlas/preview/ (sprites.png, boss.png, icons.png, atlas.png ${packed.width}x${packed.height}, icons-atlas.png ${iconAtlas.width}x${iconAtlas.height})`,
  );
}

console.log(`${compiled.length} sprites, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
