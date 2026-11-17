// BUG-016 (LP, M5): colour vision modes recolour the game world, not only the UI. Palette mapping per
// mode, faction rule, separation in the matching Machado 2009 simulation (same method as QA's
// tests/e2e/support/m5_cvd.py), hazard pattern on danger areas only, and atlas recolouring.

import { describe, expect, it } from 'vitest';
import type { ColorVisionMode, PaletteDef } from '../../src/core/index.ts';
import {
  CVD_DANGER_TOKENS,
  CVD_OVERRIDES,
  cvdPalette,
  hazardPatternFor,
} from '../../src/render/pipeline/cvd-palette.ts';
import { AREA_FRAGMENT } from '../../src/render/shaders/index.ts';
import { createSpriteAtlas, recolorSpriteAtlas } from '../../src/render/sprites/atlas-texture.ts';
import { areaEdgeMode } from '../../src/render/vfx/area-batch.ts';
import type { AreaStyle } from '../../src/render/vfx/area-batch.ts';
import { createAreaStyles } from '../../src/render/vfx/telegraph-style.ts';
import { loadAllSprites, loadPalette } from '../../tools/art/lib/load.ts';

const palette = loadPalette();
const MODES: readonly ColorVisionMode[] = ['protan', 'deutan', 'tritan'];
const KEPT = ['kept-blue', 'kept-blue-deep', 'kept-cyan', 'kept-white', 'kept-gold', 'glint'];

type Rgb = [number, number, number];
type M3 = readonly [Rgb, Rgb, Rgb];
/** Machado 2009, severity 1.0, linear RGB (QA m5_cvd.py). */
const MACHADO: Readonly<Record<'protan' | 'deutan' | 'tritan', M3>> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3079],
  ],
};

const hex = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const unlin = (v: number): number => {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
};
function simulate(c: Rgb, m: M3): Rgb {
  const l = c.map(lin) as Rgb;
  return m.map((r) => unlin(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])) as Rgb;
}
function luminance(c: Rgb): number {
  const [r, g, b] = c.map(lin) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function lab(c: Rgb): Rgb {
  const [r, g, b] = c.map(lin) as Rgb;
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const rad = (d: number): number => (d * Math.PI) / 180;
/** CIEDE2000, ported line by line from QA's m5_cvd.py. */
function de2000(c1: Rgb, c2: Rgb): number {
  const [L1, a1, b1] = lab(c1);
  const [L2, a2, b2] = lab(c2);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = ((((Math.atan2(b1, a1p) * 180) / Math.PI) % 360) + 360) % 360;
  const h2p = ((((Math.atan2(b2, a2p) * 180) / Math.PI) % 360) + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dh = h2p - h1p;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dh / 2));
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) > 180)
    hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  else hbp = (h1p + h2p) / 2;
  const T =
    1 -
    0.17 * Math.cos(rad(hbp - 30)) +
    0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) -
    0.2 * Math.cos(rad(4 * hbp - 63));
  const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dth)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

