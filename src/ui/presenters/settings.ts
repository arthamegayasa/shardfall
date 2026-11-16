// Settings screen model (ui-spec S07). Pure: every change returns a new Settings object that the
// screen hands to AppActions.applySettings. Defaults live in src/app/settings.ts (LP).

import type { ColorVisionMode, GraphicsQuality, Settings } from '../../core/index.ts';

export type SettingsTab = 'graphics' | 'audio' | 'controls' | 'access';

export const SETTINGS_TABS: readonly { readonly id: SettingsTab; readonly labelKey: string }[] = [
  { id: 'graphics', labelKey: 'ui.settings.tab_graphics' },
  { id: 'audio', labelKey: 'ui.settings.tab_audio' },
  { id: 'controls', labelKey: 'ui.settings.tab_controls' },
  { id: 'access', labelKey: 'ui.settings.tab_access' },
];

export type SettingId =
  | 'quality'
  | 'screenShake'
  | 'fullscreen'
  | 'master'
  | 'music'
  | 'sfx'
  | 'ui'
  | 'mono'
  | 'reduceRepeats'
  | 'muteWhenUnfocused'
  | 'textScale'
  | 'reduceEffects'
  | 'damageNumbers'
  | 'colorVision'
  | 'pauseWhenUnfocused'
  | 'showFlavor'
  | 'solidPanels'
  | 'shopTimer';

export type RowKind = 'slider' | 'choice' | 'toggle';

export interface SettingsRow {
  readonly id: SettingId;
  readonly tab: SettingsTab;
  readonly kind: RowKind;
  readonly labelKey: string;
}

export const SETTINGS_ROWS: readonly SettingsRow[] = [
  { id: 'quality', tab: 'graphics', kind: 'choice', labelKey: 'ui.settings.quality' },
  { id: 'screenShake', tab: 'graphics', kind: 'slider', labelKey: 'ui.settings.shake' },
  { id: 'fullscreen', tab: 'graphics', kind: 'toggle', labelKey: 'ui.settings.fullscreen' },
  { id: 'master', tab: 'audio', kind: 'slider', labelKey: 'ui.settings.master' },
  { id: 'music', tab: 'audio', kind: 'slider', labelKey: 'ui.settings.music' },
  { id: 'sfx', tab: 'audio', kind: 'slider', labelKey: 'ui.settings.sfx' },
  { id: 'ui', tab: 'audio', kind: 'slider', labelKey: 'ui.settings.ui_volume' },
  { id: 'mono', tab: 'audio', kind: 'toggle', labelKey: 'ui.settings.mono' },
  { id: 'reduceRepeats', tab: 'audio', kind: 'toggle', labelKey: 'ui.settings.reduce_repeats' },
  { id: 'muteWhenUnfocused', tab: 'audio', kind: 'toggle', labelKey: 'ui.settings.mute_unfocused' },
  { id: 'textScale', tab: 'access', kind: 'choice', labelKey: 'ui.settings.text_size' },
  { id: 'reduceEffects', tab: 'access', kind: 'toggle', labelKey: 'ui.settings.reduce_effects' },
  { id: 'damageNumbers', tab: 'access', kind: 'toggle', labelKey: 'ui.settings.damage_numbers' },
  { id: 'colorVision', tab: 'access', kind: 'choice', labelKey: 'ui.settings.color_vision' },
  {
    id: 'pauseWhenUnfocused',
    tab: 'access',
    kind: 'toggle',
    labelKey: 'ui.settings.pause_unfocused',
  },
  { id: 'showFlavor', tab: 'access', kind: 'toggle', labelKey: 'ui.settings.flavor' },
  { id: 'solidPanels', tab: 'access', kind: 'toggle', labelKey: 'ui.settings.solid_panels' },
  // Optional Glazier Timer (A-12, CD K1). Saved now, used once GD gives the shop a timer.
  { id: 'shopTimer', tab: 'access', kind: 'choice', labelKey: 'ui.settings.shop_timer' },
];

/** Slider range and step (ui-spec 6.2: 11 notches, left/right changes 10). */
export const SLIDER_MAX = 100;
export const SLIDER_STEP = 10;

const QUALITY: readonly { readonly v: GraphicsQuality; readonly key: string }[] = [
  { v: 'low', key: 'ui.settings.quality_low' },
  { v: 'medium', key: 'ui.settings.quality_medium' },
  { v: 'high', key: 'ui.settings.quality_high' },
];
const TEXT_SCALE: readonly { readonly v: 0 | 1 | 2; readonly key: string }[] = [
  { v: 0, key: 'ui.settings.text_normal' },
  { v: 1, key: 'ui.settings.text_large' },
  { v: 2, key: 'ui.settings.text_largest' },
];
const COLOR_VISION: readonly { readonly v: ColorVisionMode; readonly key: string }[] = [
  { v: 'off', key: 'ui.settings.cv_off' },
  { v: 'protan', key: 'ui.settings.cv_protan' },
  { v: 'deutan', key: 'ui.settings.cv_deutan' },
  { v: 'tritan', key: 'ui.settings.cv_tritan' },
];
const SHOP_TIMER: readonly {
  readonly v: Settings['access']['shopTimer'];
  readonly key: string;
}[] = [
  { v: 'on', key: 'ui.settings.on' },
  { v: 'extended', key: 'ui.settings.extended' },
  { v: 'off', key: 'ui.settings.off' },
];
const ON_KEY = 'ui.settings.on';
const OFF_KEY = 'ui.settings.off';

