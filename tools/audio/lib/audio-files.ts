// Shared helpers for tools/audio: reading the audio data files and writing WAV previews.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..', '..');
export const AUDIO_SRC = join(ROOT, 'src', 'audio');
export const PREVIEW_DIR = join(ROOT, 'audio', 'preview');

export interface AudioFiles {
  readonly cues: unknown;
  readonly routes: unknown;
  readonly instruments: unknown;
  /** Song files by file name (src/audio/music/mus.*.json). */
  readonly songs: ReadonlyMap<string, unknown>;
  /** Raw text of every data file, for the size budget. */
  readonly rawText: readonly string[];
}

export function readAudioFiles(): AudioFiles {
  const rawText: string[] = [];
  const read = (...p: string[]): unknown => {
    const text = readFileSync(join(AUDIO_SRC, ...p), 'utf8');
    rawText.push(text);
    return JSON.parse(text) as unknown;
  };
  const songs = new Map<string, unknown>();
  for (const f of readdirSync(join(AUDIO_SRC, 'music')).sort()) {
    if (f.startsWith('mus.') && f.endsWith('.json')) songs.set(f, read('music', f));
  }
  return {
    cues: read('cues', 'cues.json'),
    routes: read('cues', 'routes.json'),
    instruments: read('music', 'instruments.json'),
    songs,
    rawText,
  };
}

/** 16-bit PCM WAV from one (mono) or two (stereo) channels in [-1, 1]. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  const dataBytes = n * ch * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      v.setInt16(o, Math.round(s * 32767), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}
