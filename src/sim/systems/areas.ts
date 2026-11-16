/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Ground areas: enemy telegraphs and danger zones (layer L4), player zones (layer L3).
// Telegraph timing comes from data; this module only resolves shapes (GDD 14.1, architecture 6.4).

import {
  AreaShape,
  HitKind,
  SimEventType,
  TelegraphKind,
  atan2Turns,
  cosTurns,
  sinTurns,
} from '../../core/index.ts';
import { PLAYER_ZONE_SOFT_CAP } from '../capacity.ts';
import { DangerMode } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { allocSlot, freeSlot } from '../pools.ts';
import {
  applyBurn,
  applyHit,
  applySlow,
  beginHit,
  canDamage,
  damagePlayer,
  endHit,
} from './combat.ts';
import { spawnEnemyShot } from './enemy-shots.ts';

/** Spawn a danger area and raise TelegraphStarted. Returns the slot or -1 when the pool is full. */
export function spawnDanger(
  ctx: SimCtx,
  mode: number,
  shape: number,
  kind: number,
  x: number,
  y: number,
  radius: number,
  ticks: number,
  dmg: number,
  sourceRef: number,
  owner: number,
): number {
  const da = ctx.world.dangerAreas;
  const i = allocSlot(da);
  if (i < 0) {
    ctx.poolOverflow++;
    return -1;
  }
  da.x[i] = x;
  da.y[i] = y;
  da.prevX[i] = x;
  da.prevY[i] = y;
  da.radius[i] = radius;
  da.shape[i] = shape;
  da.kind[i] = kind;
  da.sourceRef[i] = sourceRef;
  da.x2[i] = x;
  da.y2[i] = y;
  da.p0[i] = 0;
  da.p1[i] = 0;
  da.p2[i] = 0;
  const t = Math.max(1, ticks);
  da.ticksLeft[i] = t;
  da.ticksTotal[i] = t;
  da.mode[i] = mode;
  da.dmg[i] = dmg;
  da.owner[i] = owner;
  da.ownerSerial[i] = owner >= 0 ? ctx.world.enemies.serial[owner]! : 0;
  da.speed[i] = 0;
  da.maxRadius[i] = 0;
  da.done[i] = 0;
  // Spawn tick: the countdown starts on the next tick so the telegraph lasts exactly `ticks`.
  da.tickTimer[i] = ctx.world.tick;
  ctx.events.push(SimEventType.TelegraphStarted, x, y, kind, t, sourceRef);
  return i;
}

/** Spawn a player zone (fire zone, embers). Above the soft cap the zone is skipped (overflow). */
export function spawnPlayerZone(
  ctx: SimCtx,
  x: number,
  y: number,
  radius: number,
  ticks: number,
  sourceRef: number,
  tagMask: number,
  procDepth: number,
): number {
  const pz = ctx.world.playerZones;
  if (pz.count >= PLAYER_ZONE_SOFT_CAP) {
    ctx.poolOverflow++;
    return -1;
  }
  const i = allocSlot(pz);
  if (i < 0) {
    ctx.poolOverflow++;
    return -1;
  }
  const burnIdx = ctx.sd.statusIndex['burn'];
  const burnTick = burnIdx !== undefined ? (ctx.data.statuses[burnIdx]?.tickTicks ?? 1) : 1;
  pz.x[i] = x;
  pz.y[i] = y;
  pz.prevX[i] = x;
  pz.prevY[i] = y;
  pz.radius[i] = radius;
  pz.shape[i] = AreaShape.Circle;
  pz.kind[i] = 0;
  pz.sourceRef[i] = sourceRef;
  pz.x2[i] = x;
  pz.y2[i] = y;
  pz.p0[i] = 0;
  pz.p1[i] = 0;
  pz.p2[i] = 0;
  const t = Math.max(1, ticks);
  pz.ticksLeft[i] = t;
  pz.ticksTotal[i] = t;
  pz.mode[i] = 0;
  pz.dmg[i] = 0;
  pz.owner[i] = -1;
  pz.tickEvery[i] = Math.max(1, burnTick);
  pz.tickTimer[i] = 0;
  pz.burnDps[i] = 0;
  pz.slowPct[i] = 0;
  pz.procDepth[i] = procDepth;
  pz.tagMask[i] = tagMask;
  pz.done[i] = 0;
  return i;
}

