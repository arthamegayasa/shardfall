// UI 1.1 (docs/ui/redesign-1.1.md 3.4): the How to play screen shows once before the very first run.
// The "seen" flag lives in shardfall.settings.v1; saves written before 1.1 lack it and must still load.
import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../../src/core/index.ts';
import { defaultSettings, loadSettings, saveSettings } from '../../../src/app/settings.ts';
import type { KeyValueStore } from '../../../src/app/storage.ts';

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const m = new Map(Object.entries(init));
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => {
      m.set(k, v);
      return true;
    },
    remove: (k) => {
      m.delete(k);
    },
  };
}

/** A settings save exactly as 1.0 wrote it (no seenHowTo field). */
const OLD_SAVE = JSON.stringify({
  v: 1,
  graphics: { quality: 'high', screenShake: 40, fullscreen: false },
  audio: {
    master: 55,
    music: 70,
    sfx: 100,
    ui: 80,
    mono: false,
    reduceRepeats: false,
    muteWhenUnfocused: true,
  },
  access: { textScale: 2, reduceEffects: false, colorVision: 'tritan' },
  keybinds: { rite: ['KeyQ', null] },
});

describe('settings persistence: seenHowTo (How to play shown once)', () => {
  it('defaults to not seen', () => {
    expect(defaultSettings(false).seenHowTo).toBe(false);
  });

  it('a fresh device (no save) has not seen it', () => {
    expect(loadSettings(memoryStore(), defaultSettings(false)).seenHowTo).toBe(false);
  });

  it('loads a 1.0 save without the field: not seen, every other value kept', () => {
    const s = loadSettings(
      memoryStore({ [STORAGE_KEYS.settings]: OLD_SAVE }),
      defaultSettings(false),
    );
    expect(s.seenHowTo).toBe(false);
    expect(s.graphics.quality).toBe('high');
    expect(s.audio.master).toBe(55);
    expect(s.access.textScale).toBe(2);
    expect(s.access.colorVision).toBe('tritan');
    expect(s.keybinds.rite).toEqual(['KeyQ', null]);
    expect(s.keybinds.pause).toEqual(['Escape', 'KeyP']);
  });

  it('round-trips seen = true through save and load', () => {
    const store = memoryStore();
    saveSettings(store, { ...defaultSettings(false), seenHowTo: true });
    expect(loadSettings(store, defaultSettings(false)).seenHowTo).toBe(true);
  });

  it('treats a broken value as not seen', () => {
    const broken = JSON.stringify({ ...JSON.parse(OLD_SAVE), seenHowTo: 'yes' });
    const s = loadSettings(
      memoryStore({ [STORAGE_KEYS.settings]: broken }),
      defaultSettings(false),
    );
    expect(s.seenHowTo).toBe(false);
  });
});