function clampSlider(v: number): number {
  return Math.min(SLIDER_MAX, Math.max(0, Math.round(v / SLIDER_STEP) * SLIDER_STEP));
}

/** Slider value for a pointer at fraction 0..1 of the notch strip (ui-spec 6.2 "klik atau seret"). */
export function sliderFromFraction(f: number): number {
  return clampSlider((Number.isFinite(f) ? f : 0) * SLIDER_MAX);
}

/** Settings with one slider set to an absolute value (mouse), clamped to the 10-step grid. */
export function setSlider(s: Settings, id: SettingId, value: number): Settings {
  const v = clampSlider(value);
  switch (id) {
    case 'screenShake':
      return { ...s, graphics: { ...s.graphics, screenShake: v } };
    case 'master':
    case 'music':
    case 'sfx':
    case 'ui':
      return { ...s, audio: { ...s.audio, [id]: v } };
    default:
      return s;
  }
}

/** Next option in a list, wrapping (ui-spec 6.2 "< Large >"). */
function cycle<T>(list: readonly { readonly v: T }[], current: T, delta: 1 | -1): T {
  const i = list.findIndex((o) => o.v === current);
  const next = list[(Math.max(0, i) + delta + list.length) % list.length];
  return next === undefined ? current : next.v;
}

export function sliderValue(s: Settings, id: SettingId): number {
  switch (id) {
    case 'screenShake':
      return s.graphics.screenShake;
    case 'master':
    case 'music':
    case 'sfx':
    case 'ui':
      return s.audio[id];
    default:
      return 0;
  }
}

export function toggleValue(s: Settings, id: SettingId): boolean {
  switch (id) {
    case 'fullscreen':
      return s.graphics.fullscreen;
    case 'mono':
    case 'reduceRepeats':
    case 'muteWhenUnfocused':
      return s.audio[id];
    case 'reduceEffects':
    case 'damageNumbers':
    case 'pauseWhenUnfocused':
    case 'showFlavor':
    case 'solidPanels':
      return s.access[id];
    default:
      return false;
  }
}

/** String key for the displayed value of a choice or toggle row; null for sliders. */
export function valueKey(s: Settings, id: SettingId): string | null {
  switch (id) {
    case 'quality':
      return QUALITY.find((o) => o.v === s.graphics.quality)?.key ?? null;
    case 'textScale':
      return TEXT_SCALE.find((o) => o.v === s.access.textScale)?.key ?? null;
    case 'colorVision':
      return COLOR_VISION.find((o) => o.v === s.access.colorVision)?.key ?? null;
    case 'shopTimer':
      return SHOP_TIMER.find((o) => o.v === s.access.shopTimer)?.key ?? null;
    case 'screenShake':
    case 'master':
    case 'music':
    case 'sfx':
    case 'ui':
      return null;
    default:
      return toggleValue(s, id) ? ON_KEY : OFF_KEY;
  }
}

/** Settings after pressing left (-1) or right (+1) on a row. Toggles flip either way. */
export function stepSetting(s: Settings, id: SettingId, delta: 1 | -1): Settings {
  const g = s.graphics;
  const a = s.audio;
  const x = s.access;
  switch (id) {
    case 'quality':
      return { ...s, graphics: { ...g, quality: cycle(QUALITY, g.quality, delta) } };
    case 'screenShake':
      return {
        ...s,
        graphics: { ...g, screenShake: clampSlider(g.screenShake + delta * SLIDER_STEP) },
      };
    case 'fullscreen':
      return { ...s, graphics: { ...g, fullscreen: !g.fullscreen } };
    case 'master':
    case 'music':
    case 'sfx':
    case 'ui':
      return { ...s, audio: { ...a, [id]: clampSlider(a[id] + delta * SLIDER_STEP) } };
    case 'mono':
    case 'reduceRepeats':
    case 'muteWhenUnfocused':
      return { ...s, audio: { ...a, [id]: !a[id] } };
    case 'textScale':
      return { ...s, access: { ...x, textScale: cycle(TEXT_SCALE, x.textScale, delta) } };
    case 'colorVision':
      return { ...s, access: { ...x, colorVision: cycle(COLOR_VISION, x.colorVision, delta) } };
    case 'shopTimer':
      return { ...s, access: { ...x, shopTimer: cycle(SHOP_TIMER, x.shopTimer, delta) } };
    case 'reduceEffects':
    case 'damageNumbers':
    case 'pauseWhenUnfocused':
    case 'showFlavor':
    case 'solidPanels':
      return { ...s, access: { ...x, [id]: !x[id] } };
  }
}
