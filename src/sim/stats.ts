// Player stat composition (effect-primitives 6.5, GDD 5.6). Recomputed only when an input changes:
// inventory, buffs, level-up cards, or the value of a continuous passive condition.
// Also collects passive rules (status_rule, shop_mod) that are recomputed with the stats.

import { Action, StackMode, Trigger } from './codes.ts';
import type { SimCtx } from './ctx.ts';
import { playerCondPasses } from './effects/conditions.ts';
import { pnum, pstr } from './sim-data.ts';

/** Scratch buffers sized to the stat table, owned by the sim instance. */
export interface StatScratch {
  readonly add: Float64Array;
  readonly mult: Float64Array;
  readonly minV: Float64Array;
  readonly hasMin: Uint8Array;
}

export function createStatScratch(statCount: number): StatScratch {
  return {
    add: new Float64Array(statCount),
    mult: new Float64Array(statCount),
    minV: new Float64Array(statCount),
    hasMin: new Uint8Array(statCount),
  };
}

function statIndexOf(ctx: SimCtx, id: string): number {
  return ctx.sd.statIdx.get(id) ?? -1;
}

function passiveActive(ctx: SimCtx, effect: number): boolean {
  const eff = ctx.sd.effects[effect];
  if (eff === undefined) return false;
  for (const c of eff.conds) if (!playerCondPasses(ctx, c)) return false;
  return true;
}

/** Bitmask of passive effect condition results; a change triggers a recompute. */
export function passiveConditionMask(ctx: SimCtx): number {
  const { active } = ctx;
  let mask = 0;
  let bit = 0;
  const s = active.start[Trigger.Passive] ?? 0;
  const e = active.start[Trigger.Passive + 1] ?? 0;
  for (let k = s; k < e && bit < 31; k++) {
    const entry = active.order[k] ?? 0;
    const eff = ctx.sd.effects[active.effect[entry] ?? 0];
    if (eff === undefined || eff.conds.length === 0) continue;
    if (passiveActive(ctx, eff.index)) mask |= 1 << bit;
    bit++;
  }
  return mask;
}

function clampStat(ctx: SimCtx, i: number, v: number): number {
  const def = ctx.data.stats[i];
  if (def === undefined) return v;
  let out = v;
  if (def.min !== null && out < def.min) out = def.min;
  if (def.max !== null && out > def.max) out = def.max;
  return out;
}

