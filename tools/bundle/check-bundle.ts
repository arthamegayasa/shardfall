#!/usr/bin/env node
// bundle:check (architecture.md 13): gzip size of every file in dist/ against the budget, and no test
// hooks in the production build (window.__shardfall, the hooks chunk). Run after `npm run build`.
// Usage: node tools/bundle/check-bundle.ts [distDir]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
/** Initial JavaScript including three.js and audio code: target 300 KB, CI fail 400 KB. */
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

const fmt = (n: number): string => `${(n / KB).toFixed(1)} KB`;
let js = 0;
let total = 0;
const errors: string[] = [];
for (const file of walk(dist)) {
  if (file.endsWith('.map')) continue;
  const buf = readFileSync(file);
  const gz = gzipSync(buf, { level: 9 }).length;
  const rel = relative(dist, file).replaceAll('\\', '/');
  // Lazy chunks (the Indonesian string table) are not part of the first page.
  const lazy = rel.includes('/id-') || rel.endsWith('id.json');
  if (!lazy) total += gz;
  if (rel.endsWith('.js') && !lazy) js += gz;
  console.log(`${fmt(gz).padStart(10)}  ${rel}${lazy ? '  (lazy)' : ''}`);
  if (rel.endsWith('.js') || rel.endsWith('.html')) {
    const text = buf.toString('utf8');
    if (text.includes('__shardfall')) errors.push(`${rel} contains "__shardfall" (test hooks)`);
    if (/(^|\/)hooks-[^/]*\.js$/.test(rel)) errors.push(`${rel} is the e2e hooks chunk`);
  }
}
console.log(`initial JS gzip ${fmt(js)} (target ${fmt(JS_TARGET)}, fail ${fmt(JS_FAIL)})`);
console.log(`first page gzip ${fmt(total)} (target ${fmt(TOTAL_TARGET)}, fail ${fmt(TOTAL_FAIL)})`);
if (js > JS_FAIL) errors.push(`initial JS ${fmt(js)} is above ${fmt(JS_FAIL)}`);
if (total > TOTAL_FAIL) errors.push(`first page ${fmt(total)} is above ${fmt(TOTAL_FAIL)}`);
if (js > JS_TARGET) console.log(`WARN  initial JS above the ${fmt(JS_TARGET)} target`);
for (const e of errors) console.error(`ERROR ${e}`);
process.exit(errors.length === 0 ? 0 : 1);
