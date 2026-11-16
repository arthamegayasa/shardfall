// Ground area styles from palette tokens (AD; art-direction 8.1, 8.2). Colours resolve once at creation.
// Danger (L4): danger-red fill 30% growing with the telegraph, solid 1 px edge. Spawn ring: danger-violet edge.
// Player zones (L3): kept-gold fill at most 25%, dashed kept-white edge (style-guide 1.3, CD review 2.2).

import { Color } from 'three';
import { TelegraphKind } from '../../core/index.ts';
import type { PaletteDef } from '../../core/index.ts';
import type { AreaStyle } from './area-batch.ts';

export interface AreaStyles {
  readonly danger: AreaStyle;
  readonly bossDanger: AreaStyle;
  readonly spawn: AreaStyle;
  readonly playerZone: AreaStyle;
}

/** Linear rgb of a palette token (three converts sRGB hex to the linear working space). */
export function linearRgb(palette: PaletteDef, token: string): [number, number, number] {
  const c = new Color(palette.core[token] ?? '#ff00ff');
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
  return {
    danger: style(palette, 'danger-red', 0.3, 'danger-red', 1, false),
    bossDanger: style(palette, 'danger-magenta', 0.3, 'danger-magenta', 1, false),
    spawn: style(palette, 'danger-violet', 0.14, 'danger-violet', 1, false),
    playerZone: style(palette, 'kept-gold', 0.25, 'kept-white', 0.9, true),
  };
}

/** Style for a danger area by TelegraphKind (boss patterns read magenta, everything else red). */
export function dangerStyleFor(styles: AreaStyles, kind: number): AreaStyle {
  return kind === TelegraphKind.BossArea ? styles.bossDanger : styles.danger;
}
