// Float RGBA image helpers for concept rendering and preview sheets (sRGB space, 0..1).
import { writePng } from './png.mjs';

export function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function toHex([r, g, b]) {
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** WCAG relative luminance of an sRGB triple (0..1). */
export function luminance([r, g, b]) {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** HSV saturation 0..1. */
export function saturation([r, g, b]) {
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
}

export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function createImage(w, h, fill = [0, 0, 0, 0]) {
  const data = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill.length === 4 ? fill : [...fill, 1], i * 4);
  return { w, h, data };
}

export function cloneImage(img) {
  return { w: img.w, h: img.h, data: new Float32Array(img.data) };
}

export function getPx(img, x, y) {
  const i = (y * img.w + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/** Source-over blend of rgb with alpha onto pixel (x, y). Integer coordinates only. */
export function blendPx(img, x, y, rgb, a = 1) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= img.w || y >= img.h || a <= 0) return;
  const i = (y * img.w + x) * 4;
  const d = img.data;
  const da = d[i + 3];
  const oa = a + da * (1 - a);
  if (oa <= 0) return;
  for (let c = 0; c < 3; c++) d[i + c] = (rgb[c] * a + d[i + c] * da * (1 - a)) / oa;
  d[i + 3] = oa;
}

export function addPx(img, x, y, rgb, k = 1) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  for (let c = 0; c < 3; c++) img.data[i + c] += rgb[c] * k;
}

export function fillRect(img, x, y, w, h, rgb, a = 1) {
  for (let yy = Math.max(0, y); yy < Math.min(img.h, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(img.w, x + w); xx++) blendPx(img, xx, yy, rgb, a);
}

export function fillEllipse(img, cx, cy, rx, ry, rgb, a = 1) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) blendPx(img, x, y, rgb, a);
    }
}

/** 1 px ellipse outline (pixel-exact, no anti-aliasing). */
export function ellipseRing(img, cx, cy, rx, ry, rgb, a = 1) {
  const seen = new Set();
  const steps = Math.ceil(2 * Math.PI * Math.max(rx, ry) * 2);
  for (let s = 0; s < steps; s++) {
    const t = (s / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * rx - 0.5);
    const y = Math.round(cy + Math.sin(t) * ry - 0.5);
    const k = `${x},${y}`;
    if (!seen.has(k)) {
      seen.add(k);
      blendPx(img, x, y, rgb, a);
    }
  }
}

export function line(img, x0, y0, x1, y1, rgb, a = 1, dash = 0) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    if (dash && Math.floor(i / dash) % 2 === 1) continue;
    const t = n === 0 ? 0 : i / n;
    blendPx(img, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), rgb, a);
  }
}

/** Composite src over dst at offset. */
export function composite(dst, src, ox = 0, oy = 0) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const a = src.data[i + 3];
      if (a > 0) blendPx(dst, x + ox, y + oy, [src.data[i], src.data[i + 1], src.data[i + 2]], a);
    }
}

export function upscaleNearest(img, s) {
  const out = createImage(img.w * s, img.h * s);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const si = (((y / s) | 0) * img.w + ((x / s) | 0)) * 4;
      out.data.set(img.data.subarray(si, si + 4), (y * out.w + x) * 4);
    }
  return out;
}

/** Separable box blur, repeated `passes` times (3 passes approximate a Gaussian). RGB and alpha. */
export function blur(img, r, passes = 3) {
  let a = cloneImage(img);
  const tmp = new Float32Array(a.data.length);
  const pass = (src, dst, horiz) => {
    const { w, h } = a;
    const n = horiz ? w : h;
    const m = horiz ? h : w;
    for (let j = 0; j < m; j++) {
      const acc = [0, 0, 0, 0];
      const idx = (k) => {
        const kk = Math.max(0, Math.min(n - 1, k));
        return (horiz ? j * w + kk : kk * w + j) * 4;
      };
      for (let k = -r; k <= r; k++) {
        const i = idx(k);
        for (let c = 0; c < 4; c++) acc[c] += src[i + c];
      }
      for (let k = 0; k < n; k++) {
        const o = (horiz ? j * w + k : k * w + j) * 4;
        for (let c = 0; c < 4; c++) dst[o + c] = acc[c] / (2 * r + 1);
        const add = idx(k + r + 1);
        const sub = idx(k - r);
        for (let c = 0; c < 4; c++) acc[c] += src[add + c] - src[sub + c];
      }
    }
  };
  for (let p = 0; p < passes; p++) {
    pass(a.data, tmp, true);
    pass(tmp, a.data, false);
  }
  return a;
}

export function toRgba8(img) {
  const out = new Uint8Array(img.w * img.h * 4);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, img.data[i])) * 255);
  return out;
}

export function savePng(path, img) {
  writePng(path, img.w, img.h, toRgba8(img));
}
