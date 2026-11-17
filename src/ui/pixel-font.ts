// Team bitmap font "Shardfall Pixel" (style guide 2.3, ui-spec 7.2; Producer decision 2026-11-16).
// Glyphs are data in this file: 5 x 7 inside a 6 x 9 cell (7 rows above the baseline, 2 below for
// descenders). At boot the UI assembles them into a tiny TrueType font (one square contour per
// pixel run) and registers it with FontFace, so DOM text keeps native wrapping, focus, and screen
// reader support. One font pixel = 9th of the font-size; the CSS sets font-size to 9 x --f so every
// font pixel is a whole number of device pixels. If loading fails, the monospace fallback stays.

export const PIXEL_FONT_FAMILY = 'Shardfall Pixel';

/** Cell in font pixels (style guide 2.3). */
export const CELL_W = 6;
export const CELL_H = 9;
const ASCENT_PX = 7;
const DESCENT_PX = 2;
/** Font units per font pixel; unitsPerEm = CELL_H x this. */
const PX = 128;

// Rows top to bottom. '#' = ink. Up to 9 rows: 0..6 sit above the baseline, 7..8 are descenders.
// Missing trailing rows are empty. Width is always 5.
const G: Readonly<Record<string, string>> = {
  ' ': '',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '"': '.#.#.|.#.#.',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  $: '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
  '%': '##...|##..#|...#.|..#..|.#...|#..##|...##',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  "'": '..#..|..#..',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..',
  '+': '.....|..#..|..#..|#####|..#..|..#..',
  ',': '.....|.....|.....|.....|.....|..#..|..#..|.#...',
  '-': '.....|.....|.....|.###.',
  '.': '.....|.....|.....|.....|.....|.....|..#..',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '####.|....#|....#|.###.|....#|....#|####.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ':': '.....|.....|..#..|.....|.....|..#..',
  ';': '.....|.....|..#..|.....|.....|..#..|..#..|.#...',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
  '=': '.....|.....|#####|.....|#####',
  '>': '#....|.#...|..#..|...#.|..#..|.#...|#....',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.',
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '[': '.###.|.#...|.#...|.#...|.#...|.#...|.###.',
  '\\': '#....|#....|.#...|..#..|...#.|....#|....#',
  ']': '.###.|...#.|...#.|...#.|...#.|...#.|.###.',
  '^': '..#..|.#.#.|#...#',
  _: '.....|.....|.....|.....|.....|.....|.....|#####',
  '`': '.#...|..#..',
  a: '.....|.....|.###.|....#|.####|#...#|.####',
  b: '#....|#....|####.|#...#|#...#|#...#|####.',
  c: '.....|.....|.###.|#....|#....|#....|.###.',
  d: '....#|....#|.####|#...#|#...#|#...#|.####',
  e: '.....|.....|.###.|#...#|#####|#....|.###.',
  f: '..##.|.#...|####.|.#...|.#...|.#...|.#...',
  g: '.....|.....|.####|#...#|#...#|#...#|.####|....#|.###.',
  h: '#....|#....|####.|#...#|#...#|#...#|#...#',
  i: '..#..|.....|.##..|..#..|..#..|..#..|.###.',
  j: '...#.|.....|..##.|...#.|...#.|...#.|...#.|#..#.|.##..',
  k: '#....|#....|#..#.|#.#..|##...|#.#..|#..#.',
  l: '.##..|..#..|..#..|..#..|..#..|..#..|.###.',
  m: '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#...#',
  n: '.....|.....|####.|#...#|#...#|#...#|#...#',
  o: '.....|.....|.###.|#...#|#...#|#...#|.###.',
  p: '.....|.....|####.|#...#|#...#|#...#|####.|#....|#....',
  q: '.....|.....|.####|#...#|#...#|#...#|.####|....#|....#',
  r: '.....|.....|#.##.|##..#|#....|#....|#....',
  s: '.....|.....|.####|#....|.###.|....#|####.',
  t: '.#...|.#...|####.|.#...|.#...|.#..#|..##.',
  u: '.....|.....|#...#|#...#|#...#|#..##|.##.#',
  v: '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
  w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.',
  x: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
  y: '.....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.',
  z: '.....|.....|#####|...#.|..#..|.#...|#####',
  '{': '...##|..#..|..#..|.#...|..#..|..#..|...##',
  '|': '..#..|..#..|..#..|..#..|..#..|..#..|..#..',
  '}': '##...|..#..|..#..|...#.|..#..|..#..|##...',
  '~': '.....|.....|.#...|#.#.#|...#.',
  // Middle dot U+00B7: separator in the title credit line (M4-02).
  '·': '.....|.....|.....|..#..',
};

