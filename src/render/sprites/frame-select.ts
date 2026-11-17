// Pure sprite mapping helpers (AD): animation frame choice, direction frames, facing, and the quad
// placement that the sprite vertex shader mirrors (architecture.md 7.2). No three.js, no allocation.

import { DEPTH_PX_PER_U, PX_PER_U } from '../../core/index.ts';

export interface AnimTiming {
  readonly ticksPerFrame: number;
  readonly loop: boolean;
  readonly frameCount: number;
}

/** Frame index for a render clock in ticks: loops wrap, one-shots hold the last frame, 0 ticks = frame 0. */
export function frameIndexAt(anim: AnimTiming, clockTicks: number): number {
  const n = anim.frameCount;
  if (n <= 1 || anim.ticksPerFrame <= 0) return 0;
  const step = Math.floor(Math.max(0, clockTicks) / anim.ticksPerFrame);
  return anim.loop ? step % n : Math.min(step, n - 1);
}

/** Frame index for a 0..1 progress (spawn crack growth, telegraph fill). 1 maps to the last frame. */
export function frameIndexForProgress(frameCount: number, progress: number): number {
  if (frameCount <= 1) return 0;
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  return Math.min(frameCount - 1, Math.floor(p * frameCount));
}

/** tan(22.5 deg) and tan(67.5 deg): borders between the four line orientations. */
const TAN_22_5 = 0.41421356237309503;
const TAN_67_5 = 2.414213562373095;

/**
 * dir4 frame for a velocity in world u per tick, measured in SCREEN space (16 px per u across,
 * 10 px per u deep, y down): 0 horizontal, 1 rising (/), 2 vertical, 3 falling (\).
 * A line has no head, so opposite directions share a frame. Zero velocity gives 0.
 */
export function dir4Index(vx: number, vy: number): number {
  const sx = vx * PX_PER_U;
  const sy = vy * DEPTH_PX_PER_U;
  const ax = sx < 0 ? -sx : sx;
  const ay = sy < 0 ? -sy : sy;
  if (ay <= ax * TAN_22_5) return 0;
  if (ay >= ax * TAN_67_5) return 2;
  // Screen y grows downward: same signs mean the shot moves right-and-down, the "\" diagonal.
  return sx > 0 === sy > 0 ? 3 : 1;
}

/** Below this per-tick floor displacement (u) an actor counts as standing (about 0.06 u/s). */
export const MOVE_EPSILON_U = 0.001;

export function isMoving(dx: number, dy: number): boolean {
  return dx * dx + dy * dy > MOVE_EPSILON_U * MOVE_EPSILON_U;
}

/**
 * Facing for an actor that turns toward its horizontal motion: moving left or right sets it,
 * pure vertical motion or standing keeps the previous facing. Returns -1 or 1.
 */
export function facingFromMotion(dx: number, previous: number): number {
  if (dx > MOVE_EPSILON_U) return 1;
  if (dx < -MOVE_EPSILON_U) return -1;
  return previous < 0 ? -1 : 1;
}

export interface FrameRectLike {
  readonly w: number;
  readonly h: number;
  /** Top-left of the trimmed rect inside the frame box. */
  readonly ox: number;
  readonly oy: number;
}

export interface MutableQuad {
  /** Left and right edge in px relative to the feet, x right. */
  left: number;
  right: number;
  /** Top and bottom edge in px relative to the feet, y UP (bottom edge of the anchor row = 0). */
  top: number;
  bottom: number;
}

/**
 * Quad edges in virtual px relative to the snapped feet pixel, same maths as shaders/sprite.ts.
 * flip < 0 mirrors around the feet x. scale (redesign 1.1) is rounded to a whole number >= 1 and grows the
 * quad about the floor-snapped centre of the rect. Every edge is an integer, so texels map to whole pixels.
 */
export function spriteQuad(
  anchorX: number,
  anchorY: number,
  rect: FrameRectLike,
  flip: number,
  out: MutableQuad,
  scale = 1,
): void {
  const sc = Math.max(1, Math.round(Math.abs(scale)));
  const left0 = rect.ox - anchorX;
  const top0 = anchorY + 1 - rect.oy;
  const px = Math.floor(left0 + rect.w * 0.5);
  const py = Math.floor(top0 - rect.h * 0.5);
  const left = px + (left0 - px) * sc;
  const right = px + (left0 + rect.w - px) * sc;
  if (flip < 0) {
    out.left = -right;
    out.right = -left;
  } else {
    out.left = left;
    out.right = right;
  }
  out.top = py + (top0 - py) * sc;
  out.bottom = py + (top0 - rect.h - py) * sc;
}

/** Feet pixel in a virtual frame: world floor point to px, rounded like the vertex shader. y DOWN. */
export function feetPixel(
  originX: number,
  originY: number,
  refOriginX: number,
  refOriginY: number,
  x: number,
  y: number,
  out: { x: number; y: number },
): void {
  out.x = Math.round(originX + refOriginX + PX_PER_U * x);
  out.y = Math.round(originY + refOriginY + DEPTH_PX_PER_U * y);
}
