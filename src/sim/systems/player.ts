// Player: movement with vertical screen compensation (architecture 7.1), regen, Barrier recharge,
// invulnerability timers, Rite charges and casting (GDD 7.1). Numbers from config.csv, stats, rites.csv.

import {
  Button,
  DEPTH_PX_PER_U,
  HitKind,
  INPUT_AXIS_MAX,
  PX_PER_U,
  SimEventType,
  SourceKind,
  TICK_RATE,
  encodeSource,
} from '../../core/index.ts';
import type { InputFrame } from '../../core/index.ts';
import { clampInside, insideDistance } from '../arena.ts';
import type { Point } from '../arena.ts';
import { AIM_UNITS_PER_U, EDGE_INSET_U } from '../capacity.ts';
import { ShotMode, Status } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { statOf } from '../ctx.ts';
import { pnum, pstr } from '../sim-data.ts';
import { applyHit, applySlow, areaDamage, beginHit, canDamage, endHit } from './combat.ts';
import { areaScale, resetShotSpec, spawnPlayerShot } from './projectiles.ts';

const tmp: Point = { x: 0, y: 0 };

/** Movement speed in u/tick: config base x (1 + move_speed / 100). */
export function moveSpeed(ctx: SimCtx): number {
  return ctx.cfg.playerBaseSpeedUPerTick * (1 + statOf(ctx, ctx.sd.stat.move_speed, 0) / 100);
}

/**
 * Screen-direction input to floor velocity (architecture 7.1): k = 1 / sqrt(dx^2 + (dy / r)^2),
 * vx = dx k S, vy = dy k S (PX_PER_U / DEPTH_PX_PER_U). Analog magnitude below 1 scales the speed.
 */
export function inputVelocity(ctx: SimCtx, input: InputFrame, out: Point): void {
  const mx = input.moveX / INPUT_AXIS_MAX;
  const my = input.moveY / INPUT_AXIS_MAX;
  const len = Math.sqrt(mx * mx + my * my);
  if (len === 0) {
    out.x = 0;
    out.y = 0;
    return;
  }
  const mag = len > 1 ? 1 : len;
  const dx = mx / len;
  const dy = my / len;
  const r = ctx.cfg.playerVerticalScreenRatio;
  const k = 1 / Math.sqrt(dx * dx + (dy / r) * (dy / r));
  const speed = moveSpeed(ctx) * mag;
  out.x = dx * k * speed;
  out.y = dy * k * speed * (PX_PER_U / DEPTH_PX_PER_U);
}

/** Walk, clamp to the boundary, accumulate floor distance for on_distance. Returns distance moved. */
export function movePlayer(ctx: SimCtx, input: InputFrame): number {
  const p = ctx.world.player;
  inputVelocity(ctx, input, tmp);
  const ox = p.x;
  const oy = p.y;
  let nx = p.x + tmp.x;
  let ny = p.y + tmp.y;
  if (input.moveX !== 0) p.facing = input.moveX < 0 ? -1 : 1;
  if (ctx.arena !== null) {
    clampInside(ctx.arena, nx, ny, p.radius, tmp);
    nx = tmp.x;
    ny = tmp.y;
  }
  p.x = nx;
  p.y = ny;
  const dx = nx - ox;
  const dy = ny - oy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Regen, Barrier recharge, invulnerability, Glass Step crit window. Once per pulse tick. */
export function updatePlayerTimers(ctx: SimCtx): void {
  const { world, sd, run } = ctx;
  const p = world.player;
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.hitFlashTicks > 0) p.hitFlashTicks--;
  const regen = statOf(ctx, sd.stat.hp_regen, 0);
  if (regen > 0 && p.hp > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regen / TICK_RATE);
  // Barrier recharge: barrier_recharge seconds per charge while below max (0 = never).
  const recharge = statOf(ctx, sd.stat.barrier_recharge, 0);
  if (recharge > 0 && p.barrier < p.barrierMax) {
    run.barrierTimer++;
    if (run.barrierTimer >= Math.round(recharge * TICK_RATE)) {
      run.barrierTimer = 0;
      p.barrier++;
      ctx.events.push(SimEventType.BarrierGained, p.x, p.y, p.barrier, 0, 0);
    }
  } else {
    run.barrierTimer = 0;
  }
  if (run.critForcedTicks > 0) {
    run.critForcedTicks--;
    if (run.critForcedTicks === 0) run.critForcedHits = 0;
  }
  // Rite recharge: one charge at a time while below max.
  if (p.riteCharges < p.riteChargesMax) {
    if (p.riteCooldownTicks > 0) p.riteCooldownTicks--;
    if (p.riteCooldownTicks <= 0) {
      p.riteCharges++;
      ctx.events.push(SimEventType.RiteReady, p.x, p.y, p.riteIndex, 0, 0);
      if (p.riteCharges < p.riteChargesMax) p.riteCooldownTicks = p.riteCooldownMaxTicks;
    }
  } else {
    p.riteCooldownTicks = 0;
  }
}

