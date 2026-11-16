/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Warden affixes (GDD 15.2, affixes.csv): hasted, volley, veiled, blinking, brood, tar_trail,
// pulsing, bulwark. Every number comes from the affix params; a missing key turns that part off.
// Damaging affixes are telegraphed (P2-e) with at least the GD minimum of their category.

import {
  AffixAction,
  AreaShape,
  SimEventType,
  SourceKind,
  TICK_RATE,
  TelegraphKind,
  cosTurns,
  encodeSource,
  sinTurns,
} from '../../core/index.ts';
import { clampInside } from '../arena.ts';
import type { Point } from '../arena.ts';
import { AFFIX_TIMER_STRIDE } from '../capacity.ts';
import { DangerMode } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { pnum, pstr } from '../sim-data.ts';
import { TeleMin, spawnDanger, teleTicks } from './areas.ts';
import { startMarkAt } from './spawner.ts';

const tmp: Point = { x: 0, y: 0 };
const sec = (s: number): number => Math.round(s * TICK_RATE);
const perTick = (uPerSec: number): number => uPerSec / TICK_RATE;

function hasAffix(ctx: SimCtx, s: number, a: number): boolean {
  return a >= 0 && a < 31 && (ctx.world.enemies.affixMask[s]! & (1 << a)) !== 0;
}

function timerAt(s: number, a: number): number {
  return s * AFFIX_TIMER_STRIDE + a;
}

/** Give affix a (AffixIndex) to enemy slot s: mask bit, one-time effects, first timers, event. */
export function applyAffix(ctx: SimCtx, s: number, a: number): void {
  const def = ctx.data.affixes[a];
  const e = ctx.world.enemies;
  if (def === undefined || a >= 31 || hasAffix(ctx, s, a)) return;
  e.affixMask[s] = e.affixMask[s]! | (1 << a);
  const p = def.params;
  const af = ctx.sd.affix;
  if (a === af.hasted) {
    e.speedMult[s] = e.speedMult[s]! * (1 + pnum(p, 'move_pct', 0) / 100);
  } else if (a === af.veiled) {
    e.shield[s] = pnum(p, 'shell_frac', 0) * e.maxHp[s]!;
  } else if (a === af.bulwark) {
    e.guardAdd[s] = e.guardAdd[s]! + pnum(p, 'guard_add', 0);
    if (pnum(p, 'kb_immune', 0) > 0) e.kbImmune[s] = 1;
  } else if (a === af.tar_trail) {
    e.affixTimer[timerAt(s, a)] = sec(pnum(p, 'drop_every', 0));
  } else {
    // Timed affixes start a full interval after they are given (blinking, brood, pulsing).
    e.affixTimer[timerAt(s, a)] = sec(pnum(p, 'interval', 0));
  }
  ctx.events.push(SimEventType.AffixApplied, e.x[s]!, e.y[s]!, a, s, 0);
}

/** Overtime haste (GDD 3.3): hasted is added to the living Warden. */
export function applyOvertimeHaste(ctx: SimCtx, s: number): void {
  const a = ctx.sd.affix.hasted;
  if (a < 0 || hasAffix(ctx, s, a)) return;
  applyAffix(ctx, s, a);
  const e = ctx.world.enemies;
  ctx.events.push(SimEventType.AffixTriggered, e.x[s]!, e.y[s]!, a, AffixAction.Haste, 1);
}

/** Affix volley (GDD 15.2): ring telegraph, then a ring of shots, after each attack sequence. */
export function afterAttack(ctx: SimCtx, s: number): void {
  const a = ctx.sd.affix.volley;
  if (!hasAffix(ctx, s, a)) return;
  const def = ctx.data.affixes[a];
  if (def === undefined) return;
  const e = ctx.world.enemies;
  const count = Math.floor(pnum(def.params, 'count', 0));
  const speed = perTick(pnum(def.params, 'shot_speed', 0));
  const life = sec(pnum(def.params, 'shot_life', 0));
  const dmg = pnum(def.params, 'dmg', 0) * e.dmgScale[s]!;
  if (count <= 0 || speed <= 0 || life <= 0) return;
  const z = spawnDanger(
    ctx,
    DangerMode.Burst,
    AreaShape.Circle,
    TelegraphKind.Ring,
    e.x[s]!,
    e.y[s]!,
    e.radius[s]!,
    teleTicks(ctx, TeleMin.Projectile, def.telegraphTicks),
    dmg,
    encodeSource(SourceKind.Affix, a),
    -1,
  );
  if (z >= 0) {
    const da = ctx.world.dangerAreas;
    da.maxRadius[z] = count;
    da.speed[z] = speed;
    da.tickEvery[z] = life;
    da.p2[z] = e.typeIndex[s]!;
  }
}

