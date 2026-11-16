// Decor and obstacle shader (LP; architecture 7.6, art-direction 6, 10). One merged mesh per arena:
// pixel texels from the env atlas (nearest, 16 per u), lit by the shared scene lights, emissive
// lantern paper driven by the flicker of its light, vertex sway for cloth, strings, and paper, and the
// edge fog toward the biome void.

import { ENV_COMMON_GLSL } from './env-common.ts';
import { SCENE_LIGHTING_GLSL } from './lighting.ts';

export const ENV_DECOR_VERTEX = /* glsl */ `
attribute vec2 aTex;
attribute vec2 aSwatch;
attribute vec4 aAnim;   // sway x, sway z (u per u of lever), phase, pivot height
attribute vec4 aMisc;   // emissive gain, light slot (-1 steady), angular freq, bob amplitude
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vTex;
varying vec2 vSwatch;
varying float vEmissive;
varying float vLight;

void main() {
  vec3 p = position;
  float t = uTime * aMisc.z + aAnim.z;
  float lever = abs(p.y - aAnim.w);
  p.x += aAnim.x * lever * sin(t);
  p.z += aAnim.y * lever * sin(t * 0.83 + 1.3);
  p.y += aMisc.w * sin(t * 0.71);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTex = aTex;
  vSwatch = aSwatch;
  vEmissive = aMisc.x;
  vLight = aMisc.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const ENV_DECOR_FRAGMENT = /* glsl */ `
${SCENE_LIGHTING_GLSL}
${ENV_COMMON_GLSL}
uniform sampler2D uAtlas;
uniform vec2 uAtlasSize;
uniform float uFlicker[8];
uniform float uEmissiveGain;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vTex;
varying vec2 vSwatch;
varying float vEmissive;
varying float vLight;

void main() {
  // Nearest texel inside the 32 x 32 swatch (texel coords are world-scaled, 16 per u).
  vec2 t = floor(mod(vTex, 32.0));
  vec4 c = texture2D(uAtlas, (vSwatch + t + 0.5) / uAtlasSize);
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 col = c.rgb * sfLight(vWorld, n);
  float e = (1.0 - c.a) * vEmissive;
  if (e > 0.0) {
    float f = vLight >= 0.0 ? uFlicker[int(vLight + 0.5)] : 0.93;
    col += c.rgb * e * uEmissiveGain * f;
  }
  col = mix(col, uFogColor, sfFogAmount(vWorld.xz));
  gl_FragColor = vec4(col, 1.0);
}
`;
