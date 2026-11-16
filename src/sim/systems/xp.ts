// XP and levels (GDD 11.1): XP from L to L+1 = xp_base + xp_per_level x L. XP comes only from Glint
// picked up as pieces (GDD 4.1); levels gained during a Pulse are picked in the levelUp phase.

import { SimEventType } from '../../core/index.ts';
import type { SimCtx } from '../ctx.ts';

export function xpToNext(ctx: SimCtx, level: number): number {
  return ctx.cfg.xpBase + ctx.cfg.xpPerLevel * level;
}

export function addXp(ctx: SimCtx, amount: number): void {
  const p = ctx.world.player;
  p.xp += amount;
  // Guard against non-positive thresholds from broken data (would loop forever).
  while (p.xpToNext > 0 && p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = xpToNext(ctx, p.level);
    ctx.run.pendingLevelUps++;
    ctx.run.levelsThisPulse++;
    ctx.events.push(SimEventType.PlayerLeveledUp, p.x, p.y, p.level, 0, 0);
  }
}
