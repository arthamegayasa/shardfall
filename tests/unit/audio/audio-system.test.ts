import { describe, expect, it } from 'vitest';
import { SimEventType } from '../../../src/core/index.ts';
import { createAudioSystem } from '../../../src/audio/audio-system.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import { cuesJson, events, instrumentsJson, pulseSongJson, routes, shopSongJson } from './audio-fixtures.ts';

const files = {
  cues: cuesJson,
  routes,
  instruments: instrumentsJson,
  songs: [pulseSongJson, shopSongJson],
};

describe('audio system', () => {
  it('builds from the real data without an AudioContext and stays silent before unlock', () => {
    const audio = createAudioSystem(fixtureGameData(), files);
    const w = createFakeWorld({ phase: 'pulse', enemies: 3 });
    expect(() => {
      audio.update(w, events([{ type: SimEventType.PulseStarted }, { type: SimEventType.PlayerDamaged }]), 1 / 60);
      audio.playUi('ui.confirm');
      audio.setPaused(true);
      audio.setHidden(true);
      audio.dispose();
    }).not.toThrow();
  });

  it('fails fast at boot on invalid audio data', () => {
    expect(() => createAudioSystem(fixtureGameData(), { ...files, cues: { cues: [{ id: 'x' }] } })).toThrow();
    expect(() =>
      createAudioSystem(fixtureGameData(), { ...files, routes: { ...routes, glint: 'sfx.missing.cue' } }),
    ).toThrow(/unknown cue/);
  });
});
