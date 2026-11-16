// Decor and obstacle meshes from arena data (LP; LD 7, 12.2; art-direction 10). Kinds are LD asset ids
// read at runtime from content/levels/<arena>.json; unknown kinds fall back to a plain crate block so a
// new id never breaks the render. Local space: x across the footprint, z toward the camera (front),
// y up. Decor never scales (LD 7.2): sizes are fixed per kind, the footprint only places it.

import type { ArenaDef } from '../../core/index.ts';
import { EnvMat } from './env-textures.ts';
import type { Anim, MeshBuilder, PrimOpts } from './mesh-builder.ts';

type DecorDef = ArenaDef['decor'][number];
type ObstacleDef = ArenaDef['obstacles'][number];

/** Animation presets by LD anim id (art-direction 10: cloth sway, lantern sway, paper drift). */
function animFor(id: string | undefined, phase: number, pivotY: number): Anim | undefined {
  switch (id) {
    case 'cloth-sway':
      return { ampX: 0.22, ampZ: 0.08, phase, pivotY, freq: 1.7 };
    case 'lantern-sway':
      return { ampX: 0.16, ampZ: 0.05, phase, pivotY, freq: 1.25 };
    case 'paper-drift':
      return { ampX: 0.05, ampZ: 0.03, bob: 0.06, phase, pivotY, freq: 0.8 };
    default:
      return undefined;
  }
}

/** Small deterministic hash of an id string, for per-object variation (never Math.random). */
export function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const WOOD_DARK: PrimOpts = { mat: EnvMat.woodDark };
const WOOD: PrimOpts = { mat: EnvMat.wood };

function lantern(
  b: MeshBuilder,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  light: number,
  anim?: Anim,
  glow = 1,
): void {
  const cap: PrimOpts = { mat: EnvMat.woodDark, ...(anim ? { anim } : {}) };
  b.cylinder({ x, y, z }, r * 0.7, h * 0.12, 6, cap);
  b.cylinder({ x, y: y + h * 0.12, z }, r, h * 0.76, 8, {
    mat: EnvMat.paper,
    emissive: glow,
    light,
    ...(anim ? { anim } : {}),
  });
  b.cylinder({ x, y: y + h * 0.88, z }, r * 0.6, h * 0.12, 6, cap);
}

function stall(
  b: MeshBuilder,
  w: number,
  d: number,
  h: number,
  seed: number,
  anim: string | undefined,
): void {
  const cloth = seed < 0.5 ? EnvMat.clothStripeA : EnvMat.clothStripeB;
  const front = d / 2;
  const back = -d / 2;
  // Back panel, counter, goods.
  b.box({ x: 0, y: 0, z: back + 0.1 }, w - 0.1, h * 0.7, 0.14, WOOD_DARK);
  b.box({ x: 0, y: 0, z: front - 0.45 }, w - 0.4, 0.85, 0.6, WOOD);
  for (let i = 0; i < 4; i++) {
    const gx = -w / 2 + 0.6 + i * ((w - 1.2) / 3);
    const s = 0.22 + ((seed * 7 + i * 0.37) % 1) * 0.2;
    b.box({ x: gx, y: 0.85, z: front - 0.45, rotY: i * 0.4 }, s, s * 1.1, s, { mat: EnvMat.goods });
  }
  // Posts.
  const px = w / 2 - 0.1;
  b.box({ x: -px, y: 0, z: front + 0.05 }, 0.14, h - 0.55, 0.14, WOOD_DARK);
  b.box({ x: px, y: 0, z: front + 0.05 }, 0.14, h - 0.55, 0.14, WOOD_DARK);
  b.box({ x: -px, y: 0, z: back + 0.05 }, 0.14, h, 0.14, WOOD_DARK);
  b.box({ x: px, y: 0, z: back + 0.05 }, 0.14, h, 0.14, WOOD_DARK);
  // Slanted awning and a swaying valance along its front edge.
  const eaveY = h - 0.55;
  b.panel({ x: 0, y: 0, z: 0 }, w + 0.3, back - 0.05, h, front + 0.25, eaveY, { mat: cloth });
  const sway = animFor(anim, seed * 6.28, eaveY);
  b.card({ x: 0, y: eaveY - 0.3, z: front + 0.26 }, w + 0.3, 0.3, {
    mat: cloth,
    ...(sway ? { anim: sway } : {}),
  });
  // Two small lanterns under the eave (steady glow, no light of their own).
  const swing = animFor(anim === undefined ? undefined : 'lantern-sway', seed * 3.1, eaveY);
  lantern(b, -w * 0.3, eaveY - 0.62, front + 0.15, 0.12, 0.3, -1, swing, 0.6);
  lantern(b, w * 0.3, eaveY - 0.62, front + 0.15, 0.12, 0.3, -1, swing, 0.6);
}

