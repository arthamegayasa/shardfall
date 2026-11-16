// Test harness for sim unit tests (GP, M1-03): a sim on the sim fixture with access to internals.

import { createInputFrame } from '../../../../src/core/index.ts';
import type { Command, InputFrame, SimEventType } from '../../../../src/core/index.ts';
import type { GameData } from '../../../../src/content/index.ts';
import { createSimInternals } from '../../../../src/sim/create-sim.ts';
import type { SimInternals } from '../../../../src/sim/create-sim.ts';
import { resetPool } from '../../../../src/sim/pools.ts';
import { dropSchedule } from '../../../../src/sim/systems/spawner.ts';
import { simFixtureData } from './sim-fixture.ts';

export interface Ev {
  readonly tick: number;
  readonly type: number;
  readonly x: number;
  readonly y: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

export interface Harness extends SimInternals {
  readonly data: GameData;
  readonly input: InputFrame;
  /** Every event since creation (or since clearLog). */
  readonly log: Ev[];
  send(cmd: Command): void;
  step(n?: number): void;
  start(opts?: { seed?: number; profile?: string; classId?: string }): void;
  /** Remove every Unlit, mark, shot, and the rest of the spawn schedule. */
  quiet(): void;
  /** Events of one type in the log. */
  of(type: SimEventType): Ev[];
  clearLog(): void;
  /** Move events raised outside step() (direct system calls) into the log. */
  drain(): void;
}

export function harness(opts: { data?: GameData; debug?: boolean } = {}): Harness {
  const data = opts.data ?? simFixtureData();
  const it = createSimInternals({ data, debugCommands: opts.debug ?? true });
  const input = createInputFrame();
  const log: Ev[] = [];
  const pull = (): void => {
    const ev = it.sim.events;
    for (let k = 0; k < ev.count; k++) {
      log.push({
        tick: it.sim.view.tick,
        type: ev.type[k] ?? 0,
        x: ev.x[k] ?? 0,
        y: ev.y[k] ?? 0,
        a: ev.a[k] ?? 0,
        b: ev.b[k] ?? 0,
        c: ev.c[k] ?? 0,
      });
    }
  };
  const h: Harness = {
    ...it,
    data,
    input,
    log,
    send(cmd) {
      it.sim.enqueue(cmd);
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        it.sim.step(input);
        pull();
      }
    },
    start(o = {}) {
      it.sim.enqueue({
        type: 'run.start',
        seed: o.seed ?? 7,
        classId: o.classId ?? 'lantern',
        profile: o.profile ?? 'run_a',
        difficulty: 0,
      });
      h.step();
    },
    quiet() {
      const w = it.ctx.world;
      resetPool(w.enemies);
      resetPool(w.enemyShots);
      resetPool(w.spawnMarks);
      resetPool(w.dangerAreas);
      dropSchedule(it.ctx);
    },
    of(type) {
      return log.filter((e) => e.type === type);
    },
    clearLog() {
      log.length = 0;
    },
    drain() {
      pull();
      it.ctx.events.clear();
    },
  };
  return h;
}

/** Index of a row by id in a GameData table. */
export function idOf(list: readonly { readonly id: string }[], id: string): number {
  return list.findIndex((x) => x.id === id);
}

/** Step until the predicate holds or maxTicks pass. Returns true when it held. */
export function stepUntil(h: Harness, pred: () => boolean, maxTicks: number): boolean {
  for (let i = 0; i < maxTicks; i++) {
    if (pred()) return true;
    h.step();
  }
  return pred();
}
