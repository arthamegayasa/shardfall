// Shared GLSL for environment shaders (LP): hash noise and the edge fog (art-direction 7, LD 4.3).
// Fog starts startOutside u beyond the boundary and is full at endOutside; the back side (decor zone)
// fades at half rate so the market stays visible behind the stage. The boundary is passed as up to 8
// outward half-planes (n.x, n.y, d): outside distance = max(n . p - d).

export const ENV_COMMON_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform vec4 uFog;        // start, end, strength, back rate
uniform vec3 uEdges[8];   // outward normal xy, offset
uniform int uEdgeCount;
uniform float uBackY;     // min y of the boundary (back edge)

float sfHash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

float sfNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sfHash(i), sfHash(i + vec2(1.0, 0.0)), u.x),
             mix(sfHash(i + vec2(0.0, 1.0)), sfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Distance outside the arena boundary in u (negative inside).
float sfOutside(vec2 p) {
  float d = -1e4;
  for (int i = 0; i < 8; i++) {
    if (i >= uEdgeCount) break;
    d = max(d, dot(uEdges[i].xy, p) - uEdges[i].z);
  }
  return d;
}

float sfFogAmount(vec2 p) {
  // Compress depth behind the back edge: the decor zone fades at uFog.w of the normal rate.
  vec2 q = p;
  if (q.y < uBackY) q.y = uBackY + (q.y - uBackY) * uFog.w;
  return smoothstep(uFog.x, uFog.y, sfOutside(q)) * uFog.z;
}
`;
