// FNV-1a 32-bit hashing (architecture.md 8.4, 9.3). Used for Sim.hash(), replay checkpoints, contentHash.
// Floats are hashed through their IEEE-754 bits, so equal states give equal hashes on the same JS engine.

export const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const f64 = new Float64Array(1);
const f64Words = new Uint32Array(f64.buffer);

/** Incremental FNV-1a hasher. Allocate once and reuse; no allocation per call. */
export interface Hasher {
  reset(): void;
  /** Hash an unsigned or signed 32-bit integer as 4 little-endian bytes. */
  u32(v: number): void;
  /** Hash a float through its 64-bit pattern. NaN is canonicalised; -0 stays distinct from 0. */
  f64(v: number): void;
  bool(v: boolean): void;
  /** Hash a string as UTF-8 bytes, preceded by its UTF-16 length. */
  str(s: string): void;
  /** Current 32-bit hash as an unsigned number. */
  value(): number;
}

function mixByte(h: number, byte: number): number {
  return Math.imul(h ^ (byte & 0xff), FNV_PRIME);
}

function mixU32(h: number, v: number): number {
  let x = h;
  x = mixByte(x, v);
  x = mixByte(x, v >>> 8);
  x = mixByte(x, v >>> 16);
  x = mixByte(x, v >>> 24);
  return x;
}

/** UTF-8 encode on the fly and mix every byte (no TextEncoder: core stays free of DOM and Node). */
function mixString(h: number, s: string): number {
  let x = h;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) {
      x = mixByte(x, c);
    } else if (c < 0x800) {
      x = mixByte(x, 0xc0 | (c >> 6));
      x = mixByte(x, 0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      x = mixByte(x, 0xe0 | (c >> 12));
      x = mixByte(x, 0x80 | ((c >> 6) & 0x3f));
      x = mixByte(x, 0x80 | (c & 0x3f));
    } else {
      x = mixByte(x, 0xf0 | (c >> 18));
      x = mixByte(x, 0x80 | ((c >> 12) & 0x3f));
      x = mixByte(x, 0x80 | ((c >> 6) & 0x3f));
      x = mixByte(x, 0x80 | (c & 0x3f));
    }
  }
  return x;
}

export function createHasher(seed: number = FNV_OFFSET): Hasher {
  let h = seed >>> 0;
  return {
    reset() {
      h = seed >>> 0;
    },
    u32(v) {
      h = mixU32(h, v);
    },
    f64(v) {
      f64[0] = v !== v ? Number.NaN : v;
      h = mixU32(h, f64Words[0] ?? 0);
      h = mixU32(h, f64Words[1] ?? 0);
    },
    bool(v) {
      h = mixByte(h, v ? 1 : 0);
    },
    str(s) {
      h = mixU32(h, s.length);
      h = mixString(h, s);
    },
    value() {
      return h >>> 0;
    },
  };
}

/** FNV-1a 32 of the UTF-8 bytes of a string (plain, no length prefix). Used for contentHash. */
export function fnv1aString(s: string, seed: number = FNV_OFFSET): number {
  return mixString(seed >>> 0, s) >>> 0;
}

/** 8 lowercase hex chars, zero padded (architecture 8.4). */
export function toHex8(h: number): string {
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Hash a sequence of typed array values (only indices where alive[i] !== 0 when alive is given). */
export function hashColumn(
  hasher: Hasher,
  column: ArrayLike<number>,
  highWater: number,
  alive?: ArrayLike<number>,
): void {
  for (let i = 0; i < highWater; i++) {
    if (alive !== undefined && alive[i] === 0) continue;
    hasher.f64(column[i] ?? 0);
  }
}
