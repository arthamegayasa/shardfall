// Instanced ground areas: telegraphs and spawn rings (L4) and player zones (L3). AD.
// Fixed capacity, typed arrays allocated once, no allocation per frame (coding-standards 5).

import {
  BufferAttribute,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three';
import { AREA_FRAGMENT, AREA_INSTANCE_ATTRIBUTES, AREA_VERTEX } from '../shaders/index.ts';

/** Fill and edge colours in linear rgb plus alpha (from palette tokens, see telegraph-style.ts). */
export interface AreaStyle {
  readonly fill: readonly [number, number, number, number];
  readonly edge: readonly [number, number, number, number];
  readonly dashed: boolean;
}

export interface AreaBatch {
  readonly mesh: Mesh;
  readonly overflow: number;
  begin(): void;
  /** shape = AreaShape. Geometry per AreaPoolView. progress 0..1 grows the fill. */
  push(
    shape: number,
    x: number,
    y: number,
    x2: number,
    y2: number,
    radius: number,
    p0: number,
    p1: number,
    p2: number,
    progress: number,
    style: AreaStyle,
  ): boolean;
  end(): void;
  dispose(): void;
}

export function createAreaBatch(capacity: number, renderOrder: number): AreaBatch {
  const geo = new InstancedBufferGeometry();
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const A = AREA_INSTANCE_ATTRIBUTES;
  const make = (name: string, size: number): Float32Array => {
    const a = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
    a.setUsage(DynamicDrawUsage);
    geo.setAttribute(name, a);
    return a.array as Float32Array;
  };
  const g = make('aGeo', A.aGeo);
  const sh = make('aShape', A.aShape);
  const mo = make('aMode', A.aMode);
  const fi = make('aFill', A.aFill);
  const ed = make('aEdge', A.aEdge);
  const names: readonly string[] = ['aGeo', 'aShape', 'aMode', 'aFill', 'aEdge'];
  geo.instanceCount = 0;
  const material = new ShaderMaterial({
    vertexShader: AREA_VERTEX,
    fragmentShader: AREA_FRAGMENT,
    // Flipped sprites and floor quads reverse winding; never cull.
    side: DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;

  let n = 0;
  let overflow = 0;
  return {
    mesh,
    get overflow() {
      return overflow;
    },
    begin() {
      n = 0;
      overflow = 0;
    },
    push(shape, x, y, x2, y2, radius, p0, p1, p2, progress, style) {
      if (n >= capacity) {
        overflow++;
        return false;
      }
      const i = n * 4;
      g[i] = x;
      g[i + 1] = y;
      g[i + 2] = x2;
      g[i + 3] = y2;
      sh[i] = radius;
      sh[i + 1] = p0;
      sh[i + 2] = p1;
      sh[i + 3] = p2;
      mo[i] = shape;
      mo[i + 1] = progress;
      mo[i + 2] = style.dashed ? 1 : 0;
      mo[i + 3] = 0;
      fi[i] = style.fill[0];
      fi[i + 1] = style.fill[1];
      fi[i + 2] = style.fill[2];
      fi[i + 3] = style.fill[3];
      ed[i] = style.edge[0];
      ed[i + 1] = style.edge[1];
      ed[i + 2] = style.edge[2];
      ed[i + 3] = style.edge[3];
      n++;
      return true;
    },
    end() {
      geo.instanceCount = n;
      if (n === 0) return;
      for (let k = 0; k < names.length; k++) {
        const a = geo.getAttribute(names[k] ?? '') as InstancedBufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(0, n * a.itemSize);
        a.needsUpdate = true;
      }
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
