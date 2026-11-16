// Backdrop flat behind the market (LP; CD brief 1.1, LD 12.2): night sky over distant rooftops and the
// ribs of a broken glass dome, painted procedurally on one camera-facing quad. Only the top band of the
// screen shows it, where the tilt-shift blur softens it. Pixel-quantised to 16 texels per u.

export const ENV_BACKDROP_VERTEX = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const ENV_BACKDROP_FRAGMENT = /* glsl */ `
uniform vec3 uVoid;
uniform vec3 uHaze;
uniform vec3 uGlass;
uniform vec3 uWindow;
uniform float uTime;
varying vec2 vLocal;   // x in u across, y = height on the flat in u (0 = bottom edge)

float bHash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 q = floor(vLocal * 16.0) / 16.0;
  float y = q.y;
  // Sky: void at the top, a faint haze toward the rooftops.
  vec3 col = mix(uHaze, uVoid, smoothstep(0.0, 9.0, y));
  // Broken glass dome: rings and meridian ribs around a centre below the market, some panes missing.
  vec2 c = vec2(0.0, -14.0);
  vec2 d = q - c;
  float r = length(d);
  float ang = atan(d.x, d.y);
  float cell = floor(ang * 9.0);
  float band = floor(r / 3.2);
  float broken = step(0.62, bHash(vec2(cell, band)));
  float rib = (1.0 - step(0.07, abs(fract(ang * 9.0) - 0.5) * r * 0.7)) * step(r, 30.0);
  float ring = (1.0 - step(0.06, abs(fract(r / 3.2) - 0.5) * 3.2)) * step(r, 30.0);
  float frame = max(rib, ring) * (1.0 - broken * 0.8);
  float pane = (1.0 - broken) * step(r, 30.0) * 0.05;
  col = mix(col, uGlass * 0.32, frame * 0.45);
  col += uGlass * pane * 0.25;
  // Rare glints in the glass, slowly twinkling.
  float s = bHash(floor(q * 4.0));
  if (s > 0.995) col += uGlass * 0.25 * (0.6 + 0.4 * sin(uTime * 1.3 + s * 40.0));
  // Distant rooftops and towers (darker than the haze), with a few lit windows.
  float colId = floor(q.x / 1.25);
  float h = 1.2 + 2.6 * bHash(vec2(colId, 3.0));
  if (bHash(vec2(colId, 9.0)) > 0.86) h += 2.2;
  if (y < h) {
    col = uVoid * 0.72;
    float win = step(0.93, bHash(floor(q * vec2(3.0, 2.0))));
    col = mix(col, uWindow, win * 0.35);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
