// Renders WAV previews of every cue and every song into audio/preview/ (gitignored), with the same
// pure DSP and song compiler the game runs. Music previews add the hall reverb offline (FFT
// convolution of the hall send with the game IR) and play adaptive timelines: level fades on bar
// lines, the Warden overlay, the riser, and the boss phase break, as the sequencer does.
// Usage: node tools/audio/render-cues.ts [filter] [--dry]
//   filter: only cue ids or song files containing that text. --dry: no hall reverb (faster).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGameData } from '../../src/content/index.ts';
import type { RawGameData } from '../../src/content/index.ts';
import { parseCueTable, parseInstruments } from '../../src/audio/cue-data.ts';
import { liveWarmupPairs } from '../../src/audio/event-map.ts';
import type { Routes } from '../../src/audio/event-map.ts';
import { compileSong, createNoteBuffer, layerFade, notesForBar } from '../../src/audio/music/song.ts';
import type { CompiledSong, NoteEvent } from '../../src/audio/music/song.ts';
import {
  IR_HALL,
  dbToGain,
  loopPointsOf,
  panGains,
  pickRef,
  renderCue,
  renderInstrumentSample,
  renderIr,
} from '../../src/audio/synth/index.ts';
import type { InstrumentDef } from '../../src/audio/synth/index.ts';
import { formatBudget, measureBudget } from './lib/budget.ts';
import { PREVIEW_DIR, ROOT, encodeWav, readAudioFiles } from './lib/audio-files.ts';

const MIX_RATE = 48000;
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const filter = args.find((a) => !a.startsWith('--')) ?? '';
const files = readAudioFiles();
const cues = parseCueTable(files.cues);
const instruments = parseInstruments(files.instruments);

// ---- SFX ------------------------------------------------------------------------------------
mkdirSync(join(PREVIEW_DIR, 'sfx'), { recursive: true });
let t0 = performance.now();
let count = 0;
for (const cue of cues.cues) {
  if (cue.deprecated || !cue.id.includes(filter)) continue;
  // Same rate as the game buffer, so previews sound like the game.
  const buf = renderCue(cue, cue.sampleRate);
  writeFileSync(join(PREVIEW_DIR, 'sfx', `${cue.id}.wav`), encodeWav([buf], cue.sampleRate));
  count++;
}
console.log(`sfx: ${count} cues written in ${(performance.now() - t0).toFixed(0)} ms`);

// ---- Budget (A-7) ---------------------------------------------------------------------------
const raw = JSON.parse(readFileSync(join(ROOT, 'content', 'generated', 'game-data.json'), 'utf8')) as RawGameData;
const warmup = liveWarmupPairs(buildGameData(raw), files.routes as Routes);
console.log(formatBudget(measureBudget(cues, instruments, warmup)));

