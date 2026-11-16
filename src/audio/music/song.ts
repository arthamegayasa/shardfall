// Song data (src/audio/music/<cue-id>.json, audio-direction 7): validation (test A-5), compile,
// and per-bar note generation. Pure, shared by the browser sequencer and the Node preview mixdown.

import { isNoteName, noteToMidi } from '../synth/index.ts';

export const STEPS_PER_BAR = 16;
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

/** One note to play, in steps relative to the bar start. inst is an instrument or "kit.<lane>". */
export interface NoteEvent {
  readonly inst: string;
  readonly midi: number;
  readonly step: number;
  readonly lenSteps: number;
  readonly vel: number;
  readonly gainDb: number;
  readonly pan: number;
  readonly hall: number;
}

interface Hit {
  readonly step: number;
  readonly len: number;
  readonly vel: number;
}

interface CompiledLayer {
  readonly id: string;
  readonly instrument: string;
  readonly type: string;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly everyBars: number;
  readonly gainDb: number;
  readonly pan: number;
  readonly hall: number;
  readonly octave: number;
  readonly voicing: 'close' | 'open';
  readonly hits: readonly Hit[];
  readonly arp: readonly { readonly idx: number; readonly oct: number }[] | null;
  readonly stepLen: number;
  readonly lanes: readonly { readonly lane: string; readonly hits: readonly Hit[] }[];
  /** Melody: per section name, per bar of the section, the notes. */
  readonly melody: ReadonlyMap<string, readonly (readonly MelNote[])[]> | null;
  /** Melody bars played in rotation (overlay style). */
  readonly rotation: readonly (readonly MelNote[])[] | null;
  readonly fixedNotes: readonly number[];
  readonly double: { readonly instrument: string; readonly octave: number; readonly gainDb: number } | null;
}

interface MelNote {
  readonly midi: number | null;
  readonly step: number;
  readonly len: number;
  readonly vel: number;
}

