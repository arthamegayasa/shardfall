// Shaders (AD, LP review; coding-standards 8: one shader per file, .glsl via ?raw or a .ts template).
// Sprite: instanced billboards with per-instance light (LP's lighting.ts), emissive, hit flash, dissolve.
// Area: ground telegraphs, zones, decals. lighting.ts: LP's shared scene lighting chunk.
export {
  EMISSIVE_ALPHA_BYTE,
  KEPT_MIN_LIGHT,
  SPRITE_FRAGMENT,
  SPRITE_INSTANCE_ATTRIBUTES,
  SPRITE_VERTEX,
  SpriteLight,
  spriteVertex,
} from './sprite.ts';
export { AREA_FRAGMENT, AREA_INSTANCE_ATTRIBUTES, AREA_MERGE_MAX, AREA_VERTEX } from './area.ts';
