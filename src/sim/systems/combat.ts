/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Damage both ways, kills, statuses, knockback (GDD 5.2 to 5.4, effect-primitives 6.1, 6.2, 6.6).

import {
  HitKind,
  SimEventType,
  SourceKind,
  StatusBit,
  TICK_RATE,
  cosTurns,
  encodeSource,
  packDamageFlags,
  sinTurns,
} from '../../core/index.ts';
import { clampInside } from '../arena.ts';
import type { Point } from '../arena.ts';
import { BURN_STACK_SLOTS, HIT_STACK_DEPTH } from '../capacity.ts';
import { AiState, Behavior, Status, Trigger } from '../codes.ts';
import type { HitCtx, SimCtx } from '../ctx.ts';
import { statOf } from '../ctx.ts';
import { freeSlot } from '../pools.ts';
import { pnum } from '../sim-data.ts';
import { dropGlint, gainGlint } from './pickups.ts';

const tmp: Point = { x: 0, y: 0 };

/** Push a fresh hit context (nesting level +1). Returns null when the stack is exhausted. */
export function beginHit(ctx: SimCtx): HitCtx | null {
  if (ctx.hitDepth + 1 >= HIT_STACK_DEPTH) return null;
  ctx.hitDepth++;
  const h = ctx.hits[ctx.hitDepth];
  if (h === undefined) return null;
  h.target = -1;
  h.targetSerial = 0;
  h.sourceRef = 0;
  h.weaponIndex = -1;
  h.weaponSlot = -1;
  h.tagMask = 0;
  h.hitKind = HitKind.Projectile;
  h.procDepth = 0;
  h.isRite = false;
  h.base = 0;
  h.crit = false;
  h.forceCrit = false;
  h.bonus = 0;
  h.vuln = 0;
  h.critMultAdd = 0;
  h.preCrit = 0;
  h.final = 0;
  h.hpBefore = 0;
  h.killed = false;
  h.executed = false;
  h.x = 0;
  h.y = 0;
  h.knockback = 0;
  h.status = -1;
  h.statusChance = 0;
  h.noLeech = false;
  return h;
}

export function endHit(ctx: SimCtx): void {
  if (ctx.hitDepth >= 0) ctx.hitDepth--;
}

/** True when the enemy can take damage now (not dying, not emerging, not in a boss transition). */
export function canDamage(ctx: SimCtx, slot: number): boolean {
  const e = ctx.world.enemies;
  if (slot < 0 || e.alive[slot] === 0 || e.hp[slot]! <= 0) return false;
  const st = e.aiState[slot];
  return st !== AiState.Transition && st !== AiState.Emerging;
}

function healWindow(ctx: SimCtx): void {
  const run = ctx.run;
  if (ctx.world.tick - run.leechWindowTick >= TICK_RATE) {
    run.leechWindowTick = ctx.world.tick;
    run.leechHealed = 0;
  }
}

export function healPlayer(ctx: SimCtx, amount: number, sourceRef: number): void {
  const p = ctx.world.player;
  if (amount <= 0 || p.hp <= 0 || p.hp >= p.maxHp) return;
  const got = Math.min(amount, p.maxHp - p.hp);
  p.hp += got;
  ctx.events.push(SimEventType.PlayerHealed, p.x, p.y, got, 0, sourceRef);
}

/** Apply knockback (GDD 5.4): distance x (1 - kb_resist), spread over knockback_s. Chargers are immune. */
export function knockEnemy(
  ctx: SimCtx,
  slot: number,
  fromX: number,
  fromY: number,
  dist: number,
): void {
  const e = ctx.world.enemies;
  if (dist <= 0 || e.alive[slot] === 0) return;
  const def = ctx.data.enemies[e.typeIndex[slot]!];
  const sim = ctx.sd.enemies[e.typeIndex[slot]!];
  if (def === undefined || sim === undefined) return;
  if (
    e.aiState[slot] === AiState.Attack &&
    (sim.behavior === Behavior.Charger || sim.behavior === Behavior.WardenHound)
  )
    return;
  const d = dist * (1 - def.kbResist);
  if (d <= 0) return;
  let dx = e.x[slot]! - fromX;
  let dy = e.y[slot]! - fromY;
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) {
    dx = e.facing[slot]! >= 0 ? -1 : 1;
    dy = 0;
    len = 1;
  }
  const ticks = Math.max(1, ctx.cfg.knockbackTicks);
  e.kbX[slot] = ((dx / len) * d) / ticks;
  e.kbY[slot] = ((dy / len) * d) / ticks;
  e.kbTicks[slot] = ticks;
  if (ctx.run.knockbackAddMark > 0) applyMark(ctx, slot, ctx.run.knockbackAddMark * TICK_RATE, -1);
}

