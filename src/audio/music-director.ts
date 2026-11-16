// Adaptive music decisions from the read-only WorldView (audio-direction 6). Pure: no Web Audio,
// no clocks of its own (callers pass the audio time), so every rule is unit-tested in Node.

import { TICK_RATE } from '../core/index.ts';
import type { WorldView } from '../core/index.ts';
import { computeLevel } from './music/song.ts';
import type { BossLevels, CompiledSong } from './music/song.ts';

export const SONG_TITLE = 'mus.title';
export const SONG_PULSE = 'mus.biome1.pulse';
export const SONG_BOSS = 'mus.biome1.boss';
export const SONG_SHOP = 'mus.shop';
export const SONG_END = 'mus.end';
export const SONG_OVERLAY = 'mus.overlay.unlit';
export const RISER_CUE = 'mus.riser.pulse_end';

/**
 * Song that should play now. idle is the title screen (app state before run.start); the end
 * screens keep victory or defeat until the next run, so mus.end also plays there. pulseClear is
 * silent apart from stingers, and the boss song stops once the boss falls (its stinger takes over).
 */
export function songFor(view: WorldView, bossDefeated: boolean): string | null {
  switch (view.phase) {
    case 'idle':
      return SONG_TITLE;
    case 'pulse':
      if (!view.pulse.isBoss) return SONG_PULSE;
      return bossDefeated ? null : SONG_BOSS;
    case 'reward':
    case 'levelUp':
    case 'shop':
      return SONG_SHOP;
    case 'victory':
    case 'defeat':
      return SONG_END;
    default:
      return null;
  }
}

/** Seconds since the boss emerged, NaN before (the director tracks it on the audio clock). */
export interface BossClock {
  readonly sinceSpawnSec: number;
}

/** Boss song level from the boss bar in the WorldView (audio-direction 6.6). */
export function bossLevel(b: BossLevels, view: WorldView, clock: BossClock): number {
  const boss = view.pulse.boss;
  if (!boss.active) return b.intro;
  if (boss.enraged) return b.enraged;
  if (boss.phase >= 2) return b.phase2;
  const late =
    clock.sinceSpawnSec >= b.lateAfterSec || (boss.maxHp > 0 && boss.hp < boss.maxHp * b.lateBelowHpFrac);
  return late ? b.phase1Late : b.phase1;
}

/**
 * Intensity level for the current snapshot; songs without intensity rules stay at 0.
 * pressure comes from MusicPressureChanged (sim owns the Q21 threshold in config.csv) after the
 * hold of PressureLatch, so the director never counts Unlit itself.
 */
export function levelFor(song: CompiledSong, view: WorldView, pressure = false, clock?: BossClock): number {
  const rules = song.intensity;
  if (rules === null) return 0;
  const p = view.pulse;
  if (rules.boss !== null) return Math.min(rules.max, bossLevel(rules.boss, view, clock ?? { sinceSpawnSec: Number.NaN }));
  if (p.isBoss) return rules.max;
  const progress = p.ticksTotal > 0 ? 1 - p.ticksLeft / p.ticksTotal : 0;
  let level = computeLevel(rules, p.index + 1, progress, pressure, p.wardenAlive);
  // A hasted Warden (20 s of overtime) pushes to the top (audio-direction 6.4).
  if (p.wardenAlive && p.warden.enraged) level = Math.max(level, Math.min(rules.max, rules.wardenHastedLevel));
  return level;
}

/** Riser 6 s before the end of a timed Pulse, never while a Warden holds the timer (6.4). */
export function riserDue(view: WorldView, secondsBeforeEnd: number): boolean {
  const p = view.pulse;
  if (view.phase !== 'pulse' || p.isBoss || p.wardenAlive || p.overtime) return false;
  if (p.ticksTotal <= 0 || p.ticksLeft <= 0) return false;
  return p.ticksLeft / TICK_RATE <= secondsBeforeEnd;
}

/**
 * Crowd pressure with a minimum hold (audio-direction 6.3: "ditahan minimal 2 birama"): once
 * raised, the step stays for holdBars bars even if the sim releases it sooner.
 */
export interface PressureLatch {
  set(on: boolean, nowSec: number): void;
  active(nowSec: number, barSec: number, holdBars: number): boolean;
  reset(): void;
}

export function createPressureLatch(): PressureLatch {
  let on = false;
  let raisedAt = Number.NEGATIVE_INFINITY;
  return {
    set(v, now) {
      if (v && !on) raisedAt = now;
      on = v;
    },
    active(now, barSec, holdBars) {
      return on || now < raisedAt + holdBars * barSec;
    },
    reset() {
      on = false;
      raisedAt = Number.NEGATIVE_INFINITY;
    },
  };
}
