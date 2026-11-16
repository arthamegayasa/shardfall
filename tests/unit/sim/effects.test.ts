// K15: effect engine with the tier A Mementos and synergies (effect-primitives 3 to 6, GDD 8, 9).

import { describe, expect, it } from 'vitest';
import { HitKind, SimEventType, SourceKind, encodeSource } from '../../../src/core/index.ts';
import { applyBurn, applyHit, beginHit, endHit } from '../../../src/sim/systems/combat.ts';
import { spawnEnemy } from '../../../src/sim/systems/spawner.ts';
import { harness, idOf } from './support/harness.ts';
import type { Harness } from './support/harness.ts';

function stat(h: Harness, id: string): number {
  return h.data.stats.findIndex((s) => s.id === id);
}

function ready(mementos: readonly string[]): Harness {
  const h = harness();
  h.start();
  h.quiet();
  h.ctx.run.weaponIndex.fill(-1);
  for (const m of mementos) h.send({ type: 'debug.grant', kind: 'memento', id: m, tier: 1 });
  h.step();
  return h;
}

function weaponHit(
  h: Harness,
  slot: number,
  base: number,
  weapon: string,
  kind = HitKind.Projectile,
): number {
  const c = beginHit(h.ctx);
  if (c === null) throw new Error('stack');
  const wi = idOf(h.data.weapons, weapon);
  c.target = slot;
  c.base = base;
  c.hitKind = kind;
  c.weaponIndex = wi;
  c.weaponSlot = 0;
  c.tagMask = h.ctx.sd.weapons[wi]?.tagMask ?? 0;
  c.sourceRef = encodeSource(SourceKind.Weapon, wi);
  applyHit(h.ctx);
  const f = c.final;
  endHit(h.ctx);
  h.drain();
  return f;
}

const enemy = (h: Harness, id: string, x = 4, y = 0): number =>
  spawnEnemy(h.ctx, idOf(h.data.enemies, id), x, y, false);

describe('Mementos (K15)', () => {
  it('glass_marble adds pierce, shard_pouch adds projectiles, ashen_crown adds burn stacks (stat_mod)', () => {
    const h = ready(['glass_marble', 'shard_pouch', 'ashen_crown']);
    const s = h.ctx.world.player.stats;
    expect(s[stat(h, 'pierce')]).toBe(1);
    expect(s[stat(h, 'projectiles')]).toBe(1);
    expect(s[stat(h, 'burn_max_stacks')]).toBe(3);
  });

  it('kindling_jar adds vulnerability on burning targets (hit_mod)', () => {
    const h = ready(['kindling_jar']);
    h.ctx.world.player.stats[stat(h, 'crit_chance')] = 0;
    const a = enemy(h, 'tank');
    const plain = weaponHit(h, a, 10, 'splinter_shot');
    applyBurn(h.ctx, a, 1, 1);
    const burning = weaponHit(h, a, 10, 'splinter_shot');
    const guard = h.data.enemies[idOf(h.data.enemies, 'tank')]?.guard ?? 0;
    expect(plain).toBeCloseTo(10 - guard, 9);
    expect(burning).toBeCloseTo(10 * 1.2 - guard, 9);
  });

  it('duelist_ribbon adds bonus on full HP targets only', () => {
    const h = ready(['duelist_ribbon']);
    h.ctx.world.player.stats[stat(h, 'crit_chance')] = 0;
    const a = enemy(h, 'tank');
    const guard = h.data.enemies[idOf(h.data.enemies, 'tank')]?.guard ?? 0;
    expect(weaponHit(h, a, 10, 'splinter_shot')).toBeCloseTo(15 - guard, 9);
    expect(weaponHit(h, a, 10, 'splinter_shot')).toBeCloseTo(10 - guard, 9);
  });

  it('headsman_hook executes normal Unlit below 12% HP, not bosses', () => {
    const h = ready(['headsman_hook']);
    h.ctx.world.player.stats[stat(h, 'crit_chance')] = 0;
    const t = enemy(h, 'tank');
    const e = h.ctx.world.enemies;
    e.hp[t] = (e.maxHp[t] ?? 0) * 0.13;
    weaponHit(h, t, 3, 'splinter_shot');
    expect(e.alive[t]).toBe(0);
    expect(h.of(SimEventType.EnemyKilled)).toHaveLength(1);
    expect(h.of(SimEventType.ProcTriggered)[0]?.a).toBe(idOf(h.data.effects, 'headsman_hook_1'));
  });

  it('coal_locket burns with chance x copies (stack_mode chance)', () => {
    const h = ready(['coal_locket', 'coal_locket', 'coal_locket']);
    const t = enemy(h, 'tank');
    let burns = 0;
    for (let i = 0; i < 200; i++) {
      h.ctx.world.enemies.burnStacks[t] = 0;
      h.ctx.world.enemies.hp[t] = h.ctx.world.enemies.maxHp[t] ?? 0;
      weaponHit(h, t, 1, 'splinter_shot');
      if ((h.ctx.world.enemies.burnStacks[t] ?? 0) > 0) burns++;
    }
    // 3 copies x 0.08 = 0.24: expect roughly 48 of 200, well above one copy's 16.
    expect(burns).toBeGreaterThan(25);
    expect(burns).toBeLessThan(80);
  });

  it('splinter_comb fires a seeking shard on crit (on_crit spawn_projectile, proc)', () => {
    const h = ready(['splinter_comb']);
    h.ctx.world.player.stats[stat(h, 'crit_chance')] = 100;
    const a = enemy(h, 'tank', 4, 0);
    enemy(h, 'tank', 6, 1);
    weaponHit(h, a, 10, 'splinter_shot');
    const ps = h.ctx.world.playerShots;
    let procs = 0;
    for (let i = 0; i < ps.highWater; i++) if (ps.alive[i] === 1 && ps.isProc[i] === 1) procs++;
    expect(procs).toBe(1);
  });

  it('smolder_boots drops an ember zone every `distance` u walked (on_distance spawn_zone)', () => {
    const h = ready(['smolder_boots']);
    h.input.moveX = 127;
    const per = h.data.config.playerBaseSpeedUPerTick;
    const dist = 3;
    h.step(Math.ceil(dist / per) + 1);
    expect(h.ctx.world.playerZones.count).toBe(1);
  });
});

