// AudioSystem implementation (architecture 6.8, 11). Listener only: reads WorldView and frame
// events, never writes sim state, so the sim hash is identical with audio on or off (AU A-8).

import { TICK_RATE, createRng } from '../core/index.ts';
import type { ArenaDef, AudioSystem, Settings, WorldView } from '../core/index.ts';
import type { GameData } from '../content/index.ts';
import type { CueDef, CueTable } from './cue-data.ts';
import { bootRenderOrder, liveLengthMs, parseCueTable, parseInstruments } from './cue-data.ts';
import { DUCK_TARGET_COUNT, createDucker } from './ducking.ts';
import type { DuckTarget } from './ducking.ts';
import { createGraph, createSfxPlayer, rampTo } from './engine.ts';
import type { Graph, PlayRequest, SfxPlayer } from './engine.ts';
import { createEventMap, liveWarmupPairs } from './event-map.ts';
import type { EventMap, Routes } from './event-map.ts';
import { DEFAULT_PAN_BOUNDS, coalesceBoostDb, panBoundsOf, panForX, volumeToGain } from './mix-math.ts';
import type { PanBounds } from './mix-math.ts';
import {
  RISER_CUE,
  SONG_END,
  SONG_OVERLAY,
  SONG_PULSE,
  SONG_SHOP,
  SONG_TITLE,
  createPressureLatch,
  levelFor,
  riserDue,
  songFor,
} from './music-director.ts';
import { createMusicPlayer, createSampleBank } from './music-player.ts';
import type { MusicPlayer, SampleBank } from './music-player.ts';
import { compileSong } from './music/song.ts';
import type { CompiledSong } from './music/song.ts';
import { createMainThreadRenderer } from './render-jobs.ts';
import type { BufferRenderer, RenderJob } from './render-jobs.ts';
import { dbToGain, semisToRatio } from './synth/index.ts';
import { createTriggerList } from './triggers.ts';

/** Raw data files, injected so tests and tools can build the system without Vite JSON imports. */
export interface AudioData {
  readonly cues: unknown;
  readonly routes: unknown;
  readonly instruments: unknown;
  readonly songs: readonly unknown[];
}

/** Platform hooks: the browser defaults, replaceable in tests (fake context, no worker). */
export interface AudioEnv {
  readonly createContext?: () => AudioContext;
  /** Off-thread renderer (Web Worker); null or a throw falls back to the main thread. */
  readonly createRenderer?: () => BufferRenderer | null;
}

const LOW_HP_CUE = 'sfx.player.lowhp';
const LOW_HP_PERIOD_SEC = 1.0;
const DEFEAT_RATE = 0.7;
const DEFEAT_LOWPASS_HZ = 300;
const PAUSE_LOWPASS_HZ = 800;
const PAUSE_MUSIC_DB = -6;
/** Song fades in seconds (audio-direction 6.1). */
const FADE_IN: Readonly<Record<string, number>> = { [SONG_SHOP]: 2, [SONG_TITLE]: 1.5, [SONG_END]: 2 };
const FADE_OUT: Readonly<Record<string, number>> = { [SONG_SHOP]: 0.6, [SONG_TITLE]: 1, [SONG_END]: 1 };
/** Loop cut when a Pulse ends: short, pad and reverb ring on (audio-direction 6.4). */
const LOOP_CUT_SEC = 0.08;
/** Duck gains only move when the target changes by more than this (no per-frame automation). */
const DUCK_EPS_DB = 0.05;
const AUDIO_SEED = 0x5f17a0d1;

function ignore(): void {
  // Intentionally empty: see call sites.
}

interface Live {
  readonly graph: Graph;
  readonly sfx: SfxPlayer;
  readonly bank: SampleBank;
  readonly music: MusicPlayer;
  readonly renderer: BufferRenderer;
  readonly fallback: BufferRenderer;
}

