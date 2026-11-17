// QA M5 release tests (M5-02): retests of BUG-006 to BUG-013 in the real e2e build, a per-screen
// keyboard reachability search (A-07, replaces the fixed cycle walk of m3-a11y.spec.ts as the
// reachability measure; that walk stays as it was), and the release play-through: one full run per
// class with real keys (the live loop sped up with setTimeScale only), autosave and Continue after a
// reload, Silt unlocks in The Keeping, and Low quality plus Reduce Effects kept after a reload.
// Long tests are opt-in with QA_LONG=1. Raw evidence goes to tests/out/qa/m5/.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  EVIDENCE,
  focused,
  installPointerBlocker,
  pointerEvents,
  screen,
  snap,
  watchProblems,
} from './support/qa.ts';
import { GPU_ARGS, SETTINGS_KEY, advanceToPulse, bootWith, freshRun } from './support/m3.ts';
import { replayInNode } from './support/node-sim.ts';

test.use({ viewport: { width: 1920, height: 1080 }, launchOptions: { args: GPU_ARGS } });

const OUT = `${EVIDENCE}/m5`;
mkdirSync(OUT, { recursive: true });
const LONG = process.env['QA_LONG'] === '1';

const OPPOSITE: Record<string, string> = {
  ArrowDown: 'ArrowUp',
  ArrowUp: 'ArrowDown',
  ArrowRight: 'ArrowLeft',
  ArrowLeft: 'ArrowRight',
  Tab: 'Shift+Tab',
  'Shift+Tab': 'Tab',
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

async function settingsSaved(page: Page): Promise<Record<string, Record<string, unknown>>> {
  return page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, Record<string, unknown>>,
    SETTINGS_KEY,
  );
}

async function frames(page: Page, n = 2): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const f = (): void => {
          left--;
          if (left <= 0) resolve();
          else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      }),
    n,
  );
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

async function startRunByKeys(page: Page, classId = 'lantern'): Promise<void> {
  await expect.poll(() => screen(page)).toBe('title');
  await focusTo(page, 'title-new-run', 'ArrowDown', 6);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('class-select');
  await focusTo(page, `class-${classId}`, 'ArrowDown', 4);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('pulse');
  await expect.poll(async () => (await snap(page)).phase).toBe('pulse');
  const t = (await snap(page)).tick;
  await expect.poll(async () => (await snap(page)).tick).toBeGreaterThan(t + 2);
}

// ---------------------------------------------------------------------------------------------
// A-07 by breadth-first search (BUG-010 retest)
// ---------------------------------------------------------------------------------------------

const NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Shift+Tab'] as const;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Visible interactive controls (same filter as the M3 A-07 walk) with their boxes. */
async function interactive(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const el of document.querySelectorAll<HTMLElement>(
      '#ui-root button, #ui-root [tabindex], #ui-root [data-ui]',
    )) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const isInteractive = el.tagName === 'BUTTON' || el.tabIndex >= 0;
      if (!isInteractive || r.width === 0 || st.visibility === 'hidden' || st.display === 'none')
        continue;
      if (el.closest('[aria-hidden="true"]') !== null) continue;
      out[el.dataset['ui'] ?? el.tagName] = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    return out;
  });
}

async function focusText(page: Page): Promise<string> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? '');
}

interface ScreenSpec {
  readonly name: string;
  readonly target: string;
  /** Screen id expected while exploring (run-lost shows as run-end). */
  readonly screenId: string;
  /** Settings tab open at the start of the search. */
  readonly tab?: string;
}

const SCREENS: readonly ScreenSpec[] = [
  { name: 'title', target: 'title', screenId: 'title' },
  { name: 'class-select', target: 'class-select', screenId: 'class-select' },
  { name: 'settings-graphics', target: 'settings', screenId: 'settings', tab: 'graphics' },
  { name: 'settings-audio', target: 'settings', screenId: 'settings', tab: 'audio' },
  { name: 'settings-access', target: 'settings', screenId: 'settings', tab: 'access' },
  { name: 'settings-controls', target: 'settings', screenId: 'settings', tab: 'controls' },
  { name: 'archive', target: 'archive', screenId: 'archive' },
  { name: 'credits', target: 'credits', screenId: 'credits' },
  { name: 'pause', target: 'pause', screenId: 'pause' },
  { name: 'level-up', target: 'level-up', screenId: 'level-up' },
  { name: 'glazier', target: 'glazier', screenId: 'glazier' },
  { name: 'warden-reward', target: 'warden-reward', screenId: 'warden-reward' },
  { name: 'run-lost', target: 'run-lost', screenId: 'run-end' },
];

