/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Player and enemy projectiles: spawn, motion, collisions, range and bounds (GDD 6, 6.1; arena 4.2).

import { HitKind, cosTurns, sinTurns } from '../../core/index.ts';
import { insideDistance } from '../arena.ts';
import { PIERCE_MEMORY, PROC_SHOT_SOFT_CAP } from '../capacity.ts';
import { Archetype, ShotMode, Status } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { statOf } from '../ctx.ts';
import { allocSlot, freeSlot } from '../pools.ts';
import { pnum } from '../sim-data.ts';
import {
  applyHit,
  areaDamage,
  beginHit,
  burnDpsNonHit,
  canDamage,
  endHit,
  riteLanded,
} from './combat.ts';
import { spawnPlayerZone } from './areas.ts';
import { dropGlint } from './pickups.ts';

/** Reusable spawn description (filled by the caller, read by spawnPlayerShot). */
export interface ShotSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mode: number;
  dmg: number;
  dmg2: number;
  areaRadius: number;
  tagMask: number;
  hitKind: number;
  procDepth: number;
  isRite: boolean;
  pierce: number;
  range: number;
  weaponIndex: number;
  weaponSlot: number;
  tier: number;
  knockback: number;
  sourceRef: number;
  isProc: boolean;
  timer: number;
  targetX: number;
  targetY: number;
  phase: number;
  /** Status applied by the blast (Lantern Bolt explode_status=burn), -1 none. */
  status: number;
  /** Fire zone left by the blast (tier IV): radius u and ticks, 0 none. */
  zoneRadius: number;
  zoneTicks: number;
  /** Fire zone extras: Slow percent and damage tick interval (Rite Flare zone). */
  zoneSlow: number;
  zoneTick: number;
  /** Coin tier IV: extra targets after the first hit. */
  bounce: number;
}

export function createShotSpec(): ShotSpec {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    mode: ShotMode.Straight,
    dmg: 0,
    dmg2: 0,
    areaRadius: 0,
    tagMask: 0,
    hitKind: HitKind.Projectile,
    procDepth: 0,
    isRite: false,
    pierce: 0,
    range: 0,
    weaponIndex: -1,
    weaponSlot: -1,
    tier: 1,
    knockback: 0,
    sourceRef: 0,
    isProc: false,
    timer: 0,
    targetX: 0,
    targetY: 0,
    phase: 0,
    status: -1,
    zoneRadius: 0,
    zoneTicks: 0,
    zoneSlow: 0,
    zoneTick: 0,
    bounce: 0,
  };
}

/** Recount live proc projectiles (start of each pulse tick). */
export function recountProcShots(ctx: SimCtx): void {
  const ps = ctx.world.playerShots;
  let n = 0;
  for (let i = 0; i < ps.highWater; i++) if (ps.alive[i] === 1 && ps.isProc[i] === 1) n++;
  ctx.procLive = n;
}

/** Reset a spec to defaults before filling it. */
export function resetShotSpec(s: ShotSpec): void {
  // Every field: a reused spec must not leak values from the previous spawn into hashed state.
  s.x = 0;
  s.y = 0;
  s.vx = 0;
  s.vy = 0;
  s.radius = 0;
  s.mode = ShotMode.Straight;
  s.dmg = 0;
  s.dmg2 = 0;
  s.areaRadius = 0;
  s.tagMask = 0;
  s.hitKind = HitKind.Projectile;
  s.procDepth = 0;
  s.isRite = false;
  s.pierce = 0;
  s.range = 0;
  s.weaponIndex = -1;
  s.weaponSlot = -1;
  s.tier = 1;
  s.knockback = 0;
  s.sourceRef = 0;
  s.isProc = false;
  s.timer = 0;
  s.targetX = 0;
  s.targetY = 0;
  s.phase = 0;
  s.status = -1;
  s.zoneRadius = 0;
  s.zoneTicks = 0;
  s.zoneSlow = 0;
  s.zoneTick = 0;
  s.bounce = 0;
}

