// QA M3 keyboard play per class (1920x1080, High, real GPU): title, class select, one real-time Pulse
// with real keys, Temper, the Glazier (buy, reroll), Pulse 2, Pause, Abandon, run end with Silt, and
// The Keeping. The Vintner is unlocked with Silt earned in the Lamplighter run; that run clears
// Pulses 2 to 6 with debug.endPulse (the only shortcut, labelled). The Chorister costs more Silt than
// one run gives, so its Silt comes from the grantSilt hook (labelled). No mouse (pointer recorder).

import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { keyboardPulse } from './support/kb.ts';
import {
  focused,
  installPointerBlocker,
  layoutIssues,
  pointerEvents,
  rawText,
  screen,
  snap,
  watchProblems,
} from './support/qa.ts';
import type { LayoutIssue } from './support/qa.ts';
import { GPU_ARGS, M3_OUT, bootWith } from './support/m3.ts';

test.use({ viewport: { width: 1920, height: 1080 }, launchOptions: { args: GPU_ARGS } });

const layout: Record<string, LayoutIssue[]> = {};
const log: string[] = [];

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${M3_OUT}/play-${name}.png` });
  expect.soft(await rawText(page), `raw keys on ${name}`).toEqual([]);
  const issues = await layoutIssues(page);
  if (issues.length > 0) layout[name] = issues;
}

const OPPOSITE: Record<string, string> = {
  ArrowDown: 'ArrowUp',
  ArrowUp: 'ArrowDown',
  ArrowRight: 'ArrowLeft',
  ArrowLeft: 'ArrowRight',
};

/** Move focus with key, then with the opposite key, until data-ui matches. */
async function focusTo(page: Page, ui: string, key = 'ArrowDown', max = 12): Promise<void> {
  for (const k of [key, OPPOSITE[key] ?? key])
    for (let i = 0; i < max && (await focused(page)) !== ui; i++) await page.keyboard.press(k);
  expect(await focused(page), `focus ${ui}`).toBe(ui);
}

async function meta(page: Page): Promise<{ silt: number; unlocked: string[] }> {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('shardfall.meta.v1') ?? '{"silt":0,"unlocked":[]}') as {
        silt: number;
        unlocked: string[];
      },
  );
}

/** Temper and Warden chest screens until the Glazier, picking with Enter (input lock 300 ms). */
async function toGlazier(page: Page, tag: string): Promise<void> {
  let shotTemper = false;
  for (let i = 0; i < 40; i++) {
    const sc = await screen(page);
    if (sc === 'glazier') return;
    if (sc === 'level-up' || sc === 'warden-reward') {
      if (!shotTemper) {
        await shot(page, `${tag}-${sc}`);
        shotTemper = true;
      }
      await page.waitForTimeout(350);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(150);
  }
  expect(await screen(page)).toBe('glazier');
}

/** Esc, Abandon Run, confirm: the run end screen. */
async function abandon(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('pause');
  await focusTo(page, 'pause-abandon');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('confirm');
  await focusTo(page, 'confirm-abandon', 'ArrowRight', 4);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('run-end');
}

async function buyInKeeping(page: Page, id: string): Promise<void> {
  await expect.poll(() => screen(page)).toBe('archive');
  await focusTo(page, `keeping-${id}`, 'ArrowDown', 12);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-ui="keeping-${id}"]`)).toHaveClass(/is-owned/);
}

