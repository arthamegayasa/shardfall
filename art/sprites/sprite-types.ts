// Sprite source format (Art Director). Spec: docs/art-pipeline.md section 3.
// Base fields match `SpriteSheetDef` in docs/tech/architecture.md section 10 (Lead Programmer).
// Extensions (class, mirror, outlineMode, emissive, status, note) are AD additions; the rasterizer output is unchanged.
// Hand-authored sprites are JSON (`art/sprites/<id>.json`). Procedural sprites are TS modules (`art/sprites/<id>.ts`)
// whose default export has the same shape.

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

/** Colour side, decides allowed palette tokens (style-guide 1.3). `env` and `neutral` may use no team colours. */
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
  /** Frame box in sprite px (docs/art-direction.md section 3). */
  readonly frameW: number;
  readonly frameH: number;
  /** Feet position inside the frame, in px. Convention: bottom centre { x: floor(frameW / 2), y: frameH - 1 }. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Overrides on top of the default legend (docs/art-pipeline.md 3.2). '.' is always transparent. */
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
