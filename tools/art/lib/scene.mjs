// Concept arena renderer. A CPU stand-in for the runtime HD-2D stack described in docs/art-direction.md:
// low-res scene at native sprite resolution, integer upscale, then post (bloom, danger overlay, DoF bands,
// vignette, glass glint). Screen-space approximation of the tilted orthographic camera.
import {
  hex, mix, luminance, contrast, createImage, cloneImage, blendPx, addPx, fillRect, fillEllipse,
  ellipseRing, line, upscaleNearest, blur,
} from './image.mjs';
import { tokenColor, CORE } from './sprite.mjs';

export const LOW_W = 640;
export const LOW_H = 360;
// Camera pitch asin(2/3) (docs/tech/architecture.md 7.1): floor depth shows at 2/3, floor circles become ellipses ry = r * 2/3.
const FORESHORTEN = 2 / 3;
// Arena from docs/levels/arena-design.md: 32 x 20 u (1 u = 16 px), corners cut 3 u, centred in the 640 x 360 frame.
export const MAIN = { x0: 64, x1: 576, y0: 97, y1: 310 };
const CUT = 48; // 3 u corner cut in world px
/** Distance outside the cut-corner arena in world px (<= 0 inside). `top` weights the far edge (decor side). */
export function outside(x, y, top = 1) {
  const dl = MAIN.x0 - x;
  const dr = x - MAIN.x1;
  const dt = ((MAIN.y0 - y) / FORESHORTEN) * top;
  const db = (y - MAIN.y1) / FORESHORTEN;
  const k = Math.SQRT1_2;
  return Math.max(dl, dr, dt, db, (dl + dt + CUT) * k, (dr + dt + CUT) * k, (dl + db + CUT) * k, (dr + db + CUT) * k);
}
// Concept lighting constants: centre floor multiplier, point light gain, share of light hue kept on surfaces.
const AMBIENT = 0.88;
const POOL = 1.15;
const TINT = 0.15;
const BLOOM = 0.8;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Environment layer: albedo, emissive mask, and a flag for pixels that receive scene light. */
function makeEnv() {
  return {
    albedo: createImage(LOW_W, LOW_H, [0, 0, 0, 1]),
    emissive: createImage(LOW_W, LOW_H, [0, 0, 0, 0]),
    lit: new Uint8Array(LOW_W * LOW_H),
    lights: [],
  };
}

function envRect(env, x, y, w, h, rgb, { emissive = 0, lit = true } = {}) {
  for (let yy = Math.max(0, y); yy < Math.min(LOW_H, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(LOW_W, x + w); xx++) envPx(env, xx, yy, rgb, { emissive, lit });
}

function envPx(env, x, y, rgb, { emissive = 0, lit = true } = {}) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= LOW_W || y >= LOW_H) return;
  const i = y * LOW_W + x;
  env.albedo.data.set([...rgb, 1], i * 4);
  env.lit[i] = lit && !emissive ? 1 : 0;
  if (emissive) env.emissive.data.set([...rgb.map((c) => c * emissive), 1], i * 4);
  else env.emissive.data.set([0, 0, 0, 0], i * 4);
}

function lantern(env, cx, top, b, { paper = 'paper', flame = 'flame', capTok = 'wood-dark', size = 1 } = {}) {
  const P = hex(b.env[paper]);
  const F = hex(b.env[flame]);
  const C = hex(b.env[capTok] ?? CORE.ink);
  const w = 4 + size;
  const h = 5 + size;
  envRect(env, cx - Math.floor(w / 2) + 1, top, w - 2, 1, C);
  for (let y = 1; y <= h; y++) {
    const inset = y === 1 || y === h ? 1 : 0;
    for (let x = -Math.floor(w / 2) + inset; x < Math.ceil(w / 2) - inset; x++) envPx(env, cx + x, top + y, P, { emissive: 0.75 });
  }
  envPx(env, cx, top + Math.ceil(h / 2), F, { emissive: 1 });
  envPx(env, cx, top + Math.ceil(h / 2) + 1, F, { emissive: 1 });
  envRect(env, cx - Math.floor(w / 2) + 1, top + h + 1, w - 2, 1, C);
}

