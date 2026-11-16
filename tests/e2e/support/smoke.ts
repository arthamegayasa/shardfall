// Browser smoke checklist (test-plan 11.2 items 1 to 4, 8, 9; M1-09b), shared by the per-browser
// spec files (a browser or channel can only be chosen at the top level of a spec file).
// Item 8 (D-5 hash vs Node): strict for V8 browsers (Chrome, Edge), recorded for Firefox and WebKit
// (architecture 4.2: determinism is guaranteed within one JS engine; others are reported).

import { writeFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EVIDENCE, boot, rawText, screen, send, snap, watchProblems } from './qa.ts';
import { nodeSim } from './node-sim.ts';

const DIRS: readonly (readonly [number, number])[] = [
  [127, 0],
  [90, 90],
  [0, 127],
  [-90, 90],
  [-127, 0],
  [-90, -90],
  [0, -127],
  [90, -90],
];

export async function runSmoke(
  page: Page,
  label: string,
  opts: { strictHash: boolean },
): Promise<void> {
  const problems = watchProblems(page);
  const log: string[] = [`browser ${label} ${page.context().browser()?.version() ?? ''}`];
  const t0 = Date.now();
  // Viewport 1280x720 comes from playwright.config.ts. page.setViewportSize hangs in Playwright
  // Firefox 157 on this Windows machine (QA M1-09b), so the smoke never resizes.
  await boot(page);
  // 1. Title, no console errors, WebGL2.
  await expect.poll(() => screen(page)).toBe('title');
  const webgl2 = await page.evaluate(
    () => document.createElement('canvas').getContext('webgl2') !== null,
  );
  log.push(`1 title in ${Date.now() - t0} ms, webgl2 ${webgl2}`);
  expect(webgl2).toBe(true);
  await page.screenshot({ path: `${EVIDENCE}/smoke-title-${label}.png` });
  // 2. First input unlocks audio; no errors follow. 3. Menu keys.
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('class-select');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('pulse');
  // 3. Movement and Rite with real keys.
  const p0 = (await snap(page)).player;
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  const p1 = (await snap(page)).player;
  log.push(`3 KeyD moved ${(p1.x - p0.x).toFixed(2)} u`);
  expect(p1.x).toBeGreaterThan(p0.x);
  await expect(page.locator('.rite')).toHaveClass(/is-ready/, { timeout: 5000 });
  await page.keyboard.press('Space');
  await expect(page.locator('.rite')).not.toHaveClass(/is-ready/, { timeout: 2000 });
  // Pause and resume with Esc.
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('pause');
  const tp = (await snap(page)).tick;
  await page.waitForTimeout(800);
  expect((await snap(page)).tick).toBe(tp);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('pulse');
  // 9. fps sanity over 5 s of a normal Pulse (indicative only).
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        let last = performance.now();
        const end = last + 5000;
        const f = (now: number): void => {
          out.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(f);
          else resolve(out.slice(1));
        };
        requestAnimationFrame(f);
      }),
  );
  const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
  log.push(`9 fps over 5 s of Pulse 1: ${(1000 / avg).toFixed(1)} (${frames.length} frames)`);
  // 4. The rest of Pulse 1 at 4x speed until the Glazier; buy one item (Glint topped up), begin Pulse 2.
  await page.evaluate(() => {
    window.__shardfall?.setTimeScale(4);
  });
  for (let i = 0; i < 400; i++) {
    const s = await snap(page);
    if (s.phase === 'shop' || s.phase === 'defeat') break;
    if (s.phase === 'levelUp') {
      await page.waitForTimeout(350);
      await page.keyboard.press('Digit1');
    }
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => {
    window.__shardfall?.setTimeScale(1);
  });
  const atShop = await snap(page);
  log.push(`4 after Pulse 1: phase ${atShop.phase}, glint ${atShop.glint}, hp ${atShop.hp}`);
  expect(atShop.phase).toBe('shop');
  await expect.poll(() => screen(page)).toBe('glazier');
  await send(page, { type: 'debug.glint', amount: 100 });
  await page.waitForTimeout(450);
  const g0 = (await snap(page)).glint;
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await snap(page)).glint).toBeLessThan(g0);
  await page.screenshot({ path: `${EVIDENCE}/smoke-glazier-${label}.png` });
  expect(await rawText(page)).toEqual([]);
  await page.keyboard.press('KeyB');
  await expect.poll(async () => (await snap(page)).pulseIndex).toBe(1);
  expect((await snap(page)).phase).toBe('pulse');
  log.push('4 bought one item with Digit1, Pulse 2 started with B');
  // 8. D-5 hash against Node for a 1200-tick scripted run.
  const browserRun = await page.evaluate((dirs) => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    h.pauseLoop();
    h.startRun({ seed: 42, classId: 'lantern' });
    const cps: string[] = [];
    for (let t = 0; t < 1200; t++) {
      const d = dirs[Math.floor(t / 30) % dirs.length] ?? [0, 0];
      h.step(1, {
        moveX: d[0],
        moveY: d[1],
        held: 0,
        pressed: t % 240 === 120 ? 1 : 0,
        aimX: 0,
        aimY: 0,
      });
      if ((t + 1) % 60 === 0) cps.push(h.getStateHash());
    }
    return cps;
  }, DIRS);
  const node = nodeSim('script', '42', '1200');
  const nodeCps = node['checkpoints'] as string[];
  const firstDiff = browserRun.findIndex((h, i) => h !== nodeCps[i]);
  log.push(
    `8 D-5 vs Node: ${firstDiff < 0 ? 'identical (20 checkpoints)' : `first difference at checkpoint ${firstDiff + 1} (tick ${(firstDiff + 1) * 60})`}`,
  );
  log.push(`problems: ${JSON.stringify(problems)}`);
  writeFileSync(`${EVIDENCE}/smoke-${label}.txt`, `${log.join('\n')}\n`);
  console.log(log.join('\n'));
  if (opts.strictHash) expect(firstDiff, 'D-5 hash vs Node').toBe(-1);
  expect(problems).toEqual([]);
}
