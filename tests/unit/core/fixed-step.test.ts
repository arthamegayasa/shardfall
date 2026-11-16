import { describe, expect, it } from 'vitest';
import {
  createFixedStep,
  createRng,
  MAX_TICKS_PER_FRAME,
  TICK_MS,
} from '../../../src/core/index.ts';

/** Total ticks after feeding the given frame deltas. */
function run(deltas: readonly number[], maxTicks = MAX_TICKS_PER_FRAME): number {
  const fs = createFixedStep({ maxTicksPerFrame: maxTicks });
  let ticks = 0;
  for (const d of deltas) ticks += fs.advance(d);
  return ticks;
}

describe('fixed step accumulator', () => {
  it('runs 60 ticks per simulated second at 30, 60, and 144 fps (D-6)', () => {
    for (const fps of [30, 60, 144]) {
      const deltas = Array.from({ length: fps * 10 }, () => 1000 / fps);
      const ticks = run(deltas);
      expect(Math.abs(ticks - 600)).toBeLessThanOrEqual(1);
    }
  });

  it('runs the same number of ticks for seeded random frame times (D-6)', () => {
    const rng = createRng(31337);
    const deltas = Array.from({ length: 2000 }, () => rng.range(4, 40));
    const total = deltas.reduce((s, d) => s + d, 0);
    expect(Math.abs(run(deltas) - total / TICK_MS)).toBeLessThanOrEqual(1);
  });

  it('caps ticks per frame and drops the excess instead of spiralling', () => {
    const fs = createFixedStep({ maxTicksPerFrame: 4 });
    expect(fs.advance(200)).toBe(4);
    // The excess is dropped: the next normal frame does not owe catch-up ticks.
    expect(fs.advance(TICK_MS)).toBe(1);
    expect(fs.droppedTicks).toBeGreaterThan(0);
  });

  it('clamps huge deltas (tab switch) to 250 ms before the cap applies', () => {
    const fs = createFixedStep({ maxTicksPerFrame: 100 });
    expect(fs.advance(10_000)).toBe(15);
  });

  it('keeps alpha in [0, 1)', () => {
    const fs = createFixedStep();
    for (const d of [3, 7, 16.7, 33.4, 1, 0]) {
      fs.advance(d);
      expect(fs.alpha).toBeGreaterThanOrEqual(0);
      expect(fs.alpha).toBeLessThan(1);
    }
  });

  it('scales time for e2e setTimeScale', () => {
    const fs = createFixedStep({ maxTicksPerFrame: 16 });
    expect(fs.advance(TICK_MS * 2, 4)).toBe(8);
  });

  it('ignores negative deltas', () => {
    const fs = createFixedStep();
    expect(fs.advance(-50)).toBe(0);
  });
});
