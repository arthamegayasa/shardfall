// Synthetic stereo impulse responses for the hall and room sends (audio-direction 3.1).

import { createRng } from '../../core/index.ts';
import { seedFor } from './render.ts';

export interface IrSpec {
  readonly id: string;
  readonly rt60Sec: number;
  readonly preDelayMs: number;
  readonly earlyMs: readonly number[];
}

export const IR_HALL: IrSpec = { id: 'ir.hall', rt60Sec: 2.4, preDelayMs: 20, earlyMs: [23, 37, 51] };
export const IR_ROOM: IrSpec = { id: 'ir.room', rt60Sec: 0.6, preDelayMs: 8, earlyMs: [11, 17] };

function channel(spec: IrSpec, sampleRate: number, seed: number): Float32Array {
  const rng = createRng(seed);
  const pre = Math.round((spec.preDelayMs / 1000) * sampleRate);
  const n = pre + Math.round(spec.rt60Sec * sampleRate);
  const ir = new Float32Array(n);
  let lp = 0;
  for (let i = pre; i < n; i++) {
    const t = (i - pre) / sampleRate;
    const x = t / spec.rt60Sec;
    // Tail darkens: one-pole cutoff falls from about 12 kHz to 2.5 kHz.
    const fc = 12000 * Math.pow(2500 / 12000, x);
    const a = 1 - Math.exp((-2 * Math.PI * fc) / sampleRate);
    const v = (rng.next() * 2 - 1) * Math.pow(10, (-3 * t) / spec.rt60Sec);
    lp += a * (v - lp);
    ir[i] = lp;
  }
  // Sharp early "glass" reflections.
  for (const ms of spec.earlyMs) {
    const j = Math.round((ms / 1000) * sampleRate);
    if (j < n) ir[j] = (ir[j] ?? 0) + (rng.next() < 0.5 ? -0.5 : 0.5);
  }
  // Normalise energy so send levels mean the same for both IRs.
  let e = 0;
  for (let i = 0; i < n; i++) e += (ir[i] ?? 0) * (ir[i] ?? 0);
  const k = e > 0 ? 0.25 / Math.sqrt(e) : 0;
  for (let i = 0; i < n; i++) ir[i] = (ir[i] ?? 0) * k;
  return ir;
}

/** Left and right channels use different seeds so the reverb is wide. */
export function renderIr(spec: IrSpec, sampleRate: number): readonly [Float32Array, Float32Array] {
  return [
    channel(spec, sampleRate, seedFor(spec.id, 1)),
    channel(spec, sampleRate, seedFor(spec.id, 2)),
  ];
}
