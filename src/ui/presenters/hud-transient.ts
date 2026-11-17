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
/** Level row flashes gold on PlayerLeveledUp (ui-spec S03, A-09 visual twin of the level cue). */
export const LEVEL_FLASH_TICKS = Math.round(TICK_RATE * 0.4);
/** HP bar flashes on PlayerDamaged (A-09 visual twin of the hurt cue, next to the VFX edge flash). */
export const HIT_FLASH_TICKS = Math.round(TICK_RATE * 0.3);
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

/**
 * Visible banner kind at this tick (None once it expired). A banner never lasts longer than
 * BANNER_TICKS, so one that ends further away belongs to a run whose clock was later than this
 * run's (run.start resets the tick to 0): it is stale and hidden (BUG-008).
 */
export function bannerShown(b: Banner, tick: number): BannerKind {
  return tick < b.untilTick && b.untilTick - tick <= BANNER_TICKS ? b.kind : BannerKind.None;
}

/** Last sim tick the HUD saw, to notice a new run (the run-relative clock goes back). */
export interface TransientClock {
  lastTick: number;
}

export function createTransientClock(): TransientClock {
  return { lastTick: -1 };
}

/** True once per new run: the tick went back since the last frame (BUG-008). */
export function runRestarted(c: TransientClock, tick: number): boolean {
  const restarted = c.lastTick >= 0 && tick < c.lastTick;
  c.lastTick = tick;
  return restarted;
}

