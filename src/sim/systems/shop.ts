// The Glazier (GDD 4.3, 4.4, 12; gd-answers Q12, Q26 to Q29): offers, buy with Fuse on full slots,
// reroll, lock, sell, manual Fuse (shop.merge). Prices from content/rules priceFor.

import { OfferKind, RejectReason, SimEventType } from '../../core/index.ts';
import type { InventorySlotView, ShopOfferView } from '../../core/index.ts';
import { priceFor } from '../../content/index.ts';
import { WEAPON_MAX_TIER } from '../capacity.ts';
import type { OfferState, SimCtx } from '../ctx.ts';
import { rebuildActiveEffects } from '../effects/active.ts';
import { acquireMemento, mementoOfferable, rarityWeights, weightedPick } from './progression.ts';

function luckOf(ctx: SimCtx): number {
  const i = ctx.sd.stat.luck;
  return i >= 0 ? (ctx.world.player.stats[i] ?? 0) : 0;
}

function crackPriceMult(ctx: SimCtx): number {
  return ctx.run.diff?.priceMult ?? 1;
}

export function offerPrice(ctx: SimCtx, o: OfferState): number {
  const { sd, cfg, run, data } = ctx;
  if (o.kind === OfferKind.Weapon) {
    const base = sd.rarityByOrder[o.tier - 1]?.weaponPrice ?? 0;
    return priceFor(base, run.threat, cfg.priceGrowth, crackPriceMult(ctx), run.shopPriceMult);
  }
  if (o.kind === OfferKind.Memento) {
    const def = data.mementos[o.defIndex];
    const base =
      def?.priceOverride ?? sd.rarityByOrder[sd.mementoRarity[o.defIndex] ?? 0]?.mementoPrice ?? 0;
    return priceFor(base, run.threat, cfg.priceGrowth, crackPriceMult(ctx), run.shopPriceMult);
  }
  return 0;
}

/** Sell price (GDD 4.4): floor(sell_frac x weapon_price(tier) x (1 + growth x (t - 1))), no Crack or Memento mult. */
export function sellPrice(ctx: SimCtx, tier: number): number {
  const base = ctx.sd.rarityByOrder[tier - 1]?.weaponPrice ?? 0;
  return Math.floor(
    ctx.data.shop.sellFrac * base * (1 + ctx.cfg.priceGrowth * (ctx.run.threat - 1)),
  );
}

/** Reroll price: reroll_base_add + ceil(t / reroll_t_div) + reroll_step x n + reroll_delta, min 1. */
export function rerollPrice(ctx: SimCtx): number {
  const sh = ctx.data.shop;
  const run = ctx.run;
  const div = sh.rerollTDiv > 0 ? sh.rerollTDiv : 1;
  const v =
    sh.rerollBaseAdd +
    Math.ceil(run.threat / div) +
    sh.rerollStep * run.rerollCount +
    run.shopRerollDelta;
  return Math.max(1, v);
}

function freeRerollsLeft(ctx: SimCtx): number {
  return Math.max(0, ctx.run.shopFreeRerolls - ctx.run.freeRerollsUsed);
}

function weaponSlotsOf(ctx: SimCtx): number {
  return ctx.run.weaponIndex.length;
}

function firstEmptySlot(ctx: SimCtx): number {
  const w = ctx.run.weaponIndex;
  for (let i = 0; i < w.length; i++) if (w[i] === -1) return i;
  return -1;
}

/** Lowest slot other than `not` holding the same weapon id and tier (below IV), or -1. */
function mergePartner(ctx: SimCtx, wi: number, tier: number, not: number): number {
  const run = ctx.run;
  if (tier >= WEAPON_MAX_TIER) return -1;
  for (let i = 0; i < run.weaponIndex.length; i++) {
    if (i !== not && run.weaponIndex[i] === wi && run.weaponTier[i] === tier) return i;
  }
  return -1;
}

function ownsWeapon(ctx: SimCtx, wi: number): boolean {
  for (const w of ctx.run.weaponIndex) if (w === wi) return true;
  return false;
}

