// audio:check (architecture 15.1, audio-direction 11 test A-5): validates cues.json, routes.json,
// instruments.json, and every song file, plus the gzip budget of audio data. Exit 1 on any error.
// Usage: node tools/audio/validate.ts

import { gzipSync } from 'node:zlib';
import { parseCueTable, parseInstruments, validateCueJson } from '../../src/audio/cue-data.ts';
import { validateRoutes } from '../../src/audio/event-map.ts';
import type { Routes } from '../../src/audio/event-map.ts';
import { compileSong } from '../../src/audio/music/song.ts';
import { readAudioFiles } from './lib/audio-files.ts';

/** architecture 13: audio data gzip target 15 KB (CI fail at 25 KB). */
const DATA_GZIP_TARGET = 15 * 1024;

const files = readAudioFiles();
const errors: string[] = [...validateCueJson(files.cues)];
let known = new Set<string>();
try {
  known = new Set(parseInstruments(files.instruments).keys());
} catch (e) {
  errors.push(String(e));
}
const songIds = new Set<string>();
for (const [file, json] of files.songs) {
  const songErrors: string[] = [];
  const song = compileSong(json, known, songErrors);
  errors.push(...songErrors.map((m) => `${file}: ${m}`));
  if (song === null) continue;
  if (`${song.id}.json` !== file) errors.push(`${file}: id ${song.id} must match the file name`);
  songIds.add(song.id);
}
if (errors.length === 0) {
  // Stingers in routes.json must name song files (one-shot songs since M2).
  errors.push(...validateRoutes(files.routes as Routes, parseCueTable(files.cues), songIds));
}

// Minified size is what Vite ships.
const minified = files.rawText.map((t) => JSON.stringify(JSON.parse(t))).join('');
const gz = gzipSync(minified).length;
const sizeLine = `audio data gzip ${(gz / 1024).toFixed(1)} KB (target ${DATA_GZIP_TARGET / 1024} KB)`;
if (gz > DATA_GZIP_TARGET) errors.push(sizeLine);

if (errors.length > 0) {
  console.error(`audio:check failed (${errors.length}):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`audio:check ok: ${files.songs.size} songs, ${sizeLine}`);
