// QA M3 accessibility audit (docs/qa/accessibility.md A-01 to A-12) plus settings E-14, E-16, E-17.
// Keyboard only for every UI action (pointer recorder); hooks only build states and read results.
// Frame captures for the flash test (A-02 step 4) and the damage number check (A-03 step 2) use the
// real GPU and go to tests/out/qa/m3/; tests/e2e/support/m3_analyze.py and the QA report read them.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  focused,
  installPointerBlocker,
  layoutIssues,
  pointerEvents,
  screen,
  snap,
  watchProblems,
} from './support/qa.ts';
import type { LayoutIssue } from './support/qa.ts';
import { GPU_ARGS, M3_OUT, SETTINGS_KEY, bootWith, freshRun } from './support/m3.ts';

// Real GPU for the whole file (launchOptions cannot change inside a describe group).
test.use({ launchOptions: { args: GPU_ARGS } });

const A11Y = `${M3_OUT}/a11y`;
mkdirSync(A11Y, { recursive: true });
const results: Record<string, unknown> = {};

test.afterAll(() => {
  // Merge with earlier runs so a partial run (-g, QA_LONG) never drops other results.
  const file = `${A11Y}/a11y-results.json`;
  const old = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>)
    : {};
  writeFileSync(file, `${JSON.stringify({ ...old, ...results }, null, 2)}\n`);
});

/** Reach a control by keyboard: arrows inside groups, Tab across groups. */
async function reach(page: Page, ui: string): Promise<void> {
  for (let round = 0; round < 6; round++) {
    for (const k of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
      for (let i = 0; i < 14; i++) {
        if ((await focused(page)) === ui) return;
        const before = await focused(page);
        await page.keyboard.press(k);
        if ((await focused(page)) === before) break;
      }
    }
    if ((await focused(page)) === ui) return;
    await page.keyboard.press('Tab');
  }
  expect(await focused(page), `reach ${ui}`).toBe(ui);
}

async function settingsSaved(page: Page): Promise<Record<string, Record<string, unknown>>> {
  return page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, Record<string, unknown>>,
    SETTINGS_KEY,
  );
}

async function openSettingsFromTitle(page: Page, tab: string): Promise<void> {
  await expect.poll(() => screen(page)).toBe('title');
  await reach(page, 'title-settings');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('settings');
  await reach(page, `settings-tab-${tab}`);
  await page.keyboard.press('Enter');
}

async function startRunByKeys(page: Page): Promise<void> {
  await expect.poll(() => screen(page)).toBe('title');
  await reach(page, 'title-new-run');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('class-select');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('pulse');
  await expect.poll(async () => (await snap(page)).phase).toBe('pulse');
  const t = (await snap(page)).tick;
  await expect.poll(async () => (await snap(page)).tick).toBeGreaterThan(t + 2);
}

const riteReady = (page: Page) =>
  page.evaluate(() => document.querySelector('.rite')?.classList.contains('is-ready') ?? false);