async function resetTo(page: Page, target: string, tab?: string): Promise<void> {
  await page.evaluate(async (t) => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    // Leave first so the target screen is entered again (fresh default focus, no step memory).
    await h.goToScreen(t === 'title' ? 'credits' : 'title');
    await h.goToScreen(t as never);
  }, target);
  await frames(page, 2);
  if (tab !== undefined) {
    // Settings keep the last open tab between visits: switch with Q until the wanted tab is open
    // (Q and E are the documented tab keys; focus lands on the active tab).
    const active = (): Promise<string> =>
      page.evaluate(
        () => document.querySelector<HTMLElement>('#ui-root .tab.is-active')?.dataset['ui'] ?? '',
      );
    for (let i = 0; i < 6 && (await active()) !== `settings-tab-${tab}`; i++) {
      await page.keyboard.press('KeyQ');
      await frames(page, 1);
    }
    expect(await active()).toBe(`settings-tab-${tab}`);
  }
}

interface Edge {
  readonly from: string;
  readonly key: string;
  readonly to: string;
}

interface Exploration {
  readonly screen: string;
  readonly entry: string;
  readonly visible: string[];
  readonly reached: string[];
  readonly missing: string[];
  readonly edges: Edge[];
  readonly paths: Record<string, string[]>;
  readonly boxes: Record<string, Box>;
  readonly reversals: { from: string; key: string; to: string; back: string }[];
  readonly valueRestoreFailed: string[];
}

/**
 * Every control reachable from the entry focus with arrows, Tab, and Shift+Tab (keyboard only; the
 * hooks only build the screen). Online search: from the current focus, walk known edges to the
 * nearest control with an untried key, press it, record where focus lands. Screens that remember
 * focus between visits (The Keeping) need no reset. A key that changes a setting value instead of
 * moving focus is undone with the opposite key so the layout stays the same.
 */
async function explore(page: Page, spec: ScreenSpec): Promise<Exploration> {
  await resetTo(page, spec.target, spec.tab);
  const entry = await focused(page);
  const boxes = await interactive(page);
  const visible = Object.keys(boxes);
  const known = new Map<string, Map<string, string>>();
  const paths = new Map<string, string[]>([[entry, []]]);
  const edges: Edge[] = [];
  const reversals: Exploration['reversals'] = [];
  const valueRestoreFailed: string[] = [];
  const learn = (from: string, key: string, to: string): void => {
    edges.push({ from, key, to });
    let m = known.get(from);
    if (m === undefined) known.set(from, (m = new Map<string, string>()));
    if (!m.has(key)) m.set(key, to);
    if (to !== '' && !to.startsWith('<') && !paths.has(to))
      paths.set(to, [...(paths.get(from) ?? []), key]);
  };
  /** Shortest known key route from cur to a control with an untried key. */
  const plan = (cur: string): { keys: string[]; node: string; key: string } | null => {
    const prev = new Map<string, { from: string; key: string } | null>([[cur, null]]);
    const queue = [cur];
    while (queue.length > 0) {
      const n = queue.shift() ?? '';
      const tried = known.get(n);
      const untried = NAV_KEYS.find((k) => tried?.has(k) !== true);
      if (untried !== undefined) {
        const keys: string[] = [];
        for (let at = n; prev.get(at) !== null;) {
          const p = prev.get(at);
          if (p === undefined || p === null) break;
          keys.unshift(p.key);
          at = p.from;
        }
        return { keys, node: n, key: untried };
      }
      for (const [k, to] of tried ?? []) {
        if (to === '' || to.startsWith('<') || prev.has(to)) continue;
        prev.set(to, { from: n, key: k });
        queue.push(to);
      }
    }
    return null;
  };
  let cur = entry;
  let resets = 0;
  for (let guard = 0; guard < 1500; guard++) {
    let route = plan(cur);
    if (route === null) {
      // Nothing left from here: done, unless untried keys remain elsewhere (reset and retry once).
      const left = [...paths.keys()].some(
        (n) => n !== '' && NAV_KEYS.some((k) => known.get(n)?.has(k) !== true),
      );
      if (!left || resets > 3) break;
      resets++;
      await resetTo(page, spec.target, spec.tab);
      cur = await focused(page);
      route = plan(cur);
      if (route === null) break;
    }
    let off = false;
    for (const k of route.keys) {
      await page.keyboard.press(k);
      await frames(page, 1);
      if ((await screen(page)) !== spec.screenId) {
        off = true;
        break;
      }
    }
    if (off) {
      await resetTo(page, spec.target, spec.tab);
      cur = await focused(page);
      continue;
    }
    cur = await focused(page);
    if (cur !== route.node) continue; // history changed a step: plan again from here
    const text0 = await focusText(page);
    await page.keyboard.press(route.key);
    await frames(page, 1);
    const sc = await screen(page);
    if (sc !== spec.screenId) {
      learn(cur, route.key, `<screen ${sc}>`);
      await resetTo(page, spec.target, spec.tab);
      cur = await focused(page);
      continue;
    }
    const y = await focused(page);
    learn(cur, route.key, y);
    if (y === cur && route.key.startsWith('Arrow') && (await focusText(page)) !== text0) {
      await page.keyboard.press(OPPOSITE[route.key] ?? route.key);
      await frames(page, 1);
      if ((await focusText(page)) !== text0) valueRestoreFailed.push(`${cur} ${route.key}`);
      continue;
    }
    if (route.key.startsWith('Arrow') && y !== cur && y !== '') {
      const opp = OPPOSITE[route.key] ?? route.key;
      await page.keyboard.press(opp);
      await frames(page, 1);
      const back = await focused(page);
      reversals.push({ from: cur, key: route.key, to: y, back });
      learn(y, opp, back);
      cur = back;
    } else {
      cur = y;
    }
    if (cur === '') {
      await resetTo(page, spec.target, spec.tab);
      cur = await focused(page);
    }
  }
  const reached = [...paths.keys()].filter((r) => r !== '');
  return {
    screen: spec.name,
    entry,
    visible,
    reached,
    missing: visible.filter((v) => !paths.has(v)),
    edges,
    paths: Object.fromEntries(paths),
    boxes,
    reversals,
    valueRestoreFailed,
  };
}

