/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Unlit AI (GDD 14.2, 14.3, 15.1): chase (with weave), charger, shooter, exploder, summoner, lobber,
// Warden hound, Warden choir, Warden bulwark; affixes; separation, boundary clamp, contact damage.
// Every number comes from enemies.csv (columns and params) and affixes.csv. Every damaging attack is
// telegraphed for at least the GD minimum of its category (GDD 14.1).

import {
  AreaShape,
  SimEventType,
  SourceKind,
  TICK_RATE,
  TelegraphKind,
  encodeSource,
  sinTurns,
} from '../../core/index.ts';
import { clampInside } from '../arena.ts';
import type { Point } from '../arena.ts';
import { SEPARATION_NEIGHBOURS } from '../capacity.ts';
import { AiState, Behavior, DangerMode } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { pnum, pstr } from '../sim-data.ts';
import { afterAttack, summonAround, summonsAlive, updateAffixes } from './affixes.ts';
import { TeleMin, spawnDanger, teleTicks } from './areas.ts';
import { damagePlayer } from './combat.ts';
import { spawnEnemyShot } from './enemy-shots.ts';

const tmp: Point = { x: 0, y: 0 };

const sec = (s: number): number => Math.round(s * TICK_RATE);
const perTick = (uPerSec: number): number => uPerSec / TICK_RATE;
/** Weave phase spread between slots (golden ratio turns) so a swarm does not sway in step. */
const WEAVE_SLOT_PHASE = 0.6180339887;

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

/** Chase with a sideways sway (swarmer weave_amp u, weave_hz). Missing keys: straight chase. */
function chaseTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const def = ctx.data.enemies[e.typeIndex[s]!];
  const ox = e.x[s]!;
  const oy = e.y[s]!;
  moveToward(ctx, s, p.x, p.y, speed, false);
  if (def === undefined) return;
  const amp = pnum(def.params, 'weave_amp', 0);
  const hz = pnum(def.params, 'weave_hz', 0);
  if (amp <= 0 || hz <= 0) return;
  const dx = p.x - ox;
  const dy = p.y - oy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return;
  // Sideways offset of a sine of amplitude amp: move by its change over this tick.
  const ph = s * WEAVE_SLOT_PHASE;
  const t = e.ageTicks[s]!;
  const off =
    amp * (sinTurns(ph + (hz * t) / TICK_RATE) - sinTurns(ph + (hz * (t - 1)) / TICK_RATE));
  e.x[s] = e.x[s]! + (-dy / d) * off;
  e.y[s] = e.y[s]! + (dx / d) * off;
}

function setState(ctx: SimCtx, s: number, st: number, ticks: number): void {
  const e = ctx.world.enemies;
  e.aiState[s] = st;
  e.aiStateTicks[s] = ticks;
}