export interface IntensityRules {
  readonly max: number;
  readonly baseByPulse: readonly { readonly fromPulse: number; readonly level: number }[];
  readonly progressSteps: readonly { readonly atProgress: number; readonly add: number }[];
  readonly pressure: { readonly enemiesAlive: number; readonly add: number } | null;
  readonly wardenAliveMinLevel: number;
  readonly riserSecondsBeforeEnd: number | null;
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

function parseArp(tokens: string, stepLen: number, where: string, errors: string[]) {
  const out: { idx: number; oct: number }[] = [];
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
  const bpm = num(json, 'bpm', 0);
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
    const rhythm = typeof rl['rhythm'] === 'string' ? rl['rhythm'] : '';
    if ((type === 'chord' || type === 'chordRoot' || type === 'note') && !RHYTHM_RE.test(rhythm)) {
      errors.push(`${where}: rhythm must be 16 chars of X x . _ -`);
    }
    const lanes: { lane: string; hits: Hit[] }[] = [];
    if (type === 'drum') {
      const l = isObj(rl['lanes']) ? rl['lanes'] : {};
      for (const [lane, pat] of Object.entries(l)) {
        const key = `kit.${lane}`;
        if (!(KIT_LANES as readonly string[]).includes(lane) || !knownInstruments.has(key)) {
          errors.push(`${where}: unknown kit lane "${lane}"`);
        }
        if (typeof pat !== 'string' || !RHYTHM_RE.test(pat)) errors.push(`${where}: lane ${lane} pattern`);
        else lanes.push({ lane: key, hits: parseRhythm(pat, 1) });
        instruments.add(key);
      }
    }
    const stepLen = num(rl, 'stepLen', 1);
    const arp =
      type === 'arp' ? parseArp(typeof rl['tokens'] === 'string' ? rl['tokens'] : '', stepLen, where, errors) : null;
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
    const send = isObj(rl['send']) ? rl['send'] : {};
    layers.push({
      id: lid,
      instrument,
      type,
      minLevel: num(rl, 'minLevel', 0),
      maxLevel: num(rl, 'maxLevel', 3),
      everyBars: Math.max(1, num(rl, 'everyBars', 1)),
      gainDb: num(rl, 'gainDb', -12),
      pan: num(rl, 'pan', 0),
      hall: num(send, 'hall', 0),
      octave: num(rl, 'octave', 4),
      voicing: rl['voicing'] === 'open' ? 'open' : 'close',
      hits: RHYTHM_RE.test(rhythm) ? parseRhythm(rhythm, num(rl, 'noteSteps', 1)) : [],
      arp,
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
    intensity: parseIntensity(json['intensity']),
    layers,
    instruments,
  };
}

function parseIntensity(v: unknown): IntensityRules | null {
  if (!isObj(v)) return null;
  const arr = (k: string): Obj[] => (Array.isArray(v[k]) ? (v[k] as unknown[]).filter(isObj) : []);
  const pr = v['pressure'];
  const riser = v['riser'];
  return {
    max: num(v, 'max', 3),
    baseByPulse: arr('baseByPulse').map((o) => ({ fromPulse: num(o, 'fromPulse', 1), level: num(o, 'level', 0) })),
    progressSteps: arr('progressSteps').map((o) => ({ atProgress: num(o, 'atProgress', 1), add: num(o, 'add', 0) })),
    pressure: isObj(pr) ? { enemiesAlive: num(pr, 'enemiesAlive', 999), add: num(pr, 'add', 0) } : null,
    wardenAliveMinLevel: num(v, 'wardenAliveMinLevel', 0),
    riserSecondsBeforeEnd: isObj(riser) ? num(riser, 'secondsBeforeEnd', 6) : null,
  };
}

/** Chord tone for an arp index: 0 root, 1 third, 2 fifth, 3 seventh or root an octave up. */
function chordTone(ch: Chord, idx: number): number {
  if (idx < 3) return ch.intervals[idx] ?? 0;
  return ch.intervals.length > 3 ? (ch.intervals[3] ?? 12) : 12;
}

function voicingOf(ch: Chord, octave: number, voicing: 'close' | 'open'): number[] {
  const root = (octave + 1) * 12 + ch.root;
  const iv = ch.intervals;
  if (voicing === 'close') return iv.map((i) => root + i);
  const out = [root, root + (iv[2] ?? 7), root + 12 + (iv[1] ?? 4)];
  if (iv.length > 3) out.push(root + 12 + (iv[3] ?? 10));
  return out;
}

/**
 * Notes of absolute bar barIndex at intensity level, appended to out (cleared first).
 * Bars repeat the loop; everyBars and melody rotation count from the song start.
 */
export function notesForBar(song: CompiledSong, barIndex: number, level: number, out: NoteEvent[]): void {
  out.length = 0;
  const loopBar = barIndex % Math.max(1, song.loopBars);
  const ch = song.barChord[loopBar];
  if (ch === undefined) return;
  const section = song.barSection[loopBar] ?? '';
  const inSection = song.barIndexInSection[loopBar] ?? 0;
  for (const L of song.layers) {
    if (level < L.minLevel || level > L.maxLevel) continue;
    if (barIndex % L.everyBars !== 0) continue;
    const base = { gainDb: L.gainDb, pan: L.pan, hall: L.hall };
    const push = (inst: string, midi: number, step: number, len: number, vel: number): void => {
      out.push({ inst, midi, step, lenSteps: len, vel, ...base });
    };
    switch (L.type) {
      case 'chord':
        for (const h of L.hits) for (const m of voicingOf(ch, L.octave, L.voicing)) push(L.instrument, m, h.step, h.len, h.vel);
        break;
      case 'chordRoot':
        for (const h of L.hits) push(L.instrument, (L.octave + 1) * 12 + ch.root, h.step, h.len, h.vel);
        break;
      case 'note':
        for (const h of L.hits) for (const m of L.fixedNotes) push(L.instrument, m, h.step, h.len, h.vel);
        break;
      case 'arp': {
        const root = (L.octave + 1) * 12 + ch.root;
        (L.arp ?? []).forEach((a, i) => {
          if (a.idx >= 0) push(L.instrument, root + chordTone(ch, a.idx) + 12 * a.oct, i * L.stepLen, L.stepLen, 0.8);
        });
        break;
      }
      case 'drum':
        for (const lane of L.lanes) for (const h of lane.hits) push(lane.lane, 0, h.step, 1, h.vel);
        break;
      case 'melody': {
        const bar =
          L.melody !== null
            ? L.melody.get(section)?.[inSection]
            : L.rotation?.[Math.floor(barIndex / L.everyBars) % Math.max(1, L.rotation.length)];
        for (const n of bar ?? []) {
          if (n.midi === null) continue;
          push(L.instrument, n.midi, n.step, n.len, n.vel);
          if (L.double !== null) {
            out.push({
              inst: L.double.instrument,
              midi: n.midi + 12 * L.double.octave,
              step: n.step,
              lenSteps: n.len,
              vel: n.vel,
              gainDb: L.double.gainDb,
              pan: L.pan,
              hall: L.hall,
            });
          }
        }
        break;
      }
    }
  }
}

/**
 * Intensity level from a read-only sim snapshot (audio-direction 6.3). Stateless: the caller
 * applies it only at bar boundaries.
 */
export function computeLevel(
  rules: IntensityRules,
  pulseNumber: number,
  progress: number,
  enemiesAlive: number,
  wardenAlive: boolean,
): number {
  let base = 0;
  for (const b of rules.baseByPulse) if (pulseNumber >= b.fromPulse) base = b.level;
  let add = 0;
  for (const p of rules.progressSteps) if (progress >= p.atProgress) add = Math.max(add, p.add);
  const pressure = rules.pressure !== null && enemiesAlive > rules.pressure.enemiesAlive ? rules.pressure.add : 0;
  let level = Math.min(rules.max, base + add + pressure);
  if (wardenAlive) level = Math.max(level, Math.min(rules.max, rules.wardenAliveMinLevel));
  return level;
}
