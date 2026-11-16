// Floor shader (LP; architecture 7.2, LD 4.3, art-direction 6). One large floor quad: the arena floor
// and lip use AD's floor tile (texel = 1/16 u across, 1/10 u deep, so one texel = one virtual pixel),
// with a per-stone variant, mirror, and tone; beyond the lip the ground falls to the curb tone and the
// edge fog. Also draws the Pulse open wave and floor lift, and the faint boss stage ring (LD 9).

import { ENV_COMMON_GLSL } from './env-common.ts';
import { SCENE_LIGHTING_GLSL } from './lighting.ts';

export const ENV_FLOOR_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const ENV_FLOOR_FRAGMENT = /* glsl */ `
${SCENE_LIGHTING_GLSL}
${ENV_COMMON_GLSL}
uniform sampler2D uTile;      // variants stacked vertically, 16 x 16 texels each
uniform float uVariants;
uniform float uLip;
uniform vec3 uCurb;
uniform vec4 uPulse;          // wave radius (0..1, < 0 off), wave alpha, floor lift, rim flash
uniform vec2 uPulseOrigin;
uniform vec2 uPulseExtent;    // half extents used to normalise the wave radius
uniform vec3 uGlass;
uniform vec4 uBossRing;       // centre xy, radius, ring darkening (0 = none)
varying vec3 vWorld;

void main() {
  vec2 p = vWorld.xz;
  // Texel grid: 16 per u across, 10 per u in depth (one texel = one virtual pixel).
  vec2 texel = floor(vec2(p.x * 16.0, p.y * 10.0) + 1e-3);
  vec2 tile = floor(texel / 16.0);
  float h = sfHash(tile + 17.0);
  float variant = min(floor(h * uVariants), uVariants - 1.0);
  vec2 inTile = mod(texel, 16.0);
  if (sfHash(tile + 41.0) > 0.5) inTile.x = 15.0 - inTile.x;
  vec3 c = texelFetch(uTile, ivec2(int(inTile.x), int(variant * 16.0 + inTile.y)), 0).rgb;
  // Per-stone tone and broad wear keep the floor alive without raising saturation.
  c *= 0.95 + 0.08 * sfHash(tile + 3.0);
  c *= 0.96 + 0.06 * sfNoise(p * 0.3);
  float out_ = sfOutside(p);
  // Faint boss stage ring: contrast well under 1.15 (LD 9).
  if (uBossRing.w > 0.0) {
    float r = length((p - uBossRing.xy) * vec2(1.0, 1.0));
    if (abs(r - uBossRing.z) < 0.18) c *= 1.0 - uBossRing.w;
  }
  // Beyond the lip: the ground drops to the curb tone with sparse darker texels.
  if (out_ > uLip) {
    float k = smoothstep(uLip, uLip + 1.2, out_);
    vec3 g = uCurb * (0.9 + 0.16 * sfHash(texel * 0.5));
    c = mix(c, g, k);
  }
  float inside = step(out_, 0.0);
  // Stage light: the diorama stage is lit, the market floor around it falls off (lanterns still reach).
  float stage = 1.0 - 0.38 * smoothstep(uLip, uLip + 4.0, out_);
  vec3 fp = vec3(p.x, 0.0, p.y);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 col = c * (sfDirect(up, sfShadow(fp)) * stage + sfPoints(fp, up)) * (1.0 + uPulse.z * inside);
  if (uPulse.x >= 0.0) {
    float rn = length((p - uPulseOrigin) / uPulseExtent);
    float ring = 1.0 - smoothstep(0.0, 0.06, abs(rn - uPulse.x));
    float trail = smoothstep(uPulse.x - 0.25, uPulse.x, rn) * step(rn, uPulse.x) * 0.35;
    col += uGlass * (ring + trail) * uPulse.y * inside;
  }
  col = mix(col, uFogColor, sfFogAmount(p));
  gl_FragColor = vec4(col, 1.0);
}
`;
