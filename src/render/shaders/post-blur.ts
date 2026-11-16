// Separable Gaussian blur for the bloom levels (LP). 9 taps along uDir, bilinear source.

export const POST_BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uDir;        // texel step along the blur axis (1 / size, scaled by spread)
varying vec2 vUv;

void main() {
  vec3 c = texture2D(uSource, vUv).rgb * 0.227027;
  c += texture2D(uSource, vUv + uDir * 1.3846).rgb * 0.316216;
  c += texture2D(uSource, vUv - uDir * 1.3846).rgb * 0.316216;
  c += texture2D(uSource, vUv + uDir * 3.2308).rgb * 0.070270;
  c += texture2D(uSource, vUv - uDir * 3.2308).rgb * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}
`;