/** First and last mapped character codes (printable ASCII). */
const FIRST = 32;
const LAST = 126;
/** Characters beyond ASCII, one cmap segment each, glyphs after the ASCII ones. */
const EXTRA = [0xb7] as const;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Glyph rows for a character ('' rows when absent), always CELL_H rows of 5 columns. */
export function glyphRows(ch: string): string[] {
  const src = G[ch];
  const rows = src === undefined || src === '' ? [] : src.split('|');
  const out: string[] = [];
  for (let r = 0; r < CELL_H; r++) out.push((rows[r] ?? '').padEnd(5, '.').slice(0, 5));
  return out;
}

/** True when the font defines the character (space counts). */
export function hasGlyph(ch: string): boolean {
  return ch in G;
}

/**
 * Pixel runs of one glyph as rectangles in font pixels, x right, y DOWN from the cell top. Equal
 * runs in consecutive rows merge vertically, so most strokes are one contour.
 */
export function glyphRects(ch: string): Rect[] {
  const rows = glyphRows(ch);
  const open: { x: number; w: number; y: number; h: number }[] = [];
  const done: Rect[] = [];
  rows.forEach((row, y) => {
    const runs: { x: number; w: number }[] = [];
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let e = x;
      while (e < row.length && row[e] === '#') e++;
      runs.push({ x, w: e - x });
      x = e;
    }
    for (let i = open.length - 1; i >= 0; i--) {
      const o = open[i];
      if (o === undefined) continue;
      const k = runs.findIndex((r) => r.x === o.x && r.w === o.w);
      if (k >= 0 && o.y + o.h === y) {
        o.h++;
        runs.splice(k, 1);
      } else {
        done.push({ x: o.x, y: o.y, w: o.w, h: o.h });
        open.splice(i, 1);
      }
    }
    for (const r of runs) open.push({ x: r.x, w: r.w, y, h: 1 });
  });
  for (const o of open) done.push({ x: o.x, y: o.y, w: o.w, h: o.h });
  return done;
}

// ---- TrueType assembly ----

class Writer {
  private bytes: number[] = [];
  get length(): number {
    return this.bytes.length;
  }
  u8(v: number): this {
    this.bytes.push(v & 255);
    return this;
  }
  u16(v: number): this {
    return this.u8(v >> 8).u8(v);
  }
  i16(v: number): this {
    return this.u16(v < 0 ? v + 65536 : v);
  }
  u32(v: number): this {
    return this.u16((v >>> 16) & 0xffff).u16(v & 0xffff);
  }
  tag(s: string): this {
    for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i));
    return this;
  }
  raw(b: readonly number[]): this {
    for (const v of b) this.u8(v);
    return this;
  }
  pad4(): this {
    while (this.bytes.length % 4 !== 0) this.u8(0);
    return this;
  }
  out(): number[] {
    return this.bytes;
  }
}

