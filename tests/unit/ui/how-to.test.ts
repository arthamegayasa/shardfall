// How to play (redesign-1.1 3.4): four panels whose keys follow the current bindings, shown once
// before the first run (Settings.seenHowTo).
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/app/settings.ts';
import { howToPanels, markHowToSeen, shouldShowHowTo } from '../../../src/ui/presenters/how-to.ts';

describe('How to play model', () => {
  it('has four panels in reading order with the default keys', () => {
    const panels = howToPanels(defaultSettings(false).keybinds);
    expect(panels.map((p) => p.id)).toEqual(['move', 'skill', 'wave', 'shop']);
    expect(panels[0]?.params).toEqual({ keys: 'WASD' });
    expect(panels[1]?.params).toEqual({ key: 'Space' });
    expect(panels.every((p) => p.titleKey.startsWith('ui.howto.'))).toBe(true);
    expect(panels.every((p) => p.textKey.startsWith('ui.howto.'))).toBe(true);
  });

  it('shows remapped keys', () => {
    const kb = {
      ...defaultSettings(false).keybinds,
      moveUp: ['ArrowUp', null],
      moveLeft: ['ArrowLeft', null],
      moveDown: ['ArrowDown', null],
      moveRight: ['ArrowRight', null],
      rite: ['KeyQ', 'Space'],
    } as const;
    const panels = howToPanels(kb);
    expect(panels[0]?.params).toEqual({ keys: 'Up/Left/Down/Right' });
    expect(panels[1]?.params).toEqual({ key: 'Q' });
  });

  it('opens by itself only until it was seen', () => {
    const fresh = defaultSettings(false);
    expect(shouldShowHowTo(fresh)).toBe(true);
    const seen = markHowToSeen(fresh);
    expect(seen.seenHowTo).toBe(true);
    expect(shouldShowHowTo(seen)).toBe(false);
    // Nothing else changes, and marking twice keeps the same object (no extra save).
    expect({ ...seen, seenHowTo: false }).toEqual(fresh);
    expect(markHowToSeen(seen)).toBe(seen);
  });
});
