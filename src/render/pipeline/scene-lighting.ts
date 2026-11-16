// Scene light uniforms shared by environment and sprite shaders (architecture.md 7.6). LP.
// Colours and intensities come from art/palette.json (biome key, fill, point preset); positions,
// intensity multipliers, and flicker overrides from the arena JSON (lighting.points). The number of
// live point lights follows the quality profile (Low 4, Medium and High 8).

import { Color, Matrix4, Vector3, Vector4 } from 'three';
import type { Texture } from 'three';
import type { ArenaDef, PaletteBiomeDef } from '../../core/index.ts';
import {
  directionFromAzEl,
  flickerAt,
  luminance,
  selectPointLights,
  surfaceLightColor,
} from './lights.ts';
import { MAX_POINT_LIGHTS } from './quality.ts';

/** Share of the key and fill hue that reaches surfaces (art-direction 6: about 15%). */
export const DIRECT_HUE_KEEP = 0.2;
/** Lantern pools keep more of their warmth; they sit outside the arena boundary (LD 8). */
export const POINT_HUE_KEEP = 0.7;
/** Exposure applied to palette intensities so the arena centre lands near 0.75 of albedo (linear). */
export const LIGHT_EXPOSURE = 0.52;
/** Neutral ambient, a little toward the fill colour, so faces turned away are not black. */
export const AMBIENT_LEVEL = 0.2;
/** Lantern intensity multiplier on top of the palette preset (point lights are local accents). */
export const POINT_GAIN = 2.4;

// A type alias (not an interface) so it is assignable to Record<string, { value: unknown }>.
export type SceneLightingUniforms = {
  readonly uKeyDir: { value: Vector3 };
  readonly uKeyColor: { value: Vector3 };
  readonly uFillDir: { value: Vector3 };
  readonly uFillColor: { value: Vector3 };
  readonly uAmbient: { value: Vector3 };
  readonly uPointPos: { value: Vector4[] };
  readonly uPointColor: { value: Vector3[] };
  readonly uPointCount: { value: number };
  readonly uCenterLevel: { value: number };
  readonly uShadowMap: { value: Texture | null };
  readonly uShadowMatrix: { value: Matrix4 };
  readonly uShadowOn: { value: number };
  readonly uShadowTexel: { value: number };
  readonly uShadowPcf: { value: number };
};

/** One resolved lantern: base colour and flicker, position in three space. */
interface PointLightDef {
  readonly pos: Vector3;
  readonly range: number;
  readonly color: Vector3;
  readonly flicker: number;
  readonly seed: number;
}

export interface SceneLighting {
  readonly uniforms: SceneLightingUniforms;
  /** Arena ids of point lights in uniform order (index = slot in uPointPos), for emissive linking. */
  readonly pointIds: readonly string[];
  /** Current flicker multiplier per point slot (emissive lanterns follow their light). */
  readonly flicker: Float32Array;
  setBiome(biome: PaletteBiomeDef, arena: ArenaDef): void;
  setMaxPoints(max: number): void;
  update(timeSec: number): void;
}

function linear(hex: string): Color {
  return new Color(hex);
}

