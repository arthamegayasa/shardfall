// Web Audio graph and SFX playback (audio-direction 8.1). Created only inside AudioSystem.unlock(),
// never at import time. Buffers come from the pure DSP in ./synth.

import type { CueDef, CueTable } from './cue-data.ts';
import { PRIORITY_UI, liveLengthMs } from './cue-data.ts';
import { DUCK_TARGET_COUNT, DuckTarget, duckGroupOf } from './ducking.ts';
import { createVoicePool } from './voices.ts';
import type { VoicePool } from './voices.ts';

/** Ramp time constant for every gain change (audio-direction 2.4: at least 5 ms). */
const RAMP_TAU = 0.012;
const STEAL_FADE_SEC = 0.01;
/** Least recently used live renders are evicted one by one beyond this count. */
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
  cue: number;
}

/** One play request after mapping, coalescing, and jitter (all values final). Reused by callers. */
export interface PlayRequest {
  whenSec: number;
  rate: number;
  gain: number;
  pan: number;
  /** Live cue length in seconds, 0 = recipe length. */
  durSec: number;
  /** Start offset into the buffer (riser joined late). */
  offsetSec: number;
}

export interface SfxPlayer {
  /** Stores the rendered buffer of a buffer-mode cue (boot rendering happens outside). */
  setBuffer(cue: number, data: Float32Array): void;
  /** Stores a live render of a cue at lengthMs (see liveLengthMs). */
  addLive(cue: number, lengthMs: number, data: Float32Array): void;
  hasLive(cue: number, lengthMs: number): boolean;
  isReady(cue: number): boolean;
  /** Starts a cue respecting voice limits. Returns false when dropped. */
  play(cue: CueDef, req: PlayRequest, maxVoices: number): boolean;
  /** Stops every instance of a cue (riser cut when a Warden appears). */
  stopCue(cue: number, now: number): void;
  activeVoices(now: number): number;
}

const BUSES = ['sfx', 'ui', 'music'] as const;
const LIVE_KEY = 100000;

/**
 * requestLive is called on a live-cache miss: the caller renders off the main thread and calls
 * addLive. Until then the nearest cached length plays, aligned so its end (the telegraph peak)
 * still lands on the hit (audio-direction 10.6).
 */
