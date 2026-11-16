// Regression tests for bugs found by QA in M1-09b (docs/qa/bugs.md). Each test names its bug id.
// A bug that is still open is written with it.fails: the test documents the expected behaviour and
// passes while the bug exists. The programmer who fixes the bug changes it.fails to it (test-plan 1.4).

import { describe, expect, it } from 'vitest';
import { createInputFrame } from '../../../src/core/index.ts';
import { createSim } from '../../../src/sim/index.ts';
import { realGameData } from './support/real-data.ts';

const data = realGameData();
const classId = data.classes[0]?.id ?? '';
const startWeapon = data.classes[0]?.startWeapon ?? '';

function ownedWeaponIds(view: {
  shop: { inventory: readonly { weaponIndex: number }[] };
}): string[] {
  return view.shop.inventory
    .filter((s) => s.weaponIndex >= 0)
    .map((s) => data.weapons[s.weaponIndex]?.id ?? '?');
}

describe('QA M1 bug regressions', () => {
  it('BUG-001: in Pulse 1 the shop view (pause build summary) shows the class weapon of the run', () => {
    const sim = createSim({ data });
    const input = createInputFrame();
    sim.enqueue({ type: 'run.start', seed: 1, classId, profile: 'run_a', difficulty: 0 });
    sim.step(input);
    expect(sim.view.phase).toBe('pulse');
    expect(ownedWeaponIds(sim.view)).toEqual([startWeapon]);
  });

  it('BUG-001: a new run does not show the previous run weapons and Mementos', () => {
    const sim = createSim({ data, debugCommands: true });
    const input = createInputFrame();
    sim.enqueue({ type: 'run.start', seed: 1, classId, profile: 'run_a', difficulty: 0 });
    sim.step(input);
    // Reach the first shop so the view is filled, with an extra weapon and a Memento.
    const extra = data.weapons.find((w) => w.id !== startWeapon)?.id ?? '';
    sim.enqueue({ type: 'debug.grant', kind: 'weapon', id: extra, tier: 1 });
    sim.enqueue({ type: 'debug.grant', kind: 'memento', id: data.mementos[0]?.id ?? '', tier: 1 });
    sim.enqueue({ type: 'debug.endPulse' });
    for (let i = 0; i < 600 && sim.view.phase !== 'shop'; i++) {
      if (sim.view.phase === 'levelUp') sim.enqueue({ type: 'levelup.pick', choice: 0 });
      sim.step(input);
    }
    expect(sim.view.phase).toBe('shop');
    expect(ownedWeaponIds(sim.view)).toContain(extra);
    // Abandon and start a fresh run.
    sim.enqueue({ type: 'run.abandon' });
    for (let i = 0; i < 600 && sim.view.phase !== 'defeat'; i++) sim.step(input);
    sim.enqueue({ type: 'run.start', seed: 2, classId, profile: 'run_a', difficulty: 0 });
    sim.step(input);
    expect(sim.view.phase).toBe('pulse');
    expect(ownedWeaponIds(sim.view)).toEqual([startWeapon]);
    expect(sim.view.shop.mementos).toEqual([]);
  });
});