function statusDef(ctx: SimCtx, id: string): (typeof ctx.data.statuses)[number] | undefined {
  const i = ctx.sd.statusIndex[id];
  return i === undefined ? undefined : ctx.data.statuses[i];
}

export function applyMark(ctx: SimCtx, slot: number, ticks: number, pct: number): void {
  const e = ctx.world.enemies;
  const def = statusDef(ctx, 'mark');
  const dur = ticks > 0 ? ticks : (def?.durationTicks ?? 0);
  const v = pct >= 0 ? pct : def !== undefined ? pnum(def.params, 'vuln', 0) : 0;
  if (dur <= 0) return;
  e.markTicks[slot] = Math.max(e.markTicks[slot]!, dur);
  e.markPct[slot] = Math.max(e.markPct[slot]!, v);
}

export function applySlow(ctx: SimCtx, slot: number, pct: number, ticks: number): void {
  const e = ctx.world.enemies;
  const def = statusDef(ctx, 'slow');
  const dur = ticks > 0 ? ticks : (def?.durationTicks ?? 0);
  if (dur <= 0 || pct <= 0) return;
  if (pct >= e.slowPct[slot]! || e.slowTicks[slot]! <= 0) e.slowPct[slot] = pct;
  e.slowTicks[slot] = Math.max(e.slowTicks[slot]!, dur);
}

/** Burn stacking (effect-primitives 6.6): add below max stacks, else replace the weakest if stronger. */
export function applyBurn(ctx: SimCtx, slot: number, dps: number, stacks: number): void {
  const e = ctx.world.enemies;
  const def = statusDef(ctx, 'burn');
  if (def === undefined || dps <= 0 || e.alive[slot] === 0) return;
  const max = Math.min(
    BURN_STACK_SLOTS,
    Math.max(1, Math.floor(statOf(ctx, ctx.sd.stat.burn_max_stacks, 1))),
  );
  const base = slot * BURN_STACK_SLOTS;
  const wasBurning = e.burnStacks[slot]! > 0;
  for (let s = 0; s < Math.max(1, stacks); s++) {
    const n = e.burnStacks[slot]!;
    if (n < max) {
      e.burnDps[base + n] = dps;
      e.burnStacks[slot] = n + 1;
    } else {
      let weak = 0;
      for (let k = 1; k < n; k++) if (e.burnDps[base + k]! < e.burnDps[base + weak]!) weak = k;
      if (dps > e.burnDps[base + weak]!) e.burnDps[base + weak] = dps;
    }
  }
  e.burnTicks[slot] = def.durationTicks;
  if (!wasBurning) e.burnTickTimer[slot] = Math.max(1, def.tickTicks);
  if (ctx.run.burnAddMark > 0) applyMark(ctx, slot, ctx.run.burnAddMark * TICK_RATE, -1);
}

/** Burn DPS per stack from a hit (dps_frac x preCrit hit), or the non-hit DPS (burn_dps_nonhit x proc_scale). */
export function burnDpsFromHit(ctx: SimCtx, preCrit: number): number {
  const def = statusDef(ctx, 'burn');
  return def === undefined ? 0 : pnum(def.params, 'dps_frac', 0) * preCrit;
}

export function burnDpsNonHit(ctx: SimCtx, dpsParam: number): number {
  const base = dpsParam > 0 ? dpsParam : ctx.cfg.burnDpsNonhit;
  return base * ctx.run.procScale;
}