function checksum(b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < b.length; i += 4) {
    const v =
      ((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    sum = (sum + (v >>> 0)) >>> 0;
  }
  return sum;
}

interface GlyphOut {
  readonly data: number[];
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
  readonly points: number;
  readonly contours: number;
}

/** Simple TrueType glyph: clockwise rectangles, on-curve points, word coordinates. */
function encodeGlyph(rects: readonly Rect[]): GlyphOut {
  if (rects.length === 0)
    return { data: [], xMin: 0, yMin: 0, xMax: 0, yMax: 0, points: 0, contours: 0 };
  const pts: [number, number][] = [];
  for (const r of rects) {
    const x0 = r.x * PX;
    const x1 = (r.x + r.w) * PX;
    const yTop = (ASCENT_PX - r.y) * PX;
    const yBot = (ASCENT_PX - r.y - r.h) * PX;
    // Clockwise in y-up space: bottom-left, top-left, top-right, bottom-right.
    pts.push([x0, yBot], [x0, yTop], [x1, yTop], [x1, yBot]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const w = new Writer();
  w.i16(rects.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
  for (let i = 0; i < rects.length; i++) w.u16(i * 4 + 3);
  w.u16(0); // instructionLength
  for (let i = 0; i < pts.length; i++) w.u8(0x01); // on curve, word deltas
  let px = 0;
  for (const p of pts) {
    w.i16(p[0] - px);
    px = p[0];
  }
  let py = 0;
  for (const p of pts) {
    w.i16(p[1] - py);
    py = p[1];
  }
  return { data: w.out(), xMin, yMin, xMax, yMax, points: pts.length, contours: rects.length };
}

function nameTable(): number[] {
  const names: [number, string][] = [
    [1, PIXEL_FONT_FAMILY],
    [2, 'Regular'],
    [3, `${PIXEL_FONT_FAMILY} Regular`],
    [4, PIXEL_FONT_FAMILY],
    [5, 'Version 1.0'],
    [6, 'ShardfallPixel-Regular'],
  ];
  const strings = new Writer();
  const recs = new Writer();
  for (const [id, text] of names) {
    const start = strings.length;
    for (let i = 0; i < text.length; i++) strings.u16(text.charCodeAt(i));
    recs
      .u16(3)
      .u16(1)
      .u16(0x409)
      .u16(id)
      .u16(strings.length - start)
      .u16(start);
  }
  const w = new Writer();
  w.u16(0)
    .u16(names.length)
    .u16(6 + names.length * 12);
  return w.raw(recs.out()).raw(strings.out()).out();
}

/** Builds the TrueType file for the team pixel font. Deterministic; about 10 KB. */
export function buildPixelFontTtf(): Uint8Array {
  const chars: string[] = [];
  for (let c = FIRST; c <= LAST; c++) chars.push(String.fromCharCode(c));
  for (const c of EXTRA) chars.push(String.fromCharCode(c));
  // Glyph 0 .notdef: a hollow box.
  const notdef: Rect[] = [
    { x: 0, y: 0, w: 5, h: 1 },
    { x: 0, y: 6, w: 5, h: 1 },
    { x: 0, y: 1, w: 1, h: 5 },
    { x: 4, y: 1, w: 1, h: 5 },
  ];
  const glyphs = [encodeGlyph(notdef), ...chars.map((ch) => encodeGlyph(glyphRects(ch)))];
  const numGlyphs = glyphs.length;
  const adv = CELL_W * PX;
  const upem = CELL_H * PX;
  const ascent = ASCENT_PX * PX;
  const descent = DESCENT_PX * PX;

  const glyf = new Writer();
  const loca = new Writer();
  for (const g of glyphs) {
    loca.u32(glyf.length);
    glyf.raw(g.data).pad4();
  }
  loca.u32(glyf.length);

  const drawn = glyphs.filter((g) => g.contours > 0);
  const xMin = Math.min(...drawn.map((g) => g.xMin));
  const yMin = Math.min(...drawn.map((g) => g.yMin));
  const xMax = Math.max(...drawn.map((g) => g.xMax));
  const yMax = Math.max(...drawn.map((g) => g.yMax));
  const maxPoints = Math.max(...glyphs.map((g) => g.points));
  const maxContours = Math.max(...glyphs.map((g) => g.contours));

  const head = new Writer()
    .u32(0x00010000)
    .u32(0x00010000)
    .u32(0) // checkSumAdjustment, patched below
    .u32(0x5f0f3cf5)
    .u16(0x0003)
    .u16(upem)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .i16(xMin)
    .i16(yMin)
    .i16(xMax)
    .i16(yMax)
    .u16(0)
    .u16(8)
    .i16(2)
    .i16(1) // long loca
    .i16(0);

  const hhea = new Writer()
    .u32(0x00010000)
    .i16(ascent)
    .i16(-descent)
    .i16(0)
    .u16(adv)
    .i16(0)
    .i16(adv - xMax)
    .i16(xMax)
    .i16(1)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .u16(numGlyphs);

  const maxp = new Writer()
    .u32(0x00010000)
    .u16(numGlyphs)
    .u16(maxPoints)
    .u16(maxContours)
    .u16(0)
    .u16(0)
    .u16(2)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0)
    .u16(0);

  const os2 = new Writer()
    .u16(4)
    .i16(adv)
    .u16(400)
    .u16(5)
    .u16(0)
    .i16(3 * PX)
    .i16(3 * PX)
    .i16(0)
    .i16(PX)
    .i16(3 * PX)
    .i16(3 * PX)
    .i16(0)
    .i16(4 * PX)
    .i16(PX)
    .i16(3 * PX)
    .i16(0)
    .raw([2, 0, 6, 9, 0, 0, 0, 0, 0, 0]) // panose: monospaced
    .u32(1)
    .u32(0)
    .u32(0)
    .u32(0)
    .tag('SHRD')
    .u16(0x0040 | 0x0080) // REGULAR, USE_TYPO_METRICS
    .u16(FIRST)
    .u16(Math.max(LAST, ...EXTRA))
    .i16(ascent)
    .i16(-descent)
    .i16(0)
    .u16(ascent)
    .u16(descent)
    .u32(1)
    .u32(0)
    .i16(5 * PX)
    .i16(ascent)
    .u16(0)
    .u16(32)
    .u16(1);

  const hmtx = new Writer();
  for (let i = 0; i < numGlyphs; i++) hmtx.u16(adv).i16(glyphs[i]?.xMin ?? 0);

  // cmap format 4: segment FIRST..LAST -> glyphs 1.., one segment per EXTRA code (glyphs after
  // ASCII), plus the 0xFFFF terminator.
  const segs: { start: number; end: number; delta: number }[] = [
    { start: FIRST, end: LAST, delta: 1 - FIRST },
    ...EXTRA.map((c, i) => ({ start: c, end: c, delta: LAST - FIRST + 2 + i - c })),
    { start: 0xffff, end: 0xffff, delta: 1 },
  ];
  const segCount = segs.length;
  const searchRange = 2 * 2 ** Math.floor(Math.log2(segCount));
  const sub4 = new Writer()
    .u16(4)
    .u16(16 + 8 * segCount)
    .u16(0)
    .u16(segCount * 2)
    .u16(searchRange)
    .u16(Math.floor(Math.log2(segCount)))
    .u16(segCount * 2 - searchRange);
  for (const sg of segs) sub4.u16(sg.end);
  sub4.u16(0);
  for (const sg of segs) sub4.u16(sg.start);
  for (const sg of segs) sub4.i16(sg.delta);
  for (let i = 0; i < segCount; i++) sub4.u16(0);
  const cmap = new Writer().u16(0).u16(1).u16(3).u16(1).u32(12).raw(sub4.out());

  const post = new Writer()
    .u32(0x00030000)
    .u32(0)
    .i16(-PX)
    .i16(PX)
    .u32(1)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0);

  const tables: [string, number[]][] = [
    ['OS/2', os2.out()],
    ['cmap', cmap.out()],
    ['glyf', glyf.out()],
    ['head', head.out()],
    ['hhea', hhea.out()],
    ['hmtx', hmtx.out()],
    ['loca', loca.out()],
    ['maxp', maxp.out()],
    ['name', nameTable()],
    ['post', post.out()],
  ];
  const n = tables.length;
  let pow = 1;
  let log = 0;
  while (pow * 2 <= n) {
    pow *= 2;
    log++;
  }
  const font = new Writer()
    .u32(0x00010000)
    .u16(n)
    .u16(pow * 16)
    .u16(log)
    .u16(n * 16 - pow * 16);
  let offset = 12 + n * 16;
  const body = new Writer();
  let headOffset = 0;
  for (const [tag, data] of tables) {
    const padded = [...data];
    while (padded.length % 4 !== 0) padded.push(0);
    if (tag === 'head') headOffset = offset;
    font.tag(tag).u32(checksum(padded)).u32(offset).u32(data.length);
    body.raw(padded);
    offset += padded.length;
  }
  const all = [...font.out(), ...body.out()];
  const adjust = (0xb1b0afba - checksum(all)) >>> 0;
  all[headOffset + 8] = (adjust >>> 24) & 255;
  all[headOffset + 9] = (adjust >>> 16) & 255;
  all[headOffset + 10] = (adjust >>> 8) & 255;
  all[headOffset + 11] = adjust & 255;
  return new Uint8Array(all);
}

/**
 * Registers the pixel font with the document. Resolves true when the browser accepted it. The
 * caller toggles a CSS class so text switches only once the font is ready (no layout jump).
 */
export async function loadPixelFont(doc: Document): Promise<boolean> {
  const win = doc.defaultView;
  if (win === null || typeof win.FontFace !== 'function') return false;
  try {
    const bytes = buildPixelFontTtf();
    const face = new win.FontFace(PIXEL_FONT_FAMILY, bytes.buffer as ArrayBuffer, {
      style: 'normal',
      weight: '400',
      display: 'block',
    });
    await face.load();
    doc.fonts.add(face);
    return true;
  } catch {
    return false;
  }
}
