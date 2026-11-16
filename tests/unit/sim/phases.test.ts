// K01, K16, K19: run phases, run end, missing data guard (docs/specs/gp-core-loop.md).

import { describe, expect, it } from 'vitest';
import { RejectReason, RunOutcome, RunPhaseCode, SimEventType } from '../../../src/core/index.ts';
import { createSim } from '../../../src/sim/index.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';
import { harness, stepUntil } from './support/harness.ts';

describe('run phases (K01)', () => {
  it('goes pulse -> pulseClear -> levelUp/shop -> pulse with pulse_clear_s between', () => {
    const h = harness();
    h.start({ profile: 'run_a_m1' });
    expect(h.sim.view.phase).toBe('pulse');
    expect(h.of(SimEventType.PulseStarted)[0]?.a).toBe(0);
    const total = h.sim.view.pulse.ticksTotal;
    expect(total).toBe(h.data.profiles['run_a_m1']?.[0]?.durationTicks);
    h.step(total);
    expect(h.sim.view.phase).not.toBe('pulse');
    expect(stepUntil(h, () => h.sim.view.phase !== 'pulseClear', 10_000)).toBe(true);
    const changes = h.of(SimEventType.PhaseChanged);
    const clearAt = changes.find((e) => e.a === RunPhaseCode.pulseClear)?.tick ?? 0;
    const leftAt = changes.find((e) => e.b === RunPhaseCode.pulseClear)?.tick ?? 0;
    expect(leftAt - clearAt).toBe(h.data.config.pulseClearTicks);
    // Level-ups first (if any), then the shop.
    while (h.sim.view.phase === 'levelUp') {
      h.send({ type: 'levelup.pick', choice: 0 });
      h.step();
    }
    expect(h.sim.view.phase).toBe('shop');
    h.send({ type: 'pulse.begin' });
    h.step();
    expect(h.sim.view.phase).toBe('pulse');
    expect(h.sim.view.pulse.index).toBe(1);
    const codes = h.of(SimEventType.PhaseChanged).map((e) => e.a);
    expect(codes[0]).toBe(RunPhaseCode.pulse);
    expect(codes).toContain(RunPhaseCode.pulseClear);
    expect(codes).toContain(RunPhaseCode.shop);
  });

  it('rejects commands in the wrong phase with WrongPhase', () => {
    const h = harness();
    h.send({ type: 'pulse.begin' });
    h.step();
    h.start();
    h.send({ type: 'shop.reroll' });
    h.step();
    const rej = h.of(SimEventType.CommandRejected).map((e) => e.a);
    expect(rej).toEqual([RejectReason.WrongPhase, RejectReason.WrongPhase]);
  });

  it('rejects debug commands when debugCommands is off', () => {
    const h = harness({ debug: false });
    h.start();
    h.send({ type: 'debug.glint', amount: 5 });
    h.step();
    expect(h.of(SimEventType.CommandRejected)[0]?.a).toBe(RejectReason.DebugDisabled);
  });
});

describe('run end (K16)', () => {
  it('dies at 0 HP and enters defeat after death_slowmo_s', () => {
    const h = harness();
    h.start();
    h.ctx.world.player.hp = 0.5;
    h.ctx.run.weaponIndex.fill(-1);
    h.quiet();
    // A swarmer on the player: contact damage after grace.
    h.send({ type: 'debug.spawn', enemyId: 'swarmer', x: 0, y: 0, count: 1 });
    expect(stepUntil(h, () => h.of(SimEventType.PlayerDied).length > 0, 120)).toBe(true);
    const diedAt = h.sim.view.tick;
    expect(stepUntil(h, () => h.sim.view.phase === 'defeat', 600)).toBe(true);
    expect(h.sim.view.tick - diedAt).toBe(h.data.config.deathSlowmoTicks);
    const end = h.of(SimEventType.RunEnded)[0];
    expect(end?.a).toBe(RunOutcome.Defeat);
    expect(h.sim.view.runStats.killedBy).not.toBe(0);
  });

  it('abandon ends the run with RunOutcome.Abandon', () => {
    const h = harness();
    h.start();
    h.send({ type: 'run.abandon' });
    h.step();
    expect(h.sim.view.phase).toBe('defeat');
    expect(h.of(SimEventType.RunEnded)[0]?.a).toBe(RunOutcome.Abandon);
  });

  it('wins after the final Pulse of a profile without a boss', () => {
    const h = harness();
    h.start({ profile: 'run_a_m1' });
    const slots = h.data.profiles['run_a_m1'] ?? [];
    for (let i = 0; i < slots.length; i++) {
      h.ctx.world.player.hp = h.ctx.world.player.maxHp;
      h.send({ type: 'debug.setHp', hp: 1e9 });
      h.send({ type: 'debug.endPulse' });
      h.step();
      while (h.sim.view.phase === 'pulseClear' || h.sim.view.phase === 'levelUp') {
        if (h.sim.view.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
        h.step();
      }
      if (h.sim.view.phase === 'shop') {
        h.send({ type: 'pulse.begin' });
        h.step();
      }
    }
    expect(stepUntil(h, () => h.sim.view.phase === 'victory', 600)).toBe(true);
    expect(h.of(SimEventType.RunEnded)[0]?.a).toBe(RunOutcome.Victory);
    expect(h.sim.view.runStats.pulsesCleared).toBe(slots.length);
  });
});

describe('missing data guard (K19)', () => {
  it('does not crash on empty data and rejects run.start', () => {
    const base = fixtureGameData();
    const empty = {
      ...base,
      classes: [],
      meta: { ...base.meta, missingTables: ['classes', 'waves'] },
    };
    const sim = createSim({ data: empty });
    sim.enqueue({
      type: 'run.start',
      seed: 1,
      classId: 'test_lamp',
      profile: 'run_a_m1',
      difficulty: 0,
    });
    sim.step({ moveX: 0, moveY: 0, held: 0, pressed: 0, aimX: 0, aimY: 0 });
    expect(sim.view.phase).toBe('idle');
    let rejected = -1;
    for (let i = 0; i < sim.events.count; i++) {
      if (sim.events.type[i] === SimEventType.CommandRejected) rejected = sim.events.a[i] ?? -1;
    }
    expect(rejected).toBe(RejectReason.UnknownId);
  });

  it('runs on the LP fixture data (missing optional tables)', () => {
    const sim = createSim({ data: fixtureGameData() });
    sim.enqueue({
      type: 'run.start',
      seed: 1,
      classId: 'test_lamp',
      profile: 'run_a_m1',
      difficulty: 0,
    });
    const input = { moveX: 50, moveY: 0, held: 0, pressed: 0, aimX: 0, aimY: 0 };
    for (let i = 0; i < 3000; i++) sim.step(input);
    expect(sim.view.phase).not.toBe('idle');
  });
});
