// M5-01: the game must not crash when localStorage is blocked (privacy mode, disabled cookies,
// sandboxed iframe) or full. createStorage falls back to memory for the session.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorage } from '../../../src/app/storage.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function memoryLocalStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => {
      m.clear();
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
}

describe('createStorage', () => {
  it('works in memory when reading window.localStorage throws (blocked storage)', () => {
    const win = {};
    Object.defineProperty(win, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    vi.stubGlobal('window', win);
    const store = createStorage();
    expect(store.get('k')).toBeNull();
    expect(store.set('k', 'v')).toBe(true);
    expect(store.get('k')).toBe('v');
    store.remove('k');
    expect(store.get('k')).toBeNull();
  });

  it('keeps the value in memory and reports failure when setItem throws (quota)', () => {
    const ls = memoryLocalStorage();
    ls.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    vi.stubGlobal('window', { localStorage: ls });
    const store = createStorage();
    expect(store.set('k', 'v')).toBe(false);
    expect(store.get('k')).toBe('v');
  });

  it('works when getItem and removeItem throw', () => {
    const ls = memoryLocalStorage();
    ls.getItem = () => {
      throw new Error('blocked');
    };
    ls.removeItem = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('window', { localStorage: ls });
    const store = createStorage();
    store.set('k', 'v');
    expect(store.get('k')).toBe('v');
    expect(() => {
      store.remove('k');
    }).not.toThrow();
    expect(store.get('k')).toBeNull();
  });

  it('works when window has no localStorage at all', () => {
    vi.stubGlobal('window', {});
    const store = createStorage();
    expect(store.set('k', 'v')).toBe(true);
    expect(store.get('k')).toBe('v');
  });

  it('reads and writes through to localStorage when it is available', () => {
    const ls = memoryLocalStorage();
    vi.stubGlobal('window', { localStorage: ls });
    const store = createStorage();
    expect(store.set('k', 'v')).toBe(true);
    expect(ls.getItem('k')).toBe('v');
    expect(createStorage().get('k')).toBe('v');
  });
});
