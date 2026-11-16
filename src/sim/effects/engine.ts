/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Effect engine (effect-primitives 3 to 6): trigger dispatch with procDepth gating, icd, per-Pulse
// limits, chance with stack modes, and the 16 actions. Passive actions (stat_mod, status_rule,
// shop_mod, convert) are folded into stats by stats.ts.

import {
  HitKind,
  SimEventType,
  TICK_RATE,
  atan2Turns,
  cosTurns,
  sinTurns,
} from '../../core/index.ts';
import {
  Action,
  HIT_KIND_CODES,
  Pending,
  STATUS_CODES,
  ShotMode,
  StackMode,
  Status,
  Trigger,
} from '../codes.ts';
import type { EffectHooks, HitCtx, SimCtx } from '../ctx.ts';
import { statOf } from '../ctx.ts';
import { allocSlot, freeSlot } from '../pools.ts';
import { pnum, pstr } from '../sim-data.ts';
import type { EffectSim } from '../sim-data.ts';
import { condsPass } from './conditions.ts';
import {
  applyBurn,
  applyHit,
  applyMark,
  applySlow,
  areaDamage,
  beginHit,
  burnDpsFromHit,
  burnDpsNonHit,
  canDamage,
  endHit,
  executeTarget,
  healPlayer,
  knockEnemy,
  nearestEnemy,
} from '../systems/combat.ts';
import { spawnPlayerZone } from '../systems/areas.ts';
import { dropGlint, gainGlint } from '../systems/pickups.ts';
import { areaScale, resetShotSpec, spawnPlayerShot } from '../systems/projectiles.ts';
import { castRite } from '../systems/player.ts';
import { fireWeapon, runWeaponEcho } from '../systems/weapons.ts';

const sec = (s: number): number => Math.round(s * TICK_RATE);

function hitNow(ctx: SimCtx): HitCtx | undefined {
  return ctx.hits[ctx.hitDepth];
}

/** procDepth gate (effect-primitives 6.2): depth 0 always, depth 1 with allow_proc, depth 2 never. */
function depthAllows(eff: EffectSim, depth: number): boolean {
  return depth === 0 || (depth === 1 && eff.allowProc);
}

/**
 * Try one active entry: icd, per-Pulse limit, conditions, chance. Returns true when the action runs.
 * Counters advance only for entries that get as far as their every_nth condition.
 */
function gate(ctx: SimCtx, entry: number, target: number, depth: number): EffectSim | null {
  const eff = ctx.sd.effects[ctx.active.effect[entry]!];
  if (eff === undefined || !depthAllows(eff, depth)) return null;
  const run = ctx.run;
  if (eff.icdTicks > 0 && run.effectNextTick[eff.index]! > ctx.world.tick) return null;
  if (eff.maxPerPulse > 0 && run.effectFires[eff.index]! >= eff.maxPerPulse) return null;
  if (!condsPass(ctx, eff, target)) return null;
  const copies = ctx.active.copies[entry]!;
  const chance = eff.stackMode === StackMode.Chance ? Math.min(1, eff.chance * copies) : eff.chance;
  if (chance < 1 && !ctx.rng.combat.chance(chance)) return null;
  run.effectNextTick[eff.index] = ctx.world.tick + eff.icdTicks;
  run.effectFires[eff.index] = run.effectFires[eff.index]! + 1;
  return eff;
}

function valueMul(ctx: SimCtx, eff: EffectSim, entry: number): number {
  return eff.stackMode === StackMode.Value ? ctx.active.copies[entry]! : 1;
}

/** Origin point for spawn actions: player, target (hit or kill position), or point (event position). */
function origin(
  ctx: SimCtx,
  eff: EffectSim,
  out: { x: number; y: number },
  fallbackPlayer: boolean,
): void {
  const o = pstr(eff.p, 'origin', fallbackPlayer ? 'player' : 'target');
  const h = hitNow(ctx);
  const p = ctx.world.player;
  if (o === 'player' || h === undefined) {
    out.x = p.x;
    out.y = p.y;
  } else {
    out.x = h.x;
    out.y = h.y;
  }
}

