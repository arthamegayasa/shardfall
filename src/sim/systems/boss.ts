/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Warden mark and boss (GDD 3.3, 15.1, 16; gd-answers Q33 to Q37). Bosses cycle the data patterns of
// their phase with gaps, HP floors and transitions, enrage, and a Unlit trickle. Every pattern
// archetype of boss_patterns.csv is implemented: target_circles, ring_gap, lanes, summon, spiral,
// blink_slam, lines, cone, charge_lane. Every damaging step is telegraphed first, never shorter than
// telegraph_min_boss_s (cone: telegraph_min_charge_s), and the boss stands still while a pattern runs.

import {
  AreaShape,
  HitStopReason,
  HitStopStrength,
  SimEventType,
  SourceKind,
  TICK_RATE,
  TelegraphKind,
  atan2Turns,
  cosTurns,
  encodeSource,
  sinTurns,
} from '../../core/index.ts';
import { SECTOR_IDS, clampInside, insideDistance, shapeCenter, shapeRadius } from '../arena.ts';
import type { Point } from '../arena.ts';
import { SHAPE_SAMPLE_ATTEMPTS } from '../capacity.ts';
import { AiState, DangerMode } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { pnum, pstr } from '../sim-data.ts';
import type { BossPatternDef, BossPhaseDef } from '../../content/index.ts';
import { TeleMin, spawnDanger, teleTicks } from './areas.ts';
import { damagePlayer } from './combat.ts';
import { spawnEnemyShot } from './enemy-shots.ts';
import { farthestSector, startMark } from './spawner.ts';

const pt: Point = { x: 0, y: 0 };
const sec = (s: number): number => Math.round(s * TICK_RATE);

/** Circle centres placed by the current target_circles pattern (pattern start only, max count). */
const circleX = new Float64Array(64);
const circleY = new Float64Array(64);
/** Lane y positions of the current lanes pattern. */
const laneY = new Float64Array(64);

/** Phases per (data, boss type, Crack), built once: bossPhases runs every boss tick. */
const phaseCache = new WeakMap<object, Map<number, readonly BossPhaseDef[]>>();

function phaseOf(phases: readonly BossPhaseDef[], n: number): BossPhaseDef | undefined {
  for (let i = 0; i < phases.length; i++) if (phases[i]?.phase === n) return phases[i];
  return undefined;
}

export function bossPhases(ctx: SimCtx, bossType: number): readonly BossPhaseDef[] {
  let byKey = phaseCache.get(ctx.data);
  if (byKey === undefined) {
    byKey = new Map();
    phaseCache.set(ctx.data, byKey);
  }
  const key = bossType * 1024 + ctx.run.difficulty;
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const id = ctx.data.enemies[bossType]?.id;
  const list = ctx.data.bossPhases
    .filter((p) => p.bossId === id && p.minCrack <= ctx.run.difficulty)
    .sort((a, b) => a.phase - b.phase);
  byKey.set(key, list);
  return list;
}

function patternById(ctx: SimCtx, id: string): number {
  for (let i = 0; i < ctx.data.bossPatterns.length; i++)
    if (ctx.data.bossPatterns[i]?.id === id) return i;
  return -1;
}

/**
 * Warden: mark at the sector farthest from the player at warden_spawn_frac of the Pulse (not
 * counted). A full mark pool retries next tick instead of losing the Warden (LP review M1).
 */
export function spawnWardenMark(ctx: SimCtx): void {
  const run = ctx.run;
  if (run.wardenType < 0 || run.wardenSpawned) return;
  if (startMark(ctx, run.wardenType, 1, farthestSector(ctx), false) >= 0) run.wardenSpawned = true;
}

