// Glass rim at the arena boundary (LP; LD 4.3, art-direction 1.4). Low glass edge, 0.25 u tall, dust at
// about 50% over the floor, top face brighter so it reads as a 2 px line on every side. Flashes bone on
// Pulse close (the "glass flash", art-direction 6). Drawn on L0 without depth write: never over actors.

import { SCENE_LIGHTING_GLSL } from './lighting.ts';

export const ENV_RIM_VERTEX = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const ENV_RIM_FRAGMENT = /* glsl */ `
${SCENE_LIGHTING_GLSL}
uniform vec3 uRimColor;
uniform float uRimOpacity;
uniform vec3 uFlashColor;
uniform float uFlash;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec3 n = normalize(vNormal);
  float top = step(0.5, n.y);
  vec3 l = sfLight(vWorld, vec3(0.0, 1.0, 0.0)) / max(uCenterLevel, 1e-3);
  vec3 c = uRimColor * mix(0.8, 1.1, top) * clamp(l, vec3(0.7), vec3(1.3));
  // A slow glint travelling along the rim (glass catching light).
  float g = smoothstep(0.96, 1.0, sin((vWorld.x + vWorld.z) * 0.35 - uTime * 0.6));
  c += uRimColor * g * 0.35 * top;
  float a = mix(uRimOpacity, 1.0, uFlash);
  c = mix(c, uFlashColor * 1.6, uFlash);
  gl_FragColor = vec4(c, a);
}
`;
