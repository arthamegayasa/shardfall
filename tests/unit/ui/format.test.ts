import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../../../src/core/index.ts';
import {
  ceilSeconds,
  floorSeconds,
  formatClock,
  formatInt,
  formatStatValue,
  frac01,
  keyLabel,
} from '../../../src/ui/format.ts';

describe('ui format helpers', () => {
  it('formats a clock as m:ss with a padded seconds field', () => {
    expect(formatClock(24)).toBe('0:24');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(4503)).toBe('75:03');
    expect(formatClock(-3)).toBe('0:00');
  });

  it('rounds remaining ticks up so the last second shows until the final tick', () => {
    expect(ceilSeconds(TICK_RATE * 2)).toBe(2);
    expect(ceilSeconds(TICK_RATE * 2 - 1)).toBe(2);
    expect(ceilSeconds(1)).toBe(1);
    expect(ceilSeconds(0)).toBe(0);
    expect(ceilSeconds(-5)).toBe(0);
  });

  it('rounds elapsed ticks down', () => {
    expect(floorSeconds(TICK_RATE * 3 - 1)).toBe(2);
    expect(floorSeconds(0)).toBe(0);
  });

  it('shows integers rounded up and never negative', () => {
    expect(formatInt(41.2)).toBe('42');
    expect(formatInt(42)).toBe('42');
    expect(formatInt(-1)).toBe('0');
  });

  it('shows stat values with at most two decimals and no trailing zeros', () => {
    expect(formatStatValue(4)).toBe('4');
    expect(formatStatValue(1.5)).toBe('1.5');
    expect(formatStatValue(0.333333)).toBe('0.33');
    expect(formatStatValue(-0.001)).toBe('0');
  });

  it('clamps fractions to 0..1 and treats a zero denominator as 0', () => {
    expect(frac01(5, 10)).toBe(0.5);
    expect(frac01(15, 10)).toBe(1);
    expect(frac01(-1, 10)).toBe(0);
    expect(frac01(1, 0)).toBe(0);
  });

  it('labels key codes for hints', () => {
    expect(keyLabel('KeyR')).toBe('R');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Escape')).toBe('Esc');
    expect(keyLabel(null)).toBe('');
  });
});
