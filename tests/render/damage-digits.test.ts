// Damage number layout (AD, M1-05).

import { describe, expect, it } from 'vitest';
import {
  DAMAGE_NUMBER_LIFE_SEC,
  DAMAGE_NUMBER_RISE_PX,
  damageAlpha,
  damageRisePx,
  digitOffsetX,
  digitsOf,
  MAX_DIGITS,
} from '../../src/render/vfx/damage-digits.ts';

const digits = (v: number): number[] => {
  const out = new Uint8Array(MAX_DIGITS);
  return Array.from(out.subarray(0, digitsOf(v, out)));
};

describe('digitsOf', () => {
  it('writes digits most significant first', () => {
    expect(digits(7)).toEqual([7]);
    expect(digits(42)).toEqual([4, 2]);
    expect(digits(1305)).toEqual([1, 3, 0, 5]);
  });
  it('rounds, shows at least 1 for a hit, nothing for 0', () => {
    expect(digits(12.6)).toEqual([1, 3]);
    expect(digits(0.2)).toEqual([1]);
    expect(digits(0)).toEqual([]);
    expect(digits(-5)).toEqual([]);
    expect(digits(Number.NaN)).toEqual([]);
  });
  it('clamps to five digits', () => {
    expect(digits(1234567)).toEqual([9, 9, 9, 9, 9]);
  });
});

describe('digitOffsetX', () => {
  it('centres glyphs on the hit point with a 4 px advance', () => {
    expect(digitOffsetX(0, 1)).toBe(0);
    expect([0, 1].map((i) => digitOffsetX(i, 2))).toEqual([-2, 2]);
    expect([0, 1, 2].map((i) => digitOffsetX(i, 3))).toEqual([-4, 0, 4]);
  });
});

describe('rise and fade', () => {
  it('rises in whole pixels with ease-out to the full height', () => {
    expect(damageRisePx(0)).toBe(0);
    expect(damageRisePx(DAMAGE_NUMBER_LIFE_SEC)).toBe(DAMAGE_NUMBER_RISE_PX);
    expect(damageRisePx(DAMAGE_NUMBER_LIFE_SEC / 2)).toBeGreaterThan(DAMAGE_NUMBER_RISE_PX / 2);
    expect(Number.isInteger(damageRisePx(0.123))).toBe(true);
  });
  it('stays opaque, then fades to 0 at the end of life', () => {
    expect(damageAlpha(0)).toBe(1);
    expect(damageAlpha(DAMAGE_NUMBER_LIFE_SEC * 0.5)).toBe(1);
    expect(damageAlpha(DAMAGE_NUMBER_LIFE_SEC * 0.85)).toBeCloseTo(0.5, 5);
    expect(damageAlpha(DAMAGE_NUMBER_LIFE_SEC)).toBe(0);
  });
});
