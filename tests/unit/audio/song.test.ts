import { describe, expect, it } from 'vitest';
import {
  compileSong,
  computeLevel,
  createNoteBuffer,
  layerFade,
  notesForBar,
  parseChord,
} from '../../../src/audio/music/song.ts';
import type { CompiledSong, NoteEvent } from '../../../src/audio/music/song.ts';
import {
  bossLevel,
  createPressureLatch,
  levelFor,
  riserDue,
  songFor,
} from '../../../src/audio/music-director.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import {
  allSongJson,
  bossSongJson,
  knownInstruments,
  overlaySongJson,
  pulseSongJson,
  shopSongJson,
} from './audio-fixtures.ts';

function compiled(json: unknown): CompiledSong {
  const errors: string[] = [];
  const song = compileSong(json, knownInstruments(), errors);
  expect(errors).toEqual([]);
  if (song === null) throw new Error('song did not compile');
  return song;
}

function bar(song: CompiledSong, index: number, level: number, from = level): NoteEvent[] {
  const out = createNoteBuffer();
  notesForBar(song, index, level, out, from, 8);
  return out.items.slice(0, out.count).map((n) => ({ ...n }));
}

const layerOf = (song: CompiledSong, id: string): number => song.layers.findIndex((l) => l.id === id);

describe('song data (validator A-5)', () => {
  it('compiles every song file without errors', () => {
    expect(allSongJson.length).toBeGreaterThanOrEqual(14);
    for (const json of allSongJson) compiled(json);
    expect(compiled(pulseSongJson).loopBars).toBe(16);
    expect(compiled(shopSongJson).loopBars).toBe(16);
    expect(compiled(bossSongJson).loopBars).toBe(16);
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
          { id: 'r', instrument: 'string_pad', type: 'chord', rhythm: ['X_______________', 'X___'] },
          { id: 'v', instrument: 'string_pad', type: 'chord', rhythm: 'X_______________', minLevel: 5 },
        ],
      },
      knownInstruments(),
      errors,
    );
    expect(errors.some((e) => e.includes('unknown chord'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown instrument'))).toBe(true);
    expect(errors.some((e) => e.includes('expected 16'))).toBe(true);
    expect(errors.some((e) => e.includes('rhythm[1]'))).toBe(true);
    expect(errors.some((e) => e.includes('minLevel must be 0..4'))).toBe(true);
  });

  it('rejects a stale crowd count: MusicPressureChanged decides pressure (LP M1 review)', () => {
    const json = structuredClone(pulseSongJson) as { intensity: { pressure: Record<string, unknown> } };
    json.intensity.pressure['enemiesAlive'] = 60;
    const errors: string[] = [];
    compileSong(json, knownInstruments(), errors);
    expect(errors.join()).toMatch(/enemiesAlive is not used/);
  });

  it('reads stinger and overlay flags', () => {
    const stinger = allSongJson.map((j) => compiled(j)).find((s) => s.id === 'mus.stinger.victory');
    expect(stinger?.oneShot).toBe(true);
    expect(stinger?.loopBars).toBe(4);
    const overlay = compiled(overlaySongJson);
    expect(overlay.followsHost).toBe(true);
    expect(overlay.oneShot).toBe(false);
  });

  it('parses chord symbols', () => {
    expect(parseChord('Dm')).toEqual({ root: 2, intervals: [0, 3, 7] });
    expect(parseChord('Bb')?.root).toBe(10);
    expect(parseChord('Eb')?.root).toBe(3);
    expect(parseChord('Csus4')?.intervals).toEqual([0, 5, 7]);
    expect(parseChord('Fmaj7')?.intervals).toEqual([0, 4, 7, 11]);
    expect(parseChord('Q')).toBeNull();
  });
});

