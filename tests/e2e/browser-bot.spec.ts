// E-13 (test-plan 7.3, M1-03 of 13.1; M1-09b): a browser bot plays whole runs with real key presses.
// It reads getSnapshot and getScreenPositions, holds W, A, S, D, presses Space for the Rite, digits
// for Temper, reward, and Glazier picks, and B to begin the next Pulse. setTimeScale(4) speeds up the
// live loop; there are no debug commands. Each finished run is exported and replayed in Node (D-8).

import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EVIDENCE, boot, snap, watchProblems } from './support/qa.ts';
import { replayInNode } from './support/node-sim.ts';

const TIME_SCALE = 4;
const SEEDS = [101, 202, 303];

async function playRun(
  page: Page,
  maxMs: number,
): Promise<{ log: string[]; phase: string; pulses: number }> {
  const log: string[] = [];
  let held = new Set<string>();
  const release = async (): Promise<void> => {
    for (const k of held) await page.keyboard.up(k);
    held = new Set();
  };
  const t0 = Date.now();
  let lastPhase = '';
  let maxPulse = 0;
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      const offers = Array.from(document.querySelectorAll('[data-ui^="shop-offer-"]')).map(
        (e) => !e.className.includes('is-unaffordable') && !e.className.includes('card-empty'),
      );
      const ready = document.querySelector('.rite')?.classList.contains('is-ready') ?? false;
      const c = document.querySelector('canvas#game')?.getBoundingClientRect();
      return {
        s: h.getSnapshot(),
        p: h.getScreenPositions(),
        offers,
        ready,
        cx: (c?.width ?? 0) / 2,
        cy: (c?.height ?? 0) / 2,
      };
    });
    const { s } = st;
    maxPulse = Math.max(maxPulse, s.pulseIndex + 1);
    if (s.phase !== lastPhase) {
      log.push(
        `${((Date.now() - t0) / 1000).toFixed(1)}s pulse ${s.pulseIndex + 1} ${s.phase} hp ${s.hp}/${s.maxHp} glint ${s.glint} lv ${s.level}`,
      );
      lastPhase = s.phase;
      if (s.phase !== 'pulse') await release();
      if (['levelUp', 'reward', 'shop'].includes(s.phase)) await page.waitForTimeout(400);
    }
    if (s.phase === 'victory' || s.phase === 'defeat') break;
    if (s.phase === 'pulse') {
      let vx = (st.cx - st.p.player.x) / 400;
      let vy = (st.cy - st.p.player.y) / 250;
      let nearest = Infinity;
      for (const e of [...st.p.enemies, ...st.p.enemyShots]) {
        const dx = st.p.player.x - e.x;
        const dy = st.p.player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        nearest = Math.min(nearest, d);
        if (d < 260) {
          vx += ((dx / d) * (260 - d)) / 60;
          vy += ((dy / d) * (260 - d)) / 60;
        }
      }
      const want = new Set<string>();
      const len = Math.hypot(vx, vy);
      if (len > 0.2) {
        if (vx / len > 0.38) want.add('KeyD');
        if (vx / len < -0.38) want.add('KeyA');
        if (vy / len > 0.38) want.add('KeyS');
        if (vy / len < -0.38) want.add('KeyW');
      }
      for (const k of held) if (!want.has(k)) await page.keyboard.up(k);
      for (const k of want) if (!held.has(k)) await page.keyboard.down(k);
      held = want;
      if (st.ready && nearest < 180) await page.keyboard.press('Space');
      await page.waitForTimeout(40);
    } else if (s.phase === 'levelUp' || s.phase === 'reward') {
      await page.keyboard.press('Digit1');
      await page.waitForTimeout(350);
    } else if (s.phase === 'shop') {
      const i = st.offers.findIndex((a) => a);
      await page.keyboard.press(i >= 0 ? `Digit${i + 1}` : 'KeyB');
      await page.waitForTimeout(250);
    } else {
      await page.waitForTimeout(50);
    }
  }
  await release();
  return { log, phase: (await snap(page)).phase, pulses: maxPulse };
}

for (const seed of SEEDS) {
  test(`E-13: browser bot with real keys finishes a run (seed ${seed}), replay matches in Node`, async ({
    page,
  }) => {
    test.setTimeout(420_000);
    const problems = watchProblems(page);
    await boot(page);
    await page.evaluate(
      ([s, scale]) => {
        const h = window.__shardfall;
        h?.startRun({ seed: s, classId: 'lantern' });
        h?.setTimeScale(scale);
      },
      [seed, TIME_SCALE] as const,
    );
    const r = await playRun(page, 360_000);
    const end = await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      h.pauseLoop();
      return { replay: h.exportReplay(), hash: h.getStateHash(), snap: h.getSnapshot() };
    });
    await page.evaluate(() => window.__shardfall?.step(0));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${EVIDENCE}/e13-seed${seed}-end.png` });
    const { result } = replayInNode(`e13-seed${seed}`, end.replay);
    writeFileSync(
      `${EVIDENCE}/e13-seed${seed}.txt`,
      `${r.log.join('\n')}\nend: ${end.snap.phase} pulse ${end.snap.pulseIndex + 1} tick ${end.snap.tick} hash ${end.hash}\nnode replay: ${JSON.stringify(result)}\nproblems: ${JSON.stringify(problems)}\n`,
    );
    console.log(
      `[E-13 seed ${seed}] ${end.snap.phase} at Pulse ${end.snap.pulseIndex + 1}, tick ${end.snap.tick}; node ${JSON.stringify(result)}`,
    );
    expect(['victory', 'defeat']).toContain(end.snap.phase);
    expect(end.snap.screen).toBe('run-end');
    expect(result['mismatchAt']).toBe(-1);
    expect(result['finalHash']).toBe(end.hash);
    expect(problems).toEqual([]);
  });
}
