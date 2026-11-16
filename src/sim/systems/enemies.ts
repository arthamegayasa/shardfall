/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Unlit AI (GDD 14.2, 14.3, 15.1): chase, charger, shooter, Warden hound; separation, boundary clamp,
// contact damage. Every number comes from enemies.csv (columns and params) and affixes.csv.

import {
  AreaShape,
  SimEventType,
  SourceKind,
  TICK_RATE,
  TelegraphKind,
  encodeSource,
} from '../../core/index.ts';
import { clampInside } from '../arena.ts';
import type { Point } from '../arena.ts';
import { SEPARATION_NEIGHBOURS } from '../capacity.ts';
import { AiState, Behavior, DangerMode } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { pnum } from '../sim-data.ts';
import { damagePlayer } from './combat.ts';
import { spawnDanger } from './areas.ts';
import { spawnEnemyShot } from './enemy-shots.ts';

const tmp: Point = { x: 0, y: 0 };

const sec = (s: number): number => Math.round(s * TICK_RATE);
const perTick = (uPerSec: number): number => uPerSec / TICK_RATE;

function moveToward(
  ctx: SimCtx,
  s: number,
  tx: number,
  ty: number,
  speed: number,
  away: boolean,
): void {
  const e = ctx.world.enemies;
  let dx = tx - e.x[s]!;
  let dy = ty - e.y[s]!;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return;
  dx /= d;
  dy /= d;
  const k = away ? -speed : Math.min(speed, d);
  e.x[s] = e.x[s]! + dx * k;
  e.y[s] = e.y[s]! + dy * k;
}

function setState(ctx: SimCtx, s: number, st: number, ticks: number): void {
  const e = ctx.world.enemies;
  e.aiState[s] = st;
  e.aiStateTicks[s] = ticks;
}

/** Charge windup: lock direction to the player, show a charge line, then charge (GDD 14.2 charger). */
function startWindup(
  ctx: SimCtx,
  s: number,
  windupTicks: number,
  chargeLen: number,
  attackSrc: number,
): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  let dx = p.x - e.x[s]!;
  let dy = p.y - e.y[s]!;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0) {
    dx /= d;
    dy /= d;
  } else {
    dx = e.facing[s]!;
    dy = 0;
  }
  e.dirX[s] = dx;
  e.dirY[s] = dy;
  setState(ctx, s, AiState.Windup, Math.max(1, windupTicks));
  const a = spawnDanger(
    ctx,
    DangerMode.Visual,
    AreaShape.Line,
    TelegraphKind.Charge,
    e.x[s]!,
    e.y[s]!,
    0,
    Math.max(1, windupTicks),
    0,
    attackSrc,
    s,
  );
  if (a >= 0) {
    const da = ctx.world.dangerAreas;
    da.x2[a] = e.x[s]! + dx * chargeLen;
    da.y2[a] = e.y[s]! + dy * chargeLen;
    da.p0[a] = e.radius[s]!;
  }
}

function chargerTick(ctx: SimCtx, s: number, speed: number, isHound: boolean): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const type = e.typeIndex[s]!;
  const def = ctx.data.enemies[type];
  if (def === undefined) return;
  const prm = def.params;
  const trigger = pnum(prm, 'trigger_range', 0);
  const chargeSpeed = perTick(pnum(prm, 'charge_speed', 0));
  const chargeTicks = sec(pnum(prm, 'charge_s', 0));
  const recoverTicks = sec(pnum(prm, 'recover_s', 0));
  const cooldown = sec(pnum(prm, 'cooldown', 0));
  const charges = Math.max(1, Math.floor(pnum(prm, 'charges', 1)));
  const gapTicks = sec(pnum(prm, 'charge_gap_s', 0));
  const restTicks = sec(pnum(prm, 'rest_s', 0));
  const src = encodeSource(SourceKind.EnemyAttack, type);
  const canCharge = trigger > 0 && chargeSpeed > 0 && chargeTicks > 0;
  const st = e.aiState[s]!;
  if (st === AiState.Windup) {
    e.aiStateTicks[s] = e.aiStateTicks[s]! - 1;
    if (e.aiStateTicks[s] <= 0) {
      setState(ctx, s, AiState.Attack, chargeTicks);
      e.chargeHit[s] = 0;
    }
    return;
  }
  if (st === AiState.Attack) {
    e.x[s] = e.x[s]! + e.dirX[s]! * chargeSpeed;
    e.y[s] = e.y[s]! + e.dirY[s]! * chargeSpeed;
    e.aiStateTicks[s] = e.aiStateTicks[s]! - 1;
    if (e.aiStateTicks[s] <= 0) {
      const n = e.aiCounter[s]! + 1;
      e.aiCounter[s] = n;
      if (isHound && n < charges) {
        setState(ctx, s, AiState.Recover, gapTicks);
      } else {
        e.aiCounter[s] = 0;
        if (isHound) volley(ctx, s);
        setState(ctx, s, AiState.Recover, isHound ? restTicks : recoverTicks);
        e.aiTimer[s] = cooldown;
      }
    }
    return;
  }
  if (st === AiState.Recover) {
    e.aiStateTicks[s] = e.aiStateTicks[s]! - 1;
    if (e.aiStateTicks[s] <= 0) {
      if (isHound && e.aiCounter[s]! > 0) {
        startWindup(ctx, s, def.telegraphTicks, chargeSpeed * chargeTicks, src);
      } else {
        setState(ctx, s, AiState.Move, 0);
      }
    }
    return;
  }
  // Move: chase; start a charge when in trigger range and off cooldown.
  if (e.aiTimer[s]! > 0) e.aiTimer[s] = e.aiTimer[s]! - 1;
  moveToward(ctx, s, p.x, p.y, speed, false);
  if (!canCharge || e.aiTimer[s]! > 0 || e.ageTicks[s]! < ctx.cfg.spawnGraceTicks) return;
  const dx = p.x - e.x[s]!;
  const dy = p.y - e.y[s]!;
  if (dx * dx + dy * dy <= trigger * trigger) {
    startWindup(ctx, s, def.telegraphTicks, chargeSpeed * chargeTicks, src);
  }
}