const at = { x: 0, y: 0 };

function damageFrom(ctx: SimCtx, eff: EffectSim, power: number): number {
  const h = hitNow(ctx);
  if (eff.p['dmg_frac'] !== undefined) return pnum(eff.p, 'dmg_frac', 0) * (h?.final ?? 0) * power;
  return pnum(eff.p, 'dmg', 0) * ctx.run.procScale * power;
}

function tagsOf(ctx: SimCtx, eff: EffectSim): number {
  // Resolved once in sim-data (no string split in the hit path).
  return eff.tagMask >= 0 ? eff.tagMask : (hitNow(ctx)?.tagMask ?? 0);
}

function burnInRadius(ctx: SimCtx, x: number, y: number, r: number, dps: number): void {
  const e = ctx.world.enemies;
  for (let s = 0; s < e.highWater; s++) {
    if (!canDamage(ctx, s)) continue;
    const dx = e.x[s]! - x;
    const dy = e.y[s]! - y;
    const rr = r + e.radius[s]!;
    if (dx * dx + dy * dy <= rr * rr) applyBurn(ctx, s, dps, 1);
  }
}

/** Toughest: damageable enemy with the highest HP (tie: smallest slot). */
function toughest(ctx: SimCtx): number {
  const e = ctx.world.enemies;
  let best = -1;
  let hp = -1;
  for (let s = 0; s < e.highWater; s++) {
    if (!canDamage(ctx, s)) continue;
    if (e.hp[s]! > hp) {
      hp = e.hp[s]!;
      best = s;
    }
  }
  return best;
}

function spawnProjectiles(ctx: SimCtx, eff: EffectSim, depth: number, power: number): number {
  const h = hitNow(ctx);
  const pattern = pstr(eff.p, 'pattern', 'aimed');
  const count = Math.max(1, Math.floor(pnum(eff.p, 'count', 1)));
  const dmg = damageFrom(ctx, eff, power);
  // Fallbacks from the triggering weapon when the effect omits speed or range.
  const wt =
    h !== undefined && h.weaponIndex >= 0 ? ctx.sd.weapons[h.weaponIndex]?.tiers[0] : undefined;
  const speed =
    pnum(eff.p, 'speed', 0) > 0 ? pnum(eff.p, 'speed', 0) / TICK_RATE : (wt?.speedUPerTick ?? 0);
  const range = pnum(eff.p, 'range', 0) > 0 ? pnum(eff.p, 'range', 0) : (wt?.rangeU ?? 0);
  if (speed <= 0 || range <= 0 || dmg <= 0) return 0;
  origin(ctx, eff, at, pattern === 'ring' || pattern === 'aimed' || pattern === 'toughest');
  const e = ctx.world.enemies;
  const exclude = h !== undefined ? h.target : -1;
  const seekRange = pnum(eff.p, 'seek_range', range);
  let base = ctx.rng.combat.next();
  let spawned = 0;
  if (pattern === 'aimed' || pattern === 'seek_other' || pattern === 'toughest') {
    const t =
      pattern === 'toughest'
        ? toughest(ctx)
        : nearestEnemy(ctx, at.x, at.y, seekRange, pattern === 'seek_other' ? exclude : -1);
    if (t < 0) return 0;
    base = atan2Turns(e.y[t]! - at.y, e.x[t]! - at.x);
  } else if (pattern === 'fan' && h !== undefined) {
    base = atan2Turns(h.y - ctx.world.player.y, h.x - ctx.world.player.x);
  }
  const s = ctx.shot;
  for (let k = 0; k < count; k++) {
    let a = base;
    if (pattern === 'ring' || pattern === 'split') a = base + k / count;
    else if (pattern === 'fan')
      a = base + (k - (count - 1) * 0.5) * ctx.cfg.extraProjectileSpreadTurns;
    resetShotSpec(s);
    s.x = at.x;
    s.y = at.y;
    s.vx = cosTurns(a) * speed;
    s.vy = sinTurns(a) * speed;
    s.radius = ctx.cfg.playerShotRadiusU;
    s.mode = ShotMode.Straight;
    s.dmg = dmg;
    s.tagMask = tagsOf(ctx, eff);
    s.hitKind = HIT_KIND_CODES[pstr(eff.p, 'kind', 'projectile')] ?? HitKind.Projectile;
    s.procDepth = depth;
    s.pierce = Math.floor(pnum(eff.p, 'pierce', 0));
    s.range = range;
    s.sourceRef = eff.sourceRef;
    s.isProc = true;
    if (spawnPlayerShot(ctx, s) >= 0) spawned++;
  }
  return spawned;
}

