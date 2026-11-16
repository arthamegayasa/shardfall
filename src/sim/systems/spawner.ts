/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Pulse spawner (GDD 3.2, gd-answers Q15 to Q17): schedule from wave_spawns at Pulse start (RNG
// stream spawn), spawn marks, grace, alive cap with a FIFO queue, quiet end of Pulse.

import { SimEventType } from '../../core/index.ts';
import {
  SECTOR_IDS,
  clampInside,
  insideDistance,
  randomPointInShape,
  shapeCenter,
} from '../arena.ts';
import type { Point } from '../arena.ts';
import {
  AFFIX_TIMER_STRIDE,
  BURN_STACK_SLOTS,
  SCHEDULE_CAPACITY,
  SPAWN_POINT_ATTEMPTS,
} from '../capacity.ts';
import { AiState } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { allocSlot, freeSlot } from '../pools.ts';
import type { PulseSlotDef } from '../../content/index.ts';
import { applyAffix } from './affixes.ts';

const pt: Point = { x: 0, y: 0 };
const c2: Point = { x: 0, y: 0 };

/**
 * Build the spawn schedule of a Pulse. Group sizes uniform in [group_min, group_max] (last group
 * truncated), group time uniform within [start_frac x D, end_frac x D] clipped to [0, D - quiet]
 * [Asumsi: uniform until the w(tau) curve parameters exist in config.csv], sector uniform from the row.
 */
export function buildSchedule(ctx: SimCtx, slot: PulseSlotDef): void {
  const run = ctx.run;
  const rng = ctx.rng.spawn;
  run.scheduleCount = 0;
  run.scheduleNext = 0;
  run.queueHead = 0;
  run.queueTail = 0;
  if (slot.kind === 'boss') return;
  const d = slot.durationTicks;
  const quietEnd = Math.max(0, d - ctx.cfg.spawnQuietEndTicks);
  const spawnMult = run.diff?.spawnMult ?? 1;
  const ticks: number[] = [];
  const order: number[] = [];
  for (const sp of slot.spawns) {
    let type = -1;
    for (let i = 0; i < ctx.data.enemies.length; i++)
      if (ctx.data.enemies[i]?.id === sp.enemyId) type = i;
    if (type < 0) continue;
    let left = Math.round(sp.count * spawnMult);
    const lo = Math.min(sp.startFrac * d, quietEnd);
    const hi = Math.max(lo, Math.min(sp.endFrac * d, quietEnd));
    while (left > 0) {
      if (run.scheduleCount >= SCHEDULE_CAPACITY) {
        // Truncated schedule: counted, never silent (LP review M1).
        ctx.poolOverflow++;
        break;
      }
      const gMin = Math.max(1, sp.groupMin);
      const gMax = Math.max(gMin, sp.groupMax);
      const size = Math.min(left, rng.intRange(gMin, gMax));
      left -= size;
      const t = Math.floor(rng.range(lo, hi));
      const sectors = sp.sectors;
      const sec =
        sectors.length > 0
          ? Math.max(
              0,
              SECTOR_IDS.indexOf(sectors[rng.int(sectors.length)] as (typeof SECTOR_IDS)[number]),
            )
          : rng.int(SECTOR_IDS.length);
      const k = run.scheduleCount++;
      run.schedTick[k] = t;
      run.schedType[k] = type;
      run.schedSize[k] = size;
      run.schedSector[k] = sec;
      ticks.push(t);
      order.push(k);
    }
  }
  // Sort by time; ties keep row then group order (k is in that order).
  order.sort((a, b) => (ticks[a] ?? 0) - (ticks[b] ?? 0) || a - b);
  const tt = order.map((k) => run.schedTick[k]!);
  const ty = order.map((k) => run.schedType[k]!);
  const sz = order.map((k) => run.schedSize[k]!);
  const sc = order.map((k) => run.schedSector[k]!);
  for (let i = 0; i < order.length; i++) {
    run.schedTick[i] = tt[i]!;
    run.schedType[i] = ty[i]!;
    run.schedSize[i] = sz[i]!;
    run.schedSector[i] = sc[i]!;
  }
}

/** Unlit alive plus members of active spawn marks that count toward alive_cap (GDD 3.2). */
export function countedAlive(ctx: SimCtx): number {
  const e = ctx.world.enemies;
  const m = ctx.world.spawnMarks;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] === 1 && e.counted[i] === 1) n++;
  for (let i = 0; i < m.highWater; i++)
    if (m.alive[i] === 1 && m.counted[i] === 1) n += m.members[i]!;
  return n;
}

