// LP M2-09, tier B activation: a locked class sends the player to The Keeping, Silt (granted with the
// grantSilt hook) buys it with the "Press again" pattern, and the second class then starts a run_b
// run whose run.start carries the owned unlocks. Keyboard only after the hook calls.

import { expect, test } from '@playwright/test';
import { boot, focused, screen, watchProblems } from './support/qa.ts';

test.use({ viewport: { width: 1920, height: 1080 } });

test('The Keeping unlocks the second class and the class select starts it', async ({ page }) => {
  const problems = watchProblems(page);
  await boot(page);
  const cost = await page.evaluate(() => {
    const raw = localStorage.getItem('shardfall.meta.v1');
    return raw === null ? null : (JSON.parse(raw) as { silt: number }).silt;
  });
  expect(cost, 'fresh storage has no meta yet').toBeNull();

  // Fresh player: only the Lamplighter is open.
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('class-select');
  await expect(page.locator('[data-ui="class-blade"]')).toHaveClass(/is-locked/);
  await expect(page.locator('[data-ui="class-bell"]')).toHaveClass(/is-locked/);
  await expect(page.locator('[data-ui="class-lantern"]')).not.toHaveClass(/is-locked/);
  for (let i = 0; i < 4 && (await focused(page)) !== 'class-blade'; i++)
    await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('class-blade');
  await expect(page.locator('[data-ui="class-begin"]')).toHaveText('Locked: buy in Unlocks');

  // Silt from the hook, then Enter on the locked class opens The Keeping.
  await page.evaluate(() => {
    window.__shardfall?.grantSilt(10);
  });
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('archive');
  await expect(page.locator('[data-ui="keeping-silt"]')).toHaveText('10 Silt');
  for (let i = 0; i < 8 && (await focused(page)) !== 'keeping-unlock_blade'; i++)
    await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('keeping-unlock_blade');
  const row = page.locator('[data-ui="keeping-unlock_blade"]');
  await expect(row).toHaveClass(/is-affordable/);
  // Unlock once arms the row, the second press buys (ui-spec S09, no dialog).
  await page.keyboard.press('Enter');
  await expect(row).toHaveClass(/is-armed/);
  await expect(row).toContainText('Press again');
  await page.keyboard.press('Enter');
  await expect(row).toHaveClass(/is-owned/);
  const silt = await page.locator('[data-ui="keeping-silt"]').textContent();
  const left = Number.parseInt(silt ?? '', 10);
  expect(left).toBeLessThan(10);
  // Expensive unlocks stay out of reach.
  await expect(page.locator('[data-ui="keeping-unlock_bell"]')).toHaveClass(/is-poor/);
  const stored = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('shardfall.meta.v1') ?? '{}') as {
        silt: number;
        unlocked: string[];
      },
  );
  expect(stored.unlocked).toEqual(expect.arrayContaining(['blade', 'unlock_blade']));
  expect(stored.silt).toBe(left);

  // Back to the class select: the Vintner is open and starts a run.
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('class-select');
  await expect(page.locator('[data-ui="class-blade"]')).not.toHaveClass(/is-locked/);
  for (let i = 0; i < 4 && (await focused(page)) !== 'class-blade'; i++)
    await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('class-blade');
  await expect(page.locator('[data-ui="class-begin"]')).toHaveText('Begin');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('pulse');
  const replay = await page.evaluate(
    () =>
      window.__shardfall?.exportReplay() as {
        classId: string;
        profile: string;
        commands: [number, { type: string; unlocked?: string[] }][];
      },
  );
  expect(replay.classId).toBe('blade');
  expect(replay.profile).toBe('run_b');
  expect(replay.commands[0]?.[1].unlocked).toEqual(['unlock_blade']);
  expect(problems).toEqual([]);
});