/** Boss Pulse start: stage telegraph for boss_entry_s, boss invulnerable and harmless until it emerges. */
export function startBossEntry(ctx: SimCtx): void {
  const run = ctx.run;
  const arena = ctx.arena;
  if (run.bossType < 0 || arena === null) return;
  shapeCenter(arena.def.bossStage.shape, pt);
  run.bossEntryTicks = Math.max(1, ctx.cfg.bossEntryTicks);
  spawnDanger(
    ctx,
    DangerMode.Visual,
    AreaShape.Circle,
    TelegraphKind.BossArea,
    pt.x,
    pt.y,
    shapeRadius(arena.def.bossStage.shape),
    run.bossEntryTicks,
    0,
    encodeSource(SourceKind.Spawn, run.bossType),
    -1,
  );
}

function emergeBoss(
  ctx: SimCtx,
  spawn: (ctx: SimCtx, type: number, x: number, y: number, counted: boolean) => number,
): void {
  const run = ctx.run;
  const arena = ctx.arena;
  if (arena === null) return;
  shapeCenter(arena.def.bossStage.shape, pt);
  const s = spawn(ctx, run.bossType, pt.x, pt.y, false);
  if (s < 0) return;
  run.bossSlot = s;
  run.bossPhase = 1;
  run.bossCyclePos = 0;
  run.bossPatternIndex = -1;
  run.bossFightTicks = 0;
  run.bossEnraged = false;
  run.bossTrickleTicks = ctx.cfg.bossTrickleEveryTicks;
  const phases = bossPhases(ctx, run.bossType);
  run.bossGapTicks = phases[0]?.gapTicks ?? 0;
  setFloor(ctx, phases);
  ctx.events.push(SimEventType.BossSpawned, pt.x, pt.y, run.bossType, 0, 0);
}

/** HP floor = next phase threshold while that phase is pending (GDD 16: no skipping phase 2). */
function setFloor(ctx: SimCtx, phases: readonly BossPhaseDef[]): void {
  const run = ctx.run;
  const next = phaseOf(phases, run.bossPhase + 1);
  const max = run.bossSlot >= 0 ? ctx.world.enemies.maxHp[run.bossSlot]! : 0;
  run.bossHpFloor = next !== undefined ? next.hpBelow * max : 0;
}

/** Boss movement in gaps (bosses stand still during telegraphs and patterns). */
export function bossMove(ctx: SimCtx, s: number, speed: number): void {
  const e = ctx.world.enemies;
  const run = ctx.run;
  if (s !== run.bossSlot || run.bossPatternIndex >= 0 || run.bossTransitionTicks > 0) return;
  const p = ctx.world.player;
  const dx = p.x - e.x[s]!;
  const dy = p.y - e.y[s]!;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > e.radius[s]! + p.radius && d > 0) {
    e.x[s] = e.x[s]! + (dx / d) * speed;
    e.y[s] = e.y[s]! + (dy / d) * speed;
  }
}

/** Telegraph ticks of a pattern: data, raised to the boss minimum (cone: charge minimum). */
function patTele(ctx: SimCtx, pat: BossPatternDef): number {
  return teleTicks(
    ctx,
    pat.archetype === 'cone' ? TeleMin.Charge : TeleMin.Boss,
    pat.telegraphTicks,
  );
}

function strikeCircle(
  ctx: SimCtx,
  pat: BossPatternDef,
  idx: number,
  x: number,
  y: number,
  r: number,
  ticks: number,
): void {
  spawnDanger(
    ctx,
    DangerMode.Strike,
    AreaShape.Circle,
    TelegraphKind.BossArea,
    x,
    y,
    r,
    ticks,
    pat.dmg * ctx.run.dmgScale,
    encodeSource(SourceKind.BossPattern, idx),
    -1,
  );
}

/** Travel time in ticks for a shot or charge to cross the arena (structural, from the arena size). */
function crossTicks(ctx: SimCtx, speedPerTick: number): number {
  const a = ctx.arena;
  if (a === null || speedPerTick <= 0) return 0;
  return Math.ceil((a.maxX - a.minX + (a.maxY - a.minY)) / speedPerTick);
}

