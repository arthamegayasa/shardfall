// Canonical state hash (architecture.md 8.4): FNV-1a over tick, phase, RNG streams, player, shop,
// level-up, reward, inventory, Mementos, effect counters, then every pool (live slots in slot order,
// every column except serial). UI-only values (revisions, view copies) are not hashed.

import { RNG_STREAMS, RunPhaseCode } from '../core/index.ts';
import type { Hasher } from '../core/index.ts';
import type { SimCtx } from './ctx.ts';
import type { PoolCore } from './pools.ts';

type Column = ArrayLike<number>;

function hashArray(h: Hasher, a: Column): void {
  for (let i = 0; i < a.length; i++) h.f64(a[i] ?? 0);
}

/** Hash live slots of a pool: per slot, every listed column (strided columns hash their stride). */
function hashPool(
  h: Hasher,
  p: PoolCore,
  cols: readonly Column[],
  strided: readonly Column[],
): void {
  h.u32(p.highWater);
  h.u32(p.count);
  for (let i = 0; i < p.highWater; i++) {
    if (p.alive[i] === 0) continue;
    h.u32(i);
    h.f64(p.x[i] ?? 0);
    h.f64(p.y[i] ?? 0);
    h.f64(p.prevX[i] ?? 0);
    h.f64(p.prevY[i] ?? 0);
    h.f64(p.radius[i] ?? 0);
    for (const c of cols) h.f64(c[i] ?? 0);
    for (const c of strided) {
      const stride = c.length / p.capacity;
      for (let k = 0; k < stride; k++) h.f64(c[i * stride + k] ?? 0);
    }
  }
  // Free list order matters for future allocations.
  h.u32(p.freeTop);
  for (let i = 0; i < p.freeTop; i++) h.u32(p.freeList[i] ?? 0);
}

function hashHitMemory(
  h: Hasher,
  ps: SimCtx['world']['playerShots'],
  enemySerial: ArrayLike<number>,
): void {
  const stride = ps.hitSlots.length / ps.capacity;
  for (let i = 0; i < ps.highWater; i++) {
    if (ps.alive[i] === 0) continue;
    for (let k = 0; k < stride; k++) {
      const at = i * stride + k;
      const slot = ps.hitSlots[at] ?? 0;
      h.u32(ps.hitSerials[at] === enemySerial[slot] ? 1 : 0);
    }
  }
}

/**
 * every_nth per_target counters (LP review M1). The stored serials are enemy serials, which are not
 * reset or saved, so only counters that still name a living enemy are hashed, with their value.
 */
function hashTargetCounters(h: Hasher, ctx: SimCtx): void {
  const run = ctx.run;
  const e = ctx.world.enemies;
  const cap = e.capacity;
  const slots = run.targetCounter.length / cap;
  for (let k = 0; k < slots; k++) {
    for (let s = 0; s < e.highWater; s++) {
      const i = k * cap + s;
      const live = e.alive[s] === 1 && run.targetCounterSerial[i] === e.serial[s];
      h.u32(live ? (run.targetCounter[i] ?? 0) : 0);
    }
  }
}

/** Owner links that store a serial: hash whether the link still names its living owner. */
function hashOwnerLinks(
  h: Hasher,
  p: PoolCore,
  owner: ArrayLike<number>,
  ownerSerial: ArrayLike<number>,
  enemies: SimCtx['world']['enemies'],
): void {
  for (let i = 0; i < p.highWater; i++) {
    if (p.alive[i] === 0) continue;
    const o = owner[i] ?? -1;
    h.u32(o >= 0 && enemies.alive[o] === 1 && enemies.serial[o] === ownerSerial[i] ? 1 : 0);
  }
}

