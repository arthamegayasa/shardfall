// Meta unlock rules (src/content/rules/unlocks.ts, LP M2-09): price per tier, buying, open classes,
// weapons, and Memento packs. Sim fixture data plus synthetic unlock rows; prices are test inputs.

import { describe, expect, it } from 'vitest';
import {
  applyUnlock,
  classUnlock,
  isClassOpen,
  isMementoOpen,
  isWeaponOpen,
  ownedUnlockIds,
  unlockCost,
  unlockStatus,
} from '../../../src/content/index.ts';
import type { GameData, MetaUnlockDef } from '../../../src/content/index.ts';
import type { MetaSave } from '../../../src/core/index.ts';
import { simFixtureData } from '../sim/support/sim-fixture.ts';

const ROWS: readonly [MetaUnlockDef, MetaUnlockDef, MetaUnlockDef] = [
  {
    id: 'unlock_blade',
    kind: 'class',
    targets: ['blade'],
    costSilt: 40,
    contentTier: 'B',
    costSiltB: 20,
  },
  {
    id: 'unlock_tithe',
    kind: 'weapon',
    targets: ['tithe_coin'],
    costSilt: 20,
    contentTier: 'B',
    costSiltB: null,
  },
  {
    id: 'test_lock',
    kind: 'memento_pack',
    targets: ['pt_1', 'pt_2'],
    costSilt: 5,
    contentTier: 'A',
    costSiltB: null,
  },
] as unknown as readonly [MetaUnlockDef, MetaUnlockDef, MetaUnlockDef];

function dataFor(tier: 'B' | 'C'): GameData {
  const base = simFixtureData('C');
  return { ...base, meta: { ...base.meta, contentTier: tier }, metaUnlocks: [...ROWS] };
}

const meta = (silt: number, unlocked: string[] = []): MetaSave => ({
  v: 1,
  silt,
  unlocked,
  mementosFound: [],
  highestDifficultyWon: -1,
  lastClassId: 'lantern',
  runs: 0,
});

describe('meta unlock rules (GDD 17.2)', () => {
  it('cost_silt_b replaces cost_silt only in content tier B', () => {
    const blade = ROWS[0];
    expect(unlockCost(dataFor('B'), blade)).toBe(20);
    expect(unlockCost(dataFor('C'), blade)).toBe(40);
    expect(unlockCost(dataFor('B'), ROWS[1])).toBe(20);
  });

  it('buying spends Silt, adds the unlock and the class it opens, and refuses repeats', () => {
    const d = dataFor('B');
    expect(unlockStatus(d, meta(19), 'unlock_blade')).toBe('poor');
    expect(applyUnlock(d, meta(19), 'unlock_blade')).toBeNull();
    expect(unlockStatus(d, meta(20), 'unlock_blade')).toBe('affordable');
    const after = applyUnlock(d, meta(25), 'unlock_blade') ?? meta(-1);
    expect(after.silt).toBe(5);
    expect(after.unlocked).toEqual(['blade', 'unlock_blade']);
    expect(unlockStatus(d, after, 'unlock_blade')).toBe('owned');
    expect(applyUnlock(d, after, 'unlock_blade')).toBeNull();
    expect(applyUnlock(d, meta(999), 'nope')).toBeNull();
  });

  it('classes, weapons, and Memento packs open with their unlock', () => {
    const d = dataFor('B');
    expect(isClassOpen(d, [], 'lantern')).toBe(true);
    expect(isClassOpen(d, [], 'blade')).toBe(false);
    expect(isClassOpen(d, ['unlock_blade'], 'blade')).toBe(true);
    expect(classUnlock(d, 'blade')?.id).toBe('unlock_blade');
    expect(isWeaponOpen(d, [], 'lantern_bolt')).toBe(true);
    expect(isWeaponOpen(d, [], 'tithe_coin')).toBe(false);
    expect(isWeaponOpen(d, ['unlock_tithe'], 'tithe_coin')).toBe(true);
    expect(isMementoOpen(d, [], 'pt_1')).toBe(false);
    expect(isMementoOpen(d, ['test_lock'], 'pt_1')).toBe(true);
    expect(ownedUnlockIds(d, ['blade', 'test_lock', 'unlock_blade', 'gone'])).toEqual([
      'unlock_blade',
      'test_lock',
    ]);
  });

  it('a priced class without an unlock row is never free', () => {
    const d = { ...dataFor('B'), metaUnlocks: [] };
    expect(isClassOpen(d, [], 'blade')).toBe(false);
    expect(isClassOpen(d, ['blade'], 'blade')).toBe(true);
  });
});