/** Distance from (x, y) along unit (dx, dy) to the arena boundary (ray march, pattern start only). */
function rayToEdge(ctx: SimCtx, x: number, y: number, dx: number, dy: number): number {
  const a = ctx.arena;
  if (a === null) return 0;
  const max = a.maxX - a.minX + (a.maxY - a.minY);
  // Bisection on the convex boundary: inside at lo, outside at hi.
  let lo = 0;
  let hi = max;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) * 0.5;
    if (insideDistance(a, x + dx * mid, y + dy * mid) >= 0) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** target_circles (Ember Rain): first on the player (first_on_player), the rest in spread, no overlap. */
function targetCircles(ctx: SimCtx, pat: BossPatternDef, idx: number, ticks: number): void {
  const prm = pat.params;
  const p = ctx.world.player;
  const rng = ctx.rng.ai;
  const count = Math.min(circleX.length, Math.max(1, Math.floor(pnum(prm, 'count', 1))));
  const r = pnum(prm, 'radius', 0);
  const spread = pnum(prm, 'spread', 0);
  const firstOnPlayer = pnum(prm, 'first_on_player', 0) > 0;
  if (r <= 0) return;
  let n = 0;
  for (let k = 0; k < count; k++) {
    let x = p.x;
    let y = p.y;
    if (k > 0 || !firstOnPlayer) {
      // Uniform in the spread disk around the player, rejecting overlaps; bounded attempts, the
      // last candidate is kept when the disk is full (deterministic).
      for (let a = 0; a < SHAPE_SAMPLE_ATTEMPTS; a++) {
        const t = rng.next();
        const d = spread * Math.sqrt(rng.next());
        x = p.x + cosTurns(t) * d;
        y = p.y + sinTurns(t) * d;
        let free = true;
        for (let j = 0; j < n && free; j++) {
          const dx = x - circleX[j]!;
          const dy = y - circleY[j]!;
          if (dx * dx + dy * dy < 4 * r * r) free = false;
        }
        if (free) break;
      }
    }
    if (ctx.arena !== null) {
      clampInside(ctx.arena, x, y, 0, pt);
      x = pt.x;
      y = pt.y;
    }
    circleX[n] = x;
    circleY[n] = y;
    n++;
    strikeCircle(ctx, pat, idx, x, y, r, ticks);
  }
}

/** ring_gap (Snuff Ring, Toll Waves): rings with staggered telegraphs, gaps min_gap_diff_deg apart. */
function ringGap(ctx: SimCtx, pat: BossPatternDef, idx: number, ticks: number): number {
  const prm = pat.params;
  const run = ctx.run;
  const e = ctx.world.enemies;
  const rng = ctx.rng.ai;
  const bx = e.x[run.bossSlot]!;
  const by = e.y[run.bossSlot]!;
  const rings = Math.max(1, Math.floor(pnum(prm, 'rings', 1)));
  const gapTicks = sec(pnum(prm, 'ring_gap_s', 0));
  const thick = pnum(prm, 'thickness', 0);
  const speed = pnum(prm, 'speed', 0) / TICK_RATE;
  const maxR = pnum(prm, 'max_radius', 0);
  const gapHalf = (pnum(prm, 'gap_deg', 0) / 360) * 0.5;
  const minSep = pnum(prm, 'min_gap_diff_deg', 0) / 360;
  const src = encodeSource(SourceKind.BossPattern, idx);
  let gap = rng.next();
  for (let k = 0; k < rings; k++) {
    // Later rings: gap at least min_gap_diff_deg away from the previous one (GDD 16.1).
    if (k > 0) gap += minSep + rng.next() * Math.max(0, 1 - minSep * 2);
    gap -= Math.floor(gap);
    const z = spawnDanger(
      ctx,
      DangerMode.ExpandingRing,
      AreaShape.Ring,
      TelegraphKind.Ring,
      bx,
      by,
      thick,
      ticks + gapTicks * k,
      pat.dmg * run.dmgScale,
      src,
      -1,
    );
    if (z < 0) continue;
    const da = ctx.world.dangerAreas;
    da.p0[z] = 0;
    da.p1[z] = gap;
    da.p2[z] = gapHalf;
    da.speed[z] = speed;
    da.maxRadius[z] = maxR;
  }
  const travel = speed > 0 ? Math.ceil(maxR / speed) : 0;
  return ticks + gapTicks * (rings - 1) + travel;
}

