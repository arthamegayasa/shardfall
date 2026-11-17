// QA M5 smoke of the production build (M5-04, test-plan 11.2 items 1 to 3 and 7 by keyboard): the
// real dist/ served by `vite preview` under the GitHub Pages base path, no e2e hooks. Opt-in: set
// QA_PROD_URL (for example http://127.0.0.1:4180/shardfall/) after starting
// `npx vite preview --outDir dist --base /shardfall/ --port 4180 --strictPort --host 127.0.0.1`.
// Every installed browser is launched from inside the test, so one run covers the matrix.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, expect, firefox, test, webkit } from '@playwright/test';
import type { Browser, BrowserType, Page } from '@playwright/test';
import { EVIDENCE } from './support/qa.ts';
import { GPU_ARGS } from './support/m3.ts';

const URL = process.env['QA_PROD_URL'] ?? '';
const OUT = `${EVIDENCE}/m5`;
mkdirSync(OUT, { recursive: true });

function webkitExe(): string | undefined {
  if (existsSync(webkit.executablePath())) return undefined;
  const cache = join(process.env['LOCALAPPDATA'] ?? '', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('webkit-'))
    .sort();
  const last = dirs[dirs.length - 1];
  const exe = last === undefined ? '' : join(cache, last, 'Playwright.exe');
  return existsSync(exe) ? exe : undefined;
}

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const wk = webkitExe();

interface Target {
  readonly name: string;
  readonly type: BrowserType;
  readonly options: Parameters<BrowserType['launch']>[0];
  readonly available: boolean;
}

const TARGETS: readonly Target[] = [
  { name: 'chromium-gpu', type: chromium, options: { args: GPU_ARGS }, available: true },
  { name: 'chrome', type: chromium, options: { channel: 'chrome' }, available: existsSync(CHROME) },
  {
    name: 'msedge',
    type: chromium,
    options: { channel: 'msedge' },
    available: EDGE.some((p) => existsSync(p)),
  },
  {
    name: 'firefox',
    type: firefox,
    options: {},
    available: existsSync(firefox.executablePath()),
  },
  {
    name: wk === undefined ? 'webkit' : 'webkit-fallback',
    type: webkit,
    options: wk === undefined ? {} : { executablePath: wk },
    available: existsSync(webkit.executablePath()) || wk !== undefined,
  },
];

async function screenId(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('#ui-root [data-screen]')?.dataset['screen'] ?? '',
  );
}

for (const target of TARGETS) {
  test(`M5 production build smoke: ${target.name}`, async () => {
    test.skip(URL === '', 'opt-in: set QA_PROD_URL to a vite preview of dist/');
    test.skip(!target.available, `${target.name} not installed`);
    test.setTimeout(120_000);
    const browser: Browser = await target.type.launch(target.options);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const problems: string[] = [];
    const requests: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning')
        problems.push(`console.${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));
    page.on('response', (res) => {
      requests.push(`${res.status()} ${res.url()}`);
      if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`);
    });
    const log: string[] = [`browser ${target.name} ${browser.version()}`, `url ${URL}`];
    const t0 = Date.now();
    await page.goto(URL);
    await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1', {
      timeout: 30_000,
    });
    await expect.poll(() => screenId(page)).toBe('title');
    log.push(`title in ${Date.now() - t0} ms`);
    const facts = await page.evaluate(() => ({
      hooks: '__shardfall' in window,
      webgl2: document.createElement('canvas').getContext('webgl2') !== null,
      title: document.title,
      foot: document.querySelector('[data-ui="title-foot"]')?.textContent.trim() ?? '',
    }));
    log.push(`facts ${JSON.stringify(facts)}`);
    await page.screenshot({ path: `${OUT}/prod-title-${target.name}.png` });
    // Keys only: New Run, first class, a few seconds of play, pause, resume.
    await page.keyboard.press('Enter');
    await expect.poll(() => screenId(page)).toBe('class-select');
    await page.keyboard.press('Enter');
    await expect.poll(() => screenId(page)).toBe('pulse');
    await page.waitForTimeout(1500);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyD');
    await page.keyboard.press('Space');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/prod-pulse-${target.name}.png` });
    await page.keyboard.press('Escape');
    await expect.poll(() => screenId(page)).toBe('pause');
    await page.keyboard.press('Escape');
    await expect.poll(() => screenId(page)).toBe('pulse');
    await page.waitForTimeout(1500);
    const base = new globalThis.URL(URL);
    const outside = requests.filter((r) => {
      const u = r.split(' ')[1] ?? '';
      return u.startsWith(base.origin) && !u.startsWith(URL);
    });
    log.push(`responses ${requests.length}, outside base path ${JSON.stringify(outside)}`);
    log.push(`problems ${JSON.stringify(problems)}`);
    writeFileSync(`${OUT}/prod-${target.name}.txt`, `${log.join('\n')}\n`);
    console.log(log.join('\n'));
    await browser.close();
    expect(facts.hooks, 'e2e hooks in the production bundle').toBe(false);
    expect(facts.webgl2).toBe(true);
    expect(outside).toEqual([]);
    expect(problems.filter((p) => !p.startsWith('console.warning'))).toEqual([]);
  });
}
