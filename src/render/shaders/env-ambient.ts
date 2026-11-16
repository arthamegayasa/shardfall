// Ambient particles from arena data (LP; LD 7.3, art-direction 8.2): glass dust over the arena (1 px,
// bone or dust, at most 25% opacity, never gold) and moths circling the lanterns in the decor zone.
// Motion is computed in the vertex shader from per-particle seeds and the render clock: no CPU work
// per frame. Points snap to whole virtual pixels.

export const ENV_AMBIENT_VERTEX = /* glsl */ `
attribute vec4 aSeed;     // four uniform randoms
attribute vec4 aParams;   // kind (0 arena drift, 1 decor orbit), size px, opacity, anchor index
attribute vec3 aColor;    // linear colour from the arena's colour token
uniform float uTime;
uniform vec2 uRes;
uniform vec4 uDustBox;    // min x, max x, min y, max y (u)
uniform vec4 uAnchors[16];// moth anchors: x, h, y, radius
varying float vAlpha;
varying vec3 vColor;

void main() {
  vec3 p;
  vColor = aColor;
  float a = aParams.z;
  if (aParams.x < 0.5) {
    // Dust: slow drift with wrap inside the box, gentle rise and fall, slow twinkle.
    vec2 span = uDustBox.yw - uDustBox.xz;
    vec2 base = uDustBox.xz + aSeed.xy * span;
    vec2 drift = vec2(0.18, -0.07) * uTime * (0.4 + aSeed.z);
    vec2 xy = uDustBox.xz + mod(base - uDustBox.xz + drift, span);
    float h = 0.4 + aSeed.w * 2.2 + 0.25 * sin(uTime * (0.3 + aSeed.z * 0.4) + aSeed.x * 20.0);
    p = vec3(xy.x, h, xy.y);
    a *= 0.55 + 0.45 * sin(uTime * (0.7 + aSeed.y) + aSeed.w * 30.0);
  } else {
    vec4 an = uAnchors[int(aParams.w + 0.5)];
    float t = uTime * (1.6 + aSeed.x * 1.4) + aSeed.y * 6.2831;
    float r = an.w * (0.6 + 0.4 * aSeed.z);
    p = vec3(an.x + cos(t) * r, an.y + sin(t * 1.7) * 0.25 + (aSeed.w - 0.5) * 0.4, an.z + sin(t) * r * 0.6);
  }
  vec4 clip = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vec2 px = floor((clip.xy / clip.w * 0.5 + 0.5) * uRes) + 0.5;
  gl_Position = vec4(px / uRes * 2.0 - 1.0, clip.z / clip.w, 1.0);
  gl_PointSize = aParams.y;
  vAlpha = a;
}
`;

export const ENV_AMBIENT_FRAGMENT = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, clamp(vAlpha, 0.0, 1.0));
}
`;
