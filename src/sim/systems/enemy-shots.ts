/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Enemy projectiles: spawn, motion, expiry, hits on the player (GDD 5.3, 14.2).

import { insideDistance } from '../arena.ts';
import type { SimCtx } from '../ctx.ts';
import { allocSlot, freeSlot } from '../pools.ts';
import { damagePlayer } from './combat.ts';

export function spawnEnemyShot(
  ctx: SimCtx,
  x: number,
  y: number,
  vx: number,
  vy: number,
  dmg: number,
  lifeTicks: number,
  sourceRef: number,
): number {
  const es = ctx.world.enemyShots;
  const i = allocSlot(es);
  if (i < 0) {
    ctx.poolOverflow++;
    return -1;
  }
  es.x[i] = x;
  es.y[i] = y;
  es.prevX[i] = x;
  es.prevY[i] = y;
  es.radius[i] = ctx.cfg.enemyShotRadiusU;
  es.vx[i] = vx;
  es.vy[i] = vy;
  es.dmg[i] = dmg;
  es.lifeTicks[i] = lifeTicks;
  es.sourceRef[i] = sourceRef;
  return i;
}

/** Enemy shots: move, expire, hit the player (destroyed on touch in all cases, GDD 5.3). */
export function updateEnemyShots(ctx: SimCtx): void {
  const es = ctx.world.enemyShots;
  const p = ctx.world.player;
  const arena = ctx.arena;
  const margin = arena !== null ? -arena.projectileMargin : -Infinity;
  for (let i = 0; i < es.highWater; i++) {
    if (es.alive[i] === 0) continue;
    es.prevX[i] = es.x[i]!;
    es.prevY[i] = es.y[i]!;
    es.x[i] = es.x[i]! + es.vx[i]!;
    es.y[i] = es.y[i]! + es.vy[i]!;
    es.lifeTicks[i] = es.lifeTicks[i]! - 1;
    const dx = p.x - es.x[i]!;
    const dy = p.y - es.y[i]!;
    const rr = p.radius + es.radius[i]!;
    if (dx * dx + dy * dy <= rr * rr) {
      const dmg = es.dmg[i]!;
      const src = es.sourceRef[i]!;
      freeSlot(es, i);
      damagePlayer(ctx, dmg, src);
      continue;
    }
    if (
      es.lifeTicks[i]! <= 0 ||
      (arena !== null && insideDistance(arena, es.x[i]!, es.y[i]!) < margin)
    ) {
      freeSlot(es, i);
    }
  }
}
