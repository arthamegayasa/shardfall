// Run save and load (architecture.md 6.11, 12). Saves use string ids; loading rebuilds the exact
// canonical state of a choice phase (reward, levelUp, shop) so the hash matches an uninterrupted run.

import { OfferKind, RNG_STREAMS } from '../core/index.ts';
import type { LoadResult, RngState, RunSave } from '../core/index.ts';
import type { GameData } from '../content/index.ts';
import type { CardChoice, OfferState, SimCtx } from './ctx.ts';
import { rebuildActiveEffects } from './effects/active.ts';
import type { StatScratch } from './stats.ts';
import { refreshShopView } from './systems/shop.ts';
import {
  applyThreat,
  canonicalReset,
  ensureStats,
  placePlayer,
  useArenaFor,
} from './systems/run.ts';
import { xpToNext } from './systems/xp.ts';

const RARITY_COLUMNS = ['plain', 'fine', 'rare', 'fabled'] as const;

const OFFER_KIND_NAMES = ['empty', 'weapon', 'memento', 'taken'] as const;

export function createSave(ctx: SimCtx): RunSave | null {
  const { world, run, data } = ctx;
  const phase = world.phase;
  if (phase !== 'reward' && phase !== 'levelUp' && phase !== 'shop') return null;
  const rng = {} as Record<(typeof RNG_STREAMS)[number], readonly [number, number, number, number]>;
  for (const name of RNG_STREAMS) rng[name] = ctx.rng[name].getState();
  const cls = data.classes[run.classIndex];
  const weapons = Array.from(run.weaponIndex, (wi, i) =>
    wi >= 0 ? { id: data.weapons[wi]?.id ?? '', tier: run.weaponTier[i] ?? 1 } : null,
  );
  const effectState: Record<string, number> = {};
  if (run.siltKills !== 0) effectState['silt_kills'] = run.siltKills;
  return {
    v: 1,
    contentHash: data.meta.contentHash,
    seed: run.seed,
    classId: cls?.id ?? run.classId,
    profile: run.profile,
    difficulty: run.difficulty,
    phase,
    pulseIndex: world.pulse.index,
    tick: world.tick,
    rng,
    player: {
      hp: world.player.hp,
      level: world.player.level,
      xp: world.player.xp,
      glint: world.player.glint,
    },
    weapons,
    mementos: run.mementoOrder.map((m) => ({
      id: data.mementos[m]?.id ?? '',
      count: run.mementoCount[m] ?? 0,
    })),
    levelUpPicks: run.levelUpPicks.map((c) => ({
      cardId: data.levelUpCards[c.cardIndex]?.id ?? '',
      rarity: c.rarity,
    })),
    pendingLevelUps: run.pendingLevelUps,
    levelUpChoices: run.levelChoices.map((c) => ({
      cardId: data.levelUpCards[c.cardIndex]?.id ?? '',
      rarity: c.rarity,
    })),
    rewardChoices: run.rewardChoices.map((m) => data.mementos[m]?.id ?? ''),
    shop: {
      offers: run.offers.map((o) => ({
        kind: OFFER_KIND_NAMES[o.kind] ?? 'empty',
        id:
          o.defIndex < 0
            ? ''
            : o.kind === OfferKind.Weapon ||
                (o.kind === OfferKind.Taken && o.boughtKind === OfferKind.Weapon)
              ? (data.weapons[o.defIndex]?.id ?? '')
              : (data.mementos[o.defIndex]?.id ?? ''),
        tier: o.tier,
        locked: o.locked,
      })),
      rerollCount: run.rerollCount,
      freeRerollsUsed: run.freeRerollsUsed,
    },
    effectState,
    runStats: {
      kills: world.runStats.kills,
      glintEarned: world.runStats.glintEarned,
      glintSpent: world.runStats.glintSpent,
      pulsesCleared: world.runStats.pulsesCleared,
      runTicks: world.runStats.runTicks,
    },
  };
}

function idx(list: readonly { readonly id: string }[], id: string): number {
  return list.findIndex((x) => x.id === id);
}

