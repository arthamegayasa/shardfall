// QA e2e helpers (M1-09b): problem watcher, raw-key scan, layout scan, pointer blocker, snapshot and
// step shortcuts. Hooks: window.__shardfall (architecture 6.12), build:e2e only.

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { E2eSnapshot } from '../../../src/core/dom.ts';

export const EVIDENCE = 'docs/qa/evidence/M1';

/** console.error, pageerror, and failed requests (test-plan 7.1). */
export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const url = msg.location().url;
      problems.push(`console.error: ${msg.text()}${url === '' ? '' : ` (${url})`}`);
    }
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`);
  });
  return problems;
}

/** Fresh boot with empty storage. */
export async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
  await page.waitForFunction(() => window.__shardfall !== undefined);
}

export async function snap(page: Page): Promise<E2eSnapshot> {
  return page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    return h.getSnapshot();
  });
}

export async function screen(page: Page): Promise<string> {
  return page.evaluate(() => window.__shardfall?.getSnapshot().screen ?? '');
}

export async function hash(page: Page): Promise<string> {
  return page.evaluate(() => window.__shardfall?.getStateHash() ?? '');
}

export async function step(
  page: Page,
  ticks: number,
  input?: Record<string, number>,
): Promise<void> {
  await page.evaluate(
    ([t, i]) => {
      window.__shardfall?.step(t, i);
    },
    [ticks, input ?? {}] as const,
  );
}

export async function send(page: Page, cmd: object): Promise<void> {
  await page.evaluate((c) => {
    window.__shardfall?.send(c as never);
  }, cmd);
}

/** Raw string keys, unresolved placeholders, or dev markers in the visible UI text. */
export async function rawText(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.querySelector('#ui-root')?.textContent ?? '');
  const bad = text.match(
    /\[\[[^\]]*\]\]|\{[a-z_0-9]+\}|\b(?:ui|memento|weapon|syn|class|tag|rite|card|stat|unlit|biome|glazier|enemy|boss|warden)\.[a-z_0-9]+(?:\.[a-z_0-9]+)*|undefined|NaN/g,
  );
  return bad ?? [];
}

export interface LayoutIssue {
  readonly kind: 'clipped' | 'offscreen' | 'overlap';
  readonly what: string;
}

/**
 * Visible text elements in #ui-root that are clipped (scroll size larger than client size with
 * overflow hidden), leave the viewport, or overlap a sibling text element. A11y A-05 step 2.
 */
export async function layoutIssues(page: Page): Promise<LayoutIssue[]> {
  return page.evaluate(() => {
    const out: { kind: 'clipped' | 'offscreen' | 'overlap'; what: string }[] = [];
    const root = document.querySelector('#ui-root');
    if (root === null) return out;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const label = (el: Element): string => {
      const ui = (el as HTMLElement).dataset['ui'];
      const cls = typeof el.className === 'string' ? (el.className.split(' ')[0] ?? '') : '';
      return `${el.tagName.toLowerCase()}${ui === undefined ? '' : `[${ui}]`}.${cls} "${el.textContent.trim().slice(0, 40)}"`;
    };
    const visible = (el: Element): boolean => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0)
        return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const leaves: Element[] = [];
    for (const el of root.querySelectorAll('*')) {
      // The aria-live region is visually hidden on purpose (screen readers only).
      if (el.closest('.live-region') !== null) continue;
      if (!visible(el)) continue;
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
      );
      if (!hasText) continue;
      leaves.push(el);
      const s = getComputedStyle(el);
      const he = el as HTMLElement;
      const clipsX = s.overflowX !== 'visible' || s.textOverflow === 'ellipsis';
      const clipsY = s.overflowY !== 'visible';
      if (
        (clipsX && he.scrollWidth > he.clientWidth + 1) ||
        (clipsY && he.scrollHeight > he.clientHeight + 1)
      )
        out.push({ kind: 'clipped', what: label(el) });
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1)
        out.push({ kind: 'offscreen', what: label(el) });
    }
    // Pairwise overlap of text leaves that are not nested (O(n^2), n is small on every screen).
    for (let i = 0; i < leaves.length; i++) {
      const a = leaves[i];
      if (a === undefined) continue;
      const ra = a.getBoundingClientRect();
      for (let j = i + 1; j < leaves.length; j++) {
        const b = leaves[j];
        if (b === undefined || a.contains(b) || b.contains(a)) continue;
        const rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 2 && oy > 2) out.push({ kind: 'overlap', what: `${label(a)} x ${label(b)}` });
      }
    }
    return out;
  });
}

/** Records pointer and mouse events (A-07 step 1: the test must not use the mouse). */
export async function installPointerBlocker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __qaPointer: string[] };
    w.__qaPointer = [];
    for (const type of ['pointerdown', 'mousedown', 'pointermove', 'mousemove', 'wheel']) {
      window.addEventListener(
        type,
        (e) => {
          w.__qaPointer.push(`${type}@${(e as MouseEvent).clientX},${(e as MouseEvent).clientY}`);
        },
        true,
      );
    }
  });
}

export async function pointerEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __qaPointer?: string[] }).__qaPointer ?? []);
}

/** data-ui of the focused element, '' when none. */
export async function focused(page: Page): Promise<string> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset['ui'] ?? '');
}
