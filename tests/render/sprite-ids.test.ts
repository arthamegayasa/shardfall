// Sprite id coverage (AD, M1-05; architecture.md 7.6): every Tier A data id has its own sprite in the
// real atlas, and unknown rows resolve to a declared placeholder instead of nothing.

import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SPRITES,
  resolveClassSpriteId,
  resolveEnemySpriteId,
  resolveWeaponSpriteId,
  spriteIdForEnemy,
  spriteIdForWeapon,
} from '../../src/render/sprites/sprite-ids.ts';
import { fixtureGameData } from '../support/fixture-data.ts';
import { loadArtFixture } from './support.ts';

const { manifest } = await loadArtFixture();
const has = (id: string): boolean => manifest.sprites[id] !== undefined;

/** Tier A content (GDD 2.3, 6.1, 7, 14.2, 15.1, 16.1). */
const TIER_A = {
  classes: ['lantern'],
  enemies: [
    { id: 'swarmer', role: 'swarmer', behavior: 'swarmer', sizeClass: 'small' },
    { id: 'charger', role: 'charger', behavior: 'charger', sizeClass: 'medium' },
    { id: 'shooter', role: 'shooter', behavior: 'shooter', sizeClass: 'medium' },
    { id: 'tank', role: 'tank', behavior: 'tank', sizeClass: 'large' },
    { id: 'warden_hound', role: 'warden', behavior: 'warden_hound', sizeClass: 'warden' },
    { id: 'boss_lantern', role: 'boss', behavior: 'boss_lantern', sizeClass: 'boss' },
  ],
  weapons: [
    'lantern_bolt',
    'splinter_shot',
    'arc_blade',
    'orbit_shards',
    'chain_spark',
    'returning_glaive',
  ],
};

describe('id rules', () => {
  it('maps data ids to sprite ids', () => {
    expect(spriteIdForEnemy('swarmer')).toBe('unlit-swarmer');
    expect(spriteIdForEnemy('warden_hound')).toBe('warden-hound');
    expect(spriteIdForEnemy('boss_lantern')).toBe('boss-lantern');
    expect(spriteIdForWeapon('splinter_shot')).toBe('fx-shot-splinter-shot');
  });
});

describe('Tier A coverage in the real atlas', () => {
  it('every Tier A class, enemy, and weapon has its own sprite (no placeholder fallback)', () => {
    for (const c of TIER_A.classes) expect(resolveClassSpriteId(c, has)).toBe(`kept-${c}`);
    for (const e of TIER_A.enemies)
      expect(resolveEnemySpriteId(e, has)).toBe(spriteIdForEnemy(e.id));
    for (const w of TIER_A.weapons)
      expect(resolveWeaponSpriteId(w, has)).toBe(spriteIdForWeapon(w));
  });
  it('every declared placeholder exists', () => {
    const { bySize, ...rest } = FALLBACK_SPRITES;
    for (const id of [...Object.values(rest), ...Object.values(bySize)]) expect(has(id)).toBe(true);
  });
});

describe('fallbacks', () => {
  it('resolves fixture rows by behavior, role, then size', () => {
    const data = fixtureGameData();
    const ids = data.enemies.map((e) => resolveEnemySpriteId(e, has));
    // test_swarmer -> role swarmer, test_charger -> role charger, test_warden -> behavior warden_hound.
    expect(ids).toEqual(['unlit-swarmer', 'unlit-charger', 'warden-hound']);
    for (const id of ids) expect(has(id)).toBe(true);
    expect(
      resolveEnemySpriteId(
        { id: 'mystery', role: 'mote', behavior: 'drift', sizeClass: 'large' },
        has,
      ),
    ).toBe('unlit-tank');
  });
  it('unknown classes and weapons use the declared placeholders', () => {
    expect(resolveClassSpriteId('nobody', has)).toBe(FALLBACK_SPRITES.player);
    expect(resolveWeaponSpriteId('test_late', has)).toBe(FALLBACK_SPRITES.playerShot);
  });
});
