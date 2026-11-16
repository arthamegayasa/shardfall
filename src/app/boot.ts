// Composition root (architecture.md 3, 5). LP only: wires data, sim, renderer, UI, audio, input, loop.
// Test hooks are loaded with a dynamic import behind __E2E__, so production builds never contain them.

import {
  assert,
  createRngStreams,
  FRAME_EVENT_CAPACITY,
  FRAME_EVENT_CAPACITY_E2E,
  MAX_TICKS_PER_FRAME,
  MAX_TICKS_PER_FRAME_E2E,
} from '../core/index.ts';
import type { Command, CommandSink, Settings, StringTable } from '../core/index.ts';
import type { AppActions, MetaView, Renderer, Ui } from '../core/dom.ts';
import { buildGameData, GAME_DATA_FORMAT } from '../content/index.ts';
import type { GameData, RawGameData } from '../content/index.ts';
import { createSim } from '../sim/index.ts';
import { createRenderer } from '../render/index.ts';
import { createUi } from '../ui/index.ts';
import { createAudio } from '../audio/index.ts';
import { loadArtAssets } from './assets.ts';
import { createInputSource } from './input/input.ts';
import { createLogger } from './logger.ts';
import { createLoop } from './loop.ts';
import type { GameLoop } from './loop.ts';
import { createReplayRecorder } from './replay.ts';
import type { ReplayRecorder } from './replay.ts';
import { defaultSettings, loadSettings, saveSettings } from './settings.ts';
import { createStorage } from './storage.ts';
import { formatString } from '../content/index.ts';

const gameDataModules = import.meta.glob('../../content/generated/game-data.json', {
  eager: true,
  import: 'default',
});
const stringModules = import.meta.glob('../../content/generated/strings.json', {
  eager: true,
  import: 'default',
});

const log = createLogger('app');

/** Profile used when the UI starts a run (M1 prototype profile, data-schema 3.20). */
const DEFAULT_PROFILE = 'run_a_m1';

export interface AppContext {
  readonly data: GameData;
  readonly strings: StringTable;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: Renderer;
  readonly ui: Ui;
  readonly loop: GameLoop;
  readonly commands: CommandSink;
  readonly recorder: ReplayRecorder | null;
  readonly sim: ReturnType<typeof createSim>;
  /** The loop runs only while no hold is set (user pause, hidden tab, e2e driving). */
  setHold(reason: 'user' | 'hidden' | 'e2e', on: boolean): void;
  startRun(opts: {
    readonly seed: number;
    readonly classId: string;
    readonly profile?: string;
    readonly difficulty?: number;
  }): void;
}

function loadGameData(): GameData {
  const raw = Object.values(gameDataModules)[0] as RawGameData | undefined;
  assert(
    raw !== undefined && (raw.format as string) === GAME_DATA_FORMAT,
    'content/generated/game-data.json missing or invalid; run npm run data',
  );
  if (raw.missingTables.length > 0)
    log.warn(`data tables missing: ${raw.missingTables.join(', ')}`);
  return buildGameData(raw, { freeze: __DEV_TOOLS__ });
}

function loadStrings(): StringTable {
  const s = Object.values(stringModules)[0];
  return s !== null && typeof s === 'object' ? (s as StringTable) : {};
}

