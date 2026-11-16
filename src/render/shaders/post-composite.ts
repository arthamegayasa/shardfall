// Final composite at physical canvas resolution (LP; architecture 7.5, art-direction 7, CD K3).
// Per screen pixel: scene texel nearest (texelFetch, exact) -> DoF band mix with the bilinear blur ->
// bilinear bloom -> vignette -> biome grade -> glass glint in two corners -> danger layer L4 (nearest,
// stacked fills capped at 35%) -> see-through player silhouette -> sRGB. The sharp band rows 54..324
// never read the blur, so DoF on and off give identical pixels there (LD-T03, S-6).

import { OPAQUE_ALPHA, STACKED_FILL_MAX_ALPHA } from '../pipeline/danger-rules.ts';
import { TILT_SHIFT_WEIGHT_GLSL } from './post-tilt-shift.ts';

/** Share of the bloom held off the player's own sprite pixels (LP M2-09 legibility). */
export const PLAYER_BLOOM_HOLD = 0.85;

export const POST_COMPOSITE_FRAGMENT = /* glsl */ `
${TILT_SHIFT_WEIGHT_GLSL}
uniform sampler2D uScene;
uniform sampler2D uBlur;
uniform sampler2D uBloomA;
uniform sampler2D uBloomB;
uniform sampler2D uDanger;
uniform sampler2D uMask;
uniform vec2 uVirtual;        // virtual size (px)
uniform vec2 uViewport;       // physical size of the scaled area (px)
uniform float uOriginY;
uniform vec2 uShake;          // whole virtual px
uniform float uDof;
uniform float uBloomLevels;
uniform float uBloom;
uniform vec2 uVignette;       // strength, start distance
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uGrade;
uniform float uGlint;
uniform vec3 uGlass;
uniform float uTime;
uniform float uSilhouette;    // 1 when danger covers the player
uniform vec2 uFeet;           // player feet, virtual px (GL origin)
uniform float uHasPlayer;
uniform vec3 uKeptCyan;
uniform vec3 uKeptWhite;
varying vec2 vUv;

float sfLinearToSrgb(float c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

float sfGlintLines(vec2 p, float size) {
  // p: px from the corner. Diagonal distance from the corner, lines drift outward ~4 px/s.
  float u = (p.x + p.y) * 0.70710678;
  if (u > size) return 0.0;
  float fade = smoothstep(size * 0.08, size * 0.25, u) * (1.0 - smoothstep(size * 0.55, size, u));
  float l = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float pos = mod(size * (0.22 + fk * 0.19) + uTime * 4.0, size);
    float w = fk == 1.0 ? 2.0 : 1.2;
    l += 1.0 - smoothstep(0.0, w, abs(u - pos));
  }
  return min(l, 1.0) * fade;
}

void main() {
  vec2 vpx = vUv * uVirtual;
  ivec2 maxT = ivec2(uVirtual) - 1;
  ivec2 t = clamp(ivec2(floor(vpx - uShake)), ivec2(0), maxT);
  vec2 suv = (vpx - uShake) / uVirtual;
  vec3 c = texelFetch(uScene, t, 0).rgb;

  if (uDof > 0.5) {
    float refRow = uVirtual.y - 1.0 - float(t.y) - uOriginY;
    float w = sfTiltWeight(refRow);
    if (w > 0.0) c = mix(c, texture2D(uBlur, suv).rgb, min(1.0, w * 1.5));
  }
  // Player pixels keep their own colours: bloom from nearby effects (Glint pickups, rings, the Rite
  // flare) is mostly held off the sprite so the Kept never washes out to a white blob (LP M2-09).
  vec2 rel = vec2(t) + 0.5 - uFeet;
  bool nearPlayer = uHasPlayer > 0.5 && abs(rel.x) < 16.0 && rel.y > -6.0 && rel.y < 30.0;
  vec4 m = nearPlayer ? texelFetch(uMask, t, 0) : vec4(0.0);
  float bloomKeep = 1.0 - ${PLAYER_BLOOM_HOLD.toFixed(3)} * m.r;
  if (uBloomLevels > 0.5) c += texture2D(uBloomA, suv).rgb * uBloom * bloomKeep;
  if (uBloomLevels > 1.5) c += texture2D(uBloomB, suv).rgb * uBloom * 0.6 * bloomKeep;
  c = clamp(c, 0.0, 1.0);

  // Vignette: 20% darker in the corners, starting at normalised distance 0.55.
  vec2 dv = (vUv - 0.5) * 2.0;
  float dist = length(dv) * 0.70710678;
  c *= 1.0 - uVignette.x * smoothstep(uVignette.y, 1.0, dist);
  // Grade: shadows toward lift, highlights toward gain.
  c = mix(c, uLift + c * (uGain - uLift), uGrade);
  // Glass glint, top-left and bottom-right corners only (never the centre).
  if (uGlint > 0.5) {
    vec2 p = vUv * uViewport;
    float size = uViewport.y * 0.24;
    float g = sfGlintLines(vec2(p.x, uViewport.y - p.y), size) + sfGlintLines(vec2(uViewport.x - p.x, p.y), size);
    c = mix(c, uGlass, clamp(g, 0.0, 1.0) * 0.1);
  }

  // Danger layer (premultiplied). Stacked fills read as one fill: alpha capped at 35% (K3).
  vec4 d = texelFetch(uDanger, t, 0);
  if (d.a < ${OPAQUE_ALPHA.toFixed(3)} && d.a > ${STACKED_FILL_MAX_ALPHA.toFixed(3)}) {
    d *= ${STACKED_FILL_MAX_ALPHA.toFixed(3)} / d.a;
  }
  c = c * (1.0 - d.a) + d.rgb;

  // See-through player silhouette above the danger layer.
  // Only pixels near the player's feet can belong to the silhouette (sprite 24 x 24 plus ring).
  if (nearPlayer) {
    if (m.r < 0.5) {
      vec4 n0 = texelFetch(uMask, clamp(t + ivec2(1, 0), ivec2(0), maxT), 0);
      vec4 n1 = texelFetch(uMask, clamp(t - ivec2(1, 0), ivec2(0), maxT), 0);
      vec4 n2 = texelFetch(uMask, clamp(t + ivec2(0, 1), ivec2(0), maxT), 0);
      vec4 n3 = texelFetch(uMask, clamp(t - ivec2(0, 1), ivec2(0), maxT), 0);
      float edge = max(max(n0.r, n1.r), max(n2.r, n3.r));
      float occ = max(max(n0.g, n1.g), max(n2.g, n3.g));
      if (edge > 0.5 && uSilhouette > 0.5) c = uKeptWhite;
      else if (edge > 0.5 && occ > 0.5) c = mix(c, uKeptCyan, 0.5);
    } else if (m.g > 0.5) {
      c = mix(c, uKeptCyan, 0.25);
    }
    if (uSilhouette > 0.5) {
      // Foot ring: 1 px kept-cyan ellipse around the feet.
      vec2 q = (vec2(t) + 0.5 - uFeet) / vec2(7.0, 3.0);
      float e = length(q);
      if (abs(e - 1.0) * 3.0 < 0.55) c = uKeptCyan;
    }
  }

  gl_FragColor = vec4(sfLinearToSrgb(c.r), sfLinearToSrgb(c.g), sfLinearToSrgb(c.b), 1.0);
}
`;