function floorTiles(env, b, variants) {
  const remap = (t) => t.replace(/^b1\./, `${b.id}.`);
  const sets = variants.map((tile) => tile.px.map((t) => (t ? tokenColor(remap(t)) : null)));
  const { w: tw, h: th } = variants[0];
  for (let y = 70; y < 320; y++)
    for (let x = 0; x < LOW_W; x++) {
      const tx = Math.floor(x / tw);
      const ty = Math.floor(y / th);
      const v = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      const c = sets[v % sets.length][(y % th) * tw + (x % tw)];
      envPx(env, x, y, c);
    }
  // Lip: 1 u band outside the boundary keeps floor value. Beyond it the ground drops toward curb (fog fades it later).
  const curb = hex(b.env.curb);
  for (let y = 70; y < LOW_H; y++)
    for (let x = 0; x < LOW_W; x++) {
      const d = outside(x, y);
      if (d > 16) {
        const i = (y * LOW_W + x) * 4;
        const px = [env.albedo.data[i], env.albedo.data[i + 1], env.albedo.data[i + 2]];
        envPx(env, x, y, mix(px, curb, Math.min(1, 0.6 + (d - 16) / 80)));
      }
    }
  for (let y = 320; y < LOW_H; y++) for (let x = 0; x < LOW_W; x++) envPx(env, x, y, mix(curb, hex(b.env.void), 0.4));
  envRect(env, 0, 0, LOW_W, 70, hex(b.env.void), { lit: false });
}

// ---------- Biome decor (top edge and outer sides only, style-guide 1.9) ----------

function decorMarket(env, b, R) {
  const E = (k) => hex(b.env[k]);
  for (let i = 0; i < 7; i++) {
    const x = 18 + i * 88 + Math.floor(R() * 6);
    const w = 70;
    envRect(env, x, 40, w, 46, E('wood-dark'));
    envRect(env, x + 2, 44, w - 4, 3, E('wood'));
    envRect(env, x, 74, w, 12, E('wood'));
    envRect(env, x, 74, w, 1, mix(E('wood'), [1, 1, 1], 0.15));
    for (let g = 0; g < 5; g++) {
      const gx = x + 6 + g * 13;
      const tok = ['stone', 'dust', 'stone', 'shadow', 'dust'][g];
      envRect(env, gx, 69 - (g % 2) * 2, 7, 5 + (g % 2) * 2, hex(CORE[tok]));
    }
    const cloth = [E('cloth-indigo'), i % 2 ? E('cloth-moss') : E('cloth-ochre')];
    for (let yy = 28; yy < 42; yy++) {
      const inset = Math.floor((42 - yy) / 3);
      for (let xx = x - 3 + inset; xx < x + w + 3 - inset; xx++) envPx(env, xx, yy, cloth[Math.floor((xx - x) / 5) & 1]);
    }
    for (let xx = x - 3; xx < x + w + 3; xx++) if ((xx - x) % 5 < 3) envPx(env, xx, 42, cloth[Math.floor((xx - x) / 5) & 1]);
    envRect(env, x, 28, 2, 58, E('wood-dark'));
    envRect(env, x + w - 2, 28, 2, 58, E('wood-dark'));
  }
  // Lantern strings across the top.
  for (let s = 0; s < 3; s++) {
    const x0 = s * 220 - 10;
    const x1 = x0 + 240;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const y = 16 + s * 3 + Math.round(10 * 4 * t * (1 - t));
      envPx(env, x, y, E('rope'));
      if ((x - x0) % 22 === 11) lantern(env, x, y + 1, b);
    }
  }
  // Side lantern posts with floor light pools.
  for (const [x, y] of [[30, 150], [610, 150], [30, 262], [610, 262]]) {
    envRect(env, x, y - 34, 2, 34, E('wood-dark'));
    lantern(env, x + 1, y - 42, b, { size: 2 });
    env.lights.push({ x: x + 1, y, r: b.point.radiusPx, color: hex(b.point.color), k: b.point.intensity });
  }
  for (let i = 0; i < 7; i++) env.lights.push({ x: 50 + i * 90, y: 92, r: 40, color: hex(b.point.color), k: b.point.intensity * 0.55 });
}

