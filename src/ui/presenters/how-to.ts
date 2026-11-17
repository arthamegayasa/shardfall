// How to play (redesign-1.1 3.4): four short panels. Key names come from the current bindings
// with the same label helpers as the HUD hint, so a remap shows up here too. The screen opens by
// itself once before the first run; Settings.seenHowTo remembers that it was shown.

import type { Settings, StringParams } from '../../core/index.ts';
import { keyLabel } from '../format.ts';
import { moveKeysText } from './hud-transient.ts';

export type HowToPanelId = 'move' | 'skill' | 'wave' | 'shop';

export interface HowToPanel {
  readonly id: HowToPanelId;
  readonly titleKey: string;
  readonly textKey: string;
  readonly params: StringParams;
}

export function howToPanels(kb: Settings['keybinds']): HowToPanel[] {
  const keys = moveKeysText([
    keyLabel(kb.moveUp[0]),
    keyLabel(kb.moveLeft[0]),
    keyLabel(kb.moveDown[0]),
    keyLabel(kb.moveRight[0]),
  ]);
  return [
    { id: 'move', titleKey: 'ui.howto.move_title', textKey: 'ui.howto.move', params: { keys } },
    {
      id: 'skill',
      titleKey: 'ui.howto.skill_title',
      textKey: 'ui.howto.skill',
      params: { key: keyLabel(kb.rite[0]) },
    },
    { id: 'wave', titleKey: 'ui.howto.wave_title', textKey: 'ui.howto.wave', params: {} },
    { id: 'shop', titleKey: 'ui.howto.shop_title', textKey: 'ui.howto.shop', params: {} },
  ];
}

/** True until How to play was shown once (it then opens only from the title or pause menu). */
export function shouldShowHowTo(s: Settings): boolean {
  return !s.seenHowTo;
}

/** Settings with the flag set; the same object when it already was (no extra save). */
export function markHowToSeen(s: Settings): Settings {
  return s.seenHowTo ? s : { ...s, seenHowTo: true };
}