/** Rebuild ShopView from the shop state (only when something changed). */
export function refreshShopView(ctx: SimCtx): void {
  const { world, run, sd } = ctx;
  const glint = world.player.glint;
  const offers: ShopOfferView[] = run.offers.map((o) => {
    const price = offerPrice(ctx, o);
    let mergeSlot = -1;
    let mergeToTier = 0;
    let blocked = false;
    let isNew = false;
    if (o.kind === OfferKind.Weapon) {
      const hasFree = firstEmptySlot(ctx) >= 0;
      const partner = hasFree ? -1 : mergePartner(ctx, o.defIndex, o.tier, -1);
      if (partner >= 0) {
        mergeSlot = partner;
        mergeToTier = o.tier + 1;
      }
      blocked = !hasFree && partner < 0;
      isNew = !ownsWeapon(ctx, o.defIndex);
    } else if (o.kind === OfferKind.Memento) {
      isNew = (run.mementoCount[o.defIndex] ?? 0) === 0;
    }
    const tier = o.kind === OfferKind.Memento ? (sd.mementoRarity[o.defIndex] ?? 0) + 1 : o.tier;
    return {
      kind: o.kind,
      defIndex: o.defIndex,
      tier,
      price,
      locked: o.locked,
      affordable: glint >= price,
      mergeSlot,
      mergeToTier,
      blockedNoSlot: blocked,
      isNewId: isNew,
    };
  });
  const inv: InventorySlotView[] = [];
  for (let i = 0; i < weaponSlotsOf(ctx); i++) {
    const wi = run.weaponIndex[i] ?? -1;
    const tier = run.weaponTier[i] ?? 0;
    inv.push({
      weaponIndex: wi,
      tier: wi >= 0 ? tier : 0,
      sellPrice: wi >= 0 ? sellPrice(ctx, tier) : 0,
      canMerge: wi >= 0 && mergePartner(ctx, wi, tier, i) >= 0,
    });
  }
  world.shop.offers = offers;
  world.shop.inventory = inv;
  world.shop.mementos = run.mementoOrder.map((m) => ({
    mementoIndex: m,
    count: run.mementoCount[m] ?? 0,
  }));
  world.shop.rerollPrice = rerollPrice(ctx);
  world.shop.freeRerolls = freeRerollsLeft(ctx);
  world.shop.revision++;
}

/** Shop tag weight (GDD 12): class tag x class_tag_weight, shares an owned tag x owned_tag_weight. */
function tagWeight(ctx: SimCtx, mask: number): number {
  const { data, run, world } = ctx;
  let w = 1;
  const cls = data.classes[run.classIndex];
  const ci = cls !== undefined ? data.tags.findIndex((t) => t.id === cls.tag) : -1;
  if (ci >= 0 && (mask & (1 << ci)) !== 0) w *= data.shop.classTagWeight;
  for (let t = 0; t < ctx.sd.tagCount; t++) {
    if ((mask & (1 << t)) !== 0 && (world.shop.tagCounts[t] ?? 0) >= 1) {
      w *= data.shop.ownedTagWeight;
      break;
    }
  }
  return w;
}

function inOffers(offers: readonly OfferState[], kind: number, def: number, skip: number): boolean {
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i];
    if (i !== skip && o !== undefined && o.kind === kind && o.defIndex === def) return true;
  }
  return false;
}