function decorCloister(env, b, R) {
  const E = (k) => hex(b.env[k]);
  envRect(env, 0, 22, LOW_W, 64, E('stone-dark'));
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 72;
    // Arch opening (dark), pillars, rim.
    for (let yy = 30; yy < 80; yy++)
      for (let xx = x + 10; xx < x + 58; xx++) {
        const dx = (xx - (x + 34)) / 24;
        const dy = (yy - 44) / 14;
        if (yy >= 44 || dx * dx + dy * dy <= 1) envPx(env, xx, yy, E('void'), { lit: false });
      }
    envRect(env, x + 4, 30, 6, 56, E('stone'));
    envRect(env, x + 58, 30, 6, 56, E('stone'));
    envRect(env, x + 4, 30, 6, 2, E('stone-light'));
    envRect(env, x + 58, 30, 6, 2, E('stone-light'));
    if (i % 2 === 0) {
      envRect(env, x + 28, 46, 12, 26, E('banner'));
      for (let k = 0; k < 12; k += 3) envPx(env, x + 28 + k, 72, E('banner'));
    } else {
      // Candles in the niche.
      for (const cx of [x + 26, x + 34, x + 42]) {
        const h = 4 + Math.floor(R() * 4);
        envRect(env, cx, 80 - h, 2, h, E('candle'), { emissive: 0.6 });
        envPx(env, cx, 79 - h, E('flame'), { emissive: 1 });
        envPx(env, cx + 1, 79 - h, E('flame'), { emissive: 1 });
      }
      env.lights.push({ x: x + 34, y: 92, r: 44, color: hex(b.point.color), k: b.point.intensity * 0.7 });
    }
    for (let m = 0; m < 6; m++) envPx(env, x + 4 + Math.floor(R() * 60), 82 + Math.floor(R() * 4), E('moss'));
  }
  envRect(env, 0, 84, LOW_W, 3, E('stone-light'));
  // Side candle stands.
  for (const [x, y] of [[30, 150], [610, 150], [30, 262], [610, 262]]) {
    envRect(env, x - 2, y - 14, 6, 14, E('stone'));
    envRect(env, x, y - 20, 2, 6, E('candle'), { emissive: 0.6 });
    envPx(env, x, y - 21, E('flame'), { emissive: 1 });
    envPx(env, x + 1, y - 21, E('flame'), { emissive: 1 });
    env.lights.push({ x: x + 1, y, r: b.point.radiusPx, color: hex(b.point.color), k: b.point.intensity });
  }
}

