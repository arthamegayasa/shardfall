// HUD model (ui-spec S03, style guide 2.2). Filled every frame into a preallocated object with no
// allocation; the HUD screen formats strings only for fields that changed.

import type { GameData } from '../../content/index.ts';
import type { WorldView } from '../../core/index.ts';
import { ceilSeconds, frac01 } from '../format.ts';

export const TimerMode = { Timer: 0, Boss: 1, Held: 2 } as const;
export type TimerMode = (typeof TimerMode)[keyof typeof TimerMode];

/** Last seconds highlighted in kept-gold (ui-spec S03). Presentation constant, not balance. */
export const FINAL_COUNTDOWN_SECS = 5;

export interface HudModel {
  hp: number;
  maxHp: number;
  hpFrac: number;
  lowHp: boolean;
  level: number;
  xpFrac: number;
  /** 1-based Pulse number. */
  pulseNumber: number;
  /** Waves in this run profile ("Wave 3 of 15"); 0 when the view does not know it. */
  pulseCount: number;
  timerMode: TimerMode;
  timerSecs: number;
  finalCountdown: boolean;
  /** EnemyTypeIndex of the boss or Warden shown in the timer slot, -1 in timer mode. */
  foeTypeIndex: number;
  foeFrac: number;
  foePhase: number;
  foeEnraged: boolean;
  /** Boss Pulse before the boss emerges: name with an empty bar that fills on entry (CD M1 4). */
  foePending: boolean;
  glint: number;
  riteIndex: number;
  riteReady: boolean;
  riteSecs: number;
  /** Cooldown left as 0..1 (1 = just cast). Drives the fill from the bottom. */
  riteFrac: number;
  /** Charges shown when the Rite holds more than one (0 hides the badge). */
  riteCharges: number;
}

export function createHudModel(): HudModel {
  return {
    hp: 0,
    maxHp: 0,
    hpFrac: 0,
    lowHp: false,
    level: 0,
    xpFrac: 0,
    pulseNumber: 0,
    pulseCount: 0,
    timerMode: TimerMode.Timer,
    timerSecs: 0,
    finalCountdown: false,
    foeTypeIndex: -1,
    foeFrac: 0,
    foePhase: 0,
    foeEnraged: false,
    foePending: false,
    glint: 0,
    riteIndex: -1,
    riteReady: false,
    riteSecs: 0,
    riteFrac: 0,
    riteCharges: 0,
  };
}

/**
 * EnemyTypeIndex of the boss expected in this Pulse before it spawns (the run profile is not in the
 * view, so any profile slot with this index and a boss id answers; slice runs share one boss).
 * Falls back to the first enemy with role boss, -1 when none.
 */
export function pendingBossType(data: GameData, pulseIndex: number): number {
  for (const slots of Object.values(data.profiles)) {
    const id = slots[pulseIndex]?.bossId ?? null;
    if (id !== null) {
      const i = data.enemies.findIndex((e) => e.id === id);
      if (i >= 0) return i;
    }
  }
  return data.enemies.findIndex((e) => e.role === 'boss');
}

/**
 * lowHp comes from PlayerHpLowChanged events (the sim owns the threshold), so the UI never
 * duplicates that rule. pendingBoss: pendingBossType for this Pulse, shown before the boss spawns.
 */
export function fillHudModel(
  view: WorldView,
  lowHp: boolean,
  out: HudModel,
  pendingBoss = -1,
): void {
  const p = view.player;
  const pulse = view.pulse;
  out.hp = p.hp;
  out.maxHp = p.maxHp;
  out.hpFrac = frac01(p.hp, p.maxHp);
  out.lowHp = lowHp && p.hp > 0;
  out.level = p.level;
  out.xpFrac = frac01(p.xp, p.xpToNext);
  out.pulseNumber = pulse.index + 1;
  out.pulseCount = pulse.count > 0 ? pulse.count : 0;
  out.glint = p.glint;

  out.foePending = false;
  if (pulse.isBoss && pulse.boss.active) {
    out.timerMode = TimerMode.Boss;
    out.foeTypeIndex = pulse.boss.typeIndex;
    out.foeFrac = frac01(pulse.boss.hp, pulse.boss.maxHp);
    out.foePhase = pulse.boss.phase;
    out.foeEnraged = pulse.boss.enraged;
  } else if (pulse.isBoss) {
    // Untimed boss Pulse before the boss emerges: never "0:00" (review M1 LP and CD).
    out.timerMode = TimerMode.Boss;
    out.foeTypeIndex = pulse.boss.typeIndex >= 0 ? pulse.boss.typeIndex : pendingBoss;
    out.foeFrac = 0;
    out.foePhase = 0;
    out.foeEnraged = false;
    out.foePending = true;
  } else if (pulse.overtime && pulse.wardenAlive && pulse.warden.active) {
    out.timerMode = TimerMode.Held;
    out.foeTypeIndex = pulse.warden.typeIndex;
    out.foeFrac = frac01(pulse.warden.hp, pulse.warden.maxHp);
    out.foePhase = pulse.warden.phase;
    out.foeEnraged = pulse.warden.enraged;
  } else {
    out.timerMode = TimerMode.Timer;
    out.foeTypeIndex = -1;
    out.foeFrac = 0;
    out.foePhase = 0;
    out.foeEnraged = false;
  }
  out.timerSecs = ceilSeconds(pulse.ticksLeft);
  out.finalCountdown =
    out.timerMode === TimerMode.Timer && out.timerSecs > 0 && out.timerSecs <= FINAL_COUNTDOWN_SECS;

  out.riteIndex = p.riteIndex;
  // Multi-charge Rites are ready while a charge is left; single-charge ones when the cooldown ends.
  out.riteReady = p.riteChargesMax > 1 ? p.riteCharges > 0 : p.riteCooldownTicks <= 0;
  out.riteSecs = out.riteReady ? 0 : ceilSeconds(p.riteCooldownTicks);
  out.riteFrac = out.riteReady ? 0 : frac01(p.riteCooldownTicks, p.riteCooldownMaxTicks);
  out.riteCharges = p.riteChargesMax > 1 ? p.riteCharges : 0;
}
