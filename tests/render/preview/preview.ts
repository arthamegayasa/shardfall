// Visual preview of the entity render (AD, M1-05, M2-03): the real renderer and art on a fake WorldView.
// Served by tests/render/preview/capture.ts (Vite, mode test) and screenshotted with Playwright.
// Timeline (render seconds): 9.80 Rite cast toward the Rite zone, 10.00 level up, 10.15 one swarmer
// dies (dissolve, shards, motes), 10.05 and 10.25 damage events (one crit). Shot taken at 10.30, so
// the Rite landing ring, rising level sparkles, the breaking swarmer, and fresh numbers are on screen.
// 10.27 (redesign 1.1): Arc Blade sweeps toward a hit, Chain Spark jumps hero -> Warden -> shooter, and
// Sky Splinter fires: the arc cone, chain lines, and muzzle flashes in each weapon's light are on screen.

import {
  DAMAGE_HIT_KIND_SHIFT,
  encodeSource,
  HitKind,
  SimEventType,
  SourceKind,
} from '../../../src/core/index.ts';
import type { ArenaDef } from '../../../src/core/index.ts';
import arenaMarket from '../../../content/levels/arena_market.json';
import { loadArtAssets } from '../../../src/app/assets.ts';
import { defaultSettings } from '../../../src/app/settings.ts';
import { createRenderer } from '../../../src/render/index.ts';
import { createPreviewScene, eventsOf, NO_EVENTS, PREVIEW_DATA, W } from '../fake-scene.ts';

declare global {
  interface Window {
    __previewDone?: boolean;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('canvas#game');
if (canvas === null) throw new Error('canvas missing');
const renderer = createRenderer(canvas, loadArtAssets(), PREVIEW_DATA);
const dpr = window.devicePixelRatio;
renderer.resize(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr));
renderer.applySettings(defaultSettings(false));
// The real slice arena and biome light (LP environment, lantern lights), so sprites are lit as in game.
renderer.setArena(arenaMarket as unknown as ArenaDef, 'biome_market');
const scene = createPreviewScene();
// The renderer coalesces renders closer than a few ms (and drops their events for entities), so each
// timeline step waits a little before rendering.
const draw = async (t: number, events = NO_EVENTS): Promise<void> => {
  await new Promise((r) => setTimeout(r, 12));
  renderer.render({ view: scene.world, alpha: 1, events, timeSec: t });
};
await draw(9.8, eventsOf([[SimEventType.RiteCast, -3, -3.4, 0, 0]]));
await draw(10.0, eventsOf([[SimEventType.PlayerLeveledUp, 0, 0, 3, 0]]));
await draw(10.05, scene.events[0]);
// Swarmer slot 3 dies: its last frame dissolves where it stood.
(scene.world.enemies as unknown as { alive: Uint8Array }).alive[3] = 0;
await draw(10.15);
await draw(10.25, scene.events[1]);
const melee = HitKind.Melee << DAMAGE_HIT_KIND_SHIFT;
const chainHit = HitKind.Chain << DAMAGE_HIT_KIND_SHIFT;
const arcSrc = encodeSource(SourceKind.Weapon, W.arc);
const chainSrc = encodeSource(SourceKind.Weapon, W.spark);
await draw(
  10.27,
  eventsOf([
    [SimEventType.EnemyDamaged, -1.6, 2.2, 14, melee, arcSrc],
    [SimEventType.WeaponFired, 0, 1, W.arc, 1, 0],
    [SimEventType.EnemyDamaged, 6, 4.5, 8, chainHit, chainSrc],
    [SimEventType.EnemyDamaged, 9.5, -2, 8, chainHit, chainSrc],
    [SimEventType.WeaponFired, 0, 1, W.spark, 1, 1],
    [SimEventType.WeaponFired, 0, 1, W.splinter, 1, 2],
  ]),
);
await draw(10.3);
window.__previewDone = true;
