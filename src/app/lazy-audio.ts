// Lazy audio (LP M2-09, architecture 13 bundle budget): src/audio (synth, songs, cue tables) is a
// separate chunk loaded on the first user gesture or when the page is idle, whichever comes first.
// Until it arrives this proxy keeps the last settings, arena, pause, and hidden state and replays
// them on the real AudioSystem. Nothing can sound before unlock(), so frames before the load lose
// nothing; the real system reads the WorldView every frame and catches up on its own.

import type { ArenaDef, AudioSystem, CreateAudio, Settings } from '../core/index.ts';
import type { GameData } from '../content/index.ts';

export type AudioModuleLoader = () => Promise<{ readonly createAudio: CreateAudio }>;

export interface LazyAudio extends AudioSystem {
  /** Start loading the chunk without unlocking (idle prefetch). Safe to call more than once. */
  preload(): Promise<void>;
  /** True once the real AudioSystem exists. */
  readonly loaded: boolean;
}

export function createLazyAudio(data: GameData, load: AudioModuleLoader): LazyAudio {
  let real: AudioSystem | null = null;
  let loading: Promise<void> | null = null;
  let disposed = false;
  let settings: Settings['audio'] | null = null;
  let arena: ArenaDef | null = null;
  let paused = false;
  let hidden = false;

  const preload = (): Promise<void> => {
    loading ??= load().then((mod) => {
      if (disposed) return;
      const a = mod.createAudio(data);
      if (settings !== null) a.applySettings(settings);
      if (arena !== null) a.setArena(arena);
      if (paused) a.setPaused(true);
      if (hidden) a.setHidden(true);
      real = a;
    });
    // A failed chunk load may be retried by the next gesture.
    loading.catch(() => {
      loading = null;
    });
    return loading;
  };

  return {
    preload,
    get loaded() {
      return real !== null;
    },
    unlock() {
      // Loaded already: unlock synchronously inside the gesture (autoplay policy).
      if (real !== null) return real.unlock();
      return preload().then(() => real?.unlock());
    },
    update(view, events, dtSec) {
      real?.update(view, events, dtSec);
    },
    playUi(cueId) {
      real?.playUi(cueId);
    },
    applySettings(s) {
      settings = s;
      real?.applySettings(s);
    },
    setArena(a) {
      arena = a;
      real?.setArena(a);
    },
    setPaused(p) {
      paused = p;
      real?.setPaused(p);
    },
    setHidden(h) {
      hidden = h;
      real?.setHidden(h);
    },
    dispose() {
      disposed = true;
      real?.dispose();
      real = null;
    },
  };
}
