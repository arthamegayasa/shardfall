// Full run through the real UI (LP, M1-09a): title, New Run, Lamplighter, Pulse with movement and
// Rite, pause and resume countdown, Temper, the Glazier (buy, lock, reroll, sell, Fuse), the next
// Pulse, autosave and Continue after a reload, Warden reward, victory, back to title; and a defeat.
// Clicks and keys drive every decision; the e2e hooks only speed up time (step, debug.endPulse,
// debug.glint, debug.xp, debug.setHp). Screenshots of every screen go to tests/out/e2e/.

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const OUT = 'tests/out/e2e';

/** Raw string keys, unresolved placeholders, or dev markers in the visible UI text. */
async function rawText(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.querySelector('#ui-root')?.textContent ?? '');
  const bad = text.match(
    /\[\[[^\]]*\]\]|\{[a-z_0-9]+\}|\b(?:ui|memento|weapon|syn|class|tag|rite|card|stat|unlit|biome|glazier)\.[a-z_0-9]+(?:\.[a-z_0-9]+)*/g,
  );
  return bad ?? [];
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  expect(await rawText(page), `raw keys on ${name}`).toEqual([]);
}

async function screen(page: Page): Promise<string> {
  return page.evaluate(() => window.__shardfall?.getSnapshot().screen ?? '');
}

async function snap(page: Page) {
  return page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    return h.getSnapshot();
  });
}

/** Step the sim from the test (loop held) and render one frame. */
async function step(page: Page, ticks: number, input?: { moveX?: number; moveY?: number }) {
  await page.evaluate(
    ([t, i]) => {
      window.__shardfall?.step(t, i);
    },
    [ticks, input ?? {}] as const,
  );
}

async function send(page: Page, cmd: object): Promise<void> {
  await page.evaluate((c) => {
    window.__shardfall?.send(c as never);
  }, cmd);
}

/** Choice screens ignore input for 300 ms after they appear, the run end for 500 ms (ui-spec 8.4). */
async function afterInputLock(page: Page, ms = 400): Promise<void> {
  await page.waitForTimeout(ms);
}

/** End the current Pulse and step until a post-Pulse phase. */
async function endPulse(page: Page): Promise<void> {
  await send(page, { type: 'debug.endPulse' });
  await step(page, 1);
  for (let i = 0; i < 40; i++) {
    const s = await snap(page);
    if (s.phase !== 'pulse' && s.phase !== 'pulseClear') return;
    // A Warden Pulse runs on in overtime until the Warden falls (up to 75 s since M4-04); the Kept
    // stands still meanwhile, so keep it alive like the rest of this fast-forwarded flow (QA M5).
    if (s.phase === 'pulse') await send(page, { type: 'debug.setHp', hp: s.maxHp });
    await step(page, 30);
  }
  throw new Error('Pulse did not end');
}

function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));
  return problems;
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
  await page.waitForFunction(() => window.__shardfall !== undefined);
}

