// QA M3 content regression on the real build data (content tier B, run_b): test-plan 6.4 B-7 and
// 13.3 M3-02, plus unlock pools, Warden affixes, boss patterns, synergy thresholds, and run_b
// determinism (D-1, D-2, D-4) for every class. Real data: ids and rules are read from GameData, no
// balance numbers are copied (test-plan 1.3). Summary lines are printed for docs/qa/M3-report.md.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OfferKind,
  SimEventType,
  SourceKind,
  TICK_RATE,
  createInputFrame,
  encodeSource,
  toHex8,
} from '../../../src/core/index.ts';
import type { Command, Sim } from '../../../src/core/index.ts';
import { defaultRunProfile, isMementoOpen, isWeaponOpen } from '../../../src/content/index.ts';
import { createSim, playReplay } from '../../../src/sim/index.ts';
import { botCommands, botInput } from '../sim/support/bot.ts';
import { runQaBot } from './support/qa-bot.ts';
import type { QaBotKind } from './support/qa-bot.ts';
import { arenaBounds, realGameData } from './support/real-data.ts';
import { recordBotRun } from './support/record.ts';

const data = realGameData();
const PROFILE = defaultRunProfile(data);
const ALL_UNLOCKS = data.metaUnlocks.map((u) => u.id);
const CLASSES = data.classes.map((c) => c.id);
/** 15 Pulses, untimed boss, shops: 45 min of game time is a safe upper bound. */
const MAX_TICKS = TICK_RATE * 60 * 45;
const boundsFor = (i: number) => arenaBounds(data, i);
const ROOT = resolve(import.meta.dirname, '../../..');
const CLI = resolve(import.meta.dirname, 'support/sim-cli.ts');
const OUT = resolve(ROOT, 'tests/out/qa');

/** Everything a run showed, by id. */
interface Seen {
  enemies: Set<string>;
  wardensKilled: Set<string>;
  bossesKilled: Set<string>;
  bossPhases: Set<number>;
  patterns: Set<string>;
  affixes: Set<string>;
  affixTriggers: Set<string>;
  synergies: Set<string>;
  offers: Set<string>;
  rewardChoices: Set<string>;
  bought: Set<string>;
  weaponsFired: Set<string>;
  rites: Set<string>;
  telegraphs: number;
}

function newSeen(): Seen {
  return {
    enemies: new Set(),
    wardensKilled: new Set(),
    bossesKilled: new Set(),
    bossPhases: new Set(),
    patterns: new Set(),
    affixes: new Set(),
    affixTriggers: new Set(),
    synergies: new Set(),
    offers: new Set(),
    rewardChoices: new Set(),
    bought: new Set(),
    weaponsFired: new Set(),
    rites: new Set(),
    telegraphs: 0,
  };
}

function itemId(kind: number, defIndex: number): string {
  if (kind === OfferKind.Weapon) return `weapon:${data.weapons[defIndex]?.id ?? defIndex}`;
  if (kind === OfferKind.Memento) return `memento:${data.mementos[defIndex]?.id ?? defIndex}`;
  return `other:${kind}`;
}

/** Collect events of the last step and the visible offers into seen. */
function observe(sim: Sim, seen: Seen): void {
  const ev = sim.events;
  for (let i = 0; i < ev.count; i++) {
    const t = ev.type[i];
    const a = ev.a[i] ?? 0;
    const b = ev.b[i] ?? 0;
    switch (t) {
      case SimEventType.EnemySpawned:
        seen.enemies.add(data.enemies[a]?.id ?? String(a));
        break;
      case SimEventType.WardenKilled:
        seen.wardensKilled.add(data.enemies[a]?.id ?? String(a));
        break;
      case SimEventType.BossKilled:
        seen.bossesKilled.add(data.enemies[a]?.id ?? String(a));
        break;
      case SimEventType.BossPhaseChanged:
        seen.bossPhases.add(a);
        break;
      case SimEventType.BossPatternStarted:
        seen.patterns.add(data.bossPatterns[a]?.id ?? String(a));
        break;
      case SimEventType.AffixApplied:
        seen.affixes.add(data.affixes[a]?.id ?? String(a));
        break;
      case SimEventType.AffixTriggered:
        seen.affixTriggers.add(data.affixes[a]?.id ?? String(a));
        break;
      case SimEventType.SynergyActivated:
        seen.synergies.add(`${data.tags[a]?.id ?? a}:${b}`);
        break;
      case SimEventType.ItemBought:
        seen.bought.add(itemId(a, b));
        break;
      case SimEventType.WeaponFired:
        seen.weaponsFired.add(data.weapons[a]?.id ?? String(a));
        break;
      case SimEventType.RiteCast:
        seen.rites.add(data.rites[a]?.id ?? String(a));
        break;
      case SimEventType.TelegraphStarted:
        seen.telegraphs++;
        break;
      default:
        break;
    }
  }
  const v = sim.view;
  if (v.phase === 'shop')
    for (const o of v.shop.offers)
      if (o.kind === OfferKind.Weapon || o.kind === OfferKind.Memento)
        seen.offers.add(itemId(o.kind, o.defIndex));
  if (v.phase === 'reward')
    for (const c of v.reward.choices)
      seen.rewardChoices.add(`memento:${data.mementos[c.mementoIndex]?.id ?? c.mementoIndex}`);
}

