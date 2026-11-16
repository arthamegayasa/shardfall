// AudioSystem implementation (architecture 6.8, 11). Listener only: reads WorldView and frame
// events, never writes sim state, so the sim hash is identical with audio on or off (AU A-8).

import { TICK_RATE, createRng } from '../core/index.ts';
import type {
  ArenaDef,
  AudioSystem,
  RunPhase,
  Settings,
  WorldView,
} from '../core/index.ts';
import type { GameData } from '../content/index.ts';
import type { CueDef, CueTable } from './cue-data.ts';
import { parseCueTable, parseInstruments } from './cue-data.ts';
import { DUCK_TARGET_COUNT, createDucker } from './ducking.ts';
import type { DuckTarget } from './ducking.ts';
import { createGraph, createSfxPlayer, rampTo } from './engine.ts';
import type { Graph, SfxPlayer } from './engine.ts';
import { createEventMap, liveWarmupPairs } from './event-map.ts';
import type { EventMap, Routes } from './event-map.ts';
import { DEFAULT_PAN_BOUNDS, coalesceBoostDb, panBoundsOf, panForX, volumeToGain } from './mix-math.ts';
import type { PanBounds } from './mix-math.ts';
import { RISER_CUE, levelFor, riserDue, songForPhase } from './music-director.ts';
import { createMusicPlayer, createSampleBank } from './music-player.ts';
import type { MusicPlayer } from './music-player.ts';
import { compileSong } from './music/song.ts';
import type { CompiledSong } from './music/song.ts';
import { IR_HALL, IR_ROOM, dbToGain, renderIr, semisToRatio } from './synth/index.ts';
import { createTriggerList } from './triggers.ts';

/** Raw data files, injected so tests and tools can build the system without Vite JSON imports. */
export interface AudioData {
  readonly cues: unknown;
  readonly routes: unknown;
  readonly instruments: unknown;
  readonly songs: readonly unknown[];
}

const LOW_HP_CUE = 'sfx.player.lowhp';
const LOW_HP_PERIOD_SEC = 1.0;
const DEFEAT_RATE = 0.7;
const DEFEAT_LOWPASS_HZ = 300;
const PAUSE_LOWPASS_HZ = 800;
const PAUSE_MUSIC_DB = -6;
const SHOP_FADE_IN_SEC = 2;
const SHOP_FADE_OUT_SEC = 0.6;
const PULSE_FADE_OUT_SEC = 0.08;
const AUDIO_SEED = 0x5f17a0d1;
/** Slice length for boot rendering before yielding to the browser. */
const RENDER_SLICE_MS = 8;

function ignore(): void {
  // Intentionally empty: see call sites.
}

interface Live {
  readonly graph: Graph;
  readonly sfx: SfxPlayer;
  readonly music: MusicPlayer;
}

