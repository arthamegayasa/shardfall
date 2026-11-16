// art/palette.json shape, owned by AD. Single source of colour and biome light (architecture.md 6.10, 10).
// [Frozen M1] Biome entries are looked up by contentId = GD biome id (biome_market, ...).

/** "#RRGGBB" */
export type HexColor = string;

export interface DirectionalLightDef {
  readonly color: HexColor;
  readonly intensity: number;
  /** 0 front (camera side), 90 screen right, 180 back, 270 screen left. */
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
}

export interface PaletteBiomeDef {
  /** Token prefix only (b1, b2, b3), never a data id. */
  readonly id: string;
  /** GD biome id, e.g. biome_market. */
  readonly contentId: string;
  readonly workingName?: string;
  /** Environment tokens, referenced as `<id>.<token>` (b1.floor-dark). */
  readonly env: Readonly<Record<string, HexColor>>;
  readonly emissive?: readonly string[];
  readonly key: DirectionalLightDef;
  readonly fill: DirectionalLightDef;
  /**
   * Point light preset. Range in world u (M0 review asked AD to rename radiusPx to rangeU);
   * consumers accept either until AD migrates the file.
   */
  readonly point: {
    readonly color: HexColor;
    readonly intensity: number;
    readonly rangeU?: number;
    readonly radiusPx?: number;
    readonly flicker: number;
  };
  readonly fog: { readonly color: HexColor; readonly strength: number };
  readonly grade: { readonly lift: HexColor; readonly gain: HexColor; readonly strength: number };
}

export interface PaletteDef {
  readonly version: number;
  /** Core tokens (style-guide 1.2), e.g. ink, kept-blue, danger-red. */
  readonly core: Readonly<Record<string, HexColor>>;
  /** Tokens that glow (written above 1.0 into the HDR scene target). */
  readonly emissive: readonly string[];
  readonly groups: {
    readonly neutral: readonly string[];
    readonly kept: readonly string[];
    readonly keptHighlight: readonly string[];
    readonly unlit: readonly string[];
  };
  readonly biomes: readonly PaletteBiomeDef[];
}
