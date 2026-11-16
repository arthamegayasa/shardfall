// Sim events to cue triggers (architecture 6.5 payload table, docs/audio-list.md).
// Routing data lives in src/audio/cues/routes.json; id-based tables are resolved once at boot
// against GameData, so the per-frame path only reads typed arrays.

import {
  DAMAGE_HIT_KIND_SHIFT,
  DAMAGE_RANK_SHIFT,
  DamageFlag,
  EnemyRank,
  HitKind,
  RejectReason,
  RunOutcome,
  RunPhaseCode,
  SimEventType,
  SourceKind,
  TICK_RATE,
  TelegraphKind,
  sourceIndexOf,
  sourceKindOf,
} from '../core/index.ts';
import type { SimEventReader } from '../core/index.ts';
import type { GameData } from '../content/index.ts';
import type { CueTable } from './cue-data.ts';
import type { TriggerList } from './triggers.ts';

type CueRef = string | null;
interface StartResolve {
  readonly start: CueRef;
  readonly resolve: CueRef;
}

/** Shape of routes.json (docs/audio-list.md section 1.3). */
export interface Routes {
  readonly simple: Readonly<Record<string, readonly string[]>>;
  readonly silent: readonly string[];
  readonly weapons: {
    readonly fireByArchetype: Readonly<Record<string, CueRef>>;
    readonly fireById: Readonly<Record<string, { readonly cue: CueRef; readonly semis?: number }>>;
    readonly impactByArchetype: Readonly<Record<string, CueRef>>;
    readonly hit: string;
    readonly hitCrit: string;
  };
  readonly enemies: {
    readonly deathBySize: Readonly<Record<string, CueRef>>;
    readonly deathById: Readonly<Record<string, CueRef>>;
    readonly hurtWarden: string;
    readonly hurtBoss: string;
  };
  readonly rites: {
    readonly byArchetype: Readonly<
      Record<string, { readonly cast: CueRef; readonly impact: CueRef; readonly impactDelayMs?: number }>
    >;
    readonly ready: string;
    readonly readySuppressAfterPulseStartMs: number;
  };
  readonly procs: {
    readonly byOwner: Readonly<Record<string, CueRef>>;
    readonly byAction: Readonly<Record<string, CueRef>>;
  };
  readonly telegraphs: {
    readonly byKind: Readonly<Record<string, StartResolve>>;
    readonly wardenCharge: StartResolve;
    readonly bossPatternByArchetype: Readonly<Record<string, StartResolve>>;
    readonly affixById: Readonly<Record<string, StartResolve>>;
    readonly wardenChargeStepSemis: number;
  };
  readonly affixApplied: Readonly<Record<string, CueRef>>;
  readonly enemyShots: { readonly default: CueRef; readonly fromAffix: CueRef };
  readonly glint: string;
  readonly synergy: { readonly cue: string; readonly semisByThreshold: Readonly<Record<string, number>> };
  readonly merge: { readonly cue: string; readonly semisByTier: Readonly<Record<string, number>> };
  readonly lock: { readonly cue: string; readonly unlockSemis: number };
  readonly rejected: { readonly cue: string; readonly silentReasons: readonly string[] };
  readonly phaseEnter: Readonly<Record<string, CueRef>>;
  readonly runEnded: Readonly<Record<string, CueRef>>;
}

/** Events handled in code below; every other SimEventType must be in routes.simple or routes.silent. */
export const CODED_EVENTS: readonly string[] = [
  'PhaseChanged',
  'RunEnded',
  'PlayerHpLowChanged',
  'WeaponFired',
  'RiteCast',
  'RiteReady',
  'SynergyActivated',
  'EnemyDamaged',
  'EnemyKilled',
  'EnemyProjectileFired',
  'TelegraphStarted',
  'TelegraphResolved',
  'AffixApplied',
  'GlintCollected',
  'ProcTriggered',
  'ItemMerged',
  'ItemLocked',
  'CommandRejected',
];