/**
 * Coverage run: QA dodgerRandom choices and GP's dodger movement, HP kept full by debug commands so
 * every Pulse, both Wardens, and the boss are reached. Rite pressed every 4 s during Pulses.
 */
function coverageRun(
  classId: string,
  seed: number,
  unlocked: readonly string[],
  seen: Seen,
  difficulty = 0,
): {
  phase: string;
  pulses: number;
  silt: number;
  ticks: number;
  overtime: boolean;
  where: string;
} {
  const sim = createSim({ data, debugCommands: true });
  const input = createInputFrame();
  const cmds: Command[] = [];
  let overtime = false;
  // Reuse the QA bot's shop and card logic through runQaBot's observe hook would not keep HP full,
  // so this loop mirrors it: debug.setHp in Pulses, QA-style random affordable buys elsewhere.
  let rnd = seed * 2654435761;
  const next = (): number => {
    rnd = (Math.imul(rnd ^ (rnd >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return rnd / 4294967296;
  };
  sim.enqueue({ type: 'run.start', seed, classId, profile: PROFILE, difficulty, unlocked });
  sim.step(input);
  observe(sim, seen);
  let t = 0;
  for (; t < MAX_TICKS; t++) {
    const v = sim.view;
    if (v.phase === 'victory' || v.phase === 'defeat') break;
    if (v.phase === 'pulse') {
      if (v.pulse.overtime) overtime = true;
      sim.enqueue({ type: 'debug.setHp', hp: v.player.maxHp });
      botInput(v, input);
      input.pressed = t % 240 === 0 ? 1 : 0;
      if (v.pulse.boss.active || v.pulse.overtime) {
        // Stay near the boss (same as QA B-1b), or the Warden in overtime: GP's dodger flees from the
        // only foe left, so short-range classes never end overtime when HP is kept full.
        const e = v.enemies;
        for (let i = 0; i < e.highWater; i++) {
          if (e.alive[i] !== 1 || (e.rank[i] ?? 0) < 1) continue;
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
      if (v.phase === 'shop') {
        const ok: number[] = [];
        v.shop.offers.forEach((o, i) => {
          if (o.kind !== OfferKind.Weapon && o.kind !== OfferKind.Memento) return;
          if (o.affordable && !o.blockedNoSlot) ok.push(i);
        });
        if (ok.length > 0)
          sim.enqueue({ type: 'shop.buy', offer: ok[Math.floor(next() * ok.length)] ?? 0 });
        else if (next() < 0.5 && v.player.glint >= v.shop.rerollPrice)
          sim.enqueue({ type: 'shop.reroll' });
        else sim.enqueue({ type: 'pulse.begin' });
      } else {
        botCommands(v, cmds);
        for (const c of cmds) {
          if (c.type === 'reward.pick')
            sim.enqueue({
              type: 'reward.pick',
              choice: Math.floor(next() * Math.max(1, v.reward.choices.length)),
            });
          else if (c.type === 'levelup.pick')
            sim.enqueue({
              type: 'levelup.pick',
              choice: Math.floor(next() * Math.max(1, v.levelUp.choices.length)),
            });
          else sim.enqueue(c);
        }
      }
    }
    sim.step(input);
    observe(sim, seen);
  }
  const v = sim.view;
  const where = `pulse ${v.pulse.index + 1} kind ${v.pulse.kind} left ${v.pulse.ticksLeft} overtime ${String(v.pulse.overtime)} warden ${String(v.pulse.warden.active)} ${v.pulse.warden.hp.toFixed(0)}/${v.pulse.warden.maxHp.toFixed(0)} boss ${String(v.pulse.boss.active)} ${v.pulse.boss.hp.toFixed(0)}/${v.pulse.boss.maxHp.toFixed(0)} phase ${v.pulse.boss.phase} enemies ${countAlive(v.enemies)} player ${v.player.x.toFixed(1)},${v.player.y.toFixed(1)}`;
  return {
    phase: v.phase,
    pulses: v.runStats.pulsesCleared,
    silt: v.runStats.silt,
    ticks: t,
    overtime,
    where,
  };
}

function countAlive(pool: { highWater: number; alive: ArrayLike<number> }): number {
  let n = 0;
  for (let i = 0; i < pool.highWater; i++) if (pool.alive[i] !== 0) n++;
  return n;
}

const fmt = (s: Set<string> | Set<number>): string => [...s].map(String).sort().join(' ');

describe('QA M3: content tier B on real data', () => {
  it('build is content tier B with run_b as the default profile', () => {
    expect(data.meta.contentTier).toBe('B');
    expect(PROFILE).toBe('run_b');
    expect(CLASSES.length).toBe(3);
  });

  it('B-7: class x run_b, 5 seeds of dodgerRandom (no unlocks and all unlocks) finish with no invariant violations', () => {
    const rows: string[] = [];
    for (const classId of CLASSES) {
      for (const unlocked of [[], ALL_UNLOCKS] as const) {
        for (let seed = 1; seed <= 5; seed++) {
          const r = runQaBot(
            createSim({ data }),
            { seed, classId, profile: PROFILE, unlocked },
            'dodgerRandom' satisfies QaBotKind,
            MAX_TICKS,
            boundsFor,
          );
          rows.push(
            `${classId.padEnd(8)} unlocks ${String(unlocked.length)} seed ${seed} ${r.outcome.padEnd(7)} pulses ${String(r.pulsesCleared).padStart(2)} buys ${r.purchases}`,
          );
          expect(r.outcome, `${classId} seed ${seed}`).not.toBe('timeout');
          expect(r.violations, `${classId} seed ${seed}`).toEqual([]);
        }
      }
    }
    console.log(`[QA M3 B-7] ${PROFILE}\n${rows.join('\n')}`);
  }, 180_000);

  it('B-6: build variety, 50 dodgerRandom runs (all unlocks, classes in turn): no tag dominant in more than 40% of runs', () => {
    const tally = new Map<string, number>();
    let ended = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const classId = CLASSES[seed % CLASSES.length] ?? '';
      let tags: number[] = [];
      const r = runQaBot(
        createSim({ data }),
        { seed: 1000 + seed, classId, profile: PROFILE, unlocked: ALL_UNLOCKS },
        'dodgerRandom',
        MAX_TICKS,
        boundsFor,
        (sim) => {
          if (sim.view.phase === 'shop') tags = Array.from(sim.view.shop.tagCounts);
        },
      );
      if (r.outcome !== 'timeout') ended++;
      // Dominant tag: highest count at the last shop (ties: first in data order); none if all zero.
      const best = Math.max(0, ...tags);
      const id = best === 0 ? 'none' : (data.tags[tags.indexOf(best)]?.id ?? '?');
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    console.log(
      `[QA M3 B-6] dominant tag at the last shop over 50 runs: ${rows.map(([k, v]) => `${k} ${v}`).join(', ')}`,
    );
    expect(ended).toBe(50);
    for (const [k, v] of rows)
      if (k !== 'none') expect(v / 50, `tag ${k}`).toBeLessThanOrEqual(0.4);
  }, 180_000);

  it('M3-02: every tier B enemy, Warden, boss pattern, rite, and item can appear in run_b (HP kept full, all unlocks)', () => {
    const seen = newSeen();
    const rows: string[] = [];
    for (const classId of CLASSES) {
      for (const seed of [11, 12, 13]) {
        const r = coverageRun(classId, seed, ALL_UNLOCKS, seen);
        rows.push(
          `${classId.padEnd(8)} seed ${seed} ${r.phase} pulses ${r.pulses} silt ${r.silt} ticks ${r.ticks} overtime ${String(r.overtime)}`,
        );
        expect(r.phase, `${classId} seed ${seed}: ${r.where}`).toBe('victory');
        expect(r.pulses).toBe(data.profiles[PROFILE]?.length);
        expect(r.silt, 'a won run gives Silt').toBeGreaterThan(0);
      }
    }
    const slots = data.profiles[PROFILE] ?? [];
    const wantEnemies = new Set<string>();
    for (const s of slots) for (const sp of s.spawns) wantEnemies.add(sp.enemyId);
    const wardens = new Set(slots.flatMap((s) => (s.wardenId === null ? [] : [s.wardenId])));
    const bosses = new Set(slots.flatMap((s) => (s.bossId === null ? [] : [s.bossId])));
    for (const w of wardens) wantEnemies.add(w);
    for (const b of bosses) wantEnemies.add(b);
    // Summons (summon_id params) count as content too.
    for (const e of data.enemies) {
      const id = (e.params as Record<string, unknown>)['summon_id'];
      if (typeof id === 'string' && wantEnemies.has(e.id)) wantEnemies.add(id);
    }
    const wardenAffixes = new Set(
      data.enemies.filter((e) => wardens.has(e.id)).flatMap((e) => e.affixes),
    );
    const patterns = new Set(
      data.bossPhases.filter((p) => bosses.has(p.bossId)).flatMap((p) => p.cycle),
    );
    console.log(
      [
        `[QA M3-02 coverage] ${PROFILE}, contentHash ${data.meta.contentHash}`,
        ...rows,
        `enemies spawned: ${fmt(seen.enemies)} (want ${fmt(wantEnemies)})`,
        `wardens killed: ${fmt(seen.wardensKilled)}; bosses killed: ${fmt(seen.bossesKilled)}; boss phases: ${fmt(seen.bossPhases)}`,
        `boss patterns: ${fmt(seen.patterns)} (want ${fmt(patterns)})`,
        `affixes applied: ${fmt(seen.affixes)}; triggered: ${fmt(seen.affixTriggers)} (Warden affixes in data: ${fmt(wardenAffixes)})`,
        `rites cast: ${fmt(seen.rites)}; weapons fired: ${fmt(seen.weaponsFired)}`,
        `synergies: ${seen.synergies.size} of ${data.synergies.length}: ${fmt(seen.synergies)}`,
        `offers: ${seen.offers.size}; reward choices: ${seen.rewardChoices.size}; bought: ${seen.bought.size}; telegraphs ${seen.telegraphs}`,
      ].join('\n'),
    );
    for (const id of wantEnemies) expect(seen.enemies, `enemy ${id} spawned`).toContain(id);
    for (const id of wardens) expect(seen.wardensKilled, `Warden ${id} killed`).toContain(id);
    for (const id of bosses) expect(seen.bossesKilled, `boss ${id} killed`).toContain(id);
    for (const id of patterns) expect(seen.patterns, `boss pattern ${id}`).toContain(id);
    for (const id of wardenAffixes) expect(seen.affixes, `affix ${id} applied`).toContain(id);
    for (const c of data.classes) expect(seen.rites, `rite ${c.riteId}`).toContain(c.riteId);
    // Every weapon and Memento shows up in a shop or a Warden chest at least once.
    const offered = new Set([...seen.offers, ...seen.rewardChoices]);
    for (const w of data.weapons)
      if (!data.classes.some((c) => c.startWeapon === w.id))
        expect(offered, `weapon ${w.id} offered`).toContain(`weapon:${w.id}`);
    for (const m of data.mementos)
      expect(offered, `memento ${m.id} offered`).toContain(`memento:${m.id}`);
  }, 180_000);

  it('Warden affixes outside the Warden tables: overtime haste and the Crack random pool run without errors', () => {
    // hasted only comes in overtime; random_pool affixes only from Crack levels (tiers A and B ship
    // Crack 0). Crack 2 adds one random affix to each Warden: run seeds until every pool affix appeared.
    const seen = newSeen();
    const rows: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const r = coverageRun(CLASSES[seed % CLASSES.length] ?? '', seed, ALL_UNLOCKS, seen, 2);
      rows.push(`crack 2 seed ${seed}: ${r.phase}, overtime ${String(r.overtime)}`);
      expect(
        r.phase === 'victory' || r.phase === 'defeat',
        `crack 2 seed ${seed}: ${r.where}`,
      ).toBe(true);
    }
    const pool = data.affixes.filter((a) => a.randomPool).map((a) => a.id);
    console.log(
      `[QA M3 affixes] ${rows.join('; ')}\napplied ${fmt(seen.affixes)}; triggered ${fmt(seen.affixTriggers)}; random pool ${pool.join(' ')}`,
    );
    for (const id of pool) expect(seen.affixes, `pool affix ${id}`).toContain(id);
  }, 180_000);

  it('unlocks: locked weapons and Memento packs never appear without their unlock, and do with it', () => {
    const locked = [
      ...data.weapons.filter((w) => !isWeaponOpen(data, [], w.id)).map((w) => `weapon:${w.id}`),
      ...data.mementos.filter((m) => !isMementoOpen(data, [], m.id)).map((m) => `memento:${m.id}`),
    ];
    expect(locked.length).toBeGreaterThan(0);
    const none = newSeen();
    const all = newSeen();
    for (const seed of [21, 22, 23, 24]) {
      coverageRun('lantern', seed, [], none);
      coverageRun('lantern', seed, ALL_UNLOCKS, all);
    }
    const offeredNone = new Set([...none.offers, ...none.rewardChoices]);
    const offeredAll = new Set([...all.offers, ...all.rewardChoices]);
    console.log(
      `[QA M3 unlocks] locked without unlocks: ${locked.join(' ')}\nseen with all unlocks: ${locked.filter((l) => offeredAll.has(l)).join(' ')}`,
    );
    for (const id of locked) {
      expect(offeredNone, `${id} offered without its unlock`).not.toContain(id);
      expect(offeredAll, `${id} offered with all unlocks`).toContain(id);
    }
  }, 180_000);

  describe('M3-02: each weapon and Memento acts within 5 s of the next Pulse (P4-d proxy)', () => {
    /** Run to the first shop, optionally grant an item there, then 5 s of Pulse 2 on scripted input. */
    function trial(
      grant: { kind: 'weapon' | 'memento'; id: string } | null,
      seconds = 5,
      dense = false,
    ): {
      fingerprint: string;
      fired: number;
      damage: number;
      procs: number;
      shopPrices: string;
    } {
      const sim = createSim({ data, debugCommands: true });
      const input = createInputFrame();
      sim.enqueue({
        type: 'run.start',
        seed: 7,
        classId: 'lantern',
        profile: PROFILE,
        difficulty: 0,
        unlocked: ALL_UNLOCKS,
      });
      sim.step(input);
      sim.enqueue({ type: 'debug.endPulse' });
      for (let g = 0; g < 2000 && sim.view.phase !== 'shop'; g++) {
        const v = sim.view;
        if (v.phase === 'reward') sim.enqueue({ type: 'reward.pick', choice: 0 });
        if (v.phase === 'levelUp') sim.enqueue({ type: 'levelup.pick', choice: 0 });
        sim.step(input);
      }
      expect(sim.view.phase).toBe('shop');
      sim.enqueue({ type: 'debug.glint', amount: 500 });
      sim.step(input);
      if (dense) {
        // Dense trial: two extra fast projectile weapons at top tier, same for baseline and item.
        for (const w of ['splinter_shot', 'chain_spark']) {
          if (data.weapons.some((x) => x.id === w))
            sim.enqueue({ type: 'debug.grant', kind: 'weapon', id: w, tier: 4 });
          sim.step(input);
        }
      }
      if (grant !== null) {
        sim.enqueue({ type: 'debug.grant', kind: grant.kind, id: grant.id, tier: 1 });
        sim.step(input);
      }
      sim.enqueue({ type: 'shop.reroll' });
      sim.step(input);
      const shopPrices = `${sim.view.shop.rerollPrice}|${sim.view.shop.offers.map((o) => o.price).join(',')}`;
      sim.enqueue({ type: 'pulse.begin' });
      sim.step(input);
      sim.enqueue({ type: 'debug.setHp', hp: Math.floor(sim.view.player.maxHp / 2) });
      // Fixed targets around the player so every trial has the same contacts: a ring of the
      // toughest normal Unlit at orbit range and a group of the weakest at shooting range.
      const normals = data.enemies.filter(
        (e) => e.role !== 'warden' && e.role !== 'boss' && e.role !== 'mote',
      );
      const tough = [...normals].sort((x, y) => y.hp - x.hp)[0]?.id ?? '';
      const weak = [...normals].sort((x, y) => x.hp - y.hp)[0]?.id ?? '';
      const px = sim.view.player.x;
      const py = sim.view.player.y;
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2;
        sim.enqueue({
          type: 'debug.spawn',
          enemyId: tough,
          x: px + Math.cos(ang) * 1.6,
          y: py + Math.sin(ang) * 1.6,
          count: 1,
        });
      }
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2 + 0.3;
        sim.enqueue({
          type: 'debug.spawn',
          enemyId: weak,
          x: px + Math.cos(ang) * 4,
          y: py + Math.sin(ang) * 3,
          count: 1,
        });
      }
      const widx = grant?.kind === 'weapon' ? data.index.weapon(grant.id) : -1;
      const owned = new Set(
        grant?.kind === 'memento' ? (data.effectsByOwner[grant.id] ?? []).map(Number) : [],
      );
      let fired = 0;
      let damage = 0;
      let procs = 0;
      let dmgSum = 0;
      let kills = 0;
      let heals = 0;
      let barrier = 0;
      let glint = 0;
      let status = 0;
      input.moveX = 0;
      input.moveY = 0;
      for (let t = 0; t < seconds * TICK_RATE; t++) {
        // Stand still (orbit and aura weapons need contact); Rite every 2 s (on_rite Mementos).
        // Dense: walk a slow circle to collect Glint, and add a ring of weak Unlit every 2 s.
        input.pressed = t % 120 === 30 ? 1 : 0;
        if (dense) {
          const ang = (t / (6 * TICK_RATE)) * Math.PI * 2;
          input.moveX = Math.round(Math.cos(ang) * 90);
          input.moveY = Math.round(Math.sin(ang) * 90);
          if (t % 120 === 0) {
            const qx = sim.view.player.x;
            const qy = sim.view.player.y;
            for (let k = 0; k < 8; k++) {
              const a2 = (k / 8) * Math.PI * 2;
              sim.enqueue({
                type: 'debug.spawn',
                enemyId: weak,
                x: qx + Math.cos(a2) * 3,
                y: qy + Math.sin(a2) * 2.5,
                count: 1,
              });
            }
          }
        }
        sim.step(input);
        const ev = sim.events;
        for (let i = 0; i < ev.count; i++) {
          const type = ev.type[i];
          const a = ev.a[i] ?? 0;
          if (type === SimEventType.WeaponFired && a === widx) fired++;
          if (type === SimEventType.EnemyDamaged) {
            dmgSum += a;
            if (widx >= 0 && ev.c[i] === encodeSource(SourceKind.Weapon, widx)) damage++;
          }
          if (type === SimEventType.ProcTriggered && owned.has(a)) procs++;
          if (type === SimEventType.EnemyKilled) kills++;
          if (type === SimEventType.PlayerHealed) heals += a;
          if (type === SimEventType.BarrierGained) barrier++;
          if (type === SimEventType.GlintCollected) glint += a;
        }
        const e = sim.view.enemies;
        for (let i = 0; i < e.highWater; i++) if (e.alive[i] === 1) status += e.statusMask[i] ?? 0;
      }
      const v = sim.view;
      const fingerprint = JSON.stringify({
        dmg: dmgSum.toFixed(3),
        kills,
        heals: heals.toFixed(3),
        barrier,
        glint,
        status,
        hp: v.player.hp.toFixed(3),
        wallet: v.player.glint,
        stats: Array.from(v.player.stats).map((x) => x.toFixed(4)),
        shopPrices,
      });
      return { fingerprint, fired, damage, procs, shopPrices };
    }

    const base = (() => {
      let cached: ReturnType<typeof trial> | null = null;
      return () => (cached ??= trial(null));
    })();

    it('weapons: each fires and deals damage in the first 5 s', () => {
      const rows: string[] = [];
      for (const w of data.weapons) {
        const r = trial({ kind: 'weapon', id: w.id });
        rows.push(`${w.id.padEnd(17)} fired ${String(r.fired).padStart(3)} hits ${r.damage}`);
        expect(r.fired + r.damage, `weapon ${w.id}`).toBeGreaterThan(0);
      }
      console.log(`[QA M3-02 weapons]\n${rows.join('\n')}`);
    });

    it('Mementos: each changes the run (proc, stats, damage, sustain, economy, or shop prices)', () => {
      const diffOf = (fp: string, ref: string): string[] => {
        const r0 = JSON.parse(ref) as Record<string, unknown>;
        return Object.entries(JSON.parse(fp) as Record<string, unknown>)
          .filter(([k, val]) => JSON.stringify(val) !== JSON.stringify(r0[k]))
          .map(([k]) => k);
      };
      const b = base();
      const b20 = trial(null, 20, true);
      const rows: string[] = [];
      const silent5: string[] = [];
      const silent20: string[] = [];
      for (const m of data.mementos) {
        const r = trial({ kind: 'memento', id: m.id });
        const diff = diffOf(r.fingerprint, b.fingerprint);
        let note = '';
        if (diff.length === 0 && r.procs === 0) {
          // Not visible in 5 s (chance or condition based): prove it works in a dense 20 s trial.
          silent5.push(m.id);
          const r20 = trial({ kind: 'memento', id: m.id }, 20, true);
          const d20 = diffOf(r20.fingerprint, b20.fingerprint);
          note = ` | 20 s: ${d20.join(',') || '-'} procs ${r20.procs}`;
          if (d20.length === 0 && r20.procs === 0) silent20.push(m.id);
        }
        rows.push(
          `${m.id.padEnd(15)} flat ${String(m.isFlat).padEnd(5)} procs ${String(r.procs).padStart(3)} changed: ${diff.join(',') || '-'}${note}`,
        );
      }
      console.log(
        `[QA M3-02 mementos] silent in 5 s: ${silent5.join(' ') || 'none'}\n${rows.join('\n')}`,
      );
      expect(silent20, 'Mementos with no effect even in 20 s').toEqual([]);
    });
  });

  it('synergies: every tag threshold in the data activates when the tag count reaches it', () => {
    const rows: string[] = [];
    for (const tag of data.tags) {
      const sim = createSim({ data, debugCommands: true });
      const input = createInputFrame();
      const got = new Set<number>();
      const read = (): void => {
        const ev = sim.events;
        for (let i = 0; i < ev.count; i++)
          if (
            ev.type[i] === SimEventType.SynergyActivated &&
            data.tags[ev.a[i] ?? -1]?.id === tag.id
          )
            got.add(ev.b[i] ?? 0);
      };
      sim.enqueue({
        type: 'run.start',
        seed: 3,
        classId: 'lantern',
        profile: PROFILE,
        difficulty: 0,
        unlocked: ALL_UNLOCKS,
      });
      sim.step(input);
      const tIdx = data.index.tag(tag.id);
      const items = [
        ...data.mementos
          .filter((m) => (m.tags as readonly string[]).includes(tag.id))
          .map((m) => ({ kind: 'memento' as const, id: m.id })),
        ...data.weapons
          .filter((w) => (w.tags as readonly string[]).includes(tag.id))
          .map((w) => ({ kind: 'weapon' as const, id: w.id })),
      ];
      const want = data.synergies.filter((s) => s.tag === tag.id).map((s) => s.threshold);
      const maxWant = Math.max(...want);
      for (let k = 0; k < 24 && (sim.view.shop.tagCounts[tIdx] ?? 0) < maxWant; k++) {
        const it2 = items[k % items.length];
        if (it2 === undefined) break;
        sim.enqueue({ type: 'debug.grant', kind: it2.kind, id: it2.id, tier: 1 });
        sim.step(input);
        read();
      }
      const count = sim.view.shop.tagCounts[tIdx] ?? 0;
      for (let t = 0; t < 120; t++) {
        sim.step(input);
        read();
      }
      rows.push(
        `${tag.id.padEnd(6)} count ${count} want ${want.join(',')} activated ${[...got].sort().join(',')}`,
      );
      for (const th of want) expect(got, `${tag.id} ${th}`).toContain(th);
    }
    console.log(`[QA M3 synergies]\n${rows.join('\n')}`);
  });

  describe('determinism on run_b for every class', () => {
    for (const classId of CLASSES) {
      it(`D-1: a whole ${classId} bot run replays with every checkpoint matching`, () => {
        const rec = recordBotRun(
          createSim({ data }),
          data,
          { seed: 404, classId, profile: PROFILE },
          MAX_TICKS,
        );
        expect(rec.phase === 'victory' || rec.phase === 'defeat').toBe(true);
        for (let k = 0; k < 2; k++) {
          const res = playReplay(createSim({ data }), rec.replay);
          expect(res.mismatchAt).toBe(-1);
          expect(res.finalHash).toBe(rec.finalHash);
        }
        console.log(
          `[QA M3 D-1] ${classId}: ${rec.phase}, ticks ${rec.replay.ticks}, checkpoints ${rec.replay.checkpoints.length}, hash ${rec.finalHash}`,
        );
      }, 60_000);
    }

    it('D-2: run_b replays of every class match in a separate Node process', () => {
      mkdirSync(OUT, { recursive: true });
      for (const classId of CLASSES) {
        const rec = recordBotRun(
          createSim({ data }),
          data,
          { seed: 505, classId, profile: PROFILE },
          TICK_RATE * 60 * 4,
        );
        const file = resolve(OUT, `m3-d2-${classId}.json`);
        writeFileSync(file, JSON.stringify(rec.replay));
        const out = JSON.parse(
          execFileSync(process.execPath, [CLI, 'replay', file], { cwd: ROOT, encoding: 'utf8' }),
        ) as { mismatchAt: number; finalHash: string };
        expect(out.mismatchAt, classId).toBe(-1);
        expect(out.finalHash, classId).toBe(rec.finalHash);
      }
    }, 60_000);

    for (const classId of CLASSES) {
      it(`D-4: ${classId} save and load in the shop of Pulse 3 keeps the run identical to the end`, () => {
        const drive = (sim: Sim, stopAtShop3: boolean): void => {
          const input = createInputFrame();
          const cmds: Command[] = [];
          for (let t = 0; t < MAX_TICKS; t++) {
            const v = sim.view;
            if (v.phase === 'victory' || v.phase === 'defeat') return;
            if (stopAtShop3 && v.phase === 'shop' && v.pulse.index === 2) return;
            if (v.phase === 'pulse') botInput(v, input);
            else {
              input.moveX = 0;
              input.moveY = 0;
              input.pressed = 0;
              botCommands(v, cmds);
              for (const c of cmds) sim.enqueue(c);
            }
            sim.step(input);
          }
        };
        // First seed from 606 whose bot run reaches the shop of Pulse 3 (the bot may die earlier).
        let a = createSim({ data });
        for (let seed = 606; seed < 626; seed++) {
          a = createSim({ data });
          a.enqueue({
            type: 'run.start',
            seed,
            classId,
            profile: PROFILE,
            difficulty: 0,
            unlocked: ALL_UNLOCKS,
          });
          a.step(createInputFrame());
          drive(a, true);
          if (a.view.phase === 'shop') break;
        }
        expect(a.view.phase).toBe('shop');
        const save = a.save();
        expect(save).not.toBeNull();
        if (save === null) return;
        const b = createSim({ data });
        expect(b.load(JSON.parse(JSON.stringify(save)) as typeof save)).toEqual({ ok: true });
        expect(toHex8(b.hash())).toBe(toHex8(a.hash()));
        drive(a, false);
        drive(b, false);
        expect(b.view.tick).toBe(a.view.tick);
        expect(b.view.phase).toBe(a.view.phase);
        expect(toHex8(b.hash())).toBe(toHex8(a.hash()));
        console.log(
          `[QA M3 D-4] ${classId}: ${a.view.phase} at tick ${a.view.tick}, hash ${toHex8(a.hash())}`,
        );
      }, 60_000);
    }
  });
});
