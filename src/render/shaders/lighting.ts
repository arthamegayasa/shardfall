// Shared scene lighting GLSL (LP; architecture.md 7.6, art-direction 6). Included by the environment
// shaders and available to AD's sprite shader. Uniforms come from SceneLighting.uniforms
// (src/render/pipeline/scene-lighting.ts), which the renderer updates once per frame.
//
// Interface for sprite shaders (vertex or fragment):
//   1. spread `lighting.uniforms` into the ShaderMaterial uniforms (same objects, live updates);
//   2. prepend SCENE_LIGHTING_GLSL to the shader source;
//   3. call `sfSpriteLight(feetWorld, minLevel)` with the three.js world position of the feet
//      (x, h, y). It returns an rgb multiplier normalised so the arena centre is 1.0, warm near
//      lanterns, darker at the edges. minLevel = 0.7 for Kept (style-guide 1.6), 0.0 for Unlit.
//   Optional: sfLight(p, n) for lit surfaces, sfShadow(p) for decor shadow (1 lit, 0 shadowed).
//   Sprite fragments may write rgb above 1.0 for emissive texels: the scene target is HDR and the
//   bloom pass keeps only values above 1.0.

export const SCENE_LIGHTING_GLSL = /* glsl */ `
#define SF_MAX_POINTS 8
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
uniform vec3 uAmbient;
uniform vec4 uPointPos[SF_MAX_POINTS];
uniform vec3 uPointColor[SF_MAX_POINTS];
uniform int uPointCount;
uniform float uCenterLevel;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowOn;
uniform float uShadowTexel;
uniform float uShadowPcf;

float sfShadowTap(vec2 uv, float z) {
  return z - 0.0015 <= texture2D(uShadowMap, uv).r ? 1.0 : 0.0;
}

// 1 = lit by the key light, 0 = in a decor shadow. Outside the shadow frustum counts as lit.
float sfShadow(vec3 p) {
  if (uShadowOn < 0.5) return 1.0;
  vec4 s = uShadowMatrix * vec4(p, 1.0);
  vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x <= 0.0 || c.x >= 1.0 || c.y <= 0.0 || c.y >= 1.0 || c.z >= 1.0) return 1.0;
  if (uShadowPcf < 0.5) return sfShadowTap(c.xy, c.z);
  float t = uShadowTexel;
  return 0.25 * (sfShadowTap(c.xy + vec2(-t, -t), c.z) + sfShadowTap(c.xy + vec2(t, -t), c.z)
    + sfShadowTap(c.xy + vec2(-t, t), c.z) + sfShadowTap(c.xy + vec2(t, t), c.z));
}

vec3 sfPoints(vec3 p, vec3 n) {
  vec3 l = vec3(0.0);
  for (int i = 0; i < SF_MAX_POINTS; i++) {
    if (i >= uPointCount) break;
    vec3 d = uPointPos[i].xyz - p;
    // Lanterns light pools on the floor: height counts half toward the falloff (stylised, LD 8).
    float pool = length(vec3(d.x, d.y * 0.5, d.z));
    if (pool >= uPointPos[i].w) continue;
    float dist = length(d);
    float a = 1.0 - pool / uPointPos[i].w;
    // Wrapped diffuse so vertical faces and sprites near a lantern still catch some warmth.
    float ndl = clamp(dot(n, d / max(dist, 1e-4)) * 0.75 + 0.25, 0.0, 1.0);
    l += uPointColor[i] * (a * a * (3.0 - 2.0 * a) * ndl);
  }
  return l;
}

// Ambient, key (shadowed), and fill: everything but the lanterns.
vec3 sfDirect(vec3 n, float shadow) {
  vec3 l = uAmbient;
  l += uKeyColor * max(dot(n, uKeyDir), 0.0) * mix(0.35, 1.0, shadow);
  return l + uFillColor * max(dot(n, uFillDir), 0.0);
}

vec3 sfLightShadowed(vec3 p, vec3 n, float shadow) {
  return sfDirect(n, shadow) + sfPoints(p, n);
}

vec3 sfLight(vec3 p, vec3 n) {
  return sfLightShadowed(p, n, sfShadow(p));
}

// Per-instance sprite light at the feet, 1.0 at the arena centre. Clamped so actors never drop below
// minLevel of their palette colour and lantern pools cannot blow them out.
vec3 sfSpriteLight(vec3 feet, float minLevel) {
  vec3 l = sfLight(feet + vec3(0.0, 0.02, 0.0), vec3(0.0, 1.0, 0.0)) / max(uCenterLevel, 1e-3);
  return clamp(l, vec3(minLevel), vec3(1.3));
}
`;