/** lanes (Lantern Lanes): horizontal lanes min_sep apart, rows of shots from a random side. */
function lanes(ctx: SimCtx, pat: BossPatternDef, idx: number, ticks: number): number {
  const prm = pat.params;
  const run = ctx.run;
  const rng = ctx.rng.ai;
  const count = Math.min(laneY.length, Math.max(1, Math.floor(pnum(prm, 'count', 1))));
  const width = pnum(prm, 'width', 0);
  const yMin = pnum(prm, 'y_min', 0);
  const yMax = pnum(prm, 'y_max', 0);
  const minSep = pnum(prm, 'min_sep', 0);
  const spacing = pnum(prm, 'spacing', 0);
  const speed = pnum(prm, 'speed', 0) / TICK_RATE;
  const arena = ctx.arena;
  const x0 = arena !== null ? arena.minX : -1;
  const x1 = arena !== null ? arena.maxX : 1;
  const src = encodeSource(SourceKind.BossPattern, idx);
  for (let k = 0; k < count; k++) {
    let y = rng.range(yMin, yMax);
    // Rejection sampling for min_sep between lanes, bounded attempts (deterministic).
    for (let tries = 0; tries < count * count + count; tries++) {
      let ok = true;
      for (let j = 0; j < k && ok; j++) if (Math.abs(laneY[j]! - y) < minSep) ok = false;
      if (ok) break;
      y = rng.range(yMin, yMax);
    }
    laneY[k] = y;
    const fromLeft = rng.chance(0.5);
    const z = spawnDanger(
      ctx,
      DangerMode.Lane,
      AreaShape.Line,
      TelegraphKind.Lane,
      fromLeft ? x0 : x1,
      y,
      0,
      ticks,
      pat.dmg * run.dmgScale,
      src,
      -1,
    );
    if (z >= 0) {
      const da = ctx.world.dangerAreas;
      da.x2[z] = fromLeft ? x1 : x0;
      da.y2[z] = y;
      da.p0[z] = width * 0.5;
      da.speed[z] = speed;
      da.maxRadius[z] = spacing;
      da.p2[z] = run.bossType;
    }
  }
  return ticks + (speed > 0 ? Math.ceil(((x1 - x0) * 2) / speed) : 0);
}

/** Fan telegraph and shots from the boss toward the player (cone, lines combo, choir share Fan). */
function fan(
  ctx: SimCtx,
  idx: number,
  ticks: number,
  count: number,
  deg: number,
  speedPerTick: number,
  dmg: number,
): void {
  const run = ctx.run;
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const life = crossTicks(ctx, speedPerTick);
  if (count <= 0 || speedPerTick <= 0 || life <= 0) return;
  const z = spawnDanger(
    ctx,
    DangerMode.Fan,
    AreaShape.Cone,
    TelegraphKind.Cone,
    e.x[run.bossSlot]!,
    e.y[run.bossSlot]!,
    speedPerTick * life,
    ticks,
    dmg * run.dmgScale,
    encodeSource(SourceKind.BossPattern, idx),
    run.bossSlot,
  );
  if (z < 0) return;
  const da = ctx.world.dangerAreas;
  da.x2[z] = p.x;
  da.y2[z] = p.y;
  da.p0[z] = (deg / 360) * 0.5;
  da.maxRadius[z] = count;
  da.speed[z] = speedPerTick;
  da.tickEvery[z] = life;
  da.p2[z] = run.bossType;
}

