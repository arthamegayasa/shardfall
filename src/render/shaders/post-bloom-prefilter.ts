// Bloom prefilter (LP; architecture 7.5, art-direction 7): keeps only HDR values above 1.0 (emissive
// lanterns, glows written by sprite shaders) and downsamples to half resolution with 5 bilinear taps.

export const POST_BLOOM_PREFILTER_FRAGMENT = /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uTexel;      // 1 / source size
varying vec2 vUv;

vec3 sfBright(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  // Soft knee around 1.0: nothing below the threshold reaches the bloom.
  float k = clamp(m - 1.0, 0.0, 4.0);
  return c * (k / max(m, 1e-4));
}

void main() {
  vec3 c = sfBright(texture2D(uSource, vUv).rgb) * 0.4;
  c += sfBright(texture2D(uSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb) * 0.15;
  c += sfBright(texture2D(uSource, vUv + uTexel * vec2(1.0, -1.0)).rgb) * 0.15;
  c += sfBright(texture2D(uSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb) * 0.15;
  c += sfBright(texture2D(uSource, vUv + uTexel * vec2(1.0, 1.0)).rgb) * 0.15;
  gl_FragColor = vec4(c, 1.0);
}
`;
