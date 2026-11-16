// Fixed-timestep accumulator, pure and clock-free (architecture.md 4.1). [Frozen M1]
// src/app/loop.ts drives it from requestAnimationFrame; tests drive it with synthetic frame deltas (D-6).

import { MAX_FRAME_DELTA_MS, MAX_TICKS_PER_FRAME, TICK_MS } from './constants.ts';

export interface FixedStepOptions {
  readonly tickMs?: number;
  readonly maxTicksPerFrame?: number;
  readonly maxFrameDeltaMs?: number;
}

export interface FixedStep {
  /**
   * Feed one frame delta (ms of wall clock). timeScale multiplies it (e2e setTimeScale).
   * Returns how many sim ticks to run now. Ticks above maxTicksPerFrame are dropped:
   * the game slows down instead of spiralling.
   */
  advance(frameDeltaMs: number, timeScale?: number): number;
  /** Interpolation factor in [0, 1) for rendering between the previous and the current tick. */
  readonly alpha: number;
  /** Total ticks dropped by the per-frame cap since creation. */
  readonly droppedTicks: number;
  setMaxTicksPerFrame(n: number): void;
  reset(): void;
}

/** Tolerance (ms) so frame deltas that are exact tick multiples never lose a tick to float rounding. */
const EPSILON_MS = 1e-6;

export function createFixedStep(opts: FixedStepOptions = {}): FixedStep {
  const tickMs = opts.tickMs ?? TICK_MS;
  const maxDelta = opts.maxFrameDeltaMs ?? MAX_FRAME_DELTA_MS;
  let maxTicks = opts.maxTicksPerFrame ?? MAX_TICKS_PER_FRAME;
  let acc = 0;
  let dropped = 0;
  return {
    advance(frameDeltaMs, timeScale = 1) {
      acc += Math.min(Math.max(frameDeltaMs, 0), maxDelta) * timeScale;
      let ticks = 0;
      while (acc >= tickMs - EPSILON_MS && ticks < maxTicks) {
        acc -= tickMs;
        ticks++;
      }
      if (acc >= tickMs - EPSILON_MS) {
        const extra = Math.floor((acc + EPSILON_MS) / tickMs);
        dropped += extra;
        acc -= extra * tickMs;
      }
      return ticks;
    },
    get alpha() {
      return acc <= 0 ? 0 : acc / tickMs;
    },
    get droppedTicks() {
      return dropped;
    },
    setMaxTicksPerFrame(n) {
      maxTicks = n;
    },
    reset() {
      acc = 0;
    },
  };
}