/** Side information for the engine and music director, rewritten every map() call. */
export interface MapSignals {
  /** -1 unchanged, 0 left low HP, 1 entered low HP. */
  lowHp: number;
  playerDied: boolean;
  /** Longest telegraph started this frame, seconds (telegraph duck hold). */
  telegraphSec: number;
}

export interface EventMap {
  /**
   * Maps one frame of events into triggers. ladder = glintLadder MIDI notes of the active song.
   * nowSec = audio clock, used for the Glint streak reset and the Rite-ready suppression.
   */
  map(events: SimEventReader, out: TriggerList, nowSec: number, ladder: readonly number[]): void;
  readonly signals: MapSignals;
}

/** Resolution of one content id, exported for the coverage test and docs. */
export interface CoverageRow {
  readonly table: string;
  readonly id: string;
  readonly cue: string | null;
  readonly via: 'id' | 'fallback' | 'declared-silent';
}

const NONE = -1;

function resolveCue(cues: CueTable, id: CueRef, where: string): number {
  if (id === null) return NONE;
  const i = cues.indexOf.get(id);
  if (i === undefined) throw new Error(`routes.json: unknown cue "${id}" (${where})`);
  return i;
}

/** Throws when routes reference unknown cues or leave an event type unrouted. */
export function validateRoutes(routes: Routes, cues: CueTable): string[] {
  const errors: string[] = [];
  const check = (id: CueRef, where: string): void => {
    if (id !== null && !cues.indexOf.has(id)) errors.push(`routes.json ${where}: unknown cue "${id}"`);
  };
  const walk = (v: unknown, where: string): void => {
    if (typeof v === 'string' && /^(sfx|ui|mus|amb)\./.test(v)) check(v, where);
    else if (Array.isArray(v)) {
      v.forEach((x, i) => {
        walk(x, `${where}[${i}]`);
      });
    }
    else if (typeof v === 'object' && v !== null) {
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
    }
  };
  walk(routes, 'routes');
  const routed = new Set([...Object.keys(routes.simple), ...routes.silent, ...CODED_EVENTS]);
  for (const name of Object.keys(SimEventType)) {
    if (!routed.has(name)) errors.push(`routes.json: event ${name} is neither routed nor declared silent`);
  }
  for (const name of Object.keys(routes.simple)) {
    if (!(name in SimEventType)) errors.push(`routes.json simple: unknown event ${name}`);
  }
  return errors;
}

function weaponFire(routes: Routes, w: { id: string; archetype: string }): { cue: CueRef; semis: number; via: CoverageRow['via'] } {
  const byId = routes.weapons.fireById[w.id];
  if (byId !== undefined) return { cue: byId.cue, semis: byId.semis ?? 0, via: byId.cue === null ? 'declared-silent' : 'id' };
  const cue = routes.weapons.fireByArchetype[w.archetype];
  if (cue === undefined) throw new Error(`routes.json: no fire cue for weapon archetype "${w.archetype}"`);
  return { cue, semis: 0, via: cue === null ? 'declared-silent' : 'fallback' };
}

function enemyDeath(routes: Routes, e: { id: string; sizeClass: string }): { cue: CueRef; via: CoverageRow['via'] } {
  const byId = routes.enemies.deathById[e.id];
  if (byId !== undefined) return { cue: byId, via: byId === null ? 'declared-silent' : 'id' };
  const cue = routes.enemies.deathBySize[e.sizeClass];
  if (cue === undefined) throw new Error(`routes.json: no death cue for size class "${e.sizeClass}"`);
  return { cue, via: cue === null ? 'declared-silent' : 'fallback' };
}

function procCue(routes: Routes, e: { owner: string; action: string }): { cue: CueRef; via: CoverageRow['via'] } {
  const byOwner = routes.procs.byOwner[e.owner];
  if (byOwner !== undefined) return { cue: byOwner, via: byOwner === null ? 'declared-silent' : 'id' };
  const cue = routes.procs.byAction[e.action];
  if (cue === undefined) throw new Error(`routes.json: no proc cue for action "${e.action}"`);
  return { cue, via: cue === null ? 'declared-silent' : 'fallback' };
}