export function hashState(ctx: SimCtx, h: Hasher, words: Uint32Array): number {
  const { world: w, run } = ctx;
  h.reset();
  h.u32(w.tick);
  h.u32(RunPhaseCode[w.phase]);
  h.u32(w.arenaIndex);
  for (const name of RNG_STREAMS) {
    ctx.rng[name].writeState(words);
    for (let i = 0; i < 4; i++) h.u32(words[i] ?? 0);
  }
  const p = w.player;
  h.f64(p.x);
  h.f64(p.y);
  h.f64(p.prevX);
  h.f64(p.prevY);
  h.f64(p.radius);
  h.f64(p.facing);
  h.u32(p.classIndex);
  h.f64(p.hp);
  h.f64(p.maxHp);
  h.u32(p.level);
  h.f64(p.xp);
  h.f64(p.xpToNext);
  h.f64(p.glint);
  h.u32(p.riteIndex);
  h.u32(p.riteCooldownTicks);
  h.u32(p.riteCooldownMaxTicks);
  h.u32(p.riteCharges);
  h.u32(p.riteChargesMax);
  h.f64(p.barrier);
  h.f64(p.barrierMax);
  h.u32(p.invulnTicks);
  h.u32(p.hitFlashTicks);
  hashArray(h, p.stats);
  // Pulse.
  const pu = w.pulse;
  h.u32(pu.index);
  h.u32(pu.count);
  h.u32(pu.kind);
  h.f64(pu.threat);
  h.u32(pu.ticksLeft);
  h.u32(pu.ticksTotal);
  h.bool(pu.overtime);
  // Run stats.
  const rs = w.runStats;
  h.u32(rs.kills);
  h.f64(rs.glintEarned);
  h.f64(rs.glintSpent);
  h.u32(rs.pulsesCleared);
  h.u32(rs.runTicks);
  h.f64(rs.silt);
  h.u32(rs.killedBy);
  h.u32(rs.difficulty);
  // Inventory, Mementos, cards, choices, shop.
  hashArray(h, run.weaponIndex);
  hashArray(h, run.weaponTier);
  hashArray(h, run.weaponCd);
  hashArray(h, run.weaponShots);
  hashArray(h, run.weaponTimer);
  h.u32(run.mementoOrder.length);
  for (const m of run.mementoOrder) h.u32(m);
  hashArray(h, run.mementoCount);
  h.u32(run.levelUpPicks.length);
  for (const c of run.levelUpPicks) {
    h.u32(c.cardIndex);
    h.u32(c.rarity);
  }
  hashArray(h, run.statCardAdd);
  h.u32(run.pendingLevelUps);
  h.u32(run.levelChoices.length);
  for (const c of run.levelChoices) {
    h.u32(c.cardIndex);
    h.u32(c.rarity);
    h.f64(c.value);
  }
  h.u32(run.rewardChoices.length);
  for (const m of run.rewardChoices) h.u32(m);
  h.u32(run.offers.length);
  for (const o of run.offers) {
    h.u32(o.kind);
    h.u32(o.defIndex + 1);
    h.u32(o.tier);
    h.bool(o.locked);
  }
  h.u32(run.rerollCount);
  h.u32(run.freeRerollsUsed);
  hashArray(h, w.shop.tagCounts);
  h.u32(run.synergyMask);
  h.f64(run.siltKills);
  hashArray(h, run.weaponOpen);
  hashArray(h, run.mementoOpen);
  // Run timers and effect state.
  h.f64(run.threat);
  h.u32(run.pulseTick);
  h.u32(run.clearTicks + 1);
  h.u32(run.deathTicks + 1);
  h.u32(run.victoryTicks + 1);
  h.u32(run.wardenSpawnTick + 1);
  h.u32(run.wardenSlot + 1);
  h.bool(run.wardenSpawned);
  h.u32(run.overtimeTicks);
  h.bool(run.hasteApplied);
  h.u32(run.bossSlot + 1);
  h.u32(run.bossEntryTicks + 1);
  h.u32(run.bossPhase);
  h.u32(run.bossCyclePos);
  h.u32(run.bossGapTicks);
  h.u32(run.bossTransitionTicks);
  h.u32(run.bossFightTicks);
  h.bool(run.bossEnraged);
  h.u32(run.bossTrickleTicks);
  h.u32(run.bossPatternIndex + 1);
  h.u32(run.bossPatternTicks);
  h.u32(run.bossPatternStep);
  h.u32(run.bossPatternTotal);
  h.f64(run.bossPatX);
  h.f64(run.bossPatY);
  h.f64(run.bossPatDirX);
  h.f64(run.bossPatDirY);
  h.f64(run.bossPatAngle);
  h.bool(run.bossPatHit);
  h.bool(run.bossKilled);
  h.f64(run.bossHpFloor);
  // Choice queue state (LP review M1: these drove phases but were not hashed).
  h.bool(run.rewardPending);
  h.u32(run.rewardSourceType + 1);
  h.u32(run.levelsThisPulse);
  h.bool(run.wardenKilled);
  h.f64(run.playerSlowPct);
  h.u32(run.playerSlowTicks);
  hashArray(h, run.coinGlint);
  hashArray(h, run.lungeTimer);
  hashArray(h, run.lungeTicks);
  h.bool(run.unhurtThisPulse);
  h.u32(run.lastHurtTick);
  h.u32(run.critForcedHits);
  h.u32(run.critForcedTicks);
  h.u32(run.barrierTimer);
  h.u32(run.leechWindowTick);
  h.f64(run.leechHealed);
  h.u32(run.glintStreak);
  h.u32(run.lastPickupTick);
  hashArray(h, run.effectNextTick);
  hashArray(h, run.effectFires);
  hashArray(h, run.effectTimer);
  hashArray(h, run.effectCounter);
  hashArray(h, run.effectDist);
  hashArray(h, run.effectWeaponCounter);
  hashArray(h, run.buffStacks);
  hashArray(h, run.buffTicks);
  hashArray(h, run.healWindowTick);
  hashArray(h, run.healAmount);
  hashTargetCounters(h, ctx);
  // Spawn schedule (remaining entries and queue).
  h.u32(run.scheduleCount);
  h.u32(run.scheduleNext);
  for (let i = run.scheduleNext; i < run.scheduleCount; i++) {
    h.u32(run.schedTick[i] ?? 0);
    h.u32(run.schedType[i] ?? 0);
    h.u32(run.schedSize[i] ?? 0);
    h.u32(run.schedSector[i] ?? 0);
  }
  for (let i = run.queueHead; i < run.queueTail; i++) h.u32(run.queue[i] ?? 0);
  h.u32(run.pendingSeq);
  // Pools.
  const e = w.enemies;
  hashPool(
    h,
    e,
    [
      e.typeIndex,
      e.rank,
      e.hp,
      e.maxHp,
      e.shield,
      e.aiState,
      e.aiStateTicks,
      e.facing,
      e.hitFlashTicks,
      e.statusMask,
      e.ageTicks,
      e.aiTimer,
      e.aiCounter,
      e.dirX,
      e.dirY,
      e.kbX,
      e.kbY,
      e.kbTicks,
      e.burnStacks,
      e.burnTicks,
      e.burnTickTimer,
      e.slowPct,
      e.slowTicks,
      e.markTicks,
      e.markPct,
      e.dmgScale,
      e.speedMult,
      e.counted,
      e.chargeHit,
      e.affixMask,
      e.blinkX,
      e.blinkY,
      e.blinkTicks,
      e.shellRegrow,
      e.summonOwner,
      e.guardAdd,
      e.kbImmune,
    ],
    [e.burnDps, e.orbitTimer, e.affixTimer],
  );
  hashOwnerLinks(h, e, e.summonOwner, e.summonOwnerSerial, e);
  const es = w.enemyShots;
  hashPool(h, es, [es.sourceRef, es.vx, es.vy, es.dmg, es.lifeTicks], []);
  const ps = w.playerShots;
  hashPool(
    h,
    ps,
    [
      ps.sourceRef,
      ps.vx,
      ps.vy,
      ps.mode,
      ps.dmg,
      ps.dmg2,
      ps.areaRadius,
      ps.tagMask,
      ps.hitKind,
      ps.procDepth,
      ps.isRite,
      ps.pierceLeft,
      ps.rangeLeft,
      ps.weaponIndex,
      ps.weaponSlot,
      ps.tier,
      ps.knockback,
      ps.timer,
      ps.targetX,
      ps.targetY,
      ps.phase,
      ps.hitCount,
      ps.isProc,
      ps.blastStatus,
      ps.zoneRadius,
      ps.zoneTicks,
      ps.zoneSlow,
      ps.zoneTick,
      ps.bounceLeft,
    ],
    [ps.hitSlots],
  );
  // Pierce memory: enemy serials are never reset or saved (architecture 8.1), so a loaded run has
  // other raw values. Hash whether each remembered hit still names the living enemy instead.
  hashHitMemory(h, ps, w.enemies.serial);
  const pk = w.pickups;
  hashPool(h, pk, [pk.kind, pk.amount, pk.magnetized, pk.dropTick, pk.flyTicks, pk.flySpeed], []);
  for (const a of [w.dangerAreas, w.playerZones]) {
    hashPool(
      h,
      a,
      [
        a.shape,
        a.kind,
        a.sourceRef,
        a.x2,
        a.y2,
        a.p0,
        a.p1,
        a.p2,
        a.ticksLeft,
        a.ticksTotal,
        a.mode,
        a.dmg,
        a.owner,
        a.speed,
        a.maxRadius,
        a.tickEvery,
        a.tickTimer,
        a.burnDps,
        a.slowPct,
        a.procDepth,
        a.tagMask,
        a.done,
      ],
      [],
    );
  }
  const sm = w.spawnMarks;
  hashPool(
    h,
    sm,
    [sm.typeIndex, sm.ticksLeft, sm.ticksTotal, sm.members, sm.counted, sm.owner],
    [],
  );
  hashOwnerLinks(h, sm, sm.owner, sm.ownerSerial, w.enemies);
  const pd = ctx.pending;
  hashPool(
    h,
    pd,
    [
      pd.kind,
      pd.dueTick,
      pd.seq,
      pd.effect,
      pd.dmg,
      pd.power,
      pd.procDepth,
      pd.tagMask,
      pd.target,
      pd.sourceRef,
      pd.weaponSlot,
    ],
    [],
  );
  return h.value();
}
