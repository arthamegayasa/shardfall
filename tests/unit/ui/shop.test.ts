import { describe, expect, it } from 'vitest';
import { ownerTextParams } from '../../../src/content/index.ts';
import { OfferKind } from '../../../src/core/index.ts';
import type { ShopOfferView } from '../../../src/core/index.ts';
import {
  buildShopModel,
  focusedSlotIndex,
  initialOfferFocus,
  tagPreview,
} from '../../../src/ui/presenters/shop.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';
import { pl } from './writable.ts';

const data = fixtureGameData('A');
const W_BOLT = data.index.weapon('test_bolt');
const W_SHARD = data.index.weapon('test_shard');
const M_LENS = data.index.memento('test_lens');
const T_FLAME = data.index.tag('flame');

const offer = (o: Partial<ShopOfferView>): ShopOfferView => ({
  kind: OfferKind.Weapon,
  defIndex: W_BOLT,
  tier: 1,
  price: 10,
  locked: false,
  affordable: true,
  mergeSlot: -1,
  mergeToTier: 0,
  blockedNoSlot: false,
  isNewId: true,
  ...o,
});

function shopWorld(offers: ShopOfferView[], flameCount = 0) {
  const w = createFakeWorld({ phase: 'shop' });
  const tagCounts = new Float64Array(data.tags.length);
  tagCounts[T_FLAME] = flameCount;
  pl(w).glint = 20;
  w.shop = {
    revision: 3,
    offers,
    rerollPrice: 5,
    freeRerolls: 0,
    inventory: [
      { weaponIndex: W_BOLT, tier: 1, sellPrice: 6, canMerge: false },
      { weaponIndex: -1, tier: 0, sellPrice: 0, canMerge: false },
    ],
    mementos: [{ mementoIndex: M_LENS, count: 1 }],
    tagCounts,
  };
  return w;
}

describe('Glazier model', () => {
  it('maps offers to cards with item keys, state and buyability from the view', () => {
    const w = shopWorld([
      offer({}),
      offer({ kind: OfferKind.Memento, defIndex: M_LENS, tier: 2, affordable: false }),
      offer({ kind: OfferKind.Taken }),
      offer({ kind: OfferKind.Empty }),
    ]);
    const m = buildShopModel(w, data);
    expect(m.offers.map((o) => o.state)).toEqual(['weapon', 'memento', 'taken', 'empty']);
    expect(m.offers[0]?.item?.nameKey).toBe('weapon.test_bolt.name');
    expect(m.offers[0]?.buyable).toBe(true);
    expect(m.offers[1]?.buyable).toBe(false);
    expect(m.offers[1]?.rarityOrder).toBe(1);
    expect(m.offers[2]?.item).toBeNull();
    expect(m.revision).toBe(3);
    expect(m.nextPulse).toBe(2);
  });

  it('shows the Fuse target and blocked slots exactly as the sim reports them (K2)', () => {
    const w = shopWorld([
      offer({ mergeSlot: 0, mergeToTier: 2 }),
      offer({ defIndex: W_SHARD, blockedNoSlot: true }),
    ]);
    const m = buildShopModel(w, data);
    expect(m.offers[0]?.fuseSlot).toBe(0);
    expect(m.offers[0]?.fuseTier).toBe(2);
    expect(m.offers[1]?.blockedNoSlot).toBe(true);
    expect(m.offers[1]?.buyable).toBe(false);
  });

  it('lists inventory slots including empty ones and the owned Mementos', () => {
    const m = buildShopModel(shopWorld([]), data);
    expect(m.inventory).toHaveLength(2);
    expect(m.inventory[0]?.item?.id).toBe('test_bolt');
    expect(m.inventory[1]?.empty).toBe(true);
    expect(m.mementos[0]?.item?.id).toBe('test_lens');
  });

  it('lists only owned tags with their thresholds from data', () => {
    const m = buildShopModel(shopWorld([], 1), data);
    expect(m.tags.map((t) => t.tag)).toEqual(['flame']);
    expect(m.tags[0]?.thresholds).toEqual([2]);
    expect(m.tags[0]?.reached).toBe(0);
  });

  it('previews a synergy unlock when a new id crosses a threshold (K3)', () => {
    const w = shopWorld([offer({ isNewId: true })], 1);
    const m = buildShopModel(w, data);
    const card = m.offers[0];
    if (card === undefined) throw new Error('missing offer');
    const p = tagPreview(m, data, card);
    expect(p).toEqual([
      {
        tag: 'flame',
        count: 1,
        newCount: 2,
        isNewTag: false,
        unlockDescKey: 'syn.flame.2',
        // Placeholder values come from the synergy's effects (string-table 4).
        unlockParams: ownerTextParams(data, 'syn_flame_2'),
      },
    ]);
  });

  it('adds nothing to tag counts for a copy of an owned id (GDD 8.1)', () => {
    const w = shopWorld([offer({ isNewId: false })], 1);
    const m = buildShopModel(w, data);
    const card = m.offers[0];
    if (card === undefined) throw new Error('missing offer');
    expect(tagPreview(m, data, card)[0]?.unlockDescKey).toBeNull();
    expect(tagPreview(m, data, card)[0]?.newCount).toBe(1);
  });

  it('marks tags the player does not own yet as new in the preview', () => {
    const w = shopWorld([offer({ defIndex: W_SHARD })]);
    const m = buildShopModel(w, data);
    const card = m.offers[0];
    if (card === undefined) throw new Error('missing offer');
    const p = tagPreview(m, data, card);
    expect(p.map((x) => [x.tag, x.isNewTag])).toEqual([
      ['shard', true],
      ['edge', true],
    ]);
  });

  it('focuses the first buyable offer first, or none', () => {
    const w = shopWorld([offer({ affordable: false }), offer({})]);
    expect(initialOfferFocus(buildShopModel(w, data))).toBe(1);
    const none = shopWorld([offer({ affordable: false })]);
    expect(initialOfferFocus(buildShopModel(none, data))).toBe(-1);
  });

  it('allows a free reroll even without Glint', () => {
    const w = shopWorld([]);
    pl(w).glint = 0;
    w.shop = { ...w.shop, freeRerolls: 1 };
    expect(buildShopModel(w, data).canReroll).toBe(true);
    w.shop = { ...w.shop, freeRerolls: 0 };
    expect(buildShopModel(w, data).canReroll).toBe(false);
  });
});

describe('Glazier Sell and Fuse hotkeys target (review M1 LP)', () => {
  it('acts only on a focused inventory slot', () => {
    expect(focusedSlotIndex('shop-slot-1')).toBe(0);
    expect(focusedSlotIndex('shop-slot-6')).toBe(5);
    expect(focusedSlotIndex('shop-offer-2')).toBe(-1);
    expect(focusedSlotIndex('shop-sell')).toBe(-1);
    expect(focusedSlotIndex('')).toBe(-1);
  });
});
