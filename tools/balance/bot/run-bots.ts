#!/usr/bin/env node
// Run balance bots over many seeds on the built game data (GD, M2-01).
// Usage (repo root):
//   node tools/balance/bot/run-bots.ts --bot good --profile run_a --seeds 1-40
//   node tools/balance/bot/run-bots.ts --bot naive --seeds 1-40 --data tests/out/game-data-b.json --profile run_b --class blade
//   add --json <file> to write per-run rows, --verbose for one line per run.
//   P1-c: --class all rotates classes by seed, --all-unlocks opens every meta unlock.
// Reports win rate, Pulse reached, run length (sim time plus an estimate of shop and Temper time),
// Warden and boss fight length, Unlit alive (peak and last 6 s per Pulse), Glint picked up, purchases.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGameData } from '../../../src/content/index.ts';
import type { GameData, RawGameData } from '../../../src/content/index.ts';
import { SimEventType, TICK_RATE, createInputFrame } from '../../../src/core/index.ts';
import type { Command } from '../../../src/core/index.ts';
import { createSim } from '../../../src/sim/index.ts';
import { BotPolicy } from './policy.ts';
import type { BotKind, Bounds } from './policy.ts';

/** Human time estimates outside the sim (CD S-12 target: median shop 25 s or less). [Asumsi] */
const SHOP_S = 20;
const TEMPER_S = 4;
const REWARD_S = 5;
const LAST_WINDOW_S = 6;
const MAX_TICKS = TICK_RATE * 60 * 40;

interface PulseStat {
  pulse: number;
  ticks: number;
  peakAlive: number;
  peakLast: number;
  sumLast: number;
  nLast: number;
  dropped: number;
  picked: number;
  swept: number;
  damageTaken: number;
}

export interface RunRow {
  seed: number;
  outcome: string;
  pulseReached: number;
  pulseTicks: number;
  estMinutes: number;
  wardenS: number | null;
  bossS: number | null;
  purchases: number;
  rerolls: number;
  levelPicks: number;
  level: number;
  pulses: PulseStat[];
  maxAliveAll: number;
  poolOverflow: number;
  /** Silt given at the run end (WorldView runStats.silt; 0 in content tier A). LP M2-09. */
  silt: number;
  /** P1-c: tag with the highest count at the last shop (ties: first in data order; none if all 0). */
  dominantTag: string;
}

function arg(args: string[], flag: string, def: string): string {
  const i = args.indexOf(flag);
  return i === -1 ? def : (args[i + 1] ?? def);
}

function loadData(path: string): GameData {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RawGameData;
  return buildGameData(raw, { freeze: true });
}

