// S01 Title (ui-spec 5, redesign-1.1 3.4): logo at display size with the tagline, then the menu
// Continue (only with a run save), New run, How to play, Unlocks (tier B+), Settings, Credits, all
// left-aligned on one vertical axis so the arena shows on the right. Initial focus: Continue when
// present, else New run; back from a menu screen, the item that opened it. The first New run ever
// shows How to play before class select. A save that cannot be restored is dropped by app
// (boot.ts) and leaves us on the title: then ui.title.save_lost shows here.

import { button, h, put } from '../dom.ts';
import { keyLabel } from '../format.ts';
import { shouldShowHowTo } from '../presenters/how-to.ts';
import { moveKeysText } from '../presenters/hud-transient.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

/** Title menu items that open a screen which returns here (focus comes back to them). */
const RETURN_FOCUS: Readonly<Record<string, string>> = {
  howTo: 'title-howto',
  settings: 'title-settings',
  credits: 'title-credits',
  archive: 'title-keeping',
};

export function createTitleScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-title');
  const focus = ctx.newFocusList();
  /** The last Continue failed: show ui.title.save_lost until the title is left. */
  let saveLost = false;

  const enter = (): void => {
    el.textContent = '';
    focus.reset();
    const safe = h(doc, 'div', 'safe title-safe');
    const menu = h(doc, 'nav', 'menu title-menu');
    const add = (dataUi: string, key: string, run: () => void, primary = false): void => {
      const b = button(doc, dataUi, t(key), primary ? 'primary' : '');
      menu.appendChild(b);
      focus.add({ el: b, group: 0, activate: run });
    };
    const meta = deps.meta();
    if (meta.hasRunSave) {
      add(
        'title-continue',
        'ui.title.continue',
        () => {
          ctx.sound(Cue.Confirm);
          deps.app.continueRun();
          // Success switches to the run (this element leaves the DOM). Still here without a save:
          // app could not restore it and already removed it (review M1 LP).
          if (el.isConnected && !deps.meta().hasRunSave) {
            saveLost = true;
            enter();
            ctx.announce(t('ui.title.save_lost'));
          }
        },
        true,
      );
    }
    add(
      'title-new-run',
      'ui.title.begin',
      () => {
        ctx.sound(Cue.Confirm);
        // First run ever: How to play first, its "Got it" goes on to class select.
        if (shouldShowHowTo(deps.settings())) ctx.openHowTo('classSelect');
        else ctx.go('classSelect');
      },
      !meta.hasRunSave,
    );
    add('title-howto', 'ui.title.howto', () => {
      ctx.sound(Cue.Confirm);
      ctx.openHowTo();
    });
    if (deps.data.meta.contentTier !== 'A') {
      add('title-keeping', 'ui.title.keeping', () => {
        ctx.sound(Cue.Confirm);
        deps.app.openArchive();
      });
    }
    add('title-settings', 'ui.title.settings', () => {
      ctx.sound(Cue.Confirm);
      deps.app.openSettings();
    });
    add('title-credits', 'ui.title.credits', () => {
      ctx.sound(Cue.Confirm);
      ctx.go('credits');
    });
    const head = put(
      h(doc, 'div', 'title-head'),
      h(doc, 'h1', 't-display title-logo', t('ui.title.name')),
      h(doc, 'p', 'title-tagline', t('ui.title.tagline')),
    );
    const version = h(
      doc,
      'p',
      'version-label',
      t('ui.title.version', { version: deps.data.meta.contentHash.slice(0, 8) }),
    );
    // Foot (M4-02): the run controls from the active bindings as plain chips and the credit line
    // bottom left, the build id bottom right. It is in the flow, so large text never overlaps.
    const kb = deps.settings().keybinds;
    const chips = put(
      h(doc, 'div', 'title-controls'),
      h(
        doc,
        'span',
        'chip',
        t('ui.title.chip_move', {
          keys: moveKeysText([
            keyLabel(kb.moveUp[0]),
            keyLabel(kb.moveLeft[0]),
            keyLabel(kb.moveDown[0]),
            keyLabel(kb.moveRight[0]),
          ]),
        }),
      ),
      h(doc, 'span', 'chip', t('ui.title.chip_rite', { key: keyLabel(kb.rite[0]) })),
      h(doc, 'span', 'chip', t('ui.title.chip_pause', { key: keyLabel(kb.pause[0]) })),
    );
    const foot = put(
      h(doc, 'div', 'title-foot'),
      put(
        h(doc, 'div', 'title-foot-left'),
        chips,
        h(doc, 'p', 'title-credit', t('ui.title.credit_line', { version: __APP_VERSION__ })),
      ),
      version,
    );
    const notice = saveLost ? h(doc, 'p', 'title-notice', t('ui.title.save_lost')) : null;
    // Silt balance top right while Silt exists (tiers B and C, ui-spec S01).
    const silt =
      deps.data.meta.contentTier !== 'A'
        ? h(doc, 'p', 'title-silt', t('ui.common.silt', { n: meta.silt }))
        : null;
    put(el, put(safe, put(h(doc, 'div', 'title-col'), head, menu, notice), silt, foot));
    const back = RETURN_FOCUS[ctx.previous()];
    const prev = back === undefined ? null : menu.querySelector(`[data-ui="${back}"]`);
    const i = prev === null ? -1 : focus.indexOf(prev);
    focus.focus(i >= 0 ? i : 0, true);
  };

  return {
    el,
    focus,
    enter,
    leave() {
      saveLost = false;
    },
  };
}
