// K05, K06: Pulse spawner and telegraphed Unlit attacks (GDD 3.2, 14.1, 14.2).

import { describe, expect, it } from 'vitest';
import { SimEventType, TelegraphKind } from '../../../src/core/index.ts';
import { buildSchedule, countedAlive } from '../../../src/sim/systems/spawner.ts';
import { harness, idOf, stepUntil } from './support/harness.ts';

describe('spawner (K05)', () => {
  it('schedules exactly the wave_spawns counts in groups within group_min..group_max', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    // Build Pulse 4's schedule directly.
    const slot = h.data.profiles['run_a']?.[3];
    if (slot === undefined) throw new Error('slot');
    const run = h.ctx.run;
    const total = slot.spawns.reduce((a, s) => a + s.count, 0);
    buildSchedule(h.ctx, slot);
    let sum = 0;
    for (let i = 0; i < run.scheduleCount; i++) {
      sum += run.schedSize[i] ?? 0;
      if (i > 0) expect(run.schedTick[i] ?? 0).toBeGreaterThanOrEqual(run.schedTick[i - 1] ?? 0);
      expect(run.schedTick[i] ?? 0).toBeLessThanOrEqual(
        slot.durationTicks - h.data.config.spawnQuietEndTicks,
      );
    }
    expect(sum).toBe(total);
    for (const sp of slot.spawns) {
      const type = idOf(h.data.enemies, sp.enemyId);
      for (let i = 0; i < run.scheduleCount; i++) {
        if (run.schedType[i] !== type) continue;
        expect(run.schedSize[i] ?? 0).toBeLessThanOrEqual(sp.groupMax);
      }
    }
  });

  it('marks every spawn spawn_mark_s before the Unlit emerges, outside the player safe radius', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    h.step(h.sim.view.pulse.ticksTotal - 1);
    const marks = h.of(SimEventType.SpawnMarked);
    const spawned = h.of(SimEventType.EnemySpawned);
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(m.b).toBe(h.data.config.spawnMarkTicks);
    const first = marks[0];
    const firstSpawn = spawned[0];
    if (first === undefined || firstSpawn === undefined) throw new Error('no spawns');
    expect(firstSpawn.tick - first.tick).toBe(h.data.config.spawnMarkTicks);
    const safe = h.ctx.arena?.def.spawn.playerSafeRadius ?? 0;
    expect(Math.hypot(first.x, first.y)).toBeGreaterThanOrEqual(safe);
    // Total emerged = schedule total (Pulse 1 has only swarmers, cap above the count).
    const want = (h.data.profiles['run_a']?.[0]?.spawns ?? []).reduce((a, s) => a + s.count, 0);
    expect(spawned.length).toBe(want);
  });

  it('gives no contact damage during spawn_grace_s', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.run.weaponIndex.fill(-1);
    h.send({ type: 'debug.spawn', enemyId: 'swarmer', x: 0, y: 0, count: 1 });
    h.step();
    const grace = h.data.config.spawnGraceTicks;
    h.step(grace - 2);
    expect(h.of(SimEventType.PlayerDamaged)).toHaveLength(0);
    expect(stepUntil(h, () => h.of(SimEventType.PlayerDamaged).length > 0, 10)).toBe(true);
  });

  it('never exceeds alive_cap with counted Unlit and marks', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    const cap = h.data.profiles['run_a']?.[0]?.aliveCap ?? 0;
    h.ctx.run.weaponIndex.fill(-1);
    h.ctx.world.player.hp = 1e9;
    let max = 0;
    for (let i = 0; i < h.sim.view.pulse.ticksTotal - 2; i++) {
      h.step();
      h.ctx.world.player.hp = 1e9;
      max = Math.max(max, countedAlive(h.ctx));
    }
    expect(max).toBeLessThanOrEqual(cap);
  });
});

describe('telegraphed attacks (K06)', () => {
  it('charger shows a Charge telegraph for telegraph_s before charging', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.run.weaponIndex.fill(-1);
    h.ctx.world.pulse.ticksLeft = 1e6;
    h.send({ type: 'debug.spawn', enemyId: 'charger', x: 4, y: 0, count: 1 });
    expect(stepUntil(h, () => h.of(SimEventType.TelegraphStarted).length > 0, 300)).toBe(true);
    const t = h.of(SimEventType.TelegraphStarted)[0];
    expect(t?.a).toBe(TelegraphKind.Charge);
    expect(t?.b).toBe(h.data.enemies[idOf(h.data.enemies, 'charger')]?.telegraphTicks);
  });

  it('shooter shows a Projectile telegraph before each shot', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.run.weaponIndex.fill(-1);
    h.ctx.world.pulse.ticksLeft = 1e6;
    h.send({ type: 'debug.spawn', enemyId: 'shooter', x: 6, y: 0, count: 1 });
    expect(stepUntil(h, () => h.ctx.world.enemyShots.count > 0, 600)).toBe(true);
    const tel = h.of(SimEventType.TelegraphStarted);
    expect(tel[0]?.a).toBe(TelegraphKind.Projectile);
    const shooter = h.data.enemies[idOf(h.data.enemies, 'shooter')];
    expect(h.sim.view.tick - (tel[0]?.tick ?? 0)).toBeGreaterThanOrEqual(
      shooter?.telegraphTicks ?? 0,
    );
  });

  it('Warden volley fires only after its Ring telegraph', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.run.weaponIndex.fill(-1);
    h.ctx.world.pulse.ticksLeft = 1e6;
    h.ctx.world.player.hp = 1e9;
    h.send({ type: 'debug.spawn', enemyId: 'warden_hound', x: 5, y: 0, count: 1 });
    const ok = stepUntil(
      h,
      () => {
        h.ctx.world.player.hp = 1e9;
        return h.of(SimEventType.TelegraphStarted).some((e) => e.a === TelegraphKind.Ring);
      },
      1200,
    );
    expect(ok).toBe(true);
    const ring = h.of(SimEventType.TelegraphStarted).find((e) => e.a === TelegraphKind.Ring);
    expect(ring?.b).toBe(h.data.affixes[idOf(h.data.affixes, 'volley')]?.telegraphTicks);
    const fired = () => h.of(SimEventType.EnemyProjectileFired);
    expect(fired()).toHaveLength(0);
    h.step(ring?.b ?? 0);
    expect(fired()).toHaveLength(1);
    // Shots leave exactly when the telegraph resolves (P2-e).
    expect((fired()[0]?.tick ?? 0) - (ring?.tick ?? 0)).toBe(ring?.b);
    expect(fired()[0]?.b).toBe(
      Number(h.data.affixes[idOf(h.data.affixes, 'volley')]?.params['count']),
    );
  });
});
