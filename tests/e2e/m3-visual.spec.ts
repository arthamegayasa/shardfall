// QA M3 visual captures (M2 items deferred from M1 and M3 checks): 1 s glance frames (test-plan 10,
// brief S-1: crowded Pulse, Warden, boss, telegraphs stacked on the player, late Pulse), the same peak
// scene at Low, Medium, High, Reduce Effects, and each colour vision mode, and the draw-order scene
// (8.6). Reduce Effects is set off explicitly: playwright.config.ts emulates prefers-reduced-motion,
// which turns it on by default (A-11). Real GPU through ANGLE (headless SwiftShader would cap quality at Low). Images and hook
// answers go to tests/out/qa/m3/; analysis is done by QA scripts and the proxy tester.

import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { watchProblems } from './support/qa.ts';
import {
  GPU_ARGS,
  M3_OUT,
  advanceToPulse,
  bootWith,
  capture,
  freshRun,
  gpuName,
  stepUntilNear,
} from './support/m3.ts';
import type { SettingsPatch } from './support/m3.ts';

test.use({ viewport: { width: 1920, height: 1080 }, launchOptions: { args: GPU_ARGS } });

/** Same peak scene for every quality and mode: seed 5, spawnStress('peak'), 1 s later. */
async function peakScene(page: Page): Promise<void> {
  await freshRun(page, 5);
  await page.evaluate(() => {
    const h = window.__shardfall;
    h?.spawnStress('peak');
    h?.step(60);
  });
}

/** Ring of Unlit around the player (world u offsets). */
async function ring(page: Page, enemyId: string, n: number, r: number): Promise<void> {
  await page.evaluate(
    ([id, count, radius]) => {
      const h = window.__shardfall;
      if (h === undefined) return;
      // Player world position is not in the snapshot screen space; the snapshot has world x, y.
      const s = h.getSnapshot();
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        h.send({
          type: 'debug.spawn',
          enemyId: id,
          x: s.player.x + Math.cos(a) * radius,
          y: s.player.y + Math.sin(a) * radius * 0.7,
          count: 1,
        });
      }
      h.step(1);
    },
    [enemyId, n, r] as const,
  );
}

// QA M5-04 (A-04 step 5 per mode): QA_CV=protan|deutan|tritan captures the same five glance scenes with
// Color Vision set to that mode, under the names cv-<mode>-glance-*. Unset: mode Off, original names.
const GLANCE_CV = process.env['QA_CV'] ?? 'off';
const glanceName = (name: string): string =>
  GLANCE_CV === 'off' ? name : `cv-${GLANCE_CV}-${name}`;

test('M3 glance frames (1920x1080, High)', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watchProblems(page);
  await bootWith(page, {
    graphics: { quality: 'high' },
    access: { reduceEffects: false, colorVision: GLANCE_CV },
  });
  console.log(`[m3-visual] GPU: ${await gpuName(page)} colour vision: ${GLANCE_CV}`);

  // G1 crowded Pulse: last normal Pulse composition and a late build.
  await peakScene(page);
  const g1 = await capture(page, glanceName('glance-1-peak'));

  // G2 Warden Pulse 4 (index 3) with the Warden on screen and a telegraph if one comes.
  await freshRun(page, 21);
  await advanceToPulse(page, 3);
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    for (let t = 0; t < 1800; t++) {
      const s = h.getSnapshot();
      h.send({ type: 'debug.setHp', hp: s.maxHp });
      const p = h.getScreenPositions();
      if (p.enemies.some((e) => e.rank === 1) && p.dangerAreas.length > 0 && t > 240) return;
      h.step(1);
    }
  });
  const g2 = await capture(page, glanceName('glance-2-warden'));

  // G3 boss Pulse 15 (index 14) during a pattern with telegraphs.
  await freshRun(page, 31);
  await advanceToPulse(page, 14);
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    for (let t = 0; t < 3000; t++) {
      const s = h.getSnapshot();
      h.send({ type: 'debug.setHp', hp: s.maxHp });
      const p = h.getScreenPositions();
      if (p.enemies.some((e) => e.rank === 2) && p.dangerAreas.length >= 3 && t > 400) return;
      h.step(1);
    }
  });
  const g3 = await capture(page, glanceName('glance-3-boss'));

  // G4 telegraphs stacked on the player (K3, S-4): chargers and shooters close around the player.
  await freshRun(page, 41);
  await advanceToPulse(page, 6);
  await ring(page, 'charger', 6, 2.6);
  await ring(page, 'shooter', 4, 4);
  const found = await stepUntilNear(page, 900, 2, 110);
  const g4 = await capture(page, glanceName('glance-4-stack'));

  // G5 late Pulse 13 (index 12) after 20 s with the starter build: the crowd builds up.
  await freshRun(page, 51);
  await advanceToPulse(page, 12);
  await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return;
    for (let t = 0; t < 1200; t += 10) {
      h.send({ type: 'debug.setHp', hp: h.getSnapshot().maxHp });
      h.step(10);
    }
  });
  const g5 = await capture(page, glanceName('glance-5-late'));

  for (const g of [g1, g2, g3, g4, g5])
    console.log(
      `[m3-visual] ${g.name}: ${JSON.stringify(g.counts)} nearest ${JSON.stringify(g.nearest)}`,
    );
  console.log(`[m3-visual] G4 stacked telegraphs found after ${found} ticks`);
  expect(g4.dangerAreas.length).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

