// S06 Pause with read-only build summary, and S06b confirm dialog for Abandon run (ui-spec 5,
// redesign-1.1 3.4). Menu left (Resume, How to play, Settings, Abandon run); right panel "Your
// weapons", "Your relics", and the stats in two columns, zero values dimmed. At large text sizes
// the panel scrolls (wheel, or arrows while it has focus) with a scroll mark. Esc or P resumes. In
// the dialog Esc picks the safe option (Stay), which also has initial focus.

import type { ScreenId } from '../../core/dom.ts';
import { button, h, put } from '../dom.ts';
import { formatClock, floorSeconds } from '../format.ts';
import { menuIntent } from '../menu-keys.ts';
import { buildSummary, statLines } from '../presenters/run-end.ts';
import { moreAbove, moreBelow, overflows, scrollStep } from '../scroll.ts';
import type { ScrollMetrics } from '../scroll.ts';
import { buildRow, panel, titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

/** Menu items that open a screen which returns here (focus comes back to them). */
const RETURN_FOCUS: Readonly<Record<string, string>> = {
  howTo: 'pause-howto',
  settings: 'pause-settings',
};

export function createPauseScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-pause');
  const focus = ctx.newFocusList();
  let confirmOpen = false;
  /** Scrollable summary and its scroll mark (null until built). */
  let scrollBox: HTMLElement | null = null;
  let scrollMark: HTMLElement | null = null;

  const metrics = (b: HTMLElement): ScrollMetrics => ({
    top: b.scrollTop,
    client: b.clientHeight,
    height: b.scrollHeight,
  });

  const syncMark = (): void => {
    if (scrollBox === null || scrollMark === null) return;
    const m = metrics(scrollBox);
    const below = moreBelow(m);
    const above = moreAbove(m);
    scrollMark.hidden = !overflows(m);
    scrollMark.classList.toggle('is-below', below);
    scrollMark.classList.toggle('is-above', above && !below);
    scrollMark.textContent = t(below ? 'ui.end.more_below' : 'ui.end.more_above');
  };

  /** Arrow up or down while the summary has focus scrolls it until its edge. */
  const scrollKey = (e: KeyboardEvent): boolean => {
    if (scrollBox === null || doc.activeElement !== scrollBox) return false;
    const intent = menuIntent(e.code, e.shiftKey, deps.settings().keybinds);
    if (intent !== 'up' && intent !== 'down') return false;
    const row = scrollBox.querySelector('.stat-row');
    const step = row instanceof HTMLElement ? row.offsetHeight * 3 : scrollBox.clientHeight / 2;
    const next = scrollStep(metrics(scrollBox), intent === 'up' ? -1 : 1, step);
    if (next === null) return false;
    scrollBox.scrollTop = next;
    syncMark();
    return true;
  };

  const resume = (): void => {
    ctx.sound(Cue.PauseClose);
    deps.app.resume();
  };

  /** Right panel (redesign-1.1 3.4): weapons, relics, then stats in two columns. Scrolls. */
  const summary = (): HTMLElement => {
    const col = panel(ctx, 'pause-build', true);
    const view = ctx.view();
    if (view === null) return col;
    const scroll = h(doc, 'div', 'pause-scroll');
    scroll.dataset['ui'] = 'pause-build';
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', t('ui.pause.stats'));
    const b = buildSummary(view, deps.data);
    scroll.appendChild(
      put(
        h(doc, 'p', 'pause-progress'),
        h(
          doc,
          'span',
          'chip',
          t('ui.pause.wave', {
            n: view.pulse.index + 1,
            total: Math.max(1, view.pulse.count),
          }),
        ),
        h(
          doc,
          'span',
          'chip',
          t('ui.pause.time', { time: formatClock(floorSeconds(view.runStats.runTicks)) }),
        ),
      ),
    );
    const weapons = h(doc, 'div', 'build-list');
    for (const w of b.weapons) {
      weapons.appendChild(
        buildRow(
          ctx,
          { kind: 'weapon', id: w.item.id },
          w.item.nameKey,
          w.item.tags,
          w.rarityOrder,
          ctx.tier(w.level),
        ),
      );
    }
    const relics = h(doc, 'div', 'build-list');
    for (const m of b.mementos) {
      relics.appendChild(
        buildRow(
          ctx,
          { kind: 'memento', id: m.item.id },
          m.item.nameKey,
          m.item.tags,
          m.rarityOrder,
          m.level > 1 ? `x${String(m.level)}` : '',
        ),
      );
    }
    if (b.mementos.length === 0)
      relics.appendChild(h(doc, 'p', 'dim pause-empty', t('ui.pause.no_relics')));
    const stats = h(doc, 'div', 'stat-list pause-stats');
    for (const line of statLines(view, deps.data)) {
      put(
        stats,
        put(
          h(doc, 'div', `stat-row${line.zero ? ' is-zero' : ''}`),
          h(doc, 'span', 'stat-name', t(line.labelKey)),
          h(doc, 'span', 'num', line.text),
        ),
      );
    }
    put(
      scroll,
      put(
        h(doc, 'div', 'pause-loadout'),
        put(
          h(doc, 'section', 'pause-group'),
          h(doc, 'h3', 'col-title', t('ui.shop.weapons')),
          weapons,
        ),
        put(
          h(doc, 'section', 'pause-group'),
          h(doc, 'h3', 'col-title', t('ui.shop.mementos')),
          relics,
        ),
      ),
      put(h(doc, 'section', 'pause-group'), h(doc, 'h3', 'col-title', t('ui.pause.stats')), stats),
    );
    const mark = h(doc, 'p', 'end-more');
    mark.setAttribute('aria-hidden', 'true');
    mark.hidden = true;
    scroll.addEventListener('scroll', syncMark, { passive: true });
    scrollBox = scroll;
    scrollMark = mark;
    put(col, scroll, mark);
    return col;
  };

  /** focusUi: data-ui of the menu button to focus ('' for Resume). */
  const buildMenu = (focusUi = ''): void => {
    el.textContent = '';
    focus.reset();
    scrollBox = null;
    scrollMark = null;
    const safe = h(doc, 'div', 'safe pause-safe');
    const menu = h(doc, 'nav', 'menu panel glass');
    const resumeBtn = button(doc, 'pause-resume', t('ui.pause.resume'), 'primary');
    const howBtn = button(doc, 'pause-howto', t('ui.pause.howto'));
    const settingsBtn = button(doc, 'pause-settings', t('ui.pause.settings'));
    const abandonBtn = button(doc, 'pause-abandon', t('ui.pause.abandon'));
    put(menu, resumeBtn, howBtn, settingsBtn, abandonBtn);
    focus.add({ el: resumeBtn, group: 0, activate: resume });
    focus.add({
      el: howBtn,
      group: 0,
      activate: () => {
        ctx.sound(Cue.Confirm);
        ctx.openHowTo();
      },
    });
    focus.add({
      el: settingsBtn,
      group: 0,
      activate: () => {
        ctx.sound(Cue.Confirm);
        deps.app.openSettings();
      },
    });
    focus.add({
      el: abandonBtn,
      group: 0,
      activate: () => {
        ctx.sound(Cue.Confirm);
        openConfirm(true);
      },
    });
    const side = summary();
    put(
      el,
      put(safe, titleBlock(ctx, t('ui.pause.title')), put(h(doc, 'div', 'pause-cols'), menu, side)),
    );
    // Large text: a summary taller than its panel scrolls and becomes a focus stop (arrows).
    const box = side.querySelector<HTMLElement>('.pause-scroll');
    if (box !== null && overflows(metrics(box))) {
      focus.add({
        el: box,
        group: 1,
        activate: () => {
          ctx.sound(Cue.Denied);
        },
      });
    }
    syncMark();
    const prev = focusUi === '' ? null : menu.querySelector(`[data-ui="${focusUi}"]`);
    const i = prev === null ? -1 : focus.indexOf(prev);
    focus.focus(i >= 0 ? i : 0, true);
  };

  const buildConfirm = (): void => {
    el.textContent = '';
    focus.reset();
    const dlg = h(doc, 'div', 'dialog panel');
    dlg.setAttribute('role', 'alertdialog');
    dlg.dataset['screen'] = 'confirm';
    const q = h(doc, 'p', 'dialog-q', t('ui.confirm.abandon'));
    const stay = button(doc, 'confirm-stay', t('ui.confirm.stay'), 'primary');
    const yes = button(doc, 'confirm-abandon', t('ui.confirm.abandon_yes'));
    put(dlg, q, put(h(doc, 'div', 'dialog-buttons'), stay, yes));
    focus.add({
      el: stay,
      group: 0,
      activate: () => {
        ctx.sound(Cue.Back);
        openConfirm(false);
      },
    });
    focus.add({
      el: yes,
      group: 0,
      activate: () => {
        ctx.sound(Cue.Confirm);
        confirmOpen = false;
        ctx.setConfirmOpen(false);
        deps.commands.send({ type: 'run.abandon' });
        // The sim applies the command on its next step, so the loop must run again.
        deps.app.resume();
      },
    });
    put(el, put(h(doc, 'div', 'safe dialog-safe'), dlg));
    focus.focus(0, true);
  };

  const openConfirm = (open: boolean): void => {
    confirmOpen = open;
    ctx.setConfirmOpen(open);
    if (open) buildConfirm();
    else buildMenu();
  };

  return {
    el,
    focus,
    enter(id: ScreenId) {
      confirmOpen = id === 'confirm';
      if (confirmOpen) buildConfirm();
      // Back from How to play or Settings: the button that opened it keeps the focus.
      else buildMenu(RETURN_FOCUS[ctx.previous()] ?? '');
    },
    key(e) {
      if (!confirmOpen && ctx.matches('pause', e)) {
        resume();
        return true;
      }
      return !confirmOpen && scrollKey(e);
    },
    back() {
      if (confirmOpen) {
        ctx.sound(Cue.Back);
        openConfirm(false);
      } else resume();
    },
    leave() {
      if (confirmOpen) {
        confirmOpen = false;
        ctx.setConfirmOpen(false);
      }
    },
  };
}
