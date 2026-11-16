// localStorage wrapper: every access in try/catch, memory fallback (architecture.md 12).

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

export function createStorage(): KeyValueStore {
  const memory = new Map<string, string>();
  const ls = (): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        const v = ls()?.getItem(key);
        if (v !== undefined && v !== null) return v;
      } catch {
        // Blocked or private mode: fall through to memory.
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      try {
        ls()?.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        ls()?.removeItem(key);
      } catch {
        // Ignore: memory copy is gone already.
      }
    },
  };
}