/** Clears a banner (new run). */
export function bannerClear(b: Banner): void {
  b.kind = BannerKind.None;
  b.untilTick = 0;
  b.typeIndex = -1;
  b.pulseNumber = 0;
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

// ---- Weapon strip (redesign 1.1 3.2) ----
// One icon per owned weapon slot. Each fire event pulses its icon; a weapon that has not fired
// for a second dims (it needs an enemy in range); a slot that changed in the shop glows "New" at
// the next wave start. Everything is timed in sim ticks (deterministic, frozen while paused) and
// kept in preallocated typed arrays, so the per-frame path never allocates.

/** Icon pulse on WeaponFired: scale 1 to 1.15 to 1 in 120 ms; also the reduce-effects flash. */
export const WEAPON_PULSE_TICKS = Math.max(1, Math.round(TICK_RATE * 0.12));
/** No shot for this long: the icon dims. Longer than the slowest base cooldown (echo_bell 2.0 s)
 *  so a weapon that is firing normally never dims between its own shots, only with no target. */
export const WEAPON_IDLE_TICKS = Math.round(TICK_RATE * 2.5);
/** "New" glow on a slot bought since the previous wave start. */
export const WEAPON_NEW_TICKS = TICK_RATE * 2;
/** Upper bound for weapon slots the strip tracks (the sim has 6). */
export const WEAPON_STRIP_CAPACITY = 12;

/** The part of InventorySlotView the strip reads. */
export interface StripSlotSource {
  readonly weaponIndex: number;
  readonly tier: number;
}

export interface WeaponStrip {
  /** Inventory slots mirrored (the inventory length, at most the capacity). */
  slots: number;
  /** WeaponIndex per slot, -1 empty. */
  readonly weaponIndex: Int32Array;
  readonly tier: Int32Array;
  /** 1 for contact weapons (orbit shards): they have no fire event, their own hits count instead. */
  readonly contact: Uint8Array;
  /** Tick of the last shot (or of the wave start / the weapon's arrival). */
  readonly lastFired: Float64Array;
  /** Tick when the running pulse started, -Infinity when none yet. */
  readonly pulseTick: Float64Array;
  /** Counts pulses started; the DOM restarts the animation when it changes. */
  readonly pulseSeq: Uint32Array;
  /** Tick when the "New" glow ends. */
  readonly newUntil: Float64Array;
  /** Slot contents at the previous wave start. */
  readonly startWeapon: Int32Array;
  readonly startTier: Int32Array;
  /** False until the run's first wave start was seen (wave 1 shows nothing new). */
  hasStart: boolean;
}

export function createWeaponStrip(capacity = WEAPON_STRIP_CAPACITY): WeaponStrip {
  const s: WeaponStrip = {
    slots: 0,
    weaponIndex: new Int32Array(capacity),
    tier: new Int32Array(capacity),
    contact: new Uint8Array(capacity),
    lastFired: new Float64Array(capacity),
    pulseTick: new Float64Array(capacity),
    pulseSeq: new Uint32Array(capacity),
    newUntil: new Float64Array(capacity),
    startWeapon: new Int32Array(capacity),
    startTier: new Int32Array(capacity),
    hasStart: false,
  };
  stripReset(s);
  return s;
}

/** Forgets everything timed by the previous run (BUG-008 rule) and the wave-start snapshot. */
export function stripReset(s: WeaponStrip): void {
  s.slots = 0;
  s.weaponIndex.fill(-1);
  s.tier.fill(0);
  s.contact.fill(0);
  s.lastFired.fill(0);
  s.pulseTick.fill(-Infinity);
  s.pulseSeq.fill(0);
  s.newUntil.fill(0);
  s.startWeapon.fill(-1);
  s.startTier.fill(0);
  s.hasStart = false;
}

/**
 * Mirrors the inventory (call when the shop view revision changes). A slot whose weapon changed
 * starts awake at `tick` with no pulse running. isContact tells contact weapons apart.
 */
export function stripSync(
  s: WeaponStrip,
  inventory: readonly StripSlotSource[],
  isContact: (weaponIndex: number) => boolean,
  tick: number,
): void {
  const n = Math.min(inventory.length, s.weaponIndex.length);
  for (let i = 0; i < s.weaponIndex.length; i++) {
    const src = i < n ? inventory[i] : undefined;
    const wi = src !== undefined && src.weaponIndex >= 0 ? src.weaponIndex : -1;
    if (wi !== s.weaponIndex[i]) {
      s.weaponIndex[i] = wi;
      s.contact[i] = wi >= 0 && isContact(wi) ? 1 : 0;
      s.lastFired[i] = tick;
      s.pulseTick[i] = -Infinity;
    }
    s.tier[i] = wi >= 0 ? (src?.tier ?? 0) : 0;
  }
  s.slots = n;
}

function startPulse(s: WeaponStrip, slot: number, tick: number): boolean {
  s.lastFired[slot] = tick;
  const since = tick - (s.pulseTick[slot] ?? -Infinity);
  if (since >= 0 && since < WEAPON_PULSE_TICKS) return false;
  s.pulseTick[slot] = tick;
  s.pulseSeq[slot] = (s.pulseSeq[slot] ?? 0) + 1;
  return true;
}

/**
 * A WeaponFired event for `slot` (event field c). Keeps the weapon awake; returns true when a new
 * pulse starts (a shot inside a running pulse does not restart it). Unknown slots are ignored.
 */
export function stripFired(s: WeaponStrip, slot: number, tick: number): boolean {
  if (!(slot >= 0 && slot < s.slots) || (s.weaponIndex[slot] ?? -1) < 0) return false;
  return startPulse(s, slot | 0, tick);
}

/** A hit from WeaponIndex `weaponIndex`: wakes and pulses the contact slots holding it. */
export function stripHit(s: WeaponStrip, weaponIndex: number, tick: number): void {
  for (let i = 0; i < s.slots; i++) {
    if (s.contact[i] === 1 && s.weaponIndex[i] === weaponIndex) startPulse(s, i, tick);
  }
}

/**
 * Wave start (after stripSync with this wave's inventory): every weapon starts awake, slots that
 * hold a different weapon or a higher tier than at the previous wave start glow "New" (bought or
 * combined in the shop). The run's first wave marks nothing. Returns the number of new slots.
 */
export function stripWaveStart(s: WeaponStrip, tick: number): number {
  let fresh = 0;
  for (let i = 0; i < s.weaponIndex.length; i++) {
    const wi = s.weaponIndex[i] ?? -1;
    const tier = s.tier[i] ?? 0;
    const changed =
      wi >= 0 && (wi !== s.startWeapon[i] || tier > (s.startTier[i] ?? 0)) && i < s.slots;
    if (s.hasStart && changed) {
      s.newUntil[i] = tick + WEAPON_NEW_TICKS;
      fresh++;
    } else s.newUntil[i] = 0;
    s.lastFired[i] = tick;
    s.startWeapon[i] = wi;
    s.startTier[i] = tier;
  }
  s.hasStart = true;
  return fresh;
}

/** True once the weapon has not fired for WEAPON_IDLE_TICKS (no enemy in range). */
export function stripIdle(s: WeaponStrip, slot: number, tick: number): boolean {
  return tick - (s.lastFired[slot] ?? tick) >= WEAPON_IDLE_TICKS;
}

/** True while a pulse runs (drives the reduce-effects brightness flash). */
export function stripLit(s: WeaponStrip, slot: number, tick: number): boolean {
  const since = tick - (s.pulseTick[slot] ?? -Infinity);
  return since >= 0 && since < WEAPON_PULSE_TICKS;
}

/** True while the slot's "New" glow shows (never longer than WEAPON_NEW_TICKS: stale runs hide). */
export function stripNew(s: WeaponStrip, slot: number, tick: number): boolean {
  const until = s.newUntil[slot] ?? 0;
  return tick < until && until - tick <= WEAPON_NEW_TICKS;
}