export function updatePlayerZones(ctx: SimCtx): void {
  const pz = ctx.world.playerZones;
  const e = ctx.world.enemies;
  for (let i = 0; i < pz.highWater; i++) {
    if (pz.alive[i] === 0) continue;
    pz.tickTimer[i] = pz.tickTimer[i]! - 1;
    if (pz.tickTimer[i]! <= 0) {
      pz.tickTimer[i] = pz.tickEvery[i]!;
      const x = pz.x[i]!;
      const y = pz.y[i]!;
      const r = pz.radius[i]!;
      for (let s = 0; s < e.highWater; s++) {
        if (!canDamage(ctx, s)) continue;
        const dx = e.x[s]! - x;
        const dy = e.y[s]! - y;
        const rr = r + e.radius[s]!;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (pz.burnDps[i]! > 0) applyBurn(ctx, s, pz.burnDps[i]!, 1);
        if (pz.slowPct[i]! > 0) applySlow(ctx, s, pz.slowPct[i]! / 100, pz.tickEvery[i]! + 1);
        if (pz.dmg[i]! > 0) {
          const h = beginHit(ctx);
          if (h === null) continue;
          h.target = s;
          h.base = pz.dmg[i]!;
          h.sourceRef = pz.sourceRef[i]!;
          h.tagMask = pz.tagMask[i]!;
          h.hitKind = HitKind.Zone;
          h.procDepth = Math.max(1, pz.procDepth[i]!);
          applyHit(ctx);
          endHit(ctx);
        }
      }
    }
    pz.ticksLeft[i] = pz.ticksLeft[i]! - 1;
    if (pz.ticksLeft[i]! <= 0) freeSlot(pz, i);
  }
}

/** Distance from a point to segment (ax, ay)-(bx, by). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return Math.sqrt(dx * dx + dy * dy);
}

/** True when the player circle overlaps danger area i. */
export function playerInDanger(ctx: SimCtx, i: number): boolean {
  const da = ctx.world.dangerAreas;
  const p = ctx.world.player;
  const x = da.x[i]!;
  const y = da.y[i]!;
  const dx = p.x - x;
  const dy = p.y - y;
  switch (da.shape[i]) {
    case AreaShape.Circle: {
      const rr = da.radius[i]! + p.radius;
      return dx * dx + dy * dy <= rr * rr;
    }
    case AreaShape.Line:
      return segDist(p.x, p.y, x, y, da.x2[i]!, da.y2[i]!) <= da.p0[i]! + p.radius;
    case AreaShape.Ring: {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > da.radius[i]! + p.radius || d < da.p0[i]! - p.radius) return false;
      const gap = da.p2[i]!;
      if (gap <= 0) return true;
      let a = atan2Turns(dy, dx) - da.p1[i]!;
      a -= Math.floor(a + 0.5);
      return Math.abs(a) > gap;
    }
    case AreaShape.Cone: {
      const d2 = dx * dx + dy * dy;
      if (d2 > da.radius[i]! * da.radius[i]!) return false;
      let a = atan2Turns(dy, dx) - atan2Turns(da.y2[i]! - y, da.x2[i]! - x);
      a -= Math.floor(a + 0.5);
      return Math.abs(a) <= da.p0[i]!;
    }
    default:
      return false;
  }
}

function resolve(ctx: SimCtx, i: number): void {
  const da = ctx.world.dangerAreas;
  ctx.events.push(
    SimEventType.TelegraphResolved,
    da.x[i]!,
    da.y[i]!,
    da.kind[i]!,
    0,
    da.sourceRef[i]!,
  );
}

