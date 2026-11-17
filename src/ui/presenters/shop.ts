// The Shop model (ui-spec S05, redesign-1.1 3.1). Built only when shop.revision changes. The sim
// owns every rule: prices, affordability, Combine targets and blocked slots come from ShopView
// (K2). Tag previews use the shared pure rule synergyTierFor (K3). The presenter only turns those
// facts into plain lines: what a purchase does (outcome), what it did (toast), Combine status.

import type { GameData, TagId } from '../../content/index.ts';
import { synergyTierFor } from '../../content/index.ts';
import { OfferKind } from '../../core/index.ts';
import type { ShopOfferView, ShopView, WorldView } from '../../core/index.ts';
import type { StringParams } from '../../core/index.ts';
import { mementoInfo, mementoRarityOrder, synergiesOf, weaponInfo } from './content.ts';
import type { ItemInfo } from './content.ts';

export type OfferState = 'empty' | 'weapon' | 'memento' | 'taken';

/** What buying an offer does to the hero (redesign-1.1 3.1). */
export type OfferOutcomeKind =
  'new-weapon' | 'copy' | 'combine' | 'blocked' | 'new-relic' | 'relic-stack';

/** One plain outcome line: string key plus its numbers ({n} owned relics, {tier} after Combine). */
export interface OfferOutcome {
  readonly kind: OfferOutcomeKind;
  readonly key: string;
  /** Relics of this id already owned (relic-stack), else 0. */
  readonly count: number;
  /** Tier after the purchase combines (combine), else 0. */
  readonly tier: number;
}

/** Highest weapon tier (mirrors the sim's WEAPON_MAX_TIER; ui.tier.4 is the last label). */
const WEAPON_TOP_TIER = 4;

export interface OfferCard {
  readonly slot: number;
  readonly state: OfferState;
  /** WeaponIndex or MementoIndex from the view (-1 meaning none is never sent by the sim). */
  readonly defIndex: number;
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
  /** What buying it does; null for empty and taken offers. */
  readonly outcome: OfferOutcome | null;
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
  /** Pulses in this run profile ("Wave 2 of 15"). */
  readonly totalPulses: number;
  /** Inventory slots holding a weapon, and all weapon slots ("2 of 6"). */
  readonly weaponsOwned: number;
  readonly weaponSlots: number;
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

function outcome(kind: OfferOutcomeKind, key: string, count = 0, tier = 0): OfferOutcome {
  return { kind, key, count, tier };
}

/**
 * The purchase outcome of one offer, from the sim's facts only (redesign-1.1 3.1). Weapons: the
 * sim blocks first, then combines when the slots are full (mergeSlot), else a free slot takes a new
 * id or another copy (both copies fire). Relics: new, or a stack on the owned count.
 */
export function offerOutcome(
  o: ShopOfferView,
  ownedRelics: readonly { readonly mementoIndex: number; readonly count: number }[],
): OfferOutcome | null {
  if (o.kind === OfferKind.Weapon) {
    if (o.blockedNoSlot) return outcome('blocked', 'ui.shop.slots_full');
    if (o.mergeSlot >= 0) return outcome('combine', 'ui.shop.out_combine', 0, o.mergeToTier);
    if (o.isNewId) return outcome('new-weapon', 'ui.shop.out_new_weapon');
    return outcome('copy', 'ui.shop.out_copy');
  }
  if (o.kind === OfferKind.Memento) {
    const owned = ownedRelics.find((m) => m.mementoIndex === o.defIndex)?.count ?? 0;
    if (o.isNewId || owned <= 0) return outcome('new-relic', 'ui.shop.out_new_relic');
    return outcome('relic-stack', 'ui.shop.out_relic_stack', owned);
  }
  return null;
}

function offerCard(
  data: GameData,
  o: ShopOfferView,
  slot: number,
  ownedRelics: ShopView['mementos'],
): OfferCard {
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
    defIndex: o.defIndex,
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
    outcome: offerOutcome(o, ownedRelics),
  };
}

