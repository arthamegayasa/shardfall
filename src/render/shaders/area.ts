// Ground area shader for telegraphs, spawn rings, and player zones (AD; architecture.md 6.4, 7.4).
// One floor quad per area covers its bounding box; the fragment shader evaluates the shape in screen px
// (16 px per u across, 10 px per u deep). Edges are exactly 1 virtual px (fwidth), fills are flat
// alpha, no anti-aliasing, so telegraph edges stay crisp like sprites (art-direction 8.1).
//
// M4 (AD, M4-01, CD M3 polish 3): merged fills. A batch created with merge on (player zones) uploads
// every circle it draws (uMerge, uMergeCount); a fill texel already covered by an earlier circle is
// skipped and an edge texel inside another circle becomes fill, so stacked zones read as one fill with
// one outline instead of growing denser (style-guide 1.8).
//
// M5 (LP, BUG-016): hazard pattern (aMode.z = 2, colour vision modes only, danger areas only). The edge is
// 2 virtual px and striped every 3 px between a pale tint of the edge colour and the edge colour; the
// fill alternates 4 px diagonal bands between HAZARD_FILL_HI (capped at the stacked fill limit, 35%) and
// HAZARD_FILL_LO times the style alpha. Bands are laid on absolute virtual px, so stacked telegraphs
// stripe in phase. Player zones never use it: stripes mean danger even when hue cannot (protan, deutan).

/** Per-instance layout, in floats. Keep in sync with vfx/area-batch.ts. */
export const AREA_INSTANCE_ATTRIBUTES = {
  /** x, y, x2, y2 in world u. */
  aGeo: 4,
  /** radius, p0, p1, p2 (AreaPoolView meaning). */
  aShape: 4,
  /** shape (AreaShape), fill progress 0..1, dashed edge 0/1, instance index (merged fills). */
  aMode: 4,
  /** Fill colour (linear rgb) and alpha. */
  aFill: 4,
  /** Edge colour (linear rgb) and alpha. */
  aEdge: 4,
} as const;

import { STACKED_FILL_MAX_ALPHA } from '../pipeline/danger-rules.ts';

/** Hazard pattern constants (BUG-016). Fill bands: high = min(alpha + HI_ADD, MAX), low = alpha * LO. */
export const HAZARD_EDGE_PX = 2;
export const HAZARD_STRIPE_PX = 3;
export const HAZARD_BAND_PX = 4;
export const HAZARD_FILL_HI_ADD = 0.05;
export const HAZARD_FILL_MAX = STACKED_FILL_MAX_ALPHA;
export const HAZARD_FILL_LO = 0.6;
/** Share of white mixed into the edge colour for the pale stripes (close to danger-core). */
export const HAZARD_PALE_MIX = 0.75;

/** Max circles a merged batch can test against (uMerge array length). */
export const AREA_MERGE_MAX = 64;

export const AREA_VERTEX = /* glsl */ `
attribute vec4 aGeo;
attribute vec4 aShape;
attribute vec4 aMode;
attribute vec4 aFill;
attribute vec4 aEdge;
varying vec2 vWorld;
varying vec4 vGeo;
varying vec4 vShape;
varying vec4 vMode;
varying vec4 vFill;
varying vec4 vEdge;

void main() {
  vec2 lo;
  vec2 hi;
  float pad = 0.25;
  if (aMode.x > 1.5 && aMode.x < 2.5) {
    // Line: segment plus half width.
    lo = min(aGeo.xy, aGeo.zw) - vec2(aShape.y + pad);
    hi = max(aGeo.xy, aGeo.zw) + vec2(aShape.y + pad);
  } else {
    lo = aGeo.xy - vec2(aShape.x + pad);
    hi = aGeo.xy + vec2(aShape.x + pad);
  }
  vec2 w = mix(lo, hi, position.xy);
  vWorld = w;
  vGeo = aGeo;
  vShape = aShape;
  vMode = aMode;
  vFill = aFill;
  vEdge = aEdge;
  gl_Position = projectionMatrix * viewMatrix * vec4(w.x, 0.0, w.y, 1.0);
}
`;

