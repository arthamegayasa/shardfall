// Entity layers over a fake WorldView (AD, M1-05): every M1 entity becomes an instance in the right layer,
// the player turns toward its motion, hit flash and damage numbers follow the view and events.
// Runs three.js objects in Node (no WebGL context needed: only buffers are filled).

import { DataTexture } from 'three';
import type { InstancedBufferAttribute, InstancedBufferGeometry, Mesh } from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Settings } from '../../src/core/index.ts';
import type { RenderFrame } from '../../src/core/dom.ts';
import { createEntityLayers } from '../../src/render/sprites/entity-layers.ts';
import type { EntityLayers } from '../../src/render/sprites/entity-layers.ts';
import { createPreviewScene, playerOf, PREVIEW_DATA } from './fake-scene.ts';
import type { PreviewScene } from './fake-scene.ts';
import { loadArtFixture, NO_EVENTS } from './support.ts';

const art = await loadArtFixture();
const texture = new DataTexture(new Uint8Array(4), 1, 1);

const count = (m: Mesh | undefined): number =>
  (m?.geometry as InstancedBufferGeometry | undefined)?.instanceCount ?? -1;
const attr = (m: Mesh | undefined, name: string): Float32Array =>
  ((m?.geometry as InstancedBufferGeometry).getAttribute(name) as InstancedBufferAttribute)
    .array as Float32Array;

const settings = (damageNumbers: boolean): Settings =>
  ({ access: { damageNumbers } }) as unknown as Settings;

function frame(scene: PreviewScene, timeSec: number, events = NO_EVENTS): RenderFrame {
  return { view: scene.world, alpha: 1, events, timeSec };
}

let layers: EntityLayers;
let scene: PreviewScene;
beforeEach(() => {
  layers = createEntityLayers(texture, art.manifest, art.palette, PREVIEW_DATA);
  layers.resize({ pixelScale: 3, width: 640, height: 360, originX: 0, originY: 0 });
  scene = createPreviewScene();
});

describe('entity layers', () => {
  it('fills every layer from the fake world', () => {
    layers.update(frame(scene, 1, scene.events[0]));
    const [zones, actors, effects] = layers.sceneObjects as Mesh[];
    const [danger, dangerSprites] = layers.dangerObjects as Mesh[];
    const w = scene.world;
    // L2: player + alive enemies + Glint.
    expect(count(actors)).toBe(1 + w.enemies.highWater + w.pickups.highWater);
    // L3: player shots + 2 burning Unlit + damage glyphs (6, 14, 8 -> 1 + 2 + 1).
    expect(count(effects)).toBe(w.playerShots.highWater + 2 + 4);
    // Areas: 4 telegraphs + 3 spawn rings (L4), 1 player zone (L3).
    expect(count(danger)).toBe(4 + 3);
    expect(count(zones)).toBe(1);
    // L4 sprites: 3 spawn cracks + 4 enemy shots.
    expect(count(dangerSprites)).toBe(3 + 4);
    expect(layers.overflow()).toBe(0);
  });

  it('turns the player toward horizontal motion and keeps it while standing', () => {
    const actors = layers.sceneObjects[1] as Mesh;
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

  it('uses the walk cycle while moving and idle while standing', () => {
    const actors = layers.sceneObjects[1] as Mesh;
    const walk = art.manifest.sprites['kept-lantern']?.animations['walk']?.frames ?? [];
    const idle = art.manifest.sprites['kept-lantern']?.animations['idle']?.frames ?? [];
    layers.update(frame(scene, 0));
    expect(attr(actors, 'iRect')[0]).toBe(walk[0]?.x);
    playerOf(scene.world).prevX = scene.world.player.x;
    layers.update(frame(scene, 0));
    expect(attr(actors, 'iRect')[0]).toBe(idle[0]?.x);
  });

  it('flashes hit Unlit with bone and leaves others unflashed', () => {
    layers.update(frame(scene, 1));
    const actors = layers.sceneObjects[1] as Mesh;
    const flash = attr(actors, 'iFlash');
    // Instance 0 is the player; enemy slot i is instance i + 1. Slot 2 has hitFlashTicks.
    expect(flash[(2 + 1) * 4 + 3]).toBe(1);
    expect(flash[(0 + 1) * 4 + 3]).toBe(0);
    expect(flash[0 * 4 + 3]).toBe(0);
  });

  it('drops damage numbers when the setting is off and expires them after their life', () => {
    const effects = layers.sceneObjects[2] as Mesh;
    const shots = scene.world.playerShots.highWater + 2;
    layers.update(frame(scene, 1, scene.events[0]));
    expect(count(effects)).toBe(shots + 4);
    layers.update(frame(scene, 2));
    expect(count(effects)).toBe(shots);
    layers.applySettings(settings(false));
    layers.update(frame(scene, 3, scene.events[1]));
    expect(count(effects)).toBe(shots);
  });

  it('sends line shots through dir4 and keeps instances on whole frames', () => {
    layers.update(frame(scene, 1));
    const effects = layers.sceneObjects[2] as Mesh;
    const rects = attr(effects, 'iRect');
    for (let i = 0; i < count(effects); i++) {
      expect(Number.isInteger(rects[i * 4])).toBe(true);
      expect(rects[i * 4 + 2]).toBeGreaterThan(0);
    }
  });
});
