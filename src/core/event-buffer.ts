// Fixed-capacity struct-of-arrays event buffer (architecture.md 6.5). [Frozen M1]
// Sim writes one buffer per tick; app copies every tick into a FrameEvents buffer (same layout plus tick).
// Low-priority events are dropped first when full; the overflow counter is exposed for getPerf().

import type { SimEventReader } from './contracts/events.ts';
import { SimEventType } from './contracts/events.ts';

/** Per-tick sim buffer capacity. */
export const SIM_EVENT_CAPACITY = 256;
/** Frame buffer capacity (normal and e2e builds). */
export const FRAME_EVENT_CAPACITY = 1024;
export const FRAME_EVENT_CAPACITY_E2E = 4096;

const LOW_PRIORITY = new Uint8Array(256);
for (const t of [
  SimEventType.EnemyDamaged,
  SimEventType.WeaponFired,
  SimEventType.ProcTriggered,
  SimEventType.GlintCollected,
  SimEventType.GlintDropped,
  SimEventType.EnemySpawned,
]) {
  LOW_PRIORITY[t] = 1;
}

export function isLowPriorityEvent(type: number): boolean {
  return LOW_PRIORITY[type] === 1;
}

export interface EventBuffer extends SimEventReader {
  readonly capacity: number;
  /** Tick of each event (FrameEvents). All zero in a per-tick sim buffer. */
  readonly tick: ArrayLike<number>;
  /** Events dropped because the buffer was full, since creation or resetOverflow(). */
  readonly overflow: number;
  push(type: number, x: number, y: number, a: number, b: number, c: number): void;
  /** Append every event of another reader, stamping each with tick. */
  appendFrom(src: SimEventReader, tick: number): void;
  clear(): void;
  resetOverflow(): void;
}

export function createEventBuffer(capacity: number): EventBuffer {
  const type = new Uint8Array(capacity);
  const tick = new Int32Array(capacity);
  const x = new Float64Array(capacity);
  const y = new Float64Array(capacity);
  const a = new Float64Array(capacity);
  const b = new Float64Array(capacity);
  const c = new Float64Array(capacity);
  let count = 0;
  let overflow = 0;

  const copy = (to: number, from: number): void => {
    type[to] = type[from] ?? 0;
    tick[to] = tick[from] ?? 0;
    x[to] = x[from] ?? 0;
    y[to] = y[from] ?? 0;
    a[to] = a[from] ?? 0;
    b[to] = b[from] ?? 0;
    c[to] = c[from] ?? 0;
  };

  /** Remove the newest low-priority event to make room. Rare path: the O(n) shift keeps order. */
  const evictLowPriority = (): boolean => {
    for (let i = count - 1; i >= 0; i--) {
      if (LOW_PRIORITY[type[i] ?? 0] !== 1) continue;
      for (let j = i; j < count - 1; j++) copy(j, j + 1);
      count--;
      return true;
    }
    return false;
  };

  const pushAt = (
    t: number,
    tk: number,
    px: number,
    py: number,
    pa: number,
    pb: number,
    pc: number,
  ): void => {
    if (count >= capacity) {
      overflow++;
      if (LOW_PRIORITY[t] === 1 || !evictLowPriority()) return;
    }
    type[count] = t;
    tick[count] = tk;
    x[count] = px;
    y[count] = py;
    a[count] = pa;
    b[count] = pb;
    c[count] = pc;
    count++;
  };

  return {
    capacity,
    type,
    tick,
    x,
    y,
    a,
    b,
    c,
    get count() {
      return count;
    },
    get overflow() {
      return overflow;
    },
    push(t, px, py, pa, pb, pc) {
      pushAt(t, 0, px, py, pa, pb, pc);
    },
    appendFrom(src, tk) {
      for (let i = 0; i < src.count; i++) {
        pushAt(
          src.type[i] ?? 0,
          tk,
          src.x[i] ?? 0,
          src.y[i] ?? 0,
          src.a[i] ?? 0,
          src.b[i] ?? 0,
          src.c[i] ?? 0,
        );
      }
    },
    clear() {
      count = 0;
    },
    resetOverflow() {
      overflow = 0;
    },
  };
}
