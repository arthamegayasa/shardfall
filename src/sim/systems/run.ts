// Run and Pulse lifecycle (architecture 4.4, GDD 1, 3.3): start, Pulse start and end, Warden
// overtime, boss Pulse, pulseClear, the choice queue (reward, levelUp, shop), victory and defeat.

import { RunOutcome, RunPhaseCode, SimEventType } from '../../core/index.ts';
import type { RunPhase } from '../../core/index.ts';
import { createArenaGeom, shapeCenter } from '../arena.ts';
import type { Point } from '../arena.ts';
import { SPATIAL_CELL_U } from '../capacity.ts';
import { Trigger } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { statOf } from '../ctx.ts';
import { fireSimpleTrigger } from '../effects/engine.ts';
import { resetPool } from '../pools.ts';
import { createSpatialHash } from '../spatial-hash.ts';
import { recomputeStats } from '../stats.ts';
import type { StatScratch } from '../stats.ts';
import { startBossEntry } from './boss.ts';
import { pickLevelCard, rollLevelChoices, rollReward } from './progression.ts';
import { openShop } from './shop.ts';
import { dropSchedule, buildSchedule } from './spawner.ts';
import { gainGlint, sweepPickups } from './pickups.ts';
import { riteCooldown } from './player.ts';

export function setPhase(ctx: SimCtx, next: RunPhase): void {
  const w = ctx.world;
  const prev = w.phase;
  w.phase = next;
  w.phaseRevision++;
  ctx.events.push(SimEventType.PhaseChanged, 0, 0, RunPhaseCode[next], RunPhaseCode[prev], 0);
}

/** Use the arena of a Pulse slot (biome -> arena). Rebuilds geometry and the spatial grid when it changes. */
export function useArenaFor(ctx: SimCtx, pulseIndex: number): void {
  const slot = ctx.run.slots[pulseIndex];
  const biome = ctx.data.biomes.find((b) => b.id === slot?.biome);
  let idx = biome !== undefined ? ctx.data.arenas.findIndex((a) => a.id === biome.arenaId) : -1;
  if (idx < 0) idx = 0;
  const def = ctx.data.arenas[idx];
  if (def === undefined) return;
  if (ctx.arena !== null && ctx.arena.def === def && ctx.grid !== null) return;
  ctx.world.arenaIndex = idx;
  const g = createArenaGeom(def);
  ctx.arena = g;
  const m = g.projectileMargin;
  ctx.grid = createSpatialHash({
    minX: g.minX - m,
    minY: g.minY - m,
    maxX: g.maxX + m,
    maxY: g.maxY + m,
    cellU: SPATIAL_CELL_U,
    capacity: ctx.world.enemies.capacity,
  });
}

/** Threat scaling for the current Pulse (GDD 5.2, 5.3, 5.5). */
export function applyThreat(ctx: SimCtx, threat: number): void {
  const { cfg, run } = ctx;
  const t1 = threat - 1;
  run.threat = threat;
  run.hpScale = 1 + cfg.enemyHpLin * t1 + cfg.enemyHpQuad * t1 * t1;
  run.dmgScale = (1 + cfg.enemyDmgLin * t1) * (run.diff?.enemyDmgMult ?? 1);
  run.procScale = 1 + cfg.procGrowth * t1;
}

/** Player derived values from final stats (after recompute). */
export function syncPlayerFromStats(ctx: SimCtx): void {
  const { world, sd } = ctx;
  const p = world.player;
  const maxHp = statOf(ctx, sd.stat.max_hp, p.maxHp);
  p.maxHp = maxHp;
  if (p.hp > maxHp) p.hp = maxHp;
  p.barrierMax = Math.floor(statOf(ctx, sd.stat.barrier_max, 0));
  if (p.barrier > Math.max(p.barrierMax, 1)) p.barrier = Math.max(p.barrierMax, 1);
  p.riteChargesMax = Math.max(1, Math.floor(statOf(ctx, sd.stat.rite_charges, 1)));
  if (p.riteCharges > p.riteChargesMax) p.riteCharges = p.riteChargesMax;
  p.riteCooldownMaxTicks = riteCooldown(ctx);
}

export function ensureStats(ctx: SimCtx, sc: StatScratch): void {
  if (!ctx.run.statsDirty) return;
  recomputeStats(ctx, sc);
  syncPlayerFromStats(ctx);
}

