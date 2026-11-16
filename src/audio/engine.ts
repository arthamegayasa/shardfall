// Web Audio graph and SFX playback (audio-direction 8.1). Created only inside AudioSystem.unlock(),
// never at import time. Buffers come from the pure DSP in ./synth.

import type { CueDef, CueTable } from './cue-data.ts';
import { PRIORITY_UI } from './cue-data.ts';
import { DUCK_TARGET_COUNT, DuckTarget, duckGroupOf } from './ducking.ts';
import { renderCue } from './synth/index.ts';
import { createVoicePool } from './voices.ts';
import type { VoicePool } from './voices.ts';

/** Ramp time constant for every gain change (audio-direction 2.4: at least 5 ms). */
const RAMP_TAU = 0.012;
const STEAL_FADE_SEC = 0.01;
/** Live cue renders are cached per length rounded to 50 ms (audio-list 2). */
const LIVE_STEP_MS = 50;
const LIVE_CACHE_MAX = 48;

export interface Graph {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;
  readonly masterLowpass: BiquadFilterNode;
  readonly musicIn: GainNode;
  readonly musicPause: BiquadFilterNode;
  readonly musicPauseGain: GainNode;
  readonly musicFader: GainNode;
  readonly sfxFader: GainNode;
  readonly uiFader: GainNode;
  readonly uiIn: GainNode;
  /** Duck gains indexed by DuckTarget: music, then four sfx priority groups. */
  readonly duck: readonly GainNode[];
  readonly hallSend: GainNode;
  readonly roomSend: GainNode;
  readonly hall: ConvolverNode;
  readonly room: ConvolverNode;
}

export function createGraph(ctx: AudioContext): Graph {
  const gain = (v = 1): GainNode => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const masterGain = gain();
  const masterLowpass = ctx.createBiquadFilter();
  masterLowpass.type = 'lowpass';
  masterLowpass.frequency.value = 20000;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  comp.knee.value = 6;
  comp.attack.value = 0.005;
  comp.release.value = 0.12;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.ratio.value = 20;
  limiter.knee.value = 0;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  masterGain.connect(masterLowpass).connect(comp).connect(limiter).connect(ctx.destination);

  const duck: GainNode[] = [];
  for (let i = 0; i < DUCK_TARGET_COUNT; i++) duck.push(gain());
  const musicIn = gain();
  const musicPause = ctx.createBiquadFilter();
  musicPause.type = 'lowpass';
  musicPause.frequency.value = 20000;
  const musicPauseGain = gain();
  const musicFader = gain();
  const musicDuck = duck[DuckTarget.Music] ?? gain();
  musicIn.connect(musicDuck).connect(musicPause).connect(musicPauseGain).connect(musicFader).connect(masterGain);
  const sfxFader = gain();
  for (let i = 1; i < DUCK_TARGET_COUNT; i++) duck[i]?.connect(sfxFader);
  sfxFader.connect(masterGain);
  const uiIn = gain();
  const uiFader = gain();
  uiIn.connect(uiFader).connect(masterGain);
  // Sends: hall returns into the music bus, room into the sfx bus (audio-direction 8.1).
  const hallSend = gain();
  const roomSend = gain();
  const hall = ctx.createConvolver();
  const room = ctx.createConvolver();
  hall.normalize = false;
  room.normalize = false;
  hallSend.connect(hall).connect(musicDuck);
  roomSend.connect(room).connect(sfxFader);
  return {
    ctx,
    masterGain,
    masterLowpass,
    musicIn,
    musicPause,
    musicPauseGain,
    musicFader,
    sfxFader,
    uiFader,
    uiIn,
    duck,
    hallSend,
    roomSend,
    hall,
    room,
  };
}

/** Smoothly moves an AudioParam (never a hard jump, never an exponential ramp to 0). */
export function rampTo(p: AudioParam, value: number, now: number, tau = RAMP_TAU): void {
  p.cancelScheduledValues(now);
  p.setTargetAtTime(value, now, tau);
}

export function toAudioBuffer(ctx: BaseAudioContext, data: Float32Array, sampleRate: number): AudioBuffer {
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}

interface VoiceNodes {
  src: AudioBufferSourceNode | null;
  gain: GainNode | null;
  token: number;
}

/** One play request after mapping, coalescing, and jitter (all values final). */
export interface PlayRequest {
  readonly whenSec: number;
  readonly rate: number;
  readonly gain: number;
  readonly pan: number;
  /** Live cue length in seconds, 0 = recipe length. */
  readonly durSec: number;
  /** Start offset into the buffer (riser joined late). */
  readonly offsetSec: number;
}

export interface SfxPlayer {
  /** Renders buffer-mode cues in slices so boot never freezes. Resolves when all are ready. */
  renderAll(yieldEvery: () => Promise<void>): Promise<void>;
  isReady(cue: number): boolean;
  /** Renders a live cue at durSec into the cache ahead of time. */
  prewarm(cue: number, durSec: number): void;
  /** Starts a cue respecting voice limits. Returns false when dropped. */
  play(cue: CueDef, req: PlayRequest, maxVoices: number): boolean;
  /** Stops every instance of a cue (riser cut when a Warden appears). */
  stopCue(cue: number, now: number): void;
  activeVoices(now: number): number;
}

function busRank(c: CueDef): number {
  return c.bus === 'ui' ? 0 : c.bus === 'sfx' ? 1 : 2;
}

