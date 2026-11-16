// Cue table (src/audio/cues/cues.json) and instrument table (src/audio/music/instruments.json):
// parsing, defaults, and validation. Pure: used by the engine at boot, by tests, and by tools/audio.
// Field meaning: docs/audio-list.md section 2.

import { isNoteName, noteToMidi } from './synth/index.ts';
import type { InstrumentDef, LayerSpec, SynthRecipe } from './synth/index.ts';

export type Bus = 'sfx' | 'ui' | 'music';
export type DuckRuleId = 'player_hit' | 'telegraph' | 'reward' | 'big_moment';
export type CuePan = 'center' | 'worldX' | number;

/** Priority value of the ui bus ("U" in audio-list): own voice pool, never competes with sim SFX. */
export const PRIORITY_UI = 7;

/** Live cue renders are cached per length rounded to 50 ms (audio-list 2). */
export const LIVE_STEP_MS = 50;

/** Live cue length key: durSec rounded to 50 ms, at least 50 ms. */
export function liveLengthMs(durSec: number): number {
  return Math.max(LIVE_STEP_MS, Math.round((durSec * 1000) / LIVE_STEP_MS) * LIVE_STEP_MS);
}

/** Default render rate of SFX buffers: cues are lowpassed or short, so 24 kHz keeps memory low. */
export const DEFAULT_CUE_SAMPLE_RATE = 24000;

export interface CueDef extends SynthRecipe {
  readonly index: number;
  /** Buffer sample rate (the browser resamples on playback). */
  readonly sampleRate: number;
  readonly tier: 'A' | 'B' | 'C';
  readonly bus: Bus;
  /** 1 (highest) to 6, PRIORITY_UI for the ui bus. */
  readonly priority: number;
  readonly mode: 'buffer' | 'live';
  readonly maxVoices: number;
  readonly minIntervalMs: number;
  readonly pitchJitter: number;
  readonly gainJitterDb: number;
  readonly sendRoom: number;
  readonly sendHall: number;
  readonly pan: CuePan;
  /** 0 when the cue does not coalesce. */
  readonly coalesceMaxBoostDb: number;
  /** Glint ladder: pitch follows glintLadder of the active song (audio-direction 5.2). */
  readonly ladder: { readonly resetMs: number; readonly baseMidi: number } | null;
  readonly duck: DuckRuleId | null;
  readonly delayMs: number;
  readonly deprecated: boolean;
}

export interface CueTable {
  readonly cues: readonly CueDef[];
  readonly indexOf: ReadonlyMap<string, number>;
}

const CUE_ID_RE = /^(sfx|ui|mus|amb)(\.[a-z0-9_]+){1,4}$/;
const LAYER_KINDS = new Set(['tone', 'noise', 'grains', 'pluck']);
const WAVES = new Set(['sine', 'triangle', 'saw', 'square', 'pulse12', 'pulse25']);
const FILTERS = new Set(['lp', 'hp', 'bp']);
const DUCKS = new Set(['player_hit', 'telegraph', 'reward', 'big_moment']);

type Obj = Readonly<Record<string, unknown>>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Field readers that record problems instead of throwing, so one run lists every error. */
function reader(where: string, o: Obj, errors: string[]) {
  const num = (k: string, def: number | null, min = -Infinity, max = Infinity): number => {
    const v = o[k];
    if (v === undefined && def !== null) return def;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      errors.push(`${where}: "${k}" must be a number in [${min}, ${max}]`);
      return def ?? 0;
    }
    return v;
  };
  const optNum = (k: string): number | null => (o[k] === undefined ? null : num(k, 0, 1));
  const str = <T extends string>(k: string, allowed: ReadonlySet<string>, def: T | null): T => {
    const v = o[k];
    if (v === undefined && def !== null) return def;
    if (typeof v !== 'string' || !allowed.has(v)) {
      errors.push(`${where}: "${k}" must be one of ${[...allowed].join(', ')}`);
      return (def ?? [...allowed][0]) as T;
    }
    return v as T;
  };
  return { num, optNum, str };
}

function checkFreq(where: string, v: unknown, errors: string[]): void {
  if (v === undefined) return;
  if (typeof v === 'number' ? !(v > 0) : typeof v !== 'string' || !isNoteName(v)) {
    errors.push(`${where}: bad frequency ${JSON.stringify(v)}`);
  }
}