function queuePending(
  ctx: SimCtx,
  kind: number,
  eff: EffectSim,
  delayTicks: number,
  dmg: number,
  power: number,
  radius: number,
  x: number,
  y: number,
  target: number,
): void {
  const pd = ctx.pending;
  const i = allocSlot(pd);
  if (i < 0) {
    ctx.poolOverflow++;
    return;
  }
  const h = hitNow(ctx);
  pd.kind[i] = kind;
  pd.dueTick[i] = ctx.world.tick + Math.max(1, delayTicks);
  pd.seq[i] = ctx.run.pendingSeq++;
  pd.effect[i] = eff.index;
  pd.dmg[i] = dmg;
  pd.power[i] = power;
  pd.radius[i] = radius;
  pd.procDepth[i] = 1;
  pd.tagMask[i] = h?.tagMask ?? 0;
  pd.target[i] = target;
  pd.targetSerial[i] = target >= 0 ? ctx.world.enemies.serial[target]! : 0;
  pd.sourceRef[i] = eff.sourceRef;
  pd.weaponSlot[i] = h?.weaponSlot ?? -1;
  pd.x[i] = x;
  pd.y[i] = y;
}

/** Run the action of a gated effect. depth = procDepth of the triggering event. */
function act(ctx: SimCtx, eff: EffectSim, entry: number, target: number, depth: number): void {
  const nd = depth + 1;
  const p = ctx.world.player;
  const h = hitNow(ctx);
  const mul = valueMul(ctx, eff, entry);
  let instances = 1;
  switch (eff.action) {
    case Action.HitMod: {
      if (h === undefined) return;
      const v = pnum(eff.p, 'value', 0) * mul;
      const mode = pstr(eff.p, 'mode', 'bonus');
      if (mode === 'force_crit') h.forceCrit = true;
      else if (mode === 'vuln') h.vuln += v;
      else if (mode === 'crit_mult_add') h.critMultAdd += v;
      else h.bonus += v;
      return;
    }
    case Action.ApplyStatus: {
      if (target < 0 || !canDamage(ctx, target)) return;
      const st = STATUS_CODES[pstr(eff.p, 'status', '')];
      const dur = sec(pnum(eff.p, 'duration', 0));
      const v = pnum(eff.p, 'value', 0) * mul;
      if (st === Status.Burn) {
        const dps =
          pnum(eff.p, 'dps', 0) > 0 || h === undefined || h.preCrit <= 0
            ? burnDpsNonHit(ctx, pnum(eff.p, 'dps', 0))
            : burnDpsFromHit(ctx, h.preCrit);
        applyBurn(ctx, target, dps, Math.max(1, Math.floor(pnum(eff.p, 'stacks', 1))));
      } else if (st === Status.Slow) applySlow(ctx, target, v / 100, dur);
      else if (st === Status.Mark) applyMark(ctx, target, dur, v > 0 ? v / 100 : -1);
      else if (st === Status.Knockback) knockEnemy(ctx, target, p.x, p.y, v);
      return;
    }
    case Action.SpawnProjectile:
      instances = spawnProjectiles(ctx, eff, nd, 1);
      break;
    case Action.SpawnArea: {
      origin(ctx, eff, at, false);
      const r = pnum(eff.p, 'radius', 0) * areaScale(ctx);
      const dmg = damageFrom(ctx, eff, 1);
      const delay = sec(pnum(eff.p, 'delay', 0));
      const st = STATUS_CODES[pstr(eff.p, 'status', '')] ?? -1;
      if (delay > 0) {
        queuePending(ctx, Pending.Area, eff, delay, dmg, 1, r, at.x, at.y, -1);
      } else if (dmg <= 0) {
        // Damage-free nova (Flame 6): non-hit Burn to every Unlit inside (effect-primitives 6.6).
        if (st === Status.Burn)
          burnInRadius(ctx, at.x, at.y, r, burnDpsNonHit(ctx, pnum(eff.p, 'dps', 0)));
        ctx.fx.onArea(ctx, at.x, at.y, r, 0, tagsOf(ctx, eff), nd);
      } else {
        areaDamage(
          ctx,
          at.x,
          at.y,
          r,
          dmg,
          eff.sourceRef,
          tagsOf(ctx, eff),
          HitKind.Area,
          nd,
          false,
          st,
          pnum(eff.p, 'knockback', 0),
          -1,
          -1,
        );
      }
      break;
    }
    case Action.SpawnZone: {
      origin(ctx, eff, at, true);
      const maxAlive = Math.floor(pnum(eff.p, 'max_alive', 0));
      if (maxAlive > 0) {
        const pz = ctx.world.playerZones;
        let n = 0;
        for (let i = 0; i < pz.highWater; i++)
          if (pz.alive[i] === 1 && pz.sourceRef[i] === eff.sourceRef) n++;
        if (n >= maxAlive) return;
      }
      const z = spawnPlayerZone(
        ctx,
        at.x,
        at.y,
        pnum(eff.p, 'radius', 0) * areaScale(ctx),
        sec(pnum(eff.p, 'duration', 0)),
        eff.sourceRef,
        tagsOf(ctx, eff),
        nd,
      );
      if (z < 0) return;
      const pz = ctx.world.playerZones;
      if (pnum(eff.p, 'tick', 0) > 0) pz.tickEvery[z] = Math.max(1, sec(pnum(eff.p, 'tick', 0)));
      pz.dmg[z] = pnum(eff.p, 'dmg', 0) * ctx.run.procScale;
      if (pstr(eff.p, 'status', '') === 'burn')
        pz.burnDps[z] = burnDpsNonHit(ctx, pnum(eff.p, 'dps', 0));
      break;
    }
    case Action.Execute:
      executeTarget(ctx);
      break;
    case Action.Heal: {
      const run = ctx.run;
      const cap = pnum(eff.p, 'max_per_sec', 0);
      if (ctx.world.tick - run.healWindowTick[eff.index]! >= TICK_RATE) {
        run.healWindowTick[eff.index] = ctx.world.tick;
        run.healAmount[eff.index] = 0;
      }
      let amt = pnum(eff.p, 'amount', 0) * mul;
      if (cap > 0) amt = Math.min(amt, cap - run.healAmount[eff.index]!);
      if (amt <= 0) return;
      run.healAmount[eff.index] = run.healAmount[eff.index]! + amt;
      healPlayer(ctx, amt, eff.sourceRef);
      break;
    }
    case Action.GainBarrier: {
      const cap = Math.max(p.barrierMax, 1);
      const before = p.barrier;
      p.barrier = Math.min(cap, p.barrier + Math.floor(pnum(eff.p, 'charges', 1)) * mul);
      if (p.barrier === before) return;
      ctx.run.statsDirty = true;
      ctx.events.push(SimEventType.BarrierGained, p.x, p.y, p.barrier, 0, 0);
      break;
    }
    case Action.GainGlint: {
      const mode = pstr(eff.p, 'mode', 'direct');
      const amount = pnum(eff.p, 'amount', 0) * mul;
      if (mode === 'drop') {
        origin(ctx, eff, at, false);
        dropGlint(ctx, at.x, at.y, amount);
      } else if (mode === 'same') {
        gainGlint(ctx, ctxAmount, true, false);
      } else if (mode === 'interest') {
        const div = pnum(eff.p, 'div', 0);
        if (div <= 0) return;
        gainGlint(
          ctx,
          Math.min(pnum(eff.p, 'cap', Infinity), Math.floor(p.glint / div)),
          false,
          false,
        );
      } else if (mode === 'formula') {
        gainGlint(
          ctx,
          pnum(eff.p, 'base', 0) + pnum(eff.p, 'per_t', 0) * ctx.run.threat,
          false,
          false,
        );
      } else {
        gainGlint(ctx, amount, false, false);
      }
      break;
    }
    case Action.Repeat: {
      const what = pstr(eff.p, 'what', 'area');
      const delay = sec(pnum(eff.p, 'delay', 0));
      const power = pnum(eff.p, 'power', 1);
      if (what === 'area') {
        queuePending(
          ctx,
          Pending.Area,
          eff,
          delay,
          areaCtx.dmg * power,
          power,
          areaCtx.radius,
          areaCtx.x,
          areaCtx.y,
          -1,
        );
      } else if (what === 'rite') {
        queuePending(ctx, Pending.Rite, eff, delay, 0, power, 0, areaCtx.x, areaCtx.y, -1);
      } else if (h !== undefined) {
        const other = nearestEnemy(ctx, h.x, h.y, pnum(eff.p, 'range', 0), target);
        if (other < 0) return;
        queuePending(ctx, Pending.Hit, eff, delay, h.final * power, power, 0, h.x, h.y, other);
      }
      break;
    }
    case Action.TriggerWeapons: {
      const scope = pstr(eff.p, 'scope', 'all');
      const ti = ctx.data.tags.findIndex((t) => t.id === scope);
      const power = pnum(eff.p, 'power', 1);
      const run = ctx.run;
      instances = 0;
      for (let slot = 0; slot < run.weaponIndex.length; slot++) {
        const wi = run.weaponIndex[slot]!;
        if (wi < 0) continue;
        if (scope !== 'all' && (ti < 0 || ((ctx.sd.weapons[wi]?.tagMask ?? 0) & (1 << ti)) === 0))
          continue;
        if (fireWeapon(ctx, slot, power)) instances++;
      }
      break;
    }
    case Action.Buff: {
      const run = ctx.run;
      const max = Math.max(1, Math.floor(pnum(eff.p, 'max_stacks', 1)));
      const before = run.buffStacks[eff.index]!;
      const refresh = pnum(eff.p, 'refresh', 1) > 0;
      if (before < max) run.buffStacks[eff.index] = before + 1;
      if (refresh || before === 0) run.buffTicks[eff.index] = sec(pnum(eff.p, 'duration', 0));
      if (run.buffStacks[eff.index] !== before) run.statsDirty = true;
      if (before < max && run.buffStacks[eff.index] === max) {
        ctx.events.push(SimEventType.BuffMaxed, p.x, p.y, eff.index, max, 0);
      }
      return;
    }
    default:
      return; // passive actions are applied by stats.ts
  }
  if (eff.emitsProc)
    ctx.events.push(SimEventType.ProcTriggered, p.x, p.y, eff.index, instances, eff.sourceRef);
}

