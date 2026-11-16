// Public API of src/audio (Audio Director). Other modules import only from here (architecture.md 5).
// No AudioContext before unlock(); the sim hash never depends on audio (AU A-8).

import type { CreateAudio } from '../core/index.ts';
import { createAudioSystem } from './audio-system.ts';
import cues from './cues/cues.json';
import routes from './cues/routes.json';
import instruments from './music/instruments.json';
import songBoss from './music/mus.biome1.boss.json';
import songPulse from './music/mus.biome1.pulse.json';
import songEnd from './music/mus.end.json';
import songOverlay from './music/mus.overlay.unlit.json';
import songShop from './music/mus.shop.json';
import stBossDefeated from './music/mus.stinger.boss_defeated.json';
import stBossIntro from './music/mus.stinger.boss_intro.json';
import stBossPhase from './music/mus.stinger.boss_phase.json';
import stDefeat from './music/mus.stinger.defeat.json';
import stPulseEnd from './music/mus.stinger.pulse_end.json';
import stPulseStart from './music/mus.stinger.pulse_start.json';
import stVictory from './music/mus.stinger.victory.json';
import stWarden from './music/mus.stinger.warden.json';
import songTitle from './music/mus.title.json';
import { createWorkerRenderer } from './render-jobs.ts';
import type { BufferRenderer, WorkerLike } from './render-jobs.ts';

/** Boot rendering runs in a Web Worker when the browser allows it (audio-direction 2.2). */
function workerRenderer(): BufferRenderer | null {
  if (typeof Worker === 'undefined') return null;
  const worker = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' });
  // WorkerLike is the subset the renderer uses (DOM handler types carry a `this` parameter).
  return createWorkerRenderer(worker as unknown as WorkerLike);
}

export const createAudio: CreateAudio = (data) =>
  createAudioSystem(
    data,
    {
      cues,
      routes,
      instruments,
      songs: [
        songTitle,
        songPulse,
        songOverlay,
        songShop,
        songBoss,
        songEnd,
        stPulseStart,
        stPulseEnd,
        stWarden,
        stBossIntro,
        stBossPhase,
        stBossDefeated,
        stVictory,
        stDefeat,
      ],
    },
    { createRenderer: workerRenderer },
  );

export { createAudioSystem } from './audio-system.ts';
export type { AudioData, AudioEnv } from './audio-system.ts';
