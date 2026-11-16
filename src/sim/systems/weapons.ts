/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Automatic weapon attacks per archetype (GDD 6, 6.2, 6.3). Cooldown counts down, then the weapon
// waits until an Unlit is in range (never fires into the air). Copies aim independently.

import {
  HitKind,
  SimEventType,
  SourceKind,
  TAU,
  TICK_RATE,
  atan2Turns,
  cosTurns,
  encodeSource,
  sinTurns,
} from '../../core/index.ts';
import { WEAPON_MAX_TIER } from '../capacity.ts';
import { Archetype, Pending, ShotMode, Status } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { statOf } from '../ctx.ts';
import { allocSlot, freeSlot } from '../pools.ts';
import { pnum, pstr } from '../sim-data.ts';
import type { WeaponSim, WeaponTierSim } from '../sim-data.ts';
import { applyHit, areaDamage, beginHit, canDamage, endHit, nearestEnemy } from './combat.ts';
import { areaScale, fanAngle, resetShotSpec, spawnPlayerShot } from './projectiles.ts';
import type { ShotSpec } from './projectiles.ts';

/** Cooldown in ticks (GDD 5.2): base x tier cd mult / (1 + attack_speed_pct / 100), at least 1 tick. */
export function weaponCooldown(ctx: SimCtx, t: WeaponTierSim): number {
  const as = statOf(ctx, ctx.sd.stat.attack_speed_pct, 0);
  return Math.max(1, Math.round((t.cooldownTicks * t.cdMult) / (1 + as / 100)));
}

function rangeOf(ctx: SimCtx, w: WeaponSim, t: WeaponTierSim): number {
  const pct = statOf(ctx, ctx.sd.stat.range_pct, 0);
  // Melee arc: range_pct has half effect (GDD 5.2).
  const eff = w.archetype === Archetype.Arc ? pct * 0.5 : pct;
  return t.rangeU * (1 + eff / 100);
}

function usesProjectileStats(a: number): boolean {
  return (
    a === Archetype.Projectile ||
    a === Archetype.BoltExplode ||
    a === Archetype.Boomerang ||
    a === Archetype.Coin
  );
}

function specOf(ctx: SimCtx): ShotSpec {
  return ctx.shot;
}

