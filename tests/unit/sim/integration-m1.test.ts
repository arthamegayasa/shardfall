// LP M1-09a regressions: presentation signals, run-relative tick, load event, save validation,
// debug helpers used by the e2e hooks, and the event order at defeat (architecture 6.5).

import { describe, expect, it } from 'vitest';
import { LOW_HP_FRAC, RejectReason, RunPhaseCode, SimEventType } from '../../../src/core/index.ts';
import type { RunSave } from '../../../src/core/index.ts';
import { harness, stepUntil } from './support/harness.ts';

describe('presentation signals', () => {
  it('emits PlayerHpLowChanged on entering low HP and 0 when the Pulse ends', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    h.quiet();
    const max = h.sim.view.player.maxHp;
    h.send({ type: 'debug.setHp', hp: Math.floor(max * LOW_HP_FRAC) });
    h.step();
    expect(h.of(SimEventType.PlayerHpLowChanged).map((e) => e.a)).toEqual([1]);
    h.send({ type: 'debug.endPulse' });
    h.step();
    expect(h.of(SimEventType.PlayerHpLowChanged).map((e) => e.a)).toEqual([1, 0]);
  });

  it('emits MusicPressureChanged at music_pressure_frac of alive_cap (GD Q21)', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    h.quiet();
    const cap = h.data.profiles['run_a']?.[0]?.aliveCap ?? 0;
    const need = Math.ceil(cap * h.data.config.musicPressureFrac);
    h.send({ type: 'debug.spawn', enemyId: 'swarmer', x: 8, y: 4, count: need - 1 });
    h.step();
    expect(h.of(SimEventType.MusicPressureChanged)).toEqual([]);
    h.send({ type: 'debug.spawn', enemyId: 'swarmer', x: -8, y: 4, count: 1 });
    h.step();
    expect(h.of(SimEventType.MusicPressureChanged).map((e) => e.a)).toEqual([1]);
  });
});

describe('run-relative tick', () => {
  it('restarts the sim tick at run.start so an idle title screen does not change the run', () => {
    const fresh = harness();
    fresh.start({ seed: 3, profile: 'run_a' });
    fresh.step(120);
    const idle = harness();
    idle.step(500); // title screen idling in the browser
    idle.start({ seed: 3, profile: 'run_a' });
    idle.step(120);
    expect(idle.sim.view.tick).toBe(fresh.sim.view.tick);
    expect(idle.sim.hash()).toBe(fresh.sim.hash());
  });
});

/** Run to the first Glazier and return the save. */
function shopSave(): { h: ReturnType<typeof harness>; save: RunSave } {
  const h = harness();
  h.start({ profile: 'run_a' });
  h.send({ type: 'debug.endPulse' });
  h.step();
  stepUntil(h, () => h.sim.view.phase !== 'pulseClear', 10_000);
  while (h.sim.view.phase === 'levelUp') {
    h.send({ type: 'levelup.pick', choice: 0 });
    h.step();
  }
  const save = h.sim.save();
  if (save === null) throw new Error('no save in the shop');
  return { h, save };
}

describe('load', () => {
  it('emits PhaseChanged in the first step after load (consumers rebuild their screens)', () => {
    const { save } = shopSave();
    const h2 = harness();
    expect(h2.sim.load(save)).toEqual({ ok: true });
    h2.step();
    const pc = h2.of(SimEventType.PhaseChanged);
    expect(pc[0]?.a).toBe(RunPhaseCode.shop);
  });

  it('rejects malformed saves as corrupt instead of throwing or soft-locking', () => {
    const { save } = shopSave();
    const h2 = harness();
    const bad = (v: unknown): unknown => h2.sim.load(v as RunSave);
    expect(bad(null)).toEqual({ ok: false, reason: 'corrupt' });
    expect(bad({ ...save, shop: undefined })).toEqual({ ok: false, reason: 'corrupt' });
    expect(bad({ ...save, pulseIndex: 99 })).toEqual({ ok: false, reason: 'corrupt' });
    expect(bad({ ...save, phase: 'levelUp', levelUpChoices: [] })).toEqual({
      ok: false,
      reason: 'corrupt',
    });
    expect(bad({ ...save, v: 2 })).toEqual({ ok: false, reason: 'badVersion' });
    // The failed loads left the sim usable for a valid one.
    expect(h2.sim.load(save)).toEqual({ ok: true });
  });
});

describe('debug helpers for e2e (architecture 6.12)', () => {
  it('debug.xp grants levels that are picked after the Pulse', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    h.send({ type: 'debug.xp', amount: h.sim.view.player.xpToNext });
    h.step();
    expect(h.sim.view.player.level).toBe(2);
    h.send({ type: 'debug.endPulse' });
    h.step();
    stepUntil(h, () => h.sim.view.phase !== 'pulseClear', 10_000);
    expect(h.sim.view.phase).toBe('levelUp');
  });

  it('debug.endPulse kills a living Warden first, so its reward follows', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    // Clear normal Pulses until the Warden Pulse.
    for (let g = 0; g < 20 && h.sim.view.pulse.kind !== 1; g++) {
      h.send({ type: 'debug.endPulse' });
      h.step();
      stepUntil(h, () => h.sim.view.phase !== 'pulseClear', 10_000);
      while (h.sim.view.phase === 'levelUp' || h.sim.view.phase === 'reward') {
        h.send({
          type: h.sim.view.phase === 'levelUp' ? 'levelup.pick' : 'reward.pick',
          choice: 0,
        });
        h.step();
      }
      h.send({ type: 'pulse.begin' });
      h.step();
    }
    expect(h.sim.view.pulse.kind).toBe(1);
    const ok = stepUntil(
      h,
      () => {
        h.send({ type: 'debug.setHp', hp: 1e9 });
        return h.sim.view.pulse.warden.active;
      },
      60 * 120,
    );
    expect(ok).toBe(true);
    h.send({ type: 'debug.endPulse' });
    h.step();
    expect(h.of(SimEventType.WardenKilled).length).toBe(1);
    stepUntil(h, () => h.sim.view.phase !== 'pulseClear', 10_000);
    expect(h.sim.view.phase).toBe('reward');
  });

  it('rejects debug.setHp with a non-finite value', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    h.send({ type: 'debug.setHp', hp: Number.NaN });
    h.step();
    expect(h.of(SimEventType.CommandRejected)[0]?.a).toBe(RejectReason.WrongPhase);
    expect(Number.isFinite(h.sim.view.player.hp)).toBe(true);
  });
});

describe('event order at defeat (architecture 6.5)', () => {
  it('emits PlayerDied before PhaseChanged to defeat, then RunEnded', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    h.send({ type: 'debug.setHp', hp: 1 });
    const p = h.sim.view.player;
    h.send({ type: 'debug.spawn', enemyId: 'charger', x: p.x + 0.5, y: p.y, count: 6 });
    h.step();
    const died = stepUntil(h, () => h.sim.view.phase === 'defeat', 60 * 30);
    expect(died).toBe(true);
    const order = h.log
      .filter(
        (e) =>
          e.type === SimEventType.PlayerDied ||
          e.type === SimEventType.RunEnded ||
          (e.type === SimEventType.PhaseChanged && e.a === RunPhaseCode.defeat),
      )
      .map((e) => e.type);
    expect(order).toEqual([
      SimEventType.PlayerDied,
      SimEventType.PhaseChanged,
      SimEventType.RunEnded,
    ]);
  });
});
