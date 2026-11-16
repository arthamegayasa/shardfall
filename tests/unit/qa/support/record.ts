// Records a bot-driven run as a ReplayV1 (architecture 4.5) for QA determinism tests (M1-09b).
// Same tick convention as src/app/replay.ts and playReplay: commands recorded at tick t are enqueued
// before the step that advances t to t + 1; checkpoints every REPLAY_CHECKPOINT_TICKS.

import { REPLAY_CHECKPOINT_TICKS, createInputFrame, toHex8 } from '../../../../src/core/index.ts';
import type { Command, ReplayInputRun, ReplayV1, Sim } from '../../../../src/core/index.ts';
import type { GameData } from '../../../../src/content/index.ts';
import { botCommands, botInput } from '../../sim/support/bot.ts';

export interface Recording {
  readonly replay: ReplayV1;
  readonly finalHash: string;
  readonly phase: string;
}

/** Drive sim with GP's bot from run.start until the run ends or maxTicks, recording everything. */
export function recordBotRun(
  sim: Sim,
  data: GameData,
  start: { seed: number; classId: string; profile: string },
  maxTicks: number,
): Recording {
  const input = createInputFrame();
  const cmds: Command[] = [];
  const runs: [number, number, number, number, number, number, number][] = [];
  const commands: (readonly [number, Command])[] = [];
  const checkpoints: (readonly [number, string])[] = [];
  const startCmd: Command = {
    type: 'run.start',
    seed: start.seed,
    classId: start.classId,
    profile: start.profile,
    difficulty: 0,
  };
  commands.push([0, startCmd]);
  sim.enqueue(startCmd);
  let t = 0;
  for (; t < maxTicks; t++) {
    const v = sim.view;
    if (t > 0) {
      if (v.phase === 'victory' || v.phase === 'defeat') break;
      if (v.phase === 'pulse') botInput(v, input);
      else {
        input.moveX = 0;
        input.moveY = 0;
        input.pressed = 0;
        botCommands(v, cmds);
        for (const c of cmds) {
          commands.push([t, c]);
          sim.enqueue(c);
        }
      }
    }
    const last = runs[runs.length - 1];
    const f = input;
    if (
      last?.[1] === f.moveX &&
      last[2] === f.moveY &&
      last[3] === f.held &&
      last[4] === f.pressed &&
      last[5] === f.aimX &&
      last[6] === f.aimY
    )
      last[0]++;
    else runs.push([1, f.moveX, f.moveY, f.held, f.pressed, f.aimX, f.aimY]);
    sim.step(input);
    if ((t + 1) % REPLAY_CHECKPOINT_TICKS === 0) checkpoints.push([t + 1, toHex8(sim.hash())]);
  }
  const replay: ReplayV1 = {
    format: 'shardfall-replay',
    v: 1,
    contentHash: data.meta.contentHash,
    contentTier: 'A',
    seed: start.seed,
    classId: start.classId,
    profile: start.profile,
    difficulty: 0,
    ticks: t,
    input: runs.map((r): ReplayInputRun => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]),
    commands,
    checkpoints,
  };
  return { replay, finalHash: toHex8(sim.hash()), phase: sim.view.phase };
}
