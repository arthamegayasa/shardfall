// Screen interface and the shared context every screen receives from ui-root.

import type { AppScreen, ScreenId, UiDeps } from '../../core/dom.ts';
import type { ActionId, Settings, SimEventReader, WorldView } from '../../core/index.ts';
import type { FocusList } from '../focus.ts';
import type { IconArt } from '../icons.ts';
import type { TranslateFn } from '../strings.ts';

export interface UiContext {
  readonly doc: Document;
  readonly deps: UiDeps;
  readonly t: TranslateFn;
  /** True when the string table has the key (optional lines such as epithets and Glazier lines). */
  readonly has: (key: string) => boolean;
  /** AD icons and portraits from UiDeps.art, rasterized once. */
  readonly icons: IconArt;
  /** UI cue id from docs/audio-list.md 9 (ui-spec 8.5). ui.focus is throttled. */
  sound(cueId: string): void;
  /** Screen reader announcement (live region, ui-spec 9). */
  announce(text: string): void;
  /** UI-owned navigation between menu screens (title, class select, settings back). */
  go(screen: AppScreen): void;
  /** App screen that was active before the current one (settings Back). */
  previous(): AppScreen;
  /** Input lock when a choice screen appears (ui-spec 8.4). */
  lockInput(ms: number): void;
  inputLocked(): boolean;
  /**
   * True inside enter() when the screen is shown again after a menu it opened (pause, settings,
   * The Keeping): the screen keeps its last focus instead of the initial one (ui-spec 8.2).
   */
  returning(): boolean;
  /** Latest WorldView (still valid while the loop is held, e.g. on the pause screen). */
  view(): WorldView | null;
  /** True when the key event matches one of the action's two bindings. */
  matches(action: ActionId, e: KeyboardEvent): boolean;
  /** Label of the action's first binding, for key hints. */
  keyHint(action: ActionId): string;
  newFocusList(): FocusList;
  /** Tier label (ui.tier.N), or the digit while the string table lacks the key. */
  tier(n: number): string;
  /** Save and apply new settings (AppActions.applySettings) and refresh UI scale and classes. */
  applySettings(s: Settings): void;
  /** Abandon dialog state on the pause screen (activeScreenId 'confirm'). */
  setConfirmOpen(open: boolean): void;
  /** What happened between the last Pulse and this Glazier visit (picks the Glazier line). */
  visit(): VisitFlags;
}

export interface VisitFlags {
  /** A Warden or boss reward was shown since the last Pulse. */
  readonly sawReward: boolean;
  /** A Temper choice was shown since the last Pulse. */
  readonly sawTemper: boolean;
}

export interface Screen {
  readonly el: HTMLElement;
  /** Focus list for arrows, Tab, confirm. Null for the HUD. */
  readonly focus: FocusList | null;
  /** Build or refresh DOM when the screen becomes active. */
  enter(id: ScreenId): void;
  /** Every frame while active. Must not allocate when nothing changed. */
  update?(view: WorldView, events: SimEventReader): void;
  /** Screen shortcuts. Return true when handled. */
  key?(e: KeyboardEvent): boolean;
  /** Back action (Esc, Backspace). */
  back?(): void;
  leave?(): void;
}

/** Input lock durations (ui-spec 8.4). */
export const CHOICE_LOCK_MS = 300;
export const RUN_END_LOCK_MS = 500;