test.describe('keyboard and settings', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('A-01 remap: Rite to K, persists, conflict swap, reset, physical key codes', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installPointerBlocker(page);
    const problems = watchProblems(page);
    const log: string[] = [];
    await bootWith(page, { access: { reduceEffects: false } });
    await openSettingsFromTitle(page, 'controls');
    await reach(page, 'bind-rite-1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(100);
    const s1 = await settingsSaved(page);
    log.push(`rite after rebind: ${JSON.stringify(s1['keybinds']?.['rite'])}`);
    expect((s1['keybinds']?.['rite'] as string[])[0]).toBe('KeyK');
    await page.screenshot({ path: `${A11Y}/a01-remap.png` });
    await page.keyboard.press('Escape');
    await startRunByKeys(page);
    await expect.poll(() => riteReady(page), { timeout: 8000 }).toBe(true);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const afterSpace = await riteReady(page);
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(300);
    const afterK = await riteReady(page);
    log.push(`old Space casts: ${String(!afterSpace)}, K casts: ${String(!afterK)}`);
    expect(afterSpace, 'Space no longer casts').toBe(true);
    expect(afterK, 'K casts the Rite').toBe(false);

    // Persistence after reload.
    await page.reload();
    await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
    await page.waitForFunction(() => window.__shardfall !== undefined);
    await startRunByKeys(page);
    await expect.poll(() => riteReady(page), { timeout: 8000 }).toBe(true);
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(300);
    expect(await riteReady(page), 'K still casts after reload').toBe(false);
    log.push('K casts after reload: true');

    // Conflict: K onto Move Left (slot 1) swaps with the Rite and says so.
    await page.keyboard.press('Escape');
    await expect.poll(() => screen(page)).toBe('pause');
    await reach(page, 'pause-settings');
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe('settings');
    await reach(page, 'settings-tab-controls');
    await page.keyboard.press('Enter');
    await reach(page, 'bind-moveLeft-1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(100);
    const note =
      (await page.locator('[data-ui="settings-note"], .settings-note').first().textContent()) ?? '';
    const s2 = await settingsSaved(page);
    log.push(
      `conflict note "${note.trim()}", moveLeft ${JSON.stringify(s2['keybinds']?.['moveLeft'])}, rite ${JSON.stringify(s2['keybinds']?.['rite'])}`,
    );
    await page.screenshot({ path: `${A11Y}/a01-conflict.png` });
    expect((s2['keybinds']?.['moveLeft'] as string[])[0]).toBe('KeyK');
    expect((s2['keybinds']?.['rite'] as (string | null)[]).some((k) => k !== null)).toBe(true);
    expect(note.trim().length).toBeGreaterThan(0);

    // Reset to defaults with the "Press again" pattern.
    await reach(page, 'settings-reset-controls');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const s3 = await settingsSaved(page);
    log.push(`after reset: rite ${JSON.stringify(s3['keybinds']?.['rite'])}`);
    expect((s3['keybinds']?.['rite'] as string[])[0]).toBe('Space');

    // Physical codes: a keydown with code KeyW but key "z" (AZERTY) moves up.
    await page.keyboard.press('Escape');
    await expect.poll(() => screen(page)).toBe('pause');
    await page.keyboard.press('Escape');
    await expect.poll(() => screen(page)).toBe('pulse');
    // Resume plays a short countdown before the sim runs again (A-06 [Saran]): wait it out.
    const tr = (await snap(page)).tick;
    await expect
      .poll(async () => (await snap(page)).tick, { timeout: 8000 })
      .toBeGreaterThan(tr + 5);
    const y0 = (await snap(page)).player.y;
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'z', bubbles: true }));
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'z', bubbles: true }));
    });
    const y1 = (await snap(page)).player.y;
    log.push(`code KeyW key "z": world y ${y0.toFixed(2)} -> ${y1.toFixed(2)}`);
    expect(y1).not.toBe(y0);
    results['A-01'] = log;
    expect(await pointerEvents(page)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('A-06 pause anywhere: Esc and P in Pulse, Temper, Glazier, Warden; hidden tab (E-16)', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const problems = watchProblems(page);
    const log: string[] = [];
    await bootWith(page, { access: { reduceEffects: false } });
    const check = async (ctx: string, key: string): Promise<void> => {
      await page.keyboard.press(key);
      await expect.poll(() => screen(page), { message: `pause from ${ctx}` }).toBe('pause');
      const a = await snap(page);
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(2000);
      await page.keyboard.up('KeyD');
      const b = await snap(page);
      log.push(
        `${ctx} (${key}): tick ${a.tick} -> ${b.tick}, x ${a.player.x.toFixed(2)} -> ${b.player.x.toFixed(2)}`,
      );
      expect(b.tick, ctx).toBe(a.tick);
      expect(b.player.x, ctx).toBe(a.player.x);
      await page.keyboard.press('Escape');
      await expect.poll(() => screen(page)).not.toBe('pause');
    };
    await startRunByKeys(page);
    await check('Pulse', 'Escape');
    await check('Pulse', 'KeyP');
    // Temper and Glazier through commands, then live loop again.
    await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) return;
      h.pauseLoop();
      h.send({ type: 'debug.xp', amount: 9999 });
      h.step(1);
      h.send({ type: 'debug.endPulse' });
      h.step(120);
      h.resumeLoop();
    });
    await expect.poll(() => screen(page)).toBe('level-up');
    await page.waitForTimeout(400);
    await check('Temper', 'Escape');
    for (let i = 0; i < 120 && (await screen(page)) === 'level-up'; i++) {
      await page.waitForTimeout(320);
      if ((await screen(page)) === 'level-up') await page.keyboard.press('Enter');
    }
    await expect.poll(() => screen(page)).toBe('glazier');
    await check('Glazier', 'KeyP');
    // Warden on screen: Pulse 4.
    await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) return;
      h.pauseLoop();
      for (let g = 0; g < 4000; g++) {
        const s = h.getSnapshot();
        if (
          s.phase === 'pulse' &&
          s.pulseIndex === 3 &&
          h.getScreenPositions().enemies.some((e) => e.rank === 1)
        )
          break;
        if (s.phase === 'pulse' && s.pulseIndex < 3) h.send({ type: 'debug.endPulse' });
        else if (s.phase === 'reward') h.send({ type: 'reward.pick', choice: 0 });
        else if (s.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
        else if (s.phase === 'shop') h.send({ type: 'pulse.begin' });
        h.send({ type: 'debug.setHp', hp: s.maxHp });
        h.step(5);
      }
      h.resumeLoop();
    });
    await expect.poll(() => screen(page)).toBe('pulse');
    await check('Warden Pulse', 'Escape');

    // Hidden tab: a second page in front.
    const t0 = (await snap(page)).tick;
    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await page.waitForTimeout(1500);
    const vis = await page.evaluate(() => document.visibilityState);
    const s1 = await snap(page);
    await page.waitForTimeout(1500);
    const s2 = await snap(page);
    log.push(
      `hidden tab: visibility ${vis}, screen ${s1.screen}, tick ${t0} -> ${s1.tick} -> ${s2.tick}`,
    );
    await page.bringToFront();
    await other.close();
    results['A-06'] = log;
    if (vis === 'hidden') {
      expect(s2.tick, 'tick frozen while hidden').toBe(s1.tick);
    } else {
      log.push('visibilityState did not change in this browser mode: step 3 not testable here');
    }
    expect(problems).toEqual([]);
  });

  test('A-07 every screen by keyboard: focus reaches each control, focus is visible, Esc goes back', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await installPointerBlocker(page);
    const problems = watchProblems(page);
    await bootWith(page, { access: { reduceEffects: false } });
    await page.evaluate(() => window.__shardfall?.pauseLoop());
    const rows: Record<string, unknown>[] = [];
    const screens = [
      'title',
      'class-select',
      'settings',
      'archive',
      'credits',
      'pause',
      'level-up',
      'glazier',
      'warden-reward',
      'run-lost',
    ] as const;
    for (const id of screens) {
      await page.evaluate((s) => window.__shardfall?.goToScreen(s as never), id);
      await page.waitForTimeout(400);
      const visible = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          '#ui-root button, #ui-root [tabindex], #ui-root [data-ui]',
        )) {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          const interactive = el.tagName === 'BUTTON' || el.tabIndex >= 0;
          if (!interactive || r.width === 0 || st.visibility === 'hidden' || st.display === 'none')
            continue;
          if (el.closest('[aria-hidden="true"]') !== null) continue;
          out.push(el.dataset['ui'] ?? el.tagName);
        }
        return [...new Set(out)];
      });
      const seen = new Set<string>();
      let focusVisible = true;
      const record = async (): Promise<void> => {
        const f = await focused(page);
        if (f === '') return;
        seen.add(f);
        const vis = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (el === null) return false;
          const st = getComputedStyle(el);
          return (
            el.classList.contains('is-focus') ||
            st.outlineStyle !== 'none' ||
            st.boxShadow !== 'none'
          );
        });
        focusVisible &&= vis;
      };
      // Every group (Tab), then every direction inside it, stopping if the screen changes.
      walk: for (let g = 0; g < 8; g++) {
        for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
          for (let i = 0; i < 14; i++) {
            await record();
            await page.keyboard.press(k);
            if ((await screen(page)) !== (id === 'run-lost' ? 'run-end' : id)) break walk;
          }
        }
        await record();
        await page.keyboard.press('Tab');
      }
      // Leave every arrow press undone by going back where Esc applies.
      const before = await screen(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const after = await screen(page);
      const missing = visible.filter((v) => !seen.has(v));
      rows.push({
        screen: id,
        visible: visible.length,
        reached: seen.size,
        missing,
        focusVisible,
        esc: `${before} -> ${after}`,
      });
      await page.screenshot({ path: `${A11Y}/a07-${id}.png` });
    }
    results['A-07'] = rows;
    console.log(`[A-07]\n${rows.map((r) => JSON.stringify(r)).join('\n')}`);
    expect(await pointerEvents(page)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('A-10 and E-14: settings from pause apply at once, keep the sim hash, and persist', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const problems = watchProblems(page);
    const log: string[] = [];
    await bootWith(page, { access: { reduceEffects: false } });
    await startRunByKeys(page);
    await page.keyboard.press('Escape');
    await expect.poll(() => screen(page)).toBe('pause');
    const h0 = await page.evaluate(() => window.__shardfall?.getStateHash());
    await reach(page, 'pause-settings');
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe('settings');
    // Graphics: quality one step left. Audio: master one step left. Access: every toggle once.
    const change = async (tab: string, row: string): Promise<void> => {
      await reach(page, `settings-tab-${tab}`);
      await page.keyboard.press('Enter');
      await reach(page, `setting-${row}`);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(80);
    };
    await change('graphics', 'quality');
    await change('audio', 'master');
    for (const row of [
      'textScale',
      'reduceEffects',
      'damageNumbers',
      'colorVision',
      'showFlavor',
      'solidPanels',
    ])
      await change('access', row);
    const live = await page.evaluate(() => {
      const ui = document.querySelector('.sf-ui');
      return {
        cv: (ui as HTMLElement | null)?.dataset['cv'],
        reduce: ui?.classList.contains('reduce-effects'),
        solid: ui?.classList.contains('solid-panels'),
      };
    });
    const saved = await settingsSaved(page);
    log.push(`live UI after change: ${JSON.stringify(live)}`);
    log.push(
      `saved: graphics ${JSON.stringify(saved['graphics'])} audio.master ${String(saved['audio']?.['master'])} access ${JSON.stringify(saved['access'])}`,
    );
    await page.screenshot({ path: `${A11Y}/a10-settings-access.png` });
    await page.keyboard.press('Escape');
    await expect.poll(() => screen(page)).toBe('pause');
    const h1 = await page.evaluate(() => window.__shardfall?.getStateHash());
    log.push(`sim hash in pause before and after settings: ${h0} ${h1}`);
    expect(h1).toBe(h0);
    // Reload: every value is kept.
    await page.reload();
    await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
    const after = await settingsSaved(page);
    const same = JSON.stringify(after) === JSON.stringify(saved);
    log.push(`settings identical after reload: ${String(same)}`);
    expect(same).toBe(true);
    results['A-10/E-14'] = log;
    expect(problems).toEqual([]);
  });

  test('E-17: resizing during a Pulse keeps integer pixel scale, the HUD, and no errors', async ({
    page,
  }) => {
    const problems = watchProblems(page);
    await bootWith(page, { access: { reduceEffects: false } });
    await startRunByKeys(page);
    const rows: string[] = [];
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const c = document.querySelector('canvas#game') as HTMLCanvasElement;
        const hud = document.querySelector('.hud, [data-screen="pulse"]')?.getBoundingClientRect();
        return {
          canvas: [c.width, c.height],
          css: [c.clientWidth, c.clientHeight],
          hudVisible: hud !== undefined && hud.width > 0,
        };
      });
      const issues = await layoutIssues(page);
      rows.push(
        `${size.width}x${size.height}: ${JSON.stringify(r)} layout issues ${issues.length}`,
      );
      await page.screenshot({ path: `${A11Y}/e17-${size.width}x${size.height}.png` });
      expect(r.hudVisible).toBe(true);
    }
    results['E-17'] = rows;
    expect(problems).toEqual([]);
  });
});

