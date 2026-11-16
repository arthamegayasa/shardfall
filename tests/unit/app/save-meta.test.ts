// LP M1-09a: run autosave envelope, meta save, and the run watcher (architecture 12).

import { describe, expect, it } from 'vitest';
import { RunOutcome, STORAGE_KEYS } from '../../../src/core/index.ts';
import { defaultMeta, loadMeta, metaAfterRun, saveMeta } from '../../../src/app/meta/meta-store.ts';
import { createRunWatch } from '../../../src/app/run-watch.ts';
import { clearRunSave, readRunSave, writeRunSave } from '../../../src/app/save/run-save.ts';
import type { KeyValueStore } from '../../../src/app/storage.ts';
import { harness, stepUntil } from '../sim/support/harness.ts';

function memoryStore(): KeyValueStore & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      map.set(k, v);
      return true;
    },
    remove: (k) => {
      map.delete(k);
    },
  };
}

describe('run autosave envelope', () => {
  it('round-trips a sim save and reports garbage as corrupt', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    h.send({ type: 'debug.endPulse' });
    h.step();
    stepUntil(h, () => h.sim.view.phase !== 'pulseClear', 10_000);
    const run = h.sim.save();
    if (run === null) throw new Error('no save');
    const store = memoryStore();
    expect(readRunSave(store)).toEqual({ kind: 'none' });
    writeRunSave(store, run, '2026-11-17T00:00:00.000Z');
    const back = readRunSave(store);
    expect(back.kind).toBe('ok');
    if (back.kind === 'ok') expect(back.run).toEqual(run);
    store.set(STORAGE_KEYS.run, '{"app":"shardfall","v":1,"run":{"v":1}}');
    expect(readRunSave(store)).toEqual({ kind: 'corrupt' });
    store.set(STORAGE_KEYS.run, 'not json');
    expect(readRunSave(store)).toEqual({ kind: 'corrupt' });
    clearRunSave(store);
    expect(readRunSave(store)).toEqual({ kind: 'none' });
  });
});

describe('meta save', () => {
  it('counts runs, keeps the best Crack won, merges Mementos found', () => {
    let m = defaultMeta('lantern');
    m = metaAfterRun(m, {
      outcome: RunOutcome.Defeat,
      classId: 'lantern',
      difficulty: 0,
      silt: 0,
      mementoIds: ['whetstone'],
    });
    m = metaAfterRun(m, {
      outcome: RunOutcome.Victory,
      classId: 'lantern',
      difficulty: 0,
      silt: 0,
      mementoIds: ['coal_locket', 'whetstone'],
    });
    expect(m.runs).toBe(2);
    expect(m.highestDifficultyWon).toBe(0);
    expect(m.mementosFound).toEqual(['coal_locket', 'whetstone']);
    const store = memoryStore();
    saveMeta(store, m);
    expect(loadMeta(store, 'lantern')).toEqual(m);
    store.set(STORAGE_KEYS.meta, '{"v":1,"runs":"x"}');
    expect(loadMeta(store, 'lantern').runs).toBe(0);
  });
});

describe('run watcher', () => {
  it('saves on entering a choice phase and after each choice, and reports the run end', () => {
    const h = harness();
    let saves = 0;
    const ends: number[] = [];
    const watch = createRunWatch({
      sim: h.sim,
      save: () => {
        saves++;
      },
      onRunEnd: (e) => ends.push(e.outcome),
      onArena: () => undefined,
    });
    const step = (n = 1): void => {
      for (let i = 0; i < n; i++) {
        h.step();
        watch.afterTick();
      }
    };
    h.start({ profile: 'run_a' });
    watch.afterTick();
    step(10);
    expect(saves).toBe(0);
    h.send({ type: 'debug.endPulse' });
    step(1);
    for (let i = 0; i < 600 && h.sim.view.phase === 'pulseClear'; i++) step();
    expect(saves).toBe(1);
    step(30);
    expect(saves).toBe(1); // no change, no write
    while (h.sim.view.phase === 'levelUp') {
      h.send({ type: 'levelup.pick', choice: 0 });
      step();
    }
    h.send({ type: 'debug.glint', amount: 100 });
    step();
    h.send({ type: 'shop.reroll' });
    step();
    expect(saves).toBeGreaterThanOrEqual(3);
    h.send({ type: 'run.abandon' });
    step();
    expect(ends).toEqual([RunOutcome.Abandon]);
  });
});