/** Fire weapon in slot once at power (1 = normal). Returns true when it attacked. */
export function fireWeapon(ctx: SimCtx, slot: number, power: number): boolean {
  const { world, sd, run } = ctx;
  const wi = run.weaponIndex[slot]!;
  if (wi < 0) return false;
  const w = sd.weapons[wi];
  if (w === undefined) return false;
  const tier = Math.min(WEAPON_MAX_TIER, Math.max(1, run.weaponTier[slot]!));
  const t = w.tiers[tier - 1];
  if (t === undefined) return false;
  if (w.archetype === Archetype.Orbit) return false;
  const p = world.player;
  const range = rangeOf(ctx, w, t);
  const target = nearestEnemy(ctx, p.x, p.y, range, -1);
  if (target < 0) return false;
  const e = world.enemies;
  const tx = e.x[target]!;
  const ty = e.y[target]!;
  const aim = atan2Turns(ty - p.y, tx - p.x);
  p.facing = tx < p.x ? -1 : 1;
  const dmg = t.dmg * t.dmgMult * power;
  const src = encodeSource(SourceKind.Weapon, wi);
  const shots = run.weaponShots[slot]! + 1;
  run.weaponShots[slot] = shots;
  let count = t.count;
  if (usesProjectileStats(w.archetype)) count += Math.floor(statOf(ctx, sd.stat.projectiles, 0));
  const spread = ctx.cfg.extraProjectileSpreadTurns;
  const s = specOf(ctx);

  switch (w.archetype) {
    case Archetype.Projectile:
    case Archetype.Coin:
    case Archetype.BoltExplode:
    case Archetype.Boomerang: {
      const fanN = Math.floor(pnum(t.p, 'fan_every_n', 0));
      if (fanN > 0 && shots % fanN === 0)
        count = Math.max(count, Math.floor(pnum(t.p, 'fan_count', count)));
      const blades =
        w.archetype === Archetype.Boomerang ? Math.max(1, Math.floor(pnum(t.p, 'blades', 1))) : 1;
      for (let b = 0; b < blades; b++) {
        const baseAim = aim + b / blades;
        for (let k = 0; k < count; k++) {
          const a = fanAngle(baseAim, k, count, spread);
          resetShotSpec(s);
          s.x = p.x;
          s.y = p.y;
          s.vx = cosTurns(a) * t.speedUPerTick;
          s.vy = sinTurns(a) * t.speedUPerTick;
          s.radius = t.projRadiusU;
          s.dmg = dmg;
          s.tagMask = w.tagMask;
          s.hitKind = w.hitKind;
          s.range = range;
          s.weaponIndex = wi;
          s.weaponSlot = slot;
          s.tier = tier;
          s.knockback = t.knockbackU;
          s.sourceRef = src;
          if (w.archetype === Archetype.BoltExplode) {
            s.mode = ShotMode.Bolt;
            s.dmg2 = t.dmg2 * t.dmgMult * power;
            s.areaRadius = t.radiusU * areaScale(ctx);
            s.status = pstr(t.p, 'explode_status', '') === 'burn' ? Status.Burn : -1;
            s.zoneRadius = pnum(t.p, 'fire_zone_radius', 0) * areaScale(ctx);
            s.zoneTicks = Math.round(pnum(t.p, 'fire_zone_s', 0) * TICK_RATE);
          } else if (w.archetype === Archetype.Boomerang) {
            s.mode = ShotMode.Boomerang;
            s.pierce = t.pierce;
          } else {
            s.pierce = t.pierce + Math.floor(statOf(ctx, sd.stat.pierce, 0));
            if (w.archetype === Archetype.Coin) s.bounce = Math.floor(pnum(t.p, 'bounce', 0));
          }
          spawnPlayerShot(ctx, s);
        }
      }
      break;
    }
    case Archetype.Arc: {
      const spinN = Math.floor(pnum(t.p, 'spin_every_n', 0));
      const full = spinN > 0 && shots % spinN === 0;
      const halfArc = full
        ? 0.5
        : ((pnum(t.p, 'arc_deg', 0) + pnum(t.p, 'arc_deg_add', 0)) / 360) * 0.5;
      const radius = (t.radiusU > 0 ? t.radiusU : range) * areaScale(ctx);
      sweep(ctx, p.x, p.y, radius, aim, halfArc, dmg, src, w, wi, slot, t.knockbackU);
      break;
    }
    case Archetype.Chain:
      chain(ctx, target, dmg, src, w, wi, slot, t);
      break;
    case Archetype.RingEcho: {
      const radius = t.radiusU * areaScale(ctx);
      areaDamage(
        ctx,
        p.x,
        p.y,
        radius,
        dmg,
        src,
        w.tagMask,
        w.hitKind,
        0,
        false,
        -1,
        t.knockbackU,
        wi,
        slot,
      );
      const echoes = Math.floor(pnum(t.p, 'echo_count', 0) + pnum(t.p, 'echo_count_add', 0));
      const delay = Math.round(pnum(t.p, 'echo_delay', 0) * TICK_RATE);
      const frac = pnum(t.p, 'echo_frac', 0);
      for (let k = 1; k <= echoes; k++) {
        queueWeaponEcho(ctx, slot, delay * k, dmg * frac, radius, src, w.tagMask);
      }
      break;
    }
    default:
      break;
  }
  ctx.events.push(SimEventType.WeaponFired, p.x, p.y, wi, count, slot);
  return true;
}

function queueWeaponEcho(
  ctx: SimCtx,
  slot: number,
  delayTicks: number,
  dmg: number,
  radius: number,
  src: number,
  tagMask: number,
): void {
  const pd = ctx.pending;
  const i = allocSlot(pd);
  if (i < 0) {
    ctx.poolOverflow++;
    return;
  }
  pd.kind[i] = Pending.WeaponEcho;
  pd.dueTick[i] = ctx.world.tick + Math.max(1, delayTicks);
  pd.seq[i] = ctx.run.pendingSeq++;
  pd.effect[i] = -1;
  pd.dmg[i] = dmg;
  pd.power[i] = radius;
  pd.procDepth[i] = 0;
  pd.tagMask[i] = tagMask;
  pd.target[i] = -1;
  pd.sourceRef[i] = src;
  pd.weaponSlot[i] = slot;
  pd.x[i] = ctx.world.player.x;
  pd.y[i] = ctx.world.player.y;
}

function hitTarget(
  ctx: SimCtx,
  target: number,
  dmg: number,
  src: number,
  w: WeaponSim,
  wi: number,
  slot: number,
  hitKind: number,
  knockback: number,
  status: number,
  statusChance: number,
): void {
  const h = beginHit(ctx);
  if (h === null) return;
  h.target = target;
  h.base = dmg;
  h.sourceRef = src;
  h.tagMask = w.tagMask;
  h.hitKind = hitKind;
  h.weaponIndex = wi;
  h.weaponSlot = slot;
  h.knockback = knockback;
  h.status = status;
  h.statusChance = statusChance;
  applyHit(ctx);
  endHit(ctx);
}

