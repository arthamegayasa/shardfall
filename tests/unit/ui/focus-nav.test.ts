import { describe, expect, it } from 'vitest';
import { Dir, findNeighbor, nextGroupIndex } from '../../../src/ui/focus-nav.ts';
import type { NavMemory, NavRect } from '../../../src/ui/focus-nav.ts';
import { choiceLockApplies, menuIntent } from '../../../src/ui/menu-keys.ts';
import { defaultSettings } from '../../../src/app/settings.ts';

const r = (x: number, y: number, group: number, w = 10, h = 10): NavRect => ({ x, y, w, h, group });

// Glazier-like layout: offers column (group 0) with lock buttons, slot grid (group 1), bar (group 2).
const SHOP: NavRect[] = [
  r(100, 0, 0, 80, 20), // 0 offer 1
  r(190, 0, 0), // 1 lock 1
  r(100, 30, 0, 80, 20), // 2 offer 2
  r(190, 30, 0), // 3 lock 2
  r(300, 0, 1), // 4 slot 1
  r(320, 0, 1), // 5 slot 2
  r(300, 20, 1), // 6 slot 4
  r(100, 100, 2), // 7 reroll
  r(300, 100, 2), // 8 begin
];

describe('spatial focus navigation', () => {
  it('moves down a column inside the group', () => {
    expect(findNeighbor(SHOP, 0, Dir.Down)).toBe(2);
    expect(findNeighbor(SHOP, 2, Dir.Up)).toBe(0);
  });

  it('moves right from a card to its lock button before leaving the group', () => {
    expect(findNeighbor(SHOP, 0, Dir.Right)).toBe(1);
  });

  it('crosses to the neighbouring group only at the edge', () => {
    expect(findNeighbor(SHOP, 1, Dir.Right)).toBe(4);
    expect(findNeighbor(SHOP, 2, Dir.Down)).toBe(7);
  });

  it('navigates a slot grid by rows and columns', () => {
    expect(findNeighbor(SHOP, 4, Dir.Right)).toBe(5);
    expect(findNeighbor(SHOP, 4, Dir.Down)).toBe(6);
    expect(findNeighbor(SHOP, 6, Dir.Up)).toBe(4);
  });

  it('returns -1 when nothing lies in that direction', () => {
    expect(findNeighbor(SHOP, 0, Dir.Up)).toBe(-1);
    expect(findNeighbor(SHOP, 8, Dir.Down)).toBe(-1);
  });

  it('starts at the first item when nothing is focused and handles an empty list', () => {
    expect(findNeighbor(SHOP, -1, Dir.Down)).toBe(0);
    expect(findNeighbor([], 0, Dir.Down)).toBe(-1);
  });

  it('cycles focus groups with Tab and Shift+Tab', () => {
    expect(nextGroupIndex(SHOP, 2, 1)).toBe(4);
    expect(nextGroupIndex(SHOP, 4, 1)).toBe(7);
    expect(nextGroupIndex(SHOP, 7, 1)).toBe(0);
    expect(nextGroupIndex(SHOP, 0, -1)).toBe(7);
    expect(nextGroupIndex([], 0, 1)).toBe(-1);
  });
});

describe('menu key intents', () => {
  const binds = defaultSettings(false).keybinds;

  it('navigates with arrows and WASD', () => {
    expect(menuIntent('ArrowUp', false, binds)).toBe('up');
    expect(menuIntent('KeyW', false, binds)).toBe('up');
    expect(menuIntent('KeyS', false, binds)).toBe('down');
    expect(menuIntent('KeyA', false, binds)).toBe('left');
    expect(menuIntent('KeyD', false, binds)).toBe('right');
  });

  it('confirms with Enter or Space and goes back with Esc or Backspace', () => {
    expect(menuIntent('Enter', false, binds)).toBe('confirm');
    expect(menuIntent('Space', false, binds)).toBe('confirm');
    expect(menuIntent('Escape', false, binds)).toBe('back');
    expect(menuIntent('Backspace', false, binds)).toBe('back');
  });

  it('keeps Enter and Esc as a fixed safe path even when confirm and back are remapped', () => {
    const remapped = {
      ...binds,
      confirm: ['KeyJ', null] as const,
      back: ['KeyK', null] as const,
    };
    expect(menuIntent('Enter', false, remapped)).toBe('confirm');
    expect(menuIntent('Escape', false, remapped)).toBe('back');
    expect(menuIntent('KeyJ', false, remapped)).toBe('confirm');
  });

  it('maps Tab and Shift+Tab to group cycling and ignores unrelated keys', () => {
    expect(menuIntent('Tab', false, binds)).toBe('nextGroup');
    expect(menuIntent('Tab', true, binds)).toBe('prevGroup');
    expect(menuIntent('KeyR', false, binds)).toBeNull();
  });
});

describe('choice input lock (ui-spec 8.4, LP M2-09)', () => {
  it('applies after run screens and menus, not to a screen restored by Continue', () => {
    expect(choiceLockApplies('pulse')).toBe(true);
    expect(choiceLockApplies('level-up')).toBe(true);
    expect(choiceLockApplies('pause')).toBe(true);
    expect(choiceLockApplies('title')).toBe(false);
  });

  it('does not lock the run end again when coming back from The Keeping (BUG-009)', () => {
    expect(choiceLockApplies('archive')).toBe(false);
    expect(choiceLockApplies('pulse')).toBe(true);
  });
});

