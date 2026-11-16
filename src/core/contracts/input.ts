// Per-tick player input (architecture.md 6.2). [Frozen M1]

export const Button = { Rite: 1 << 0 } as const;
export type Button = (typeof Button)[keyof typeof Button];

/** Movement axis range. Input is quantised to integers for determinism and compact replays. */
export const INPUT_AXIS_MAX = 127;

export interface InputFrame {
  /** Movement intent, integers in [-127, 127]. Desired SCREEN direction (architecture 7.1). */
  moveX: number;
  moveY: number;
  /** Bitmask of Button held during this tick. */
  held: number;
  /** Bitmask of Button pressed since the previous tick. Latched by app so a press is never lost. */
  pressed: number;
  /**
   * Rite aim point in world space, quantised to 1/16 u (integer = screen px at x scale).
   * World u = aimX / 16. Mouse: cursor projected to the floor (Projector.cssToWorld).
   * Gamepad: player position + move direction * 4 u.
   */
  aimX: number;
  aimY: number;
}

/** A fresh all-zero frame. Call once and reuse; do not allocate per tick. */
export function createInputFrame(): InputFrame {
  return { moveX: 0, moveY: 0, held: 0, pressed: 0, aimX: 0, aimY: 0 };
}
