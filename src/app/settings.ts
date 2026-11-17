// Default Settings and persistence (architecture.md 6.11, 12). LP.
// Keybinds per ui-spec 8.1; volumes per AU (80/70/100/80); quality Medium (P-REF target).

import { STORAGE_KEYS } from '../core/index.ts';
import type { Settings } from '../core/index.ts';
import type { KeyValueStore } from './storage.ts';

export function defaultSettings(prefersReducedMotion: boolean): Settings {
  return {
    v: 1,
    graphics: { quality: 'medium', screenShake: 100, fullscreen: false },
    audio: {
      master: 80,
      music: 70,
      sfx: 100,
      ui: 80,
      mono: false,
      reduceRepeats: false,
      muteWhenUnfocused: true,
    },
    access: {
      textScale: 0,
      reduceEffects: prefersReducedMotion,
      damageNumbers: true,
      colorVision: 'off',
      pauseWhenUnfocused: true,
      showFlavor: true,
      solidPanels: false,
      shopTimer: 'on',
    },
    keybinds: {
      moveUp: ['KeyW', 'ArrowUp'],
      moveDown: ['KeyS', 'ArrowDown'],
      moveLeft: ['KeyA', 'ArrowLeft'],
      moveRight: ['KeyD', 'ArrowRight'],
      rite: ['Space', null],
      pause: ['Escape', 'KeyP'],
      confirm: ['Enter', 'Space'],
      back: ['Escape', 'Backspace'],
      reroll: ['KeyR', null],
      lock: ['KeyL', null],
      beginPulse: ['KeyB', null],
      stats: ['KeyT', null],
      merge: ['KeyM', null],
      sell: ['KeyX', null],
    },
    seenHowTo: false,
  };
}

/** Load saved settings over the defaults. Unknown or broken data falls back to defaults. */
export function loadSettings(store: KeyValueStore, defaults: Settings): Settings {
  const text = store.get(STORAGE_KEYS.settings);
  if (text === null) return defaults;
  try {
    const saved = JSON.parse(text) as Partial<Settings>;
    if (saved.v !== 1) return defaults;
    return {
      v: 1,
      graphics: { ...defaults.graphics, ...saved.graphics },
      audio: { ...defaults.audio, ...saved.audio },
      access: { ...defaults.access, ...saved.access },
      keybinds: { ...defaults.keybinds, ...saved.keybinds },
      // Added in 1.1: older saves have no field and must still show How to play once.
      seenHowTo: saved.seenHowTo === true,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(store: KeyValueStore, s: Settings): void {
  store.set(STORAGE_KEYS.settings, JSON.stringify(s));
}
