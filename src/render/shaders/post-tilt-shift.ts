// Tilt-shift DoF blur, one axis per pass (LP; architecture 7.3, 7.5; art-direction 7). The blur radius
// comes from the reference frame row (GLSL twin of src/render/post/band.ts tiltShiftWeight): zero in
// rows 54..324, rising with smoothstep to DOF_MAX_RADIUS_PX at the screen edge. Virtual resolution.

import { DOF_SHARP_BOTTOM_PX, DOF_SHARP_TOP_PX } from '../../core/index.ts';
import { DOF_BOTTOM_BAND_PX, DOF_MAX_RADIUS_PX, DOF_TOP_BAND_PX } from '../post/band.ts';

const f = (n: number): string => n.toFixed(1);

/** GLSL twin of tiltShiftWeight. Keep in sync with band.ts (tested there). */
export const TILT_SHIFT_WEIGHT_GLSL = /* glsl */ `
float sfSmooth01(float t) { float x = clamp(t, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float sfTiltWeight(float refRow) {
  if (refRow < ${f(DOF_SHARP_TOP_PX)}) return sfSmooth01((${f(DOF_SHARP_TOP_PX)} - refRow) / ${f(DOF_TOP_BAND_PX)});
  if (refRow > ${f(DOF_SHARP_BOTTOM_PX)}) return sfSmooth01((refRow - ${f(DOF_SHARP_BOTTOM_PX)}) / ${f(DOF_BOTTOM_BAND_PX)});
  return 0.0;
}
`;

export const POST_TILT_SHIFT_FRAGMENT = /* glsl */ `
${TILT_SHIFT_WEIGHT_GLSL}
uniform sampler2D uSource;
uniform vec2 uSize;       // virtual size in px
uniform vec2 uAxis;       // (1, 0) or (0, 1)
uniform float uOriginY;   // reference frame origin inside the virtual frame
varying vec2 vUv;

void main() {
  float row = floor(vUv.y * uSize.y);
  float refRow = uSize.y - 1.0 - row - uOriginY;
  float r = sfTiltWeight(refRow) * ${f(DOF_MAX_RADIUS_PX)};
  if (r <= 0.0) {
    gl_FragColor = vec4(texture2D(uSource, vUv).rgb, 1.0);
    return;
  }
  vec2 step_ = uAxis / uSize * r * 0.5;
  vec3 c = texture2D(uSource, vUv).rgb * 0.2;
  c += (texture2D(uSource, vUv + step_).rgb + texture2D(uSource, vUv - step_).rgb) * 0.17;
  c += (texture2D(uSource, vUv + step_ * 2.0).rgb + texture2D(uSource, vUv - step_ * 2.0).rgb) * 0.13;
  c += (texture2D(uSource, vUv + step_ * 3.0).rgb + texture2D(uSource, vUv - step_ * 3.0).rgb) * 0.07;
  c += (texture2D(uSource, vUv + step_ * 4.0).rgb + texture2D(uSource, vUv - step_ * 4.0).rgb) * 0.03;
  gl_FragColor = vec4(c, 1.0);
}
`;
