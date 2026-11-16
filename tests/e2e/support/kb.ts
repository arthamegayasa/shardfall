// Real-time keyboard dodger shared by QA e2e specs (moved from keyboard-play.spec.ts, M3-QA).
// Reads the e2e snapshot and screen positions, holds W, A, S, D, casts the Rite with Space.

import type { Page } from '@playwright/test';
import { snap } from './qa.ts';

export interface PlayStats {
  readonly seconds: number;
  readonly riteCasts: number;
  readonly maxEnemies: number;
  readonly glintStart: number;
  readonly glintEnd: number;
  readonly hpEnd: number;
  readonly keyChanges: number;
}

/** Real-time keyboard dodger until the phase leaves 'pulse' or maxMs passes. */
export async function keyboardPulse(
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
