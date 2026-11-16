// Low-poly mesh builder for diorama decor (LP; art-direction 10, architecture 7.6). Primitives from
// three.js maths (boxes, cylinders, gables, quads) are baked into ONE merged BufferGeometry so all decor
// of an arena is a single draw call. Texel coordinates are world-scaled: 16 texels per u on every face
// (P3-b), wrapped inside a 32 x 32 swatch by the shader. Runs once per setArena (allocation is fine).

import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  Matrix3,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { swatchOrigin } from './env-textures.ts';
import type { EnvMat } from './env-textures.ts';

/** Texels per world unit on decor faces (same density as sprites and the floor across). */
export const DECOR_TEXELS_PER_U = 16;

export interface Anim {
  /** Sway amplitude in u per u of height above pivotY, along world x and z. */
  readonly ampX: number;
  readonly ampZ: number;
  /** Vertical bob amplitude in u (paper drift). */
  readonly bob?: number;
  readonly phase: number;
  readonly pivotY: number;
  /** Radians per second. */
  readonly freq: number;
}

export interface PrimOpts {
  readonly mat: EnvMat;
  /** Emissive gain multiplier for the texel mask (0 = never glows). Default 1. */
  readonly emissive?: number;
  /** Point light slot whose flicker drives the glow, -1 = steady. */
  readonly light?: number;
  readonly anim?: Anim;
}

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotX?: number;
  readonly rotY?: number;
  readonly rotZ?: number;
}

