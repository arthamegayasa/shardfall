// Smoke test (LP, M1-01; QA owns tests/e2e afterwards): the e2e build boots, the canvas renders,
// test hooks are installed, and the sim steps. Fails on console errors, page errors, failed requests.

import { expect, test } from '@playwright/test';

test('boots the e2e build, renders the canvas, and steps the sim', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));

  await page.goto('/');
  const canvas = page.locator('canvas#game');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-ready', '1');
  await page.waitForFunction(() => window.__shardfall !== undefined);

  const result = await page.evaluate(async () => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    await h.ready();
    h.pauseLoop();
    const before = h.getSnapshot().tick;
    h.startRun({ seed: 42, classId: 'lantern' });
    h.step(60, { moveX: 127 });
    return { version: h.version, before, snap: h.getSnapshot(), hash: h.getStateHash() };
  });
  expect(result.version).toBe(1);
  expect(result.snap.tick - result.before).toBe(60);
  expect(result.snap.phase).toBe('pulse');
  expect(result.hash).toMatch(/^[0-9a-f]{8}$/);

  await page.screenshot({ path: 'tests/out/smoke.png' });
  expect(problems).toEqual([]);
});
