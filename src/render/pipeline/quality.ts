// Graphics quality profiles (architecture.md 7.7). LP. Pure: Settings in, flat profile out.
// Low keeps colour code, layers, and legibility (P3-f); it only drops optional effects.
// "Reduce effects" (accessibility A-02) is separate from quality: it removes DoF, bloom, glass glint,
// and screen shake, softens Pulse flashes, and cuts ambient particles to 30%.

import type { Settings } from '../../core/index.ts';

export type QualityLevel = Settings['graphics']['quality'];

export interface QualityProfile {
  readonly level: QualityLevel;
  readonly reduceEffects: boolean;
  /** Tilt-shift band blur (top and bottom bands only). */
  readonly dof: boolean;
  /** Bloom mip levels: 0 off, 1 = 1/2 res, 2 = 1/2 and 1/4 res. */
  readonly bloomLevels: 0 | 1 | 2;
  /** Glass glint lines in the top-left and bottom-right screen corners. */
  readonly glassGlint: boolean;
  /** Dynamic lantern lights, first N of the arena list (priority order, LD 8). */
  readonly maxPointLights: number;
  /** Decor shadow map size in texels, 0 = off. */
  readonly shadowMapSize: number;
  /** 4-tap percentage closer filtering on the shadow map. */
  readonly shadowPcf: boolean;
  /** Particle budget for ambient and VFX (architecture 7.7). */
  readonly particleCap: number;
  /** Fraction of the arena's ambient particle counts that is drawn. */
  readonly ambientFraction: number;
  /** Screen shake multiplier 0..1 (Settings screenShake / 100, 0 with reduce effects). */
  readonly screenShake: number;
  /** Multiplier on full-screen-ish light flashes (Pulse open and close). */
  readonly flashScale: number;
}

/** Lights the shaders are compiled for. Arena data allows at most 8 (LD 7.4). */
export const MAX_POINT_LIGHTS = 8;

const BASE: Readonly<
  Record<
    QualityLevel,
    Omit<
      QualityProfile,
      'level' | 'reduceEffects' | 'screenShake' | 'flashScale' | 'ambientFraction'
    >
  >
> = {
  low: {
    dof: false,
    bloomLevels: 0,
    glassGlint: false,
    maxPointLights: 4,
    shadowMapSize: 0,
    shadowPcf: false,
    particleCap: 300,
  },
  medium: {
    dof: true,
    bloomLevels: 1,
    glassGlint: true,
    maxPointLights: MAX_POINT_LIGHTS,
    shadowMapSize: 1024,
    shadowPcf: false,
    particleCap: 600,
  },
  high: {
    dof: true,
    bloomLevels: 2,
    glassGlint: true,
    maxPointLights: MAX_POINT_LIGHTS,
    shadowMapSize: 2048,
    shadowPcf: true,
    particleCap: 1000,
  },
};

/** Reduce effects keeps this share of ambient particles (art-direction 8.3). */
const REDUCED_AMBIENT_FRACTION = 0.3;
/** Reduce effects keeps Pulse light flashes, softer (they carry timing information). */
const REDUCED_FLASH_SCALE = 0.4;

export function qualityProfile(s: Settings): QualityProfile {
  const level: QualityLevel = s.graphics.quality in BASE ? s.graphics.quality : 'medium';
  const base = BASE[level];
  const reduce = s.access.reduceEffects;
  const shake = Math.min(1, Math.max(0, s.graphics.screenShake / 100));
  return {
    ...base,
    level,
    reduceEffects: reduce,
    dof: base.dof && !reduce,
    bloomLevels: reduce ? 0 : base.bloomLevels,
    glassGlint: base.glassGlint && !reduce,
    screenShake: reduce ? 0 : shake,
    flashScale: reduce ? REDUCED_FLASH_SCALE : 1,
    ambientFraction: reduce ? REDUCED_AMBIENT_FRACTION : 1,
  };
}

/** Medium without reduce effects: the profile before the first applySettings. */
export function defaultQuality(): QualityProfile {
  return {
    ...BASE.medium,
    level: 'medium',
    reduceEffects: false,
    screenShake: 1,
    flashScale: 1,
    ambientFraction: 1,
  };
}

/** WebGL renderer strings of software rasterizers (no GPU: headless CI, remote desktops). */
export function isSoftwareRenderer(unmaskedRenderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(unmaskedRenderer);
}

/** Quality on a software rasterizer: never above Low, whatever the player chose. */
export function softwareCap(q: QualityProfile): QualityProfile {
  return {
    ...q,
    dof: false,
    bloomLevels: 0,
    glassGlint: false,
    maxPointLights: Math.min(q.maxPointLights, BASE.low.maxPointLights),
    shadowMapSize: 0,
    shadowPcf: false,
    particleCap: Math.min(q.particleCap, BASE.low.particleCap),
  };
}
