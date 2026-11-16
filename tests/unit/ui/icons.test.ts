import { describe, expect, it } from 'vitest';
import type { SpriteSheetDef } from '../../../src/core/index.ts';
import {
  findIconSprite,
  findPortraitSprite,
  fitScale,
  iconCandidates,
  kebab,
  monogram,
} from '../../../src/ui/icons.ts';

const sprite = (id: string, cls: SpriteSheetDef['class'] = 'icon'): SpriteSheetDef => ({
  id,
  class: cls,
  faction: 'kept',
  frameW: 16,
  frameH: 16,
  anchor: { x: 8, y: 15 },
  outline: 'none',
  status: 'final',
  animations: { idle: { frames: [['c']], ticksPerFrame: 0, loop: false } },
});

describe('icon lookup (AD sprites by id convention)', () => {
  it('turns data ids into kebab-case sprite ids', () => {
    expect(kebab('lantern_bolt')).toBe('lantern-bolt');
    expect(kebab('attackSpeedPct')).toBe('attack-speed-pct');
    expect(iconCandidates({ kind: 'weapon', id: 'lantern_bolt' })[0]).toBe(
      'icon-weapon-lantern-bolt',
    );
    expect(iconCandidates({ kind: 'stat', id: 'max_hp' })).toContain('icon-stat-max-hp');
  });

  it('prefers the exact kind id, then any icon ending with the id', () => {
    const sprites = [
      sprite('icon-lantern-bolt'),
      sprite('icon-weapon-lantern-bolt'),
      sprite('icon-arms-orbit-shards'),
      sprite('kept-orbit-shards', 'kept'),
    ];
    expect(findIconSprite(sprites, { kind: 'weapon', id: 'lantern_bolt' })?.id).toBe(
      'icon-weapon-lantern-bolt',
    );
    expect(findIconSprite(sprites, { kind: 'weapon', id: 'orbit_shards' })?.id).toBe(
      'icon-arms-orbit-shards',
    );
    expect(findIconSprite(sprites, { kind: 'memento', id: 'missing' })).toBeNull();
  });

  it('finds the Glazier portrait under either prefix or by class', () => {
    expect(findPortraitSprite([sprite('icon-portrait-glazier', 'portrait')], 'glazier')?.id).toBe(
      'icon-portrait-glazier',
    );
    expect(findPortraitSprite([sprite('npc-glazier-mask', 'portrait')], 'glazier')?.id).toBe(
      'npc-glazier-mask',
    );
    expect(findPortraitSprite([sprite('icon-glazier')], 'glazier')).toBeNull();
  });
});

describe('icon fallback and scale', () => {
  it('builds a two-letter monogram from the display name', () => {
    expect(monogram('Lantern Bolt')).toBe('LB');
    expect(monogram('Pocket of Sky')).toBe('PO');
    expect(monogram('Whetstone')).toBe('Wh');
    expect(monogram('Thrice-Leaping')).toBe('TL');
    expect(monogram('')).toBe('');
  });

  it('fits sprites at the largest integer scale, never below 1', () => {
    expect(fitScale(16, 16, 32)).toBe(2);
    expect(fitScale(16, 16, 30)).toBe(1);
    expect(fitScale(48, 48, 48)).toBe(1);
    expect(fitScale(8, 7, 16)).toBe(2);
    expect(fitScale(64, 64, 16)).toBe(1);
  });
});