// ---- Music ----------------------------------------------------------------------------------
t0 = performance.now();
interface Sampled {
  readonly def: InstrumentDef;
  readonly samples: Float32Array[];
  readonly loopStart: number | null;
}
const bank = new Map<string, Sampled>();
for (const def of instruments.values()) {
  const refs: readonly (number | null)[] = def.refNotes.length > 0 ? def.refNotes : [null];
  const samples = refs.map((r) => renderInstrumentSample(def, r));
  const lp = loopPointsOf(def, samples[0]?.length ?? 0);
  bank.set(def.id, { def, samples, loopStart: lp === null ? null : Math.round(lp.startSec * def.sampleRate) });
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

/** Stereo dry mix plus a mono hall send, like the music bus and hallSend in the browser. */
class Mix {
  readonly l: Float32Array;
  readonly r: Float32Array;
  readonly wet: Float32Array;
  constructor(seconds: number) {
    const n = Math.ceil(seconds * MIX_RATE);
    this.l = new Float32Array(n);
    this.r = new Float32Array(n);
    this.wet = new Float32Array(n);
  }

  /** One sampled note; fade = optional linear gain ramp in absolute seconds (layer fades). */
  note(n: NoteEvent, startSec: number, stepSec: number, fade: readonly [number, number, number, number] | null): void {
    const s = bank.get(n.inst);
    if (s === undefined) return;
    const pitched = s.def.refNotes.length > 0;
    const ref = pitched ? pickRef(s.def.refNotes, n.midi) : { index: 0, rate: 1 };
    const sample = s.samples[ref.index];
    if (sample === undefined) return;
    const hold = pitched ? n.lenSteps * stepSec : sample.length / s.def.sampleRate;
    const rel = pitched ? s.def.releaseMs / 1000 : 0.001;
    const step = (s.def.sampleRate * ref.rate) / MIX_RATE;
    const start = Math.floor(startSec * MIX_RATE);
    const holdN = hold * MIX_RATE;
    const relN = Math.max(1, rel * MIX_RATE);
    const total = Math.ceil(holdN + relN);
    const gain = n.vel * dbToGain(n.gainDb);
    const [gl, gr] = panGains(n.pan);
    const loopStart = pitched ? s.loopStart : null;
    let pos = 0;
    for (let i = 0; i < total; i++) {
      const j = start + i;
      if (j >= this.l.length) break;
      if (pos >= sample.length) {
        if (loopStart === null) break;
        // Wrap like AudioBufferSourceNode: the sample after the last one is loopStart.
        pos -= sample.length - loopStart;
      }
      const k = Math.floor(pos);
      let k1 = k + 1;
      if (k1 >= sample.length) {
        if (loopStart === null) break;
        k1 = loopStart;
      }
      const frac = pos - k;
      let v = ((sample[k] ?? 0) * (1 - frac) + (sample[k1] ?? 0) * frac) * gain;
      if (i >= holdN) v *= Math.max(0, 1 - (i - holdN) / relN);
      if (fade !== null) {
        const t = j / MIX_RATE;
        const [ft0, ft1, g0, g1] = fade;
        v *= t <= ft0 ? g0 : t >= ft1 ? g1 : g0 + ((g1 - g0) * (t - ft0)) / (ft1 - ft0);
      }
      if (j >= 0) {
        this.l[j] = (this.l[j] ?? 0) + v * gl;
        this.r[j] = (this.r[j] ?? 0) + v * gr;
        this.wet[j] = (this.wet[j] ?? 0) + v * n.hall;
      }
      pos += step;
    }
  }

  /** A mono buffer (cue) at its own rate, e.g. the riser. */
  buffer(buf: Float32Array, rate: number, startSec: number, gain: number, hall: number): void {
    const step = rate / MIX_RATE;
    const start = Math.floor(startSec * MIX_RATE);
    for (let i = 0; ; i++) {
      const pos = i * step;
      const k = Math.floor(pos);
      if (k + 1 >= buf.length || start + i >= this.l.length) break;
      const v = ((buf[k] ?? 0) * (1 - (pos - k)) + (buf[k + 1] ?? 0) * (pos - k)) * gain;
      const j = start + i;
      this.l[j] = (this.l[j] ?? 0) + v * Math.SQRT1_2;
      this.r[j] = (this.r[j] ?? 0) + v * Math.SQRT1_2;
      this.wet[j] = (this.wet[j] ?? 0) + v * hall;
    }
  }

  /** Dry plus hall reverb (offline convolution with ir.hall), as stereo channels. */
  finish(): readonly [Float32Array, Float32Array] {
    if (!dry) {
      const [wl, wr] = convolve(this.wet, hallIr());
      for (let i = 0; i < this.l.length; i++) {
        this.l[i] = (this.l[i] ?? 0) + (wl[i] ?? 0);
        this.r[i] = (this.r[i] ?? 0) + (wr[i] ?? 0);
      }
    }
    return [this.l, this.r];
  }
}

// ---- Offline hall reverb (radix-2 FFT convolution) ------------------------------------------
let irCache: readonly [Float32Array, Float32Array] | null = null;
function hallIr(): readonly [Float32Array, Float32Array] {
  irCache ??= renderIr(IR_HALL, MIX_RATE);
  return irCache;
}

function fft(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = (re[b] ?? 0) * cr - (im[b] ?? 0) * ci;
        const xi = (re[b] ?? 0) * ci + (im[b] ?? 0) * cr;
        re[b] = (re[a] ?? 0) - xr;
        im[b] = (im[a] ?? 0) - xi;
        re[a] = (re[a] ?? 0) + xr;
        im[a] = (im[a] ?? 0) + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] = (re[i] ?? 0) / n;
      im[i] = (im[i] ?? 0) / n;
    }
  }
}