test('E-16 and A-06 step 3: a minimized (hidden) window pauses the run, and it resumes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const problems = watchProblems(page);
  await bootWith(page, { access: { reduceEffects: false } });
  await startRunByKeys(page);
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = (await cdp.send('Browser.getWindowForTarget')) as { windowId: number };
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  await page.waitForTimeout(800);
  const vis = await page.evaluate(() => document.visibilityState);
  const a = await snap(page);
  await page.waitForTimeout(1500);
  const b = await snap(page);
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(800);
  const c = await snap(page);
  const log = [
    `minimized: visibility ${vis}, screen ${a.screen}, tick ${a.tick} -> ${b.tick}; restored: screen ${c.screen}, tick ${c.tick}`,
  ];
  if (vis === 'hidden') {
    expect(b.tick).toBe(a.tick);
  } else {
    // Playwright Chromium disables window backgrounding, so the page never becomes hidden. Simulate
    // it through the same path the app listens to: document.hidden plus a visibilitychange event.
    const hide = async (on: boolean): Promise<void> => {
      await page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => (h ? 'hidden' : 'visible'),
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }, on);
    };
    await hide(true);
    await page.waitForTimeout(300);
    const d = await snap(page);
    await page.waitForTimeout(1500);
    const e = await snap(page);
    await hide(false);
    await page.waitForTimeout(400);
    const f = await snap(page);
    await page.waitForTimeout(2500);
    const g = await snap(page);
    log.push(
      `simulated hidden: screen ${d.screen}, tick ${d.tick} -> ${e.tick}; visible again: screen ${f.screen}, tick ${f.tick} -> ${g.tick}`,
    );
    expect(e.tick, 'tick frozen while hidden').toBe(d.tick);
  }
  results['E-16'] = log;
  console.log(log.join(' | '));
  expect(problems).toEqual([]);
});