const MODES: readonly { name: string; patch: SettingsPatch }[] = [
  { name: 'peak-low', patch: { graphics: { quality: 'low' }, access: { reduceEffects: false } } },
  {
    name: 'peak-medium',
    patch: { graphics: { quality: 'medium' }, access: { reduceEffects: false } },
  },
  { name: 'peak-high', patch: { graphics: { quality: 'high' }, access: { reduceEffects: false } } },
  {
    name: 'peak-reduce',
    patch: { graphics: { quality: 'high' }, access: { reduceEffects: true } },
  },
  {
    name: 'peak-nodmg',
    patch: {
      graphics: { quality: 'high' },
      access: { reduceEffects: false, damageNumbers: false },
    },
  },
  {
    name: 'peak-protan',
    patch: {
      graphics: { quality: 'high' },
      access: { reduceEffects: false, colorVision: 'protan' },
    },
  },
  {
    name: 'peak-deutan',
    patch: {
      graphics: { quality: 'high' },
      access: { reduceEffects: false, colorVision: 'deutan' },
    },
  },
  {
    name: 'peak-tritan',
    patch: {
      graphics: { quality: 'high' },
      access: { reduceEffects: false, colorVision: 'tritan' },
    },
  },
];

test('M3 peak scene per quality, Reduce Effects, damage numbers off, colour vision modes', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = watchProblems(page);
  const rows: string[] = [];
  for (const m of MODES) {
    await bootWith(page, m.patch);
    await peakScene(page);
    const hashAfter = await page.evaluate(() => window.__shardfall?.getStateHash() ?? '');
    const a = await capture(page, m.name);
    const perf = await page.evaluate(() => window.__shardfall?.getPerf());
    rows.push(
      `${m.name}: hash ${hashAfter} drawCalls ${perf?.drawCalls ?? -1} triangles ${perf?.triangles ?? -1} enemies ${a.counts['enemies'] ?? -1}`,
    );
  }
  console.log(`[m3-visual modes]\n${rows.join('\n')}`);
  // Display settings never touch the sim: the same scene gives the same state hash in every mode.
  const hashes = new Set(rows.map((r) => r.split(' ')[2]));
  expect(hashes.size, rows.join('\n')).toBe(1);
  expect(problems).toEqual([]);
});

test('M3 draw order: enemy shots under the Rite stay visible (8.6, P2-f)', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = watchProblems(page);
  await bootWith(page, { graphics: { quality: 'high' }, access: { reduceEffects: false } });
  await freshRun(page, 61);
  await advanceToPulse(page, 4);
  await ring(page, 'shooter', 8, 3.2);
  // Wait for enemy shots close to the player, then cast the Rite (pressed bit) and capture mid-flare.
  const t = await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) return -1;
    for (let k = 0; k < 900; k++) {
      h.send({ type: 'debug.setHp', hp: h.getSnapshot().maxHp });
      const p = h.getScreenPositions();
      const close = p.enemyShots.filter(
        (s) => Math.hypot(s.x - p.player.x, s.y - p.player.y) < 160,
      ).length;
      if (close >= 3) return k;
      h.step(1);
    }
    return -1;
  });
  const before = await capture(page, 'shots-before-rite');
  await page.evaluate(() => {
    const h = window.__shardfall;
    h?.step(1, { pressed: 1 });
    h?.step(4);
  });
  const a = await capture(page, 'draworder-rite');
  console.log(
    `[m3-visual draw order] shots near after ${t} ticks: ${before.enemyShots.length} before, ${a.enemyShots.length} under the Rite`,
  );
  expect(problems).toEqual([]);
});