/** Kill an enemy: events, Glint, Warden and boss bookkeeping, on_kill (byPlayer only). */
export function killEnemy(ctx: SimCtx, slot: number, sourceRef: number, byPlayer: boolean): void {
  const { world, run } = ctx;
  const e = world.enemies;
  if (e.alive[slot] === 0) return;
  e.hp[slot] = 0;
  const type = e.typeIndex[slot]!;
  const rank = e.rank[slot]!;
  const x = e.x[slot]!;
  const y = e.y[slot]!;
  world.runStats.kills++;
  ctx.events.push(SimEventType.EnemyKilled, x, y, type, rank, sourceRef);
  if (byPlayer) ctx.fx.onKill(ctx);
  const def = ctx.data.enemies[type];
  const glint = def?.glint ?? 0;
  if (byPlayer || rank > 0) run.siltKills += def?.silt ?? 0;
  if (rank === 1) {
    run.wardenKilled = true;
    run.wardenSlot = -1;
    run.rewardPending = true;
    run.rewardSourceType = type;
    ctx.events.push(SimEventType.WardenKilled, x, y, type, 0, 0);
    if (world.pulse.overtime) gainGlint(ctx, glint, true, false);
    else dropPieces(ctx, x, y, glint, ctx.sd.enemies[type]?.glintPieces ?? 1);
  } else if (rank === 2) {
    run.bossKilled = true;
    run.bossSlot = -1;
    ctx.events.push(SimEventType.BossKilled, x, y, type, 0, 0);
    dropPieces(ctx, x, y, glint, ctx.sd.enemies[type]?.glintPieces ?? 1);
  } else {
    dropGlint(ctx, x, y, glint);
  }
  freeSlot(e, slot);
}

function dropPieces(ctx: SimCtx, x: number, y: number, total: number, pieces: number): void {
  if (total <= 0) return;
  const each = Math.floor(total / pieces);
  let left = total;
  for (let i = 0; i < pieces; i++) {
    const v = i === pieces - 1 ? left : each;
    left -= v;
    const a = pieces > 1 ? i / pieces : 0;
    // Spread pieces on a small ring so they read as separate drops.
    dropGlint(
      ctx,
      x + ctx.cfg.spawnGroupSpreadU * cosTurns(a),
      y + ctx.cfg.spawnGroupSpreadU * sinTurns(a),
      v,
    );
  }
}

/**
 * Apply the current hit (ctx.hits[ctx.hitDepth]) to its target: effect-primitives 6.1 steps 2 to 8.
 * Caller fills target, base (tier and proc scaling included), source fields.
 */
