// Meta save (architecture.md 6.11, 12): run count, last class, highest Crack won, Mementos found.
// Tier A has no Silt and no unlocks; the fields are kept so tier B only adds rules (src/sim/meta).

import { RunOutcome, STORAGE_KEYS } from '../../core/index.ts';
import type { MetaSave } from '../../core/index.ts';
import type { KeyValueStore } from '../storage.ts';

export function defaultMeta(lastClassId: string): MetaSave {
  return {
    v: 1,
    silt: 0,
    unlocked: [],
    mementosFound: [],
    highestDifficultyWon: -1,
    lastClassId,
    runs: 0,
  };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

export function loadMeta(store: KeyValueStore, lastClassId: string): MetaSave {
  const d = defaultMeta(lastClassId);
  const raw = store.get(STORAGE_KEYS.meta);
  if (raw === null) return d;
  try {
    const m = JSON.parse(raw) as Partial<MetaSave> | null;
    if (m?.v !== 1) return d;
    return {
      v: 1,
      silt: num(m.silt, 0),
      unlocked: strings(m.unlocked),
      mementosFound: strings(m.mementosFound),
      highestDifficultyWon: num(m.highestDifficultyWon, -1),
      lastClassId: typeof m.lastClassId === 'string' ? m.lastClassId : lastClassId,
      runs: num(m.runs, 0),
    };
  } catch {
    return d;
  }
}

export function saveMeta(store: KeyValueStore, meta: MetaSave): void {
  store.set(STORAGE_KEYS.meta, JSON.stringify(meta));
}

export interface RunEndInfo {
  readonly outcome: number;
  readonly classId: string;
  readonly difficulty: number;
  readonly silt: number;
  readonly mementoIds: readonly string[];
}

/** Pure: meta after a run ends. */
export function metaAfterRun(meta: MetaSave, end: RunEndInfo): MetaSave {
  const found = new Set(meta.mementosFound);
  for (const id of end.mementoIds) found.add(id);
  return {
    ...meta,
    silt: meta.silt + Math.max(0, end.silt),
    mementosFound: [...found].sort(),
    highestDifficultyWon:
      end.outcome === RunOutcome.Victory
        ? Math.max(meta.highestDifficultyWon, end.difficulty)
        : meta.highestDifficultyWon,
    lastClassId: end.classId,
    runs: meta.runs + 1,
  };
}
