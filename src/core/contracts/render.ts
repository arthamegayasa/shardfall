// Renderer (architecture.md 6.6, 7). [Frozen M1] DOM-facing: exported through src/core/dom.ts only.
// Implemented by LP + AD in src/render.

import type { GameData } from '../../content/game-data.ts';
import type { ArenaDef } from './arena.ts';
import type { SimEventReader } from './events.ts';
import type { PaletteDef } from './palette.ts';
import type { Settings } from './settings.ts';
import type { SpriteSheetDef } from './sprite.ts';
import type { WorldView } from './world-view.ts';

export interface RenderFrame {
  readonly view: WorldView;
  /** Interpolation factor in [0, 1). */
  readonly alpha: number;
  /** Frame events. */
  readonly events: SimEventReader;
  /** Render clock in seconds from sim tick + alpha (not wall clock) so screenshots are stable. */
  readonly timeSec: number;
}

export interface Projector {
  /** Integer world scale: one virtual pixel = pixelScale physical pixels. */
  readonly pixelScale: number;
  /** World floor position (u) to CSS pixels relative to the canvas. Writes into out. */
  worldToCss(x: number, y: number, out: { x: number; y: number }): void;
  /** CSS pixels to world floor position (u), for mouse aim. Writes into out. */
  cssToWorld(cssX: number, cssY: number, out: { x: number; y: number }): void;
}

export interface RenderAssets {
  readonly sprites: readonly SpriteSheetDef[];
  readonly palette: PaletteDef;
  readonly tiles: readonly SpriteSheetDef[];
}

export interface Renderer {
  resize(physicalWidth: number, physicalHeight: number): void;
  /** Quality, reduce effects, damage numbers, screen shake, colour vision. */
  applySettings(s: Settings): void;
  setArena(arena: ArenaDef, biomeId: string): void;
  render(frame: RenderFrame): void;
  readonly projector: Projector;
  /** renderer.info snapshot for debug overlay and getPerf. */
  stats(): { readonly drawCalls: number; readonly triangles: number };
  dispose(): void;
}

/**
 * Factory signature of src/render. data maps dense indices in WorldView and events back to ids
 * (enemy, class, weapon, effect) for sprite and VFX lookup (architecture 19, M1-01).
 */
export type CreateRenderer = (
  canvas: HTMLCanvasElement,
  assets: RenderAssets,
  data: GameData,
) => Renderer;