export function createSfxPlayer(
  graph: Graph,
  table: CueTable,
  requestLive: (cue: number, lengthMs: number) => void,
): SfxPlayer {
  const { ctx } = graph;
  const cues = table.cues;
  const buffers: (AudioBuffer | null)[] = cues.map(() => null);
  /** Insertion order is the LRU order: a hit re-inserts the key. */
  const liveCache = new Map<number, AudioBuffer>();
  const liveByCue: number[][] = cues.map(() => []);
  const pools: Record<'sfx' | 'ui' | 'music', VoicePool> = {
    sfx: createVoicePool({ capacity: 24, reserved: 4, reservedMaxPriority: 2, cueCount: cues.length }),
    ui: createVoicePool({ capacity: 6, reserved: 0, reservedMaxPriority: 0, cueCount: cues.length }),
    music: createVoicePool({ capacity: 6, reserved: 0, reservedMaxPriority: 0, cueCount: cues.length }),
  };
  const nodes: Record<'sfx' | 'ui' | 'music', VoiceNodes[]> = {
    sfx: Array.from({ length: 24 }, () => ({ src: null, gain: null, token: 0, cue: -1 })),
    ui: Array.from({ length: 6 }, () => ({ src: null, gain: null, token: 0, cue: -1 })),
    music: Array.from({ length: 6 }, () => ({ src: null, gain: null, token: 0, cue: -1 })),
  };
  const keyOf = (cue: number, ms: number): number => cue * LIVE_KEY + ms;

  /** Result of liveBuffer, reused: the buffer and how to align its end with the wanted length. */
  const pick: { buf: AudioBuffer | null; offsetSec: number; delaySec: number } = {
    buf: null,
    offsetSec: 0,
    delaySec: 0,
  };
  function liveBuffer(cue: CueDef, durSec: number): void {
    const ms = liveLengthMs(durSec);
    const key = keyOf(cue.index, ms);
    pick.offsetSec = 0;
    pick.delaySec = 0;
    const hit = liveCache.get(key);
    if (hit !== undefined) {
      liveCache.delete(key);
      liveCache.set(key, hit);
      pick.buf = hit;
      return;
    }
    requestLive(cue.index, ms);
    // Prefer the shortest longer render (start inside it), else the longest shorter one.
    let best = -1;
    for (const m of liveByCue[cue.index] ?? []) {
      if (best < 0) best = m;
      else if (m >= ms) {
        if (best < ms || m < best) best = m;
      } else if (best < ms && m > best) best = m;
    }
    const near = best < 0 ? undefined : liveCache.get(keyOf(cue.index, best));
    pick.buf = near ?? null;
    if (near === undefined) return;
    const want = ms / 1000;
    if (near.duration >= want) pick.offsetSec = near.duration - want;
    else pick.delaySec = want - near.duration;
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
    v.cue = -1;
  }

  return {
    setBuffer(i, data) {
      const cue = cues[i];
      if (cue !== undefined) buffers[i] = toAudioBuffer(ctx, data, cue.sampleRate);
    },
    addLive(i, ms, data) {
      const cue = cues[i];
      if (cue === undefined) return;
      const key = keyOf(i, ms);
      if (!liveCache.has(key)) liveByCue[i]?.push(ms);
      liveCache.delete(key);
      liveCache.set(key, toAudioBuffer(ctx, data, cue.sampleRate));
      while (liveCache.size > LIVE_CACHE_MAX) {
        const oldest = liveCache.keys().next().value;
        if (oldest === undefined) break;
        liveCache.delete(oldest);
        const c = Math.floor(oldest / LIVE_KEY);
        const list = liveByCue[c];
        const k = list?.indexOf(oldest - c * LIVE_KEY) ?? -1;
        if (list !== undefined && k >= 0) list.splice(k, 1);
      }
    },
    hasLive(i, ms) {
      return liveCache.has(keyOf(i, ms));
    },
    isReady(i) {
      const cue = cues[i];
      if (cue === undefined) return false;
      return cue.mode === 'live' ? (liveByCue[i]?.length ?? 0) > 0 : buffers[i] !== null;
    },
    play(cue, req, maxVoices) {
      let buf: AudioBuffer | null | undefined;
      let offset = req.offsetSec;
      let when = req.whenSec;
      if (cue.mode === 'live') {
        liveBuffer(cue, req.durSec > 0 ? req.durSec : cue.durationMs / 1000);
        buf = pick.buf;
        offset += pick.offsetSec;
        when += pick.delaySec;
      } else buf = buffers[cue.index];
      if (buf === null || buf === undefined) return false;
      const bus = cue.bus;
      const pool = pools[bus];
      const durSec = Math.max(0.001, (buf.duration - offset) / req.rate);
      const prio = bus === 'sfx' ? cue.priority : PRIORITY_UI;
      const slot = pool.request(cue.index, prio, maxVoices, cue.minIntervalMs / 1000, when, durSec);
      if (slot < 0) return false;
      const vs = nodes[bus];
      if (pool.lastStolen >= 0) {
        const victim = vs[pool.lastStolen];
        if (victim !== undefined && victim.token === pool.lastStolenToken) fadeOut(victim, when);
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
      src.start(when, offset);
      const v = vs[slot];
      if (v !== undefined) {
        v.src = src;
        v.gain = g;
        v.cue = cue.index;
        v.token = pool.tokenOf(slot);
        src.onended = () => {
          if (v.src === src) {
            v.src = null;
            v.gain = null;
            v.cue = -1;
          }
          tail.disconnect();
        };
      }
      return true;
    },
    stopCue(i, now) {
      for (const bus of BUSES) {
        const list = nodes[bus];
        for (let k = 0; k < list.length; k++) {
          const v = list[k];
          if (v !== undefined && v.src !== null && v.cue === i) fadeOut(v, now);
        }
      }
    },
    activeVoices(now) {
      return pools.sfx.activeCount(now) + pools.ui.activeCount(now);
    },
  };
}
