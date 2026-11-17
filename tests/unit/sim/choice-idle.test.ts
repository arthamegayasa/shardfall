// BUG-013 (M4-03): idling in a choice phase (Temper level-up, the Glazier shop, Warden reward) must
// not change sim state. The run clock (world.tick, runStats.runTicks) stands still there, so effect
// cooldowns and "not hurt for N s" conditions cannot be charged by waiting, and the state hash only
// moves when a command changes something. Steps still happen (replays count steps), they are no-ops.

import { describe, expect, it } from 'vitest';
import { toHex8 } from '../../../src/core/index.ts';
import type { Harness } from './support/harness.ts';
import { harness, stepUntil } from './support/harness.ts';

const CHOICE = new Set(['levelUp', 'shop', 'reward']);

/** Start a run, end Pulse 1 at once, and step until the first choice phase opens. */
function toChoice(seed: number): Harness {
  const h = harness();
  h.start({ seed });
  h.send({ type: 'debug.xp', amount: 500 });
  h.step();
  h.send({ type: 'debug.endPulse' });
  h.step();
  expect(stepUntil(h, () => CHOICE.has(h.sim.view.phase), 2000)).toBe(true);
  return h;
}

/** Answer every Temper card with the first choice until the shop opens. */
function toShop(h: Harness): void {
  for (let i = 0; i < 50 && h.sim.view.phase !== 'shop'; i++) {
    if (h.sim.view.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
    else if (h.sim.view.phase === 'reward') h.send({ type: 'reward.pick', choice: 0 });
    h.step();
  }
  expect(h.sim.view.phase).toBe('shop');
}

describe('choice phases freeze the run clock (BUG-013)', () => {
  it('60 s idle in Temper changes neither tick, run time, nor the state hash', () => {
    const h = toChoice(7);
    expect(h.sim.view.phase).toBe('levelUp');
    const tick = h.sim.view.tick;
    const runTicks = h.sim.view.runStats.runTicks;
    const hash = toHex8(h.sim.hash());
    h.step(3600);
    expect(h.sim.view.phase).toBe('levelUp');
    expect(h.sim.view.tick).toBe(tick);
    expect(h.sim.view.runStats.runTicks).toBe(runTicks);
    expect(toHex8(h.sim.hash())).toBe(hash);
  });

  it('60 s idle in the Glazier shop changes neither tick, run time, nor the state hash', () => {
    const h = toChoice(7);
    toShop(h);
    const tick = h.sim.view.tick;
    const runTicks = h.sim.view.runStats.runTicks;
    const hash = toHex8(h.sim.hash());
    h.step(3600);
    expect(h.sim.view.tick).toBe(tick);
    expect(h.sim.view.runStats.runTicks).toBe(runTicks);
    expect(toHex8(h.sim.hash())).toBe(hash);
  });

  it('shop commands still apply while the clock stands still', () => {
    const h = toChoice(7);
    toShop(h);
    h.send({ type: 'debug.glint', amount: 50 });
    h.step();
    const glint = h.sim.view.player.glint;
    const tick = h.sim.view.tick;
    h.send({ type: 'shop.reroll' });
    h.step();
    expect(h.sim.view.player.glint).toBeLessThan(glint);
    expect(h.sim.view.tick).toBe(tick);
  });

  it('the next Pulse plays the same whether the player idled 0 or 60 s in Temper and the shop', () => {
    const run = (idle: number): string => {
      const h = toChoice(11);
      h.step(idle);
      toShop(h);
      h.step(idle);
      h.send({ type: 'pulse.begin' });
      h.step();
      expect(h.sim.view.phase).toBe('pulse');
      h.input.moveX = 127;
      h.step(600);
      return toHex8(h.sim.hash());
    };
    expect(run(3600)).toBe(run(0));
  });

  it('the Pulse clock still runs: pulse and pulseClear advance the tick', () => {
    const h = harness();
    h.start();
    const t0 = h.sim.view.tick;
    h.step(30);
    expect(h.sim.view.tick).toBe(t0 + 30);
    expect(h.sim.view.runStats.runTicks).toBeGreaterThanOrEqual(30);
  });
});
