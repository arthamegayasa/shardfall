// Per-frame trigger list: the event map writes cue triggers here, same-cue triggers of one frame
// merge into one (coalescing, audio-direction 8.4). Fixed capacity, reused every frame.

export const TRIGGER_CAPACITY = 128;

export interface TriggerList {
  count: number;
  readonly cue: Int32Array;
  /** Number of merged triggers (coalesce boost). */
  readonly hits: Int32Array;
  /** Running mean of world x, NaN when the trigger has no position. */
  readonly x: Float64Array;
  /** Pitch offset in semitones (max of merged triggers: the highest Glint rung wins). */
  readonly semis: Float64Array;
  /** Live-cue length in seconds (max of merged), 0 = recipe length. */
  readonly durSec: Float64Array;
  /** Extra delay before playing, seconds. */
  readonly delaySec: Float64Array;
  /** Clears the list. cueCount sizes the merge lookup. */
  reset(): void;
  /** Adds or merges a trigger. x = NaN for unpositioned sounds. */
  add(cue: number, x: number, semis: number, durSec: number, delaySec: number): void;
}

export function createTriggerList(cueCount: number): TriggerList {
  const slotOf = new Int32Array(cueCount).fill(-1);
  const list: TriggerList = {
    count: 0,
    cue: new Int32Array(TRIGGER_CAPACITY),
    hits: new Int32Array(TRIGGER_CAPACITY),
    x: new Float64Array(TRIGGER_CAPACITY),
    semis: new Float64Array(TRIGGER_CAPACITY),
    durSec: new Float64Array(TRIGGER_CAPACITY),
    delaySec: new Float64Array(TRIGGER_CAPACITY),
    reset() {
      for (let i = 0; i < list.count; i++) slotOf[list.cue[i] ?? 0] = -1;
      list.count = 0;
    },
    add(cue, x, semis, durSec, delaySec) {
      if (cue < 0 || cue >= cueCount) return;
      const s = slotOf[cue] ?? -1;
      if (s >= 0) {
        const h = (list.hits[s] ?? 1) + 1;
        list.hits[s] = h;
        const px = list.x[s] ?? Number.NaN;
        if (!Number.isNaN(x)) list.x[s] = Number.isNaN(px) ? x : px + (x - px) / h;
        if (semis > (list.semis[s] ?? 0)) list.semis[s] = semis;
        if (durSec > (list.durSec[s] ?? 0)) list.durSec[s] = durSec;
        return;
      }
      if (list.count >= TRIGGER_CAPACITY) return;
      const i = list.count++;
      slotOf[cue] = i;
      list.cue[i] = cue;
      list.hits[i] = 1;
      list.x[i] = x;
      list.semis[i] = semis;
      list.durSec[i] = durSec;
      list.delaySec[i] = delaySec;
    },
  };
  return list;
}
