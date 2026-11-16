// Layered synthesis: every SFX recipe and instrument note is a list of layers in data
// (src/audio/cues/cues.json, src/audio/music/instruments.json). Pure, deterministic for a given Rng.

import type { Rng } from '../../core/index.ts';
import { createBiquad, createNoise, waveSample } from './dsp.ts';
import type { FilterType, NoiseSource, Wave } from './dsp.ts';
import { dbToGain, freqOf, semisToRatio } from './notes.ts';

export interface FilterSpec {
  readonly type: FilterType;
  readonly freq: number;
  /** Exponential sweep target over sweepMs (default: whole layer). */
  readonly freqEnd?: number;
  readonly sweepMs?: number;
  readonly q?: number;
}

export interface RepeatSpec {
  readonly count: number;
  readonly everyMs: number;
  /** Interval of the last repeat; intervals change geometrically (accelerating fuse beeps). */
  readonly everyEndMs?: number;
  /** Pitch step per repeat. */
  readonly semis?: number;
  /** Gain step per repeat. */
  readonly gainDb?: number;
}

/** Timing and envelope shared by every layer kind. Times in ms from the cue start. */
export interface LayerBase {
  readonly startMs?: number;
  /** Default: until the end of the cue. */
  readonly durMs?: number;
  readonly attackMs?: number;
  /** decay: exponential fall to -60 dB at decayMs. flat: hold. swell: rises to the end, then stops. */
  readonly env?: 'decay' | 'flat' | 'swell';
  readonly decayMs?: number;
  readonly releaseMs?: number;
  readonly gainDb?: number;
  readonly filter?: FilterSpec;
  readonly repeat?: RepeatSpec;
}

export interface ToneLayer extends LayerBase {
  readonly kind: 'tone';
  readonly wave: Wave;
  /** Hz or note name. Instruments use ratio (of the note frequency) instead. */
  readonly freq?: number | string;
  readonly ratio?: number;
  readonly freqEnd?: number | string;
  readonly ratioEnd?: number;
  readonly glideMs?: number;
  readonly detuneCents?: number;
  readonly tremoloHz?: number;
  /** 0..1 */
  readonly tremoloDepth?: number;
  readonly vibratoHz?: number;
  readonly vibratoCents?: number;
  readonly vibratoDelayMs?: number;
  /** Phase modulation: sine modulator at freq * ratio, index decaying to indexEnd. */
  readonly fm?: {
    readonly ratio: number;
    readonly index: number;
    readonly indexEnd?: number;
    readonly indexDecayMs?: number;
  };
}

export interface NoiseLayer extends LayerBase {
  readonly kind: 'noise';
  readonly color?: 'white' | 'pink';
}

/** Many tiny random sine pings or noise ticks: glass shards, crackle, cascades. */
export interface GrainsLayer extends LayerBase {
  readonly kind: 'grains';
  readonly count: number;
  readonly freqMin: number;
  readonly freqMax: number;
  /** Grain start times spread over this window after startMs. */
  readonly spreadMs: number;
  readonly grainMs: number;
  readonly grainMsMax?: number;
  readonly wave?: Wave | 'noise';
  /** Pitch fall per grain in semitones. */
  readonly drop?: number;
}

/** Karplus-Strong plucked string computed in JS (audio-direction 2.4). */
export interface PluckLayer extends LayerBase {
  readonly kind: 'pluck';
  readonly freq?: number | string;
  readonly ratio?: number;
  readonly damping?: number;
}

export type LayerSpec = ToneLayer | NoiseLayer | GrainsLayer | PluckLayer;

/** Inputs shared by every layer of one render. */
interface RenderEnv {
  readonly sr: number;
  readonly totalMs: number;
  /** Note frequency for instrument layers that use ratio. */
  readonly baseHz: number;
  readonly rng: Rng;
  readonly noise: NoiseSource;
}

const FILTER_UPDATE_SAMPLES = 16;

/** Precomputed envelope of one layer occurrence, stepped per sample without Math.pow. */
interface EnvState {
  readonly attackN: number;
  readonly decayK: number;
  readonly swell: boolean;
  readonly releaseN: number;
  readonly totalN: number;
}

function envState(layer: LayerBase, durSec: number, sr: number): EnvState {
  const env = layer.env ?? 'decay';
  const decaySec = Math.max((layer.decayMs ?? durSec * 1000) / 1000, 0.001);
  return {
    attackN: Math.round(((layer.attackMs ?? 0) / 1000) * sr),
    // Per-sample factor that reaches -60 dB after decaySec.
    decayK: env === 'decay' ? Math.pow(10, -3 / (decaySec * sr)) : 1,
    swell: env === 'swell',
    releaseN: Math.max(1, Math.round(((layer.releaseMs ?? 4) / 1000) * sr)),
    totalN: Math.max(1, Math.floor(durSec * sr)),
  };
}

