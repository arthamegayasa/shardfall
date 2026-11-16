#!/usr/bin/env node
// Arena legibility check (LD, arena-design.md 11): automatable part of LD-T01 plus LD-T10.
// Usage:
//   node tools/levels/check-arena.ts               check every content/levels/*.json
//   node tools/levels/check-arena.ts arena_proto   check one arena
//   node tools/levels/check-arena.ts --self-test   prove each rule fires on a broken copy of arena_market
// Exit 1 on any error. Warnings never fail.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ArenaDef } from '../../src/core/index.ts';
import type { CheckContext, Issue } from './lib/legibility.ts';
import { checkArena } from './lib/legibility.ts';

const root = resolve(import.meta.dirname, '..', '..');
const levelsDir = join(root, 'content', 'levels');

function loadContext(): CheckContext {
  const tokens = new Set<string>();
  const palettePath = join(root, 'art', 'palette.json');
  if (existsSync(palettePath)) {
    const pal = JSON.parse(readFileSync(palettePath, 'utf8')) as {
      core?: Record<string, string>;
      biomes?: { id: string; env?: Record<string, string> }[];
    };
    for (const k of Object.keys(pal.core ?? {})) tokens.add(k);
    for (const b of pal.biomes ?? [])
      for (const k of Object.keys(b.env ?? {})) tokens.add(`${b.id}.${k}`);
  }
  const tilesDir = join(root, 'art', 'tiles');
  const tileIds = existsSync(tilesDir)
    ? new Set(
        readdirSync(tilesDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.slice(0, -5)),
      )
    : null;
  return { tokens, tileIds };
}

function readArena(name: string): unknown {
  return JSON.parse(readFileSync(join(levelsDir, `${name}.json`), 'utf8')) as unknown;
}

function runCheck(names: readonly string[], ctx: CheckContext): boolean {
  let errors = 0;
  let warnings = 0;
  for (const name of names) {
    let json: unknown;
    try {
      json = readArena(name);
    } catch (e) {
      console.log(`ERROR content/levels/${name}.json: ${(e as Error).message}`);
      errors++;
      continue;
    }
    const { issues, metrics } = checkArena(name, json, ctx);
    const e = issues.filter((i) => i.level === 'error').length;
    errors += e;
    warnings += issues.length - e;
    console.log(`${e === 0 ? 'PASS' : 'FAIL'}  content/levels/${name}.json`);
    for (const i of issues)
      console.log(`  ${i.level === 'error' ? 'ERROR' : 'WARN '} [${i.rule}] ${i.msg}`);
    console.log(
      `  ${Object.entries(metrics)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join('  ')}`,
    );
  }
  console.log(`${names.length} arena(s), ${errors} error(s), ${warnings} warning(s)`);
  return errors === 0;
}

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
type MArena = Mutable<ArenaDef>;