export function applyHit(ctx: SimCtx): void {
  const h = ctx.hits[ctx.hitDepth];
  if (h === undefined) return;
  const slot = h.target;
  if (!canDamage(ctx, slot)) return;
  const { world, sd, cfg, run } = ctx;
  const e = world.enemies;
  h.targetSerial = e.serial[slot]!;
  h.hpBefore = e.hp[slot]!;
  h.x = e.x[slot]!;
  h.y = e.y[slot]!;
  h.bonus = statOf(ctx, sd.stat.damage_pct, 0) / 100;
  if (e.markTicks[slot]! > 0) h.vuln += e.markPct[slot]!;
  // Glass Step: the next N non-proc weapon hits are forced crits.
  if (run.critForcedHits > 0 && h.procDepth === 0 && h.weaponIndex >= 0) {
    h.forceCrit = true;
    run.critForcedHits--;
  }
  ctx.fx.preHit(ctx);
  h.preCrit = h.base * (1 + h.bonus) * (1 + h.vuln);
  const critMult = statOf(ctx, sd.stat.crit_mult, 1) + h.critMultAdd;
  const hit = h.preCrit * (h.crit ? critMult : 1);
  const def = ctx.data.enemies[e.typeIndex[slot]!];
  const guard = def?.guard ?? 0;
  let dmg = guard > 0 ? Math.max(hit * cfg.guardMinFrac, hit - guard) : hit;
  // Shell (affix veiled) absorbs first.
  if (e.shield[slot]! > 0) {
    const absorbed = Math.min(e.shield[slot]!, dmg);
    e.shield[slot] = e.shield[slot]! - absorbed;
    dmg -= absorbed;
  }
  let hp = e.hp[slot]! - dmg;
  if (e.rank[slot] === 2 && run.bossHpFloor > 0 && hp < run.bossHpFloor) hp = run.bossHpFloor;
  h.final = e.hp[slot]! - hp;
  e.hp[slot] = hp;
  e.hitFlashTicks[slot] = 1;
  ctx.events.push(
    SimEventType.EnemyDamaged,
    h.x,
    h.y,
    h.final,
    packDamageFlags(h.crit, h.procDepth > 0, e.rank[slot]!, h.hitKind),
    h.sourceRef,
  );
  // Leech: non-proc hits only, capped per second (GDD 5.1).
  const leech = statOf(ctx, sd.stat.leech, 0);
  if (leech > 0 && h.procDepth === 0 && !h.noLeech && ctx.rng.combat.chance(leech / 100)) {
    healWindow(ctx);
    if (run.leechHealed + 1 <= cfg.leechHealCapPerTick * TICK_RATE) {
      run.leechHealed += 1;
      healPlayer(ctx, 1, encodeSource(SourceKind.Status, 0));
    }
  }
  if (h.knockback > 0) knockEnemy(ctx, slot, world.player.x, world.player.y, h.knockback);
  if (h.status === Status.Burn && (h.statusChance <= 0 || ctx.rng.combat.chance(h.statusChance))) {
    applyBurn(ctx, slot, burnDpsFromHit(ctx, h.preCrit), 1);
  }
  ctx.fx.postHit(ctx);
  if (e.alive[slot] === 1 && e.hp[slot] <= 0) {
    h.killed = true;
    killEnemy(ctx, slot, h.sourceRef, true);
  }
}

/** Kill the current hit's target through execute (ignores guard, counts as a kill by that hit). */
export function executeTarget(ctx: SimCtx): void {
  const h = ctx.hits[ctx.hitDepth];
  if (h === undefined || !canDamage(ctx, h.target)) return;
  const e = ctx.world.enemies;
  if (e.rank[h.target] === 2) return;
  h.executed = true;
  h.killed = true;
  e.hp[h.target] = 0;
  killEnemy(ctx, h.target, h.sourceRef, true);
}

/**
 * Damage every enemy in a circle with one hit each (explosions, Rite, spawn_area). Raises on_area once.
 * baseDmg already includes tier or proc scaling.
 */
export function areaDamage(
  ctx: SimCtx,
  x: number,
  y: number,
  radius: number,
  baseDmg: number,
  sourceRef: number,
  tagMask: number,
  hitKind: number,
  procDepth: number,
  isRite: boolean,
  status: number,
  knockback: number,
  weaponIndex: number,
  weaponSlot: number,
): void {
  const grid = ctx.grid;
  const depth = ctx.hitDepth + 1;
  const buf = ctx.queryBufs[depth];
  if (grid === null || buf === undefined) return;
  const e = ctx.world.enemies;
  const n = grid.query(x, y, radius + ctx.cfg.enemyRadiusBossU, buf);
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    if (!canDamage(ctx, s)) continue;
    const dx = e.x[s]! - x;
    const dy = e.y[s]! - y;
    const rr = radius + e.radius[s]!;
    if (dx * dx + dy * dy > rr * rr) continue;
    const h = beginHit(ctx);
    if (h === null) return;
    h.target = s;
    h.base = baseDmg;
    h.sourceRef = sourceRef;
    h.tagMask = tagMask;
    h.hitKind = hitKind;
    h.procDepth = procDepth;
    h.isRite = isRite;
    h.weaponIndex = weaponIndex;
    h.weaponSlot = weaponSlot;
    h.status = status;
    if (knockback > 0 && e.alive[s] === 1) knockEnemy(ctx, s, x, y, knockback);
    applyHit(ctx);
    endHit(ctx);
  }
  ctx.fx.onArea(ctx, x, y, radius, baseDmg, tagMask, procDepth);
}

