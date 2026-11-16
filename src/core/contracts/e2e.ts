// e2e test hooks, compiled in only when __E2E__ is true (architecture.md 6.12). [Frozen M1]
// DOM-facing: exported through src/core/dom.ts only. Implemented in src/app/e2e/hooks.ts.

import type { Command } from './commands.ts';
import type { InputFrame } from './input.ts';
import type { ScreenId } from './ui.ts';
import type { RunPhase } from './world-view.ts';

export interface E2eSnapshot {
  readonly screen: ScreenId;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly pulseIndex: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly glint: number;
  readonly level: number;
  readonly player: { readonly x: number; readonly y: number };
  readonly counts: {
    readonly enemies: number;
    readonly enemyShots: number;
    readonly playerShots: number;
    readonly pickups: number;
    readonly dangerAreas: number;
    readonly playerZones: number;
  };
}

export interface E2ePerf {
  /** Rolling 600 frames. */
  readonly frameMs: {
    readonly avg: number;
    readonly p95: number;
    readonly p99: number;
    readonly max: number;
  };
  readonly simTickMs: { readonly avg: number; readonly p95: number };
  readonly drawCalls: number;
  readonly triangles: number;
  readonly eventOverflow: number;
  readonly poolOverflow: number;
}

export interface E2eHooks {
  readonly version: 1;
  ready(): Promise<void>;
  startRun(opts: {
    readonly seed: number;
    readonly classId: string;
    readonly profile?: string;
    readonly difficulty?: number;
  }): void;
  /** Stop the rAF loop; from now on the test drives time. */
  pauseLoop(): void;
  resumeLoop(): void;
  step(ticks: number, input?: Partial<InputFrame>): void;
  /** 0.25 to 16. Above 4 ticks per frame only in e2e (MAX_TICKS_PER_FRAME_E2E). */
  setTimeScale(scale: number): void;
  send(cmd: Command): void;
  /** 8 lowercase hex chars of Sim.hash(). */
  getStateHash(): string;
  getSnapshot(): E2eSnapshot;
  /** CSS pixel positions relative to the canvas, from Projector. */
  getScreenPositions(): {
    readonly player: { readonly x: number; readonly y: number };
    readonly enemies: readonly { readonly x: number; readonly y: number; readonly rank: number }[];
    readonly enemyShots: readonly { readonly x: number; readonly y: number }[];
    readonly dangerAreas: readonly { readonly x: number; readonly y: number }[];
  };
  /** Builds the needed state (debug commands, AppActions), then resolves when the screen is shown. */
  goToScreen(id: ScreenId | 'run-lost' | 'run-won'): Promise<void>;
  /** Deterministic stress scene from debug commands. 'peak': last normal Pulse composition + late-run build. */
  spawnStress(preset: 'peak' | 'peak-boss'): void;
  grantItem(id: string, tier?: number): void;
  /**
   * Add Silt to the meta save (stored at once) so tests can buy unlocks in The Keeping. Additive
   * M2-09; e2e builds only, like every hook.
   */
  grantSilt(amount: number): void;
  loadReplay(replay: unknown): void;
  exportReplay(): unknown;
  getPerf(): E2ePerf;
}

declare global {
  interface Window {
    __shardfall?: E2eHooks;
  }
}
