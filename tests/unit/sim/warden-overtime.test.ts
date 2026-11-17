// GD M4-04: a Warden holding the Pulse in overtime decays after warden_overtime_decay_s, so a held
// Pulse always ends (GDD 3.3). Fixture data with the decay keys set; real data must enable it.

import { describe, expect, it } from 'vitest';
import { SimEventType } from '../../../src/core/index.ts';
import type { GameData } from '../../../src/content/index.ts';
import { harness, stepUntil } from './support/harness.ts';
import type { Harness } from './support/harness.ts';
import { simFixtureData } from './support/sim-fixture.ts';
import { realGameData } from '../qa/support/real-data.ts';

const DECAY = 300;
const LEN = 120;

function withDecay(decay: number, len: number): GameData {
  const base = simFixtureData();
  return {
    ...base,
    config: { ...base.config, wardenOvertimeDecayTicks: decay, wardenOvertimeDecayLenTicks: len },
  };
}

/** Clear Pulses with debug.endPulse until Pulse index `target` is running. */
function skipTo(h: Harness, target: number): void {
  while (h.sim.view.pulse.index < target || h.sim.view.phase !== 'pulse') {
    const ph = h.sim.view.phase;
    if (ph === 'pulse') h.send({ type: 'debug.endPulse' });
    else if (ph === 'levelUp') h.send({ type: 'levelup.pick', choice: 0 });
    else if (ph === 'reward') h.send({ type: 'reward.pick', choice: 0 });
    else if (ph === 'shop') h.send({ type: 'pulse.begin' });
    h.step();
  }
}

/** Run Pulse 4 of run_a with no weapons and an invulnerable player until overtime starts. */
function heldWarden(data: GameData): { h: Harness; keep: () => void } {
  const h = harness({ data });
  h.start({ profile: 'run_a' });
  skipTo(h, 4);
  h.ctx.run.weaponIndex.fill(-1);
  const keep = () => {
    h.ctx.world.player.hp = h.ctx.world.player.maxHp;
    h.ctx.world.player.invulnTicks = 10;
  };
  const slot = h.data.profiles['run_a']?.[4];
  if (slot === undefined) throw new Error('slot');
  expect(stepUntil(h, () => (keep(), h.sim.view.pulse.overtime), slot.durationTicks + 10)).toBe(
    true,
  );
  return { h, keep };
}

describe('Warden overtime limit (GD M4-04)', () => {
  it('decays the held Warden after warden_overtime_decay_s and ends the Pulse with the reward', () => {
    const { h, keep } = heldWarden(withDecay(DECAY, LEN));
    const s = h.ctx.run.wardenSlot;
    const e = h.ctx.world.enemies;
    const maxHp = e.maxHp[s] ?? 0;
    // Before the decay starts the Warden keeps its HP (nothing damages it).
    for (let i = 0; i < DECAY - 2; i++) {
      keep();
      h.step();
    }
    expect(h.ctx.run.wardenSlot).toBe(s);
    expect(e.hp[s]).toBe(maxHp);
    // Halfway through the decay the HP ceiling is at most half of max HP, and only falls.
    let last = e.hp[s] ?? 0;
    for (let i = 0; i < LEN / 2 + 2; i++) {
      keep();
      h.step();
      const hp = e.hp[s] ?? 0;
      expect(hp).toBeLessThanOrEqual(last);
      last = hp;
    }
    expect(last).toBeLessThanOrEqual(maxHp / 2 + 1e-9);
    // The Warden dies by the end of the decay: a normal Warden kill, then the reward chest.
    expect(
      stepUntil(h, () => (keep(), h.of(SimEventType.WardenKilled).length > 0), LEN / 2 + 2),
    ).toBe(true);
    expect(h.ctx.run.overtimeTicks).toBeLessThanOrEqual(DECAY + LEN + 1);
    expect(stepUntil(h, () => (keep(), h.sim.view.phase === 'reward'), 2000)).toBe(true);
    expect(h.sim.view.reward.choices.length).toBe(h.data.shop.wardenChestChoices);
  });

  it('heals cannot outlast the decay', () => {
    const { h, keep } = heldWarden(withDecay(DECAY, LEN));
    const s = h.ctx.run.wardenSlot;
    const e = h.ctx.world.enemies;
    const killed = stepUntil(
      h,
      () => {
        keep();
        e.hp[s] = e.maxHp[s] ?? 0; // a full heal every tick
        return h.of(SimEventType.WardenKilled).length > 0;
      },
      DECAY + LEN + 2,
    );
    expect(killed).toBe(true);
  });

  it('decay 0 keeps the old rule: the Warden holds the Pulse', () => {
    const { h, keep } = heldWarden(withDecay(0, LEN));
    for (let i = 0; i < DECAY + LEN + 60; i++) {
      keep();
      h.step();
    }
    expect(h.of(SimEventType.WardenKilled).length).toBe(0);
    expect(h.sim.view.pulse.overtime).toBe(true);
  });

  it('real data enables the limit, after the overtime haste', () => {
    const cfg = realGameData().config;
    expect(cfg.wardenOvertimeDecayTicks).toBeGreaterThan(cfg.wardenOvertimeHasteTicks);
    expect(cfg.wardenOvertimeDecayLenTicks).toBeGreaterThan(0);
  });
});
