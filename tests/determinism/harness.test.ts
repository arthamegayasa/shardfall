// Determinism harness (architecture.md 14.1), run against whatever createSim currently is.
// With the M1-01 stub this proves the plumbing (seeded streams, input, hash); GP extends it in M1-03
// with D-1 to D-9 on fixture data.

import { describe, expect, it } from 'vitest';
import { createInputFrame, toHex8 } from '../../src/core/index.ts';
import type { InputFrame } from '../../src/core/index.ts';
import { createSim } from '../../src/sim/index.ts';
import { fixtureGameData } from '../support/fixture-data.ts';

const data = fixtureGameData();

/** Deterministic scripted input: a slow circle of 8 directions. */
function scriptedInput(tick: number, out: InputFrame): void {
  const dirs = [
    [127, 0],
    [90, 90],
    [0, 127],
    [-90, 90],
    [-127, 0],
    [-90, -90],
    [0, -127],
    [90, -90],
  ] as const;
  const d = dirs[Math.floor(tick / 30) % dirs.length] ?? [0, 0];
  out.moveX = d[0];
  out.moveY = d[1];
}

function runHashes(seed: number, ticks: number): string[] {
  const sim = createSim({ data });
  sim.enqueue({
    type: 'run.start',
    seed,
    classId: 'test_lamp',
    profile: 'run_a_m1',
    difficulty: 0,
  });
  const input = createInputFrame();
  const hashes: string[] = [];
  for (let t = 0; t < ticks; t++) {
    scriptedInput(t, input);
    sim.step(input);
    if (sim.view.tick % 60 === 0) hashes.push(toHex8(sim.hash()));
  }
  return hashes;
}

describe('determinism harness', () => {
  it('D-1: same seed and input give identical checkpoints', () => {
    expect(runHashes(12345, 600)).toEqual(runHashes(12345, 600));
  });

  it('D-3: different seeds give different hashes', () => {
    expect(runHashes(1, 60)).not.toEqual(runHashes(2, 60));
  });
});
