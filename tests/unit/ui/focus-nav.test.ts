import { describe, expect, it } from 'vitest';
import { Dir, findNeighbor, nextGroupIndex } from '../../../src/ui/focus-nav.ts';
import type { NavRect } from '../../../src/ui/focus-nav.ts';
import { menuIntent } from '../../../src/ui/menu-keys.ts';
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