/** lines (Root Lines): count lines from the boss to the arena edge, the first toward the player. */
function lines(ctx: SimCtx, pat: BossPatternDef, idx: number, ticks: number): void {
  const prm = pat.params;
  const run = ctx.run;
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const bx = e.x[run.bossSlot]!;
  const by = e.y[run.bossSlot]!;
  const count = Math.max(1, Math.floor(pnum(prm, 'count', 1)));
  const width = pnum(prm, 'width', 0);
  if (width > 0) {
    const base = atan2Turns(p.y - by, p.x - bx);
    for (let k = 0; k < count; k++) {
      const t = base + k / count;
      const dx = cosTurns(t);
      const dy = sinTurns(t);
      const len = rayToEdge(ctx, bx, by, dx, dy);
      const z = spawnDanger(
        ctx,
        DangerMode.Strike,
        AreaShape.Line,
        TelegraphKind.Lane,
        bx,
        by,
        0,
        ticks,
        pat.dmg * run.dmgScale,
        encodeSource(SourceKind.BossPattern, idx),
        -1,
      );
      if (z < 0) continue;
      const da = ctx.world.dangerAreas;
      da.x2[z] = bx + dx * len;
      da.y2[z] = by + dy * len;
      da.p0[z] = width * 0.5;
    }
  }
  // Root and Thorn combo (phase 3): a thorn fan with the same telegraph.
  const fanCount = Math.floor(pnum(prm, 'fan_count', 0));
  if (fanCount > 0) {
    fan(
      ctx,
      idx,
      ticks,
      fanCount,
      pnum(prm, 'fan_deg', 0),
      pnum(prm, 'fan_speed', 0) / TICK_RATE,
      pnum(prm, 'fan_dmg', 0),
    );
  }
}

/**
 * Start pattern idx: immediate telegraphs and the pattern state for its timed steps. Returns the
 * pattern duration in ticks (telegraph plus execution); the boss stands still meanwhile.
 */
function startPattern(ctx: SimCtx, idx: number): number {
  const pat = ctx.data.bossPatterns[idx];
  const run = ctx.run;
  if (pat === undefined) return 1;
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const s = run.bossSlot;
  const bx = e.x[s]!;
  const by = e.y[s]!;
  const prm = pat.params;
  const ticks = patTele(ctx, pat);
  const src = encodeSource(SourceKind.BossPattern, idx);
  run.bossPatternStep = 0;
  run.bossPatHit = false;
  ctx.events.push(SimEventType.BossPatternStarted, bx, by, idx, run.bossPhase, src);
  switch (pat.archetype) {
    case 'target_circles':
      targetCircles(ctx, pat, idx, ticks);
      return ticks;
    case 'ring_gap':
      return Math.max(1, ringGap(ctx, pat, idx, ticks));
    case 'lanes':
      return Math.max(1, lanes(ctx, pat, idx, ticks));
    case 'summon':
      // The boss glows for the telegraph; the spawn mark starts so that it ends with it
      // (spawn mark inside the telegraph, boss_patterns notes).
      spawnDanger(
        ctx,
        DangerMode.Visual,
        AreaShape.Circle,
        TelegraphKind.BossArea,
        bx,
        by,
        e.radius[s]!,
        ticks,
        0,
        src,
        s,
      );
      return ticks;
    case 'spiral':
      // Core glow, then shots for `duration` (stepped in runPattern).
      spawnDanger(
        ctx,
        DangerMode.Visual,
        AreaShape.Circle,
        TelegraphKind.Projectile,
        bx,
        by,
        e.radius[s]!,
        ticks,
        0,
        src,
        s,
      );
      run.bossPatAngle = atan2Turns(p.y - by, p.x - bx);
      return ticks + sec(pnum(prm, 'duration', 0));
    case 'blink_slam': {
      const r = pnum(prm, 'radius', 0);
      let x = p.x;
      let y = p.y;
      if (ctx.arena !== null) {
        clampInside(ctx.arena, x, y, e.radius[s]!, pt);
        x = pt.x;
        y = pt.y;
      }
      run.bossPatX = x;
      run.bossPatY = y;
      if (r > 0) strikeCircle(ctx, pat, idx, x, y, r, ticks);
      return ticks + 1;
    }
    case 'lines':
      lines(ctx, pat, idx, ticks);
      return ticks;
    case 'cone': {
      // Repeats: each fan has its own telegraph; the next starts repeat_gap_s after the last fired.
      const repeats = Math.max(1, Math.floor(pnum(prm, 'repeats', 1)));
      const gap = sec(pnum(prm, 'repeat_gap_s', 0));
      fan(
        ctx,
        idx,
        ticks,
        Math.floor(pnum(prm, 'count', 0)),
        pnum(prm, 'fan_deg', 0),
        pnum(prm, 'speed', 0) / TICK_RATE,
        pat.dmg,
      );
      run.bossPatternStep = 1;
      return repeats * ticks + (repeats - 1) * gap;
    }
    case 'charge_lane': {
      // Lane from the boss through the player to the edge; the boss charges along it.
      let dx = p.x - bx;
      let dy = p.y - by;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        dx /= d;
        dy /= d;
      } else {
        dx = e.facing[s]! >= 0 ? 1 : -1;
        dy = 0;
      }
      const speed = pnum(prm, 'speed', 0) / TICK_RATE;
      const width = pnum(prm, 'width', 0);
      const len = Math.max(0, rayToEdge(ctx, bx, by, dx, dy) - e.radius[s]!);
      run.bossPatDirX = dx;
      run.bossPatDirY = dy;
      const z = spawnDanger(
        ctx,
        DangerMode.Visual,
        AreaShape.Line,
        TelegraphKind.Charge,
        bx,
        by,
        0,
        ticks,
        0,
        src,
        s,
      );
      if (z >= 0) {
        const da = ctx.world.dangerAreas;
        da.x2[z] = bx + dx * len;
        da.y2[z] = by + dy * len;
        da.p0[z] = width * 0.5;
      }
      return ticks + (speed > 0 ? Math.ceil(len / speed) : 0);
    }
    default:
      return 1;
  }
}