/** Canonical reset of every Pulse-scoped value (architecture 8.1, QA D-4): saves restore the rest. */
export function canonicalReset(ctx: SimCtx): void {
  const { world, run } = ctx;
  resetPool(world.enemies);
  resetPool(world.enemyShots);
  resetPool(world.playerShots);
  resetPool(world.pickups);
  resetPool(world.dangerAreas);
  resetPool(world.playerZones);
  resetPool(world.spawnMarks);
  resetPool(ctx.pending);
  run.pendingSeq = 0;
  dropSchedule(ctx);
  run.scheduleCount = 0;
  run.scheduleNext = 0;
  run.queueHead = 0;
  run.queueTail = 0;
  run.effectNextTick.fill(0);
  run.effectFires.fill(0);
  run.effectTimer.fill(0);
  run.effectCounter.fill(0);
  run.effectDist.fill(0);
  run.effectWeaponCounter.fill(0);
  run.targetCounter.fill(0);
  run.targetCounterSerial.fill(0);
  run.buffStacks.fill(0);
  run.buffTicks.fill(0);
  run.healWindowTick.fill(0);
  run.healAmount.fill(0);
  run.weaponCd.fill(0);
  run.weaponShots.fill(0);
  run.weaponTimer.fill(0);
  run.critForcedHits = 0;
  run.critForcedTicks = 0;
  run.barrierTimer = 0;
  run.leechWindowTick = 0;
  run.leechHealed = 0;
  run.glintStreak = 0;
  run.lastPickupTick = 0;
  run.lastHurtTick = 0;
  run.distanceAcc = 0;
  run.unhurtThisPulse = true;
  run.pulseTick = 0;
  run.clearTicks = -1;
  run.wardenSpawnTick = -1;
  run.wardenSlot = -1;
  run.wardenSpawned = false;
  run.overtimeTicks = 0;
  run.hasteApplied = false;
  run.bossSlot = -1;
  run.bossEntryTicks = -1;
  run.bossPhase = 0;
  run.bossCyclePos = 0;
  run.bossGapTicks = 0;
  run.bossTransitionTicks = 0;
  run.bossFightTicks = 0;
  run.bossEnraged = false;
  run.bossTrickleTicks = 0;
  run.bossPatternIndex = -1;
  run.bossPatternTicks = 0;
  run.bossPatternStep = 0;
  run.bossHpFloor = 0;
  run.statsDirty = true;
  const p = world.player;
  p.facing = 1;
  p.invulnTicks = 0;
  p.hitFlashTicks = 0;
  p.barrier = 0;
  p.riteCooldownTicks = 0;
  p.riteCharges = 0;
  const pulse = world.pulse;
  pulse.ticksLeft = 0;
  pulse.ticksTotal = 0;
  pulse.overtime = false;
  pulse.wardenAlive = false;
  pulse.warden.active = false;
  pulse.boss.active = false;
}

export function resetEffectCounters(ctx: SimCtx): void {
  const run = ctx.run;
  run.effectNextTick.fill(0);
  run.effectFires.fill(0);
  run.effectTimer.fill(0);
  run.effectCounter.fill(0);
  run.effectDist.fill(0);
  run.effectWeaponCounter.fill(0);
  run.healWindowTick.fill(0);
  run.healAmount.fill(0);
}

/** Place the player at the start point of a Pulse slot (boss or default). */
export function placePlayer(ctx: SimCtx, pulseIndex: number): void {
  const p = ctx.world.player;
  const slot = ctx.run.slots[pulseIndex];
  const arena = ctx.arena;
  const start =
    arena === null
      ? null
      : slot?.kind === 'boss'
        ? arena.def.playerStart.boss
        : arena.def.playerStart.default;
  p.x = start?.[0] ?? 0;
  p.y = start?.[1] ?? 0;
  p.prevX = p.x;
  p.prevY = p.y;
}