export function recomputeStats(ctx: SimCtx, sc: StatScratch): void {
  const { data, sd, run, active, world } = ctx;
  const stats = world.player.stats;
  const n = sd.statCount;
  sc.add.fill(0);
  sc.mult.fill(1);
  sc.minV.fill(0);
  sc.hasMin.fill(0);

  run.burnDmgMult = 1;
  run.burnSpreadChance = 0;
  run.burnSpreadRange = 0;
  run.burnAddMark = 0;
  run.knockbackAddMark = 0;
  run.shopSlotsAdd = 0;
  run.shopPriceMult = 1;
  run.shopRerollDelta = 0;
  run.shopFreeRerolls = 0;

  // 2. Add: class stat_mods, level-up cards, stat_mod add, buffs.
  const cls = data.classes[run.classIndex];
  const clsMods = sd.classStatMods[run.classIndex];
  if (run.started && clsMods !== undefined) {
    for (let m = 0; m < clsMods.length; m++) {
      const part = clsMods[m];
      if (part !== undefined) sc.add[part.stat] = (sc.add[part.stat] ?? 0) + part.value;
    }
  }
  for (let i = 0; i < n; i++) sc.add[i] = (sc.add[i] ?? 0) + (run.statCardAdd[i] ?? 0);

  for (let k = 0; k < active.count; k++) {
    const eff = sd.effects[active.effect[k] ?? 0];
    if (eff === undefined) continue;
    const copies = active.copies[k] ?? 1;
    if (eff.action === Action.Buff) {
      const stacks = run.buffStacks[eff.index] ?? 0;
      if (stacks <= 0) continue;
      for (let b = 0; b < eff.buffParts.length; b++) {
        const part = eff.buffParts[b];
        if (part !== undefined) sc.add[part.stat] = (sc.add[part.stat] ?? 0) + part.value * stacks;
      }
      continue;
    }
    if (eff.trigger !== Trigger.Passive || !passiveActive(ctx, eff.index)) continue;
    const mul = eff.stackMode === StackMode.Value ? copies : 1;
    switch (eff.action) {
      case Action.StatMod: {
        const i = eff.statIndex;
        if (i < 0) break;
        const op = pstr(eff.p, 'op', 'add');
        const v = pnum(eff.p, 'value', 0);
        if (op === 'mult') {
          for (let c = 0; c < mul; c++) sc.mult[i] = (sc.mult[i] ?? 1) * v;
        } else if (op === 'min') {
          if (v !== 0 && (sc.hasMin[i] === 0 || v < (sc.minV[i] ?? 0))) {
            sc.minV[i] = v;
            sc.hasMin[i] = 1;
          }
        } else {
          sc.add[i] = (sc.add[i] ?? 0) + v * mul;
        }
        break;
      }
      case Action.StatusRule: {
        const status = pstr(eff.p, 'status', '');
        const rule = pstr(eff.p, 'rule', '');
        const v = pnum(eff.p, 'value', 0);
        if (status === 'burn') {
          if (rule === 'dmg_mult') run.burnDmgMult *= v;
          else if (rule === 'spread_chance') run.burnSpreadChance += v * mul;
          else if (rule === 'spread_range') run.burnSpreadRange = Math.max(run.burnSpreadRange, v);
          else if (rule === 'add_mark') run.burnAddMark = Math.max(run.burnAddMark, v);
        } else if (status === 'knockback' && rule === 'add_mark') {
          run.knockbackAddMark = Math.max(run.knockbackAddMark, v);
        }
        break;
      }
      case Action.ShopMod: {
        const field = pstr(eff.p, 'field', '');
        const v = pnum(eff.p, 'value', 0);
        if (field === 'slots') run.shopSlotsAdd += v * mul;
        else if (field === 'price_mult') run.shopPriceMult *= v;
        else if (field === 'reroll_delta') run.shopRerollDelta += v * mul;
        else if (field === 'free_rerolls') run.shopFreeRerolls += v * mul;
        break;
      }
      default:
        break;
    }
  }

  // 1, 3, 4, 5: base, mult, min, clamp.
  for (let i = 0; i < n; i++) {
    const def = data.stats[i];
    let base = def?.base ?? 0;
    if (i === sd.stat.max_hp && run.started && cls !== undefined) base = cls.maxHp;
    let v = (base + (sc.add[i] ?? 0)) * (sc.mult[i] ?? 1);
    if (sc.hasMin[i] === 1) {
      const m = sc.minV[i] ?? 0;
      v = v === 0 ? m : Math.min(v, m);
    }
    stats[i] = clampStat(ctx, i, v);
  }

  // 6, 7: convert from clamped source values, then re-clamp the targets.
  run.glintConvert = false;
  for (let k = 0; k < active.count; k++) {
    const eff = sd.effects[active.effect[k] ?? 0];
    if (eff?.action !== Action.Convert || eff.trigger !== Trigger.Passive) continue;
    if (pstr(eff.p, 'from', '') === 'held_glint') run.glintConvert = true;
    if (!passiveActive(ctx, eff.index)) continue;
    const to = statIndexOf(ctx, pstr(eff.p, 'to', ''));
    if (to < 0) continue;
    const from = pstr(eff.p, 'from', '');
    const src = from === 'held_glint' ? world.player.glint : (stats[statIndexOf(ctx, from)] ?? 0);
    const cap = pnum(eff.p, 'cap', Infinity);
    stats[to] = (stats[to] ?? 0) + Math.min(cap, src * pnum(eff.p, 'ratio', 0));
  }
  for (let k = 0; k < active.count; k++) {
    const eff = sd.effects[active.effect[k] ?? 0];
    if (eff?.action !== Action.Convert) continue;
    const to = statIndexOf(ctx, pstr(eff.p, 'to', ''));
    if (to >= 0) stats[to] = clampStat(ctx, to, stats[to] ?? 0);
  }

  run.passiveMask = passiveConditionMask(ctx);
  run.statsDirty = false;
}
