// S04 Temper (level-up) and S04b Warden reward (ui-spec 5). Three row cards, keys 1..3, input lock
// 300 ms. Esc opens pause (the pick is mandatory). DOM rebuilds only when the view revision changes.

import type { ScreenId } from '../../core/dom.ts';
import type { WorldView } from '../../core/index.ts';
import { h, put } from '../dom.ts';
import { buildLevelUpModel, buildRewardModel } from '../presenters/choices.ts';
import type { ChoiceCard } from '../presenters/choices.ts';
import { rowCard, titleBlock } from './components.ts';
import { CHOICE_LOCK_MS } from './types.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

export function createChoiceScreen(ctx: UiContext, mode: 'levelUp' | 'reward'): Screen {
  const { doc, t, deps } = ctx;
  const el = h(
    doc,
    'div',
    `screen screen-choice screen-${mode === 'levelUp' ? 'temper' : 'reward'}`,
  );
  const focus = ctx.newFocusList();
  let revision = -1;
  let phaseRevision = -1;
  let count = 0;
  let picked = false;

  const pick = (choice: number): void => {
    if (picked || choice < 0 || choice >= count) return;
    if (ctx.inputLocked()) {
      ctx.sound(Cue.Denied);
      return;
    }
    picked = true;
    if (mode === 'levelUp') deps.commands.send({ type: 'levelup.pick', choice });
    else deps.commands.send({ type: 'reward.pick', choice });
  };

  const build = (view: WorldView): void => {
    el.textContent = '';
    focus.reset();
    picked = false;
    let title: HTMLElement;
    let cards: readonly ChoiceCard[];
    if (mode === 'levelUp') {
      const m = buildLevelUpModel(view, deps.data);
      revision = m.revision;
      const sub =
        m.queueTotal > 1
          ? `${t('ui.levelup.level', { n: m.level })}  ${t('ui.levelup.queue', { i: m.queueIndex, total: m.queueTotal })}`
          : t('ui.levelup.level', { n: m.level });
      title = titleBlock(ctx, t('ui.levelup.title'), sub);
      cards = m.cards;
    } else {
      const m = buildRewardModel(view, deps.data);
      revision = m.revision;
      const sub =
        m.sourceNameKey === null ? '' : t('ui.reward.subtitle', { name: t(m.sourceNameKey) });
      title = titleBlock(ctx, t('ui.reward.title'), sub);
      cards = m.cards;
    }
    count = cards.length;
    const list = h(doc, 'div', 'card-list');
    cards.forEach((c) => {
      const note =
        c.statChange === null
          ? ''
          : t('ui.levelup.stat_change', {
              stat: t(c.statChange.statKey),
              old: c.statChange.before,
              new: c.statChange.after,
            });
      const card = rowCard(ctx, {
        dataUi: `${mode === 'levelUp' ? 'temper' : 'reward'}-card-${String(c.choice + 1)}`,
        nameKey: c.nameKey,
        descKey: c.descKey,
        descParams: c.descParams,
        flavorKey: c.flavorKey,
        tags: c.tags,
        rarityOrder: c.rarityOrder,
        hotkey: c.choice + 1,
        note,
      });
      list.appendChild(card);
      focus.add({
        el: card,
        group: 0,
        activate: () => {
          pick(c.choice);
        },
      });
    });
    put(el, put(h(doc, 'div', 'safe choice-safe'), title, list));
    focus.focus(0, true);
  };

  return {
    el,
    focus,
    enter(_id: ScreenId) {
      const view = ctx.view();
      revision = -1;
      if (view !== null) {
        phaseRevision = view.phaseRevision;
        build(view);
      }
      ctx.lockInput(CHOICE_LOCK_MS);
    },
    update(view) {
      const rev = mode === 'levelUp' ? view.levelUp.revision : view.reward.revision;
      if (rev !== revision || view.phaseRevision !== phaseRevision) {
        // A new card set (next level in the queue) gets its own input lock.
        const fresh = view.phaseRevision !== phaseRevision || rev !== revision;
        phaseRevision = view.phaseRevision;
        build(view);
        if (fresh) ctx.lockInput(CHOICE_LOCK_MS);
      }
    },
    key(e) {
      const digit = /^Digit([1-9])$/.exec(e.code) ?? /^Numpad([1-9])$/.exec(e.code);
      if (digit?.[1] !== undefined) {
        const i = Number(digit[1]) - 1;
        if (i < count) {
          focus.focus(i, true);
          pick(i);
          return true;
        }
      }
      return false;
    },
    back() {
      ctx.sound(Cue.PauseOpen);
      deps.app.pause();
    },
  };
}
