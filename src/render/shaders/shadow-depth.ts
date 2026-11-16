// Depth-only shader for the decor shadow map (LP). Static: rendered once per arena or quality change.

/** Depth-only pass for the decor shadow map (static: rendered once per arena or quality change). */
export const SHADOW_DEPTH_VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const SHADOW_DEPTH_FRAGMENT = /* glsl */ `
void main() {
  gl_FragColor = vec4(1.0);
}
`;
