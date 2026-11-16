// QA M3 e2e helpers: settings through storage, phase driving through commands, GPU launch args,
// and scene capture with the hook answers needed by the 1 s glance test and image analysis.

import { mkdirSync, writeFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EVIDENCE, snap } from './qa.ts';

export const M3_OUT = `${EVIDENCE}/m3`;
mkdirSync(M3_OUT, { recursive: true });

/**
 * Real GPU in headless Chromium through ANGLE D3D11 (same flags as tests/render/hd2d/capture.ts).
 * Without them headless Chromium falls back to SwiftShader and the renderer caps quality at Low.
 */
export const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];

export const SETTINGS_KEY = 'shardfall.settings.v1';

/** Partial settings merged over the defaults by loadSettings (graphics, audio, access, keybinds). */
export interface SettingsPatch {
  graphics?: Record<string, unknown>;
  audio?: Record<string, unknown>;
  access?: Record<string, unknown>;
  keybinds?: Record<string, unknown>;
}

/** Boot with empty storage plus a settings patch, then wait for the hooks. */
export async function bootWith(page: Page, patch: SettingsPatch = {}): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([key, p]) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify({ v: 1, ...p }));
    },
    [SETTINGS_KEY, patch] as const,
  );
  await page.reload();
  await expect(page.locator('canvas#game')).toHaveAttribute('data-ready', '1');
  await page.waitForFunction(() => window.__shardfall !== undefined);
}

export async function gpuName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl === null) return 'no webgl2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext === null ? 'unknown' : String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  });
}

/** Paused loop, fresh run (seed, class), one tick. */
export async function freshRun(page: Page, seed: number, classId = 'lantern'): Promise<void> {
  await page.evaluate(
    ([s, c]) => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      h.pauseLoop();
      h.startRun({ seed: s, classId: c });
      h.step(1);
    },
    [seed, classId] as const,
  );
}

/**
 * From a running run, clear Pulses with debug.endPulse (the only shortcut) and take the first card
 * or chest pick until the Pulse with index pulseIndex (0-based) is running. HP kept full.
 */
export async function advanceToPulse(page: Page, pulseIndex: number): Promise<void> {
  await page.evaluate((target) => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    for (let guard = 0; guard < 4000; guard++) {
      const s = h.getSnapshot();
      if (s.phase === 'pulse' && s.pulseIndex === target) return;
      if (s.phase === 'pulse') {
        h.send({ type: 'debug.setHp', hp: s.maxHp });
        h.send({ type: 'debug.endPulse' });
      } else if (s.phase === 'reward') h.send({ type: 'reward.pick', choice: 0 });
      else if (s.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
      else if (s.phase === 'shop') h.send({ type: 'pulse.begin' });
      else if (s.phase === 'victory' || s.phase === 'defeat')
        throw new Error(`run ended (${s.phase})`);
      h.step(5);
    }
    throw new Error(`never reached Pulse ${target + 1}`);
  }, pulseIndex);
}

/** Step until pred(snapshot, positions) holds, HP kept full. Returns ticks stepped or -1. */
export async function stepUntilNear(
  page: Page,
  maxTicks: number,
  minAreasNearPlayer: number,
  nearPx: number,
): Promise<number> {
  return page.evaluate(
    ([max, minAreas, near]) => {
      const h = window.__shardfall;
      if (h === undefined) throw new Error('hooks missing');
      for (let t = 0; t < max; t++) {
        const s = h.getSnapshot();
        h.send({ type: 'debug.setHp', hp: s.maxHp });
        const p = h.getScreenPositions();
        const n = p.dangerAreas.filter(
          (a) => Math.hypot(a.x - p.player.x, a.y - p.player.y) < near,
        ).length;
        if (n >= minAreas) return t;
        h.step(1);
      }
      return -1;
    },
    [maxTicks, minAreasNearPlayer, nearPx] as const,
  );
}

export interface SceneAnswer {
  readonly name: string;
  readonly viewport: { width: number; height: number };
  readonly player: { x: number; y: number };
  /** Nearest threat: enemy, enemy shot, or active telegraph (danger area) to the player. */
  readonly nearest: { kind: string; x: number; y: number; d: number } | null;
  readonly counts: Record<string, number>;
  readonly enemies: readonly { x: number; y: number; rank: number }[];
  readonly enemyShots: readonly { x: number; y: number }[];
  readonly dangerAreas: readonly { x: number; y: number }[];
}

/** Screenshot plus the hook answer (positions in CSS px = screenshot px at device scale 1). */
export async function capture(page: Page, name: string): Promise<SceneAnswer> {
  await page.evaluate(() => window.__shardfall?.step(0));
  await page.waitForTimeout(150);
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  const pos = await page.evaluate(() => {
    const h = window.__shardfall;
    if (h === undefined) throw new Error('hooks missing');
    return h.getScreenPositions();
  });
  const s = await snap(page);
  let nearest: SceneAnswer['nearest'] = null;
  const consider = (kind: string, list: readonly { x: number; y: number }[]): void => {
    for (const q of list) {
      const d = Math.hypot(q.x - pos.player.x, q.y - pos.player.y);
      if (nearest === null || d < nearest.d) nearest = { kind, x: q.x, y: q.y, d };
    }
  };
  consider('enemy', pos.enemies);
  consider('enemyShot', pos.enemyShots);
  consider('telegraph', pos.dangerAreas);
  await page.screenshot({ path: `${M3_OUT}/${name}.png` });
  const answer: SceneAnswer = {
    name,
    viewport: vp,
    player: pos.player,
    nearest,
    counts: s.counts,
    enemies: pos.enemies,
    enemyShots: pos.enemyShots,
    dangerAreas: pos.dangerAreas,
  };
  writeFileSync(`${M3_OUT}/${name}.json`, `${JSON.stringify(answer)}\n`);
  return answer;
}