/** Roll one offer into slot `at` (GDD 12). */
function rollOffer(ctx: SimCtx, offers: OfferState[], at: number): OfferState {
  const { data, sd, run } = ctx;
  const rng = ctx.rng.shop;
  const weights: number[] = [];
  rarityWeights(ctx, run.threat, luckOf(ctx), 0, weights);
  const isWeapon = rng.chance(data.shop.weaponChance);
  let rarity = weightedPick(rng, weights);
  if (rarity < 0) rarity = 0;
  if (isWeapon) {
    // Merge push: a copy of an owned weapon (tier below IV) at the same tier.
    if (rng.chance(data.shop.mergePushChance)) {
      const owned: number[] = [];
      for (let i = 0; i < run.weaponIndex.length; i++) {
        const wi = run.weaponIndex[i] ?? -1;
        if (
          wi >= 0 &&
          (run.weaponTier[i] ?? 0) < WEAPON_MAX_TIER &&
          !inOffers(offers, OfferKind.Weapon, wi, at)
        )
          owned.push(i);
      }
      if (owned.length > 0) {
        const s = owned[rng.int(owned.length)] ?? 0;
        return {
          kind: OfferKind.Weapon,
          defIndex: run.weaponIndex[s] ?? 0,
          tier: run.weaponTier[s] ?? 1,
          locked: false,
          boughtKind: OfferKind.Weapon,
        };
      }
    }
    const ws: number[] = [];
    for (let w = 0; w < data.weapons.length; w++) {
      const def = data.weapons[w];
      if (
        def === undefined ||
        run.weaponOpen[w] !== 1 ||
        inOffers(offers, OfferKind.Weapon, w, at)
      ) {
        ws.push(0);
        continue;
      }
      ws.push(tagWeight(ctx, sd.weapons[w]?.tagMask ?? 0));
    }
    const pick = weightedPick(rng, ws);
    if (pick >= 0)
      return {
        kind: OfferKind.Weapon,
        defIndex: pick,
        tier: rarity + 1,
        locked: false,
        boughtKind: OfferKind.Weapon,
      };
  }
  // Memento: rarity pool, empty pool steps down then up (GDD 12).
  let r = rarity;
  let down = true;
  for (let step = 0; step < sd.rarityByOrder.length * 2; step++) {
    const ms: number[] = [];
    let any = false;
    for (let m = 0; m < data.mementos.length; m++) {
      const ok =
        sd.mementoRarity[m] === r &&
        mementoOfferable(ctx, m) &&
        !inOffers(offers, OfferKind.Memento, m, at);
      const w = ok ? tagWeight(ctx, sd.mementoTagMask[m] ?? 0) : 0;
      if (ok) any = true;
      ms.push(w);
    }
    if (any) {
      const pick = weightedPick(rng, ms);
      if (pick >= 0)
        return {
          kind: OfferKind.Memento,
          defIndex: pick,
          tier: r + 1,
          locked: false,
          boughtKind: OfferKind.Memento,
        };
    }
    if (down && r > 0) r--;
    else {
      if (down) {
        down = false;
        r = rarity;
      }
      r++;
      if (r >= sd.rarityByOrder.length) break;
    }
  }
  return {
    kind: OfferKind.Empty,
    defIndex: -1,
    tier: 0,
    locked: false,
    boughtKind: OfferKind.Empty,
  };
}

/** Is a locked offer still valid when the shop opens (Memento max stack reached elsewhere)? */
function offerValid(ctx: SimCtx, o: OfferState): boolean {
  if (o.kind === OfferKind.Memento) return mementoOfferable(ctx, o.defIndex);
  return o.kind === OfferKind.Weapon;
}

function offerCount(ctx: SimCtx): number {
  return Math.max(1, ctx.data.shop.slots + Math.floor(ctx.run.shopSlotsAdd));
}

/** Fill every unlocked slot (shop open and reroll). Locked invalid offers are replaced on open. */
export function fillOffers(ctx: SimCtx, opening: boolean): void {
  const run = ctx.run;
  const n = offerCount(ctx);
  const next: OfferState[] = [];
  for (let i = 0; i < n; i++) {
    const old = run.offers[i];
    if (old?.locked === true && (!opening || offerValid(ctx, old))) next.push(old);
    else
      next.push({
        kind: OfferKind.Empty,
        defIndex: -1,
        tier: 0,
        locked: false,
        boughtKind: OfferKind.Empty,
      });
  }
  for (let i = 0; i < n; i++) {
    if (next[i]?.locked === true) continue;
    next[i] = rollOffer(ctx, next, i);
  }
  run.offers = next;
}

export function openShop(ctx: SimCtx): void {
  ctx.run.rerollCount = 0;
  ctx.run.freeRerollsUsed = 0;
  fillOffers(ctx, true);
  refreshShopView(ctx);
}

function reject(ctx: SimCtx, reason: number): void {
  ctx.events.push(SimEventType.CommandRejected, 0, 0, reason, 0, 0);
}

function spend(ctx: SimCtx, amount: number): void {
  const p = ctx.world.player;
  p.glint -= amount;
  ctx.world.runStats.glintSpent += amount;
  if (ctx.run.glintConvert) ctx.run.statsDirty = true;
}

