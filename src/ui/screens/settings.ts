// S07 Settings (ui-spec 5): Graphics, Audio, Controls (remap), Accessibility. Changes apply and save
// at once through AppActions.applySettings (app persists shardfall.settings.v1 in localStorage), no
// Apply button. Left/right change the focused row, Q/E switch tabs, Esc goes back. Mouse: click or
// drag a slider, click the arrows of a choice, click a binding then press a key.

import type { ActionId, Settings } from '../../core/index.ts';
import { button, h, put, setText } from '../dom.ts';
import { keyLabel } from '../format.ts';
import {
  actionLabelKey,
  DEFAULT_KEYBINDS,
  isBindable,
  rebind,
  REMAP_ROWS,
} from '../presenters/remap.ts';
import type { RemapContext } from '../presenters/remap.ts';
import {
  SETTINGS_ROWS,
  SETTINGS_TABS,
  SLIDER_MAX,
  SLIDER_STEP,
  setSlider,
  sliderFromFraction,
  sliderValue,
  stepSetting,
  valueKey,
} from '../presenters/settings.ts';
import type { SettingsRow, SettingsTab } from '../presenters/settings.ts';
import { panel, titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

/** "Press again" window for Reset Controls (ui-spec S09 pattern, no dialog). */
const PRESS_AGAIN_MS = 3000;

const GROUP_TABS = 0;
const GROUP_ROWS = 1;
const GROUP_BINDS_MENU = 2;
const GROUP_BAR = 3;

interface Recording {
  readonly action: ActionId;
  readonly slot: 0 | 1;
}

export function createSettingsScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const win = doc.defaultView;
  const el = h(doc, 'div', 'screen screen-settings');
  const focus = ctx.newFocusList();
  let tab: SettingsTab = 'graphics';
  let focusedRow: SettingsRow | null = null;
  let recording: Recording | null = null;
  let resetArmedUntil = 0;
  let resetTimer = 0;
  const notches = new Map<string, HTMLElement[]>();
  const numbers = new Map<string, HTMLElement>();
  const choiceText = new Map<string, HTMLElement>();
  const note = h(doc, 'p', 'settings-note');
  note.setAttribute('role', 'status');

  const now = (): number => (win === null ? 0 : win.performance.now());

  /** Large text sizes let the settings body scroll; keyboard focus keeps its row in view. */
  const keepVisible = (target: HTMLElement): void => {
    target.scrollIntoView({ block: 'nearest' });
  };

  const renderValue = (row: SettingsRow, s: Settings): void => {
    if (row.kind === 'slider') {
      const v = sliderValue(s, row.id);
      const list = notches.get(row.id) ?? [];
      list.forEach((n, i) => {
        n.classList.toggle('is-on', v > 0 && i * SLIDER_STEP <= v);
      });
      const num = numbers.get(row.id);
      if (num !== undefined) setText(num, String(v));
    } else {
      const key = valueKey(s, row.id);
      const target = choiceText.get(row.id);
      if (target !== undefined) setText(target, key === null ? '' : t(key));
    }
  };

  const apply = (row: SettingsRow, next: Settings): void => {
    if (next === deps.settings()) return;
    ctx.applySettings(next);
    ctx.sound(row.kind === 'slider' ? Cue.SliderTick : Cue.Toggle);
    renderValue(row, next);
  };

  const change = (row: SettingsRow, delta: 1 | -1): void => {
    apply(row, stepSetting(deps.settings(), row.id, delta));
  };

  /** Mouse on the notch strip: click or drag sets the value under the pointer (review M1 LP). */
  const wireSlider = (row: SettingsRow, strip: HTMLElement): void => {
    const at = (clientX: number): void => {
      const r = strip.getBoundingClientRect();
      const f = r.width > 0 ? (clientX - r.left) / r.width : 0;
      const v = sliderFromFraction(f);
      if (v !== sliderValue(deps.settings(), row.id))
        apply(row, setSlider(deps.settings(), row.id, v));
    };
    strip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      strip.setPointerCapture(e.pointerId);
      at(e.clientX);
    });
    strip.addEventListener('pointermove', (e) => {
      if (strip.hasPointerCapture(e.pointerId)) at(e.clientX);
    });
    const release = (e: PointerEvent): void => {
      if (strip.hasPointerCapture(e.pointerId)) strip.releasePointerCapture(e.pointerId);
    };
    strip.addEventListener('pointerup', release);
    strip.addEventListener('pointercancel', release);
    // The row button must not treat a slider click as "activate".
    strip.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  };

  const arrow = (row: SettingsRow, delta: 1 | -1, text: string): HTMLElement => {
    const a = h(doc, 'span', delta < 0 ? 'arrow arrow-l' : 'arrow arrow-r', text);
    a.setAttribute('aria-hidden', 'true');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      change(row, delta);
    });
    return a;
  };

  const settingRows = (body: HTMLElement, s: Settings): void => {
    for (const row of SETTINGS_ROWS) {
      if (row.tab !== tab) continue;
      const b = button(doc, `setting-${row.id}`, '', `setting-row kind-${row.kind}`);
      b.textContent = '';
      const value = h(doc, 'span', 'setting-value');
      if (row.kind === 'slider') {
        const strip = h(doc, 'span', 'slider');
        const list: HTMLElement[] = [];
        for (let n = 0; n <= SLIDER_MAX; n += SLIDER_STEP) {
          const notch = h(doc, 'span', 'notch');
          list.push(notch);
          strip.appendChild(notch);
        }
        notches.set(row.id, list);
        const num = h(doc, 'span', 'num slider-num');
        numbers.set(row.id, num);
        wireSlider(row, strip);
        put(value, strip, num);
      } else {
        const text = h(doc, 'span', 'choice-text');
        choiceText.set(row.id, text);
        put(value, arrow(row, -1, '<'), text, arrow(row, 1, '>'));
      }
      put(b, h(doc, 'span', 'setting-label', t(row.labelKey)), value);
      body.appendChild(b);
      renderValue(row, s);
      focus.add({
        el: b,
        group: GROUP_ROWS,
        activate: () => {
          if (row.kind !== 'slider') change(row, 1);
        },
        onFocus: () => {
          focusedRow = row;
          keepVisible(b);
        },
      });
    }
  };

  const bindLabel = (code: string | null): string => (code === null ? '' : keyLabel(code));

  const controlRows = (body: HTMLElement, s: Settings): void => {
    body.classList.add('is-controls');
    const cols = h(doc, 'div', 'remap-cols');
    const col = (context: RemapContext, titleKey: string, group: number): HTMLElement => {
      const c = h(doc, 'div', 'remap-col');
      c.appendChild(h(doc, 'h3', 'col-title', t(titleKey)));
      for (const row of REMAP_ROWS) {
        if (row.context !== context) continue;
        const line = h(doc, 'div', 'remap-row');
        line.appendChild(h(doc, 'span', 'setting-label', t(row.labelKey)));
        const pair = s.keybinds[row.action];
        for (const slot of [0, 1] as const) {
          const rec =
            recording !== null && recording.action === row.action && recording.slot === slot;
          const code = pair[slot];
          const b = button(
            doc,
            `bind-${row.action}-${String(slot + 1)}`,
            rec ? t('ui.settings.press_key') : bindLabel(code),
            `bind${rec ? ' is-recording' : ''}${code === null && !rec ? ' is-empty' : ''}`,
          );
          b.setAttribute('aria-label', `${t(row.labelKey)} ${bindLabel(code)}`.trim());
          line.appendChild(b);
          focus.add({
            el: b,
            group,
            onFocus: () => {
              keepVisible(b);
            },
            activate: () => {
              recording = { action: row.action, slot };
              ctx.sound(Cue.Confirm);
              setText(note, t('ui.settings.press_key'));
              rebuild(`bind-${row.action}-${String(slot + 1)}`);
            },
          });
        }
        c.appendChild(line);
      }
      return c;
    };
    put(
      cols,
      col('gameplay', 'ui.settings.remap_gameplay', GROUP_ROWS),
      col('menu', 'ui.settings.remap_menu', GROUP_BINDS_MENU),
    );
    body.appendChild(cols);
  };

  const finishRecording = (code: string | null): void => {
    const rec = recording;
    recording = null;
    if (rec === null) return;
    const dataUi = `bind-${rec.action}-${String(rec.slot + 1)}`;
    if (code === null) {
      ctx.sound(Cue.Back);
      setText(note, '');
      rebuild(dataUi);
      return;
    }
    const s = deps.settings();
    const res = rebind(s.keybinds, rec.action, rec.slot, code);
    if (res.keybinds !== s.keybinds) ctx.applySettings({ ...s, keybinds: res.keybinds });
    ctx.sound(Cue.Toggle);
    const swapped =
      res.swappedWith === null
        ? ''
        : t('ui.settings.swapped', { action: t(actionLabelKey(res.swappedWith)) });
    setText(note, swapped);
    if (swapped !== '') ctx.announce(swapped);
    rebuild(dataUi);
  };

  const resetControls = (btn: HTMLElement): void => {
    if (now() < resetArmedUntil) {
      resetArmedUntil = 0;
      if (win !== null) win.clearTimeout(resetTimer);
      ctx.applySettings({ ...deps.settings(), keybinds: DEFAULT_KEYBINDS });
      ctx.sound(Cue.Confirm);
      setText(note, '');
      rebuild('settings-reset-controls');
      return;
    }
    resetArmedUntil = now() + PRESS_AGAIN_MS;
    ctx.sound(Cue.Toggle);
    const label = btn.querySelector('.btn-label');
    if (label instanceof HTMLElement) setText(label, t('ui.common.press_again'));
    btn.classList.add('is-armed');
    if (win !== null) {
      win.clearTimeout(resetTimer);
      resetTimer = win.setTimeout(() => {
        resetArmedUntil = 0;
        if (label instanceof HTMLElement) setText(label, t('ui.settings.reset_controls'));
        btn.classList.remove('is-armed');
      }, PRESS_AGAIN_MS);
    }
  };

  const build = (focusUi = ''): void => {
    el.textContent = '';
    focus.reset();
    notches.clear();
    numbers.clear();
    choiceText.clear();
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
        group: GROUP_TABS,
        activate: () => {
          if (tab !== tb.id) {
            tab = tb.id;
            recording = null;
            setText(note, '');
            ctx.sound(Cue.Toggle);
            build();
          }
        },
      });
      if (tb.id === tab) tabFocus = i;
    }
    const body = panel(ctx, 'settings-body', true);
    if (tab === 'controls') controlRows(body, s);
    else settingRows(body, s);
    const bar = h(doc, 'div', 'bottom-bar');
    if (tab === 'controls') {
      const reset = button(doc, 'settings-reset-controls', t('ui.settings.reset_controls'));
      bar.appendChild(reset);
      focus.add({
        el: reset,
        group: GROUP_BAR,
        activate: () => {
          resetControls(reset);
        },
      });
    }
    bar.appendChild(note);
    const back = button(doc, 'settings-back', t('ui.common.back'));
    bar.appendChild(back);
    focus.add({ el: back, group: GROUP_BAR, activate: goBack });
    put(el, put(safe, titleBlock(ctx, t('ui.settings.title')), tabs, body, bar));
    const keep = focusUi === '' ? null : el.querySelector<HTMLElement>(`[data-ui="${focusUi}"]`);
    const ki = keep === null ? -1 : focus.indexOf(keep);
    focus.focus(ki >= 0 ? ki : tabFocus, true);
  };

  const rebuild = (focusUi: string): void => {
    build(focusUi);
  };

  const goBack = (): void => {
    recording = null;
    ctx.sound(Cue.Back);
    ctx.go(ctx.previous() === 'paused' ? 'paused' : 'title');
  };

  const switchTab = (delta: 1 | -1): void => {
    const i = SETTINGS_TABS.findIndex((x) => x.id === tab);
    const next = SETTINGS_TABS[(i + delta + SETTINGS_TABS.length) % SETTINGS_TABS.length];
    if (next === undefined) return;
    tab = next.id;
    recording = null;
    setText(note, '');
    ctx.sound(Cue.Toggle);
    build();
  };

  return {
    el,
    focus,
    enter() {
      recording = null;
      setText(note, '');
      build();
    },
    key(e) {
      if (recording !== null) {
        // Esc cancels; any other bindable key becomes the binding (ui-spec S07).
        if (e.code === 'Escape') finishRecording(null);
        else if (isBindable(e.code)) finishRecording(e.code);
        return true;
      }
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
    leave() {
      recording = null;
      if (win !== null) win.clearTimeout(resetTimer);
      resetArmedUntil = 0;
    },
  };
}