describe('notesForBar', () => {
  it('plays the base layers at level 0: Dm pad, long bass, the bell motif', () => {
    const song = compiled(pulseSongJson);
    const b0 = bar(song, 0, 0);
    const pad = b0.filter((n) => n.inst === 'string_pad').map((n) => n.midi);
    expect(pad).toEqual([50, 53, 57]);
    expect(b0.some((n) => n.inst === 'sub_bass' && n.midi === 38 && n.lenSteps === 8)).toBe(true);
    // Bell motif opens on D5 (head of the Motif of Light) and answers later in bar 2.
    expect(b0.some((n) => n.inst === 'glass_bell' && n.midi === 74 && n.step === 0)).toBe(true);
    expect(bar(song, 1, 0).filter((n) => n.inst === 'glass_bell').map((n) => n.step)).toEqual([8, 12]);
    expect(b0.some((n) => n.inst.startsWith('kit.'))).toBe(false);
  });

  it('swaps the long bass for the driving bass and adds percussion at level 1', () => {
    const song = compiled(pulseSongJson);
    const b0 = bar(song, 0, 1);
    expect(b0.filter((n) => n.inst === 'kit.kick').map((n) => n.step)).toEqual([0, 8, 10]);
    expect(b0.some((n) => n.inst === 'sub_bass' && n.lenSteps === 8)).toBe(false);
    expect(b0.filter((n) => n.inst === 'sub_bass').length).toBe(6);
  });

  it('varies phrases: fills at section ends, not a one-bar loop', () => {
    const song = compiled(pulseSongJson);
    const toms = (i: number): number[] => bar(song, i, 1).filter((n) => n.inst === 'kit.tom').map((n) => n.step);
    expect(toms(0)).toEqual([4, 12]);
    expect(toms(7)).toEqual([4, 10, 11, 12, 13, 14, 15]);
    expect(toms(15)).toEqual(toms(7));
    const snares = (i: number): number => bar(song, i, 2).filter((n) => n.inst === 'kit.snare').length;
    expect(snares(7)).toBeGreaterThan(snares(0));
    const arp = (i: number): string =>
      bar(song, i, 2)
        .filter((n) => n.inst === 'chip_arp')
        .map((n) => n.midi)
        .join();
    expect(arp(2)).not.toBe(arp(0));
  });

  it('adds the counter line at level 2 only and the Motif of Light lead at level 3', () => {
    const song = compiled(pulseSongJson);
    expect(bar(song, 0, 2).some((n) => n.inst === 'chip_lead')).toBe(true);
    const b3 = bar(song, 0, 3);
    expect(b3.some((n) => n.inst === 'chip_lead')).toBe(false);
    expect(b3.some((n) => n.inst === 'brass' && n.midi === 74 && n.step === 0 && n.lenSteps === 4)).toBe(true);
    expect(b3.some((n) => n.inst === 'glass_bell' && n.midi === 86 && n.step === 0)).toBe(true);
  });

  it('runs the shop arp over the chord tones', () => {
    const song = compiled(shopSongJson);
    // Fmaj7 at octave 4: F4 = 65; tokens 0 2 1+ 2 0+ 2 1+ 2 with stepLen 2.
    const arp = bar(song, 0, 0).filter((n) => n.inst === 'pluck').map((n) => n.midi);
    expect(arp).toEqual([65, 72, 81, 72, 77, 72, 81, 72]);
  });

  it('keeps only the first two beats of a layer that fades out (audio-direction 6.3)', () => {
    const song = compiled(pulseSongJson);
    const hold = layerOf(song, 'bass_hold');
    const drive = layerOf(song, 'bass_drive');
    const fading = bar(song, 3, 1, 0);
    const holdSteps = fading.filter((n) => n.layer === hold).map((n) => n.step);
    expect(holdSteps).toEqual([0]);
    expect(fading.some((n) => n.layer === drive && n.step >= 8)).toBe(true);
  });

  it('marks layer fades on level changes', () => {
    const song = compiled(pulseSongJson);
    const fade = (id: string, from: number, to: number): number => {
      const L = song.layers[layerOf(song, id)];
      if (L === undefined) throw new Error(id);
      return layerFade(L, from, to);
    };
    expect(fade('bass_hold', 0, 1)).toBe(-1);
    expect(fade('bass_drive', 0, 1)).toBe(1);
    expect(fade('pad', 0, 3)).toBe(0);
    expect(fade('lead', 2, 3)).toBe(1);
    expect(fade('counter', 2, 3)).toBe(-1);
  });

  it('reuses note objects bar after bar (no per-bar allocation)', () => {
    const song = compiled(pulseSongJson);
    const out = createNoteBuffer();
    notesForBar(song, 0, 3, out);
    const first = out.items[0];
    for (let i = 1; i < 16; i++) notesForBar(song, i, 3, out);
    // After one loop the pool holds the largest bar; the second loop allocates nothing.
    const size = out.items.length;
    for (let i = 16; i < 32; i++) notesForBar(song, i, 3, out);
    expect(out.items[0]).toBe(first);
    expect(out.items.length).toBe(size);
  });

  it('plays the boss at five levels, the enraged level adds the rage layers', () => {
    const song = compiled(bossSongJson);
    const ids = (lvl: number): Set<string> => new Set(bar(song, 0, lvl).map((n) => song.layers[n.layer]?.id ?? ''));
    expect([...ids(0)].sort()).toEqual(['choir_pad', 'drone']);
    expect(ids(3).has('lead')).toBe(true);
    expect(ids(3).has('rage_perc')).toBe(false);
    expect(ids(4).has('rage_perc')).toBe(true);
    expect(ids(4).has('rage_brass')).toBe(true);
    // Lead in section A only, its answer in section B (call and response).
    expect(bar(song, 8, 3).some((n) => song.layers[n.layer]?.id === 'lead')).toBe(false);
    expect(bar(song, 8, 3).some((n) => song.layers[n.layer]?.id === 'answer')).toBe(true);
  });
});

