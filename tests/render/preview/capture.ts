#!/usr/bin/env node
// Screenshot the M1 entity render on a fake world (AD, M1-05). Usage: npm run art:shot
// Starts Vite in mode "test" (no data watcher, so content/generated is never rewritten), opens
// tests/render/preview/index.html in headless Chromium, writes tests/out/render-preview-<w>x<h>.png,
// and fails on console or page errors. The server and browser are always closed.

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const PORT = 5199;
const SIZES: readonly (readonly [number, number])[] = [
  [1920, 1080],
  [1280, 720],
];

const server = await createServer({
  root: ROOT,
  mode: 'test',
  logLevel: 'warn',
  server: { port: PORT, strictPort: true, host: '127.0.0.1' },
});
await server.listen();
const browser = await chromium.launch();
const problems: string[] = [];
try {
  mkdirSync(resolve(ROOT, 'tests', 'out'), { recursive: true });
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await page.goto(`http://127.0.0.1:${PORT}/tests/render/preview/index.html`);
    await page.waitForFunction(() => window.__previewDone === true, undefined, { timeout: 30_000 });
    const out = resolve(ROOT, 'tests', 'out', `render-preview-${w}x${h}.png`);
    await page.screenshot({ path: out });
    console.log(`wrote ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (problems.length > 0) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