/** Burn ticks, status timers, status bits, knockback motion. Once per tick in the pulse phase. */
export function updateEnemyStatuses(ctx: SimCtx): void {
  const { world, run } = ctx;
  const e = world.enemies;
  const burnDef = statusDef(ctx, 'burn');
  const tickTicks = burnDef !== undefined ? Math.max(1, burnDef.tickTicks) : 1;
  const tickSec = tickTicks / TICK_RATE;
  const burnRef = encodeSource(SourceKind.Status, Status.Burn);
  for (let s = 0; s < e.highWater; s++) {
    if (e.alive[s] === 0) continue;
    if (e.kbTicks[s]! > 0) {
      e.x[s] = e.x[s]! + e.kbX[s]!;
      e.y[s] = e.y[s]! + e.kbY[s]!;
      e.kbTicks[s] = e.kbTicks[s]! - 1;
      if (ctx.arena !== null) {
        clampInside(ctx.arena, e.x[s]!, e.y[s]!, e.radius[s]!, tmp);
        e.x[s] = tmp.x;
        e.y[s] = tmp.y;
      }
    }
    if (e.slowTicks[s]! > 0) e.slowTicks[s] = e.slowTicks[s]! - 1;
    if (e.markTicks[s]! > 0) e.markTicks[s] = e.markTicks[s]! - 1;
    if (e.hitFlashTicks[s]! > 0) e.hitFlashTicks[s] = e.hitFlashTicks[s]! - 1;
    if (e.burnStacks[s]! > 0) {
      e.burnTicks[s] = e.burnTicks[s]! - 1;
      e.burnTickTimer[s] = e.burnTickTimer[s]! - 1;
      if (e.burnTickTimer[s]! <= 0) {
        e.burnTickTimer[s] = tickTicks;
        let dps = 0;
        const base = s * BURN_STACK_SLOTS;
        for (let k = 0; k < e.burnStacks[s]!; k++) dps += e.burnDps[base + k]!;
        burnTick(ctx, s, dps * tickSec * run.burnDmgMult, burnRef);
      }
      if (e.alive[s] === 1 && e.burnTicks[s]! <= 0) e.burnStacks[s] = 0;
    }
    if (e.alive[s] === 0) continue;
    let mask = 0;
    if (e.burnStacks[s]! > 0) mask |= StatusBit.Burn;
    if (e.slowTicks[s]! > 0) mask |= StatusBit.Slow;
    if (e.markTicks[s]! > 0) mask |= StatusBit.Mark;
    e.statusMask[s] = mask;
  }
}

/** One Burn tick: dot, procDepth 1, no crit, ignores guard and hit bonuses (effect-primitives 6.6). */
function burnTick(ctx: SimCtx, slot: number, dmg: number, sourceRef: number): void {
  if (!canDamage(ctx, slot) || dmg <= 0) return;
  const e = ctx.world.enemies;
  const h = beginHit(ctx);
  if (h === null) return;
  h.target = slot;
  h.targetSerial = e.serial[slot]!;
  h.sourceRef = sourceRef;
  h.hitKind = HitKind.Dot;
  h.procDepth = 1;
  h.hpBefore = e.hp[slot]!;
  h.x = e.x[slot]!;
  h.y = e.y[slot]!;
  let hp = e.hp[slot]! - dmg;
  if (e.rank[slot] === 2 && ctx.run.bossHpFloor > 0 && hp < ctx.run.bossHpFloor)
    hp = ctx.run.bossHpFloor;
  h.final = e.hp[slot]! - hp;
  e.hp[slot] = hp;
  ctx.events.push(
    SimEventType.EnemyDamaged,
    h.x,
    h.y,
    h.final,
    packDamageFlags(false, true, e.rank[slot]!, HitKind.Dot),
    sourceRef,
  );
  // Pyre Bell style spread (status_rule spread_chance, spread_range).
  if (
    ctx.run.burnSpreadChance > 0 &&
    ctx.run.burnSpreadRange > 0 &&
    ctx.rng.combat.chance(ctx.run.burnSpreadChance)
  ) {
    const other = nearestEnemy(ctx, h.x, h.y, ctx.run.burnSpreadRange, slot);
    if (other >= 0) applyBurn(ctx, other, e.burnDps[slot * BURN_STACK_SLOTS]!, 1);
  }
  if (e.hp[slot] <= 0) {
    h.killed = true;
    killEnemy(ctx, slot, sourceRef, true);
  }
  endHit(ctx);
}

