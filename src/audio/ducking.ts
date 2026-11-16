// Ducking per group with plain gain envelopes (audio-direction 8.5). Pure: the engine reads
// duckDb(target, now) every frame and ramps the matching GainNode.

import type { DuckRuleId } from './cue-data.ts';

/** Duck targets: the music bus and four sfx priority groups. */
export const DuckTarget = { Music: 0, SfxP12: 1, SfxP3: 2, SfxP4: 3, SfxP56: 4 } as const;
export type DuckTarget = (typeof DuckTarget)[keyof typeof DuckTarget];
export const DUCK_TARGET_COUNT = 5;

/** sfx priority (1..6) to its duck group. */
export function duckGroupOf(priority: number): DuckTarget {
  if (priority <= 2) return DuckTarget.SfxP12;
  if (priority === 3) return DuckTarget.SfxP3;
  if (priority === 4) return DuckTarget.SfxP4;
  return DuckTarget.SfxP56;
}

interface DuckLeg {
  readonly target: DuckTarget;
  readonly depthDb: number;
}

interface DuckRule {
  readonly legs: readonly DuckLeg[];
  readonly attackSec: number;
  /** Hold after attack. null = hold for the duration passed by the caller (cue length). */
  readonly holdSec: number | null;
  readonly maxHoldSec: number;
  readonly releaseSec: number;
}

/** audio-direction 8.5, values in data units of that table. */
export const DUCK_RULES: Readonly<Record<DuckRuleId, DuckRule>> = {
  player_hit: {
    legs: [
      { target: DuckTarget.Music, depthDb: -6 },
      { target: DuckTarget.SfxP4, depthDb: -8 },
      { target: DuckTarget.SfxP56, depthDb: -8 },
    ],
    attackSec: 0.01,
    holdSec: 0.15,
    maxHoldSec: 0.15,
    releaseSec: 0.3,
  },
  telegraph: {
    legs: [{ target: DuckTarget.SfxP56, depthDb: -4 }],
    attackSec: 0.02,
    holdSec: null,
    maxHoldSec: 0.6,
    releaseSec: 0.2,
  },
  reward: {
    legs: [{ target: DuckTarget.Music, depthDb: -4 }],
    attackSec: 0.03,
    holdSec: 0.3,
    maxHoldSec: 0.3,
    releaseSec: 0.6,
  },
  big_moment: {
    legs: [
      { target: DuckTarget.Music, depthDb: -12 },
      { target: DuckTarget.SfxP3, depthDb: -10 },
      { target: DuckTarget.SfxP4, depthDb: -10 },
      { target: DuckTarget.SfxP56, depthDb: -10 },
    ],
    attackSec: 0.05,
    holdSec: null,
    maxHoldSec: 4,
    releaseSec: 1.5,
  },
};

const MAX_ACTIVE = 16;

export interface Ducker {
  /** Starts a duck at nowSec. durSec is the cue or telegraph length for rules that hold for it. */
  trigger(rule: DuckRuleId, nowSec: number, durSec: number): void;
  /** Current attenuation of target in dB (0 or negative). The deepest active duck wins. */
  duckDb(target: DuckTarget, nowSec: number): number;
  clear(): void;
}

export function createDucker(): Ducker {
  const rule: (DuckRule | null)[] = new Array<DuckRule | null>(MAX_ACTIVE).fill(null);
  const t0 = new Float64Array(MAX_ACTIVE);
  const holdEnd = new Float64Array(MAX_ACTIVE);

  function legDb(i: number, r: DuckRule, depth: number, now: number): number {
    const start = t0[i] ?? 0;
    const he = holdEnd[i] ?? 0;
    if (now < start) return 0;
    if (now < start + r.attackSec) return (depth * (now - start)) / r.attackSec;
    if (now < he) return depth;
    if (now < he + r.releaseSec) return depth * (1 - (now - he) / r.releaseSec);
    return 0;
  }

  return {
    trigger(id, now, dur) {
      const r = DUCK_RULES[id];
      let slot = -1;
      for (let i = 0; i < MAX_ACTIVE; i++) {
        const ri = rule[i];
        if (ri === null || ri === undefined || now > (holdEnd[i] ?? 0) + ri.releaseSec) {
          slot = i;
          break;
        }
      }
      if (slot < 0) {
        // Full: replace the duck that ends first.
        slot = 0;
        for (let i = 1; i < MAX_ACTIVE; i++) if ((holdEnd[i] ?? 0) < (holdEnd[slot] ?? 0)) slot = i;
      }
      const hold = Math.min(r.holdSec ?? dur, r.maxHoldSec);
      rule[slot] = r;
      t0[slot] = now;
      holdEnd[slot] = now + r.attackSec + hold;
    },
    duckDb(target, now) {
      let db = 0;
      for (let i = 0; i < MAX_ACTIVE; i++) {
        const r = rule[i];
        if (r === null || r === undefined) continue;
        for (let k = 0; k < r.legs.length; k++) {
          const leg = r.legs[k];
          if (leg === undefined || leg.target !== target) continue;
          const v = legDb(i, r, leg.depthDb, now);
          if (v < db) db = v;
        }
      }
      return db;
    },
    clear() {
      rule.fill(null);
    },
  };
}