/** Each case breaks one rule on a copy of a valid arena; the rule id must appear in the result. */
const CASES: readonly { rule: string; what: string; mutate: (a: MArena) => void }[] = [
  {
    rule: 'S1',
    what: 'decor carries a scale field',
    mutate: (a) => {
      const d = a.decor[0];
      if (d) (d as unknown as Record<string, unknown>)['scale'] = 2;
    },
  },
  {
    rule: 'S2',
    what: 'boundary counter-clockwise',
    mutate: (a) => {
      a.arena.boundary.reverse();
    },
  },
  {
    rule: 'S4',
    what: 'rim colour as hex',
    mutate: (a) => {
      a.arena.rim.colorToken = '#A39A8C';
    },
  },
  {
    rule: 'Z2',
    what: 'boss start next to the stage',
    mutate: (a) => {
      a.playerStart.boss = [0, 2];
    },
  },
  {
    rule: 'SP1',
    what: 'spawn sector in the middle',
    mutate: (a) => {
      const z = a.spawn.zones[0];
      if (z) z.shape = { type: 'rect', min: [-2, -2], max: [2, 2] };
    },
  },
  {
    rule: 'SP2',
    what: 'spawn sector inside the start ring',
    mutate: (a) => {
      const z = a.spawn.zones[0];
      if (z) z.shape = { type: 'rect', min: [-2, -2], max: [2, 2] };
    },
  },
  {
    rule: 'R1',
    what: 'five obstacles',
    mutate: (a) => {
      a.obstacles.push(
        {
          id: 'extra_1',
          kind: 'sack-pile',
          shape: { type: 'circle', center: [6, -5], radius: 0.5 },
          height: 0.3,
          blocks: ['move'],
        },
        {
          id: 'extra_2',
          kind: 'sack-pile',
          shape: { type: 'circle', center: [0, 7], radius: 0.5 },
          height: 0.3,
          blocks: ['move'],
        },
      );
    },
  },
  {
    rule: 'R2',
    what: 'obstacle too tall',
    mutate: (a) => {
      const o = a.obstacles[0];
      if (o) o.height = 0.6;
    },
  },
  {
    rule: 'R3',
    what: 'obstacle 4 u long',
    mutate: (a) => {
      const o = a.obstacles[0];
      if (o) o.shape = { type: 'rect', min: [-10, -5.5], max: [-6, -4.5] };
    },
  },
  {
    rule: 'R4',
    what: 'coverage above 5%',
    mutate: (a) => {
      a.obstacles.splice(
        0,
        a.obstacles.length,
        ...(
          [
            [-9, -3],
            [9, -3],
            [-9, 4.5],
            [9, 4.5],
          ] as const
        ).map(([x, y], i) => ({
          id: `big_${i}`,
          kind: 'sack-pile',
          shape: {
            type: 'rect' as const,
            min: [x - 1.5, y - 1.5] as [number, number],
            max: [x + 1.5, y + 1.5] as [number, number],
          },
          height: 0.3,
          blocks: ['move' as const],
        })),
      );
    },
  },
  {
    rule: 'R5',
    what: 'obstacles 1 u apart',
    mutate: (a) => {
      const o = a.obstacles[1];
      if (o) o.shape = { type: 'circle', center: [-4.5, -5], radius: 1 };
    },
  },
  {
    rule: 'R6',
    what: 'obstacle near the wall',
    mutate: (a) => {
      const o = a.obstacles[0];
      if (o) o.shape = { type: 'rect', min: [-15, -1], max: [-13, 1] };
    },
  },
  {
    rule: 'R7',
    what: 'obstacle in the start ring',
    mutate: (a) => {
      const o = a.obstacles[1];
      if (o) o.shape = { type: 'circle', center: [0, 2], radius: 1 };
    },
  },
  {
    rule: 'R11',
    what: 'west half without a lane',
    mutate: (a) => {
      a.obstacles.splice(
        0,
        a.obstacles.length,
        {
          id: 'w1',
          kind: 'sack-pile',
          shape: { type: 'rect', min: [-12, -5.5], max: [-9, -4.5] },
          height: 0.3,
          blocks: ['move'],
        },
        {
          id: 'w2',
          kind: 'sack-pile',
          shape: { type: 'rect', min: [-8.5, 4.5], max: [-5.5, 5.5] },
          height: 0.3,
          blocks: ['move'],
        },
        {
          id: 'w3',
          kind: 'sack-pile',
          shape: { type: 'rect', min: [-5, -5.5], max: [-2, -4.5] },
          height: 0.3,
          blocks: ['move'],
        },
      );
    },
  },
  {
    rule: 'D1',
    what: 'decor inside the lip',
    mutate: (a) => {
      const d = a.decor[0];
      if (d) d.pos = [0, -10.5];
    },
  },
  {
    rule: 'D2',
    what: 'tall side decor in front',
    mutate: (a) => {
      const d = a.decor.find((x) => x.zone === 'side');
      if (d) {
        d.pos = [-18.5, 6];
        d.height = 3;
      }
    },
  },
  {
    rule: 'D3',
    what: 'decor lightId without a light',
    mutate: (a) => {
      const d = a.decor[0];
      if (d) d.lightId = 'missing_light';
    },
  },
  {
    rule: 'D4',
    what: '13 animated decor',
    mutate: (a) => {
      for (const d of a.decor.slice(0, 13)) d.anim = 'cloth-sway';
    },
  },
  {
    rule: 'L1',
    what: 'nine lights',
    mutate: (a) => {
      while (a.lighting.points.length < 9)
        a.lighting.points.push({ id: `extra_${a.lighting.points.length}`, pos: [-20, 2, -12] });
    },
  },
  {
    rule: 'L3',
    what: 'light over the play area',
    mutate: (a) => {
      const p = a.lighting.points[0];
      if (p) p.pos = [0, 1, -8];
    },
  },
  {
    rule: 'P1',
    what: 'gold dust over the arena',
    mutate: (a) => {
      const p = a.ambient.particles.find((x) => x.area === 'arena');
      if (p) p.colorToken = 'glint';
    },
  },
];

function selfTest(ctx: CheckContext): boolean {
  const name = 'arena_market';
  const base = readArena(name);
  const baseErrors = checkArena(name, base, ctx).issues.filter((i) => i.level === 'error');
  let ok = baseErrors.length === 0;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  base ${name} has no errors${ok ? '' : `: ${baseErrors.map((i) => i.rule).join(', ')}`}`,
  );
  for (const c of CASES) {
    const copy = structuredClone(base) as MArena;
    c.mutate(copy);
    const issues: Issue[] = checkArena(name, copy, ctx).issues;
    const hit = issues.some((i) => i.level === 'error' && i.rule === c.rule);
    if (!hit) ok = false;
    console.log(`${hit ? 'ok  ' : 'FAIL'}  ${c.rule} fires on: ${c.what}`);
  }
  console.log(ok ? `self-test passed (${CASES.length} cases)` : 'self-test FAILED');
  return ok;
}

const args = process.argv.slice(2);
const ctx = loadContext();
let ok: boolean;
if (args.includes('--self-test')) {
  ok = selfTest(ctx);
} else {
  const all = existsSync(levelsDir)
    ? readdirSync(levelsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5))
        .sort()
    : [];
  const names = args.length > 0 ? args : all;
  if (names.length === 0) console.log('no arenas in content/levels');
  ok = runCheck(names, ctx);
}
process.exit(ok ? 0 : 1);
