// Player weapon readability (redesign 1.1 section 4, AD): weapon light per tag, effect kind per archetype,
// render scale constants, muzzle flash timing and reduce effects, and every shipped weapon reading apart.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARC_SWEEP_SEC,
  DEFAULT_LIGHT_TOKEN,
  fadeOut,
  MUZZLE_FLASH_SEC,
  muzzleFlashAlpha,
  PLAYER_SHOT_SCALE,
  SHOT_HALO_SCALE,
  SHOT_TAIL,
  SHOT_TINT,
  TAG_LIGHT_TOKENS,
  WeaponFxKind,
  weaponFxKindOf,
  weaponLightTokens,
} from '../../src/render/vfx/weapon-fx.ts';
import { loadArtFixture } from './support.ts';

const art = await loadArtFixture();

/** id and tags of every row in content/data/weapons.csv (header row, # comments skipped). */
function shippedWeapons(): { id: string; tags: string[]; archetype: string }[] {
  const csv = readFileSync(
    resolve(import.meta.dirname, '..', '..', 'content', 'data', 'weapons.csv'),
    'utf8',
  );
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.startsWith('#'));
  const head = (lines[0] ?? '').split(',');
  const iId = head.indexOf('id');
  const iTags = head.indexOf('tags');
  const iArch = head.indexOf('archetype');
  return lines.slice(1).map((l) => {
    const c = l.split(',');
    return {
      id: c[iId] ?? '',
      tags: (c[iTags] ?? '').split('|'),
      archetype: c[iArch] ?? '',
    };
  });
}

describe('weapon light', () => {
  it('maps each tag to its UI hue (flame amber, shard cyan, edge white, echo blue)', () => {
    expect(weaponLightTokens(['flame'])).toEqual(['kept-gold', 'kept-gold']);
    expect(weaponLightTokens(['shard'])).toEqual(['kept-cyan', 'kept-cyan']);
    expect(weaponLightTokens(['edge', 'echo'])).toEqual(['kept-white', 'kept-blue']);
    expect(weaponLightTokens(['echo', 'flame'])).toEqual(['kept-blue', 'kept-gold']);
  });

  it('falls back to the 1.0 cyan for rows without tags or with an unknown tag', () => {
    expect(weaponLightTokens(undefined)).toEqual([DEFAULT_LIGHT_TOKEN, DEFAULT_LIGHT_TOKEN]);
    expect(weaponLightTokens([])).toEqual([DEFAULT_LIGHT_TOKEN, DEFAULT_LIGHT_TOKEN]);
    expect(weaponLightTokens(['mystery', 'shard'])).toEqual([DEFAULT_LIGHT_TOKEN, 'kept-cyan']);
  });

  it('uses only palette tokens, and player colours only (never danger hues)', () => {
    for (const token of Object.values(TAG_LIGHT_TOKENS)) {
      expect(art.palette.core[token], token).toBeDefined();
      expect(token.startsWith('danger')).toBe(false);
    }
  });

  it('gives every shipped weapon its own (core, tail) light pair', () => {
    const rows = shippedWeapons();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const pairs = rows.map((r) => weaponLightTokens(r.tags).join('/'));
    expect(new Set(pairs).size).toBe(rows.length);
    for (const r of rows)
      for (const tag of r.tags) expect(TAG_LIGHT_TOKENS[tag], `${r.id} ${tag}`).toBeDefined();
  });
});

describe('weapon effect kind', () => {
  it('follows the archetype', () => {
    expect(weaponFxKindOf('orbit')).toBe(WeaponFxKind.Orbit);
    expect(weaponFxKindOf('arc')).toBe(WeaponFxKind.Arc);
    expect(weaponFxKindOf('chain')).toBe(WeaponFxKind.Chain);
    expect(weaponFxKindOf('ring_echo')).toBe(WeaponFxKind.Ring);
    for (const a of ['projectile', 'bolt_explode', 'boomerang', 'coin', undefined])
      expect(weaponFxKindOf(a)).toBe(WeaponFxKind.Shot);
  });

  it('covers every shipped archetype', () => {
    const known = new Set(['orbit', 'arc', 'chain', 'ring_echo', 'projectile', 'bolt_explode']);
    known.add('boomerang');
    known.add('coin');
    for (const r of shippedWeapons()) expect(known.has(r.archetype), r.archetype).toBe(true);
  });
});

describe('shot scale and glow constants', () => {
  it('draws shots at least 1.5x, on whole pixels, with a halo one step larger', () => {
    expect(PLAYER_SHOT_SCALE).toBeGreaterThanOrEqual(1.5);
    expect(Number.isInteger(PLAYER_SHOT_SCALE)).toBe(true);
    expect(SHOT_HALO_SCALE).toBe(PLAYER_SHOT_SCALE + 1);
    expect(SHOT_TINT).toBeGreaterThan(0);
    expect(SHOT_TINT).toBeLessThan(1);
  });

  it('fades the tail from the shot backwards and keeps whole-number dot scales', () => {
    expect(SHOT_TAIL.length).toBe(3);
    for (let k = 1; k < SHOT_TAIL.length; k++)
      expect(SHOT_TAIL[k]?.alpha).toBeLessThan(SHOT_TAIL[k - 1]?.alpha ?? 0);
    for (const d of SHOT_TAIL) expect(Number.isInteger(d.scale)).toBe(true);
    expect(SHOT_TAIL[0]?.light).toBe('core');
  });
});

describe('muzzle flash and fades', () => {
  it('is short: full for half its life, then fading to 0', () => {
    expect(MUZZLE_FLASH_SEC).toBeLessThanOrEqual(0.15);
    expect(muzzleFlashAlpha(0, false)).toBe(1);
    expect(muzzleFlashAlpha(MUZZLE_FLASH_SEC * 0.75, false)).toBeCloseTo(0.5, 6);
    expect(muzzleFlashAlpha(MUZZLE_FLASH_SEC, false)).toBe(0);
    expect(muzzleFlashAlpha(-0.01, false)).toBe(0);
  });

  it('never shows with reduce effects (no flicker)', () => {
    for (const age of [0, 0.02, 0.05, 0.09]) expect(muzzleFlashAlpha(age, true)).toBe(0);
  });

  it('eases floor effects out over their life', () => {
    expect(fadeOut(0, ARC_SWEEP_SEC)).toBe(1);
    expect(fadeOut(ARC_SWEEP_SEC / 2, ARC_SWEEP_SEC)).toBeCloseTo(0.75, 6);
    expect(fadeOut(ARC_SWEEP_SEC, ARC_SWEEP_SEC)).toBe(0);
    expect(fadeOut(0.1, 0)).toBe(0);
  });
});
