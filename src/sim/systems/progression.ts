// Level-up cards (GDD 11.2) and the Warden or boss reward chest (GDD 13.2). Cards and chest are
// rolled when their screen shows (streams levelUp and loot), saved, and never rerolled on load.

import { SimEventType } from '../../core/index.ts';
import type { Rng } from '../../core/index.ts';
import { LEVEL_CARD_CHOICES } from '../capacity.ts';
import type { CardChoice, SimCtx } from '../ctx.ts';
import { rebuildActiveEffects } from '../effects/active.ts';

const RARITY_COLUMNS = ['plain', 'fine', 'rare', 'fabled'] as const;

/** Rarity weights for a threat with luck (GDD 13.1); rarities below minOrder get weight 0. */
export function rarityWeights(
  ctx: SimCtx,
  threat: number,
  luck: number,
  minOrder: number,
  out: number[],
): void {
  const rows = ctx.data.rarityWeights;
  let row = rows[rows.length - 1];
  for (const r of rows) {
    if (threat >= r.tMin && threat <= r.tMax) {
      row = r;
      break;
    }
  }
  out.length = 0;
  for (let o = 0; o < ctx.sd.rarityByOrder.length; o++) {
    const id = ctx.sd.rarityByOrder[o]?.id;
    const col = RARITY_COLUMNS.find((c) => c === id);
    let w = row !== undefined && col !== undefined ? row[col] : 0;
    if (o > 0) w *= 1 + luck / 100;
    out.push(o < minOrder ? 0 : w);
  }
}

/** Weighted pick of an index; returns -1 when every weight is 0. */
export function weightedPick(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) return -1;
  let r = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    if (r < w) return i;
    r -= w;
  }
  for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] ?? 0) > 0) return i;
  return -1;
}

function luckOf(ctx: SimCtx): number {
  const i = ctx.sd.stat.luck;
  return i >= 0 ? (ctx.world.player.stats[i] ?? 0) : 0;
}

/** Roll the 3 cards for the current level: distinct stats, stats at max excluded (GDD 11.2). */
export function rollLevelChoices(ctx: SimCtx): void {
  const { data, run, world } = ctx;
  const rng = ctx.rng.levelUp;
  const weightsR: number[] = [];
  rarityWeights(ctx, run.threat, luckOf(ctx), 0, weightsR);
  const pool: number[] = [];
  for (let i = 0; i < data.levelUpCards.length; i++) {
    const c = data.levelUpCards[i];
    if (c === undefined) continue;
    const si = data.stats.findIndex((s) => s.id === c.stat);
    if (si < 0) continue;
    const max = data.stats[si]?.max ?? null;
    if (max !== null && (world.player.stats[si] ?? 0) >= max) continue;
    pool.push(i);
  }
  const choices: CardChoice[] = [];
  const usedStats = new Set<string>();
  // Three cards (GDD 11.2): the count of choices is part of the screen design, not balance.
  while (choices.length < LEVEL_CARD_CHOICES) {
    const weights = pool.map((ci) => {
      const c = data.levelUpCards[ci];
      return c === undefined || usedStats.has(c.stat) ? 0 : c.weight;
    });
    const k = weightedPick(rng, weights);
    if (k < 0) break;
    const ci = pool[k] ?? 0;
    const card = data.levelUpCards[ci];
    if (card === undefined) break;
    usedStats.add(card.stat);
    let rarity = weightedPick(rng, weightsR);
    if (rarity < 0) rarity = 0;
    const col = RARITY_COLUMNS[Math.min(rarity, RARITY_COLUMNS.length - 1)] ?? 'plain';
    choices.push({ cardIndex: ci, rarity, value: card[col] });
  }
  run.levelChoices = choices;
  world.levelUp.choices = choices;
  world.levelUp.pending = run.pendingLevelUps;
  world.levelUp.total = run.levelsThisPulse;
  world.levelUp.revision++;
  ctx.events.push(SimEventType.LevelUpCardsShown, 0, 0, choices.length, 0, 0);
}

