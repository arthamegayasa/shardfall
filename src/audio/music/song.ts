// Song data (src/audio/music/<cue-id>.json, audio-direction 7): validation (test A-5), compile,
// and per-bar note generation. Pure, shared by the browser sequencer and the Node preview mixdown.

import { isNoteName, noteToMidi } from '../synth/index.ts';

export const STEPS_PER_BAR = 16;
/** Highest intensity level: 0 to 3 for Pulse songs, 4 is the enraged boss (audio-direction 6.6). */
export const MAX_LEVEL = 4;
/** Lanes of the kit instrument (audio-direction 4.1). Sample ids are "kit.<lane>". */
export const KIT_LANES = ['kick', 'tom', 'snare', 'hat', 'hat_open', 'shaker', 'timp'] as const;

const CHORD_QUALITIES: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '6': [0, 4, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};
const CHORD_RE = /^([A-G])(#|b)?(.*)$/;
const RHYTHM_RE = /^[Xx._-]{16}$/;
const LAYER_TYPES = new Set(['chord', 'chordRoot', 'arp', 'melody', 'drum', 'note']);

export interface Chord {
  /** Pitch class 0..11 of the root. */
  readonly root: number;
  readonly intervals: readonly number[];
}

export function parseChord(sym: string): Chord | null {
  const m = CHORD_RE.exec(sym);
  if (m === null) return null;
  const q = CHORD_QUALITIES[m[3] ?? ''];
  if (q === undefined) return null;
  const pc = (noteToMidi(`${m[1] ?? 'C'}${m[2] ?? ''}4`) - 60 + 12) % 12;
  return { root: pc, intervals: q };
}

/**
 * One note to play, in steps relative to the bar start. inst is an instrument or "kit.<lane>".
 * Mutable on purpose: NoteBuffer reuses the objects bar after bar (no per-bar allocation).
 */
export interface NoteEvent {
  inst: string;
  midi: number;
  step: number;
  lenSteps: number;
  vel: number;
  gainDb: number;
  pan: number;
  hall: number;
  /** Index of the song layer (per-layer fades in the player). */
  layer: number;
}

/** Reusable list of notes: count is the length, items beyond count are spare objects. */
export interface NoteBuffer {
  count: number;
  readonly items: NoteEvent[];
}

export function createNoteBuffer(): NoteBuffer {
  return { count: 0, items: [] };
}

interface Hit {
  readonly step: number;
  readonly len: number;
  readonly vel: number;
}

interface ArpToken {
  readonly idx: number;
  readonly oct: number;
}

interface MelNote {
  readonly midi: number | null;
  readonly step: number;
  readonly len: number;
  readonly vel: number;
}

export interface CompiledLayer {
  readonly id: string;
  readonly instrument: string;
  readonly type: string;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly everyBars: number;
  /** Section names the layer plays in, null = every section. */
  readonly sections: ReadonlySet<string> | null;
  readonly gainDb: number;
  readonly pan: number;
  readonly hall: number;
  readonly octave: number;
  readonly voicing: 'close' | 'open';
  /** Rhythm patterns cycled per loop bar (a list gives multi-bar phrases and fills). */
  readonly rhythms: readonly (readonly Hit[])[];
  readonly arps: readonly (readonly ArpToken[])[];
  readonly stepLen: number;
  readonly lanes: readonly { readonly lane: string; readonly patterns: readonly (readonly Hit[])[] }[];
  /** Melody: per section name, per bar of the section, the notes. */
  readonly melody: ReadonlyMap<string, readonly (readonly MelNote[])[]> | null;
  /** Melody bars played in rotation (overlay style). */
  readonly rotation: readonly (readonly MelNote[])[] | null;
  readonly fixedNotes: readonly number[];
  readonly double: { readonly instrument: string; readonly octave: number; readonly gainDb: number } | null;
}

/** Boss song levels from the boss state (audio-direction 6.6). */
export interface BossLevels {
  /** Before the boss emerges (intro): drone and choir. */
  readonly intro: number;
  readonly phase1: number;
  /** Phase 1 after lateAfterSec or below lateBelowHpFrac. */
  readonly phase1Late: number;
  readonly lateAfterSec: number;
  readonly lateBelowHpFrac: number;
  readonly phase2: number;
  readonly enraged: number;
  /** Silence after BossPhaseChanged into phase 2, filled by the phase stinger. */
  readonly phaseBreakSec: number;
}

export interface IntensityRules {
  readonly max: number;
  readonly baseByPulse: readonly { readonly fromPulse: number; readonly level: number }[];
  readonly progressSteps: readonly { readonly atProgress: number; readonly add: number }[];
  /** Added while MusicPressureChanged says "crowded" (GD Q21), held at least holdBars bars. */
  readonly pressure: { readonly add: number; readonly holdBars: number } | null;
  readonly wardenAliveMinLevel: number;
  /** Level while the Warden is hasted in overtime (audio-direction 6.4). */
  readonly wardenHastedLevel: number;
  readonly riserSecondsBeforeEnd: number | null;
  readonly fadeInBeats: number;
  readonly fadeOutBeats: number;
  readonly boss: BossLevels | null;
}

export interface CompiledSong {
  readonly id: string;
  readonly bpm: number;
  readonly stepSec: number;
  readonly barSec: number;
  /** Bars in one loop of the form. */
  readonly loopBars: number;
  /** Section name and chord per bar of the loop. */
  readonly barSection: readonly string[];
  readonly barIndexInSection: readonly number[];
  readonly barChord: readonly Chord[];
  readonly glintLadder: readonly number[];
  readonly intensity: IntensityRules | null;
  readonly layers: readonly CompiledLayer[];
  /** Instruments and kit lanes the song uses (for sample rendering). */
  readonly instruments: ReadonlySet<string>;
  /** Stinger: plays its bars once, then rings out for tailSec (audio-direction 7.6). */
  readonly oneShot: boolean;
  readonly tailSec: number;
  /** Overlay: plays on the bar clock and tempo of the song under it (mus.overlay.unlit). */
  readonly followsHost: boolean;
  /** Song trim added to every layer (gain staging, audio-direction 8.2). */
  readonly gainDb: number;
}

type Obj = Readonly<Record<string, unknown>>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseRhythm(p: string, noteSteps: number): Hit[] {
  const hits: Hit[] = [];
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    const ch = p[i];
    if (ch !== 'X' && ch !== 'x' && ch !== '.') continue;
    let len = 1;
    while (i + len < STEPS_PER_BAR && p[i + len] === '_') len++;
    if (len === 1) len = noteSteps;
    hits.push({ step: i, len, vel: ch === 'X' ? 1 : ch === 'x' ? 0.75 : 0.4 });
  }
  return hits;
}

