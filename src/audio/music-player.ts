// Data-driven sequencer (audio-direction 2.3, 6, 7): schedules bars on the audio clock with
// lookahead, playing instrument samples rendered at boot by the pure DSP (sampler playback).
// One looping song at a time with per-layer gains (level fades on bar lines), an overlay that
// follows the song's bar clock (Warden), and one-shot stingers on top.

import type { InstrumentDef } from './synth/index.ts';
import { dbToGain, loopPointsOf, pickRef } from './synth/index.ts';
import { createNoteBuffer, layerFade, notesForBar, sortNotesByStep } from './music/song.ts';
import type { CompiledSong, NoteBuffer, NoteEvent } from './music/song.ts';
import { rampTo, toAudioBuffer } from './engine.ts';

/**
 * Notes are scheduled once their start enters this window (update runs every frame). A bar's
 * notes are generated just before its downbeat, so level changes land on bar lines (6.3), but
 * nodes are created a few at a time to keep each frame cheap.
 */
const LOOKAHEAD_SEC = 0.15;
/** Fade of the loop when the boss phase break cuts it (audio-direction 6.6). */
const BREAK_FADE_SEC = 0.08;
/** Overlay fades: in over 2 beats, out over 1 bar of the host (audio-direction 6.7). */
const OVERLAY_IN_BEATS = 2;
const OVERLAY_OUT_BEATS = 4;

interface Sampled {
  readonly def: InstrumentDef;
  readonly buffers: (AudioBuffer | null)[];
  readonly loop: { readonly startSec: number; readonly endSec: number } | null;
}

export interface SampleBank {
  /** Stores the rendered reference note refIndex of an instrument. */
  set(def: InstrumentDef, refIndex: number, data: Float32Array): void;
  get(inst: string): Sampled | undefined;
}

export function createSampleBank(ctx: BaseAudioContext): SampleBank {
  const map = new Map<string, Sampled>();
  return {
    set(def, refIndex, data) {
      let s = map.get(def.id);
      if (s === undefined) {
        s = {
          def,
          buffers: new Array<AudioBuffer | null>(Math.max(1, def.refNotes.length)).fill(null),
          loop: loopPointsOf(def, data.length),
        };
        map.set(def.id, s);
      }
      s.buffers[refIndex] = toAudioBuffer(ctx, data, def.sampleRate);
    },
    get: (inst) => map.get(inst),
  };
}

interface Playing {
  readonly song: CompiledSong;
  readonly gain: GainNode;
  /** One gain per song layer, under gain (level fades). */
  readonly layerGains: GainNode[];
  readonly loop: boolean;
  /** Next bar to generate and its start time. */
  bar: number;
  barTime: number;
  /** Level of the last generated bar, -1 before the first. */
  level: number;
  /** Notes of the last generated bar, sorted by step, and the next one to schedule. */
  readonly notes: NoteBuffer;
  next: number;
  notesBarTime: number;
  readonly sources: AudioBufferSourceNode[];
}

interface Overlay {
  readonly song: CompiledSong;
  readonly gain: GainNode;
  readonly notes: NoteBuffer;
  active: boolean;
  /** Audio time after which a faded overlay stops generating notes. */
  endAt: number;
}

export interface MusicPlayer {
  readonly currentId: string | null;
  /** Starts song after startDelaySec with a fade-in; the running song fades out now. */
  play(song: CompiledSong, fadeInSec: number, fadeOutSec: number, startDelaySec?: number): void;
  stop(fadeOutSec: number): void;
  /** Schedules bars that enter the lookahead window at the given intensity level. */
  update(level: number): void;
  /** Warden overlay on the current song's bar clock; null fades it out over one bar. */
  setOverlay(song: CompiledSong | null): void;
  /** Plays a one-shot song now. Returns the audio time its tail ends. */
  stinger(song: CompiledSong): number;
  /** Silences the loop for sec, then resumes on the next section downbeat (boss phase 2). */
  breakFor(sec: number): void;
  activeNotes(): number;
}