// BUG-010 (A-07): the Glazier at 1920x1080 in CSS px, measured from the QA screenshot
// docs/qa/evidence/M3/play-bell-glazier.png. Offers with their lock buttons (group 0), the 3 x 2
// weapon slot grid in the right panel (group 1), the bottom bar (group 2).
const offer = (row: number): NavRect => r(428, 90 + row * 155, 0, 1028, 136);
const lock = (row: number): NavRect => r(1466, 90 + row * 155, 0, 40, 136);
const slot = (i: number): NavRect =>
  r(1540 + (i % 3) * 100, 142 + Math.floor(i / 3) * 106, 1, 88, 93);
const GLAZIER: NavRect[] = [
  offer(0), // 0 shop-offer-1
  lock(0), // 1 shop-lock-1
  offer(1), // 2
  lock(1), // 3
  offer(2), // 4
  lock(2), // 5 shop-lock-3
  offer(3), // 6
  lock(3), // 7 shop-lock-4
  slot(0), // 8 shop-slot-1
  slot(1), // 9
  slot(2), // 10 shop-slot-3
  slot(3), // 11 shop-slot-4
  slot(4), // 12
  slot(5), // 13 shop-slot-6
  r(20, 1012, 2, 248, 48), // 14 reroll
  r(283, 1012, 2, 157, 48), // 15 sell
  r(453, 1012, 2, 157, 48), // 16 fuse
  r(625, 1012, 2, 175, 48), // 17 stats
  r(1618, 1012, 2, 282, 48), // 18 begin
];
const G = { lock3: 5, lock4: 7, slot1: 8, slot3: 10, slot4: 11, slot6: 13, stats: 17, begin: 18 };

/** Mirrors FocusList.move: remembers the last move that left a group. */
function walker(rects: readonly NavRect[], start: number) {
  let at = start;
  let memory: NavMemory | null = null;
  return {
    get at() {
      return at;
    },
    press(dir: Dir): number {
      const next = findNeighbor(rects, at, dir, memory);
      if (next >= 0 && next !== at) {
        memory = rects[next]?.group !== rects[at]?.group ? { from: at, to: next, dir } : null;
        at = next;
      }
      return at;
    },
    tab(): number {
      memory = null;
      at = nextGroupIndex(rects, at, 1);
      return at;
    },
  };
}

describe('Glazier arrow order follows the layout (BUG-010, A-07)', () => {
  it('goes from Begin Pulse up the slot column and back down to Begin Pulse', () => {
    const w = walker(GLAZIER, G.begin);
    expect(w.press(Dir.Up)).toBe(G.slot6);
    expect(w.press(Dir.Up)).toBe(G.slot3);
    expect(w.press(Dir.Down)).toBe(G.slot6);
    // Before the fix this jumped left into the lock column (shop-lock-3).
    expect(w.press(Dir.Down)).toBe(G.begin);
  });

  it('prefers a target in line with the focus (beam) over a nearer one off to the side', () => {
    expect(findNeighbor(GLAZIER, G.slot6, Dir.Down)).toBe(G.begin);
    expect(findNeighbor(GLAZIER, 1, Dir.Right)).toBe(G.slot1);
    expect(findNeighbor(GLAZIER, G.stats, Dir.Up)).toBe(6);
  });

  it('returns to the origin when the move that left a group is reversed', () => {
    for (const from of [1, 3, G.lock3, G.lock4]) {
      const w = walker(GLAZIER, from);
      const to = w.press(Dir.Right);
      expect(GLAZIER[to]?.group).toBe(1);
      expect(w.press(Dir.Left)).toBe(from);
    }
    const w = walker(GLAZIER, G.lock3);
    expect(w.press(Dir.Right)).toBe(G.slot4);
    expect(w.press(Dir.Left)).toBe(G.lock3);
  });

  it('ignores the memory once the focus moved on inside the group', () => {
    const w = walker(GLAZIER, G.lock3);
    w.press(Dir.Right); // slot 4
    w.press(Dir.Right); // slot 5
    w.press(Dir.Left); // slot 4, in-group
    expect(w.at).toBe(G.slot4);
    // Plain spatial choice again: the lock in line with slot 4 (shop-lock-2).
    expect(w.press(Dir.Left)).toBe(3);
  });

  it('reaches every control from every control with arrows alone (A-07)', () => {
    const dirs = [Dir.Up, Dir.Down, Dir.Left, Dir.Right];
    for (let start = 0; start < GLAZIER.length; start++) {
      const seen = new Set<number>([start]);
      const queue = [start];
      while (queue.length > 0) {
        const at = queue.shift() ?? 0;
        for (const d of dirs) {
          const next = findNeighbor(GLAZIER, at, d);
          if (next >= 0 && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(seen.size).toBe(GLAZIER.length);
    }
  });

  it('walks each offer row left to right: card, lock, then the slot row beside it', () => {
    const w = walker(GLAZIER, 2);
    expect(w.press(Dir.Right)).toBe(3);
    expect(w.press(Dir.Right)).toBe(G.slot4);
    expect(w.press(Dir.Right)).toBe(12);
    expect(w.press(Dir.Right)).toBe(G.slot6);
    expect(w.press(Dir.Right)).toBe(G.slot6);
  });

  it('skips items without a box (hidden controls)', () => {
    const rects = [r(0, 0, 0), r(0, 20, 0, 0, 0), r(0, 40, 0)];
    expect(findNeighbor(rects, 0, Dir.Down)).toBe(2);
  });
});
