// S04 Level up (was Temper) and S04b Elite reward (ui-spec 5, redesign-1.1 3.3). Three glass panes
// side by side across the width: upgrade cyan for level up, relic green for the reward. Keys 1..3
// pick, Left / Right follow the visual order and Up / Down step through the same row. Input lock
// 300 ms. Esc opens pause (the pick is mandatory). DOM rebuilds only when the view revision changes.

import type { ScreenId } from '../../core/dom.ts';
import { SimEventType } from '../../core/index.ts';
import type { WorldView } from '../../core/index.ts';
import { button, h, put } from '../dom.ts';
import { menuIntent } from '../menu-keys.ts';
import { buildLevelUpModel, buildRewardModel } from '../presenters/choices.ts';
import type { ChoiceCard } from '../presenters/choices.ts';
import { iconBox, pane, rarityPips, tagChips } from './components.ts';
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

  /** One choice as a focusable glass pane: hotkey badge on the strip, big icon, name, effect. */
  const card = (c: ChoiceCard): HTMLButtonElement => {
    const upgrade = mode === 'levelUp';
    const root = button(
      doc,
      `${upgrade ? 'temper' : 'reward'}-card-${String(c.choice + 1)}`,
      '',
      `choice-card rarity-${String(c.rarityOrder)} reveal`,
    );
    root.style.setProperty('--i', String(c.choice));
    const p = pane(
      doc,
      upgrade ? 'upgrade' : 'relic',
      t(upgrade ? 'ui.choice.upgrade' : 'ui.choice.relic'),
      String(c.choice + 1),
      root,
    );
    p.badge?.classList.add('choice-key');
    const name = t(c.nameKey);
    const top = put(
      h(doc, 'span', 'choice-top'),
      iconBox(ctx, c.icon, name, c.tags, 'big'),
      rarityPips(ctx, c.rarityOrder, true),
    );
    const effect = h(doc, 'span', 'choice-effect', t(c.descKey, c.descParams));
    put(p.body, top, h(doc, 'span', 'choice-name', name), effect);
    if (c.statChange !== null) {
      p.body.appendChild(
        h(
          doc,
          'span',
          'choice-change t-dim',
          t('ui.levelup.stat_change', {
            stat: t(c.statChange.statKey),
            old: c.statChange.before,
            new: c.statChange.after,
          }),
        ),
      );
    }
    if (c.tags.length > 0) p.body.appendChild(tagChips(ctx, c.tags));
    if (c.flavorKey !== null && deps.settings().access.showFlavor)
      p.body.appendChild(h(doc, 'span', 'choice-flavor t-dim', t(c.flavorKey)));
    return root;
  };

  const build = (view: WorldView): void => {
    el.textContent = '';
    focus.reset();
    picked = false;
    let cards: readonly ChoiceCard[];
    const head = h(doc, 'div', 'choice-head');
    if (mode === 'levelUp') {
      const m = buildLevelUpModel(view, deps.data);
      revision = m.revision;
      // "Choose 1 upgrade" plus how many level ups wait behind this one (no "Lv 2 / 1 of 2").
      put(
        head,
        h(doc, 'h1', 'heading choice-title', t('ui.levelup.title')),
        h(doc, 'p', 'choice-sub', t('ui.levelup.subtitle')),
        m.waiting > 0
          ? h(doc, 'p', 'chip choice-waiting', t('ui.levelup.waiting', { n: m.waiting }))
          : null,
      );
      cards = m.cards;
    } else {
      const m = buildRewardModel(view, deps.data);
      revision = m.revision;
      put(
        head,
        h(doc, 'h1', 'heading choice-title', t('ui.reward.title')),
        m.sourceNameKey === null
          ? null
          : h(doc, 'p', 'choice-sub', t('ui.reward.subtitle', { name: t(m.sourceNameKey) })),
      );
      cards = m.cards;
    }
    count = cards.length;
    const list = h(doc, 'div', 'choice-row');
    list.style.setProperty('--n', String(Math.max(1, count)));
    cards.forEach((c) => {
      const el2 = card(c);
      list.appendChild(el2);
      focus.add({
        el: el2,
        group: 0,
        activate: () => {
          pick(c.choice);
        },
      });
    });
    put(el, put(h(doc, 'div', 'safe choice-safe'), head, list));
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
    update(view, events) {
      // A rejected pick (e.g. the sim moved on) must not leave the cards dead until a new revision.
      for (let i = 0; i < events.count; i++)
        if (events.type[i] === SimEventType.CommandRejected) picked = false;
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
      // The cards are one row: Up / Down step to the previous / next card (Left / Right move
      // spatially through the same order), so a vertical habit still reaches every card.
      const intent = menuIntent(e.code, e.shiftKey, deps.settings().keybinds);
      if ((intent === 'up' || intent === 'down') && count > 0) {
        const next = Math.min(count - 1, Math.max(0, focus.index + (intent === 'down' ? 1 : -1)));
        if (next !== focus.index) focus.focus(next);
        return true;
      }
      return false;
    },
    back() {
      ctx.sound(Cue.PauseOpen);
      deps.app.pause();
    },
  };
}
