// PLACEHOLDER floor mesh. Owner AD (architecture.md 5: src/render/env). Written by LP in M1-01 so the
// stage renders before AD's environment work. TODO(AD, M1-05): replace with the real arena mesh, lip, rim.
// Texel rule (architecture 7.2): 1 texel = 1/16 u in x and 1/10 u in depth; a 16 x 16 tile covers 1 x 1.6 u.

import {
  DataTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { compileSprite, frameToRgba } from '../../core/index.ts';
import type { PaletteDef, SpriteSheetDef, Vec2 } from '../../core/index.ts';

/** Depth in u covered by one 16-texel tile row (16 texels / 10 texels per u). */
const TILE_DEPTH_U = 1.6;

export function createFloorTexture(tile: SpriteSheetDef, palette: PaletteDef): DataTexture | null {
  const compiled = compileSprite(tile, palette);
  const first = Object.values(compiled.anims)[0]?.frames[0];
  if (first === undefined || first.w === 0) return null;
  const tex = new DataTexture(
    frameToRgba(first, palette),
    first.w,
    first.h,
    RGBAFormat,
    UnsignedByteType,
  );
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false;
  tex.repeat.set(1, 1 / TILE_DEPTH_U);
  tex.needsUpdate = true;
  return tex;
}

/** Flat floor polygon in world u (sim x, y), lying on three's XZ plane. */
export function createFloorMesh(
  boundary: readonly Vec2[],
  texture: DataTexture | null,
  fallbackHex: string,
): Mesh {
  const shape = new Shape();
  boundary.forEach(([x, y], i) => {
    // ShapeGeometry lives in XY; rotating by -90 deg about X maps (x, -y) to (x, 0, y).
    if (i === 0) shape.moveTo(x, -y);
    else shape.lineTo(x, -y);
  });
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  const material =
    texture !== null
      ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
      : new MeshBasicMaterial({ color: fallbackHex, side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 0;
  return mesh;
}

/** Arena outline used until LD's arena_proto.json exists: 32 x 20 u with 3 u cut corners (architecture 7.3). */
export const DEFAULT_ARENA_BOUNDARY: readonly Vec2[] = [
  [-13, -10],
  [13, -10],
  [16, -7],
  [16, 7],
  [13, 10],
  [-13, 10],
  [-16, 7],
  [-16, -7],
];
