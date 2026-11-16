// String table lookup and formatting (architecture.md 9.7). Used by UI; pure.

import type { StringParams, StringTable } from '../core/index.ts';

export interface FormatOptions {
  /** Called once per missing key (app logs a console warning in release builds). */
  readonly onMissing?: (key: string) => void;
  /** Dev shows [[key]] for missing keys; release shows the key itself. */
  readonly dev?: boolean;
}

/**
 * Look up `key`, pick `.one` / `.other` when params.count is given and plural forms exist,
 * and replace `{name}` placeholders.
 */
export function formatString(
  table: StringTable,
  key: string,
  params?: StringParams,
  opts: FormatOptions = {},
): string {
  let template: string | undefined;
  const count = params?.['count'];
  if (typeof count === 'number') {
    template = table[count === 1 ? `${key}.one` : `${key}.other`];
  }
  template ??= table[key];
  if (template === undefined) {
    opts.onMissing?.(key);
    return opts.dev === true ? `[[${key}]]` : key;
  }
  if (params === undefined) return template;
  return template.replace(/\{([a-z0-9_]+)\}/gi, (whole, name: string) => {
    const v = params[name];
    return v === undefined ? whole : String(v);
  });
}
