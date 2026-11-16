import { describe, expect, it } from 'vitest';
import {
  buildPixelFontTtf,
  CELL_H,
  glyphRects,
  glyphRows,
  hasGlyph,
} from '../../../src/ui/pixel-font.ts';

describe('team pixel font glyphs', () => {
  it('defines every printable ASCII character in a 5 x 9 grid', () => {
    for (let c = 32; c <= 126; c++) {
      const ch = String.fromCharCode(c);
      expect(hasGlyph(ch), ch).toBe(true);
      const rows = glyphRows(ch);
      expect(rows).toHaveLength(CELL_H);
      for (const r of rows) expect(r).toMatch(/^[#.]{5}$/);
    }
  });

  it('keeps capitals and digits inside the 7 rows above the baseline', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const rows = glyphRows(ch);
      expect(rows[7], ch).toBe('.....');
      expect(rows[8], ch).toBe('.....');
      expect(
        rows.slice(0, 7).some((r) => r.includes('#')),
        ch,
      ).toBe(true);
    }
  });

  it('covers exactly the inked pixels with merged rectangles', () => {
    for (const ch of 'AgjQ%@') {
      const rows = glyphRows(ch);
      const count = new Map<string, number>();
      for (const r of glyphRects(ch))
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++) {
            const k = `${String(x)},${String(y)}`;
            count.set(k, (count.get(k) ?? 0) + 1);
          }
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const k = `${String(x)},${String(y)}`;
          expect(count.get(k) ?? 0, `${ch} ${k}`).toBe(row.charAt(x) === '#' ? 1 : 0);
        }
      });
    }
    // Vertical strokes merge: "I" is three rectangles (top bar, stem, bottom bar).
    expect(glyphRects('I')).toHaveLength(3);
  });
});

describe('team pixel font file', () => {
  it('is a deterministic TrueType file with the expected tables', () => {
    const a = buildPixelFontTtf();
    const b = buildPixelFontTtf();
    expect(a).toEqual(b);
    const view = new DataView(a.buffer);
    expect(view.getUint32(0)).toBe(0x00010000);
    const n = view.getUint16(4);
    const tags: string[] = [];
    for (let i = 0; i < n; i++) {
      const o = 12 + i * 16;
      tags.push(String.fromCharCode(...a.subarray(o, o + 4)));
    }
    expect(tags).toEqual([
      'OS/2',
      'cmap',
      'glyf',
      'head',
      'hhea',
      'hmtx',
      'loca',
      'maxp',
      'name',
      'post',
    ]);
    expect([...tags].sort()).toEqual(tags);
    expect(a.length).toBeLessThan(32 * 1024);
  });

  it('balances the whole-file checksum through head.checkSumAdjustment', () => {
    const a = buildPixelFontTtf();
    const view = new DataView(a.buffer);
    let sum = 0;
    for (let i = 0; i < a.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0;
    expect(a.length % 4).toBe(0);
    expect(sum).toBe(0xb1b0afba);
  });
});
