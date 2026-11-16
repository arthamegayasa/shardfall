// The Glazier model (ui-spec S05). Built only when shop.revision changes. The sim owns every rule:
// prices, affordability, Fuse targets and blocked slots come from ShopView (K2). Tag previews use
// the shared pure rule synergyTierFor (K3).

import type { GameData, TagId } from '../../content/index.ts';
import { synergyTierFor } from '../../content/index.ts';
import { OfferKind } from '../../core/index.ts';
import type { ShopOfferView, WorldView } from '../../core/index.ts';
import { mementoInfo, mementoRarityOrder, synergiesOf, weaponInfo } from './content.ts';
import type { ItemInfo } from './content.ts';

export type OfferState = 'empty' | 'weapon' | 'memento' | 'taken';

export interface OfferCard {
  readonly slot: number;
  readonly state: OfferState;
  readonly item: ItemInfo | null;
  /** Weapon tier 1..4; for Mementos rarity order + 1. */
  readonly tier: number;
  /** 0 Plain .. 3 Fabled, drives frame colour and rarity pips. */
  readonly rarityOrder: number;
  readonly isWeapon: boolean;
  readonly price: number;
  readonly locked: boolean;
  readonly affordable: boolean;
  /** Inventory slot that fuses on purchase, -1 when none. */
  readonly fuseSlot: number;
  readonly fuseTier: number;
  readonly blockedNoSlot: boolean;
  readonly isNewId: boolean;
  /** Can be bought right now (not empty, not taken, affordable, not blocked). */
  readonly buyable: boolean;
}

export interface InventorySlot {
  readonly slot: number;
  readonly empty: boolean;
  readonly item: ItemInfo | null;
  readonly tier: number;
  readonly sellPrice: number;
  readonly canFuse: boolean;
}

export interface MementoChip {
  readonly mementoIndex: number;
  readonly item: ItemInfo | null;
  readonly count: number;
  readonly rarityOrder: number;
}

export interface TagRow {
  readonly tag: TagId;
  readonly count: number;
  /** Ascending thresholds from synergies.csv (for pips). */
  readonly thresholds: readonly number[];
  /** Highest threshold reached (0 none). */
  readonly reached: number;
}

export interface ShopModel {
  readonly revision: number;
  readonly glint: number;
  readonly hp: number;
  readonly maxHp: number;
  /** 1-based number of the next Pulse. */
  readonly nextPulse: number;
  readonly rerollPrice: number;
  readonly freeRerolls: number;
  readonly canReroll: boolean;
  readonly offers: readonly OfferCard[];
  readonly inventory: readonly InventorySlot[];
  readonly mementos: readonly MementoChip[];
  /** Owned tags only (count > 0), in data order. */
  readonly tags: readonly TagRow[];
}

function offerState(kind: number): OfferState {
  if (kind === OfferKind.Weapon) return 'weapon';
  if (kind === OfferKind.Memento) return 'memento';
  if (kind === OfferKind.Taken) return 'taken';
  return 'empty';
}

function offerCard(data: GameData, o: ShopOfferView, slot: number): OfferCard {
  const state = offerState(o.kind);
  const isWeapon = state === 'weapon';
  const isMemento = state === 'memento';
  let item: ItemInfo | null = null;
  if (isWeapon) item = weaponInfo(data, o.defIndex);
  else if (isMemento) item = mementoInfo(data, o.defIndex);
  const rarityOrder = isMemento ? mementoRarityOrder(data, o.defIndex) : Math.max(0, o.tier - 1);
  return {
    slot,
    state,
    item,
    tier: o.tier,
    rarityOrder,
    isWeapon,
    price: o.price,
    locked: o.locked,
    affordable: o.affordable,
    fuseSlot: o.mergeSlot,
    fuseTier: o.mergeSlot >= 0 ? o.mergeToTier : 0,
    blockedNoSlot: o.blockedNoSlot,
    isNewId: o.isNewId,
    buyable: (isWeapon || isMemento) && o.affordable && !o.blockedNoSlot,
  };
}

export function buildShopModel(view: WorldView, data: GameData): ShopModel {
  const shop = view.shop;
  const offers = shop.offers.map((o, i) => offerCard(data, o, i));
  const inventory = shop.inventory.map((s, i): InventorySlot => {
    const empty = s.weaponIndex < 0;
    return {
      slot: i,
      empty,
      item: empty ? null : weaponInfo(data, s.weaponIndex),
      tier: s.tier,
      sellPrice: s.sellPrice,
      canFuse: !empty && s.canMerge,
    };
  });
  const mementos = shop.mementos.map((m): MementoChip => ({
    mementoIndex: m.mementoIndex,
    item: mementoInfo(data, m.mementoIndex),
    count: m.count,
    rarityOrder: mementoRarityOrder(data, m.mementoIndex),
  }));
  const tags: TagRow[] = [];
  data.tags.forEach((t, i) => {
    const count = shop.tagCounts[i] ?? 0;
    if (count <= 0) return;
    const thresholds = synergiesOf(data, t.id).map((s) => s.threshold);
    tags.push({ tag: t.id, count, thresholds, reached: synergyTierFor(count, thresholds) });
  });
  const price = shop.freeRerolls > 0 ? 0 : shop.rerollPrice;
  return {
    revision: shop.revision,
    glint: view.player.glint,
    hp: view.player.hp,
    maxHp: view.player.maxHp,
    nextPulse: view.pulse.index + 2,
    rerollPrice: shop.rerollPrice,
    freeRerolls: shop.freeRerolls,
    canReroll: view.player.glint >= price,
    offers,
    inventory,
    mementos,
    tags,
  };
}

export interface TagPreview {
  readonly tag: TagId;
  readonly count: number;
  readonly newCount: number;
  /** Tag not owned before this purchase. */
  readonly isNewTag: boolean;
  /** Description key of the synergy tier this purchase would unlock, null when none. */
  readonly unlockDescKey: string | null;
}

/**
 * What buying this offer does to the Tag panel (ui-spec S05 "Pratinjau sinergi"). Tag counts rise
 * only for a new id (GDD 8.1, ShopOfferView.isNewId). Empty for empty and taken offers.
 */
export function tagPreview(model: ShopModel, data: GameData, offer: OfferCard): TagPreview[] {
  if (offer.item === null) return [];
  const add = offer.isNewId ? 1 : 0;
  return offer.item.tags.map((tag) => {
    const count = model.tags.find((r) => r.tag === tag)?.count ?? 0;
    const syn = synergiesOf(data, tag);
    const thresholds = syn.map((s) => s.threshold);
    const before = synergyTierFor(count, thresholds);
    const after = synergyTierFor(count + add, thresholds);
    const unlock =
      after > before ? (syn.find((s) => s.threshold === after)?.descKey ?? null) : null;
    return { tag, count, newCount: count + add, isNewTag: count === 0, unlockDescKey: unlock };
  });
}

/** Initial focus: first buyable offer, else -1 (caller focuses Begin Pulse). ui-spec S05. */
export function initialOfferFocus(model: ShopModel): number {
  return model.offers.findIndex((o) => o.buyable);
}
