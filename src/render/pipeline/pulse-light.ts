// "Light is the clock" (vision 4.2, art-direction 6, CD M2 brief 1.3). LP. Pure timing for the
// Pulse open wave and the Pulse close glass flash, read by the environment shader each frame:
// - open: a ring of glass light grows from pulseOrigin to the arena edge in 0.6 s at 35% then fades,
//   and the floor brightens 10%, settling back within 1 s;
// - close: the glass rim flashes bone for 0.25 s (once, under 25% of the screen, A-02).

/** Open wave travel time to the arena edge (s). */
export const PULSE_WAVE_SEC = 0.6;
/** Open wave peak opacity. */
export const PULSE_WAVE_ALPHA = 0.35;
/** Floor brightness lift at the start of a Pulse, fading over PULSE_LIFT_SEC. */
export const PULSE_LIFT = 0.1;
export const PULSE_LIFT_SEC = 1;
/** Close flash length (s). */
export const PULSE_FLASH_SEC = 0.25;

export interface PulseLightState {
  openAt: number;
  closeAt: number;
}

export interface PulseLightSample {
  /** Wave front radius as a fraction of the distance to the arena edge (0..1), < 0 when inactive. */
  waveRadius: number;
  /** Wave opacity 0..1 (already scaled by PULSE_WAVE_ALPHA). */
  waveAlpha: number;
  /** Extra floor brightness, 0..PULSE_LIFT. */
  floorLift: number;
  /** Rim flash strength 0..1. */
  rimFlash: number;
}

export function createPulseLight(): PulseLightState {
  return { openAt: Number.NEGATIVE_INFINITY, closeAt: Number.NEGATIVE_INFINITY };
}

export function pulseOpened(s: PulseLightState, timeSec: number): void {
  s.openAt = timeSec;
}

export function pulseClosed(s: PulseLightState, timeSec: number): void {
  s.closeAt = timeSec;
}

/**
 * Sample the effects at timeSec. flashScale (QualityProfile) softens them under reduce effects.
 * A clock earlier than a stored start (new run) reads as inactive.
 */
export function samplePulseLight(
  s: PulseLightState,
  timeSec: number,
  flashScale: number,
  out: PulseLightSample,
): PulseLightSample {
  const sinceOpen = timeSec - s.openAt;
  if (sinceOpen >= 0 && sinceOpen < PULSE_LIFT_SEC) {
    const r = sinceOpen / PULSE_WAVE_SEC;
    out.waveRadius = r <= 1 ? r : -1;
    // Full strength while travelling, quick fade at the edge.
    out.waveAlpha = r <= 1 ? PULSE_WAVE_ALPHA * (1 - r * r * 0.5) * flashScale : 0;
    out.floorLift = PULSE_LIFT * (1 - sinceOpen / PULSE_LIFT_SEC) * flashScale;
  } else {
    out.waveRadius = -1;
    out.waveAlpha = 0;
    out.floorLift = 0;
  }
  const sinceClose = timeSec - s.closeAt;
  out.rimFlash =
    sinceClose >= 0 && sinceClose < PULSE_FLASH_SEC
      ? (1 - sinceClose / PULSE_FLASH_SEC) * flashScale
      : 0;
  return out;
}