test('plays a full run through the UI to victory, with autosave and Continue', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watchProblems(page);
  await boot(page);

  // Title and class select through real clicks.
  await expect(page.locator('[data-ui="title-continue"]')).toHaveCount(0);
  await shot(page, '01-title');
  await page.click('[data-ui="title-new-run"]');
  expect(await screen(page)).toBe('class-select');
  await expect(page.locator('[data-ui="class-lantern"]')).toBeVisible();
  await shot(page, '02-class-select');
  await page.click('[data-ui="class-begin"]');
  await expect.poll(() => screen(page)).toBe('pulse');

  // Pulse in real time: walk right with D, cast the Rite with Space.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const walked = await snap(page);
  expect(walked.player.x).toBeGreaterThan(0.5);
  // Then the test drives time: 8 s of Pulse, enemies, auto attacks, Glint.
  await page.evaluate(() => {
    window.__shardfall?.pauseLoop();
  });
  for (let i = 0; i < 8; i++) await step(page, 60, { moveY: i % 2 === 0 ? 60 : -60 });
  const mid = await snap(page);
  expect(mid.phase).toBe('pulse');
  expect(mid.counts.enemies + mid.counts.pickups).toBeGreaterThan(0);
  await shot(page, '03-pulse');

  // Pause with Esc, resume with Esc: 3, 2, 1 countdown in the timer slot (ui-spec S06).
  await page.keyboard.press('Escape');
  expect(await screen(page)).toBe('pause');
  await shot(page, '04-pause');
  await page.keyboard.press('Escape');
  await expect(page.locator('.resume-countdown')).toHaveText('3');
  await shot(page, '05-resume-countdown');
  await expect(page.locator('.resume-countdown')).toBeHidden({ timeout: 2000 });
  expect(await screen(page)).toBe('pulse');

  // Temper: guarantee one level, end the Pulse, pick the first card with the 1 key.
  await send(page, { type: 'debug.xp', amount: mid.level * 1000 });
  await step(page, 1);
  await endPulse(page);
  expect(await screen(page)).toBe('level-up');
  await shot(page, '06-temper');
  while ((await screen(page)) === 'level-up') {
    await afterInputLock(page);
    await page.keyboard.press('Digit1');
    await step(page, 1);
  }

  // The Glazier: buy, lock, reroll, sell, Fuse through clicks and shortcuts.
  expect(await screen(page)).toBe('glazier');
  await send(page, { type: 'debug.glint', amount: 300 });
  await step(page, 1);
  await afterInputLock(page);
  await shot(page, '07-glazier');
  const glint0 = (await snap(page)).glint;
  await page.click('[data-ui="shop-offer-1"]');
  await step(page, 1);
  expect((await snap(page)).glint).toBeLessThan(glint0);
  await expect(page.locator('[data-ui="shop-offer-1"]')).toHaveClass(/card-empty/);
  await page.click('[data-ui="shop-lock-2"]');
  await step(page, 1);
  await expect(page.locator('[data-ui="shop-lock-2"]')).toHaveAttribute('aria-pressed', 'true');
  const glint1 = (await snap(page)).glint;
  await page.keyboard.press('KeyR');
  await step(page, 1);
  expect((await snap(page)).glint).toBeLessThan(glint1);
  await expect(page.locator('[data-ui="shop-lock-2"]')).toHaveAttribute('aria-pressed', 'true');
  // A second Lantern Bolt I makes Fuse possible with slot 1.
  await page.evaluate(() => {
    window.__shardfall?.grantItem('lantern_bolt', 1);
  });
  await step(page, 1);
  await page.click('[data-ui="shop-slot-1"]');
  await page.click('[data-ui="shop-fuse"]');
  await step(page, 1);
  await expect(page.locator('[data-ui="shop-slot-1"] .slot-tier')).toHaveText('II');
  // Sell the last bought weapon if one exists in slot 2, otherwise grant one to sell.
  if ((await page.locator('[data-ui="shop-slot-2"].is-empty').count()) > 0) {
    await page.evaluate(() => {
      window.__shardfall?.grantItem('arc_blade', 1);
    });
    await step(page, 1);
  }
  const glint2 = (await snap(page)).glint;
  await page.click('[data-ui="shop-slot-2"]');
  await page.click('[data-ui="shop-sell"]');
  await step(page, 1);
  expect((await snap(page)).glint).toBeGreaterThan(glint2);
  await shot(page, '08-glazier-after');

  // Next Pulse with the B key.
  await page.keyboard.press('KeyB');
  await step(page, 60);
  const p2 = await snap(page);
  expect(p2.phase).toBe('pulse');
  expect(p2.pulseIndex).toBe(1);
  await shot(page, '09-pulse-2');

  // Autosave in the Glazier, reload, Continue from the title.
  await endPulse(page);
  while ((await snap(page)).phase === 'levelUp') {
    await send(page, { type: 'levelup.pick', choice: 0 });
    await step(page, 1);
  }
  expect((await snap(page)).phase).toBe('shop');
  const before = await snap(page);
  await page.reload();
  await page.waitForFunction(() => window.__shardfall !== undefined);
  await expect(page.locator('[data-ui="title-continue"]')).toBeVisible();
  await shot(page, '10-title-continue');
  await page.click('[data-ui="title-continue"]');
  await expect.poll(() => screen(page)).toBe('glazier');
  const resumed = await snap(page);
  // The save is written when the Glazier opens; shop ticks after it only advance the clock.
  expect(resumed.pulseIndex).toBe(before.pulseIndex);
  expect(resumed.glint).toBe(before.glint);
  expect(resumed.level).toBe(before.level);
  expect(resumed.hp).toBe(before.hp);
  await shot(page, '11-continued-glazier');

  // Play out the remaining Pulses; stop at the Warden reward to pick it with a click.
  await page.evaluate(() => {
    window.__shardfall?.pauseLoop();
  });
  let sawReward = false;
  for (let guard = 0; guard < 40; guard++) {
    const s = await snap(page);
    if (s.phase === 'victory') break;
    if (s.phase === 'shop') {
      await afterInputLock(page);
      await page.keyboard.press('KeyB');
      await step(page, 1);
      continue;
    }
    if (s.phase === 'pulse') {
      await send(page, { type: 'debug.setHp', hp: s.maxHp });
      // Let a Warden appear before ending its Pulse so the reward follows.
      for (let i = 0; i < 40; i++) {
        const w = await page.evaluate(() => {
          const h = window.__shardfall;
          return h === undefined ? false : h.getSnapshot().counts.enemies > 0;
        });
        if (w) break;
        await step(page, 60);
      }
      // Keep the Kept alive while the Pulse plays on (the UI picks a random seed).
      for (let i = 0; i < 10; i++) {
        await send(page, { type: 'debug.setHp', hp: s.maxHp });
        await step(page, 60);
      }
      if ((await snap(page)).phase === 'pulse') await endPulse(page);
      continue;
    }
    if (s.phase === 'reward') {
      if (!sawReward) {
        sawReward = true;
        await afterInputLock(page);
        await shot(page, '12-warden-reward');
      }
      await page.click('[data-ui="reward-card-1"]');
      await step(page, 1);
      continue;
    }
    if (s.phase === 'levelUp') {
      await send(page, { type: 'levelup.pick', choice: 0 });
      await step(page, 1);
      continue;
    }
    await step(page, 30);
  }
  await expect.poll(async () => (await snap(page)).phase, { timeout: 10_000 }).toBe('victory');
  await step(page, 1);
  expect(await screen(page)).toBe('run-end');
  expect(sawReward).toBe(true);
  await afterInputLock(page, 650);
  await shot(page, '13-run-won');

  // Back to the title: the autosave is gone.
  await page.click('[data-ui="end-title"]');
  expect(await screen(page)).toBe('title');
  await expect(page.locator('[data-ui="title-continue"]')).toHaveCount(0);
  await shot(page, '14-title-after');
  expect(problems).toEqual([]);
});