function convolve(x: Float32Array, ir: readonly [Float32Array, Float32Array]): [Float32Array, Float32Array] {
  let n = 1;
  while (n < x.length + ir[0].length) n <<= 1;
  const xr = new Float64Array(n);
  const xi = new Float64Array(n);
  xr.set(x);
  fft(xr, xi, false);
  const out: Float32Array[] = [];
  for (const h of ir) {
    const hr = new Float64Array(n);
    const hi = new Float64Array(n);
    hr.set(h);
    fft(hr, hi, false);
    for (let i = 0; i < n; i++) {
      const a = xr[i] ?? 0;
      const b = xi[i] ?? 0;
      const c = hr[i] ?? 0;
      const d = hi[i] ?? 0;
      hr[i] = a * c - b * d;
      hi[i] = a * d + b * c;
    }
    fft(hr, hi, true);
    out.push(Float32Array.from(hr.subarray(0, x.length)));
  }
  return [out[0] ?? new Float32Array(0), out[1] ?? new Float32Array(0)];
}

// ---- Timelines ------------------------------------------------------------------------------
/** One step of a preview timeline: a bar at a level, or a silent break (boss phase change). */
type Plan = { readonly level: number } | { readonly breakSec: number };

interface TimelineOpts {
  readonly overlay?: CompiledSong | undefined;
  readonly overlayFromBar?: number;
  readonly riser?: boolean;
  readonly tailSec?: number;
}

/**
 * Plays song bars along plan like the sequencer: level fades at bar lines (fade-in 1 beat,
 * fade-out 2 beats), the overlay on the host bar clock from overlayFromBar, and a riser cue that
 * ends with the last bar.
 */
function renderTimeline(
  song: CompiledSong,
  plan: readonly Plan[],
  opts: TimelineOpts = {},
): readonly [Float32Array, Float32Array] {
  const tail = opts.tailSec ?? (song.oneShot ? song.tailSec : 3);
  let seconds = tail;
  for (const p of plan) seconds += 'level' in p ? song.barSec : p.breakSec;
  const mix = new Mix(seconds);
  const buf = createNoteBuffer();
  const obuf = createNoteBuffer();
  const rules = song.intensity;
  const beat = song.barSec / 4;
  const fin = (rules?.fadeInBeats ?? 1) * beat;
  const fout = (rules?.fadeOutBeats ?? 2) * beat;
  const fadeOutSteps = Math.round((rules?.fadeOutBeats ?? 2) * 4);
  let t = 0;
  let bar = 0;
  let prev = -1;
  for (const p of plan) {
    if (!('level' in p)) {
      t += p.breakSec;
      bar = Math.ceil(bar / 8) * 8;
      continue;
    }
    const from = prev < 0 ? p.level : prev;
    notesForBar(song, bar, p.level, buf, from, fadeOutSteps);
    for (let i = 0; i < buf.count; i++) {
      const n = buf.items[i];
      if (n === undefined) continue;
      const L = song.layers[n.layer];
      const f = L === undefined ? 0 : layerFade(L, from, p.level);
      const fade: [number, number, number, number] | null =
        f > 0 ? [t, t + fin, 0, 1] : f < 0 ? [t, t + fout, 1, 0] : null;
      mix.note(n, t + n.step * song.stepSec, song.stepSec, fade);
    }
    if (opts.overlay !== undefined && bar >= (opts.overlayFromBar ?? 0)) {
      notesForBar(opts.overlay, bar, 0, obuf);
      for (let i = 0; i < obuf.count; i++) {
        const n = obuf.items[i];
        if (n !== undefined) mix.note(n, t + n.step * song.stepSec, song.stepSec, null);
      }
    }
    prev = p.level;
    t += song.barSec;
    bar++;
  }
  const riser = cues.cues[cues.indexOf.get('mus.riser.pulse_end') ?? -1];
  if (opts.riser === true && riser !== undefined) {
    const rb = renderCue(riser, riser.sampleRate);
    mix.buffer(rb, riser.sampleRate, t - rb.length / riser.sampleRate, 1, riser.sendHall);
  }
  return mix.finish();
}