/** A string or a list of strings (patterns cycled per bar). */
function strList(v: unknown): string[] | null {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')) return v;
  return null;
}

function parsePatterns(v: unknown, noteSteps: number, where: string, errors: string[]): Hit[][] {
  const list = strList(v);
  if (list === null) {
    errors.push(`${where}: rhythm must be a pattern or a list of patterns`);
    return [];
  }
  const out: Hit[][] = [];
  list.forEach((p, i) => {
    if (!RHYTHM_RE.test(p)) errors.push(`${where}[${i}]: rhythm must be 16 chars of X x . _ -`);
    else out.push(parseRhythm(p, noteSteps));
  });
  return out;
}

function parseMelodyBar(bar: string, where: string, errors: string[]): MelNote[] {
  const notes: MelNote[] = [];
  let step = 0;
  for (const tok of bar.trim().split(/\s+/)) {
    const m = /^(r|[A-G](?:#|b)?-?\d):(\d+)(!?)$/.exec(tok);
    if (m === null || (m[1] !== 'r' && !isNoteName(m[1] ?? ''))) {
      errors.push(`${where}: bad melody token "${tok}"`);
      continue;
    }
    const len = Number(m[2]);
    if (m[1] !== 'r') {
      notes.push({ midi: noteToMidi(m[1] ?? 'C4'), step, len, vel: m[3] === '!' ? 1 : 0.8 });
    }
    step += len;
  }
  if (step !== STEPS_PER_BAR) errors.push(`${where}: bar has ${step} steps, expected 16`);
  return notes;
}

function parseArp(tokens: string, stepLen: number, where: string, errors: string[]): ArpToken[] {
  const out: ArpToken[] = [];
  const toks = tokens.trim().split(/\s+/);
  for (const t of toks) {
    const m = /^(r|[0-3])([+-]*)$/.exec(t);
    if (m === null) {
      errors.push(`${where}: bad arp token "${t}"`);
      continue;
    }
    const sfx = m[2] ?? '';
    let oct = 0;
    for (let i = 0; i < sfx.length; i++) oct += sfx[i] === '+' ? 1 : -1;
    out.push({ idx: m[1] === 'r' ? -1 : Number(m[1]), oct });
  }
  if (toks.length * stepLen !== STEPS_PER_BAR) {
    errors.push(`${where}: ${toks.length} tokens x stepLen ${stepLen} must be 16`);
  }
  return out;
}

function num(o: Obj, k: string, def: number): number {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

function levelIn(o: Obj, k: string, def: number, where: string, errors: string[]): number {
  const v = num(o, k, def);
  if (!Number.isInteger(v) || v < 0 || v > MAX_LEVEL) errors.push(`${where}: ${k} must be 0..${MAX_LEVEL}`);
  return v;
}

/**
 * Compiles and validates a song. errors receives every problem (validator A-5); the result is
 * usable only when errors stays empty. knownInstruments: ids from instruments.json.
 */
export function compileSong(
  json: unknown,
  knownInstruments: ReadonlySet<string>,
  errors: string[],
): CompiledSong | null {
  if (!isObj(json) || typeof json['id'] !== 'string') {
    errors.push('song: missing id');
    return null;
  }
  const id = json['id'];
  const followsHost = json['followsHost'] === true;
  const oneShot = json['oneShot'] === true;
  // Overlays take the tempo of the song under them; bpm only sets the preview tempo.
  const bpm = num(json, 'bpm', followsHost ? 116 : 0);
  if (!(bpm > 20 && bpm < 300)) errors.push(`${id}: bpm`);
  const meter = json['meter'];
  if (!Array.isArray(meter) || meter[0] !== 4 || meter[1] !== 4) errors.push(`${id}: meter must be [4, 4]`);
  if (num(json, 'stepsPerBeat', 0) !== 4) errors.push(`${id}: stepsPerBeat must be 4`);
  const sections = isObj(json['sections']) ? json['sections'] : {};
  const form = Array.isArray(json['form']) ? (json['form'] as unknown[]) : [];
  if (form.length === 0) errors.push(`${id}: empty form`);
  const sectionChords = new Map<string, Chord[]>();
  for (const [name, sec] of Object.entries(sections)) {
    const chords = isObj(sec) && Array.isArray(sec['chords']) ? (sec['chords'] as unknown[]) : [];
    const parsed: Chord[] = [];
    for (const c of chords) {
      const ch = typeof c === 'string' ? parseChord(c) : null;
      if (ch === null) errors.push(`${id} section ${name}: unknown chord ${JSON.stringify(c)}`);
      else parsed.push(ch);
    }
    if (parsed.length === 0) errors.push(`${id} section ${name}: no chords`);
    sectionChords.set(name, parsed);
  }
  const barSection: string[] = [];
  const barIndexInSection: number[] = [];
  const barChord: Chord[] = [];
  for (const s of form) {
    const chords = typeof s === 'string' ? sectionChords.get(s) : undefined;
    if (chords === undefined) {
      errors.push(`${id}: form references unknown section ${JSON.stringify(s)}`);
      continue;
    }
    chords.forEach((c, i) => {
      barSection.push(s as string);
      barIndexInSection.push(i);
      barChord.push(c);
    });
  }

  const instruments = new Set<string>();
  const layers: CompiledLayer[] = [];
  const rawLayers = Array.isArray(json['layers']) ? (json['layers'] as unknown[]) : [];
  for (const rl of rawLayers) {
    if (!isObj(rl)) continue;
    const lid = typeof rl['id'] === 'string' ? rl['id'] : '?';
    const where = `${id} layer ${lid}`;
    const type = typeof rl['type'] === 'string' ? rl['type'] : '';
    if (!LAYER_TYPES.has(type)) errors.push(`${where}: unknown type "${type}"`);
    const instrument = typeof rl['instrument'] === 'string' ? rl['instrument'] : '';
    if (type !== 'drum') {
      if (!knownInstruments.has(instrument)) errors.push(`${where}: unknown instrument "${instrument}"`);
      instruments.add(instrument);
    }
    const noteSteps = num(rl, 'noteSteps', 1);
    const rhythms =
      type === 'chord' || type === 'chordRoot' || type === 'note'
        ? parsePatterns(rl['rhythm'], noteSteps, `${where} rhythm`, errors)
        : [];
    const lanes: { lane: string; patterns: Hit[][] }[] = [];
    if (type === 'drum') {
      const l = isObj(rl['lanes']) ? rl['lanes'] : {};
      for (const [lane, pat] of Object.entries(l)) {
        const key = `kit.${lane}`;
        if (!(KIT_LANES as readonly string[]).includes(lane) || !knownInstruments.has(key)) {
          errors.push(`${where}: unknown kit lane "${lane}"`);
        }
        lanes.push({ lane: key, patterns: parsePatterns(pat, 1, `${where} lane ${lane}`, errors) });
        instruments.add(key);
      }
    }
    const stepLen = num(rl, 'stepLen', 1);
    const arps: ArpToken[][] = [];
    if (type === 'arp') {
      const list = strList(rl['tokens']);
      if (list === null) errors.push(`${where}: arp tokens must be a string or a list`);
      else list.forEach((t, i) => arps.push(parseArp(t, stepLen, `${where} tokens[${i}]`, errors)));
    }
    let melody: Map<string, MelNote[][]> | null = null;
    let rotation: MelNote[][] | null = null;
    if (type === 'melody') {
      if (isObj(rl['bySection'])) {
        melody = new Map();
        for (const [sec, bars] of Object.entries(rl['bySection'])) {
          const list = Array.isArray(bars) ? (bars as unknown[]) : [];
          const want = sectionChords.get(sec)?.length ?? -1;
          if (list.length !== want) errors.push(`${where}: section ${sec} has ${list.length} bars, chords ${want}`);
          melody.set(
            sec,
            list.map((b, i) => parseMelodyBar(typeof b === 'string' ? b : '', `${where} ${sec}[${i}]`, errors)),
          );
        }
      } else if (Array.isArray(rl['bars'])) {
        rotation = (rl['bars'] as unknown[]).map((b, i) =>
          parseMelodyBar(typeof b === 'string' ? b : '', `${where} bars[${i}]`, errors),
        );
      } else errors.push(`${where}: melody needs bySection or bars`);
    }
    const fixedNotes: number[] = [];
    if (type === 'note') {
      for (const n of Array.isArray(rl['notes']) ? (rl['notes'] as unknown[]) : []) {
        if (typeof n === 'string' && isNoteName(n)) fixedNotes.push(noteToMidi(n));
        else errors.push(`${where}: bad note ${JSON.stringify(n)}`);
      }
    }
    const dbl = rl['double'];
    let double: CompiledLayer['double'] = null;
    if (isObj(dbl) && typeof dbl['instrument'] === 'string') {
      if (!knownInstruments.has(dbl['instrument'])) errors.push(`${where}: unknown double instrument`);
      instruments.add(dbl['instrument']);
      double = { instrument: dbl['instrument'], octave: num(dbl, 'octave', 0), gainDb: num(dbl, 'gainDb', -12) };
    }
    let secFilter: Set<string> | null = null;
    if (rl['sections'] !== undefined) {
      const list = strList(rl['sections']) ?? [];
      secFilter = new Set(list);
      for (const s of list) if (!sectionChords.has(s)) errors.push(`${where}: unknown section ${s}`);
    }
    const send = isObj(rl['send']) ? rl['send'] : {};
    const minLevel = levelIn(rl, 'minLevel', 0, where, errors);
    const maxLevel = levelIn(rl, 'maxLevel', MAX_LEVEL, where, errors);
    layers.push({
      id: lid,
      instrument,
      type,
      minLevel,
      maxLevel,
      everyBars: Math.max(1, num(rl, 'everyBars', 1)),
      sections: secFilter,
      gainDb: num(rl, 'gainDb', -12),
      pan: num(rl, 'pan', 0),
      hall: num(send, 'hall', 0),
      octave: num(rl, 'octave', 4),
      voicing: rl['voicing'] === 'open' ? 'open' : 'close',
      rhythms,
      arps,
      stepLen,
      lanes,
      melody,
      rotation,
      fixedNotes,
      double,
    });
  }

  const ladder: number[] = [];
  for (const n of Array.isArray(json['glintLadder']) ? (json['glintLadder'] as unknown[]) : []) {
    if (typeof n === 'string' && isNoteName(n)) ladder.push(noteToMidi(n));
    else errors.push(`${id}: bad glintLadder note ${JSON.stringify(n)}`);
  }

  return {
    id,
    bpm,
    stepSec: 60 / bpm / 4,
    barSec: (60 / bpm) * 4,
    loopBars: barChord.length,
    barSection,
    barIndexInSection,
    barChord,
    glintLadder: ladder,
    intensity: parseIntensity(json['intensity'], id, errors),
    layers,
    instruments,
    oneShot,
    tailSec: num(json, 'tailSec', 2),
    followsHost,
    gainDb: num(json, 'gainDb', 0),
  };
}

function parseIntensity(v: unknown, id: string, errors: string[]): IntensityRules | null {
  if (!isObj(v)) return null;
  const arr = (k: string): Obj[] => (Array.isArray(v[k]) ? (v[k] as unknown[]).filter(isObj) : []);
  const pr = v['pressure'];
  // The sim owns the crowd threshold (MusicPressureChanged, config.csv); a count here is stale.
  if (isObj(pr) && pr['enemiesAlive'] !== undefined) {
    errors.push(`${id}: intensity.pressure.enemiesAlive is not used, MusicPressureChanged decides`);
  }
  const riser = v['riser'];
  const b = v['boss'];
  const max = levelIn(v, 'max', 3, `${id} intensity`, errors);
  return {
    max,
    baseByPulse: arr('baseByPulse').map((o) => ({ fromPulse: num(o, 'fromPulse', 1), level: num(o, 'level', 0) })),
    progressSteps: arr('progressSteps').map((o) => ({ atProgress: num(o, 'atProgress', 1), add: num(o, 'add', 0) })),
    pressure: isObj(pr) ? { add: num(pr, 'add', 0), holdBars: num(pr, 'holdBars', 2) } : null,
    wardenAliveMinLevel: num(v, 'wardenAliveMinLevel', 0),
    wardenHastedLevel: num(v, 'wardenHastedLevel', max),
    riserSecondsBeforeEnd: isObj(riser) ? num(riser, 'secondsBeforeEnd', 6) : null,
    fadeInBeats: num(v, 'fadeInBeats', 1),
    fadeOutBeats: num(v, 'fadeOutBeats', 2),
    boss: isObj(b)
      ? {
          intro: num(b, 'intro', 0),
          phase1: num(b, 'phase1', 1),
          phase1Late: num(b, 'phase1Late', 2),
          lateAfterSec: num(b, 'lateAfterSec', 30),
          lateBelowHpFrac: num(b, 'lateBelowHpFrac', 0.75),
          phase2: num(b, 'phase2', 3),
          enraged: num(b, 'enraged', max),
          phaseBreakSec: num(b, 'phaseBreakSec', 1.5),
        }
      : null,
  };
}

/** Chord tone for an arp index: 0 root, 1 third, 2 fifth, 3 seventh or root an octave up. */
function chordTone(ch: Chord, idx: number): number {
  if (idx < 3) return ch.intervals[idx] ?? 0;
  return ch.intervals.length > 3 ? (ch.intervals[3] ?? 12) : 12;
}

/** Writes the voicing of ch into tmp and returns how many notes it has (no allocation). */
function voicingInto(ch: Chord, octave: number, voicing: 'close' | 'open', tmp: number[]): number {
  const root = (octave + 1) * 12 + ch.root;
  const iv = ch.intervals;
  if (voicing === 'close') {
    for (let i = 0; i < iv.length; i++) tmp[i] = root + (iv[i] ?? 0);
    return iv.length;
  }
  tmp[0] = root;
  tmp[1] = root + (iv[2] ?? 7);
  tmp[2] = root + 12 + (iv[1] ?? 4);
  if (iv.length > 3) {
    tmp[3] = root + 12 + (iv[3] ?? 10);
    return 4;
  }
  return 3;
}

const voicingTmp: number[] = [0, 0, 0, 0];

function emit(
  out: NoteBuffer,
  inst: string,
  midi: number,
  step: number,
  len: number,
  vel: number,
  gainDb: number,
  L: CompiledLayer,
  layer: number,
): void {
  let n = out.items[out.count];
  if (n === undefined) {
    n = { inst, midi, step, lenSteps: len, vel, gainDb, pan: 0, hall: 0, layer };
    out.items.push(n);
  }
  n.inst = inst;
  n.midi = midi;
  n.step = step;
  n.lenSteps = len;
  n.vel = vel;
  n.gainDb = gainDb;
  n.pan = L.pan;
  n.hall = L.hall;
  n.layer = layer;
  out.count++;
}

/** Whether layer L plays at level (ignoring bar filters). */
export function layerAtLevel(L: CompiledLayer, level: number): boolean {
  return level >= L.minLevel && level <= L.maxLevel;
}

/** Fade of one layer at a bar line: 1 fades in, -1 fades out, 0 unchanged (playing or silent). */
export function layerFade(L: CompiledLayer, fromLevel: number, toLevel: number): -1 | 0 | 1 {
  const was = layerAtLevel(L, fromLevel);
  const is = layerAtLevel(L, toLevel);
  if (is && !was) return 1;
  if (was && !is) return -1;
  return 0;
}

/**
 * Notes of absolute bar barIndex at level, written into out (count reset first). Layers that
 * play at fromLevel but not at level are fading out: only their notes starting before
 * fadeOutSteps are kept, the player ramps them down (audio-direction 6.3).
 * Bars repeat the loop; everyBars and melody rotation count from the song start.
 */
export function notesForBar(
  song: CompiledSong,
  barIndex: number,
  level: number,
  out: NoteBuffer,
  fromLevel: number = level,
  fadeOutSteps: number = STEPS_PER_BAR,
): void {
  out.count = 0;
  const loopBar = barIndex % Math.max(1, song.loopBars);
  const ch = song.barChord[loopBar];
  if (ch === undefined) return;
  const section = song.barSection[loopBar] ?? '';
  const inSection = song.barIndexInSection[loopBar] ?? 0;
  for (let li = 0; li < song.layers.length; li++) {
    const L = song.layers[li];
    if (L === undefined) continue;
    const now = layerAtLevel(L, level);
    const leaving = !now && layerAtLevel(L, fromLevel);
    if (!now && !leaving) continue;
    if (barIndex % L.everyBars !== 0) continue;
    if (L.sections !== null && !L.sections.has(section)) continue;
    const maxStep = leaving ? fadeOutSteps : STEPS_PER_BAR;
    const g = L.gainDb + song.gainDb;
    switch (L.type) {
      case 'chord': {
        const hits = L.rhythms[loopBar % Math.max(1, L.rhythms.length)] ?? [];
        const nv = voicingInto(ch, L.octave, L.voicing, voicingTmp);
        for (const h of hits) {
          if (h.step >= maxStep) break;
          for (let k = 0; k < nv; k++) emit(out, L.instrument, voicingTmp[k] ?? 0, h.step, h.len, h.vel, g, L, li);
        }
        break;
      }
      case 'chordRoot': {
        const hits = L.rhythms[loopBar % Math.max(1, L.rhythms.length)] ?? [];
        const midi = (L.octave + 1) * 12 + ch.root;
        for (const h of hits) {
          if (h.step >= maxStep) break;
          emit(out, L.instrument, midi, h.step, h.len, h.vel, g, L, li);
        }
        break;
      }
      case 'note': {
        const hits = L.rhythms[loopBar % Math.max(1, L.rhythms.length)] ?? [];
        for (const h of hits) {
          if (h.step >= maxStep) break;
          for (const m of L.fixedNotes) emit(out, L.instrument, m, h.step, h.len, h.vel, g, L, li);
        }
        break;
      }
      case 'arp': {
        const root = (L.octave + 1) * 12 + ch.root;
        const toks = L.arps[loopBar % Math.max(1, L.arps.length)] ?? [];
        for (let i = 0; i < toks.length; i++) {
          const a = toks[i];
          const step = i * L.stepLen;
          if (a === undefined || step >= maxStep) continue;
          if (a.idx >= 0) emit(out, L.instrument, root + chordTone(ch, a.idx) + 12 * a.oct, step, L.stepLen, 0.8, g, L, li);
        }
        break;
      }
      case 'drum':
        for (const lane of L.lanes) {
          const hits = lane.patterns[loopBar % Math.max(1, lane.patterns.length)] ?? [];
          for (const h of hits) {
            if (h.step >= maxStep) break;
            emit(out, lane.lane, 0, h.step, 1, h.vel, g, L, li);
          }
        }
        break;
      case 'melody': {
        const bar =
          L.melody !== null
            ? L.melody.get(section)?.[inSection]
            : L.rotation?.[Math.floor(barIndex / L.everyBars) % Math.max(1, L.rotation.length)];
        if (bar === undefined) break;
        for (const n of bar) {
          if (n.midi === null || n.step >= maxStep) continue;
          emit(out, L.instrument, n.midi, n.step, n.len, n.vel, g, L, li);
          if (L.double !== null) {
            const dg = L.double.gainDb + song.gainDb;
            emit(out, L.double.instrument, n.midi + 12 * L.double.octave, n.step, n.len, n.vel, dg, L, li);
          }
        }
        break;
      }
    }
  }
}

/** Orders a NoteBuffer by step in place (insertion sort: small lists, no comparator closure). */
export function sortNotesByStep(buf: NoteBuffer): void {
  const a = buf.items;
  for (let i = 1; i < buf.count; i++) {
    const n = a[i];
    if (n === undefined) continue;
    let j = i - 1;
    while (j >= 0 && (a[j]?.step ?? 0) > n.step) {
      a[j + 1] = a[j] as NoteEvent;
      j--;
    }
    a[j + 1] = n;
  }
}

/**
 * Intensity level of a timed Pulse from a read-only sim snapshot (audio-direction 6.3).
 * Stateless: the caller applies it only at bar boundaries. pressure comes from the sim event.
 */
export function computeLevel(
  rules: IntensityRules,
  pulseNumber: number,
  progress: number,
  pressure: boolean,
  wardenAlive: boolean,
): number {
  let base = 0;
  for (const b of rules.baseByPulse) if (pulseNumber >= b.fromPulse) base = b.level;
  let add = 0;
  for (const p of rules.progressSteps) if (progress >= p.atProgress) add = Math.max(add, p.add);
  const crowd = pressure && rules.pressure !== null ? rules.pressure.add : 0;
  let level = Math.min(rules.max, base + add + crowd);
  if (wardenAlive) level = Math.max(level, Math.min(rules.max, rules.wardenAliveMinLevel));
  return level;
}
