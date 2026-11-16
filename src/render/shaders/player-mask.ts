// Player mask for the see-through silhouette (LP; LD 9, CD K3, architecture 7.4). Re-draws the player
// sprite alone with AD's sprite vertex shader into a mask target: r = player coverage, g = covered by
// something nearer in the scene (scene depth closer than the player's feet depth).

export const PLAYER_MASK_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform sampler2D uSceneDepth;
uniform vec2 uRes;
varying vec2 vUv;

void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.5) discard;
  float sceneZ = texelFetch(uSceneDepth, ivec2(gl_FragCoord.xy), 0).r;
  float occluded = sceneZ < gl_FragCoord.z - 0.00004 ? 1.0 : 0.0;
  gl_FragColor = vec4(1.0, occluded, 0.0, 1.0);
}
`;