export function createMusicPlayer(
  ctx: AudioContext,
  out: AudioNode,
  hallSend: AudioNode,
  bank: SampleBank,
): MusicPlayer {
  let current: Playing | null = null;
  let overlay: Overlay | null = null;
  const fading: Playing[] = [];
  const stingers: Playing[] = [];

  function makePlaying(song: CompiledSong, loop: boolean, startAt: number, gainValue: number): Playing {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.connect(out);
    const layerGains: GainNode[] = [];
    for (let i = 0; i < song.layers.length; i++) {
      const g = ctx.createGain();
      g.connect(gain);
      layerGains.push(g);
    }
    return {
      song,
      gain,
      layerGains,
      loop,
      bar: 0,
      barTime: startAt,
      level: -1,
      notes: createNoteBuffer(),
      next: 0,
      notesBarTime: 0,
      sources: [],
    };
  }

  function release(p: Playing, fadeSec: number): void {
    const now = ctx.currentTime;
    rampTo(p.gain.gain, 0, now, Math.max(0.005, fadeSec / 4));
    const end = now + fadeSec + 0.05;
    for (const s of p.sources) {
      try {
        s.stop(end);
      } catch {
        // Already stopped.
      }
    }
    // Nothing new is scheduled for a released song.
    p.notes.count = 0;
    p.next = 0;
    p.bar = Number.MAX_SAFE_INTEGER;
    fading.push(p);
  }

  function scheduleNote(p: Playing, n: NoteEvent, barTime: number, dest: AudioNode, stepSec: number): void {
    const inst = bank.get(n.inst);
    if (inst === undefined) return;
    const pitched = inst.def.refNotes.length > 0;
    const ref = pitched ? pickRef(inst.def.refNotes, n.midi) : { index: 0, rate: 1 };
    const buf = inst.buffers[ref.index];
    if (buf === null || buf === undefined) return;
    const t = barTime + n.step * stepSec;
    const holdEnd = t + n.lenSteps * stepSec;
    const rel = inst.def.releaseMs / 1000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = ref.rate;
    let natural = t + buf.duration / ref.rate;
    if (pitched && inst.loop !== null && holdEnd + rel * 2 > natural) {
      // Sustained instruments loop their sample instead of shipping long buffers.
      src.loop = true;
      src.loopStart = inst.loop.startSec;
      src.loopEnd = inst.loop.endSec;
      natural = Number.POSITIVE_INFINITY;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(n.vel * dbToGain(n.gainDb), t);
    // Pitched notes are held then released; drum hits play their whole sample.
    if (pitched) g.gain.setTargetAtTime(0, holdEnd, rel / 3);
    src.connect(g);
    let tail: AudioNode = g;
    if (n.pan !== 0) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = n.pan;
      g.connect(pan);
      tail = pan;
    }
    tail.connect(dest);
    if (n.hall > 0) {
      const s = ctx.createGain();
      s.gain.value = n.hall;
      tail.connect(s).connect(hallSend);
    }
    src.start(t);
    src.stop(pitched ? Math.min(natural, holdEnd + rel * 2) : natural);
    const list = p.sources;
    src.onended = () => {
      tail.disconnect();
      const i = list.indexOf(src);
      if (i >= 0) list.splice(i, 1);
    };
    list.push(src);
  }

  /** Level fades of every layer at the downbeat t (audio-direction 6.3). */
  function applyFades(p: Playing, from: number, to: number, t: number): void {
    const rules = p.song.intensity;
    const beat = p.song.barSec / 4;
    const fin = (rules?.fadeInBeats ?? 1) * beat;
    const fout = (rules?.fadeOutBeats ?? 2) * beat;
    for (let i = 0; i < p.song.layers.length; i++) {
      const L = p.song.layers[i];
      const g = p.layerGains[i];
      if (L === undefined || g === undefined) continue;
      const f = layerFade(L, from, to);
      if (f === 0) continue;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(f > 0 ? 0 : 1, t);
      g.gain.linearRampToValueAtTime(f > 0 ? 1 : 0, t + (f > 0 ? fin : fout));
    }
  }

  function generateBar(p: Playing, level: number): void {
    const from = p.level < 0 ? level : p.level;
    const fadeOutSteps = Math.round((p.song.intensity?.fadeOutBeats ?? 2) * 4);
    notesForBar(p.song, p.bar, level, p.notes, from, fadeOutSteps);
    sortNotesByStep(p.notes);
    if (from !== level) applyFades(p, from, level, p.barTime);
    p.level = level;
    p.next = 0;
    p.notesBarTime = p.barTime;
    if (p === current && overlay !== null && (overlay.active || p.barTime < overlay.endAt)) {
      // The overlay rides the host's bar index and tempo; its few notes are scheduled at once.
      notesForBar(overlay.song, p.bar, 0, overlay.notes);
      for (let i = 0; i < overlay.notes.count; i++) {
        const n = overlay.notes.items[i];
        if (n !== undefined) scheduleNote(p, n, p.barTime, overlay.gain, p.song.stepSec);
      }
    }
    p.bar++;
    p.barTime += p.song.barSec;
  }

  /** Schedules what enters the lookahead window. Returns false when a one-shot has finished. */
  function advance(p: Playing, level: number, horizon: number): boolean {
    for (;;) {
      if (p.next >= p.notes.count) {
        if (!p.loop && p.bar >= p.song.loopBars) return false;
        if (p.barTime >= horizon) return true;
        generateBar(p, level);
        continue;
      }
      const n = p.notes.items[p.next];
      if (n === undefined || p.notesBarTime + n.step * p.song.stepSec >= horizon) return true;
      scheduleNote(p, n, p.notesBarTime, p.layerGains[n.layer] ?? p.gain, p.song.stepSec);
      p.next++;
    }
  }

  function disconnect(p: Playing): void {
    for (const g of p.layerGains) g.disconnect();
    p.gain.disconnect();
  }

  const player: MusicPlayer = {
    get currentId() {
      return current?.song.id ?? null;
    },
    play(song, fadeInSec, fadeOutSec, startDelaySec = 0) {
      if (current !== null) release(current, fadeOutSec);
      const now = ctx.currentTime;
      const startAt = now + 0.05 + startDelaySec;
      const p = makePlaying(song, true, startAt, fadeInSec > 0 ? 0.0001 : 1);
      if (fadeInSec > 0) p.gain.gain.setTargetAtTime(1, startAt, fadeInSec / 4);
      current = p;
    },
    stop(fadeOutSec) {
      if (current === null) return;
      release(current, fadeOutSec);
      current = null;
    },
    setOverlay(song) {
      const now = ctx.currentTime;
      const beat = (current?.song.barSec ?? 2) / 4;
      if (song === null) {
        if (overlay === null || !overlay.active) return;
        overlay.active = false;
        overlay.endAt = now + beat * OVERLAY_OUT_BEATS;
        rampTo(overlay.gain.gain, 0, now, (beat * OVERLAY_OUT_BEATS) / 4);
        return;
      }
      if (overlay !== null && overlay.song === song && overlay.active) return;
      if (overlay === null || overlay.song !== song) {
        overlay?.gain.disconnect();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(out);
        overlay = { song, gain, notes: createNoteBuffer(), active: true, endAt: Number.POSITIVE_INFINITY };
      }
      overlay.active = true;
      overlay.endAt = Number.POSITIVE_INFINITY;
      const g = overlay.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(1, now + beat * OVERLAY_IN_BEATS);
    },
    stinger(song) {
      const startAt = ctx.currentTime + 0.02;
      stingers.push(makePlaying(song, false, startAt, 1));
      return startAt + song.loopBars * song.barSec + song.tailSec;
    },
    breakFor(sec) {
      const p = current;
      if (p === null) return;
      const now = ctx.currentTime;
      const resume = now + sec;
      const g = p.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + BREAK_FADE_SEC);
      g.setValueAtTime(0, resume);
      g.linearRampToValueAtTime(1, resume + 0.01);
      for (const s of p.sources) {
        try {
          s.stop(now + BREAK_FADE_SEC + 0.02);
        } catch {
          // Already stopped.
        }
      }
      // Resume at the next section start (8-bar phrases) so the music re-enters on a downbeat.
      p.bar = Math.ceil(p.bar / 8) * 8;
      p.barTime = resume;
      p.notes.count = 0;
      p.next = 0;
    },
    update(level) {
      const now = ctx.currentTime;
      for (let i = fading.length - 1; i >= 0; i--) {
        const f = fading[i];
        if (f !== undefined && f.sources.length === 0) {
          disconnect(f);
          fading.splice(i, 1);
        }
      }
      const horizon = now + LOOKAHEAD_SEC;
      for (let i = stingers.length - 1; i >= 0; i--) {
        const s = stingers[i];
        if (s === undefined) continue;
        if (!advance(s, 0, horizon) && s.sources.length === 0) {
          disconnect(s);
          stingers.splice(i, 1);
        }
      }
      if (overlay !== null && !overlay.active && now > overlay.endAt + 4) {
        overlay.gain.disconnect();
        overlay = null;
      }
      const p = current;
      if (p === null) return;
      // After a long stall (tab suspended), skip ahead instead of scheduling a burst of old notes.
      if (p.barTime < now - p.song.barSec) {
        p.barTime = now + 0.05;
        p.notes.count = 0;
        p.next = 0;
      }
      advance(p, level, horizon);
    },
    activeNotes() {
      let n = current?.sources.length ?? 0;
      for (const f of fading) n += f.sources.length;
      for (const s of stingers) n += s.sources.length;
      return n;
    },
  };
  return player;
}

