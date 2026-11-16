// K03, K04: automatic weapons with tiers, Rite (docs/specs/gp-core-loop.md).

import { describe, expect, it } from 'vitest';
import {
  Button,
  HitKind,
  SimEventType,
  SourceKind,
  encodeSource,
} from '../../../src/core/index.ts';
import { weaponCooldown } from '../../../src/sim/systems/weapons.ts';
import { harness, idOf, stepUntil } from './support/harness.ts';

const HIT_KIND_SHIFT = 4;
const hitKindOf = (b: number): number => (b >> HIT_KIND_SHIFT) & 7;

describe('weapons (K03)', () => {
  it('does not fire without an Unlit in range', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.step(120);
    expect(h.of(SimEventType.WeaponFired)).toHaveLength(0);
  });

  it('Lantern Bolt hits on impact, then explodes as an area hit that burns', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.send({ type: 'debug.spawn', enemyId: 'tank', x: 3, y: 0, count: 1 });
    expect(stepUntil(h, () => h.of(SimEventType.EnemyDamaged).length >= 2, 240)).toBe(true);
    const dmg = h.of(SimEventType.EnemyDamaged);
    const bolt = encodeSource(SourceKind.Weapon, idOf(h.data.weapons, 'lantern_bolt'));
    expect(dmg[0]?.c).toBe(bolt);
    expect(hitKindOf(dmg[0]?.b ?? 0)).toBe(HitKind.Projectile);
    expect(hitKindOf(dmg[1]?.b ?? 0)).toBe(HitKind.Area);
    // Tank guard: non-crit impact = max(8 x 0.25, 8 - guard).
    const tank = h.data.enemies[idOf(h.data.enemies, 'tank')];
    const nonCrit =
      (dmg[0]?.b ?? 0) & 1
        ? null
        : Math.max(8 * h.data.config.guardMinFrac, 8 - (tank?.guard ?? 0));
    if (nonCrit !== null) expect(dmg[0]?.a).toBeCloseTo(nonCrit, 9);
    expect(h.ctx.world.enemies.burnStacks[0]).toBeGreaterThan(0);
  });

  it('uses the tier damage multiplier from rarity.csv', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.run.weaponIndex[0] = idOf(h.data.weapons, 'splinter_shot');
    h.ctx.run.weaponTier[0] = 3;
    h.send({ type: 'debug.spawn', enemyId: 'swarmer', x: 2, y: 0, count: 1 });
    expect(stepUntil(h, () => h.of(SimEventType.EnemyDamaged).length >= 1, 120)).toBe(true);
    const ev = h.of(SimEventType.EnemyDamaged)[0];
    const mult = h.data.rarities.find((r) => r.order === 2)?.weaponDmgMult ?? 0;
    const crit = ((ev?.b ?? 0) & 1) === 1;
    if (!crit) expect(ev?.a).toBeCloseTo(6 * mult, 9);
  });

  it('cooldown = base x tier cd mult / (1 + attack_speed / 100)', () => {
    const h = harness();
    h.start();
    const w = h.ctx.sd.weapons[idOf(h.data.weapons, 'lantern_bolt')];
    const t1 = w?.tiers[0];
    const t4 = w?.tiers[3];
    if (t1 === undefined || t4 === undefined) throw new Error('tiers');
    expect(weaponCooldown(h.ctx, t1)).toBe(Math.round(t1.cooldownTicks * t1.cdMult));
    expect(weaponCooldown(h.ctx, t4)).toBe(Math.round(t4.cooldownTicks * t4.cdMult));
    const as = h.data.stats.findIndex((s) => s.id === 'attack_speed_pct');
    h.ctx.world.player.stats[as] = 100;
    expect(weaponCooldown(h.ctx, t1)).toBe(Math.round(t1.cooldownTicks / 2));
  });

  it('every tier A weapon archetype damages an Unlit', () => {
    for (const id of [
      'splinter_shot',
      'arc_blade',
      'orbit_shards',
      'chain_spark',
      'returning_glaive',
    ]) {
      const h = harness();
      h.start();
      h.quiet();
      h.ctx.run.weaponIndex[0] = idOf(h.data.weapons, id);
      h.ctx.run.weaponTier[0] = 1;
      h.send({ type: 'debug.spawn', enemyId: 'tank', x: 1.5, y: 0, count: 1 });
      h.send({ type: 'debug.spawn', enemyId: 'tank', x: 2.5, y: 1, count: 1 });
      const src = encodeSource(SourceKind.Weapon, idOf(h.data.weapons, id));
      const ok = stepUntil(h, () => h.of(SimEventType.EnemyDamaged).some((e) => e.c === src), 300);
      expect(ok, id).toBe(true);
    }
  });
});

describe('Rite (K04)', () => {
  it('casts Flare at the aim point clamped to max_range, lands after flight_s, leaves a zone', () => {
    const h = harness();
    h.start();
    h.quiet();
    const rite = h.data.rites[idOf(h.data.rites, 'flare_lantern')];
    const maxRange = Number(rite?.params['max_range']);
    const flight = Math.round(Number(rite?.params['flight_s']) * 60);
    h.input.aimX = 100 * 16;
    h.input.aimY = 0;
    h.input.pressed = Button.Rite;
    h.step();
    h.input.pressed = 0;
    const cast = h.of(SimEventType.RiteCast)[0];
    expect(cast).toBeDefined();
    expect(cast?.x).toBeCloseTo(h.sim.view.player.x + maxRange, 6);
    expect(h.sim.view.player.riteCharges).toBe(h.sim.view.player.riteChargesMax - 1);
    expect(h.ctx.world.playerZones.count).toBe(0);
    h.step(flight);
    expect(h.ctx.world.playerZones.count).toBe(1);
  });

  it('rejects the Rite without charges and recharges with the Rite cooldown', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.world.pulse.ticksLeft = 1e6;
    h.input.pressed = Button.Rite;
    h.step();
    h.step();
    h.input.pressed = 0;
    expect(h.of(SimEventType.RiteRejected)).toHaveLength(1);
    const p = h.sim.view.player;
    const cd = p.riteCooldownMaxTicks;
    expect(cd).toBe(h.data.rites[p.riteIndex]?.cooldownTicks);
    expect(stepUntil(h, () => h.of(SimEventType.RiteReady).length > 0, cd + 5)).toBe(true);
    expect(p.riteCharges).toBe(1);
  });
});
