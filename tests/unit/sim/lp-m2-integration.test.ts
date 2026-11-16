// LP M2-09 integration: config keys written by GD (config.csv) are the keys the sim reads, with no
// number left in code (low_hp_frac, spawn_mark_medium_group_min, glint_fly_speed_start, glint_fly_accel).
// Sim fixture data with config overrides; values are test inputs, not balance data.

import { describe, expect, it } from 'vitest';
import { SimEventType, SourceKind, TICK_RATE, encodeSource } from '../../../src/core/index.ts';
import type { GameData } from '../../../src/content/index.ts';
import { dropGlint } from '../../../src/sim/systems/pickups.ts';
import { mementoOfferable } from '../../../src/sim/systems/progression.ts';
import { startMarkAt } from '../../../src/sim/systems/spawner.ts';
import { harness, idOf, stepUntil } from './support/harness.ts';
import type { Harness } from './support/harness.ts';
import { simFixtureData } from './support/sim-fixture.ts';

type Cfg = GameData['config'];

function withConfig(patch: Partial<Cfg>): GameData {
  const base = simFixtureData();
  return { ...base, config: { ...base.config, ...patch } };
}

function ready(h: Harness): Harness {
  h.start();
  h.quiet();
  h.ctx.run.weaponIndex.fill(-1);
  h.clearLog();
  return h;
}

describe('config keys from GD data (LP M2-09 A1)', () => {
  it('low_hp_frac sets the PlayerHpLowChanged threshold', () => {
    for (const frac of [0.3, 0.6]) {
      const h = ready(harness({ data: withConfig({ lowHpFrac: frac }) }));
      const max = h.sim.view.player.maxHp;
      h.send({ type: 'debug.setHp', hp: Math.floor(max * 0.5) });
      h.step();
      const low = h.of(SimEventType.PlayerHpLowChanged).map((e) => e.a);
      // Half HP is low only when the threshold is above one half.
      expect(low).toEqual(frac > 0.5 ? [1] : []);
    }
  });

  it('spawn_mark_medium_group_min decides when a group uses at least the medium mark', () => {
    const small = (h: Harness): number => {
      const type = idOf(h.data.enemies, 'swarmer');
      const slot = startMarkAt(h.ctx, type, 3, 0, 0, false, -1);
      return h.ctx.world.spawnMarks.radius[slot] ?? 0;
    };
    const medium = simFixtureData().config.spawnMarkDiamMediumU * 0.5;
    const grouped = small(ready(harness({ data: withConfig({ spawnMarkMediumGroupMin: 3 }) })));
    const alone = small(ready(harness({ data: withConfig({ spawnMarkMediumGroupMin: 4 }) })));
    expect(grouped).toBe(medium);
    expect(alone).toBeLessThan(medium);
  });

  it('a pulled Glint starts at glint_fly_speed_start and accelerates up to glint_fly_speed', () => {
    const top = 20 / TICK_RATE;
    const h = ready(
      harness({
        data: withConfig({
          glintFlySpeedUPerTick: top,
          glintFlySpeedStartUPerTick: 3 / TICK_RATE,
          glintFlyAccel: 60,
          pickupRadiusBaseU: 30,
        }),
      }),
    );
    dropGlint(h.ctx, 12, 0, 1);
    h.drain();
    h.step();
    const pk = h.ctx.world.pickups;
    const speeds: number[] = [];
    for (let i = 0; i < 40 && pk.alive[0] === 1; i++) {
      speeds.push(pk.flySpeed[0] ?? 0);
      h.step();
    }
    // First moved tick used the start speed, then +60/TICK_RATE^2 per tick, never above the top.
    expect(speeds[0]).toBeCloseTo(3 / TICK_RATE + 60 / (TICK_RATE * TICK_RATE), 12);
    for (let i = 1; i < speeds.length; i++)
      expect(speeds[i] ?? 0).toBeGreaterThanOrEqual((speeds[i - 1] ?? 0) - 1e-12);
    expect(Math.max(...speeds)).toBeCloseTo(top, 12);
  });

  it('with glint_fly_accel 0 a piece flies at the top speed (M1 behavior)', () => {
    const top = 12 / TICK_RATE;
    const h = ready(
      harness({
        data: withConfig({
          glintFlySpeedUPerTick: top,
          glintFlySpeedStartUPerTick: 1 / TICK_RATE,
          glintFlyAccel: 0,
          pickupRadiusBaseU: 30,
        }),
      }),
    );
    dropGlint(h.ctx, 12, 0, 1);
    h.drain();
    h.step();
    expect(h.ctx.world.pickups.flySpeed[0]).toBeCloseTo(top, 12);
  });
});