/** Telegraph kind an enemy role most likely uses (cache warming only; misses just render later). */
const ROLE_KIND: Readonly<Record<string, string>> = {
  charger: 'Charge',
  shooter: 'Projectile',
  lobber: 'Area',
  exploder: 'Area',
  summoner: 'Area',
};

/**
 * Live telegraph cues and the durations the data will ask for, so the engine can render them at
 * boot instead of on the first telegraph (one render costs a few ms on the main thread).
 */
export function liveWarmupPairs(data: GameData, routes: Routes): { cue: string; durSec: number }[] {
  const out: { cue: string; durSec: number }[] = [];
  const add = (cue: CueRef | undefined, ticks: number): void => {
    if (cue !== null && cue !== undefined && ticks > 0) out.push({ cue, durSec: ticks / TICK_RATE });
  };
  const t = routes.telegraphs;
  for (const e of data.enemies) {
    if (e.role === 'warden') add(t.wardenCharge.start, e.telegraphTicks);
    else add(t.byKind[ROLE_KIND[e.role] ?? '']?.start, e.telegraphTicks);
  }
  for (const p of data.bossPatterns) {
    add((t.bossPatternByArchetype[p.archetype] ?? t.byKind['BossArea'])?.start, p.telegraphTicks);
  }
  for (const a of data.affixes) add(t.affixById[a.id]?.start, a.telegraphTicks);
  return out;
}

/** How every weapon, enemy, Rite, effect, and boss pattern of data resolves to a cue. */
export function describeCoverage(data: GameData, routes: Routes): CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const w of data.weapons) rows.push({ table: 'weapons', id: w.id, ...pick(weaponFire(routes, w)) });
  for (const e of data.enemies) rows.push({ table: 'enemies', id: e.id, ...enemyDeath(routes, e) });
  for (const r of data.rites) {
    const route = routes.rites.byArchetype[r.archetype];
    if (route === undefined) throw new Error(`routes.json: no cue for rite archetype "${r.archetype}"`);
    rows.push({ table: 'rites', id: r.id, cue: route.cast, via: route.cast === null ? 'declared-silent' : 'fallback' });
  }
  for (const e of data.effects) rows.push({ table: 'effects', id: e.id, ...procCue(routes, e) });
  for (const p of data.bossPatterns) {
    const sr = routes.telegraphs.bossPatternByArchetype[p.archetype];
    rows.push({
      table: 'boss_patterns',
      id: p.id,
      cue: sr?.start ?? null,
      via: sr === undefined ? 'fallback' : sr.start === null ? 'declared-silent' : 'id',
    });
  }
  return rows;
}

function pick(v: { cue: CueRef; via: CoverageRow['via'] }): { cue: CueRef; via: CoverageRow['via'] } {
  return { cue: v.cue, via: v.via };
}