/** Apply a chosen card. Returns false when the choice index is invalid. */
export function pickLevelCard(ctx: SimCtx, choice: number): boolean {
  const { data, run, world, sd } = ctx;
  const c = run.levelChoices[choice];
  if (c === undefined) return false;
  const card = data.levelUpCards[c.cardIndex];
  if (card === undefined) return false;
  const si = data.stats.findIndex((s) => s.id === card.stat);
  if (si >= 0) run.statCardAdd[si] = (run.statCardAdd[si] ?? 0) + c.value;
  run.levelUpPicks.push({ cardIndex: c.cardIndex, rarity: c.rarity });
  run.pendingLevelUps = Math.max(0, run.pendingLevelUps - 1);
  run.statsDirty = true;
  // max_hp cards also raise current HP by the value (GDD 5.6); applied after the recompute by the caller.
  if (si >= 0 && si === sd.stat.max_hp) world.player.hp += c.value;
  ctx.events.push(SimEventType.LevelUpCardChosen, 0, 0, c.cardIndex, c.rarity, 0);
  run.levelChoices = [];
  return true;
}

/** Memento is offerable: in the build, open (default or an owned unlock), not at max stack. */
export function mementoOfferable(ctx: SimCtx, m: number): boolean {
  const def = ctx.data.mementos[m];
  if (def === undefined) return false;
  if (ctx.run.mementoOpen[m] !== 1) return false;
  return (ctx.run.mementoCount[m] ?? 0) < def.maxStack;
}

/** Roll the reward chest (GDD 13.2): N distinct Mementos at or above the minimum rarity. */
export function rollReward(ctx: SimCtx, minRarityId: string): void {
  const { data, run, world, sd } = ctx;
  const rng = ctx.rng.loot;
  const minOrder = sd.rarityOrder[minRarityId] ?? 0;
  const weights: number[] = [];
  rarityWeights(ctx, run.threat, luckOf(ctx), minOrder, weights);
  const picked: number[] = [];
  const n = Math.max(0, ctx.data.shop.wardenChestChoices);
  for (let k = 0; k < n; k++) {
    let rarity = weightedPick(rng, weights);
    let found = -1;
    // Empty rarity pool: step down (not below the minimum), then up (GDD 13.1).
    for (let step = 0; step < sd.rarityByOrder.length * 2 && found < 0; step++) {
      if (rarity < 0) break;
      const cands: number[] = [];
      for (let m = 0; m < data.mementos.length; m++) {
        if (sd.mementoRarity[m] !== rarity || picked.includes(m) || !mementoOfferable(ctx, m))
          continue;
        cands.push(m);
      }
      if (cands.length > 0) found = cands[rng.int(cands.length)] ?? -1;
      else rarity = rarity > minOrder && step < sd.rarityByOrder.length ? rarity - 1 : rarity + 1;
      if (rarity >= sd.rarityByOrder.length) break;
    }
    if (found >= 0) picked.push(found);
  }
  run.rewardChoices = picked;
  world.reward.sourceTypeIndex = run.rewardSourceType;
  world.reward.choices = picked.map((m) => ({ mementoIndex: m, rarity: sd.mementoRarity[m] ?? 0 }));
  world.reward.revision++;
  let top = 0;
  for (const m of picked) top = Math.max(top, sd.mementoRarity[m] ?? 0);
  ctx.events.push(SimEventType.RewardShown, 0, 0, picked.length, 0, 0);
  if (picked.length > 0) ctx.events.push(SimEventType.MementoOfferSpawned, 0, 0, top, 0, 0);
}

/** Add one copy of a Memento (shop, reward, debug). Rebuilds owners and tag counts. */
export function acquireMemento(ctx: SimCtx, m: number, emitSynergy: boolean): void {
  const run = ctx.run;
  const before = run.mementoCount[m] ?? 0;
  run.mementoCount[m] = before + 1;
  if (before === 0) run.mementoOrder.push(m);
  rebuildActiveEffects(ctx, emitSynergy);
  ctx.events.push(SimEventType.MementoAcquired, 0, 0, m, ctx.sd.mementoRarity[m] ?? 0, 0);
}
