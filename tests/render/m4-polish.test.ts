// M4-01 render polish (AD): hit flash matching, windup outline contrast (BUG-007), zone effective fill,
// near-player damage number cap, Rite look per archetype, merged zone fills in the area shader.

import { describe, expect, it } from 'vitest';
import {
  DAMAGE_HIT_KIND_SHIFT,
  EnemyRank,
  HitKind,
  SimEventType,
  tokenRgb,
} from '../../src/core/index.ts';
import type { SimEventReader } from '../../src/core/index.ts';
import { capNearPlayer, NEAR_PLAYER_MAX } from '../../src/render/pipeline/damage-cap.ts';
import { prewarmKey, scheduleIdle, takePrewarmed } from '../../src/render/pipeline/prewarm.ts';
import type { PrewarmSlot } from '../../src/render/pipeline/prewarm.ts';
import { AREA_FRAGMENT } from '../../src/render/shaders/index.ts';
import {
  contrastRatio,
  createHitFlashTracker,
  isPeriodicHit,
  unlitFlashAlpha,
  windupOutline,
} from '../../src/render/sprites/actor-flash.ts';
import type { FlashPoolView } from '../../src/render/sprites/actor-flash.ts';
import { afterimageFraction, RiteLook, riteLookOf } from '../../src/render/vfx/effects.ts';
import {
  createAreaStyles,
  effectiveFill,
  linearRgb,
  PLAYER_ZONE_MAX_FILL,
} from '../../src/render/vfx/telegraph-style.ts';
import { loadPalette } from '../../tools/art/lib/load.ts';

const palette = loadPalette();

function damage(list: readonly (readonly [number, number, number])[]): SimEventReader {
  return {
    count: list.length,
    type: list.map(() => SimEventType.EnemyDamaged),
    x: list.map((e) => e[0]),
    y: list.map((e) => e[1]),
    a: list.map(() => 5),
    b: list.map((e) => e[2] << DAMAGE_HIT_KIND_SHIFT),
    c: list.map(() => 0),
  };
}

function pool(xy: readonly (readonly [number, number])[], ticks: readonly number[]): FlashPoolView {
  return {
    highWater: xy.length,
    alive: xy.map(() => 1),
    serial: xy.map((_, i) => i + 1),
    x: xy.map((p) => p[0]),
    y: xy.map((p) => p[1]),
    hitFlashTicks: [...ticks],
  };
}

describe('hit flash tracker (CD M3 polish 1)', () => {
  it('flashes impact hits only, never zone or Burn ticks', () => {
    expect(isPeriodicHit(HitKind.Zone << DAMAGE_HIT_KIND_SHIFT)).toBe(true);
    expect(isPeriodicHit(HitKind.Dot << DAMAGE_HIT_KIND_SHIFT)).toBe(true);
    for (const k of [
      HitKind.Projectile,
      HitKind.Melee,
      HitKind.Area,
      HitKind.Chain,
      HitKind.Contact,
    ])
      expect(isPeriodicHit(k << DAMAGE_HIT_KIND_SHIFT)).toBe(false);
    // A zone tick hits a clump of five at once: no flash at all.
    const xy: readonly (readonly [number, number])[] = [
      [0, 0],
      [0.3, 0],
      [0, 0.3],
      [0.3, 0.3],
      [0.15, 0.15],
    ];
    const clump = pool(xy, [2, 2, 2, 2, 2]);
    const tr = createHitFlashTracker();
    tr.update(damage(xy.map(([x, y]) => [x, y, HitKind.Zone] as const)), clump);
    for (let s = 0; s < 5; s++) expect(tr.flashing(s)).toBe(false);
    // One projectile in the clump flashes exactly the nearest slot.
    tr.update(damage([[0.31, 0.29, HitKind.Projectile]]), clump);
    expect([0, 1, 2, 3, 4].filter((s) => tr.flashing(s))).toEqual([3]);
  });

  it('ignores slots the sim did not mark as hit and ends with the sim flash', () => {
    const p = pool(
      [
        [0, 0],
        [0.2, 0],
      ],
      [0, 2],
    );
    const tr = createHitFlashTracker();
    tr.update(damage([[0, 0, HitKind.Projectile]]), p);
    expect(tr.flashing(0)).toBe(false);
    expect(tr.flashing(1)).toBe(true);
    (p.hitFlashTicks as number[])[1] = 0;
    tr.update(damage([]), p);
    expect(tr.flashing(1)).toBe(false);
  });

  it('caps the bone tint at 50%, Warden and boss at 35% (style-guide 1.4)', () => {
    expect(unlitFlashAlpha(EnemyRank.Normal)).toBe(0.5);
    expect(unlitFlashAlpha(EnemyRank.Warden)).toBe(0.35);
    expect(unlitFlashAlpha(EnemyRank.Boss)).toBe(0.35);
  });
});