/** Start Pulse index (GDD 3.3 "Awal setiap Pulse"). */
export function beginPulse(ctx: SimCtx, index: number, sc: StatScratch): void {
  const { world, run, data } = ctx;
  const slot = run.slots[index];
  if (slot === undefined) return;
  useArenaFor(ctx, index);
  applyThreat(ctx, slot.threat);
  run.levelsThisPulse = 0;
  run.rewardPending = false;
  run.wardenKilled = false;
  run.bossKilled = false;
  run.wardenType =
    slot.kind === 'warden' && slot.wardenId !== null
      ? data.enemies.findIndex((e) => e.id === slot.wardenId)
      : -1;
  run.bossType =
    slot.kind === 'boss' && slot.bossId !== null
      ? data.enemies.findIndex((e) => e.id === slot.bossId)
      : -1;
  run.unhurtThisPulse = true;
  run.lastHurtTick = world.tick;
  run.pulseTick = 0;
  const pulse = world.pulse;
  pulse.index = index;
  pulse.count = run.slots.length;
  pulse.kind = slot.kind === 'boss' ? 2 : slot.kind === 'warden' ? 1 : 0;
  pulse.threat = slot.threat;
  pulse.isBoss = slot.kind === 'boss';
  pulse.ticksTotal = pulse.isBoss ? 0 : slot.durationTicks;
  pulse.ticksLeft = pulse.ticksTotal;
  pulse.overtime = false;
  pulse.wardenAlive = false;
  placePlayer(ctx, index);
  run.statsDirty = true;
  ensureStats(ctx, sc);
  const p = world.player;
  // HP: full, or heal pulse_heal_frac of the missing HP (Crack 5).
  const healFrac = run.diff?.pulseHealFrac ?? 1;
  p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - p.hp) * healFrac);
  if (p.hp <= 0) p.hp = p.maxHp;
  p.riteCharges = p.riteChargesMax;
  p.riteCooldownTicks = 0;
  p.barrier = p.barrierMax;
  p.invulnTicks = 0;
  if (run.wardenType >= 0) {
    run.wardenSpawnTick = Math.floor(slot.durationTicks * ctx.cfg.wardenSpawnFrac);
  }
  buildSchedule(ctx, slot);
  setPhase(ctx, 'pulse');
  ctx.events.push(SimEventType.PulseStarted, p.x, p.y, index, pulse.kind, 0);
  if (pulse.isBoss) startBossEntry(ctx);
  fireSimpleTrigger(ctx, Trigger.OnPulseStart);
}

/** Remove every enemy and hazard without drops (glass flash), keep pickups. */
function dissolveAll(ctx: SimCtx): void {
  const { world } = ctx;
  resetPool(world.enemies);
  resetPool(world.enemyShots);
  resetPool(world.playerShots);
  resetPool(world.dangerAreas);
  resetPool(world.playerZones);
  resetPool(world.spawnMarks);
  resetPool(ctx.pending);
  dropSchedule(ctx);
}

/**
 * End of a Pulse (GDD 3.3): dissolve, on_pulse_end, sweep, canonical reset, then pulseClear or the
 * victory delay when the final Pulse is done. collectFrac overrides the sweep (boss: 1).
 */
export function endPulse(ctx: SimCtx, collectFrac: number): void {
  const { world, run } = ctx;
  dissolveAll(ctx);
  fireSimpleTrigger(ctx, Trigger.OnPulseEnd);
  sweepPickups(ctx, collectFrac);
  const index = world.pulse.index;
  const unhurt = run.unhurtThisPulse;
  canonicalReset(ctx);
  world.runStats.pulsesCleared++;
  world.pulse.index = index;
  ctx.events.push(
    SimEventType.PulseEnded,
    world.player.x,
    world.player.y,
    index,
    unhurt ? 1 : 0,
    0,
  );
  const slot = run.slots[index];
  if (slot?.isFinal === true || index + 1 >= run.slots.length) {
    run.victoryTicks = Math.max(1, ctx.cfg.victoryDelayTicks);
    return;
  }
  run.clearTicks = Math.max(1, ctx.cfg.pulseClearTicks);
  setPhase(ctx, 'pulseClear');
}

/** Pulse timer, Warden overtime and haste. Returns true when the Pulse ended this tick. */
export function updatePulseTimer(ctx: SimCtx): boolean {
  const { world, run, cfg } = ctx;
  const pulse = world.pulse;
  run.pulseTick++;
  if (pulse.isBoss) return false;
  if (pulse.ticksLeft > 0) {
    pulse.ticksLeft--;
    if (pulse.ticksLeft > 0) return false;
  }
  if (run.wardenSlot >= 0 && world.enemies.alive[run.wardenSlot] === 1) {
    // Overtime: the Warden holds the timer (GDD 3.3).
    if (!pulse.overtime) {
      pulse.overtime = true;
      dropSchedule(ctx);
    }
    run.overtimeTicks++;
    if (
      !run.hasteApplied &&
      cfg.wardenOvertimeHasteTicks > 0 &&
      run.overtimeTicks >= cfg.wardenOvertimeHasteTicks
    ) {
      run.hasteApplied = true;
      applyHaste(ctx, run.wardenSlot);
    }
    return false;
  }
  if (run.wardenType >= 0 && !run.wardenSpawned) return false;
  endPulse(ctx, run.diff?.pulseEndCollectFrac ?? cfg.pulseEndCollectFrac);
  return true;
}

