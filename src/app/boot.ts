// Composition root (architecture.md 3, 5). LP only: wires data, sim, renderer, UI, audio, input, loop,
// autosave, meta, and the resume countdown. Test hooks are loaded with a dynamic import behind
// __E2E__, so production builds never contain them.

import {
  assert,
  createRngStreams,
  FRAME_EVENT_CAPACITY,
  FRAME_EVENT_CAPACITY_E2E,
  MAX_TICKS_PER_FRAME,
  MAX_TICKS_PER_FRAME_E2E,
  STORAGE_KEYS,
} from '../core/index.ts';
import type { Command, CommandSink, MetaSave, Settings, StringTable } from '../core/index.ts';
import type { AppActions, MetaView, Renderer, Ui } from '../core/dom.ts';
import {
  applyUnlock,
  buildGameData,
  defaultRunProfile,
  formatString,
  GAME_DATA_FORMAT,
  isClassOpen,
  ownedUnlockIds,
} from '../content/index.ts';
import type { GameData, RawGameData } from '../content/index.ts';
import { createSim } from '../sim/index.ts';
import { createRenderer } from '../render/index.ts';
import { createUi } from '../ui/index.ts';
import { loadArtAssets } from './assets.ts';
import { createInputSource } from './input/input.ts';
import { createLazyAudio } from './lazy-audio.ts';
import { createLogger } from './logger.ts';
import { createLoop } from './loop.ts';
import type { GameLoop } from './loop.ts';
import { loadMeta, metaAfterRun, saveMeta, defaultMeta } from './meta/meta-store.ts';
import { createReplayRecorder } from './replay.ts';
import type { ReplayRecorder } from './replay.ts';
import { createRunWatch } from './run-watch.ts';
import { clearRunSave, hasRunSave, readRunSave, writeRunSave } from './save/run-save.ts';
import { defaultSettings, loadSettings, saveSettings } from './settings.ts';
import { createStorage } from './storage.ts';

const gameDataModules = import.meta.glob('../../content/generated/game-data.json', {
  eager: true,
  import: 'default',
});
const stringModules = import.meta.glob('../../content/generated/strings.json', {
  eager: true,
  import: 'default',
});
/** Indonesian table (WR), loaded lazily only for ?lang=id; missing keys fall back to English. */
const idStringModules = import.meta.glob('../../content/strings/id.json', { import: 'default' });

const log = createLogger('app');

/** Resume countdown after pause during a Pulse: 3, 2, 1 over 900 ms (ui-spec S06). */
const COUNTDOWN_STEPS = 3;
const COUNTDOWN_STEP_MS = 300;
/** Latest time after boot to start loading the audio chunk when the page never goes idle. */
const AUDIO_PREFETCH_MS = 2000;

export type HoldReason = 'user' | 'hidden' | 'e2e' | 'countdown';

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
  readonly app: AppActions;
  /** The loop runs only while no hold is set (user pause, hidden tab, countdown, e2e driving). */
  setHold(reason: HoldReason, on: boolean): void;
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

async function loadStrings(lang: string | null): Promise<StringTable> {
  const s = Object.values(stringModules)[0];
  const en = s !== null && typeof s === 'object' ? (s as StringTable) : {};
  if (lang !== 'id') return en;
  const loader = Object.values(idStringModules)[0];
  if (loader === undefined) return en;
  try {
    const id = (await loader()) as StringTable;
    return { ...en, ...id };
  } catch (err) {
    log.warn('id strings failed to load', err);
    return en;
  }
}

/** Strings of the current boot, for reportBootFailure (English until boot has loaded them). */
let bootStrings: StringTable | null = null;

/**
 * Friendly full-screen message instead of a blank page (M5-01). Only the first one shows; the
 * page stays usable for reading and reloading.
 */
function showFatal(doc: Document, key: string): void {
  const uiRoot = doc.querySelector<HTMLElement>('#ui-root');
  if (uiRoot === null || uiRoot.querySelector('.fatal') !== null) return;
  const en: StringTable = {};
  const strings = bootStrings ?? (Object.values(stringModules)[0] as StringTable | undefined) ?? en;
  const msg = doc.createElement('p');
  msg.className = 'fatal';
  msg.setAttribute('role', 'alert');
  msg.textContent = formatString(strings, key, undefined, { dev: __DEV_TOOLS__ });
  uiRoot.appendChild(msg);
}

