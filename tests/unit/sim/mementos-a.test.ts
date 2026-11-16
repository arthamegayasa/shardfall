// Every tier A Memento on the real effects.csv rows (M2-05, GD 9 and effect-primitives 8), plus the
// Shard 2 seeking split. Values are read from the data, never copied (architecture 14.2).

import { describe, expect, it } from 'vitest';
import { HitKind, SimEventType, SourceKind, encodeSource } from '../../../src/core/index.ts';
import type { GameData } from '../../../src/content/index.ts';
import { pnum } from '../../../src/sim/sim-data.ts';
import { applyBurn, applyHit, beginHit, endHit } from '../../../src/sim/systems/combat.ts';
import { spawnEnemy } from '../../../src/sim/systems/spawner.ts';
import { realGameData } from '../qa/support/real-data.ts';
import { harness, idOf } from './support/harness.ts';
import type { Harness } from './support/harness.ts';

const data: GameData = realGameData();
const classId = data.classes[0]?.id ?? '';

function stat(h: Harness, id: string): number {
  return h.data.stats.findIndex((s) => s.id === id);
}

function effParams(id: string): Readonly<Record<string, number | string>> {
  return data.effects[idOf(data.effects, id)]?.params ?? {};
}

/** Real data, quiet arena, no weapons, the given Mementos; crit off unless asked. */
function ready(mementos: readonly string[], crit = 0): Harness {
  const h = harness({ data });
  h.start({ classId });
  h.quiet();
  h.ctx.run.weaponIndex.fill(-1);
  for (const m of mementos) h.send({ type: 'debug.grant', kind: 'memento', id: m, tier: 1 });
  h.step();
  h.ctx.world.player.stats[stat(h, 'crit_chance')] = crit;
  h.ctx.world.pulse.ticksLeft = 60 * 600;
  return h;
}

function statAfter(mementos: readonly string[], id: string): number {
  const h = ready(mementos);
  h.ctx.run.statsDirty = true;
  h.step();
  return h.ctx.world.player.stats[stat(h, id)] ?? 0;
}

const enemy = (h: Harness, id: string, x = 4, y = 0): number => {
  const s = spawnEnemy(h.ctx, idOf(h.data.enemies, id), x, y, false);
  const e = h.ctx.world.enemies;
  h.ctx.grid?.build(e.highWater, e.alive, e.x, e.y);
  return s;
};

function weaponHit(h: Harness, slot: number, base: number, weapon: string): number {
  const c = beginHit(h.ctx);
  if (c === null) throw new Error('stack');
  const wi = idOf(h.data.weapons, weapon);
  const w = h.ctx.sd.weapons[wi];
  c.target = slot;
  c.base = base;
  c.hitKind = w?.hitKind ?? HitKind.Projectile;
  c.weaponIndex = wi;
  c.weaponSlot = 0;
  c.tagMask = w?.tagMask ?? 0;
  c.sourceRef = encodeSource(SourceKind.Weapon, wi);
  applyHit(h.ctx);
  const f = c.final;
  endHit(h.ctx);
  h.drain();
  return f;
}

function procShots(h: Harness): number {
  const ps = h.ctx.world.playerShots;
  let n = 0;
  for (let i = 0; i < ps.highWater; i++) if (ps.alive[i] === 1 && ps.isProc[i] === 1) n++;
  return n;
}

const guardOf = (id: string): number => data.enemies[idOf(data.enemies, id)]?.guard ?? 0;

