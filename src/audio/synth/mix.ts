// Offline mixdown of sampled notes (Node previews of music). The browser plays the same samples
// with AudioBufferSourceNode; this file mirrors that playback in plain JS.

/** Equal-power pan gains for pan in [-1, 1]. */
export function panGains(pan: number): readonly [number, number] {
  const p = (Math.min(1, Math.max(-1, pan)) + 1) * 0.25 * Math.PI;
  return [Math.cos(p), Math.sin(p)];
}

export interface MixNote {
  readonly sample: Float32Array;
  readonly sampleRate: number;
  /** Playback rate (pitch shift). */
  readonly rate: number;
  readonly startSec: number;
  /** Held length before release. */
  readonly holdSec: number;
  readonly releaseSec: number;
  readonly gain: number;
  readonly pan: number;
  /** Loop start in samples of the sample (looped instruments); the loop ends at the sample end. */
  readonly loopStart?: number;
}

/** Adds one note into a stereo mix at outRate with linear interpolation and a linear release. */
export function mixNote(outL: Float32Array, outR: Float32Array, outRate: number, n: MixNote): void {
  const [gl, gr] = panGains(n.pan);
  const step = (n.sampleRate * n.rate) / outRate;
  const start = Math.floor(n.startSec * outRate);
  const hold = n.holdSec * outRate;
  const rel = Math.max(1, n.releaseSec * outRate);
  const total = Math.ceil(hold + rel);
  let pos = 0;
  for (let i = 0; i < total; i++) {
    const j = start + i;
    if (j >= outL.length) break;
    const len = n.sample.length;
    const loop = n.loopStart !== undefined && n.loopStart < len - 2 ? n.loopStart : -1;
    if (pos >= len) {
      if (loop < 0) break;
      // Wrap like AudioBufferSourceNode: the sample after the last one is loopStart.
      pos -= len - loop;
    }
    const k = Math.floor(pos);
    let k1 = k + 1;
    if (k1 >= len) {
      if (loop < 0) break;
      k1 = loop;
    }
    const frac = pos - k;
    const s = (n.sample[k] ?? 0) * (1 - frac) + (n.sample[k1] ?? 0) * frac;
    const env = i < hold ? 1 : Math.max(0, 1 - (i - hold) / rel);
    const v = s * env * n.gain;
    if (j >= 0) {
      outL[j] = (outL[j] ?? 0) + v * gl;
      outR[j] = (outR[j] ?? 0) + v * gr;
    }
    pos += step;
  }
}
