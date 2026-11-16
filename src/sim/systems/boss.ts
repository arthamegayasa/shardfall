/* eslint-disable @typescript-eslint/no-non-null-assertion -- typed array hot loops, coding-standards 1.3 */
// Warden and boss (GDD 3.3, 15.1, 16; gd-answers Q33 to Q37). M1 scope: they appear, have HP, and
// attack with telegraphs; bosses cycle data patterns per phase with transitions and enrage.
// Pattern archetypes implemented: target_circles, ring_gap, summon, lanes. Others fall back to a
// single telegraphed strike at the player until M2.

import {
  AreaShape,
  SimEventType,
  SourceKind,
  TICK_RATE,
  TelegraphKind,
  encodeSource,
} from '../../core/index.ts';
import { SECTOR_IDS, shapeCenter, shapeRadius } from '../arena.ts';
import type { Point } from '../arena.ts';
import { AiState, DangerMode } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';
import { pnum, pstr } from '../sim-data.ts';
import type { BossPatternDef, BossPhaseDef } from '../../content/index.ts';
import { spawnDanger } from './areas.ts';
import { farthestSector, startMark } from './spawner.ts';

const pt: Point = { x: 0, y: 0 };
const sec = (s: number): number => Math.round(s * TICK_RATE);

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

/** Warden: mark at the sector farthest from the player at warden_spawn_frac of the Pulse (not counted). */
export function spawnWardenMark(ctx: SimCtx): void {
  const run = ctx.run;
  if (run.wardenType < 0 || run.wardenSpawned) return;
  run.wardenSpawned = true;
  startMark(ctx, run.wardenType, 1, farthestSector(ctx), false);
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

function strike(
  ctx: SimCtx,
  pat: BossPatternDef,
  idx: number,
  x: number,
  y: number,
  r: number,
): void {
  spawnDanger(
    ctx,
    DangerMode.Strike,
    AreaShape.Circle,
    TelegraphKind.BossArea,
    x,
    y,
    r,
    pat.telegraphTicks,
    pat.dmg * ctx.run.dmgScale,
    encodeSource(SourceKind.BossPattern, idx),
    -1,
  );
}

/** Start pattern idx; returns its duration in ticks (telegraph plus execution). */
function startPattern(ctx: SimCtx, idx: number): number {
  const pat = ctx.data.bossPatterns[idx];
  const run = ctx.run;
  if (pat === undefined) return 1;
  const e = ctx.world.enemies;
  const p = ctx.world.player;
  const bx = e.x[run.bossSlot]!;
  const by = e.y[run.bossSlot]!;
  const src = encodeSource(SourceKind.BossPattern, idx);
  const prm = pat.params;
  const rng = ctx.rng.ai;
  switch (pat.archetype) {
    case 'target_circles': {
      const count = Math.max(1, Math.floor(pnum(prm, 'count', 1)));
      const r = pnum(prm, 'radius', 0);
      const spread = pnum(prm, 'spread', 0);
      strike(ctx, pat, idx, p.x, p.y, r);
      for (let k = 1; k < count; k++) {
        strike(
          ctx,
          pat,
          idx,
          p.x + rng.range(-spread, spread),
          p.y + rng.range(-spread, spread),
          r,
        );
      }
      return Math.max(1, pat.telegraphTicks);
    }
    case 'ring_gap': {
      // All rings are placed at once with staggered telegraphs (ring k fills ring_gap_s x k later).
      const rings = Math.max(1, Math.floor(pnum(prm, 'rings', 1)));
      const gapTicks = sec(pnum(prm, 'ring_gap_s', 0));
      const thick = pnum(prm, 'thickness', 0);
      const speed = pnum(prm, 'speed', 0) / TICK_RATE;
      const maxR = pnum(prm, 'max_radius', 0);
      const gapHalf = (pnum(prm, 'gap_deg', 0) / 360) * 0.5;
      const minSep = pnum(prm, 'min_gap_diff_deg', 0) / 360;
      let gap = rng.next();
      for (let k = 0; k < rings; k++) {
        // Later rings: gap at least min_gap_sep_deg away from the previous one (GDD 16.1).
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
          pat.telegraphTicks + gapTicks * k,
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
      return Math.max(1, pat.telegraphTicks + gapTicks * (rings - 1) + travel);
    }
    case 'summon': {
      const enemyId = pstr(prm, 'enemy_id', '');
      let type = ctx.sd.swarmerType;
      for (let i = 0; i < ctx.data.enemies.length; i++)
        if (ctx.data.enemies[i]?.id === enemyId) type = i;
      const count = Math.max(0, Math.floor(pnum(prm, 'count', 0)));
      startMark(ctx, type, count, rng.int(SECTOR_IDS.length), false);
      ctx.events.push(SimEventType.BossSummoned, bx, by, type, count, src);
      return Math.max(1, ctx.cfg.spawnMarkTicks);
    }
    case 'lanes': {
      const lanes = Math.max(1, Math.floor(pnum(prm, 'count', 1)));
      const width = pnum(prm, 'width', 0);
      const yMin = pnum(prm, 'y_min', 0);
      const yMax = pnum(prm, 'y_max', 0);
      const minSep = pnum(prm, 'min_sep', 0);
      const spacing = pnum(prm, 'spacing', 0);
      const speed = pnum(prm, 'speed', 0) / TICK_RATE;
      const arena = ctx.arena;
      const x0 = arena !== null ? arena.minX : -1;
      const x1 = arena !== null ? arena.maxX : 1;
      // Pattern start, not per tick: a small array is fine.
      const used: number[] = [];
      for (let k = 0; k < lanes; k++) {
        let y = rng.range(yMin, yMax);
        // Rejection sampling for min_sep between lanes, bounded attempts (deterministic).
        for (let tries = 0; tries < lanes * lanes + lanes; tries++) {
          if (used.every((u) => Math.abs(u - y) >= minSep)) break;
          y = rng.range(yMin, yMax);
        }
        used.push(y);
        const fromLeft = rng.chance(0.5);
        const z = spawnDanger(
          ctx,
          DangerMode.Lane,
          AreaShape.Line,
          TelegraphKind.Lane,
          fromLeft ? x0 : x1,
          y,
          0,
          pat.telegraphTicks,
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
      const len = x1 - x0;
      return Math.max(1, pat.telegraphTicks + (speed > 0 ? Math.ceil((len * 2) / speed) : 0));
    }
    default: {
      // TODO(GP, M2-xx): spiral, blink_slam, lines, cone, charge_lane. M1: one strike at the player.
      strike(ctx, pat, idx, p.x, p.y, pnum(prm, 'radius', p.radius * 4));
      return Math.max(1, pat.telegraphTicks);
    }
  }
}

/**
 * Boss tick: entry, phases, transitions, pattern cycle with gaps, enrage, swarmer trickle.
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
        startMark(ctx, trickleType, cfg.bossTrickleCount, ctx.rng.ai.int(SECTOR_IDS.length), false);
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
    }
    return;
  }
  if (run.bossPatternIndex >= 0) {
    run.bossPatternTicks--;
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
  run.bossPatternTicks = startPattern(ctx, idx);
}
