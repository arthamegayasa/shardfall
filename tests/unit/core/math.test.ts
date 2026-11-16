import { describe, expect, it } from 'vitest';
import { atan2Turns, cosTurns, sinTurns, TAU } from '../../../src/core/index.ts';

describe('deterministic trig', () => {
  it('matches Math.sin and Math.cos within 1e-7 over several turns', () => {
    for (let i = -2000; i <= 2000; i++) {
      const t = i / 997;
      expect(Math.abs(sinTurns(t) - Math.sin(t * TAU))).toBeLessThan(1e-7);
      expect(Math.abs(cosTurns(t) - Math.cos(t * TAU))).toBeLessThan(1e-7);
    }
  });

  it('hits exact values at quarter turns', () => {
    expect(sinTurns(0)).toBe(0);
    expect(sinTurns(0.5)).toBeCloseTo(0, 12);
    expect(sinTurns(0.25)).toBeCloseTo(1, 9);
    expect(cosTurns(0)).toBeCloseTo(1, 9);
  });

  it('matches Math.atan2 within 1e-7 turns in every quadrant', () => {
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * TAU;
      for (const r of [0.001, 1, 250]) {
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        expect(Math.abs(atan2Turns(y, x) - Math.atan2(y, x) / TAU)).toBeLessThan(1e-7);
      }
    }
    expect(atan2Turns(0, 0)).toBe(0);
  });
});