// Event payloads for the trigger being dispatched (set right before dispatch; not state).
let ctxAmount = 0;
const areaCtx = { x: 0, y: 0, radius: 0, dmg: 0 };

/** Dispatch a trigger to every active entry of that trigger, in effect order. */
function dispatch(
  ctx: SimCtx,
  trigger: number,
  target: number,
  depth: number,
  skipHitMods: boolean,
  onlyHitMods: boolean,
): void {
  const a = ctx.active;
  const s = a.start[trigger]!;
  const e = a.start[trigger + 1]!;
  for (let k = s; k < e; k++) {
    const entry = a.order[k]!;
    const eff = ctx.sd.effects[a.effect[entry]!];
    if (eff === undefined) continue;
    const isHitMod = eff.action === Action.HitMod;
    if ((skipHitMods && isHitMod) || (onlyHitMods && !isHitMod)) continue;
    const g = gate(ctx, entry, target, depth);
    if (g !== null) act(ctx, g, entry, target, depth);
  }
}

function dispatchForceCrit(ctx: SimCtx, h: HitCtx): void {
  const a = ctx.active;
  const s = a.start[Trigger.OnHit]!;
  const e = a.start[Trigger.OnHit + 1]!;
  for (let k = s; k < e; k++) {
    const entry = a.order[k]!;
    const eff = ctx.sd.effects[a.effect[entry]!];
    if (eff?.action !== Action.HitMod || pstr(eff.p, 'mode', '') !== 'force_crit') continue;
    if (gate(ctx, entry, h.target, h.procDepth) !== null) h.forceCrit = true;
  }
}

