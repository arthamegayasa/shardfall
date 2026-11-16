// Instanced billboard sprite shader (AD, LP review; architecture.md 7.2, 7.6).
// Feet are projected, snapped to a whole virtual pixel, and the quad is built in integer px around them,
// so every sprite texel lands on exactly one virtual pixel. The whole quad takes the feet depth.
// Mirror in TS: src/render/sprites/frame-select.ts spriteQuad (unit tested).

/** Per-instance layout, in floats. Keep in sync with sprite-batch.ts. */
export const SPRITE_INSTANCE_ATTRIBUTES = {
  /** three.js world position of the feet: (x, h, y). */
  iPos: 3,
  /** Atlas rect in px: x, y, w, h. */
  iRect: 4,
  /** left, top (px from feet, y up), extra offset dx, dy (px, y up). */
  iOff: 4,
  /** flip (-1 or 1), alpha, unused, unused. */
  iParams: 4,
  /** Flash colour (linear rgb) and amount 0..1. */
  iFlash: 4,
} as const;

export const SPRITE_VERTEX = /* glsl */ `
uniform vec2 uRes;
uniform vec2 uAtlasSize;
uniform float uDepthBias;
attribute vec3 iPos;
attribute vec4 iRect;
attribute vec4 iOff;
attribute vec4 iParams;
attribute vec4 iFlash;
varying vec2 vUv;
varying vec4 vFlash;
varying float vAlpha;

void main() {
  vec4 clip = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
  vec2 ndc = clip.xy / clip.w;
  // Feet pixel, y up, snapped to the nearest pixel corner.
  vec2 feet = floor((ndc * 0.5 + 0.5) * uRes + 0.5);
  float lx = iOff.x + position.x * iRect.z;
  float x = iParams.x < 0.0 ? -lx : lx;
  float y = iOff.y - iRect.w + position.y * iRect.w;
  vec2 p = feet + vec2(x, y) + iOff.zw;
  gl_Position = vec4(p / uRes * 2.0 - 1.0, clip.z / clip.w - uDepthBias, 1.0);
  // Atlas row 0 is v = 0 (flipY false): the top of the rect is iRect.y.
  vUv = vec2(iRect.x + position.x * iRect.z, iRect.y + (1.0 - position.y) * iRect.w) / uAtlasSize;
  vFlash = iFlash;
  vAlpha = iParams.y;
}
`;

export const SPRITE_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vFlash;
varying float vAlpha;

void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.5 || vAlpha <= 0.0) discard;
  gl_FragColor = vec4(mix(t.rgb, vFlash.rgb, vFlash.a), vAlpha);
}
`;
