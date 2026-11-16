import { describe, expect, it } from 'vitest';
import { computeUiScale } from '../../../src/ui/scale.ts';

describe('computeUiScale', () => {
  it('matches the ui-spec 7.1 table at DPR 1', () => {
    expect(computeUiScale(1920, 1080, 1, 0).uiScale).toBe(3);
    expect(computeUiScale(1280, 720, 1, 0).uiScale).toBe(2);
    expect(computeUiScale(1366, 768, 1, 0).uiScale).toBe(2);
    expect(computeUiScale(2560, 1440, 1, 0).uiScale).toBe(4);
  });

  it('computes the scale in physical pixels and converts back to CSS px at DPR 1.25', () => {
    // 1536 x 864 CSS at 1.25 is a 1920 x 1080 panel.
    const s = computeUiScale(1536, 864, 1.25, 0);
    expect(s.uiScale).toBe(3);
    expect(s.unitCss).toBeCloseTo(2.4);
    expect(s.unitCss * 1.25).toBe(3);
  });

  it('keeps UI scale 2 on a 1920 x 950 browser viewport (world scale is separate)', () => {
    expect(computeUiScale(1920, 950, 1, 0).uiScale).toBe(2);
  });

  it('adds one integer font step per text size level', () => {
    expect(computeUiScale(1920, 1080, 1, 0).fontScale).toBe(3);
    expect(computeUiScale(1920, 1080, 1, 1).fontScale).toBe(4);
    expect(computeUiScale(1920, 1080, 1, 2).fontScale).toBe(5);
  });

  it('never goes below scale 2 and flags a too small window', () => {
    const s = computeUiScale(1000, 600, 1, 0);
    expect(s.uiScale).toBe(2);
    expect(s.tooSmall).toBe(true);
    expect(computeUiScale(1280, 720, 1, 0).tooSmall).toBe(false);
  });
});
