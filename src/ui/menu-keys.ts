// Menu key mapping (ui-spec 8.1, 8.2): arrows and the move bindings navigate, Enter and the confirm
// binding select, Esc and the back binding go back, Tab cycles focus groups. Enter and Esc always
// work as a fixed safe path so a remap can never lock the player out of menus (ui-spec S07).

import type { ActionId, Settings } from '../core/index.ts';

export type MenuIntent =
  'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'nextGroup' | 'prevGroup';

export function isBound(keybinds: Settings['keybinds'], action: ActionId, code: string): boolean {
  const b = keybinds[action];
  return b[0] === code || b[1] === code;
}

export function menuIntent(
  code: string,
  shift: boolean,
  keybinds: Settings['keybinds'],
): MenuIntent | null {
  if (code === 'Tab') return shift ? 'prevGroup' : 'nextGroup';
  if (code === 'Enter' || code === 'NumpadEnter') return 'confirm';
  if (code === 'Escape') return 'back';
  if (code === 'ArrowUp' || isBound(keybinds, 'moveUp', code)) return 'up';
  if (code === 'ArrowDown' || isBound(keybinds, 'moveDown', code)) return 'down';
  if (code === 'ArrowLeft' || isBound(keybinds, 'moveLeft', code)) return 'left';
  if (code === 'ArrowRight' || isBound(keybinds, 'moveRight', code)) return 'right';
  if (isBound(keybinds, 'confirm', code)) return 'confirm';
  if (isBound(keybinds, 'back', code)) return 'back';
  return null;
}

/** Screens where the pause binding opens the pause menu (ui-spec 8.3). */
export function pausesRun(screenId: string): boolean {
  return (
    screenId === 'pulse' ||
    screenId === 'level-up' ||
    screenId === 'warden-reward' ||
    screenId === 'glazier'
  );
}

/**
 * The choice-screen input lock (ui-spec 8.4) guards against keys carried over from play or from the
 * press that ended the run. A Glazier, Temper, or reward restored by Continue on the title comes from
 * a menu press that already finished, so it is not locked (LP M2-09, e2e keyboard-play E-15).
 */
export function choiceLockApplies(fromScreenId: string): boolean {
  return fromScreenId !== 'title';
}
