import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PANE_KINDS, paneModel } from '../../../src/ui/screens/components.ts';

const css = (f: string): string =>
  readFileSync(resolve(import.meta.dirname, '../../../src/ui/css', f), 'utf8');

describe('glass pane model (redesign-1.1 2)', () => {
  it('builds the category classes for each kind', () => {
    expect(paneModel('weapon', 'Weapon')).toEqual({
      rootClass: 'pane pane--weapon',
      glyphClass: 'cat-glyph cat-weapon',
      label: 'Weapon',
      badge: null,
    });
    expect(paneModel('relic', 'Relic', 'New').rootClass).toBe('pane pane--relic');
    expect(paneModel('upgrade', 'Upgrade').glyphClass).toBe('cat-glyph cat-upgrade');
  });

  it('keeps a badge only when it has text', () => {
    expect(paneModel('weapon', 'Weapon', 'New').badge).toBe('New');
    expect(paneModel('weapon', 'Weapon', '  Owned 2 ').badge).toBe('Owned 2');
    expect(paneModel('weapon', 'Weapon', '   ').badge).toBeNull();
    expect(paneModel('weapon', 'Weapon').badge).toBeNull();
  });

  it('has a category token, a pane variant, and a shape glyph for every kind', () => {
    const base = css('base.css');
    const components = css('components.css');
    for (const kind of PANE_KINDS) {
      expect(base).toMatch(new RegExp(`--cat-${kind}:`));
      expect(components).toContain(`.sf-ui .pane--${kind} {`);
      // The glyph is a clip-path shape so the category never rests on colour alone.
      expect(components).toMatch(new RegExp(String.raw`\.cat-glyph\.cat-${kind} \{\s*clip-path:`));
    }
  });
});
