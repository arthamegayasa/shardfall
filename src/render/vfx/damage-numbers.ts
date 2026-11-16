// Damage numbers from EnemyDamaged frame events (AD; style-guide 1.8, ui-spec K9, architecture 7.4 L3).
// Ring buffer of fixed capacity: when full the oldest number is replaced. No allocation per frame.

import { DamageFlag, SimEventType } from '../../core/index.ts';
import type { AtlasSpriteEntry, SimEventReader } from '../../core/index.ts';
import type { SpriteBatch } from '../sprites/sprite-batch.ts';
import {
  DAMAGE_NUMBER_LIFE_SEC,
  damageAlpha,
  damageRisePx,
  digitOffsetX,
  digitsOf,
  MAX_DIGITS,
} from './damage-digits.ts';

export interface DamageNumbers {
  /** Read EnemyDamaged events of this frame. */
  ingest(events: SimEventReader, timeSec: number): void;
  /** Push glyph sprites for every live number into the L3 batch. */
  draw(batch: SpriteBatch, timeSec: number): void;
  setEnabled(on: boolean): void;
  clear(): void;
}

/** Glyph height above the hit point so the number starts over the Unlit, not on its feet (px). */
const START_HEIGHT_PX = 14;

export function createDamageNumbers(digits: AtlasSpriteEntry, capacity = 96): DamageNumbers {
  const normal = digits.animations['normal']?.frames ?? [];
  const crit = digits.animations['crit']?.frames ?? normal;
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const value = new Float32Array(capacity);
  const isCrit = new Uint8Array(capacity);
  const born = new Float64Array(capacity);
  const live = new Uint8Array(capacity);
  const jitter = new Int8Array(capacity);
  const scratch = new Uint8Array(MAX_DIGITS);
  let next = 0;
  let enabled = true;

  return {
    ingest(events, timeSec) {
      if (!enabled || normal.length < 10) return;
      for (let e = 0; e < events.count; e++) {
        if (events.type[e] !== SimEventType.EnemyDamaged) continue;
        const v = events.a[e] ?? 0;
        if (!(v > 0)) continue;
        const i = next;
        next = (next + 1) % capacity;
        x[i] = events.x[e] ?? 0;
        y[i] = events.y[e] ?? 0;
        value[i] = v;
        isCrit[i] = ((events.b[e] ?? 0) & DamageFlag.Crit) !== 0 ? 1 : 0;
        born[i] = timeSec;
        live[i] = 1;
        // Deterministic sideways spread (-3..3 px) so stacked hits stay readable.
        jitter[i] = ((i * 5) % 7) - 3;
      }
    },
    draw(batch, timeSec) {
      if (!enabled) return;
      for (let i = 0; i < capacity; i++) {
        if (live[i] === 0) continue;
        const age = timeSec - (born[i] ?? 0);
        if (age >= DAMAGE_NUMBER_LIFE_SEC || age < 0) {
          live[i] = 0;
          continue;
        }
        const frames = isCrit[i] === 1 ? crit : normal;
        const count = digitsOf(value[i] ?? 0, scratch);
        const rise = START_HEIGHT_PX + damageRisePx(age);
        const alpha = damageAlpha(age);
        for (let d = 0; d < count; d++) {
          const rect = frames[scratch[d] ?? 0];
          if (rect === undefined) continue;
          batch.push(
            x[i] ?? 0,
            y[i] ?? 0,
            0,
            rect,
            digits.anchor.x,
            digits.anchor.y,
            1,
            digitOffsetX(d, count) + (jitter[i] ?? 0),
            rise,
            0,
            0,
            0,
            0,
            alpha,
          );
        }
      }
    },
    setEnabled(on) {
      enabled = on;
      if (!on) live.fill(0);
    },
    clear() {
      live.fill(0);
    },
  };
}
