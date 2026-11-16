// CSV dialect parser (architecture.md 9.2). [Frozen M1]
// UTF-8 without BOM, comma separator, snake_case header, RFC 4180 double quotes for cells with commas,
// `#` comment lines and blank lines ignored. Cells are trimmed. Multi-line cells are not allowed.

export interface CsvRow {
  /** 1-based physical line number in the file. */
  readonly line: number;
  readonly cells: readonly string[];
}

export interface CsvTable {
  readonly header: readonly string[];
  /** 1-based line of the header. */
  readonly headerLine: number;
  readonly rows: readonly CsvRow[];
}

export interface CsvIssue {
  readonly line: number;
  /** 1-based column, 0 when the whole line is concerned. */
  readonly col: number;
  readonly message: string;
}

export type CsvResult =
  | { readonly ok: true; readonly table: CsvTable }
  | { readonly ok: false; readonly issues: readonly CsvIssue[] };

const HEADER_RE = /^[a-z][a-z0-9_]*$/;

/** Split one line into cells. Returns an issue message on malformed quotes. */
function splitLine(line: string): string[] | string {
  const cells: string[] = [];
  let i = 0;
  const n = line.length;
  for (;;) {
    // Skip leading spaces before a possible quote.
    let j = i;
    while (j < n && line[j] === ' ') j++;
    if (j < n && line[j] === '"') {
      let value = '';
      let k = j + 1;
      for (;;) {
        if (k >= n) return 'unterminated quoted cell (multi-line cells are not allowed)';
        const ch = line[k];
        if (ch === '"') {
          if (line[k + 1] === '"') {
            value += '"';
            k += 2;
            continue;
          }
          k++;
          break;
        }
        value += ch ?? '';
        k++;
      }
      while (k < n && line[k] === ' ') k++;
      if (k < n && line[k] !== ',') return 'unexpected text after a closing quote';
      cells.push(value.trim());
      if (k >= n) return cells;
      i = k + 1;
    } else {
      const comma = line.indexOf(',', i);
      const raw = comma === -1 ? line.slice(i) : line.slice(i, comma);
      if (raw.includes('"')) return 'quote inside an unquoted cell (wrap the whole cell in quotes)';
      cells.push(raw.trim());
      if (comma === -1) return cells;
      i = comma + 1;
    }
  }
}

export function parseCsv(text: string): CsvResult {
  const issues: CsvIssue[] = [];
  if (text.charCodeAt(0) === 0xfeff) {
    return {
      ok: false,
      issues: [{ line: 1, col: 0, message: 'file starts with a BOM; save as UTF-8 without BOM' }],
    };
  }
  const lines = text.split('\n');
  let header: string[] | null = null;
  let headerLine = 0;
  const rows: CsvRow[] = [];
  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1;
    const line = (lines[li] ?? '').replace(/\r$/, '');
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const cells = splitLine(line);
    if (typeof cells === 'string') {
      issues.push({ line: lineNo, col: 0, message: cells });
      continue;
    }
    if (header === null) {
      header = cells;
      headerLine = lineNo;
      const seen = new Set<string>();
      cells.forEach((h, ci) => {
        if (!HEADER_RE.test(h))
          issues.push({ line: lineNo, col: ci + 1, message: `header "${h}" must be snake_case` });
        if (seen.has(h))
          issues.push({ line: lineNo, col: ci + 1, message: `duplicate header "${h}"` });
        seen.add(h);
      });
      continue;
    }
    if (cells.length !== header.length) {
      issues.push({
        line: lineNo,
        col: 0,
        message: `row has ${cells.length} cells, header has ${header.length}`,
      });
      continue;
    }
    rows.push({ line: lineNo, cells });
  }
  if (header === null)
    return { ok: false, issues: [{ line: 1, col: 0, message: 'missing header row' }] };
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, table: { header, headerLine, rows } };
}