/** Build one decor object into the merged mesh. lightSlot maps an arena light id to its uniform slot. */
export function buildDecor(b: MeshBuilder, d: DecorDef, lightSlot: (id: string) => number): void {
  const seed = idHash(d.id);
  const light = d.lightId === undefined ? -1 : lightSlot(d.lightId);
  const [hx, hy] = d.footprintHalf;
  b.setObject(d.pos[0], d.pos[1], d.rotYDeg);
  switch (d.kind) {
    case 'lantern-gate': {
      const px = hx - 0.4;
      for (const sx of [-px, px]) {
        b.box({ x: sx, y: 0, z: 0 }, 0.6, 0.35, 0.6, { mat: EnvMat.stone });
        b.box({ x: sx, y: 0.35, z: 0 }, 0.36, d.height - 1.15, 0.36, WOOD_DARK);
      }
      b.box({ x: 0, y: 3.15, z: 0 }, px * 2, 0.2, 0.3, WOOD_DARK);
      b.box({ x: 0, y: d.height - 1.2, z: 0 }, hx * 2 + 0.4, 0.36, 0.5, WOOD);
      b.gable(
        { x: 0, y: d.height - 0.84, z: 0 },
        hx * 2 + 0.9,
        1.0,
        0.55,
        { mat: EnvMat.roofTile },
        WOOD_DARK,
      );
      // The big cracked lantern hangs under the beam, over the boss stage.
      b.box({ x: 0, y: d.height - 1.55, z: 0 }, 0.06, 0.35, 0.06, { mat: EnvMat.rope });
      lantern(b, 0, d.height - 2.45, 0, 0.5, 0.9, light, undefined, 1.2);
      b.card({ x: 0.12, y: d.height - 2.25, z: 0.51 }, 0.06, 0.5, WOOD_DARK);
      break;
    }
    case 'stall-awning':
      stall(b, hx * 2, hy * 2, d.height, seed, d.anim);
      break;
    case 'side-stall':
      stall(b, hx * 2, hy * 2, d.height, seed, d.anim);
      break;
    case 'lantern-pole': {
      b.box({ x: 0, y: 0, z: 0 }, 0.3, 0.2, 0.3, WOOD_DARK);
      b.box({ x: 0, y: 0, z: 0 }, 0.16, d.height, 0.16, WOOD_DARK);
      b.box({ x: 0, y: d.height - 0.18, z: 0.18 }, 0.1, 0.1, 0.5, WOOD_DARK);
      b.box({ x: 0, y: d.height - 0.45, z: 0.36 }, 0.03, 0.28, 0.03, { mat: EnvMat.rope });
      lantern(b, 0, d.height - 0.9, 0.36, 0.2, 0.45, light);
      break;
    }
    case 'lantern-string': {
      const sag = 0.45;
      const segs = 8;
      const ropeY = (x: number): number => d.height - sag * (1 - (x / hx) * (x / hx));
      for (let i = 0; i < segs; i++) {
        const x0 = -hx + (i / segs) * hx * 2;
        const x1 = -hx + ((i + 1) / segs) * hx * 2;
        const y0 = ropeY(x0);
        const y1 = ropeY(x1);
        const len = Math.hypot(x1 - x0, y1 - y0);
        b.box(
          { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 0.02, z: 0, rotZ: Math.atan2(y1 - y0, x1 - x0) },
          len,
          0.04,
          0.04,
          { mat: EnvMat.rope },
        );
      }
      for (let i = 0; i < 7; i++) {
        const x = -hx + ((i + 0.5) / 7) * hx * 2;
        const top = ropeY(x);
        const sway = animFor(d.anim, seed * 6.28 + i * 0.9, top);
        lantern(b, x, top - 0.42, 0, 0.14, 0.3, -1, sway, 0.85);
      }
      break;
    }
    case 'crate-stack': {
      const c: PrimOpts = { mat: EnvMat.crate };
      b.box({ x: -hx * 0.42, y: 0, z: 0.1, rotY: 0.1 }, 0.75, 0.75, 0.75, c);
      b.box({ x: hx * 0.42, y: 0, z: -0.05, rotY: -0.08 }, 0.75, 0.75, 0.75, c);
      b.box({ x: 0.05, y: 0.75, z: 0, rotY: 0.3 }, 0.62, 0.62, 0.62, c);
      break;
    }
    case 'market-roofline': {
      const widths = [hx * 0.62, hx * 0.76, hx * 0.62];
      const heights = [d.height - 2.3, d.height - 1.6, d.height - 2.6];
      let x = -hx;
      for (let i = 0; i < 3; i++) {
        const w = widths[i] ?? 3;
        const h = heights[i] ?? 3;
        const cx = x + w / 2;
        b.box({ x: cx, y: 0, z: 0 }, w - 0.1, h, hy * 2, { mat: EnvMat.plaster });
        b.gable(
          { x: cx, y: h, z: 0 },
          w + 0.2,
          hy * 2 + 0.4,
          1.2 + i * 0.15,
          { mat: EnvMat.roofTile },
          { mat: EnvMat.plaster },
        );
        // Windows on the front face: some lit, some dark (seeded per building).
        for (let k = 0; k < 2; k++) {
          const lit = (seed * 10 + i * 3 + k) % 3 < 1.6;
          b.card({ x: cx - w * 0.22 + k * w * 0.44, y: h - 2.2, z: hy + 0.01 }, 1.0, 1.0, {
            mat: EnvMat.window,
            emissive: lit ? 0.7 : 0,
          });
        }
        x += w;
      }
      b.box({ x: hx * 0.35, y: heights[1] ?? 4, z: -0.2 }, 0.4, 2.0, 0.4, {
        mat: EnvMat.stoneDark,
      });
      break;
    }
    case 'cloth-rolls': {
      const mats = [EnvMat.clothIndigo, EnvMat.clothOchre, EnvMat.clothMoss];
      const len = hx * 2 - 0.1;
      const r = 0.2;
      const at = [
        [-0.21, 0],
        [0.21, 0],
        [0, 0.36],
      ];
      at.forEach(([z, y], i) => {
        b.cylinder({ x: -len / 2, y: (y ?? 0) + r, z: z ?? 0, rotZ: -Math.PI / 2 }, r, len, 8, {
          mat: mats[i] ?? EnvMat.clothOchre,
        });
      });
      break;
    }
    case 'barrel-cluster': {
      b.cylinder({ x: -hx * 0.45, y: 0, z: 0.1 }, 0.38, 1.0, 8, { mat: EnvMat.barrel }, WOOD);
      b.cylinder({ x: hx * 0.45, y: 0, z: -0.15 }, 0.38, 1.0, 8, { mat: EnvMat.barrel }, WOOD);
      b.cylinder({ x: 0.05, y: 0, z: 0.55 }, 0.3, 0.75, 8, { mat: EnvMat.barrel }, WOOD);
      break;
    }
    case 'sack-pile-low':
    case 'sack-pile': {
      const s: PrimOpts = { mat: EnvMat.sack };
      b.box({ x: -hx * 0.4, y: 0, z: 0, rotY: 0.3 }, hx * 0.9, d.height * 0.55, hy * 0.9, s);
      b.box({ x: hx * 0.4, y: 0, z: 0.1, rotY: -0.2 }, hx * 0.85, d.height * 0.5, hy * 0.85, s);
      b.box({ x: 0, y: d.height * 0.5, z: 0, rotY: 0.6 }, hx * 0.8, d.height * 0.45, hy * 0.8, s);
      break;
    }
    case 'ground-lantern': {
      b.box({ x: 0, y: 0, z: 0 }, 0.34, 0.06, 0.34, WOOD_DARK);
      b.box({ x: 0, y: 0.06, z: 0 }, 0.26, 0.26, 0.26, { mat: EnvMat.paper, light });
      b.box({ x: 0, y: 0.32, z: 0 }, 0.32, 0.05, 0.32, WOOD_DARK);
      break;
    }
    case 'frozen-paper': {
      for (let i = 0; i < 5; i++) {
        const k = idHash(`${d.id}:${String(i)}`);
        const px = (k - 0.5) * hx * 1.8;
        const pz = (((k * 7.3) % 1) - 0.5) * hy * 1.6;
        const py = 0.12 + ((k * 13.7) % 1) * 0.33;
        const anim = animFor(d.anim, k * 6.28, py);
        b.flat({ x: px, y: py, z: pz, rotX: 0.3 + k * 0.6, rotY: k * 6.28 }, 0.32, 0.24, {
          mat: EnvMat.paperDim,
          ...(anim ? { anim } : {}),
        });
      }
      break;
    }
    case 'glass-shards': {
      for (let i = 0; i < 6; i++) {
        const k = idHash(`${d.id}:${String(i)}`);
        b.flat(
          {
            x: (k - 0.5) * hx * 1.8,
            y: 0.02 + ((k * 5.1) % 1) * 0.06,
            z: (((k * 3.7) % 1) - 0.5) * hy * 1.6,
            rotX: -0.4 - k * 0.5,
            rotY: k * 6.28,
          },
          0.18 + k * 0.12,
          0.1 + ((k * 9.1) % 1) * 0.1,
          { mat: EnvMat.glass, emissive: 0.5 },
        );
      }
      break;
    }
    case 'basket-stack': {
      b.cylinder(
        { x: -hx * 0.3, y: 0, z: 0.05 },
        0.34,
        0.42,
        8,
        { mat: EnvMat.rope },
        { mat: EnvMat.goods },
      );
      b.cylinder(
        { x: hx * 0.35, y: 0, z: -0.1 },
        0.28,
        0.36,
        8,
        { mat: EnvMat.rope },
        { mat: EnvMat.goods },
      );
      b.cylinder(
        { x: 0, y: 0.42, z: 0 },
        0.26,
        Math.max(0.2, d.height - 0.42),
        8,
        { mat: EnvMat.rope },
        { mat: EnvMat.goods },
      );
      break;
    }
    case 'crate-low': {
      b.box({ x: 0, y: 0, z: 0, rotY: seed - 0.5 }, hx * 1.7, d.height, hy * 1.6, {
        mat: EnvMat.crate,
      });
      break;
    }
    case 'floating-lanterns': {
      for (let i = 0; i < 5; i++) {
        const k = idHash(`${d.id}:${String(i)}`);
        const y = d.height - 1.6 + k * 1.3;
        const anim = animFor(d.anim, k * 6.28, y + 0.6);
        lantern(
          b,
          (k - 0.5) * hx * 1.8,
          y,
          (((k * 7.1) % 1) - 0.5) * hy * 1.6,
          0.16,
          0.32,
          -1,
          anim,
          0.9,
        );
      }
      break;
    }
    case 'festival-tent': {
      const wall = d.height * 0.5;
      b.box({ x: 0, y: 0, z: 0 }, hx * 1.8, wall, hy * 1.8, { mat: EnvMat.clothOchre });
      b.pyramid({ x: 0, y: wall, z: 0 }, hx * 2.1, hy * 2.1, d.height - wall - 0.2, {
        mat: seed < 0.5 ? EnvMat.clothStripeA : EnvMat.clothStripeB,
      });
      b.box({ x: 0, y: d.height - 0.25, z: 0 }, 0.06, 0.3, 0.06, WOOD_DARK);
      b.card({ x: 0, y: 0, z: hy * 0.9 + 0.01 }, hx * 0.6, wall * 0.8, { mat: EnvMat.clothIndigo });
      break;
    }
    case 'vendor-cart': {
      b.box({ x: 0, y: 0.45, z: 0 }, hx * 1.6, 0.45, hy * 1.5, WOOD);
      for (const sx of [-hx * 0.55, hx * 0.55])
        b.cylinder({ x: sx, y: 0.42, z: hy * 0.8, rotX: Math.PI / 2 }, 0.4, 0.1, 8, WOOD_DARK);
      b.box({ x: -hx * 0.75, y: 0.9, z: 0 }, 0.08, d.height - 0.9, 0.08, WOOD_DARK);
      b.box({ x: hx * 0.75, y: 0.9, z: 0 }, 0.08, d.height - 0.9, 0.08, WOOD_DARK);
      b.panel({ x: 0, y: 0, z: 0 }, hx * 1.8, -hy, d.height, hy, d.height - 0.25, {
        mat: EnvMat.clothStripeA,
      });
      b.box({ x: -0.2, y: 0.9, z: 0 }, 0.5, 0.3, 0.4, { mat: EnvMat.goods });
      b.box({ x: 0.35, y: 0.9, z: 0.1, rotY: 0.4 }, 0.36, 0.26, 0.36, { mat: EnvMat.goods });
      break;
    }
    case 'paper-garland': {
      const top = d.height;
      for (let i = 0; i < 4; i++) {
        const x0 = -hx + (i / 4) * hx * 2;
        const sag = 0.08 * Math.sin(((i + 0.5) / 4) * Math.PI);
        b.box({ x: x0 + hx / 4, y: top - sag, z: 0 }, hx / 2, 0.03, 0.03, { mat: EnvMat.rope });
      }
      for (let i = 0; i < 9; i++) {
        const x = -hx + ((i + 0.5) / 9) * hx * 2;
        const y = top - 0.1 * Math.sin(((i + 0.5) / 9) * Math.PI) - 0.24;
        const anim = animFor(d.anim, seed * 6.28 + i * 0.7, y + 0.24);
        b.card({ x, y, z: 0 }, 0.18, 0.22, {
          mat: i % 2 === 0 ? EnvMat.paperDim : EnvMat.clothOchre,
          ...(anim ? { anim } : {}),
        });
      }
      break;
    }
    case 'lantern-rack': {
      for (const sx of [-hx * 0.9, hx * 0.9])
        b.box({ x: sx, y: 0, z: 0 }, 0.1, d.height, 0.1, WOOD_DARK);
      b.box({ x: 0, y: d.height - 0.12, z: 0 }, hx * 2, 0.1, 0.1, WOOD);
      b.box({ x: 0, y: d.height * 0.45, z: 0 }, hx * 2, 0.08, 0.08, WOOD_DARK);
      for (let i = 0; i < 3; i++)
        lantern(
          b,
          -hx * 0.55 + i * hx * 0.55,
          d.height - 0.6,
          0.06,
          0.13,
          0.32,
          light,
          undefined,
          0.85,
        );
      break;
    }
    case 'fallen-lantern': {
      b.cylinder({ x: -hx * 0.6, y: 0.16, z: 0, rotZ: -Math.PI / 2 }, 0.16, hx * 1.2, 8, {
        mat: EnvMat.paper,
        emissive: 0.3,
      });
      b.box({ x: hx * 0.55, y: 0, z: 0.05 }, 0.12, 0.1, 0.12, WOOD_DARK);
      break;
    }
    case 'woven-mat': {
      b.flat({ x: 0, y: 0.02, z: 0, rotY: (seed - 0.5) * 0.3 }, hx * 2, hy * 2, {
        mat: EnvMat.clothStripeB,
      });
      break;
    }
    default:
      buildFallback(b, d, seed, light);
  }
}

