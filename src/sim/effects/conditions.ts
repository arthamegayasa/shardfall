// Effect conditions (effect-primitives 4). All conditions of an effect must pass (AND).
// Hit conditions read ctx.hits[ctx.hitDepth]; player conditions read the player state.
// String values were resolved to numeric codes in sim-data.ts.

import { TICK_RATE } from '../../core/index.ts';
import { Cond, Status } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import type { ConditionSim, EffectSim } from '../sim-data.ts';

export function enemyHasStatus(ctx: SimCtx, slot: number, status: number): boolean {
  const e = ctx.world.enemies;
  switch (status) {
    case Status.Burn:
      return (e.burnStacks[slot] ?? 0) > 0;
    case Status.Slow:
      return (e.slowTicks[slot] ?? 0) > 0;
    case Status.Mark:
      return (e.markTicks[slot] ?? 0) > 0;
    default:
      return false;
  }
}

/** every_nth: increments the counter of its scope and passes on each n-th qualifying event. */
function everyNth(ctx: SimCtx, eff: EffectSim, c: ConditionSim, target: number): boolean {
  const n = Math.max(1, Math.floor(c.num));
  const run = ctx.run;
  if (c.scope === 1) {
    const hit = ctx.hits[ctx.hitDepth];
    const ws = hit !== undefined ? hit.weaponSlot : -1;
    if (ws < 0) return false;
    const i = eff.index * run.weaponIndex.length + ws;
    const v = (run.effectWeaponCounter[i] ?? 0) + 1;
    run.effectWeaponCounter[i] = v;
    return v % n === 0;
  }
  if (c.scope === 2) {
    if (target < 0) return false;
    const slot = run.targetSlotOf[eff.index] ?? -1;
    if (slot < 0) {
      // More active per_target effects than counter slots (architecture 8.1: max 4 per run): the
      // condition fails deterministically and is counted, never silently (LP review M1, MAYOR 19).
      ctx.poolOverflow++;
      return false;
    }
    const cap = ctx.world.enemies.capacity;
    const i = slot * cap + target;
    if (i >= run.targetCounter.length) return false;
    const serial = ctx.world.enemies.serial[target] ?? 0;
    if (run.targetCounterSerial[i] !== serial) {
      run.targetCounterSerial[i] = serial;
      run.targetCounter[i] = 0;
    }
    const v = (run.targetCounter[i] ?? 0) + 1;
    run.targetCounter[i] = v;
    return v % n === 0;
  }
  const v = (run.effectCounter[eff.index] ?? 0) + 1;
  run.effectCounter[eff.index] = v;
  return v % n === 0;
}

/** Player-only conditions, usable by passive effects (continuous, effect-primitives 3). */
export function playerCondPasses(ctx: SimCtx, c: ConditionSim): boolean {
  const p = ctx.world.player;
  switch (c.code) {
    case Cond.PlayerHpBelow:
      return p.maxHp > 0 && p.hp < p.maxHp * c.num;
    case Cond.TimeSinceHurt:
      return ctx.world.tick - ctx.run.lastHurtTick >= c.num * TICK_RATE;
    case Cond.HasBarrier:
      return p.barrier >= 1;
    case Cond.HeldGlintAtLeast:
      return p.glint >= c.num;
    case Cond.UnhurtThisPulse:
      return ctx.run.unhurtThisPulse;
    default:
      return true;
  }
}

/**
 * Evaluate all conditions of an effect for the current trigger context. every_nth is evaluated last
 * so its counter advances only on events that pass every other condition.
 */
export function condsPass(ctx: SimCtx, eff: EffectSim, target: number): boolean {
  const hit = ctx.hits[ctx.hitDepth];
  const en = ctx.world.enemies;
  let nth: ConditionSim | null = null;
  for (let i = 0; i < eff.conds.length; i++) {
    const c = eff.conds[i];
    if (c === undefined) continue;
    switch (c.code) {
      case Cond.SourceTag:
        if (hit === undefined || c.num < 0 || (hit.tagMask & (1 << c.num)) === 0) return false;
        break;
      case Cond.SourceKind:
        if (hit === undefined || hit.hitKind !== c.num) return false;
        break;
      case Cond.SourceWeapon:
        if (hit === undefined || hit.weaponIndex < 0 || hit.weaponIndex !== c.num) return false;
        break;
      case Cond.TargetHasStatus:
        if (target < 0 || !enemyHasStatus(ctx, target, c.num)) return false;
        break;
      case Cond.TargetWithin: {
        if (target < 0) return false;
        const dx = (en.x[target] ?? 0) - ctx.world.player.x;
        const dy = (en.y[target] ?? 0) - ctx.world.player.y;
        if (dx * dx + dy * dy > c.num * c.num) return false;
        break;
      }
      case Cond.TargetHpBelow: {
        if (target < 0) return false;
        const max = en.maxHp[target] ?? 0;
        if (max <= 0 || (en.hp[target] ?? 0) >= max * c.num) return false;
        break;
      }
      case Cond.TargetHpFull:
        if (hit === undefined || target < 0 || hit.hpBefore < (en.maxHp[target] ?? 0)) return false;
        break;
      case Cond.TargetIs: {
        if (target < 0) return false;
        const rank = en.rank[target] ?? 0;
        // not_boss = 3: any rank except boss (2).
        if (c.num === 3 ? rank === 2 : rank !== c.num) return false;
        break;
      }
      case Cond.EveryNth:
        nth = c;
        break;
      case Cond.KilledByCrit:
        if (hit === undefined || !hit.crit) return false;
        break;
      default:
        if (!playerCondPasses(ctx, c)) return false;
    }
  }
  if (nth !== null && !everyNth(ctx, eff, nth, target)) return false;
  return true;
}