function isRngState(v: unknown): v is RngState {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number');
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isArr = (v: unknown): v is readonly unknown[] => Array.isArray(v);
const isObj = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Shape and range check before applySave touches the sim (LP review M1-09a): a malformed or
 * truncated save returns 'corrupt' instead of throwing or loading into a state that cannot advance
 * (a pulseIndex past the profile, a choice phase without choices). Returns null when the save is usable.
 */
export function validateSave(save: unknown, data: GameData): LoadResult | null {
  const corrupt: LoadResult = { ok: false, reason: 'corrupt' };
  if (!isObj(save)) return corrupt;
  if (save['v'] !== 1) return { ok: false, reason: 'badVersion' };
  const player = save['player'];
  const shop = save['shop'];
  const rng = save['rng'];
  if (
    !isNum(save['seed']) ||
    !isNum(save['difficulty']) ||
    !isNum(save['pulseIndex']) ||
    !isNum(save['tick']) ||
    !isNum(save['pendingLevelUps']) ||
    typeof save['classId'] !== 'string' ||
    typeof save['profile'] !== 'string' ||
    !isObj(player) ||
    !isNum(player['hp']) ||
    !isNum(player['level']) ||
    !isNum(player['xp']) ||
    !isNum(player['glint']) ||
    !isObj(shop) ||
    !isArr(shop['offers']) ||
    !isNum(shop['rerollCount']) ||
    !isNum(shop['freeRerollsUsed']) ||
    !isObj(rng) ||
    !isArr(save['weapons']) ||
    !isArr(save['mementos']) ||
    !isArr(save['levelUpPicks']) ||
    !isArr(save['levelUpChoices']) ||
    !isArr(save['rewardChoices']) ||
    !isObj(save['effectState']) ||
    !isObj(save['runStats'])
  )
    return corrupt;
  const slots = data.profiles[save['profile']];
  if (slots === undefined) return { ok: false, reason: 'unknownId' };
  // pulseIndex is the Pulse just cleared; pulse.begin needs a next slot.
  const pi = save['pulseIndex'];
  if (pi < 0 || pi + 1 >= slots.length || !Number.isInteger(pi)) return corrupt;
  const phase = save['phase'];
  if (phase === 'levelUp' && save['levelUpChoices'].length === 0) return corrupt;
  if (phase === 'reward' && save['rewardChoices'].length === 0) return corrupt;
  return null;
}

/**
 * Load a run save into the sim. beginRun sets up the run header (class, profile, difficulty, seed).
 * Returns unknownId when any id no longer exists in the data.
 */
export function applySave(
  ctx: SimCtx,
  save: RunSave,
  sc: StatScratch,
  beginRun: (classIndex: number, profile: string, difficulty: number, seed: number) => boolean,
): LoadResult {
  const { data, world } = ctx;
  if ((save as { v: unknown }).v !== 1) return { ok: false, reason: 'badVersion' };
  const phase: string = save.phase;
  if (phase !== 'reward' && phase !== 'levelUp' && phase !== 'shop')
    return { ok: false, reason: 'corrupt' };
  const ci = idx(data.classes, save.classId);
  if (ci < 0 || data.profiles[save.profile] === undefined)
    return { ok: false, reason: 'unknownId' };
  const weapons: ({ wi: number; tier: number } | null)[] = [];
  for (const w of save.weapons) {
    if (w === null) {
      weapons.push(null);
      continue;
    }
    const wi = idx(data.weapons, w.id);
    if (wi < 0) return { ok: false, reason: 'unknownId' };
    weapons.push({ wi, tier: w.tier });
  }
  const mementos: { m: number; count: number }[] = [];
  for (const m of save.mementos) {
    const mi = idx(data.mementos, m.id);
    if (mi < 0) return { ok: false, reason: 'unknownId' };
    mementos.push({ m: mi, count: m.count });
  }
  const picks: { cardIndex: number; rarity: number }[] = [];
  for (const c of save.levelUpPicks) {
    const k = idx(data.levelUpCards, c.cardId);
    if (k < 0) return { ok: false, reason: 'unknownId' };
    picks.push({ cardIndex: k, rarity: c.rarity });
  }
  const choices: CardChoice[] = [];
  for (const c of save.levelUpChoices) {
    const k = idx(data.levelUpCards, c.cardId);
    const card = data.levelUpCards[k];
    if (card === undefined) return { ok: false, reason: 'unknownId' };
    const col = RARITY_COLUMNS[Math.min(c.rarity, RARITY_COLUMNS.length - 1)] ?? 'plain';
    choices.push({ cardIndex: k, rarity: c.rarity, value: card[col] });
  }
  const reward: number[] = [];
  for (const id of save.rewardChoices) {
    const k = idx(data.mementos, id);
    if (k < 0) return { ok: false, reason: 'unknownId' };
    reward.push(k);
  }
  const offers: OfferState[] = [];
  for (const o of save.shop.offers) {
    const kind = OFFER_KIND_NAMES.indexOf(o.kind);
    if (kind < 0) return { ok: false, reason: 'corrupt' };
    let def = -1;
    let weapon = false;
    if (o.id !== '') {
      const wi = idx(data.weapons, o.id);
      const mi = idx(data.mementos, o.id);
      weapon = kind === OfferKind.Weapon || (kind === OfferKind.Taken && wi >= 0 && mi < 0);
      def = weapon ? wi : mi;
      if (def < 0) return { ok: false, reason: 'unknownId' };
    }
    const bought =
      kind === OfferKind.Taken ? (weapon ? OfferKind.Weapon : OfferKind.Memento) : kind;
    offers.push({ kind, defIndex: def, tier: o.tier, locked: o.locked, boughtKind: bought });
  }
  for (const name of RNG_STREAMS)
    if (!isRngState(save.rng[name])) return { ok: false, reason: 'corrupt' };

  if (!beginRun(ci, save.profile, save.difficulty, save.seed))
    return { ok: false, reason: 'unknownId' };
  // beginRun replaced ctx.run with a fresh run state.
  const run = ctx.run;
  for (const name of RNG_STREAMS) ctx.rng[name].setState(save.rng[name]);
  world.tick = save.tick;
  canonicalReset(ctx);
  run.weaponIndex.fill(-1);
  run.weaponTier.fill(0);
  weapons.forEach((w, i) => {
    if (w === null || i >= run.weaponIndex.length) return;
    run.weaponIndex[i] = w.wi;
    run.weaponTier[i] = w.tier;
  });
  run.mementoCount.fill(0);
  run.mementoOrder = mementos.map((m) => m.m);
  for (const m of mementos) run.mementoCount[m.m] = m.count;
  run.levelUpPicks = picks;
  run.statCardAdd.fill(0);
  for (const pk of picks) {
    const card = data.levelUpCards[pk.cardIndex];
    const si = card !== undefined ? data.stats.findIndex((s) => s.id === card.stat) : -1;
    const col = RARITY_COLUMNS[Math.min(pk.rarity, RARITY_COLUMNS.length - 1)] ?? 'plain';
    if (si >= 0 && card !== undefined) run.statCardAdd[si] = (run.statCardAdd[si] ?? 0) + card[col];
  }
  run.pendingLevelUps = save.pendingLevelUps;
  run.levelsThisPulse = save.pendingLevelUps;
  run.levelChoices = choices;
  run.rewardChoices = reward;
  run.rewardPending = false;
  run.offers = offers;
  run.rerollCount = save.shop.rerollCount;
  run.freeRerollsUsed = save.shop.freeRerollsUsed;
  run.siltKills = save.effectState['silt_kills'] ?? 0;
  const p = world.player;
  p.level = save.player.level;
  p.xp = save.player.xp;
  p.xpToNext = xpToNext(ctx, p.level);
  p.glint = save.player.glint;
  const rs = world.runStats;
  rs.kills = save.runStats.kills;
  rs.glintEarned = save.runStats.glintEarned;
  rs.glintSpent = save.runStats.glintSpent;
  rs.pulsesCleared = save.runStats.pulsesCleared;
  rs.runTicks = save.runStats.runTicks;
  rs.silt = 0;
  rs.killedBy = 0;
  // Pulse view as left by the end of the cleared Pulse.
  const slot = run.slots[save.pulseIndex];
  const pulse = world.pulse;
  pulse.index = save.pulseIndex;
  pulse.count = run.slots.length;
  pulse.kind = slot?.kind === 'boss' ? 2 : slot?.kind === 'warden' ? 1 : 0;
  pulse.isBoss = slot?.kind === 'boss';
  pulse.threat = slot?.threat ?? 1;
  applyThreat(ctx, pulse.threat);
  const next = Math.min(save.pulseIndex + 1, run.slots.length - 1);
  useArenaFor(ctx, next);
  placePlayer(ctx, next);
  rebuildActiveEffects(ctx, false);
  ensureStats(ctx, sc);
  p.hp = Math.min(save.player.hp, p.maxHp);
  world.phase = save.phase;
  world.phaseRevision++;
  world.levelUp.choices = choices;
  world.levelUp.pending = run.pendingLevelUps;
  world.levelUp.total = run.levelsThisPulse;
  world.levelUp.revision++;
  world.reward.choices = reward.map((m) => ({
    mementoIndex: m,
    rarity: ctx.sd.mementoRarity[m] ?? 0,
  }));
  world.reward.sourceTypeIndex = -1;
  world.reward.revision++;
  refreshShopView(ctx);
  return { ok: true };
}
