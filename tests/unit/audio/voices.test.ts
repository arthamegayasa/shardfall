import { describe, expect, it } from 'vitest';
import { DropReason, createVoicePool } from '../../../src/audio/voices.ts';

const sfxPool = () => createVoicePool({ capacity: 24, reserved: 4, reservedMaxPriority: 2, cueCount: 64 });

describe('voice pool', () => {
  it('drops triggers inside the minimum interval of the same cue', () => {
    const p = sfxPool();
    expect(p.request(0, 6, 4, 0.04, 1.0, 0.1)).toBeGreaterThanOrEqual(0);
    expect(p.request(0, 6, 4, 0.04, 1.02, 0.1)).toBe(-1);
    expect(p.lastDrop).toBe(DropReason.Interval);
    expect(p.request(0, 6, 4, 0.04, 1.05, 0.1)).toBeGreaterThanOrEqual(0);
  });

  it('steals the oldest instance of a cue at its maxVoices', () => {
    const p = sfxPool();
    const first = p.request(1, 6, 2, 0, 1.0, 5);
    const firstToken = p.tokenOf(first);
    p.request(1, 6, 2, 0, 1.1, 5);
    const third = p.request(1, 6, 2, 0, 1.2, 5);
    expect(third).toBe(first);
    expect(p.lastStolen).toBe(first);
    expect(p.lastStolenToken).toBe(firstToken);
    expect(p.activeCount(1.3)).toBe(2);
  });

  it('keeps 4 slots for priority 1 and 2 (danger and player hits never fail)', () => {
    const p = sfxPool();
    for (let c = 0; c < 20; c++) expect(p.request(c, 6, 4, 0, 1, 5)).toBeGreaterThanOrEqual(0);
    // A 21st low-priority sound finds no lower priority to steal and is dropped.
    expect(p.request(30, 6, 4, 0, 1, 5)).toBe(-1);
    expect(p.lastDrop).toBe(DropReason.Full);
    // A telegraph still gets a reserved slot without stealing.
    expect(p.request(31, 2, 4, 0, 1, 5)).toBeGreaterThanOrEqual(0);
    expect(p.lastStolen).toBe(-1);
  });

  it('steals the least important, then oldest, voice when full', () => {
    const p = sfxPool();
    const oldest = p.request(0, 5, 4, 0, 1.0, 5);
    for (let c = 1; c < 24; c++) p.request(c, c < 12 ? 6 : 2, 4, 0, 1.0 + c * 0.01, 5);
    // The oldest priority-6 voice goes first, not the older priority-5 one.
    const s = p.request(40, 1, 4, 0, 2, 1);
    expect(s).toBe(p.lastStolen);
    expect(s).not.toBe(oldest);
    expect(s).toBe(1);
  });

  it('lets an urgent cue take an equal-priority voice when everything is urgent', () => {
    const p = sfxPool();
    for (let c = 0; c < 24; c++) p.request(c, 1, 4, 0, 1 + c * 0.01, 5);
    expect(p.request(50, 1, 4, 0, 2, 1)).toBe(0);
    expect(p.request(51, 3, 4, 0, 2, 1)).toBe(-1);
  });

  it('frees voices whose sound has ended', () => {
    const p = sfxPool();
    p.request(0, 6, 4, 0, 1.0, 0.1);
    expect(p.activeCount(1.05)).toBe(1);
    expect(p.activeCount(1.2)).toBe(0);
  });
});
