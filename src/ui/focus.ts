// DOM focus list per screen (ui-spec 8.2): roving tabindex, hover moves focus, click activates.
// Layout is read only on a navigation key press, never per frame.

import { findNeighbor, nextGroupIndex } from './focus-nav.ts';
import type { Dir, NavRect } from './focus-nav.ts';

export interface FocusItem {
  readonly el: HTMLElement;
  readonly group: number;
  readonly activate: () => void;
  /** Called when this item gains focus (previews, info line). */
  readonly onFocus?: () => void;
}

export interface FocusList {
  add(item: FocusItem): number;
  reset(): void;
  focus(index: number, silent?: boolean): void;
  readonly index: number;
  readonly size: number;
  move(dir: Dir): boolean;
  cycleGroup(delta: 1 | -1): void;
  activate(): void;
  /** Index of the item whose element is el, -1 when absent. */
  indexOf(el: Element): number;
}

export interface FocusListOptions {
  /** Sound for a focus change (throttled by the caller). */
  readonly onMove: () => void;
  /** False while the input lock is active (ui-spec 8.4). */
  readonly canActivate: () => boolean;
  readonly onDenied: () => void;
}

export function createFocusList(opts: FocusListOptions): FocusList {
  let items: FocusItem[] = [];
  let index = -1;

  const focus = (i: number, silent = false): void => {
    const next = items[i];
    if (next === undefined) return;
    const prev = items[index];
    if (prev !== undefined && index !== i) {
      prev.el.tabIndex = -1;
      prev.el.classList.remove('is-focus');
    }
    const changed = index !== i;
    index = i;
    next.el.tabIndex = 0;
    next.el.classList.add('is-focus');
    next.el.focus({ preventScroll: true });
    if (changed) {
      next.onFocus?.();
      if (!silent) opts.onMove();
    }
  };

  const activate = (i: number): void => {
    const it = items[i];
    if (it === undefined) return;
    if (!opts.canActivate()) {
      opts.onDenied();
      return;
    }
    it.activate();
  };

  const rects = (): NavRect[] =>
    items.map((it) => {
      const r = it.el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, group: it.group };
    });

  return {
    add(item) {
      const i = items.length;
      items.push(item);
      item.el.tabIndex = -1;
      item.el.addEventListener('mouseenter', () => {
        focus(i);
      });
      item.el.addEventListener('click', (e) => {
        e.preventDefault();
        focus(i, true);
        activate(i);
      });
      return i;
    },
    reset() {
      items = [];
      index = -1;
    },
    focus,
    get index() {
      return index;
    },
    get size() {
      return items.length;
    },
    move(dir) {
      const next = findNeighbor(rects(), index, dir);
      if (next < 0 || next === index) return false;
      focus(next);
      return true;
    },
    cycleGroup(delta) {
      const next = nextGroupIndex(rects(), index, delta);
      if (next >= 0) focus(next);
    },
    activate() {
      activate(index);
    },
    indexOf(el) {
      return items.findIndex((it) => it.el === el);
    },
  };
}
