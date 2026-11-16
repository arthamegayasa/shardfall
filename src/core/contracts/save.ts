// Run and meta saves (architecture.md 6.11, 12). [Frozen M1]
// Saves store string ids, not dense indices, so a save survives data reordering.

import type { RngStreamName } from '../rng.ts';

export type { RngStreamName };

export interface RunSaveV1 {
  readonly v: 1;
  readonly contentHash: string;
  readonly seed: number;
  readonly classId: string;
  readonly profile: string;
  readonly difficulty: number;
  readonly phase: 'reward' | 'levelUp' | 'shop';
  /** Index of the Pulse just cleared. */
  readonly pulseIndex: number;
  readonly tick: number;
  readonly rng: Readonly<Record<RngStreamName, readonly [number, number, number, number]>>;
  readonly player: {
    readonly hp: number;
    readonly level: number;
    readonly xp: number;
    readonly glint: number;
  };
  /** Slot order preserved. null = empty slot. */
  readonly weapons: readonly ({ readonly id: string; readonly tier: number } | null)[];
  /** Acquisition order (effect order). */
  readonly mementos: readonly { readonly id: string; readonly count: number }[];
  readonly levelUpPicks: readonly { readonly cardId: string; readonly rarity: number }[];
  readonly pendingLevelUps: number;
  readonly levelUpChoices: readonly { readonly cardId: string; readonly rarity: number }[];
  readonly rewardChoices: readonly string[];
  readonly shop: {
    readonly offers: readonly {
      readonly kind: 'empty' | 'weapon' | 'memento' | 'taken';
      readonly id: string;
      readonly tier: number;
      readonly locked: boolean;
    }[];
    readonly rerollCount: number;
    readonly freeRerollsUsed: number;
  };
  /** Per-run effect state that survives between Pulses (counters with run scope). Empty in tier A. */
  readonly effectState: Readonly<Record<string, number>>;
  readonly runStats: {
    readonly kills: number;
    readonly glintEarned: number;
    readonly glintSpent: number;
    readonly pulsesCleared: number;
    readonly runTicks: number;
  };
  /** Enemy id of the Warden or boss whose chest is shown (RewardView.sourceTypeIndex). M2-05, additive. */
  readonly rewardSourceId?: string;
  /** Levels gained in the cleared Pulse (LevelUpView.total, "1 of 2"). M2-05, additive. */
  readonly levelsThisPulse?: number;
}

export type RunSave = RunSaveV1;

export interface MetaSaveV1 {
  readonly v: 1;
  readonly silt: number;
  readonly unlocked: readonly string[];
  readonly mementosFound: readonly string[];
  /** -1 when none. */
  readonly highestDifficultyWon: number;
  readonly lastClassId: string;
  readonly runs: number;
}

export type MetaSave = MetaSaveV1;

/** localStorage envelope for shardfall.run.v1. savedAt is written by app (wall clock, not hashed). */
export interface RunSaveEnvelope {
  readonly app: 'shardfall';
  readonly v: 1;
  readonly savedAt: string;
  readonly run: RunSave;
}

/** localStorage keys (architecture 12). */
export const STORAGE_KEYS = {
  run: 'shardfall.run.v1',
  meta: 'shardfall.meta.v1',
  settings: 'shardfall.settings.v1',
} as const;