function markRadiusFor(ctx: SimCtx, type: number, size: number): number {
  const sim = ctx.sd.enemies[type];
  let r = sim?.markRadiusU ?? 0;
  // Groups of spawn_mark_medium_group_min or more use at least the medium mark (GDD 3.2, config).
  const minGroup = ctx.cfg.spawnMarkMediumGroupMin;
  const medium = ctx.cfg.spawnMarkDiamMediumU * 0.5;
  if (minGroup > 0 && size >= minGroup && r < medium) r = medium;
  return r;
}

/** One sector attempt for pickPoint (module level: no closure per spawn). */
function tryInSector(
  ctx: SimCtx,
  arena: NonNullable<SimCtx['arena']>,
  sec: number,
  checkPlayer: boolean,
  markR: number,
  out: Point,
): boolean {
  const shape = arena.sectors[SECTOR_IDS[sec] ?? 'n'];
  if (shape === undefined) return false;
  const p = ctx.world.player;
  const safe = arena.def.spawn.playerSafeRadius;
  for (let a = 0; a < SPAWN_POINT_ATTEMPTS; a++) {
    randomPointInShape(shape, ctx.rng.spawn, out);
    const dx = out.x - p.x;
    const dy = out.y - p.y;
    if (checkPlayer && dx * dx + dy * dy < safe * safe) continue;
    if (insideDistance(arena, out.x, out.y) < markR) continue;
    return true;
  }
  return false;
}

/** Pick a spawn point in a sector (arena-design 5.2): reject near the player or with the mark outside. */
function pickPoint(ctx: SimCtx, sector: number, markR: number, out: Point): void {
  const arena = ctx.arena;
  if (arena === null) {
    out.x = 0;
    out.y = 0;
    return;
  }
  if (tryInSector(ctx, arena, sector, true, markR, out)) return;
  const far = farthestSector(ctx);
  if (tryInSector(ctx, arena, far, true, markR, out)) return;
  tryInSector(ctx, arena, far, false, markR, out);
}

