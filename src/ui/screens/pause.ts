// S06 Pause with read-only build summary, and S06b confirm dialog for Abandon Run (ui-spec 5).
// Esc or P resumes. In the dialog Esc picks the safe option (Stay), which also has initial focus.

import type { ScreenId } from '../../core/dom.ts';
import { button, h, put } from '../dom.ts';
import { formatClock, floorSeconds, formatStatValue } from '../format.ts';
import { buildSummary } from '../presenters/run-end.ts';
import { buildRow, panel, titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

export function createPauseScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-pause');
  const focus = ctx.newFocusList();
  let confirmOpen = false;

  const resume = (): void => {
    ctx.sound(Cue.PauseClose);
    deps.app.resume();
  };

  const summary = (): HTMLElement => {
    const col = panel(ctx, 'pause-build', true);
    const view = ctx.view();
    if (view === null) return col;
    const b = buildSummary(view, deps.data);
    col.appendChild(
      h(
        doc,
        'p',
        'dim',
        `${t('ui.hud.pulse', { n: view.pulse.index + 1 })}  ${formatClock(floorSeconds(view.runStats.runTicks))}`,
      ),
    );
    col.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.weapons')));
    const list = h(doc, 'div', 'build-list');
    for (const w of b.weapons) {
      list.appendChild(
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
    col.appendChild(list);
    col.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.mementos')));
    const mlist = h(doc, 'div', 'build-list');
    for (const m of b.mementos) {
      mlist.appendChild(
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
    col.appendChild(mlist);
    col.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.stats')));
    const stats = h(doc, 'div', 'stat-list');
    deps.data.stats.forEach((s, i) => {
      if (!s.showInUi) return;
      put(
        stats,
        put(
          h(doc, 'div', 'stat-row'),
          h(doc, 'span', '', t(s.displayKey)),
          h(doc, 'span', 'num', formatStatValue(view.player.stats[i] ?? s.base)),
        ),
      );
    });
    col.appendChild(stats);
    return col;
  };

  const buildMenu = (): void => {
    el.textContent = '';
    focus.reset();
    const safe = h(doc, 'div', 'safe pause-safe');
    const menu = h(doc, 'nav', 'menu panel glass');
    const resumeBtn = button(doc, 'pause-resume', t('ui.pause.resume'));
    const settingsBtn = button(doc, 'pause-settings', t('ui.pause.settings'));
    const abandonBtn = button(doc, 'pause-abandon', t('ui.pause.abandon'));
    put(menu, resumeBtn, settingsBtn, abandonBtn);
    focus.add({ el: resumeBtn, group: 0, activate: resume });
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
    put(
      el,
      put(
        safe,
        titleBlock(ctx, t('ui.pause.title')),
        put(h(doc, 'div', 'pause-cols'), menu, summary()),
      ),
    );
    focus.focus(0, true);
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
      else buildMenu();
    },
    key(e) {
      if (!confirmOpen && ctx.matches('pause', e)) {
        resume();
        return true;
      }
      return false;
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
