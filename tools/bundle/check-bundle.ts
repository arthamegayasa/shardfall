#!/usr/bin/env node
// bundle:check (architecture.md 13): gzip size of every file in dist/ against the budget, and no test
// hooks in the production build (window.__shardfall, the hooks chunk). Run after `npm run build`.
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
const initial = initialFiles(readFileSync(indexPath, 'utf8'));

const fmt = (n: number): string => `${(n / KB).toFixed(1)} KB`;
let js = 0;
let total = 0;
let later = 0;
const errors: string[] = [];
const files = walk(dist).map((f) => relative(dist, f).replaceAll('\\', '/'));
for (const want of initial)
  if (!files.includes(want)) errors.push(`index.html loads ${want}, which is not in dist/`);
for (const rel of files) {
  if (rel.endsWith('.map') || rel.startsWith('.vite/')) continue;
  const buf = readFileSync(join(dist, rel));
  const gz = gzipSync(buf, { level: 9 }).length;
  const isInitial = initial.has(rel);
  const isWorker = /worker[^/]*\.js$/.test(rel);
  if (isInitial) {
    total += gz;
    if (rel.endsWith('.js')) js += gz;
  } else {
    later += gz;
  }
  const label = isInitial ? '' : isWorker ? '  (worker)' : '  (lazy)';
  console.log(`${fmt(gz).padStart(10)}  ${rel}${label}`);
  if (rel.endsWith('.js') || rel.endsWith('.html')) {
    const text = buf.toString('utf8');
    if (text.includes('__shardfall')) errors.push(`${rel} contains "__shardfall" (test hooks)`);
    if (/(^|\/)hooks-[^/]*\.js$/.test(rel)) errors.push(`${rel} is the e2e hooks chunk`);
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
