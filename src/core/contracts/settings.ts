// Player settings, persisted by app as shardfall.settings.v1 (architecture.md 6.11, 12). [Frozen M1]
// Defaults live in src/app/settings.ts.

/** Integer 0..100 per bus. AU applies gain = (v / 100) ^ 2. */
export interface VolumeSettings {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly ui: number;
}

export type ActionId =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'rite'
  | 'pause'
  | 'confirm'
  | 'back'
  | 'reroll'
  | 'lock'
  | 'beginPulse'
  | 'stats'
  | 'merge'
  | 'sell';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type ColorVisionMode = 'off' | 'protan' | 'deutan' | 'tritan';

export interface Settings {
  readonly v: 1;
  readonly graphics: {
    readonly quality: GraphicsQuality;
    /** 0..100, multiplies shake amplitude. */
    readonly screenShake: number;
    readonly fullscreen: boolean;
  };
  readonly audio: VolumeSettings & {
    readonly mono: boolean;
    readonly reduceRepeats: boolean;
    readonly muteWhenUnfocused: boolean;
  };
  readonly access: {
    /** Normal, Large, Largest. */
    readonly textScale: 0 | 1 | 2;
    readonly reduceEffects: boolean;
    readonly damageNumbers: boolean;
    readonly colorVision: ColorVisionMode;
    readonly pauseWhenUnfocused: boolean;
    readonly showFlavor: boolean;
    readonly solidPanels: boolean;
    /** Unused while the shop is untimed (GDD 12). */
    readonly shopTimer: 'on' | 'off' | 'extended';
  };
  /** KeyboardEvent.code values, two bindings per action, null = empty. */
  readonly keybinds: Readonly<Record<ActionId, readonly [string | null, string | null]>>;
  /**
   * The How to play screen was shown (UI 1.1, additive): it opens once by itself before the first
   * run. Saves from 1.0 lack the field and load as false (src/app/settings.ts).
   */
  readonly seenHowTo: boolean;
}
