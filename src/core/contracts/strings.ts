// String table: content/strings/en.json, owned by WR (architecture.md 9.7). [Frozen M1]
// Flat object, dotted snake_case keys, {name} parameters, plurals as `.one` and `.other` suffixes.
// Formatting helpers live in src/content (formatString).

export type StringTable = Readonly<Record<string, string>>;

export type StringParams = Readonly<Record<string, string | number>>;
