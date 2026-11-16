// Renders WAV previews of every cue and of the M1 music loops into audio/preview/ (gitignored),
// with the same pure DSP the game runs at boot. Usage: node tools/audio/render-cues.ts [filter]
// Optional filter: only cue ids containing that text (music is skipped when a filter is given).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCueTable, parseInstruments } from '../../src/audio/cue-data.ts';
import { compileSong, notesForBar } from '../../src/audio/music/song.ts';
import type { CompiledSong, NoteEvent } from '../../src/audio/music/song.ts';
import {
  dbToGain,
  mixNote,
  pickRef,
  renderCue,
  renderInstrumentSample,
} from '../../src/audio/synth/index.ts';
import { PREVIEW_DIR, encodeWav, readAudioFiles } from './lib/audio-files.ts';

const MIX_RATE = 48000;

const filter = process.argv[2] ?? '';
const files = readAudioFiles();
const cues = parseCueTable(files.cues);
const instruments = parseInstruments(files.instruments);

mkdirSync(join(PREVIEW_DIR, 'sfx'), { recursive: true });
let t0 = performance.now();
let count = 0;
let sfxBytes = 0;
let sfxSec = 0;
for (const cue of cues.cues) {
  if (cue.deprecated || !cue.id.includes(filter)) continue;
  // Same rate as the game buffer, so previews sound like the game.
  const buf = renderCue(cue, cue.sampleRate);
  sfxBytes += buf.length * 4;
  sfxSec += buf.length / cue.sampleRate;
  writeFileSync(join(PREVIEW_DIR, 'sfx', `${cue.id}.wav`), encodeWav([buf], cue.sampleRate));
  count++;
}
const sfxMs = performance.now() - t0;
console.log(
  `sfx: ${count} cues, ${sfxSec.toFixed(1)} s audio, ` +
    `${(sfxBytes / 1e6).toFixed(2)} MB as Float32, rendered and written in ${sfxMs.toFixed(0)} ms`,
);

if (filter === '') {
  t0 = performance.now();
  const samples = new Map<string, Float32Array[]>();
  for (const def of instruments.values()) {
    const refs: readonly (number | null)[] = def.refNotes.length > 0 ? def.refNotes : [null];
    const list = refs.map((r) => renderInstrumentSample(def, r));
    samples.set(def.id, list);
  }
  console.log(`instruments: ${instruments.size} rendered in ${(performance.now() - t0).toFixed(0)} ms`);

  const known = new Set(instruments.keys());
  const songs = new Map<string, CompiledSong>();
  for (const [file, json] of files.songs) {
    const errors: string[] = [];
    const song = compileSong(json, known, errors);
    if (song === null || errors.length > 0) throw new Error(`${file}:\n${errors.join('\n')}`);
    songs.set(song.id, song);
  }

  /** Offline mix of bars at a fixed level. No hall reverb (convolution is browser-only). */
  const mixSong = (song: CompiledSong, level: number, bars: number): readonly [Float32Array, Float32Array] => {
    const tail = 2.5;
    const n = Math.ceil((bars * song.barSec + tail) * MIX_RATE);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    const notes: NoteEvent[] = [];
    for (let bar = 0; bar < bars; bar++) {
      notesForBar(song, bar, level, notes);
      for (const note of notes) {
        const def = instruments.get(note.inst);
        const bufs = samples.get(note.inst);
        if (def === undefined || bufs === undefined) continue;
        const pitched = def.refNotes.length > 0;
        const ref = pitched ? pickRef(def.refNotes, note.midi) : { index: 0, rate: 1 };
        const sample = bufs[ref.index];
        if (sample === undefined) continue;
        mixNote(l, r, MIX_RATE, {
          sample,
          sampleRate: def.sampleRate,
          rate: ref.rate,
          startSec: bar * song.barSec + note.step * song.stepSec,
          holdSec: pitched ? note.lenSteps * song.stepSec : sample.length / def.sampleRate,
          releaseSec: def.releaseMs / 1000,
          gain: note.vel * dbToGain(note.gainDb),
          pan: note.pan,
        });
      }
    }
    return [l, r];
  };

  mkdirSync(join(PREVIEW_DIR, 'music'), { recursive: true });
  const jobs: readonly [string, number, number][] = [
    ['mus.biome1.pulse', 0, 16],
    ['mus.biome1.pulse', 1, 16],
    ['mus.biome1.pulse', 2, 8],
    ['mus.biome1.pulse', 3, 8],
    ['mus.shop', 0, 8],
  ];
  for (const [id, level, bars] of jobs) {
    const song = songs.get(id);
    if (song === undefined) continue;
    const t = performance.now();
    const [l, r] = mixSong(song, level, bars);
    const name = `${id}.L${level}.wav`;
    writeFileSync(join(PREVIEW_DIR, 'music', name), encodeWav([l, r], MIX_RATE));
    console.log(`music: ${name} (${bars} bars) in ${(performance.now() - t).toFixed(0)} ms`);
  }
}
console.log(`previews in ${PREVIEW_DIR}`);