function boundsOf(data: GameData, index: number): Bounds {
  const b = data.arenas[index]?.arena.boundary ?? [[0, 0]];
  const xs = b.map((p) => p[0]);
  const ys = b.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function runOne(
  data: GameData,
  kind: BotKind,
  seed: number,
  classId: string,
  profile: string,
  unlocked: readonly string[] = [],
): RunRow {
  const sim = createSim({ data });
  const bot = new BotPolicy(kind, data, seed, classId);
  const input = createInputFrame();
  const cmds: Command[] = [];
  let lastShopTags: number[] = [];
  sim.enqueue({
    type: 'run.start',
    seed,
    classId,
    profile,
    difficulty: 0,
    unlocked: [...unlocked],
  });
  sim.step(input);
  const pulses: PulseStat[] = [];
  let cur: PulseStat | null = null;
  let pulseTicks = 0;
  let purchases = 0;
  let rerolls = 0;
  let levelPicks = 0;
  let rewards = 0;
  let wardenStart = -1;
  let wardenS: number | null = null;
  let bossStart = -1;
  let bossS: number | null = null;
  let maxAliveAll = 0;
  let lastPhaseRev = -1;
  let outcome = 'timeout';
  for (let t = 0; t < MAX_TICKS; t++) {
    const v = sim.view;
    if (v.phase === 'victory' || v.phase === 'defeat') {
      outcome = v.phase;
      break;
    }
    if (v.phase === 'pulse') {
      if (cur === null || cur.pulse !== v.pulse.index + 1) {
        cur = {
          pulse: v.pulse.index + 1,
          ticks: 0,
          peakAlive: 0,
          peakLast: 0,
          sumLast: 0,
          nLast: 0,
          dropped: 0,
          picked: 0,
          swept: 0,
          damageTaken: 0,
        };
        pulses.push(cur);
      }
      cur.ticks++;
      pulseTicks++;
      let alive = 0;
      const e = v.enemies;
      for (let i = 0; i < e.highWater; i++) if (e.alive[i] === 1 && e.rank[i] === 0) alive++;
      if (alive > cur.peakAlive) cur.peakAlive = alive;
      if (alive > maxAliveAll) maxAliveAll = alive;
      const timed = v.pulse.ticksTotal > 0;
      if (timed && v.pulse.ticksLeft <= LAST_WINDOW_S * TICK_RATE) {
        if (alive > cur.peakLast) cur.peakLast = alive;
        cur.sumLast += alive;
        cur.nLast++;
      }
      bot.pulseInput(v, input, boundsOf(data, v.arenaIndex));
    } else {
      input.moveX = 0;
      input.moveY = 0;
      input.pressed = 0;
      if (v.phaseRevision !== lastPhaseRev) {
        lastPhaseRev = v.phaseRevision;
        if (v.phase === 'levelUp') levelPicks++;
        if (v.phase === 'shop') lastShopTags = Array.from(v.shop.tagCounts);
        if (v.phase === 'reward') rewards++;
      }
      purchases += bot.choose(v, cmds);
      for (const c of cmds) {
        if (c.type === 'shop.reroll') rerolls++;
        sim.enqueue(c);
      }
    }
    sim.step(input);
    const ev = sim.events;
    for (let k = 0; k < ev.count; k++) {
      const type = ev.type[k];
      const a = ev.a[k] ?? 0;
      const tick = sim.view.tick;
      if (type === SimEventType.GlintDropped && cur !== null) cur.dropped += a;
      else if (type === SimEventType.GlintCollected && cur !== null) cur.picked += a;
      else if (type === SimEventType.GlintSwept && cur !== null) cur.swept += a;
      else if (type === SimEventType.PlayerDamaged && cur !== null) cur.damageTaken += a;
      else if (type === SimEventType.WardenSpawned) wardenStart = tick;
      else if (type === SimEventType.WardenKilled && wardenStart >= 0)
        wardenS = (tick - wardenStart) / TICK_RATE;
      else if (type === SimEventType.BossSpawned) bossStart = tick;
      else if (type === SimEventType.BossKilled && bossStart >= 0)
        bossS = (tick - bossStart) / TICK_RATE;
    }
  }
  const v = sim.view;
  const shops = pulses.length - (outcome === 'defeat' ? 1 : 0) - (outcome === 'victory' ? 1 : 0);
  const est =
    pulseTicks / TICK_RATE +
    Math.max(0, shops) * SHOP_S +
    levelPicks * TEMPER_S +
    rewards * REWARD_S;
  return {
    seed,
    outcome,
    pulseReached: pulses.length,
    pulseTicks,
    estMinutes: est / 60,
    wardenS,
    bossS,
    purchases,
    rerolls,
    levelPicks,
    level: v.player.level,
    pulses,
    maxAliveAll,
    poolOverflow: sim.poolOverflow,
    silt: v.runStats.silt,
    dominantTag: dominantTag(data, lastShopTags),
  };
}

function dominantTag(data: GameData, tags: readonly number[]): string {
  const best = Math.max(0, ...tags);
  return best === 0 ? 'none' : (data.tags[tags.indexOf(best)]?.id ?? '?');
}

function median(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

function f(n: number, d = 1): string {
  return Number.isFinite(n) ? n.toFixed(d) : '-';
}

export function summarize(rows: RunRow[], label: string): string {
  const n = rows.length;
  const wins = rows.filter((r) => r.outcome === 'victory');
  const deaths = new Map<number, number>();
  for (const r of rows)
    if (r.outcome === 'defeat') deaths.set(r.pulseReached, (deaths.get(r.pulseReached) ?? 0) + 1);
  const lines: string[] = [];
  lines.push(`## ${label}: ${n} runs`);
  lines.push(
    `win ${wins.length}/${n} (${f((wins.length / n) * 100, 0)}%), timeouts ${rows.filter((r) => r.outcome === 'timeout').length}`,
  );
  lines.push(
    `death Pulse: ${
      [...deaths.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([p, c]) => `P${p} x${c}`)
        .join(', ') || '-'
    }`,
  );
  lines.push(
    `Silt per run: median ${f(median(rows.map((r) => r.silt)))}, losses ${f(median(rows.filter((r) => r.outcome !== 'victory').map((r) => r.silt)))}, wins ${f(median(wins.map((r) => r.silt)))}`,
  );
  lines.push(
    `median Pulse reached ${median(rows.map((r) => r.pulseReached))}; median est. run minutes (wins) ${f(median(wins.map((r) => r.estMinutes)))}, sim minutes (wins) ${f(median(wins.map((r) => r.pulseTicks / TICK_RATE / 60)))}`,
  );
  const ws = rows.map((r) => r.wardenS).filter((x): x is number => x !== null);
  const bs = rows.map((r) => r.bossS).filter((x): x is number => x !== null);
  lines.push(
    `Warden kill s: median ${f(median(ws))} (n ${ws.length}, min ${f(Math.min(...ws))}, max ${f(Math.max(...ws))}); boss kill s: median ${f(median(bs))} (n ${bs.length}, min ${f(Math.min(...bs))}, max ${f(Math.max(...bs))})`,
  );
  lines.push(
    `purchases median ${median(rows.map((r) => r.purchases))} (wins ${median(wins.map((r) => r.purchases))}), rerolls median ${median(rows.map((r) => r.rerolls))}, final level median ${median(rows.map((r) => r.level))}, max alive ${Math.max(...rows.map((r) => r.maxAliveAll))}, poolOverflow max ${Math.max(...rows.map((r) => r.poolOverflow))}`,
  );
  const dom = new Map<string, number>();
  for (const r of rows) dom.set(r.dominantTag, (dom.get(r.dominantTag) ?? 0) + 1);
  lines.push(
    `P1-c dominant tag at the last shop: ${[...dom.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, c]) => `${k} ${c} (${f((c / n) * 100, 0)}%)`)
      .join(', ')}`,
  );
  const maxP = Math.max(...rows.map((r) => r.pulses.length));
  lines.push('');
  lines.push(
    '| Pulse | runs | peak alive (median) | peak last 6 s (median) | mean last 6 s (median) | Glint picked % (median) | damage taken (median) |',
  );
  lines.push('|---|---|---|---|---|---|---|');
  for (let p = 1; p <= maxP; p++) {
    const ps = rows.map((r) => r.pulses[p - 1]).filter((x): x is PulseStat => x !== undefined);
    lines.push(
      `| ${p} | ${ps.length} | ${median(ps.map((x) => x.peakAlive))} | ${median(ps.map((x) => x.peakLast))} | ${f(median(ps.filter((x) => x.nLast > 0).map((x) => x.sumLast / x.nLast)))} | ${f(median(ps.filter((x) => x.dropped > 0).map((x) => (x.picked / x.dropped) * 100)), 0)} | ${f(median(ps.map((x) => x.damageTaken)), 0)} |`,
    );
  }
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const root = resolve(import.meta.dirname, '..', '..', '..');
  const dataPath = resolve(root, arg(args, '--data', 'content/generated/game-data.json'));
  const kind = arg(args, '--bot', 'good') as BotKind;
  const profile = arg(args, '--profile', 'run_a');
  const classId = arg(args, '--class', 'lantern');
  const [lo, hi] = arg(args, '--seeds', '1-40').split('-').map(Number);
  const data = loadData(dataPath);
  // --class all rotates the classes by seed (seed % class count, as QA B-6); --all-unlocks opens
  // every meta unlock (P1-c with the full pool).
  const classes = classId === 'all' ? data.classes.map((c) => c.id) : [classId];
  const unlocked = args.includes('--all-unlocks') ? data.metaUnlocks.map((u) => u.id) : [];
  const rows: RunRow[] = [];
  const t0 = performance.now();
  for (let seed = lo ?? 1; seed <= (hi ?? lo ?? 1); seed++) {
    const cls = classes[seed % classes.length] ?? classId;
    const r = runOne(data, kind, seed, cls, profile, unlocked);
    rows.push(r);
    if (args.includes('--verbose'))
      console.log(
        `seed ${seed} ${r.outcome} P${r.pulseReached} buys ${r.purchases} L${r.level} warden ${f(r.wardenS ?? Number.NaN)} boss ${f(r.bossS ?? Number.NaN)} est ${f(r.estMinutes)} min peaks ${r.pulses.map((p) => `${p.peakAlive}/${p.peakLast}`).join(' ')}`,
      );
  }
  console.log(
    summarize(
      rows,
      `${kind} bot, ${profile}, class ${classId}, contentHash ${data.meta.contentHash}`,
    ),
  );
  console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)} s wall)`);
  const json = arg(args, '--json', '');
  if (json !== '') writeFileSync(resolve(root, json), JSON.stringify(rows, null, 1));
}

if (import.meta.main) main();
