// Arena legibility rules that can be checked from data alone (LD, arena-design.md 4 to 9 and 11).
// Covers the automatable part of LD-T01 (structure, R1 to R7, R11, decor zones, budgets, spawn band,
// safe zones, particles) and LD-T10 (no light projected onto the play area). Pure: no file IO.

import type { ArenaDef, Shape, Vec2 } from '../../../src/core/index.ts';
import { DOF_SHARP_TOP_PX, worldToRef } from '../../../src/core/index.ts';
import type { Region } from './geometry.ts';
import {
  clearanceInside,
  convexClockwiseError,
  distToEdges,
  footprintPoints,
  pointInConvex,
  polygonArea,
  regionArea,
  regionBounds,
  regionDistance,
  regionOf,
  samplePoints,
} from './geometry.ts';

/** LD rule numbers. Change only together with arena-design.md. */
export const LD = {
  maxObstacles: 4, // R1
  maxObstacleHeight: 0.4, // R2
  rectShortMin: 1, // R3
  rectLongMax: 3, // R3
  circleDiameterMin: 1, // R3
  circleDiameterMax: 3, // R3
  maxCoverage: 0.05, // R4
  obstacleGap: 4, // R5
  obstacleWallGap: 4, // R6
  laneWidth: 4, // R11
  laneHalfX: 13, // R11: lanes are searched in the full-depth part of the arena, |x| <= 13
  spawnBandMin: 1.0, // 5.2
  spawnBandMax: 2.5, // 5.2
  playerSafeRadiusMin: 3, // 5.1 readability floor
  interiorMinPlayerDistMin: 2, // 5.2
  bossStartGap: 4, // 9: boss Pulse start stays this far outside the boss stage
  decorSideFrontZ: 2, // 7.1: side decor whose footprint reaches y >= 2 counts as side front
  decorSideBackMaxH: 6, // 7.1
  decorSideFrontMaxH: 2, // 7.1
  decorFrontMaxH: 0.5, // 7.1
  frontDecorTopMinPx: 303, // 7.1: front decor top stays below this reference frame y
  maxDecor: 80, // 7.4
  maxAnimated: 12, // 7.4
  maxLights: 8, // 7.4, architecture 6.10
  lightBox: { x0: 64, x1: 576, y0: DOF_SHARP_TOP_PX, y1: 303 }, // LD-T10, reference frame px
  arenaParticlesMax: 40, // 7.3
  arenaParticleSizePx: 1, // 7.3
  arenaParticleOpacityMax: 0.25, // 7.3
  arenaParticleTokens: ['bone', 'dust'] as readonly string[], // 7.3
  bossRingContrastMax: 1.15, // 9
} as const;

export const SECTORS = ['n', 's', 'e', 'w', 'ne', 'se', 'sw', 'nw'] as const;

export interface Issue {
  readonly rule: string;
  readonly level: 'error' | 'warn';
  readonly msg: string;
}

export interface CheckContext {
  /** Palette colour tokens that exist (core names and "b1.env-name" style biome names). */
  readonly tokens: ReadonlySet<string>;
  /** Tile ids that exist under art/tiles, or null to skip the check. */
  readonly tileIds: ReadonlySet<string> | null;
}

export interface CheckResult {
  readonly issues: Issue[];
  readonly metrics: Record<string, string | number>;
}

const SNAKE = /^[a-z][a-z0-9_]*$/;
const KEBAB = /^[a-z][a-z0-9-]*$/;

