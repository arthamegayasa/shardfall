// M2-05 gameplay vertical slice (docs/specs/gp-m2-slice.md): LP review findings, impact events,
// affixes, tier B/C behaviors, boss pattern archetypes, Orbit lunge, Tithe Coin. Sim fixture data
// (tests/unit/sim/fixtures/data), tier C build where B/C rows are needed.

import { describe, expect, it } from 'vitest';
import {
  AffixAction,
  AreaShape,
  Button,
  DAMAGE_IMPACT_SHIFT,
  HitKind,
  HitStopReason,
  SimEventType,
  SourceKind,
  TelegraphKind,
  encodeSource,
} from '../../../src/core/index.ts';
import { insideDistance } from '../../../src/sim/arena.ts';
import { AiState, DangerMode } from '../../../src/sim/codes.ts';
import { TeleMin, teleTicks } from '../../../src/sim/systems/areas.ts';
import { applyHit, beginHit, endHit, knockEnemy } from '../../../src/sim/systems/combat.ts';
import { dropGlint } from '../../../src/sim/systems/pickups.ts';
import { spawnEnemy } from '../../../src/sim/systems/spawner.ts';
import { createSim } from '../../../src/sim/index.ts';
import { createInputFrame } from '../../../src/core/index.ts';
import { harness, idOf, stepUntil } from './support/harness.ts';
import type { Harness } from './support/harness.ts';
import { simFixtureData } from './support/sim-fixture.ts';

const tierC = (): Harness => harness({ data: simFixtureData('C') });

function stat(h: Harness, id: string): number {
  return h.data.stats.findIndex((s) => s.id === id);
}

function ready(h: Harness, mementos: readonly string[] = []): Harness {
  h.start();
  h.quiet();
  h.ctx.run.weaponIndex.fill(-1);
  for (const m of mementos) h.send({ type: 'debug.grant', kind: 'memento', id: m, tier: 1 });
  h.step();
  h.ctx.world.player.stats[stat(h, 'crit_chance')] = 0;
  // Long Pulse so behavior tests are not cut by the fixture Pulse timer.
  h.ctx.world.pulse.ticksLeft = 60 * 600;
  return h;
}

const enemy = (h: Harness, id: string, x = 4, y = 0): number => {
  const s = spawnEnemy(h.ctx, idOf(h.data.enemies, id), x, y, false);
  const e = h.ctx.world.enemies;
  h.ctx.grid?.build(e.highWater, e.alive, e.x, e.y);
  return s;
};