describe('windup outline (BUG-007)', () => {
  it('stays at least 1.5:1 against both floor tokens in both pulse phases', () => {
    const magenta = linearRgb(palette, 'danger-magenta');
    const core = linearRgb(palette, 'danger-core');
    const out: [number, number, number] = [0, 0, 0];
    const phases = new Set<number>();
    for (let clock = 0; clock < 16; clock++) {
      windupOutline(clock, magenta, core, out);
      phases.add(Number(out[1].toFixed(5)));
      for (const floor of ['floor-mid', 'floor-lit'])
        expect(contrastRatio(out, linearRgb(palette, floor))).toBeGreaterThanOrEqual(1.5);
    }
    expect(phases.size).toBe(2);
    // The old dark-red body tint was about 1:1 against the floor (QA 1.0 to 1.03).
    expect(
      contrastRatio(linearRgb(palette, 'danger-red'), linearRgb(palette, 'floor-lit')),
    ).toBeLessThan(2);
  });
});

describe('player zone fill (CD M3 polish 3)', () => {
  it('solves shader alpha for 20% effective Rite fill and 12% trails, never above 25%', () => {
    const styles = createAreaStyles(palette);
    const gold = tokenRgb(palette, 'kept-gold');
    for (const floor of ['floor-mid', 'floor-lit']) {
      const f = tokenRgb(palette, floor);
      const rite = effectiveFill(f, gold, styles.riteZone.fill[3]);
      expect(rite).toBeLessThanOrEqual(0.2 + 1e-6);
      expect(rite).toBeGreaterThan(0.17);
      expect(rite).toBeLessThanOrEqual(PLAYER_ZONE_MAX_FILL);
      expect(effectiveFill(f, gold, styles.trailZone.fill[3])).toBeLessThanOrEqual(0.15);
    }
    // The M3 value 0.25 measured 36 to 39% on screen (CD M3 measured 37%).
    expect(effectiveFill(tokenRgb(palette, 'floor-lit'), gold, 0.25)).toBeGreaterThan(0.33);
  });

  it('merges stacked zone fills in the area shader', () => {
    expect(AREA_FRAGMENT).toContain('uniform vec4 uMerge[');
    expect(AREA_FRAGMENT).toContain('coveredBefore');
  });
});

describe('near-player damage numbers (CD M3 polish 9)', () => {
  it('keeps at most 4 within 2 u of the player, oldest normal first, crits last', () => {
    const n = 10;
    const live = new Uint8Array(n).fill(1);
    const crit = [0, 1, 0, 0, 0, 0, 1, 0, 0, 0];
    const born = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9];
    // Slot 9 is far away (5 u); the rest sit near the player at the origin.
    const x = [0, 0.5, 1, 1.5, -1, -0.5, 0.2, 0.7, -1.2, 5];
    const y = new Array<number>(n).fill(0);
    capNearPlayer(live, crit, born, x, y, 0, 0);
    const kept = [...live].map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
    // Near: 9 numbers; 4 stay: both crits (1, 6) and the two newest normals (7, 8). Far 9 untouched.
    expect(kept).toEqual([1, 6, 7, 8, 9]);
    expect(kept.filter((i) => i !== 9)).toHaveLength(NEAR_PLAYER_MAX);
  });

  it('drops crits only when no normal number is near', () => {
    const live = new Uint8Array(6).fill(1);
    capNearPlayer(
      live,
      [1, 1, 1, 1, 1, 1],
      [5, 4, 3, 2, 1, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      0,
      0,
    );
    expect([...live]).toEqual([1, 1, 1, 1, 0, 0]);
  });
});

describe('Rite look per archetype (CD M3 polish 2)', () => {
  it('maps rites.csv archetypes; only throw_zone flies to the aim point', () => {
    expect(riteLookOf({ archetype: 'throw_zone' })).toBe(RiteLook.Throw);
    expect(riteLookOf({ archetype: 'ring' })).toBe(RiteLook.Ring);
    expect(riteLookOf({ archetype: 'dash' })).toBe(RiteLook.Dash);
    expect(riteLookOf({ archetype: 'other' })).toBe(RiteLook.Other);
    expect(riteLookOf(undefined)).toBe(RiteLook.Throw);
    expect([0, 1, 2].map((k) => afterimageFraction(k, 3))).toEqual([0.25, 0.5, 0.75]);
  });
});

describe('arena pre-warm (BUG-006)', () => {
  it('hands the pre-built arena to the matching setArena once', () => {
    const slot: PrewarmSlot<string> = { key: prewarmKey('market', 'b1'), value: 'env' };
    expect(takePrewarmed(slot, prewarmKey('cloister', 'b2'))).toBeNull();
    expect(slot.value).toBe('env');
    expect(takePrewarmed(slot, prewarmKey('market', 'b1'))).toBe('env');
    expect(takePrewarmed(slot, prewarmKey('market', 'b1'))).toBeNull();
  });

  it('runs on idle when the host has requestIdleCallback, else after a short timeout', () => {
    const calls: string[] = [];
    scheduleIdle(
      {
        requestIdleCallback: (cb, o) => {
          calls.push(`idle ${o?.timeout ?? 0}`);
          cb();
          return 1;
        },
        setTimeout: () => 0,
      },
      () => calls.push('task'),
    );
    scheduleIdle(
      {
        setTimeout: (cb, ms) => {
          calls.push(`timeout ${ms}`);
          cb();
          return 1;
        },
      },
      () => calls.push('task'),
    );
    expect(calls).toEqual(['idle 600', 'task', 'timeout 50', 'task']);
  });
});
