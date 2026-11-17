// Entity layers over a fake WorldView (AD, M1-05, M2-03): every entity becomes an instance in the right
// layer, the player turns toward its motion and picks cast, hit, walk, idle; Unlit flash, wind up, emerge
// and dissolve on death; Rite zones grow with a cyan edge; damage numbers follow events and settings.
// Runs three.js objects in Node (no WebGL context needed: only buffers are filled).

import { DataTexture } from 'three';
import type { InstancedBufferAttribute, InstancedBufferGeometry, Mesh } from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DAMAGE_HIT_KIND_SHIFT,
  DAMAGE_RANK_SHIFT,
  EnemyRank,
  HitKind,
  SimEventType,
} from '../../src/core/index.ts';
import type { Settings } from '../../src/core/index.ts';
import type { RenderFrame } from '../../src/core/dom.ts';
import { SpriteLight } from '../../src/render/shaders/index.ts';
import {
  AiAnim,
  createEntityLayers,
  PLAYER_HIT_FLASH_ALPHA,
} from '../../src/render/sprites/entity-layers.ts';
import type { EntityLayers } from '../../src/render/sprites/entity-layers.ts';
import {
  BIG_FOE_HIT_FLASH_ALPHA,
  UNLIT_HIT_FLASH_ALPHA,
} from '../../src/render/sprites/actor-flash.ts';
import { DASH_AFTERIMAGES } from '../../src/render/vfx/effects.ts';
import { linearRgb } from '../../src/render/vfx/telegraph-style.ts';
import { createPreviewScene, eventsOf, playerOf, PREVIEW_DATA } from './fake-scene.ts';
import type { PreviewScene } from './fake-scene.ts';
import { loadArtFixture, NO_EVENTS } from './support.ts';

const art = await loadArtFixture();
const texture = new DataTexture(new Uint8Array(4), 1, 1);

const count = (m: unknown): number =>
  ((m as Mesh | undefined)?.geometry as InstancedBufferGeometry | undefined)?.instanceCount ?? -1;
const attr = (m: unknown, name: string): Float32Array =>
  (((m as Mesh).geometry as InstancedBufferGeometry).getAttribute(name) as InstancedBufferAttribute)
    .array as Float32Array;

const settings = (damageNumbers: boolean, reduceEffects = false): Settings =>
  ({ access: { damageNumbers, reduceEffects } }) as unknown as Settings;

function frame(scene: PreviewScene, timeSec: number, events = NO_EVENTS): RenderFrame {
  return { view: scene.world, alpha: 1, events, timeSec };
}

const anim = (id: string, name: string) => art.manifest.sprites[id]?.animations[name]?.frames ?? [];

let layers: EntityLayers;
let scene: PreviewScene;
/** Scene object order: zones, decals, fx rings, actors, effects. */
let zones: Mesh, decals: Mesh, actors: Mesh, effects: Mesh;
beforeEach(() => {
  layers = createEntityLayers(texture, art.manifest, art.palette, PREVIEW_DATA);
  layers.resize({ pixelScale: 3, width: 640, height: 360, originX: 0, originY: 0 });
  scene = createPreviewScene();
  const objs = layers.sceneObjects as Mesh[];
  zones = objs[0] as Mesh;
  decals = objs[1] as Mesh;
  actors = objs[3] as Mesh;
  effects = objs[4] as Mesh;
});

