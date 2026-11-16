// Sprite source format: art/sprites/<id>.json or <id>.ts (architecture.md 10, art-pipeline 3). [Frozen M1]
// Canonical home of SpriteSheetDef. art/sprites/sprite-types.ts re-exports these types (AD, M1-05).
// Hand-authored sprites are JSON. Procedural sprites are TS modules whose default export has this shape.

export type SpriteClass =
  | 'kept'
  | 'unlit-small'
  | 'unlit-medium'
  | 'unlit-large'
  | 'warden'
  | 'boss'
  | 'glint'
  | 'projectile-danger'
  | 'projectile-kept'
  | 'portrait'
  | 'prop'
  | 'tile'
  | 'vfx-kept'
  | 'vfx-danger'
  | 'icon';

/** Colour side, decides allowed palette tokens (style-guide 1.3). `env` and `neutral` use no team colours. */
export type Faction = 'kept' | 'unlit' | 'neutral' | 'env';

export interface SpriteAnimation {
  /** Each frame is an array of equal-length rows. With `mirror`, rows hold the left half only. */
  readonly frames: readonly (readonly string[])[];
  /** Sim ticks (60 Hz) per frame. 0 for static or tile variants. */
  readonly ticksPerFrame: number;
  readonly loop: boolean;
}

export interface SpriteSheetDef {
  /** kebab-case, unique, group prefix: kept-, unlit-, warden-, boss-, fx-, prop-, tile-, icon-. */
  readonly id: string;
  readonly class: SpriteClass;
  readonly faction: Faction;
  /** Frame box in sprite px (art-direction 3). */
  readonly frameW: number;
  readonly frameH: number;
  /** Feet position inside the frame, in px. Convention: bottom centre { x: floor(frameW / 2), y: frameH - 1 }. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Overrides on top of the default legend (art-pipeline 3.2). '.' is always transparent. */
  readonly legend?: Readonly<Record<string, string>>;
  /** 'ink': auto 1 px ink outline, plus unlit-rim on the top inner edge for faction unlit. */
  readonly outline: 'ink' | 'none';
  /** Outline neighbourhood. Default 4 (thin limbs stay separate in silhouette). */
  readonly outlineMode?: 4 | 8;
  /** true: row + reversed(row). 'odd': shares the last column as the centre column. */
  readonly mirror?: boolean | 'odd';
  /** Extra tokens that glow for this sprite, on top of palette-level emissive tokens. */
  readonly emissive?: readonly string[];
  readonly status: 'concept' | 'placeholder' | 'final';
  /** One line for reviewers: role, silhouette key, and the one "slightly wrong" trait. */
  readonly note?: string;
  readonly animations: Readonly<Record<string, SpriteAnimation>>;
}
