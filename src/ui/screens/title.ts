// S01 Title (ui-spec 5): Continue (only with a run save), New Run, The Keeping (tier B+), Settings,
// Credits. Initial focus: Continue when present, else New Run. A save that cannot be restored is
// dropped by app (boot.ts) and leaves us on the title: then ui.title.save_lost shows here.

import { button, h, put } from '../dom.ts';
import { keyLabel } from '../format.ts';
import { moveKeysText } from '../presenters/hud-transient.ts';
import { titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

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
    const menu = h(doc, 'nav', 'menu panel glass');
    const add = (dataUi: string, key: string, run: () => void): void => {
      const b = button(doc, dataUi, t(key));
      menu.appendChild(b);
      focus.add({ el: b, group: 0, activate: run });
    };
    const meta = deps.meta();
    if (meta.hasRunSave) {
      add('title-continue', 'ui.title.continue', () => {
        ctx.sound(Cue.Confirm);
        deps.app.continueRun();
        // Success switches to the run (this element leaves the DOM). Still here without a save:
        // app could not restore it and already removed it (review M1 LP).
        if (el.isConnected && !deps.meta().hasRunSave) {
          saveLost = true;
          enter();
          ctx.announce(t('ui.title.save_lost'));
        }
      });
    }
    add('title-new-run', 'ui.title.begin', () => {
      ctx.sound(Cue.Confirm);
      ctx.go('classSelect');
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
    const head = titleBlock(ctx, t('ui.title.name'), t('ui.title.tagline'));
    head.classList.add('title-head');
    const version = h(
      doc,
      'p',
      'version-label',
      t('ui.title.version', { version: deps.data.meta.contentHash.slice(0, 8) }),
    );
    // Bottom left (M4-02): credit and version line, and the run controls from the active bindings.
    const kb = deps.settings().keybinds;
    const controls = t('ui.title.controls', {
      move: moveKeysText([
        keyLabel(kb.moveUp[0]),
        keyLabel(kb.moveLeft[0]),
        keyLabel(kb.moveDown[0]),
        keyLabel(kb.moveRight[0]),
      ]),
      rite: keyLabel(kb.rite[0]),
      pause: keyLabel(kb.pause[0]),
    });
    const foot = put(
      h(doc, 'div', 'title-foot'),
      h(doc, 'p', 'title-controls', controls),
      h(doc, 'p', 'title-credit', t('ui.title.credit_line')),
    );
    const notice = saveLost ? h(doc, 'p', 'title-notice', t('ui.title.save_lost')) : null;
    // Silt balance top right while Silt exists (tiers B and C, ui-spec S01).
    const silt =
      deps.data.meta.contentTier !== 'A'
        ? h(doc, 'p', 'title-silt', t('ui.common.silt', { n: meta.silt }))
        : null;
    put(el, put(safe, head, menu, notice, silt, foot, version));
    focus.focus(0, true);
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
