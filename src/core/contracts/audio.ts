// Audio system (architecture.md 6.8, 11). [Frozen M1] Implemented by AU in src/audio.

import type { GameData } from '../../content/game-data.ts';
import type { ArenaDef } from './arena.ts';
import type { SimEventReader } from './events.ts';
import type { Settings } from './settings.ts';
import type { WorldView } from './world-view.ts';

export type { VolumeSettings } from './settings.ts';

export interface AudioSystem {
  /** Must be called from a user gesture (autoplay policy). */
  unlock(): Promise<void>;
  /** Called every frame. Maps events to cues and drives adaptive music from view. */
  update(view: WorldView, events: SimEventReader, dtSec: number): void;
  playUi(cueId: string): void;
  applySettings(s: Settings['audio']): void;
  /** Arena bounds for worldX panning (audio-direction 8.6). */
  setArena(arena: ArenaDef): void;
  setPaused(paused: boolean): void;
  /** Tab hidden or window unfocused; AU suspends when muteWhenUnfocused. */
  setHidden(hidden: boolean): void;
  dispose(): void;
}

/**
 * Factory signature of src/audio (AU). Creates no AudioContext until unlock(). data maps event
 * payload indices to ids for the cue map (architecture 11 and 19, M1-01).
 */
export type CreateAudio = (data: GameData) => AudioSystem;