function hasWebGl2(doc: Document): boolean {
  try {
    return doc.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

export async function boot(doc: Document): Promise<void> {
  const canvas = doc.querySelector<HTMLCanvasElement>('#game');
  const uiRoot = doc.querySelector<HTMLElement>('#ui-root');
  assert(canvas !== null && uiRoot !== null, 'index.html must contain #game and #ui-root');
  const strings = loadStrings();
  if (!hasWebGl2(doc)) {
    const msg = doc.createElement('p');
    msg.className = 'fatal';
    msg.textContent = formatString(strings, 'ui.error.webgl2', undefined, { dev: __DEV_TOOLS__ });
    uiRoot.appendChild(msg);
    return;
  }

  const data = loadGameData();
  const store = createStorage();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let settings: Settings = loadSettings(store, defaultSettings(reducedMotion));
  const assets = loadArtAssets();
  const sim = createSim({ data, debugCommands: __DEV_TOOLS__ });
  const renderer = createRenderer(canvas, assets, data);
  const audio = createAudio(data);
  const recorder = __DEV_TOOLS__
    ? createReplayRecorder({
        contentHash: data.meta.contentHash,
        contentTier: data.meta.contentTier,
      })
    : null;
  // Seeds for UI-started runs come from a visual-only RNG seeded once per session (never Math.random).
  const seedRng = createRngStreams(Math.floor(performance.now() * 1000) >>> 0).spawn;

  const commands: CommandSink = {
    send(cmd: Command) {
      if (cmd.type === 'run.start') recorder?.begin(cmd, sim.view.tick);
      else recorder?.recordCommand(sim.view.tick, cmd);
      sim.enqueue(cmd);
    },
  };

  let ui: Ui | null = null;
  const holds = new Set<string>();
  const setHold: AppContext['setHold'] = (reason, on) => {
    if (on) holds.add(reason);
    else holds.delete(reason);
    if (holds.size === 0) loop.start();
    else loop.stop();
  };
  const startRun: AppContext['startRun'] = (opts) => {
    commands.send({
      type: 'run.start',
      seed: opts.seed >>> 0,
      classId: opts.classId,
      profile: opts.profile ?? DEFAULT_PROFILE,
      difficulty: opts.difficulty ?? 0,
    });
    ui?.setScreen('run');
  };

  const app: AppActions = {
    startRun(classId, difficulty) {
      startRun({ seed: seedRng.nextU32(), classId, difficulty });
    },
    continueRun() {
      // TODO(LP, M1-09): load shardfall.run.v1 through sim.load().
    },
    pause() {
      setHold('user', true);
      audio.setPaused(true);
      ui?.setScreen('paused');
    },
    resume() {
      // TODO(LP, M1-09): 900 ms countdown before ticking (ui-spec S06).
      audio.setPaused(false);
      ui?.setScreen('run');
      setHold('user', false);
    },
    openSettings() {
      ui?.setScreen('settings');
    },
    openArchive() {
      ui?.setScreen('archive');
    },
    applySettings(s) {
      settings = s;
      saveSettings(store, s);
      renderer.applySettings(s);
      audio.applySettings(s.audio);
    },
    unlock() {
      // TODO(LP, M3): meta unlocks (content tier B).
      return false;
    },
    deleteSaveData() {
      // TODO(LP, M1-09): clear run, meta, settings keys.
    },
    quitToTitle() {
      ui?.setScreen('title');
    },
  };

  const meta = (): MetaView => ({
    silt: 0,
    unlocked: [],
    mementosFound: [],
    highestDifficultyWon: -1,
    lastClassId: data.classes[0]?.id ?? '',
    hasRunSave: false,
  });

  ui = createUi({
    root: uiRoot,
    strings,
    data,
    commands,
    app,
    projector: renderer.projector,
    sound: {
      play: (cueId) => {
        audio.playUi(cueId);
      },
    },
    settings: () => settings,
    meta,
    art: assets,
  });

  const input = createInputSource({
    target: window,
    canvas,
    settings: () => settings,
    projector: () => renderer.projector,
    playerPos: () => sim.view.player,
  });

  const loop = createLoop({
    sim,
    renderer,
    ui,
    audio,
    input,
    recorder,
    maxTicksPerFrame: __E2E__ ? MAX_TICKS_PER_FRAME_E2E : MAX_TICKS_PER_FRAME,
    frameEventCapacity: __E2E__ ? FRAME_EVENT_CAPACITY_E2E : FRAME_EVENT_CAPACITY,
    now: () => performance.now(),
  });

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    renderer.resize(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr));
  };
  window.addEventListener('resize', resize);
  resize();
  renderer.applySettings(settings);
  audio.applySettings(settings.audio);

  const unlockAudio = (): void => {
    audio.unlock().catch((err: unknown) => {
      log.warn('audio unlock failed', err);
    });
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  doc.addEventListener('visibilitychange', () => {
    audio.setHidden(doc.hidden);
    setHold('hidden', doc.hidden && settings.access.pauseWhenUnfocused);
  });

  loop.start();
  canvas.dataset['ready'] = '1';

  if (__E2E__) {
    const hooks = await import('./e2e/hooks.ts');
    hooks.installE2eHooks({
      data,
      strings,
      canvas,
      renderer,
      ui,
      loop,
      commands,
      recorder,
      sim,
      startRun,
      setHold,
    });
  }
}