/** Rite cooldown in ticks: cooldown x (1 - rite_haste / 100). */
export function riteCooldown(ctx: SimCtx): number {
  const rite = ctx.data.rites[ctx.world.player.riteIndex];
  if (rite === undefined) return 0;
  return Math.max(
    1,
    Math.round(rite.cooldownTicks * (1 - statOf(ctx, ctx.sd.stat.rite_haste, 0) / 100)),
  );
}

/** Rite input: cast on press when a charge is ready, else RiteRejected (GDD 7.1). */
export function handleRiteInput(ctx: SimCtx, input: InputFrame): void {
  if ((input.pressed & Button.Rite) === 0) return;
  const p = ctx.world.player;
  if (p.riteCharges < 1 || ctx.data.rites[p.riteIndex] === undefined) {
    ctx.events.push(SimEventType.RiteRejected, p.x, p.y, p.riteIndex, 0, 0);
    return;
  }
  const wasFull = p.riteCharges >= p.riteChargesMax;
  p.riteCharges--;
  if (wasFull) p.riteCooldownTicks = p.riteCooldownMaxTicks;
  castRite(ctx, input.aimX / AIM_UNITS_PER_U, input.aimY / AIM_UNITS_PER_U, 1, false);
}

/**
 * Cast the class Rite at an aim point with a power multiplier. repeat: Echo 4 re-cast (proc depth 1,
 * does not raise on_rite again).
 */
export function castRite(
  ctx: SimCtx,
  aimX: number,
  aimY: number,
  power: number,
  repeat: boolean,
): void {
  const { world } = ctx;
  const p = world.player;
  const rite = ctx.data.rites[p.riteIndex];
  if (rite === undefined) return;
  const prm = rite.params;
  const src = encodeSource(SourceKind.Rite, p.riteIndex);
  const dmg = rite.dmg * ctx.run.procScale * power;
  const depth = repeat ? 1 : 0;
  // rites.csv has no tags column: Rite hits carry no tag [Asumsi].
  const tagMask = 0;
  let ax = aimX;
  let ay = aimY;
  switch (rite.archetype) {
    case 'throw_zone': {
      // Clamp to max_range from the player and EDGE_INSET_U inside the boundary.
      const maxR = pnum(prm, 'max_range', 0);
      let dx = ax - p.x;
      let dy = ay - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (maxR > 0 && d > maxR) {
        dx = (dx / d) * maxR;
        dy = (dy / d) * maxR;
      }
      ax = p.x + dx;
      ay = p.y + dy;
      if (ctx.arena !== null) {
        clampInside(ctx.arena, ax, ay, EDGE_INSET_U, tmp);
        ax = tmp.x;
        ay = tmp.y;
      }
      const s = ctx.shot;
      resetShotSpec(s);
      s.x = p.x;
      s.y = p.y;
      s.mode = ShotMode.Lob;
      s.timer = Math.max(1, Math.round(pnum(prm, 'flight_s', 0) * TICK_RATE));
      s.targetX = ax;
      s.targetY = ay;
      s.radius = 0;
      s.dmg2 = dmg;
      s.areaRadius = rite.radiusU * areaScale(ctx);
      s.tagMask = tagMask;
      s.hitKind = HitKind.Area;
      s.procDepth = depth;
      s.isRite = true;
      s.sourceRef = src;
      s.status = pstr(prm, 'status', '') === 'burn' ? Status.Burn : -1;
      s.zoneRadius = pnum(prm, 'zone_radius', 0) * areaScale(ctx);
      s.zoneTicks = Math.round(pnum(prm, 'zone_s', 0) * TICK_RATE);
      s.zoneSlow = pnum(prm, 'slow', 0);
      s.zoneTick = Math.round(pnum(prm, 'zone_tick', 0) * TICK_RATE);
      spawnPlayerShot(ctx, s);
      break;
    }
    case 'ring': {
      const r = rite.radiusU * areaScale(ctx);
      areaDamage(
        ctx,
        p.x,
        p.y,
        r,
        dmg,
        src,
        tagMask,
        HitKind.Area,
        depth,
        true,
        -1,
        pnum(prm, 'knockback', 0),
        -1,
        -1,
      );
      const slow = pnum(prm, 'slow', 0) / 100;
      const slowTicks = Math.round(pnum(prm, 'slow_s', 0) * TICK_RATE);
      if (slow > 0) {
        const e = world.enemies;
        for (let s = 0; s < e.highWater; s++) {
          if (!canDamage(ctx, s)) continue;
          const dx = (e.x[s] ?? 0) - p.x;
          const dy = (e.y[s] ?? 0) - p.y;
          const rr = r + (e.radius[s] ?? 0);
          if (dx * dx + dy * dy <= rr * rr) applySlow(ctx, s, slow, slowTicks);
        }
      }
      break;
    }
    case 'dash': {
      dash(ctx, ax, ay, dmg, src, tagMask, depth, rite.radiusU);
      break;
    }
    default:
      break;
  }
  ctx.events.push(SimEventType.RiteCast, ax, ay, p.riteIndex, 0, 0);
  if (!repeat) ctx.fx.onRite(ctx, ax, ay);
}

