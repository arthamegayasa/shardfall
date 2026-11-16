// Public API of src/sim (GP). Other modules import only from here (architecture.md 5).
// Planned layout (architecture 5): create-sim.ts, world.ts, capacity.ts, pools/, systems/, effects/,
// spatial-hash.ts, save-codec.ts, state-hash.ts, meta/.
// TODO(GP, M1-03): real sim behind createSim; keep the CreateSim signature from src/core/contracts/sim.ts.

export { createSim } from './create-sim.ts';
