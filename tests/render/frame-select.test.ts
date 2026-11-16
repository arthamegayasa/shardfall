// Sprite mapping logic (AD, M1-05): frame choice, line orientation, facing, quad placement.

import { describe, expect, it } from 'vitest';
import {
  REF_ORIGIN_X,
  REF_ORIGIN_Y,
  virtualFrameFor,
  worldToVirtual,
} from '../../src/core/index.ts';
import {
  dir4Index,
  facingFromMotion,
  feetPixel,
  frameIndexAt,
  frameIndexForProgress,
  isMoving,
  spriteQuad,
} from '../../src/render/sprites/frame-select.ts';

describe('frameIndexAt', () => {
  it('loops through frames at ticksPerFrame', () => {
    const walk = { ticksPerFrame: 8, loop: true, frameCount: 4 };
    expect([0, 7, 8, 15, 16, 31, 32].map((t) => frameIndexAt(walk, t))).toEqual([
      0, 0, 1, 1, 2, 3, 0,
    ]);
  });
  it('holds the last frame of a one-shot', () => {
    const shot = { ticksPerFrame: 4, loop: false, frameCount: 3 };
    expect([0, 4, 8, 100].map((t) => frameIndexAt(shot, t))).toEqual([0, 1, 2, 2]);
  });
  it('returns 0 for static sprites and negative clocks', () => {
    expect(frameIndexAt({ ticksPerFrame: 0, loop: true, frameCount: 10 }, 99)).toBe(0);
    expect(frameIndexAt({ ticksPerFrame: 5, loop: true, frameCount: 2 }, -3)).toBe(0);
  });
});

describe('frameIndexForProgress', () => {
  it('spreads progress evenly and clamps', () => {
    expect([-1, 0, 0.24, 0.25, 0.5, 0.99, 1, 2].map((p) => frameIndexForProgress(4, p))).toEqual([
      0, 0, 0, 1, 2, 3, 3, 3,
    ]);
    expect(frameIndexForProgress(1, 0.7)).toBe(0);
  });
});

describe('dir4Index (screen space, 16 x 10 px per u)', () => {
  it('maps cardinal directions', () => {
    expect(dir4Index(1, 0)).toBe(0);
    expect(dir4Index(-1, 0)).toBe(0);
    expect(dir4Index(0, 1)).toBe(2);
    expect(dir4Index(0, -1)).toBe(2);
  });
  it('maps screen diagonals: up-right rising, down-right falling', () => {
    // A 45 degree SCREEN diagonal needs 16 px across per 16 px down: vy = 1.6 vx in world u.
    expect(dir4Index(1, -1.6)).toBe(1);
    expect(dir4Index(-1, 1.6)).toBe(1);
    expect(dir4Index(1, 1.6)).toBe(3);
    expect(dir4Index(-1, -1.6)).toBe(3);
  });
  it('applies the camera foreshortening: world 45 degrees is shallower on screen', () => {
    // World (1, 1) shows as 16 px across, 10 px down: 32 degrees on screen, still a diagonal.
    expect(dir4Index(1, 1)).toBe(3);
    // World (1, 0.25) is 16 x 2.5 px: under 22.5 degrees, horizontal.
    expect(dir4Index(1, 0.25)).toBe(0);
  });
  it('treats zero velocity as horizontal', () => {
    expect(dir4Index(0, 0)).toBe(0);
  });
});

describe('facing and motion', () => {
  it('turns toward horizontal motion and keeps facing otherwise', () => {
    expect(facingFromMotion(0.05, -1)).toBe(1);
    expect(facingFromMotion(-0.05, 1)).toBe(-1);
    expect(facingFromMotion(0, -1)).toBe(-1);
    expect(facingFromMotion(0.0001, -1)).toBe(-1);
    expect(facingFromMotion(0, 0)).toBe(1);
  });
  it('detects movement above the epsilon', () => {
    expect(isMoving(0, 0)).toBe(false);
    expect(isMoving(0.0005, 0)).toBe(false);
    expect(isMoving(0, 0.075)).toBe(true);
  });
});

describe('spriteQuad', () => {
  const q = { left: 0, right: 0, top: 0, bottom: 0 };
  it('puts the trimmed rect bottom on the feet for a bottom-anchored frame', () => {
    // kept sprite: frame 24 x 24, anchor (12, 23), trimmed 18 x 21 at ox 3, oy 3.
    spriteQuad(12, 23, { w: 18, h: 21, ox: 3, oy: 3 }, 1, q);
    expect(q).toEqual({ left: -9, right: 9, top: 21, bottom: 0 });
  });
  it('mirrors around the feet when flipped', () => {
    spriteQuad(12, 23, { w: 13, h: 10, ox: 1, oy: 14 }, -1, q);
    expect(q).toEqual({ left: -2, right: 11, top: 10, bottom: 0 });
  });
  it('centres a mid-anchored decal on its point', () => {
    // fx-spawn-crack: frame 24 x 16, anchor (12, 11), trimmed 17 x 9 bottom aligned (oy 7).
    spriteQuad(12, 11, { w: 17, h: 9, ox: 3, oy: 7 }, 1, q);
    expect(q.top).toBe(5);
    expect(q.bottom).toBe(-4);
  });
});

describe('feetPixel', () => {
  it('matches core worldToVirtual on whole pixels at 1 u = 16 x 10 px', () => {
    const frame = virtualFrameFor(1920, 950);
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    for (const [x, y] of [
      [0, 0],
      [-16, -10],
      [16, 10],
      [3.25, -2.7],
    ] as const) {
      feetPixel(frame.originX, frame.originY, REF_ORIGIN_X, REF_ORIGIN_Y, x, y, a);
      worldToVirtual(frame, x, y, 0, b);
      expect(a.x).toBe(Math.round(b.x));
      expect(a.y).toBe(Math.round(b.y));
    }
    // Arena corners land on the reference box of architecture 7.3 (x 64..576, y 100..300).
    feetPixel(0, 0, REF_ORIGIN_X, REF_ORIGIN_Y, -16, -10, a);
    expect(a).toEqual({ x: 64, y: 100 });
    feetPixel(0, 0, REF_ORIGIN_X, REF_ORIGIN_Y, 16, 10, a);
    expect(a).toEqual({ x: 576, y: 300 });
  });
});
