// K18: headless bot runs whole 10 Pulse runs to victory or defeat without errors, fast.

import { describe, expect, it } from 'vitest';
import { SimEventType, TICK_RATE, createInputFrame } from '../../../src/core/index.ts';
import type { Command } from '../../../src/core/index.ts';
import { createSim } from '../../../src/sim/index.ts';
import { botCommands, botInput, runBot } from './support/bot.ts';
import { simFixtureData } from './support/sim-fixture.ts';

const data = simFixtureData();
/** Generous upper bound: 10 Pulses, boss, and shops. */
const MAX_TICKS = TICK_RATE * 60 * 20;

describe('headless bot (K18)', () => {
  it('finishes run_a (Warden and boss) for several seeds, faster than 20x real time', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 5; seed++) {
      const sim = createSim({ data });
      const t0 = performance.now();
      const r = runBot(sim, { seed, classId: 'lantern', profile: 'run_a' }, MAX_TICKS, (s) => {
        for (let i = 0; i < s.events.count; i++) seen.add(s.events.type[i] ?? 0);
      });
      const ms = performance.now() - t0;
      expect(r.outcome, `seed ${seed}`).not.toBe('timeout');
      // Simulated seconds / wall seconds above 20 (QA B-4).
      expect((r.ticks / TICK_RATE) * 1000).toBeGreaterThan(ms * 20);
      expect(Number.isFinite(sim.view.player.hp)).toBe(true);
    }
    for (const t of [
      SimEventType.PulseStarted,
      SimEventType.WeaponFired,
      SimEventType.EnemyKilled,
      SimEventType.GlintCollected,
      SimEventType.PlayerLeveledUp,
      SimEventType.LevelUpCardsShown,
      SimEventType.ItemBought,
      SimEventType.WardenSpawned,
      SimEventType.RiteCast,
      SimEventType.RunEnded,
    ]) {
      expect(seen.has(t), `event ${t}`).toBe(true);
    }
  });

  it('wins run_a_m1 (no boss: the final Pulse ends the run)', () => {
    let wins = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const r = runBot(
        createSim({ data }),
        { seed, classId: 'lantern', profile: 'run_a_m1' },
        MAX_TICKS,
      );
      expect(r.outcome).not.toBe('timeout');
      if (r.outcome === 'victory') {
        wins++;
        expect(r.pulsesCleared).toBe(data.profiles['run_a_m1']?.length);
      }
    }
    expect(wins).toBeGreaterThan(0);
  });

  it('reaches the boss and wins run_a with HP kept full by debug commands', () => {
    const sim = createSim({ data, debugCommands: true });
    const input = createInputFrame();
    const cmds: Command[] = [];
    sim.enqueue({
      type: 'run.start',
      seed: 3,
      classId: 'lantern',
      profile: 'run_a',
      difficulty: 0,
    });
    let reachedBoss = false;
    for (let t = 0; t < MAX_TICKS; t++) {
      const v = sim.view;
      if (v.phase === 'victory' || v.phase === 'defeat') break;
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
    expect(reachedBoss).toBe(true);
    expect(sim.view.phase).toBe('victory');
    expect(sim.view.runStats.pulsesCleared).toBe(data.profiles['run_a']?.length);
  });
});