/** Validates the shape of a layer list (docs/audio-list.md 2.1). */
export function validateLayers(where: string, layers: unknown, errors: string[]): void {
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push(`${where}: "layers" must be a non-empty array`);
    return;
  }
  layers.forEach((l: unknown, i) => {
    const w = `${where} layer ${i}`;
    if (!isObj(l) || typeof l['kind'] !== 'string' || !LAYER_KINDS.has(l['kind'])) {
      errors.push(`${w}: unknown kind`);
      return;
    }
    const r = reader(w, l, errors);
    for (const k of ['startMs', 'durMs', 'attackMs', 'decayMs', 'releaseMs']) {
      if (l[k] !== undefined) r.num(k, 0, 0, 60000);
    }
    if (l['gainDb'] !== undefined) r.num('gainDb', 0, -96, 24);
    if (l['kind'] === 'tone') {
      r.str('wave', WAVES, null);
      checkFreq(w, l['freq'], errors);
      checkFreq(w, l['freqEnd'], errors);
      if (l['freq'] === undefined && l['ratio'] === undefined) {
        errors.push(`${w}: tone needs freq or ratio`);
      }
    }
    if (l['kind'] === 'pluck') checkFreq(w, l['freq'], errors);
    if (l['kind'] === 'grains') {
      r.num('count', null, 1, 500);
      r.num('freqMin', null, 1, 20000);
      r.num('freqMax', null, 1, 20000);
      r.num('spreadMs', null, 0, 60000);
      r.num('grainMs', null, 1, 10000);
      if (l['wave'] !== undefined && l['wave'] !== 'noise') r.str('wave', WAVES, null);
    }
    const f = l['filter'];
    if (f !== undefined) {
      if (!isObj(f)) errors.push(`${w}: filter must be an object`);
      else {
        const fr = reader(`${w} filter`, f, errors);
        fr.str('type', FILTERS, null);
        fr.num('freq', null, 10, 24000);
      }
    }
    const rep = l['repeat'];
    if (rep !== undefined) {
      if (!isObj(rep)) errors.push(`${w}: repeat must be an object`);
      else {
        const rr = reader(`${w} repeat`, rep, errors);
        rr.num('count', null, 1, 64);
        rr.num('everyMs', null, 1, 10000);
      }
    }
  });
}

function parseCue(raw: unknown, index: number, errors: string[]): CueDef | null {
  if (!isObj(raw) || typeof raw['id'] !== 'string') {
    errors.push(`cue ${index}: missing id`);
    return null;
  }
  const id = raw['id'];
  const where = `cue ${id}`;
  if (!CUE_ID_RE.test(id)) errors.push(`${where}: id must match <domain>.<subject>.<action>`);
  const r = reader(where, raw, errors);
  const bus = r.str<Bus>('bus', new Set(['sfx', 'ui', 'music']), null);
  const prioRaw = raw['priority'];
  let priority = PRIORITY_UI;
  if (bus === 'ui') {
    if (prioRaw !== 'U') errors.push(`${where}: ui cues use priority "U"`);
  } else {
    priority = r.num('priority', null, 1, 6);
  }
  validateLayers(where, raw['layers'], errors);
  const send = isObj(raw['send']) ? raw['send'] : {};
  const sendR = reader(`${where} send`, send, errors);
  const panRaw = raw['pan'];
  let pan: CuePan = 'center';
  if (panRaw === 'worldX' || panRaw === 'center') pan = panRaw;
  else if (typeof panRaw === 'number' && panRaw >= -1 && panRaw <= 1) pan = panRaw;
  else if (panRaw !== undefined) errors.push(`${where}: pan must be center, worldX, or -1..1`);
  const co = raw['coalesce'];
  const coalesceMaxBoostDb = isObj(co) ? reader(`${where} coalesce`, co, errors).num('maxBoostDb', 3, 0, 12) : 0;
  const lad = raw['ladder'];
  let ladder: CueDef['ladder'] = null;
  if (isObj(lad)) {
    const lr = reader(`${where} ladder`, lad, errors);
    const base = lad['baseNote'];
    if (typeof base !== 'string' || !isNoteName(base)) errors.push(`${where}: ladder.baseNote`);
    ladder = {
      resetMs: lr.num('resetMs', 500, 0, 10000),
      baseMidi: typeof base === 'string' && isNoteName(base) ? noteToMidi(base) : 86,
    };
  }
  const duckRaw = raw['duck'];
  let duck: DuckRuleId | null = null;
  if (typeof duckRaw === 'string' && DUCKS.has(duckRaw)) duck = duckRaw as DuckRuleId;
  else if (duckRaw !== undefined && duckRaw !== null) errors.push(`${where}: unknown duck rule`);
  return {
    id,
    index,
    tier: r.str<'A' | 'B' | 'C'>('tier', new Set(['A', 'B', 'C']), 'A'),
    bus,
    priority,
    mode: r.str<'buffer' | 'live'>('mode', new Set(['buffer', 'live']), 'buffer'),
    sampleRate: r.num('sampleRate', DEFAULT_CUE_SAMPLE_RATE, 8000, 48000),
    durationMs: r.num('durationMs', null, 5, 20000),
    gainDb: r.num('gainDb', null, -60, -1),
    attackMs: r.num('attackMs', 0, 0, 1000),
    lowpassHz: r.optNum('lowpassHz'),
    highpassHz: r.optNum('highpassHz'),
    layers: (Array.isArray(raw['layers']) ? raw['layers'] : []) as readonly LayerSpec[],
    maxVoices: r.num('maxVoices', 1, 1, 24),
    minIntervalMs: r.num('minIntervalMs', 0, 0, 10000),
    pitchJitter: r.num('pitchJitter', 0, 0, 0.5),
    gainJitterDb: r.num('gainJitterDb', 0, 0, 12),
    sendRoom: sendR.num('room', 0, 0, 1),
    sendHall: sendR.num('hall', 0, 0, 1),
    pan,
    coalesceMaxBoostDb,
    ladder,
    duck,
    delayMs: r.num('delayMs', 0, 0, 5000),
    deprecated: raw['deprecated'] === true,
  };
}

