/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Glint pieces: drop, floor cap merge, magnet, fly, collect, and the end of Pulse sweep (GDD 4.1, 4.2).

import { PickupKind, SimEventType } from '../../core/index.ts';
import { clampInside } from '../arena.ts';
import type { Point } from '../arena.ts';
import { EDGE_INSET_U, GLINT_STREAK_RESET_TICKS } from '../capacity.ts';
import { Trigger } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { statOf } from '../ctx.ts';
import { allocSlot, freeSlot } from '../pools.ts';
import { addXp } from './xp.ts';

const tmp: Point = { x: 0, y: 0 };

/** Add Glint to the balance. viaPiece: counts as a pickup (XP, on_pickup unless swept). */
export function gainGlint(ctx: SimCtx, amount: number, viaPiece: boolean, onPickup: boolean): void {
  if (amount <= 0) return;
  const { world, run } = ctx;
  const p = world.player;
  p.glint += amount;
  world.runStats.glintEarned += amount;
  if (run.glintConvert) run.statsDirty = true;
  if (!viaPiece) return;
  addXp(ctx, amount);
  if (!onPickup) return;
  run.glintStreak =
    world.tick - run.lastPickupTick > GLINT_STREAK_RESET_TICKS ? 1 : run.glintStreak + 1;
  run.lastPickupTick = world.tick;
  ctx.events.push(SimEventType.GlintCollected, p.x, p.y, amount, run.glintStreak, 0);
  ctx.fx.onPlayerEvent(ctx, Trigger.OnPickup, 0, amount);
}

/** Drop one Glint piece. Above the floor cap or with a full pool the value merges into the nearest floor piece. */
export function dropGlint(ctx: SimCtx, x: number, y: number, amount: number): void {
  if (amount <= 0) return;
  const pk = ctx.world.pickups;
  if (ctx.arena !== null) clampInside(ctx.arena, x, y, EDGE_INSET_U, tmp);
  else {
    tmp.x = x;
    tmp.y = y;
  }
  let floor = 0;
  for (let i = 0; i < pk.highWater; i++) if (pk.alive[i] === 1 && pk.magnetized[i] === 0) floor++;
  if (floor >= ctx.cfg.glintFloorCap || pk.freeTop === 0) {
    // Merge into the nearest floor piece (tie: smallest slot). Falls back to any piece.
    let best = -1;
    let bestD = Infinity;
    for (let pass = 0; pass < 2 && best < 0; pass++) {
      for (let i = 0; i < pk.highWater; i++) {
        if (pk.alive[i] === 0 || (pass === 0 && pk.magnetized[i] === 1)) continue;
        const dx = pk.x[i]! - tmp.x;
        const dy = pk.y[i]! - tmp.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    if (best >= 0) {
      pk.amount[best] = pk.amount[best]! + amount;
      ctx.events.push(SimEventType.GlintDropped, tmp.x, tmp.y, amount, 0, 0);
      return;
    }
  }
  const s = allocSlot(pk);
  if (s < 0) {
    ctx.poolOverflow++;
    gainGlint(ctx, amount, true, false);
    return;
  }
  pk.x[s] = tmp.x;
  pk.y[s] = tmp.y;
  pk.prevX[s] = tmp.x;
  pk.prevY[s] = tmp.y;
  pk.radius[s] = 0;
  pk.kind[s] = PickupKind.Glint;
  pk.amount[s] = amount;
  pk.magnetized[s] = 0;
  pk.dropTick[s] = ctx.world.tick;
  ctx.events.push(SimEventType.GlintDropped, tmp.x, tmp.y, amount, 0, 0);
}

export function updatePickups(ctx: SimCtx): void {
  const { world, cfg, sd } = ctx;
  const pk = world.pickups;
  const p = world.player;
  const r = cfg.pickupRadiusBaseU * (1 + statOf(ctx, sd.stat.pickup_radius_pct, 0) / 100);
  const r2 = r * r;
  const collect = p.radius + cfg.glintCollectDistAddU;
  const collect2 = collect * collect;
  const speed = cfg.glintFlySpeedUPerTick;
  for (let i = 0; i < pk.highWater; i++) {
    if (pk.alive[i] === 0) continue;
    pk.prevX[i] = pk.x[i]!;
    pk.prevY[i] = pk.y[i]!;
    let dx = p.x - pk.x[i]!;
    let dy = p.y - pk.y[i]!;
    let d2 = dx * dx + dy * dy;
    if (pk.magnetized[i] === 0 && d2 <= r2) pk.magnetized[i] = 1;
    if (pk.magnetized[i] === 1) {
      const d = Math.sqrt(d2);
      if (d > 0) {
        const step = Math.min(speed, d);
        pk.x[i] = pk.x[i]! + (dx / d) * step;
        pk.y[i] = pk.y[i]! + (dy / d) * step;
      }
      dx = p.x - pk.x[i]!;
      dy = p.y - pk.y[i]!;
      d2 = dx * dx + dy * dy;
    }
    if (d2 <= collect2) {
      const amount = pk.amount[i]!;
      freeSlot(pk, i);
      gainGlint(ctx, amount, true, true);
    }
  }
}

/** Collect frac of all floor Glint (floor of the total) as XP without on_pickup; the rest fades. */
export function sweepPickups(ctx: SimCtx, frac: number): void {
  const pk = ctx.world.pickups;
  let total = 0;
  for (let i = 0; i < pk.highWater; i++) {
    if (pk.alive[i] === 0) continue;
    total += pk.amount[i]!;
    freeSlot(pk, i);
  }
  if (total <= 0) return;
  const got = Math.floor(total * frac);
  gainGlint(ctx, got, true, false);
  const p = ctx.world.player;
  ctx.events.push(SimEventType.GlintSwept, p.x, p.y, got, total - got, 0);
}
