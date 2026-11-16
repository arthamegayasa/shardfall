// Public API of src/audio (Audio Director). Other modules import only from here (architecture.md 5).
// STUB from LP (M1-01): silent AudioSystem with the frozen contract.
// TODO(AU, M1-06): engine (bus graph per audio-direction 8.1), synth/ (pure DSP, Node-testable),
// cues/cues.json, music/<cue-id>.json, event-map.ts (SimEventType + GameData ids to cues).
// Rules: no AudioContext before unlock(); hash of the sim must not change with audio on or off.

import type { AudioSystem, CreateAudio } from '../core/index.ts';

export const createAudio: CreateAudio = (_data): AudioSystem => ({
  unlock() {
    return Promise.resolve();
  },
  update() {
    // Listener only: reads view and events, never writes.
  },
  playUi() {
    // TODO(AU, M1-06): UI cues.
  },
  applySettings() {
    // TODO(AU, M1-06): bus gains (v / 100) ^ 2, mono, reduce repeats.
  },
  setArena() {
    // TODO(AU, M1-06): worldX panning bounds from arena.boundary.
  },
  setPaused() {
    // TODO(AU, M1-06): pause lowpass.
  },
  setHidden() {
    // TODO(AU, M1-06): suspend when muteWhenUnfocused.
  },
  dispose() {
    // Nothing allocated yet.
  },
});
