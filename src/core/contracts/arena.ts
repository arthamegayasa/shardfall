// Arena definition: content/levels/<id>.json, owned by LD (architecture.md 6.10, 9.6). [Frozen M1]
// All distances in world u. Floor positions are [x, y] where y is the floor depth axis
// (arena-design calls it z; +y points toward the camera, down the screen).
// Sim reads: arena.boundary, projectileMargin, playerStart, pulseOrigin, safeZones, spawn,
// bossStage.shape, obstacles. Render reads the rest. Light colours come from art/palette.json.

export type Vec2 = readonly [number, number];

export type Shape =
  | { readonly type: 'rect'; readonly min: Vec2; readonly max: Vec2 }
  | { readonly type: 'circle'; readonly center: Vec2; readonly radius: number }
  /** Convex, clockwise on screen. */
  | { readonly type: 'polygon'; readonly points: readonly Vec2[] };

export type SpawnSector = 'n' | 's' | 'e' | 'w' | 'ne' | 'se' | 'sw' | 'nw';

export interface ArenaDef {
  readonly schemaVersion: 1;
  /** snake_case, equals the file name, referenced by biomes.csv arena_id. */
  readonly id: string;
  readonly arena: {
    /** Convex polygon, clockwise on screen. */
    readonly boundary: readonly Vec2[];
    readonly lip: number;
    readonly rim: {
      readonly height: number;
      readonly colorToken: string;
      readonly opacity: number;
    };
    readonly projectileMargin: number;
    readonly floor: {
      readonly baseToken: string;
      readonly altToken: string;
      readonly tileId: string;
    };
  };
  readonly playerStart: { readonly default: Vec2; readonly boss: Vec2 };
  readonly pulseOrigin: Vec2;
  readonly safeZones: readonly {
    readonly id: string;
    readonly shape: Shape;
    readonly blocks: readonly ('obstacle' | 'spawn' | 'decor')[];
  }[];
  readonly spawn: {
    readonly playerSafeRadius: number;
    readonly interiorMinPlayerDist: number;
    /** 8 sectors n, s, e, w, ne, se, sw, nw. */
    readonly zones: readonly { readonly id: string; readonly shape: Shape }[];
  };
  readonly bossStage: {
    readonly shape: Shape;
    readonly landmarkId: string;
    readonly floorRingContrastMax: number;
  };
  readonly lighting: {
    /** Colour = palette biome fog. */
    readonly edgeFade: { readonly startOutside: number; readonly endOutside: number };
    /** Max 8, in priority order: Low quality uses the first 4. Colour and base intensity from the palette. */
    readonly points: readonly {
      readonly id: string;
      readonly pos: readonly [number, number, number];
      readonly intensityMul?: number;
      readonly flicker?: number;
    }[];
  };
  readonly obstacles: readonly {
    readonly id: string;
    readonly kind: string;
    readonly shape: Shape;
    readonly height: number;
    readonly blocks: readonly ('move' | 'projectile')[];
  }[];
  readonly decor: readonly {
    readonly id: string;
    readonly kind: string;
    readonly zone: 'back' | 'side' | 'front';
    readonly pos: Vec2;
    readonly rotYDeg: number;
    readonly height: number;
    readonly footprintHalf: Vec2;
    readonly anim?: string;
    readonly lightId?: string;
  }[];
  readonly ambient: {
    readonly particles: readonly {
      readonly kind: string;
      readonly area: 'arena' | 'decor';
      readonly max: number;
      readonly colorToken: string;
      readonly opacity: number;
      readonly sizePx: number;
    }[];
  };
}
