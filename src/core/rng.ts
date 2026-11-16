// Seeded RNG: sfc32 per named stream (architecture.md 4.3). [Frozen M1]
// Stream seed = splitmix32(hash(runSeed, streamName)). Math.random is banned in all of src/ and art/.

import { createHasher } from './hash.ts';

/** The six sim streams. Order is fixed; save and hash iterate in this order. */
export const RNG_STREAMS = ['spawn', 'ai', 'combat', 'loot', 'shop', 'levelUp'] as const;
export type RngStreamName = (typeof RNG_STREAMS)[number];

export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** Next unsigned 32-bit integer. */
  nextU32(): number;
  /** Float in [0, 1) with 32 bits of resolution. */
  next(): number;
  /** Integer in [0, n). n must be a positive integer below 2^32. */
  int(n: number): number;
  /** Integer in [min, max] inclusive. */
  intRange(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** true with probability p (p <= 0 never, p >= 1 always; consumes one draw either way). */
  chance(p: number): boolean;
  /** Copy of the internal state, for save and hash. */
  getState(): RngState;
  /** Writes the state into out without allocating (hash, save). */
  writeState(out: number[] | Uint32Array): void;
  setState(state: RngState): void;
}

const INV_2_32 = 1 / 4294967296;
/** Outputs discarded after seeding so close seeds diverge (standard sfc32 practice). */
const WARMUP_DRAWS = 15;

/** One splitmix32 step. Returns [nextState, output]. Used only for seeding. */
export function splitmix32(state: number): { readonly state: number; readonly value: number } {
  const s = (state + 0x9e3779b9) | 0;
  let z = s;
  z ^= z >>> 16;
  z = Math.imul(z, 0x21f0aaad);
  z ^= z >>> 15;
  z = Math.imul(z, 0x735a2d97);
  z ^= z >>> 15;
  return { state: s, value: z >>> 0 };
}

/** Expand one 32-bit seed into a full sfc32 state with splitmix32, then warm up. */
export function seedState(seed: number): RngState {
  let s = seed | 0;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = splitmix32(s);
    s = r.state;
    out.push(r.value);
  }
  const rng = createRng([out[0] ?? 0, out[1] ?? 0, out[2] ?? 0, out[3] ?? 0]);
  for (let i = 0; i < WARMUP_DRAWS; i++) rng.nextU32();
  return rng.getState();
}

/** sfc32 generator from an explicit state, or from a 32-bit seed. */
export function createRng(init: RngState | number): Rng {
  const st = typeof init === 'number' ? seedState(init) : init;
  let a = st[0] | 0;
  let b = st[1] | 0;
  let c = st[2] | 0;
  let d = st[3] | 0;

  const nextU32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  const next = (): number => nextU32() * INV_2_32;

  return {
    nextU32,
    next,
    int(n) {
      return Math.floor(next() * n);
    },
    intRange(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    getState() {
      return [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    },
    writeState(out) {
      out[0] = a >>> 0;
      out[1] = b >>> 0;
      out[2] = c >>> 0;
      out[3] = d >>> 0;
    },
    setState(s) {
      a = s[0] | 0;
      b = s[1] | 0;
      c = s[2] | 0;
      d = s[3] | 0;
    },
  };
}

/** Seed for one named stream: FNV-1a over (runSeed, streamName). */
export function streamSeed(runSeed: number, stream: string): number {
  const h = createHasher();
  h.u32(runSeed >>> 0);
  h.str(stream);
  return h.value();
}

export type RngStreams = Readonly<Record<RngStreamName, Rng>>;

/** All six sim streams for a run seed. Streams are independent: draws on one never move another. */
export function createRngStreams(runSeed: number): RngStreams {
  return {
    spawn: createRng(streamSeed(runSeed, 'spawn')),
    ai: createRng(streamSeed(runSeed, 'ai')),
    combat: createRng(streamSeed(runSeed, 'combat')),
    loot: createRng(streamSeed(runSeed, 'loot')),
    shop: createRng(streamSeed(runSeed, 'shop')),
    levelUp: createRng(streamSeed(runSeed, 'levelUp')),
  };
}