test('M3 keyboard play: one Pulse and one shop per class, Silt unlock path', async ({ page }) => {
  test.setTimeout(480_000);
  await installPointerBlocker(page);
  const problems = watchProblems(page);
  await bootWith(page, { graphics: { quality: 'high' }, access: { reduceEffects: false } });

  for (const cls of ['lantern', 'blade', 'bell'] as const) {
    await expect.poll(() => screen(page)).toBe('title');
    await focusTo(page, 'title-new-run', 'ArrowDown', 6);
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe('class-select');
    await focusTo(page, `class-${cls}`, 'ArrowDown', 4);
    await expect(page.locator(`[data-ui="class-${cls}"]`)).not.toHaveClass(/is-locked/);
    await shot(page, `${cls}-class-select`);
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe('pulse');
    await expect.poll(async () => (await snap(page)).phase).toBe('pulse');

    let midShot = false;
    const p1 = await keyboardPulse(page, 40_000, async (ms) => {
      if (!midShot && ms > 9000) {
        midShot = true;
        await page.screenshot({ path: `${M3_OUT}/play-${cls}-pulse1-mid.png` });
      }
    });
    log.push(`${cls} Pulse 1 real time: ${JSON.stringify(p1)}`);
    await toGlazier(page, cls);
    await shot(page, `${cls}-glazier`);
    const g0 = (await snap(page)).glint;
    const t0 = Date.now();
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(200);
    const g1 = (await snap(page)).glint;
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(200);
    const g2 = (await snap(page)).glint;
    await shot(page, `${cls}-glazier-after`);
    await page.keyboard.press('KeyB');
    await expect.poll(() => screen(page)).toBe('pulse');
    log.push(
      `${cls} Glazier: glint ${g0} -> buy ${g1} -> reroll ${g2}; keys to leave ${Date.now() - t0} ms (scripted, not a human time)`,
    );
    const p2 = await keyboardPulse(page, 6000);
    log.push(`${cls} Pulse 2 (6 s): hp ${p2.hpEnd}`);

    if (cls === 'lantern') {
      // Shortcut (labelled): clear Pulses 2 to 6 with debug.endPulse so the run earns real Silt.
      await page.evaluate(() => {
        const h = window.__shardfall;
        if (h === undefined) return;
        h.pauseLoop();
        for (let g = 0; g < 4000; g++) {
          const s = h.getSnapshot();
          if (s.phase === 'pulse' && s.pulseIndex >= 6) break;
          if (s.phase === 'pulse') {
            h.send({ type: 'debug.setHp', hp: s.maxHp });
            h.send({ type: 'debug.endPulse' });
          } else if (s.phase === 'reward') h.send({ type: 'reward.pick', choice: 0 });
          else if (s.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
          else if (s.phase === 'shop') h.send({ type: 'pulse.begin' });
          h.step(5);
        }
        h.resumeLoop();
      });
    }
    await page.keyboard.press('Escape');
    await expect.poll(() => screen(page)).toBe('pause');
    await shot(page, `${cls}-pause`);
    await page.keyboard.press('Escape');
    const before = await meta(page);
    await abandon(page);
    await shot(page, `${cls}-run-end`);
    const after = await meta(page);
    const shown = (await page.locator('#ui-root').textContent()) ?? '';
    log.push(
      `${cls} run end: Silt ${before.silt} -> ${after.silt}; screen mentions Silt: ${/Silt/.test(shown)}`,
    );
    expect(after.silt).toBeGreaterThan(before.silt);

    if (cls === 'lantern' || cls === 'blade') {
      if (cls === 'blade') {
        // Shortcut (labelled): the Chorister costs more Silt than a lost run gives.
        await page.evaluate(() => window.__shardfall?.grantSilt(60));
      }
      await focusTo(page, 'end-keeping', 'ArrowRight', 6);
      await page.keyboard.press('Enter');
      await buyInKeeping(page, cls === 'lantern' ? 'unlock_blade' : 'unlock_bell');
      await shot(page, `${cls}-keeping`);
      await page.keyboard.press('Escape');
      await expect.poll(() => screen(page)).toBe('run-end');
      // The run end locks input for 500 ms on every entry, also when returning from The Keeping
      // (BUG-009): a quick Enter is dropped. Record the focus, then wait the lock out.
      log.push(`${cls} focus after returning from The Keeping: ${await focused(page)}`);
      await page.waitForTimeout(550);
    }
    await focusTo(page, 'end-title', 'ArrowRight', 6);
    await page.keyboard.press('Enter');
  }

  const m = await meta(page);
  log.push(`meta at the end: ${JSON.stringify(m)}`);
  writeFileSync(`${M3_OUT}/play-log.txt`, `${log.join('\n')}\n`);
  writeFileSync(`${M3_OUT}/play-layout.json`, `${JSON.stringify(layout, null, 2)}\n`);
  console.log(log.join('\n'));
  expect(m.unlocked).toEqual(expect.arrayContaining(['unlock_blade', 'unlock_bell']));
  expect(await pointerEvents(page)).toEqual([]);
  expect(problems).toEqual([]);
});
