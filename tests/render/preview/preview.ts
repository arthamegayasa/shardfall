// Visual preview of the entity render (AD, M1-05, M2-03): the real renderer and art on a fake WorldView.
// Served by tests/render/preview/capture.ts (Vite, mode test) and screenshotted with Playwright.
// Timeline (render seconds): 9.80 Rite cast toward the Rite zone, 10.00 level up, 10.15 one swarmer
// dies (dissolve, shards, motes), 10.05 and 10.25 damage events (one crit). Shot taken at 10.30, so
// the Rite landing ring, rising level sparkles, the breaking swarmer, and fresh numbers are on screen.

import { SimEventType } from '../../../src/core/index.ts';
import type { ArenaDef } from '../../../src/core/index.ts';
import arenaMarket from '../../../content/levels/arena_market.json';
import { loadArtAssets } from '../../../src/app/assets.ts';
import { defaultSettings } from '../../../src/app/settings.ts';
import { createRenderer } from '../../../src/render/index.ts';
import { createPreviewScene, eventsOf, NO_EVENTS, PREVIEW_DATA } from '../fake-scene.ts';

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
const draw = (t: number, events = NO_EVENTS): void => {
  renderer.render({ view: scene.world, alpha: 1, events, timeSec: t });
};
draw(9.8, eventsOf([[SimEventType.RiteCast, -3, -3.4, 0, 0]]));
draw(10.0, eventsOf([[SimEventType.PlayerLeveledUp, 0, 0, 3, 0]]));
draw(10.05, scene.events[0]);
// Swarmer slot 3 dies: its last frame dissolves where it stood.
(scene.world.enemies as unknown as { alive: Uint8Array }).alive[3] = 0;
draw(10.15);
draw(10.25, scene.events[1]);
draw(10.3);
window.__previewDone = true;
