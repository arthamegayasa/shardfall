// K12, K13, K14: Glint, XP and level-up, shop (GDD 4, 11, 12).

import { describe, expect, it } from 'vitest';
import { OfferKind, RejectReason, SimEventType } from '../../../src/core/index.ts';
import { priceFor } from '../../../src/content/index.ts';
import { dropGlint, sweepPickups } from '../../../src/sim/systems/pickups.ts';
import { rerollPrice, sellPrice } from '../../../src/sim/systems/shop.ts';
import { harness, idOf, stepUntil } from './support/harness.ts';
import type { Harness } from './support/harness.ts';

function toShop(h: Harness): void {
  h.send({ type: 'debug.endPulse' });
  h.step();
  stepUntil(
    h,
    () => {
      if (h.sim.view.phase === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
      if (h.sim.view.phase === 'reward') h.send({ type: 'reward.pick', choice: 0 });
      return h.sim.view.phase === 'shop';
    },
    600,
  );
}

describe('Glint (K12)', () => {
  it('drops on kill, flies within the pickup radius, is collected and gives XP', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.send({ type: 'debug.spawn', enemyId: 'swarmer', x: 3, y: 0, count: 1 });
    expect(stepUntil(h, () => h.of(SimEventType.GlintDropped).length > 0, 300)).toBe(true);
    const value = h.data.enemies[idOf(h.data.enemies, 'swarmer')]?.glint ?? 0;
    expect(h.of(SimEventType.GlintDropped)[0]?.a).toBe(value);
    // Walk to it.
    h.input.moveX = 127;
    expect(stepUntil(h, () => h.of(SimEventType.GlintCollected).length > 0, 300)).toBe(true);
    expect(h.sim.view.player.glint).toBe(value);
    expect(h.sim.view.player.xp).toBe(value);
  });

  it('merges value into the nearest floor piece above glint_floor_cap (no value lost)', () => {
    const h = harness();
    h.start();
    h.quiet();
    const cap = h.data.config.glintFloorCap;
    for (let i = 0; i < cap + 10; i++) dropGlint(h.ctx, 10, (i % 10) - 5, 1);
    const pk = h.ctx.world.pickups;
    let total = 0;
    for (let i = 0; i < pk.highWater; i++) if (pk.alive[i] === 1) total += pk.amount[i] ?? 0;
    expect(pk.count).toBe(cap);
    expect(total).toBe(cap + 10);
  });

  it('sweeps floor(total x pulse_end_collect_frac) at the end of a Pulse, as XP without on_pickup', () => {
    const h = harness();
    h.start();
    h.quiet();
    for (let i = 0; i < 7; i++) dropGlint(h.ctx, 12, 0, 1);
    const g0 = h.sim.view.player.glint;
    sweepPickups(h.ctx, h.data.config.pulseEndCollectFrac);
    const got = Math.floor(7 * h.data.config.pulseEndCollectFrac);
    expect(h.sim.view.player.glint - g0).toBe(got);
    expect(h.ctx.world.pickups.count).toBe(0);
  });
});

describe('XP and level-up (K13)', () => {
  it('levels at xp_base + xp_per_level x L and offers 3 distinct stat cards', () => {
    const h = harness();
    h.start();
    h.quiet();
    const need = h.data.config.xpBase + h.data.config.xpPerLevel * 1;
    expect(h.sim.view.player.xpToNext).toBe(need);
    for (let i = 0; i < need; i++) dropGlint(h.ctx, 0.2, 0, 1);
    h.step(5);
    expect(h.sim.view.player.level).toBe(2);
    expect(h.of(SimEventType.PlayerLeveledUp)).toHaveLength(1);
    h.send({ type: 'debug.endPulse' });
    h.step();
    expect(stepUntil(h, () => h.sim.view.phase === 'levelUp', 200)).toBe(true);
    const choices = h.sim.view.levelUp.choices;
    expect(choices).toHaveLength(3);
    const stats = choices.map((c) => h.data.levelUpCards[c.cardIndex]?.stat);
    expect(new Set(stats).size).toBe(3);
  });

  it('applies the chosen card; a max_hp card also raises current HP', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.ctx.run.pendingLevelUps = 1;
    h.send({ type: 'debug.endPulse' });
    h.step();
    expect(stepUntil(h, () => h.sim.view.phase === 'levelUp', 200)).toBe(true);
    const card = idOf(h.data.levelUpCards, 'card_max_hp');
    h.ctx.run.levelChoices = [
      { cardIndex: card, rarity: 0, value: h.data.levelUpCards[card]?.plain ?? 0 },
    ];
    const hp0 = h.sim.view.player.hp;
    const max0 = h.sim.view.player.maxHp;
    h.send({ type: 'levelup.pick', choice: 0 });
    h.step();
    const v = h.data.levelUpCards[card]?.plain ?? 0;
    expect(h.sim.view.player.maxHp).toBe(max0 + v);
    expect(h.sim.view.player.hp).toBe(Math.min(hp0 + v, max0 + v));
    expect(h.sim.view.phase).toBe('shop');
  });
});