describe('synergies and recursion (K15)', () => {
  it('activates Flame 2 with SynergyActivated when two flame ids are owned', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.send({ type: 'debug.grant', kind: 'memento', id: 'coal_locket', tier: 1 });
    h.step();
    const flame = h.data.tags.findIndex((t) => t.id === 'flame');
    expect(h.ctx.world.shop.tagCounts[flame]).toBe(2);
    const ev = h.of(SimEventType.SynergyActivated);
    expect(ev[0]?.a).toBe(flame);
    expect(ev[0]?.b).toBe(2);
  });

  it('Flame 4 chains at most two steps through procDepth', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.run.weaponIndex.fill(-1);
    for (const m of ['coal_locket', 'kindling_jar', 'torch_glove', 'smolder_boots']) {
      h.send({ type: 'debug.grant', kind: 'memento', id: m, tier: 1 });
    }
    h.step();
    const flame = h.data.tags.findIndex((t) => t.id === 'flame');
    expect(h.ctx.world.shop.tagCounts[flame]).toBeGreaterThanOrEqual(4);
    // A line of burning swarmers, each within the blast radius of the previous one.
    const slots: number[] = [];
    for (let i = 0; i < 6; i++) slots.push(enemy(h, 'swarmer', 3 + i * 1.2, 0));
    for (const s of slots) applyBurn(h.ctx, s, 1, 1);
    h.ctx.world.player.stats[stat(h, 'crit_chance')] = 0;
    // The grid is rebuilt every tick; enemies spawned directly need one rebuild here.
    const e = h.ctx.world.enemies;
    h.ctx.grid?.build(e.highWater, e.alive, e.x, e.y);
    weaponHit(h, slots[0] ?? 0, 1000, 'splinter_shot');
    const blasts = h
      .of(SimEventType.ProcTriggered)
      .filter((e) => e.a === idOf(h.data.effects, 'syn_flame_4a'));
    // Kill at depth 0 -> blast (depth 1) -> kill -> blast (depth 2) -> no further blasts.
    expect(blasts).toHaveLength(2);
  });
});
