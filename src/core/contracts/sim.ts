// Sim API (architecture.md 6.3). [Frozen M1] Implemented by GP in src/sim/create-sim.ts.

import type { GameData } from '../../content/game-data.ts';
import type { Command } from './commands.ts';
import type { SimEventReader } from './events.ts';
import type { InputFrame } from './input.ts';
import type { RunSave } from './save.ts';
import type { WorldView } from './world-view.ts';

export interface SimConfig {
  /** Injected; sim never imports JSON. */
  readonly data: GameData;
  /** Accept DebugCommand. App sets true only in dev and e2e builds. */
  readonly debugCommands?: boolean;
}

export interface Sim {
  /** Live read-only view. Valid until the next step(). Same object every tick. */
  readonly view: WorldView;
  /** Events produced by the most recent step() only. */
  readonly events: SimEventReader;
  enqueue(cmd: Command): void;
  step(input: InputFrame): void;
  /** Valid in phases reward, levelUp, shop. Returns null otherwise. */
  save(): RunSave | null;
  load(save: RunSave): LoadResult;
  /** FNV-1a 32-bit over the canonical sim state (architecture 8.4). */
  hash(): number;
}

export type LoadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknownId' | 'badVersion' | 'corrupt' };

/** Factory signature of src/sim/create-sim.ts (GP). */
export type CreateSim = (config: SimConfig) => Sim;
