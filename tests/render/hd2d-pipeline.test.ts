// Unit tests for the HD-2D pipeline's pure logic (LP, M2-02): quality profiles, point light selection
// and flicker, tilt-shift band maths, screen shake, K3 danger rules, damage number cap, Pulse light,
// procedural env textures, and boundary half-planes.

import { describe, expect, it } from 'vitest';
import { AreaShape, DOF_SHARP_BOTTOM_PX, DOF_SHARP_TOP_PX } from '../../src/core/index.ts';
import type { AreaPoolView, PaletteDef, Settings, WorldView } from '../../src/core/index.ts';
import { defaultSettings } from '../../src/app/settings.ts';
import {
  defaultQuality,
  MAX_POINT_LIGHTS,
  qualityProfile,
} from '../../src/render/pipeline/quality.ts';
import {
  directionFromAzEl,
  flickerAt,
  luminance,
  pointFalloff,
  selectPointLights,
  surfaceLightColor,
} from '../../src/render/pipeline/lights.ts';
import {
  DOF_MAX_RADIUS_PX,
  refRowOfTargetRow,
  tiltShiftRadius,
  tiltShiftWeight,
} from '../../src/render/post/band.ts';
import {
  addTrauma,
  createShake,
  decayShake,
  SHAKE_MAX_PX,
  shakeOffset,
} from '../../src/render/pipeline/shake.ts';
import {
  playerCoveredByDanger,
  STACKED_FILL_MAX_ALPHA,
  stackedFillScale,
} from '../../src/render/pipeline/danger-rules.ts';
import {
  DAMAGE_NUMBER_CAP,
  pickDamageSlot,
  playerBoxPushPx,
} from '../../src/render/pipeline/damage-cap.ts';
import {
  createPulseLight,
  PULSE_FLASH_SEC,
  PULSE_LIFT,
  PULSE_WAVE_SEC,
  pulseClosed,
  pulseOpened,
  samplePulseLight,
} from '../../src/render/pipeline/pulse-light.ts';
import {
  buildEnvAtlas,
  ENV_ATLAS_H,
  ENV_ATLAS_W,
  roleColor,
} from '../../src/render/env/env-textures.ts';
import { boundaryEdges } from '../../src/render/env/arena-env.ts';
import paletteJson from '../../art/palette.json';
import { createFakeWorld } from '../fixtures/fake-world.ts';

const palette = paletteJson as unknown as PaletteDef;

function settings(
  quality: Settings['graphics']['quality'],
  reduceEffects = false,
  shake = 100,
): Settings {
  const s = defaultSettings(false);
  return {
    ...s,
    graphics: { ...s.graphics, quality, screenShake: shake },
    access: { ...s.access, reduceEffects },
  };
}

describe('qualityProfile', () => {
  it('turns off DoF, bloom, glint, and shadows on Low and keeps 4 lights', () => {
    const q = qualityProfile(settings('low'));
    expect(q).toMatchObject({ dof: false, bloomLevels: 0, glassGlint: false, shadowMapSize: 0 });
    expect(q.maxPointLights).toBe(4);
  });

  it('gives Medium one bloom level and High two, both with all 8 lights', () => {
    const m = qualityProfile(settings('medium'));
    const h = qualityProfile(settings('high'));
    expect([m.bloomLevels, h.bloomLevels]).toEqual([1, 2]);
    expect([m.maxPointLights, h.maxPointLights]).toEqual([MAX_POINT_LIGHTS, MAX_POINT_LIGHTS]);
    expect(h.shadowMapSize).toBeGreaterThan(m.shadowMapSize);
    expect(h.particleCap).toBeGreaterThan(m.particleCap);
  });

  it('removes DoF, bloom, glint, and shake under reduce effects at any quality', () => {
    const q = qualityProfile(settings('high', true));
    expect(q).toMatchObject({ dof: false, bloomLevels: 0, glassGlint: false, screenShake: 0 });
    expect(q.ambientFraction).toBeLessThan(1);
    expect(q.flashScale).toBeLessThan(1);
    // Lights and shadows are not "effects": they stay at the chosen quality.
    expect(q.maxPointLights).toBe(MAX_POINT_LIGHTS);
  });

  it('scales screen shake by the Settings slider', () => {
    expect(qualityProfile(settings('medium', false, 50)).screenShake).toBe(0.5);
    expect(qualityProfile(settings('medium', false, 0)).screenShake).toBe(0);
  });

  it('defaults to Medium before the first applySettings', () => {
    expect(defaultQuality()).toEqual(qualityProfile(settings('medium')));
  });
});