const KEYS: Readonly<Record<string, readonly string[]>> = {
  '': [
    'schemaVersion',
    'id',
    'arena',
    'playerStart',
    'pulseOrigin',
    'safeZones',
    'spawn',
    'bossStage',
    'lighting',
    'obstacles',
    'decor',
    'ambient',
  ],
  arena: ['boundary', 'lip', 'rim', 'projectileMargin', 'floor'],
  'arena.rim': ['height', 'colorToken', 'opacity'],
  'arena.floor': ['baseToken', 'altToken', 'tileId'],
  playerStart: ['default', 'boss'],
  'safeZones[]': ['id', 'shape', 'blocks'],
  spawn: ['playerSafeRadius', 'interiorMinPlayerDist', 'zones'],
  'spawn.zones[]': ['id', 'shape'],
  bossStage: ['shape', 'landmarkId', 'floorRingContrastMax'],
  lighting: ['edgeFade', 'points'],
  'lighting.edgeFade': ['startOutside', 'endOutside'],
  'lighting.points[]': ['id', 'pos', 'intensityMul', 'flicker'],
  'obstacles[]': ['id', 'kind', 'shape', 'height', 'blocks'],
  'decor[]': ['id', 'kind', 'zone', 'pos', 'rotYDeg', 'height', 'footprintHalf', 'anim', 'lightId'],
  ambient: ['particles'],
  'ambient.particles[]': ['kind', 'area', 'max', 'colorToken', 'opacity', 'sizePx'],
};
const SHAPE_KEYS: Readonly<Record<string, readonly string[]>> = {
  rect: ['type', 'min', 'max'],
  circle: ['type', 'center', 'radius'],
  polygon: ['type', 'points'],
};

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isVec2(v: unknown): v is Vec2 {
  return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
}
function isShape(v: unknown): v is Shape {
  if (!isObj(v)) return false;
  if (v['type'] === 'rect') return isVec2(v['min']) && isVec2(v['max']);
  if (v['type'] === 'circle') return isVec2(v['center']) && isNum(v['radius']) && v['radius'] > 0;
  if (v['type'] === 'polygon') return Array.isArray(v['points']) && v['points'].every(isVec2);
  return false;
}
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** S1: unknown fields (catches leftovers such as units, camera, nameKey, scale). */
function checkKeys(v: unknown, path: string, out: Issue[]): void {
  if (Array.isArray(v)) {
    for (const e of v) if (isObj(e)) checkKeys(e, `${path}[]`, out);
    return;
  }
  if (!isObj(v)) return;
  const allowed = path.endsWith('shape') ? (SHAPE_KEYS[String(v['type'])] ?? ['type']) : KEYS[path];
  if (allowed === undefined) return;
  for (const k of Object.keys(v)) {
    const p = path === '' ? k : `${path}.${k}`;
    if (!allowed.includes(k)) {
      const why = /scale/i.test(k)
        ? ' (decor and obstacles are never scaled, arena-design 7.2)'
        : '';
      out.push({ rule: 'S1', level: 'error', msg: `unknown field "${p}"${why}` });
    } else checkKeys(v[k], p, out);
  }
}

