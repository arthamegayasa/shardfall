// Sim factory (architecture.md 6.3). Owns the step order (GDD 3.6): commands, Pulse timer, player
// movement and attacks, Unlit deaths (boss included), then damage to the player.
// Rules: no wall clock, no Math.random, no DOM, numbers only from GameData.

import {
  RejectReason,
  RNG_STREAMS,
  RunOutcome,
  RunPhaseCode,
  SIM_EVENT_CAPACITY,
  SimEventType,
  createEventBuffer,
  createHasher,
  createRngStreams,
  seedState,
  streamSeed,
} from '../core/index.ts';
import type {
  Command,
  CreateSim,
  InputFrame,
  LoadResult,
  RunSave,
  Sim,
  SimConfig,
} from '../core/index.ts';
import { setRunUnlocks } from '../content/index.ts';
import { ENEMY_CAPACITY, HIT_STACK_DEPTH, WEAPON_MAX_TIER } from './capacity.ts';
import { TRIGGER_COUNT } from './codes.ts';
import { createHitCtx, createPending, createRunState } from './ctx.ts';
import type { SimCtx } from './ctx.ts';
import { rebuildActiveEffects } from './effects/active.ts';
import { createEffectHooks, updatePending, updateTimedEffects } from './effects/engine.ts';
import { applySave, createSave, validateSave } from './save-codec.ts';
import { buildSimData } from './sim-data.ts';
import { hashState } from './state-hash.ts';
import { createStatScratch, passiveConditionMask } from './stats.ts';
import type { StatScratch } from './stats.ts';
import { updateDangerAreas, updatePlayerZones } from './systems/areas.ts';
import { bossMove, spawnWardenMark, updateBoss } from './systems/boss.ts';
import { killEnemy, updateEnemyStatuses } from './systems/combat.ts';
import { updateEnemyShots } from './systems/enemy-shots.ts';
import { contactDamage, updateEnemies } from './systems/enemies.ts';
import { gainGlint, updatePickups } from './systems/pickups.ts';
import { handleRiteInput, movePlayer, updatePlayerTimers } from './systems/player.ts';
import { acquireMemento } from './systems/progression.ts';
import { updatePlayerShots } from './systems/projectiles.ts';
import { createShotSpec, recountProcShots } from './systems/projectiles.ts';
import {
  advanceChoices,
  beginPulse,
  bossDefeated,
  canonicalReset,
  endPulse,
  endRun,
  ensureStats,
  levelPick,
  updateClear,
  updatePulseTimer,
  useArenaFor,
} from './systems/run.ts';
import {
  refreshShopView,
  shopBuy,
  shopLock,
  shopMerge,
  shopReroll,
  shopSell,
} from './systems/shop.ts';
import { updateSignals } from './systems/signals.ts';
import { spawnEnemy, updateMarks, updateSpawner } from './systems/spawner.ts';
import { updateWeapons } from './systems/weapons.ts';
import { addXp, xpToNext } from './systems/xp.ts';
import { createWorld } from './world.ts';

/** Sim plus its internal context. Tests use it to check systems directly; the app uses createSim. */
export interface SimInternals {
  readonly sim: Sim;
  readonly ctx: SimCtx;
  readonly sc: StatScratch;
}

export const createSim: CreateSim = (config: SimConfig): Sim => createSimInternals(config).sim;

