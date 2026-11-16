// DSP primitives on plain numbers (architecture.md 11): no Web Audio, so everything runs in Node.
// Biquad coefficients follow the RBJ audio EQ cookbook (audio-direction 2.3).

import type { Rng } from '../../core/index.ts';

export type FilterType = 'lp' | 'hp' | 'bp';
export type Wave = 'sine' | 'triangle' | 'saw' | 'square' | 'pulse12' | 'pulse25';

/** Second-order filter with mutable coefficients (re-set during sweeps). */
export interface Biquad {
  set(type: FilterType, freqHz: number, q: number, sampleRate: number): void;
  process(x: number): number;
}

export function createBiquad(): Biquad {
  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return {
    set(type, freqHz, q, sampleRate) {
      const f = Math.min(Math.max(freqHz, 10), sampleRate * 0.45);
      const w0 = (2 * Math.PI * f) / sampleRate;
      const cos = Math.cos(w0);
      const alpha = Math.sin(w0) / (2 * Math.max(q, 0.05));
      const a0 = 1 + alpha;
      if (type === 'lp') {
        b0 = (1 - cos) / 2 / a0;
        b1 = (1 - cos) / a0;
        b2 = b0;
      } else if (type === 'hp') {
        b0 = (1 + cos) / 2 / a0;
        b1 = -(1 + cos) / a0;
        b2 = b0;
      } else {
        // Band-pass with 0 dB peak gain.
        b0 = alpha / a0;
        b1 = 0;
        b2 = -alpha / a0;
      }
      a1 = (-2 * cos) / a0;
      a2 = (1 - alpha) / a0;
    },
    process(x) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      return y;
    },
  };
}

/** PolyBLEP residual that removes most aliasing from hard waveform edges. */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

function pulse(phase: number, dt: number, duty: number): number {
  let v = phase < duty ? 1 : -1;
  v += polyBlep(phase, dt);
  const shifted = phase - duty < 0 ? phase - duty + 1 : phase - duty;
  v -= polyBlep(shifted, dt);
  // Remove the DC offset of an asymmetric pulse.
  return v - (2 * duty - 1);
}

/** One sample of a band-limited-ish waveform. phase in [0, 1), dt = freq / sampleRate. */
export function waveSample(wave: Wave, phase: number, dt: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(2 * Math.PI * phase);
    case 'triangle':
      return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    case 'saw':
      return 2 * phase - 1 - polyBlep(phase, dt);
    case 'square':
      return pulse(phase, dt, 0.5);
    case 'pulse12':
      return pulse(phase, dt, 0.125);
    case 'pulse25':
      return pulse(phase, dt, 0.25);
  }
}

/** White and pink noise from the audio RNG (never Math.random, architecture 4.3). */
export interface NoiseSource {
  white(): number;
  pink(): number;
}

export function createNoise(rng: Rng): NoiseSource {
  // Paul Kellet's economy pink filter.
  let p0 = 0;
  let p1 = 0;
  let p2 = 0;
  return {
    white() {
      return rng.next() * 2 - 1;
    },
    pink() {
      const w = rng.next() * 2 - 1;
      p0 = 0.99765 * p0 + w * 0.099046;
      p1 = 0.963 * p1 + w * 0.2965164;
      p2 = 0.57 * p2 + w * 1.0526913;
      return (p0 + p1 + p2 + w * 0.1848) * 0.25;
    },
  };
}

export function peakOf(buf: Float32Array): number {
  let p = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = Math.abs(buf[i] ?? 0);
    if (v > p) p = v;
  }
  return p;
}

/** Scales buf in place so its peak equals targetPeak. Silent buffers stay silent. */
export function normalizePeak(buf: Float32Array, targetPeak: number): void {
  const p = peakOf(buf);
  if (p <= 0) return;
  const k = targetPeak / p;
  for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] ?? 0) * k;
}

/** Runs a static filter over buf in place. */
export function filterInPlace(
  buf: Float32Array,
  type: FilterType,
  freqHz: number,
  q: number,
  sampleRate: number,
): void {
  const f = createBiquad();
  f.set(type, freqHz, q, sampleRate);
  for (let i = 0; i < buf.length; i++) buf[i] = f.process(buf[i] ?? 0);
}

/** Linear fade-in over the first n samples and fade-out over the last m samples. */
export function fadeEdges(buf: Float32Array, inSamples: number, outSamples: number): void {
  const n = Math.min(inSamples, buf.length);
  for (let i = 0; i < n; i++) buf[i] = (buf[i] ?? 0) * (i / n);
  const m = Math.min(outSamples, buf.length);
  for (let i = 0; i < m; i++) {
    const j = buf.length - 1 - i;
    buf[j] = (buf[j] ?? 0) * (i / m);
  }
}