describe('shop (K14)', () => {
  it('offers shop.csv slots offers priced with priceFor', () => {
    const h = harness();
    h.start();
    toShop(h);
    const offers = h.sim.view.shop.offers;
    expect(offers).toHaveLength(h.data.shop.slots);
    const t = h.sim.view.pulse.threat;
    for (const o of offers) {
      if (o.kind === OfferKind.Weapon) {
        const base = h.data.rarities.find((r) => r.order === o.tier - 1)?.weaponPrice ?? 0;
        expect(o.price).toBe(priceFor(base, t, h.data.config.priceGrowth, 1, 1));
      } else if (o.kind === OfferKind.Memento) {
        const m = h.data.mementos[o.defIndex];
        const base =
          m?.priceOverride ?? h.data.rarities.find((r) => r.id === m?.rarity)?.mementoPrice ?? 0;
        expect(o.price).toBe(priceFor(base, t, h.data.config.priceGrowth, 1, 1));
      }
    }
  });

  it('buys, rejects without Glint, rerolls with rising cost, keeps locked offers', () => {
    const h = harness();
    h.start();
    toShop(h);
    h.ctx.world.player.glint = 0;
    h.send({ type: 'shop.buy', offer: 0 });
    h.step();
    expect(h.of(SimEventType.CommandRejected).at(-1)?.a).toBe(RejectReason.NotEnoughGlint);
    h.send({ type: 'debug.glint', amount: 1000 });
    h.send({ type: 'shop.lock', offer: 1, locked: true });
    h.step();
    const locked = h.sim.view.shop.offers[1];
    const c0 = rerollPrice(h.ctx);
    h.send({ type: 'shop.reroll' });
    h.step();
    expect(rerollPrice(h.ctx)).toBe(c0 + h.data.shop.rerollStep);
    expect(h.of(SimEventType.ShopRerolled)[0]?.a).toBe(c0);
    expect(h.sim.view.shop.offers[1]?.defIndex).toBe(locked?.defIndex);
    expect(h.sim.view.shop.offers[1]?.locked).toBe(true);
    const g = h.sim.view.player.glint;
    const price = h.sim.view.shop.offers[0]?.price ?? 0;
    h.send({ type: 'shop.buy', offer: 0 });
    h.step();
    expect(h.sim.view.player.glint).toBe(g - price);
    expect(h.sim.view.shop.offers[0]?.kind).toBe(OfferKind.Taken);
    expect(h.of(SimEventType.ItemBought)).toHaveLength(1);
  });

  it('sells (not the last weapon), Fuses manually, merges on a full inventory, rejects SlotsFull', () => {
    const h = harness();
    h.start();
    toShop(h);
    const run = h.ctx.run;
    // Last weapon cannot be sold.
    h.send({ type: 'shop.sell', inventorySlot: 0 });
    h.step();
    expect(h.of(SimEventType.CommandRejected).at(-1)?.a).toBe(RejectReason.InvalidSlot);
    // Two Splinter Shots tier I: Fuse into slot of the lower index.
    const ss = idOf(h.data.weapons, 'splinter_shot');
    run.weaponIndex[3] = ss;
    run.weaponTier[3] = 1;
    run.weaponIndex[1] = ss;
    run.weaponTier[1] = 1;
    h.send({ type: 'shop.merge', inventorySlot: 3 });
    h.step();
    expect(run.weaponIndex[1]).toBe(ss);
    expect(run.weaponTier[1]).toBe(2);
    expect(run.weaponIndex[3]).toBe(-1);
    // Sell it: floor(sell_frac x weapon_price(tier) x growth).
    const g = h.sim.view.player.glint;
    const want = sellPrice(h.ctx, 2);
    h.send({ type: 'shop.sell', inventorySlot: 1 });
    h.step();
    expect(h.sim.view.player.glint - g).toBe(want);
    // Full inventory: buying a copy merges, a new weapon is rejected SlotsFull.
    const slots = run.weaponIndex.length;
    for (let i = 0; i < slots; i++) {
      run.weaponIndex[i] = i === 0 ? ss : idOf(h.data.weapons, 'arc_blade');
      run.weaponTier[i] = i === 0 ? 1 : 4;
    }
    h.ctx.world.player.glint = 1e6;
    run.offers = [
      {
        kind: OfferKind.Weapon,
        defIndex: ss,
        tier: 1,
        locked: false,
        boughtKind: OfferKind.Weapon,
      },
      {
        kind: OfferKind.Weapon,
        defIndex: idOf(h.data.weapons, 'chain_spark'),
        tier: 1,
        locked: false,
        boughtKind: OfferKind.Weapon,
      },
    ];
    h.send({ type: 'shop.buy', offer: 0 });
    h.send({ type: 'shop.buy', offer: 1 });
    h.step();
    expect(run.weaponTier[0]).toBe(2);
    expect(h.of(SimEventType.ItemMerged).at(-1)?.b).toBe(2);
    expect(h.of(SimEventType.CommandRejected).at(-1)?.a).toBe(RejectReason.SlotsFull);
  });
});
