// Damage numbers from EnemyDamaged frame events (AD; style-guide 1.8, ui-spec K9, architecture 7.4 L3).
// Fixed ring of slots, no allocation per frame. M2: at most DAMAGE_NUMBER_CAP alive (LP damage-cap.ts:
// the oldest normal number goes first, crits last), numbers are pushed sideways out of the player
// sprite box, and crits use the larger kept-cyan 4x6 digit set (CD K4).

import { DamageFlag, SimEventType } from '../../core/index.ts';
import type { AtlasSpriteEntry, SimEventReader } from '../../core/index.ts';
import type { SpriteBatch } from '../sprites/sprite-batch.ts';
import { DAMAGE_NUMBER_CAP, pickDamageSlot, playerBoxPushPx } from '../pipeline/damage-cap.ts';
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
  /** Push glyph sprites for every live number into the L3 batch. playerX/Y = player feet (u). */
  draw(batch: SpriteBatch, timeSec: number, playerX?: number, playerY?: number): void;
  setEnabled(on: boolean): void;
  clear(): void;
}

/** Glyph height above the hit point so the number starts over the Unlit, not on its feet (px). */
const START_HEIGHT_PX = 14;
/** Glyph advance and height per set: normal 3x5 (+1 outline), crit 4x6 (+1 outline). */
const NORMAL = { advance: 4, height: 7 } as const;
const CRIT = { advance: 5, height: 8 } as const;

export function createDamageNumbers(digits: AtlasSpriteEntry, capacity = 48): DamageNumbers {
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
  let serial = 0;
  let enabled = true;
  const cap = Math.min(capacity, DAMAGE_NUMBER_CAP);

  const expire = (timeSec: number): void => {
    for (let i = 0; i < capacity; i++) {
      const age = timeSec - (born[i] ?? 0);
      if (live[i] === 1 && (age >= DAMAGE_NUMBER_LIFE_SEC || age < 0)) live[i] = 0;
    }
  };

  return {
    ingest(events, timeSec) {
      if (!enabled || normal.length < 10) return;
      expire(timeSec);
      for (let e = 0; e < events.count; e++) {
        if (events.type[e] !== SimEventType.EnemyDamaged) continue;
        const v = events.a[e] ?? 0;
        if (!(v > 0)) continue;
        const i = pickDamageSlot(live, isCrit, born, cap);
        x[i] = events.x[e] ?? 0;
        y[i] = events.y[e] ?? 0;
        value[i] = v;
        isCrit[i] = ((events.b[e] ?? 0) & DamageFlag.Crit) !== 0 ? 1 : 0;
        born[i] = timeSec;
        live[i] = 1;
        // Deterministic sideways spread (-3..3 px) so stacked hits stay readable.
        jitter[i] = ((serial++ * 5) % 7) - 3;
      }
    },
    draw(batch, timeSec, playerX, playerY) {
      if (!enabled) return;
      for (let i = 0; i < capacity; i++) {
        if (live[i] === 0) continue;
        const age = timeSec - (born[i] ?? 0);
        if (age >= DAMAGE_NUMBER_LIFE_SEC || age < 0) {
          live[i] = 0;
          continue;
        }
        const c = isCrit[i] === 1;
        const set = c ? CRIT : NORMAL;
        const frames = c ? crit : normal;
        const count = digitsOf(value[i] ?? 0, scratch);
        const rise = START_HEIGHT_PX + damageRisePx(age);
        const alpha = damageAlpha(age);
        const nx = x[i] ?? 0;
        const ny = y[i] ?? 0;
        const halfW = Math.ceil((count * set.advance) / 2);
        const push =
          playerX === undefined || playerY === undefined
            ? 0
            : playerBoxPushPx(nx, ny, rise, halfW, set.height, playerX, playerY);
        for (let d = 0; d < count; d++) {
          const rect = frames[scratch[d] ?? 0];
          if (rect === undefined) continue;
          const ox = c
            ? d * set.advance - Math.floor(((count - 1) * set.advance) / 2)
            : digitOffsetX(d, count);
          batch.push(
            nx,
            ny,
            0,
            rect,
            digits.anchor.x,
            digits.anchor.y,
            1,
            ox + (jitter[i] ?? 0) + push,
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
