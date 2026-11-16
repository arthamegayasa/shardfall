import { describe, expect, it } from 'vitest';
import { compileSong, computeLevel, notesForBar, parseChord } from '../../../src/audio/music/song.ts';
import type { CompiledSong, NoteEvent } from '../../../src/audio/music/song.ts';
import { levelFor, riserDue, songForPhase } from '../../../src/audio/music-director.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import { knownInstruments, pulseSongJson, shopSongJson } from './audio-fixtures.ts';

function compiled(json: unknown): CompiledSong {
  const errors: string[] = [];
  const song = compileSong(json, knownInstruments(), errors);
  expect(errors).toEqual([]);
  if (song === null) throw new Error('song did not compile');
  return song;
}

function bar(song: CompiledSong, index: number, level: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  notesForBar(song, index, level, out);
  return out;
}

describe('song data (validator A-5)', () => {
  it('compiles mus.biome1.pulse and mus.shop without errors', () => {
    expect(compiled(pulseSongJson).loopBars).toBe(16);
    expect(compiled(shopSongJson).loopBars).toBe(8);
  });

  it('reports wrong bar lengths, unknown chords, and unknown instruments', () => {
    const errors: string[] = [];
    compileSong(
      {
        id: 'mus.bad',
        bpm: 100,
        meter: [4, 4],
        stepsPerBeat: 4,
        form: ['A'],
        sections: { A: { chords: ['Dm', 'Xq'] } },
        layers: [
          { id: 'l', instrument: 'kazoo', type: 'melody', bySection: { A: ['D5:4', 'D5:16'] } },
        ],
      },
      knownInstruments(),
      errors,
    );
    expect(errors.some((e) => e.includes('unknown chord'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown instrument'))).toBe(true);
    expect(errors.some((e) => e.includes('expected 16'))).toBe(true);
  });

  it('parses chord symbols', () => {
    expect(parseChord('Dm')).toEqual({ root: 2, intervals: [0, 3, 7] });
    expect(parseChord('Bb')?.root).toBe(10);
    expect(parseChord('Csus4')?.intervals).toEqual([0, 5, 7]);
    expect(parseChord('Fmaj7')?.intervals).toEqual([0, 4, 7, 11]);
    expect(parseChord('Q')).toBeNull();
  });
});

describe('notesForBar', () => {
  it('plays the base layer at level 0: Dm pad, long bass, bell every 2 bars', () => {
    const song = compiled(pulseSongJson);
    const b0 = bar(song, 0, 0);
    const pad = b0.filter((n) => n.inst === 'string_pad').map((n) => n.midi);
    expect(pad).toEqual([50, 53, 57]);
    expect(b0.some((n) => n.inst === 'sub_bass' && n.midi === 38 && n.lenSteps === 8)).toBe(true);
    expect(b0.some((n) => n.inst === 'glass_bell' && n.midi === 74)).toBe(true);
    expect(bar(song, 1, 0).some((n) => n.inst === 'glass_bell')).toBe(false);
    expect(b0.some((n) => n.inst.startsWith('kit.'))).toBe(false);
  });

  it('swaps the long bass for the driving bass and adds percussion at level 1', () => {
    const song = compiled(pulseSongJson);
    const b0 = bar(song, 0, 1);
    expect(b0.filter((n) => n.inst === 'kit.kick').map((n) => n.step)).toEqual([0, 8, 10]);
    expect(b0.some((n) => n.inst === 'sub_bass' && n.lenSteps === 8)).toBe(false);
    expect(b0.filter((n) => n.inst === 'sub_bass').length).toBe(6);
  });

  it('adds the Motif of Light lead with its bell double at level 3', () => {
    const song = compiled(pulseSongJson);
    const b0 = bar(song, 0, 3);
    expect(b0.some((n) => n.inst === 'brass' && n.midi === 74 && n.step === 0 && n.lenSteps === 4)).toBe(true);
    expect(b0.some((n) => n.inst === 'glass_bell' && n.midi === 86 && n.step === 0)).toBe(true);
  });

  it('runs the shop arp over the chord tones', () => {
    const song = compiled(shopSongJson);
    // Fmaj7 at octave 4: F4 = 65; tokens 0 2 1+ 2 0+ 2 1+ 2 with stepLen 2.
    const arp = bar(song, 0, 0).filter((n) => n.inst === 'pluck').map((n) => n.midi);
    expect(arp).toEqual([65, 72, 81, 72, 77, 72, 81, 72]);
  });
});

describe('intensity', () => {
  const rules = () => {
    const r = compiled(pulseSongJson).intensity;
    if (r === null) throw new Error('no intensity');
    return r;
  };

  it('rises with progress and Pulse number (audio-direction 6.3)', () => {
    expect(computeLevel(rules(), 1, 0, 0, false)).toBe(0);
    expect(computeLevel(rules(), 1, 0.4, 0, false)).toBe(1);
    expect(computeLevel(rules(), 1, 0.75, 0, false)).toBe(2);
    expect(computeLevel(rules(), 4, 0.75, 0, false)).toBe(3);
    expect(computeLevel(rules(), 8, 0.4, 0, false)).toBe(3);
  });

  it('holds at least level 2 while a Warden lives and adds pressure for crowds', () => {
    expect(computeLevel(rules(), 1, 0, 0, true)).toBe(2);
    expect(computeLevel(rules(), 1, 0, 61, false)).toBe(1);
  });
});

describe('music director', () => {
  it('chooses the Pulse loop in Pulses and the shop music in pick phases', () => {
    expect(songForPhase('pulse')).toBe('mus.biome1.pulse');
    expect(songForPhase('levelUp')).toBe('mus.shop');
    expect(songForPhase('shop')).toBe('mus.shop');
    expect(songForPhase('pulseClear')).toBeNull();
    expect(songForPhase('defeat')).toBeNull();
  });

  it('reads the level from the WorldView', () => {
    const song = compiled(pulseSongJson);
    const w = createFakeWorld({ phase: 'pulse' });
    w.pulse = { ...w.pulse, ticksTotal: 1200, ticksLeft: 300 };
    expect(levelFor(song, w)).toBe(2);
    // MusicPressureChanged (Q21) adds the pressure step.
    expect(levelFor(song, w, true)).toBe(3);
    w.pulse = { ...w.pulse, isBoss: true };
    expect(levelFor(song, w)).toBe(3);
  });

  it('starts the riser 6 s before the end, never while a Warden holds the timer', () => {
    const w = createFakeWorld({ phase: 'pulse' });
    w.pulse = { ...w.pulse, ticksTotal: 1800, ticksLeft: 400 };
    expect(riserDue(w, 6)).toBe(false);
    w.pulse = { ...w.pulse, ticksLeft: 360 };
    expect(riserDue(w, 6)).toBe(true);
    w.pulse = { ...w.pulse, wardenAlive: true };
    expect(riserDue(w, 6)).toBe(false);
  });
});
