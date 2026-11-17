import { describe, expect, it } from 'vitest';
import { moreAbove, moreBelow, overflows, scrollStep } from '../../../src/ui/scroll.ts';

describe('run end build list scroll mark and arrow scrolling (CD M3 10)', () => {
  it('needs no mark when the list fits', () => {
    const m = { top: 0, client: 300, height: 300 };
    expect(overflows(m)).toBe(false);
    expect(moreBelow(m)).toBe(false);
    expect(scrollStep(m, 1, 40)).toBeNull();
  });

  it('marks more below at the top and more above at the bottom', () => {
    expect(moreBelow({ top: 0, client: 300, height: 500 })).toBe(true);
    expect(moreAbove({ top: 0, client: 300, height: 500 })).toBe(false);
    expect(moreBelow({ top: 200, client: 300, height: 500 })).toBe(false);
    expect(moreAbove({ top: 200, client: 300, height: 500 })).toBe(true);
  });

  it('ignores sub-pixel rounding at the edges', () => {
    expect(overflows({ top: 0, client: 300, height: 300.5 })).toBe(false);
    expect(moreBelow({ top: 199.5, client: 300, height: 500 })).toBe(false);
  });

  it('scrolls one step and clamps, then lets the arrow leave the list at an edge', () => {
    expect(scrollStep({ top: 0, client: 300, height: 500 }, 1, 40)).toBe(40);
    expect(scrollStep({ top: 180, client: 300, height: 500 }, 1, 40)).toBe(200);
    expect(scrollStep({ top: 200, client: 300, height: 500 }, 1, 40)).toBeNull();
    expect(scrollStep({ top: 20, client: 300, height: 500 }, -1, 40)).toBe(0);
    expect(scrollStep({ top: 0, client: 300, height: 500 }, -1, 40)).toBeNull();
  });
});
