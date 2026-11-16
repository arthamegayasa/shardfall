import { describe, expect, it } from 'vitest';
import {
  EnemyRank,
  HitKind,
  RejectReason,
  SimEventType,
  SourceKind,
  TelegraphKind,
  encodeSource,
  packDamageFlags,
} from '../../../src/core/index.ts';
import type { GameData } from '../../../src/content/index.ts';
import {
  createEventMap,
  describeCoverage,
  liveWarmupPairs,
  validateRoutes,
} from '../../../src/audio/event-map.ts';
import type { EventMap } from '../../../src/audio/event-map.ts';
import { createTriggerList } from '../../../src/audio/triggers.ts';
import type { TriggerList } from '../../../src/audio/triggers.ts';
import type { CueTable } from '../../../src/audio/cue-data.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGameData } from '../../../src/content/index.ts';
import type { RawGameData } from '../../../src/content/index.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';
import { events, realCues, routes } from './audio-fixtures.ts';
import type { EventRow } from './audio-fixtures.ts';

/** D dorian Glint ladder of mus.biome1.pulse as MIDI notes. */
const LADDER = [86, 88, 91, 93, 95, 98, 100, 103];

interface Setup {
  readonly data: GameData;
  readonly cues: CueTable;
  readonly map: EventMap;
  readonly out: TriggerList;
  run(rows: readonly EventRow[], now?: number): string[];
}

function setup(tier: 'A' | 'B' = 'A'): Setup {
  const data = fixtureGameData(tier);
  const cues = realCues();
  const map = createEventMap(data, cues, routes);
  const out = createTriggerList(cues.cues.length);
  return {
    data,
    cues,
    map,
    out,
    run(rows, now = 10) {
      out.reset();
      map.map(events(rows), out, now, LADDER);
      const ids: string[] = [];
      for (let i = 0; i < out.count; i++) ids.push(cues.cues[out.cue[i] ?? -1]?.id ?? '?');
      return ids;
    },
  };
}

describe('routes.json', () => {
  it('references only existing cues and routes or silences every SimEventType', () => {
    expect(validateRoutes(routes, realCues())).toEqual([]);
  });

  it('gives every weapon, enemy, Rite, and effect of the data a cue or a declared silence', () => {
    const s = setup();
    const rows = describeCoverage(s.data, routes);
    expect(rows.length).toBe(
      s.data.weapons.length + s.data.enemies.length + s.data.rites.length + s.data.effects.length,
    );
    for (const r of rows) {
      if (r.via === 'declared-silent') expect(r.cue, `${r.table} ${r.id}`).toBeNull();
      else expect(s.cues.indexOf.has(r.cue ?? ''), `${r.table} ${r.id}`).toBe(true);
    }
  });
});

describe('coverage of the build data', () => {
  // Validity only (coding-standards 6.3): every id in content/generated resolves, no balance numbers.
  const raw = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../content/generated/game-data.json'), 'utf8'),
  ) as RawGameData;
  const data = buildGameData(raw);

  it('resolves every weapon, enemy, Rite, effect, and boss pattern to a cue or a declared silence', () => {
    const cues = realCues();
    expect(() => createEventMap(data, cues, routes)).not.toThrow();
    for (const r of describeCoverage(data, routes)) {
      if (r.via === 'declared-silent' || (r.table === 'boss_patterns' && r.cue === null)) continue;
      expect(cues.indexOf.has(r.cue ?? ''), `${r.table} ${r.id}`).toBe(true);
    }
  });

  it('lists only live cues for boot warmup', () => {
    const cues = realCues();
    for (const w of liveWarmupPairs(data, routes)) {
      const i = cues.indexOf.get(w.cue);
      expect(i, w.cue).toBeDefined();
      expect(cues.cues[i ?? -1]?.mode, w.cue).toBe('live');
      expect(w.durSec).toBeGreaterThan(0);
    }
  });
});