test('CW-4 UI colour audit: danger red and magenta only on low HP and boss warnings; poor prices dim', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = watchProblems(page);
  await bootWith(page, { graphics: { quality: 'high' }, access: { reduceEffects: false } });
  await page.evaluate(() => window.__shardfall?.pauseLoop());
  const scan = (): Promise<string[]> =>
    page.evaluate(() => {
      const near = (c: string, t: [number, number, number]): boolean => {
        const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c);
        if (m === null) return false;
        if (m[4] !== undefined && Number(m[4]) < 0.2) return false;
        return (
          Math.abs(Number(m[1]) - t[0]) +
            Math.abs(Number(m[2]) - t[1]) +
            Math.abs(Number(m[3]) - t[2]) <
          60
        );
      };
      const RED: [number, number, number] = [0xff, 0x3b, 0x4e];
      const MAG: [number, number, number] = [0xff, 0x2e, 0x9a];
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('#ui-root *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0)
          continue;
        for (const [prop, val] of [
          ['color', st.color],
          ['background', st.backgroundColor],
          ['border', st.borderTopColor],
          ['outline', st.outlineColor],
        ] as const) {
          if (prop === 'border' && st.borderTopWidth === '0px') continue;
          if (prop === 'outline' && st.outlineStyle === 'none') continue;
          if (prop === 'color' && el.textContent.trim() === '') continue;
          const which = near(val, RED) ? 'red' : near(val, MAG) ? 'magenta' : '';
          if (which !== '')
            out.push(
              `${which} ${prop}: ${el.dataset['ui'] ?? ''}.${el.className.split(' ').slice(0, 2).join('.')} "${el.textContent.trim().slice(0, 24)}"`,
            );
        }
      }
      return [...new Set(out)];
    });
  const rows: Record<string, string[]> = {};
  for (const id of [
    'title',
    'class-select',
    'settings',
    'archive',
    'pause',
    'glazier',
    'level-up',
    'warden-reward',
    'run-lost',
  ] as const) {
    await page.evaluate((s) => window.__shardfall?.goToScreen(s as never), id);
    await page.waitForTimeout(300);
    rows[id] = await scan();
  }
  // Pulse at full HP, at low HP, and in the boss Pulse.
  await freshRun(page, 3);
  await page.evaluate(() => window.__shardfall?.step(30));
  rows['pulse-full-hp'] = await scan();
  await page.evaluate(() => {
    const h = window.__shardfall;
    h?.send({ type: 'debug.setHp', hp: 3 });
    h?.step(10);
  });
  rows['pulse-low-hp'] = await scan();
  await capture(page, 'cw4-low-hp');
  await freshRun(page, 3);
  await advanceToPulse(page, 14);
  await page.evaluate(() => window.__shardfall?.step(400));
  rows['pulse-boss'] = await scan();
  // Poor prices in the Glazier: dim colour plus a non-colour mark (ui-spec 9).
  await page.evaluate(() => window.__shardfall?.goToScreen('glazier'));
  await page.waitForTimeout(300);
  rows['glazier-poor-prices'] = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-ui^="shop-offer-"]')].map((o) => {
      const price = o.querySelector<HTMLElement>('.card-price, .price');
      const st = price === null ? null : getComputedStyle(price);
      return `${o.dataset['ui'] ?? ''} class "${o.className}" price "${price?.textContent.trim() ?? ''}" color ${st?.color ?? '-'} opacity ${st?.opacity ?? '-'} classes "${price?.className ?? ''}"`;
    }),
  );
  writeFileSync(`${M3_OUT}/cw4-ui-colours.json`, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`[CW-4] ${JSON.stringify(rows, null, 1).slice(0, 4000)}`);
  expect(problems).toEqual([]);
});