/**
 * Kinds without a dedicated builder (biomes 2 and 3 are Tier C) get a shape guessed from the LD asset
 * id, so the diorama still reads: stone blocks, roofed houses, lantern posts, trellis frames, banners.
 * Effect-only kinds (smoke, mist, ash) add no geometry.
 */
function buildFallback(b: MeshBuilder, d: DecorDef, seed: number, light: number): void {
  const [hx, hy] = d.footprintHalf;
  const k = d.kind;
  const has = (...words: string[]): boolean => words.some((w) => k.includes(w));
  const h = Math.min(d.height, 7);
  if (has('smoke', 'mist', 'ash-drift')) return;
  if (has('lantern', 'candle', 'ember-post', 'ember-pile')) {
    const post = Math.max(0.1, h - 0.5);
    if (post > 0.4) b.box({ x: 0, y: 0, z: 0 }, 0.18, post, 0.18, { mat: EnvMat.stoneDark });
    lantern(b, 0, Math.max(0, post - 0.1), 0, Math.min(0.3, hx), 0.45, light);
    return;
  }
  if (has('roofline', 'house', 'tower', 'press')) {
    const wall = h * 0.65;
    b.box({ x: 0, y: 0, z: 0 }, hx * 2, wall, hy * 2, { mat: EnvMat.plaster });
    b.gable(
      { x: 0, y: wall, z: 0 },
      hx * 2 + 0.3,
      hy * 2 + 0.3,
      h - wall,
      { mat: EnvMat.roofTile },
      { mat: EnvMat.plaster },
    );
    return;
  }
  if (has('trellis', 'vine', 'terrace')) {
    for (const sx of [-hx * 0.9, 0, hx * 0.9]) b.box({ x: sx, y: 0, z: 0 }, 0.1, h, 0.1, WOOD_DARK);
    for (const yy of [h * 0.45, h * 0.9]) b.box({ x: 0, y: yy, z: 0 }, hx * 2, 0.06, 0.06, WOOD);
    b.card({ x: 0, y: h * 0.2, z: 0.06 }, hx * 1.8, h * 0.7, { mat: EnvMat.clothMoss });
    return;
  }
  if (has('banner')) {
    b.box({ x: 0, y: 0, z: 0 }, 0.08, h, 0.08, WOOD_DARK);
    const anim = animFor(d.anim, seed * 6.28, h);
    b.card({ x: 0, y: h * 0.35, z: 0.05 }, Math.min(hx * 2, 1.4), h * 0.6, {
      mat: EnvMat.clothOchre,
      ...(anim ? { anim } : {}),
    });
    return;
  }
  if (has('barrel')) {
    const n = Math.max(1, Math.min(4, Math.round(hx * 2)));
    for (let i = 0; i < n; i++)
      b.cylinder(
        { x: -hx + (i + 0.5) * ((hx * 2) / n), y: 0, z: 0 },
        0.36,
        Math.min(h, 1),
        8,
        { mat: EnvMat.barrel },
        WOOD,
      );
    return;
  }
  if (has('basket', 'cart', 'crate')) {
    b.box({ x: 0, y: 0, z: 0 }, hx * 2, Math.min(h, 1.5), hy * 2, { mat: EnvMat.crate });
    return;
  }
  // Stone: walls, arches, pillars, statues, steps, parapets, cliffs, stumps.
  b.box({ x: 0, y: 0, z: 0 }, hx * 2, h, hy * 2, {
    mat: has('stump', 'charred') ? EnvMat.woodDark : EnvMat.stone,
  });
}

