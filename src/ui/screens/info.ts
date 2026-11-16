// Credits (and the M1 Keeping placeholder): title, short body, Back. The Keeping itself is
// screens/keeping.ts since M2-09; the full two-tab S09 screen (wireframe 09) stays with UI.

import { button, h, put } from '../dom.ts';
import { panel, titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

export function createInfoScreen(ctx: UiContext, kind: 'archive' | 'credits'): Screen {
  const { doc, t } = ctx;
  const el = h(doc, 'div', `screen screen-${kind}`);
  const focus = ctx.newFocusList();
  const back = (): void => {
    ctx.sound(Cue.Back);
    ctx.go('title');
  };
  return {
    el,
    focus,
    enter() {
      el.textContent = '';
      focus.reset();
      const title = kind === 'archive' ? t('ui.keeping.title') : t('ui.credits.title');
      const body = panel(ctx, 'info-body');
      body.appendChild(
        h(
          doc,
          'p',
          'info-text',
          kind === 'archive' ? t('ui.keeping.unknown') : t('ui.credits.body'),
        ),
      );
      const backBtn = button(doc, `${kind}-back`, t('ui.common.back'));
      focus.add({ el: backBtn, group: 0, activate: back });
      put(
        el,
        put(
          h(doc, 'div', 'safe info-safe'),
          titleBlock(ctx, title),
          body,
          put(h(doc, 'div', 'bottom-bar'), backBtn),
        ),
      );
      focus.focus(0, true);
    },
    back,
  };
}
