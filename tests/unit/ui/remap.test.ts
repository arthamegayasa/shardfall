import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/app/settings.ts';
import {
  actionLabelKey,
  contextOf,
  DEFAULT_KEYBINDS,
  isBindable,
  rebind,
  REMAP_ROWS,
} from '../../../src/ui/presenters/remap.ts';

const kb = defaultSettings(false).keybinds;

describe('control remap model', () => {
  it('keeps the UI copy of the default bindings equal to the app defaults', () => {
    expect(DEFAULT_KEYBINDS).toEqual(kb);
  });

  it('lists every action once, gameplay first', () => {
    const actions = REMAP_ROWS.map((r) => r.action);
    expect(new Set(actions).size).toBe(actions.length);
    expect(actions.sort()).toEqual(Object.keys(kb).sort());
    expect(contextOf('rite')).toBe('gameplay');
    expect(contextOf('reroll')).toBe('menu');
    expect(actionLabelKey('beginPulse')).toBe('ui.action.begin_pulse');
  });

  it('binds a free key without touching other actions', () => {
    const r = rebind(kb, 'rite', 1, 'KeyQ');
    expect(r.keybinds.rite).toEqual(['Space', 'KeyQ']);
    expect(r.swappedWith).toBeNull();
    expect(r.keybinds.moveUp).toEqual(kb.moveUp);
  });

  it('swaps with another action in the same context so nothing is lost', () => {
    const r = rebind(kb, 'rite', 0, 'KeyW');
    expect(r.keybinds.rite).toEqual(['KeyW', null]);
    expect(r.keybinds.moveUp).toEqual(['Space', 'ArrowUp']);
    expect(r.swappedWith).toBe('moveUp');
  });

  it('allows the same key in different contexts (Space for Rite and Confirm)', () => {
    const r = rebind(kb, 'reroll', 1, 'Space');
    expect(r.swappedWith).toBe('confirm');
    expect(r.keybinds.rite).toEqual(['Space', null]);
    const g = rebind(kb, 'pause', 1, 'Enter');
    expect(g.swappedWith).toBeNull();
    expect(g.keybinds.confirm).toEqual(kb.confirm);
  });

  it('swaps the two slots of one action when the key is already its other binding', () => {
    const r = rebind(kb, 'moveUp', 0, 'ArrowUp');
    expect(r.keybinds.moveUp).toEqual(['ArrowUp', 'KeyW']);
    expect(r.swappedWith).toBeNull();
  });

  it('returns the same object when nothing changes and never mutates the input', () => {
    const before = JSON.stringify(kb);
    expect(rebind(kb, 'rite', 0, 'Space').keybinds).toBe(kb);
    rebind(kb, 'rite', 0, 'KeyW');
    expect(JSON.stringify(kb)).toBe(before);
  });

  it('ignores modifier-only keys', () => {
    expect(isBindable('ShiftLeft')).toBe(false);
    expect(isBindable('MetaRight')).toBe(false);
    expect(isBindable('')).toBe(false);
    expect(isBindable('KeyJ')).toBe(true);
    expect(isBindable('Numpad4')).toBe(true);
  });
});