function weaponHit(h: Harness, slot: number, base: number, weapon = 'splinter_shot'): number {
  const c = beginHit(h.ctx);
  if (c === null) throw new Error('stack');
  const wi = idOf(h.data.weapons, weapon);
  c.target = slot;
  c.base = base;
  c.hitKind = HitKind.Projectile;
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

/** Keep the player alive; invulnerable unless told otherwise. */
function keep(h: Harness, invuln = true): void {
  const p = h.ctx.world.player;
  p.hp = p.maxHp;
  if (invuln) p.invulnTicks = 10;
}

function stepKeep(h: Harness, n: number, invuln = true): void {
  for (let i = 0; i < n; i++) {
    keep(h, invuln);
    h.step();
  }
}

/** Clear Pulses with debug.endPulse until Pulse index `target` is running. */
function skipTo(h: Harness, target: number): void {
  while (h.sim.view.pulse.index < target || h.sim.view.phase !== 'pulse') {
    const ph = h.sim.view.phase;
    if (ph === 'pulse') h.send({ type: 'debug.endPulse' });
    else if (ph === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
    else if (ph === 'reward') h.send({ type: 'reward.pick', choice: 0 });
    else if (ph === 'shop') h.send({ type: 'pulse.begin' });
    h.step();
  }
}

describe('LP review M1 findings (sim)', () => {
  it('MAYOR 19: per_target counters go to the first 4 active effects; the 5th fails and is counted', () => {
    const h = ready(harness(), ['pt_1', 'pt_2', 'pt_3', 'pt_4', 'pt_5']);
    const slots = ['pt_1_1', 'pt_2_1', 'pt_3_1', 'pt_4_1', 'pt_5_1'].map(
      (id) => h.ctx.run.targetSlotOf[idOf(h.data.effects, id)],
    );
    expect(slots).toEqual([0, 1, 2, 3, -1]);
    const t = enemy(h, 'tank');
    const guard = h.data.enemies[idOf(h.data.enemies, 'tank')]?.guard ?? 0;
    const before = h.sim.poolOverflow;
    expect(weaponHit(h, t, 10)).toBeCloseTo(10 - guard, 9);
    // Second hit on the same target: four counters reach 2 (+100% each), the fifth cannot count.
    expect(weaponHit(h, t, 10)).toBeCloseTo(10 * 5 - guard, 9);
    expect(h.sim.poolOverflow).toBe(before + 2);
  });

  it('leech heals carry their own SourceRef, not the Burn one', () => {
    const h = ready(harness());
    h.ctx.world.player.stats[stat(h, 'leech')] = 100;
    h.ctx.world.player.hp = 1;
    weaponHit(h, enemy(h, 'tank'), 1);
    const healed = h.of(SimEventType.PlayerHealed);
    expect(healed.length).toBe(1);
    expect(healed[0]?.c).not.toBe(encodeSource(SourceKind.Status, 0));
  });

  it('save at the Warden reward keeps RewardView.sourceTypeIndex and the level total, same hash', () => {
    const h = harness();
    h.start();
    skipTo(h, 4);
    expect(stepUntil(h, () => (keep(h), h.ctx.run.wardenSlot >= 0), 2000)).toBe(true);
    h.send({ type: 'debug.xp', amount: 200 });
    h.send({ type: 'debug.endPulse' });
    expect(stepUntil(h, () => h.sim.view.phase === 'reward', 200)).toBe(true);
    const warden = idOf(h.data.enemies, 'warden_hound');
    expect(h.sim.view.reward.sourceTypeIndex).toBe(warden);
    const save = h.sim.save();
    expect(save).not.toBeNull();
    if (save === null) return;
    const b = createSim({ data: h.data, debugCommands: true });
    expect(b.load(save)).toEqual({ ok: true });
    expect(b.view.reward.sourceTypeIndex).toBe(warden);
    expect(b.hash()).toBe(h.sim.hash());
    const input = createInputFrame();
    h.send({ type: 'reward.pick', choice: 0 });
    h.step();
    b.enqueue({ type: 'reward.pick', choice: 0 });
    b.step(input);
    expect(h.sim.view.phase).toBe('levelUp');
    expect(b.view.levelUp.total).toBe(h.sim.view.levelUp.total);
    expect(b.view.levelUp.total).toBeGreaterThan(1);
    expect(b.hash()).toBe(h.sim.hash());
  });

  it('telegraph durations are never below the GD minimum of their category', () => {
    const h = harness();
    h.start();
    const c = h.data.config;
    expect(teleTicks(h.ctx, TeleMin.Boss, 1)).toBe(c.telegraphMinBossTicks);
    expect(teleTicks(h.ctx, TeleMin.Charge, 1)).toBe(c.telegraphMinChargeTicks);
    expect(teleTicks(h.ctx, TeleMin.Area, 1)).toBe(c.telegraphMinAreaTicks);
    expect(teleTicks(h.ctx, TeleMin.Projectile, 1)).toBe(c.telegraphMinProjectileTicks);
    expect(teleTicks(h.ctx, TeleMin.Area, 500)).toBe(500);
  });
});

describe('impact and feel events (CD M1 4)', () => {
  it('EnemyDamaged carries an impact tier; the hit flash is visible in the next view', () => {
    const h = ready(harness());
    const t = enemy(h, 'tank');
    weaponHit(h, t, 10);
    const ev = h.of(SimEventType.EnemyDamaged)[0];
    const e = h.ctx.world.enemies;
    const frac = (ev?.a ?? 0) / (e.maxHp[t] ?? 1);
    const tier = ((ev?.b ?? 0) >> DAMAGE_IMPACT_SHIFT) & 3;
    expect(tier).toBe(frac >= 0.5 ? 3 : frac >= 0.25 ? 2 : frac >= 0.1 ? 1 : 0);
    h.step();
    expect(h.sim.view.enemies.hitFlashTicks[t]).toBeGreaterThan(0);
  });

  it('knockback raises EnemyKnockedBack with the resisted distance; bulwark Unlit are immune', () => {
    const h = ready(tierC());
    const c = enemy(h, 'charger', 3, 0);
    knockEnemy(h.ctx, c, 0, 0, 1);
    h.drain();
    const kb = h.of(SimEventType.EnemyKnockedBack);
    const resist = h.data.enemies[idOf(h.data.enemies, 'charger')]?.kbResist ?? 0;
    expect(kb[0]?.a).toBeCloseTo(1 - resist, 9);
    expect(kb[0]?.b).toBeCloseTo(0, 9);
    const w = enemy(h, 'warden_bulwark', -3, 0);
    h.clearLog();
    knockEnemy(h.ctx, w, 0, 0, 1);
    h.drain();
    expect(h.of(SimEventType.EnemyKnockedBack)).toHaveLength(0);
    expect(h.ctx.world.enemies.kbTicks[w]).toBe(0);
  });

  it('the Rite raises RiteLanded where it lands, with the Unlit hit, and a hit stop', () => {
    const h = ready(harness());
    enemy(h, 'tank', 3, 0);
    h.input.aimX = 3 * 16;
    h.input.aimY = 0;
    h.input.pressed = Button.Rite;
    h.step();
    h.input.pressed = 0;
    expect(stepUntil(h, () => (keep(h), h.of(SimEventType.RiteLanded).length > 0), 120)).toBe(true);
    const ev = h.of(SimEventType.RiteLanded)[0];
    expect(ev?.x).toBeCloseTo(3, 6);
    expect(ev?.a).toBe(h.ctx.world.player.riteIndex);
    expect(ev?.c).toBe(1);
    expect(h.of(SimEventType.HitStop).some((e) => e.b === HitStopReason.RiteLanded)).toBe(true);
  });

  it('the Pulse end dissolves every living Unlit with EnemyDissolved at its position', () => {
    const h = ready(harness());
    enemy(h, 'tank', 3, 0);
    enemy(h, 'swarmer', -3, 1);
    h.send({ type: 'debug.endPulse' });
    h.step();
    const ev = h.of(SimEventType.EnemyDissolved);
    expect(ev).toHaveLength(2);
    expect(ev.map((e) => e.x).sort()).toEqual([-3, 3]);
  });

  it('Glint starts flying with GlintPulled and counts flyTicks until collected', () => {
    const h = ready(harness());
    dropGlint(h.ctx, 1.2, 0, 3);
    h.drain();
    h.step();
    expect(h.of(SimEventType.GlintPulled)).toHaveLength(1);
    const pk = h.ctx.world.pickups;
    expect(pk.flyTicks[0]).toBe(1);
    expect(h.sim.view.pickups.flyTicks?.[0]).toBe(1);
    expect(stepUntil(h, () => h.of(SimEventType.GlintCollected).length > 0, 30)).toBe(true);
  });

  it('a Warden kill raises a medium hit stop', () => {
    const h = harness();
    h.start();
    skipTo(h, 4);
    expect(stepUntil(h, () => (keep(h), h.ctx.run.wardenSlot >= 0), 2000)).toBe(true);
    h.send({ type: 'debug.endPulse' });
    h.step();
    expect(h.of(SimEventType.HitStop).some((e) => e.b === HitStopReason.WardenKilled)).toBe(true);
  });
});

describe('Warden affixes (GDD 15.2)', () => {
  it('veiled: shell of shell_frac x max HP absorbs first and regrows after regrow_s without damage', () => {
    const h = ready(tierC());
    const w = enemy(h, 'warden_choir', 6, 0);
    const e = h.ctx.world.enemies;
    const full = 0.2 * (e.maxHp[w] ?? 0);
    expect(e.shield[w]).toBeCloseTo(full, 9);
    const hp = e.hp[w] ?? 0;
    weaponHit(h, w, 10);
    expect(e.hp[w]).toBeCloseTo(hp, 9);
    expect(e.shield[w]).toBeCloseTo(full - 10, 9);
    const regrow = 6 * 60;
    stepKeep(h, regrow + 2);
    expect(e.shield[w]).toBeCloseTo(full, 9);
    expect(
      h.of(SimEventType.AffixTriggered).some((x) => x.b === AffixAction.ShellUp && x.c === 0),
    ).toBe(true);
  });

  it('blinking: telegraphs a spot min_dist from the player, then the Warden lands there', () => {
    const h = ready(tierC());
    enemy(h, 'warden_choir', 10, 0);
    expect(
      stepUntil(
        h,
        () => (keep(h), h.of(SimEventType.AffixTriggered).some((x) => x.b === AffixAction.Blink)),
        8 * 60,
      ),
    ).toBe(true);
    const blink = h.of(SimEventType.AffixTriggered).find((x) => x.b === AffixAction.Blink);
    const p = h.ctx.world.player;
    expect(Math.hypot((blink?.x ?? 0) - p.x, (blink?.y ?? 0) - p.y)).toBeCloseTo(3, 6);
  });

  it('bulwark adds guard and knockback immunity; brood summons motes; tar slows the player; pulsing telegraphs', () => {
    const h = ready(tierC());
    const w = enemy(h, 'warden_bulwark', 2, 0);
    const e = h.ctx.world.enemies;
    expect(e.guardAdd[w]).toBe(4);
    expect(e.kbImmune[w]).toBe(1);
    let slowed = false;
    for (let i = 0; i < 9 * 60; i++) {
      keep(h);
      h.step();
      if (h.ctx.run.playerSlowTicks > 0) slowed = true;
    }
    expect(slowed).toBe(true);
    const mote = idOf(h.data.enemies, 'mote');
    let motes = 0;
    for (let s = 0; s < e.highWater; s++)
      if (e.alive[s] === 1 && e.typeIndex[s] === mote && e.summonOwner[s] === w) motes++;
    expect(motes).toBe(3);
    const pulsing = encodeSource(SourceKind.Affix, idOf(h.data.affixes, 'pulsing'));
    const tele = h.of(SimEventType.TelegraphStarted).filter((x) => x.c === pulsing);
    expect(tele.length).toBeGreaterThan(0);
    expect(tele[0]?.b).toBeGreaterThanOrEqual(h.data.config.telegraphMinAreaTicks);
  });
});

describe('tier B and C Unlit (GDD 14.2, 15.1)', () => {
  it('exploder: fuse telegraph, blast hurts the player and other Unlit, then it is gone', () => {
    const h = ready(tierC());
    const x = enemy(h, 'exploder', 1.2, 0);
    expect(stepUntil(h, () => h.of(SimEventType.EnemyExploded).length > 0, 200)).toBe(true);
    const e = h.ctx.world.enemies;
    expect(e.alive[x]).toBe(0);
    const src = encodeSource(SourceKind.EnemyAttack, idOf(h.data.enemies, 'exploder'));
    const tele = h.of(SimEventType.TelegraphStarted).find((t) => t.c === src);
    expect(tele?.b).toBeGreaterThanOrEqual(h.data.config.telegraphMinAreaTicks);
    expect(h.of(SimEventType.PlayerDamaged).some((d) => d.c === src)).toBe(true);
    // Other Unlit in the blast take enemy_dmg, drop Glint, no on_kill (player kept invulnerable).
    const b = ready(tierC());
    enemy(b, 'exploder', 1.2, 0);
    const sw = enemy(b, 'swarmer', 1.2, 1);
    expect(stepUntil(b, () => (keep(b), b.of(SimEventType.EnemyExploded).length > 0), 200)).toBe(
      true,
    );
    expect(b.ctx.world.enemies.alive[sw]).toBe(0);
    expect(b.of(SimEventType.EnemyKilled).some((k) => k.c === src)).toBe(true);
  });

  it('exploder killed during its fuse does not blast', () => {
    const h = ready(tierC());
    const x = enemy(h, 'exploder', 1.2, 0);
    const e = h.ctx.world.enemies;
    expect(stepUntil(h, () => e.aiState[x] === AiState.Windup, 120)).toBe(true);
    h.ctx.world.enemies.hp[x] = 1;
    weaponHit(h, x, 50);
    stepKeep(h, 120);
    expect(h.of(SimEventType.EnemyExploded)).toHaveLength(0);
  });

  it('summoner keeps at most max_summons motes alive', () => {
    const h = ready(tierC());
    const s = enemy(h, 'summoner', 7, 0);
    const e = h.ctx.world.enemies;
    const mote = idOf(h.data.enemies, 'mote');
    const count = (): number => {
      let n = 0;
      for (let i = 0; i < e.highWater; i++)
        if (e.alive[i] === 1 && e.typeIndex[i] === mote && e.summonOwner[i] === s) n++;
      return n;
    };
    stepKeep(h, 5 * 60 + 60);
    expect(count()).toBe(3);
    stepKeep(h, 5 * 60);
    expect(count()).toBe(6);
    stepKeep(h, 10 * 60);
    expect(count()).toBe(6);
  });

  it('Warden choir fires a fan of fan_count after a cone telegraph; lobber and bulwark telegraph areas', () => {
    const h = ready(tierC());
    enemy(h, 'warden_choir', 6, 0);
    enemy(h, 'lobber', -7, 0);
    enemy(h, 'warden_bulwark', 0, 6);
    stepKeep(h, 6 * 60);
    const choir = encodeSource(SourceKind.EnemyAttack, idOf(h.data.enemies, 'warden_choir'));
    expect(
      h.of(SimEventType.TelegraphStarted).some((t) => t.c === choir && t.a === TelegraphKind.Cone),
    ).toBe(true);
    expect(h.of(SimEventType.EnemyProjectileFired).some((f) => f.c === choir && f.b === 5)).toBe(
      true,
    );
    const lob = encodeSource(SourceKind.EnemyAttack, idOf(h.data.enemies, 'lobber'));
    expect(h.of(SimEventType.TelegraphResolved).some((t) => t.c === lob)).toBe(true);
    const bul = encodeSource(SourceKind.EnemyAttack, idOf(h.data.enemies, 'warden_bulwark'));
    expect(
      h.of(SimEventType.TelegraphStarted).some((t) => t.c === bul && t.a === TelegraphKind.Area),
    ).toBe(true);
  });
});

/** Boss Pulse with the boss emerged; bossId overrides the boss type before it emerges. */
function bossFight(h: Harness, bossId?: string): number {
  h.start();
  skipTo(h, 9);
  if (bossId !== undefined) h.ctx.run.bossType = idOf(h.data.enemies, bossId);
  expect(stepUntil(h, () => (keep(h), h.ctx.run.bossSlot >= 0), 600)).toBe(true);
  return h.ctx.run.bossSlot;
}

/** Force the boss to start cycle position pos now. Returns the tick it started. */
function forcePattern(h: Harness, pos: number): number {
  const run = h.ctx.run;
  run.bossPatternIndex = -1;
  run.bossPatternTicks = 0;
  run.bossGapTicks = 0;
  run.bossCyclePos = pos;
  h.ctx.events.clear();
  h.clearLog();
  keep(h);
  h.step();
  return h.sim.view.tick;
}

describe('Paper Sun patterns (GDD 16.1)', () => {
  it('Ember Rain: first circle on the player, others inside spread; all telegraphed 1 s first', () => {
    const h = harness();
    bossFight(h);
    const p = h.ctx.world.player;
    const px = p.x;
    const py = p.y;
    forcePattern(h, 0);
    const tele = h.of(SimEventType.TelegraphStarted).filter((t) => t.a === TelegraphKind.BossArea);
    expect(tele).toHaveLength(5);
    expect(tele[0]?.x).toBeCloseTo(px, 9);
    expect(tele[0]?.y).toBeCloseTo(py, 9);
    for (const t of tele) {
      expect(Math.hypot(t.x - px, t.y - py)).toBeLessThanOrEqual(3 + 1e-9);
      expect(t.b).toBeGreaterThanOrEqual(h.data.config.telegraphMinBossTicks);
    }
    expect(h.of(SimEventType.BossPatternStarted)[0]?.a).toBe(
      idOf(h.data.bossPatterns, 'ember_rain_5'),
    );
  });

  it('Moth Call: the spawn mark starts so it ends with the 1 s telegraph', () => {
    const h = harness();
    bossFight(h);
    const t0 = forcePattern(h, 3);
    expect(stepUntil(h, () => (keep(h), h.of(SimEventType.BossSummoned).length > 0), 120)).toBe(
      true,
    );
    const mark = h
      .of(SimEventType.SpawnMarked)
      .find((m) => m.a === idOf(h.data.enemies, 'swarmer') && m.tick > t0);
    const tele = h.data.config.telegraphMinBossTicks;
    expect(mark).toBeDefined();
    expect((mark?.tick ?? 0) - t0 + (mark?.b ?? 0)).toBe(tele);
  });
});

describe('tier C boss pattern archetypes', () => {
  const vine = (): { h: Harness; s: number } => {
    const h = tierC();
    const s = bossFight(h, 'boss_vine');
    return { h, s };
  };
  const pat = (h: Harness, id: string): number =>
    encodeSource(SourceKind.BossPattern, idOf(h.data.bossPatterns, id));

  it('spiral: core telegraph, then arms x rate x duration shots', () => {
    const { h } = vine();
    forcePattern(h, 0);
    const src = pat(h, 'spiral_t');
    expect(
      h
        .of(SimEventType.TelegraphStarted)
        .some((t) => t.c === src && t.a === TelegraphKind.Projectile),
    ).toBe(true);
    stepKeep(h, 60 + 3 * 60 + 5);
    const shots = h
      .of(SimEventType.EnemyProjectileFired)
      .filter((f) => f.c === src)
      .reduce((n, f) => n + f.b, 0);
    expect(shots).toBe(2 * 10 * 3);
    expect(h.of(SimEventType.EnemyProjectileFired).find((f) => f.c === src)?.tick).toBeGreaterThan(
      h.of(SimEventType.TelegraphStarted).find((t) => t.c === src)?.tick ?? 0,
    );
  });

  it('blink_slam: strike circle at the player, the boss lands there when it resolves', () => {
    const { h, s } = vine();
    const p = h.ctx.world.player;
    forcePattern(h, 1);
    const tele = h.of(SimEventType.TelegraphStarted).find((t) => t.c === pat(h, 'blink_t'));
    expect(tele?.x).toBeCloseTo(p.x, 6);
    stepKeep(h, 62);
    const e = h.ctx.world.enemies;
    expect(e.x[s]).toBeCloseTo(tele?.x ?? NaN, 6);
    expect(e.y[s]).toBeCloseTo(tele?.y ?? NaN, 6);
  });

  it('lines: count strike lines from the boss to the arena edge; combo adds a thorn fan', () => {
    const { h } = vine();
    forcePattern(h, 2);
    const da = h.ctx.world.dangerAreas;
    const arena = h.ctx.arena;
    let lines = 0;
    for (let i = 0; i < da.highWater; i++) {
      if (da.alive[i] !== 1 || da.sourceRef[i] !== pat(h, 'lines_t')) continue;
      expect(da.shape[i]).toBe(AreaShape.Line);
      expect(da.mode[i]).toBe(DangerMode.Strike);
      if (arena !== null)
        expect(Math.abs(insideDistance(arena, da.x2[i] ?? 0, da.y2[i] ?? 0))).toBeLessThan(1e-3);
      lines++;
    }
    expect(lines).toBe(3);
    stepKeep(h, 200);
    forcePattern(h, 5);
    const combo = h.of(SimEventType.TelegraphStarted).filter((t) => t.c === pat(h, 'combo_t'));
    expect(combo.filter((t) => t.a === TelegraphKind.Lane)).toHaveLength(5);
    expect(combo.filter((t) => t.a === TelegraphKind.Cone)).toHaveLength(1);
  });

  it('cone: each repeat has its own telegraph (charge minimum) and fires count shots', () => {
    const { h } = vine();
    forcePattern(h, 3);
    stepKeep(h, 140);
    const src = pat(h, 'cone_t');
    const tele = h.of(SimEventType.TelegraphStarted).filter((t) => t.c === src);
    expect(tele).toHaveLength(2);
    for (const t of tele) expect(t.b).toBeGreaterThanOrEqual(h.data.config.telegraphMinChargeTicks);
    const fired = h.of(SimEventType.EnemyProjectileFired).filter((f) => f.c === src);
    expect(fired.map((f) => f.b)).toEqual([9, 9]);
  });

  it('charge_lane: lane telegraph, then the boss charges and hits the player once', () => {
    const { h, s } = vine();
    const e = h.ctx.world.enemies;
    const x0 = e.x[s] ?? 0;
    const y0 = e.y[s] ?? 0;
    forcePattern(h, 4);
    const src = pat(h, 'charge_t');
    expect(
      h.of(SimEventType.TelegraphStarted).some((t) => t.c === src && t.a === TelegraphKind.Charge),
    ).toBe(true);
    // The player keeps HP but not invulnerability: the charge must land.
    for (let i = 0; i < 160; i++) {
      keep(h, false);
      h.step();
    }
    expect(Math.hypot((e.x[s] ?? 0) - x0, (e.y[s] ?? 0) - y0)).toBeGreaterThan(1);
    expect(h.of(SimEventType.PlayerDamaged).filter((d) => d.c === src)).toHaveLength(1);
  });
});

describe('weapons: Orbit lunge and Tithe Coin (GDD 6.2, 4.1)', () => {
  it('Orbit Shards IV lunge out by lunge_dist every lunge_every_s and come back', () => {
    const h = ready(harness());
    h.send({ type: 'debug.grant', kind: 'weapon', id: 'orbit_shards', tier: 4 });
    h.step();
    const ps = h.ctx.world.playerShots;
    const p = h.ctx.world.player;
    let max = 0;
    for (let t = 0; t < 5 * 60; t++) {
      keep(h);
      h.step();
      for (let i = 0; i < ps.highWater; i++)
        if (ps.alive[i] === 1)
          max = Math.max(max, Math.hypot((ps.x[i] ?? 0) - p.x, (ps.y[i] ?? 0) - p.y));
    }
    const area = 1 + (h.ctx.world.player.stats[stat(h, 'area_pct')] ?? 0) / 100;
    const base = 1.8 * area;
    expect(max).toBeGreaterThan(base + 3.5);
    expect(max).toBeLessThanOrEqual(base + 4 + 1e-6);
    const orbit = idOf(h.data.weapons, 'orbit_shards');
    expect(h.of(SimEventType.WeaponFired).some((f) => f.a === orbit)).toBe(true);
  });

  it('Tithe Coin kills drop Glint up to the per-Pulse cap; tier IV coins bounce once', () => {
    const h = ready(tierC());
    h.send({ type: 'debug.grant', kind: 'weapon', id: 'tithe_coin', tier: 1 });
    h.step();
    for (let k = 0; k < 14; k++) enemy(h, 'swarmer', 2 + (k % 4), -3 + Math.floor(k / 4) * 2);
    stepKeep(h, 20 * 60);
    expect(h.ctx.run.coinGlint[0]).toBe(10);

    const b = ready(tierC());
    b.send({ type: 'debug.grant', kind: 'weapon', id: 'tithe_coin', tier: 4 });
    b.step();
    enemy(b, 'tank', 3, 0);
    enemy(b, 'tank', 3, 2.5);
    const ps = b.ctx.world.playerShots;
    let bounced = false;
    for (let t = 0; t < 120 && !bounced; t++) {
      keep(b);
      b.step();
      for (let i = 0; i < ps.highWater; i++)
        if (
          ps.alive[i] === 1 &&
          ps.weaponIndex[i] === idOf(b.data.weapons, 'tithe_coin') &&
          ps.bounceLeft[i] === 0 &&
          ps.hitCount[i] === 1
        )
          bounced = true;
    }
    expect(bounced).toBe(true);
  });
});

describe('determinism with tier B and C content (K17)', () => {
  it('two sims with the same seed and commands hash the same while affixes, behaviors, and the boss run', () => {
    const data = simFixtureData('C');
    const run = (): number[] => {
      const sim = createSim({ data, debugCommands: true });
      const input = createInputFrame();
      const out: number[] = [];
      sim.enqueue({
        type: 'run.start',
        seed: 99,
        classId: 'lantern',
        profile: 'run_a',
        difficulty: 0,
      });
      sim.step(input);
      for (const [id, x, y] of [
        ['warden_bulwark', 6, 3],
        ['warden_choir', -6, -3],
        ['exploder', 4, -4],
        ['summoner', -8, 5],
        ['lobber', 8, -6],
      ] as const)
        sim.enqueue({ type: 'debug.spawn', enemyId: id, x, y, count: 1 });
      for (let t = 0; t < 1200; t++) {
        sim.enqueue({ type: 'debug.setHp', hp: 999 });
        input.moveX = t % 120 < 60 ? 127 : -127;
        sim.step(input);
        if (t % 60 === 0) out.push(sim.hash());
      }
      return out;
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(new Set(a).size).toBeGreaterThan(10);
  });
});
