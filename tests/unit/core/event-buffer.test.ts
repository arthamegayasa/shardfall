import { describe, expect, it } from 'vitest';
import { createEventBuffer, SimEventType } from '../../../src/core/index.ts';

describe('event buffer', () => {
  it('stores events in SoA columns in push order', () => {
    const buf = createEventBuffer(4);
    buf.push(SimEventType.PlayerDamaged, 1, 2, 3, 4, 5);
    buf.push(SimEventType.EnemyKilled, 6, 7, 8, 9, 10);
    expect(buf.count).toBe(2);
    expect([buf.type[0], buf.x[0], buf.y[0], buf.a[0], buf.b[0], buf.c[0]]).toEqual([
      SimEventType.PlayerDamaged,
      1,
      2,
      3,
      4,
      5,
    ]);
    expect(buf.type[1]).toBe(SimEventType.EnemyKilled);
  });

  it('drops low-priority events first when full and counts overflow', () => {
    const buf = createEventBuffer(2);
    buf.push(SimEventType.EnemyDamaged, 0, 0, 1, 0, 0);
    buf.push(SimEventType.PlayerDamaged, 0, 0, 2, 0, 0);
    // Incoming high priority evicts the low-priority EnemyDamaged.
    buf.push(SimEventType.EnemyKilled, 0, 0, 3, 0, 0);
    expect(buf.count).toBe(2);
    expect([buf.type[0], buf.type[1]]).toEqual([
      SimEventType.PlayerDamaged,
      SimEventType.EnemyKilled,
    ]);
    // Incoming low priority is dropped.
    buf.push(SimEventType.WeaponFired, 0, 0, 4, 0, 0);
    expect(buf.count).toBe(2);
    expect(buf.overflow).toBe(2);
  });

  it('copies tick events into frame events with their tick', () => {
    const tickBuf = createEventBuffer(8);
    const frame = createEventBuffer(8);
    tickBuf.push(SimEventType.PulseStarted, 0, 0, 0, 0, 0);
    frame.appendFrom(tickBuf, 10);
    tickBuf.clear();
    tickBuf.push(SimEventType.RunEnded, 0, 0, 1, 0, 0);
    frame.appendFrom(tickBuf, 11);
    expect(frame.count).toBe(2);
    expect([frame.tick[0], frame.tick[1]]).toEqual([10, 11]);
    expect(frame.type[1]).toBe(SimEventType.RunEnded);
  });

  it('clears without reallocating', () => {
    const buf = createEventBuffer(2);
    const typeColumn = buf.type;
    buf.push(SimEventType.PhaseChanged, 0, 0, 1, 0, 0);
    buf.clear();
    expect(buf.count).toBe(0);
    expect(buf.type).toBe(typeColumn);
  });
});