test('A-11: prefers-reduced-motion turns Reduce Effects on at first launch only', async ({
  browser,
}) => {
  const out: string[] = [];
  for (const rm of ['reduce', 'no-preference'] as const) {
    const ctx = await browser.newContext({
      reducedMotion: rm,
      viewport: { width: 1280, height: 720 },
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
    const on = await page.evaluate(
      () => document.querySelector('.sf-ui')?.classList.contains('reduce-effects') ?? null,
    );
    out.push(`${rm}: reduce-effects ${String(on)}`);
    expect(on).toBe(rm === 'reduce');
    await ctx.close();
  }
  results['A-11'] = out;
});

test.describe('text size A-05', () => {
  const SIZES = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ];
  for (const scale of [0, 1, 2] as const) {
    test(`A-05 text scale ${scale}: no clipped, overlapping, or offscreen text`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const problems = watchProblems(page);
      const rows: Record<string, LayoutIssue[] | number> = {};
      for (const size of SIZES) {
        await page.setViewportSize(size);
        await bootWith(page, { access: { textScale: scale, reduceEffects: false } });
        await page.evaluate(() => window.__shardfall?.pauseLoop());
        for (const id of [
          'glazier',
          'level-up',
          'settings',
          'pulse',
          'run-lost',
          'warden-reward',
        ] as const) {
          await page.evaluate((s) => window.__shardfall?.goToScreen(s as never), id);
          await page.waitForTimeout(250);
          const issues = (await layoutIssues(page)).filter(
            (i) => i.kind !== 'overlap' || !/live-region/.test(i.what),
          );
          if (issues.length > 0) rows[`${id}@${size.width}x${size.height}`] = issues;
          if (size.width === 1280 && (scale === 2 || id === 'glazier'))
            await page.screenshot({ path: `${A11Y}/a05-scale${scale}-${id}-1280x720.png` });
        }
        if (size.width === 1280 && scale === 0) {
          // Cap height of body text ("H") in the font and size the Glazier card text uses.
          await page.evaluate(() => window.__shardfall?.goToScreen('glazier'));
          const cap = await page.evaluate(() => {
            const el = document.querySelector<HTMLElement>(
              '.sf-ui .card-desc, .sf-ui .card-name, .sf-ui p',
            );
            if (el === null) return -1;
            const st = getComputedStyle(el);
            const c = document.createElement('canvas').getContext('2d');
            if (c === null) return -1;
            c.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
            const m = c.measureText('H');
            return m.actualBoundingBoxAscent;
          });
          rows['capHeightPx@1280x720'] = cap;
        }
      }
      results[`A-05 scale ${scale}`] = rows;
      console.log(`[A-05 scale ${scale}] ${JSON.stringify(rows).slice(0, 1500)}`);
      expect(problems).toEqual([]);
    });
  }
});