export function createEventMap(data: GameData, cues: CueTable, routes: Routes): EventMap {
  const errors = validateRoutes(routes, cues);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const cue = (id: CueRef, where: string): number => resolveCue(cues, id, where);

  // Per-content tables resolved once (typed arrays, no lookups by string per event).
  const wFire = new Int32Array(data.weapons.length);
  const wSemis = new Float64Array(data.weapons.length);
  const wImpact = new Int32Array(data.weapons.length);
  data.weapons.forEach((w, i) => {
    const f = weaponFire(routes, w);
    wFire[i] = cue(f.cue, `weapon ${w.id}`);
    wSemis[i] = f.semis;
    wImpact[i] = cue(routes.weapons.impactByArchetype[w.archetype] ?? null, `weapon ${w.id} impact`);
  });
  const eDeath = new Int32Array(data.enemies.length);
  const eIsWarden = new Uint8Array(data.enemies.length);
  data.enemies.forEach((e, i) => {
    eDeath[i] = cue(enemyDeath(routes, e).cue, `enemy ${e.id}`);
    eIsWarden[i] = e.role === 'warden' ? 1 : 0;
  });
  const rCast = new Int32Array(data.rites.length);
  const rImpact = new Int32Array(data.rites.length);
  const rDelay = new Float64Array(data.rites.length);
  data.rites.forEach((r, i) => {
    const route = routes.rites.byArchetype[r.archetype];
    rCast[i] = cue(route?.cast ?? null, `rite ${r.id}`);
    rImpact[i] = cue(route?.impact ?? null, `rite ${r.id} impact`);
    rDelay[i] = (route?.impactDelayMs ?? 0) / 1000;
  });
  const pCue = new Int32Array(data.effects.length);
  data.effects.forEach((e, i) => {
    pCue[i] = cue(procCue(routes, e).cue, `effect ${e.id}`);
  });
  const sr = (r: StartResolve | undefined, where: string): readonly [number, number] => [
    cue(r?.start ?? null, where),
    cue(r?.resolve ?? null, where),
  ];
  const kindStart = new Int32Array(16).fill(NONE);
  const kindResolve = new Int32Array(16).fill(NONE);
  for (const [name, code] of Object.entries(TelegraphKind)) {
    const [s, r] = sr(routes.telegraphs.byKind[name], `telegraph ${name}`);
    kindStart[code] = s;
    kindResolve[code] = r;
  }
  const [wardenChargeStart, wardenChargeResolve] = sr(routes.telegraphs.wardenCharge, 'wardenCharge');
  const bpStart = new Int32Array(data.bossPatterns.length).fill(NONE);
  const bpResolve = new Int32Array(data.bossPatterns.length).fill(NONE);
  const bpHasRoute = new Uint8Array(data.bossPatterns.length);
  data.bossPatterns.forEach((p, i) => {
    const r = routes.telegraphs.bossPatternByArchetype[p.archetype];
    if (r === undefined) return;
    bpHasRoute[i] = 1;
    [bpStart[i], bpResolve[i]] = sr(r, `boss pattern ${p.id}`);
  });
  const afStart = new Int32Array(data.affixes.length).fill(NONE);
  const afResolve = new Int32Array(data.affixes.length).fill(NONE);
  const afHasRoute = new Uint8Array(data.affixes.length);
  const afApplied = new Int32Array(data.affixes.length);
  data.affixes.forEach((a, i) => {
    const r = routes.telegraphs.affixById[a.id];
    if (r !== undefined) {
      afHasRoute[i] = 1;
      [afStart[i], afResolve[i]] = sr(r, `affix ${a.id}`);
    }
    afApplied[i] = cue(routes.affixApplied[a.id] ?? null, `affix applied ${a.id}`);
  });

  const simple: Int32Array[] = [];
  for (const [name, list] of Object.entries(routes.simple)) {
    const code = SimEventType[name as keyof typeof SimEventType];
    simple[code] = Int32Array.from(list.map((id) => cue(id, `simple ${name}`)));
  }

  const cHit = cue(routes.weapons.hit, 'hit');
  const cCrit = cue(routes.weapons.hitCrit, 'hitCrit');
  const cHurtWarden = cue(routes.enemies.hurtWarden, 'hurtWarden');
  const cHurtBoss = cue(routes.enemies.hurtBoss, 'hurtBoss');
  const cReady = cue(routes.rites.ready, 'ready');
  const cShot = cue(routes.enemyShots.default, 'enemyShots');
  const cShotAffix = cue(routes.enemyShots.fromAffix, 'enemyShots affix');
  const cGlint = cue(routes.glint, 'glint');
  const cSynergy = cue(routes.synergy.cue, 'synergy');
  const cMerge = cue(routes.merge.cue, 'merge');
  const cLock = cue(routes.lock.cue, 'lock');
  const cRejected = cue(routes.rejected.cue, 'rejected');
  const silentReject = new Uint8Array(16);
  for (const r of routes.rejected.silentReasons) {
    const code = (RejectReason as Readonly<Record<string, number | undefined>>)[r];
    if (code !== undefined) silentReject[code] = 1;
  }
  const phaseCue = new Int32Array(8).fill(NONE);
  for (const [phase, code] of Object.entries(RunPhaseCode)) phaseCue[code] = cue(routes.phaseEnter[phase] ?? null, `phase ${phase}`);
  const runCue = new Int32Array(4).fill(NONE);
  for (const [name, code] of Object.entries(RunOutcome)) runCue[code] = cue(routes.runEnded[name] ?? null, `runEnded ${name}`);
  const glintCue = cues.cues[cGlint];
  const glintResetSec = (glintCue?.ladder?.resetMs ?? 500) / 1000;
  const glintBase = glintCue?.ladder?.baseMidi ?? 86;
  const readySuppressSec = routes.rites.readySuppressAfterPulseStartMs / 1000;
  const wardenStep = routes.telegraphs.wardenChargeStepSemis;

  // Mutable state across frames.
  let lastPulseStart = -Infinity;
  let glintStep = 0;
  let lastGlint = -Infinity;
  let wardenSeq = 0;
  let lastWardenCharge = -Infinity;
  const signals: MapSignals = { lowHp: -1, playerDied: false, telegraphSec: 0 };

  function ladderSemis(step: number, ladder: readonly number[]): number {
    if (ladder.length === 0) return 0;
    return (ladder[step % ladder.length] ?? glintBase) - glintBase;
  }

  function telegraph(out: TriggerList, start: boolean, a: number, b: number, c: number, x: number, now: number): void {
    const kind = sourceKindOf(c);
    const idx = sourceIndexOf(c);
    const durSec = start ? b / TICK_RATE : 0;
    let id: number = (start ? kindStart : kindResolve)[a] ?? NONE;
    let semis = 0;
    if (kind === SourceKind.BossPattern && bpHasRoute[idx] === 1) {
      id = (start ? bpStart : bpResolve)[idx] ?? NONE;
    } else if (kind === SourceKind.Affix && afHasRoute[idx] === 1) {
      id = (start ? afStart : afResolve)[idx] ?? NONE;
    } else if (kind === SourceKind.EnemyAttack && a === TelegraphKind.Charge && eIsWarden[idx] === 1) {
      id = start ? wardenChargeStart : wardenChargeResolve;
      if (start) {
        // Each charge of the series of three rises (count 1, 2, 3, audio-list 6.1).
        wardenSeq = now - lastWardenCharge < 1.5 ? wardenSeq + 1 : 0;
        lastWardenCharge = now;
        semis = wardenStep * Math.min(wardenSeq, 2);
      }
    }
    if (start && durSec > signals.telegraphSec) signals.telegraphSec = durSec;
    out.add(id, x, semis, durSec, 0);
  }

  /** Cue for one EnemyDamaged event, NONE when it stays silent. */
  function damageCue(b: number, c: number): number {
    const rank = (b >> DAMAGE_RANK_SHIFT) & 3;
    const hitKind = (b >> DAMAGE_HIT_KIND_SHIFT) & 7;
    if (rank === EnemyRank.Warden) return cHurtWarden;
    if (rank === EnemyRank.Boss) return cHurtBoss;
    if ((b & DamageFlag.Crit) !== 0) return cCrit;
    // Status ticks, zones, and Rite hits stay silent: too frequent or already covered (audio-list 4.2).
    const kind = sourceKindOf(c);
    if (hitKind === HitKind.Dot || hitKind === HitKind.Zone) return NONE;
    if (kind === SourceKind.Status || kind === SourceKind.Rite) return NONE;
    if (kind === SourceKind.Weapon) {
      const imp = wImpact[sourceIndexOf(c)] ?? NONE;
      // Explosions and orbit contact have their own impact; the bolt itself still thuds.
      if (imp !== NONE && hitKind !== HitKind.Projectile) return imp;
    }
    return cHit;
  }

  return {
    signals,
    map(ev, out, now, ladder) {
      signals.lowHp = -1;
      signals.playerDied = false;
      signals.telegraphSec = 0;
      for (let i = 0; i < ev.count; i++) {
        const type = ev.type[i] ?? 0;
        const x = ev.x[i] ?? 0;
        const a = ev.a[i] ?? 0;
        const b = ev.b[i] ?? 0;
        const c = ev.c[i] ?? 0;
        const list = simple[type];
        if (list !== undefined) {
          for (let k = 0; k < list.length; k++) out.add(list[k] ?? NONE, x, 0, 0, 0);
        }
        switch (type) {
          case SimEventType.PulseStarted:
            lastPulseStart = now;
            break;
          case SimEventType.PlayerDied:
            signals.playerDied = true;
            break;
          case SimEventType.PhaseChanged:
            out.add(phaseCue[a] ?? NONE, Number.NaN, 0, 0, 0);
            break;
          case SimEventType.RunEnded:
            out.add(runCue[a] ?? NONE, Number.NaN, 0, 0, 0);
            break;
          case SimEventType.PlayerHpLowChanged:
            signals.lowHp = a === 1 ? 1 : 0;
            break;
          case SimEventType.WeaponFired:
            out.add(wFire[a] ?? NONE, Number.NaN, wSemis[a] ?? 0, 0, 0);
            break;
          case SimEventType.RiteCast:
            out.add(rCast[a] ?? NONE, Number.NaN, 0, 0, 0);
            out.add(rImpact[a] ?? NONE, x, 0, 0, rDelay[a] ?? 0);
            break;
          case SimEventType.RiteReady:
            // The Rite is always ready at Pulse start, no need to announce it (audio-list 3).
            if (now - lastPulseStart >= readySuppressSec) out.add(cReady, Number.NaN, 0, 0, 0);
            break;
          case SimEventType.SynergyActivated:
            out.add(cSynergy, Number.NaN, routes.synergy.semisByThreshold[String(b)] ?? 0, 0, 0);
            break;
          case SimEventType.EnemyDamaged:
            out.add(damageCue(b, c), x, 0, 0, 0);
            break;
          case SimEventType.EnemyKilled:
            if (b === EnemyRank.Normal) out.add(eDeath[a] ?? NONE, x, 0, 0, 0);
            break;
          case SimEventType.EnemyProjectileFired:
            out.add(sourceKindOf(c) === SourceKind.Affix ? cShotAffix : cShot, x, 0, 0, 0);
            break;
          case SimEventType.TelegraphStarted:
            telegraph(out, true, a, b, c, x, now);
            break;
          case SimEventType.TelegraphResolved:
            telegraph(out, false, a, b, c, x, now);
            break;
          case SimEventType.AffixApplied:
            out.add(afApplied[a] ?? NONE, x, 0, 0, 0);
            break;
          case SimEventType.GlintCollected: {
            if (b > 0) glintStep = b - 1;
            else {
              glintStep = now - lastGlint <= glintResetSec ? glintStep + 1 : 0;
            }
            lastGlint = now;
            out.add(cGlint, x, ladderSemis(glintStep, ladder), 0, 0);
            break;
          }
          case SimEventType.ProcTriggered:
            out.add(pCue[a] ?? NONE, x, 0, 0, 0);
            break;
          case SimEventType.ItemMerged:
            out.add(cMerge, Number.NaN, routes.merge.semisByTier[String(b)] ?? 0, 0, 0);
            break;
          case SimEventType.ItemLocked:
            out.add(cLock, Number.NaN, b === 1 ? 0 : routes.lock.unlockSemis, 0, 0);
            break;
          case SimEventType.CommandRejected:
            if (silentReject[a] !== 1) out.add(cRejected, Number.NaN, 0, 0, 0);
            break;
        }
      }
    },
  };
}
