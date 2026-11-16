import { describe, expect, it } from 'vitest';
import { DuckTarget, createDucker, duckGroupOf } from '../../../src/audio/ducking.ts';
import {
  DEFAULT_PAN_BOUNDS,
  coalesceBoostDb,
  panBoundsOf,
  panForX,
  volumeToGain,
} from '../../../src/audio/mix-math.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';

describe('mix math', () => {
  it('maps fader values with (v / 100) ^ 2', () => {
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(50)).toBe(0.25);
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(140)).toBe(1);
  });

  it('pans world x across the 16 u half width, scaled to 0.6', () => {
    expect(panForX(0, DEFAULT_PAN_BOUNDS)).toBe(0);
    expect(panForX(16, DEFAULT_PAN_BOUNDS)).toBeCloseTo(0.6, 10);
    expect(panForX(-8, DEFAULT_PAN_BOUNDS)).toBeCloseTo(-0.3, 10);
    expect(panForX(-40, DEFAULT_PAN_BOUNDS)).toBeCloseTo(-0.6, 10);
  });

  it('takes pan bounds from the arena boundary', () => {
    const arena = fixtureGameData().arenas[0];
    expect(arena).toBeDefined();
    if (arena === undefined) return;
    expect(panBoundsOf(arena)).toEqual({ centerX: 0, halfWidth: 10 });
  });

  it('adds 1 dB per doubling of coalesced triggers up to the cap', () => {
    expect(coalesceBoostDb(1, 3)).toBe(0);
    expect(coalesceBoostDb(2, 3)).toBe(1);
    expect(coalesceBoostDb(4, 3)).toBe(2);
    expect(coalesceBoostDb(64, 3)).toBe(3);
    expect(coalesceBoostDb(8, 0)).toBe(0);
  });
});

describe('ducking', () => {
  it('ducks music by 6 dB after a player hit, then releases', () => {
    const d = createDucker();
    d.trigger('player_hit', 1, 0.25);
    expect(d.duckDb(DuckTarget.Music, 1.1)).toBeCloseTo(-6, 10);
    expect(d.duckDb(DuckTarget.SfxP56, 1.1)).toBeCloseTo(-8, 10);
    expect(d.duckDb(DuckTarget.SfxP12, 1.1)).toBe(0);
    // Hold ends at 1 + 0.01 + 0.15, release lasts 0.3 s.
    expect(d.duckDb(DuckTarget.Music, 1.31)).toBeCloseTo(-3, 5);
    expect(d.duckDb(DuckTarget.Music, 1.5)).toBe(0);
  });

  it('applies the deepest active duck per target', () => {
    const d = createDucker();
    d.trigger('reward', 1, 0.7);
    d.trigger('big_moment', 1, 3);
    expect(d.duckDb(DuckTarget.Music, 1.2)).toBeCloseTo(-12, 10);
  });

  it('caps the telegraph hold at 600 ms', () => {
    const d = createDucker();
    d.trigger('telegraph', 0, 2);
    expect(d.duckDb(DuckTarget.SfxP56, 0.6)).toBeCloseTo(-4, 10);
    expect(d.duckDb(DuckTarget.SfxP56, 0.9)).toBe(0);
  });

  it('groups sfx priorities as in audio-direction 8.5', () => {
    expect(duckGroupOf(1)).toBe(DuckTarget.SfxP12);
    expect(duckGroupOf(3)).toBe(DuckTarget.SfxP3);
    expect(duckGroupOf(4)).toBe(DuckTarget.SfxP4);
    expect(duckGroupOf(6)).toBe(DuckTarget.SfxP56);
  });
});