describe('tier A Mementos on real data', () => {
  it('covers all 12 tier A Mementos of the build', () => {
    const tierA = data.mementos.filter((m) => m.contentTier === 'A').map((m) => m.id);
    expect(tierA.sort()).toEqual(
      [
        'ashen_crown',
        'coal_locket',
        'duelist_ribbon',
        'glass_marble',
        'headsman_hook',
        'kindling_jar',
        'prism_lens',
        'shard_pouch',
        'smolder_boots',
        'splinter_comb',
        'torch_glove',
        'whetstone',
      ].sort(),
    );
  });

  it('coal_locket: Burn on hit with chance x copies', () => {
    const chance = data.effects[idOf(data.effects, 'coal_locket_1')]?.chance ?? 0;
    const h = ready(['coal_locket', 'coal_locket']);
    const t = enemy(h, 'tank');
    let burns = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const e = h.ctx.world.enemies;
      e.burnStacks[t] = 0;
      e.hp[t] = e.maxHp[t] ?? 0;
      weaponHit(h, t, 1, 'splinter_shot');
      if ((e.burnStacks[t] ?? 0) > 0) burns++;
    }
    const p = Math.min(1, chance * 2);
    expect(burns / n).toBeGreaterThan(p * 0.6);
    expect(burns / n).toBeLessThan(p * 1.4);
  });

  it('kindling_jar: vulnerability on burning targets', () => {
    const v = pnum(effParams('kindling_jar_1'), 'value', 0);
    const h = ready(['kindling_jar']);
    const t = enemy(h, 'tank');
    const g = guardOf('tank');
    expect(weaponHit(h, t, 10, 'splinter_shot')).toBeCloseTo(10 - g, 9);
    applyBurn(h.ctx, t, 1, 1);
    expect(weaponHit(h, t, 10, 'splinter_shot')).toBeCloseTo(10 * (1 + v) - g, 9);
  });

  it('torch_glove: edge hits apply Burn, other tags do not', () => {
    const h = ready(['torch_glove']);
    const a = enemy(h, 'tank');
    weaponHit(h, a, 1, 'splinter_shot');
    expect(h.ctx.world.enemies.burnStacks[a]).toBe(0);
    weaponHit(h, a, 1, 'arc_blade');
    expect(h.ctx.world.enemies.burnStacks[a]).toBeGreaterThan(0);
  });

  it('ashen_crown: burn_max_stacks up by its value', () => {
    const v = pnum(effParams('ashen_crown_1'), 'value', 0);
    expect(statAfter(['ashen_crown'], 'burn_max_stacks') - statAfter([], 'burn_max_stacks')).toBe(
      v,
    );
  });

  it('smolder_boots: an ember zone every `distance` u walked', () => {
    const dist = pnum(effParams('smolder_boots_1'), 'distance', 0);
    const h = ready(['smolder_boots']);
    h.input.moveX = 127;
    const per = h.data.config.playerBaseSpeedUPerTick;
    h.step(Math.ceil(dist / per) + 1);
    expect(h.ctx.world.playerZones.count).toBe(1);
  });

  it('glass_marble, shard_pouch, whetstone: flat stat bonuses from their values', () => {
    for (const [m, eff, st] of [
      ['glass_marble', 'glass_marble_1', 'pierce'],
      ['shard_pouch', 'shard_pouch_1', 'projectiles'],
      ['whetstone', 'whetstone_1', 'crit_chance'],
    ] as const) {
      const v = pnum(effParams(eff), 'value', 0);
      expect(statAfter([m], st) - statAfter([], st)).toBeCloseTo(v, 9);
    }
  });

  it('prism_lens: every n-th projectile hit splits into count shards', () => {
    const p = effParams('prism_lens_1');
    const cond = data.effects[idOf(data.effects, 'prism_lens_1')]?.conditions ?? [];
    const nth = Number(cond.find((c) => c.name === 'every_nth')?.value.split('@')[0] ?? 0);
    const h = ready(['prism_lens']);
    const t = enemy(h, 'tank');
    for (let i = 1; i < nth; i++) weaponHit(h, t, 1, 'splinter_shot');
    expect(procShots(h)).toBe(0);
    weaponHit(h, t, 1, 'splinter_shot');
    expect(procShots(h)).toBe(pnum(p, 'count', 0));
  });

  it('splinter_comb: a crit sends a seeking shard to another Unlit', () => {
    const h = ready(['splinter_comb'], 100);
    const a = enemy(h, 'tank', 4, 0);
    enemy(h, 'tank', 6, 1);
    weaponHit(h, a, 10, 'splinter_shot');
    expect(procShots(h)).toBe(pnum(effParams('splinter_comb_1'), 'count', 0));
  });

  it('duelist_ribbon: bonus on full HP targets only', () => {
    const v = pnum(effParams('duelist_ribbon_1'), 'value', 0);
    const h = ready(['duelist_ribbon']);
    const t = enemy(h, 'tank');
    const g = guardOf('tank');
    expect(weaponHit(h, t, 10, 'splinter_shot')).toBeCloseTo(10 * (1 + v) - g, 9);
    expect(weaponHit(h, t, 10, 'splinter_shot')).toBeCloseTo(10 - g, 9);
  });

  it('headsman_hook: executes normal Unlit below its threshold, never the Warden', () => {
    const cond = data.effects[idOf(data.effects, 'headsman_hook_1')]?.conditions ?? [];
    const below = Number(cond.find((c) => c.name === 'target_hp_below')?.value ?? 0);
    const h = ready(['headsman_hook']);
    const e = h.ctx.world.enemies;
    const t = enemy(h, 'tank');
    e.hp[t] = (e.maxHp[t] ?? 0) * below + 0.5;
    weaponHit(h, t, 3, 'splinter_shot');
    expect(e.alive[t]).toBe(0);
    const w = enemy(h, 'warden_hound', -4, 0);
    e.hp[w] = (e.maxHp[w] ?? 0) * below + 0.5;
    weaponHit(h, w, 3, 'splinter_shot');
    expect(e.alive[w]).toBe(1);
  });
});