/** Hold distance in [keepMin, keepMax] from the player (shooter, summoner, lobber, choir). */
function keepDistance(
  ctx: SimCtx,
  s: number,
  speed: number,
  keepMin: number,
  keepMax: number,
): number {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const dx = p.x - e.x[s]!;
  const dy = p.y - e.y[s]!;
  const d2 = dx * dx + dy * dy;
  if (keepMax > 0 && d2 > keepMax * keepMax) moveToward(ctx, s, p.x, p.y, speed, false);
  else if (keepMin > 0 && d2 < keepMin * keepMin) moveToward(ctx, s, p.x, p.y, speed, true);
  else if (keepMax <= 0) moveToward(ctx, s, p.x, p.y, speed, false);
  return d2;
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
  const ticks = teleTicks(ctx, TeleMin.Charge, windupTicks);
  setState(ctx, s, AiState.Windup, ticks);
  const a = spawnDanger(
    ctx,
    DangerMode.Visual,
    AreaShape.Line,
    TelegraphKind.Charge,
    e.x[s]!,
    e.y[s]!,
    0,
    ticks,
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
        afterAttack(ctx, s);
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

function shooterTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const type = e.typeIndex[s]!;
  const def = ctx.data.enemies[type];
  if (def === undefined) return;
  const prm = def.params;
  const keepMax = pnum(prm, 'keep_max', 0);
  const shotSpeed = perTick(pnum(prm, 'shot_speed', 0));
  const life = sec(pnum(prm, 'shot_life', 0));
  const cooldown = sec(pnum(prm, 'cooldown', 0));
  const src = encodeSource(SourceKind.EnemyAttack, type);
  if (e.aiState[s] === AiState.Windup) {
    e.aiStateTicks[s] = e.aiStateTicks[s]! - 1;
    if (e.aiStateTicks[s] <= 0) {
      const dx = p.x - e.x[s]!;
      const dy = p.y - e.y[s]!;
      const d = Math.sqrt(dx * dx + dy * dy);
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
      afterAttack(ctx, s);
      e.aiTimer[s] = cooldown;
      setState(ctx, s, AiState.Move, 0);
    }
    return;
  }
  const d2 = keepDistance(ctx, s, speed, pnum(prm, 'keep_min', 0), keepMax);
  if (e.aiTimer[s]! > 0) {
    e.aiTimer[s] = e.aiTimer[s]! - 1;
    return;
  }
  if (shotSpeed <= 0 || e.ageTicks[s]! < ctx.cfg.spawnGraceTicks) return;
  if (keepMax > 0 && d2 > keepMax * keepMax) return;
  const ticks = teleTicks(ctx, TeleMin.Projectile, def.telegraphTicks);
  setState(ctx, s, AiState.Windup, ticks);
  spawnDanger(
    ctx,
    DangerMode.Visual,
    AreaShape.Circle,
    TelegraphKind.Projectile,
    e.x[s]!,
    e.y[s]!,
    e.radius[s]!,
    ticks,
    0,
    src,
    s,
  );
}

/**
 * Warden choir (GDD 15.1): keeps distance, every cooldown a fan of fan_count shots over fan_deg
 * toward the player after a cone telegraph (telegraph_s, projectile minimum). The fan leaves when
 * the telegraph resolves; a dead choir cancels it.
 */
function choirTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const type = e.typeIndex[s]!;
  const def = ctx.data.enemies[type];
  if (def === undefined) return;
  const prm = def.params;
  if (e.aiState[s] === AiState.Windup) {
    e.aiStateTicks[s] = e.aiStateTicks[s]! - 1;
    if (e.aiStateTicks[s] <= 0) {
      afterAttack(ctx, s);
      e.aiTimer[s] = sec(pnum(prm, 'cooldown', 0));
      setState(ctx, s, AiState.Move, 0);
    }
    return;
  }
  keepDistance(ctx, s, speed, pnum(prm, 'keep_min', 0), pnum(prm, 'keep_max', 0));
  if (e.aiTimer[s]! > 0) {
    e.aiTimer[s] = e.aiTimer[s]! - 1;
    return;
  }
  const count = Math.floor(pnum(prm, 'fan_count', 0));
  const shotSpeed = perTick(pnum(prm, 'shot_speed', 0));
  const life = sec(pnum(prm, 'shot_life', 0));
  if (count <= 0 || shotSpeed <= 0 || life <= 0) return;
  if (e.ageTicks[s]! < ctx.cfg.spawnGraceTicks) return;
  const ticks = teleTicks(ctx, TeleMin.Projectile, def.telegraphTicks);
  setState(ctx, s, AiState.Windup, ticks);
  const z = spawnDanger(
    ctx,
    DangerMode.Fan,
    AreaShape.Cone,
    TelegraphKind.Cone,
    e.x[s]!,
    e.y[s]!,
    shotSpeed * life,
    ticks,
    def.attackDmg * e.dmgScale[s]!,
    encodeSource(SourceKind.EnemyAttack, type),
    s,
  );
  if (z >= 0) {
    const da = ctx.world.dangerAreas;
    da.x2[z] = p.x;
    da.y2[z] = p.y;
    da.p0[z] = (pnum(prm, 'fan_deg', 0) / 360) * 0.5;
    da.maxRadius[z] = count;
    da.speed[z] = shotSpeed;
    da.tickEvery[z] = life;
    da.p2[z] = type;
  }
}

/**
 * Exploder (GDD 14.2): within trigger_range lights a fuse of fuse_s (growing circle of
 * blast_radius, moves at fuse_move_mult). The blast resolves in areas.ts; killed first = no blast.
 */
function exploderTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const type = e.typeIndex[s]!;
  const def = ctx.data.enemies[type];
  if (def === undefined) return;
  const prm = def.params;
  if (e.aiState[s] === AiState.Windup) {
    moveToward(ctx, s, p.x, p.y, speed * pnum(prm, 'fuse_move_mult', 0), false);
    return;
  }
  moveToward(ctx, s, p.x, p.y, speed, false);
  const trigger = pnum(prm, 'trigger_range', 0);
  const fuse = sec(pnum(prm, 'fuse_s', 0));
  const radius = pnum(prm, 'blast_radius', 0);
  if (trigger <= 0 || fuse <= 0 || radius <= 0) return;
  if (e.ageTicks[s]! < ctx.cfg.spawnGraceTicks) return;
  const dx = p.x - e.x[s]!;
  const dy = p.y - e.y[s]!;
  if (dx * dx + dy * dy > trigger * trigger) return;
  const ticks = teleTicks(ctx, TeleMin.Area, fuse);
  setState(ctx, s, AiState.Windup, ticks);
  const z = spawnDanger(
    ctx,
    DangerMode.Blast,
    AreaShape.Circle,
    TelegraphKind.Area,
    e.x[s]!,
    e.y[s]!,
    radius,
    ticks,
    def.attackDmg * e.dmgScale[s]!,
    encodeSource(SourceKind.EnemyAttack, type),
    s,
  );
  if (z >= 0) ctx.world.dangerAreas.p1[z] = pnum(prm, 'enemy_dmg', 0);
}

function enemyTypeById(ctx: SimCtx, id: string): number {
  for (let i = 0; i < ctx.data.enemies.length; i++) if (ctx.data.enemies[i]?.id === id) return i;
  return -1;
}