describe('event map', () => {
  it('maps WeaponFired to the fire cue of the weapon archetype', () => {
    const s = setup('B');
    const w = (id: string): number => s.data.index.weapon(id);
    expect(s.run([{ type: SimEventType.WeaponFired, a: w('test_bolt') }])).toEqual(['sfx.weapon.fire.lob']);
    expect(s.run([{ type: SimEventType.WeaponFired, a: w('test_shard') }])).toEqual(['sfx.weapon.fire.bolt']);
    expect(s.run([{ type: SimEventType.WeaponFired, a: w('test_late') }])).toEqual(['sfx.weapon.fire.ring']);
  });

  it('maps EnemyKilled by size class and leaves Warden kills to WardenKilled', () => {
    const s = setup();
    const e = (id: string): number => s.data.index.enemy(id);
    expect(s.run([{ type: SimEventType.EnemyKilled, a: e('test_swarmer') }])).toEqual(['sfx.enemy.death.small']);
    expect(s.run([{ type: SimEventType.EnemyKilled, a: e('test_charger') }])).toEqual(['sfx.enemy.death.medium']);
    expect(
      s.run([{ type: SimEventType.EnemyKilled, a: e('test_warden'), b: EnemyRank.Warden }]),
    ).toEqual([]);
  });

  it('picks the EnemyDamaged cue from rank, crit, hit kind, and source', () => {
    const s = setup();
    const bolt = encodeSource(SourceKind.Weapon, s.data.index.weapon('test_bolt'));
    const dmg = (b: number, c = bolt): string[] => s.run([{ type: SimEventType.EnemyDamaged, a: 5, b, c }]);
    expect(dmg(packDamageFlags(false, false, 0, HitKind.Projectile))).toEqual(['sfx.weapon.hit']);
    expect(dmg(packDamageFlags(false, false, 0, HitKind.Area))).toEqual(['sfx.weapon.impact.burst']);
    expect(dmg(packDamageFlags(true, false, 0, HitKind.Projectile))).toEqual(['sfx.weapon.hit_crit']);
    expect(dmg(packDamageFlags(false, false, EnemyRank.Warden, HitKind.Projectile))).toEqual(['sfx.warden.hurt']);
    expect(dmg(packDamageFlags(false, false, EnemyRank.Boss, HitKind.Projectile))).toEqual(['sfx.boss.hurt']);
    expect(dmg(packDamageFlags(false, false, 0, HitKind.Dot))).toEqual([]);
    expect(dmg(packDamageFlags(false, false, 0, HitKind.Area), encodeSource(SourceKind.Rite, 0))).toEqual([]);
  });

  it('coalesces same-cue events of one frame into one trigger with a hit count and mean x', () => {
    const s = setup();
    const a = s.data.index.enemy('test_swarmer');
    const rows: EventRow[] = [];
    for (let i = 0; i < 20; i++) rows.push({ type: SimEventType.EnemyKilled, a, x: i < 10 ? -4 : 4 });
    expect(s.run(rows)).toEqual(['sfx.enemy.death.small']);
    expect(s.out.hits[0]).toBe(20);
    expect(s.out.x[0]).toBeCloseTo(0, 10);
  });

  it('climbs the Glint ladder from the streak length in b', () => {
    const s = setup();
    const semis = (b: number): number => {
      s.run([{ type: SimEventType.GlintCollected, a: 1, b }]);
      return s.out.semis[0] ?? Number.NaN;
    };
    expect(semis(1)).toBe(0);
    expect(semis(2)).toBe(2);
    expect(semis(3)).toBe(5);
    expect(semis(9)).toBe(0);
  });

  it('counts its own Glint streak when b is 0 and resets after 500 ms', () => {
    const s = setup();
    const at = (now: number): number => {
      s.run([{ type: SimEventType.GlintCollected, a: 1, b: 0 }], now);
      return s.out.semis[0] ?? Number.NaN;
    };
    expect(at(1.0)).toBe(0);
    expect(at(1.2)).toBe(2);
    expect(at(1.4)).toBe(5);
    expect(at(2.5)).toBe(0);
  });

  it('routes a Warden charge telegraph to the Warden windup with the sim duration', () => {
    const s = setup();
    const c = encodeSource(SourceKind.EnemyAttack, s.data.index.enemy('test_warden'));
    const ids = s.run([{ type: SimEventType.TelegraphStarted, a: TelegraphKind.Charge, b: 36, c }]);
    expect(ids).toEqual(['sfx.warden.charge.windup']);
    expect(s.out.durSec[0]).toBeCloseTo(0.6, 10);
    expect(s.map.signals.telegraphSec).toBeCloseTo(0.6, 10);
    const charger = encodeSource(SourceKind.EnemyAttack, s.data.index.enemy('test_charger'));
    expect(s.run([{ type: SimEventType.TelegraphStarted, a: TelegraphKind.Charge, b: 36, c: charger }])).toEqual([
      'sfx.enemy.charger.windup',
    ]);
    expect(s.run([{ type: SimEventType.TelegraphResolved, a: TelegraphKind.Charge, c: charger }])).toEqual([
      'sfx.enemy.charger.dash',
    ]);
  });

  it('casts the Rite and schedules its impact with a delay', () => {
    const s = setup();
    const ids = s.run([{ type: SimEventType.RiteCast, a: s.data.index.rite('test_flare'), x: 3 }]);
    expect(ids).toEqual(['sfx.rite.cast.lantern', 'sfx.rite.impact.lantern']);
    expect(s.out.delaySec[1]).toBeCloseTo(0.35, 10);
    expect(s.out.x[1]).toBe(3);
  });

  it('suppresses RiteReady right after PulseStarted', () => {
    const s = setup();
    s.run([{ type: SimEventType.PulseStarted }], 5);
    expect(s.run([{ type: SimEventType.RiteReady }], 6)).toEqual([]);
    expect(s.run([{ type: SimEventType.RiteReady }], 7)).toEqual(['sfx.rite.ready']);
  });

  it('maps procs by effect owner or action and keeps passive effects silent', () => {
    const s = setup();
    const e = (id: string): number => s.data.index.effect(id);
    expect(s.run([{ type: SimEventType.ProcTriggered, a: e('test_lens_1') }])).toEqual(['sfx.proc.shard_split']);
    expect(s.run([{ type: SimEventType.ProcTriggered, a: e('class_test_lamp_1') }])).toEqual(['sfx.player.heal']);
    expect(s.run([{ type: SimEventType.ProcTriggered, a: e('syn_flame_2a') }])).toEqual([]);
  });

  it('plays ui.denied for real rejections only', () => {
    const s = setup();
    expect(s.run([{ type: SimEventType.CommandRejected, a: RejectReason.NotEnoughGlint }])).toEqual(['ui.denied']);
    expect(s.run([{ type: SimEventType.CommandRejected, a: RejectReason.WrongPhase }])).toEqual([]);
  });

  it('maps Pulse flow, Warden arrival, and run end to SFX and stingers', () => {
    const s = setup();
    expect(s.run([{ type: SimEventType.PulseStarted }])).toEqual(['sfx.pulse.start_wave', 'mus.stinger.pulse_start']);
    expect(s.run([{ type: SimEventType.PulseEnded }])).toEqual(['sfx.pulse.end_flash', 'mus.stinger.pulse_end']);
    expect(s.run([{ type: SimEventType.WardenSpawned }])).toEqual(['sfx.warden.arrive', 'mus.stinger.warden']);
    expect(s.run([{ type: SimEventType.RunEnded, a: 0 }])).toEqual(['mus.stinger.defeat']);
    expect(s.run([{ type: SimEventType.RunEnded, a: 1 }])).toEqual(['mus.stinger.victory']);
    expect(s.run([{ type: SimEventType.ItemMerged, b: 3 }])).toEqual(['ui.shop.merge']);
    expect(s.out.semis[0]).toBe(7);
  });

  it('raises signals for low HP and player death', () => {
    const s = setup();
    s.run([{ type: SimEventType.PlayerHpLowChanged, a: 1 }]);
    expect(s.map.signals.lowHp).toBe(1);
    s.run([{ type: SimEventType.PlayerDied }]);
    expect(s.map.signals.lowHp).toBe(-1);
    expect(s.map.signals.playerDied).toBe(true);
  });
});
