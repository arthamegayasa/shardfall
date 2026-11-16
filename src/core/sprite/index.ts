// Pure sprite rasterizer and atlas packer, shared by render, UI icons, and art tools (architecture.md 10).
export { compileSprite, DEFAULT_LEGEND, frameToRgba, HEIGHT_RANGE, tokenRgb } from './rasterize.ts';
export type { CompiledAnimation, CompiledFrame, CompiledSprite, Rgb } from './rasterize.ts';
export { packAtlas } from './atlas-pack.ts';
export type {
  AtlasFrameRect,
  AtlasManifest,
  AtlasSpriteEntry,
  PackedAtlas,
  PackOptions,
} from './atlas-pack.ts';
