// Transient HUD elements (ui-spec S03 "Elemen sesaat"): arrival banners for Warden and boss, the
// "Pulse {n} Held" banner, a short "Pulse {n}" banner at Pulse start (CD M1 4 [S]), and the control
// hint in Pulse 1. Timed in sim ticks so a paused game freezes them and screenshots stay stable.

import { SimEventType, TICK_RATE } from '../../core/index.ts';

export const BannerKind = { None: 0, Pulse: 1, Warden: 2, Boss: 3, Held: 4 } as const;
export type BannerKind = (typeof BannerKind)[keyof typeof BannerKind];

/** Warden and boss arrival and the Held banner: 2.5 s (ui-spec S03). */
export const BANNER_TICKS = Math.round(TICK_RATE * 2.5);
/** Pulse start banner: short, in step with the opening light wave. */
export const PULSE_BANNER_TICKS = Math.round(TICK_RATE * 1.2);
/** Control hint fades after 6 s or once the player moved and used the Rite (ui-spec S03). */
export const HINT_TICKS = TICK_RATE * 6;
/** Rite slot shake after RiteRejected. */
export const RITE_DENIED_TICKS = Math.round(TICK_RATE * 0.25);
/** Distance in world u that counts as "moved" for the hint. */
export const HINT_MOVE_U = 1;

export interface Banner {
  kind: BannerKind;
  /** Sim tick when the banner hides. */
  untilTick: number;
  /** EnemyTypeIndex for Warden and boss banners, -1 otherwise. */
  typeIndex: number;
  /** 1-based Pulse number for Pulse and Held banners. */
  pulseNumber: number;
}

export function createBanner(): Banner {
  return { kind: BannerKind.None, untilTick: 0, typeIndex: -1, pulseNumber: 0 };
}

/**
 * Applies one sim event to the banner. A Warden or boss arrival replaces a Pulse banner; a Pulse
 * banner never hides an arrival that is still showing. Returns true when the banner changed.
 */
export function bannerEvent(
  b: Banner,
  type: number,
  a: number,
  tick: number,
  pulseNumber: number,
): boolean {
  if (type === SimEventType.WardenSpawned || type === SimEventType.BossSpawned) {
    b.kind = type === SimEventType.WardenSpawned ? BannerKind.Warden : BannerKind.Boss;
    b.untilTick = tick + BANNER_TICKS;
    b.typeIndex = a;
    b.pulseNumber = pulseNumber;
    return true;
  }
  if (type === SimEventType.PulseStarted) {
    const arrival = b.kind === BannerKind.Warden || b.kind === BannerKind.Boss;
    if (arrival && tick < b.untilTick) return false;
    b.kind = BannerKind.Pulse;
    b.untilTick = tick + PULSE_BANNER_TICKS;
    b.typeIndex = -1;
    b.pulseNumber = Math.floor(a) + 1;
    return true;
  }
  return false;
}

/** The Held banner starts when the timer slot turns into the held Warden bar. */
export function bannerHeld(b: Banner, tick: number, pulseNumber: number): void {
  b.kind = BannerKind.Held;
  b.untilTick = tick + BANNER_TICKS;
  b.typeIndex = -1;
  b.pulseNumber = pulseNumber;
}

/** Visible banner kind at this tick (None once it expired). */
export function bannerShown(b: Banner, tick: number): BannerKind {
  return tick < b.untilTick ? b.kind : BannerKind.None;
}

export interface HintState {
  active: boolean;
  startTick: number;
  startX: number;
  startY: number;
  moved: boolean;
  usedRite: boolean;
}

export function createHint(): HintState {
  return { active: false, startTick: 0, startX: 0, startY: 0, moved: false, usedRite: false };
}

/** Starts the hint at the start of the run's first Pulse. */
export function hintStart(s: HintState, tick: number, x: number, y: number): void {
  s.active = true;
  s.startTick = tick;
  s.startX = x;
  s.startY = y;
  s.moved = false;
  s.usedRite = false;
}

/** Advances the hint; returns whether it is still shown. riteCast: a RiteCast event this frame. */
export function hintStep(
  s: HintState,
  tick: number,
  x: number,
  y: number,
  riteCast: boolean,
): boolean {
  if (!s.active) return false;
  if (riteCast) s.usedRite = true;
  const dx = x - s.startX;
  const dy = y - s.startY;
  if (dx * dx + dy * dy >= HINT_MOVE_U * HINT_MOVE_U) s.moved = true;
  if (tick - s.startTick >= HINT_TICKS || (s.moved && s.usedRite)) s.active = false;
  return s.active;
}

/**
 * Key text for "{keys} Move": the four primary move labels joined when each is one character
 * ("WASD"), else separated by slashes ("Up/Left/Down/Right"). Empty labels are skipped.
 */
export function moveKeysText(labels: readonly string[]): string {
  const shown = labels.filter((l) => l !== '');
  return shown.every((l) => l.length === 1) ? shown.join('') : shown.join('/');
}
