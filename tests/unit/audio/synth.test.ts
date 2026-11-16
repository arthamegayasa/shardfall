import { describe, expect, it } from 'vitest';
import {
  IR_HALL,
  IR_ROOM,
  dbToGain,
  mixNote,
  noteToMidi,
  peakOf,
  pickRef,
  renderCue,
  renderInstrumentSample,
  renderIr,
} from '../../../src/audio/synth/index.ts';
import type { SynthRecipe } from '../../../src/audio/synth/index.ts';
import { parseInstruments } from '../../../src/audio/cue-data.ts';
import { instrumentsJson, realCues } from './audio-fixtures.ts';

const recipe = (over: Partial<SynthRecipe> = {}): SynthRecipe => ({
  id: 'sfx.test.tone',
  durationMs: 100,
  gainDb: -12,
  attackMs: 2,
  lowpassHz: null,
  highpassHz: null,
  layers: [
    { kind: 'tone', wave: 'saw', freq: 440, env: 'flat' },
    { kind: 'noise', gainDb: -12, filter: { type: 'bp', freq: 1000, freqEnd: 3000 } },
  ],
  ...over,
});

function same(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

describe('note names', () => {
  it('maps scientific pitch names to MIDI numbers', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('Bb4')).toBe(70);
    expect(noteToMidi('C#5')).toBe(73);
    expect(noteToMidi('D6')).toBe(86);
  });

  it('rejects malformed names', () => {
    expect(() => noteToMidi('H4')).toThrow();
  });
});

describe('renderCue', () => {
  it('renders the same buffer twice for the same recipe (deterministic DSP)', () => {
    const a = renderCue(recipe(), 24000);
    const b = renderCue(recipe(), 24000);
    expect(same(a, b)).toBe(true);
  });

  it('gives different noise for a different cue id', () => {
    const a = renderCue(recipe(), 24000);
    const b = renderCue(recipe({ id: 'sfx.test.other' }), 24000);
    expect(same(a, b)).toBe(false);
  });

  it('normalises the peak to gainDb', () => {
    const buf = renderCue(recipe({ gainDb: -9 }), 24000);
    expect(peakOf(buf)).toBeCloseTo(dbToGain(-9), 5);
  });

  it('renders live cues at the requested length', () => {
    const r = recipe({ layers: [{ kind: 'tone', wave: 'sine', freq: 1000, env: 'swell' }] });
    expect(renderCue(r, 24000, 600).length).toBe(Math.ceil(0.6 * 24000));
    expect(renderCue(r, 24000, 400).length).toBe(Math.ceil(0.4 * 24000));
  });

  it('trims inaudible tails of decaying sounds', () => {
    const r = recipe({ durationMs: 1000, layers: [{ kind: 'tone', wave: 'sine', freq: 500, decayMs: 100 }] });
    expect(renderCue(r, 24000).length).toBeLessThan(24000 * 0.3);
  });

  it('renders every cue of cues.json to finite samples within full scale', () => {
    for (const cue of realCues().cues) {
      const buf = renderCue(cue, cue.sampleRate);
      expect(buf.length, cue.id).toBeGreaterThan(0);
      let finite = true;
      for (let i = 0; i < buf.length; i++) if (!Number.isFinite(buf[i])) finite = false;
      expect(finite, cue.id).toBe(true);
      expect(peakOf(buf), cue.id).toBeLessThanOrEqual(dbToGain(cue.gainDb) + 1e-6);
    }
  });
});

describe('instrument samples', () => {
  it('renders each reference note deterministically', () => {
    const defs = parseInstruments(instrumentsJson);
    const bell = defs.get('glass_bell');
    expect(bell).toBeDefined();
    if (bell === undefined) return;
    const ref = bell.refNotes[0] ?? 66;
    expect(same(renderInstrumentSample(bell, ref), renderInstrumentSample(bell, ref))).toBe(true);
  });

  it('picks the nearest reference and the playback rate that reaches the note', () => {
    const r = pickRef([54, 66, 78], 69);
    expect(r.index).toBe(1);
    expect(r.rate).toBeCloseTo(Math.pow(2, 3 / 12), 10);
  });
});

describe('impulse responses', () => {
  it('builds stereo IRs of rt60 plus pre-delay with different channels', () => {
    const [l, r] = renderIr(IR_ROOM, 48000);
    expect(l.length).toBe(Math.round(0.008 * 48000) + Math.round(0.6 * 48000));
    expect(same(l, r)).toBe(false);
    const [h] = renderIr(IR_HALL, 48000);
    expect(h.length).toBeGreaterThan(l.length);
  });
});

describe('mixNote', () => {
  it('pans a centred note equally to both channels', () => {
    const l = new Float32Array(100);
    const r = new Float32Array(100);
    mixNote(l, r, 1000, {
      sample: new Float32Array(200).fill(1),
      sampleRate: 1000,
      rate: 1,
      startSec: 0,
      holdSec: 0.05,
      releaseSec: 0.01,
      gain: 1,
      pan: 0,
    });
    expect(l[10]).toBeCloseTo(r[10] ?? 0, 6);
    expect(l[10]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(l[80]).toBe(0);
  });
});