/** Length that is still audible: decaying layers stop at -80 dB instead of running to the cue end. */
function audibleSec(layer: LayerBase, durSec: number): number {
  if ((layer.env ?? 'decay') !== 'decay') return durSec;
  const decaySec = (layer.decayMs ?? durSec * 1000) / 1000;
  return Math.min(durSec, (layer.attackMs ?? 0) / 1000 + (decaySec * 4) / 3);
}

function glide(f0: number, f1: number, t: number, glideSec: number): number {
  if (f1 === f0 || glideSec <= 0) return f1;
  const x = Math.min(1, t / glideSec);
  return f0 * Math.pow(f1 / f0, x);
}

function toneFreqs(layer: ToneLayer | PluckLayer, env: RenderEnv): readonly [number, number] {
  const f0 =
    layer.ratio !== undefined
      ? env.baseHz * layer.ratio
      : layer.freq !== undefined
        ? freqOf(layer.freq)
        : env.baseHz;
  if (layer.kind === 'pluck') return [f0, f0];
  const f1 =
    layer.ratioEnd !== undefined
      ? env.baseHz * layer.ratioEnd
      : layer.freqEnd !== undefined
        ? freqOf(layer.freqEnd)
        : f0;
  return [f0, f1];
}

/** Renders one occurrence of a layer into out, starting at sample offset, scaled by gain and pitch. */
function renderOnce(
  layer: LayerSpec,
  env: RenderEnv,
  out: Float32Array,
  startSec: number,
  durSec: number,
  pitch: number,
  gain: number,
): void {
  const { sr } = env;
  const start = Math.floor(startSec * sr);
  const n = Math.min(Math.floor(audibleSec(layer, durSec) * sr), out.length - start);
  if (n <= 0) return;
  const filt = layer.filter !== undefined ? createBiquad() : null;
  const fSpec = layer.filter;
  const fSweep = fSpec !== undefined ? (fSpec.sweepMs ?? durSec * 1000) / 1000 : 0;
  const fSweeps = fSpec?.freqEnd !== undefined && fSpec.freqEnd !== fSpec.freq;

  if (layer.kind === 'grains') {
    renderGrains(layer, env, out, start, n, pitch, gain);
    return;
  }

  let ks: Float32Array | null = null;
  let ksPos = 0;
  if (layer.kind === 'pluck') {
    const period = Math.max(2, Math.round(sr / (toneFreqs(layer, env)[0] * pitch)));
    ks = new Float32Array(period);
    for (let i = 0; i < period; i++) ks[i] = env.noise.white();
  }
  const damping = layer.kind === 'pluck' ? (layer.damping ?? 0.996) : 0;

  let f0 = 0;
  let f1 = 0;
  if (layer.kind === 'tone') {
    const fr = toneFreqs(layer, env);
    const det = semisToRatio((layer.detuneCents ?? 0) / 100) * pitch;
    f0 = fr[0] * det;
    f1 = fr[1] * det;
  }
  const glideSec = layer.kind === 'tone' ? (layer.glideMs ?? durSec * 1000) / 1000 : 0;
  const glideN = Math.max(1, Math.round(glideSec * sr));
  const glideK = f0 > 0 && f1 !== f0 ? Math.pow(f1 / f0, 1 / glideN) : 1;
  let freq = f0;
  const fm = layer.kind === 'tone' ? layer.fm : undefined;
  const idxEnd = fm !== undefined ? (fm.indexEnd ?? fm.index) : 0;
  let idxDelta = fm !== undefined ? fm.index - idxEnd : 0;
  const idxK = fm !== undefined ? Math.exp(-1 / (((fm.indexDecayMs ?? 300) / 1000) * sr)) : 1;
  const es = envState(layer, durSec, sr);
  let dec = 1;
  let phase = env.rng.next();
  let modPhase = 0;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (filt !== null && fSpec !== undefined && (i === 0 || (fSweeps && i % FILTER_UPDATE_SAMPLES === 0))) {
      const ff = glide(fSpec.freq, fSpec.freqEnd ?? fSpec.freq, t, fSweep) * pitch;
      filt.set(fSpec.type, ff, fSpec.q ?? 0.707, sr);
    }
    let s: number;
    if (layer.kind === 'noise') {
      s = layer.color === 'pink' ? env.noise.pink() : env.noise.white();
    } else if (ks !== null) {
      const next = (ksPos + 1) % ks.length;
      s = ks[ksPos] ?? 0;
      ks[ksPos] = damping * 0.5 * (s + (ks[next] ?? 0));
      ksPos = next;
    } else {
      const tl = layer as ToneLayer;
      let f = freq;
      if (i < glideN) freq *= glideK;
      if (tl.vibratoHz !== undefined && t >= (tl.vibratoDelayMs ?? 0) / 1000) {
        f *= semisToRatio(((tl.vibratoCents ?? 10) / 100) * Math.sin(2 * Math.PI * tl.vibratoHz * t));
      }
      const dt = f / sr;
      if (fm !== undefined) {
        const idx = idxEnd + idxDelta;
        idxDelta *= idxK;
        modPhase += dt * fm.ratio;
        modPhase -= Math.floor(modPhase);
        s = Math.sin(2 * Math.PI * phase + idx * Math.sin(2 * Math.PI * modPhase));
      } else {
        s = waveSample(tl.wave, phase, dt);
      }
      if (tl.tremoloHz !== undefined) {
        const depth = tl.tremoloDepth ?? 0.5;
        s *= 1 - depth * 0.5 * (1 + Math.sin(2 * Math.PI * tl.tremoloHz * t));
      }
      phase += dt;
      phase -= Math.floor(phase);
    }
    if (filt !== null) s = filt.process(s);
    let g = i < es.attackN ? i / es.attackN : 1;
    if (i >= es.attackN) dec *= es.decayK;
    g *= dec;
    if (es.swell) {
      const x = i / es.totalN;
      g *= 0.03 + 0.97 * x * x;
    }
    const left = es.totalN - i;
    if (left < es.releaseN) g *= Math.max(0, left / es.releaseN);
    const j = start + i;
    out[j] = (out[j] ?? 0) + s * gain * g;
  }
}

