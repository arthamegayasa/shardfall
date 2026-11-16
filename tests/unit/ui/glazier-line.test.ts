import { describe, expect, it } from 'vitest';
import { RejectReason, SimEventType } from '../../../src/core/index.ts';
import {
  lineKeys,
  openingTrigger,
  pickLine,
  reactionTrigger,
} from '../../../src/ui/presenters/glazier-line.ts';

const table = new Set([
  'glazier.open',
  'glazier.first',
  'glazier.after_temper',
  'glazier.warden_fell',
  'glazier.reroll',
  'glazier.reroll.2',
  'glazier.reroll.3',
]);
const has = (k: string): boolean => table.has(k);

describe('Glazier opening line', () => {
  it('speaks of the fallen Warden first, then the first visit, then open or Temper', () => {
    expect(openingTrigger({ pulseIndex: 4, sawReward: true, sawTemper: true })).toBe('warden_fell');
    expect(openingTrigger({ pulseIndex: 0, sawReward: false, sawTemper: true })).toBe('first');
    expect(openingTrigger({ pulseIndex: 3, sawReward: false, sawTemper: false })).toBe('open');
    expect(openingTrigger({ pulseIndex: 2, sawReward: false, sawTemper: true })).toBe(
      'after_temper',
    );
    expect(openingTrigger({ pulseIndex: 3, sawReward: false, sawTemper: true })).toBe('open');
  });

  it('reacts to reroll, Fuse and missing Glint only', () => {
    expect(reactionTrigger(SimEventType.ShopRerolled, 0)).toBe('reroll');
    expect(reactionTrigger(SimEventType.ItemMerged, 0)).toBe('fuse');
    expect(reactionTrigger(SimEventType.CommandRejected, RejectReason.NotEnoughGlint)).toBe(
      'no_glint',
    );
    expect(reactionTrigger(SimEventType.CommandRejected, RejectReason.WrongPhase)).toBeNull();
    expect(reactionTrigger(SimEventType.ItemBought, 0)).toBeNull();
  });
});

describe('Glazier line pick', () => {
  it('collects the base key and numbered WR variants', () => {
    expect(lineKeys('reroll', has)).toEqual([
      'glazier.reroll',
      'glazier.reroll.2',
      'glazier.reroll.3',
    ]);
    expect(lineKeys('no_glint', has)).toEqual([]);
  });

  it('is deterministic for a seed and cycles through variants', () => {
    expect(pickLine('reroll', 0, has)).toBe('glazier.reroll');
    expect(pickLine('reroll', 4, has)).toBe('glazier.reroll.2');
    expect(pickLine('reroll', 4, has)).toBe(pickLine('reroll', 4, has));
    expect(pickLine('reroll', -1, has)).toBe('glazier.reroll.3');
  });

  it('falls back to the open line, and to no line without any Glazier key', () => {
    expect(pickLine('no_glint', 7, has)).toBe('glazier.open');
    expect(pickLine('open', 0, () => false)).toBeNull();
  });
});
