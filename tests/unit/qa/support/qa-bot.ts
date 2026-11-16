// QA bots (test-plan 6.3, M1-09b). Read the WorldView, act through InputFrame and Commands only.
// - dodgerRandom: GP's dodger movement (tests/unit/sim/support/bot.ts) plus random affordable buys,
//   random level-up and reward cards, and occasional rerolls, from a bot RNG derived from the seed.
// - idle: never moves, never casts, never buys; picks the first card so the run can continue.

import { OfferKind, createInputFrame } from '../../../../src/core/index.ts';
import type { Command, InputFrame, Sim, WorldView } from '../../../../src/core/index.ts';
import { botInput } from '../../sim/support/bot.ts';

export type QaBotKind = 'dodgerRandom' | 'idle';

/** Bot-only RNG (mulberry32). Never shared with the sim. */
export function botRng(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reroll chance per shop visit for dodgerRandom (bot config, not game data). */
const REROLL_CHANCE = 0.25;

export interface QaBotResult {
  readonly outcome: 'victory' | 'defeat' | 'timeout';
  readonly ticks: number;
  readonly pulsesCleared: number;
  readonly purchases: number;
  readonly violations: readonly string[];
}

function choices(
  view: WorldView,
  cmds: Command[],
  kind: QaBotKind,
  rnd: () => number,
  st: { rerolled: boolean },
): number {
  cmds.length = 0;
  let bought = 0;
  switch (view.phase) {
    case 'reward': {
      const n = Math.max(1, view.reward.choices.length);
      cmds.push({ type: 'reward.pick', choice: kind === 'idle' ? 0 : Math.floor(rnd() * n) });
      break;
    }
    case 'levelUp': {
      const n = Math.max(1, view.levelUp.choices.length);
      cmds.push({ type: 'levelup.pick', choice: kind === 'idle' ? 0 : Math.floor(rnd() * n) });
      break;
    }
    case 'shop': {
      if (kind === 'idle') {
        cmds.push({ type: 'pulse.begin' });
        break;
      }
      const ok: number[] = [];
      view.shop.offers.forEach((o, i) => {
        if (o.kind !== OfferKind.Weapon && o.kind !== OfferKind.Memento) return;
        if (o.affordable && !o.blockedNoSlot) ok.push(i);
      });
      if (ok.length > 0) {
        cmds.push({ type: 'shop.buy', offer: ok[Math.floor(rnd() * ok.length)] ?? 0 });
        bought++;
      } else if (
        !st.rerolled &&
        rnd() < REROLL_CHANCE &&
        view.player.glint >= view.shop.rerollPrice
      ) {
        st.rerolled = true;
        cmds.push({ type: 'shop.reroll' });
      } else {
        st.rerolled = false;
        cmds.push({ type: 'pulse.begin' });
      }
      break;
    }
    default:
      break;
  }
  return bought;
}

/** B-2 invariants on the current view. Returns a description per violation (empty = fine). */
export function checkInvariants(
  view: WorldView,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): string[] {
  const out: string[] = [];
  const p = view.player;
  const nums: [string, number][] = [
    ['hp', p.hp],
    ['maxHp', p.maxHp],
    ['glint', p.glint],
    ['x', p.x],
    ['y', p.y],
    ['xp', p.xp],
  ];
  for (const [k, v] of nums) if (!Number.isFinite(v)) out.push(`player.${k} not finite (${v})`);
  if (p.hp < 0 || p.hp > p.maxHp + 1e-9) out.push(`hp ${p.hp} outside [0, ${p.maxHp}]`);
  if (p.glint < 0) out.push(`glint negative (${p.glint})`);
  const slack = p.radius + 0.01;
  if (
    p.x < bounds.minX - slack ||
    p.x > bounds.maxX + slack ||
    p.y < bounds.minY - slack ||
    p.y > bounds.maxY + slack
  )
    out.push(`player outside arena (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  for (const [name, pool] of [
    ['enemies', view.enemies],
    ['enemyShots', view.enemyShots],
    ['playerShots', view.playerShots],
    ['pickups', view.pickups],
  ] as const) {
    if (pool.highWater > pool.capacity) out.push(`${name} highWater ${pool.highWater} > capacity`);
    for (let i = 0; i < pool.highWater; i++) {
      if (pool.alive[i] === 0) continue;
      const x = pool.x[i] ?? 0;
      const y = pool.y[i] ?? 0;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        out.push(`${name}[${i}] position not finite`);
        continue;
      }
      // Living enemies and pickups stay inside the arena (spawns are inside sectors; 1 u slack).
      if (name === 'enemies' || name === 'pickups') {
        if (
          x < bounds.minX - 1 ||
          x > bounds.maxX + 1 ||
          y < bounds.minY - 1 ||
          y > bounds.maxY + 1
        )
          out.push(`${name}[${i}] outside arena (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
    }
  }
  return out;
}

export function runQaBot(
  sim: Sim,
  start: { seed: number; classId: string; profile: string },
  kind: QaBotKind,
  maxTicks: number,
  boundsFor: (arenaIndex: number) => { minX: number; maxX: number; minY: number; maxY: number },
): QaBotResult {
  const input: InputFrame = createInputFrame();
  const cmds: Command[] = [];
  const rnd = botRng(start.seed);
  const st = { rerolled: false };
  const violations: string[] = [];
  let purchases = 0;
  sim.enqueue({
    type: 'run.start',
    seed: start.seed,
    classId: start.classId,
    profile: start.profile,
    difficulty: 0,
  });
  sim.step(input);
  for (let t = 0; t < maxTicks; t++) {
    const v = sim.view;
    if (t % 60 === 0 && violations.length < 20) {
      for (const msg of checkInvariants(v, boundsFor(v.arenaIndex)))
        violations.push(`tick ${v.tick} phase ${v.phase}: ${msg}`);
    }
    if (v.phase === 'victory' || v.phase === 'defeat')
      return {
        outcome: v.phase,
        ticks: t,
        pulsesCleared: v.runStats.pulsesCleared,
        purchases,
        violations,
      };
    if (v.phase === 'pulse') {
      if (kind === 'idle') {
        input.moveX = 0;
        input.moveY = 0;
        input.pressed = 0;
        input.held = 0;
      } else botInput(v, input);
    } else {
      input.moveX = 0;
      input.moveY = 0;
      input.pressed = 0;
      purchases += choices(v, cmds, kind, rnd, st);
      for (const c of cmds) sim.enqueue(c);
    }
    sim.step(input);
  }
  return {
    outcome: 'timeout',
    ticks: maxTicks,
    pulsesCleared: sim.view.runStats.pulsesCleared,
    purchases,
    violations,
  };
}
