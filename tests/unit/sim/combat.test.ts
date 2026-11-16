// K09, K10, K11: damage both ways, Burn, stat composition (GDD 5.2 to 5.6, effect-primitives 6.5, 6.6).

import { describe, expect, it } from 'vitest';
import { HitKind, SimEventType, TICK_RATE } from '../../../src/core/index.ts';
import { BURN_STACK_SLOTS } from '../../../src/sim/capacity.ts';
import {
  applyBurn,
  applyHit,
  beginHit,
  damagePlayer,
  endHit,
} from '../../../src/sim/systems/combat.ts';
import { spawnEnemy } from '../../../src/sim/systems/spawner.ts';
import { ensureStats } from '../../../src/sim/systems/run.ts';
import { harness, idOf } from './support/harness.ts';
import type { Harness } from './support/harness.ts';

function stat(h: Harness, id: string): number {
  return h.data.stats.findIndex((s) => s.id === id);
}

/** Hit an enemy slot once with a base damage; crit chance forced to 0 unless given. */
function hit(h: Harness, slot: number, base: number): number {
  const c = beginHit(h.ctx);
  if (c === null) throw new Error('hit stack');
  c.target = slot;
  c.base = base;
  c.hitKind = HitKind.Projectile;
  applyHit(h.ctx);
  const f = c.final;
  endHit(h.ctx);
  return f;
}

function ready(): Harness {
  const h = harness();
  h.start();
  h.quiet();
  h.ctx.run.weaponIndex.fill(-1);
  h.ctx.world.player.stats[stat(h, 'crit_chance')] = 0;
  return h;
}

describe('damage to Unlit (K09)', () => {
  it('applies guard as max(hit x guard_min_frac, hit - guard)', () => {
    const h = ready();
    const tank = spawnEnemy(h.ctx, idOf(h.data.enemies, 'tank'), 5, 0, false);
    const guard = h.data.enemies[idOf(h.data.enemies, 'tank')]?.guard ?? 0;
    expect(hit(h, tank, 10)).toBeCloseTo(10 - guard, 9);
    expect(hit(h, tank, 1)).toBeCloseTo(1 * h.data.config.guardMinFrac, 9);
  });

  it('adds damage_pct and crit_mult', () => {
    const h = ready();
    const s = spawnEnemy(h.ctx, idOf(h.data.enemies, 'swarmer'), 5, 0, false);
    h.ctx.world.player.stats[stat(h, 'damage_pct')] = 50;
    h.ctx.world.player.stats[stat(h, 'crit_chance')] = 100;
    const mult = h.ctx.world.player.stats[stat(h, 'crit_mult')] ?? 0;
    expect(hit(h, s, 2)).toBeCloseTo(2 * 1.5 * mult, 9);
  });

  it('floors boss HP at the pending phase threshold', () => {
    const h = ready();
    const b = spawnEnemy(h.ctx, idOf(h.data.enemies, 'boss_lantern'), 0, -3, false);
    const max = h.ctx.world.enemies.maxHp[b] ?? 0;
    h.ctx.run.bossHpFloor = max * 0.5;
    hit(h, b, max * 10);
    expect(h.ctx.world.enemies.hp[b]).toBeCloseTo(max * 0.5, 9);
  });
});

describe('damage to the player (K09)', () => {
  it('reduces by armor k/(k+armor), grants iframes_hurt, ignores hits while invulnerable', () => {
    const h = ready();
    const p = h.ctx.world.player;
    p.stats[stat(h, 'armor')] = 5;
    const hp0 = p.hp;
    damagePlayer(h.ctx, 10, 0);
    const k = h.data.config.armorK;
    expect(hp0 - p.hp).toBeCloseTo(Math.max(1, (10 * k) / (k + 5)), 9);
    expect(p.invulnTicks).toBe(h.data.config.iframesHurtTicks);
    const hp1 = p.hp;
    damagePlayer(h.ctx, 10, 0);
    expect(p.hp).toBe(hp1);
  });

  it('Barrier absorbs a hit with iframes_block; dodge 100% avoids with iframes_dodge', () => {
    const h = ready();
    const p = h.ctx.world.player;
    p.barrier = 1;
    const hp0 = p.hp;
    damagePlayer(h.ctx, 10, 0);
    expect(p.hp).toBe(hp0);
    expect(p.barrier).toBe(0);
    expect(p.invulnTicks).toBe(h.data.config.iframesBlockTicks);
    p.invulnTicks = 0;
    p.stats[stat(h, 'dodge')] = 100;
    damagePlayer(h.ctx, 10, 0);
    expect(p.hp).toBe(hp0);
    expect(p.invulnTicks).toBe(h.data.config.iframesDodgeTicks);
  });
});