describe('Homeward Blade return (GD fix in projectiles.ts, LP M2-09 A2)', () => {
  it('one throw hits a large Unlit at most once out and once back', () => {
    const h = ready(harness());
    const glaive = idOf(h.data.weapons, 'returning_glaive');
    h.ctx.run.weaponIndex[0] = glaive;
    h.ctx.run.weaponTier[0] = 1;
    h.send({ type: 'debug.spawn', enemyId: 'tank', x: 2.5, y: 0, count: 1 });
    expect(stepUntil(h, () => h.of(SimEventType.WeaponFired).length > 0, 300)).toBe(true);
    // Stop further throws, freeze the target, and let the first blade come home.
    h.ctx.run.weaponIndex[0] = -1;
    const e = h.ctx.world.enemies;
    const shots = h.ctx.world.playerShots;
    for (let i = 0; i < 240 && shots.count > 0; i++) {
      e.x[0] = 2.5;
      e.y[0] = 0;
      h.step();
    }
    expect(shots.count).toBe(0);
    const src = encodeSource(SourceKind.Weapon, glaive);
    const hits = h.of(SimEventType.EnemyDamaged).filter((ev) => ev.c === src);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

describe('meta unlocks in the run (LP M2-09 B)', () => {
  const pts = (h: Harness): number[] =>
    h.data.mementos.flatMap((m, i) => (m.unlock === 'test_lock' ? [i] : []));

  it('run.start unlocked opens a Memento pack for this run; without it the pack stays closed', () => {
    const closed = harness();
    closed.start();
    for (const m of pts(closed)) expect(mementoOfferable(closed.ctx, m)).toBe(false);
    const open = harness();
    open.send({
      type: 'run.start',
      seed: 7,
      classId: 'lantern',
      profile: 'run_a',
      difficulty: 0,
      unlocked: ['test_lock', 'not_an_unlock'],
    });
    open.step();
    expect(open.ctx.run.unlocked).toEqual(['test_lock']);
    expect(pts(open).length).toBeGreaterThan(0);
    for (const m of pts(open)) expect(mementoOfferable(open.ctx, m)).toBe(true);
  });

  it('the unlock set survives save and load with the same state hash', () => {
    const h = harness();
    h.send({
      type: 'run.start',
      seed: 9,
      classId: 'lantern',
      profile: 'run_a',
      difficulty: 0,
      unlocked: ['test_lock'],
    });
    h.step();
    h.send({ type: 'debug.endPulse' });
    expect(stepUntil(h, () => h.sim.save() !== null, 600)).toBe(true);
    const save = h.sim.save();
    if (save === null) throw new Error('no save at the shop');
    expect(save.unlocked).toEqual(['test_lock']);
    const b = harness();
    expect(b.sim.load(save).ok).toBe(true);
    b.step(0);
    expect(b.ctx.run.unlocked).toEqual(['test_lock']);
    expect(b.sim.hash()).toBe(h.sim.hash());
    // An old save without the field loads with no unlocks.
    const c = harness();
    const { unlocked: _drop, ...old } = save;
    expect(c.sim.load(old).ok).toBe(true);
    expect(c.ctx.run.unlocked).toEqual([]);
  });

  it('Silt at the run end = (cleared Pulses x silt_per_pulse + Warden and boss silt + win) x mult', () => {
    const base = simFixtureData('B');
    const data = { ...base, config: { ...base.config, siltPerPulse: 1, siltWin: 10 } };
    const h = harness({ data });
    h.start({ profile: 'run_a' });
    for (let k = 0; k < 2; k++) {
      h.send({ type: 'debug.endPulse' });
      stepUntil(h, () => h.ctx.world.phase !== 'pulse' && h.ctx.world.phase !== 'pulseClear', 900);
      for (let g = 0; g < 20 && h.ctx.world.phase !== 'shop'; g++) {
        if (h.ctx.world.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
        if (h.ctx.world.phase === 'reward') h.send({ type: 'reward.pick', choice: 0 });
        h.step();
      }
      h.send({ type: 'pulse.begin' });
      h.step();
    }
    const cleared = h.ctx.world.runStats.pulsesCleared;
    const kills = h.ctx.run.siltKills;
    expect(cleared).toBe(2);
    h.clearLog();
    h.send({ type: 'run.abandon' });
    h.step();
    const ended = h.of(SimEventType.RunEnded)[0];
    expect(ended?.b).toBe(Math.floor((cleared * 1 + kills) * (h.ctx.run.diff?.siltMult ?? 1)));
  });
});
