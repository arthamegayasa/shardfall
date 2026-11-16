// QA bot tests on the real M1 data (test-plan 6.4, M1-09b): B-1 run completes, B-2 state invariants,
// B-3 idle bot does not win, B-4 headless speed. Real data: outcomes and invariants only, no balance
// numbers copied (architecture 14.2). A summary line per run is printed for docs/qa/M1-report.md.

import { describe, expect, it } from 'vitest';
import { TICK_RATE, createInputFrame } from '../../../src/core/index.ts';
import type { Command } from '../../../src/core/index.ts';
import { createSim } from '../../../src/sim/index.ts';
import { botCommands, botInput } from '../sim/support/bot.ts';
import { runQaBot } from './support/qa-bot.ts';
import { arenaBounds, realGameData } from './support/real-data.ts';

const data = realGameData();
const classId = data.classes[0]?.id ?? '';
const PROFILE = 'run_a';
/** Upper bound from test-plan B-1: 10 Pulses, untimed boss, and shops; 30 min of game time. */
const MAX_TICKS = TICK_RATE * 60 * 30;
const boundsFor = (i: number) => arenaBounds(data, i);

describe('QA bot on real data (M1-09b)', () => {
  it('B-1, B-2, B-4: 20 seeds of dodger+random finish run_a with no invariant violations, >= 20x real time', () => {
    const rows: string[] = [];
    let simTicks = 0;
    const t0 = performance.now();
    for (let seed = 1; seed <= 20; seed++) {
      const r = runQaBot(
        createSim({ data }),
        { seed, classId, profile: PROFILE },
        'dodgerRandom',
        MAX_TICKS,
        boundsFor,
      );
      simTicks += r.ticks;
      rows.push(
        `seed ${String(seed).padStart(2)} ${r.outcome.padEnd(7)} pulses ${r.pulsesCleared} ticks ${r.ticks} buys ${r.purchases}`,
      );
      expect(r.outcome, `seed ${seed}`).not.toBe('timeout');
      expect(r.violations, `seed ${seed}`).toEqual([]);
    }
    const ms = performance.now() - t0;
    const speed = simTicks / TICK_RATE / (ms / 1000);
    console.log(
      `[QA B-1] ${PROFILE}, class ${classId}\n${rows.join('\n')}\n[QA B-4] ${(simTicks / TICK_RATE).toFixed(0)} sim s in ${(ms / 1000).toFixed(2)} s wall = ${speed.toFixed(0)}x real time`,
    );
    expect(speed).toBeGreaterThan(20);
  }, 120_000);

  it('B-1b: victory is reachable on real data (HP kept full by debug commands, boss killed)', () => {
    for (const seed of [3, 8]) {
      const sim = createSim({ data, debugCommands: true });
      const input = createInputFrame();
      const cmds: Command[] = [];
      sim.enqueue({ type: 'run.start', seed, classId, profile: PROFILE, difficulty: 0 });
      let reachedBoss = false;
      let reward = false;
      for (let t = 0; t < MAX_TICKS; t++) {
        const v = sim.view;
        if (v.phase === 'victory' || v.phase === 'defeat') break;
        if (v.phase === 'reward') reward = true;
        if (v.phase === 'pulse') {
          sim.enqueue({ type: 'debug.setHp', hp: v.player.maxHp });
          botInput(v, input);
          if (v.pulse.boss.active) {
            reachedBoss = true;
            // Stay within weapon range of the boss instead of fleeing.
            const e = v.enemies;
            for (let i = 0; i < e.highWater; i++) {
              if (e.alive[i] !== 1 || e.rank[i] !== 2) continue;
              const dx = (e.x[i] ?? 0) - v.player.x;
              const dy = (e.y[i] ?? 0) - v.player.y;
              const d = Math.hypot(dx, dy);
              input.moveX = d > 4 ? Math.round((dx / d) * 127) : 0;
              input.moveY = d > 4 ? Math.round((dy / d) * 127) : 0;
            }
          }
        } else {
          input.moveX = 0;
          input.moveY = 0;
          input.pressed = 0;
          botCommands(v, cmds);
          for (const c of cmds) sim.enqueue(c);
        }
        sim.step(input);
      }
      console.log(
        `[QA B-1b] seed ${seed}: ${sim.view.phase}, pulses ${sim.view.runStats.pulsesCleared}, tick ${sim.view.tick}`,
      );
      expect(reward, `seed ${seed} Warden reward`).toBe(true);
      expect(reachedBoss, `seed ${seed} boss`).toBe(true);
      expect(sim.view.phase, `seed ${seed}`).toBe('victory');
      expect(sim.view.runStats.pulsesCleared).toBe(data.profiles[PROFILE]?.length);
    }
  }, 120_000);

  it('B-3: the idle bot never wins (10 seeds)', () => {
    const rows: string[] = [];
    for (let seed = 101; seed <= 110; seed++) {
      const r = runQaBot(
        createSim({ data }),
        { seed, classId, profile: PROFILE },
        'idle',
        MAX_TICKS,
        boundsFor,
      );
      rows.push(`seed ${seed} ${r.outcome} pulses ${r.pulsesCleared}`);
      expect(r.outcome, `seed ${seed}`).not.toBe('timeout');
      expect(r.outcome, `seed ${seed}`).not.toBe('victory');
      expect(r.violations, `seed ${seed}`).toEqual([]);
    }
    console.log(`[QA B-3]\n${rows.join('\n')}`);
  }, 120_000);
});
