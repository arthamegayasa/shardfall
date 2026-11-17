// One instanced draw call per sprite layer (architecture.md 7.4, 7.6). LP + AD.
// Fixed capacity, typed arrays allocated once; push() writes one instance, no allocation per frame.

import {
  BufferAttribute,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Texture } from 'three';
import type { AtlasFrameRect } from '../../core/index.ts';
import { SPRITE_FRAGMENT, SPRITE_INSTANCE_ATTRIBUTES, spriteVertex } from '../shaders/index.ts';

export interface SpriteBatchOptions {
  readonly capacity: number;
  /** L2 actors: depth test and write (order by feet). Other layers draw in submission order. */
  readonly depth: boolean;
  readonly renderOrder: number;
  /**
   * Scene lighting from LP (src/render/shaders/lighting.ts): the GLSL chunk and the live uniform
   * objects (shared, updated by the renderer each frame). Omitted: sprites render at palette colour.
   */
  readonly lighting?: SpriteLightingSource;
  /** Shared emissive gain uniform ({ value }), so one setter drives every batch. Default 1. */
  readonly emissiveGain?: { value: number };
  /**
   * Linear rgb of the 1 px actor outline (palette `ink`). Texels of this colour take the per-instance
   * outline recolour (windup telegraph, BUG-007). Default black (only matches pure black texels).
   */
  readonly outlineKey?: readonly [number, number, number];
}

/** What a sprite batch needs from LP's SceneLighting (uniforms are shared objects, not copies). */
export interface SpriteLightingSource {
  readonly glsl: string;
  readonly uniforms: Readonly<Record<string, { value: unknown }>>;
}

export interface SpriteBatch {
  readonly mesh: Mesh;
  readonly capacity: number;
  /** Instances dropped this frame because the batch was full (debug and tests). */
  readonly overflow: number;
  begin(): void;
  /**
   * Add one sprite. (x, y) world floor u, h height u. anchorX/Y from the atlas entry.
   * dx, dy extra px offset (y up). flash rgb is linear. dissolve 0..1 breaks the sprite up in whole
   * texels; light = SpriteLight mode (0 none, 1 Unlit, 2 Kept). outline rgb (linear) and amount
   * recolour the ink outline texels (0 = keep). scale is a whole-number size multiplier (redesign 1.1:
   * player shots), 1 = native; the quad grows about the rect centre (shaders/sprite.ts). Returns false
   * when full.
   */
  push(
    x: number,
    y: number,
    h: number,
    rect: AtlasFrameRect,
    anchorX: number,
    anchorY: number,
    flip: number,
    dx: number,
    dy: number,
    flashR: number,
    flashG: number,
    flashB: number,
    flashAmount: number,
    alpha: number,
    dissolve?: number,
    light?: number,
    outlineR?: number,
    outlineG?: number,
    outlineB?: number,
    outlineAmount?: number,
    scale?: number,
  ): boolean;
  end(): void;
  setResolution(width: number, height: number): void;
  dispose(): void;
}

