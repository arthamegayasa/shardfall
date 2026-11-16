// Headless bot for sim tests (GP, M1-03): flees the nearest Unlit (with a pull toward the arena
// centre so it does not pin itself to a wall), casts the Rite at the nearest Unlit, picks the first
// reward and level-up card, buys the cheapest affordable offer until it cannot, then starts the Pulse.

import { Button, OfferKind, createInputFrame } from '../../../../src/core/index.ts';
import type { Command, InputFrame, Sim, WorldView } from '../../../../src/core/index.ts';

export interface BotResult {
  readonly outcome: 'victory' | 'defeat' | 'timeout';
  readonly ticks: number;
  readonly pulsesCleared: number;
  readonly purchases: number;
}

/** Choose movement and Rite input for one pulse tick. */
export function botInput(view: WorldView, out: InputFrame): void {
  const p = view.player;
  const e = view.enemies;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < e.highWater; i++) {
    if (e.alive[i] === 0) continue;
    const dx = (e.x[i] ?? 0) - p.x;
    const dy = (e.y[i] ?? 0) - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  out.pressed = 0;
  out.held = 0;
  let mx = -p.x * 0.08;
  let my = -p.y * 0.12;
  if (best >= 0) {
    const dx = p.x - (e.x[best] ?? 0);
    const dy = p.y - (e.y[best] ?? 0);
    const d = Math.sqrt(bestD) || 1;
    mx += dx / d;
    my += dy / d;
    out.aimX = Math.round((e.x[best] ?? 0) * 16);
    out.aimY = Math.round((e.y[best] ?? 0) * 16);
    if (p.riteCharges > 0 && d < 6) out.pressed = Button.Rite;
  }
  const len = Math.sqrt(mx * mx + my * my);
  out.moveX = len > 0 ? Math.round((mx / len) * 127) : 0;
  out.moveY = len > 0 ? Math.round((my / len) * 127) : 0;
}

/** Decide the commands for a choice phase. Returns the commands to enqueue this tick. */
export function botCommands(view: WorldView, out: Command[]): number {
  out.length = 0;
  let purchases = 0;
  switch (view.phase) {
    case 'reward':
      out.push({ type: 'reward.pick', choice: 0 });
      break;
    case 'levelUp':
      out.push({ type: 'levelup.pick', choice: 0 });
      break;
    case 'shop': {
      let cheapest = -1;
      let price = Infinity;
      view.shop.offers.forEach((o, i) => {
        if (o.kind !== OfferKind.Weapon && o.kind !== OfferKind.Memento) return;
        if (!o.affordable || o.blockedNoSlot) return;
        if (o.price < price) {
          price = o.price;
          cheapest = i;
        }
      });
      if (cheapest >= 0) {
        out.push({ type: 'shop.buy', offer: cheapest });
        purchases++;
      } else {
        out.push({ type: 'pulse.begin' });
      }
      break;
    }
    default:
      break;
  }
  return purchases;
}

/** Run one whole run with the bot. maxTicks bounds the test time. */
export function runBot(
  sim: Sim,
  start: { seed: number; classId: string; profile: string },
  maxTicks: number,
  onTick?: (sim: Sim) => void,
): BotResult {
  const input = createInputFrame();
  const cmds: Command[] = [];
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
    if (v.phase === 'victory' || v.phase === 'defeat') {
      return { outcome: v.phase, ticks: t, pulsesCleared: v.runStats.pulsesCleared, purchases };
    }
    if (v.phase === 'pulse') botInput(v, input);
    else {
      input.moveX = 0;
      input.moveY = 0;
      input.pressed = 0;
      purchases += botCommands(v, cmds);
      for (const c of cmds) sim.enqueue(c);
    }
    sim.step(input);
    onTick?.(sim);
  }
  return {
    outcome: 'timeout',
    ticks: maxTicks,
    pulsesCleared: sim.view.runStats.pulsesCleared,
    purchases,
  };
}
