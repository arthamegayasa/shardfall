import { describe, expect, it } from 'vitest';
import { createHasher, fnv1aString, hashColumn, toHex8 } from '../../../src/core/index.ts';

describe('fnv1a', () => {
  it('matches published FNV-1a 32-bit test vectors', () => {
    expect(fnv1aString('')).toBe(0x811c9dc5);
    expect(fnv1aString('a')).toBe(0xe40c292c);
    expect(fnv1aString('foobar')).toBe(0xbf9cf968);
  });

  it('hashes non-ASCII text as UTF-8 bytes', () => {
    // "é" is C3 A9 in UTF-8; hashing those two bytes by hand must agree.
    const manual = Math.imul(Math.imul(0x811c9dc5 ^ 0xc3, 0x01000193) ^ 0xa9, 0x01000193) >>> 0;
    expect(fnv1aString('é')).toBe(manual);
  });

  it('formats as 8 lowercase hex chars', () => {
    expect(toHex8(0xabc)).toBe('00000abc');
    expect(toHex8(0xdeadbeef)).toBe('deadbeef');
  });
});

describe('hasher', () => {
  it('gives equal hashes for equal state and different hashes for different floats', () => {
    const a = createHasher();
    const b = createHasher();
    a.u32(7);
    a.f64(1.5);
    b.u32(7);
    b.f64(1.5);
    expect(a.value()).toBe(b.value());
    b.f64(1.5000000000000002);
    a.f64(1.5);
    expect(a.value()).not.toBe(b.value());
  });

  it('resets to the seed', () => {
    const h = createHasher();
    const empty = h.value();
    h.str('state');
    h.reset();
    expect(h.value()).toBe(empty);
  });

  it('canonicalises NaN so equal NaN states hash equal', () => {
    const a = createHasher();
    const b = createHasher();
    a.f64(Number.NaN);
    b.f64(0 / 0);
    expect(a.value()).toBe(b.value());
  });

  it('hashes only alive slots of a pool column', () => {
    const x = new Float64Array([1, 99, 3]);
    const alive = new Uint8Array([1, 0, 1]);
    const a = createHasher();
    hashColumn(a, x, 3, alive);
    const b = createHasher();
    b.f64(1);
    b.f64(3);
    expect(a.value()).toBe(b.value());
  });
});
