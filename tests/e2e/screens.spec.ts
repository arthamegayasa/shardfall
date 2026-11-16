// Screenshot set per screen (test-plan 7.4, M1-08) at 1920x1080 and 1280x720, plus a layout scan
// (clipped, offscreen, overlapping text; A-05 step 2) and a raw-key scan on every screen.
// States come from goToScreen and spawnStress (architecture 6.12), seed fixed by the hooks.
// Files: docs/qa/evidence/M1/<screen>-<w>x<h>-chromium.png, findings in screens-layout-<w>x<h>.json.

import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  EVIDENCE,
  boot,
  focused,
  layoutIssues,
  rawText,
  screen,
  snap,
  step,
  watchProblems,
} from './support/qa.ts';
import type { LayoutIssue } from './support/qa.ts';

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
] as const;

type Target =
  | 'title'
  | 'class-select'
  | 'pulse'
  | 'level-up'
  | 'glazier'
  | 'pause'
  | 'settings'
  | 'run-lost'
  | 'run-won'
  | 'warden-reward'
  | 'credits'
  | 'confirm';

for (const size of SIZES) {
  test(`screenshot set ${size.width}x${size.height}`, async ({ page, browserName }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(size);
    const problems = watchProblems(page);
    const findings: Record<string, LayoutIssue[] | string[]> = {};
    await boot(page);
    await page.evaluate(() => {
      window.__shardfall?.pauseLoop();
    });
    const tag = `${size.width}x${size.height}-${browserName}`;
    const capture = async (name: string): Promise<void> => {
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${EVIDENCE}/${name}-${tag}.png` });
      const raw = await rawText(page);
      if (raw.length > 0) findings[`${name}:raw`] = raw;
      expect.soft(raw, `raw keys on ${name}`).toEqual([]);
      const issues = await layoutIssues(page);
      if (issues.length > 0) findings[name] = issues;
    };
    const go = async (id: Target, name: string = id): Promise<void> => {
      await page.evaluate((s) => window.__shardfall?.goToScreen(s), id);
      await capture(name);
    };

    await go('title');
    await go('class-select');
    await go('pulse', 'pulse-start');
    await step(page, 120, { moveX: 60 });
    // pulse-peak: the stress scene (last normal Pulse composition and a late build), 1 s in.
    await page.evaluate(() => {
      const h = window.__shardfall;
      h?.spawnStress('peak');
      h?.step(60);
    });
    const peak = await snap(page);
    findings['pulse-peak:counts'] = [JSON.stringify(peak.counts)];
    await capture('pulse-peak');
    await go('level-up');
    // Temper by keyboard focus: ArrowDown to the second card, Enter picks it (input lock 300 ms).
    expect(await focused(page)).toBe('temper-card-1');
    await page.waitForTimeout(350);
    await page.keyboard.press('ArrowDown');
    expect(await focused(page)).toBe('temper-card-2');
    const lv = (await snap(page)).phase;
    await page.keyboard.press('Enter');
    await step(page, 1);
    expect(lv).toBe('levelUp');
    expect((await snap(page)).phase).not.toBe('levelUp');
    await go('glazier');
    await go('pause');
    // Confirm dialog through the keyboard (goToScreen('confirm') fails, BUG-004): Abandon Run, Enter.
    for (let i = 0; i < 4 && (await focused(page)) !== 'pause-abandon'; i++)
      await page.keyboard.press('ArrowDown');
    expect(await focused(page)).toBe('pause-abandon');
    await page.keyboard.press('Enter');
    await step(page, 0);
    expect(await screen(page)).toBe('confirm');
    await capture('confirm');
    await page.keyboard.press('Escape');
    await step(page, 0);
    expect(await screen(page)).toBe('pause');
    await go('settings');
    // Every settings tab (Tab cycles focus groups; arrows move inside the tab row).
    for (const tab of ['audio', 'controls', 'accessibility']) {
      const el = page.locator(`[data-ui="settings-tab-${tab}"]`);
      if ((await el.count()) === 0) continue;
      await el.focus();
      await page.keyboard.press('Enter');
      await capture(`settings-${tab}`);
    }
    await go('warden-reward');
    await go('run-lost');
    await go('run-won');
    await go('credits');
    expect(await screen(page)).toBe('credits');

    writeFileSync(
      `${EVIDENCE}/screens-layout-${size.width}x${size.height}.json`,
      `${JSON.stringify(findings, null, 2)}\n`,
    );
    expect(problems).toEqual([]);
  });
}

test('stress: peak enemy count, live loop, frame time (Chromium headless: indicative only)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const problems = watchProblems(page);
  await boot(page);
  const results: Record<string, unknown> = {
    browserName,
    headless: test.info().project.use.headless ?? true,
  };
  for (const preset of ['peak', 'peak-boss'] as const) {
    await page.evaluate((p) => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      h.pauseLoop();
      h.startRun({ seed: 5, classId: 'lantern' });
      h.step(1);
      h.spawnStress(p);
      h.resumeLoop();
    }, preset);
    // The late build clears the one-shot stress spawn within seconds, so the test tops the Unlit up
    // to the architecture 13 peak (120 enemies) every 200 ms with debug.spawn and keeps HP full.
    // Warm up 3 s, then measure 10 s with an independent rAF frame-time recorder (inside the 20 s Pulse 1).
    const counts: number[] = [];
    const topUp = async (): Promise<void> => {
      await page.evaluate((target) => {
        const h = window.__shardfall;
        const s = h?.getSnapshot();
        if (h === undefined || s === undefined || s.phase !== 'pulse') return;
        h.send({ type: 'debug.setHp', hp: s.maxHp });
        const ids = ['swarmer', 'swarmer', 'charger', 'shooter', 'tank'];
        for (let k = s.counts.enemies; k < target; k++) {
          const a = (k * 0.618) % 1;
          h.send({
            type: 'debug.spawn',
            enemyId: ids[k % ids.length] ?? 'swarmer',
            x: Math.cos(a * 6.283) * 11,
            y: Math.sin(a * 6.283) * 6.5,
            count: 1,
          });
        }
      }, 120);
    };
    const t0 = Date.now();
    while (Date.now() - t0 < 3000) {
      await topUp();
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => {
      const w = window as unknown as { __qaFrames: number[]; __qaOn: boolean };
      w.__qaFrames = [];
      w.__qaOn = true;
      let last = performance.now();
      const tick = (now: number): void => {
        if (!w.__qaOn) return;
        w.__qaFrames.push(now - last);
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    while (Date.now() - t0 < 13_000) {
      await topUp();
      counts.push((await snap(page)).counts.enemies);
      await page.waitForTimeout(200);
    }
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __qaFrames: number[]; __qaOn: boolean };
      w.__qaOn = false;
      return w.__qaFrames.slice(1);
    });
    const perf = await page.evaluate(() => window.__shardfall?.getPerf());
    const s = await snap(page);
    await page.screenshot({
      path: `${EVIDENCE}/stress-${preset}-1920x1080-${browserName}${process.env['QA_HEADED'] === '1' ? '-headed' : ''}.png`,
    });
    const sorted = [...frames].sort((a, b) => a - b);
    const pct = (p: number): number =>
      sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] ?? 0;
    const avg = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
    results[preset] = {
      phase: s.phase,
      enemiesMin: Math.min(...counts),
      enemiesAvg: Number(
        (counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length)).toFixed(1),
      ),
      enemiesMax: Math.max(...counts),
      countsEnd: s.counts,
      frames: sorted.length,
      frameMs: {
        avg: Number(avg.toFixed(2)),
        p95: Number(pct(0.95).toFixed(2)),
        p99: Number(pct(0.99).toFixed(2)),
        max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
      },
      fpsAvg: Number((1000 / Math.max(0.001, avg)).toFixed(1)),
      perfHook: perf,
    };
    console.log(`[stress ${preset}] ${JSON.stringify(results[preset])}`);
    expect(s.phase).toBe('pulse');
    expect.soft(perf?.eventOverflow ?? -1, 'event overflow under stress').toBe(0);
  }
  writeFileSync(
    `${EVIDENCE}/stress-${browserName}${process.env['QA_HEADED'] === '1' ? '-headed' : ''}.json`,
    `${JSON.stringify(results, null, 2)}\n`,
  );
  expect(problems).toEqual([]);
});