/** Affix volley (GDD 15.2): ring of shots after each attack sequence. */
function volley(ctx: SimCtx, s: number): void {
  const e = ctx.world.enemies;
  const mask = e.affixMask[s]!;
  for (let a = 0; a < ctx.data.affixes.length && a < 31; a++) {
    if ((mask & (1 << a)) === 0) continue;
    const def = ctx.data.affixes[a];
    if (def?.id !== 'volley') continue;
    const count = Math.floor(pnum(def.params, 'count', 0));
    const speed = perTick(pnum(def.params, 'shot_speed', 0));
    const life = sec(pnum(def.params, 'shot_life', 0));
    const dmg = pnum(def.params, 'dmg', 0) * e.dmgScale[s]!;
    if (count <= 0 || speed <= 0 || life <= 0) continue;
    const src = encodeSource(SourceKind.Affix, a);
    // Ring telegraph first; the shots leave when it resolves (P2-e).
    const z = spawnDanger(
      ctx,
      DangerMode.Burst,
      AreaShape.Circle,
      TelegraphKind.Ring,
      e.x[s]!,
      e.y[s]!,
      e.radius[s]!,
      def.telegraphTicks,
      dmg,
      src,
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
}

function shooterTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const type = e.typeIndex[s]!;
  const def = ctx.data.enemies[type];
  if (def === undefined) return;
  const prm = def.params;
  const keepMin = pnum(prm, 'keep_min', 0);
  const keepMax = pnum(prm, 'keep_max', 0);
  const shotSpeed = perTick(pnum(prm, 'shot_speed', 0));
  const life = sec(pnum(prm, 'shot_life', 0));
  const cooldown = sec(pnum(prm, 'cooldown', 0));
  const src = encodeSource(SourceKind.EnemyAttack, type);
  const dx = p.x - e.x[s]!;
  const dy = p.y - e.y[s]!;
  const d2 = dx * dx + dy * dy;
  if (e.aiState[s] === AiState.Windup) {
    e.aiStateTicks[s] = e.aiStateTicks[s]! - 1;
    if (e.aiStateTicks[s] <= 0) {
      const d = Math.sqrt(d2);
      if (d > 0 && shotSpeed > 0 && life > 0) {
        spawnEnemyShot(
          ctx,
          e.x[s]!,
          e.y[s]!,
          (dx / d) * shotSpeed,
          (dy / d) * shotSpeed,
          def.attackDmg * e.dmgScale[s]!,
          life,
          src,
        );
        ctx.events.push(SimEventType.EnemyProjectileFired, e.x[s]!, e.y[s]!, type, 1, src);
      }
      e.aiTimer[s] = cooldown;
      setState(ctx, s, AiState.Move, 0);
    }
    return;
  }
  if (keepMax > 0 && d2 > keepMax * keepMax) moveToward(ctx, s, p.x, p.y, speed, false);
  else if (keepMin > 0 && d2 < keepMin * keepMin) moveToward(ctx, s, p.x, p.y, speed, true);
  else if (keepMax <= 0) moveToward(ctx, s, p.x, p.y, speed, false);
  if (e.aiTimer[s]! > 0) {
    e.aiTimer[s] = e.aiTimer[s]! - 1;
    return;
  }
  if (shotSpeed <= 0 || e.ageTicks[s]! < ctx.cfg.spawnGraceTicks) return;
  if (keepMax > 0 && d2 > keepMax * keepMax) return;
  setState(ctx, s, AiState.Windup, Math.max(1, def.telegraphTicks));
  spawnDanger(
    ctx,
    DangerMode.Visual,
    AreaShape.Circle,
    TelegraphKind.Projectile,
    e.x[s]!,
    e.y[s]!,
    e.radius[s]!,
    def.telegraphTicks,
    0,
    src,
    s,
  );
}

/** Soft separation between Unlit (architecture 8.3: at most 8 neighbours). */
function separate(ctx: SimCtx, s: number): void {
  const grid = ctx.grid;
  if (grid === null) return;
  const e = ctx.world.enemies;
  const buf = ctx.scratch;
  const r = e.radius[s]!;
  const n = grid.query(e.x[s]!, e.y[s]!, r * 2, buf);
  let used = 0;
  for (let k = 0; k < n && used < SEPARATION_NEIGHBOURS; k++) {
    const o = buf[k]!;
    if (o === s || e.alive[o] === 0) continue;
    const dx = e.x[s]! - e.x[o]!;
    const dy = e.y[s]! - e.y[o]!;
    const rr = r + e.radius[o]!;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    used++;
    const d = Math.sqrt(d2);
    // Bosses and Wardens are not pushed by small Unlit (they push through).
    if (e.rank[s]! < e.rank[o]!) continue;
    const push = (rr - d) * 0.5;
    if (d > 0) {
      e.x[s] = e.x[s]! + (dx / d) * push * 0.5;
      e.y[s] = e.y[s]! + (dy / d) * push * 0.5;
    } else {
      e.x[s] = e.x[s]! + (s < o ? -push : push) * 0.5;
    }
  }
}

/** Move every Unlit by behaviour. Boss pattern logic lives in boss.ts; here bosses only chase in gaps. */
export function updateEnemies(
  ctx: SimCtx,
  bossMove: (ctx: SimCtx, slot: number, speed: number) => void,
): void {
  const { world, sd } = ctx;
  const e = world.enemies;
  const p = world.player;
  for (let s = 0; s < e.highWater; s++) {
    if (e.alive[s] === 0) continue;
    e.prevX[s] = e.x[s]!;
    e.prevY[s] = e.y[s]!;
    e.ageTicks[s] = e.ageTicks[s]! + 1;
    const type = e.typeIndex[s]!;
    const def = ctx.data.enemies[type];
    const sim = sd.enemies[type];
    if (def === undefined || sim === undefined) continue;
    const slow = e.slowTicks[s]! > 0 ? e.slowPct[s]! : 0;
    const speed = def.speedUPerTick * e.speedMult[s]! * Math.max(0, 1 - slow);
    switch (sim.behavior) {
      case Behavior.Charger:
        chargerTick(ctx, s, speed, false);
        break;
      case Behavior.WardenHound:
        chargerTick(ctx, s, speed, true);
        break;
      case Behavior.Shooter:
        shooterTick(ctx, s, speed);
        break;
      case Behavior.Boss:
        bossMove(ctx, s, speed);
        break;
      default:
        moveToward(ctx, s, p.x, p.y, speed, false);
    }
    separate(ctx, s);
    if (ctx.arena !== null) {
      clampInside(ctx.arena, e.x[s]!, e.y[s]!, e.radius[s]!, tmp);
      e.x[s] = tmp.x;
      e.y[s] = tmp.y;
    }
    const fx = p.x - e.x[s]!;
    if (fx !== 0 && e.aiState[s] !== AiState.Attack) e.facing[s] = fx < 0 ? -1 : 1;
  }
}

/**
 * Contact damage (GDD 5.3): one hit per tick from the overlapping Unlit with the largest contact
 * damage (tie: smallest slot). Charging Unlit use attack_dmg once per charge. Grace and emerging skip.
 */
export function contactDamage(ctx: SimCtx): void {
  const { world, cfg } = ctx;
  const e = world.enemies;
  const p = world.player;
  if (p.invulnTicks > 0) return;
  let best = -1;
  let bestDmg = 0;
  let charging = false;
  for (let s = 0; s < e.highWater; s++) {
    if (e.alive[s] === 0 || e.hp[s]! <= 0) continue;
    if (e.ageTicks[s]! < cfg.spawnGraceTicks || e.aiState[s] === AiState.Emerging) continue;
    const dx = e.x[s]! - p.x;
    const dy = e.y[s]! - p.y;
    const rr = e.radius[s]! + p.radius;
    if (dx * dx + dy * dy > rr * rr) continue;
    const def = ctx.data.enemies[e.typeIndex[s]!];
    if (def === undefined) continue;
    const sim = ctx.sd.enemies[e.typeIndex[s]!];
    const isCharge =
      e.aiState[s] === AiState.Attack &&
      e.chargeHit[s] === 0 &&
      (sim?.behavior === Behavior.Charger || sim?.behavior === Behavior.WardenHound);
    const dmg = (isCharge ? def.attackDmg : def.contactDmg) * e.dmgScale[s]!;
    if (dmg > bestDmg) {
      bestDmg = dmg;
      best = s;
      charging = isCharge;
    }
  }
  if (best < 0) return;
  if (charging) e.chargeHit[best] = 1;
  const type = e.typeIndex[best]!;
  damagePlayer(
    ctx,
    bestDmg,
    encodeSource(charging ? SourceKind.EnemyAttack : SourceKind.EnemyContact, type),
  );
}
