// QA M5 accessibility captures for the M4 checklist items not measured in M3:
// A-08 (text and focus contrast): screenshots of the Glazier, Temper, Settings, Pulse HUD at the
// peak (bright and dark arena behind the HUD), run end, and title at 1280x720 with the boxes of every
// text leaf and of the focused control; tests/e2e/support/m5_contrast.py measures them.
// A-09 (visual equivalent of every informative sound, Master 0): before and after frames of player
// hit, level up, Memento gained, Pulse near its end, Warden and boss arrival; the HUD and arena
// regions that change are measured here.
// Real GPU. Raw evidence goes to tests/out/qa/m5/a11y/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EVIDENCE, snap, watchProblems } from './support/qa.ts';
import { GPU_ARGS, advanceToPulse, bootWith, freshRun } from './support/m3.ts';

test.use({ viewport: { width: 1280, height: 720 }, launchOptions: { args: GPU_ARGS } });

const OUT = `${EVIDENCE}/m5/a11y`;
mkdirSync(OUT, { recursive: true });

/** Text leaves (elements with their own text) and the focused control, in CSS px. */
async function textBoxes(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const root = document.querySelector('#ui-root');
    const texts: Record<string, unknown>[] = [];
    if (root !== null)
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.closest('.live-region') !== null) continue;
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent ?? '').trim())
          .join(' ')
          .trim();
        if (own === '') continue;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        let opacity = 1;
        for (let e: HTMLElement | null = el; e !== null; e = e.parentElement)
          opacity *= Number(getComputedStyle(e).opacity);
        if (opacity === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const dimClass = el.closest(
          '.is-unaffordable, .is-disabled, .is-locked, .is-taken, .card-empty, [aria-disabled="true"]',
        );
        texts.push({
          text: own.slice(0, 40),
          ui: el.closest<HTMLElement>('[data-ui]')?.dataset['ui'] ?? '',
          cls: typeof el.className === 'string' ? el.className : '',
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          fontPx: parseFloat(st.fontSize),
          opacity,
          dim: opacity < 0.95 || dimClass !== null,
        });
      }
    const a = document.activeElement as HTMLElement | null;
    const fr = a?.getBoundingClientRect();
    return {
      texts,
      focus:
        a === null || fr === undefined || a === document.body
          ? null
          : { ui: a.dataset['ui'] ?? '', x: fr.x, y: fr.y, w: fr.width, h: fr.height },
    };
  });
}

