// Cue and instrument rendering on top of renderLayers. Same code in the browser (boot render)
// and in Node (tools/audio/render-cues.ts), so the WAV previews match the game exactly.

import { createRng, fnv1aString } from '../../core/index.ts';
import { fadeEdges, filterInPlace, normalizePeak, peakOf } from './dsp.ts';
import { renderLayers } from './layers.ts';
import type { LayerSpec } from './layers.ts';
import { dbToGain, midiToHz } from './notes.ts';

/** The synthesis part of a cue (cue-data.ts adds playback fields). */
export interface SynthRecipe {
  readonly id: string;
  readonly durationMs: number;
  /** Peak level of the rendered buffer in dBFS with all faders at 100% (audio-direction 8.2). */
  readonly gainDb: number;
  readonly attackMs: number;
  readonly lowpassHz: number | null;
  readonly highpassHz: number | null;
  readonly layers: readonly LayerSpec[];
}

/** End fade so no buffer ends on a click (audio-direction 2.4: ramps of at least 5 ms). */
const END_FADE_MS = 5;
/** Tails quieter than this relative to the peak (-66 dB) are cut to save buffer memory. */
const TAIL_THRESHOLD = 0.0005;

/** Copy of buf without its inaudible tail, ending on a short fade. */
function trimTail(buf: Float32Array, sampleRate: number): Float32Array {
  const limit = peakOf(buf) * TAIL_THRESHOLD;
  let end = buf.length;
  while (end > 1 && Math.abs(buf[end - 1] ?? 0) <= limit) end--;
  const fade = Math.round((END_FADE_MS / 1000) * sampleRate);
  end = Math.min(buf.length, end + fade);
  if (end >= buf.length) return buf;
  const out = buf.slice(0, end);
  fadeEdges(out, 0, fade);
  return out;
}

function finish(buf: Float32Array, r: SynthRecipe, sampleRate: number): Float32Array {
  if (r.highpassHz !== null) filterInPlace(buf, 'hp', r.highpassHz, 0.707, sampleRate);
  if (r.lowpassHz !== null) filterInPlace(buf, 'lp', r.lowpassHz, 0.707, sampleRate);
  fadeEdges(
    buf,
    Math.round((r.attackMs / 1000) * sampleRate),
    Math.round((END_FADE_MS / 1000) * sampleRate),
  );
  normalizePeak(buf, dbToGain(r.gainDb));
  return trimTail(buf, sampleRate);
}

/** Seed per recipe id so renders are deterministic and independent of render order. */
export function seedFor(id: string, salt = 0): number {
  return (fnv1aString(id) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
}

/**
 * Renders a cue to a mono buffer. durationMs overrides the recipe length for live cues
 * (telegraph windups follow the sim duration).
 */
export function renderCue(
  r: SynthRecipe,
  sampleRate: number,
  durationMs: number = r.durationMs,
): Float32Array {
  const rng = createRng(seedFor(r.id, Math.round(durationMs)));
  return finish(renderLayers(r.layers, durationMs, sampleRate, rng), r, sampleRate);
}

/** One pitched sample of a music instrument (sampler playback shifts it by at most 6 semitones). */
export interface InstrumentDef {
  readonly id: string;
  readonly sampleRate: number;
  /** Reference notes rendered at boot. Empty for unpitched kit lanes. */
  readonly refNotes: readonly number[];
  readonly lengthMs: number;
  readonly releaseMs: number;
  readonly peakDb: number;
  readonly highpassHz: number | null;
  readonly lowpassHz: number | null;
  readonly layers: readonly LayerSpec[];
  /**
   * Sustained instruments loop instead of rendering long samples (buffer memory, audio-direction
   * 2.2): the sample ends releaseGuardMs before lengthMs, and its last xfadeMs are crossfaded
   * with the audio just before startMs, so playback can jump from the end back to startMs.
   */
  readonly loop: { readonly startMs: number; readonly xfadeMs: number } | null;
}

/** Part of a looped sample cut off at the end so the layer release never enters the loop. */
const LOOP_RELEASE_GUARD_MS = 80;

/** Loop region in seconds of a rendered instrument sample, null for one-shot samples. */
export function loopPointsOf(
  inst: InstrumentDef,
  sampleLength: number,
): { readonly startSec: number; readonly endSec: number } | null {
  if (inst.loop === null) return null;
  return { startSec: inst.loop.startMs / 1000, endSec: sampleLength / inst.sampleRate };
}

/** Equal-power crossfade of the loop tail into the audio before the loop start. */
function makeLoop(buf: Float32Array, startN: number, xfadeN: number, endN: number): Float32Array {
  const x = Math.max(1, Math.min(xfadeN, startN, endN - startN - 1));
  const out = buf.slice(0, endN);
  for (let i = 0; i < x; i++) {
    const t = (i + 0.5) / x;
    const a = Math.cos(t * 0.5 * Math.PI);
    const b = Math.sin(t * 0.5 * Math.PI);
    const j = endN - x + i;
    out[j] = (buf[j] ?? 0) * a + (buf[startN - x + i] ?? 0) * b;
  }
  return out;
}

export function renderInstrumentSample(inst: InstrumentDef, refMidi: number | null): Float32Array {
  const rng = createRng(seedFor(inst.id, refMidi ?? 0));
  const hz = refMidi === null ? 440 : midiToHz(refMidi);
  const buf = renderLayers(inst.layers, inst.lengthMs, inst.sampleRate, rng, hz);
  const recipe: SynthRecipe = {
    id: inst.id,
    durationMs: inst.lengthMs,
    gainDb: inst.peakDb,
    attackMs: 0,
    lowpassHz: inst.lowpassHz,
    highpassHz: inst.highpassHz,
    layers: inst.layers,
  };
  if (inst.loop === null) return finish(buf, recipe, inst.sampleRate);
  // Looped: filter and normalise, but keep the sustained end (no tail trim, no end fade).
  const sr = inst.sampleRate;
  if (recipe.highpassHz !== null) filterInPlace(buf, 'hp', recipe.highpassHz, 0.707, sr);
  if (recipe.lowpassHz !== null) filterInPlace(buf, 'lp', recipe.lowpassHz, 0.707, sr);
  normalizePeak(buf, dbToGain(inst.peakDb));
  const endN = Math.max(2, buf.length - Math.round((LOOP_RELEASE_GUARD_MS / 1000) * sr));
  const startN = Math.min(endN - 2, Math.round((inst.loop.startMs / 1000) * sr));
  return makeLoop(buf, startN, Math.round((inst.loop.xfadeMs / 1000) * sr), endN);
}

/** Index of the reference note closest to midi, and the playback rate that reaches midi. */
export function pickRef(refNotes: readonly number[], midi: number): { index: number; rate: number } {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < refNotes.length; i++) {
    const d = Math.abs(midi - (refNotes[i] ?? 0));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  const ref = refNotes[best] ?? midi;
  return { index: best, rate: Math.pow(2, (midi - ref) / 12) };
}