/** Nearest damageable enemy within range of (x, y), excluding one slot; ties go to the smallest slot. */
export function nearestEnemy(
  ctx: SimCtx,
  x: number,
  y: number,
  range: number,
  exclude: number,
): number {
  const e = ctx.world.enemies;
  let best = -1;
  let bestD = range * range;
  for (let s = 0; s < e.highWater; s++) {
    if (s === exclude || !canDamage(ctx, s)) continue;
    const dx = e.x[s]! - x;
    const dy = e.y[s]! - y;
    const d = dx * dx + dy * dy;
    if (d < bestD || (d === bestD && best < 0)) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * Damage to the player (GDD 5.3): ignored while invulnerable, then dodge, Barrier, armor, iframes.
 * raw already includes dm(t) and the Crack multiplier.
 */
export function damagePlayer(ctx: SimCtx, raw: number, sourceRef: number): void {
  const { world, cfg, sd, run } = ctx;
  const p = world.player;
  if (world.phase !== 'pulse' || run.deathTicks >= 0 || p.hp <= 0 || raw <= 0) return;
  if (p.invulnTicks > 0) return;
  const dodge = statOf(ctx, sd.stat.dodge, 0);
  if (dodge > 0 && ctx.rng.combat.chance(dodge / 100)) {
    p.invulnTicks = cfg.iframesDodgeTicks;
    ctx.events.push(SimEventType.PlayerDodged, p.x, p.y, 0, 0, sourceRef);
    ctx.fx.onPlayerEvent(ctx, Trigger.OnDodge, sourceRef, 0);
    return;
  }
  if (p.barrier >= 1) {
    p.barrier--;
    p.invulnTicks = cfg.iframesBlockTicks;
    ctx.events.push(SimEventType.DamageBlocked, p.x, p.y, p.barrier, 0, sourceRef);
    ctx.fx.onPlayerEvent(ctx, Trigger.OnBlock, sourceRef, p.barrier);
    run.statsDirty = true;
    return;
  }
  const armor = statOf(ctx, sd.stat.armor, 0);
  const k = cfg.armorK;
  let mult = armor >= 0 ? k / (k + armor) : 1 + -armor / k;
  if (mult < 1 - cfg.armorMaxReduction) mult = 1 - cfg.armorMaxReduction;
  const dmg = Math.max(1, raw * mult);
  p.hp -= dmg;
  p.invulnTicks = cfg.iframesHurtTicks;
  p.hitFlashTicks = cfg.iframesHurtTicks;
  run.unhurtThisPulse = false;
  run.lastHurtTick = world.tick;
  ctx.events.push(SimEventType.PlayerDamaged, p.x, p.y, dmg, Math.max(0, p.hp), sourceRef);
  if (p.hp <= 0) {
    p.hp = 0;
    world.runStats.killedBy = sourceRef;
    run.deathTicks = Math.max(1, cfg.deathSlowmoTicks);
    ctx.events.push(SimEventType.PlayerDied, p.x, p.y, 0, 0, sourceRef);
    return;
  }
  ctx.fx.onPlayerEvent(ctx, Trigger.OnHurt, sourceRef, dmg);
}

/** Damage scale for enemy attacks this Pulse: dm(t) x Crack multiplier. */
export function enemyDamage(ctx: SimCtx, base: number): number {
  return base * ctx.run.dmgScale;
}