/** Spawn a player projectile. Proc projectiles above the soft cap are skipped (counted as overflow). */
export function spawnPlayerShot(ctx: SimCtx, s: ShotSpec): number {
  const ps = ctx.world.playerShots;
  // procLive is recounted once per pulse tick and raised per spawn (never lowered within the tick:
  // conservative, deterministic, no 512-slot scan per proc; LP review M1).
  if (s.isProc && ctx.procLive >= PROC_SHOT_SOFT_CAP) {
    ctx.poolOverflow++;
    return -1;
  }
  const i = allocSlot(ps);
  if (i < 0) {
    ctx.poolOverflow++;
    return -1;
  }
  if (s.isProc) ctx.procLive++;
  ps.x[i] = s.x;
  ps.y[i] = s.y;
  ps.prevX[i] = s.x;
  ps.prevY[i] = s.y;
  ps.radius[i] = s.radius;
  ps.vx[i] = s.vx;
  ps.vy[i] = s.vy;
  ps.mode[i] = s.mode;
  ps.dmg[i] = s.dmg;
  ps.dmg2[i] = s.dmg2;
  ps.areaRadius[i] = s.areaRadius;
  ps.tagMask[i] = s.tagMask;
  ps.hitKind[i] = s.hitKind;
  ps.procDepth[i] = s.procDepth;
  ps.isRite[i] = s.isRite ? 1 : 0;
  ps.pierceLeft[i] = s.pierce;
  ps.rangeLeft[i] = s.range;
  ps.weaponIndex[i] = s.weaponIndex;
  ps.weaponSlot[i] = s.weaponSlot;
  ps.tier[i] = s.tier;
  ps.knockback[i] = s.knockback;
  ps.sourceRef[i] = s.sourceRef;
  ps.isProc[i] = s.isProc ? 1 : 0;
  ps.timer[i] = s.timer;
  ps.targetX[i] = s.targetX;
  ps.targetY[i] = s.targetY;
  ps.phase[i] = s.phase;
  ps.hitCount[i] = 0;
  for (let k = 0; k < PIERCE_MEMORY; k++) {
    ps.hitSlots[i * PIERCE_MEMORY + k] = 0;
    ps.hitSerials[i * PIERCE_MEMORY + k] = 0;
  }
  ps.blastStatus[i] = s.status;
  ps.zoneRadius[i] = s.zoneRadius;
  ps.zoneTicks[i] = s.zoneTicks;
  ps.zoneSlow[i] = s.zoneSlow;
  ps.zoneTick[i] = s.zoneTick;
  ps.bounceLeft[i] = s.bounce;
  return i;
}

function alreadyHit(ctx: SimCtx, i: number, target: number): boolean {
  const ps = ctx.world.playerShots;
  const n = ps.hitCount[i]!;
  const serial = ctx.world.enemies.serial[target]!;
  const base = i * PIERCE_MEMORY;
  for (let k = 0; k < n; k++) {
    if (ps.hitSlots[base + k] === target && ps.hitSerials[base + k] === serial) return true;
  }
  return false;
}

function rememberHit(ctx: SimCtx, i: number, target: number): void {
  const ps = ctx.world.playerShots;
  const base = i * PIERCE_MEMORY;
  const n = ps.hitCount[i]!;
  // Ring buffer once full: the oldest entry is overwritten.
  const at = n < PIERCE_MEMORY ? n : (n + ctx.world.tick) % PIERCE_MEMORY;
  ps.hitSlots[base + at] = target;
  ps.hitSerials[base + at] = ctx.world.enemies.serial[target]!;
  if (n < PIERCE_MEMORY) ps.hitCount[i] = n + 1;
}

/**
 * Tithe Coin (GDD 4.1, 6.2): a kill by a coin drops glint_per_kill (+ tier add) Glint as a piece at
 * the kill point, at most glint_cap_base + glint_cap_per_tier x tier per weapon slot per Pulse.
 * Missing keys: no Glint (behavior off).
 */
function coinKill(ctx: SimCtx, i: number, x: number, y: number): void {
  const ps = ctx.world.playerShots;
  const wi = ps.weaponIndex[i]!;
  const slot = ps.weaponSlot[i]!;
  const w = wi >= 0 ? ctx.sd.weapons[wi] : undefined;
  if (w?.archetype !== Archetype.Coin || slot < 0) return;
  const tier = Math.max(1, ps.tier[i]!);
  const t = w.tiers[tier - 1];
  if (t === undefined) return;
  const per = pnum(t.p, 'glint_per_kill', 0) + pnum(t.p, 'glint_per_kill_add', 0);
  const cap = pnum(t.p, 'glint_cap_base', 0) + pnum(t.p, 'glint_cap_per_tier', 0) * tier;
  const run = ctx.run;
  const left = cap - run.coinGlint[slot]!;
  const amount = Math.min(per, left);
  if (amount <= 0) return;
  run.coinGlint[slot] = run.coinGlint[slot]! + amount;
  dropGlint(ctx, x, y, amount);
}