/** Spawn the row of shots of a resolved lane (boss Lantern Lanes). */
function launchLane(ctx: SimCtx, i: number): void {
  const da = ctx.world.dangerAreas;
  const ax = da.x[i]!;
  const ay = da.y[i]!;
  const bx = da.x2[i]!;
  const by = da.y2[i]!;
  const len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
  const spacing = da.maxRadius[i]!;
  const speed = da.speed[i]!;
  if (len <= 0 || spacing <= 0 || speed <= 0) return;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const n = Math.floor(len / spacing);
  const life = Math.ceil((len * 2) / speed);
  for (let k = 0; k <= n; k++) {
    // Start behind the lane origin so the row sweeps the whole lane.
    const x = ax - ux * spacing * k;
    const y = ay - uy * spacing * k;
    spawnEnemyShot(ctx, x, y, ux * speed, uy * speed, da.dmg[i]!, life + k, da.sourceRef[i]!);
  }
  ctx.events.push(SimEventType.EnemyProjectileFired, ax, ay, da.p2[i]!, n + 1, da.sourceRef[i]!);
}

export function updateDangerAreas(ctx: SimCtx): void {
  const da = ctx.world.dangerAreas;
  const e = ctx.world.enemies;
  for (let i = 0; i < da.highWater; i++) {
    if (da.alive[i] === 0 || da.tickTimer[i] === ctx.world.tick) continue;
    da.prevX[i] = da.x[i]!;
    da.prevY[i] = da.y[i]!;
    const owner = da.owner[i]!;
    if (owner >= 0) {
      if (e.alive[owner] === 0 || e.serial[owner] !== da.ownerSerial[i]) {
        resolve(ctx, i);
        freeSlot(da, i);
        continue;
      }
      if (da.mode[i] === DangerMode.Visual && da.kind[i] !== TelegraphKind.Charge) {
        da.x[i] = e.x[owner]!;
        da.y[i] = e.y[owner]!;
      }
    }
    if (da.mode[i] === DangerMode.ExpandingRing && da.done[i]! >= 1) {
      // Expanding stage: band of thickness (radius - p0) moves outward, one hit per ring.
      const thick = da.radius[i]! - da.p0[i]!;
      da.radius[i] = da.radius[i]! + da.speed[i]!;
      da.p0[i] = Math.max(0, da.radius[i]! - thick);
      if (da.done[i] === 1 && playerInDanger(ctx, i)) {
        da.done[i] = 2;
        damagePlayer(ctx, da.dmg[i]!, da.sourceRef[i]!);
      }
      da.ticksLeft[i] = da.ticksLeft[i]! - 1;
      if (da.radius[i]! >= da.maxRadius[i]! || da.ticksLeft[i]! <= 0) {
        resolve(ctx, i);
        freeSlot(da, i);
      }
      continue;
    }
    da.ticksLeft[i] = da.ticksLeft[i]! - 1;
    if (da.ticksLeft[i]! > 0) continue;
    switch (da.mode[i]) {
      case DangerMode.Strike:
        if (playerInDanger(ctx, i)) damagePlayer(ctx, da.dmg[i]!, da.sourceRef[i]!);
        resolve(ctx, i);
        freeSlot(da, i);
        break;
      case DangerMode.ExpandingRing: {
        // Telegraph done: start expanding from the centre with the marked thickness.
        da.done[i] = 1;
        const thick = Math.max(da.radius[i]! - da.p0[i]!, 0);
        da.radius[i] = thick;
        da.p0[i] = 0;
        const speed = da.speed[i]!;
        const t = speed > 0 ? Math.ceil(da.maxRadius[i]! / speed) + 1 : 1;
        da.ticksLeft[i] = t;
        da.ticksTotal[i] = t;
        break;
      }
      case DangerMode.Burst: {
        const n = Math.floor(da.maxRadius[i]!);
        const sp = da.speed[i]!;
        for (let k = 0; k < n; k++) {
          const t = k / n;
          spawnEnemyShot(
            ctx,
            da.x[i]!,
            da.y[i]!,
            cosTurns(t) * sp,
            sinTurns(t) * sp,
            da.dmg[i]!,
            da.tickEvery[i]!,
            da.sourceRef[i]!,
          );
        }
        ctx.events.push(
          SimEventType.EnemyProjectileFired,
          da.x[i]!,
          da.y[i]!,
          da.p2[i]!,
          n,
          da.sourceRef[i]!,
        );
        resolve(ctx, i);
        freeSlot(da, i);
        break;
      }
      case DangerMode.Lane:
        launchLane(ctx, i);
        resolve(ctx, i);
        freeSlot(da, i);
        break;
      default:
        resolve(ctx, i);
        freeSlot(da, i);
    }
  }
}