function decorVineyard(env, b, R) {
  const E = (k) => hex(b.env[k]);
  // Ember horizon glow at the very top.
  for (let x = 0; x < LOW_W; x++) {
    const h = 3 + Math.round(2 * Math.sin(x * 0.05) + R() * 2);
    for (let y = 18 - h; y < 18; y++) envPx(env, x, y, mix(E('ember'), E('void'), (18 - y) / (h + 1)), { emissive: 0.55 });
  }
  envRect(env, 0, 18, LOW_W, 10, E('charred'));
  for (let row = 0; row < 3; row++) {
    const y = 34 + row * 18;
    const shade = 1 - row * 0.12;
    for (let x = -4; x < LOW_W + 8; x += 24) {
      envRect(env, x, y - 12, 2, 20, E('trellis').map((c) => c * shade));
    }
    envRect(env, 0, y - 8, LOW_W, 1, E('trellis').map((c) => c * shade * 0.8));
    for (let x = 0; x < LOW_W; x++) {
      if (R() < 0.55) {
        const burnt = (x + row * 40) % 160 < 50;
        const tok = burnt ? 'charred' : R() < 0.5 ? 'leaf-dry' : 'leaf-dead';
        envPx(env, x, y - 7 + Math.floor(R() * 5), E(tok).map((c) => c * shade));
      }
    }
  }
  envRect(env, 0, 84, LOW_W, 2, E('vine-wood'));
  for (const [x, y] of [[30, 150], [610, 150], [30, 262], [610, 262]]) {
    envRect(env, x - 3, y - 10, 8, 10, E('charred'));
    envPx(env, x, y - 11, E('ember'), { emissive: 0.9 });
    envPx(env, x + 2, y - 12, E('ember'), { emissive: 0.7 });
    env.lights.push({ x: x + 1, y, r: b.point.radiusPx, color: hex(b.point.color), k: b.point.intensity });
  }
  for (let i = 0; i < 8; i++) env.lights.push({ x: 40 + i * 80, y: 80, r: 50, color: hex(b.point.color), k: b.point.intensity * 0.45 });
}

const DECOR = { b1: decorMarket, b2: decorCloister, b3: decorVineyard };

/** Light multiplier per pixel: key + fill (biome) + point lights, desaturated so floors stay neutral. */
function lightEnv(env, b) {
  const key = hex(b.key.color);
  const fill = hex(b.fill.color);
  const az = (b.key.azimuthDeg * Math.PI) / 180;
  const sx = Math.sin(az);
  const sy = Math.cos(az);
  const base = key.map((k, c) => k * b.key.intensity * 0.6 + fill[c] * b.fill.intensity * 0.55);
  const baseL = (base[0] + base[1] + base[2]) / 3;
  const out = cloneImage(env.albedo);
  const fogC = hex(b.fog.color);
  for (let y = 0; y < LOW_H; y++)
    for (let x = 0; x < LOW_W; x++) {
      const i = y * LOW_W + x;
      if (!env.lit[i]) continue;
      const nx = (x - LOW_W / 2) / LOW_W;
      const ny = (y - LOW_H / 2) / LOW_H;
      const grad = Math.max(0.68, Math.min(1.2, 0.92 - 0.6 * (nx * sx + ny * sy)));
      const m = key.map((k, c) => ((k * b.key.intensity * 0.6 * grad + fill[c] * b.fill.intensity * 0.55) / baseL) * AMBIENT);
      for (const L of env.lights) {
        const dx = (x - L.x) / L.r;
        const dy = (y - L.y) / (L.r * FORESHORTEN);
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const f = (1 - d2) ** 2 * L.k * POOL;
          for (let c = 0; c < 3; c++) m[c] += L.color[c] * f;
        }
      }
      // Pulse light: faint pale glow from the arena centre (the shard).
      const pd = ((x - 320) / 170) ** 2 + ((y - 204) / (170 * FORESHORTEN)) ** 2;
      if (pd < 1) for (let c = 0; c < 3; c++) m[c] += 0.08 * (1 - pd) ** 2;
      const g = (m[0] + m[1] + m[2]) / 3;
      for (let c = 0; c < 3; c++) m[c] = g + (m[c] - g) * TINT;
      for (let c = 0; c < 3; c++) out.data[i * 4 + c] *= m[c];
      // Edge fog: outside the main floor the scene sinks into the biome void.
      // Fog starts 3 u (48 px) outside the boundary, full at 10 u (160 px); the far (decor) side fogs at half rate.
      const f = smooth((outside(x, y, 0.45) - 48) / 112) * b.fog.strength;
      if (f > 0) {
        const px = [out.data[i * 4], out.data[i * 4 + 1], out.data[i * 4 + 2]];
        out.data.set(mix(px, fogC, f), i * 4);
      }
    }
  // Emissive and unlit pixels (lit = 0) keep their albedo untouched.
  return out;
}