function renderGrains(
  layer: GrainsLayer,
  env: RenderEnv,
  out: Float32Array,
  start: number,
  n: number,
  pitch: number,
  gain: number,
): void {
  const { sr, rng } = env;
  const filt = layer.filter !== undefined ? createBiquad() : null;
  for (let g = 0; g < layer.count; g++) {
    const g0 = start + Math.floor(rng.next() * (layer.spreadMs / 1000) * sr);
    const lenMs = layer.grainMs + rng.next() * ((layer.grainMsMax ?? layer.grainMs) - layer.grainMs);
    const len = Math.min(Math.floor((lenMs / 1000) * sr), start + n - g0);
    if (len <= 0) continue;
    const f = layer.freqMin * Math.pow(layer.freqMax / layer.freqMin, rng.next()) * pitch;
    const amp = gain * (0.5 + 0.5 * rng.next());
    const fallK = Math.pow(semisToRatio(-(layer.drop ?? 0)), 1 / len);
    const decK = Math.pow(10, -3 / ((lenMs / 1000) * sr));
    if (filt !== null && layer.filter !== undefined) {
      filt.set(layer.filter.type, f, layer.filter.q ?? 1, sr);
    }
    let phase = rng.next();
    let fi = f;
    let e = 1;
    for (let i = 0; i < len; i++) {
      let s: number;
      if (layer.wave === 'noise') {
        s = env.noise.white();
        if (filt !== null) s = filt.process(s);
      } else {
        s = waveSample(layer.wave ?? 'sine', phase, fi / sr);
        phase += fi / sr;
        phase -= Math.floor(phase);
        fi *= fallK;
      }
      const j = g0 + i;
      out[j] = (out[j] ?? 0) + s * amp * e * Math.min(1, i / 16);
      e *= decK;
    }
  }
}

/**
 * Renders layers into a new buffer of totalMs at sampleRate.
 * baseHz is the note frequency for instrument layers that set ratio instead of freq.
 */
export function renderLayers(
  layers: readonly LayerSpec[],
  totalMs: number,
  sampleRate: number,
  rng: Rng,
  baseHz = 440,
): Float32Array {
  const out = new Float32Array(Math.max(1, Math.ceil((totalMs / 1000) * sampleRate)));
  const env: RenderEnv = { sr: sampleRate, totalMs, baseHz, rng, noise: createNoise(rng) };
  for (const layer of layers) {
    const startMs = layer.startMs ?? 0;
    const durMs = layer.durMs ?? totalMs - startMs;
    const rep = layer.repeat;
    const count = rep?.count ?? 1;
    let offsetMs = 0;
    for (let k = 0; k < count; k++) {
      const pitch = semisToRatio((rep?.semis ?? 0) * k);
      const gain = dbToGain((layer.gainDb ?? 0) + (rep?.gainDb ?? 0) * k);
      renderOnce(layer, env, out, (startMs + offsetMs) / 1000, durMs / 1000, pitch, gain);
      if (rep !== undefined) {
        const end = rep.everyEndMs ?? rep.everyMs;
        const x = count > 1 ? k / (count - 1) : 0;
        offsetMs += rep.everyMs * Math.pow(end / rep.everyMs, x);
      }
    }
  }
  return out;
}