describe('intensity', () => {
  const rules = () => {
    const r = compiled(pulseSongJson).intensity;
    if (r === null) throw new Error('no intensity');
    return r;
  };

  it('rises with progress and Pulse number (audio-direction 6.3)', () => {
    expect(computeLevel(rules(), 1, 0, false, false)).toBe(0);
    expect(computeLevel(rules(), 1, 0.4, false, false)).toBe(1);
    expect(computeLevel(rules(), 1, 0.75, false, false)).toBe(2);
    expect(computeLevel(rules(), 4, 0.75, false, false)).toBe(3);
    expect(computeLevel(rules(), 8, 0.4, false, false)).toBe(3);
  });

  it('holds at least level 2 while a Warden lives and adds the pressure step', () => {
    expect(computeLevel(rules(), 1, 0, false, true)).toBe(2);
    expect(computeLevel(rules(), 1, 0, true, false)).toBe(1);
    expect(rules().pressure).toEqual({ add: 1, holdBars: 2 });
  });

  it('holds pressure at least two bars after the sim releases it', () => {
    const latch = createPressureLatch();
    const barSec = 2;
    expect(latch.active(0, barSec, 2)).toBe(false);
    latch.set(true, 10);
    expect(latch.active(10.5, barSec, 2)).toBe(true);
    latch.set(false, 11);
    expect(latch.active(13.9, barSec, 2)).toBe(true);
    expect(latch.active(14.1, barSec, 2)).toBe(false);
    latch.set(true, 20);
    latch.reset();
    expect(latch.active(20.1, barSec, 2)).toBe(false);
  });
});

describe('music director', () => {
  it('chooses the song from the phase and the boss state', () => {
    const w = createFakeWorld({ phase: 'idle' });
    expect(songFor(w, false)).toBe('mus.title');
    w.phase = 'pulse';
    expect(songFor(w, false)).toBe('mus.biome1.pulse');
    w.pulse = { ...w.pulse, isBoss: true };
    expect(songFor(w, false)).toBe('mus.biome1.boss');
    expect(songFor(w, true)).toBeNull();
    for (const phase of ['levelUp', 'shop', 'reward'] as const) {
      w.phase = phase;
      expect(songFor(w, false)).toBe('mus.shop');
    }
    w.phase = 'pulseClear';
    expect(songFor(w, false)).toBeNull();
    w.phase = 'victory';
    expect(songFor(w, false)).toBe('mus.end');
    w.phase = 'defeat';
    expect(songFor(w, false)).toBe('mus.end');
  });

  it('reads the Pulse level from the WorldView; a hasted Warden pushes to the top', () => {
    const song = compiled(pulseSongJson);
    const w = createFakeWorld({ phase: 'pulse' });
    w.pulse = { ...w.pulse, ticksTotal: 1200, ticksLeft: 300 };
    expect(levelFor(song, w)).toBe(2);
    expect(levelFor(song, w, true)).toBe(3);
    w.pulse = { ...w.pulse, ticksLeft: 1200, wardenAlive: true };
    expect(levelFor(song, w)).toBe(2);
    w.pulse = { ...w.pulse, warden: { ...w.pulse.warden, active: true, enraged: true } };
    expect(levelFor(song, w)).toBe(3);
  });

  it('follows the boss: intro, phase 1, late phase 1, phase 2, enraged (audio-direction 6.6)', () => {
    const song = compiled(bossSongJson);
    const b = song.intensity?.boss;
    if (b === undefined || b === null) throw new Error('no boss rules');
    const w = createFakeWorld({ phase: 'pulse' });
    const boss = { active: false, typeIndex: 0, hp: 1000, maxHp: 1000, shield: 0, phase: 1, enraged: false };
    w.pulse = { ...w.pulse, isBoss: true, boss };
    expect(bossLevel(b, w, { sinceSpawnSec: Number.NaN })).toBe(0);
    w.pulse = { ...w.pulse, boss: { ...boss, active: true } };
    expect(bossLevel(b, w, { sinceSpawnSec: 5 })).toBe(1);
    expect(bossLevel(b, w, { sinceSpawnSec: 31 })).toBe(2);
    w.pulse = { ...w.pulse, boss: { ...boss, active: true, hp: 700 } };
    expect(bossLevel(b, w, { sinceSpawnSec: 5 })).toBe(2);
    w.pulse = { ...w.pulse, boss: { ...boss, active: true, hp: 400, phase: 2 } };
    expect(bossLevel(b, w, { sinceSpawnSec: 60 })).toBe(3);
    w.pulse = { ...w.pulse, boss: { ...boss, active: true, hp: 400, phase: 2, enraged: true } };
    expect(levelFor(song, w, false, { sinceSpawnSec: 130 })).toBe(4);
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