/** Timed steps of the running pattern. elapsed = ticks since the pattern started. */
function runPattern(ctx: SimCtx, total: number): void {
  const run = ctx.run;
  const idx = run.bossPatternIndex;
  const pat = ctx.data.bossPatterns[idx];
  if (pat === undefined) return;
  const e = ctx.world.enemies;
  const s = run.bossSlot;
  const prm = pat.params;
  const ticks = patTele(ctx, pat);
  const elapsed = total - run.bossPatternTicks;
  const src = encodeSource(SourceKind.BossPattern, idx);
  switch (pat.archetype) {
    case 'summon': {
      const start = Math.max(0, ticks - Math.max(1, ctx.cfg.spawnMarkTicks));
      if (run.bossPatternStep !== 0 || elapsed < start) return;
      run.bossPatternStep = 1;
      const enemyId = pstr(prm, 'enemy_id', '');
      let type = -1;
      for (let i = 0; i < ctx.data.enemies.length; i++)
        if (ctx.data.enemies[i]?.id === enemyId) type = i;
      const count = Math.max(0, Math.floor(pnum(prm, 'count', 0)));
      if (type < 0 || count <= 0) return;
      // Summon sector from the spawn stream (LP review M1: spawning never draws from ai).
      startMark(ctx, type, count, ctx.rng.spawn.int(SECTOR_IDS.length), false);
      ctx.events.push(SimEventType.BossSummoned, e.x[s]!, e.y[s]!, type, count, src);
      return;
    }
    case 'spiral': {
      if (elapsed < ticks) return;
      const arms = Math.max(1, Math.floor(pnum(prm, 'arms', 1)));
      const rate = pnum(prm, 'rate', 0);
      const dur = pnum(prm, 'duration', 0);
      const speed = pnum(prm, 'speed', 0) / TICK_RATE;
      const life = crossTicks(ctx, speed);
      if (rate <= 0 || dur <= 0 || life <= 0) return;
      // Shot k leaves at k / rate s; the arm turns once per pattern duration unless `turns` is
      // given (gp-requests-m2): a spiral is one sweep of the arena by definition.
      const shotsTotal = Math.floor(rate * dur);
      const turns = pnum(prm, 'turns', 1);
      const t = elapsed - ticks;
      while (run.bossPatternStep < shotsTotal && run.bossPatternStep / rate <= t / TICK_RATE) {
        const k = run.bossPatternStep++;
        const base = run.bossPatAngle + (turns * k) / shotsTotal;
        for (let a = 0; a < arms; a++) {
          const ang = base + a / arms;
          spawnEnemyShot(
            ctx,
            e.x[s]!,
            e.y[s]!,
            cosTurns(ang) * speed,
            sinTurns(ang) * speed,
            pat.dmg * run.dmgScale,
            life,
            src,
          );
        }
        ctx.events.push(
          SimEventType.EnemyProjectileFired,
          e.x[s]!,
          e.y[s]!,
          run.bossType,
          arms,
          src,
        );
      }
      return;
    }
    case 'blink_slam':
      if (run.bossPatternStep !== 0 || elapsed < ticks) return;
      // Land on the marked spot the tick its strike resolves (the strike is resolved after us).
      run.bossPatternStep = 1;
      e.x[s] = run.bossPatX;
      e.y[s] = run.bossPatY;
      e.prevX[s] = run.bossPatX;
      e.prevY[s] = run.bossPatY;
      return;
    case 'cone': {
      const repeats = Math.max(1, Math.floor(pnum(prm, 'repeats', 1)));
      const gap = sec(pnum(prm, 'repeat_gap_s', 0));
      const k = run.bossPatternStep;
      if (k >= repeats || elapsed < k * (ticks + gap)) return;
      run.bossPatternStep = k + 1;
      fan(
        ctx,
        idx,
        ticks,
        Math.floor(pnum(prm, 'count', 0)),
        pnum(prm, 'fan_deg', 0),
        pnum(prm, 'speed', 0) / TICK_RATE,
        pat.dmg,
      );
      return;
    }
    case 'charge_lane': {
      if (elapsed < ticks) return;
      const speed = pnum(prm, 'speed', 0) / TICK_RATE;
      const half = pnum(prm, 'width', 0) * 0.5;
      e.aiState[s] = AiState.Attack;
      e.x[s] = e.x[s]! + run.bossPatDirX * speed;
      e.y[s] = e.y[s]! + run.bossPatDirY * speed;
      if (ctx.arena !== null) {
        clampInside(ctx.arena, e.x[s], e.y[s], e.radius[s]!, pt);
        e.x[s] = pt.x;
        e.y[s] = pt.y;
      }
      // One hit per charge on contact with the lane body (boss radius or half width).
      const p = ctx.world.player;
      const dx = p.x - e.x[s];
      const dy = p.y - e.y[s];
      const rr = Math.max(e.radius[s]!, half) + p.radius;
      if (!run.bossPatHit && dx * dx + dy * dy <= rr * rr) {
        run.bossPatHit = true;
        damagePlayer(ctx, pat.dmg * run.dmgScale, src);
      }
      return;
    }
    default:
      return;
  }
}

