// Public API of src/audio (Audio Director). Other modules import only from here (architecture.md 5).
// No AudioContext before unlock(); the sim hash never depends on audio (AU A-8).

import type { CreateAudio } from '../core/index.ts';
import { createAudioSystem } from './audio-system.ts';
import cues from './cues/cues.json';
import routes from './cues/routes.json';
import instruments from './music/instruments.json';
import songPulse from './music/mus.biome1.pulse.json';
import songShop from './music/mus.shop.json';

export const createAudio: CreateAudio = (data) =>
  createAudioSystem(data, { cues, routes, instruments, songs: [songPulse, songShop] });

export { createAudioSystem } from './audio-system.ts';
export type { AudioData } from './audio-system.ts';
