// S07 Settings (ui-spec 5): Graphics, Audio, Controls (read-only until M2 remap), Accessibility.
// Changes apply and save at once through AppActions.applySettings, no Apply button.
// Left/right change the focused row, Q/E switch tabs, Esc goes back.

import type { Settings } from '../../core/index.ts';
import { button, h, put, setText } from '../dom.ts';
import { keyLabel } from '../format.ts';
import {
  CONTROL_ROWS,
  SETTINGS_ROWS,
  SETTINGS_TABS,
  SLIDER_MAX,
  SLIDER_STEP,
  sliderValue,
  stepSetting,
  valueKey,
} from '../presenters/settings.ts';
import type { SettingsRow, SettingsTab } from '../presenters/settings.ts';
import { panel, titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

export function createSettingsScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-settings');
  const focus = ctx.newFocusList();
  let tab: SettingsTab = 'graphics';
  let focusedRow: SettingsRow | null = null;
  const valueEls = new Map<string, HTMLElement>();

  const renderValue = (row: SettingsRow, s: Settings): void => {
    const target = valueEls.get(row.id);
    if (target === undefined) return;
    if (row.kind === 'slider') {
      const v = sliderValue(s, row.id);
      const notches = h(doc, 'span', 'slider');
      for (let n = 0; n <= SLIDER_MAX; n += SLIDER_STEP) {
        notches.appendChild(h(doc, 'span', n <= v && v > 0 ? 'notch is-on' : 'notch'));
      }
      target.textContent = '';
      put(target, notches, h(doc, 'span', 'num', String(v)));
    } else {
      const key = valueKey(s, row.id);
      setText(target, key === null ? '' : `< ${t(key)} >`);
    }
  };

  const change = (row: SettingsRow, delta: 1 | -1): void => {
    const next = stepSetting(deps.settings(), row.id, delta);
    ctx.applySettings(next);
    ctx.sound(row.kind === 'slider' ? Cue.SliderTick : Cue.Toggle);
    renderValue(row, next);
  };

  const build = (): void => {
    el.textContent = '';
    focus.reset();
    valueEls.clear();
    focusedRow = null;
    const s = deps.settings();
    const safe = h(doc, 'div', 'safe settings-safe');
    const tabs = h(doc, 'div', 'tabs');
    let tabFocus = 0;
    for (const tb of SETTINGS_TABS) {
      const b = button(
        doc,
        `settings-tab-${tb.id}`,
        t(tb.labelKey),
        tb.id === tab ? 'tab is-active' : 'tab',
      );
      tabs.appendChild(b);
      const i = focus.add({
        el: b,
        group: 0,
        activate: () => {
          if (tab !== tb.id) {
            tab = tb.id;
            ctx.sound(Cue.Toggle);
            build();
          }
        },
      });
      if (tb.id === tab) tabFocus = i;
    }
    const body = panel(ctx, 'settings-body');
    if (tab === 'controls') {
      const binds = s.keybinds;
      for (const c of CONTROL_ROWS) {
        const pair = binds[c.action];
        const keys = [keyLabel(pair[0]), keyLabel(pair[1])].filter((k) => k !== '').join(' / ');
        put(
          body,
          put(
            h(doc, 'div', 'setting-row is-static'),
            h(doc, 'span', 'setting-label', t(c.labelKey)),
            h(doc, 'span', 'setting-value', keys),
          ),
        );
      }
    } else {
      for (const row of SETTINGS_ROWS) {
        if (row.tab !== tab) continue;
        const b = button(doc, `setting-${row.id}`, '', 'setting-row');
        b.textContent = '';
        const value = h(doc, 'span', 'setting-value');
        valueEls.set(row.id, value);
        put(b, h(doc, 'span', 'setting-label', t(row.labelKey)), value);
        body.appendChild(b);
        renderValue(row, s);
        focus.add({
          el: b,
          group: 1,
          activate: () => {
            if (row.kind !== 'slider') change(row, 1);
          },
          onFocus: () => {
            focusedRow = row;
          },
        });
      }
    }
    const bar = h(doc, 'div', 'bottom-bar');
    const back = button(doc, 'settings-back', t('ui.common.back'));
    bar.appendChild(back);
    focus.add({ el: back, group: 2, activate: goBack });
    put(el, put(safe, titleBlock(ctx, t('ui.settings.title')), tabs, body, bar));
    focus.focus(tabFocus, true);
  };

  const goBack = (): void => {
    ctx.sound(Cue.Back);
    ctx.go(ctx.previous() === 'paused' ? 'paused' : 'title');
  };

  const switchTab = (delta: 1 | -1): void => {
    const i = SETTINGS_TABS.findIndex((x) => x.id === tab);
    const next = SETTINGS_TABS[(i + delta + SETTINGS_TABS.length) % SETTINGS_TABS.length];
    if (next === undefined) return;
    tab = next.id;
    ctx.sound(Cue.Toggle);
    build();
  };

  return {
    el,
    focus,
    enter() {
      build();
    },
    key(e) {
      if (e.code === 'KeyQ') {
        switchTab(-1);
        return true;
      }
      if (e.code === 'KeyE') {
        switchTab(1);
        return true;
      }
      const a = doc.activeElement;
      const onRow =
        focusedRow !== null &&
        a instanceof HTMLElement &&
        a.dataset['ui'] === `setting-${focusedRow.id}`;
      if (onRow && focusedRow !== null) {
        if (e.code === 'ArrowLeft' || ctx.matches('moveLeft', e)) {
          change(focusedRow, -1);
          return true;
        }
        if (e.code === 'ArrowRight' || ctx.matches('moveRight', e)) {
          change(focusedRow, 1);
          return true;
        }
      }
      return false;
    },
    back: goBack,
  };
}
