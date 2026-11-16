// Discrete player decisions from app/UI to sim (architecture.md 6.2). [Frozen M1]

/** Applied by sim at the start of the next step(), FIFO. Invalid commands emit CommandRejected. */
export type Command =
  | {
      readonly type: 'run.start';
      readonly seed: number;
      readonly classId: string;
      readonly profile: string;
      /** Crack level, 0 in content tiers A and B. */
      readonly difficulty: number;
    }
  | { readonly type: 'pulse.begin' }
  /** Warden or boss reward (phase reward). choice = index into RewardView.choices. */
  | { readonly type: 'reward.pick'; readonly choice: number }
  /** choice = index into LevelUpView.choices. */
  | { readonly type: 'levelup.pick'; readonly choice: number }
  | { readonly type: 'shop.buy'; readonly offer: number }
  | { readonly type: 'shop.reroll' }
  | { readonly type: 'shop.lock'; readonly offer: number; readonly locked: boolean }
  | { readonly type: 'shop.sell'; readonly inventorySlot: number }
  /** Merge the weapon in this slot with another copy of the same id and tier (GDD 4.4). */
  | { readonly type: 'shop.merge'; readonly inventorySlot: number }
  | { readonly type: 'run.abandon' }
  | DebugCommand;

/** Accepted only when SimConfig.debugCommands is true (dev and e2e builds). Rejected otherwise. */
export type DebugCommand =
  | {
      readonly type: 'debug.grant';
      readonly kind: 'weapon' | 'memento';
      readonly id: string;
      readonly tier: number;
    }
  | {
      readonly type: 'debug.spawn';
      readonly enemyId: string;
      readonly x: number;
      readonly y: number;
      readonly count: number;
    }
  | { readonly type: 'debug.glint'; readonly amount: number }
  | { readonly type: 'debug.setHp'; readonly hp: number }
  | { readonly type: 'debug.endPulse' };

export type CommandType = Command['type'];

export interface CommandSink {
  send(cmd: Command): void;
}

export const RejectReason = {
  WrongPhase: 1,
  NotEnoughGlint: 2,
  InvalidSlot: 3,
  SlotsFull: 4,
  NotMergeable: 5,
  UnknownId: 6,
  DebugDisabled: 7,
  MaxStack: 8,
} as const;
export type RejectReason = (typeof RejectReason)[keyof typeof RejectReason];