/** S2 to S4: types the geometric rules depend on. Returns false when the rest cannot run. */
function checkStructure(name: string, j: Record<string, unknown>, out: Issue[]): boolean {
  const err = (rule: string, msg: string): void => {
    out.push({ rule, level: 'error', msg });
  };
  const start = out.length;
  if (j['schemaVersion'] !== 1) err('S1', 'schemaVersion must be 1');
  if (j['id'] !== name) err('S1', `id must equal the file name "${name}"`);
  if (!SNAKE.test(name)) err('S1', 'id must be snake_case');
  const arena = j['arena'];
  if (!isObj(arena) || !Array.isArray(arena['boundary']) || !arena['boundary'].every(isVec2))
    err('S2', 'arena.boundary must be an array of [x, y]');
  if (!isObj(arena) || !isNum(arena['lip'])) err('S1', 'arena.lip must be a number');
  const ps = j['playerStart'];
  if (!isObj(ps) || !isVec2(ps['default']) || !isVec2(ps['boss']))
    err('S1', 'playerStart.default and .boss must be [x, y]');
  if (!isVec2(j['pulseOrigin'])) err('S1', 'pulseOrigin must be [x, y]');
  const sz = j['safeZones'];
  if (
    !Array.isArray(sz) ||
    !sz.every(
      (z) =>
        isObj(z) &&
        typeof z['id'] === 'string' &&
        isShape(z['shape']) &&
        Array.isArray(z['blocks']),
    )
  )
    err('S1', 'safeZones[] needs id, shape, blocks');
  const sp = j['spawn'];
  if (
    !isObj(sp) ||
    !isNum(sp['playerSafeRadius']) ||
    !isNum(sp['interiorMinPlayerDist']) ||
    !Array.isArray(sp['zones']) ||
    !sp['zones'].every((z) => isObj(z) && typeof z['id'] === 'string' && isShape(z['shape']))
  )
    err('S1', 'spawn needs playerSafeRadius, interiorMinPlayerDist, zones[] with id and shape');
  const bs = j['bossStage'];
  if (
    !isObj(bs) ||
    !isShape(bs['shape']) ||
    typeof bs['landmarkId'] !== 'string' ||
    !isNum(bs['floorRingContrastMax'])
  )
    err('S1', 'bossStage needs shape, landmarkId, floorRingContrastMax');
  const li = j['lighting'];
  if (
    !isObj(li) ||
    !isObj(li['edgeFade']) ||
    !Array.isArray(li['points']) ||
    !li['points'].every(
      (p) =>
        isObj(p) &&
        typeof p['id'] === 'string' &&
        Array.isArray(p['pos']) &&
        p['pos'].length === 3 &&
        p['pos'].every(isNum),
    )
  )
    err('S1', 'lighting needs edgeFade and points[] with id and pos [x, h, y]');
  const ob = j['obstacles'];
  if (
    !Array.isArray(ob) ||
    !ob.every(
      (o) =>
        isObj(o) &&
        typeof o['id'] === 'string' &&
        typeof o['kind'] === 'string' &&
        isShape(o['shape']) &&
        isNum(o['height']) &&
        Array.isArray(o['blocks']),
    )
  )
    err('S1', 'obstacles[] needs id, kind, shape, height, blocks');
  const de = j['decor'];
  if (
    !Array.isArray(de) ||
    !de.every(
      (d) =>
        isObj(d) &&
        typeof d['id'] === 'string' &&
        typeof d['kind'] === 'string' &&
        (d['zone'] === 'back' || d['zone'] === 'side' || d['zone'] === 'front') &&
        isVec2(d['pos']) &&
        isNum(d['rotYDeg']) &&
        isNum(d['height']) &&
        isVec2(d['footprintHalf']),
    )
  )
    err(
      'S1',
      'decor[] needs id, kind, zone (back, side, front), pos, rotYDeg, height, footprintHalf',
    );
  const am = j['ambient'];
  if (
    !isObj(am) ||
    !Array.isArray(am['particles']) ||
    !am['particles'].every(
      (p) =>
        isObj(p) &&
        typeof p['kind'] === 'string' &&
        (p['area'] === 'arena' || p['area'] === 'decor') &&
        isNum(p['max']) &&
        typeof p['colorToken'] === 'string' &&
        isNum(p['opacity']) &&
        isNum(p['sizePx']),
    )
  )
    err('S1', 'ambient.particles[] needs kind, area, max, colorToken, opacity, sizePx');
  return out.length === start;
}

function uniqueIds(list: readonly { readonly id: string }[], what: string, out: Issue[]): void {
  const seen = new Set<string>();
  for (const { id } of list) {
    if (!SNAKE.test(id))
      out.push({ rule: 'S1', level: 'error', msg: `${what} id "${id}" must be snake_case` });
    if (seen.has(id))
      out.push({ rule: 'S1', level: 'error', msg: `${what} id "${id}" is duplicated` });
    seen.add(id);
  }
}