const token = (p: PaletteDef, t: string): Rgb => hex(p.core[t] ?? '#ff00ff');
/** Smallest simulated distance from a danger token to any player token, and which one. */
function nearestKept(p: PaletteDef, t: string, m: M3): number {
  const d = simulate(token(p, t), m);
  return Math.min(...KEPT.map((k) => de2000(d, simulate(token(p, k), m))));
}
/** HSV hue in degrees. */
function hue(c: Rgb): number {
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  if (mx === mn) return 0;
  const d = mx - mn;
  const h =
    mx === c[0]
      ? ((c[1] - c[2]) / d) % 6
      : mx === c[1]
        ? (c[2] - c[0]) / d + 2
        : (c[0] - c[1]) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('colour vision palettes (BUG-016)', () => {
  it('mode Off keeps the authored palette object', () => {
    expect(cvdPalette(palette, 'off')).toBe(palette);
    expect(hazardPatternFor('off')).toBe(false);
  });

  it('each mode replaces danger tokens only and keeps every player and neutral token', () => {
    for (const mode of MODES) {
      const p = cvdPalette(palette, mode);
      expect(hazardPatternFor(mode)).toBe(true);
      const changed = Object.keys(p.core).filter((k) => p.core[k] !== palette.core[k]);
      expect(changed.length, mode).toBeGreaterThan(0);
      for (const k of changed) expect(CVD_DANGER_TOKENS as readonly string[]).toContain(k);
      for (const k of [...palette.groups.kept, ...palette.groups.neutral])
        expect(p.core[k], `${mode} ${k}`).toBe(palette.core[k]);
      expect(p.biomes).toBe(palette.biomes);
    }
  });

  it('overrides stay in the danger family: red, magenta, violet hues, never blue, cyan, or gold', () => {
    for (const mode of MODES)
      for (const [t, h] of Object.entries(CVD_OVERRIDES[mode])) {
        const deg = hue(hex(h));
        expect(deg >= 270 || deg <= 10, `${mode} ${t} ${h} hue ${deg.toFixed(0)}`).toBe(true);
      }
  });

  it('in the matching simulation every danger token is at least 15 dE00 from every player token', () => {
    for (const mode of MODES) {
      const m = MACHADO[mode as 'protan' | 'deutan' | 'tritan'];
      const p = cvdPalette(palette, mode);
      for (const t of CVD_DANGER_TOKENS) {
        const now = nearestKept(p, t, m);
        const before = nearestKept(palette, t, m);
        expect(now, `${mode} ${t}`).toBeGreaterThanOrEqual(15);
        // Never worse than the authored palette, except protan red: it trades 33 -> 27 dE00 (still the
        // best of all danger tokens) for floor contrast 1.5 -> 2.4 (next test).
        const floor = before > 30 ? 25 : before - 0.5;
        expect(now, `${mode} ${t} vs base ${before.toFixed(1)}`).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('fixes the BUG-016 pairs: deutan telegraph red vs gold, protan and deutan violet vs blue', () => {
    const deut = MACHADO.deutan;
    const prot = MACHADO.protan;
    const d = cvdPalette(palette, 'deutan');
    const pr = cvdPalette(palette, 'protan');
    const pair = (p: PaletteDef, a: string, b: string, m: M3): number =>
      de2000(simulate(token(p, a), m), simulate(token(p, b), m));
    expect(pair(palette, 'danger-red', 'kept-gold', deut)).toBeLessThan(20);
    expect(pair(d, 'danger-red', 'kept-gold', deut)).toBeGreaterThan(25);
    expect(pair(palette, 'danger-violet', 'kept-blue', deut)).toBeLessThan(5);
    expect(pair(d, 'danger-violet', 'kept-blue', deut)).toBeGreaterThan(15);
    expect(pair(palette, 'danger-violet', 'kept-blue', prot)).toBeLessThan(6);
    expect(pair(pr, 'danger-violet', 'kept-blue', prot)).toBeGreaterThan(15);
  });

  it('danger colours keep at least 2:1 contrast on floor-mid in the matching simulation', () => {
    const prot = MACHADO.protan;
    const fl = simulate(token(palette, 'floor-mid'), prot);
    const redC = (p: PaletteDef): number => contrast(simulate(token(p, 'danger-red'), prot), fl);
    expect(redC(palette)).toBeLessThan(1.6);
    expect(redC(cvdPalette(palette, 'protan'))).toBeGreaterThan(2.2);
    for (const mode of MODES) {
      const m = MACHADO[mode as 'protan' | 'deutan' | 'tritan'];
      const p = cvdPalette(palette, mode);
      const floor = simulate(token(p, 'floor-mid'), m);
      for (const t of CVD_DANGER_TOKENS) {
        const c = contrast(simulate(token(p, t), m), floor);
        const base = contrast(simulate(token(palette, t), m), floor);
        // At least 2:1, or the authored value when that was already lower and the token is unchanged.
        expect(c, `${mode} ${t}`).toBeGreaterThanOrEqual(Math.min(2, base) - 0.01);
      }
      // The pale danger core is untouched and stays above 4.5:1 on floor-mid.
      expect(contrast(simulate(token(p, 'danger-core'), m), floor)).toBeGreaterThan(4.5);
    }
  });
});

describe('hazard pattern on danger areas (BUG-016)', () => {
  it('only danger areas take the pattern, and only when asked', () => {
    const off = createAreaStyles(palette);
    for (const s of Object.values(off) as AreaStyle[]) expect(areaEdgeMode(s)).toBeLessThan(2);
    const on = createAreaStyles(cvdPalette(palette, 'deutan'), { hazard: true });
    expect(areaEdgeMode(on.danger)).toBe(2);
    expect(areaEdgeMode(on.bossDanger)).toBe(2);
    expect(areaEdgeMode(on.spawn)).toBe(2);
    for (const k of ['riteZone', 'trailZone', 'shadow', 'footRing', 'wardenAura'] as const)
      expect(areaEdgeMode(on[k]), k).toBe(0);
  });

  it('danger area colours follow the mode palette; player zones do not change', () => {
    const off = createAreaStyles(palette);
    const deut = createAreaStyles(cvdPalette(palette, 'deutan'), { hazard: true });
    expect(deut.danger.edge).not.toEqual(off.danger.edge);
    expect(deut.spawn.edge).not.toEqual(off.spawn.edge);
    expect(deut.wardenAura.edge).not.toEqual(off.wardenAura.edge);
    expect(deut.riteZone).toEqual({ ...off.riteZone, hazard: false });
    expect(deut.footRing.edge).toEqual(off.footRing.edge);
  });

  it('the area shader implements the striped edge and banded fill', () => {
    expect(AREA_FRAGMENT).toContain('bool hazard = vMode.z > 1.5;');
    expect(AREA_FRAGMENT).toContain('bool dashed = vMode.z > 0.5 && !hazard;');
    expect(AREA_FRAGMENT).toMatch(/if \(hazard && filled && !edge\)/);
    expect(AREA_FRAGMENT).toMatch(/if \(edge && hazard && mod\(floor\(along\)/);
  });
});

describe('atlas recolouring (BUG-016)', () => {
  it('recolours danger texels in place, leaves player texels, and Off restores the pixels', async () => {
    const sprites = (await loadAllSprites()).filter((s) => !s.tile).map((s) => s.src);
    const atlas = createSpriteAtlas(sprites, palette);
    const data = (atlas.texture.image as { data: Uint8Array }).data;
    const original = Uint8Array.from(data);
    const has = (rgb: Rgb): number => {
      const [r, g, b] = rgb.map((v) => Math.round(v * 255));
      let n = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i] === r && data[i + 1] === g && data[i + 2] === b && (data[i + 3] ?? 0) > 0) n++;
      return n;
    };
    const redBase = has(token(palette, 'danger-red'));
    const cyanBase = has(token(palette, 'kept-cyan'));
    expect(redBase).toBeGreaterThan(0);
    expect(cyanBase).toBeGreaterThan(0);

    const deut = cvdPalette(palette, 'deutan');
    const v0 = atlas.texture.version;
    recolorSpriteAtlas(atlas, sprites, deut);
    expect(atlas.texture.version).toBeGreaterThan(v0);
    expect(has(token(palette, 'danger-red'))).toBe(0);
    expect(has(token(deut, 'danger-red'))).toBe(redBase);
    expect(has(token(palette, 'kept-cyan'))).toBe(cyanBase);

    recolorSpriteAtlas(atlas, sprites, palette);
    expect(data).toEqual(original);
  });
});