export function buildShopModel(view: WorldView, data: GameData): ShopModel {
  const shop = view.shop;
  const offers = shop.offers.map((o, i) => offerCard(data, o, i, shop.mementos));
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
    totalPulses: view.pulse.count,
    weaponsOwned: inventory.filter((s) => !s.empty).length,
    weaponSlots: inventory.length,
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
  readonly unlockParams: StringParams;
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
    const step = after > before ? syn.find((s) => s.threshold === after) : undefined;
    return {
      tag,
      count,
      newCount: count + add,
      isNewTag: count === 0,
      unlockDescKey: step?.descKey ?? null,
      unlockParams: step?.params ?? {},
    };
  });
}

/** Initial focus: first buyable offer, else -1 (caller focuses Begin Pulse). ui-spec S05. */
export function initialOfferFocus(model: ShopModel): number {
  return model.offers.findIndex((o) => o.buyable);
}

/** Inventory slot index from a focused control's data-ui ("shop-slot-3" -> 2), -1 otherwise. */
export function focusedSlotIndex(dataUi: string): number {
  const m = /^shop-slot-(\d+)$/.exec(dataUi);
  return m?.[1] === undefined ? -1 : Number(m[1]) - 1;
}

export interface ToastInput {
  readonly isWeapon: boolean;
  readonly nameKey: string;
  /** Tier the purchase combined into, 0 when it took a free slot. */
  readonly combinedTier: number;
  /** Weapons owned after the purchase. */
  readonly weaponsOwned: number;
  /** Copies of the bought relic owned after the purchase. */
  readonly relicCount: number;
}

export interface ToastLine {
  readonly key: string;
  readonly nameKey: string;
  readonly count: number;
  readonly tier: number;
}

/** The line shown after a purchase (redesign-1.1 3.1): what the hero has now. */
export function purchaseToast(p: ToastInput): ToastLine {
  const line = (key: string, count: number, tier = 0): ToastLine => ({
    key,
    nameKey: p.nameKey,
    count,
    tier,
  });
  if (!p.isWeapon) {
    return p.relicCount > 1
      ? line('ui.shop.toast_relic_stack', p.relicCount)
      : line('ui.shop.toast_relic', p.relicCount);
  }
  if (p.combinedTier > 0) return line('ui.shop.toast_combined', p.weaponsOwned, p.combinedTier);
  if (p.weaponsOwned === 1) return line('ui.shop.toast_added_one', 1);
  return line('ui.shop.toast_added', p.weaponsOwned);
}

export interface SlotCombine {
  readonly key: string;
  /** Tier after a Combine when ready; the slot's own tier otherwise. */
  readonly tier: number;
  readonly ready: boolean;
}

/** Combine availability of an owned weapon slot, for the selected-slot detail. */
export function slotCombine(s: InventorySlot): SlotCombine {
  if (s.canFuse) return { key: 'ui.shop.combine_ready', tier: s.tier + 1, ready: true };
  if (s.tier >= WEAPON_TOP_TIER) return { key: 'ui.shop.combine_top', tier: s.tier, ready: false };
  return { key: 'ui.shop.combine_need', tier: s.tier, ready: false };
}

export interface TagStep {
  readonly threshold: number;
  readonly descKey: string;
  readonly params: StringParams;
  /** True when count already meets this (the highest) threshold. */
  readonly reached: boolean;
}

/**
 * What a tag does next at `count` copies (redesign-1.1 3.1, "hovering a tag shows what the synergy
 * does"): the first threshold above count, or the highest one once reached. Null without synergies.
 */
export function tagNextStep(data: GameData, tag: TagId, count: number): TagStep | null {
  const steps = synergiesOf(data, tag);
  const next = steps.find((s) => s.threshold > count) ?? steps[steps.length - 1];
  if (next === undefined) return null;
  return {
    threshold: next.threshold,
    descKey: next.descKey,
    params: next.params,
    reached: count >= next.threshold,
  };
}