/** Summoner (GDD 14.2): keeps distance; every summon_every s summons up to max_summons alive. */
function summonerTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const def = ctx.data.enemies[e.typeIndex[s]!];
  if (def === undefined) return;
  const prm = def.params;
  keepDistance(ctx, s, speed, pnum(prm, 'keep_min', 0), pnum(prm, 'keep_max', 0));
  const every = sec(pnum(prm, 'summon_every', 0));
  if (every <= 0) return;
  // First summon one full interval after spawning.
  if (e.aiCounter[s] === 0) {
    e.aiCounter[s] = 1;
    e.aiTimer[s] = every;
  }
  e.aiTimer[s] = e.aiTimer[s]! - 1;
  if (e.aiTimer[s] > 0) return;
  e.aiTimer[s] = every;
  const type = enemyTypeById(ctx, pstr(prm, 'summon_id', ''));
  const max = Math.floor(pnum(prm, 'max_summons', 0));
  const n = Math.min(Math.floor(pnum(prm, 'summon_count', 0)), max - summonsAlive(ctx, s));
  if (type < 0 || n <= 0) return;
  summonAround(ctx, s, type, n);
}

/** Lobber (GDD 14.2): keeps distance; every cooldown a circle of zone_radius at the player lands. */
function lobberTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const type = e.typeIndex[s]!;
  const def = ctx.data.enemies[type];
  if (def === undefined) return;
  const prm = def.params;
  const keepMax = pnum(prm, 'keep_max', 0);
  const d2 = keepDistance(ctx, s, speed, pnum(prm, 'keep_min', 0), keepMax);
  if (e.aiTimer[s]! > 0) {
    e.aiTimer[s] = e.aiTimer[s]! - 1;
    return;
  }
  const r = pnum(prm, 'zone_radius', 0);
  if (r <= 0 || e.ageTicks[s]! < ctx.cfg.spawnGraceTicks) return;
  if (keepMax > 0 && d2 > keepMax * keepMax) return;
  spawnDanger(
    ctx,
    DangerMode.Strike,
    AreaShape.Circle,
    TelegraphKind.Area,
    p.x,
    p.y,
    r,
    teleTicks(ctx, TeleMin.Area, def.telegraphTicks),
    def.attackDmg * e.dmgScale[s]!,
    encodeSource(SourceKind.EnemyAttack, type),
    -1,
  );
  afterAttack(ctx, s);
  e.aiTimer[s] = sec(pnum(prm, 'cooldown', 0));
}

/** Warden bulwark (GDD 15.1): chases; every slam_every s stands and slams a circle around itself. */
function bulwarkTick(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const type = e.typeIndex[s]!;
  const def = ctx.data.enemies[type];
  if (def === undefined) return;
  const prm = def.params;
  const every = sec(pnum(prm, 'slam_every', 0));
  if (e.aiState[s] === AiState.Windup) {
    e.aiStateTicks[s] = e.aiStateTicks[s]! - 1;
    if (e.aiStateTicks[s] <= 0) {
      afterAttack(ctx, s);
      e.aiTimer[s] = every;
      setState(ctx, s, AiState.Move, 0);
    }
    return;
  }
  moveToward(ctx, s, p.x, p.y, speed, false);
  const r = pnum(prm, 'slam_radius', 0);
  if (every <= 0 || r <= 0) return;
  if (e.aiCounter[s] === 0) {
    e.aiCounter[s] = 1;
    e.aiTimer[s] = every;
  }
  e.aiTimer[s] = e.aiTimer[s]! - 1;
  if (e.aiTimer[s] > 0) return;
  const ticks = teleTicks(ctx, TeleMin.Area, def.telegraphTicks);
  setState(ctx, s, AiState.Windup, ticks);
  spawnDanger(
    ctx,
    DangerMode.Strike,
    AreaShape.Circle,
    TelegraphKind.Area,
    e.x[s]!,
    e.y[s]!,
    r,
    ticks,
    def.attackDmg * e.dmgScale[s]!,
    encodeSource(SourceKind.EnemyAttack, type),
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
    // Hit flash counts down before this tick's hits, so a hit is visible for HIT_FLASH_TICKS views.
    if (e.hitFlashTicks[s]! > 0) e.hitFlashTicks[s] = e.hitFlashTicks[s]! - 1;
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
      case Behavior.WardenChoir:
        choirTick(ctx, s, speed);
        break;
      case Behavior.Exploder:
        exploderTick(ctx, s, speed);
        break;
      case Behavior.Summoner:
        summonerTick(ctx, s, speed);
        break;
      case Behavior.Lobber:
        lobberTick(ctx, s, speed);
        break;
      case Behavior.WardenBulwark:
        bulwarkTick(ctx, s, speed);
        break;
      case Behavior.Boss:
        bossMove(ctx, s, speed);
        break;
      default:
        chaseTick(ctx, s, speed);
    }
    if (e.alive[s] === 0) continue;
    updateAffixes(ctx, s);
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