test.describe('effects on the GPU', () => {
  test.use({ viewport: { width: 960, height: 540 } });

  test('A-02 step 4 frames: Pulse open, Rite, hits, boss phase, Pulse close (Reduce Effects off and on)', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const problems = watchProblems(page);
    for (const reduce of [false, true]) {
      await bootWith(page, { graphics: { quality: 'high' }, access: { reduceEffects: reduce } });
      const dir = `${A11Y}/flash-${reduce ? 'reduce' : 'normal'}`;
      mkdirSync(dir, { recursive: true });
      let n = 0;
      const frames = async (count: number, input?: Record<string, number>): Promise<void> => {
        for (let i = 0; i < count; i++) {
          await page.evaluate((inp) => window.__shardfall?.step(1, inp), input ?? {});
          await page.screenshot({
            path: `${dir}/f${String(n++).padStart(4, '0')}.jpg`,
            type: 'jpeg',
            quality: 70,
          });
        }
      };
      // Pulse open wave, then a crowd with Rite casts and hits on the player.
      await freshRun(page, 77);
      await frames(90);
      await page.evaluate(() => window.__shardfall?.spawnStress('peak'));
      await frames(30, { pressed: 1 });
      await frames(60);
      // Pulse close flash.
      await page.evaluate(() => window.__shardfall?.send({ type: 'debug.endPulse' }));
      await frames(60);
      // Boss phase change: Pulse 15, boss to half HP.
      await page.evaluate(() => {
        const h = window.__shardfall;
        if (h === undefined) return;
        for (let g = 0; g < 4000; g++) {
          const s = h.getSnapshot();
          if (s.phase === 'pulse' && s.pulseIndex === 14) break;
          if (s.phase === 'pulse') h.send({ type: 'debug.endPulse' });
          else if (s.phase === 'reward') h.send({ type: 'reward.pick', choice: 0 });
          else if (s.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
          else if (s.phase === 'shop') h.send({ type: 'pulse.begin' });
          h.step(5);
        }
        h.step(300);
        h.grantItem('echo_bell', 4);
        h.grantItem('chain_spark', 4);
      });
      await frames(240, { pressed: 1 });
      results[`A-02 frames ${reduce ? 'reduce' : 'normal'}`] = n;
    }
    expect(problems).toEqual([]);
  });

  test('A-03: damage numbers off draws none; on never covers the player sprite (20 frames, diff)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const problems = watchProblems(page);
    for (const dmg of [true, false]) {
      await bootWith(page, {
        graphics: { quality: 'high' },
        access: { reduceEffects: false, damageNumbers: dmg },
      });
      await freshRun(page, 5);
      await page.evaluate(() => {
        const h = window.__shardfall;
        h?.spawnStress('peak');
        h?.step(40);
      });
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.__shardfall?.step(2));
        const p = await page.evaluate(() => window.__shardfall?.getScreenPositions().player);
        await page.screenshot({
          path: `${A11Y}/dmg-${dmg ? 'on' : 'off'}-${String(i).padStart(2, '0')}.png`,
        });
        if (i === 0) writeFileSync(`${A11Y}/dmg-player.json`, JSON.stringify(p));
      }
      const saved = await settingsSaved(page);
      expect(saved['access']?.['damageNumbers']).toBe(dmg);
    }
    expect(problems).toEqual([]);
  });
});

