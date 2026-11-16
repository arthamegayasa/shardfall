// K20: sim helpers for the e2e hooks (spawnStress, loadReplay).

import { describe, expect, it } from 'vitest';
import { SimEventType, createInputFrame } from '../../../src/core/index.ts';
import { createSim, decodeReplay, playReplay, stressCommands } from '../../../src/sim/index.ts';
import { simFixtureData } from './support/sim-fixture.ts';

const data = simFixtureData();

describe('e2e support (K20)', () => {
  it("stressCommands('peak') builds the last normal Pulse and a late-run build, all accepted", () => {
    const sim = createSim({ data, debugCommands: true });
    const input = createInputFrame();
    sim.enqueue({
      type: 'run.start',
      seed: 1,
      classId: 'lantern',
      profile: 'run_a',
      difficulty: 0,
    });
    sim.step(input);
    const cmds = stressCommands(data, 'peak');
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) sim.enqueue(c);
    sim.step(input);
    for (let i = 0; i < sim.events.count; i++) {
      expect(sim.events.type[i]).not.toBe(SimEventType.CommandRejected);
    }
    const spawns = cmds.filter((c) => c.type === 'debug.spawn').length;
    const e = sim.view.enemies;
    let alive = 0;
    for (let i = 0; i < e.highWater; i++) if (e.alive[i] === 1) alive++;
    expect(alive).toBe(spawns);
    // A few hundred ticks of peak load run without errors.
    for (let i = 0; i < 300; i++) sim.step(input);
    expect(sim.view.tick).toBeGreaterThan(300);
  });

  it("stressCommands('peak-boss') spawns the boss", () => {
    const sim = createSim({ data, debugCommands: true });
    const input = createInputFrame();
    sim.enqueue({
      type: 'run.start',
      seed: 1,
      classId: 'lantern',
      profile: 'run_a',
      difficulty: 0,
    });
    sim.step(input);
    for (const c of stressCommands(data, 'peak-boss')) sim.enqueue(c);
    sim.step(input);
    let bosses = 0;
    const e = sim.view.enemies;
    for (let i = 0; i < e.highWater; i++) if (e.alive[i] === 1 && e.rank[i] === 2) bosses++;
    expect(bosses).toBe(1);
  });

  it('decodeReplay rejects malformed input', () => {
    expect(decodeReplay(null)).toBeNull();
    expect(decodeReplay({ format: 'x' })).toBeNull();
  });

  it('playReplay reports the first mismatching checkpoint', () => {
    const replay = decodeReplay({
      format: 'shardfall-replay',
      v: 1,
      contentHash: data.meta.contentHash,
      contentTier: 'A',
      seed: 4,
      classId: 'lantern',
      profile: 'run_a',
      difficulty: 0,
      ticks: 120,
      input: [[120, 0, 0, 0, 0, 0, 0]],
      commands: [
        [0, { type: 'run.start', seed: 4, classId: 'lantern', profile: 'run_a', difficulty: 0 }],
      ],
      checkpoints: [[60, '00000000']],
    });
    expect(replay).not.toBeNull();
    if (replay === null) return;
    const res = playReplay(createSim({ data }), replay);
    expect(res.ticks).toBe(120);
    expect(res.mismatchAt).toBe(60);
  });
});
