// Control remap model (ui-spec S07 Controls, 8.1). Pure: every change returns new keybinds that the
// settings screen saves through AppActions.applySettings (localStorage shardfall.settings.v1, app).
// Bindings are KeyboardEvent.code values, two per action. A key already used by another action in
// the same context swaps places with the old binding ("Swapped with Rite.").

import type { ActionId, Settings } from '../../core/index.ts';

export type Keybinds = Settings['keybinds'];
export type RemapContext = 'gameplay' | 'menu';

export interface RemapRow {
  readonly action: ActionId;
  readonly labelKey: string;
  readonly context: RemapContext;
}

/** Gameplay (move, Rite, pause) then menu actions, in display order. */
export const REMAP_ROWS: readonly RemapRow[] = [
  { action: 'moveUp', labelKey: 'ui.action.move_up', context: 'gameplay' },
  { action: 'moveDown', labelKey: 'ui.action.move_down', context: 'gameplay' },
  { action: 'moveLeft', labelKey: 'ui.action.move_left', context: 'gameplay' },
  { action: 'moveRight', labelKey: 'ui.action.move_right', context: 'gameplay' },
  { action: 'rite', labelKey: 'ui.action.rite', context: 'gameplay' },
  { action: 'pause', labelKey: 'ui.action.pause', context: 'gameplay' },
  { action: 'confirm', labelKey: 'ui.action.confirm', context: 'menu' },
  { action: 'back', labelKey: 'ui.action.back', context: 'menu' },
  { action: 'reroll', labelKey: 'ui.action.reroll', context: 'menu' },
  { action: 'lock', labelKey: 'ui.action.lock', context: 'menu' },
  { action: 'beginPulse', labelKey: 'ui.action.begin_pulse', context: 'menu' },
  { action: 'stats', labelKey: 'ui.action.stats', context: 'menu' },
  { action: 'merge', labelKey: 'ui.action.fuse', context: 'menu' },
  { action: 'sell', labelKey: 'ui.action.sell', context: 'menu' },
];

/**
 * Defaults for "Reset Controls". Must equal src/app/settings.ts defaultSettings().keybinds (LP);
 * tests/unit/ui/remap.test.ts guards the copy because UI may not import app (architecture 5).
 */
export const DEFAULT_KEYBINDS: Keybinds = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  rite: ['Space', null],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  reroll: ['KeyR', null],
  lock: ['KeyL', null],
  beginPulse: ['KeyB', null],
  stats: ['KeyT', null],
  merge: ['KeyM', null],
  sell: ['KeyX', null],
};

export function contextOf(action: ActionId): RemapContext {
  return REMAP_ROWS.find((r) => r.action === action)?.context ?? 'menu';
}

/** Keys that never become a binding: modifier-only presses and OS keys. */
export function isBindable(code: string): boolean {
  if (code === '' || code === 'Unidentified') return false;
  return !/^(Shift|Control|Alt|Meta|OS|ContextMenu|CapsLock|NumLock|ScrollLock)/.test(code);
}

export interface RebindResult {
  readonly keybinds: Keybinds;
  /** Action whose binding was swapped away, null when the key was free in this context. */
  readonly swappedWith: ActionId | null;
}

type Pair = readonly [string | null, string | null];

function withSlot(pair: Pair, slot: 0 | 1, code: string | null): Pair {
  return slot === 0 ? [code, pair[1]] : [pair[0], code];
}

/**
 * Binds `code` to slot 0 or 1 of `action`. Another action in the same context that used the code
 * receives the old binding of this slot (a swap, so nothing is lost). The same action's other slot
 * holding the code swaps with this slot.
 */
export function rebind(kb: Keybinds, action: ActionId, slot: 0 | 1, code: string): RebindResult {
  const mine = kb[action];
  if (mine[slot] === code) return { keybinds: kb, swappedWith: null };
  const old = mine[slot];
  const other: 0 | 1 = slot === 0 ? 1 : 0;
  const next: Record<ActionId, Pair> = { ...kb };
  if (mine[other] === code) {
    next[action] = withSlot(withSlot(mine, other, old), slot, code);
    return { keybinds: next, swappedWith: null };
  }
  const ctx = contextOf(action);
  let swappedWith: ActionId | null = null;
  for (const row of REMAP_ROWS) {
    if (row.action === action || row.context !== ctx) continue;
    const pair = kb[row.action];
    let at: 0 | 1;
    if (pair[0] === code) at = 0;
    else if (pair[1] === code) at = 1;
    else continue;
    next[row.action] = withSlot(pair, at, old);
    swappedWith = row.action;
    break;
  }
  next[action] = withSlot(mine, slot, code);
  return { keybinds: next, swappedWith };
}

/** Label key of an action (for "Swapped with {action}."). */
export function actionLabelKey(action: ActionId): string {
  return REMAP_ROWS.find((r) => r.action === action)?.labelKey ?? '';
}
