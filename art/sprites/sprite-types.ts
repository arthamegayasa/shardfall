// Sprite source format (Art Director). Spec: docs/art-pipeline.md section 3.
// Re-export only: the canonical SpriteSheetDef lives in src/core/contracts/sprite.ts (LP, architecture.md 10),
// so generators keep importing from here and never drift from the runtime type.

export type {
  Faction,
  SpriteAnimation,
  SpriteClass,
  SpriteSheetDef,
} from '../../src/core/contracts/sprite.ts';
