// Adaptive music decisions from the read-only WorldView (audio-direction 6). Pure.

import { TICK_RATE } from '../core/index.ts';
import type { RunPhase, WorldView } from '../core/index.ts';
import { computeLevel } from './music/song.ts';
import type { CompiledSong } from './music/song.ts';

export const SONG_PULSE = 'mus.biome1.pulse';
export const SONG_SHOP = 'mus.shop';
export const RISER_CUE = 'mus.riser.pulse_end';

/**
 * Song that should play in a phase. Boss Pulses reuse the Pulse loop until mus.biome1.boss
 * lands in M2. pulseClear, idle, and the end screens are silent apart from stingers.
 */
export function songForPhase(phase: RunPhase): string | null {
  switch (phase) {
    case 'pulse':
      return SONG_PULSE;
    case 'reward':
    case 'levelUp':
    case 'shop':
      return SONG_SHOP;
    default:
      return null;
  }
}

function enemiesAlive(view: WorldView): number {
  const e = view.enemies;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if ((e.alive[i] ?? 0) !== 0) n++;
  return n;
}

/** Intensity level for the current snapshot; songs without intensity rules stay at 0. */
export function levelFor(song: CompiledSong, view: WorldView): number {
  const rules = song.intensity;
  if (rules === null) return 0;
  const p = view.pulse;
  // TODO(AU, M2): boss levels from boss phase once mus.biome1.boss exists (audio-direction 6.6).
  if (p.isBoss) return rules.max;
  const progress = p.ticksTotal > 0 ? 1 - p.ticksLeft / p.ticksTotal : 0;
  return computeLevel(rules, p.index + 1, progress, enemiesAlive(view), p.wardenAlive);
}

/** Riser 6 s before the end of a timed Pulse, never while a Warden holds the timer (6.4). */
export function riserDue(view: WorldView, secondsBeforeEnd: number): boolean {
  const p = view.pulse;
  if (view.phase !== 'pulse' || p.isBoss || p.wardenAlive || p.overtime) return false;
  if (p.ticksTotal <= 0 || p.ticksLeft <= 0) return false;
  return p.ticksLeft / TICK_RATE <= secondsBeforeEnd;
}
