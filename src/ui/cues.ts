// UI sound cue ids. Source of truth: docs/audio-list.md section 9 (ui-spec 8.5, CD review 2.6).
// Cues that have a sim event (ui.shop.buy from ItemBought, ui.card.pick, ...) are mapped by AU from
// events, so the UI never plays them itself.

export const Cue = {
  Focus: 'ui.focus',
  Confirm: 'ui.confirm',
  Back: 'ui.back',
  Denied: 'ui.denied',
  PulseBegin: 'ui.pulse.begin',
  PauseOpen: 'ui.pause.open',
  PauseClose: 'ui.pause.close',
  SliderTick: 'ui.slider.tick',
  Toggle: 'ui.toggle',
  Unlock: 'ui.unlock',
} as const;
export type Cue = (typeof Cue)[keyof typeof Cue];