/** Colour of an albedo under the biome key + fill at the arena centre (no point lights). For palette sheets. */
export function litColor(b, albedoHex) {
  const key = hex(b.key.color);
  const fill = hex(b.fill.color);
  const base = key.map((k, c) => k * b.key.intensity * 0.6 + fill[c] * b.fill.intensity * 0.55);
  const baseL = (base[0] + base[1] + base[2]) / 3;
  const m = key.map((k, c) => ((k * b.key.intensity * 0.6 * 0.9 + fill[c] * b.fill.intensity * 0.55) / baseL) * AMBIENT);
  const g = (m[0] + m[1] + m[2]) / 3;
  return hex(albedoHex).map((a, c) => a * (g + (m[c] - g) * TINT));
}

function grade(img, b) {
  const lift = hex(b.grade.lift);
  const gain = hex(b.grade.gain);
  const s = b.grade.strength;
  for (let i = 0; i < img.data.length; i += 4) {
    const px = [img.data[i], img.data[i + 1], img.data[i + 2]];
    const L = (px[0] + px[1] + px[2]) / 3;
    const g = mix(mix(px, lift, s * (1 - L) * 0.6), mix(px, gain, 0.5), s * L);
    img.data.set(g, i);
  }
}

// ---------- Actors ----------

function drawFrame(layer, frame, ax, ay, opts = {}) {
  const { flipX = false, recolor = {}, emissive = null, emissiveTokens = [], emissiveK = 0.5, mask = null, maskId = 0 } = opts;
  const x0 = Math.round(ax - frame.w / 2);
  const y0 = Math.round(ay - frame.h);
  for (let y = 0; y < frame.h; y++)
    for (let x = 0; x < frame.w; x++) {
      const t = frame.px[y * frame.w + (flipX ? frame.w - 1 - x : x)];
      if (t === null) continue;
      const tok = recolor[t] ?? t;
      const c = tokenColor(tok);
      blendPx(layer, x0 + x, y0 + y, c, 1);
      if (emissive && emissiveTokens.includes(tok)) blendPx(emissive, x0 + x, y0 + y, c.map((v) => v * emissiveK), 1);
      if (mask) {
        const xi = x0 + x;
        const yi = y0 + y;
        if (xi >= 0 && yi >= 0 && xi < LOW_W && yi < LOW_H) mask[yi * LOW_W + xi] = maskId;
      }
    }
  return { x0, y0 };
}

/**
 * Render one arena scene.
 * @param {object} b biome definition
 * @param {Record<string, object>} S compiled sprites by id
 * @param {{ scale?: number, seed?: number }} opts
 */
