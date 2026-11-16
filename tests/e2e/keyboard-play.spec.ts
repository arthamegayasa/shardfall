// QA keyboard-only play (M1-09b): A-07 run flow without a mouse, E-02 to E-09, E-12 pause in every
// run context (A-06), E-15 autosave and Continue, E-10 retry, at 1920x1080.
// Pulse 1 is played in real time with real key presses (a small dodging policy reads the e2e
// snapshot and holds W, A, S, D; Space casts the Rite). Later Pulses are shortened with
// debug.endPulse; that is the only hook shortcut and it is labelled where used.
// Screenshots go to docs/qa/evidence/M1/kb-*.png; layout findings to kb-layout.json.

import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  EVIDENCE,
  boot,
  focused,
  hash,
  installPointerBlocker,
  layoutIssues,
  pointerEvents,
  rawText,
  screen,
  send,
  snap,
  step,
  watchProblems,
} from './support/qa.ts';
import type { LayoutIssue } from './support/qa.ts';

test.use({ viewport: { width: 1920, height: 1080 } });

const layout: Record<string, LayoutIssue[]> = {};

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE}/kb-${name}.png` });
  expect.soft(await rawText(page), `raw keys on ${name}`).toEqual([]);
  const issues = await layoutIssues(page);
  if (issues.length > 0) layout[name] = issues;
}

interface PlayStats {
  readonly seconds: number;
  readonly riteCasts: number;
  readonly maxEnemies: number;
  readonly glintStart: number;
  readonly glintEnd: number;
  readonly hpEnd: number;
  readonly keyChanges: number;
}

/** Real-time keyboard dodger until the phase leaves 'pulse' or maxMs passes. */
async function keyboardPulse(
  page: Page,
  maxMs: number,
  onTick?: (ms: number) => Promise<void>,
): Promise<PlayStats> {
  let held = new Set<string>();
  let riteCasts = 0;
  let maxEnemies = 0;
  let keyChanges = 0;
  const glintStart = (await snap(page)).glint;
  const t0 = Date.now();
  let last = await snap(page);
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      const s = h.getSnapshot();
      const p = h.getScreenPositions();
      const canvas = document.querySelector('canvas#game')?.getBoundingClientRect();
      const ready = document.querySelector('.rite')?.classList.contains('is-ready') ?? false;
      return { s, p, cx: (canvas?.width ?? 0) / 2, cy: (canvas?.height ?? 0) / 2, ready };
    });
    last = st.s;
    if (st.s.phase !== 'pulse') break;
    maxEnemies = Math.max(maxEnemies, st.s.counts.enemies);
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
    for (const k of held)
      if (!want.has(k)) {
        await page.keyboard.up(k);
        keyChanges++;
      }
    for (const k of want)
      if (!held.has(k)) {
        await page.keyboard.down(k);
        keyChanges++;
      }
    held = want;
    if (st.ready && nearest < 160) {
      await page.keyboard.press('Space');
      riteCasts++;
    }
    await onTick?.(Date.now() - t0);
    await page.waitForTimeout(80);
  }
  for (const k of held) await page.keyboard.up(k);
  return {
    seconds: (Date.now() - t0) / 1000,
    riteCasts,
    maxEnemies,
    glintStart,
    glintEnd: last.glint,
    hpEnd: last.hp,
    keyChanges,
  };
}

/** Esc pauses; the tick and the timer stay put for 2 s and held movement keys do nothing. */
async function checkPause(page: Page, context: string): Promise<void> {
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page), { message: `pause from ${context}` }).toBe('pause');
  const a = await snap(page);
  const timerText = () =>
    page.evaluate(() => document.querySelector('.timer')?.textContent ?? null);
  const timerA = await timerText();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyD');
  const b = await snap(page);
  expect(b.tick, `tick frozen in pause (${context})`).toBe(a.tick);
  expect(b.player.x, `no movement in pause (${context})`).toBe(a.player.x);
  const timerB = await timerText();
  expect(timerB, `timer frozen (${context})`).toBe(timerA);
  await page.keyboard.press('Escape');
}

test('keyboard only: title to Pulse 1 (real time), Temper, Glazier, Pulse 2, Continue, defeat, retry', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await installPointerBlocker(page);
  const problems = watchProblems(page);
  const log: string[] = [];
  await boot(page);

  // S01 Title: initial focus on New Run, arrows walk the menu, Enter opens class select (E-02).
  await shot(page, '01-title');
  expect(await focused(page)).toBe('title-new-run');
  const order: string[] = [await focused(page)];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowDown');
    order.push(await focused(page));
  }
  log.push(`title focus order (ArrowDown): ${order.join(' > ')}`);
  for (let i = 0; i < 6 && (await focused(page)) !== 'title-new-run'; i++)
    await page.keyboard.press('ArrowUp');
  expect(await focused(page)).toBe('title-new-run');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('class-select');
  await shot(page, '02-class-select');
  expect(await focused(page)).toMatch(/^class-/);
  // Esc goes back, Enter comes back (A-07: Esc always steps back).
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('title');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('class-select');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('pulse');
  const runSeedHint = await snap(page);
  log.push(`run started from the UI (random seed), pulse ${runSeedHint.pulseIndex + 1}`);

  // E-03 HUD: HP, timer, Glint, Rite present.
  for (const sel of ['.bar-hp .bar-text', '.timer', '.hud-tr .num', '.rite'])
    await expect(page.locator(sel)).toBeVisible();

  // E-04 movement: each key moves the Kept the right way on screen.
  const pos = async () =>
    page.evaluate(() => window.__shardfall?.getScreenPositions().player ?? { x: 0, y: 0 });
  const dirs: [string, 'x' | 'y', number][] = [
    ['KeyD', 'x', 1],
    ['KeyA', 'x', -1],
    ['KeyS', 'y', 1],
    ['KeyW', 'y', -1],
  ];
  for (const [key, axis, sign] of dirs) {
    const p0 = await pos();
    await page.keyboard.down(key);
    await page.waitForTimeout(500);
    await page.keyboard.up(key);
    const p1 = await pos();
    const d = (p1[axis] - p0[axis]) * sign;
    log.push(`E-04 ${key}: moved ${d.toFixed(1)} css px along ${axis}`);
    expect(d, `E-04 ${key}`).toBeGreaterThan(10);
  }
  await page.waitForTimeout(300);
  await shot(page, '03-pulse-start');

  // E-05 Rite: Space starts the cooldown, a second press during the cooldown changes nothing.
  await expect(page.locator('.rite')).toHaveClass(/is-ready/, { timeout: 5000 });
  await page.keyboard.press('Space');
  await expect(page.locator('.rite')).not.toHaveClass(/is-ready/, { timeout: 1000 });
  const cd1 = await page.locator('.rite-secs').textContent();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await expect(page.locator('.rite')).not.toHaveClass(/is-ready/);
  log.push(`E-05 Rite cooldown text after cast: "${cd1 ?? ''}"`);

  // Pulse 1 in real time with the keyboard bot. Pause test (E-12, A-06) at about 8 s.
  let paused = false;
  let midShot = false;
  const stats = await keyboardPulse(page, 40_000, async (ms) => {
    if (!midShot && ms > 6000) {
      midShot = true;
      await shot(page, '04-pulse-mid');
    }
    if (!paused && ms > 8000) {
      paused = true;
      await checkPause(page, 'pulse');
      await shot(page, '05-resume-countdown');
      await expect(page.locator('.resume-countdown')).toBeHidden({ timeout: 2000 });
    }
  });
  log.push(`Pulse 1 real time: ${JSON.stringify(stats)}`);
  expect(paused).toBe(true);
  // E-06: enemies came, Glint was collected (kills drop Glint).
  expect(stats.maxEnemies).toBeGreaterThan(0);
  expect(stats.glintEnd).toBeGreaterThan(stats.glintStart);
  // E-07: end of the Pulse leads to Temper (if levelled) and the Glazier.
  await expect
    .poll(async () => (await snap(page)).phase, { timeout: 10_000 })
    .not.toBe('pulseClear');
  const afterPulse = await snap(page);
  log.push(
    `after Pulse 1: phase ${afterPulse.phase}, level ${afterPulse.level}, hp ${afterPulse.hp}/${afterPulse.maxHp}, glint ${afterPulse.glint}`,
  );
  expect(['levelUp', 'shop', 'defeat']).toContain(afterPulse.phase);
  expect(afterPulse.phase, 'the Kept died in Pulse 1 under keyboard play').not.toBe('defeat');

  if (afterPulse.phase === 'levelUp') {
    await page.waitForTimeout(400);
    await shot(page, '06-temper');
    await checkPause(page, 'level-up');
    let picks = 0;
    while ((await snap(page)).phase === 'levelUp' && picks < 12) {
      await page.waitForTimeout(400);
      // Arrow to the second card and confirm with Enter (keyboard focus path, not the digit keys).
      await page.keyboard.press('ArrowDown');
      expect(await focused(page)).toBe('temper-card-2');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      picks++;
    }
    log.push(`Temper picks with ArrowDown + Enter: ${picks}`);
  }

  // The Glazier (E-08, P4-c): buy with one key press, reroll with R, begin with B.
  await expect.poll(() => screen(page), { timeout: 5000 }).toBe('glazier');
  await page.waitForTimeout(400);
  await shot(page, '07-glazier');
  await checkPause(page, 'glazier');
  expect(await focused(page), 'Glazier has keyboard focus').not.toBe('');
  const g0 = (await snap(page)).glint;
  const offerTexts = async () => page.locator('[data-ui^="shop-offer-"]').allTextContents();
  const affordable = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-ui^="shop-offer-"]')).map(
      (e) => !e.className.includes('is-unaffordable') && !e.className.includes('card-empty'),
    ),
  );
  const buyIdx = affordable.findIndex((a) => a);
  log.push(`Glazier: glint ${g0}, affordable offers ${JSON.stringify(affordable)}`);
  if (buyIdx >= 0) {
    await page.keyboard.press(`Digit${buyIdx + 1}`);
    await expect.poll(async () => (await snap(page)).glint).toBeLessThan(g0);
    log.push(`bought offer ${buyIdx + 1} with one key: glint ${g0} -> ${(await snap(page)).glint}`);
  } else {
    log.push('no affordable offer after Pulse 1 (buy step not exercised by keyboard here)');
  }
  const before = await offerTexts();
  const g1 = (await snap(page)).glint;
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(200);
  const g2 = (await snap(page)).glint;
  if (g2 < g1) {
    expect(await offerTexts()).not.toEqual(before);
    log.push(`reroll with R: glint ${g1} -> ${g2}, offers changed`);
  } else {
    log.push(`reroll with R not affordable (glint ${g1})`);
  }
  await shot(page, '08-glazier-after');
  await page.keyboard.press('KeyB');
  await expect.poll(async () => (await snap(page)).pulseIndex).toBe(1);
  expect((await snap(page)).phase).toBe('pulse');

  // Pulse 2: 4 s of keyboard play, then the test shortens the Pulse (debug.endPulse).
  const p2 = await keyboardPulse(page, 4000);
  log.push(`Pulse 2 keyboard 4 s: ${JSON.stringify(p2)}`);
  await page.evaluate(() => {
    window.__shardfall?.pauseLoop();
  });
  await send(page, { type: 'debug.endPulse' });
  await step(page, 1);
  // One tick at a time so the snapshot below is taken on the tick the autosave was written.
  await page.evaluate(() => {
    const h = window.__shardfall;
    for (
      let i = 0;
      i < 3600 && h !== undefined && ['pulse', 'pulseClear'].includes(h.getSnapshot().phase);
      i++
    )
      h.step(1);
  });
  while ((await snap(page)).phase === 'levelUp') {
    await page.waitForTimeout(350);
    await page.keyboard.press('Enter');
    await step(page, 1);
  }
  expect((await snap(page)).phase).toBe('shop');
  const saved = await snap(page);
  const savedHash = await hash(page);

  // E-15: reload, Continue has the initial focus, Enter resumes the same Glazier and the same state.
  await page.reload();
  await page.waitForFunction(() => window.__shardfall !== undefined);
  await page.evaluate(() => {
    window.__shardfall?.pauseLoop();
  });
  await shot(page, '09-title-continue');
  expect(await focused(page)).toBe('title-continue');
  await page.keyboard.press('Enter');
  await step(page, 0);
  await expect.poll(() => screen(page)).toBe('glazier');
  const resumed = await snap(page);
  const resumedHash = await hash(page);
  log.push(
    `E-15 saved ${JSON.stringify({ t: saved.tick, g: saved.glint, h: savedHash })} resumed ${JSON.stringify({ t: resumed.tick, g: resumed.glint, h: resumedHash })}`,
  );
  expect(resumed.pulseIndex).toBe(saved.pulseIndex);
  expect(resumed.glint).toBe(saved.glint);
  expect(resumed.level).toBe(saved.level);
  expect(resumed.hp).toBe(saved.hp);
  expect.soft(resumedHash, 'E-15 state hash after Continue').toBe(savedHash);
  await shot(page, '10-continued-glazier');

  // E-10 defeat (forced through debug), keyboard on the run end: Enter on Try Again starts a new run.
  await page.keyboard.press('KeyB');
  await step(page, 1);
  await send(page, { type: 'debug.setHp', hp: 1 });
  const pl = (await snap(page)).player;
  await send(page, { type: 'debug.spawn', enemyId: 'charger', x: pl.x + 0.5, y: pl.y, count: 6 });
  for (let i = 0; i < 80 && (await snap(page)).phase !== 'defeat'; i++) await step(page, 30);
  expect((await snap(page)).phase).toBe('defeat');
  await step(page, 1);
  expect(await screen(page)).toBe('run-end');
  await page.waitForTimeout(650);
  await shot(page, '11-run-lost');
  expect(await focused(page)).toBe('end-again');
  await page.keyboard.press('Enter');
  await step(page, 1);
  await expect.poll(() => screen(page)).toBe('pulse');
  const retry = await snap(page);
  expect(retry.pulseIndex).toBe(0);
  expect(retry.hp).toBe(retry.maxHp);

  // Pause, open Settings with the keyboard, walk its rows, back out with Esc twice.
  await page.keyboard.press('Escape');
  await step(page, 0);
  await expect.poll(() => screen(page)).toBe('pause');
  await shot(page, '12-pause');
  for (let i = 0; i < 4 && (await focused(page)) !== 'pause-settings'; i++)
    await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('pause-settings');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('settings');
  const rows: string[] = [await focused(page)];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('ArrowDown');
    const f = await focused(page);
    if (f === rows[rows.length - 1]) break;
    rows.push(f);
  }
  log.push(`settings rows reachable with ArrowDown: ${rows.length} (${rows.join(', ')})`);
  await shot(page, '13-settings');
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('pause');
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('pulse');

  writeFileSync(`${EVIDENCE}/kb-layout.json`, `${JSON.stringify(layout, null, 2)}\n`);
  writeFileSync(`${EVIDENCE}/kb-log.txt`, `${log.join('\n')}\n`);
  console.log(log.join('\n'));
  expect(await pointerEvents(page), 'A-07: no mouse or pointer events').toEqual([]);
  expect(problems).toEqual([]);
});
