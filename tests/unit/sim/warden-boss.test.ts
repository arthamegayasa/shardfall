// K07, K08: Warden and boss (GDD 3.3, 15.1, 16; gd-answers Q33 to Q37).

import { describe, expect, it } from 'vitest';
import { AiState } from '../../../src/sim/codes.ts';
import { RunOutcome, SimEventType, TelegraphKind } from '../../../src/core/index.ts';
import { harness, stepUntil } from './support/harness.ts';
import type { Harness } from './support/harness.ts';

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

describe('Warden (K07)', () => {
  it('marks the Warden at warden_spawn_frac, holds the timer in overtime, then gives a reward', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    skipTo(h, 4);
    h.ctx.run.weaponIndex.fill(-1);
    const slot = h.data.profiles['run_a']?.[4];
    if (slot === undefined) throw new Error('slot');
    const spawnTick = Math.floor(slot.durationTicks * h.data.config.wardenSpawnFrac);
    const start = h.sim.view.tick;
    expect(
      stepUntil(h, () => h.of(SimEventType.WardenSpawned).length > 0, slot.durationTicks),
    ).toBe(true);
    const ws = h.of(SimEventType.WardenSpawned)[0];
    expect((ws?.tick ?? 0) - start).toBeGreaterThanOrEqual(spawnTick);
    expect(h.sim.view.pulse.warden.active).toBe(true);
    // Keep the player alive and let the timer run out: overtime.
    const keep = () => {
      h.ctx.world.player.hp = h.ctx.world.player.maxHp;
      h.ctx.world.player.invulnTicks = 10;
    };
    expect(stepUntil(h, () => (keep(), h.sim.view.pulse.overtime), slot.durationTicks)).toBe(true);
    expect(h.sim.view.phase).toBe('pulse');
    expect(h.sim.view.pulse.ticksLeft).toBe(0);
    h.step(30);
    expect(h.sim.view.phase).toBe('pulse');
    // Kill the Warden: the Pulse ends, the reward chest offers Mementos of at least min rarity.
    const w = h.ctx.run.wardenSlot;
    h.ctx.world.enemies.hp[w] = 1;
    h.ctx.run.weaponIndex[0] = 0;
    expect(stepUntil(h, () => (keep(), h.sim.view.phase === 'reward'), 2000)).toBe(true);
    const min = h.ctx.sd.rarityOrder[h.data.shop.wardenChestMinRarity] ?? 0;
    const choices = h.sim.view.reward.choices;
    expect(choices.length).toBe(h.data.shop.wardenChestChoices);
    for (const c of choices) expect(c.rarity).toBeGreaterThanOrEqual(min);
    expect(new Set(choices.map((c) => c.mementoIndex)).size).toBe(choices.length);
    h.send({ type: 'reward.pick', choice: 0 });
    h.step();
    expect(h.ctx.run.mementoOrder).toContain(choices[0]?.mementoIndex);
    expect(h.of(SimEventType.RewardChosen)[0]?.a).toBe(choices[0]?.mementoIndex);
  });
});

describe('boss (K08)', () => {
  it('emerges after boss_entry_s, invulnerable before, telegraphs patterns, phases, and gives victory', () => {
    const h = harness();
    h.start({ profile: 'run_a' });
    skipTo(h, 9);
    expect(h.sim.view.pulse.isBoss).toBe(true);
    expect(h.sim.view.pulse.ticksTotal).toBe(0);
    const keep = () => {
      h.ctx.world.player.hp = h.ctx.world.player.maxHp;
      h.ctx.world.player.invulnTicks = 10;
    };
    const t0 = h.sim.view.tick;
    expect(stepUntil(h, () => (keep(), h.of(SimEventType.BossSpawned).length > 0), 600)).toBe(true);
    expect((h.of(SimEventType.BossSpawned)[0]?.tick ?? 0) - t0).toBeGreaterThanOrEqual(
      h.data.config.bossEntryTicks,
    );
    expect(h.of(SimEventType.TelegraphStarted).some((e) => e.a === TelegraphKind.BossArea)).toBe(
      true,
    );
    // First pattern is telegraphed before it can damage.
    expect(stepUntil(h, () => (keep(), h.of(SimEventType.TelegraphStarted).length > 1), 600)).toBe(
      true,
    );
    // Drop HP to the phase 2 threshold: HP is floored there and a transition starts.
    const s = h.ctx.run.bossSlot;
    const e = h.ctx.world.enemies;
    e.hp[s] = 1;
    h.ctx.run.bossPatternIndex = -1;
    h.ctx.run.bossPatternTicks = 0;
    // Floor: the boss cannot be below phase 2 threshold before the transition.
    h.ctx.run.bossHpFloor = (e.maxHp[s] ?? 0) * 0.5;
    e.hp[s] = h.ctx.run.bossHpFloor;
    expect(stepUntil(h, () => (keep(), e.aiState[s] === AiState.Transition), 60)).toBe(true);
    expect(stepUntil(h, () => (keep(), h.of(SimEventType.BossPhaseChanged).length > 0), 600)).toBe(
      true,
    );
    expect(h.sim.view.pulse.boss.phase).toBe(2);
    // Kill the boss: final Pulse, victory after victory_delay_s.
    e.hp[s] = 1;
    expect(stepUntil(h, () => (keep(), h.of(SimEventType.BossKilled).length > 0), 2000)).toBe(true);
    const killed = h.of(SimEventType.BossKilled)[0]?.tick ?? 0;
    expect(stepUntil(h, () => h.sim.view.phase === 'victory', 600)).toBe(true);
    expect(h.sim.view.tick - killed).toBeGreaterThanOrEqual(h.data.config.victoryDelayTicks);
    expect(h.of(SimEventType.RunEnded)[0]?.a).toBe(RunOutcome.Victory);
  });
});
