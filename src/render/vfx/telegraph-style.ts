// Ground area styles from palette tokens (AD; art-direction 8.1, 8.2). Colours resolve once at creation.
// Danger (L4): danger-red fill 30% growing with the telegraph, solid 1 px edge. Spawn ring: danger-violet.
// Player zones (L3, CD M1 review K5): Rite zones kept-gold fill 25% with a solid 1 px kept-cyan edge
// (never dashed: dashes belong to telegraphs); trails such as Smolder Boots 15% fill, no edge.
// Decals (L1): ink blob shadow under every actor, kept-cyan foot ring for the player, Warden aura in
// danger-violet (ring 70% plus fill 14%).
//
// M5 (LP, BUG-016): createAreaStyles takes a hazard flag (every colour vision mode, pipeline/cvd-palette.ts):
// telegraph, boss, and spawn styles then draw the hazard pattern (striped edge and fill, shaders/area.ts).
// Player zones and decals never do, so the stripes alone mark danger when hue cannot.
//
// M4 (AD, M4-01, CD M3 polish 3): player zone fills are set by their EFFECTIVE fill on the floor, not by
// shader alpha. The scene blends in linear light and is shown in sRGB, so shader alpha 0.25 read as 36 to
// 39% over the floor (CD M3 measured 37%). effectiveFillAlpha() solves the shader alpha that gives the
// nominal effective fill (Rite zone 20%, trail 12%) on both floor tokens; stacked zones are merged by
// the zone batch (area-batch merge) so they never grow denser.

import { Color } from 'three';
import { TelegraphKind, tokenRgb } from '../../core/index.ts';
import type { PaletteDef } from '../../core/index.ts';
import type { AreaStyle } from './area-batch.ts';

export interface AreaStyles {
  readonly danger: AreaStyle;
  readonly bossDanger: AreaStyle;
  readonly spawn: AreaStyle;
  /** Rite fire zone (kept-gold, 20% effective on the floor, kept-cyan solid edge). */
  readonly riteZone: AreaStyle;
  /** Repeating trail zones (kept-gold, 12% effective, no edge). */
  readonly trailZone: AreaStyle;
  /** M1 name of the Rite zone style. */
  readonly playerZone: AreaStyle;
  readonly shadow: AreaStyle;
  readonly footRing: AreaStyle;
  readonly wardenAura: AreaStyle;
}

/** Max effective fill of a player zone over the floor (CD K5, style-guide 1.8), measured on screen. */
export const PLAYER_ZONE_MAX_FILL = 0.25;
/** Nominal effective fill of a Rite zone (style-guide 1.3, 1.8). */
export const PLAYER_ZONE_NOMINAL_FILL = 0.2;
/** Effective fill of repeating trails (style-guide 1.8: max 15%). */
export const TRAIL_ZONE_FILL = 0.12;
/** Floor tokens a zone is solved against (style-guide 1.2). */
const FLOOR_TOKENS = ['floor-mid', 'floor-lit'] as const;
/** Blob shadow opacity (style-guide 1.5: soft ink ellipse). */
export const SHADOW_ALPHA = 0.32;

/** Linear rgb of a palette token, core or biome (three converts sRGB hex to linear). */
export function linearRgb(palette: PaletteDef, token: string): [number, number, number] {
  let hex = palette.core[token];
  if (hex === undefined) {
    try {
      const [r, g, b] = tokenRgb(palette, token);
      hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    } catch {
      hex = '#ff00ff';
    }
  }
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(l: number): number {
  const v = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
  return v * 255;
}

/** Rec. 601 luma of an sRGB triple (0..255), the grayscale the reviews measure. */
function luma(c: readonly [number, number, number]): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

/**
 * Effective fill seen on screen when `fill` is alpha-blended in linear light over `floor` (both sRGB
 * 0..255) with shader alpha a: the share of the luma step from floor to fill, 0..1.
 */
export function effectiveFill(
  floor: readonly [number, number, number],
  fill: readonly [number, number, number],
  a: number,
): number {
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const f = floor[k] ?? 0;
    const g = fill[k] ?? 0;
    out[k] = linearToSrgb((1 - a) * srgbToLinear(f) + a * srgbToLinear(g));
  }
  const d = luma(fill) - luma(floor);
  return d === 0 ? 0 : (luma(out) - luma(floor)) / d;
}

/** Shader alpha (0..1) giving `target` effective fill over `floor` (bisection, monotonic in a). */
export function alphaForEffectiveFill(
  floor: readonly [number, number, number],
  fill: readonly [number, number, number],
  target: number,
): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (effectiveFill(floor, fill, mid) < target) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Shader alpha for a zone fill token so no floor token sees more than `target` effective fill. */
export function zoneFillAlpha(palette: PaletteDef, fillToken: string, target: number): number {
  const fill = tokenRgb(palette, fillToken);
  let a = 1;
  for (const t of FLOOR_TOKENS)
    a = Math.min(a, alphaForEffectiveFill(tokenRgb(palette, t), fill, target));
  return a;
}

function style(
  palette: PaletteDef,
  fillToken: string,
  fillAlpha: number,
  edgeToken: string,
  edgeAlpha: number,
  dashed: boolean,
  hazard = false,
): AreaStyle {
  return {
    fill: [...linearRgb(palette, fillToken), fillAlpha],
    edge: [...linearRgb(palette, edgeToken), edgeAlpha],
    dashed,
    hazard,
  };
}

export interface AreaStyleOptions {
  /** Hazard pattern on danger areas (colour vision modes, BUG-016). */
  readonly hazard?: boolean;
}

export function createAreaStyles(palette: PaletteDef, opts: AreaStyleOptions = {}): AreaStyles {
  const hz = opts.hazard === true;
  const riteFill = zoneFillAlpha(palette, 'kept-gold', PLAYER_ZONE_NOMINAL_FILL);
  const trailFill = zoneFillAlpha(palette, 'kept-gold', TRAIL_ZONE_FILL);
  const riteZone = style(palette, 'kept-gold', riteFill, 'kept-cyan', 1, false);
  return {
    danger: style(palette, 'danger-red', 0.3, 'danger-red', 1, false, hz),
    bossDanger: style(palette, 'danger-magenta', 0.3, 'danger-magenta', 1, false, hz),
    spawn: style(palette, 'danger-violet', 0.14, 'danger-violet', 1, false, hz),
    riteZone,
    trailZone: style(palette, 'kept-gold', trailFill, 'kept-gold', 0, false),
    playerZone: riteZone,
    shadow: style(palette, 'ink', SHADOW_ALPHA, 'ink', 0, false),
    footRing: style(palette, 'kept-cyan', 0, 'kept-cyan', 0.85, false),
    wardenAura: style(palette, 'danger-violet', 0.14, 'danger-violet', 0.7, false),
  };
}

/** Style for a danger area by TelegraphKind (boss patterns read magenta, everything else red). */
export function dangerStyleFor(styles: AreaStyles, kind: number): AreaStyle {
  return kind === TelegraphKind.BossArea ? styles.bossDanger : styles.danger;
}