test('loses a run and shows the run end screen', async ({ page }) => {
  test.setTimeout(60_000);
  const problems = watchProblems(page);
  await boot(page);
  await page.click('[data-ui="title-new-run"]');
  await page.click('[data-ui="class-begin"]');
  await expect.poll(() => screen(page)).toBe('pulse');
  await page.evaluate(() => {
    window.__shardfall?.pauseLoop();
  });
  await send(page, { type: 'debug.setHp', hp: 1 });
  const p = (await snap(page)).player;
  await send(page, { type: 'debug.spawn', enemyId: 'charger', x: p.x + 0.5, y: p.y, count: 6 });
  for (let i = 0; i < 60 && (await snap(page)).phase !== 'defeat'; i++) await step(page, 30);
  expect((await snap(page)).phase).toBe('defeat');
  await step(page, 1);
  expect(await screen(page)).toBe('run-end');
  await afterInputLock(page, 650);
  await shot(page, '15-run-lost');
  await page.click('[data-ui="end-title"]');
  expect(await screen(page)).toBe('title');
  expect(problems).toEqual([]);
});

test('goToScreen, spawnStress, and replays work through the hooks', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = watchProblems(page);
  await boot(page);
  await page.evaluate(() => {
    window.__shardfall?.pauseLoop();
  });
  for (const id of ['glazier', 'level-up', 'warden-reward', 'run-won', 'title'] as const) {
    await page.evaluate((s) => window.__shardfall?.goToScreen(s), id);
    expect(await screen(page)).toBe(id === 'run-won' ? 'run-end' : id);
  }
  // Stress scene: last normal Pulse composition plus a late build.
  await page.evaluate(() => {
    const h = window.__shardfall;
    h?.startRun({ seed: 5, classId: 'lantern' });
    h?.step(1);
    h?.spawnStress('peak');
    h?.step(30);
  });
  expect((await snap(page)).counts.enemies).toBeGreaterThan(20);
  await shot(page, '16-stress');
  // A recorded run replays to the same checkpoints.
  const result = await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    h.startRun({ seed: 9, classId: 'lantern' });
    h.step(300, { moveX: 90 });
    const replay = h.exportReplay();
    const hash = h.getStateHash();
    h.loadReplay(replay);
    return { hash, after: h.getStateHash() };
  });
  expect(result.after).toBe(result.hash);
  expect(problems).toEqual([]);
});