/** Nodes that can return to the entry over observed edges (no focus trap). */
function canReturn(ex: Exploration): string[] {
  const back = new Set<string>([ex.entry]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of ex.edges)
      if (!back.has(e.from) && back.has(e.to)) {
        back.add(e.from);
        grew = true;
      }
  }
  return ex.reached.filter((r) => !back.has(r));
}

/** Arrow moves whose target centre is not in the pressed direction (visual order check). */
function directionIssues(ex: Exploration): string[] {
  const out: string[] = [];
  const c = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
  for (const e of ex.edges) {
    if (!e.key.startsWith('Arrow') || e.to === e.from || e.to.startsWith('<')) continue;
    const a = ex.boxes[e.from];
    const b = ex.boxes[e.to];
    if (a === undefined || b === undefined) continue;
    const [ax, ay] = c(a);
    const [bx, by] = c(b);
    const ok =
      (e.key === 'ArrowDown' && by > ay) ||
      (e.key === 'ArrowUp' && by < ay) ||
      (e.key === 'ArrowRight' && bx > ax) ||
      (e.key === 'ArrowLeft' && bx < ax);
    if (!ok) out.push(`${e.from} ${e.key} -> ${e.to}`);
  }
  return out;
}

test('A-07 by search (BUG-010 retest): every control reachable from the entry, no trap, visual order', async ({
  page,
}) => {
  test.setTimeout(1_200_000);
  await installPointerBlocker(page);
  const problems = watchProblems(page);
  await bootWith(page, { access: { reduceEffects: false } });
  await page.evaluate(() => window.__shardfall?.pauseLoop());
  const rows: Record<string, unknown>[] = [];
  const full: Exploration[] = [];
  for (const spec of SCREENS) {
    const ex = await explore(page, spec);
    full.push(ex);
    const reversalFails = ex.reversals.filter((r) => r.back !== r.from);
    rows.push({
      screen: ex.screen,
      entry: ex.entry,
      visible: ex.visible.length,
      reached: ex.reached.length,
      missing: ex.missing,
      cannotReturnToEntry: canReturn(ex),
      directionIssues: directionIssues(ex),
      reversals: `${ex.reversals.length - reversalFails.length}/${ex.reversals.length}`,
      reversalFails: reversalFails.map((r) => `${r.from} ${r.key} -> ${r.to} back ${r.back}`),
      leaves: ex.edges.filter((e) => e.to.startsWith('<')).map((e) => `${e.from} ${e.key}`),
      valueRestoreFailed: ex.valueRestoreFailed,
    });
    await resetTo(page, spec.target, spec.tab);
    await page.screenshot({ path: `${OUT}/a07-${spec.name}.png` });
  }

  // BUG-010 steps as reported in M3 (Glazier, entry Begin Pulse): Up, Up, Down, Down, Right, Left.
  await resetTo(page, 'glazier');
  const seq = [await focused(page)];
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowLeft']) {
    await page.keyboard.press(k);
    await frames(page, 1);
    seq.push(await focused(page));
  }
  // The second half of the report: offer 3, right to lock 3, right to slot 4, left back to lock 3.
  const glazier = full.find((e) => e.screen === 'glazier');
  const lockSeq: string[] = [];
  if (glazier !== undefined) {
    // Offer 1 by Tab, Down twice to offer 3, Right to lock 3 (the route the report describes).
    await resetTo(page, 'glazier');
    for (const k of ['Tab', 'ArrowDown', 'ArrowDown', 'ArrowRight']) {
      await page.keyboard.press(k);
      await frames(page, 1);
    }
    lockSeq.push(await focused(page));
    for (const k of ['ArrowRight', 'ArrowLeft']) {
      await page.keyboard.press(k);
      await frames(page, 1);
      lockSeq.push(await focused(page));
    }
  }
  const lockPath = glazier?.paths['shop-lock-3'];
  const report = { rows, bug010: { reportSteps: seq, lockSteps: lockSeq, lockPath } };
  writeFileSync(`${OUT}/a07-search.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${OUT}/a07-search-graph.json`, `${JSON.stringify(full, null, 1)}\n`);
  console.log(`[A-07 search]\n${rows.map((r) => JSON.stringify(r)).join('\n')}`);
  console.log(`[BUG-010] ${JSON.stringify(report.bug010)}`);

  for (const r of rows) {
    expect(r['missing'], `${String(r['screen'])}: unreachable controls`).toEqual([]);
    expect(r['cannotReturnToEntry'], `${String(r['screen'])}: focus trap`).toEqual([]);
  }
  // Reported sequence: Down undoes Up (slot 3 -> slot 6 -> entry), Right then Left comes back.
  expect(seq[3], 'Down after Up, Up returns to the first Up target').toBe(seq[1]);
  expect(seq[4], 'Down, Down returns to the entry (not a lock button)').toBe(seq[0]);
  // Right from Begin Pulse (rightmost) stays; a move to the right must come back with Left.
  if (seq[5] !== seq[4]) expect(seq[6], 'Right then Left returns').toBe(seq[4]);
  expect(lockSeq[0]).toBe('shop-lock-3');
  expect(lockSeq[2], 'lock 3, Right, Left returns to lock 3').toBe('shop-lock-3');
  expect(await pointerEvents(page)).toEqual([]);
  expect(problems).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// BUG-008, BUG-009
// ---------------------------------------------------------------------------------------------

async function bannerText(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.hud-banner')?.textContent.trim() ?? '');
}

test('BUG-008 retest: the boss banner of an abandoned run never shows in the next run', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const problems = watchProblems(page);
  const log: string[] = [];
  await bootWith(page, { access: { reduceEffects: false } });
  // Hooks build the state: seed 31, Pulse 15 (boss), live loop until the arrival banner shows.
  await freshRun(page, 31);
  await advanceToPulse(page, 14);
  await page.evaluate(() => window.__shardfall?.resumeLoop());
  await expect.poll(() => bannerText(page), { timeout: 30_000 }).toContain('Paper Sun');
  const boss = await bannerText(page);
  log.push(`boss banner: "${boss}" at tick ${(await snap(page)).tick}`);
  await page.screenshot({ path: `${OUT}/bug008-boss-banner.png` });
  // Player path: Esc, Abandon, confirm, Try Again (keys only).
  await abandon(page);
  await page.waitForTimeout(550); // run end entered from a Pulse keeps its 500 ms lock (intended)
  await focusTo(page, 'end-again', 'ArrowLeft', 6);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 20 && (await screen(page)) !== 'pulse'; i++) {
    if ((await screen(page)) === 'class-select') await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await expect.poll(() => screen(page)).toBe('pulse');
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    seen.add(await bannerText(page));
    await page.waitForTimeout(100);
  }
  log.push(`player path, banners in the first 4 s of the new run: ${JSON.stringify([...seen])}`);
  await page.screenshot({ path: `${OUT}/bug008-new-run.png` });
  // Hook path as found in M3: new run seed 41 straight to Pulse 7 (index 6).
  await freshRun(page, 31);
  await advanceToPulse(page, 14);
  await page.evaluate(() => window.__shardfall?.resumeLoop());
  await expect.poll(() => bannerText(page), { timeout: 30_000 }).toContain('Paper Sun');
  await freshRun(page, 41);
  await advanceToPulse(page, 6);
  await page.evaluate(() => window.__shardfall?.resumeLoop());
  const seen2 = new Set<string>();
  for (let i = 0; i < 30; i++) {
    seen2.add(await bannerText(page));
    await page.waitForTimeout(100);
  }
  log.push(`hook path, banners in Pulse 7 of run seed 41: ${JSON.stringify([...seen2])}`);
  writeFileSync(`${OUT}/bug008.txt`, `${log.join('\n')}\n`);
  console.log(log.join('\n'));
  expect([...seen].some((s) => s.includes('Paper Sun'))).toBe(false);
  expect([...seen2].some((s) => s.includes('Paper Sun'))).toBe(false);
  expect(problems).toEqual([]);
});