/** Glass Step: dash toward the aim with the movement compensation, damage each Unlit passed once. */
function dash(
  ctx: SimCtx,
  aimX: number,
  aimY: number,
  dmg: number,
  src: number,
  tagMask: number,
  depth: number,
  halfWidth: number,
): void {
  const { world, run } = ctx;
  const p = world.player;
  const rite = ctx.data.rites[p.riteIndex];
  if (rite === undefined) return;
  const prm = rite.params;
  let dx = aimX - p.x;
  let dy = aimY - p.y;
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) {
    dx = p.facing;
    dy = 0;
    d = 1;
  }
  dx /= d;
  dy /= d;
  // Same ellipse as walking: screen-equal distance (architecture 7.1).
  const r = ctx.cfg.playerVerticalScreenRatio;
  const k = 1 / Math.sqrt(dx * dx + (dy / r) * (dy / r));
  const dist = pnum(prm, 'dash_dist', 0);
  const sx = p.x;
  const sy = p.y;
  let ex = p.x + dx * k * dist;
  let ey = p.y + dy * k * dist * (PX_PER_U / DEPTH_PX_PER_U);
  if (ctx.arena !== null && insideDistance(ctx.arena, ex, ey) < p.radius) {
    clampInside(ctx.arena, ex, ey, p.radius, tmp);
    ex = tmp.x;
    ey = tmp.y;
  }
  p.x = ex;
  p.y = ey;
  p.invulnTicks = Math.max(p.invulnTicks, Math.round(pnum(prm, 'iframes_s', 0) * TICK_RATE));
  run.critForcedHits = Math.floor(pnum(prm, 'crit_hits', 0));
  run.critForcedTicks = Math.round(pnum(prm, 'crit_window_s', 0) * TICK_RATE);
  // Damage once per Unlit within half width of the dash segment.
  const e = world.enemies;
  const vx = ex - sx;
  const vy = ey - sy;
  const len2 = vx * vx + vy * vy;
  for (let s = 0; s < e.highWater; s++) {
    if (!canDamage(ctx, s)) continue;
    const px = (e.x[s] ?? 0) - sx;
    const py = (e.y[s] ?? 0) - sy;
    let t = len2 > 0 ? (px * vx + py * vy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = px - vx * t;
    const qy = py - vy * t;
    const rr = halfWidth + (e.radius[s] ?? 0);
    if (qx * qx + qy * qy > rr * rr) continue;
    const h = beginHit(ctx);
    if (h === null) break;
    h.target = s;
    h.base = dmg;
    h.sourceRef = src;
    h.tagMask = tagMask;
    h.hitKind = HitKind.Melee;
    h.procDepth = depth;
    h.isRite = true;
    applyHit(ctx);
    endHit(ctx);
  }
}