describe('Burn (K10)', () => {
  it('uses dps_frac of the hit and ticks with the class dmg_mult', () => {
    const h = ready();
    const s = spawnEnemy(h.ctx, idOf(h.data.enemies, 'tank'), 8, 0, false);
    const burn = h.data.statuses.find((x) => x.id === 'burn');
    const frac = Number(burn?.params['dps_frac']);
    const tick = burn?.tickTicks ?? 0;
    // Lamplighter passive: Burn x status_rule dmg_mult.
    const mult = h.ctx.run.burnDmgMult;
    expect(mult).toBeGreaterThan(1);
    applyBurn(h.ctx, s, frac * 10, 1);
    h.clearLog();
    h.step(tick);
    const dot = h.of(SimEventType.EnemyDamaged).filter((e) => ((e.b >> 4) & 7) === HitKind.Dot);
    expect(dot).toHaveLength(1);
    expect(dot[0]?.a).toBeCloseTo(frac * 10 * (tick / TICK_RATE) * mult, 9);
  });

  it('stacks up to burn_max_stacks and replaces the weakest when full', () => {
    const h = ready();
    const s = spawnEnemy(h.ctx, idOf(h.data.enemies, 'tank'), 8, 0, false);
    const e = h.ctx.world.enemies;
    applyBurn(h.ctx, s, 1, 1);
    applyBurn(h.ctx, s, 5, 1);
    expect(e.burnStacks[s]).toBe(1);
    expect(e.burnDps[s * BURN_STACK_SLOTS]).toBe(5);
    h.ctx.world.player.stats[stat(h, 'burn_max_stacks')] = 3;
    applyBurn(h.ctx, s, 2, 1);
    applyBurn(h.ctx, s, 3, 1);
    expect(e.burnStacks[s]).toBe(3);
  });
});

describe('stat composition (K11)', () => {
  it('base + add, then mult, then min (smallest non-zero), then clamp, then convert', () => {
    const h = ready();
    const run = h.ctx.run;
    // Cards add to crit_chance; clamp by stats.csv max.
    run.statCardAdd[stat(h, 'crit_chance')] = 500;
    run.statCardAdd[stat(h, 'armor')] = 4;
    run.statsDirty = true;
    ensureStats(h.ctx, h.sc);
    const p = h.ctx.world.player;
    const critMax = h.data.stats[stat(h, 'crit_chance')]?.max ?? 0;
    expect(p.stats[stat(h, 'crit_chance')]).toBe(critMax);
    expect(p.stats[stat(h, 'armor')]).toBe(4);
    // Class stat_mods are added (Lamplighter area_pct).
    const cls = h.data.classes[0];
    expect(p.stats[stat(h, 'area_pct')]).toBe(Number(cls?.statMods['area_pct']));
    // max_hp base = class max_hp.
    expect(p.maxHp).toBe(cls?.maxHp);
  });

  it('passive stat_mod with stack_mode value multiplies by copies (whetstone x2)', () => {
    const h = ready();
    const base = h.ctx.world.player.stats[stat(h, 'crit_chance')] ?? 0;
    h.send({ type: 'debug.grant', kind: 'memento', id: 'whetstone', tier: 1 });
    h.send({ type: 'debug.grant', kind: 'memento', id: 'whetstone', tier: 1 });
    h.step();
    const after = h.ctx.world.player.stats[stat(h, 'crit_chance')] ?? 0;
    const statsBase = h.data.stats[stat(h, 'crit_chance')]?.base ?? 0;
    expect(base).toBe(0);
    expect(after).toBe(statsBase + 2 * 5);
  });
});
