// Replay file format (architecture.md 4.5). [Frozen M1]
// A run is fully determined by contentHash, seed, classId, profile, difficulty, per-tick InputFrames,
// and Commands with their tick.

import type { Command } from './commands.ts';

/** Run-length encoded InputFrame: [count, moveX, moveY, held, pressed, aimX, aimY]. */
export type ReplayInputRun = readonly [number, number, number, number, number, number, number];

export interface ReplayV1 {
  readonly format: 'shardfall-replay';
  readonly v: 1;
  /** FNV-1a hex of the canonical game-data JSON. */
  readonly contentHash: string;
  readonly contentTier: 'A' | 'B' | 'C';
  readonly seed: number;
  readonly classId: string;
  readonly profile: string;
  readonly difficulty: number;
  /** Total ticks recorded. */
  readonly ticks: number;
  readonly input: readonly ReplayInputRun[];
  /** Commands with the tick at which they were enqueued (applied at the start of the next step). */
  readonly commands: readonly (readonly [number, Command])[];
  /** State hash every 60 ticks: [tick, "8 hex chars"]. */
  readonly checkpoints: readonly (readonly [number, string])[];
}

export const REPLAY_CHECKPOINT_TICKS = 60;