export function createSceneLighting(): SceneLighting {
  const u: SceneLightingUniforms = {
    uKeyDir: { value: new Vector3(0, 1, 0) },
    uKeyColor: { value: new Vector3(0.5, 0.5, 0.5) },
    uFillDir: { value: new Vector3(0, 1, 0) },
    uFillColor: { value: new Vector3(0.2, 0.2, 0.2) },
    uAmbient: { value: new Vector3(AMBIENT_LEVEL, AMBIENT_LEVEL, AMBIENT_LEVEL) },
    uPointPos: { value: Array.from({ length: MAX_POINT_LIGHTS }, () => new Vector4(0, 0, 0, 1)) },
    uPointColor: { value: Array.from({ length: MAX_POINT_LIGHTS }, () => new Vector3()) },
    uPointCount: { value: 0 },
    uCenterLevel: { value: 1 },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new Matrix4() },
    uShadowOn: { value: 0 },
    uShadowTexel: { value: 1 / 1024 },
    uShadowPcf: { value: 0 },
  };
  let points: PointLightDef[] = [];
  const pointIds: string[] = [];
  const flicker = new Float32Array(MAX_POINT_LIGHTS).fill(1);
  let maxPoints = MAX_POINT_LIGHTS;
  const tmp = { x: 0, y: 0, z: 0 };

  const centerLevel = (): number => {
    // Floor at the arena centre, normal up, no shadow, no lanterns: ambient + key + fill.
    const k = u.uKeyColor.value;
    const f = u.uFillColor.value;
    const a = u.uAmbient.value;
    const kd = Math.max(0, u.uKeyDir.value.y);
    const fd = Math.max(0, u.uFillDir.value.y);
    return luminance(
      a.x + k.x * kd + f.x * fd,
      a.y + k.y * kd + f.y * fd,
      a.z + k.z * kd + f.z * fd,
    );
  };

  return {
    uniforms: u,
    pointIds,
    flicker,
    setBiome(biome, arena) {
      const key = linear(biome.key.color);
      const fill = linear(biome.fill.color);
      directionFromAzEl(biome.key.azimuthDeg, biome.key.elevationDeg, u.uKeyDir.value);
      directionFromAzEl(biome.fill.azimuthDeg, biome.fill.elevationDeg, u.uFillDir.value);
      surfaceLightColor(key.r, key.g, key.b, DIRECT_HUE_KEEP, tmp);
      u.uKeyColor.value
        .set(tmp.x, tmp.y, tmp.z)
        .multiplyScalar(biome.key.intensity * LIGHT_EXPOSURE);
      surfaceLightColor(fill.r, fill.g, fill.b, DIRECT_HUE_KEEP, tmp);
      u.uFillColor.value
        .set(tmp.x, tmp.y, tmp.z)
        .multiplyScalar(biome.fill.intensity * LIGHT_EXPOSURE);
      // Ambient: neutral with a touch of the fill hue (moonlight in the shadows).
      surfaceLightColor(fill.r, fill.g, fill.b, DIRECT_HUE_KEEP, tmp);
      u.uAmbient.value.set(tmp.x, tmp.y, tmp.z).multiplyScalar(AMBIENT_LEVEL);
      u.uCenterLevel.value = centerLevel();

      const pc = linear(biome.point.color);
      surfaceLightColor(pc.r, pc.g, pc.b, POINT_HUE_KEEP, tmp);
      // Older palette files used radiusPx (16 px per u); rangeU is the current field.
      const range = biome.point.rangeU ?? (biome.point.radiusPx ?? 56) / 16;
      points = arena.lighting.points.map((p, i) => ({
        // Arena pos is [x, h, y]; three space is (x, h, y).
        pos: new Vector3(p.pos[0], p.pos[1], p.pos[2]),
        range,
        color: new Vector3(tmp.x, tmp.y, tmp.z).multiplyScalar(
          biome.point.intensity * (p.intensityMul ?? 1) * POINT_GAIN * LIGHT_EXPOSURE,
        ),
        flicker: p.flicker ?? biome.point.flicker,
        seed: i + 1,
      }));
      pointIds.length = 0;
      for (const p of arena.lighting.points) pointIds.push(p.id);
    },
    setMaxPoints(max) {
      maxPoints = Math.max(0, Math.min(MAX_POINT_LIGHTS, max));
    },
    update(timeSec) {
      const live = selectPointLights(points.length, maxPoints);
      u.uPointCount.value = live.length;
      for (let s = 0; s < MAX_POINT_LIGHTS; s++) {
        const p = points[s];
        const f = p === undefined ? 1 : flickerAt(timeSec, p.seed, p.flicker);
        flicker[s] = f;
        if (s >= live.length || p === undefined) continue;
        u.uPointPos.value[s]?.set(p.pos.x, p.pos.y, p.pos.z, p.range);
        u.uPointColor.value[s]?.copy(p.color).multiplyScalar(f);
      }
    },
  };
}
