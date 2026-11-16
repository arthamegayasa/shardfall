import { describe, expect, it } from 'vitest';
import {
  pixelScaleFor,
  virtualFrameFor,
  virtualToWorld,
  worldToRef,
  worldToVirtual,
} from '../../../src/core/index.ts';

describe('projection', () => {
  it('maps the final arena corners to the documented reference pixels (architecture 7.3)', () => {
    const p = { x: 0, y: 0 };
    worldToRef(-16, -10, 0, p);
    expect(p).toEqual({ x: 64, y: 100 });
    worldToRef(16, 10, 0, p);
    expect(p).toEqual({ x: 576, y: 300 });
  });

  it('uses whole pixels per floor unit: 16 along x, 10 along depth', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    worldToRef(0, 0, 0, a);
    worldToRef(1, 1, 0, b);
    expect([b.x - a.x, b.y - a.y]).toEqual([16, 10]);
  });

  it('picks the integer world scale from the required box (architecture 7.3 table)', () => {
    const cases: [number, number, number, number, number][] = [
      [1920, 1080, 3, 640, 360],
      [1920, 950, 3, 640, 316],
      [1280, 720, 2, 640, 360],
      [1366, 768, 2, 683, 384],
      [2560, 1440, 4, 640, 360],
      [2560, 1080, 3, 853, 360],
    ];
    for (const [w, h, scale, vw, vh] of cases) {
      expect(pixelScaleFor(w, h)).toBe(scale);
      const f = virtualFrameFor(w, h);
      expect([f.width, f.height]).toEqual([vw, vh]);
    }
  });

  it('round-trips floor points through virtual pixels', () => {
    const f = virtualFrameFor(1366, 768);
    const v = { x: 0, y: 0 };
    const w = { x: 0, y: 0 };
    worldToVirtual(f, 3.25, -4.5, 0, v);
    virtualToWorld(f, v.x, v.y, w);
    expect(w.x).toBeCloseTo(3.25, 10);
    expect(w.y).toBeCloseTo(-4.5, 10);
  });
});