/** Obstacles: low (max 0.4 u, LD R2), near floor value, top edges picked out in stone (LD R10). */
export function buildObstacle(b: MeshBuilder, o: ObstacleDef): void {
  const seed = idHash(o.id);
  let cx: number;
  let cy: number;
  let w: number;
  let dd: number;
  if (o.shape.type === 'rect') {
    cx = (o.shape.min[0] + o.shape.max[0]) / 2;
    cy = (o.shape.min[1] + o.shape.max[1]) / 2;
    w = o.shape.max[0] - o.shape.min[0];
    dd = o.shape.max[1] - o.shape.min[1];
  } else if (o.shape.type === 'circle') {
    cx = o.shape.center[0];
    cy = o.shape.center[1];
    w = o.shape.radius * 2;
    dd = w;
  } else {
    const xs = o.shape.points.map((p) => p[0]);
    const ys = o.shape.points.map((p) => p[1]);
    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    w = Math.max(...xs) - Math.min(...xs);
    dd = Math.max(...ys) - Math.min(...ys);
  }
  b.setObject(cx, cy, 0);
  const h = o.height;
  switch (o.kind) {
    case 'tipped-stall-table': {
      // Table top on its side along the back of the footprint, legs pointing to the front.
      b.box({ x: 0, y: 0, z: -dd * 0.3, rotX: -0.2 }, w, h, 0.14, WOOD);
      b.box({ x: 0, y: h - 0.03, z: -dd * 0.3 + 0.08 }, w, 0.04, 0.12, { mat: EnvMat.stone });
      for (const sx of [-w * 0.42, w * 0.42])
        b.box({ x: sx, y: h * 0.55, z: dd * 0.05 }, 0.1, 0.1, dd * 0.6, WOOD_DARK);
      b.box({ x: w * 0.15, y: 0, z: dd * 0.3, rotY: 0.5 }, 0.34, 0.24, 0.3, { mat: EnvMat.goods });
      break;
    }
    case 'covered-well': {
      const r = w / 2;
      b.cylinder(
        { x: 0, y: 0, z: 0 },
        r,
        h - 0.08,
        12,
        { mat: EnvMat.stone },
        { mat: EnvMat.stoneDark },
      );
      b.cylinder({ x: 0, y: h - 0.08, z: 0 }, r * 0.85, 0.08, 12, WOOD, WOOD);
      b.box({ x: 0, y: h, z: 0, rotY: seed * 3 }, r * 1.6, 0.03, 0.16, { mat: EnvMat.stone });
      break;
    }
    case 'sack-pile': {
      const s: PrimOpts = { mat: EnvMat.sack };
      for (let i = 0; i < 5; i++) {
        const k = idHash(`${o.id}:${String(i)}`);
        b.box(
          {
            x: (k - 0.5) * w * 0.6,
            y: i > 2 ? h * 0.5 : 0,
            z: (((k * 5.3) % 1) - 0.5) * dd * 0.5,
            rotY: k * 3,
          },
          w * 0.32,
          h * 0.5,
          dd * 0.34,
          s,
        );
      }
      break;
    }
    default: {
      const mat = /stone|pillar|wall|bench/.test(o.kind)
        ? EnvMat.stone
        : /barrel/.test(o.kind)
          ? EnvMat.barrel
          : /stump|vine/.test(o.kind)
            ? EnvMat.woodDark
            : EnvMat.crate;
      if (o.shape.type === 'circle')
        b.cylinder({ x: 0, y: 0, z: 0 }, w / 2, h, 10, { mat }, { mat });
      else b.box({ x: 0, y: 0, z: 0 }, w, h, dd, { mat });
    }
  }
}
