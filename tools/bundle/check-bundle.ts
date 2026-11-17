#!/usr/bin/env node
// bundle:check (architecture.md 13): gzip size of every file in dist/ against the budget, and no test
// hooks in the production build (window.__shardfall, the hooks chunk). Run after `npm run build`.
// Release checks (M5-01): no source maps, no unreplaced build constants, the /shardfall/ base path
// for the GitHub Pages build, and the third-party license notices next to the page.
// Usage: node tools/bundle/check-bundle.ts [distDir]
//
// Initial files are the ones index.html loads itself (module script, modulepreload, stylesheet).
// Everything else is fetched later: dynamic-import chunks (audio, Indonesian strings) and Web Worker
// scripts. They are listed and summed apart and never count toward the first page (LP M2-09).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
/** Initial JavaScript including three.js: target 300 KB, CI fail 400 KB. */
const JS_TARGET = 300 * KB;
const JS_FAIL = 400 * KB;
/** Total first page transfer: target 400 KB, fail 600 KB. */
const TOTAL_TARGET = 400 * KB;
const TOTAL_FAIL = 600 * KB;

const root = resolve(import.meta.dirname, '..', '..');
const dist = resolve(root, process.argv[2] ?? 'dist');
/** The release build (dist/) is served from GitHub Pages under this path (vite.config.ts base). */
const PAGES_BASE = '/shardfall/';
const isRelease = relative(root, dist) === 'dist';
/** Build-time constants that vite.config.ts `define` must replace everywhere. */
const BUILD_CONSTANTS = ['__E2E__', '__DEV_TOOLS__', '__APP_VERSION__'];
if (!existsSync(dist)) {
  console.error(`bundle:check: ${relative(root, dist)} does not exist; run npm run build first`);
  process.exit(1);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** dist-relative paths index.html loads directly (src and href of script and link tags). */
function initialFiles(html: string): Set<string> {
  const out = new Set<string>(['index.html']);
  const tag = /<(script|link)\b[^>]*>/gi;
  for (const m of html.matchAll(tag)) {
    const t = m[0];
    if (m[1]?.toLowerCase() === 'link' && !/rel=["']?(stylesheet|modulepreload)/i.test(t)) continue;
    const url = /(?:src|href)=["']([^"']+)["']/i.exec(t)?.[1];
    if (url === undefined || url.startsWith('data:') || /^[a-z]+:\/\//i.test(url)) continue;
    // Strip the deploy base (/shardfall/ or /) so the path is relative to dist/.
    const i = url.indexOf('assets/');
    out.add(i >= 0 ? url.slice(i) : url.replace(/^\.?\//, ''));
  }
  return out;
}

const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  console.error('bundle:check: dist/index.html missing');
  process.exit(1);
}
const indexHtml = readFileSync(indexPath, 'utf8');
const initial = initialFiles(indexHtml);

const fmt = (n: number): string => `${(n / KB).toFixed(1)} KB`;
let js = 0;
let total = 0;
let later = 0;
const errors: string[] = [];
const files = walk(dist).map((f) => relative(dist, f).replaceAll('\\', '/'));
for (const want of initial)
  if (!files.includes(want)) errors.push(`index.html loads ${want}, which is not in dist/`);
if (isRelease) {
  for (const m of indexHtml.matchAll(/(?:src|href)=["'](\/[^"']*)["']/gi)) {
    const url = m[1] ?? '';
    if (!url.startsWith(PAGES_BASE)) errors.push(`index.html loads ${url} outside ${PAGES_BASE}`);
  }
  if (!files.includes('third-party-licenses.txt'))
    errors.push('third-party-licenses.txt missing (vite.config.ts thirdPartyLicenses)');
}
for (const rel of files) {
  if (rel.endsWith('.map')) {
    if (isRelease) errors.push(`${rel}: source maps are not published in the release build`);
    continue;
  }
  if (rel.startsWith('.vite/')) continue;
  if (/(^|\/)(preview|hd2d)\.html$/.test(rel) || rel.includes('/dev/'))
    errors.push(`${rel} is a dev or test page`);
  const buf = readFileSync(join(dist, rel));
  const gz = gzipSync(buf, { level: 9 }).length;
  const isInitial = initial.has(rel);
  const isWorker = /worker[^/]*\.js$/.test(rel);
  const isCode = /\.(js|css|html)$/.test(rel);
  if (isInitial) {
    total += gz;
    if (rel.endsWith('.js')) js += gz;
  } else if (isCode) {
    later += gz;
  }
  const label = isInitial ? '' : isWorker ? '  (worker)' : isCode ? '  (lazy)' : '  (file)';
  console.log(`${fmt(gz).padStart(10)}  ${rel}${label}`);
  if (rel.endsWith('.js') || rel.endsWith('.html')) {
    const text = buf.toString('utf8');
    if (text.includes('__shardfall')) errors.push(`${rel} contains "__shardfall" (test hooks)`);
    if (/(^|\/)hooks-[^/]*\.js$/.test(rel)) errors.push(`${rel} is the e2e hooks chunk`);
    if (isRelease && text.includes('sourceMappingURL')) errors.push(`${rel} links a source map`);
    for (const c of BUILD_CONSTANTS)
      if (text.includes(c)) errors.push(`${rel} contains the unreplaced build constant ${c}`);
  }
}
console.log(`initial JS gzip ${fmt(js)} (target ${fmt(JS_TARGET)}, fail ${fmt(JS_FAIL)})`);
console.log(`first page gzip ${fmt(total)} (target ${fmt(TOTAL_TARGET)}, fail ${fmt(TOTAL_FAIL)})`);
console.log(`lazy chunks and workers gzip ${fmt(later)} (loaded after the first page)`);
if (js > JS_FAIL) errors.push(`initial JS ${fmt(js)} is above ${fmt(JS_FAIL)}`);
if (total > TOTAL_FAIL) errors.push(`first page ${fmt(total)} is above ${fmt(TOTAL_FAIL)}`);
if (js > JS_TARGET) console.log(`WARN  initial JS above the ${fmt(JS_TARGET)} target`);
for (const e of errors) console.error(`ERROR ${e}`);
process.exit(errors.length === 0 ? 0 : 1);
