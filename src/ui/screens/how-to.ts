// How to play (redesign-1.1 3.4): four short panels with icons (move, skill, waves, shop). Opens
// from the title and the pause menu, and once by itself before the very first run: then "Got it"
// goes on to class select. Esc / Backspace / Back return where it was opened. Showing it sets
// Settings.seenHowTo, so the automatic showing never repeats.

import type { AppScreen } from '../../core/dom.ts';
import { button, h, put } from '../dom.ts';
import { howToPanels, markHowToSeen } from '../presenters/how-to.ts';
import type { HowToPanelId } from '../presenters/how-to.ts';
import { glintIcon, iconBox, titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

/** Panel art box in UI units (24 x 24 sprites at an integer scale). */
const ART_UNITS = 24;

export function createHowToScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-howto');
  el.dataset['ui'] = 'howto';
  const focus = ctx.newFocusList();
  /** "Got it" target and the Back target, read on enter. */
  let next: AppScreen = 'title';
  let backTo: AppScreen = 'title';

  const leaveTo = (screen: AppScreen, cue: string): void => {
    ctx.sound(cue);
    ctx.go(screen);
  };

  /** Art for one panel: the hero, a weapon with the skill, gold, the shopkeeper. */
  const art = (id: HowToPanelId): HTMLElement => {
    const wrap = h(doc, 'span', `howto-art howto-art-${id}`);
    wrap.setAttribute('aria-hidden', 'true');
    const cls =
      deps.data.classes.find((c) => c.id === deps.meta().lastClassId) ??
      [...deps.data.classes].sort((a, b) => a.sort - b.sort)[0];
    const frame = (child: HTMLElement | null): HTMLElement => {
      const box = h(doc, 'span', 'icon icon-big howto-icon');
      if (child !== null) {
        box.classList.add('has-art');
        box.appendChild(child);
      }
      return box;
    };
    if (id === 'move') {
      wrap.appendChild(
        frame(cls === undefined ? null : ctx.icons.sprite(doc, `kept-${cls.id}`, ART_UNITS)),
      );
      const weapon = deps.data.weapons.find((w) => w.id === cls?.startWeapon);
      if (weapon !== undefined)
        wrap.appendChild(
          iconBox(ctx, { kind: 'weapon', id: weapon.id }, t(weapon.nameKey), weapon.tags, 'big'),
        );
    } else if (id === 'skill') {
      const rite = deps.data.rites.find((r) => r.id === cls?.riteId);
      if (rite !== undefined)
        wrap.appendChild(iconBox(ctx, { kind: 'rite', id: rite.id }, t(rite.nameKey), [], 'big'));
      wrap.appendChild(h(doc, 'span', 'chip howto-key', ctx.keyHint('rite')));
    } else if (id === 'wave') {
      wrap.appendChild(frame(glintIcon(ctx, ART_UNITS)));
    } else {
      wrap.appendChild(frame(ctx.icons.portrait(doc, 'glazier', ART_UNITS)));
    }
    return wrap;
  };

  const enter = (): void => {
    el.textContent = '';
    focus.reset();
    next = ctx.howToNext();
    backTo = ctx.previous() === 'paused' ? 'paused' : 'title';
    // Seen once it is on screen, whichever way the player leaves it.
    const s = deps.settings();
    const seen = markHowToSeen(s);
    if (seen !== s) ctx.applySettings(seen);

    const grid = h(doc, 'div', 'howto-grid');
    howToPanels(deps.settings().keybinds).forEach((p, i) => {
      const card = h(doc, 'section', `panel howto-panel reveal`);
      card.style.setProperty('--i', String(i));
      card.dataset['ui'] = `howto-${p.id}`;
      const head = put(
        h(doc, 'div', 'howto-head'),
        h(doc, 'span', 'chip howto-step', String(i + 1)),
        h(doc, 'h2', 'howto-title', t(p.titleKey)),
      );
      put(grid, put(card, art(p.id), head, h(doc, 'p', 'howto-text', t(p.textKey, p.params))));
    });

    const ok = button(doc, 'howto-ok', t('ui.howto.ok'), 'primary');
    focus.add({
      el: ok,
      group: 0,
      activate: () => {
        leaveTo(next, Cue.Confirm);
      },
    });
    const bar = put(h(doc, 'div', 'bottom-bar howto-bar'), ok);
    put(el, put(h(doc, 'div', 'safe howto-safe'), titleBlock(ctx, t('ui.howto.title')), grid, bar));
    focus.focus(0, true);
  };

  return {
    el,
    focus,
    enter,
    back() {
      leaveTo(backTo, Cue.Back);
    },
  };
}
