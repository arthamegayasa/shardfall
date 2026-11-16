// Visual preview of the M1 entity render (AD, M1-05): the real renderer and art on a fake WorldView.
// Served by tests/render/preview/capture.ts (Vite, mode test) and screenshotted with Playwright.

import { loadArtAssets } from '../../../src/app/assets.ts';
import { defaultSettings } from '../../../src/app/settings.ts';
import { createRenderer } from '../../../src/render/index.ts';
import { createPreviewScene, NO_EVENTS, PREVIEW_DATA } from '../fake-scene.ts';

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
const scene = createPreviewScene();
// Two frames of hits 0.25 s apart, so older numbers have risen when the shot is taken.
renderer.render({ view: scene.world, alpha: 1, events: scene.events[0], timeSec: 10 });
renderer.render({ view: scene.world, alpha: 1, events: scene.events[1], timeSec: 10.25 });
renderer.render({ view: scene.world, alpha: 1, events: NO_EVENTS, timeSec: 10.3 });
window.__previewDone = true;