function parseCuesInto(json: unknown, errors: string[]): CueDef[] {
  const list = isObj(json) ? json['cues'] : undefined;
  if (!Array.isArray(list)) {
    errors.push('cues.json: top level must be { "cues": [...] }');
    return [];
  }
  const cues: CueDef[] = [];
  const seen = new Set<string>();
  list.forEach((raw: unknown, i) => {
    const c = parseCue(raw, cues.length, errors);
    if (c === null) return;
    if (seen.has(c.id)) errors.push(`cue ${c.id}: duplicate id (entry ${i})`);
    seen.add(c.id);
    cues.push(c);
  });
  return cues;
}

/** Every problem in cues.json, empty when valid. */
export function validateCueJson(json: unknown): string[] {
  const errors: string[] = [];
  parseCuesInto(json, errors);
  return errors;
}

/** Parses cues.json and applies defaults. Throws listing every problem (fail fast at boot). */
export function parseCueTable(json: unknown): CueTable {
  const errors: string[] = [];
  const cues = parseCuesInto(json, errors);
  if (errors.length > 0) throw new Error(`Invalid cues.json:\n${errors.join('\n')}`);
  return { cues, indexOf: new Map(cues.map((c) => [c.id, c.index])) };
}

/** Parses instruments.json (map of id to definition). Throws listing every problem. */
export function parseInstruments(json: unknown): ReadonlyMap<string, InstrumentDef> {
  const errors: string[] = [];
  const out = new Map<string, InstrumentDef>();
  const insts = isObj(json) ? json['instruments'] : undefined;
  if (!isObj(insts)) throw new Error('instruments.json: top level must be { "instruments": {...} }');
  for (const [id, raw] of Object.entries(insts)) {
    const where = `instrument ${id}`;
    if (!isObj(raw)) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    const r = reader(where, raw, errors);
    validateLayers(where, raw['layers'], errors);
    const refs = Array.isArray(raw['refNotes']) ? (raw['refNotes'] as unknown[]) : [];
    const refNotes: number[] = [];
    for (const n of refs) {
      if (typeof n === 'string' && isNoteName(n)) refNotes.push(noteToMidi(n));
      else errors.push(`${where}: bad ref note ${JSON.stringify(n)}`);
    }
    const lengthMs = r.num('lengthMs', null, 10, 10000);
    const lp = raw['loop'];
    let loop: InstrumentDef['loop'] = null;
    if (lp !== undefined) {
      if (!isObj(lp)) errors.push(`${where}: loop must be an object`);
      else {
        const lr = reader(`${where} loop`, lp, errors);
        loop = { startMs: lr.num('startMs', null, 1, lengthMs - 100), xfadeMs: lr.num('xfadeMs', 60, 1, 1000) };
      }
    }
    out.set(id, {
      id,
      loop,
      sampleRate: r.num('sampleRate', null, 8000, 96000),
      refNotes,
      lengthMs,
      releaseMs: r.num('releaseMs', 80, 1, 5000),
      peakDb: r.num('peakDb', -3, -40, -1),
      highpassHz: r.optNum('highpassHz'),
      lowpassHz: r.optNum('lowpassHz'),
      layers: (Array.isArray(raw['layers']) ? raw['layers'] : []) as readonly LayerSpec[],
    });
  }
  if (errors.length > 0) throw new Error(`Invalid instruments.json:\n${errors.join('\n')}`);
  return out;
}

function busRank(c: CueDef): number {
  return c.bus === 'ui' ? 0 : c.bus === 'sfx' ? 1 : 2;
}

/** Buffer-mode cues in boot render order: UI first (title clicks), then sim SFX by priority. */
export function bootRenderOrder(table: CueTable): CueDef[] {
  return table.cues
    .filter((c) => c.mode === 'buffer' && !c.deprecated)
    .sort((a, b) => busRank(a) - busRank(b) || a.priority - b.priority);
}