describe('Shard 2 on real data (effect-primitives 6.7)', () => {
  it('a projectile kill splits toward the nearest other Unlit within seek_range', () => {
    const p = effParams('syn_shard_2');
    const seek = pnum(p, 'seek_range', 0);
    expect(seek).toBeGreaterThan(0);
    const h = ready(['glass_marble']);
    h.ctx.run.weaponIndex[0] = idOf(data.weapons, 'splinter_shot');
    h.ctx.run.weaponTier[0] = 1;
    h.send({ type: 'debug.grant', kind: 'memento', id: 'glass_marble', tier: 1 });
    h.step();
    h.ctx.run.weaponIndex.fill(-1);
    const shard = data.tags.findIndex((t) => t.id === 'shard');
    expect(h.ctx.world.shop.tagCounts[shard]).toBeGreaterThanOrEqual(2);
    const a = enemy(h, 'swarmer', 3, 0);
    const b = enemy(h, 'tank', 3 + seek * 0.5, 0);
    const c = enemy(h, 'tank', 3, -seek * 0.5);
    weaponHit(h, a, 1000, 'splinter_shot');
    const e = h.ctx.world.enemies;
    const ps = h.ctx.world.playerShots;
    const syn = encodeSource(SourceKind.Effect, idOf(data.effects, 'syn_shard_2'));
    const dirs: number[] = [];
    for (let i = 0; i < ps.highWater; i++) {
      if (ps.alive[i] !== 1 || ps.sourceRef[i] !== syn) continue;
      dirs.push(Math.atan2(ps.vy[i] ?? 0, ps.vx[i] ?? 0));
    }
    expect(dirs).toHaveLength(pnum(p, 'count', 0));
    const toward = (s: number): number => Math.atan2((e.y[s] ?? 0) - 0, (e.x[s] ?? 0) - 3);
    for (const want of [toward(b), toward(c)]) {
      expect(dirs.some((d) => Math.abs(d - want) < 1e-6)).toBe(true);
    }
    expect(h.of(SimEventType.ProcTriggered).some((x) => x.c === syn)).toBe(true);
  });
});
