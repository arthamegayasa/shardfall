// QA determinism across runtimes (test-plan 5.3, architecture 14.1; M1-09b).
// D-5: the same scripted run (seed, input per tick) in Chromium through the e2e hooks and in a fresh
//      Node process (tests/unit/qa/support/sim-cli.ts) gives identical checkpoint hashes.
// D-8: a run recorded in the browser from live keyboard input (the app's replay recorder) plays back
//      in Node with every checkpoint matching.

import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { EVIDENCE, boot, watchProblems } from './support/qa.ts';
import { nodeSim, replayInNode } from './support/node-sim.ts';

/** Same script as tests/unit/qa/support/scripted-run.ts; a drift shows up as a hash mismatch. */
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
const TICKS = 3600;
const SEED = 42;

test('D-5: Chromium and Node give identical hashes for the same seed and input', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  const problems = watchProblems(page);
  await boot(page);
  const browser = await page.evaluate(
    ([dirs, ticks, seed]) => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      h.pauseLoop();
      h.startRun({ seed, classId: 'lantern' });
      const checkpoints: string[] = [];
      for (let t = 0; t < ticks; t++) {
        const d = dirs[Math.floor(t / 30) % dirs.length] ?? [0, 0];
        h.step(1, {
          moveX: d[0],
          moveY: d[1],
          held: 0,
          pressed: t % 240 === 120 ? 1 : 0,
          aimX: 0,
          aimY: 0,
        });
        if ((t + 1) % 60 === 0) checkpoints.push(h.getStateHash());
      }
      return { checkpoints, hash: h.getStateHash(), tick: h.getSnapshot().tick };
    },
    [DIRS, TICKS, SEED] as const,
  );
  const node = nodeSim('script', String(SEED), String(TICKS));
  writeFileSync(
    `${EVIDENCE}/d5-${browserName}.json`,
    `${JSON.stringify({ browser, node }, null, 1)}\n`,
  );
  expect(browser.tick).toBe(TICKS);
  expect(browser.checkpoints).toEqual(node['checkpoints']);
  expect(browser.hash).toBe(node['hash']);
  expect(problems).toEqual([]);
});

test('D-8: a browser run recorded from live keyboard input replays in Node', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = watchProblems(page);
  await boot(page);
  await page.evaluate(() => {
    window.__shardfall?.startRun({ seed: 9, classId: 'lantern' });
  });
  // Live loop, real keys: walk a square and cast the Rite, with a pause in the middle.
  for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW', 'KeyD']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(700);
    await page.keyboard.up(key);
    if (key === 'KeyS') await page.keyboard.press('Space');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  const rec = await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    h.pauseLoop();
    return { replay: h.exportReplay(), hash: h.getStateHash(), tick: h.getSnapshot().tick };
  });
  expect(rec.replay).not.toBeNull();
  expect(rec.tick).toBeGreaterThan(200);
  const { result } = replayInNode('d8-browser-keyboard', rec.replay);
  writeFileSync(
    `${EVIDENCE}/d8-keyboard.json`,
    `${JSON.stringify({ browserTick: rec.tick, browserHash: rec.hash, node: result }, null, 1)}\n`,
  );
  expect(result['mismatchAt']).toBe(-1);
  expect(result['ticks']).toBe(rec.tick);
  expect(result['finalHash']).toBe(rec.hash);
  expect(problems).toEqual([]);
});