export function createAudioSystem(data: GameData, files: AudioData, env: AudioEnv = {}): AudioSystem {
  // Data is parsed and cross-checked at boot: bad audio data fails fast (coding-standards 7).
  const cues: CueTable = parseCueTable(files.cues);
  const instruments = parseInstruments(files.instruments);
  const known = new Set(instruments.keys());
  const songs = new Map<string, CompiledSong>();
  const stingerIds: string[] = [];
  for (const json of files.songs) {
    const errors: string[] = [];
    const song = compileSong(json, known, errors);
    if (song === null || errors.length > 0) throw new Error(`Invalid song data:\n${errors.join('\n')}`);
    songs.set(song.id, song);
    if (song.oneShot) stingerIds.push(song.id);
  }
  const stingerSongs = stingerIds.map((id) => songs.get(id));
  const overlaySong = songs.get(SONG_OVERLAY) ?? null;
  const routes = files.routes as Routes;
  const eventMap: EventMap = createEventMap(data, cues, routes, stingerIds);
  const warmup = liveWarmupPairs(data, routes);
  const triggers = createTriggerList(cues.cues.length);
  const ducker = createDucker();
  const pressure = createPressureLatch();
  const rng = createRng(AUDIO_SEED);
  const cueById = (id: string): CueDef | undefined => {
    const i = cues.indexOf.get(id);
    return i === undefined ? undefined : cues.cues[i];
  };
  const riserCue = cueById(RISER_CUE);
  const lowHpCue = cueById(LOW_HP_CUE);
  const defaultLadder = songs.get(SONG_PULSE)?.glintLadder ?? [];
  const lastDuckDb = new Float64Array(DUCK_TARGET_COUNT);
  /** Reused for every play call (no allocation per trigger). */
  const req: PlayRequest = { whenSec: 0, rate: 1, gain: 1, pan: 0, durSec: 0, offsetSec: 0 };
  const pendingLive = new Set<number>();
  const bossClock = { sinceSpawnSec: Number.NaN };

  let live: Live | null = null;
  let unlocking: Promise<void> | null = null;
  /** Context whose first resume() is still pending, and the resolver that lets a retry finish boot. */
  let resuming: { readonly ctx: AudioContext; readonly done: () => void } | null = null;
  let settings: Settings['audio'] | null = null;
  let bounds: PanBounds = DEFAULT_PAN_BOUNDS;
  let paused = false;
  let defeatFx = false;
  let defeatAt = 0;
  let lowHp = false;
  let nextLowHp = 0;
  let riserPulse = -1;
  let riserCut = false;
  let bossSpawnAt = -1;
  let bossDefeated = false;
  let stingerEndsAt = 0;
  let disposed = false;

  function applySettingsNow(l: Live): void {
    if (settings === null) return;
    const now = l.graph.ctx.currentTime;
    rampTo(l.graph.masterGain.gain, volumeToGain(settings.master), now);
    rampTo(l.graph.musicFader.gain, volumeToGain(settings.music), now);
    rampTo(l.graph.sfxFader.gain, volumeToGain(settings.sfx), now);
    rampTo(l.graph.uiFader.gain, volumeToGain(settings.ui), now);
    try {
      l.graph.ctx.destination.channelCount = settings.mono ? 1 : 2;
    } catch {
      // Some devices refuse a channel count change; per-voice pan 0 still applies.
    }
  }

  function applyPause(l: Live): void {
    const now = l.graph.ctx.currentTime;
    rampTo(l.graph.musicPause.frequency, paused ? PAUSE_LOWPASS_HZ : 20000, now, 0.05);
    rampTo(l.graph.musicPauseGain.gain, paused ? dbToGain(PAUSE_MUSIC_DB) : 1, now, 0.05);
  }

  async function renderJob(l: Live, job: RenderJob, pending: Promise<Float32Array[]> | null): Promise<Float32Array[]> {
    if (pending !== null) {
      try {
        return await pending;
      } catch {
        // Worker gone: this and later jobs render on the main thread in slices.
      }
    }
    return l.fallback.render(job);
  }

  function requestLive(cue: number, lengthMs: number): void {
    const l = live;
    const def = cues.cues[cue];
    const key = cue * 100000 + lengthMs;
    if (l === null || def === undefined || pendingLive.has(key)) return;
    pendingLive.add(key);
    const job: RenderJob = { kind: 'cue', recipe: def, sampleRate: def.sampleRate, durationMs: lengthMs };
    renderJob(l, job, l.renderer.offThread ? l.renderer.render(job) : null)
      .then((out) => {
        pendingLive.delete(key);
        const d = out[0];
        if (live === l && d !== undefined) l.sfx.addLive(cue, lengthMs, d);
      })
      .catch(ignore);
  }

  async function boot(): Promise<void> {
    const ctx = env.createContext?.() ?? new window.AudioContext({ latencyHint: 'interactive' });
    if (ctx.state !== 'running') {
      // A strict activation policy (Safari) can leave this resume() pending forever: unlock() calls
      // resume() again from the next gesture, and whichever call settles first finishes the boot.
      try {
        await new Promise<void>((resolve, reject) => {
          resuming = { ctx, done: resolve };
          ctx.resume().then(resolve, reject);
        });
      } finally {
        resuming = null;
      }
    }
    if (disposed) {
      // dispose() ran while the context was resuming: never leave a context open (LP M1 review).
      await ctx.close().catch(ignore);
      return;
    }
    const graph = createGraph(ctx);
    const renderer = offThreadRenderer();
    const fallback = createMainThreadRenderer();
    const bank = createSampleBank(ctx);
    const l: Live = {
      graph,
      sfx: createSfxPlayer(graph, cues, requestLive),
      bank,
      music: createMusicPlayer(ctx, graph.musicIn, graph.hallSend, bank),
      renderer: renderer ?? fallback,
      fallback,
    };
    live = l;
    applySettingsNow(l);
    applyPause(l);

    // Render order: UI and SFX first (title clicks, first Pulse), then reverbs and instruments.
    // A worker gets every job at once and renders off the main thread; the main thread only
    // copies finished samples into AudioBuffers (audio-direction 2.2: no frozen frames).
    type Step = { readonly job: RenderJob; readonly apply: (out: Float32Array[]) => void };
    const steps: Step[] = [];
    steps.push({
      job: { kind: 'ir', ir: 'room', sampleRate: ctx.sampleRate },
      apply: (out) => {
        graph.room.buffer = stereo(ctx, out);
      },
    });
    for (const cue of bootRenderOrder(cues)) {
      steps.push({
        job: { kind: 'cue', recipe: cue, sampleRate: cue.sampleRate, durationMs: cue.durationMs },
        apply: (out) => {
          const d = out[0];
          if (d !== undefined) l.sfx.setBuffer(cue.index, d);
        },
      });
    }
    for (const w of warmup) {
      const i = cues.indexOf.get(w.cue);
      const cue = i === undefined ? undefined : cues.cues[i];
      if (cue === undefined) continue;
      const ms = liveLengthMs(w.durSec);
      const key = cue.index * 100000 + ms;
      if (pendingLive.has(key)) continue;
      pendingLive.add(key);
      steps.push({
        job: { kind: 'cue', recipe: cue, sampleRate: cue.sampleRate, durationMs: ms },
        apply: (out) => {
          pendingLive.delete(key);
          const d = out[0];
          if (d !== undefined) l.sfx.addLive(cue.index, ms, d);
        },
      });
    }
    steps.push({
      job: { kind: 'ir', ir: 'hall', sampleRate: ctx.sampleRate },
      apply: (out) => {
        graph.hall.buffer = stereo(ctx, out);
      },
    });
    for (const def of instruments.values()) {
      const refs: readonly (number | null)[] = def.refNotes.length > 0 ? def.refNotes : [null];
      refs.forEach((ref, k) => {
        steps.push({
          job: { kind: 'instrument', def, ref },
          apply: (out) => {
            const d = out[0];
            if (d !== undefined) bank.set(def, k, d);
          },
        });
      });
    }
    const posted = l.renderer.offThread ? steps.map((s) => l.renderer.render(s.job)) : null;
    // Unhandled rejections of jobs never awaited (disposed mid-boot) are harmless.
    for (const p of posted ?? []) p.catch(ignore);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step === undefined) continue;
      const out = await renderJob(l, step.job, posted?.[i] ?? null);
      if (stale(l)) return;
      step.apply(out);
    }
  }

  /** The worker renderer, or null (no worker, or creating it threw). */
  function offThreadRenderer(): BufferRenderer | null {
    try {
      return env.createRenderer?.() ?? null;
    } catch {
      return null;
    }
  }

  /** Disposed, or a newer boot replaced l: stop rendering into it. */
  function stale(l: Live): boolean {
    return disposed || live !== l;
  }

  function pan(cue: CueDef, x: number): number {
    if (settings?.mono === true) return 0;
    if (cue.pan === 'center') return 0;
    if (cue.pan === 'worldX') return Number.isNaN(x) ? 0 : panForX(x, bounds);
    return cue.pan;
  }

  function play(l: Live, cue: CueDef, now: number, semis: number, x: number, durSec: number, delaySec: number, hits: number, offsetSec = 0): void {
    const reduce = settings?.reduceRepeats === true && cue.bus === 'sfx' && cue.priority >= 5;
    const maxVoices = reduce ? Math.max(1, Math.floor(cue.maxVoices / 2)) : cue.maxVoices;
    const jitterDb = cue.gainJitterDb > 0 ? (rng.next() * 2 - 1) * cue.gainJitterDb : 0;
    const gainDb = jitterDb + coalesceBoostDb(hits, cue.coalesceMaxBoostDb) + (reduce ? -3 : 0);
    let rate = semisToRatio(semis);
    if (cue.pitchJitter > 0) rate *= 1 + (rng.next() * 2 - 1) * cue.pitchJitter;
    if (defeatFx && cue.bus === 'sfx') rate *= DEFEAT_RATE;
    req.whenSec = now + delaySec;
    req.rate = rate;
    req.gain = dbToGain(gainDb);
    req.pan = pan(cue, x);
    req.durSec = durSec;
    req.offsetSec = offsetSec;
    const started = l.sfx.play(cue, req, maxVoices);
    if (started && cue.duck !== null) {
      ducker.trigger(cue.duck, now + delaySec, durSec > 0 ? durSec : cue.durationMs / 1000);
    }
  }

  function updateBossState(view: WorldView, now: number): void {
    const p = view.pulse;
    if (view.phase !== 'pulse' || !p.isBoss) {
      bossSpawnAt = -1;
      bossDefeated = false;
      return;
    }
    if (p.boss.active && bossSpawnAt < 0) bossSpawnAt = now;
    // The boss bar goes inactive once the boss falls; the boss song gives way to its stinger.
    if (!p.boss.active && bossSpawnAt >= 0) bossDefeated = true;
    bossClock.sinceSpawnSec = bossSpawnAt < 0 ? Number.NaN : now - bossSpawnAt;
  }

  function updateMusic(l: Live, view: WorldView, now: number): void {
    const sig = eventMap.signals;
    for (let i = 0; i < sig.stingerCount; i++) {
      const s = stingerSongs[sig.stingers[i] ?? -1];
      if (s !== undefined) stingerEndsAt = Math.max(stingerEndsAt, l.music.stinger(s));
    }
    updateBossState(view, now);
    const want = songFor(view, bossDefeated);
    const cur = l.music.currentId;
    if (want !== cur) {
      const song = want === null ? undefined : songs.get(want);
      const fadeOut = (cur === null ? undefined : FADE_OUT[cur]) ?? LOOP_CUT_SEC;
      if (song === undefined) l.music.stop(fadeOut);
      else {
        // The end loop waits for the victory or defeat stinger to ring out.
        const delay = want === SONG_END ? Math.max(0, stingerEndsAt - now - 0.5) : 0;
        l.music.play(song, FADE_IN[song.id] ?? 0, fadeOut, delay);
      }
      if (want !== SONG_PULSE) pressure.reset();
    }
    const song = want === null ? undefined : songs.get(want);
    const bossRules = song?.intensity?.boss ?? null;
    if (bossRules !== null && sig.bossPhase === 2) l.music.breakFor(bossRules.phaseBreakSec);
    l.music.setOverlay(want === SONG_PULSE && view.pulse.wardenAlive ? overlaySong : null);
    const holdBars = song?.intensity?.pressure?.holdBars ?? 0;
    const crowd = song !== undefined && pressure.active(now, song.barSec, holdBars);
    l.music.update(song === undefined ? 0 : levelFor(song, view, crowd, bossClock));
    // Riser: once per Pulse, joined late with a buffer offset so it always ends with the Pulse.
    const secs = song?.intensity?.riserSecondsBeforeEnd ?? null;
    if (riserCue !== undefined && secs !== null && riserPulse !== view.pulse.index && riserDue(view, secs)) {
      riserPulse = view.pulse.index;
      riserCut = false;
      const offset = Math.max(0, secs - view.pulse.ticksLeft / TICK_RATE);
      play(l, riserCue, now, 0, Number.NaN, 0, 0, 1, offset);
    }
    if (view.phase !== 'pulse') riserPulse = -1;
    else if (riserCue !== undefined && riserPulse === view.pulse.index && view.pulse.wardenAlive && !riserCut) {
      riserCut = true;
      l.sfx.stopCue(riserCue.index, now);
    }
  }

  /** The slow death filter lasts until the next run or a win, not just until the phase changes. */
  function isNewRunOrWin(view: WorldView, now: number): boolean {
    if (view.phase === 'idle' || view.phase === 'victory') return true;
    return view.phase === 'pulse' && view.player.hp > 0 && now - defeatAt > 1.5;
  }

  function currentLadder(l: Live): readonly number[] {
    const id = l.music.currentId;
    const song = id === null ? undefined : songs.get(id);
    return song !== undefined && song.glintLadder.length > 0 ? song.glintLadder : defaultLadder;
  }

  return {
    unlock() {
      if (disposed) return Promise.resolve();
      if (unlocking !== null && resuming !== null) {
        const r = resuming;
        r.ctx.resume().then(r.done, ignore);
      }
      unlocking ??= boot().catch((err: unknown) => {
        unlocking = null;
        throw err;
      });
      return unlocking;
    },
    update(view, events, _dtSec) {
      const l = live;
      if (l === null || l.graph.ctx.state !== 'running') return;
      const now = l.graph.ctx.currentTime;

      triggers.reset();
      eventMap.map(events, triggers, now, currentLadder(l));
      const sig = eventMap.signals;
      if (sig.lowHp >= 0) {
        lowHp = sig.lowHp === 1;
        nextLowHp = now;
      }
      if (sig.pressure >= 0) pressure.set(sig.pressure === 1, now);
      if (sig.playerDied && !defeatFx) {
        defeatFx = true;
        defeatAt = now;
        l.graph.masterLowpass.frequency.cancelScheduledValues(now);
        l.graph.masterLowpass.frequency.setValueAtTime(20000, now);
        l.graph.masterLowpass.frequency.exponentialRampToValueAtTime(DEFEAT_LOWPASS_HZ, now + 1.2);
      } else if (defeatFx && !sig.playerDied && isNewRunOrWin(view, now)) {
        defeatFx = false;
        rampTo(l.graph.masterLowpass.frequency, 20000, now, 0.1);
      }
      if (sig.telegraphSec > 0) ducker.trigger('telegraph', now, sig.telegraphSec);

      for (let i = 0; i < triggers.count; i++) {
        const cue = cues.cues[triggers.cue[i] ?? -1];
        if (cue === undefined || !l.sfx.isReady(cue.index)) continue;
        const delay = (triggers.delaySec[i] ?? 0) + cue.delayMs / 1000;
        play(l, cue, now, triggers.semis[i] ?? 0, triggers.x[i] ?? Number.NaN, triggers.durSec[i] ?? 0, delay, triggers.hits[i] ?? 1);
      }

      // The low-HP creak repeats only in a running Pulse: never under the pause menu (LP M1 review).
      if (lowHp && !paused && view.phase === 'pulse' && lowHpCue !== undefined && now >= nextLowHp) {
        play(l, lowHpCue, now, 0, Number.NaN, 0, 0, 1);
        nextLowHp = now + LOW_HP_PERIOD_SEC;
      }

      updateMusic(l, view, now);

      for (let t = 0; t < DUCK_TARGET_COUNT; t++) {
        const db = ducker.duckDb(t as DuckTarget, now);
        if (Math.abs(db - (lastDuckDb[t] ?? 0)) <= DUCK_EPS_DB) continue;
        lastDuckDb[t] = db;
        l.graph.duck[t]?.gain.setTargetAtTime(dbToGain(db), now, 0.01);
      }
    },
    playUi(cueId) {
      const l = live;
      if (l === null || l.graph.ctx.state !== 'running') return;
      const cue = cueById(cueId);
      if (cue === undefined || !l.sfx.isReady(cue.index)) return;
      play(l, cue, l.graph.ctx.currentTime, 0, Number.NaN, 0, 0, 1);
    },
    applySettings(s) {
      settings = s;
      if (live !== null) applySettingsNow(live);
    },
    setArena(arena: ArenaDef) {
      bounds = panBoundsOf(arena);
    },
    setPaused(p) {
      paused = p;
      const l = live;
      if (l === null) return;
      applyPause(l);
      // Resume the creak one period after the menu closes, not instantly.
      if (!p) nextLowHp = l.graph.ctx.currentTime + LOW_HP_PERIOD_SEC;
    },
    setHidden(hidden) {
      const l = live;
      if (l === null || settings?.muteWhenUnfocused === false) return;
      const ctx = l.graph.ctx;
      // Rejections (context closed meanwhile) are harmless: the next unlock or resume retries.
      if (hidden && ctx.state === 'running') ctx.suspend().catch(ignore);
      else if (!hidden && ctx.state === 'suspended') ctx.resume().catch(ignore);
    },
    dispose() {
      disposed = true;
      const l = live;
      live = null;
      ducker.clear();
      if (l !== null) {
        l.renderer.dispose();
        l.fallback.dispose();
        l.graph.ctx.close().catch(ignore);
      }
    },
  };
}

function stereo(ctx: BaseAudioContext, out: readonly Float32Array[]): AudioBuffer {
  const l = out[0] ?? new Float32Array(1);
  const r = out[1] ?? l;
  const b = ctx.createBuffer(2, l.length, ctx.sampleRate);
  b.getChannelData(0).set(l);
  b.getChannelData(1).set(r);
  return b;
}
