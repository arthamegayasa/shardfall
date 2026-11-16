// LP M2-09: the lazy audio proxy keeps state set before the chunk loads and replays it on the real
// AudioSystem; unlock loads the chunk first, and calls after the load go straight through.

import { describe, expect, it } from 'vitest';
import type { ArenaDef, AudioSystem, Settings } from '../../../src/core/index.ts';
import { createLazyAudio } from '../../../src/app/lazy-audio.ts';
import { defaultSettings } from '../../../src/app/settings.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';

function fakeAudio(log: string[]): AudioSystem {
  return {
    unlock: () => {
      log.push('unlock');
      return Promise.resolve();
    },
    update: () => {
      log.push('update');
    },
    playUi: (id) => {
      log.push(`ui:${id}`);
    },
    applySettings: (s) => {
      log.push(`settings:${s.master}`);
    },
    setArena: (a) => {
      log.push(`arena:${a.id}`);
    },
    setPaused: (p) => {
      log.push(`paused:${p}`);
    },
    setHidden: (h) => {
      log.push(`hidden:${h}`);
    },
    dispose: () => {
      log.push('dispose');
    },
  };
}

describe('lazy audio (LP M2-09)', () => {
  const data = fixtureGameData('A');
  const audioSettings: Settings['audio'] = { ...defaultSettings(false).audio, master: 42 };

  it('loads on unlock and replays settings, arena, pause, hidden in that order', async () => {
    const log: string[] = [];
    let loads = 0;
    const lazy = createLazyAudio(data, () => {
      loads++;
      return Promise.resolve({ createAudio: () => fakeAudio(log) });
    });
    lazy.applySettings(audioSettings);
    lazy.setArena({ id: 'arena_x' } as ArenaDef);
    lazy.setPaused(true);
    lazy.setHidden(true);
    lazy.playUi('ui.focus');
    expect(lazy.loaded).toBe(false);
    await lazy.unlock();
    expect(loads).toBe(1);
    expect(lazy.loaded).toBe(true);
    expect(log).toEqual(['settings:42', 'arena:arena_x', 'paused:true', 'hidden:true', 'unlock']);
    lazy.playUi('ui.confirm');
    await lazy.unlock();
    expect(loads).toBe(1);
    expect(log.slice(-2)).toEqual(['ui:ui.confirm', 'unlock']);
  });

  it('a failed load can be retried', async () => {
    const log: string[] = [];
    let fail = true;
    const lazy = createLazyAudio(data, () =>
      fail
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ createAudio: () => fakeAudio(log) }),
    );
    await expect(lazy.unlock()).rejects.toThrow('offline');
    fail = false;
    await lazy.unlock();
    expect(log).toEqual(['unlock']);
  });
});
