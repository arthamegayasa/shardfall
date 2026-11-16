// Light screen shake (CD M1 review 4, LP item 4). Render only: the sim never sees it. LP.
// Trauma model: events add trauma (0..1), it decays linearly, the offset is trauma^2 * max amplitude
// on smooth deterministic noise of the render clock. Offsets are whole virtual px so sprites stay
// pixel exact. Disabled by "reduce effects" and scaled by Settings screenShake (QualityProfile).

/** Max offset in virtual px at trauma 1 (3 px virtual = 9 px at 1080p: "ringan"). */
export const SHAKE_MAX_PX = 3;
/** Trauma lost per second. */
export const SHAKE_DECAY_PER_SEC = 2.5;

/** Trauma added per event kind. */
export const SHAKE_TRAUMA = {
  playerHit: 0.35,
  wardenKilled: 0.6,
  bossKilled: 0.9,
} as const;

export interface ShakeState {
  trauma: number;
  /** Render clock of the last update, seconds. NaN before the first update. */
  lastSec: number;
}

export function createShake(): ShakeState {
  return { trauma: 0, lastSec: Number.NaN };
}

export function addTrauma(s: ShakeState, amount: number): void {
  s.trauma = Math.min(1, s.trauma + Math.max(0, amount));
}

/** Advance decay to timeSec. A clock that jumps backwards (new run) resets the shake. */
export function decayShake(s: ShakeState, timeSec: number): void {
  if (Number.isNaN(s.lastSec) || timeSec < s.lastSec) {
    if (!Number.isNaN(s.lastSec)) s.trauma = 0;
    s.lastSec = timeSec;
    return;
  }
  s.trauma = Math.max(0, s.trauma - (timeSec - s.lastSec) * SHAKE_DECAY_PER_SEC);
  s.lastSec = timeSec;
}

/**
 * Whole virtual px offset for this frame. scale = QualityProfile.screenShake (0 disables).
 * Smooth noise (two sines per axis) so the shake is the same in every replay and screenshot.
 */
export function shakeOffset(
  s: ShakeState,
  timeSec: number,
  scale: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const amp = s.trauma * s.trauma * SHAKE_MAX_PX * Math.min(1, Math.max(0, scale));
  if (amp < 0.5) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const t = timeSec * Math.PI * 2;
  const nx = 0.6 * Math.sin(t * 13.1) + 0.4 * Math.sin(t * 29.3 + 1.3);
  const ny = 0.6 * Math.sin(t * 11.7 + 2.1) + 0.4 * Math.sin(t * 23.9 + 0.4);
  out.x = Math.round(nx * amp);
  out.y = Math.round(ny * amp);
  return out;
}