const NO_ANIM: Anim = { ampX: 0, ampZ: 0, bob: 0, phase: 0, pivotY: 0, freq: 0 };

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly tex: number[] = [];
  private readonly swatch: number[] = [];
  private readonly anim: number[] = [];
  private readonly misc: number[] = [];
  private readonly index: number[] = [];
  /** Object transform applied on top of each primitive placement (decor position and rotation). */
  private object = new Matrix4();
  private readonly tmpM = new Matrix4();
  private readonly tmpN = new Matrix3();
  private readonly v = new Vector3();
  private readonly n = new Vector3();

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.index.length / 3;
  }

  /** Set the object transform: floor position (x, y) in u, rotation about the vertical axis. */
  setObject(x: number, y: number, rotYDeg: number): void {
    this.object = new Matrix4().compose(
      new Vector3(x, 0, y),
      // rotYDeg 0 = the decor front faces the camera (+z); 90 turns it to face +x (screen right).
      new Quaternion().setFromEuler(new Euler(0, (rotYDeg * Math.PI) / 180, 0)),
      new Vector3(1, 1, 1),
    );
  }

  private matrixFor(p: Placement): Matrix4 {
    const local = new Matrix4().compose(
      new Vector3(p.x, p.y, p.z),
      new Quaternion().setFromEuler(new Euler(p.rotX ?? 0, p.rotY ?? 0, p.rotZ ?? 0)),
      new Vector3(1, 1, 1),
    );
    return this.tmpM.multiplyMatrices(this.object, local);
  }

  /** Add one quad (local corners a b c d counter-clockwise seen from the front), texel size w x h. */
  private quad(
    m: Matrix4,
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    d: readonly number[],
    wU: number,
    hU: number,
    o: PrimOpts,
  ): void {
    const base = this.vertexCount;
    const tw = wU * DECOR_TEXELS_PER_U;
    const th = hU * DECOR_TEXELS_PER_U;
    const uv = [0, th, tw, th, tw, 0, 0, 0];
    const corners = [a, b, c, d];
    // Face normal from the local corners, transformed with the rotation part.
    const e1 = new Vector3(
      (b[0] ?? 0) - (a[0] ?? 0),
      (b[1] ?? 0) - (a[1] ?? 0),
      (b[2] ?? 0) - (a[2] ?? 0),
    );
    const e2 = new Vector3(
      (d[0] ?? 0) - (a[0] ?? 0),
      (d[1] ?? 0) - (a[1] ?? 0),
      (d[2] ?? 0) - (a[2] ?? 0),
    );
    this.n.crossVectors(e1, e2).normalize();
    this.tmpN.getNormalMatrix(m);
    this.n.applyMatrix3(this.tmpN).normalize();
    for (let i = 0; i < 4; i++) {
      const p = corners[i] ?? [0, 0, 0];
      this.v.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0).applyMatrix4(m);
      this.pushVertex(this.v, this.n, uv[i * 2] ?? 0, uv[i * 2 + 1] ?? 0, o);
    }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  private tri(
    m: Matrix4,
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    o: PrimOpts,
  ): void {
    const base = this.vertexCount;
    const e1 = new Vector3(
      (b[0] ?? 0) - (a[0] ?? 0),
      (b[1] ?? 0) - (a[1] ?? 0),
      (b[2] ?? 0) - (a[2] ?? 0),
    );
    const e2 = new Vector3(
      (c[0] ?? 0) - (a[0] ?? 0),
      (c[1] ?? 0) - (a[1] ?? 0),
      (c[2] ?? 0) - (a[2] ?? 0),
    );
    this.n.crossVectors(e1, e2).normalize();
    this.tmpN.getNormalMatrix(m);
    this.n.applyMatrix3(this.tmpN).normalize();
    for (const p of [a, b, c]) {
      this.v.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0).applyMatrix4(m);
      // Planar texels from local x and y (gable ends).
      this.pushVertex(
        this.v,
        this.n,
        (p[0] ?? 0) * DECOR_TEXELS_PER_U,
        -(p[1] ?? 0) * DECOR_TEXELS_PER_U,
        o,
      );
    }
    this.index.push(base, base + 1, base + 2);
  }

  private pushVertex(p: Vector3, n: Vector3, u: number, v: number, o: PrimOpts): void {
    const a = o.anim ?? NO_ANIM;
    const s = swatchOrigin(o.mat);
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.tex.push(u, v);
    this.swatch.push(s.x, s.y);
    this.anim.push(a.ampX, a.ampZ, a.phase, a.pivotY);
    this.misc.push(o.emissive ?? 1, o.light ?? -1, a.freq, a.bob ?? 0);
  }

  /** Axis-aligned box in placement space: width w (x), height h (y, from the bottom), depth d (z). */
  box(p: Placement, w: number, h: number, d: number, o: PrimOpts, skipBottom = true): void {
    const m = this.matrixFor(p).clone();
    const x0 = -w / 2;
    const x1 = w / 2;
    const z0 = -d / 2;
    const z1 = d / 2;
    const y0 = 0;
    const y1 = h;
    this.quad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], w, h, o); // front +z
    this.quad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], w, h, o); // back
    this.quad(m, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], d, h, o); // right
    this.quad(m, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], d, h, o); // left
    this.quad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], w, d, o); // top
    if (!skipBottom) this.quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], w, d, o);
  }

  /** Upright cylinder (prism with `seg` sides), radius r, height h from the bottom, capped on top. */
  cylinder(p: Placement, r: number, h: number, seg: number, o: PrimOpts, capOpts?: PrimOpts): void {
    const m = this.matrixFor(p).clone();
    const side = 2 * r * Math.sin(Math.PI / seg);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = [Math.sin(a0) * r, 0, Math.cos(a0) * r];
      const c1 = [Math.sin(a1) * r, 0, Math.cos(a1) * r];
      this.quad(m, c0, c1, [c1[0] ?? 0, h, c1[2] ?? 0], [c0[0] ?? 0, h, c0[2] ?? 0], side, h, o);
      this.tri(
        m,
        [0, h, 0],
        [c0[0] ?? 0, h, c0[2] ?? 0],
        [c1[0] ?? 0, h, c1[2] ?? 0],
        capOpts ?? o,
      );
    }
  }

  /** Gable roof: ridge along x, width w, depth d, rising rh above the base height. */
  gable(p: Placement, w: number, d: number, rh: number, o: PrimOpts, endOpts?: PrimOpts): void {
    const m = this.matrixFor(p).clone();
    const x0 = -w / 2;
    const x1 = w / 2;
    const slope = Math.hypot(d / 2, rh);
    this.quad(m, [x0, 0, d / 2], [x1, 0, d / 2], [x1, rh, 0], [x0, rh, 0], w, slope, o);
    this.quad(m, [x1, 0, -d / 2], [x0, 0, -d / 2], [x0, rh, 0], [x1, rh, 0], w, slope, o);
    const e = endOpts ?? o;
    this.tri(m, [x1, 0, d / 2], [x1, 0, -d / 2], [x1, rh, 0], e);
    this.tri(m, [x0, 0, -d / 2], [x0, 0, d / 2], [x0, rh, 0], e);
  }

  /** Flat slanted panel (awning cloth): width w along x, from (z0, y0) to (z1, y1). Two-sided. */
  panel(
    p: Placement,
    w: number,
    z0: number,
    y0: number,
    z1: number,
    y1: number,
    o: PrimOpts,
  ): void {
    const m = this.matrixFor(p).clone();
    const len = Math.hypot(z1 - z0, y1 - y0);
    this.quad(m, [-w / 2, y1, z1], [w / 2, y1, z1], [w / 2, y0, z0], [-w / 2, y0, z0], w, len, o);
  }

  /** Four-sided pyramid (tent roof): base w x d at the placement height, apex h above. */
  pyramid(p: Placement, w: number, d: number, h: number, o: PrimOpts): void {
    const m = this.matrixFor(p).clone();
    const x = w / 2;
    const z = d / 2;
    const apex = [0, h, 0];
    this.tri(m, [-x, 0, z], [x, 0, z], apex, o);
    this.tri(m, [x, 0, z], [x, 0, -z], apex, o);
    this.tri(m, [x, 0, -z], [-x, 0, -z], apex, o);
    this.tri(m, [-x, 0, -z], [-x, 0, z], apex, o);
  }

  /** Vertical quad facing +z: width w, height h from the bottom. Two-sided by the material. */
  card(p: Placement, w: number, h: number, o: PrimOpts): void {
    const m = this.matrixFor(p).clone();
    this.quad(m, [-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0], w, h, o);
  }

  /** Flat floor-level quad (y up), for papers and shards. */
  flat(p: Placement, w: number, d: number, o: PrimOpts): void {
    const m = this.matrixFor(p).clone();
    this.quad(
      m,
      [-w / 2, 0, d / 2],
      [w / 2, 0, d / 2],
      [w / 2, 0, -d / 2],
      [-w / 2, 0, -d / 2],
      w,
      d,
      o,
    );
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('aTex', new BufferAttribute(new Float32Array(this.tex), 2));
    g.setAttribute('aSwatch', new BufferAttribute(new Float32Array(this.swatch), 2));
    g.setAttribute('aAnim', new BufferAttribute(new Float32Array(this.anim), 4));
    g.setAttribute('aMisc', new BufferAttribute(new Float32Array(this.misc), 4));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}