test('BUG-009 retest: back from The Keeping, focus returns to The Keeping and input is not locked', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await installPointerBlocker(page);
  const problems = watchProblems(page);
  const log: string[] = [];
  await bootWith(page, { access: { reduceEffects: false } });
  await startRunByKeys(page);
  await page.waitForTimeout(1500);
  await abandon(page);
  // Entered from a Pulse: the 500 ms lock still applies (intended); an early Enter is ignored.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  log.push(`Enter right after the run end from a Pulse: screen ${await screen(page)}`);
  expect(await screen(page)).toBe('run-end');
  await page.waitForTimeout(550);
  await focusTo(page, 'end-keeping', 'ArrowRight', 6);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('archive');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  const t0 = Date.now();
  await expect.poll(() => screen(page), { intervals: [20] }).toBe('run-end');
  const focusBack = await focused(page);
  log.push(`focus after returning from The Keeping: ${focusBack}`);
  await focusTo(page, 'end-title', 'ArrowRight', 6);
  await page.keyboard.press('Enter');
  const enterMs = Date.now() - t0;
  log.push(`Enter on Title ${enterMs} ms after Esc`);
  await expect.poll(() => screen(page), { timeout: 2000 }).toBe('title');
  log.push(`screen after Enter: ${await screen(page)}`);
  writeFileSync(`${OUT}/bug009.txt`, `${log.join('\n')}\n`);
  console.log(log.join('\n'));
  expect(focusBack).toBe('end-keeping');
  expect(enterMs, 'the Enter fell inside the old 500 ms window').toBeLessThan(500);
  expect(await pointerEvents(page)).toEqual([]);
  expect(problems).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// BUG-006: first arena frame in a fresh Edge profile (cold shader cache), QA_LONG
// ---------------------------------------------------------------------------------------------

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

/** Title (waiting or not), New Run, first class: timings of the first Pulse frame. */
async function firstPulseFrame(page: Page, waitOnTitle: boolean): Promise<Record<string, number>> {
  await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
  await page.waitForFunction(() => window.__shardfall !== undefined);
  if (waitOnTitle) await page.waitForTimeout(2000);
  await page.evaluate(() => {
    // Samples every 4 ms (main thread) and every animation frame (rAF), from before the key press.
    const w = window as unknown as { __qaS: number[][]; __qaRaf: number[] };
    const h = window.__shardfall;
    if (h === undefined) return;
    const phases = ['idle', 'pulse'];
    w.__qaS = [];
    w.__qaRaf = [];
    const t0 = performance.now();
    const id = setInterval(() => {
      const s = h.getSnapshot();
      w.__qaS.push([
        performance.now(),
        s.screen === 'pulse' ? 1 : 0,
        phases.indexOf(s.phase),
        s.tick,
      ]);
      if (performance.now() - t0 > 6000) clearInterval(id);
    }, 4);
    const f = (now: number): void => {
      w.__qaRaf.push(now);
      if (now - t0 < 6000) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('class-select');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('pulse');
  await page.waitForTimeout(1800);
  const { s, raf } = await page.evaluate(() => {
    const w = window as unknown as { __qaS: number[][]; __qaRaf: number[] };
    return { s: w.__qaS, raf: w.__qaRaf };
  });
  // tPulse: first sample on the Pulse screen. Sim start: first sample in phase pulse; the sim runs
  // once the tick then grows. Gaps: longest main-thread and rAF gap around and after tPulse.
  const iPulse = s.findIndex((x) => x[1] === 1);
  const tPulse = s[iPulse]?.[0] ?? 0;
  const iPh = s.findIndex((x, i) => i >= iPulse && x[2] === 1);
  const tick1 = s[iPh]?.[3] ?? 0;
  const iRun = s.findIndex((x, i) => i > iPh && (x[3] ?? 0) > tick1);
  const tRun = s[iRun]?.[0] ?? Number.NaN;
  const gap = (ts: number[]): number => {
    let g = 0;
    for (let k = 1; k < ts.length; k++) {
      const a = ts[k - 1] ?? 0;
      const b = ts[k] ?? 0;
      if (b >= tPulse - 50 && a <= tPulse + 1500) g = Math.max(g, b - a);
    }
    return g;
  };
  return {
    simRunsAfterMs: Math.round(tRun - tPulse),
    maxMainThreadGapMs: Math.round(gap(s.map((x) => x[0] ?? 0))),
    maxFrameGapMs: Math.round(gap(raf)),
    tickAtPulsePhase: tick1,
  };
}

test('BUG-006 retest: fresh Edge profiles, sim runs within 100 ms of the Pulse screen', async ({
  baseURL,
}) => {
  test.skip(!LONG, 'opt-in: QA_LONG=1 (launches Edge and Chromium 12 times)');
  test.skip(!EDGE_PATHS.some((p) => existsSync(p)), 'Edge not installed');
  test.setTimeout(400_000);
  const rows: Record<string, unknown>[] = [];
  // Edge as the smoke launches it (fresh profile per launch): four wait on the title like a player
  // (the pre-warm runs when the title is idle), two press Enter at once (the documented limit), two
  // load the page a second time in the same browser (warm shader cache). Then Edge and Playwright
  // Chromium with the real GPU flags of the M3 specs, for comparison.
  const runs: {
    label: string;
    channel?: string;
    args?: string[];
    wait: boolean;
    warm?: 'reload' | 'context';
  }[] = [
    ...[1, 2, 3, 4].map(() => ({ label: 'edge cold, waited', channel: 'msedge', wait: true })),
    ...[1, 2].map(() => ({ label: 'edge cold, quick', channel: 'msedge', wait: false })),
    ...[1, 2].map(() => ({
      label: 'edge warm, reload',
      channel: 'msedge',
      wait: true,
      warm: 'reload' as const,
    })),
    // A new context in the same browser has its own HTTP cache but shares the GPU process.
    ...[1, 2].map(() => ({
      label: 'edge warm GPU process, new context',
      channel: 'msedge',
      wait: true,
      warm: 'context' as const,
    })),
    ...[1, 2].map(() => ({
      label: 'edge gpu flags cold, waited',
      channel: 'msedge',
      args: GPU_ARGS,
      wait: true,
    })),
    ...[1, 2].map(() => ({ label: 'chromium gpu flags cold, waited', args: GPU_ARGS, wait: true })),
  ];
  for (const r of runs) {
    const browser = await chromium.launch({
      ...(r.channel === undefined ? {} : { channel: r.channel }),
      args: r.args ?? [],
    });
    const opts = { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' as const };
    let ctx = await browser.newContext(opts);
    let page = await ctx.newPage();
    await page.goto(baseURL ?? '/');
    if (r.warm === 'reload') {
      await firstPulseFrame(page, true);
      await page.goto(baseURL ?? '/');
    } else if (r.warm === 'context') {
      await firstPulseFrame(page, true);
      await ctx.close();
      ctx = await browser.newContext(opts);
      page = await ctx.newPage();
      await page.goto(baseURL ?? '/');
    }
    const problems = watchProblems(page);
    const m = await firstPulseFrame(page, r.wait);
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl === null || ext === null || ext === undefined
        ? 'unknown'
        : String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    });
    rows.push({ label: r.label, ...m, renderer: renderer.slice(0, 60), problems });
    await browser.close();
  }
  writeFileSync(`${OUT}/bug006-edge.json`, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`[BUG-006]\n${rows.map((r) => JSON.stringify(r)).join('\n')}`);
  for (const r of rows.filter((x) => x['label'] === 'edge cold, waited')) {
    expect(r['simRunsAfterMs'] as number, 'Edge cold, waited: sim start').toBeLessThan(100);
    expect(r['maxFrameGapMs'] as number, 'Edge cold, waited: frame hold').toBeLessThan(100);
  }
  for (const r of rows) expect(r['problems']).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Release play-through, QA_LONG
// ---------------------------------------------------------------------------------------------

/** Real-key bot (same policy as E-13) until the run ends, or until the first shop when asked. */
async function playRun(
  page: Page,
  maxMs: number,
  untilShop = false,
): Promise<{ log: string[]; phase: string }> {
  const log: string[] = [];
  let held = new Set<string>();
  const release = async (): Promise<void> => {
    for (const k of held) await page.keyboard.up(k);
    held = new Set();
  };
  const t0 = Date.now();
  let lastPhase = '';
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
    if (s.phase !== lastPhase) {
      log.push(
        `${((Date.now() - t0) / 1000).toFixed(1)}s pulse ${s.pulseIndex + 1} ${s.phase} hp ${s.hp}/${s.maxHp} glint ${s.glint} lv ${s.level}`,
      );
      lastPhase = s.phase;
      if (s.phase !== 'pulse') await release();
      if (['levelUp', 'reward', 'shop'].includes(s.phase)) await page.waitForTimeout(400);
    }
    if (s.phase === 'victory' || s.phase === 'defeat') break;
    if (untilShop && s.phase === 'shop' && s.screen === 'glazier') break;
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
  return { log, phase: (await snap(page)).phase };
}

async function buyInKeeping(page: Page, id: string, cost: number, log: string[]): Promise<void> {
  const m = await meta(page);
  if (m.silt < cost) {
    // Shortcut (labelled): top Silt up to the unlock cost when the run did not earn enough.
    await page.evaluate((n) => window.__shardfall?.grantSilt(n), cost - m.silt);
    log.push(`grantSilt ${cost - m.silt} (run gave ${m.silt}, ${id} costs ${cost})`);
  }
  await page.waitForTimeout(550);
  await focusTo(page, 'end-keeping', 'ArrowRight', 6);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('archive');
  await focusTo(page, `keeping-${id}`, 'ArrowDown', 12);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-ui="keeping-${id}"]`)).toHaveClass(/is-owned/);
  log.push(`bought ${id} in The Keeping: meta ${JSON.stringify(await meta(page))}`);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('run-end');
  await focusTo(page, 'end-title', 'ArrowRight', 6);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('title');
}

/** Cycle a settings row with ArrowRight until the saved value matches. */
async function setSetting(
  page: Page,
  tab: string,
  row: string,
  group: string,
  key: string,
  value: unknown,
): Promise<void> {
  // Q and E switch tabs (Left and Right would change the focused row's value).
  const active = (): Promise<string> =>
    page.evaluate(
      () => document.querySelector<HTMLElement>('#ui-root .tab.is-active')?.dataset['ui'] ?? '',
    );
  for (let i = 0; i < 6 && (await active()) !== `settings-tab-${tab}`; i++)
    await page.keyboard.press('KeyE');
  expect(await active()).toBe(`settings-tab-${tab}`);
  await focusTo(page, `setting-${row}`, 'ArrowDown', 14);
  for (let i = 0; i < 6 && (await settingsSaved(page))[group]?.[key] !== value; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(80);
  }
  expect((await settingsSaved(page))[group]?.[key]).toBe(value);
}

test('M5 release play: one full run per class with real keys, Continue, Silt unlocks, Low and Reduce Effects', async ({
  page,
}) => {
  test.skip(!LONG, 'opt-in: QA_LONG=1 (about 10 to 20 minutes)');
  test.setTimeout(1_800_000);
  const problems = watchProblems(page);
  const log: string[] = [];
  await bootWith(page, { graphics: { quality: 'high' }, access: { reduceEffects: false } });
  const runs: Record<string, unknown>[] = [];

  for (const cls of ['lantern', 'blade', 'bell'] as const) {
    if (cls === 'blade') {
      // Settings from the title: Low quality and Reduce Effects on, then a reload keeps them.
      await focusTo(page, 'title-settings', 'ArrowDown', 6);
      await page.keyboard.press('Enter');
      await expect.poll(() => screen(page)).toBe('settings');
      await setSetting(page, 'graphics', 'quality', 'graphics', 'quality', 'low');
      await setSetting(page, 'access', 'reduceEffects', 'access', 'reduceEffects', true);
      const before = await settingsSaved(page);
      await page.keyboard.press('Escape');
      await expect.poll(() => screen(page)).toBe('title');
      await page.reload();
      await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
      await page.waitForFunction(() => window.__shardfall !== undefined);
      const after = await settingsSaved(page);
      const live = await page.evaluate(() =>
        document.querySelector('.sf-ui')?.classList.contains('reduce-effects'),
      );
      log.push(
        `settings after reload: graphics ${JSON.stringify(after['graphics'])}, reduceEffects ${String(after['access']?.['reduceEffects'])}, live reduce-effects class ${String(live)}, identical ${String(JSON.stringify(after) === JSON.stringify(before))}`,
      );
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
      expect(live).toBe(true);
    }
    const m0 = await meta(page);
    await startRunByKeys(page, cls);
    await page.waitForTimeout(3000);
    const perf = await page.evaluate(() => window.__shardfall?.getPerf());
    await page.screenshot({ path: `${OUT}/play-${cls}-pulse1.png` });
    await page.evaluate(() => window.__shardfall?.setTimeScale(4));
    let continued = false;
    let r = await playRun(page, 120_000, cls === 'lantern');
    const runLog = [...r.log];
    if (cls === 'lantern' && r.phase === 'shop') {
      // Autosave and Continue: reload at the first Glazier, Continue from the title by keys.
      await page.waitForTimeout(500);
      const s0 = await snap(page);
      const h0 = await page.evaluate(() => window.__shardfall?.getStateHash());
      await page.reload();
      await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
      await page.waitForFunction(() => window.__shardfall !== undefined);
      await expect.poll(() => screen(page)).toBe('title');
      await focusTo(page, 'title-continue', 'ArrowUp', 6);
      await page.keyboard.press('Enter');
      await expect.poll(() => screen(page)).toBe('glazier');
      const s1 = await snap(page);
      const h1 = await page.evaluate(() => window.__shardfall?.getStateHash());
      log.push(
        `Continue: before reload Pulse ${s0.pulseIndex + 1} ${s0.phase} glint ${s0.glint} hash ${h0}; after Continue Pulse ${s1.pulseIndex + 1} ${s1.phase} glint ${s1.glint} hash ${h1}`,
      );
      await page.screenshot({ path: `${OUT}/play-lantern-continued.png` });
      expect(h1).toBe(h0);
      expect(s1.pulseIndex).toBe(s0.pulseIndex);
      continued = true;
      await page.evaluate(() => window.__shardfall?.setTimeScale(4));
      r = await playRun(page, 600_000);
      runLog.push('-- reload and Continue --', ...r.log);
    } else if (r.phase !== 'victory' && r.phase !== 'defeat') {
      r = await playRun(page, 600_000);
      runLog.push(...r.log);
    }
    const end = await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      h.setTimeScale(1);
      return { replay: h.exportReplay(), hash: h.getStateHash(), snap: h.getSnapshot() };
    });
    await expect.poll(() => screen(page)).toBe('run-end');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/play-${cls}-run-end.png` });
    const m1 = await meta(page);
    const node = continued
      ? null
      : replayInNode(
          `m5-${cls}-${String((end.replay as { seed?: number } | null)?.seed ?? 0)}`,
          end.replay,
        ).result;
    const row = {
      class: cls,
      end: end.snap.phase,
      pulse: end.snap.pulseIndex + 1,
      tick: end.snap.tick,
      silt: `${m0.silt} -> ${m1.silt}`,
      drawCalls: perf?.drawCalls,
      continued,
      nodeReplay: node,
    };
    runs.push(row);
    log.push(`${cls}: ${JSON.stringify(row)}`, ...runLog.map((l) => `  ${l}`));
    expect(['victory', 'defeat']).toContain(end.snap.phase);
    expect(m1.silt).toBeGreaterThanOrEqual(m0.silt);
    writeFileSync(`${OUT}/play-log.txt`, `${log.join('\n')}\n`);
    if (node !== null) {
      // Soft: a mismatch fails the test but the other classes still play (evidence for the report).
      expect.soft(node['mismatchAt'], `${cls}: Node replay checkpoint`).toBe(-1);
      expect.soft(node['finalHash'], `${cls}: Node replay final hash`).toBe(end.hash);
    }
    if (cls === 'lantern') await buyInKeeping(page, 'unlock_blade', 6, log);
    else if (cls === 'blade') await buyInKeeping(page, 'unlock_bell', 60, log);
  }
  writeFileSync(`${OUT}/play-log.txt`, `${log.join('\n')}\n`);
  writeFileSync(`${OUT}/play-runs.json`, `${JSON.stringify(runs, null, 2)}\n`);
  console.log(log.join('\n'));
  // Low quality draws fewer calls than High (lantern ran at High, blade and bell at Low).
  const dc = (c: string): number => Number(runs.find((x) => x['class'] === c)?.['drawCalls'] ?? 0);
  expect(dc('blade')).toBeLessThan(dc('lantern'));
  expect((await meta(page)).unlocked).toEqual(
    expect.arrayContaining(['unlock_blade', 'unlock_bell']),
  );
  expect(problems).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// D-8 soak (BUG-015): long live runs with real keys, every replay checked in Node. QA_SOAK=1.
// ---------------------------------------------------------------------------------------------

test('D-8 soak: live runs with real keys at 4x replay in Node with every checkpoint matching', async ({
  page,
}) => {
  test.skip(process.env['QA_SOAK'] !== '1', 'opt-in: QA_SOAK=1 (about 20 minutes)');
  test.setTimeout(2_400_000);
  const problems = watchProblems(page);
  const rows: Record<string, unknown>[] = [];
  const seeds = (process.env['QA_SOAK_SEEDS'] ?? '7001,7002,7003,7004,7005,7006')
    .split(',')
    .map(Number);
  await bootWith(page, { graphics: { quality: 'low' }, access: { reduceEffects: true } });
  for (const [i, seed] of seeds.entries()) {
    const cls = ['bell', 'lantern', 'blade'][i % 3] ?? 'bell';
    await page.evaluate(
      ([s, c]) => {
        const h = window.__shardfall;
        h?.startRun({ seed: s, classId: c });
        h?.setTimeScale(4);
      },
      [seed, cls] as const,
    );
    // The previous run's end phase can still be in the snapshot for a moment: wait for the new run.
    await expect.poll(async () => (await snap(page)).phase).toBe('pulse');
    const r = await playRun(page, 600_000);
    const end = await page.evaluate(() => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      h.setTimeScale(1);
      return { replay: h.exportReplay(), hash: h.getStateHash(), snap: h.getSnapshot() };
    });
    const node = replayInNode(`m5-soak-${cls}-${String(seed)}`, end.replay).result;
    rows.push({
      seed,
      class: cls,
      end: end.snap.phase,
      pulse: end.snap.pulseIndex + 1,
      steps: node['ticks'],
      mismatchAt: node['mismatchAt'],
      finalSame: node['finalHash'] === end.hash,
    });
    console.log(`[D-8 soak] ${JSON.stringify(rows[rows.length - 1])} (${r.log.length} phases)`);
    writeFileSync(`${OUT}/d8-soak.json`, `${JSON.stringify(rows, null, 2)}\n`);
  }
  for (const r of rows) {
    expect.soft(r['mismatchAt'], `seed ${String(r['seed'])}`).toBe(-1);
    expect.soft(r['finalSame'], `seed ${String(r['seed'])}`).toBe(true);
  }
  expect(problems).toEqual([]);
});