export function createSimInternals(config: SimConfig): SimInternals {
  const { data } = config;
  const sd = buildSimData(data);
  const cfgSlots = data.config.weaponSlots;
  const weaponSlots = Number.isFinite(cfgSlots) && cfgSlots > 0 ? Math.floor(cfgSlots) : 1;
  const world = createWorld(sd.statCount, sd.tagCount, weaponSlots);
  const events = createEventBuffer(SIM_EVENT_CAPACITY);
  const effectCount = data.effects.length;
  const ctx: SimCtx = {
    active: {
      count: 0,
      effect: new Int32Array(Math.max(1, effectCount)),
      copies: new Int32Array(Math.max(1, effectCount)),
      order: new Int32Array(Math.max(1, effectCount)),
      start: new Int32Array(TRIGGER_COUNT + 1),
    },
    data,
    sd,
    cfg: data.config,
    world,
    rng: createRngStreams(0),
    events,
    debug: config.debugCommands === true,
    arena: null,
    grid: null,
    scratch: new Int32Array(ENEMY_CAPACITY),
    scratch2: new Int32Array(ENEMY_CAPACITY),
    queryBufs: Array.from({ length: HIT_STACK_DEPTH + 1 }, () => new Int32Array(ENEMY_CAPACITY)),
    pending: createPending(),
    run: createRunState(
      weaponSlots,
      data.mementos.length,
      sd.statCount,
      effectCount,
      ENEMY_CAPACITY,
    ),
    hits: Array.from({ length: HIT_STACK_DEPTH }, createHitCtx),
    hitDepth: -1,
    fx: createEffectHooks(),
    shot: createShotSpec(),
    poolOverflow: 0,
    procLive: 0,
  };
  const sc = createStatScratch(sd.statCount);
  const queue: Command[] = [];
  const hasher = createHasher();
  const words = new Uint32Array(4);

  const reject = (reason: number): void => {
    events.push(SimEventType.CommandRejected, 0, 0, reason, 0, 0);
  };

  /** Reset world and run state for a new run (same world object; view identity is stable). */
  const beginRun = (
    classIndex: number,
    profile: string,
    difficulty: number,
    seed: number,
  ): boolean => {
    const cls = data.classes[classIndex];
    const slots = data.profiles[profile];
    if (cls === undefined || slots === undefined || slots.length === 0 || data.arenas.length === 0)
      return false;
    if (sd.missingRequired.length > 0) return false;
    ctx.run = createRunState(
      weaponSlots,
      data.mementos.length,
      sd.statCount,
      effectCount,
      ENEMY_CAPACITY,
    );
    const run = ctx.run;
    run.started = true;
    run.seed = seed;
    run.classIndex = classIndex;
    run.classId = cls.id;
    run.profile = profile;
    run.slots = slots;
    run.difficulty = difficulty;
    run.diff = data.difficulty.find((d) => d.level === difficulty) ?? null;
    for (const name of RNG_STREAMS) ctx.rng[name].setState(seedState(streamSeed(seed, name)));
    ctx.arena = null;
    ctx.grid = null;
    ctx.hitDepth = -1;
    // Run-relative clock: run state stores absolute ticks (lastHurtTick, effect cooldowns), so a run
    // started after the title screen idled must see the same ticks as a fresh sim (replays, D-8).
    world.tick = 0;
    canonicalReset(ctx);
    const p = world.player;
    p.classIndex = classIndex;
    p.riteIndex = Math.max(
      0,
      data.rites.findIndex((r) => r.id === cls.riteId),
    );
    p.radius = data.config.playerRadiusU;
    p.level = 1;
    p.xp = 0;
    p.xpToNext = xpToNext(ctx, 1);
    p.glint = 0;
    p.hp = 0;
    p.maxHp = cls.maxHp;
    const rs = world.runStats;
    rs.kills = 0;
    rs.glintEarned = 0;
    rs.glintSpent = 0;
    rs.pulsesCleared = 0;
    rs.runTicks = 0;
    rs.silt = 0;
    rs.killedBy = 0;
    rs.difficulty = difficulty;
    world.levelUp.choices = [];
    world.levelUp.pending = 0;
    world.levelUp.total = 0;
    world.levelUp.revision++;
    world.reward.choices = [];
    world.reward.sourceTypeIndex = -1;
    world.reward.revision++;
    useArenaFor(ctx, 0);
    rebuildActiveEffects(ctx, false);
    return true;
  };

  const startRun = (cmd: Extract<Command, { type: 'run.start' }>): void => {
    const ph = world.phase;
    if (ph !== 'idle' && ph !== 'victory' && ph !== 'defeat') {
      reject(RejectReason.WrongPhase);
      return;
    }
    const ci = data.classes.findIndex((c) => c.id === cmd.classId);
    if (ci < 0 || !beginRun(ci, cmd.profile, cmd.difficulty, cmd.seed)) {
      reject(RejectReason.UnknownId);
      return;
    }
    setRunUnlocks(data, ctx.run, cmd.unlocked ?? []);
    const cls = data.classes[ci];
    const wi = data.weapons.findIndex((w) => w.id === cls?.startWeapon);
    if (wi >= 0) {
      ctx.run.weaponIndex[0] = wi;
      ctx.run.weaponTier[0] = 1;
    }
    rebuildActiveEffects(ctx, false);
    ctx.run.statsDirty = true;
    ensureStats(ctx, sc);
    world.player.hp = world.player.maxHp;
    // BUG-001: the build summary (Pause, run end) reads the shop view; fill it from this run now,
    // not only when the first shop opens.
    refreshShopView(ctx);
    beginPulse(ctx, 0, sc);
  };

  const inPhase = (ph: string): boolean => {
    if (world.phase === ph) return true;
    reject(RejectReason.WrongPhase);
    return false;
  };

  const afterShop = (): void => {
    ensureStats(ctx, sc);
    refreshShopView(ctx);
  };

  const debugCmd = (cmd: Extract<Command, { type: `debug.${string}` }>): void => {
    if (!ctx.debug) {
      reject(RejectReason.DebugDisabled);
      return;
    }
    const run = ctx.run;
    if (!run.started) {
      reject(RejectReason.WrongPhase);
      return;
    }
    switch (cmd.type) {
      case 'debug.grant': {
        if (cmd.kind === 'weapon') {
          const wi = data.weapons.findIndex((w) => w.id === cmd.id);
          if (wi < 0) {
            reject(RejectReason.UnknownId);
            return;
          }
          const slot = run.weaponIndex.indexOf(-1);
          if (slot < 0) {
            reject(RejectReason.SlotsFull);
            return;
          }
          run.weaponIndex[slot] = wi;
          run.weaponTier[slot] = Math.min(WEAPON_MAX_TIER, Math.max(1, Math.floor(cmd.tier)));
          rebuildActiveEffects(ctx, true);
        } else {
          const mi = data.mementos.findIndex((m) => m.id === cmd.id);
          if (mi < 0) {
            reject(RejectReason.UnknownId);
            return;
          }
          acquireMemento(ctx, mi, true);
        }
        ensureStats(ctx, sc);
        refreshShopView(ctx);
        return;
      }
      case 'debug.spawn': {
        if (world.phase !== 'pulse') {
          reject(RejectReason.WrongPhase);
          return;
        }
        const type = data.enemies.findIndex((e) => e.id === cmd.enemyId);
        if (type < 0) {
          reject(RejectReason.UnknownId);
          return;
        }
        for (let k = 0; k < cmd.count; k++)
          onEmerge(ctx, spawnEnemy(ctx, type, cmd.x, cmd.y, false));
        return;
      }
      case 'debug.glint':
        gainGlint(ctx, cmd.amount, false, false);
        if (world.phase === 'shop') refreshShopView(ctx);
        return;
      case 'debug.setHp':
        if (!Number.isFinite(cmd.hp) || world.phase === 'victory' || world.phase === 'defeat') {
          reject(RejectReason.WrongPhase);
          return;
        }
        world.player.hp = Math.max(1, Math.min(world.player.maxHp, cmd.hp));
        return;
      case 'debug.endPulse':
        if (world.phase !== 'pulse' || run.victoryTicks >= 0 || run.deathTicks >= 0) {
          reject(RejectReason.WrongPhase);
          return;
        }
        if (world.pulse.isBoss) {
          if (run.bossSlot >= 0) killEnemy(ctx, run.bossSlot, 0, false);
          run.bossKilled = true;
          bossDefeated(ctx);
        } else {
          // A living Warden dies first, so its reward follows (e2e goToScreen('warden-reward')).
          if (run.wardenSlot >= 0) killEnemy(ctx, run.wardenSlot, 0, false);
          endPulse(ctx, run.diff?.pulseEndCollectFrac ?? data.config.pulseEndCollectFrac);
        }
        return;
      case 'debug.xp':
        if (world.phase !== 'pulse') {
          reject(RejectReason.WrongPhase);
          return;
        }
        addXp(ctx, Math.max(0, cmd.amount));
        return;
    }
  };

  const apply = (cmd: Command): void => {
    const run = ctx.run;
    switch (cmd.type) {
      case 'run.start':
        startRun(cmd);
        return;
      case 'pulse.begin':
        if (!inPhase('shop')) return;
        beginPulse(ctx, world.pulse.index + 1, sc);
        return;
      case 'reward.pick': {
        if (!inPhase('reward')) return;
        const m = run.rewardChoices[cmd.choice];
        if (m === undefined) {
          reject(RejectReason.InvalidSlot);
          return;
        }
        run.rewardChoices = [];
        acquireMemento(ctx, m, true);
        events.push(SimEventType.RewardChosen, 0, 0, m, 0, 0);
        advanceChoices(ctx, sc);
        return;
      }
      case 'levelup.pick':
        if (!inPhase('levelUp')) return;
        if (!levelPick(ctx, cmd.choice, sc)) reject(RejectReason.InvalidSlot);
        return;
      case 'shop.buy':
        if (!inPhase('shop')) return;
        shopBuy(ctx, cmd.offer);
        afterShop();
        return;
      case 'shop.reroll':
        if (!inPhase('shop')) return;
        shopReroll(ctx);
        afterShop();
        return;
      case 'shop.lock':
        if (!inPhase('shop')) return;
        shopLock(ctx, cmd.offer, cmd.locked);
        afterShop();
        return;
      case 'shop.sell':
        if (!inPhase('shop')) return;
        shopSell(ctx, cmd.inventorySlot);
        afterShop();
        return;
      case 'shop.merge':
        if (!inPhase('shop')) return;
        shopMerge(ctx, cmd.inventorySlot);
        afterShop();
        return;
      case 'run.abandon': {
        const ph = world.phase;
        // The final boss already fell: the victory delay must end in victory (LP review M1-09a).
        if (ph === 'idle' || ph === 'victory' || ph === 'defeat' || run.victoryTicks >= 0) {
          reject(RejectReason.WrongPhase);
          return;
        }
        endRun(ctx, RunOutcome.Abandon);
        return;
      }
      default:
        debugCmd(cmd);
    }
  };

  /** Called for every enemy that emerges (marks, debug): Warden bookkeeping and HUD views. */
  function onEmerge(c: SimCtx, slot: number): void {
    if (slot < 0) return;
    const run = c.run;
    const e = c.world.enemies;
    if (e.rank[slot] === 1 && run.wardenSlot < 0 && e.typeIndex[slot] === run.wardenType) {
      run.wardenSlot = slot;
      events.push(SimEventType.WardenSpawned, e.x[slot] ?? 0, e.y[slot] ?? 0, run.wardenType, 0, 0);
    }
  }

  const syncFoes = (): void => {
    const run = ctx.run;
    const e = world.enemies;
    const pulse = world.pulse;
    const w = pulse.warden;
    const ws = run.wardenSlot;
    w.active = ws >= 0 && e.alive[ws] === 1;
    pulse.wardenAlive = w.active;
    if (w.active) {
      w.typeIndex = e.typeIndex[ws] ?? -1;
      w.hp = e.hp[ws] ?? 0;
      w.maxHp = e.maxHp[ws] ?? 0;
      w.shield = e.shield[ws] ?? 0;
      w.phase = 1;
      w.enraged = run.hasteApplied;
    }
    const b = pulse.boss;
    const bs = run.bossSlot;
    b.active = bs >= 0 && e.alive[bs] === 1;
    if (b.active) {
      b.typeIndex = e.typeIndex[bs] ?? -1;
      b.hp = e.hp[bs] ?? 0;
      b.maxHp = e.maxHp[bs] ?? 0;
      b.shield = e.shield[bs] ?? 0;
      b.phase = run.bossPhase;
      b.enraged = run.bossEnraged;
    }
  };

  // Boss trickle type: resolved once per Pulse (and run), not every tick (no per-tick closures).
  let trickleSlots: unknown = null;
  let trickleIndex = -1;
  let trickleCached = 0;
  const trickleType = (): number => {
    if (ctx.run.slots === trickleSlots && world.pulse.index === trickleIndex) return trickleCached;
    trickleSlots = ctx.run.slots;
    trickleIndex = world.pulse.index;
    const sp = ctx.run.slots[trickleIndex]?.spawns[0];
    const t = sp !== undefined ? data.enemies.findIndex((e) => e.id === sp.enemyId) : -1;
    trickleCached = t >= 0 ? t : sd.swarmerType;
    return trickleCached;
  };

  const pulseTick = (input: InputFrame): void => {
    const run = ctx.run;
    if (run.deathTicks >= 0) {
      run.deathTicks--;
      if (run.deathTicks <= 0) endRun(ctx, RunOutcome.Defeat);
      return;
    }
    if (run.victoryTicks >= 0) {
      run.victoryTicks--;
      if (run.victoryTicks <= 0) endRun(ctx, RunOutcome.Victory);
      return;
    }
    if (updatePulseTimer(ctx)) return;
    recountProcShots(ctx);
    const p = world.player;
    p.prevX = p.x;
    p.prevY = p.y;
    const moved = movePlayer(ctx, input);
    handleRiteInput(ctx, input);
    updatePlayerTimers(ctx);
    if (run.wardenSpawnTick >= 0 && !run.wardenSpawned && run.pulseTick >= run.wardenSpawnTick)
      spawnWardenMark(ctx);
    // Marks first: a mark started this tick is not counted down until the next tick.
    updateMarks(ctx, onEmerge);
    const slot = run.slots[world.pulse.index];
    if (slot !== undefined && !world.pulse.isBoss && !world.pulse.overtime) {
      updateSpawner(ctx, slot.aliveCap, slot.durationTicks);
    }
    updateBoss(ctx, spawnEnemy, trickleType());
    const e = world.enemies;
    const grid = ctx.grid;
    if (grid !== null) grid.build(e.highWater, e.alive, e.x, e.y);
    updateEnemies(ctx, bossMove);
    if (grid !== null) grid.build(e.highWater, e.alive, e.x, e.y);
    updateWeapons(ctx);
    updatePlayerShots(ctx);
    updatePlayerZones(ctx);
    updateEnemyStatuses(ctx);
    updatePending(ctx);
    updateTimedEffects(ctx, moved);
    // Unlit deaths before damage to the player: the final boss wins ties (GDD 3.6).
    if (run.bossKilled && world.pulse.isBoss) {
      bossDefeated(ctx);
      return;
    }
    updateDangerAreas(ctx);
    updateEnemyShots(ctx);
    contactDamage(ctx);
    updatePickups(ctx);
    if (run.passiveMask !== passiveConditionMask(ctx)) run.statsDirty = true;
  };

  /** load() happens between steps; its PhaseChanged is emitted after the next clear (contract 6.5). */
  let loadedPhasePending = false;

  const step = (input: InputFrame): void => {
    events.clear();
    ctx.hitDepth = -1;
    if (loadedPhasePending) {
      loadedPhasePending = false;
      events.push(SimEventType.PhaseChanged, 0, 0, RunPhaseCode[world.phase], RunPhaseCode.idle, 0);
    }
    for (let i = 0; i < queue.length; i++) {
      const cmd = queue[i];
      if (cmd !== undefined) apply(cmd);
    }
    queue.length = 0;
    const ph = world.phase;
    if (ph === 'pulse') pulseTick(input);
    else if (ph === 'pulseClear') updateClear(ctx, sc);
    // BUG-013: choice phases (Temper, the Glazier, Warden reward) have no clock. The step still
    // runs (commands, replays count steps) but the run clock stands still, so idling there can
    // neither charge tick-based effect cooldowns and "not hurt for N s" conditions nor grow run time.
    const frozen = ph === 'levelUp' || ph === 'shop' || ph === 'reward';
    if (!frozen && ctx.run.started && world.phase !== 'victory' && world.phase !== 'defeat')
      world.runStats.runTicks++;
    ensureStats(ctx, sc);
    syncFoes();
    updateSignals(ctx);
    if (!frozen) world.tick++;
  };

  const sim: Sim = {
    view: world,
    events,
    enqueue(cmd) {
      queue.push(cmd);
    },
    step,
    save(): RunSave | null {
      return createSave(ctx);
    },
    load(save: RunSave): LoadResult {
      const bad = validateSave(save, data);
      if (bad !== null) return bad;
      let res: LoadResult;
      try {
        res = applySave(ctx, save, sc, beginRun);
      } catch {
        // A save that passed the shape check but still breaks applySave: report, never throw.
        res = { ok: false, reason: 'corrupt' };
      }
      if (res.ok) loadedPhasePending = true;
      return res;
    },
    hash() {
      return hashState(ctx, hasher, words);
    },
    get poolOverflow() {
      return ctx.poolOverflow;
    },
  };
  return { sim, ctx, sc };
}