/** Count living summons owned by slot s (summoner max_summons). */
export function summonsAlive(ctx: SimCtx, s: number): number {
  const e = ctx.world.enemies;
  const m = ctx.world.spawnMarks;
  const serial = e.serial[s]!;
  let n = 0;
  for (let i = 0; i < e.highWater; i++)
    if (e.alive[i] === 1 && e.summonOwner[i] === s && e.summonOwnerSerial[i] === serial) n++;
  for (let i = 0; i < m.highWater; i++)
    if (m.alive[i] === 1 && m.owner[i] === s && m.ownerSerial[i] === serial) n += m.members[i]!;
  return n;
}

/**
 * Spawn `count` summons of type around slot s: one spawn mark each on a ring just outside the
 * owner (owner radius plus the mark radius), random start angle from the ai stream.
 */
export function summonAround(ctx: SimCtx, s: number, type: number, count: number): void {
  const e = ctx.world.enemies;
  const mark = ctx.sd.enemies[type]?.markRadiusU ?? 0;
  const dist = e.radius[s]! + mark;
  const base = ctx.rng.ai.next();
  for (let k = 0; k < count; k++) {
    const t = base + k / count;
    startMarkAt(ctx, type, 1, e.x[s]! + cosTurns(t) * dist, e.y[s]! + sinTurns(t) * dist, false, s);
  }
}

function enemyTypeById(ctx: SimCtx, id: string): number {
  for (let i = 0; i < ctx.data.enemies.length; i++) if (ctx.data.enemies[i]?.id === id) return i;
  return -1;
}

/** Per-tick affix behavior of one enemy (after its movement). */
export function updateAffixes(ctx: SimCtx, s: number): void {
  const e = ctx.world.enemies;
  const mask = e.affixMask[s]!;
  if (mask === 0 && e.blinkTicks[s] === 0) return;
  const af = ctx.sd.affix;
  // Blink landing (the destination telegraph started blinkTicks ago).
  if (e.blinkTicks[s]! > 0) {
    e.blinkTicks[s] = e.blinkTicks[s]! - 1;
    if (e.blinkTicks[s] === 0) {
      e.x[s] = e.blinkX[s]!;
      e.y[s] = e.blinkY[s]!;
      // No interpolation streak across the arena.
      e.prevX[s] = e.x[s]!;
      e.prevY[s] = e.y[s]!;
      ctx.events.push(
        SimEventType.AffixTriggered,
        e.x[s],
        e.y[s],
        af.blinking,
        AffixAction.Blink,
        0,
      );
    }
  }
  // veiled: regrow the shell after regrow_s without damage.
  if (hasAffix(ctx, s, af.veiled) && e.shellRegrow[s]! > 0) {
    e.shellRegrow[s] = e.shellRegrow[s]! - 1;
    if (e.shellRegrow[s] === 0) {
      const def = ctx.data.affixes[af.veiled];
      const full = def !== undefined ? pnum(def.params, 'shell_frac', 0) * e.maxHp[s]! : 0;
      if (e.shield[s]! < full) {
        e.shield[s] = full;
        ctx.events.push(
          SimEventType.AffixTriggered,
          e.x[s]!,
          e.y[s]!,
          af.veiled,
          AffixAction.ShellUp,
          0,
        );
      }
    }
  }
  // Timed affix actions wait for the spawn grace (the Warden is still emerging).
  if (e.ageTicks[s]! < ctx.cfg.spawnGraceTicks) return;
  if (tick(ctx, s, af.blinking)) startBlink(ctx, s, af.blinking);
  if (tick(ctx, s, af.brood)) brood(ctx, s, af.brood);
  if (tick(ctx, s, af.pulsing)) pulse(ctx, s, af.pulsing);
  if (tick(ctx, s, af.tar_trail)) tar(ctx, s, af.tar_trail);
}

