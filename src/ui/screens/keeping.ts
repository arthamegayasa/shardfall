// S09 The Keeping (identifier `archive`), minimal M2-09 version (LP for the tier B activation; the
// full two-tab screen of ui-spec S09 and wireframe 09 stays with UI): Silt balance top right, one row
// per meta unlock with its icon, name, kind, and Silt price, and the no-dialog purchase pattern of
// ui-spec S09 (Unlock once, the row turns into "Press again" for 3 s, press again to buy).

import { classUnlock, unlockCost, unlockStatus } from '../../content/index.ts';
import type { MetaUnlockDef } from '../../content/index.ts';
import type { MetaSave } from '../../core/index.ts';
import { button, h, put } from '../dom.ts';
import { Cue } from '../cues.ts';
import { iconBox, panel, titleBlock } from './components.ts';
import type { IconRef } from '../icons.ts';
import type { Screen, UiContext } from './types.ts';

/** "Press again" window of the Silt purchase (ui-spec S09). */
const CONFIRM_MS = 3000;
/** Class portrait box in UI units (24 x 24 sprite at 1x). */
const PORTRAIT_UNITS = 24;

export function createKeepingScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-archive screen-keeping');
  const focus = ctx.newFocusList();
  let armed = '';
  let armedTimer = 0;
  let focusId = '';
  const win = doc.defaultView;

  const metaSave = (): MetaSave => {
    const m = deps.meta();
    return {
      v: 1,
      silt: m.silt,
      unlocked: m.unlocked,
      mementosFound: m.mementosFound,
      highestDifficultyWon: m.highestDifficultyWon,
      lastClassId: m.lastClassId,
      runs: m.runs ?? 0,
    };
  };

  const disarm = (): void => {
    if (armedTimer !== 0) win?.clearTimeout(armedTimer);
    armedTimer = 0;
    armed = '';
  };

  const back = (): void => {
    disarm();
    ctx.sound(Cue.Back);
    // Back where it was opened: run end (app screen 'run' in victory or defeat), class select, title.
    const prev = ctx.previous();
    ctx.go(prev === 'run' || prev === 'runEnd' || prev === 'classSelect' ? prev : 'title');
  };

  /** Display name of an unlock: the class or weapon name, or the Memento names of a pack. */
  const nameOf = (u: MetaUnlockDef): string => {
    if (u.kind === 'class') {
      const c = deps.data.classes.find((x) => x.id === u.targets[0]);
      return c === undefined ? u.id : t(c.nameKey);
    }
    if (u.kind === 'weapon') {
      const w = deps.data.weapons.find((x) => x.id === u.targets[0]);
      return w === undefined ? u.id : t(w.nameKey);
    }
    const names = u.targets.flatMap((id) => {
      const m = deps.data.mementos.find((x) => x.id === id);
      return m === undefined ? [] : [t(m.nameKey)];
    });
    return names.join(', ');
  };

  const kindLabel = (u: MetaUnlockDef): string =>
    t(
      u.kind === 'class'
        ? 'ui.keeping.kind_class'
        : u.kind === 'weapon'
          ? 'ui.keeping.kind_weapon'
          : 'ui.keeping.kind_pack',
    );

  const iconFor = (u: MetaUnlockDef): HTMLElement => {
    if (u.kind === 'class') {
      const art = ctx.icons.sprite(doc, `kept-${u.targets[0] ?? ''}`, PORTRAIT_UNITS);
      const box = h(doc, 'span', 'icon icon-big has-art');
      box.setAttribute('aria-hidden', 'true');
      if (art !== null) box.appendChild(art);
      return box;
    }
    const id = u.targets[0] ?? '';
    const ref: IconRef = { kind: u.kind === 'weapon' ? 'weapon' : 'memento', id };
    return iconBox(ctx, ref, nameOf(u), [], 'big');
  };

  const buy = (u: MetaUnlockDef): void => {
    const status = unlockStatus(deps.data, metaSave(), u.id);
    if (status === 'owned' || status === 'unknown') {
      ctx.sound(Cue.Denied);
      return;
    }
    if (status === 'poor') {
      ctx.sound(Cue.Denied);
      ctx.announce(t('ui.keeping.no_silt'));
      return;
    }
    if (armed !== u.id) {
      disarm();
      armed = u.id;
      ctx.sound(Cue.Confirm);
      ctx.announce(t('ui.common.press_again'));
      armedTimer =
        win?.setTimeout(() => {
          armedTimer = 0;
          armed = '';
          build();
        }, CONFIRM_MS) ?? 0;
      build();
      return;
    }
    disarm();
    if (deps.app.unlock(u.id)) {
      ctx.sound(Cue.Confirm);
      ctx.announce(t('ui.keeping.unlocked', { name: nameOf(u) }));
    } else {
      ctx.sound(Cue.Denied);
    }
    build();
  };

  const build = (): void => {
    el.textContent = '';
    focus.reset();
    const meta = metaSave();
    const safe = h(doc, 'div', 'safe keeping-safe');
    const head = h(doc, 'div', 'keeping-head');
    const silt = h(doc, 'p', 'keeping-silt', t('ui.common.silt', { n: meta.silt }));
    silt.dataset['ui'] = 'keeping-silt';
    put(head, titleBlock(ctx, t('ui.keeping.title')), silt);
    const list = panel(ctx, 'keeping-list');
    const rows = deps.data.metaUnlocks;
    let initial = 0;
    if (rows.length === 0) list.appendChild(h(doc, 'p', 'info-text', t('ui.keeping.empty')));
    rows.forEach((u, i) => {
      const status = unlockStatus(deps.data, meta, u.id);
      const cost = unlockCost(deps.data, u);
      const row = button(doc, `keeping-${u.id}`, '', `keeping-row is-${status}`);
      row.textContent = '';
      const text = h(doc, 'span', 'keeping-text');
      put(
        text,
        h(doc, 'span', 'item-name', nameOf(u)),
        h(doc, 'span', 'keeping-kind dim', kindLabel(u)),
      );
      const price =
        status === 'owned'
          ? t('ui.keeping.owned')
          : armed === u.id
            ? t('ui.common.press_again')
            : `${t('ui.keeping.unlock')}  ${t('ui.common.silt', { n: cost })}`;
      const side = h(doc, 'span', 'keeping-price', price);
      if (armed === u.id) row.classList.add('is-armed');
      put(row, iconFor(u), text, side);
      list.appendChild(row);
      focus.add({
        el: row,
        group: 0,
        activate: () => {
          focusId = u.id;
          buy(u);
        },
        onFocus: () => {
          focusId = u.id;
        },
      });
      if (u.id === focusId) initial = i;
    });
    const backBtn = button(doc, 'archive-back', t('ui.common.back'));
    focus.add({ el: backBtn, group: 1, activate: back });
    put(el, put(safe, head, list, put(h(doc, 'div', 'bottom-bar'), backBtn)));
    focus.focus(rows.length > 0 ? initial : 0, true);
  };

  return {
    el,
    focus,
    enter() {
      disarm();
      build();
    },
    leave() {
      disarm();
    },
    back,
  };
}

/** Price label of a locked class for the class list ("40 Silt"), or '' when it has no unlock. */
export function classPriceText(ctx: UiContext, classId: string): string {
  const u = classUnlock(ctx.deps.data, classId);
  return u === undefined ? '' : ctx.t('ui.common.silt', { n: unlockCost(ctx.deps.data, u) });
}
