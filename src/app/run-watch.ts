// Watches the sim after every step for app-level side effects (architecture.md 12, 6.6, 6.8):
// autosave on entering a post-Pulse choice phase and after every choice command, run end
// bookkeeping (meta, delete autosave), and arena changes for renderer and audio.
// Reads only revisions and events, so a tick without changes costs a few comparisons.

import { RunOutcome, SimEventType } from '../core/index.ts';
import type { Sim } from '../core/index.ts';

export interface RunEnd {
  readonly outcome: number;
  readonly silt: number;
}

export interface RunWatchDeps {
  readonly sim: Sim;
  /** Write the autosave (sim.save() is not null in choice phases). */
  readonly save: () => void;
  readonly onRunEnd: (end: RunEnd) => void;
  readonly onArena: (arenaIndex: number) => void;
}

export interface RunWatch {
  afterTick(): void;
  /** Forget remembered revisions, e.g. after sim.load, so the next tick re-checks everything. */
  reset(): void;
}

export function createRunWatch(deps: RunWatchDeps): RunWatch {
  const { sim } = deps;
  let phaseRev = -1;
  let shopRev = -1;
  let levelRev = -1;
  let rewardRev = -1;
  let arena = -1;

  return {
    afterTick() {
      const v = sim.view;
      if (v.arenaIndex !== arena) {
        arena = v.arenaIndex;
        deps.onArena(arena);
      }
      const ev = sim.events;
      for (let i = 0; i < ev.count; i++) {
        if (ev.type[i] === SimEventType.RunEnded) {
          deps.onRunEnd({ outcome: ev.a[i] ?? RunOutcome.Defeat, silt: ev.b[i] ?? 0 });
        }
      }
      const ph = v.phase;
      if (ph !== 'reward' && ph !== 'levelUp' && ph !== 'shop') {
        phaseRev = v.phaseRevision;
        return;
      }
      if (
        v.phaseRevision !== phaseRev ||
        v.shop.revision !== shopRev ||
        v.levelUp.revision !== levelRev ||
        v.reward.revision !== rewardRev
      ) {
        phaseRev = v.phaseRevision;
        shopRev = v.shop.revision;
        levelRev = v.levelUp.revision;
        rewardRev = v.reward.revision;
        deps.save();
      }
    },
    reset() {
      phaseRev = shopRev = levelRev = rewardRev = arena = -1;
    },
  };
}
