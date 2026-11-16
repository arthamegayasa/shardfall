// Pure number and time formatting for UI (ui-spec 12.3). No player words here: words come from t().

import { TICK_RATE } from '../core/index.ts';

/** Whole seconds left, rounded up so "0:01" shows until the last tick. Never negative. */
export function ceilSeconds(ticks: number): number {
  return ticks <= 0 ? 0 : Math.ceil(ticks / TICK_RATE);
}

/** Elapsed whole seconds, rounded down (run time). */
export function floorSeconds(ticks: number): number {
  return ticks <= 0 ? 0 : Math.floor(ticks / TICK_RATE);
}

/** "m:ss" with tabular digits, minutes unbounded ("75:03"). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** Integer display for Glint, HP, kills. HP can be fractional in the sim; show it rounded up. */
export function formatInt(v: number): string {
  return String(Math.max(0, Math.ceil(v - 1e-9)));
}

/** Stat or card value with at most two decimals and no trailing zeros ("4", "1.5", "0.25"). */
export function formatStatValue(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

/** Clamp to 0..1, NaN becomes 0. */
export function frac01(num: number, den: number): number {
  if (!(den > 0)) return 0;
  const f = num / den;
  return f > 1 ? 1 : f > 0 ? f : 0;
}

/** Short label for a KeyboardEvent.code, for key hints ("KeyR" -> "R", "Digit1" -> "1"). */
export function keyLabel(code: string | null): string {
  if (code === null) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  if (code === 'Escape') return 'Esc';
  return code;
}
