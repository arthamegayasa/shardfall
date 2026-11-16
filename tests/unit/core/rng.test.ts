import { describe, expect, it } from 'vitest';
import {
  createRng,
  createRngStreams,
  RNG_STREAMS,
  seedState,
  streamSeed,
} from '../../../src/core/index.ts';

const draw = (n: number, next: () => number): number[] => Array.from({ length: n }, next);

describe('sfc32 rng', () => {
  it('matches the reference sfc32 sequence for an explicit state', () => {
    // Reference: sfc32 as published by Chris Doty-Humphrey (PractRand), state (1, 2, 3, 4).
    const rng = createRng([1, 2, 3, 4]);
    const ref = (() => {
      let a = 1;
      let b = 2;
      let c = 3;
      let d = 4;
      return (): number => {
        const t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        return t >>> 0;
      };
    })();
    expect(draw(64, () => rng.nextU32())).toEqual(draw(64, ref));
  });

  it('gives the same sequence for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    expect(draw(100, () => a.nextU32())).toEqual(draw(100, () => b.nextU32()));
  });

  it('gives different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(draw(8, () => a.nextU32())).not.toEqual(draw(8, () => b.nextU32()));
  });

  it('keeps next() in [0, 1) and int(n) in [0, n)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 10_000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const k = rng.int(7);
      expect(Number.isInteger(k) && k >= 0 && k < 7).toBe(true);
    }
  });

  it('covers intRange bounds inclusively', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.intRange(-2, 2));
    expect([...seen].sort((x, y) => x - y)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('restores an exact position from getState and setState', () => {
    const rng = createRng(777);
    draw(13, () => rng.nextU32());
    const saved = rng.getState();
    const expected = draw(20, () => rng.nextU32());
    rng.setState(saved);
    expect(draw(20, () => rng.nextU32())).toEqual(expected);
  });

  it('writes the state without allocating a new array', () => {
    const rng = createRng(3);
    const out = new Uint32Array(4);
    rng.writeState(out);
    expect([...out]).toEqual([...rng.getState()]);
  });

  it('seeds deterministically from a 32-bit seed (golden values)', () => {
    // Golden values guard seeding, replays, and saves against accidental change.
    // Update only together with a written reason in architecture.md section 19.
    expect(seedState(1)).toEqual([2853186028, 3685895692, 3377028191, 3011703624]);
    const rng = createRng(1);
    expect([rng.nextU32(), rng.nextU32()]).toEqual([960850752, 2734082507]);
    expect(streamSeed(1, 'spawn')).toBe(2756249036);
  });
});

describe('rng streams', () => {
  it('derive distinct seeds per stream name', () => {
    const seeds = RNG_STREAMS.map((s) => streamSeed(1, s));
    expect(new Set(seeds).size).toBe(RNG_STREAMS.length);
  });

  it('are independent: draws on one stream never move another', () => {
    const a = createRngStreams(2024);
    const b = createRngStreams(2024);
    // Extra shop rerolls on run a only.
    for (let i = 0; i < 50; i++) a.shop.nextU32();
    expect(draw(10, () => a.spawn.nextU32())).toEqual(draw(10, () => b.spawn.nextU32()));
    expect(draw(10, () => a.combat.nextU32())).toEqual(draw(10, () => b.combat.nextU32()));
  });

  it('differ between run seeds', () => {
    const a = createRngStreams(1);
    const b = createRngStreams(2);
    expect(a.spawn.nextU32()).not.toBe(b.spawn.nextU32());
  });
});
