// One billboard sprite quad cut from the atlas (architecture.md 7.2). LP + AD.
// M1 stub: one Mesh per actor. TODO(LP, M1-05): one InstancedMesh per layer with per-instance UV rect,
// flip, flash, and minimum brightness, plus pixel snapping in the vertex shader.

import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { Texture } from 'three';
import { DEPTH_PX_PER_U, PX_PER_U } from '../../core/index.ts';
import type { AtlasFrameRect, AtlasManifest, AtlasSpriteEntry } from '../../core/index.ts';
import { BILLBOARD_TILT_RAD } from '../camera.ts';

export interface ActorSprite {
  readonly mesh: Mesh;
  /** Place the feet at world floor (x, y) u, snapped to whole virtual pixels. */
  setPosition(x: number, y: number): void;
  /** Pick the frame for a render clock in ticks. */
  setFrame(animation: string, clockTicks: number): void;
  setFacing(facing: number): void;
}

function writeQuad(
  geo: BufferGeometry,
  entry: AtlasSpriteEntry,
  f: AtlasFrameRect,
  atlasW: number,
  atlasH: number,
): void {
  // Local px with +y up, feet at the bottom edge of the anchor row.
  const left = (f.ox - entry.anchor.x) / PX_PER_U;
  const right = (f.ox + f.w - entry.anchor.x) / PX_PER_U;
  const top = (entry.anchor.y + 1 - f.oy) / PX_PER_U;
  const bottom = (entry.anchor.y + 1 - f.oy - f.h) / PX_PER_U;
  const pos = geo.getAttribute('position') as BufferAttribute;
  const uv = geo.getAttribute('uv') as BufferAttribute;
  pos.setXYZ(0, left, bottom, 0);
  pos.setXYZ(1, right, bottom, 0);
  pos.setXYZ(2, right, top, 0);
  pos.setXYZ(3, left, top, 0);
  // Atlas row 0 is at v = 0 (flipY false), so the top of the rect is v = y / H.
  const u0 = f.x / atlasW;
  const u1 = (f.x + f.w) / atlasW;
  const vTop = f.y / atlasH;
  const vBottom = (f.y + f.h) / atlasH;
  uv.setXY(0, u0, vBottom);
  uv.setXY(1, u1, vBottom);
  uv.setXY(2, u1, vTop);
  uv.setXY(3, u0, vTop);
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeBoundingSphere();
}

export function createActorSprite(
  texture: Texture,
  manifest: AtlasManifest,
  spriteId: string,
): ActorSprite | null {
  const entry = manifest.sprites[spriteId];
  if (entry === undefined) return null;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(8), 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5,
    depthWrite: true,
  });
  const mesh = new Mesh(geo, material);
  mesh.rotation.x = BILLBOARD_TILT_RAD;
  mesh.renderOrder = 2;
  let current: AtlasFrameRect | null = null;

  const sprite: ActorSprite = {
    mesh,
    setPosition(x, y) {
      mesh.position.set(
        Math.round(x * PX_PER_U) / PX_PER_U,
        0,
        Math.round(y * DEPTH_PX_PER_U) / DEPTH_PX_PER_U,
      );
    },
    setFrame(animation, clockTicks) {
      const anim = entry.animations[animation] ?? Object.values(entry.animations)[0];
      if (anim === undefined || anim.frames.length === 0) return;
      const n = anim.frames.length;
      const step = anim.ticksPerFrame > 0 ? Math.floor(clockTicks / anim.ticksPerFrame) : 0;
      const index = anim.loop ? step % n : Math.min(step, n - 1);
      const f = anim.frames[index];
      if (f === undefined || f === current) return;
      current = f;
      writeQuad(geo, entry, f, manifest.width, manifest.height);
    },
    setFacing(facing) {
      mesh.scale.x = facing < 0 ? -1 : 1;
    },
  };
  sprite.setFrame('idle', 0);
  return sprite;
}