/** Count down the timer of affix a on slot s; true (and restarted) when it fires. */
function tick(ctx: SimCtx, s: number, a: number): boolean {
  if (!hasAffix(ctx, s, a)) return false;
  const def = ctx.data.affixes[a];
  if (def === undefined) return false;
  const every = sec(pnum(def.params, a === ctx.sd.affix.tar_trail ? 'drop_every' : 'interval', 0));
  if (every <= 0) return false;
  const i = timerAt(s, a);
  const e = ctx.world.enemies;
  e.affixTimer[i] = e.affixTimer[i]! - 1;
  if (e.affixTimer[i] > 0) return false;
  e.affixTimer[i] = every;
  return true;
}

/** blinking: pick a point min_dist from the player (random direction, ai stream), telegraph it. */
function startBlink(ctx: SimCtx, s: number, a: number): void {
  const def = ctx.data.affixes[a];
  const e = ctx.world.enemies;
  if (def === undefined || e.blinkTicks[s]! > 0) return;
  const minDist = pnum(def.params, 'min_dist', 0);
  if (minDist <= 0) return;
  const p = ctx.world.player;
  const t = ctx.rng.ai.next();
  let x = p.x + cosTurns(t) * minDist;
  let y = p.y + sinTurns(t) * minDist;
  if (ctx.arena !== null) {
    clampInside(ctx.arena, x, y, e.radius[s]!, tmp);
    x = tmp.x;
    y = tmp.y;
  }
  // The destination telegraph is visual (no damage); its time is the affix telegraph_s.
  const ticks = Math.max(1, def.telegraphTicks);
  spawnDanger(
    ctx,
    DangerMode.Visual,
    AreaShape.Circle,
    TelegraphKind.Area,
    x,
    y,
    e.radius[s]!,
    ticks,
    0,
    encodeSource(SourceKind.Affix, a),
    -1,
  );
  e.blinkX[s] = x;
  e.blinkY[s] = y;
  e.blinkTicks[s] = ticks;
}

/** brood: count summons of summon_id next to the Warden, each with its spawn mark (GDD 15.2). */
function brood(ctx: SimCtx, s: number, a: number): void {
  const def = ctx.data.affixes[a];
  if (def === undefined) return;
  const count = Math.floor(pnum(def.params, 'count', 0));
  const type = enemyTypeById(ctx, pstr(def.params, 'summon_id', ''));
  if (count <= 0 || type < 0) return;
  summonAround(ctx, s, type, count);
  const e = ctx.world.enemies;
  ctx.events.push(SimEventType.AffixTriggered, e.x[s]!, e.y[s]!, a, AffixAction.Brood, count);
}

/** pulsing: growing ring telegraph on the Warden, then a shockwave of radius (Strike, follows it). */
function pulse(ctx: SimCtx, s: number, a: number): void {
  const def = ctx.data.affixes[a];
  if (def === undefined) return;
  const r = pnum(def.params, 'radius', 0);
  const dmg = pnum(def.params, 'dmg', 0) * ctx.world.enemies.dmgScale[s]!;
  if (r <= 0 || dmg <= 0) return;
  const e = ctx.world.enemies;
  spawnDanger(
    ctx,
    DangerMode.Strike,
    AreaShape.Circle,
    TelegraphKind.Area,
    e.x[s]!,
    e.y[s]!,
    r,
    teleTicks(ctx, TeleMin.Area, def.telegraphTicks),
    dmg,
    encodeSource(SourceKind.Affix, a),
    s,
  );
  ctx.events.push(SimEventType.AffixTriggered, e.x[s]!, e.y[s]!, a, AffixAction.Pulse, 0);
}

/** tar_trail: a dark puddle that slows the player, visible from the moment it appears (no damage). */
function tar(ctx: SimCtx, s: number, a: number): void {
  const def = ctx.data.affixes[a];
  if (def === undefined) return;
  const r = pnum(def.params, 'radius', 0);
  const ticks = sec(pnum(def.params, 'duration', 0));
  const slow = pnum(def.params, 'slow', 0);
  if (r <= 0 || ticks <= 0 || slow <= 0) return;
  const e = ctx.world.enemies;
  const z = spawnDanger(
    ctx,
    DangerMode.Tar,
    AreaShape.Circle,
    TelegraphKind.Area,
    e.x[s]!,
    e.y[s]!,
    r,
    ticks,
    0,
    encodeSource(SourceKind.Affix, a),
    -1,
    true,
  );
  if (z >= 0) ctx.world.dangerAreas.slowPct[z] = slow;
  ctx.events.push(SimEventType.AffixTriggered, e.x[s]!, e.y[s]!, a, AffixAction.Tar, 0);
}