/** Sector whose centre is farthest from the player (ties: lowest index). */
export function farthestSector(ctx: SimCtx): number {
  const arena = ctx.arena;
  if (arena === null) return 0;
  const p = ctx.world.player;
  let best = 0;
  let bestD = -1;
  for (let i = 0; i < SECTOR_IDS.length; i++) {
    const shape = arena.sectors[SECTOR_IDS[i] ?? 'n'];
    if (shape === undefined) continue;
    shapeCenter(shape, c2);
    const d = (c2.x - p.x) * (c2.x - p.x) + (c2.y - p.y) * (c2.y - p.y);
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Start a spawn mark for a group. counted: members count toward alive_cap. */
export function startMark(
  ctx: SimCtx,
  type: number,
  size: number,
  sector: number,
  counted: boolean,
): number {
  const r = markRadiusFor(ctx, type, size);
  pickPoint(ctx, sector, r, pt);
  return startMarkAt(ctx, type, size, pt.x, pt.y, counted, -1);
}

/**
 * Start a spawn mark at a point (summons next to their owner: summoner, brood). owner: enemy slot
 * whose summon count the members join (-1 none). Returns the mark slot or -1 when the pool is full.
 */
export function startMarkAt(
  ctx: SimCtx,
  type: number,
  size: number,
  x: number,
  y: number,
  counted: boolean,
  owner: number,
): number {
  const m = ctx.world.spawnMarks;
  const r = markRadiusFor(ctx, type, size);
  pt.x = x;
  pt.y = y;
  if (ctx.arena !== null) clampInside(ctx.arena, x, y, r, pt);
  const i = allocSlot(m);
  if (i < 0) {
    ctx.poolOverflow++;
    return -1;
  }
  const ticks = Math.max(1, ctx.cfg.spawnMarkTicks);
  m.x[i] = pt.x;
  m.y[i] = pt.y;
  m.prevX[i] = pt.x;
  m.prevY[i] = pt.y;
  m.radius[i] = r;
  m.typeIndex[i] = type;
  m.ticksLeft[i] = ticks;
  m.ticksTotal[i] = ticks;
  m.members[i] = size;
  m.counted[i] = counted ? 1 : 0;
  m.owner[i] = owner;
  m.ownerSerial[i] = owner >= 0 ? ctx.world.enemies.serial[owner]! : 0;
  ctx.events.push(SimEventType.SpawnMarked, pt.x, pt.y, type, ticks, 0);
  return i;
}

/** Spawn one enemy now (after its mark). Returns the slot or -1 when the pool is full. */
export function spawnEnemy(
  ctx: SimCtx,
  type: number,
  x: number,
  y: number,
  counted: boolean,
): number {
  const def = ctx.data.enemies[type];
  const sim = ctx.sd.enemies[type];
  if (def === undefined || sim === undefined) return -1;
  const e = ctx.world.enemies;
  const s = allocSlot(e);
  if (s < 0) {
    ctx.poolOverflow++;
    return -1;
  }
  const run = ctx.run;
  const diff = run.diff;
  let hpMult = run.hpScale * (diff?.enemyHpMult ?? 1);
  if (sim.rank === 2) hpMult *= diff?.bossHpMult ?? 1;
  const hp = def.hp * hpMult;
  e.x[s] = x;
  e.y[s] = y;
  e.prevX[s] = x;
  e.prevY[s] = y;
  e.radius[s] = sim.radiusU;
  e.typeIndex[s] = type;
  e.rank[s] = sim.rank;
  e.hp[s] = hp;
  e.maxHp[s] = hp;
  e.shield[s] = 0;
  e.aiState[s] = AiState.Move;
  e.aiStateTicks[s] = 0;
  e.facing[s] = x > ctx.world.player.x ? -1 : 1;
  e.hitFlashTicks[s] = 0;
  e.statusMask[s] = 0;
  e.ageTicks[s] = 0;
  e.aiTimer[s] = 0;
  e.aiCounter[s] = 0;
  e.dirX[s] = 0;
  e.dirY[s] = 0;
  e.kbX[s] = 0;
  e.kbY[s] = 0;
  e.kbTicks[s] = 0;
  e.burnStacks[s] = 0;
  for (let k = 0; k < BURN_STACK_SLOTS; k++) e.burnDps[s * BURN_STACK_SLOTS + k] = 0;
  e.burnTicks[s] = 0;
  e.burnTickTimer[s] = 0;
  e.slowPct[s] = 0;
  e.slowTicks[s] = 0;
  e.markTicks[s] = 0;
  e.markPct[s] = 0;
  e.dmgScale[s] = run.dmgScale;
  e.speedMult[s] = diff?.enemySpeedMult ?? 1;
  e.counted[s] = counted ? 1 : 0;
  e.chargeHit[s] = 0;
  e.affixMask[s] = 0;
  e.guardAdd[s] = 0;
  e.kbImmune[s] = 0;
  e.shellRegrow[s] = 0;
  e.blinkTicks[s] = 0;
  e.blinkX[s] = 0;
  e.blinkY[s] = 0;
  e.summonOwner[s] = -1;
  e.summonOwnerSerial[s] = 0;
  for (let k = 0; k < AFFIX_TIMER_STRIDE; k++) e.affixTimer[s * AFFIX_TIMER_STRIDE + k] = 0;
  const slots = run.weaponIndex.length;
  for (let k = 0; k < slots; k++) e.orbitTimer[s * slots + k] = 0;
  ctx.events.push(SimEventType.EnemySpawned, x, y, type, sim.rank, 0);
  for (let k = 0; k < sim.affixes.length; k++) applyAffix(ctx, s, sim.affixes[k]!);
  // Crack 2+: Wardens get warden_extra_affixes random affixes from the pool, no duplicates (GDD 15.2).
  const extra = sim.rank === 1 ? Math.floor(diff?.wardenExtraAffixes ?? 0) : 0;
  for (let n = 0; n < extra; n++) {
    let options = 0;
    for (const a of ctx.sd.affixPool) if (a < 31 && (e.affixMask[s] & (1 << a)) === 0) options++;
    if (options === 0) break;
    let pick = ctx.rng.spawn.int(options);
    for (const a of ctx.sd.affixPool) {
      if (a >= 31 || (e.affixMask[s] & (1 << a)) !== 0) continue;
      if (pick-- === 0) {
        applyAffix(ctx, s, a);
        break;
      }
    }
  }
  return s;
}

/** Emerge enemies from finished marks. Warden and boss marks are handled by their callers via the return. */
export function updateMarks(ctx: SimCtx, onEmerge: (ctx: SimCtx, slot: number) => void): void {
  const m = ctx.world.spawnMarks;
  const spread = ctx.cfg.spawnGroupSpreadU;
  for (let i = 0; i < m.highWater; i++) {
    if (m.alive[i] === 0) continue;
    m.ticksLeft[i] = m.ticksLeft[i]! - 1;
    if (m.ticksLeft[i]! > 0) continue;
    const type = m.typeIndex[i]!;
    const n = m.members[i]!;
    const counted = m.counted[i] === 1;
    const x = m.x[i]!;
    const y = m.y[i]!;
    const owner = m.owner[i]!;
    const ownerSerial = m.ownerSerial[i]!;
    freeSlot(m, i);
    for (let k = 0; k < n; k++) {
      const ox = n > 1 ? ctx.rng.spawn.range(-spread, spread) : 0;
      const oy = n > 1 ? ctx.rng.spawn.range(-spread, spread) : 0;
      const s = spawnEnemy(ctx, type, x + ox, y + oy, counted);
      if (s < 0) continue;
      ctx.world.enemies.summonOwner[s] = owner;
      ctx.world.enemies.summonOwnerSerial[s] = ownerSerial;
      onEmerge(ctx, s);
    }
  }
}

/** Advance the schedule and start marks while there is room under alive_cap (FIFO queue). */
export function updateSpawner(ctx: SimCtx, aliveCap: number, durationTicks: number): void {
  const run = ctx.run;
  const t = run.pulseTick;
  while (run.scheduleNext < run.scheduleCount && run.schedTick[run.scheduleNext]! <= t) {
    run.queue[run.queueTail++] = run.scheduleNext++;
  }
  if (run.queueHead >= run.queueTail) return;
  // Queued groups that cannot start before the quiet end are dropped (GDD 3.2).
  if (t >= durationTicks - ctx.cfg.spawnQuietEndTicks) {
    run.queueHead = run.queueTail;
    return;
  }
  let counted = countedAlive(ctx);
  while (run.queueHead < run.queueTail) {
    const k = run.queue[run.queueHead]!;
    const size = run.schedSize[k]!;
    if (counted > 0 && counted + size > aliveCap) break;
    run.queueHead++;
    if (startMark(ctx, run.schedType[k]!, size, run.schedSector[k]!, true) >= 0) counted += size;
  }
}

/** Drop the schedule and queue (end of Pulse, Warden overtime). */
export function dropSchedule(ctx: SimCtx): void {
  const run = ctx.run;
  run.scheduleNext = run.scheduleCount;
  run.queueHead = run.queueTail;
}