export function renderScene(b, S, opts = {}) {
  const scale = opts.scale ?? 3;
  const R = rng(opts.seed ?? 7);
  const env = makeEnv();
  floorTiles(env, b, S['tile-floor'].anims.variants.frames);
  DECOR[b.id](env, b, R);
  const scene = lightEnv(env, b);
  grade(scene, b);
  // Glass rim on the boundary (arena-design 4.2): about 2 px, dust at 50%, floor layer under all actors.
  const rimC = hex(CORE.dust);
  for (let y = MAIN.y0 - 4; y < MAIN.y1 + 4; y++)
    for (let x = MAIN.x0 - 4; x < MAIN.x1 + 4; x++) {
      const d = outside(x, y);
      if (d > 0 && d <= 2.2) blendPx(scene, x, y, rimC, 0.5);
    }
  const floorOnly = cloneImage(scene);

  const emissive = cloneImage(env.emissive);
  const danger = createImage(LOW_W, LOW_H, [0, 0, 0, 0]);
  // Mask: 0 floor/env, 1 kept, 2 unlit, 3 fx-kept, 4 danger, 5 glint
  const mask = new Uint8Array(LOW_W * LOW_H);
  const F = (id, anim = 'idle', i = 0) => S[id].anims[anim].frames[i];
  const ink = hex(CORE.ink);
  const cyan = hex(CORE['kept-cyan']);
  const red = hex(CORE['danger-red']);

  const player = { x: 320, y: 214 };
  const actors = [];
  const free = (x, y, r) => Math.hypot(x - player.x, (y - player.y) / FORESHORTEN) > r;
  const spot = (cx, cy, spread, minR = 44) => {
    for (let k = 0; k < 50; k++) {
      const x = Math.round(cx + (R() - 0.5) * spread * 2);
      const y = Math.round(cy + (R() - 0.5) * spread * 1.2);
      if (outside(x, y) < -10 && y > MAIN.y0 + 14 && free(x, y, minR)) return [x, y];
    }
    return [cx, cy];
  };
  for (const [cx, cy, n] of [[150, 170, 12], [500, 250, 11], [430, 130, 8], [190, 285, 7], [250, 120, 5]])
    for (let i = 0; i < n; i++) {
      const [x, y] = spot(cx, cy, 46);
      actors.push({ id: 'unlit-swarmer', x, y, frame: i % 2, flip: x > player.x });
    }
  actors.push({ id: 'unlit-charger', x: 222, y: 236, flip: false, telegraph: 'lunge' });
  actors.push({ id: 'unlit-charger', x: 470, y: 182, flip: true });
  actors.push({ id: 'unlit-shooter', x: 388, y: 286 });
  actors.push({ id: 'unlit-shooter', x: 112, y: 222 });
  actors.push({ id: 'unlit-shooter', x: 540, y: 140 });
  actors.push({ id: 'unlit-exploder', x: 372, y: 160, telegraph: 'burst' });
  actors.push({ id: 'unlit-exploder', x: 96, y: 140 });
  actors.push({ id: 'unlit-tank', x: 268, y: 304 });
  actors.push({ id: 'unlit-summoner', x: 560, y: 296 });
  actors.push({ id: 'warden-hound', x: 470, y: 134, flip: true });
  actors.push({ id: 'kept-lantern', x: player.x, y: player.y, kept: true });

  // L1 kept ground decal: ring under the player.
  ellipseRing(scene, player.x, player.y + 0.5, 9, 3.5, cyan, 0.5);

  // L4 danger (architecture 7.4): telegraph fill grows from the centre, solid edge. Composited after all post-processing.
  const burst = actors.find((a) => a.telegraph === 'burst');
  const BR = 29; // exploder blast radius 1.8 u
  fillEllipse(danger, burst.x, burst.y - 2, BR * 0.7, BR * 0.7 * FORESHORTEN, red, 0.3);
  ellipseRing(danger, burst.x, burst.y - 2, BR, BR * FORESHORTEN, red, 1);
  // Warden aura: ground decal under actors (presence marker, not a damage telegraph).
  const warden = actors.find((a) => a.id === 'warden-hound');
  const violet = hex(CORE['danger-violet']);
  fillEllipse(scene, warden.x, warden.y, 28, 28 * FORESHORTEN, violet, 0.14);
  ellipseRing(scene, warden.x, warden.y, 28, 28 * FORESHORTEN, violet, 0.7);
  const lunger = actors.find((a) => a.telegraph === 'lunge');
  line(danger, lunger.x + 12, lunger.y - 8, player.x - 14, player.y - 6, red, 1, 3);

  // L1 shadows
  for (const a of actors) {
    const f = F(a.id);
    fillEllipse(scene, a.x, a.y, Math.max(3, f.w * 0.38), Math.max(1.5, f.w * 0.1), ink, 0.35);
  }
  // L2 Glint (drawn before actors because it lies on the floor)
  const glints = [];
  for (let i = 0; i < 16; i++) {
    const [x, y] = spot(320, 210, 230, 26);
    glints.push([x, y]);
    drawFrame(scene, F('fx-glint', 'idle', i % 2), x, y, { emissive, emissiveTokens: S['fx-glint'].src.emissive, emissiveK: 0.6, mask, maskId: 5 });
  }
  // L2 actors, y-sorted by feet
  actors.sort((a, b2) => a.y - b2.y);
  for (const a of actors) {
    const src = S[a.id].src;
    const recolor = a.telegraph === 'lunge' ? { ink: 'danger-red' } : {};
    drawFrame(scene, F(a.id, 'idle', a.frame ?? 0), a.x, a.y, {
      flipX: a.flip, recolor, emissive, emissiveTokens: [...(src.emissive ?? []), 'danger-red', 'danger-magenta'],
      emissiveK: a.kept ? 0.3 : 0.45, mask, maskId: a.kept ? 1 : 2,
    });
  }
  // L3 kept effects: projectiles with short trails, capped opacity and size.
  const shots = [];
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + 0.3;
    const d = 22 + (i % 3) * 22;
    const x = Math.round(player.x + Math.cos(ang) * d);
    const y = Math.round(player.y - 10 + Math.sin(ang) * d * FORESHORTEN);
    for (let t = 1; t <= 4; t++)
      blendPx(scene, Math.round(x - Math.cos(ang) * t * 2), Math.round(y - Math.sin(ang) * t * 2 * FORESHORTEN), cyan, 0.35 - t * 0.07);
    drawFrame(scene, F('fx-shot-kept'), x, y + 2, { emissive, emissiveTokens: S['fx-shot-kept'].src.emissive, emissiveK: 0.4, mask, maskId: 3 });
    shots.push([x, y]);
  }
  // L4 danger: enemy projectiles only in the danger layer (no scene bloom; they read by contrast).
  const dangerShots = [];
  const spitters = actors.filter((a) => a.id === 'unlit-shooter');
  for (const s of spitters)
    for (let k = 1; k <= 3; k++) {
      const t = k / 4.2;
      const x = Math.round(s.x + (player.x - s.x) * t);
      const y = Math.round(s.y - 12 + (player.y - 8 - (s.y - 12)) * t);
      drawFrame(danger, F('fx-shot-danger'), x, y + 3, { mask, maskId: 4 });
      dangerShots.push([x, y]);
    }

  // ---------- Post at full resolution ----------
  const W = LOW_W * scale;
  const H = LOW_H * scale;
  let full = upscaleNearest(scene, scale);
  // Bloom: emissive mask, blurred, added.
  const bloom = blur(upscaleNearest(emissive, scale), 3 * scale, 3);
  for (let i = 0; i < full.data.length; i += 4) for (let c = 0; c < 3; c++) full.data[i + c] += bloom.data[i + c] * BLOOM;
  // Tilt-shift DoF: only the top 15% and bottom 10% bands.
  const topEdge = Math.round(H * 0.15);
  const botStart = Math.round(H * 0.9);
  const blurred = blur(full, 2 * scale, 3);
  for (let y = 0; y < H; y++) {
    const t = y < topEdge ? smooth((topEdge - y) / topEdge) : y >= botStart ? smooth((y - botStart) / (H - botStart)) : 0;
    if (t <= 0) continue;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) full.data[i + c] += (blurred.data[i + c] - full.data[i + c]) * t;
    }
  }
  // Vignette, about 20% at the corners.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)) / Math.SQRT2;
      const v = 1 - 0.2 * smooth((d - 0.55) / 0.45);
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) full.data[i + c] *= v;
    }
  // Glass glint: thin diagonal reflections in two corners only.
  const glass = hex(b.env.glass);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s1 = x + y;
      const s2 = W - x + (H - y);
      let a = 0;
      if (s1 > 180 && s1 < 186 && x + y < 400) a = 0.12;
      if (s1 > 200 && s1 < 202) a = 0.08;
      if (s2 > 150 && s2 < 155) a = 0.1;
      if (a > 0) blendPx(full, x, y, glass, a);
    }
  // Danger pass last (architecture 7.5 step 4): bloom, DoF, vignette, and glint never touch it (P2-f).
  const dangerFull = upscaleNearest(danger, scale);
  for (let i = 0; i < full.data.length; i += 4) {
    const a = dangerFull.data[i + 3];
    if (a > 0) for (let c = 0; c < 3; c++) full.data[i + c] = full.data[i + c] * (1 - a) + dangerFull.data[i + c] * a;
  }

  return { full, low: scene, danger, floorOnly, mask, dangerShots, shots, glints, player, actors, scale, W, H };
}

