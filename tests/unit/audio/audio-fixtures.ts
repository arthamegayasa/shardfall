// Shared helpers for audio unit tests: real audio data files and a tiny event reader builder.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SimEventReader } from '../../../src/core/index.ts';
import { parseCueTable, parseInstruments } from '../../../src/audio/cue-data.ts';
import type { CueTable } from '../../../src/audio/cue-data.ts';
import type { Routes } from '../../../src/audio/event-map.ts';

const AUDIO = resolve(import.meta.dirname, '..', '..', '..', 'src', 'audio');

export function readJson(...p: string[]): unknown {
  return JSON.parse(readFileSync(join(AUDIO, ...p), 'utf8')) as unknown;
}

export const cuesJson = readJson('cues', 'cues.json');
export const routes = readJson('cues', 'routes.json') as Routes;
export const instrumentsJson = readJson('music', 'instruments.json');
export const pulseSongJson = readJson('music', 'mus.biome1.pulse.json');
export const shopSongJson = readJson('music', 'mus.shop.json');

export function realCues(): CueTable {
  return parseCueTable(cuesJson);
}

export function knownInstruments(): Set<string> {
  return new Set(parseInstruments(instrumentsJson).keys());
}

export interface EventRow {
  readonly type: number;
  readonly x?: number;
  readonly y?: number;
  readonly a?: number;
  readonly b?: number;
  readonly c?: number;
}

export function events(rows: readonly EventRow[]): SimEventReader {
  return {
    count: rows.length,
    type: rows.map((r) => r.type),
    x: rows.map((r) => r.x ?? 0),
    y: rows.map((r) => r.y ?? 0),
    a: rows.map((r) => r.a ?? 0),
    b: rows.map((r) => r.b ?? 0),
    c: rows.map((r) => r.c ?? 0),
  };
}
