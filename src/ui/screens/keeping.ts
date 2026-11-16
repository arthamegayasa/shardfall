// S09 The Keeping (identifier `archive`, ui-spec S09, wireframe 09): Silt balance top right and two
// tabs (Q / E). Kept: one row per meta unlock with its icon, name, kind, and Silt price, and the
// no-dialog purchase pattern (Unlock once, the row turns into "Press again" for 3 s, press again to
// buy). Mementos: grid of every Memento with a found counter; found ones show their icon, unknown
// ones a silhouette and "???"; the detail panel shows name, effect, tags, and flavor of the focus.

import { classUnlock, unlockCost, unlockStatus } from '../../content/index.ts';
import type { MetaUnlockDef } from '../../content/index.ts';
import type { MetaSave } from '../../core/index.ts';
import { button, h, put } from '../dom.ts';
import { Cue } from '../cues.ts';
import { iconBox, panel, tagChips, titleBlock } from './components.ts';
import type { IconRef } from '../icons.ts';
import { KEEPING_TABS, mementoArchive, nextKeepingTab } from '../presenters/keeping.ts';
import type { KeepingTab, MementoArchiveEntry } from '../presenters/keeping.ts';
import type { Screen, UiContext } from './types.ts';

/** "Press again" window of the Silt purchase (ui-spec S09). */
const CONFIRM_MS = 3000;
/** Class portrait box in UI units (24 x 24 sprite at 1x). */
const PORTRAIT_UNITS = 24;
/** Focus groups: list or grid, bottom bar, tab buttons. */
const GROUP_BODY = 0;
const GROUP_BAR = 1;
const GROUP_TABS = 2;

