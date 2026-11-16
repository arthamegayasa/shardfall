import { describe, expect, it } from 'vitest';
import {
  buildGameData,
  buildRaw,
  canonicalJson,
  UnknownIdError,
} from '../../../src/content/index.ts';
import type { BuildInput } from '../../../src/content/index.ts';
import { buildFixture, fixtureGameData, fixtureInput } from '../../support/fixture-data.ts';

/** Fixture input with some files replaced or removed. */
function withCsv(patch: Record<string, string | null>): BuildInput {
  const base = fixtureInput();
  const csv: Record<string, string> = { ...base.csv };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) Reflect.deleteProperty(csv, k);
    else csv[k] = v;
  }
  return { ...base, csv };
}

describe('data pipeline', () => {
  it('builds the fixture set without errors or warnings', () => {
    const out = buildFixture();
    expect(out.report.errors).toEqual([]);
    expect(out.report.warnings).toEqual([]);
    expect(out.ok).toBe(true);
  });

  it('is deterministic: same input gives the same JSON and contentHash', () => {
    const a = buildFixture();
    const b = buildFixture();
    expect(canonicalJson(a.data)).toBe(canonicalJson(b.data));
    expect(a.data.contentHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('keeps CSV row order as array order', () => {
    const data = fixtureGameData();
    expect(data.enemies.map((e) => e.id)).toEqual(['test_swarmer', 'test_charger', 'test_warden']);
    expect(data.index.enemy('test_charger')).toBe(1);
  });

  it('filters rows above the content tier and cascades to untiered rows that need them', () => {
    const a = fixtureGameData('A');
    expect(a.weapons.map((w) => w.id)).toEqual(['test_bolt', 'test_shard']);
    const c = fixtureGameData('C');
    expect(c.weapons.map((w) => w.id)).toContain('test_late');
    const out = buildFixture('A');
    expect(
      out.report.infos.some((i) => i.includes('weapon_tiers.csv') && i.includes('dropped')),
    ).toBe(true);
  });

  it('merges weapon tiers into tiers[0..3] and joins waves with spawns into profiles', () => {
    const data = fixtureGameData();
    const bolt = data.weapons[data.index.weapon('test_bolt')];
    expect(bolt?.tiers.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
    expect(bolt?.tiers[3]?.params).toEqual({ dmg_add: 3 });
    const profile = data.profiles['run_a_m1'] ?? [];
    expect(profile.map((p) => p.pulse)).toEqual([1, 2]);
    expect(profile[1]?.spawns.map((s) => s.enemyId)).toEqual(['test_swarmer', 'test_charger']);
    expect(profile[1]?.spawns[0]?.sectors).toEqual(['n', 's']);
    expect(profile[1]?.isFinal).toBe(true);
  });

  it('converts units at load from the raw JSON', () => {
    const data = fixtureGameData();
    const shard = data.weapons[data.index.weapon('test_shard')];
    expect(shard?.cooldownTicks).toBe(30);
    expect(shard?.speedUPerTick).toBeCloseTo(15 / 60, 12);
    expect(data.config.pulseClearTicks).toBe(60);
    expect(data.config.extraProjectileSpreadTurns).toBeCloseTo(15 / 360, 12);
  });

  it('builds effectsByOwner and the fixed tag order', () => {
    const data = fixtureGameData();
    expect(data.effectsByOwner['test_lens']?.map((i) => data.effects[i]?.id)).toEqual([
      'test_lens_1',
    ]);
    expect(data.tags.map((t) => t.id)).toEqual(['flame', 'shard', 'edge', 'echo', 'ward', 'trade']);
  });

  it('throws UnknownIdError for unknown ids at the load boundary', () => {
    const data = fixtureGameData();
    expect(() => data.index.weapon('nope')).toThrow(UnknownIdError);
  });

  it('still builds when tables are missing: required ones warn, optional ones inform', () => {
    const out = buildRaw(withCsv({ mementos: null, affixes: null }));
    expect(out.ok).toBe(true);
    expect(out.report.warnings.some((w) => w.startsWith('content/data/mementos.csv missing'))).toBe(
      true,
    );
    expect(out.report.infos.some((i) => i.startsWith('content/data/affixes.csv missing'))).toBe(
      true,
    );
    expect(out.data.missingTables).toContain('mementos');
  });

  it('builds GameData even from zero tables, with NaN for undeclared config keys', () => {
    const out = buildRaw({ csv: {}, levels: {}, strings: null, contentTier: 'A' });
    expect(out.ok).toBe(true);
    const data = buildGameData(out.data);
    expect(data.weapons).toEqual([]);
    expect(Number.isNaN(data.config.playerBaseSpeedUPerTick)).toBe(true);
    expect(data.meta.missingTables.length).toBeGreaterThan(10);
  });

  it('reports file:line:col for bad cells, unknown columns, bad refs, and duplicates', () => {
    const out = buildRaw(
      withCsv({
        stats:
          'id,base,min,max,unit,display_key,show_in_ui,colour\ndamage_pct,0,,,pct,stat.d,1,red\n',
        rarity:
          'id,order,color_token,memento_price,weapon_price,weapon_dmg_mult,weapon_cd_mult\nplain,0,x,10,12,1,1\nplain,1,x,10,12,1,1\nfine,one,x,1,1,1,1\n',
        classes:
          'id,name_key,desc_key,content_tier,accent,tag,start_weapon,rite_id,max_hp\ntest_lamp,a.b,a.c,A,gold,flame,missing_weapon,test_flare,20\n',
      }),
    );
    expect(out.ok).toBe(false);
    expect(out.report.errors).toContain(
      'content/data/stats.csv:1:8 unknown column "colour" (declared: id, base, min, max, unit, display_key, show_in_ui)',
    );
    expect(out.report.errors).toContain(
      'content/data/rarity.csv:4:2 order: expected a number with "." decimals, got "one"',
    );
    expect(out.report.errors).toContain(
      'content/data/rarity.csv:3:0 duplicate id "plain" (first on line 2)',
    );
    expect(out.report.errors).toContain(
      'content/data/classes.csv:2:0 start_weapon "missing_weapon" not found in weapons',
    );
  });

  it('rejects unknown and missing keys in key-value tables', () => {
    const out = buildRaw(withCsv({ shop: 'key,value\nslots,3\nmystery,1\n' }));
    expect(out.report.errors).toContain(
      'content/data/shop.csv:3:1 unknown key "mystery" (declare it in src/content/tables)',
    );
    expect(out.report.errors.some((e) => e.includes('missing key "weapon_chance"'))).toBe(true);
  });

  it('rejects a CSV file that has no schema', () => {
    const out = buildRaw(withCsv({ keepsakes: 'id\nx\n' }));
    expect(out.report.errors).toContain(
      'content/data/keepsakes.csv:1:0 no schema for table "keepsakes" (add it to src/content/tables)',
    );
  });

  it('checks effect owners, wave and spawn keys, and Warden ids', () => {
    const out = buildRaw(
      withCsv({
        effects:
          'id,owner,trigger,conditions,chance,icd,max_per_pulse,allow_proc,stack_mode,action,params\nfx,nobody,passive,,,,,,none,stat_mod,\n',
        waves:
          'profile,pulse,kind,biome,threat,duration_s,warden_id,boss_id,alive_cap,final\nrun_a_m1,1,warden,biome_test,1,20,,,30,1\n',
      }),
    );
    expect(out.report.errors).toContain(
      'content/data/effects.csv:2:0 owner "nobody" is not a Memento, class, or synergy owner',
    );
    expect(out.report.errors).toContain('content/data/waves.csv:2:0 warden Pulse needs warden_id');
    expect(out.report.errors.some((e) => e.includes('(run_a_m1, 2) not found in waves.csv'))).toBe(
      true,
    );
  });

  it('validates params keys once the registry has an entry for the discriminator', () => {
    const out = buildRaw({
      ...fixtureInput(),
      paramsRegistry: { weapons: { projectile: { fan_count: { type: 'int', min: 1 } } } },
    });
    expect(
      out.report.errors.some((e) =>
        e.includes('key "fan_every_n" is not known for archetype=projectile'),
      ),
    ).toBe(true);
  });

  it('validates arena files: id, convex clockwise boundary, and the 32 x 20 u limit', () => {
    const base = fixtureInput();
    const out = buildRaw({
      ...base,
      levels: {
        ...base.levels,
        arena_big: JSON.stringify({
          schemaVersion: 1,
          id: 'arena_big',
          arena: {
            boundary: [
              [-20, -5],
              [20, -5],
              [20, 5],
              [-20, 5],
            ],
          },
          playerStart: { default: [0, 0], boss: [0, 0] },
          pulseOrigin: [0, 0],
        }),
        arena_ccw: JSON.stringify({
          schemaVersion: 1,
          id: 'arena_ccw',
          arena: {
            boundary: [
              [-5, -5],
              [-5, 5],
              [5, 5],
              [5, -5],
            ],
          },
          playerStart: { default: [0, 0], boss: [0, 0] },
          pulseOrigin: [0, 0],
        }),
      },
    });
    expect(
      out.report.errors.some(
        (e) => e.startsWith('content/levels/arena_big.json') && e.includes('32 x 20 u'),
      ),
    ).toBe(true);
    expect(out.report.errors).toContain(
      'content/levels/arena_ccw.json:1:0 arena.boundary must be clockwise on screen',
    );
  });
});
