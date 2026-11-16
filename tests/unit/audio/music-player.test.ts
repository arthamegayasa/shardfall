import { describe, expect, it } from 'vitest';
import { parseInstruments } from '../../../src/audio/cue-data.ts';
import { createMusicPlayer, createSampleBank } from '../../../src/audio/music-player.ts';
import { compileSong } from '../../../src/audio/music/song.ts';
import type { CompiledSong } from '../../../src/audio/music/song.ts';
import { renderInstrumentSample } from '../../../src/audio/synth/index.ts';
import { allSongJson, instrumentsJson, knownInstruments, overlaySongJson, pulseSongJson } from './audio-fixtures.ts';
import { FakeAudioContext } from './fake-audio-context.ts';
import type { FakeGain } from './fake-audio-context.ts';

function compiled(json: unknown): CompiledSong {
  const errors: string[] = [];
  const song = compileSong(json, knownInstruments(), errors);
  if (song === null || errors.length > 0) throw new Error(errors.join('\n'));
  return song;
}

function setup() {
  const ctx = new FakeAudioContext();
  const out = ctx.createGain();
  const hall = ctx.createGain();
  const bank = createSampleBank(ctx.asContext());
  const player = createMusicPlayer(ctx.asContext(), out as unknown as AudioNode, hall as unknown as AudioNode, bank);
  return { ctx, bank, player };
}

const layerIndex = (song: CompiledSong, id: string): number => song.layers.findIndex((l) => l.id === id);

describe('music player', () => {
  it('fades layers in over one beat and out over two beats on the bar line (audio-direction 6.3)', () => {
    const { ctx, player } = setup();
    const song = compiled(pulseSongJson);
    const first = ctx.gains.length;
    player.play(song, 0, 0);
    const layerGain = (id: string): FakeGain => {
      const g = ctx.gains[first + 1 + layerIndex(song, id)];
      if (g === undefined) throw new Error(id);
      return g;
    };
    player.update(0);
    const bar1 = 0.05 + song.barSec;
    ctx.currentTime = bar1 - 0.1;
    player.update(1);
    const beat = song.barSec / 4;
    const drive = layerGain('bass_drive').gain.calls;
    expect(drive).toContainEqual({ kind: 'set', value: 0, time: bar1 });
    expect(drive.find((c) => c.kind === 'linear')).toEqual({ kind: 'linear', value: 1, time: bar1 + beat });
    const hold = layerGain('bass_hold').gain.calls;
    expect(hold).toContainEqual({ kind: 'set', value: 1, time: bar1 });
    expect(hold.find((c) => c.kind === 'linear')).toEqual({ kind: 'linear', value: 0, time: bar1 + 2 * beat });
    // Steady layers are never touched.
    expect(layerGain('pad').gain.calls.length).toBe(0);
  });

  it('fades the Warden overlay in over two beats and out over one bar', () => {
    const { ctx, player } = setup();
    const song = compiled(pulseSongJson);
    player.play(song, 0, 0);
    player.update(2);
    ctx.currentTime = 1;
    const before = ctx.gains.length;
    player.setOverlay(compiled(overlaySongJson));
    const g = ctx.gains[before];
    if (g === undefined) throw new Error('no overlay gain');
    expect(g.gain.calls.at(-1)).toEqual({ kind: 'linear', value: 1, time: 1 + (song.barSec / 4) * 2 });
    ctx.currentTime = 5;
    player.setOverlay(null);
    expect(g.gain.calls.at(-1)?.kind).toBe('target');
    expect(g.gain.calls.at(-1)?.value).toBe(0);
  });

  it('plays a stinger once and reports when its tail ends', () => {
    const { ctx, player } = setup();
    const victory = compiled(allSongJson.find((j) => (j as { id: string }).id === 'mus.stinger.victory'));
    ctx.currentTime = 3;
    const end = player.stinger(victory);
    expect(end).toBeCloseTo(3.02 + victory.loopBars * victory.barSec + victory.tailSec, 6);
  });

  it('silences the loop for the boss phase break and resumes on the next downbeat', () => {
    const { ctx, player } = setup();
    const song = compiled(allSongJson.find((j) => (j as { id: string }).id === 'mus.biome1.boss'));
    const first = ctx.gains.length;
    player.play(song, 0, 0);
    player.update(1);
    ctx.currentTime = 10;
    player.breakFor(1.5);
    const g = ctx.gains[first];
    if (g === undefined) throw new Error('no song gain');
    expect(g.gain.calls).toContainEqual({ kind: 'linear', value: 0, time: 10.08 });
    expect(g.gain.calls).toContainEqual({ kind: 'set', value: 0, time: 11.5 });
    expect(g.gain.calls.at(-1)).toEqual({ kind: 'linear', value: 1, time: 11.51 });
  });

  it('loops sustained instrument samples instead of needing long buffers', () => {
    const { ctx, bank, player } = setup();
    const insts = parseInstruments(instrumentsJson);
    const pad = insts.get('string_pad');
    if (pad === undefined) throw new Error('no pad');
    pad.refNotes.forEach((ref, k) => {
      bank.set(pad, k, renderInstrumentSample(pad, ref));
    });
    const song = compiled(pulseSongJson);
    player.play(song, 0, 0);
    player.update(0);
    const padNotes = ctx.started.filter((s) => s.buffer !== null && s.buffer.sampleRate === pad.sampleRate);
    expect(padNotes.length).toBe(3);
    for (const s of padNotes) {
      expect(s.loop).toBe(true);
      expect(s.loopStart).toBeCloseTo((pad.loop?.startMs ?? 0) / 1000, 6);
      // Held a whole bar, then released: longer than the 1.6 s sample.
      expect(s.stoppedAt - s.startedAt).toBeGreaterThan(song.barSec);
    }
  });
});