export function createKeepingScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-archive screen-keeping');
  const focus = ctx.newFocusList();
  let armed = '';
  let armedTimer = 0;
  let focusId = '';
  let tab: KeepingTab = 'kept';
  let mementoFocusId = '';
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
      ctx.sound(Cue.Unlock);
      ctx.announce(t('ui.keeping.unlocked', { name: nameOf(u) }));
    } else {
      ctx.sound(Cue.Denied);
    }
    build();
  };

  const switchTab = (next: KeepingTab): void => {
    disarm();
    tab = next;
    ctx.sound(Cue.Toggle);
    build();
  };

  const tabBar = (): HTMLElement => {
    const tabs = h(doc, 'div', 'tabs keeping-tabs');
    for (const tb of KEEPING_TABS) {
      const b = button(
        doc,
        `keeping-tab-${tb.id}`,
        t(tb.labelKey),
        tb.id === tab ? 'tab is-active' : 'tab',
      );
      b.setAttribute('aria-pressed', tb.id === tab ? 'true' : 'false');
      tabs.appendChild(b);
      focus.add({
        el: b,
        group: GROUP_TABS,
        activate: () => {
          if (tab !== tb.id) switchTab(tb.id);
        },
      });
    }
    return tabs;
  };

  /** Kept tab: one row per meta unlock, plus the focus index to start on (-1 for none). */
  const keptBody = (meta: MetaSave): { body: HTMLElement; first: number } => {
    const list = panel(ctx, 'keeping-list');
    const rows = deps.data.metaUnlocks;
    let first = -1;
    if (rows.length === 0) list.appendChild(h(doc, 'p', 'info-text', t('ui.keeping.empty')));
    rows.forEach((u) => {
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
      const i = focus.add({
        el: row,
        group: GROUP_BODY,
        activate: () => {
          focusId = u.id;
          buy(u);
        },
        onFocus: () => {
          focusId = u.id;
        },
      });
      if (first < 0 || u.id === focusId) first = i;
    });
    return { body: list, first };
  };

  /** Detail panel of one archive cell (ui-spec S09 right column). */
  const fillDetail = (detail: HTMLElement, e: MementoArchiveEntry): void => {
    detail.textContent = '';
    const name = e.nameKey === null ? t('ui.keeping.unknown_name') : t(e.nameKey);
    const icon = iconBox(ctx, e.icon, name, e.tags, 'big');
    if (!e.found) icon.classList.add('is-unknown');
    const text = put(h(doc, 'div', 'keeping-text'), h(doc, 'span', 'item-name', name));
    if (e.tags.length > 0) text.appendChild(tagChips(ctx, e.tags));
    detail.appendChild(put(h(doc, 'div', 'keeping-detail-head'), icon, text));
    if (!e.found) {
      detail.appendChild(h(doc, 'p', 'keeping-detail-unknown dim', t('ui.keeping.unknown')));
      return;
    }
    if (e.descKey !== null)
      detail.appendChild(h(doc, 'p', 'item-effect', t(e.descKey, e.descParams)));
    if (e.flavorKey !== null)
      detail.appendChild(h(doc, 'p', 'card-flavor keeping-flavor', t(e.flavorKey)));
  };

  /** Mementos tab: found counter, icon grid, detail panel, plus the focus index to start on. */
  const mementoBody = (meta: MetaSave): { body: HTMLElement; first: number } => {
    const archive = mementoArchive(deps.data, meta.mementosFound);
    const unknown = t('ui.keeping.unknown_name');
    const count = h(
      doc,
      'p',
      'keeping-found',
      t('ui.keeping.found', { n: archive.found, total: archive.total }),
    );
    count.dataset['ui'] = 'keeping-found';
    const grid = h(doc, 'div', 'keeping-grid');
    const detail = panel(ctx, 'keeping-detail', true);
    detail.dataset['ui'] = 'keeping-detail';
    let first = -1;
    archive.entries.forEach((e) => {
      const name = e.nameKey === null ? unknown : t(e.nameKey);
      const cell = button(
        doc,
        `keeping-memento-${e.id}`,
        '',
        `keeping-cell ${e.found ? 'is-found' : 'is-unknown'}`,
      );
      cell.textContent = '';
      cell.setAttribute('aria-label', e.found ? name : `${unknown}, ${t('ui.keeping.unknown')}`);
      const icon = iconBox(ctx, e.icon, name, e.tags, 'big');
      if (!e.found) icon.classList.add('is-unknown');
      cell.appendChild(icon);
      grid.appendChild(cell);
      const i = focus.add({
        el: cell,
        group: GROUP_BODY,
        activate: () => {
          ctx.sound(e.found ? Cue.Confirm : Cue.Denied);
        },
        onFocus: () => {
          mementoFocusId = e.id;
          fillDetail(detail, e);
        },
      });
      if (first < 0 || e.id === mementoFocusId) first = i;
    });
    const shown = archive.entries.find((e) => e.id === mementoFocusId) ?? archive.entries[0];
    if (shown === undefined) detail.appendChild(h(doc, 'p', 'info-text', t('ui.keeping.empty')));
    else fillDetail(detail, shown);
    const gridPanel = put(panel(ctx, 'keeping-grid-panel'), count, grid);
    return { body: put(h(doc, 'div', 'keeping-archive'), gridPanel, detail), first };
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
    const tabs = tabBar();
    const { body, first } = tab === 'kept' ? keptBody(meta) : mementoBody(meta);
    const backBtn = button(doc, 'archive-back', t('ui.common.back'));
    const backIndex = focus.add({ el: backBtn, group: GROUP_BAR, activate: back });
    put(el, put(safe, head, tabs, body, put(h(doc, 'div', 'bottom-bar'), backBtn)));
    focus.focus(first >= 0 ? first : backIndex, true);
  };

  return {
    el,
    focus,
    enter() {
      disarm();
      tab = 'kept';
      build();
    },
    leave() {
      disarm();
    },
    key(e) {
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        switchTab(nextKeepingTab(tab, e.code === 'KeyQ' ? -1 : 1));
        return true;
      }
      return false;
    },
    back,
  };
}

/** Price label of a locked class for the class list ("40 Silt"), or '' when it has no unlock. */
export function classPriceText(ctx: UiContext, classId: string): string {
  const u = classUnlock(ctx.deps.data, classId);
  return u === undefined ? '' : ctx.t('ui.common.silt', { n: unlockCost(ctx.deps.data, u) });
}
