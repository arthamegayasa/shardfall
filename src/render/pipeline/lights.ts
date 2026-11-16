// Light math shared by the environment and sprite shaders (architecture.md 7.6, art-direction 6). LP.
// Pure functions: direction from azimuth and elevation, point light selection per quality, flicker,
// and the light colour normalisation that keeps the arena floor neutral (15% hue to surfaces).

/** Minimal mutable 3-vector so callers can pass three's Vector3 or a plain object. */
export interface Vec3Out {
  x: number;
  y: number;
  z: number;
}

/**
 * Unit vector from the scene toward a directional light, in three space (x right, y up, z toward the
 * camera). Azimuth 0 = from the camera side, 90 = from screen right, 180 = from the back, 270 = left.
 */
export function directionFromAzEl(azimuthDeg: number, elevationDeg: number, out: Vec3Out): Vec3Out {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const c = Math.cos(el);
  out.x = Math.sin(az) * c;
  out.y = Math.sin(el);
  out.z = Math.cos(az) * c;
  return out;
}

/**
 * Indices of the point lights to use: the first `max` entries in data order. Arena data lists lights
 * by priority and the first four are left-right symmetric so Low quality keeps the floor even (LD 8).
 */
export function selectPointLights(count: number, max: number): number[] {
  const n = Math.max(0, Math.min(count, Math.floor(max)));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
}

/** Flicker frequencies in Hz: smooth noise between 2 and 4 Hz (art-direction 6). */
const FLICKER_HZ: readonly [number, number, number] = [2.1, 2.9, 3.7];

/**
 * Brightness multiplier of a flickering light at time t (seconds). Deterministic per seed, smooth,
 * always within [1 - amount, 1]: a light never goes fully dark (flash safety, accessibility A-02).
 */
export function flickerAt(timeSec: number, seed: number, amount: number): number {
  const a = Math.min(1, Math.max(0, amount));
  if (a === 0) return 1;
  const s = seed * 1.618;
  let n = 0;
  for (let i = 0; i < FLICKER_HZ.length; i++) {
    const hz = FLICKER_HZ[i] ?? 2;
    n += Math.sin(timeSec * hz * Math.PI * 2 + s * (i + 1));
  }
  // n in [-3, 3] -> [0, 1]
  const u = (n / FLICKER_HZ.length + 1) * 0.5;
  return 1 - a * u;
}

/** Rec. 709 luminance of a linear rgb colour. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Light colour as seen by surfaces: normalised to luminance 1, then only `hueKeep` of its hue is kept
 * (the rest becomes neutral white). art-direction 6: surfaces take about 15% of the light hue so the
 * floor stays under the saturation limit. Writes linear rgb into out.
 */
export function surfaceLightColor(
  r: number,
  g: number,
  b: number,
  hueKeep: number,
  out: Vec3Out,
): Vec3Out {
  const l = luminance(r, g, b);
  if (l <= 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const k = Math.min(1, Math.max(0, hueKeep));
  out.x = 1 + (r / l - 1) * k;
  out.y = 1 + (g / l - 1) * k;
  out.z = 1 + (b / l - 1) * k;
  return out;
}

/** Smooth point light falloff used by the shaders: smoothstep of (1 - d / range), 0 outside range. */
export function pointFalloff(distance: number, range: number): number {
  if (range <= 0) return 0;
  const t = Math.min(1, Math.max(0, 1 - distance / range));
  return t * t * (3 - 2 * t);
}