/**
 * Boss tick: entry, phases, transitions, pattern cycle with gaps, enrage, Unlit trickle.
 * spawn is the spawner's spawnEnemy (passed to keep the module graph acyclic).
 */
export function updateBoss(
  ctx: SimCtx,
  spawn: (ctx: SimCtx, type: number, x: number, y: number, counted: boolean) => number,
  trickleType: number,
): void {
  const run = ctx.run;
  const cfg = ctx.cfg;
  if (run.bossType < 0 || run.bossKilled) return;
  if (run.bossEntryTicks > 0) {
    // The stage telegraph starts on the Pulse's first tick; count down from the next one so the
    // boss emerges exactly when the telegraph resolves (boss_entry_s).
    if (run.pulseTick > 1) run.bossEntryTicks--;
    if (run.bossEntryTicks === 0) emergeBoss(ctx, spawn);
    return;
  }
  const s = run.bossSlot;
  if (s < 0) return;
  const e = ctx.world.enemies;
  run.bossFightTicks++;
  const phases = bossPhases(ctx, run.bossType);
  const phase = phaseOf(phases, run.bossPhase);
  if (!run.bossEnraged && cfg.bossEnrageTicks > 0 && run.bossFightTicks >= cfg.bossEnrageTicks) {
    run.bossEnraged = true;
    ctx.events.push(SimEventType.BossEnraged, e.x[s]!, e.y[s]!, run.bossType, 0, 0);
  }
  // Trickle (not counted toward alive_cap), paused while enough trickle Unlit are alive.
  if (cfg.bossTrickleEveryTicks > 0) {
    run.bossTrickleTicks--;
    if (run.bossTrickleTicks <= 0) {
      run.bossTrickleTicks = cfg.bossTrickleEveryTicks;
      let alive = 0;
      for (let i = 0; i < e.highWater; i++)
        if (e.alive[i] === 1 && e.rank[i] === 0 && e.counted[i] === 0) alive++;
      if (alive < cfg.bossTrickleMaxAlive && cfg.bossTrickleCount > 0) {
        // Spawn stream (LP review M1): sectors of spawns never draw from ai.
        startMark(
          ctx,
          trickleType,
          cfg.bossTrickleCount,
          ctx.rng.spawn.int(SECTOR_IDS.length),
          false,
        );
      }
    }
  }
  if (run.bossTransitionTicks > 0) {
    run.bossTransitionTicks--;
    e.aiState[s] = AiState.Transition;
    if (run.bossTransitionTicks === 0) {
      const old = run.bossPhase;
      run.bossPhase++;
      run.bossCyclePos = 0;
      const np = phaseOf(phases, run.bossPhase);
      run.bossGapTicks = np?.gapTicks ?? 0;
      e.aiState[s] = AiState.Move;
      setFloor(ctx, phases);
      ctx.events.push(SimEventType.BossPhaseChanged, e.x[s]!, e.y[s]!, run.bossPhase, old, 0);
      ctx.events.push(
        SimEventType.HitStop,
        e.x[s]!,
        e.y[s]!,
        HitStopStrength.Medium,
        HitStopReason.BossPhase,
        run.bossType,
      );
    }
    return;
  }
  if (run.bossPatternIndex >= 0) {
    run.bossPatternTicks--;
    runPattern(ctx, run.bossPatternTotal);
    if (run.bossPatternTicks > 0) return;
    run.bossPatternIndex = -1;
    e.aiState[s] = AiState.Move;
    let gap = phase?.gapTicks ?? 0;
    if (run.bossEnraged) gap = Math.round(gap * cfg.bossEnrageGapMult);
    gap = Math.round(gap * (run.diff?.bossGapMult ?? 1));
    run.bossGapTicks = gap;
    return;
  }
  // Phase change pending: HP reached the floor, start the transition after the pattern ended.
  if (run.bossHpFloor > 0 && e.hp[s]! <= run.bossHpFloor) {
    const np = phaseOf(phases, run.bossPhase + 1);
    run.bossHpFloor = 0;
    run.bossTransitionTicks = Math.max(1, np?.transitionTicks ?? 1);
    e.aiState[s] = AiState.Transition;
    return;
  }
  if (run.bossGapTicks > 0) {
    run.bossGapTicks--;
    return;
  }
  if (phase === undefined || phase.cycle.length === 0) return;
  const id = phase.cycle[run.bossCyclePos % phase.cycle.length] ?? '';
  run.bossCyclePos = (run.bossCyclePos + 1) % phase.cycle.length;
  const idx = patternById(ctx, id);
  if (idx < 0) return;
  run.bossPatternIndex = idx;
  e.aiState[s] = AiState.Windup;
  const total = Math.max(1, startPattern(ctx, idx));
  run.bossPatternTicks = total;
  run.bossPatternTotal = total;
}