describe('entity layers', () => {
  it('fills every layer from the fake world', () => {
    layers.update(frame(scene, 1, scene.events[0]));
    const [danger, dangerSprites] = layers.dangerObjects as Mesh[];
    const w = scene.world;
    // L2: player + alive enemies + Glint.
    expect(count(actors)).toBe(1 + 13 + w.pickups.highWater);
    // L1 decals: one blob shadow per actor except Glint, the player foot ring, the Warden aura.
    expect(count(decals)).toBe(1 + 13 + 1 + 1);
    // L3: 10 shots + 7 fast shots x 2 tail dots + 2 magnetized Glint x 2 tail dots + 2 Burn flames
    // + damage glyphs (6, 14, 8 -> 1 + 2 + 1) + 3 sparks per projectile hit.
    expect(count(effects)).toBe(10 + 14 + 4 + 2 + 4 + 9);
    // Areas: 4 telegraphs + 3 spawn rings (L4), trail + Rite zone (L3).
    expect(count(danger)).toBe(4 + 3);
    expect(count(zones)).toBe(2);
    // L4 sprites: 3 spawn cracks + 4 enemy shots.
    expect(count(dangerSprites)).toBe(3 + 4);
    expect(layers.overflow()).toBe(0);
  });

  it('lights the player as Kept and Unlit as Unlit, effects unlit', () => {
    layers.update(frame(scene, 1));
    const p = attr(actors, 'iParams');
    expect(p[3]).toBe(SpriteLight.Kept);
    expect(p[4 + 3]).toBe(SpriteLight.Unlit);
    const e = attr(effects, 'iParams');
    expect(e[3]).toBe(SpriteLight.None);
  });

  it('turns the player toward horizontal motion and keeps it while standing', () => {
    playerOf(scene.world).prevX = scene.world.player.x + 0.07; // moving left
    layers.update(frame(scene, 1));
    expect(attr(actors, 'iParams')[0]).toBe(-1);
    playerOf(scene.world).prevX = scene.world.player.x - 0.07; // moving right
    layers.update(frame(scene, 1.1));
    expect(attr(actors, 'iParams')[0]).toBe(1);
    playerOf(scene.world).prevX = scene.world.player.x; // standing still
    layers.update(frame(scene, 1.2));
    expect(attr(actors, 'iParams')[0]).toBe(1);
  });

  it('uses walk while moving, idle while standing, cast after a Rite, hit while flashing', () => {
    const walk = anim('kept-lantern', 'walk');
    const idle = anim('kept-lantern', 'idle');
    const cast = anim('kept-lantern', 'cast');
    const hit = anim('kept-lantern', 'hit');
    layers.update(frame(scene, 0));
    expect(attr(actors, 'iRect')[0]).toBe(walk[0]?.x);
    playerOf(scene.world).prevX = scene.world.player.x;
    layers.update(frame(scene, 0));
    expect(attr(actors, 'iRect')[0]).toBe(idle[0]?.x);
    layers.update(frame(scene, 5, eventsOf([[SimEventType.RiteCast, -3, -3, 0, 0]])));
    expect(cast.map((f) => f.x)).toContain(attr(actors, 'iRect')[0]);
    playerOf(scene.world).hitFlashTicks = 6;
    layers.update(frame(scene, 6));
    expect(hit.map((f) => f.x)).toContain(attr(actors, 'iRect')[0]);
    // A partial kept-white tint keeps the class readable under frequent hits (LP M2-09).
    expect(attr(actors, 'iFlash')[3]).toBeCloseTo(PLAYER_HIT_FLASH_ALPHA, 6);
    expect(PLAYER_HIT_FLASH_ALPHA).toBeLessThan(1);
  });

  it('flashes the player gold after a level up (reward colour), never red', () => {
    playerOf(scene.world).hitFlashTicks = 0;
    layers.update(frame(scene, 2, eventsOf([[SimEventType.PlayerLeveledUp, 0, 0, 2, 0]])));
    const f = attr(actors, 'iFlash');
    const gold = linearRgb(art.palette, 'kept-gold');
    expect([f[0], f[1], f[2]].map((v) => Number(v?.toFixed(4)))).toEqual(
      gold.map((v) => Number(v.toFixed(4))),
    );
    expect(f[3]).toBeGreaterThan(0);
  });

  it('flashes impact-hit Unlit with a partial bone tint; zone and Burn ticks never flash', () => {
    const kind = (k: number, rank: number = EnemyRank.Normal): number =>
      (k << DAMAGE_HIT_KIND_SHIFT) | (rank << DAMAGE_RANK_SHIFT);
    const en = scene.world.enemies as unknown as { hitFlashTicks: Int32Array };
    // Slot 2 (swarmer at -7.5, -2.4) hit by a projectile; slot 10 (tank at -4, 6.5) by a zone tick;
    // slot 11 (Warden at 6, 4.5) by a melee hit; slot 0 by a Burn tick only.
    en.hitFlashTicks[11] = 2;
    en.hitFlashTicks[0] = 2;
    layers.update(
      frame(
        scene,
        1,
        eventsOf([
          [SimEventType.EnemyDamaged, -7.5, -2.4, 5, kind(HitKind.Projectile)],
          [SimEventType.EnemyDamaged, -4, 6.5, 2, kind(HitKind.Zone)],
          [SimEventType.EnemyDamaged, 6, 4.5, 9, kind(HitKind.Melee, EnemyRank.Warden)],
          [SimEventType.EnemyDamaged, -9, -3, 1, kind(HitKind.Dot)],
        ]),
      ),
    );
    const flash = attr(actors, 'iFlash');
    // Instance 0 is the player; enemy slot i is instance i + 1.
    const bone = linearRgb(art.palette, 'bone');
    expect(flash[(2 + 1) * 4]).toBeCloseTo(bone[0], 4);
    expect(flash[(2 + 1) * 4 + 3]).toBe(UNLIT_HIT_FLASH_ALPHA);
    expect(flash[(10 + 1) * 4 + 3]).toBe(0);
    expect(flash[(11 + 1) * 4 + 3]).toBeCloseTo(BIG_FOE_HIT_FLASH_ALPHA, 6);
    expect(flash[(0 + 1) * 4 + 3]).toBe(0);
    expect(flash[0 * 4 + 3]).toBe(0);
    expect(UNLIT_HIT_FLASH_ALPHA).toBeLessThanOrEqual(0.5);
    expect(BIG_FOE_HIT_FLASH_ALPHA).toBeLessThanOrEqual(0.35);
    // The flash holds while the sim flash runs, then ends.
    layers.update(frame(scene, 1 + 1 / 60));
    expect(attr(actors, 'iFlash')[(2 + 1) * 4 + 3]).toBe(UNLIT_HIT_FLASH_ALPHA);
    en.hitFlashTicks[2] = 0;
    layers.update(frame(scene, 1 + 2 / 60));
    expect(attr(actors, 'iFlash')[(2 + 1) * 4 + 3]).toBe(0);
  });

  it('shows the windup pose with a bright magenta outline and keeps the dark body (BUG-007)', () => {
    // Slot 6 is the charger with aiState Windup.
    expect(scene.world.enemies.aiState[6]).toBe(AiAnim.Windup);
    const windup = anim('unlit-charger', 'windup').map((f) => f.x);
    const magenta = linearRgb(art.palette, 'danger-magenta');
    const reds: number[] = [];
    for (let t = 0; t < 0.2; t += 1 / 60) {
      layers.update(frame(scene, t));
      expect(windup).toContain(attr(actors, 'iRect')[7 * 4]);
      // No body tint: the dark unlit-body value stays (three value layers).
      expect(attr(actors, 'iFlash')[7 * 4 + 3]).toBe(0);
      const o = attr(actors, 'iOutline');
      expect(o[7 * 4 + 3]).toBe(1);
      reds.push(Number((o[7 * 4 + 1] ?? 0).toFixed(4)));
    }
    // Pulses between magenta and magenta mixed toward the pale core.
    expect(reds).toContain(Number(magenta[1].toFixed(4)));
    expect(new Set(reds).size).toBe(2);
    // Units not winding up keep their ink outline.
    expect(attr(actors, 'iOutline')[(0 + 1) * 4 + 3]).toBe(0);
    expect(attr(actors, 'iOutline')[3]).toBe(0);
  });

  it('rises young Unlit out of the floor with a reverse dissolve', () => {
    const en = scene.world.enemies as unknown as { ageTicks: Int32Array };
    en.ageTicks[0] = 0;
    layers.update(frame(scene, 1));
    expect(attr(actors, 'iParams')[4 + 2]).toBe(1);
    en.ageTicks[0] = 9;
    layers.update(frame(scene, 1.1));
    expect(attr(actors, 'iParams')[4 + 2]).toBeCloseTo(0.5, 5);
  });

  it('dissolves a dying Unlit where it stood and scatters dark shards and motes', () => {
    layers.update(frame(scene, 1));
    const before = count(effects);
    const en = scene.world.enemies as unknown as { alive: Uint8Array };
    en.alive[0] = 0;
    layers.update(frame(scene, 1 + 0.1));
    // Ghost + 4 shards + 3 motes, one Unlit fewer on L2.
    expect(count(effects)).toBe(before + 1 + 4 + 3);
    expect(count(actors)).toBe(1 + 12 + scene.world.pickups.highWater);
    // The ghost is the only lit effect: born with a bone hit flash, then breaking up in texels.
    const ghostOf = (): { dissolve: number; flash: number }[] => {
      const params = attr(effects, 'iParams');
      const flash = attr(effects, 'iFlash');
      const out: { dissolve: number; flash: number }[] = [];
      for (let i = 0; i < count(effects); i++)
        if (params[i * 4 + 3] === SpriteLight.Unlit)
          out.push({ dissolve: params[i * 4 + 2] ?? 0, flash: flash[i * 4 + 3] ?? 0 });
      return out;
    };
    expect(ghostOf()).toEqual([{ dissolve: 0, flash: UNLIT_HIT_FLASH_ALPHA }]);
    layers.update(frame(scene, 1.25));
    const later = ghostOf();
    expect(later).toHaveLength(1);
    expect(later[0]?.dissolve).toBeGreaterThan(0);
    layers.update(frame(scene, 1.8));
    expect(count(effects)).toBe(before);
  });

  it('grows the Rite zone from the centre with a solid cyan edge; trails have no edge', () => {
    layers.update(frame(scene, 1));
    const geo = attr(zones, 'aShape');
    const edge = attr(zones, 'aEdge');
    const mode = attr(zones, 'aMode');
    expect(geo[4]).toBeLessThan(3);
    layers.update(frame(scene, 1.3));
    expect(attr(zones, 'aShape')[4]).toBeCloseTo(3, 5);
    const cyan = linearRgb(art.palette, 'kept-cyan');
    expect(edge[4]).toBeCloseTo(cyan[0], 4);
    expect(edge[4 + 3]).toBe(1);
    expect(mode[4 + 2]).toBe(0); // never dashed
    expect(edge[3]).toBe(0); // trail: no edge
    expect(attr(zones, 'aFill')[4 + 3]).toBeLessThanOrEqual(0.25);
    // Zones are merged: instance index in aMode.w for the merge test in the area shader.
    expect(mode[3]).toBe(0);
    expect(mode[4 + 3]).toBe(1);
  });

  it('caps damage numbers near the player at 4, dropping the oldest normal ones', () => {
    // Player feet at (0, 1). Twelve hits within 2 u, two of them crits.
    const near = eventsOf(
      Array.from({ length: 12 }, (_, i) => {
        const crit = i === 1 || i === 2 ? 1 : 0;
        return [SimEventType.EnemyDamaged, -1 + i * 0.15, 1.5, 7, crit] as const;
      }),
    );
    layers.update(frame(scene, 1, near));
    const crit = new Set(anim('fx-digits', 'crit').map((f) => f.x));
    const normal7 = anim('fx-digits', 'normal')[7]?.x;
    const rects = attr(effects, 'iRect');
    let normals = 0;
    let crits = 0;
    for (let i = 0; i < count(effects); i++) {
      const rx = rects[i * 4] ?? -1;
      if (rx === normal7) normals++;
      else if (crit.has(rx)) crits++;
    }
    expect(crits).toBe(2);
    expect(normals).toBe(2);
  });

  it('draws each Rite archetype as what happens: lantern flight, toll ring, dash afterimages', () => {
    const data = {
      ...PREVIEW_DATA,
      rites: [
        { archetype: 'throw_zone', params: { flight_s: 0.35, zone_radius: 3 } },
        { archetype: 'ring', params: {} },
        { archetype: 'dash', params: {} },
      ],
    } as unknown as typeof PREVIEW_DATA;
    const l = createEntityLayers(texture, art.manifest, art.palette, data);
    l.resize({ pixelScale: 3, width: 640, height: 360, originX: 0, originY: 0 });
    const objs = l.sceneObjects as Mesh[];
    const fx = objs[2] as Mesh;
    const fxEffects = objs[4] as Mesh;
    const flare = anim(
      'fx-flare',
      Object.keys(art.manifest.sprites['fx-flare']?.animations ?? {})[0] ?? '',
    );
    const flareX = flare[0]?.x;
    const flights = (): number => {
      const r = attr(fxEffects, 'iRect');
      const p = attr(fxEffects, 'iPos');
      let n = 0;
      // A flight carries the flare from the player (x 0) toward the aim point (x 5).
      for (let i = 0; i < count(fxEffects); i++)
        if (r[i * 4] === flareX && (p[i * 3] ?? 0) > 0.5) n++;
      return n;
    };
    // Great Toll: RiteLanded at the player with the real radius, then RiteCast at the aim point.
    l.update(frame(scene, 2));
    const baseRings = count(fx);
    l.update(
      frame(
        scene,
        2.01,
        eventsOf([
          [SimEventType.RiteLanded, 0, 1, 1, 4.5],
          [SimEventType.RiteCast, 5, 5, 1, 0],
        ]),
      ),
    );
    l.update(frame(scene, 2.01 + 0.25));
    expect(flights()).toBe(0);
    const shape = attr(fx, 'aShape');
    const geo = attr(fx, 'aGeo');
    let biggest = 0;
    for (let i = 0; i < count(fx); i++)
      if (geo[i * 4] === 0 && geo[i * 4 + 1] === 1) biggest = Math.max(biggest, shape[i * 4] ?? 0);
    expect(count(fx)).toBeGreaterThan(baseRings);
    expect(biggest).toBeGreaterThan(4.5 * 0.9);
    expect(biggest).toBeLessThanOrEqual(4.5);
    // Nothing was drawn at the aim point (5, 5).
    for (let i = 0; i < count(fx); i++) expect(geo[i * 4]).not.toBe(5);

    // Glass Step: the player was drawn at (0, 1) last frame and lands at (4, 1).
    const cyan = linearRgb(art.palette, 'kept-cyan');
    l.update(frame(scene, 3));
    l.update(
      frame(
        scene,
        3.01,
        eventsOf([
          [SimEventType.RiteLanded, 4, 1, 2, 0.6],
          [SimEventType.RiteCast, 6, 1, 2, 0],
        ]),
      ),
    );
    l.update(frame(scene, 3.11));
    expect(flights()).toBe(0);
    const pos = attr(fxEffects, 'iPos');
    const fl = attr(fxEffects, 'iFlash');
    const after: number[] = [];
    for (let i = 0; i < count(fxEffects); i++)
      if (Math.abs((fl[i * 4] ?? 0) - cyan[0]) < 1e-4 && (fl[i * 4 + 3] ?? 0) > 0.5)
        after.push(pos[i * 3] ?? 0);
    expect(after).toHaveLength(DASH_AFTERIMAGES);
    for (const x of after) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(4);
    }

    // Festival Flare keeps its lantern flight to the aim point.
    l.update(frame(scene, 4, eventsOf([[SimEventType.RiteCast, 5, 5, 0, 0]])));
    l.update(frame(scene, 4.1));
    expect(flights()).toBe(1);
  });

  it('draws crits with the cyan 4x6 digit set', () => {
    const crit = anim('fx-digits', 'crit').map((f) => f.x);
    const critHit = eventsOf([[SimEventType.EnemyDamaged, 3, 3, 7, 1 | (0 << DAMAGE_RANK_SHIFT)]]);
    layers.update(frame(scene, 1, critHit));
    const rects = attr(effects, 'iRect');
    const xs: number[] = [];
    for (let i = 0; i < count(effects); i++) xs.push(rects[i * 4] ?? -1);
    expect(xs).toContain(crit[7]);
  });

  it('caps damage numbers on screen', () => {
    const many = eventsOf(
      Array.from(
        { length: 40 },
        (_, i) => [SimEventType.EnemyDamaged, i * 0.3 - 6, 3, 5, 0] as const,
      ),
    );
    layers.update(frame(scene, 1, many));
    const digitsW = anim('fx-digits', 'normal')[5]?.w ?? 0;
    const rects = attr(effects, 'iRect');
    const normal5 = anim('fx-digits', 'normal')[5]?.x;
    let glyphs = 0;
    for (let i = 0; i < count(effects); i++) if (rects[i * 4] === normal5) glyphs++;
    expect(digitsW).toBeGreaterThan(0);
    expect(glyphs).toBe(24);
  });

  it('drops damage numbers when the setting is off and expires them after their life', () => {
    layers.update(frame(scene, 1, scene.events[0]));
    const withNumbers = count(effects);
    layers.update(frame(scene, 2));
    const without = count(effects);
    expect(withNumbers - without).toBe(4 + 9);
    layers.applySettings(settings(false));
    layers.update(frame(scene, 3, scene.events[1]));
    // Only the sparks of the new hits (3 each, one crit with 5) remain.
    expect(count(effects)).toBe(without + 3 + 5 + 3);
  });

  it('sends line shots through dir4 and keeps instances on whole frames', () => {
    layers.update(frame(scene, 1));
    const rects = attr(effects, 'iRect');
    const off = attr(effects, 'iOff');
    for (let i = 0; i < count(effects); i++) {
      expect(Number.isInteger(rects[i * 4])).toBe(true);
      expect(Number.isInteger(off[i * 4 + 2])).toBe(true);
      expect(Number.isInteger(off[i * 4 + 3])).toBe(true);
      expect(rects[i * 4 + 2]).toBeGreaterThan(0);
    }
  });
});
