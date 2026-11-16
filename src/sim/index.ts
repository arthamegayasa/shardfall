// Public API of src/sim (GP). Other modules import only from here (architecture.md 5).

export { createSim } from './create-sim.ts';
export { decodeReplay, playReplay, stressCommands } from './e2e-support.ts';
export type { ReplayResult } from './e2e-support.ts';
