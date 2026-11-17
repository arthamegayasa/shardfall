// Instanced billboard sprite shader (AD, LP review; architecture.md 7.2, 7.6).
// Feet are projected, snapped to a whole virtual pixel, and the quad is built in integer px around them,
// so every sprite texel lands on exactly one virtual pixel. The whole quad takes the feet depth.
// Mirror in TS: src/render/sprites/frame-select.ts spriteQuad (unit tested).
//
// M2 (AD):
// - Light: one rgb multiplier per instance, computed in the vertex shader at the feet with LP's
//   sfSpriteLight (src/render/shaders/lighting.ts). Constant over the quad, so pixels stay crisp: no
//   gradient across texels. Mode per instance: 0 unlit (effects), 1 lit Unlit (no floor), 2 lit Kept
//   (never below 70% of palette colour, style-guide 1.6). Without LP's uniforms (SF_NO_LIGHT) all
//   modes render at palette colour.
// - Emissive texels (atlas alpha < 0.9, see sprites/atlas-texture.ts) ignore light and are multiplied
//   by uEmissiveGain so the HDR bloom pass can pick them (LP raises it when bloom is on).
// - Hit flash: mix toward iFlash.rgb by iFlash.a (kept-white player, bone Unlit, danger-red windup).
// - Dissolve: iParams.z 0..1 discards texels by a 4x4 ordered-dither threshold on the ATLAS texel, so
//   the sprite breaks up in whole pixels; texels just above the threshold take the flash colour as a
//   one-pixel breaking edge.
//
// M4 (AD, BUG-007): Outline recolour. iOutline.rgb replaces texels equal to the outline key colour
// (uOutlineKey, the palette `ink` of the 1 px actor outline) by iOutline.a, after light and hit flash, so
// a winding-up Unlit keeps its dark body and shows a bright danger outline (style-guide 1.8).

/** Per-instance layout, in floats. Keep in sync with sprite-batch.ts. */
export const SPRITE_INSTANCE_ATTRIBUTES = {
  /** three.js world position of the feet: (x, h, y). */
  iPos: 3,
  /** Atlas rect in px: x, y, w, h. */
  iRect: 4,
  /** left, top (px from feet, y up), extra offset dx, dy (px, y up). */
  iOff: 4,
  /** flip (-1 or 1), alpha, dissolve 0..1, light mode (0 none, 1 Unlit, 2 Kept). */
  iParams: 4,
  /** Flash colour (linear rgb) and amount 0..1. */
  iFlash: 4,
  /** Outline recolour (linear rgb) and amount 0..1 (0 = keep the ink outline). */
  iOutline: 4,
} as const;

/** Max per-channel distance (linear) for a texel to count as the outline key colour. */
export const OUTLINE_KEY_TOLERANCE = 0.004;

/** Light modes for iParams.w. */
export const SpriteLight = { None: 0, Unlit: 1, Kept: 2 } as const;
export type SpriteLight = (typeof SpriteLight)[keyof typeof SpriteLight];

/** Kept actors never drop below this share of their palette colour (style-guide 1.6, art-direction 6). */
export const KEPT_MIN_LIGHT = 0.7;
/** Atlas alpha written for emissive texels (sprites/atlas-texture.ts); shader threshold 0.9. */
export const EMISSIVE_ALPHA_BYTE = 200;

export const SPRITE_VERTEX_BODY = /* glsl */ `
uniform vec2 uRes;
uniform vec2 uAtlasSize;
uniform float uDepthBias;
attribute vec3 iPos;
attribute vec4 iRect;
attribute vec4 iOff;
attribute vec4 iParams;
attribute vec4 iFlash;
attribute vec4 iOutline;
varying vec2 vUv;
varying vec4 vFlash;
varying vec4 vOutline;
varying float vAlpha;
varying float vDissolve;
varying vec3 vLight;

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
  vOutline = iOutline;
  vAlpha = iParams.y;
  vDissolve = iParams.z;
  vLight = vec3(1.0);
#ifndef SF_NO_LIGHT
  if (iParams.w > 0.5) vLight = sfSpriteLight(iPos, iParams.w > 1.5 ? ${KEPT_MIN_LIGHT.toFixed(2)} : 0.0);
#endif
}
`;

export const SPRITE_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uAtlasSize;
uniform float uEmissiveGain;
uniform vec3 uOutlineKey;
varying vec2 vUv;
varying vec4 vFlash;
varying vec4 vOutline;
varying float vAlpha;
varying float vDissolve;
varying vec3 vLight;

// 4x4 Bayer threshold in (0, 1) for an integer texel.
float bayer4(vec2 t) {
  vec2 m = mod(floor(t), 4.0);
  float i = m.x + m.y * 4.0;
  float b = 0.0;
  if (i < 0.5) b = 0.0; else if (i < 1.5) b = 8.0; else if (i < 2.5) b = 2.0; else if (i < 3.5) b = 10.0;
  else if (i < 4.5) b = 12.0; else if (i < 5.5) b = 4.0; else if (i < 6.5) b = 14.0; else if (i < 7.5) b = 6.0;
  else if (i < 8.5) b = 3.0; else if (i < 9.5) b = 11.0; else if (i < 10.5) b = 1.0; else if (i < 11.5) b = 9.0;
  else if (i < 12.5) b = 15.0; else if (i < 13.5) b = 7.0; else if (i < 14.5) b = 13.0; else b = 5.0;
  return (b + 0.5) / 16.0;
}

void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.5 || vAlpha <= 0.0) discard;
  vec3 c = t.rgb;
  bool emissive = t.a < 0.9;
  c = emissive ? c * uEmissiveGain : c * vLight;
  c = mix(c, vFlash.rgb, vFlash.a);
  if (vOutline.a > 0.0 && all(lessThan(abs(t.rgb - uOutlineKey), vec3(${OUTLINE_KEY_TOLERANCE.toFixed(4)})))) {
    c = mix(c, vOutline.rgb, vOutline.a);
  }
  if (vDissolve > 0.0) {
    float th = bayer4(vUv * uAtlasSize);
    if (th < vDissolve) discard;
    if (th < vDissolve + 0.13) c = vFlash.rgb;
  }
  gl_FragColor = vec4(c, vAlpha);
}
`;

/** Vertex shader source with or without LP's scene lighting chunk. */
export function spriteVertex(lightingGlsl: string | null): string {
  return lightingGlsl === null
    ? `#define SF_NO_LIGHT\n${SPRITE_VERTEX_BODY}`
    : `${lightingGlsl}\n${SPRITE_VERTEX_BODY}`;
}

/** Unlit vertex shader (no scene lighting), kept for callers of the M1 export. */
export const SPRITE_VERTEX = spriteVertex(null);