/** main.ts: boot threw. Show a readable message (the error itself still reaches the console). */
export function reportBootFailure(doc: Document): void {
  try {
    showFatal(doc, 'ui.error.boot');
  } catch {
    // The page is already broken; the original error is what matters.
  }
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
  const lang = new URLSearchParams(window.location.search).get('lang');
  const strings = await loadStrings(lang);
  bootStrings = strings;
  if (lang === 'id') doc.documentElement.lang = 'id';
  if (!hasWebGl2(doc)) {
    showFatal(doc, 'ui.error.webgl2');
    return;
  }

  const data = loadGameData();
  const store = createStorage();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let settings: Settings = loadSettings(store, defaultSettings(reducedMotion));
  const firstClass = data.classes[0]?.id ?? '';
  let meta: MetaSave = loadMeta(store, firstClass);
  const assets = loadArtAssets();
  const sim = createSim({ data, debugCommands: __DEV_TOOLS__ });
  let renderer: Renderer;
  try {
    renderer = createRenderer(canvas, assets, data);
  } catch (err) {
    // WebGL2 exists but the context could not be created (blocklisted GPU, lost context, limits).
    log.error('renderer could not start', err);
    showFatal(doc, 'ui.error.webgl2');
    return;
  }
  // src/audio is a lazy chunk (bundle budget, LP M2-09): loaded on the first gesture or when idle.
  const audio = createLazyAudio(data, () => import('../audio/index.ts'));
  const recorder = __DEV_TOOLS__
    ? createReplayRecorder({
        contentHash: data.meta.contentHash,
        contentTier: data.meta.contentTier,
      })
    : null;
  // Seeds for UI-started runs come from a visual-only RNG seeded once per session (never Math.random).
  const seedRng = createRngStreams(Math.floor(performance.now() * 1000) >>> 0).spawn;
  /** run.abandon was sent while paused: resume without the countdown so the end shows at once. */
  let abandonQueued = false;

  const commands: CommandSink = {
    send(cmd: Command) {
      if (cmd.type === 'run.start') recorder?.begin(cmd);
      else recorder?.recordCommand(cmd);
      if (cmd.type === 'run.abandon') abandonQueued = true;
      sim.enqueue(cmd);
    },
  };

  let ui: Ui | null = null;
  const holds = new Set<HoldReason>();
  const setHold: AppContext['setHold'] = (reason, on) => {
    if (on) holds.add(reason);
    else holds.delete(reason);
    if (holds.size === 0) loop.start();
    else loop.stop();
  };

  // Resume countdown (ui-spec S06): app state, the sim does not tick meanwhile.
  let countdownTimer = 0;
  const stopCountdown = (): void => {
    if (countdownTimer !== 0) window.clearTimeout(countdownTimer);
    countdownTimer = 0;
    ui?.setResumeCountdown(0);
    setHold('countdown', false);
  };
  const startCountdown = (): void => {
    let n = COUNTDOWN_STEPS;
    setHold('countdown', true);
    ui?.setResumeCountdown(n);
    const tickDown = (): void => {
      n--;
      if (n <= 0) {
        countdownTimer = 0;
        stopCountdown();
        return;
      }
      ui?.setResumeCountdown(n);
      countdownTimer = window.setTimeout(tickDown, COUNTDOWN_STEP_MS);
    };
    countdownTimer = window.setTimeout(tickDown, COUNTDOWN_STEP_MS);
  };

  // Run of the build's content tier (run_b since M2-09: 15 Pulses, Wardens at 4 and 10, boss at 15).
  const profile = defaultRunProfile(data);
  const startRun: AppContext['startRun'] = (opts) => {
    stopCountdown();
    clearRunSave(store);
    commands.send({
      type: 'run.start',
      seed: opts.seed >>> 0,
      classId: opts.classId,
      profile: opts.profile ?? profile,
      difficulty: opts.difficulty ?? 0,
      unlocked: ownedUnlockIds(data, meta.unlocked),
    });
    ui?.setScreen('run');
    setHold('user', false);
  };

  const app: AppActions = {
    startRun(classId, difficulty) {
      // Locked classes never start (the UI shows them as locked; this guards the action itself).
      if (!isClassOpen(data, meta.unlocked, classId)) {
        log.warn(`class ${classId} is locked`);
        return;
      }
      startRun({ seed: seedRng.nextU32(), classId, difficulty });
    },
    continueRun() {
      const saved = readRunSave(store);
      const res = saved.kind === 'ok' ? sim.load(saved.run) : null;
      if (res?.ok !== true) {
        // ui.title.save_lost: shown by the title once UI has a channel for it (review M1-lp).
        log.warn(
          `autosave could not be restored (${saved.kind}${res === null ? '' : `, ${res.reason}`})`,
        );
        clearRunSave(store);
        ui?.setScreen('title');
        return;
      }
      // A continued run cannot be replayed from run.start.
      recorder?.stop();
      watch.reset();
      ui?.setScreen('run');
      setHold('user', false);
    },
    pause() {
      stopCountdown();
      setHold('user', true);
      audio.setPaused(true);
      ui?.setScreen('paused');
    },
    resume() {
      audio.setPaused(false);
      ui?.setScreen('run');
      const countdown = sim.view.phase === 'pulse' && !abandonQueued;
      if (countdown) startCountdown();
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
    unlock(unlockId) {
      // Silt unlock (GDD 17.2, ui-spec S09): pure rule in src/sim/meta, stored at once.
      const next = applyUnlock(data, meta, unlockId);
      if (next === null) return false;
      meta = next;
      saveMeta(store, meta);
      return true;
    },
    deleteSaveData() {
      store.remove(STORAGE_KEYS.run);
      store.remove(STORAGE_KEYS.meta);
      store.remove(STORAGE_KEYS.settings);
      meta = defaultMeta(firstClass);
      app.applySettings(defaultSettings(reducedMotion));
    },
    quitToTitle() {
      stopCountdown();
      ui?.setScreen('title');
      setHold('user', false);
    },
  };

  const metaView = (): MetaView => ({
    silt: meta.silt,
    unlocked: meta.unlocked,
    mementosFound: meta.mementosFound,
    highestDifficultyWon: meta.highestDifficultyWon,
    lastClassId: meta.lastClassId,
    hasRunSave: hasRunSave(store),
    runs: meta.runs,
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
    meta: metaView,
    art: assets,
  });

  const input = createInputSource({
    target: window,
    canvas,
    settings: () => settings,
    projector: () => renderer.projector,
    playerPos: () => sim.view.player,
  });

  const watch = createRunWatch({
    sim,
    save() {
      const run = sim.save();
      if (run !== null) writeRunSave(store, run, new Date().toISOString());
    },
    onRunEnd(end) {
      abandonQueued = false;
      clearRunSave(store);
      const v = sim.view;
      meta = metaAfterRun(meta, {
        outcome: end.outcome,
        classId: data.classes[v.player.classIndex]?.id ?? meta.lastClassId,
        difficulty: v.runStats.difficulty,
        silt: end.silt,
        mementoIds: v.shop.mementos
          .map((m) => data.mementos[m.mementoIndex]?.id ?? '')
          .filter((id) => id !== ''),
      });
      saveMeta(store, meta);
    },
    onArena(index) {
      const arena = data.arenas[index];
      if (arena === undefined) return;
      const biome = data.biomes.find((b) => b.arenaId === arena.id);
      renderer.setArena(arena, biome?.id ?? '');
      audio.setArena(arena);
    },
  });

  const loop = createLoop({
    sim,
    renderer,
    ui,
    audio,
    input,
    recorder,
    afterTick: () => {
      watch.afterTick();
    },
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
  // Title background: the arena of the first Pulse until a run picks its own.
  watch.afterTick();

  // Audio unlocks on a user gesture; the listeners stay until an unlock succeeds (a failed chunk
  // load or context resume is retried by the next gesture).
  let audioUnlocked = false;
  const unlockAudio = (): void => {
    if (audioUnlocked) return;
    audio
      .unlock()
      .then(() => {
        audioUnlocked = true;
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      })
      .catch((err: unknown) => {
        log.warn('audio unlock failed', err);
      });
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  // Prefetch the audio chunk once the title is up, so the first gesture can unlock synchronously.
  const prefetchAudio = (): void => {
    audio.preload().catch((err: unknown) => {
      log.warn('audio chunk failed to load', err);
    });
  };
  if (typeof window.requestIdleCallback === 'function')
    window.requestIdleCallback(prefetchAudio, { timeout: AUDIO_PREFETCH_MS });
  else window.setTimeout(prefetchAudio, AUDIO_PREFETCH_MS);
  doc.addEventListener('visibilitychange', () => {
    audio.setHidden(doc.hidden);
    setHold('hidden', doc.hidden && settings.access.pauseWhenUnfocused);
  });

  loop.start();
  canvas.dataset['ready'] = '1';

  if (__E2E__) {
    const hooks = await import('./e2e/hooks.ts');
    // E2e flows press Title > New run > Begin on fresh storage; the first-run How to play screen
    // (UI 1.1) would sit in between. Mark it seen before the hooks exist (every helper waits for
    // them); goToScreen('how-to') still opens it.
    if (!settings.seenHowTo) app.applySettings({ ...settings, seenHowTo: true });
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
      app,
      startRun,
      setHold,
      // Test-only meta access lives inside the __E2E__ branch, so production builds drop it.
      grantSilt(amount) {
        meta = { ...meta, silt: Math.max(0, meta.silt + Math.floor(amount)) };
        saveMeta(store, meta);
      },
    });
  }
}
