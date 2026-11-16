#!/usr/bin/env node
// HD-2D screenshots and indicative frame times (LP, M2-02). Usage:
//   node tests/render/hd2d/capture.ts            screenshots (headless Chromium, GPU via ANGLE)
//   node tests/render/hd2d/capture.ts --perf     plus a headed 1920x1080 frame-time run per quality
// Starts Vite in mode "test" (no data watcher), opens tests/render/hd2d/index.html, writes
// tests/out/render/hd2d-*.png, and fails on console or page errors. Server and browser always close.
// Headless fps is not valid for the budget (architecture 13); the --perf run is headed and indicative.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const OUT = resolve(ROOT, 'tests', 'out', 'render');
const PORT = 5198;
const URL = `http://127.0.0.1:${String(PORT)}/tests/render/hd2d/index.html`;
const perfMode = process.argv.includes('--perf');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

type Quality = 'low' | 'medium' | 'high';
interface Shot {
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly quality: Quality;
  readonly scene: 'calm' | 'peak' | 'peak120' | 'boss' | 'danger' | 'k3' | 'occlude';
  readonly reduce?: boolean;
  readonly extraTicks?: number;
}

const SHOTS: readonly Shot[] = [
  { name: 'calm-1920x1080-high', w: 1920, h: 1080, quality: 'high', scene: 'calm', extraTicks: 90 },
  { name: 'calm-1280x720-high', w: 1280, h: 720, quality: 'high', scene: 'calm', extraTicks: 90 },
  { name: 'peak-1920x1080-high', w: 1920, h: 1080, quality: 'high', scene: 'peak' },
  { name: 'peak-1280x720-high', w: 1280, h: 720, quality: 'high', scene: 'peak' },
  { name: 'peak-1920x1080-medium', w: 1920, h: 1080, quality: 'medium', scene: 'peak' },
  { name: 'peak-1920x1080-low', w: 1920, h: 1080, quality: 'low', scene: 'peak' },
  { name: 'peak-1920x1080-reduce', w: 1920, h: 1080, quality: 'high', scene: 'peak', reduce: true },
  { name: 'boss-1920x1080-high', w: 1920, h: 1080, quality: 'high', scene: 'boss' },
  { name: 'peak120-1920x1080-high', w: 1920, h: 1080, quality: 'high', scene: 'peak120' },
  { name: 'k3-1280x720-high', w: 1280, h: 720, quality: 'high', scene: 'k3' },
  { name: 'occlude-1280x720-high', w: 1280, h: 720, quality: 'high', scene: 'occlude' },
];

const problems: string[] = [];

async function open(browser: Browser, w: number, h: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(URL);
  await page.waitForFunction(() => window.__hd2d !== undefined, undefined, { timeout: 30_000 });
  return page;
}

const server = await createServer({
  root: ROOT,
  mode: 'test',
  logLevel: 'warn',
  // No HMR or watching: other agents editing files must not reload the page mid-measurement.
  server: {
    port: PORT,
    strictPort: true,
    host: '127.0.0.1',
    hmr: false,
    watch: { ignored: ['**/*'] },
  },
});
await server.listen();
const lowPower = process.argv.includes('--low-power-gpu');
const args = [
  '--use-angle=d3d11',
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  ...(lowPower ? ['--force_low_power_gpu'] : []),
];
let browser = await chromium.launch({ args });
const perfResults: Record<string, unknown> = {};
try {
  mkdirSync(OUT, { recursive: true });
  for (const s of SHOTS) {
    if (only !== undefined && !s.name.includes(only)) continue;
    const page = await open(browser, s.w, s.h);
    const info = await page.evaluate((shot) => {
      const h = window.__hd2d;
      if (h === undefined) throw new Error('harness missing');
      h.setup({ quality: shot.quality, reduceEffects: shot.reduce ?? false });
      h.scene(shot.scene);
      if ((shot.extraTicks ?? 0) > 0) h.step(shot.extraTicks ?? 0);
      return { counts: h.counts(), stats: h.stats() };
    }, s);
    const out = resolve(OUT, `hd2d-${s.name}.png`);
    await page.screenshot({ path: out });
    console.log(`wrote ${out}  ${JSON.stringify(info)}`);
    await page.close();
  }
  // S-6 / LD-T03: DoF on vs off with everything else locked; compared by measure.py --dof.
  if (only === undefined || only === 'dof') {
    const page = await open(browser, 1920, 1080);
    await page.evaluate(() => {
      const h = window.__hd2d;
      if (h === undefined) throw new Error('harness missing');
      h.setup({ quality: 'high' });
      h.scene('peak');
      h.override({ glassGlint: false });
    });
    await page.screenshot({ path: resolve(OUT, 'hd2d-dof-on.png') });
    await page.evaluate(() => window.__hd2d?.override({ glassGlint: false, dof: false }));
    await page.screenshot({ path: resolve(OUT, 'hd2d-dof-off.png') });
    console.log('wrote hd2d-dof-on.png and hd2d-dof-off.png');
    await page.close();
  }
  if (perfMode) {
    await browser.close();
    browser = await chromium.launch({ args, headless: false });
    for (const q of ['medium', 'low', 'high'] as const) {
      const page = await open(browser, 1920, 1080);
      // P-REF (architecture 13): CPU throttled 2x through CDP.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
      const gpu = await page.evaluate(() => {
        const c = document.createElement('canvas').getContext('webgl2');
        const ext = c?.getExtension('WEBGL_debug_renderer_info');
        return ext ? String(c?.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
      });
      const r = await page.evaluate(async (quality) => {
        const h = window.__hd2d;
        if (h === undefined) throw new Error('harness missing');
        h.setup({ quality });
        h.scene('peak120');
        await h.perf(2); // warm-up
        const before = h.counts();
        // Pulse 1 ends after about 20 s of game time: measure inside it.
        const r = await h.perf(10);
        return { ...r, before, after: h.counts() };
      }, q);
      perfResults[q] = { ...r, gpu, cpuThrottle: 2 };
      console.log(`perf ${q}: ${JSON.stringify({ ...r, gpu })}`);
      await page.close();
    }
    writeFileSync(
      resolve(OUT, lowPower ? 'hd2d-perf-lowpower.json' : 'hd2d-perf.json'),
      `${JSON.stringify(perfResults, null, 2)}\n`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
if (problems.length > 0) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
