import { describe, expect, expectTypeOf, it } from 'vitest';
import { CellError, col, outKeyOf } from '../../../src/content/index.ts';
import type {
  ConfigValues,
  EnemyDef,
  PulseSlotDef,
  WeaponDef,
} from '../../../src/content/index.ts';

describe('column DSL', () => {
  it('derives GameData keys: camelCase plus unit suffix', () => {
    expect(outKeyOf('cooldown', col.seconds())).toBe('cooldownTicks');
    expect(outKeyOf('duration_s', col.seconds())).toBe('durationTicks');
    expect(outKeyOf('speed', col.uPerSec())).toBe('speedUPerTick');
    expect(outKeyOf('range', col.u())).toBe('rangeU');
    expect(outKeyOf('extra_projectile_spread_deg', col.deg())).toBe('extraProjectileSpreadTurns');
    expect(outKeyOf('leech_heal_cap_per_s', col.perSec())).toBe('leechHealCapPerTick');
    expect(outKeyOf('max_hp', col.float())).toBe('maxHp');
    expect(outKeyOf('final', col.bool({ as: 'isFinal' }))).toBe('isFinal');
  });

  it('converts units at load: seconds to ticks, u/s to u/tick, degrees to turns', () => {
    expect(col.seconds().toGame(0.35)).toBe(21);
    expect(col.uPerSec().toGame(6)).toBeCloseTo(0.1, 12);
    expect(col.deg().toGame(90)).toBe(0.25);
  });

  it('parses cells strictly', () => {
    expect(col.int({ min: 0 }).parseCell('3')).toBe(3);
    expect(() => col.int().parseCell('3.5')).toThrow(CellError);
    expect(() => col.float().parseCell('1,5')).toThrow(CellError);
    expect(() => col.float({ max: 1 }).parseCell('1.5')).toThrow(/above the maximum/);
    expect(col.bool().parseCell('1')).toBe(true);
    expect(() => col.bool().parseCell('yes')).toThrow(CellError);
    expect(col.enumOf(['a', 'b']).parseCell('b')).toBe('b');
    expect(() => col.id().parseCell('Bad-Id')).toThrow(/snake_case/);
    expect(col.list(col.enumOf(['flame', 'shard'])).parseCell('flame|shard')).toEqual([
      'flame',
      'shard',
    ]);
    expect(() => col.list(col.str(), { min: 1 }).parseCell('a||b')).toThrow(/empty list item/);
    expect(col.params().parseCell('count=3;pattern=split;dmg_frac=0.4')).toEqual({
      count: 3,
      pattern: 'split',
      dmg_frac: 0.4,
    });
    expect(col.conditions(['every_nth']).parseCell('every_nth:5@global')).toEqual([
      { name: 'every_nth', value: '5@global' },
    ]);
    expect(() => col.conditions(['every_nth']).parseCell('nope:1')).toThrow(/unknown condition/);
  });

  it('infers typed GameData rows from table schemas', () => {
    expectTypeOf<WeaponDef['cooldownTicks']>().toEqualTypeOf<number>();
    expectTypeOf<WeaponDef['dmg2']>().toEqualTypeOf<number | null>();
    expectTypeOf<WeaponDef['tags']>().toEqualTypeOf<
      readonly ('flame' | 'shard' | 'edge' | 'echo' | 'ward' | 'trade')[]
    >();
    expectTypeOf<EnemyDef['telegraphTicks']>().toEqualTypeOf<number>();
    expectTypeOf<PulseSlotDef['isFinal']>().toEqualTypeOf<boolean>();
    expectTypeOf<PulseSlotDef['wardenId']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConfigValues['playerBaseSpeedUPerTick']>().toEqualTypeOf<number>();
    expectTypeOf<ConfigValues['pulseClearTicks']>().toEqualTypeOf<number>();
  });
});
