// Pure damage number layout (AD; style-guide 1.8, ui-spec K9). Drawn by render from EnemyDamaged, never DOM.

/** Horizontal advance per glyph in px: 3 px glyph plus a shared 1 px ink outline (fx-digits). */
export const DIGIT_ADVANCE_PX = 4;
/** Largest number shown; bigger hits clamp so a number never exceeds MAX_DIGITS glyphs. */
export const MAX_DIGITS = 5;
const MAX_VALUE = 99999;

/** Lifetime and motion (art-direction 8.2): rise 10 px with ease-out, fade over the last 30%. */
export const DAMAGE_NUMBER_LIFE_SEC = 0.65;
export const DAMAGE_NUMBER_RISE_PX = 10;
const FADE_FROM = 0.7;

/**
 * Write the decimal digits of a damage value (most significant first) into out, return the count.
 * Values round to the nearest integer; anything above 0 shows at least "1"; 0 or less shows nothing.
 */
export function digitsOf(value: number, out: Uint8Array): number {
  if (!(value > 0)) return 0;
  let v = Math.min(MAX_VALUE, Math.max(1, Math.round(value)));
  let n = 0;
  while (v > 0 && n < MAX_DIGITS) {
    out[n++] = v % 10;
    v = Math.floor(v / 10);
  }
  for (let i = 0; i < n >> 1; i++) {
    const t = out[i] ?? 0;
    out[i] = out[n - 1 - i] ?? 0;
    out[n - 1 - i] = t;
  }
  return n;
}

/** Integer x offset (px) of glyph i in a number of count glyphs, centred on the hit point. */
export function digitOffsetX(i: number, count: number): number {
  return i * DIGIT_ADVANCE_PX - Math.floor(((count - 1) * DIGIT_ADVANCE_PX) / 2);
}

/** Whole-pixel rise above the hit point for an age in seconds. */
export function damageRisePx(ageSec: number): number {
  const t = Math.min(1, Math.max(0, ageSec / DAMAGE_NUMBER_LIFE_SEC));
  const e = 1 - (1 - t) * (1 - t);
  return Math.round(e * DAMAGE_NUMBER_RISE_PX);
}

/** Opacity for an age in seconds: 1 until FADE_FROM of the life, then linear to 0. */
export function damageAlpha(ageSec: number): number {
  const t = ageSec / DAMAGE_NUMBER_LIFE_SEC;
  if (t <= FADE_FROM) return 1;
  if (t >= 1) return 0;
  return 1 - (t - FADE_FROM) / (1 - FADE_FROM);
}
