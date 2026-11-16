// S01 Title (ui-spec 5): Continue (only with a run save), New Run, The Keeping (tier B+), Settings,
// Credits. Initial focus: Continue when present, else New Run. A save that cannot be restored is
// dropped by app (boot.ts) and leaves us on the title: then ui.title.save_lost shows here.

import { button, h, put } from '../dom.ts';
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
    const notice = saveLost ? h(doc, 'p', 'title-notice', t('ui.title.save_lost')) : null;
    put(el, put(safe, head, menu, notice, version));
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