/** Affix hasted (GDD 15.2): movement +speed_pct%. */
function applyHaste(ctx: SimCtx, slot: number): void {
  const a = ctx.data.affixes.findIndex((x) => x.id === 'hasted');
  const def = ctx.data.affixes[a];
  const e = ctx.world.enemies;
  if (def === undefined) return;
  const pct = typeof def.params['move_pct'] === 'number' ? def.params['move_pct'] : 0;
  e.speedMult[slot] = (e.speedMult[slot] ?? 1) * (1 + pct / 100);
  if (a < 31) e.affixMask[slot] = (e.affixMask[slot] ?? 0) | (1 << a);
  ctx.events.push(SimEventType.AffixApplied, e.x[slot] ?? 0, e.y[slot] ?? 0, a, slot, 0);
}

/** Next phase in the choice queue after pulseClear or a pick: reward, levelUp, shop (GDD 12). */
export function advanceChoices(ctx: SimCtx, sc: StatScratch): void {
  const { run, world } = ctx;
  ensureStats(ctx, sc);
  if (run.rewardPending) {
    run.rewardPending = false;
    const type = run.rewardSourceType;
    const isBoss = (ctx.sd.enemies[type]?.rank ?? 0) === 2;
    rollReward(ctx, isBoss ? ctx.data.shop.bossChestMinRarity : ctx.data.shop.wardenChestMinRarity);
    if (run.rewardChoices.length > 0) {
      setPhase(ctx, 'reward');
      return;
    }
    // Empty chest: replaced by the source's Glint value, paid directly (GDD 13.2).
    gainGlint(ctx, ctx.data.enemies[type]?.glint ?? 0, false, false);
  }
  if (run.pendingLevelUps > 0) {
    rollLevelChoices(ctx);
    setPhase(ctx, 'levelUp');
    return;
  }
  world.levelUp.pending = 0;
  world.levelUp.choices = [];
  world.levelUp.revision++;
  setPhase(ctx, 'shop');
  fireSimpleTrigger(ctx, Trigger.OnShopStart);
  // Shop-start effects do not count toward Pulse limits; keeps the choice phases canonical (QA D-4).
  resetEffectCounters(ctx);
  ensureStats(ctx, sc);
  openShop(ctx);
}

/** pulseClear countdown; at 0 the player is placed for the next Pulse and the choices start. */
export function updateClear(ctx: SimCtx, sc: StatScratch): void {
  const run = ctx.run;
  if (run.clearTicks > 0) run.clearTicks--;
  if (run.clearTicks > 0) return;
  run.clearTicks = -1;
  const next = Math.min(ctx.world.pulse.index + 1, run.slots.length - 1);
  useArenaFor(ctx, next);
  placePlayer(ctx, next);
  advanceChoices(ctx, sc);
}

export function levelPick(ctx: SimCtx, choice: number, sc: StatScratch): boolean {
  if (!pickLevelCard(ctx, choice)) return false;
  ensureStats(ctx, sc);
  advanceChoices(ctx, sc);
  return true;
}

/** End the run with an outcome (victory, defeat, abandon). Silt: none in content tier A. */
export function endRun(ctx: SimCtx, outcome: number): void {
  const { world, data, run } = ctx;
  let silt = 0;
  if (data.meta.contentTier !== 'A') {
    // GDD 17.1 without the per-Pulse and win terms that have no data key yet (see gp-core-loop.md).
    silt = Math.floor(run.siltKills * (run.diff?.siltMult ?? 1));
  }
  world.runStats.silt = silt;
  run.victoryTicks = -1;
  run.deathTicks = -1;
  setPhase(ctx, outcome === RunOutcome.Victory ? 'victory' : 'defeat');
  ctx.events.push(SimEventType.RunEnded, world.player.x, world.player.y, outcome, silt, 0);
}

/** Boss Pulse end: final boss gives victory after the delay; a non-final boss goes to the reward. */
export function bossDefeated(ctx: SimCtx): void {
  const { run, world } = ctx;
  const slot = run.slots[world.pulse.index];
  if (slot?.isFinal !== true) run.rewardPending = true;
  endPulse(ctx, 1);
}

/** Boss stage centre for placement and tests. */
export function bossStageCenter(ctx: SimCtx, out: Point): void {
  if (ctx.arena === null) {
    out.x = 0;
    out.y = 0;
    return;
  }
  shapeCenter(ctx.arena.def.bossStage.shape, out);
}
