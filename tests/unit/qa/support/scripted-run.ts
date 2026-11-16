// Scripted run shared by Node (sim-cli.ts, Vitest) and the browser (tests/e2e/determinism.spec.ts
// re-implements the same script through the e2e hooks). Pure function of (seed, ticks, classId).
import { createInputFrame, toHex8 } from '../../../../src/core/index.ts';
import type { InputFrame, Sim } from '../../../../src/core/index.ts';

/** 8 screen directions, 30 ticks each; Rite every 240 ticks. Same table as the browser script. */
export const SCRIPT_DIRS: readonly (readonly [number, number])[] = [
  [127, 0],
  [90, 90],
  [0, 127],
  [-90, 90],
  [-127, 0],
  [-90, -90],
  [0, -127],
  [90, -90],
];

export function scriptInput(t: number, out: InputFrame): void {
  const d = SCRIPT_DIRS[Math.floor(t / 30) % SCRIPT_DIRS.length] ?? [0, 0];
  out.moveX = d[0];
  out.moveY = d[1];
  out.held = 0;
  out.pressed = t % 240 === 120 ? 1 : 0;
  out.aimX = 0;
  out.aimY = 0;
}

export function scriptedRun(
  sim: Sim,
  seed: number,
  ticks: number,
  classId: string,
  profile = 'run_a',
): { hash: string; tick: number; phase: string; checkpoints: string[] } {
  const input = createInputFrame();
  sim.enqueue({ type: 'run.start', seed, classId, profile, difficulty: 0 });
  const checkpoints: string[] = [];
  for (let t = 0; t < ticks; t++) {
    scriptInput(t, input);
    sim.step(input);
    if ((t + 1) % 60 === 0) checkpoints.push(toHex8(sim.hash()));
  }
  return { hash: toHex8(sim.hash()), tick: sim.view.tick, phase: sim.view.phase, checkpoints };
}