export function createAudioSystem(data: GameData, files: AudioData): AudioSystem {
  // Data is parsed and cross-checked at boot: bad audio data fails fast (coding-standards 7).
  const cues: CueTable = parseCueTable(files.cues);
  const instruments = parseInstruments(files.instruments);
  const known = new Set(instruments.keys());
  const songs = new Map<string, CompiledSong>();
  for (const json of files.songs) {
    const errors: string[] = [];
    const song = compileSong(json, known, errors);
    if (song === null || errors.length > 0) throw new Error(`Invalid song data:\n${errors.join('\n')}`);
    songs.set(song.id, song);
  }
  const routes = files.routes as Routes;
  const eventMap: EventMap = createEventMap(data, cues, routes);
  const warmup = liveWarmupPairs(data, routes);
  const triggers = createTriggerList(cues.cues.length);
  const ducker = createDucker();
  const rng = createRng(AUDIO_SEED);
  const cueById = (id: string): CueDef | undefined => {
    const i = cues.indexOf.get(id);
    return i === undefined ? undefined : cues.cues[i];
  };
  const riserCue = cueById(RISER_CUE);
  const lowHpCue = cueById(LOW_HP_CUE);
  const defaultLadder = songs.get('mus.biome1.pulse')?.glintLadder ?? [];

  let live: Live | null = null;
  let unlocking: Promise<void> | null = null;
  let settings: Settings['audio'] | null = null;
  let bounds: PanBounds = DEFAULT_PAN_BOUNDS;
  let paused = false;
  let phase: RunPhase = 'idle';
  let defeatFx = false;
  let defeatAt = 0;
  let lowHp = false;
  let nextLowHp = 0;
  let riserPulse = -1;
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

  async function boot(): Promise<void> {
    const Ctor = window.AudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    if (ctx.state !== 'running') await ctx.resume();
    const graph = createGraph(ctx);
    const sfx = createSfxPlayer(graph, cues);
    const bank = createSampleBank(ctx);
    const music = createMusicPlayer(ctx, graph.musicIn, graph.hallSend, bank);
    live = { graph, sfx, music };
    applySettingsNow(live);
    applyPause(live);
    // Render in slices after the gesture so the title screen never freezes (audio-direction 2.2).
    // MessageChannel yields avoid the 4 ms clamp of nested setTimeout.
    const channel = new MessageChannel();
    let wake: (() => void) | null = null;
    channel.port1.onmessage = () => {
      wake?.();
    };
    let sliceStart = performance.now();
    const yieldEvery = async (): Promise<void> => {
      if (performance.now() - sliceStart < RENDER_SLICE_MS) return;
      await new Promise<void>((r) => {
        wake = r;
        channel.port2.postMessage(0);
      });
      sliceStart = performance.now();
    };
    const irBuffer = (spec: typeof IR_HALL): AudioBuffer => {
      const [l, r] = renderIr(spec, ctx.sampleRate);
      const b = ctx.createBuffer(2, l.length, ctx.sampleRate);
      b.getChannelData(0).set(l);
      b.getChannelData(1).set(r);
      return b;
    };
    graph.room.buffer = irBuffer(IR_ROOM);
    await sfx.renderAll(yieldEvery);
    for (const w of warmup) {
      const i = cues.indexOf.get(w.cue);
      if (i !== undefined) sfx.prewarm(i, w.durSec);
      await yieldEvery();
    }
    graph.hall.buffer = irBuffer(IR_HALL);
    await bank.render(instruments, yieldEvery);
    channel.port1.close();
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
    const started = l.sfx.play(
      cue,
      { whenSec: now + delaySec, rate, gain: dbToGain(gainDb), pan: pan(cue, x), durSec, offsetSec },
      maxVoices,
    );
    if (started && cue.duck !== null) {
      ducker.trigger(cue.duck, now + delaySec, durSec > 0 ? durSec : cue.durationMs / 1000);
    }
  }

  function updateMusic(l: Live, view: WorldView, now: number): void {
    const want = songForPhase(view.phase);
    const cur = l.music.currentId;
    if (want !== cur) {
      const song = want === null ? undefined : songs.get(want);
      const fadeOut = cur === 'mus.shop' ? SHOP_FADE_OUT_SEC : PULSE_FADE_OUT_SEC;
      if (song === undefined) l.music.stop(fadeOut);
      else l.music.play(song, want === 'mus.shop' ? SHOP_FADE_IN_SEC : 0, fadeOut);
    }
    const song = want === null ? undefined : songs.get(want);
    l.music.update(song === undefined ? 0 : levelFor(song, view));
    // Riser: once per Pulse, joined late with a buffer offset so it always ends with the Pulse.
    const secs = song?.intensity?.riserSecondsBeforeEnd ?? null;
    if (riserCue !== undefined && secs !== null && riserPulse !== view.pulse.index && riserDue(view, secs)) {
      riserPulse = view.pulse.index;
      const offset = Math.max(0, secs - view.pulse.ticksLeft / TICK_RATE);
      play(l, riserCue, now, 0, Number.NaN, 0, 0, 1, offset);
    }
    if (view.phase !== 'pulse') riserPulse = -1;
    else if (riserCue !== undefined && riserPulse === view.pulse.index && view.pulse.wardenAlive) {
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
      phase = view.phase;

      triggers.reset();
      eventMap.map(events, triggers, now, currentLadder(l));
      const sig = eventMap.signals;
      if (sig.lowHp >= 0) {
        lowHp = sig.lowHp === 1;
        nextLowHp = now;
      }
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

      if (lowHp && phase === 'pulse' && lowHpCue !== undefined && now >= nextLowHp) {
        play(l, lowHpCue, now, 0, Number.NaN, 0, 0, 1);
        nextLowHp = now + LOW_HP_PERIOD_SEC;
      }

      updateMusic(l, view, now);

      for (let t = 0; t < DUCK_TARGET_COUNT; t++) {
        const g = l.graph.duck[t];
        if (g !== undefined) g.gain.setTargetAtTime(dbToGain(ducker.duckDb(t as DuckTarget, now)), now, 0.01);
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
      if (live !== null) applyPause(live);
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
      if (l !== null) l.graph.ctx.close().catch(ignore);
    },
  };
}
