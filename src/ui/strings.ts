// String lookup for UI text (ui-spec 11, architecture 9.7). Every visible word goes through t().
// Missing keys fall back to the key itself (or [[key]] in dev builds) so screens stay usable while
// WR fills content/strings/en.json.

import type { StringParams, StringTable } from '../core/index.ts';
import { formatString } from '../content/index.ts';

export type TranslateFn = (key: string, params?: StringParams) => string;

export interface Translator {
  readonly t: TranslateFn;
  has(key: string): boolean;
  /** Keys requested but absent from the table, for debugging and tests. */
  missing(): readonly string[];
}

export interface TranslatorOptions {
  /** Dev builds show [[key]] for a missing key, release builds show the key itself. */
  readonly dev?: boolean;
}

export function createTranslator(table: StringTable, opts: TranslatorOptions = {}): Translator {
  const missing = new Set<string>();
  const format = {
    dev: opts.dev === true,
    onMissing: (key: string): void => {
      missing.add(key);
    },
  };
  return {
    t: (key, params) => formatString(table, key, params, format),
    has: (key) => key in table,
    missing: () => [...missing],
  };
}
