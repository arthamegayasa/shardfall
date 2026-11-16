// UI scale (ui-spec 7.1, architecture 7.3): integer scale in PHYSICAL pixels over a 640 x 360
// design canvas, converted back to CSS px so one UI unit stays a whole number of device pixels
// at devicePixelRatio 1.25 and 1.5.

/** Design canvas of the menu safe area, in UI units. */
export const UI_CANVAS_W = 640;
export const UI_CANVAS_H = 360;
/** Smallest UI scale (720p). Below 1280 x 720 the layout may clip; ui-spec 7.1. */
export const UI_MIN_SCALE = 2;

export interface UiScale {
  /** Physical pixels per UI unit (integer). */
  readonly uiScale: number;
  /** CSS px per UI unit: uiScale / dpr. */
  readonly unitCss: number;
  /** Physical pixels per font pixel for body text (integer), includes text size setting. */
  readonly fontScale: number;
  /** CSS px per font pixel. */
  readonly fontCss: number;
  /** True when the viewport is smaller than the safe area at the minimum scale. */
  readonly tooSmall: boolean;
}

/**
 * cssW, cssH: viewport in CSS px. dpr: devicePixelRatio. textScale: 0 Normal, 1 Large, 2 Largest
 * (ui-spec 7.3, each step adds one integer font scale).
 */
export function computeUiScale(
  cssW: number,
  cssH: number,
  dpr: number,
  textScale: number,
): UiScale {
  const ratio = dpr > 0 ? dpr : 1;
  const wp = cssW * ratio;
  const hp = cssH * ratio;
  const fit = Math.floor(Math.min(wp / UI_CANVAS_W, hp / UI_CANVAS_H));
  const uiScale = Math.max(UI_MIN_SCALE, fit);
  const fontScale = uiScale + Math.max(0, Math.floor(textScale));
  return {
    uiScale,
    unitCss: uiScale / ratio,
    fontScale,
    fontCss: fontScale / ratio,
    tooSmall: fit < UI_MIN_SCALE,
  };
}
