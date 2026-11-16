import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../../src/content/index.ts';

describe('csv dialect', () => {
  it('parses header and rows, skipping comments and blank lines, keeping line numbers', () => {
    const r = parseCsv('# comment\nid,value\n\na,1\n# another\nb, 2 \n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.header).toEqual(['id', 'value']);
    expect(r.table.headerLine).toBe(2);
    expect(r.table.rows).toEqual([
      { line: 4, cells: ['a', '1'] },
      { line: 6, cells: ['b', '2'] },
    ]);
  });

  it('accepts RFC 4180 quotes for cells containing commas and escaped quotes', () => {
    const r = parseCsv('id,params\nx,"a=1,b=2"\ny,"say ""hi"""\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.rows[0]?.cells).toEqual(['x', 'a=1,b=2']);
    expect(r.table.rows[1]?.cells).toEqual(['y', 'say "hi"']);
  });

  it('handles CRLF line endings', () => {
    const r = parseCsv('id,v\r\na,1\r\n');
    expect(r.ok && r.table.rows[0]?.cells).toEqual(['a', '1']);
  });

  it('accepts a header-only file as an empty table', () => {
    const r = parseCsv('id,v\n');
    expect(r.ok && r.table.rows.length).toBe(0);
  });

  it('reports line and column for bad headers, wrong cell counts, quotes, and BOM', () => {
    const bad = parseCsv('id,Value\na,1,2\nb,"open\n');
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.issues).toEqual([
      { line: 1, col: 2, message: 'header "Value" must be snake_case' },
      { line: 2, col: 0, message: 'row has 3 cells, header has 2' },
      { line: 3, col: 0, message: 'unterminated quoted cell (multi-line cells are not allowed)' },
    ]);
    const bom = parseCsv('﻿id\n');
    expect(bom.ok).toBe(false);
  });
});