function dispatchOtherHitMods(ctx: SimCtx, h: HitCtx): void {
  const a = ctx.active;
  const s = a.start[Trigger.OnHit]!;
  const e = a.start[Trigger.OnHit + 1]!;
  for (let k = s; k < e; k++) {
    const entry = a.order[k]!;
    const eff = ctx.sd.effects[a.effect[entry]!];
    if (eff?.action !== Action.HitMod || pstr(eff.p, 'mode', '') === 'force_crit') continue;
    const g = gate(ctx, entry, h.target, h.procDepth);
    if (g !== null) act(ctx, g, entry, h.target, h.procDepth);
  }
}

export function createEffectHooks(): EffectHooks {
  return {
    preHit(ctx) {
      const h = hitNow(ctx);
      if (h === undefined) return;
      dispatchForceCrit(ctx, h);
      h.crit = h.forceCrit || ctx.rng.combat.chance(statOf(ctx, ctx.sd.stat.crit_chance, 0) / 100);
      dispatchOtherHitMods(ctx, h);
    },
    postHit(ctx) {
      const h = hitNow(ctx);
      if (h === undefined) return;
      dispatch(ctx, Trigger.OnHit, h.target, h.procDepth, true, false);
      if (h.crit) dispatch(ctx, Trigger.OnCrit, h.target, h.procDepth, false, false);
    },
    onKill(ctx) {
      const h = hitNow(ctx);
      if (h === undefined) return;
      dispatch(ctx, Trigger.OnKill, h.target, h.procDepth, false, false);
    },
    onPlayerEvent(ctx, trigger, sourceRef, amount) {
      const h = beginHit(ctx);
      if (h === null) return;
      h.sourceRef = sourceRef;
      h.x = ctx.world.player.x;
      h.y = ctx.world.player.y;
      ctxAmount = amount;
      dispatch(ctx, trigger, -1, 0, false, false);
      endHit(ctx);
    },
    onArea(ctx, x, y, radius, dmg, tagMask, procDepth) {
      const h = beginHit(ctx);
      if (h === null) return;
      h.x = x;
      h.y = y;
      h.tagMask = tagMask;
      h.hitKind = HitKind.Area;
      h.procDepth = procDepth;
      h.final = dmg;
      areaCtx.x = x;
      areaCtx.y = y;
      areaCtx.radius = radius;
      areaCtx.dmg = dmg;
      dispatch(ctx, Trigger.OnArea, -1, procDepth, false, false);
      endHit(ctx);
    },
    onProjectileEnd(ctx, slot) {
      const ps = ctx.world.playerShots;
      const h = beginHit(ctx);
      if (h === null) return;
      h.x = ps.x[slot]!;
      h.y = ps.y[slot]!;
      h.tagMask = ps.tagMask[slot]!;
      h.hitKind = ps.hitKind[slot]!;
      h.procDepth = ps.procDepth[slot]!;
      h.weaponIndex = ps.weaponIndex[slot]!;
      h.weaponSlot = ps.weaponSlot[slot]!;
      h.final = ps.dmg[slot]!;
      dispatch(ctx, Trigger.OnProjectileEnd, -1, h.procDepth, false, false);
      endHit(ctx);
    },
    onRite(ctx, x, y) {
      const h = beginHit(ctx);
      if (h === null) return;
      h.x = x;
      h.y = y;
      h.isRite = true;
      areaCtx.x = x;
      areaCtx.y = y;
      dispatch(ctx, Trigger.OnRite, -1, 0, false, false);
      endHit(ctx);
    },
  };
}