export function shopBuy(ctx: SimCtx, offer: number): void {
  const { run, world } = ctx;
  const o = run.offers[offer];
  if (o === undefined || o.kind === OfferKind.Empty || o.kind === OfferKind.Taken) {
    reject(ctx, RejectReason.InvalidSlot);
    return;
  }
  const price = offerPrice(ctx, o);
  if (world.player.glint < price) {
    reject(ctx, RejectReason.NotEnoughGlint);
    return;
  }
  if (o.kind === OfferKind.Weapon) {
    const free = firstEmptySlot(ctx);
    if (free >= 0) {
      run.weaponIndex[free] = o.defIndex;
      run.weaponTier[free] = o.tier;
      run.weaponCd[free] = 0;
    } else {
      const partner = mergePartner(ctx, o.defIndex, o.tier, -1);
      if (partner < 0) {
        reject(ctx, RejectReason.SlotsFull);
        return;
      }
      run.weaponTier[partner] = o.tier + 1;
      ctx.events.push(SimEventType.ItemMerged, 0, 0, o.defIndex, o.tier + 1, 0);
    }
    spend(ctx, price);
    rebuildActiveEffects(ctx, true);
  } else {
    if (!mementoOfferable(ctx, o.defIndex)) {
      reject(ctx, RejectReason.MaxStack);
      return;
    }
    spend(ctx, price);
    acquireMemento(ctx, o.defIndex, true);
  }
  ctx.events.push(SimEventType.ItemBought, 0, 0, o.kind, o.defIndex, o.tier);
  run.offers[offer] = {
    kind: OfferKind.Taken,
    defIndex: o.defIndex,
    tier: o.tier,
    locked: false,
    boughtKind: o.kind,
  };
}

export function shopReroll(ctx: SimCtx): void {
  const run = ctx.run;
  let cost = 0;
  if (freeRerollsLeft(ctx) > 0) {
    run.freeRerollsUsed++;
  } else {
    cost = rerollPrice(ctx);
    if (ctx.world.player.glint < cost) {
      reject(ctx, RejectReason.NotEnoughGlint);
      return;
    }
    spend(ctx, cost);
    run.rerollCount++;
  }
  fillOffers(ctx, false);
  ctx.events.push(SimEventType.ShopRerolled, 0, 0, cost, 0, 0);
}

export function shopLock(ctx: SimCtx, offer: number, locked: boolean): void {
  const o = ctx.run.offers[offer];
  if (o === undefined || o.kind === OfferKind.Empty || o.kind === OfferKind.Taken) {
    reject(ctx, RejectReason.InvalidSlot);
    return;
  }
  o.locked = locked;
  ctx.events.push(SimEventType.ItemLocked, 0, 0, offer, locked ? 1 : 0, 0);
}

export function shopSell(ctx: SimCtx, slot: number): void {
  const run = ctx.run;
  const wi = run.weaponIndex[slot];
  if (wi === undefined || wi < 0) {
    reject(ctx, RejectReason.InvalidSlot);
    return;
  }
  let owned = 0;
  for (const w of run.weaponIndex) if (w >= 0) owned++;
  if (owned <= 1) {
    reject(ctx, RejectReason.InvalidSlot);
    return;
  }
  const tier = run.weaponTier[slot] ?? 1;
  const got = sellPrice(ctx, tier);
  run.weaponIndex[slot] = -1;
  run.weaponTier[slot] = 0;
  ctx.world.player.glint += got;
  if (run.glintConvert) run.statsDirty = true;
  rebuildActiveEffects(ctx, true);
  ctx.events.push(SimEventType.ItemSold, 0, 0, wi, tier, got);
}

export function shopMerge(ctx: SimCtx, slot: number): void {
  const run = ctx.run;
  const wi = run.weaponIndex[slot];
  if (wi === undefined || wi < 0) {
    reject(ctx, RejectReason.InvalidSlot);
    return;
  }
  const tier = run.weaponTier[slot] ?? 1;
  const partner = mergePartner(ctx, wi, tier, slot);
  if (partner < 0) {
    reject(ctx, RejectReason.NotMergeable);
    return;
  }
  // Result goes to the lower slot index of the two; the other becomes empty (GDD 4.4).
  const keep = Math.min(slot, partner);
  const drop = Math.max(slot, partner);
  run.weaponTier[keep] = tier + 1;
  run.weaponIndex[drop] = -1;
  run.weaponTier[drop] = 0;
  rebuildActiveEffects(ctx, true);
  ctx.events.push(SimEventType.ItemMerged, 0, 0, wi, tier + 1, 0);
}