export function createSfxPlayer(graph: Graph, table: CueTable): SfxPlayer {
  const { ctx } = graph;
  const cues = table.cues;
  const buffers: (AudioBuffer | null)[] = cues.map(() => null);
  const liveCache = new Map<string, AudioBuffer>();
  const pools: Record<'sfx' | 'ui' | 'music', VoicePool> = {
    sfx: createVoicePool({ capacity: 24, reserved: 4, reservedMaxPriority: 2, cueCount: cues.length }),
    ui: createVoicePool({ capacity: 6, reserved: 0, reservedMaxPriority: 0, cueCount: cues.length }),
    music: createVoicePool({ capacity: 6, reserved: 0, reservedMaxPriority: 0, cueCount: cues.length }),
  };
  const nodes: Record<'sfx' | 'ui' | 'music', VoiceNodes[]> = {
    sfx: Array.from({ length: 24 }, () => ({ src: null, gain: null, token: 0 })),
    ui: Array.from({ length: 6 }, () => ({ src: null, gain: null, token: 0 })),
    music: Array.from({ length: 6 }, () => ({ src: null, gain: null, token: 0 })),
  };

  function liveBuffer(cue: CueDef, durSec: number): AudioBuffer {
    const ms = Math.max(LIVE_STEP_MS, Math.round((durSec * 1000) / LIVE_STEP_MS) * LIVE_STEP_MS);
    const key = `${cue.index}:${ms}`;
    let buf = liveCache.get(key);
    if (buf === undefined) {
      if (liveCache.size >= LIVE_CACHE_MAX) liveCache.clear();
      buf = toAudioBuffer(ctx, renderCue(cue, cue.sampleRate, ms), cue.sampleRate);
      liveCache.set(key, buf);
    }
    return buf;
  }

  function destFor(cue: CueDef): AudioNode {
    if (cue.bus === 'ui') return graph.uiIn;
    if (cue.bus === 'music') return graph.musicIn;
    return graph.duck[duckGroupOf(cue.priority)] ?? graph.sfxFader;
  }

  function fadeOut(v: VoiceNodes, now: number): void {
    if (v.src === null || v.gain === null) return;
    rampTo(v.gain.gain, 0, now, STEAL_FADE_SEC / 3);
    try {
      v.src.stop(now + STEAL_FADE_SEC * 2);
    } catch {
      // Already stopped.
    }
    v.src = null;
    v.gain = null;
  }

  return {
    async renderAll(yieldEvery) {
      // UI first (title screen clicks), then sim SFX by priority, music-bus stingers last.
      const order = [...cues].sort((a, b) => busRank(a) - busRank(b) || a.priority - b.priority);
      for (const cue of order) {
        if (cue.mode === 'buffer' && !cue.deprecated) {
          buffers[cue.index] = toAudioBuffer(ctx, renderCue(cue, cue.sampleRate), cue.sampleRate);
        }
        await yieldEvery();
      }
    },
    prewarm(i, durSec) {
      const cue = cues[i];
      if (cue?.mode === 'live') liveBuffer(cue, durSec);
    },
    isReady(i) {
      const cue = cues[i];
      return cue !== undefined && (cue.mode === 'live' || buffers[i] !== null);
    },
    play(cue, req, maxVoices) {
      const buf = cue.mode === 'live' ? liveBuffer(cue, req.durSec > 0 ? req.durSec : cue.durationMs / 1000) : buffers[cue.index];
      if (buf === null || buf === undefined) return false;
      const bus = cue.bus;
      const pool = pools[bus];
      const durSec = Math.max(0.001, (buf.duration - req.offsetSec) / req.rate);
      const prio = bus === 'sfx' ? cue.priority : PRIORITY_UI;
      const slot = pool.request(cue.index, prio, maxVoices, cue.minIntervalMs / 1000, req.whenSec, durSec);
      if (slot < 0) return false;
      const vs = nodes[bus];
      if (pool.lastStolen >= 0) {
        const victim = vs[pool.lastStolen];
        if (victim !== undefined && victim.token === pool.lastStolenToken) fadeOut(victim, req.whenSec);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = req.rate;
      const g = ctx.createGain();
      g.gain.value = req.gain;
      src.connect(g);
      let tail: AudioNode = g;
      if (req.pan !== 0) {
        const p = ctx.createStereoPanner();
        p.pan.value = req.pan;
        g.connect(p);
        tail = p;
      }
      tail.connect(destFor(cue));
      if (cue.sendRoom > 0) {
        const s = ctx.createGain();
        s.gain.value = cue.sendRoom;
        tail.connect(s).connect(graph.roomSend);
      }
      if (cue.sendHall > 0) {
        const s = ctx.createGain();
        s.gain.value = cue.sendHall;
        tail.connect(s).connect(graph.hallSend);
      }
      src.start(req.whenSec, req.offsetSec);
      const v = vs[slot];
      if (v !== undefined) {
        v.src = src;
        v.gain = g;
        v.token = pool.tokenOf(slot);
        src.onended = () => {
          if (v.src === src) {
            v.src = null;
            v.gain = null;
          }
          tail.disconnect();
        };
      }
      return true;
    },
    stopCue(i, now) {
      for (const bus of ['sfx', 'ui', 'music'] as const) {
        for (const v of nodes[bus]) {
          if (v.src !== null && v.src.buffer !== null && buffers[i] === v.src.buffer) fadeOut(v, now);
        }
      }
    },
    activeVoices(now) {
      return pools.sfx.activeCount(now) + pools.ui.activeCount(now);
    },
  };
}