/** Run triggers without a hit: on_pulse_start, on_pulse_end, on_shop_start. */
export function fireSimpleTrigger(ctx: SimCtx, trigger: number): void {
  const h = beginHit(ctx);
  if (h === null) return;
  h.x = ctx.world.player.x;
  h.y = ctx.world.player.y;
  dispatch(ctx, trigger, -1, 0, false, false);
  endHit(ctx);
}

/** periodic and on_distance effects, buff timers. Once per pulse tick. moved = floor distance this tick. */
export function updateTimedEffects(ctx: SimCtx, moved: number): void {
  const a = ctx.active;
  const run = ctx.run;
  // Buff expiry.
  for (let k = 0; k < a.count; k++) {
    const ei = a.effect[k]!;
    if (run.buffStacks[ei]! > 0) {
      run.buffTicks[ei] = run.buffTicks[ei]! - 1;
      if (run.buffTicks[ei] <= 0) {
        run.buffStacks[ei] = 0;
        run.statsDirty = true;
      }
    }
  }
  for (const trigger of TIMED) {
    const s = a.start[trigger]!;
    const e = a.start[trigger + 1]!;
    for (let k = s; k < e; k++) {
      const entry = a.order[k]!;
      const eff = ctx.sd.effects[a.effect[entry]!];
      if (eff === undefined) continue;
      let due = false;
      if (trigger === Trigger.Periodic) {
        const interval = sec(pnum(eff.p, 'interval', 0));
        if (interval <= 0) continue;
        run.effectTimer[eff.index] = run.effectTimer[eff.index]! + 1;
        if (run.effectTimer[eff.index]! >= interval) {
          run.effectTimer[eff.index] = 0;
          due = true;
        }
      } else {
        const dist = pnum(eff.p, 'distance', 0);
        if (dist <= 0) continue;
        run.effectDist[eff.index] = run.effectDist[eff.index]! + moved;
        if (run.effectDist[eff.index]! >= dist) {
          run.effectDist[eff.index] = run.effectDist[eff.index]! - dist;
          due = true;
        }
      }
      if (!due) continue;
      const h = beginHit(ctx);
      if (h === null) continue;
      h.x = ctx.world.player.x;
      h.y = ctx.world.player.y;
      const g = gate(ctx, entry, -1, 0);
      if (g !== null) act(ctx, g, entry, -1, 0);
      endHit(ctx);
    }
  }
}

