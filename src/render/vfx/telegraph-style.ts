// Ground area styles from palette tokens (AD; art-direction 8.1, 8.2). Colours resolve once at creation.
// Danger (L4): danger-red fill 30% growing with the telegraph, solid 1 px edge. Spawn ring: danger-violet.
// Player zones (L3, CD M1 review K5): Rite zones kept-gold fill 25% with a solid 1 px kept-cyan edge
// (never dashed: dashes belong to telegraphs); trails such as Smolder Boots 15% fill, no edge.
// Decals (L1): ink blob shadow under every actor, kept-cyan foot ring for the player, Warden aura in
// danger-violet (ring 70% plus fill 14%).

import { Color } from 'three';
import { TelegraphKind, tokenRgb } from '../../core/index.ts';
import type { PaletteDef } from '../../core/index.ts';
import type { AreaStyle } from './area-batch.ts';

export interface AreaStyles {
  readonly danger: AreaStyle;
  readonly bossDanger: AreaStyle;
  readonly spawn: AreaStyle;
  /** Rite fire zone (kept-gold 25%, kept-cyan solid edge). */
  readonly riteZone: AreaStyle;
  /** Repeating trail zones (kept-gold 15%, no edge). */
  readonly trailZone: AreaStyle;
  /** M1 name of the Rite zone style. */
  readonly playerZone: AreaStyle;
  readonly shadow: AreaStyle;
  readonly footRing: AreaStyle;
  readonly wardenAura: AreaStyle;
}

/** Max effective fill of a player zone over the floor (CD K5). */
export const PLAYER_ZONE_MAX_FILL = 0.25;
export const TRAIL_ZONE_FILL = 0.15;
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

function style(
  palette: PaletteDef,
  fillToken: string,
  fillAlpha: number,
  edgeToken: string,
  edgeAlpha: number,
  dashed: boolean,
): AreaStyle {
  return {
    fill: [...linearRgb(palette, fillToken), fillAlpha],
    edge: [...linearRgb(palette, edgeToken), edgeAlpha],
    dashed,
  };
}

export function createAreaStyles(palette: PaletteDef): AreaStyles {
  const riteZone = style(palette, 'kept-gold', PLAYER_ZONE_MAX_FILL, 'kept-cyan', 1, false);
  return {
    danger: style(palette, 'danger-red', 0.3, 'danger-red', 1, false),
    bossDanger: style(palette, 'danger-magenta', 0.3, 'danger-magenta', 1, false),
    spawn: style(palette, 'danger-violet', 0.14, 'danger-violet', 1, false),
    riteZone,
    trailZone: style(palette, 'kept-gold', TRAIL_ZONE_FILL, 'kept-gold', 0, false),
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
