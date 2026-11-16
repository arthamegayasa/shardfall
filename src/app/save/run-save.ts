// Run autosave envelope in localStorage (architecture.md 6.11, 12). LP.
// The sim decides what a save contains (Sim.save/load); this module only stores the envelope and
// rejects values that are not shaped like one, so a broken save never reaches sim.load.

import { STORAGE_KEYS } from '../../core/index.ts';
import type { RunSave, RunSaveEnvelope } from '../../core/index.ts';
import type { KeyValueStore } from '../storage.ts';

export type ReadRunSave =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok'; readonly run: RunSave }
  | { readonly kind: 'corrupt' };

function isRunSave(v: unknown): v is RunSave {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Partial<RunSave>;
  return (
    r.v === 1 &&
    typeof r.seed === 'number' &&
    typeof r.classId === 'string' &&
    typeof r.profile === 'string' &&
    (r.phase === 'reward' || r.phase === 'levelUp' || r.phase === 'shop') &&
    typeof r.rng === 'object' &&
    typeof r.player === 'object' &&
    Array.isArray(r.weapons) &&
    Array.isArray(r.mementos) &&
    typeof r.shop === 'object'
  );
}

export function readRunSave(store: KeyValueStore): ReadRunSave {
  const raw = store.get(STORAGE_KEYS.run);
  if (raw === null) return { kind: 'none' };
  try {
    const env = JSON.parse(raw) as Partial<RunSaveEnvelope> | null;
    if (env?.app !== 'shardfall' || env.v !== 1 || !isRunSave(env.run)) return { kind: 'corrupt' };
    return { kind: 'ok', run: env.run };
  } catch {
    return { kind: 'corrupt' };
  }
}

export function hasRunSave(store: KeyValueStore): boolean {
  return store.get(STORAGE_KEYS.run) !== null;
}

/** savedAt is wall clock for display only; it is never hashed or read by the sim. */
export function writeRunSave(store: KeyValueStore, run: RunSave, savedAt: string): boolean {
  const env: RunSaveEnvelope = { app: 'shardfall', v: 1, savedAt, run };
  return store.set(STORAGE_KEYS.run, JSON.stringify(env));
}

export function clearRunSave(store: KeyValueStore): void {
  store.remove(STORAGE_KEYS.run);
}