export const AREA_FRAGMENT = /* glsl */ `
varying vec2 vWorld;
varying vec4 vGeo;
varying vec4 vShape;
varying vec4 vMode;
varying vec4 vFill;
varying vec4 vEdge;

uniform vec4 uMerge[${AREA_MERGE_MAX}];
uniform int uMergeCount;

const vec2 PX = vec2(16.0, 10.0);
const float TAU = 6.283185307179586;

// True when world point w is strictly inside circle j of the merged batch (xy centre, z radius).
bool inMerged(int j, vec2 w) {
  vec4 m = uMerge[j];
  if (m.z <= 0.0) return false;
  vec2 d = w - m.xy;
  return dot(d, d) < m.z * m.z * 0.98;
}

// Signed turns from a to b in (-0.5, 0.5].
float turnDiff(float a, float b) {
  float d = b - a;
  return d - floor(d + 0.5);
}

void main() {
  float shape = vMode.x;
  float progress = vMode.y;
  bool hazard = vMode.z > 1.5;
  bool dashed = vMode.z > 0.5 && !hazard;
  float ew = hazard ? ${HAZARD_EDGE_PX.toFixed(1)} : 1.0;
  vec2 rel = vWorld - vGeo.xy;
  vec2 relPx = rel * PX;
  bool inside = false;
  bool edge = false;
  bool filled = false;
  float along = 0.0;

  if (shape < 1.5 || shape > 2.5) {
    float r = max(vShape.x, 1e-4);
    float q = length(rel) / r;
    float fw = max(fwidth(q), 1e-5);
    inside = q <= 1.0;
    edge = inside && (1.0 - q) < fw * ew;
    filled = q <= progress;
    // Approximate arc length in px (13 px per u is the mean of 16 and 10).
    along = atan(relPx.y, relPx.x) * r * 13.0;
    if (shape > 0.5 && shape < 1.5) {
      // Ring: inner radius p0, gap centre p1 and half width p2 in turns.
      float qi = length(rel) / max(vShape.y, 1e-4);
      float fwi = max(fwidth(qi), 1e-5);
      if (qi < 1.0) inside = false;
      edge = inside && (edge || (qi - 1.0) < fwi * ew);
      filled = inside;
      if (vShape.w > 0.0 && abs(turnDiff(vShape.z, atan(rel.y, rel.x) / TAU)) < vShape.w) inside = false;
    } else if (shape > 2.5) {
      // Cone: apex at (x, y), axis toward (x2, y2), half angle p0 in turns.
      vec2 axis = vGeo.zw - vGeo.xy;
      float d = abs(turnDiff(atan(axis.y, axis.x) / TAU, atan(rel.y, rel.x) / TAU));
      float side = (vShape.y - d) * TAU * length(relPx);
      float fws = max(fwidth(side), 1e-5);
      if (d > vShape.y) inside = false;
      edge = inside && (edge || side < fws * ew);
    }
  } else {
    // Line from (x, y) to (x2, y2), half width p0.
    vec2 ab = vGeo.zw - vGeo.xy;
    float len2 = max(dot(ab, ab), 1e-6);
    float t = dot(rel, ab) / len2;
    vec2 n = normalize(vec2(-ab.y, ab.x));
    float d = abs(dot(rel, n));
    float hw = max(vShape.y, 1e-4);
    float lenPx = length(ab * PX);
    float sPx = t * lenPx;
    float fwd = max(fwidth(d), 1e-5);
    float fws = max(fwidth(sPx), 1e-5);
    inside = t >= 0.0 && t <= 1.0 && d <= hw;
    edge = inside && ((hw - d) < fwd * ew || sPx < fws * ew || (lenPx - sPx) < fws * ew);
    filled = t <= progress;
    // Direction dashes on the centre line: 3 px on, 3 px off (art-direction 8.2).
    if (inside && d < fwd && mod(sPx, 6.0) < 3.0) edge = true;
    along = sPx;
  }

  if (!inside) discard;
  if (edge && dashed && mod(along, 6.0) >= 3.0) edge = false;
  if (uMergeCount > 0) {
    int me = int(vMode.w + 0.5);
    bool coveredBefore = false;
    bool coveredOther = false;
    for (int j = 0; j < ${AREA_MERGE_MAX}; j++) {
      if (j >= uMergeCount) break;
      if (j == me || !inMerged(j, vWorld)) continue;
      coveredOther = true;
      if (j < me) coveredBefore = true;
    }
    // An edge inside another zone is interior of the union: draw it as fill.
    if (edge && coveredOther) {
      edge = false;
      filled = true;
    }
    if (!edge && coveredBefore) discard;
  }
  vec4 c = vec4(0.0);
  if (filled) c = vFill;
  if (hazard && filled && !edge) {
    vec2 wp = floor(vWorld * PX);
    bool hi = mod(wp.x + wp.y, ${(HAZARD_BAND_PX * 2).toFixed(1)}) < ${HAZARD_BAND_PX.toFixed(1)};
    c.a = hi ? min(vFill.a + ${HAZARD_FILL_HI_ADD.toFixed(2)}, ${HAZARD_FILL_MAX.toFixed(2)}) : vFill.a * ${HAZARD_FILL_LO.toFixed(2)};
  }
  if (edge) c = vEdge;
  if (edge && hazard && mod(floor(along), ${(HAZARD_STRIPE_PX * 2).toFixed(1)}) < ${HAZARD_STRIPE_PX.toFixed(1)}) {
    c.rgb = mix(vEdge.rgb, vec3(1.0), ${HAZARD_PALE_MIX.toFixed(2)});
  }
  if (c.a <= 0.0) discard;
  gl_FragColor = c;
}
`;
