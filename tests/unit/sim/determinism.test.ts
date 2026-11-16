// K17: determinism (architecture 14.1): same seed and inputs give identical hashes, replays play back,
// save and load keep the hash, shop rerolls do not touch the spawn stream.

import { describe, expect, it } from 'vitest';
import { REPLAY_CHECKPOINT_TICKS, createInputFrame, toHex8 } from '../../../src/core/index.ts';
import type { Command, ReplayInputRun, ReplayV1, Sim } from '../../../src/core/index.ts';
import { createSim, playReplay } from '../../../src/sim/index.ts';
import { botCommands, botInput } from './support/bot.ts';
import { harness } from './support/harness.ts';
import { simFixtureData } from './support/sim-fixture.ts';

const data = simFixtureData();

/** Drive a sim with the bot for `ticks` ticks, recording a ReplayV1. */
function record(
  seed: number,
  profile: string,
  ticks: number,
): { replay: ReplayV1; hashes: string[]; sim: Sim } {
  const sim = createSim({ data });
  const input = createInputFrame();
  const cmds: Command[] = [];
  const runs: [number, number, number, number, number, number, number][] = [];
  const commands: (readonly [number, Command])[] = [];
  const checkpoints: (readonly [number, string])[] = [];
  const hashes: string[] = [];
  const start: Command = { type: 'run.start', seed, classId: 'lantern', profile, difficulty: 0 };
  commands.push([0, start]);
  sim.enqueue(start);
  for (let t = 0; t < ticks; t++) {
    const v = sim.view;
    if (t > 0) {
      if (v.phase === 'pulse') botInput(v, input);
      else {
        input.moveX = 0;
        input.moveY = 0;
        input.pressed = 0;
        botCommands(v, cmds);
        for (const c of cmds) {
          commands.push([t, c]);
          sim.enqueue(c);
        }
      }
    }
    const last = runs[runs.length - 1];
    const f = input;
    if (
      last?.[1] === f.moveX &&
      last[2] === f.moveY &&
      last[3] === f.held &&
      last[4] === f.pressed &&
      last[5] === f.aimX &&
      last[6] === f.aimY
    )
      last[0]++;
    else runs.push([1, f.moveX, f.moveY, f.held, f.pressed, f.aimX, f.aimY]);
    sim.step(input);
    if ((t + 1) % REPLAY_CHECKPOINT_TICKS === 0) {
      const h = toHex8(sim.hash());
      checkpoints.push([t + 1, h]);
      hashes.push(h);
    }
  }
  const replay: ReplayV1 = {
    format: 'shardfall-replay',
    v: 1,
    contentHash: data.meta.contentHash,
    contentTier: 'A',
    seed,
    classId: 'lantern',
    profile,
    difficulty: 0,
    ticks,
    input: runs.map((r): ReplayInputRun => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]),
    commands,
    checkpoints,
  };
  return { replay, hashes, sim };
}

describe('determinism (K17)', () => {
  it('D-1: same seed and input give identical checkpoints over a long run', () => {
    const a = record(12345, 'run_a', 6000);
    const b = record(12345, 'run_a', 6000);
    expect(a.hashes).toHaveLength(100);
    expect(a.hashes).toEqual(b.hashes);
  });

  it('D-3: different seeds give different hashes', () => {
    expect(record(1, 'run_a', 600).hashes).not.toEqual(record(2, 'run_a', 600).hashes);
  });

  it('replay: recorded input and commands play back with every checkpoint matching', () => {
    const rec = record(777, 'run_a', 9000);
    const res = playReplay(createSim({ data }), rec.replay);
    expect(res.ticks).toBe(9000);
    expect(res.mismatchAt).toBe(-1);
    expect(res.finalHash).toBe(toHex8(rec.sim.hash()));
  });

  it('D-4: save then load in the shop keeps the hash identical to the uninterrupted run', () => {
    const a = harness();
    a.start({ seed: 99 });
    // Play Pulses 1 and 2 with the bot until the shop of Pulse 3 is open.
    const cmds: Command[] = [];
    const drive = (h: typeof a, until: () => boolean, max: number): void => {
      for (let i = 0; i < max && !until(); i++) {
        if (h.sim.view.phase === 'pulse') botInput(h.sim.view, h.input);
        else {
          h.input.moveX = 0;
          h.input.moveY = 0;
          h.input.pressed = 0;
          botCommands(h.sim.view, cmds);
          // Stop at the shop of the third Pulse without buying or starting.
          if (h.sim.view.phase === 'shop' && h.sim.view.pulse.index === 2) return;
          for (const c of cmds) h.send(c);
        }
        h.step();
      }
    };
    drive(a, () => a.sim.view.phase === 'shop' && a.sim.view.pulse.index === 2, 20_000);
    expect(a.sim.view.phase).toBe('shop');
    const save = a.sim.save();
    expect(save).not.toBeNull();
    if (save === null) return;
    const b = harness();
    const json = JSON.parse(JSON.stringify(save)) as typeof save;
    expect(b.sim.load(json)).toEqual({ ok: true });
    expect(toHex8(b.sim.hash())).toBe(toHex8(a.sim.hash()));
    // Continue both with the same commands and inputs.
    for (const h of [a, b]) {
      h.send({ type: 'shop.reroll' });
      h.send({ type: 'pulse.begin' });
    }
    for (let i = 0; i < 1200; i++) {
      botInput(a.sim.view, a.input);
      Object.assign(b.input, a.input);
      a.step();
      b.step();
      if (i % 60 === 0) expect(toHex8(b.sim.hash())).toBe(toHex8(a.sim.hash()));
    }
    expect(toHex8(b.sim.hash())).toBe(toHex8(a.sim.hash()));
  });

  it('a shop reroll does not change the next Pulse spawn schedule (RNG stream isolation)', () => {
    const make = (extraRerolls: number) => {
      const h = harness();
      h.start({ seed: 5 });
      h.send({ type: 'debug.endPulse' });
      h.step();
      for (let i = 0; i < 200 && h.sim.view.phase !== 'shop'; i++) {
        if (h.sim.view.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
        h.step();
      }
      h.send({ type: 'debug.glint', amount: 500 });
      for (let i = 0; i < extraRerolls; i++) h.send({ type: 'shop.reroll' });
      h.send({ type: 'pulse.begin' });
      h.step();
      const r = h.ctx.run;
      return {
        sched: Array.from(r.schedTick.subarray(0, r.scheduleCount)).concat(
          Array.from(r.schedSector.subarray(0, r.scheduleCount)),
        ),
        spawn: h.ctx.rng.spawn.getState(),
        shop: h.ctx.rng.shop.getState(),
      };
    };
    const a = make(0);
    const b = make(3);
    expect(b.sched).toEqual(a.sched);
    expect(b.spawn).toEqual(a.spawn);
    expect(b.shop).not.toEqual(a.shop);
  });
});