const TIMED = [Trigger.Periodic, Trigger.OnDistance] as const;

/** Process pending actions due this tick, in (due tick, insertion) order. */
export function updatePending(ctx: SimCtx): void {
  const pd = ctx.pending;
  for (;;) {
    let best = -1;
    for (let i = 0; i < pd.highWater; i++) {
      if (pd.alive[i] === 0 || pd.dueTick[i]! > ctx.world.tick) continue;
      if (
        best < 0 ||
        pd.dueTick[i]! < pd.dueTick[best]! ||
        (pd.dueTick[i] === pd.dueTick[best] && pd.seq[i]! < pd.seq[best]!)
      )
        best = i;
    }
    if (best < 0) return;
    const kind = pd.kind[best]!;
    const eff = ctx.sd.effects[pd.effect[best]!];
    freeSlot(pd, best);
    switch (kind) {
      case Pending.Area:
        areaDamage(
          ctx,
          pd.x[best]!,
          pd.y[best]!,
          pd.radius[best]!,
          pd.dmg[best]!,
          pd.sourceRef[best]!,
          pd.tagMask[best]!,
          HitKind.Area,
          pd.procDepth[best]!,
          false,
          -1,
          0,
          -1,
          -1,
        );
        break;
      case Pending.Rite:
        castRite(ctx, pd.x[best]!, pd.y[best]!, pd.power[best]!, true);
        break;
      case Pending.Hit: {
        const t = pd.target[best]!;
        if (eff === undefined || ctx.world.enemies.serial[t] !== pd.targetSerial[best]) break;
        const h = beginHit(ctx);
        if (h === null) break;
        h.target = t;
        h.base = pd.dmg[best]!;
        h.sourceRef = pd.sourceRef[best]!;
        h.tagMask = pd.tagMask[best]!;
        h.hitKind = HitKind.Melee;
        h.procDepth = 1;
        applyHit(ctx);
        endHit(ctx);
        break;
      }
      case Pending.WeaponEcho:
        runWeaponEcho(ctx, best);
        break;
      default:
        break;
    }
  }
}
