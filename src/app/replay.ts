// Replay recorder (architecture.md 4.5). Dev and e2e only: input RLE, commands with tick, hash checkpoints.

import { REPLAY_CHECKPOINT_TICKS, toHex8 } from '../core/index.ts';
import type { Command, InputFrame, ReplayInputRun, ReplayV1 } from '../core/index.ts';

export interface ReplayMeta {
  readonly contentHash: string;
  readonly contentTier: 'A' | 'B' | 'C';
}

export interface ReplayRecorder {
  /** Start a new recording at run.start (the command is recorded at tick 0). */
  begin(cmd: Extract<Command, { type: 'run.start' }>, tick: number): void;
  recordCommand(tick: number, cmd: Command): void;
  /** Call after each sim step with the input used and the sim tick after the step. */
  recordTick(input: InputFrame, tickAfter: number, hash: () => number): void;
  export(): ReplayV1 | null;
}

export function createReplayRecorder(meta: ReplayMeta): ReplayRecorder {
  let start: Extract<Command, { type: 'run.start' }> | null = null;
  let startTick = 0;
  let ticks = 0;
  const input: [number, number, number, number, number, number, number][] = [];
  const commands: [number, Command][] = [];
  const checkpoints: [number, string][] = [];

  return {
    begin(cmd, tick) {
      start = cmd;
      startTick = tick;
      ticks = 0;
      input.length = 0;
      commands.length = 0;
      checkpoints.length = 0;
      commands.push([0, cmd]);
    },
    recordCommand(tick, cmd) {
      if (start === null || cmd.type === 'run.start') return;
      commands.push([tick - startTick, cmd]);
    },
    recordTick(f, tickAfter, hash) {
      if (start === null) return;
      ticks++;
      const last = input[input.length - 1];
      if (
        last !== undefined &&
        last[1] === f.moveX &&
        last[2] === f.moveY &&
        last[3] === f.held &&
        last[4] === f.pressed &&
        last[5] === f.aimX &&
        last[6] === f.aimY
      ) {
        last[0]++;
      } else {
        input.push([1, f.moveX, f.moveY, f.held, f.pressed, f.aimX, f.aimY]);
      }
      const rel = tickAfter - startTick;
      if (rel % REPLAY_CHECKPOINT_TICKS === 0) checkpoints.push([rel, toHex8(hash())]);
    },
    export() {
      if (start === null) return null;
      return {
        format: 'shardfall-replay',
        v: 1,
        contentHash: meta.contentHash,
        contentTier: meta.contentTier,
        seed: start.seed,
        classId: start.classId,
        profile: start.profile,
        difficulty: start.difficulty,
        ticks,
        input: input.map((r): ReplayInputRun => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]),
        commands: commands.map(([t, c]) => [t, c] as const),
        checkpoints: checkpoints.map(([t, h]) => [t, h] as const),
      };
    },
  };
}
