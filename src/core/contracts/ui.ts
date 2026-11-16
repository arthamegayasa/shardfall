// DOM UI (architecture.md 6.7). [Frozen M1] DOM-facing: exported through src/core/dom.ts only.
// Implemented by UI in src/ui.

import type { GameData } from '../../content/game-data.ts';
import type { CommandSink } from './commands.ts';
import type { SimEventReader } from './events.ts';
import type { Projector, RenderAssets } from './render.ts';
import type { Settings } from './settings.ts';
import type { StringTable } from './strings.ts';
import type { WorldView } from './world-view.ts';

export type AppScreen =
  'title' | 'classSelect' | 'run' | 'paused' | 'settings' | 'runEnd' | 'archive' | 'credits';

/** Test and DOM ids per ui-spec 3 (data-screen attribute). */
export type ScreenId =
  | 'title'
  | 'class-select'
  | 'pulse'
  | 'level-up'
  | 'warden-reward'
  | 'glazier'
  | 'pause'
  | 'confirm'
  | 'settings'
  | 'run-end'
  | 'archive'
  | 'credits';

export interface AppActions {
  /** App picks seed and profile. */
  startRun(classId: string, difficulty: number): void;
  continueRun(): void;
  pause(): void;
  resume(): void;
  openSettings(): void;
  openArchive(): void;
  /** Also handles fullscreen (user gesture). */
  applySettings(s: Settings): void;
  /** Meta, content tier B. */
  unlock(unlockId: string): boolean;
  deleteSaveData(): void;
  quitToTitle(): void;
}

/** K11, forwarded by app to AudioSystem.playUi. */
export interface UiSound {
  play(cueId: string): void;
}

export interface MetaView {
  readonly silt: number;
  /** meta_unlocks ids and class ids. */
  readonly unlocked: readonly string[];
  readonly mementosFound: readonly string[];
  /** -1 when none. */
  readonly highestDifficultyWon: number;
  readonly lastClassId: string;
  readonly hasRunSave: boolean;
  /**
   * Runs finished on this device (MetaSave.runs). Additive M2-09: the HUD shows the control hint
   * only in the first run. Optional so older fakes stay valid; undefined reads as 0.
   */
  readonly runs?: number;
}

export interface UiDeps {
  readonly root: HTMLElement;
  readonly strings: StringTable;
  readonly data: GameData;
  readonly commands: CommandSink;
  readonly app: AppActions;
  readonly projector: Projector;
  readonly sound: UiSound;
  readonly settings: () => Settings;
  readonly meta: () => MetaView;
  /** Pixel art for icons and portraits, rasterized by src/core/sprite. */
  readonly art: RenderAssets;
}

export interface Ui {
  setScreen(screen: AppScreen): void;
  /** Called every frame. reward, levelUp, shop screens derive from view.phase. */
  update(view: WorldView, events: SimEventReader): void;
  /**
   * Resume countdown after pause during a Pulse (ui-spec S06): 3, 2, 1 shown in the timer slot,
   * 0 hides it. The loop is held meanwhile, so update() is not called. M1-09a, additive.
   */
  setResumeCountdown(n: number): void;
  readonly activeScreenId: ScreenId;
  dispose(): void;
}

/** Factory signature of src/ui. */
export type CreateUi = (deps: UiDeps) => Ui;
