// QA M3 performance (test-plan 9.3 and 9.4, PF-1, PF-2, PF-3, PF-7): busiest arena held at the
// architecture 13 peak (120 Unlit) in a 40 s Pulse, headed Chromium with a real GPU, per quality.
// Warm-up 5 s, measure 30 s with an independent rAF recorder plus getPerf().
// Opt-in (QA_PERF=1) because it runs headed for several minutes:
//   QA_PERF=1 npx playwright test tests/e2e/m3-perf.spec.ts                 P-DEV (discrete GPU)
//   QA_PERF=1 QA_PREF=1 npx playwright test tests/e2e/m3-perf.spec.ts       P-REF attempt: low-power
//     GPU flag plus 2x CPU throttling through CDP (the GPU actually used is logged, not assumed).

import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { snap, watchProblems } from './support/qa.ts';
import { GPU_ARGS, M3_OUT, advanceToPulse, bootWith, freshRun, gpuName } from './support/m3.ts';

const PREF = process.env['QA_PREF'] === '1';
test.skip(process.env['QA_PERF'] !== '1', 'opt-in: QA_PERF=1');
test.use({
  viewport: { width: 1920, height: 1080 },
  headless: false,
  launchOptions: { args: [...GPU_ARGS, ...(PREF ? ['--force_low_power_gpu'] : [])] },
});

const QUALITIES = ['low', 'medium', 'high'] as const;

for (const quality of QUALITIES) {
  test(`peak 120 Unlit, ${quality}${PREF ? ', P-REF attempt' : ', P-DEV'}`, async ({ page }) => {
    test.setTimeout(150_000);
    const problems = watchProblems(page);
    await bootWith(page, { graphics: { quality }, access: { reduceEffects: false } });
    if (PREF) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    }
    const gpu = await gpuName(page);
    const hz = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const t: number[] = [];
          const f = (n: number): void => {
            t.push(n);
            if (t.length < 61) requestAnimationFrame(f);
            else resolve(1000 / (((t[60] ?? 0) - (t[0] ?? 0)) / 60));
          };
          requestAnimationFrame(f);
        }),
    );
    // Pulse 11 (40 s, alive cap highest in run_b) with the stress build, then the live loop.
    await freshRun(page, 5);
    await advanceToPulse(page, 10);
    await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) return;
      h.spawnStress('peak');
      h.resumeLoop();
    });
    const ids = ['swarmer', 'swarmer', 'charger', 'shooter', 'tank', 'exploder', 'summoner'];
    const topUp = async (): Promise<void> => {
      await page.evaluate(
        ([target, list]) => {
          const h = window.__shardfall;
          const s = h?.getSnapshot();
          if (h === undefined || s === undefined || s.phase !== 'pulse') return;
          h.send({ type: 'debug.setHp', hp: s.maxHp });
          for (let k = s.counts.enemies; k < target; k++) {
            const a = (k * 0.618) % 1;
            h.send({
              type: 'debug.spawn',
              enemyId: list[k % list.length] ?? 'swarmer',
              x: Math.cos(a * 6.283) * 11,
              y: Math.sin(a * 6.283) * 6.5,
              count: 1,
            });
          }
        },
        [120, ids] as const,
      );
    };
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
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
    const counts: number[] = [];
    while (Date.now() - t0 < 35_000) {
      await topUp();
      const s = await snap(page);
      counts.push(s.counts.enemies);
      await page.waitForTimeout(200);
    }
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __qaFrames: number[]; __qaOn: boolean };
      w.__qaOn = false;
      return w.__qaFrames.slice(1);
    });
    const perf = await page.evaluate(() => window.__shardfall?.getPerf());
    const end = await snap(page);
    await page.screenshot({ path: `${M3_OUT}/perf-${quality}${PREF ? '-pref' : '-pdev'}.png` });
    const sorted = [...frames].sort((a, b) => a - b);
    const pct = (p: number): number =>
      sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] ?? 0;
    const avg = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
    const result = {
      quality,
      profile: PREF ? 'P-REF attempt (low-power GPU flag, CPU 2x)' : 'P-DEV',
      gpu,
      displayHz: Number(hz.toFixed(1)),
      phase: end.phase,
      pulse: end.pulseIndex + 1,
      enemies: {
        min: Math.min(...counts),
        avg: Number((counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)),
        max: Math.max(...counts),
      },
      countsEnd: end.counts,
      frames: sorted.length,
      frameMs: {
        avg: Number(avg.toFixed(2)),
        p95: Number(pct(0.95).toFixed(2)),
        p99: Number(pct(0.99).toFixed(2)),
        max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
      },
      fpsAvg: Number((1000 / avg).toFixed(1)),
      simTickMs: perf?.simTickMs,
      drawCalls: perf?.drawCalls,
      triangles: perf?.triangles,
      eventOverflow: perf?.eventOverflow,
      poolOverflow: perf?.poolOverflow,
    };
    console.log(`[m3-perf] ${JSON.stringify(result)}`);
    writeFileSync(
      `${M3_OUT}/perf-${quality}${PREF ? '-pref' : '-pdev'}.json`,
      `${JSON.stringify(result, null, 2)}\n`,
    );
    expect(end.phase).toBe('pulse');
    expect(problems).toEqual([]);
  });
}