function polygonShapes(a: ArenaDef): { label: string; pts: readonly Vec2[] }[] {
  const out: { label: string; pts: readonly Vec2[] }[] = [
    { label: 'arena.boundary', pts: a.arena.boundary },
  ];
  const add = (label: string, s: Shape): void => {
    if (s.type === 'polygon') out.push({ label, pts: s.points });
  };
  for (const z of a.safeZones) add(`safeZones.${z.id}`, z.shape);
  for (const z of a.spawn.zones) add(`spawn.zones.${z.id}`, z.shape);
  add('bossStage', a.bossStage.shape);
  for (const o of a.obstacles) add(`obstacles.${o.id}`, o.shape);
  return out;
}

function rectSides(s: Shape): readonly [number, number] | null {
  if (s.type !== 'rect') return null;
  const w = s.max[0] - s.min[0];
  const h = s.max[1] - s.min[1];
  return [Math.min(w, h), Math.max(w, h)];
}

/** Runs every automatable LD check on one parsed arena file. */
export function checkArena(name: string, json: unknown, ctx: CheckContext): CheckResult {
  const issues: Issue[] = [];
  const metrics: Record<string, string | number> = {};
  const err = (rule: string, msg: string): void => {
    issues.push({ rule, level: 'error', msg });
  };
  const warn = (rule: string, msg: string): void => {
    issues.push({ rule, level: 'warn', msg });
  };
  if (!isObj(json)) {
    err('S1', 'arena file must be a JSON object');
    return { issues, metrics };
  }
  checkKeys(json, '', issues);
  if (!checkStructure(name, json, issues)) return { issues, metrics };
  const a = json as unknown as ArenaDef;
  const B = a.arena.boundary;
  const lip = a.arena.lip;

  // S2: every polygon convex and clockwise on screen (architecture 9.6 point 5).
  for (const { label, pts } of polygonShapes(a)) {
    const e = convexClockwiseError(pts);
    if (e !== null) err('S2', `${label} ${e}`);
  }
  if (convexClockwiseError(B) !== null) return { issues, metrics };
  for (const s of [
    ...a.safeZones.map((z) => z.shape),
    ...a.spawn.zones.map((z) => z.shape),
    a.bossStage.shape,
    ...a.obstacles.map((o) => o.shape),
  ]) {
    if (s.type === 'rect' && (s.min[0] >= s.max[0] || s.min[1] >= s.max[1]))
      err('S2', 'rect min must be smaller than max on both axes');
  }

  // S3: boundary inside the fixed 32 x 20 u frame; area for R4.
  const bx = B.map((p) => p[0]);
  const by = B.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...bx),
    Math.max(...bx),
    Math.min(...by),
    Math.max(...by),
  ];
  if (minX < -16 || maxX > 16 || minY < -10 || maxY > 10)
    err('S3', 'arena.boundary leaves the 32 x 20 u frame (architecture 7.3)');
  const area = polygonArea(B);
  metrics['area_u2'] = r2(area);
  if (lip < 1) err('S3', `arena.lip ${lip} must be at least 1 u (arena-design 4.3)`);

  // S4: ids, tokens, asset ids.
  uniqueIds(a.safeZones, 'safeZones', issues);
  uniqueIds(a.spawn.zones, 'spawn.zones', issues);
  uniqueIds(a.lighting.points, 'lighting.points', issues);
  uniqueIds(a.obstacles, 'obstacles', issues);
  uniqueIds(a.decor, 'decor', issues);
  const tokenFields: [string, string][] = [
    ['arena.rim.colorToken', a.arena.rim.colorToken],
    ['arena.floor.baseToken', a.arena.floor.baseToken],
    ['arena.floor.altToken', a.arena.floor.altToken],
    ...a.ambient.particles.map((p): [string, string] => [
      `ambient.particles.${p.kind}.colorToken`,
      p.colorToken,
    ]),
  ];
  for (const [field, tok] of tokenFields) {
    if (/^#/.test(tok))
      err(
        'S4',
        `${field} "${tok}" is a hex colour; use a palette token (architecture 9.6 point 4)`,
      );
    else if (!ctx.tokens.has(tok))
      err('S4', `${field} "${tok}" is not a token in art/palette.json`);
  }
  if (ctx.tileIds !== null && !ctx.tileIds.has(a.arena.floor.tileId))
    warn(
      'S4',
      `arena.floor.tileId "${a.arena.floor.tileId}" has no art/tiles/${a.arena.floor.tileId}.json yet (AD)`,
    );
  for (const k of [
    ...a.obstacles.map((o) => o.kind),
    ...a.decor.map((d) => d.kind),
    a.bossStage.landmarkId,
  ]) {
    if (!KEBAB.test(k)) err('S4', `asset id "${k}" must be kebab-case (architecture 9.6 point 6)`);
  }

  // Z: start points and boss stage.
  const startZones = a.safeZones.filter((z) => z.blocks.includes('spawn'));
  const inB = (p: Vec2): boolean => pointInConvex(B, p);
  if (!inB(a.playerStart.default)) err('Z1', 'playerStart.default is outside the boundary');
  if (!inB(a.playerStart.boss)) err('Z1', 'playerStart.boss is outside the boundary');
  if (!inB(a.pulseOrigin)) err('Z1', 'pulseOrigin is outside the boundary');
  const startCircle: Region = { kind: 'circle', c: a.playerStart.default, r: 0 };
  if (!startZones.some((z) => regionDistance(regionOf(z.shape), startCircle) === 0))
    err('Z1', 'playerStart.default must lie inside a safe zone that blocks spawn (start ring)');
  const stage = regionOf(a.bossStage.shape);
  if (clearanceInside(B, stage) < 0) err('Z2', 'bossStage.shape leaves the boundary');
  const stageCover = a.safeZones.some(
    (z) =>
      z.blocks.includes('obstacle') &&
      JSON.stringify(z.shape) === JSON.stringify(a.bossStage.shape),
  );
  if (!stageCover)
    err(
      'Z2',
      'a safe zone with the same shape as bossStage must block obstacles (arena-design 5.1)',
    );
  const bossGap = regionDistance(stage, { kind: 'circle', c: a.playerStart.boss, r: 0 });
  metrics['boss_start_gap_u'] = r2(bossGap);
  if (bossGap < LD.bossStartGap)
    err(
      'Z2',
      `playerStart.boss is ${r2(bossGap)} u from the boss stage, needs ${LD.bossStartGap} u`,
    );
  if (a.bossStage.floorRingContrastMax > LD.bossRingContrastMax)
    err(
      'Z2',
      `bossStage.floorRingContrastMax ${a.bossStage.floorRingContrastMax} above ${LD.bossRingContrastMax}`,
    );

  // SP: spawn sectors (arena-design 5.2) and safe zones (5.1).
  const ids = a.spawn.zones.map((z) => z.id);
  for (const s of SECTORS) if (!ids.includes(s)) err('SP1', `spawn sector "${s}" missing`);
  for (const id of ids)
    if (!(SECTORS as readonly string[]).includes(id)) err('SP1', `unknown spawn sector "${id}"`);
  let bandMin = Infinity;
  let bandMax = -Infinity;
  let nearestSpawn = Infinity;
  for (const z of a.spawn.zones) {
    const r = regionOf(z.shape);
    for (const p of samplePoints(r, 0.25)) {
      const d = inB(p) ? distToEdges(B, p) : -distToEdges(B, p);
      bandMin = Math.min(bandMin, d);
      bandMax = Math.max(bandMax, d);
      if (d < LD.spawnBandMin - 1e-6 || d > LD.spawnBandMax + 1e-6) {
        err(
          'SP1',
          `spawn sector "${z.id}" point [${r2(p[0])}, ${r2(p[1])}] is ${r2(d)} u inside the boundary, band is ${LD.spawnBandMin} to ${LD.spawnBandMax}`,
        );
        break;
      }
    }
    for (const sz of startZones) {
      if (regionDistance(r, regionOf(sz.shape)) === 0)
        err('SP2', `spawn sector "${z.id}" overlaps safe zone "${sz.id}" that blocks spawn`);
    }
    nearestSpawn = Math.min(nearestSpawn, regionDistance(r, startCircle));
  }
  metrics['spawn_band_u'] = `${r2(bandMin)} to ${r2(bandMax)}`;
  metrics['spawn_to_start_u'] = r2(nearestSpawn);
  if (nearestSpawn < a.spawn.playerSafeRadius)
    err(
      'SP2',
      `nearest spawn sector is ${r2(nearestSpawn)} u from playerStart.default, below playerSafeRadius`,
    );
  if (a.spawn.playerSafeRadius < LD.playerSafeRadiusMin)
    err(
      'SP3',
      `spawn.playerSafeRadius ${a.spawn.playerSafeRadius} below the readability floor ${LD.playerSafeRadiusMin}`,
    );
  if (a.spawn.interiorMinPlayerDist < LD.interiorMinPlayerDistMin)
    err('SP3', `spawn.interiorMinPlayerDist below ${LD.interiorMinPlayerDistMin}`);

  // R: obstacles (arena-design 6.1).
  const obs = a.obstacles.map((o) => ({ o, r: regionOf(o.shape) }));
  if (obs.length > LD.maxObstacles) err('R1', `${obs.length} obstacles, max ${LD.maxObstacles}`);
  let covered = 0;
  for (const { o, r } of obs) {
    if (o.height > LD.maxObstacleHeight)
      err('R2', `obstacle "${o.id}" height ${o.height} above ${LD.maxObstacleHeight} u`);
    if (o.height <= 0) err('R2', `obstacle "${o.id}" height must be positive`);
    const sides = rectSides(o.shape);
    if (o.shape.type === 'polygon') err('R3', `obstacle "${o.id}" must be a rect or circle`);
    if (sides !== null && (sides[0] < LD.rectShortMin || sides[1] > LD.rectLongMax))
      err(
        'R3',
        `obstacle "${o.id}" rect ${r2(sides[0])} x ${r2(sides[1])} u, needs short side >= ${LD.rectShortMin} and long side <= ${LD.rectLongMax}`,
      );
    if (
      o.shape.type === 'circle' &&
      (o.shape.radius * 2 < LD.circleDiameterMin || o.shape.radius * 2 > LD.circleDiameterMax)
    )
      err(
        'R3',
        `obstacle "${o.id}" circle diameter ${o.shape.radius * 2} outside ${LD.circleDiameterMin} to ${LD.circleDiameterMax} u`,
      );
    covered += regionArea(r);
    const wall = clearanceInside(B, r);
    if (wall < LD.obstacleWallGap - 1e-6)
      err(
        'R6',
        `obstacle "${o.id}" is ${r2(wall)} u from the boundary, needs ${LD.obstacleWallGap}`,
      );
    for (const z of a.safeZones) {
      if (z.blocks.includes('obstacle') && regionDistance(r, regionOf(z.shape)) === 0)
        err('R7', `obstacle "${o.id}" overlaps safe zone "${z.id}"`);
    }
    for (const z of a.spawn.zones) {
      if (regionDistance(r, regionOf(z.shape)) === 0)
        err('R7', `obstacle "${o.id}" overlaps spawn sector "${z.id}"`);
    }
    if (!o.blocks.includes('move')) err('R9', `obstacle "${o.id}" must block move`);
    if (o.blocks.includes('projectile'))
      warn('R9', `obstacle "${o.id}" blocks projectiles; only valid once GD decides so`);
  }
  for (let i = 0; i < obs.length; i++) {
    for (let k = i + 1; k < obs.length; k++) {
      const p = obs[i];
      const q = obs[k];
      if (p === undefined || q === undefined) continue;
      const d = regionDistance(p.r, q.r);
      if (d < LD.obstacleGap - 1e-6)
        err(
          'R5',
          `obstacles "${p.o.id}" and "${q.o.id}" are ${r2(d)} u apart, needs ${LD.obstacleGap}`,
        );
    }
  }
  metrics['obstacles'] = obs.length;
  metrics['coverage_pct'] = r2((covered / area) * 100);
  if (covered > area * LD.maxCoverage)
    err('R4', `obstacle coverage ${r2(covered)} u2 above ${r2(area * LD.maxCoverage)} u2 (5%)`);
  // R11: each half keeps a straight north-south lane at least laneWidth wide.
  for (const [label, lo, hi] of [
    ['west', -LD.laneHalfX, 0],
    ['east', 0, LD.laneHalfX],
  ] as const) {
    const spans = obs
      .map(({ r }) => regionBounds(r))
      .map((b): [number, number] => [Math.max(lo, b[0]), Math.min(hi, b[2])])
      .filter(([s, e]) => e > s)
      .sort((p, q) => p[0] - q[0]);
    let cursor: number = lo;
    let best = 0;
    for (const [s, e] of spans) {
      best = Math.max(best, s - cursor);
      cursor = Math.max(cursor, e);
    }
    best = Math.max(best, hi - cursor);
    if (best < LD.laneWidth - 1e-6)
      err(
        'R11',
        `${label} half has no north-south lane ${LD.laneWidth} u wide (widest ${r2(best)} u)`,
      );
  }

  // D: decor (arena-design 7.1, 7.4).
  const backMaxY = minY - lip;
  const sideMinAbsX = maxX + lip;
  const frontMinY = maxY + lip;
  const lightIds = new Set(a.lighting.points.map((p) => p.id));
  let animated = 0;
  let minDecorGap = Infinity;
  const ref = { x: 0, y: 0 };
  for (const d of a.decor) {
    const pts = footprintPoints(d.pos, d.footprintHalf, d.rotYDeg);
    const fx = pts.map((p) => p[0]);
    const fy = pts.map((p) => p[1]);
    const [dMinX, dMaxX, dMinY, dMaxY] = [
      Math.min(...fx),
      Math.max(...fx),
      Math.min(...fy),
      Math.max(...fy),
    ];
    const gap = regionDistance({ kind: 'poly', pts }, { kind: 'poly', pts: B });
    minDecorGap = Math.min(minDecorGap, gap);
    if (gap < lip - 1e-6)
      err(
        'D1',
        `decor "${d.id}" footprint is ${r2(gap)} u from the boundary, must stay outside the ${lip} u lip`,
      );
    if (d.footprintHalf[0] <= 0 || d.footprintHalf[1] <= 0)
      err('D1', `decor "${d.id}" footprintHalf must be positive`);
    if (d.height <= 0) err('D2', `decor "${d.id}" height must be positive`);
    if (d.zone === 'back') {
      if (dMaxY > backMaxY + 1e-6)
        err('D2', `back decor "${d.id}" reaches y ${r2(dMaxY)}, back zone needs y <= ${backMaxY}`);
    } else if (d.zone === 'side') {
      const left = dMaxX <= -sideMinAbsX + 1e-6;
      const right = dMinX >= sideMinAbsX - 1e-6;
      if (!left && !right) err('D2', `side decor "${d.id}" enters |x| < ${sideMinAbsX}`);
      const cap = dMaxY >= LD.decorSideFrontZ ? LD.decorSideFrontMaxH : LD.decorSideBackMaxH;
      if (d.height > cap)
        err(
          'D2',
          `side decor "${d.id}" height ${d.height} above ${cap} u for its depth (front edge y ${r2(dMaxY)})`,
        );
    } else {
      if (dMinY < frontMinY - 1e-6)
        err(
          'D2',
          `front decor "${d.id}" reaches y ${r2(dMinY)}, front zone needs y >= ${frontMinY}`,
        );
      if (d.height > LD.decorFrontMaxH)
        err('D2', `front decor "${d.id}" height ${d.height} above ${LD.decorFrontMaxH} u`);
      worldToRef(0, dMinY, d.height, ref);
      if (ref.y < LD.frontDecorTopMinPx)
        err(
          'D2',
          `front decor "${d.id}" top projects to y ${r2(ref.y)}, must stay at or below y ${LD.frontDecorTopMinPx}`,
        );
    }
    if (d.anim !== undefined) animated++;
    if (d.lightId !== undefined && !lightIds.has(d.lightId))
      err('D3', `decor "${d.id}" lightId "${d.lightId}" is not a lighting point`);
  }
  metrics['decor'] = a.decor.length;
  metrics['decor_animated'] = animated;
  if (a.decor.length > 0) metrics['decor_min_gap_u'] = r2(minDecorGap);
  if (a.decor.length > LD.maxDecor)
    err('D4', `${a.decor.length} decor objects, max ${LD.maxDecor}`);
  if (animated > LD.maxAnimated)
    err('D4', `${animated} animated decor objects, max ${LD.maxAnimated}`);

  // L: lights (arena-design 7.1, 8; LD-T10).
  const pts = a.lighting.points;
  metrics['lights'] = pts.length;
  if (pts.length > LD.maxLights) err('L1', `${pts.length} light points, max ${LD.maxLights}`);
  for (const p of pts) {
    const [x, h, y] = p.pos;
    if (inB([x, y])) err('L2', `light "${p.id}" stands inside the boundary`);
    if (h < 0) err('L2', `light "${p.id}" height below the floor`);
    worldToRef(x, y, h, ref);
    const box = LD.lightBox;
    if (ref.x >= box.x0 && ref.x <= box.x1 && ref.y >= box.y0 && ref.y <= box.y1)
      err(
        'L3',
        `light "${p.id}" projects to [${r2(ref.x)}, ${r2(ref.y)}] px, inside the play area box x ${box.x0} to ${box.x1}, y ${box.y0} to ${box.y1} (LD-T10)`,
      );
    if (p.flicker !== undefined && (p.flicker < 0 || p.flicker > 1))
      err('L4', `light "${p.id}" flicker must be 0 to 1`);
    if (p.intensityMul !== undefined && p.intensityMul <= 0)
      err('L4', `light "${p.id}" intensityMul must be positive`);
  }
  const ef = a.lighting.edgeFade;
  if (
    !isNum(ef.startOutside) ||
    !isNum(ef.endOutside) ||
    ef.startOutside < lip ||
    ef.endOutside <= ef.startOutside
  )
    err('L5', 'lighting.edgeFade needs lip <= startOutside < endOutside');

  // P: ambient particles over the play area (arena-design 7.3; LD-T09 data half).
  let arenaParticles = 0;
  for (const p of a.ambient.particles) {
    if (p.area !== 'arena') continue;
    arenaParticles += p.max;
    if (p.sizePx !== LD.arenaParticleSizePx)
      err('P1', `arena particle "${p.kind}" sizePx must be ${LD.arenaParticleSizePx}`);
    if (p.opacity > LD.arenaParticleOpacityMax)
      err('P1', `arena particle "${p.kind}" opacity above ${LD.arenaParticleOpacityMax}`);
    if (!LD.arenaParticleTokens.includes(p.colorToken))
      err(
        'P1',
        `arena particle "${p.kind}" colour must be ${LD.arenaParticleTokens.join(' or ')} (never gold, cyan, or red)`,
      );
  }
  if (arenaParticles > LD.arenaParticlesMax)
    err('P1', `${arenaParticles} particles over the play area, max ${LD.arenaParticlesMax}`);

  return { issues, metrics };
}