test('A-12: Temper, Glazier, Pause, Settings have no timer (60 s each)', async ({ page }) => {
  test.skip(process.env['QA_LONG'] !== '1', 'opt-in: QA_LONG=1 (4 minutes)');
  test.setTimeout(330_000);
  const problems = watchProblems(page);
  const log: string[] = [];
  await bootWith(page, { access: { reduceEffects: false } });
  await startRunByKeys(page);
  const idle = async (what: string): Promise<void> => {
    const a = await snap(page);
    await page.waitForTimeout(60_000);
    const b = await snap(page);
    log.push(`${what}: screen ${a.screen} -> ${b.screen}, tick ${a.tick} -> ${b.tick}`);
    expect(b.screen).toBe(a.screen);
    expect.soft(b.tick, `${what}: sim tick while idle`).toBe(a.tick);
  };
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    h.pauseLoop();
    h.send({ type: 'debug.xp', amount: 9999 });
    h.step(1);
    h.send({ type: 'debug.endPulse' });
    h.step(120);
    h.resumeLoop();
  });
  await expect.poll(() => screen(page)).toBe('level-up');
  await idle('Temper');
  for (let i = 0; i < 120 && (await screen(page)) === 'level-up'; i++) {
    await page.waitForTimeout(320);
    if ((await screen(page)) === 'level-up') await page.keyboard.press('Enter');
  }
  await expect.poll(() => screen(page)).toBe('glazier');
  await idle('Glazier');
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('pause');
  await idle('Pause');
  await reach(page, 'pause-settings');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('settings');
  await idle('Settings');
  results['A-12'] = log;
  expect(problems).toEqual([]);
});
