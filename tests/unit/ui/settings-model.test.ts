import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/app/settings.ts';
import {
  SETTINGS_ROWS,
  sliderValue,
  stepSetting,
  toggleValue,
  valueKey,
} from '../../../src/ui/presenters/settings.ts';

const base = defaultSettings(false);

describe('settings model', () => {
  it('steps sliders by 10 and clamps to 0..100', () => {
    const up = stepSetting(base, 'master', 1);
    expect(sliderValue(up, 'master')).toBe(base.audio.master + 10);
    let s = base;
    for (let i = 0; i < 20; i++) s = stepSetting(s, 'ui', 1);
    expect(s.audio.ui).toBe(100);
    for (let i = 0; i < 20; i++) s = stepSetting(s, 'ui', -1);
    expect(s.audio.ui).toBe(0);
  });

  it('flips toggles in either direction', () => {
    expect(toggleValue(stepSetting(base, 'mono', 1), 'mono')).toBe(!base.audio.mono);
    expect(toggleValue(stepSetting(base, 'reduceRepeats', -1), 'reduceRepeats')).toBe(
      !base.audio.reduceRepeats,
    );
    expect(stepSetting(base, 'solidPanels', 1).access.solidPanels).toBe(!base.access.solidPanels);
  });

  it('cycles choices with wrap-around', () => {
    expect(base.graphics.quality).toBe('medium');
    expect(stepSetting(base, 'quality', 1).graphics.quality).toBe('high');
    expect(stepSetting(stepSetting(base, 'quality', 1), 'quality', 1).graphics.quality).toBe('low');
    expect(stepSetting(base, 'textScale', -1).access.textScale).toBe(2);
    expect(stepSetting(base, 'colorVision', 1).access.colorVision).toBe('protan');
  });

  it('never mutates the input settings', () => {
    const before = JSON.stringify(base);
    stepSetting(base, 'sfx', -1);
    stepSetting(base, 'fullscreen', 1);
    expect(JSON.stringify(base)).toBe(before);
  });

  it('labels choice and toggle values with string keys and sliders with none', () => {
    expect(valueKey(base, 'quality')).toBe('ui.settings.quality_medium');
    expect(valueKey(base, 'textScale')).toBe('ui.settings.text_normal');
    expect(valueKey(base, 'muteWhenUnfocused')).toBe('ui.settings.on');
    expect(valueKey(base, 'mono')).toBe('ui.settings.off');
    expect(valueKey(base, 'master')).toBeNull();
  });

  it('offers the Interface volume, Mono Audio and Reduce Repeats rows (review LP)', () => {
    const audio = SETTINGS_ROWS.filter((r) => r.tab === 'audio').map((r) => r.id);
    expect(audio).toEqual([
      'master',
      'music',
      'sfx',
      'ui',
      'mono',
      'reduceRepeats',
      'muteWhenUnfocused',
    ]);
  });
});
