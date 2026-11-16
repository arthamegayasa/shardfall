// World to screen projection as pure functions (architecture.md 7.1, 7.3). [Frozen M1]
// Used by render, arena validator, art tools, and e2e hooks so every consumer agrees on the same pixels.

import {
  DEPTH_PX_PER_U,
  HEIGHT_PX_PER_U,
  PX_PER_U,
  REF_FRAME_H,
  REF_FRAME_W,
  REF_ORIGIN_X,
  REF_ORIGIN_Y,
  REQUIRED_BOX_H,
  REQUIRED_BOX_W,
} from './constants.ts';

export interface MutablePoint {
  x: number;
  y: number;
}

/** Integer world scale from physical pixels: max(1, floor(min(Wp / 608, Hp / 296))). */
export function pixelScaleFor(physicalW: number, physicalH: number): number {
  return Math.max(1, Math.floor(Math.min(physicalW / REQUIRED_BOX_W, physicalH / REQUIRED_BOX_H)));
}

export interface VirtualFrame {
  /** Integer world scale: one virtual px = pixelScale physical px. */
  readonly pixelScale: number;
  /** Virtual resolution (render target size). */
  readonly width: number;
  readonly height: number;
  /** Top-left of the 640 x 360 reference frame inside the virtual frame (integers, may be negative). */
  readonly originX: number;
  readonly originY: number;
}

export function virtualFrameFor(physicalW: number, physicalH: number): VirtualFrame {
  const pixelScale = pixelScaleFor(physicalW, physicalH);
  const width = Math.max(1, Math.floor(physicalW / pixelScale));
  const height = Math.max(1, Math.floor(physicalH / pixelScale));
  return {
    pixelScale,
    width,
    height,
    originX: Math.floor((width - REF_FRAME_W) / 2),
    originY: Math.floor((height - REF_FRAME_H) / 2),
  };
}

/** World floor point (u) plus height h (u) to reference frame px (640 x 360 frame, origin top-left). */
export function worldToRef(x: number, y: number, h: number, out: MutablePoint): void {
  out.x = REF_ORIGIN_X + PX_PER_U * x;
  out.y = REF_ORIGIN_Y + DEPTH_PX_PER_U * y - HEIGHT_PX_PER_U * h;
}

/** World point to virtual px for a given frame. */
export function worldToVirtual(
  frame: VirtualFrame,
  x: number,
  y: number,
  h: number,
  out: MutablePoint,
): void {
  worldToRef(x, y, h, out);
  out.x += frame.originX;
  out.y += frame.originY;
}

/** Virtual px back to a world floor point (h = 0). Inverse of worldToVirtual on the floor. */
export function virtualToWorld(
  frame: VirtualFrame,
  vx: number,
  vy: number,
  out: MutablePoint,
): void {
  out.x = (vx - frame.originX - REF_ORIGIN_X) / PX_PER_U;
  out.y = (vy - frame.originY - REF_ORIGIN_Y) / DEPTH_PX_PER_U;
}

/** Quantise a world coordinate to 1/16 u, the InputFrame aim resolution (architecture 6.2). */
export function quantizeAim(u: number): number {
  return Math.round(u * PX_PER_U);
}