/** Coin bounce: turn toward the nearest Unlit not hit yet within the remaining range. */
function bounceShot(ctx: SimCtx, i: number, from: number): boolean {
  const ps = ctx.world.playerShots;
  const e = ctx.world.enemies;
  const x = ps.x[i]!;
  const y = ps.y[i]!;
  let best = -1;
  let bestD = ps.rangeLeft[i]! * ps.rangeLeft[i]!;
  for (let s = 0; s < e.highWater; s++) {
    if (s === from || !canDamage(ctx, s) || alreadyHit(ctx, i, s)) continue;
    const dx = e.x[s]! - x;
    const dy = e.y[s]! - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (best < 0) return false;
  const sp = Math.sqrt(ps.vx[i]! * ps.vx[i]! + ps.vy[i]! * ps.vy[i]!);
  const d = Math.sqrt(bestD);
  if (d <= 0 || sp <= 0) return false;
  ps.vx[i] = ((e.x[best]! - x) / d) * sp;
  ps.vy[i] = ((e.y[best]! - y) / d) * sp;
  ps.bounceLeft[i] = ps.bounceLeft[i]! - 1;
  return true;
}

function hitWithShot(ctx: SimCtx, i: number, target: number): void {
  const ps = ctx.world.playerShots;
  const h = beginHit(ctx);
  if (h === null) return;
  h.target = target;
  h.base = ps.dmg[i]!;
  h.sourceRef = ps.sourceRef[i]!;
  h.tagMask = ps.tagMask[i]!;
  h.hitKind = ps.hitKind[i]!;
  h.procDepth = ps.procDepth[i]!;
  h.isRite = ps.isRite[i] === 1;
  h.weaponIndex = ps.weaponIndex[i]!;
  h.weaponSlot = ps.weaponSlot[i]!;
  h.knockback = ps.knockback[i]!;
  applyHit(ctx);
  if (h.killed && h.procDepth === 0) coinKill(ctx, i, h.x, h.y);
  endHit(ctx);
}

/** Bolt blast and Lob landing: area damage, optional status and fire zone. Frees the shot. */
function explode(ctx: SimCtx, i: number, x: number, y: number): void {
  const ps = ctx.world.playerShots;
  const st = ps.blastStatus[i]!;
  const hits = areaDamage(
    ctx,
    x,
    y,
    ps.areaRadius[i]!,
    ps.dmg2[i]!,
    ps.sourceRef[i]!,
    ps.tagMask[i]!,
    HitKind.Area,
    ps.procDepth[i]!,
    ps.isRite[i] === 1,
    st,
    0,
    ps.weaponIndex[i]!,
    ps.weaponSlot[i]!,
  );
  if (ps.isRite[i] === 1) riteLanded(ctx, x, y, ps.areaRadius[i]!, hits);
  const zr = ps.zoneRadius[i]!;
  const zt = ps.zoneTicks[i]!;
  if (zr > 0 && zt > 0) {
    const z = spawnPlayerZone(
      ctx,
      x,
      y,
      zr,
      zt,
      ps.sourceRef[i]!,
      ps.tagMask[i]!,
      ps.procDepth[i]!,
    );
    if (z >= 0) {
      const pz = ctx.world.playerZones;
      pz.burnDps[z] = st === Status.Burn ? burnDpsNonHit(ctx, 0) : 0;
      pz.slowPct[z] = ps.zoneSlow[i]!;
      if (ps.zoneTick[i]! > 0) pz.tickEvery[z] = ps.zoneTick[i]!;
    }
  }
  freeSlot(ps, i);
}

export function updatePlayerShots(ctx: SimCtx): void {
  const { world } = ctx;
  const ps = world.playerShots;
  const e = world.enemies;
  const p = world.player;
  const grid = ctx.grid;
  const arena = ctx.arena;
  const hitBuf = ctx.scratch2;
  const margin = arena !== null ? -arena.projectileMargin : -Infinity;
  for (let i = 0; i < ps.highWater; i++) {
    if (ps.alive[i] === 0) continue;
    const mode = ps.mode[i]!;
    ps.prevX[i] = ps.x[i]!;
    ps.prevY[i] = ps.y[i]!;
    if (mode === ShotMode.Orbit) continue; // orbit shards are driven by the weapon system
    if (mode === ShotMode.Lob) {
      const t = ps.timer[i]!;
      if (t <= 1) {
        ps.x[i] = ps.targetX[i]!;
        ps.y[i] = ps.targetY[i]!;
        explode(ctx, i, ps.x[i]!, ps.y[i]!);
        continue;
      }
      ps.x[i] = ps.x[i]! + (ps.targetX[i]! - ps.x[i]!) / t;
      ps.y[i] = ps.y[i]! + (ps.targetY[i]! - ps.y[i]!) / t;
      ps.timer[i] = t - 1;
      continue;
    }
    if (mode === ShotMode.Boomerang && ps.phase[i] === 1) {
      // Returning: home on the player, free on arrival.
      const dx = p.x - ps.x[i]!;
      const dy = p.y - ps.y[i]!;
      const d = Math.sqrt(dx * dx + dy * dy);
      const sp = Math.sqrt(ps.vx[i]! * ps.vx[i]! + ps.vy[i]! * ps.vy[i]!);
      if (d <= sp || d === 0) {
        freeSlot(ps, i);
        continue;
      }
      ps.vx[i] = (dx / d) * sp;
      ps.vy[i] = (dy / d) * sp;
    }
    ps.x[i] = ps.x[i]! + ps.vx[i]!;
    ps.y[i] = ps.y[i]! + ps.vy[i]!;
    const step = Math.sqrt(ps.vx[i]! * ps.vx[i]! + ps.vy[i]! * ps.vy[i]!);
    if (!(mode === ShotMode.Boomerang && ps.phase[i] === 1))
      ps.rangeLeft[i] = ps.rangeLeft[i]! - step;

    // Collisions.
    if (grid !== null) {
      const n = grid.query(ps.x[i]!, ps.y[i]!, ps.radius[i]! + ctx.cfg.enemyRadiusBossU, hitBuf);
      let ended = false;
      for (let k = 0; k < n && !ended; k++) {
        const s = hitBuf[k]!;
        if (!canDamage(ctx, s) || alreadyHit(ctx, i, s)) continue;
        const dx = e.x[s]! - ps.x[i]!;
        const dy = e.y[s]! - ps.y[i]!;
        const rr = ps.radius[i]! + e.radius[s]!;
        if (dx * dx + dy * dy > rr * rr) continue;
        rememberHit(ctx, i, s);
        if (mode === ShotMode.Bolt) {
          const bx = ps.x[i]!;
          const by = ps.y[i]!;
          hitWithShot(ctx, i, s);
          explode(ctx, i, bx, by);
          ended = true;
          break;
        }
        hitWithShot(ctx, i, s);
        if (mode === ShotMode.Straight && ps.alive[i] === 1) {
          if (ps.bounceLeft[i]! > 0 && bounceShot(ctx, i, s)) {
            ended = true;
            break;
          }
          ps.pierceLeft[i] = ps.pierceLeft[i]! - 1;
          if (ps.pierceLeft[i]! < 0) {
            ctx.fx.onProjectileEnd(ctx, i);
            freeSlot(ps, i);
            ended = true;
          }
        }
      }
      if (ended) continue;
    }

    if (ps.rangeLeft[i]! <= 0) {
      if (mode === ShotMode.Bolt) {
        explode(ctx, i, ps.x[i]!, ps.y[i]!);
      } else if (mode === ShotMode.Boomerang) {
        // Only once at the turn: rangeLeft stays <= 0 while returning (GD M2-01: the reset every
        // tick let a returning blade hit a large target once per tick).
        if (ps.phase[i] === 0) {
          ps.phase[i] = 1;
          ps.hitCount[i] = 0; // may hit each enemy again on the way back
        }
      } else {
        ctx.fx.onProjectileEnd(ctx, i);
        freeSlot(ps, i);
      }
      continue;
    }
    if (arena !== null && insideDistance(arena, ps.x[i]!, ps.y[i]!) < margin) freeSlot(ps, i);
  }
}

/** Fan of directions around an angle (turns): projectile k of n, spread between neighbours. */
export function fanAngle(baseTurns: number, k: number, n: number, spreadTurns: number): number {
  return baseTurns + (k - (n - 1) * 0.5) * spreadTurns;
}

export function dirX(turns: number): number {
  return cosTurns(turns);
}
export function dirY(turns: number): number {
  return sinTurns(turns);
}

/** Radius multiplier from area_pct (GDD 5.2). */
export function areaScale(ctx: SimCtx): number {
  return 1 + statOf(ctx, ctx.sd.stat.area_pct, 0) / 100;
}
