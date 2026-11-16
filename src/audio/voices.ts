// Voice limiting and priority stealing (audio-direction 8.3). Pure and allocation-free per request:
// the engine asks for a slot with the audio clock time, the pool answers grant, steal, or drop.

export interface VoicePoolConfig {
  /** Total instances on this bus (sfx 24, ui 6). */
  readonly capacity: number;
  /** Slots only priorities <= reservedMaxPriority may take (sfx: 4 slots for priority 1 and 2). */
  readonly reserved: number;
  readonly reservedMaxPriority: number;
  /** Number of cues, for per-cue counters. */
  readonly cueCount: number;
}

export const DropReason = { None: 0, Interval: 1, Full: 2 } as const;
export type DropReason = (typeof DropReason)[keyof typeof DropReason];

export interface VoicePool {
  /**
   * Requests a slot. Returns the slot index, or -1 when the trigger is dropped (see lastDrop).
   * When a voice had to be stolen, lastStolen holds its slot (already reused by the new voice)
   * and lastStolenToken the token it was granted with, so the engine fades out the right node.
   */
  request(
    cue: number,
    priority: number,
    maxVoices: number,
    minIntervalSec: number,
    nowSec: number,
    durSec: number,
  ): number;
  readonly lastStolen: number;
  readonly lastStolenToken: number;
  readonly lastDrop: DropReason;
  /** Token of the voice currently in slot (increments on every grant). */
  tokenOf(slot: number): number;
  activeCount(nowSec: number): number;
  /** Forget every voice (context closed or suspended for long). */
  clear(): void;
}

export function createVoicePool(cfg: VoicePoolConfig): VoicePool {
  const n = cfg.capacity;
  const cue = new Int32Array(n).fill(-1);
  const prio = new Int32Array(n);
  const start = new Float64Array(n);
  const end = new Float64Array(n);
  const token = new Int32Array(n);
  const lastStart = new Float64Array(cfg.cueCount).fill(-Infinity);
  let nextToken = 1;

  const pool = {
    lastStolen: -1,
    lastStolenToken: 0,
    lastDrop: DropReason.None as DropReason,
    request(c: number, p: number, maxV: number, minInt: number, now: number, dur: number): number {
      pool.lastStolen = -1;
      pool.lastStolenToken = 0;
      pool.lastDrop = DropReason.None;
      // Triggers inside the minimum interval are dropped, never queued (8.3 rule 1).
      if (now - (lastStart[c] ?? -Infinity) < minInt) {
        pool.lastDrop = DropReason.Interval;
        return -1;
      }
      let active = 0;
      let free = -1;
      let sameCount = 0;
      let oldestSame = -1;
      for (let i = 0; i < n; i++) {
        if ((cue[i] ?? -1) >= 0 && (end[i] ?? 0) <= now) cue[i] = -1;
        if ((cue[i] ?? -1) < 0) {
          if (free < 0) free = i;
          continue;
        }
        active++;
        if (cue[i] === c) {
          sameCount++;
          if (oldestSame < 0 || (start[i] ?? 0) < (start[oldestSame] ?? 0)) oldestSame = i;
        }
      }
      let slot: number;
      if (sameCount >= maxV) {
        // Per-cue limit: the freshest trigger wins over the oldest instance of the same cue.
        slot = oldestSame;
      } else {
        const limit = p <= cfg.reservedMaxPriority ? n : n - cfg.reserved;
        if (active < limit && free >= 0) slot = free;
        else slot = pickVictim(p, p <= cfg.reservedMaxPriority);
      }
      if (slot < 0) {
        pool.lastDrop = DropReason.Full;
        return -1;
      }
      if ((cue[slot] ?? -1) >= 0) {
        pool.lastStolen = slot;
        pool.lastStolenToken = token[slot] ?? 0;
      }
      cue[slot] = c;
      prio[slot] = p;
      start[slot] = now;
      end[slot] = now + dur;
      token[slot] = nextToken++;
      lastStart[c] = now;
      return slot;
    },
    tokenOf(slot: number): number {
      return token[slot] ?? 0;
    },
    activeCount(now: number): number {
      let a = 0;
      for (let i = 0; i < n; i++) if ((cue[i] ?? -1) >= 0 && (end[i] ?? 0) > now) a++;
      return a;
    },
    clear(): void {
      cue.fill(-1);
      lastStart.fill(-Infinity);
    },
  };

  /**
   * Least important first (largest priority number), then oldest. Urgent cues (priority 1-2)
   * may also take an equal-priority voice so danger and player hits never fail to sound (8.3 rule 3).
   */
  function pickVictim(p: number, urgent: boolean): number {
    let best = -1;
    for (let i = 0; i < n; i++) {
      if ((cue[i] ?? -1) < 0) continue;
      const pi = prio[i] ?? 0;
      if (pi < p || (pi === p && !urgent)) continue;
      if (
        best < 0 ||
        pi > (prio[best] ?? 0) ||
        (pi === prio[best] && (start[i] ?? 0) < (start[best] ?? 0))
      ) {
        best = i;
      }
    }
    return best;
  }

  return pool;
}
