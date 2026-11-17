// Damage number limits (CD M1 review LP item 3, style-guide 1.8). LP. Pure helpers used by
// src/render/vfx/damage-numbers.ts (AD): at most DAMAGE_NUMBER_CAP numbers on screen, the oldest
// normal number is dropped first and crits last, and numbers never sit inside the player sprite box.

import { DEPTH_PX_PER_U, PX_PER_U } from '../../core/index.ts';

/** Max damage numbers alive at once (CD suggestion "about 24"). */
export const DAMAGE_NUMBER_CAP = 24;

/**
 * Slot for a new number in a fixed ring of `live.length` slots, honouring `cap` live numbers.
 * Free slot first (lowest index); when `cap` are alive, the oldest normal number; when all live
 * numbers are crits, the oldest crit. Ties break by the lower slot index (deterministic).
 */
export function pickDamageSlot(
  live: ArrayLike<number>,
  isCrit: ArrayLike<number>,
  born: ArrayLike<number>,
  cap: number,
): number {
  let alive = 0;
  let free = -1;
  let oldestNormal = -1;
  let oldestCrit = -1;
  for (let i = 0; i < live.length; i++) {
    if (live[i] === 0) {
      if (free < 0) free = i;
      continue;
    }
    alive++;
    const t = born[i] ?? 0;
    if (isCrit[i] === 1) {
      if (oldestCrit < 0 || t < (born[oldestCrit] ?? 0)) oldestCrit = i;
    } else if (oldestNormal < 0 || t < (born[oldestNormal] ?? 0)) oldestNormal = i;
  }
  if (alive < cap && free >= 0) return free;
  if (oldestNormal >= 0) return oldestNormal;
  if (oldestCrit >= 0) return oldestCrit;
  return free >= 0 ? free : 0;
}

/** Player sprite box relative to the feet, in virtual px (24 x 24 frame, 20 px figure plus outline). */
export const PLAYER_BOX = { halfW: 9, top: 23 } as const;

/**
 * Horizontal px shift that moves a number glyph row out of the player box. Number centre at world
 * (x, y) raised by risePx above the floor; halfWidthPx = half the glyph row width. Returns 0 when the
 * number does not overlap the box, otherwise the smallest shift to the side the number is already on.
 */
export function playerBoxPushPx(
  x: number,
  y: number,
  risePx: number,
  halfWidthPx: number,
  glyphHeightPx: number,
  playerX: number,
  playerY: number,
): number {
  const dx = (x - playerX) * PX_PER_U;
  // Screen y up from the player's feet: the floor offset plus the rise.
  const up = (playerY - y) * DEPTH_PX_PER_U + risePx;
  const overlapY = up + glyphHeightPx > 0 && up < PLAYER_BOX.top;
  const overlapX = dx + halfWidthPx > -PLAYER_BOX.halfW && dx - halfWidthPx < PLAYER_BOX.halfW;
  if (!overlapX || !overlapY) return 0;
  return dx >= 0 ? PLAYER_BOX.halfW - (dx - halfWidthPx) : -PLAYER_BOX.halfW - (dx + halfWidthPx);
}

/** Near-player limit (CD M3 polish 9): at most this many numbers within NEAR_PLAYER_RADIUS_U. */
export const NEAR_PLAYER_MAX = 4;
export const NEAR_PLAYER_RADIUS_U = 2;

/**
 * Drop live numbers (live[i] = 0) until at most `max` lie within radiusU (world u) of the player:
 * the oldest normal number goes first, crits only when no normal number is left near the player.
 * Ties break by the lower slot index. Returns how many were dropped. No allocation.
 */
export function capNearPlayer(
  live: Uint8Array,
  isCrit: ArrayLike<number>,
  born: ArrayLike<number>,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  playerX: number,
  playerY: number,
  radiusU = NEAR_PLAYER_RADIUS_U,
  max = NEAR_PLAYER_MAX,
): number {
  const r2 = radiusU * radiusU;
  const near = (i: number): boolean => {
    const dx = (x[i] ?? 0) - playerX;
    const dy = (y[i] ?? 0) - playerY;
    return dx * dx + dy * dy <= r2;
  };
  let count = 0;
  for (let i = 0; i < live.length; i++) if (live[i] === 1 && near(i)) count++;
  let dropped = 0;
  while (count > max) {
    let oldestNormal = -1;
    let oldestCrit = -1;
    for (let i = 0; i < live.length; i++) {
      if (live[i] !== 1 || !near(i)) continue;
      const t = born[i] ?? 0;
      if (isCrit[i] === 1) {
        if (oldestCrit < 0 || t < (born[oldestCrit] ?? 0)) oldestCrit = i;
      } else if (oldestNormal < 0 || t < (born[oldestNormal] ?? 0)) oldestNormal = i;
    }
    const drop = oldestNormal >= 0 ? oldestNormal : oldestCrit;
    if (drop < 0) break;
    live[drop] = 0;
    count--;
    dropped++;
  }
  return dropped;
}