async function captureA08(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.__shardfall?.step(0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/a08-${name}.png` });
  writeFileSync(`${OUT}/a08-${name}.json`, `${JSON.stringify(await textBoxes(page))}\n`);
}

test('A-08 captures: text leaves and focus on six screens (1280x720, Normal text)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = watchProblems(page);
  await bootWith(page, { access: { reduceEffects: false } });
  await page.evaluate(() => window.__shardfall?.pauseLoop());
  for (const id of ['title', 'level-up', 'glazier', 'run-lost'] as const) {
    await page.evaluate((s) => window.__shardfall?.goToScreen(s), id);
    await captureA08(page, id);
  }
  await page.evaluate(() => window.__shardfall?.goToScreen('title'));
  await page.evaluate(() => window.__shardfall?.goToScreen('settings'));
  for (let i = 0; i < 6; i++) {
    const tab = await page.evaluate(
      () => document.querySelector<HTMLElement>('#ui-root .tab.is-active')?.dataset['ui'] ?? '',
    );
    if (tab === 'settings-tab-access') break;
    await page.keyboard.press('KeyE');
  }
  await captureA08(page, 'settings-access');
  // HUD over the peak scene: Pulse 11, stress spawn; the player stands on the arena's lit centre,
  // then near the dark lower edge, so the top HUD sees bright and dark floor behind it.
  await freshRun(page, 5);
  await advanceToPulse(page, 10);
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    h.spawnStress('peak');
    h.step(60);
  });
  await captureA08(page, 'pulse-peak');
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    for (let i = 0; i < 90; i++) {
      h.send({ type: 'debug.setHp', hp: h.getSnapshot().maxHp });
      h.step(1, { moveX: 0, moveY: 127, held: 0, pressed: 0, aimX: 0, aimY: 0 });
    }
  });
  await captureA08(page, 'pulse-peak-edge');
  expect(problems).toEqual([]);
});

/** Mean absolute RGB change between two screenshots inside a CSS box (device scale 1). */
async function regionDiff(page: Page, a: Buffer, b: Buffer, box: number[]): Promise<number> {
  return page.evaluate(
    async ([ia, ib, bx]) => {
      const load = async (b64: string): Promise<ImageData> => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (ctx === null) throw new Error('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
      };
      const A = await load(ia);
      const B = await load(ib);
      const [x0, y0, w, h] = bx as [number, number, number, number];
      let sum = 0;
      let n = 0;
      for (let y = Math.max(0, y0); y < Math.min(A.height, y0 + h); y++)
        for (let x = Math.max(0, x0); x < Math.min(A.width, x0 + w); x++) {
          const i = (y * A.width + x) * 4;
          sum +=
            Math.abs((A.data[i] ?? 0) - (B.data[i] ?? 0)) +
            Math.abs((A.data[i + 1] ?? 0) - (B.data[i + 1] ?? 0)) +
            Math.abs((A.data[i + 2] ?? 0) - (B.data[i + 2] ?? 0));
          n++;
        }
      return n === 0 ? 0 : sum / n / 3;
    },
    [a.toString('base64'), b.toString('base64'), box] as const,
  );
}

async function boxOf(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r === undefined
      ? [0, 0, 0, 0]
      : [Math.floor(r.x) - 4, Math.floor(r.y) - 4, Math.ceil(r.width) + 8, Math.ceil(r.height) + 8];
  }, selector);
}

test('A-09: with Master at 0 every informative sound has a visual sign', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watchProblems(page);
  const rows: Record<string, unknown>[] = [];
  await bootWith(page, {
    audio: { master: 0 },
    access: { reduceEffects: false, damageNumbers: false },
  });
  const settle = async (): Promise<void> => {
    await page.evaluate(() => window.__shardfall?.step(0));
    await page.waitForTimeout(120);
  };
  const shot = async (name: string): Promise<Buffer> => {
    await settle();
    return page.screenshot({ path: `${OUT}/a09-${name}.png` });
  };
  const record = async (
    event: string,
    sign: string,
    selector: string,
    before: Buffer,
    after: Buffer,
  ): Promise<void> => {
    const box = await boxOf(page, selector);
    const d = await regionDiff(page, before, after, box);
    rows.push({ event, sign, region: selector, box, meanAbsDiff: Number(d.toFixed(2)) });
  };
  const full = [0, 0, 1280, 720];

  // Player hit: HP bar flash and screen edge flash.
  await freshRun(page, 7);
  await page.evaluate(() => window.__shardfall?.step(30));
  let b = await shot('hit-before');
  // A real hit: stand still among spawned Unlit until HP drops, then capture that frame.
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    h.spawnStress('peak');
    const hp0 = h.getSnapshot().hp;
    for (let t = 0; t < 600 && h.getSnapshot().hp >= hp0; t++) h.step(1);
  });
  let a = await shot('hit-after');
  const hpSel = '#ui-root .bar-hp';
  await record('player hit', 'HP bar white flash, red screen edge', hpSel, b, a);
  rows.push({
    event: 'player hit (whole screen)',
    meanAbsDiff: Number((await regionDiff(page, b, a, full)).toFixed(2)),
  });

  // Level up: Lv line blinks gold.
  await freshRun(page, 8);
  await page.evaluate(() => window.__shardfall?.step(30));
  b = await shot('levelup-before');
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    h.send({ type: 'debug.xp', amount: 9999 });
    h.step(2);
  });
  a = await shot('levelup-after');
  const lvSel = '#ui-root .hud-lv';
  await record('level up', 'Lv line blinks gold', lvSel, b, a);
  const lv = await snap(page);
  rows.push({ event: 'level up (state)', level: lv.level });

  // Memento gained (chest pick): the build list and the reward screen change.
  await freshRun(page, 9);
  b = await shot('memento-before');
  await page.evaluate(() => window.__shardfall?.grantItem('glass_marble'));
  a = await shot('memento-after');
  rows.push({
    event: 'Memento gained (grant, HUD)',
    sign: 'see screenshot',
    meanAbsDiff: Number((await regionDiff(page, b, a, full)).toFixed(2)),
  });

  // Pulse near its end: timer under 5 s.
  await freshRun(page, 10);
  const len = await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return 0;
    let n = 0;
    // Step until the HUD timer reads 0:06, then 0:03.
    for (; n < 4000; n++) {
      const t = document.querySelector('#ui-root .timer')?.textContent ?? '';
      if (/0:06/.test(t)) break;
      h.send({ type: 'debug.setHp', hp: h.getSnapshot().maxHp });
      h.step(1);
      if (n % 10 === 0) h.step(0);
    }
    return n;
  });
  b = await shot('pulse-end-before');
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    for (let i = 0; i < 180; i++) {
      h.send({ type: 'debug.setHp', hp: h.getSnapshot().maxHp });
      h.step(1);
    }
  });
  a = await shot('pulse-end-after');
  await record('Pulse near its end', 'timer state', '#ui-root .timer', b, a);
  rows.push({ event: 'Pulse near its end (ticks to 0:06)', ticks: len });

  // Warden and boss arrival: name banner.
  for (const [name, seed, pulse] of [
    ['warden', 11, 3],
    ['boss', 31, 14],
  ] as const) {
    await freshRun(page, seed);
    await advanceToPulse(page, pulse);
    b = await shot(`${name}-before`);
    const arrived = await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) return -1;
      for (let t = 0; t < 4000; t++) {
        const txt = document.querySelector('.hud-banner .banner-main')?.textContent ?? '';
        if (txt !== '' && !/^Wave/.test(txt)) return t;
        h.send({ type: 'debug.setHp', hp: h.getSnapshot().maxHp });
        h.step(1);
        h.step(0);
      }
      return -1;
    });
    a = await shot(`${name}-after`);
    await record(`${name} arrival`, 'name banner', '#ui-root .hud-banner', b, a);
    rows.push({
      event: `${name} arrival (banner)`,
      ticks: arrived,
      text: await page.evaluate(
        () => document.querySelector('.hud-banner')?.textContent.trim() ?? '',
      ),
    });
  }
  writeFileSync(`${OUT}/a09.json`, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`[A-09]\n${rows.map((r) => JSON.stringify(r)).join('\n')}`);
  expect(problems).toEqual([]);
});