describe('point lights', () => {
  it('keeps the first N lights in data order (LD priority)', () => {
    expect(selectPointLights(7, 4)).toEqual([0, 1, 2, 3]);
    expect(selectPointLights(7, 8)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(selectPointLights(3, 8)).toEqual([0, 1, 2]);
    expect(selectPointLights(5, 0)).toEqual([]);
  });

  it('flickers within [1 - amount, 1] and never goes dark', () => {
    for (let t = 0; t < 10; t += 0.013) {
      const f = flickerAt(t, 3, 0.12);
      expect(f).toBeGreaterThanOrEqual(0.88 - 1e-9);
      expect(f).toBeLessThanOrEqual(1);
    }
    expect(flickerAt(1.5, 2, 0)).toBe(1);
    expect(flickerAt(1.5, 2, 5)).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic per seed and time', () => {
    expect(flickerAt(2.25, 4, 0.2)).toBe(flickerAt(2.25, 4, 0.2));
    expect(flickerAt(2.25, 4, 0.2)).not.toBe(flickerAt(2.25, 5, 0.2));
  });

  it('points the key light of b1 (az 225, el 50) to the back left and up', () => {
    const d = directionFromAzEl(225, 50, { x: 0, y: 0, z: 0 });
    expect(d.x).toBeLessThan(0);
    expect(d.z).toBeLessThan(0);
    expect(d.y).toBeCloseTo(Math.sin((50 * Math.PI) / 180));
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });

  it('keeps only the requested share of a light hue at luminance 1', () => {
    const out = { x: 0, y: 0, z: 0 };
    surfaceLightColor(0.8, 0.4, 0.1, 0.15, out);
    expect(luminance(out.x, out.y, out.z)).toBeCloseTo(1);
    const full = surfaceLightColor(0.8, 0.4, 0.1, 1, { x: 0, y: 0, z: 0 });
    expect(out.x - out.z).toBeCloseTo((full.x - full.z) * 0.15);
    expect(surfaceLightColor(0, 0, 0, 0.5, { x: 1, y: 1, z: 1 })).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('falls off smoothly to zero at the range', () => {
    expect(pointFalloff(0, 3.5)).toBe(1);
    expect(pointFalloff(3.5, 3.5)).toBe(0);
    expect(pointFalloff(1, 3.5)).toBeGreaterThan(pointFalloff(2, 3.5));
    expect(pointFalloff(1, 0)).toBe(0);
  });
});

describe('tilt-shift band', () => {
  it('is exactly zero for every row of the sharp band 54..324 (LD-T03)', () => {
    for (let row = DOF_SHARP_TOP_PX; row <= DOF_SHARP_BOTTOM_PX; row++)
      expect(tiltShiftWeight(row)).toBe(0);
  });

  it('rises to full blur at the reference frame edges', () => {
    expect(tiltShiftWeight(DOF_SHARP_TOP_PX - 1)).toBeGreaterThan(0);
    expect(tiltShiftWeight(0)).toBe(1);
    expect(tiltShiftWeight(359)).toBeGreaterThan(0.9);
    expect(tiltShiftWeight(-20)).toBe(1);
    expect(tiltShiftRadius(0)).toBe(DOF_MAX_RADIUS_PX);
  });

  it('grows monotonically away from the band', () => {
    for (let row = 1; row < DOF_SHARP_TOP_PX; row++)
      expect(tiltShiftWeight(row - 1)).toBeGreaterThanOrEqual(tiltShiftWeight(row));
    for (let row = DOF_SHARP_BOTTOM_PX + 1; row < 360; row++)
      expect(tiltShiftWeight(row)).toBeGreaterThanOrEqual(tiltShiftWeight(row - 1));
  });

  it('maps GL target rows to reference rows (1920 x 950: origin -22)', () => {
    expect(refRowOfTargetRow(0, 316, -22)).toBe(337);
    expect(refRowOfTargetRow(315, 316, -22)).toBe(22);
    expect(refRowOfTargetRow(359, 360, 0)).toBe(0);
  });
});

describe('screen shake', () => {
  it('is zero without trauma, with scale 0, and after decay', () => {
    const s = createShake();
    const out = { x: 9, y: 9 };
    decayShake(s, 1);
    expect(shakeOffset(s, 1, 1, out)).toEqual({ x: 0, y: 0 });
    addTrauma(s, 1);
    expect(shakeOffset(s, 1.1, 0, out)).toEqual({ x: 0, y: 0 });
    decayShake(s, 3);
    expect(s.trauma).toBe(0);
  });

  it('gives whole px offsets within the max amplitude', () => {
    const s = createShake();
    decayShake(s, 0);
    addTrauma(s, 1);
    const out = { x: 0, y: 0 };
    let moved = false;
    for (let t = 0; t < 0.2; t += 0.01) {
      shakeOffset(s, t, 1, out);
      expect(Number.isInteger(out.x) && Number.isInteger(out.y)).toBe(true);
      expect(Math.abs(out.x)).toBeLessThanOrEqual(SHAKE_MAX_PX);
      expect(Math.abs(out.y)).toBeLessThanOrEqual(SHAKE_MAX_PX);
      if (out.x !== 0 || out.y !== 0) moved = true;
    }
    expect(moved).toBe(true);
  });

  it('resets when the render clock jumps back (new run)', () => {
    const s = createShake();
    decayShake(s, 10);
    addTrauma(s, 0.8);
    decayShake(s, 0.5);
    expect(s.trauma).toBe(0);
  });
});

function areaPool(
  list: readonly {
    shape: number;
    x: number;
    y: number;
    r?: number;
    x2?: number;
    y2?: number;
    hw?: number;
  }[],
): AreaPoolView {
  const n = list.length;
  const f = (k: (a: (typeof list)[number]) => number): Float64Array =>
    Float64Array.from(list.map(k));
  return {
    capacity: n,
    highWater: n,
    alive: new Uint8Array(n).fill(1),
    serial: new Uint32Array(n),
    x: f((a) => a.x),
    y: f((a) => a.y),
    prevX: f((a) => a.x),
    prevY: f((a) => a.y),
    radius: f((a) => a.r ?? 0),
    shape: Uint8Array.from(list.map((a) => a.shape)),
    kind: new Uint8Array(n),
    sourceRef: new Int32Array(n),
    x2: f((a) => a.x2 ?? 0),
    y2: f((a) => a.y2 ?? 0),
    p0: f((a) => a.hw ?? 0),
    p1: new Float64Array(n),
    p2: new Float64Array(n),
    ticksLeft: new Int32Array(n),
    ticksTotal: new Int32Array(n),
  };
}

function worldWith(areas: AreaPoolView): WorldView {
  const w = createFakeWorld();
  w.dangerAreas = areas;
  return w;
}

describe('K3 danger rules', () => {
  it('caps stacked fill alpha at 35% and leaves opaque pixels alone', () => {
    const two = 1 - 0.7 * 0.7;
    expect(two * stackedFillScale(two)).toBeCloseTo(STACKED_FILL_MAX_ALPHA);
    expect(stackedFillScale(0.3)).toBe(1);
    expect(stackedFillScale(1)).toBe(1);
    // Ten stacked 30% fills still read as one 35% fill.
    const ten = 1 - 0.7 ** 10;
    expect(ten * stackedFillScale(ten)).toBeCloseTo(STACKED_FILL_MAX_ALPHA);
  });

  it('detects a telegraph circle over the player sprite', () => {
    const w = worldWith(areaPool([{ shape: AreaShape.Circle, x: 0.5, y: -1, r: 1 }]));
    expect(playerCoveredByDanger(w, 0, 0)).toBe(true);
  });

  it('ignores a telegraph that is clearly away from the player', () => {
    const w = worldWith(areaPool([{ shape: AreaShape.Circle, x: 6, y: 3, r: 1.5 }]));
    expect(playerCoveredByDanger(w, 0, 0)).toBe(false);
  });

  it('counts the sprite height: a circle just above the feet on screen covers the player', () => {
    // Floor y - 1.8 u is 18 px above the feet on screen, inside the 22 px sprite.
    const w = worldWith(areaPool([{ shape: AreaShape.Circle, x: 0, y: -2.4, r: 0.7 }]));
    expect(playerCoveredByDanger(w, 0, 0)).toBe(true);
  });

  it('detects a line telegraph crossing the player', () => {
    const w = worldWith(
      areaPool([{ shape: AreaShape.Line, x: -5, y: -0.5, x2: 5, y2: -0.5, hw: 0.3 }]),
    );
    expect(playerCoveredByDanger(w, 0, 0)).toBe(true);
  });

  it('detects an enemy shot on the player', () => {
    const w = createFakeWorld({ enemyShots: 1 });
    (w.enemyShots.x as Float64Array)[0] = 0.1;
    (w.enemyShots.y as Float64Array)[0] = -0.5;
    expect(playerCoveredByDanger(w as unknown as WorldView, 0, 0)).toBe(true);
  });
});

describe('damage number cap', () => {
  const ring = (n: number): { live: Uint8Array; crit: Uint8Array; born: Float64Array } => ({
    live: new Uint8Array(n),
    crit: new Uint8Array(n),
    born: new Float64Array(n),
  });

  it('uses a free slot while under the cap', () => {
    const r = ring(30);
    r.live.fill(1, 0, 5);
    expect(pickDamageSlot(r.live, r.crit, r.born, DAMAGE_NUMBER_CAP)).toBe(5);
  });

  it('replaces the oldest normal number at the cap, never a crit first', () => {
    const r = ring(30);
    for (let i = 0; i < DAMAGE_NUMBER_CAP; i++) {
      r.live[i] = 1;
      r.born[i] = 10 + i;
    }
    r.crit[0] = 1; // oldest is a crit
    expect(pickDamageSlot(r.live, r.crit, r.born, DAMAGE_NUMBER_CAP)).toBe(1);
  });

  it('replaces the oldest crit when every live number is a crit', () => {
    const r = ring(4);
    r.live.fill(1);
    r.crit.fill(1);
    r.born.set([5, 3, 4, 6]);
    expect(pickDamageSlot(r.live, r.crit, r.born, 4)).toBe(1);
  });

  it('pushes numbers out of the player box to the side they are on', () => {
    // Right on the player's head, slightly right of centre.
    const dx = playerBoxPushPx(0.1, 0, 14, 4, 5, 0, 0);
    expect(dx).toBeGreaterThan(0);
    expect(playerBoxPushPx(-0.1, 0, 14, 4, 5, 0, 0)).toBeLessThan(0);
    // Far away: untouched.
    expect(playerBoxPushPx(3, 0, 14, 4, 5, 0, 0)).toBe(0);
  });
});

describe('Pulse light', () => {
  it('runs the open wave from the centre to the edge in 0.6 s, then stops', () => {
    const s = createPulseLight();
    const o = { waveRadius: 0, waveAlpha: 0, floorLift: 0, rimFlash: 0 };
    pulseOpened(s, 10);
    samplePulseLight(s, 10 + PULSE_WAVE_SEC / 2, 1, o);
    expect(o.waveRadius).toBeCloseTo(0.5);
    expect(o.waveAlpha).toBeGreaterThan(0);
    expect(o.floorLift).toBeLessThanOrEqual(PULSE_LIFT);
    samplePulseLight(s, 12, 1, o);
    expect(o).toEqual({ waveRadius: -1, waveAlpha: 0, floorLift: 0, rimFlash: 0 });
  });

  it('flashes the rim once on close and softens under reduce effects', () => {
    const s = createPulseLight();
    const o = { waveRadius: 0, waveAlpha: 0, floorLift: 0, rimFlash: 0 };
    pulseClosed(s, 5);
    samplePulseLight(s, 5.01, 1, o);
    const full = o.rimFlash;
    samplePulseLight(s, 5.01, 0.4, o);
    expect(o.rimFlash).toBeCloseTo(full * 0.4);
    samplePulseLight(s, 5 + PULSE_FLASH_SEC + 0.01, 1, o);
    expect(o.rimFlash).toBe(0);
  });

  it('reads as inactive when the clock is before the stored start (new run)', () => {
    const s = createPulseLight();
    const o = { waveRadius: 0, waveAlpha: 0, floorLift: 0, rimFlash: 0 };
    pulseOpened(s, 30);
    samplePulseLight(s, 1, 1, o);
    expect(o.waveRadius).toBe(-1);
  });
});

/** HSV hue (deg) and saturation of an sRGB triple. */
function hsv(r: number, g: number, b: number): [number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [(h + 360) % 360, mx === 0 ? 0 : d / mx];
}

describe('procedural env textures', () => {
  it('is deterministic and fills the whole atlas size', () => {
    const a = buildEnvAtlas(palette, 'b1');
    const b = buildEnvAtlas(palette, 'b1');
    expect(a.data.length).toBe(ENV_ATLAS_W * ENV_ATLAS_H * 4);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  for (const biome of ['b1', 'b2', 'b3']) {
    it(`keeps ${biome} texels inside LD 7.2 hue and saturation limits`, () => {
      const a = buildEnvAtlas(palette, biome);
      for (let i = 0; i < a.data.length; i += 4) {
        if ((a.data[i + 3] ?? 0) === 0 && (a.data[i] ?? 0) === 0) continue; // unused swatch
        const [h, s] = hsv(a.data[i] ?? 0, a.data[i + 1] ?? 0, a.data[i + 2] ?? 0);
        const blueCyan = h >= 170 && h <= 250;
        const redViolet = h >= 270 || h <= 10;
        if (blueCyan || redViolet) expect(s).toBeLessThanOrEqual(0.4);
        const emissive = (a.data[i + 3] ?? 255) < 255;
        if (emissive) expect(s).toBeLessThanOrEqual(0.6);
      }
    });
  }

  it('falls back to b1 tokens for roles a biome lacks', () => {
    expect(roleColor(palette, 'b2', 'wood')).not.toEqual([0, 0, 0]);
    expect(roleColor(palette, 'b3', 'indigo')).toBeDefined();
  });
});

describe('boundaryEdges', () => {
  it('returns outward half-planes: the centre is inside, a far point outside', () => {
    const boundary: readonly (readonly [number, number])[] = [
      [-13, -10],
      [13, -10],
      [16, -7],
      [16, 7],
      [13, 10],
      [-13, 10],
      [-16, 7],
      [-16, -7],
    ];
    const edges = boundaryEdges(boundary);
    expect(edges).toHaveLength(8);
    const outside = (x: number, y: number): number =>
      Math.max(...edges.map((e) => e.x * x + e.y * y - e.z));
    expect(outside(0, 0)).toBeLessThan(0);
    expect(outside(0, -13)).toBeCloseTo(3);
    expect(outside(20, 0)).toBeCloseTo(4);
    expect(outside(16, 0)).toBeCloseTo(0);
  });
});
