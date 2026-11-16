import { describe, expect, it } from 'vitest';
import {
  KEEPING_TABS,
  mementoArchive,
  nextKeepingTab,
} from '../../../src/ui/presenters/keeping.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';

const data = fixtureGameData('A');

describe('The Keeping Memento archive model (ui-spec S09)', () => {
  it('lists every Memento in data order and hides the ones not yet found', () => {
    const a = mementoArchive(data, ['test_lens']);
    expect(a.entries.map((e) => e.id)).toEqual(['test_charm', 'test_lens']);
    expect(a.found).toBe(1);
    expect(a.total).toBe(2);

    const [charm, lens] = a.entries;
    expect(charm?.found).toBe(false);
    expect(charm?.nameKey).toBeNull();
    expect(charm?.descKey).toBeNull();
    expect(charm?.flavorKey).toBeNull();
    expect(charm?.tags).toEqual([]);
    expect(charm?.rarityOrder).toBe(0);
    // The silhouette still draws from the Memento's own icon.
    expect(charm?.icon).toEqual({ kind: 'memento', id: 'test_charm' });

    expect(lens?.found).toBe(true);
    expect(lens?.nameKey).toBe('memento.test_lens.name');
    expect(lens?.descKey).toBe('memento.test_lens.desc');
    expect(lens?.icon).toEqual({ kind: 'memento', id: 'test_lens' });
  });

  it('counts only ids that exist in the current data (old saves, other tiers)', () => {
    const a = mementoArchive(data, ['test_charm', 'test_charm', 'gone_from_data', 'test_lens']);
    expect(a.found).toBe(2);
    expect(a.total).toBe(2);
    expect(mementoArchive(data, []).found).toBe(0);
  });

  it('cycles between the two tabs with Q and E', () => {
    expect(KEEPING_TABS.map((t) => t.id)).toEqual(['kept', 'mementos']);
    expect(nextKeepingTab('kept', 1)).toBe('mementos');
    expect(nextKeepingTab('mementos', 1)).toBe('kept');
    expect(nextKeepingTab('kept', -1)).toBe('mementos');
  });
});