export function createSpriteBatch(
  atlas: Texture,
  atlasW: number,
  atlasH: number,
  opts: SpriteBatchOptions,
): SpriteBatch {
  const cap = opts.capacity;
  const geo = new InstancedBufferGeometry();
  // Unit quad, corners (0,0) bottom-left to (1,1) top-right; the shader scales it in px.
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const A = SPRITE_INSTANCE_ATTRIBUTES;
  const make = (size: number): InstancedBufferAttribute => {
    const a = new InstancedBufferAttribute(new Float32Array(cap * size), size);
    a.setUsage(DynamicDrawUsage);
    return a;
  };
  const aPos = make(A.iPos);
  const aRect = make(A.iRect);
  const aOff = make(A.iOff);
  const aParams = make(A.iParams);
  const aFlash = make(A.iFlash);
  const aOutline = make(A.iOutline);
  geo.setAttribute('iPos', aPos);
  geo.setAttribute('iRect', aRect);
  geo.setAttribute('iOff', aOff);
  geo.setAttribute('iParams', aParams);
  geo.setAttribute('iFlash', aFlash);
  geo.setAttribute('iOutline', aOutline);
  geo.instanceCount = 0;
  const pos = aPos.array as Float32Array;
  const rectA = aRect.array as Float32Array;
  const off = aOff.array as Float32Array;
  const params = aParams.array as Float32Array;
  const flash = aFlash.array as Float32Array;
  const outline = aOutline.array as Float32Array;
  const attrs: readonly InstancedBufferAttribute[] = [aPos, aRect, aOff, aParams, aFlash, aOutline];
  const key = opts.outlineKey ?? [0, 0, 0];

  const material = new ShaderMaterial({
    vertexShader: spriteVertex(opts.lighting?.glsl ?? null),
    fragmentShader: SPRITE_FRAGMENT,
    uniforms: {
      ...(opts.lighting?.uniforms ?? {}),
      uEmissiveGain: opts.emissiveGain ?? { value: 1 },
      uAtlas: { value: atlas },
      uAtlasSize: { value: new Vector2(atlasW, atlasH) },
      uOutlineKey: { value: new Vector3(key[0], key[1], key[2]) },
      uRes: { value: new Vector2(1, 1) },
      // Pull sprites a hair toward the camera so feet never z-fight the floor at the same depth.
      uDepthBias: { value: opts.depth ? 1e-5 : 0 },
    },
    // Flipped sprites and floor quads reverse winding; never cull.
    side: DoubleSide,
    transparent: true,
    depthTest: opts.depth,
    depthWrite: opts.depth,
  });
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = opts.renderOrder;
  const res = material.uniforms['uRes']?.value as Vector2;

  let n = 0;
  let overflow = 0;
  return {
    mesh,
    capacity: cap,
    get overflow() {
      return overflow;
    },
    begin() {
      n = 0;
      overflow = 0;
    },
    push(
      x,
      y,
      h,
      rect,
      anchorX,
      anchorY,
      flip,
      dx,
      dy,
      fr,
      fg,
      fb,
      fa,
      alpha,
      dissolve = 0,
      light = 0,
      outlineR = 0,
      outlineG = 0,
      outlineB = 0,
      outlineAmount = 0,
      scale = 1,
    ) {
      if (n >= cap) {
        overflow++;
        return false;
      }
      const p3 = n * 3;
      const p4 = n * 4;
      // Sim (x, y) floor, height h -> three (x, h, y) (architecture 7.1).
      pos[p3] = x;
      pos[p3 + 1] = h;
      pos[p3 + 2] = y;
      rectA[p4] = rect.x;
      rectA[p4 + 1] = rect.y;
      rectA[p4 + 2] = rect.w;
      rectA[p4 + 3] = rect.h;
      off[p4] = rect.ox - anchorX;
      off[p4 + 1] = anchorY + 1 - rect.oy;
      off[p4 + 2] = dx;
      off[p4 + 3] = dy;
      // Flip sign times whole-number scale (shaders/sprite.ts).
      const sc = scale > 1 ? Math.round(scale) : 1;
      params[p4] = flip < 0 ? -sc : sc;
      params[p4 + 1] = alpha;
      params[p4 + 2] = dissolve;
      params[p4 + 3] = light;
      flash[p4] = fr;
      flash[p4 + 1] = fg;
      flash[p4 + 2] = fb;
      flash[p4 + 3] = fa;
      outline[p4] = outlineR;
      outline[p4 + 1] = outlineG;
      outline[p4 + 2] = outlineB;
      outline[p4 + 3] = outlineAmount;
      n++;
      return true;
    },
    end() {
      geo.instanceCount = n;
      if (n === 0) return;
      for (let i = 0; i < attrs.length; i++) {
        const a = attrs[i];
        if (a === undefined) continue;
        a.clearUpdateRanges();
        a.addUpdateRange(0, n * a.itemSize);
        a.needsUpdate = true;
      }
    },
    setResolution(width, height) {
      res.set(width, height);
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