/** Melee sweep: every enemy within radius and within halfArc turns of the aim direction. */
function sweep(
  ctx: SimCtx,
  x: number,
  y: number,
  radius: number,
  aim: number,
  halfArc: number,
  dmg: number,
  src: number,
  w: WeaponSim,
  wi: number,
  slot: number,
  knockback: number,
): void {
  const e = ctx.world.enemies;
  const buf = ctx.queryBufs[ctx.hitDepth + 1];
  if (ctx.grid === null || buf === undefined) return;
  const n = ctx.grid.query(x, y, radius + ctx.cfg.enemyRadiusBossU, buf);
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    if (!canDamage(ctx, s)) continue;
    const dx = e.x[s]! - x;
    const dy = e.y[s]! - y;
    const rr = radius + e.radius[s]!;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (halfArc < 0.5) {
      let a = atan2Turns(dy, dx) - aim;
      a -= Math.floor(a + 0.5);
      if (Math.abs(a) > halfArc) continue;
    }
    hitTarget(ctx, s, dmg, src, w, wi, slot, w.hitKind, knockback, -1, 0);
  }
}

/** Chain Spark: jumps to the nearest enemy not hit yet (tier IV may return to the first). */
function chain(
  ctx: SimCtx,
  first: number,
  dmg: number,
  src: number,
  w: WeaponSim,
  wi: number,
  slot: number,
  t: WeaponTierSim,
): void {
  const e = ctx.world.enemies;
  const jumps = Math.floor(pnum(t.p, 'jumps', 0) + pnum(t.p, 'jumps_add', 0));
  const jumpRange = pnum(t.p, 'jump_range', 0);
  const burnChance = pnum(t.p, 'burn_chance', 0);
  const allowReturn = pnum(t.p, 'allow_return', 0) > 0;
  const hit = ctx.scratch;
  let nHit = 0;
  let cur = first;
  for (let j = 0; j <= jumps && cur >= 0; j++) {
    const cx = e.x[cur]!;
    const cy = e.y[cur]!;
    hit[nHit++] = cur;
    hitTarget(
      ctx,
      cur,
      dmg,
      src,
      w,
      wi,
      slot,
      HitKind.Chain,
      0,
      burnChance > 0 ? Status.Burn : -1,
      burnChance,
    );
    // Next: nearest damageable not yet hit (or the first target again when allowed and not just hit).
    let best = -1;
    let bestD = jumpRange * jumpRange;
    for (let s = 0; s < e.highWater; s++) {
      if (!canDamage(ctx, s) || s === cur) continue;
      let seen = false;
      for (let k = 0; k < nHit; k++) if (hit[k] === s && !(allowReturn && s === first)) seen = true;
      if (seen) continue;
      const dx = e.x[s]! - cx;
      const dy = e.y[s]! - cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    cur = best;
  }
}

/**
 * Orbit tier IV lunge (GDD 6.2): every lunge_every_s the shards fly lunge_dist out and back. The
 * out-and-back takes lunge_s when given, else the time the shards need at their own orbit speed
 * (2 pi r / rev_s), so no duration is invented in code. Returns the radius offset this tick.
 */
function lungeOffset(
  ctx: SimCtx,
  slot: number,
  t: WeaponTierSim,
  radius: number,
  revTicks: number,
  wi: number,
  count: number,
): number {
  const run = ctx.run;
  const every = Math.round(pnum(t.p, 'lunge_every_s', 0) * TICK_RATE);
  const dist = pnum(t.p, 'lunge_dist', 0);
  if (every <= 0 || dist <= 0) return 0;
  let secs = pnum(t.p, 'lunge_s', 0);
  if (secs <= 0 && revTicks > 0 && radius > 0) {
    const orbitSpeed = (TAU * radius) / (revTicks / TICK_RATE);
    secs = (2 * dist) / orbitSpeed;
  }
  const total = Math.round(secs * TICK_RATE);
  if (total <= 0) return 0;
  if (run.lungeTicks[slot]! > 0) {
    run.lungeTicks[slot] = run.lungeTicks[slot]! - 1;
    const u = 1 - run.lungeTicks[slot] / total;
    return dist * (1 - Math.abs(2 * u - 1));
  }
  run.lungeTimer[slot] = run.lungeTimer[slot]! + 1;
  if (run.lungeTimer[slot] >= every) {
    run.lungeTimer[slot] = 0;
    run.lungeTicks[slot] = total;
    const p = ctx.world.player;
    ctx.events.push(SimEventType.WeaponFired, p.x, p.y, wi, count, slot);
  }
  return 0;
}

/** Orbit shards: keep `count` shards around the player per orbit weapon; contact hits with re-hit timers. */
export function updateOrbits(ctx: SimCtx): void {
  const { world, sd, run } = ctx;
  const ps = world.playerShots;
  const e = world.enemies;
  const p = world.player;
  const slots = run.weaponIndex.length;
  for (let slot = 0; slot < slots; slot++) {
    const wi = run.weaponIndex[slot]!;
    const w = wi >= 0 ? sd.weapons[wi] : undefined;
    if (w?.archetype !== Archetype.Orbit) continue;
    const tier = Math.min(WEAPON_MAX_TIER, Math.max(1, run.weaponTier[slot]!));
    const t = w.tiers[tier - 1];
    if (t === undefined) continue;
    const count = Math.max(0, Math.floor(t.count));
    // rev_s missing: the shards stay still around the player (no number in code, LP review M1).
    const revTicks = Math.round(pnum(t.p, 'rev_s', 0) * TICK_RATE);
    const baseRadius = t.radiusU * areaScale(ctx);
    const rehit = weaponCooldown(ctx, t);
    const dmg = t.dmg * t.dmgMult;
    const src = encodeSource(SourceKind.Weapon, wi);
    let base = 0;
    if (revTicks > 0) {
      run.weaponTimer[slot] = (run.weaponTimer[slot]! + 1) % revTicks;
      base = run.weaponTimer[slot]! / revTicks;
    }
    const radius = baseRadius + lungeOffset(ctx, slot, t, baseRadius, revTicks, wi, count);
    let k = 0;
    for (let i = 0; i < ps.highWater; i++) {
      if (ps.alive[i] === 0 || ps.mode[i] !== ShotMode.Orbit || ps.weaponSlot[i] !== slot) continue;
      if (k >= count) {
        freeSlot(ps, i);
        continue;
      }
      const a = base + k / count;
      ps.prevX[i] = ps.x[i]!;
      ps.prevY[i] = ps.y[i]!;
      ps.x[i] = p.x + cosTurns(a) * radius;
      ps.y[i] = p.y + sinTurns(a) * radius;
      ps.vx[i] = ps.x[i]! - ps.prevX[i]!;
      ps.vy[i] = ps.y[i]! - ps.prevY[i]!;
      k++;
      // Contact hits.
      for (let s = 0; s < e.highWater; s++) {
        if (!canDamage(ctx, s)) continue;
        const ti = s * slots + slot;
        if (e.orbitTimer[ti]! > world.tick) continue;
        const dx = e.x[s]! - ps.x[i]!;
        const dy = e.y[s]! - ps.y[i]!;
        const rr = ps.radius[i]! + e.radius[s]!;
        if (dx * dx + dy * dy > rr * rr) continue;
        e.orbitTimer[ti] = world.tick + rehit;
        hitTarget(ctx, s, dmg, src, w, wi, slot, w.hitKind, t.knockbackU, -1, 0);
      }
    }
    // Spawn missing shards.
    const s = specOf(ctx);
    for (; k < count; k++) {
      resetShotSpec(s);
      s.x = p.x;
      s.y = p.y;
      s.radius = t.projRadiusU;
      s.mode = ShotMode.Orbit;
      s.dmg = dmg;
      s.tagMask = w.tagMask;
      s.hitKind = w.hitKind;
      s.weaponIndex = wi;
      s.weaponSlot = slot;
      s.tier = tier;
      s.sourceRef = src;
      s.phase = k;
      spawnPlayerShot(ctx, s);
    }
  }
}

/** Cooldowns and firing for every weapon slot. Once per tick in the pulse phase. */
export function updateWeapons(ctx: SimCtx): void {
  const run = ctx.run;
  for (let slot = 0; slot < run.weaponIndex.length; slot++) {
    const wi = run.weaponIndex[slot]!;
    if (wi < 0) continue;
    if (run.weaponCd[slot]! > 0) {
      run.weaponCd[slot] = run.weaponCd[slot]! - 1;
      continue;
    }
    if (fireWeapon(ctx, slot, 1)) {
      const w = ctx.sd.weapons[wi];
      const t = w?.tiers[Math.min(WEAPON_MAX_TIER, Math.max(1, run.weaponTier[slot]!)) - 1];
      if (t !== undefined) run.weaponCd[slot] = weaponCooldown(ctx, t);
    }
  }
  updateOrbits(ctx);
}

/** Process due weapon echoes (ring_echo). Other pending kinds are handled by the effect engine. */
export function runWeaponEcho(ctx: SimCtx, i: number): void {
  const pd = ctx.pending;
  const slot = pd.weaponSlot[i]!;
  const wi = ctx.run.weaponIndex[slot]!;
  const w = wi >= 0 ? ctx.sd.weapons[wi] : undefined;
  if (w === undefined) return;
  const p = ctx.world.player;
  areaDamage(
    ctx,
    p.x,
    p.y,
    pd.power[i]!,
    pd.dmg[i]!,
    pd.sourceRef[i]!,
    pd.tagMask[i]!,
    w.hitKind,
    pd.procDepth[i]!,
    false,
    -1,
    0,
    wi,
    slot,
  );
}