/** Measure contrast on the final image (P2-c): sample the centre of a low-res pixel in the full image. */
export function measure(result) {
  const { full, mask, scale, floorOnly } = result;
  const at = (x, y) => {
    const i = ((y * scale + (scale >> 1)) * full.w + x * scale + (scale >> 1)) * 4;
    return [full.data[i], full.data[i + 1], full.data[i + 2]];
  };
  // Local floor: median luminance of floor pixels (mask 0) in a 15 px window of the final image.
  const localFloor = (x, y) => {
    const ls = [];
    for (let yy = y - 7; yy <= y + 7; yy++)
      for (let xx = x - 7; xx <= x + 7; xx++)
        if (outside(xx, yy) < -3 && mask[yy * LOW_W + xx] === 0) ls.push(at(xx, yy));
    ls.sort((p, q) => luminance(p) - luminance(q));
    return ls[ls.length >> 1];
  };
  const tokPx = (id, tok) => {
    const out = [];
    const target = tokenColor(tok);
    for (let y = MAIN.y0; y < MAIN.y1; y++)
      for (let x = MAIN.x0; x < MAIN.x1; x++) {
        if (mask[y * LOW_W + x] !== id) continue;
        const i = (y * LOW_W + x) * 4;
        const srcImg = id === 4 ? result.danger : result.low;
        const p = [srcImg.data[i], srcImg.data[i + 1], srcImg.data[i + 2]];
        if (Math.abs(p[0] - target[0]) + Math.abs(p[1] - target[1]) + Math.abs(p[2] - target[2]) < 0.02) out.push([x, y]);
      }
    return out;
  };
  const ratios = (pts) =>
    pts.map(([x, y]) => [at(x, y), localFloor(x, y)]).filter(([, f]) => f).map(([p, f]) => contrast(p, f)).sort((p, q) => p - q);
  const summary = (r) =>
    r.length ? { n: r.length, min: +r[0].toFixed(2), p10: +r[Math.floor(r.length * 0.1)].toFixed(2), median: +r[r.length >> 1].toFixed(2) } : { n: 0 };
  const floorLs = [];
  for (let y = MAIN.y0; y < MAIN.y1; y += 3)
    for (let x = MAIN.x0; x < MAIN.x1; x += 3) if (outside(x, y) < -3 && mask[y * LOW_W + x] === 0) floorLs.push(luminance(at(x, y)));
  floorLs.sort((p, q) => p - q);
  const floorSat = [];
  for (let y = MAIN.y0; y < MAIN.y1; y += 5)
    for (let x = MAIN.x0; x < MAIN.x1; x += 5) {
      if (outside(x, y) > -3) continue;
      const i = (y * LOW_W + x) * 4;
      const p = [floorOnly.data[i], floorOnly.data[i + 1], floorOnly.data[i + 2]];
      const mx = Math.max(...p);
      floorSat.push(mx ? (mx - Math.min(...p)) / mx : 0);
    }
  floorSat.sort((p, q) => p - q);
  return {
    floorLuminanceMedian: +floorLs[floorLs.length >> 1].toFixed(4),
    floorSaturationMedian: +floorSat[floorSat.length >> 1].toFixed(3),
    floorSaturationP90: +floorSat[Math.floor(floorSat.length * 0.9)].toFixed(3),
    dangerCoreVsFloor: summary(ratios(tokPx(4, 'danger-core'))),
    keptCyanVsFloor: summary(ratios(tokPx(1, 'kept-cyan'))),
    keptWhiteShotVsFloor: summary(ratios(tokPx(3, 'kept-white'))),
    unlitBodyVsFloor: summary(ratios(tokPx(2, 'unlit-body'))),
  };
}
