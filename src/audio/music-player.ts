// Data-driven sequencer (audio-direction 2.3, 7): schedules whole bars on the audio clock with
// lookahead, playing instrument samples rendered at boot by the pure DSP (sampler playback).

import type { InstrumentDef } from './synth/index.ts';
import { dbToGain, pickRef, renderInstrumentSample } from './synth/index.ts';
import { notesForBar } from './music/song.ts';
import type { CompiledSong, NoteEvent } from './music/song.ts';
import { rampTo, toAudioBuffer } from './engine.ts';

/**
 * Notes are scheduled once their start enters this window (update runs every frame). A bar's
 * notes are generated at its downbeat, so level changes land on bar lines (audio-direction 6.3),
 * but nodes are created a few at a time to keep each frame cheap.
 */
const LOOKAHEAD_SEC = 0.15;

interface Sampled {
  readonly def: InstrumentDef;
  readonly buffers: AudioBuffer[];
}

export interface SampleBank {
  render(defs: ReadonlyMap<string, InstrumentDef>, yieldEvery: () => Promise<void>): Promise<void>;
  has(inst: string): boolean;
  get(inst: string): Sampled | undefined;
}

export function createSampleBank(ctx: BaseAudioContext): SampleBank {
  const map = new Map<string, Sampled>();
  return {
    async render(defs, yieldEvery) {
      for (const def of defs.values()) {
        const refs: readonly (number | null)[] = def.refNotes.length > 0 ? def.refNotes : [null];
        const buffers: AudioBuffer[] = [];
        for (const r of refs) {
          buffers.push(toAudioBuffer(ctx, renderInstrumentSample(def, r), def.sampleRate));
          await yieldEvery();
        }
        map.set(def.id, { def, buffers });
      }
    },
    has: (inst) => map.has(inst),
    get: (inst) => map.get(inst),
  };
}

interface Playing {
  readonly song: CompiledSong;
  readonly gain: GainNode;
  /** Next bar to generate and its start time. */
  bar: number;
  barTime: number;
  /** Notes of the last generated bar, sorted by step, and the next one to schedule. */
  readonly notes: NoteEvent[];
  next: number;
  notesBarTime: number;
  readonly sources: AudioBufferSourceNode[];
}

export interface MusicPlayer {
  readonly currentId: string | null;
  /** Starts song at the next possible moment with a fade-in; the running song fades out. */
  play(song: CompiledSong, fadeInSec: number, fadeOutSec: number): void;
  stop(fadeOutSec: number): void;
  /** Schedules bars that enter the lookahead window at the given intensity level. */
  update(level: number): void;
  activeNotes(): number;
}

export function createMusicPlayer(
  ctx: AudioContext,
  out: AudioNode,
  hallSend: AudioNode,
  bank: SampleBank,
): MusicPlayer {
  let current: Playing | null = null;
  const fading: Playing[] = [];

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
    fading.push(p);
  }

  function scheduleNote(p: Playing, n: NoteEvent, barTime: number): void {
    const inst = bank.get(n.inst);
    if (inst === undefined) return;
    const pitched = inst.def.refNotes.length > 0;
    const ref = pitched ? pickRef(inst.def.refNotes, n.midi) : { index: 0, rate: 1 };
    const buf = inst.buffers[ref.index];
    if (buf === undefined) return;
    const t = barTime + n.step * p.song.stepSec;
    const holdEnd = t + n.lenSteps * p.song.stepSec;
    const rel = inst.def.releaseMs / 1000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = ref.rate;
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
    tail.connect(p.gain);
    if (n.hall > 0) {
      const s = ctx.createGain();
      s.gain.value = n.hall;
      tail.connect(s).connect(hallSend);
    }
    src.start(t);
    const natural = t + buf.duration / ref.rate;
    src.stop(pitched ? Math.min(natural, holdEnd + rel * 2) : natural);
    src.onended = () => {
      tail.disconnect();
      const i = p.sources.indexOf(src);
      if (i >= 0) p.sources.splice(i, 1);
    };
    p.sources.push(src);
  }

  const player: MusicPlayer = {
    get currentId() {
      return current?.song.id ?? null;
    },
    play(song, fadeInSec, fadeOutSec) {
      if (current !== null) release(current, fadeOutSec);
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(fadeInSec > 0 ? 0.0001 : 1, now);
      if (fadeInSec > 0) gain.gain.setTargetAtTime(1, now, fadeInSec / 4);
      gain.connect(out);
      current = { song, gain, bar: 0, barTime: now + 0.05, notes: [], next: 0, notesBarTime: 0, sources: [] };
    },
    stop(fadeOutSec) {
      if (current === null) return;
      release(current, fadeOutSec);
      current = null;
    },
    update(level) {
      const now = ctx.currentTime;
      for (let i = fading.length - 1; i >= 0; i--) {
        const f = fading[i];
        if (f !== undefined && f.sources.length === 0) {
          f.gain.disconnect();
          fading.splice(i, 1);
        }
      }
      const p = current;
      if (p === null) return;
      // After a long stall (tab suspended), skip ahead instead of scheduling a burst of old notes.
      if (p.barTime < now - p.song.barSec) {
        p.barTime = now + 0.05;
        p.notes.length = 0;
        p.next = 0;
      }
      const horizon = now + LOOKAHEAD_SEC;
      for (;;) {
        if (p.next >= p.notes.length) {
          if (p.barTime >= horizon) break;
          notesForBar(p.song, p.bar, level, p.notes);
          p.notes.sort((a, b) => a.step - b.step);
          p.next = 0;
          p.notesBarTime = p.barTime;
          p.bar++;
          p.barTime += p.song.barSec;
          continue;
        }
        const n = p.notes[p.next];
        if (n === undefined || p.notesBarTime + n.step * p.song.stepSec >= horizon) break;
        scheduleNote(p, n, p.notesBarTime);
        p.next++;
      }
    },
    activeNotes() {
      return (current?.sources.length ?? 0) + fading.reduce((a, f) => a + f.sources.length, 0);
    },
  };
  return player;
}