const levels = (...spec: [number, number][]): Plan[] =>
  spec.flatMap(([level, n]) => Array.from({ length: n }, () => ({ level })));

const jobs: { name: string; song: string; plan: Plan[]; opts?: TimelineOpts }[] = [
  { name: 'mus.title', song: 'mus.title', plan: levels([0, 16]) },
  ...[0, 1, 2, 3].map((l) => ({ name: `mus.biome1.pulse.L${l}`, song: 'mus.biome1.pulse', plan: levels([l, 16]) })),
  // Pulse 4 (36 s): L1, L2 at 35%, L3 at 70%, riser into the end; fades on bar lines.
  {
    name: 'mus.biome1.pulse.timeline_p4',
    song: 'mus.biome1.pulse',
    plan: levels([1, 6], [2, 6], [3, 5]),
    opts: { riser: true },
  },
  // Pulse 1 with a crowd surge and release (pressure +1 held 2 bars, then fade out).
  { name: 'mus.biome1.pulse.timeline_pressure', song: 'mus.biome1.pulse', plan: levels([0, 4], [1, 4], [0, 4]) },
  // Warden Pulse: level 2 floor with the Unlit overlay from bar 2.
  {
    name: 'mus.biome1.pulse.warden_overlay',
    song: 'mus.biome1.pulse',
    plan: levels([2, 12]),
    opts: { overlay: songs.get('mus.overlay.unlit'), overlayFromBar: 2 },
  },
  { name: 'mus.shop', song: 'mus.shop', plan: levels([0, 16]) },
  ...[0, 1, 2, 3, 4].map((l) => ({ name: `mus.biome1.boss.L${l}`, song: 'mus.biome1.boss', plan: levels([l, 8]) })),
  // Boss fight: intro, phase 1, late phase 1, 1.5 s phase break, phase 2, enraged.
  {
    name: 'mus.biome1.boss.timeline',
    song: 'mus.biome1.boss',
    plan: [...levels([0, 2], [1, 6], [2, 8]), { breakSec: 1.5 }, ...levels([3, 8], [4, 8])],
  },
  { name: 'mus.end', song: 'mus.end', plan: levels([0, 16]) },
];
for (const s of songs.values()) {
  if (s.oneShot) jobs.push({ name: s.id, song: s.id, plan: levels([0, s.loopBars]) });
}

mkdirSync(join(PREVIEW_DIR, 'music'), { recursive: true });
for (const job of jobs) {
  if (!job.name.includes(filter) && filter !== '') continue;
  const song = songs.get(job.song);
  if (song === undefined) continue;
  const t = performance.now();
  const [l, r] = renderTimeline(song, job.plan, job.opts);
  // Peak check: the master limiter catches overs in game; previews are scaled only if they clip.
  let peak = 0;
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i] ?? 0), Math.abs(r[i] ?? 0));
  if (peak > 0.99) {
    const k = 0.99 / peak;
    for (let i = 0; i < l.length; i++) {
      l[i] = (l[i] ?? 0) * k;
      r[i] = (r[i] ?? 0) * k;
    }
  }
  const dir = song.oneShot ? 'stingers' : 'music';
  mkdirSync(join(PREVIEW_DIR, dir), { recursive: true });
  writeFileSync(join(PREVIEW_DIR, dir, `${job.name}.wav`), encodeWav([l, r], MIX_RATE));
  const secs = l.length / MIX_RATE;
  const peakDb = 20 * Math.log10(Math.max(peak, 1e-9));
  console.log(
    `${dir}: ${job.name}.wav ${secs.toFixed(1)} s, peak ${peakDb.toFixed(1)} dBFS, ${(performance.now() - t).toFixed(0)} ms`,
  );
}
console.log(`previews in ${PREVIEW_DIR}${dry ? ' (dry, no hall)' : ''}`);
