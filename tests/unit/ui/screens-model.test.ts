import { describe, expect, it } from 'vitest';
import { encodeSource, SourceKind, TICK_RATE } from '../../../src/core/index.ts';
import { buildLevelUpModel, buildRewardModel } from '../../../src/ui/presenters/choices.ts';
import { resolveScreenId } from '../../../src/ui/presenters/phase.ts';
import { buildRunEndModel, killerNameKey } from '../../../src/ui/presenters/run-end.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';
import { pl, pu } from './writable.ts';

const data = fixtureGameData('A');

describe('screen routing', () => {
  it('maps app screens to their ids', () => {
    expect(resolveScreenId('title', null, false, false)).toBe('title');
    expect(resolveScreenId('classSelect', 'idle', false, false)).toBe('class-select');
    expect(resolveScreenId('settings', 'shop', false, false)).toBe('settings');
    expect(resolveScreenId('paused', 'pulse', false, false)).toBe('pause');
  });

  it('derives run screens from the phase', () => {
    expect(resolveScreenId('run', 'pulse', false, false)).toBe('pulse');
    expect(resolveScreenId('run', 'pulseClear', false, false)).toBe('pulse');
    expect(resolveScreenId('run', 'reward', false, false)).toBe('warden-reward');
    expect(resolveScreenId('run', 'levelUp', false, false)).toBe('level-up');
    expect(resolveScreenId('run', 'shop', false, false)).toBe('glazier');
    expect(resolveScreenId('run', 'defeat', false, false)).toBe('run-end');
    expect(resolveScreenId('run', 'victory', false, false)).toBe('run-end');
  });

  it('ignores the previous run end right after a new run starts', () => {
    expect(resolveScreenId('run', 'defeat', true, false)).toBe('pulse');
  });

  it('reports the confirm dialog on top of pause', () => {
    expect(resolveScreenId('paused', 'pulse', false, true)).toBe('confirm');
    expect(resolveScreenId('title', null, false, true)).toBe('title');
  });
});

describe('Temper (level-up) model', () => {
  it('shows the level being tempered, the queue position and a stat preview', () => {
    const w = createFakeWorld({ phase: 'levelUp', statCount: data.stats.length });
    pl(w).level = 5;
    const armor = data.stats.findIndex((s) => s.id === 'armor');
    (w.player.stats as Float64Array)[armor] = 2;
    w.levelUp = {
      revision: 7,
      pending: 2,
      total: 2,
      choices: [
        {
          cardIndex: data.levelUpCards.findIndex((c) => c.id === 'card_armor'),
          rarity: 1,
          value: 2,
        },
        {
          cardIndex: data.levelUpCards.findIndex((c) => c.id === 'card_damage'),
          rarity: 0,
          value: 4,
        },
      ],
    };
    const m = buildLevelUpModel(w, data);
    expect(m.level).toBe(4);
    expect(m.queueIndex).toBe(1);
    expect(m.queueTotal).toBe(2);
    expect(m.cards[0]?.nameKey).toBe('stat.armor');
    expect(m.cards[0]?.descKey).toBe('card.armor');
    expect(m.cards[0]?.descParams).toEqual({ value: '2' });
    expect(m.cards[0]?.statChange).toEqual({ statKey: 'stat.armor', before: '2', after: '4' });
    expect(m.cards[0]?.rarityOrder).toBe(1);
  });

  it('counts the second pick of a queue as 2 of 2', () => {
    const w = createFakeWorld({ phase: 'levelUp' });
    pl(w).level = 5;
    w.levelUp = { revision: 8, pending: 1, total: 2, choices: [] };
    const m = buildLevelUpModel(w, data);
    expect(m.level).toBe(5);
    expect(m.queueIndex).toBe(2);
  });
});

describe('Warden reward model', () => {
  it('names the source Warden and lists Memento cards with flavor', () => {
    const w = createFakeWorld({ phase: 'reward' });
    w.reward = {
      revision: 2,
      sourceTypeIndex: data.index.enemy('test_warden'),
      choices: [{ mementoIndex: data.index.memento('test_lens'), rarity: 1 }],
    };
    const m = buildRewardModel(w, data);
    expect(m.sourceNameKey).toBe('unlit.test_warden');
    expect(m.cards[0]?.nameKey).toBe('memento.test_lens.name');
    expect(m.cards[0]?.flavorKey).toBe('memento.test_lens.flavor');
    expect(m.cards[0]?.tags).toEqual(['shard']);
  });
});

describe('run end model', () => {
  it('decodes the killing source into an Unlit name (K4)', () => {
    const charger = data.index.enemy('test_charger');
    expect(killerNameKey(data, encodeSource(SourceKind.EnemyContact, charger))).toBe(
      'unlit.test_charger',
    );
    expect(killerNameKey(data, encodeSource(SourceKind.EnemyAttack, charger))).toBe(
      'unlit.test_charger',
    );
    expect(killerNameKey(data, 0)).toBeNull();
    expect(killerNameKey(data, encodeSource(SourceKind.Weapon, 0))).toBeNull();
  });

  it('summarises a defeat with the Pulse reached, time and build', () => {
    const w = createFakeWorld({ phase: 'defeat' });
    pu(w).index = 6;
    pu(w).count = 10;
    w.runStats = {
      ...w.runStats,
      kills: 412,
      glintEarned: 230,
      runTicks: TICK_RATE * 125,
      killedBy: encodeSource(SourceKind.EnemyContact, data.index.enemy('test_swarmer')),
    };
    w.shop = {
      ...w.shop,
      inventory: [
        { weaponIndex: data.index.weapon('test_bolt'), tier: 2, sellPrice: 5, canMerge: false },
      ],
    };
    const m = buildRunEndModel(w, data);
    expect(m.won).toBe(false);
    expect(m.pulseReached).toBe(7);
    expect(m.pulseCount).toBe(10);
    expect(m.timeText).toBe('2:05');
    expect(m.killerKey).toBe('unlit.test_swarmer');
    expect(m.classId).toBe('test_lamp');
    expect(m.build.weapons[0]?.level).toBe(2);
  });

  it('shows the full Pulse count and no killer on victory', () => {
    const w = createFakeWorld({ phase: 'victory' });
    pu(w).count = 10;
    pu(w).index = 9;
    const m = buildRunEndModel(w, data);
    expect(m.won).toBe(true);
    expect(m.pulseReached).toBe(10);
    expect(m.killerKey).toBeNull();
  });
});
