import { describe, expect, it } from 'vitest';
import { SimEventType } from '../../../src/core/index.ts';
import { createAudioSystem } from '../../../src/audio/audio-system.ts';
import type { AudioData } from '../../../src/audio/audio-system.ts';
import { runJob } from '../../../src/audio/render-jobs.ts';
import type { BufferRenderer, RenderJob } from '../../../src/audio/render-jobs.ts';
import { renderCue } from '../../../src/audio/synth/index.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import { allSongJson, cuesJson, events, instrumentsJson, realCues, routes } from './audio-fixtures.ts';
import { FakeAudioContext } from './fake-audio-context.ts';
import type { FakeSource } from './fake-audio-context.ts';

const files: AudioData = { cues: cuesJson, routes, instruments: instrumentsJson, songs: allSongJson };

/** Sources that played the buffer of cueId (same length and rate as its render). */
function playsOf(ctx: FakeAudioContext, cueId: string): FakeSource[] {
  const cue = realCues().cues.find((c) => c.id === cueId);
  if (cue === undefined) throw new Error(cueId);
  const len = renderCue(cue, cue.sampleRate).length;
  return ctx.started.filter((s) => s.buffer?.length === len && s.buffer.sampleRate === cue.sampleRate);
}

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
    // A stinger route that names no song file fails at boot too.
    const badStinger = { ...routes, stingers: { ...routes.stingers, byEvent: { PulseStarted: 'mus.stinger.none' } } };
    expect(() => createAudioSystem(fixtureGameData(), { ...files, routes: badStinger })).toThrow(/unknown song/);
  });

  it('closes the context and builds nothing when disposed while unlocking (LP M1 review)', async () => {
    const ctx = new FakeAudioContext('suspended');
    let open: () => void = () => undefined;
    ctx.resumeGate = new Promise<void>((r) => {
      open = r;
    });
    const audio = createAudioSystem(fixtureGameData(), files, { createContext: () => ctx.asContext() });
    const unlocking = audio.unlock();
    audio.dispose();
    open();
    await unlocking;
    expect(ctx.closed).toBe(true);
    expect(ctx.gains.length).toBe(0);
  });

  it('calls resume() again when unlock() is retried while the first resume hangs (LP M2 MINOR 2)', async () => {
    const ctx = new FakeAudioContext('suspended');
    // Strict activation: the first resume() never settles; a later gesture's resume() does.
    ctx.resumeGate = new Promise<void>(() => undefined);
    const audio = createAudioSystem(fixtureGameData(), files, { createContext: () => ctx.asContext() });
    const first = audio.unlock();
    await Promise.resolve();
    expect(ctx.resumeCalls).toBe(1);
    ctx.resumeGate = null;
    const second = audio.unlock();
    expect(second).toBe(first);
    expect(ctx.resumeCalls).toBe(2);
    await second;
    expect(ctx.state).toBe('running');
    expect(ctx.gains.length).toBeGreaterThan(0);
    // Once booted, further unlocks do not touch the context again.
    await audio.unlock();
    expect(ctx.resumeCalls).toBe(2);
    audio.dispose();
  });

  it('stops the low-HP creak under the pause menu and resumes one period after (LP M1 review)', async () => {
    const ctx = new FakeAudioContext();
    const audio = createAudioSystem(fixtureGameData(), files, { createContext: () => ctx.asContext() });
    await audio.unlock();
    const w = createFakeWorld({ phase: 'pulse' });
    w.pulse = { ...w.pulse, ticksTotal: 1800, ticksLeft: 1800 };
    const frame = (t: number, rows = events([])): void => {
      ctx.currentTime = t;
      audio.update(w, rows, 1 / 60);
    };
    frame(1, events([{ type: SimEventType.PlayerHpLowChanged, a: 1 }]));
    expect(playsOf(ctx, 'sfx.player.lowhp').length).toBe(1);
    frame(2.05);
    expect(playsOf(ctx, 'sfx.player.lowhp').length).toBe(2);
    audio.setPaused(true);
    frame(3.2);
    frame(4.5);
    expect(playsOf(ctx, 'sfx.player.lowhp').length).toBe(2);
    audio.setPaused(false);
    frame(5.0);
    expect(playsOf(ctx, 'sfx.player.lowhp').length).toBe(2);
    frame(5.6);
    expect(playsOf(ctx, 'sfx.player.lowhp').length).toBe(3);
    audio.dispose();
  });

  it('touches the duck gains only while a duck moves, not every frame (LP M1 review)', async () => {
    const ctx = new FakeAudioContext();
    const audio = createAudioSystem(fixtureGameData(), files, { createContext: () => ctx.asContext() });
    await audio.unlock();
    // createGraph makes the master gain first, then the five duck gains (engine.ts).
    const ducks = ctx.gains.slice(1, 6);
    const calls = (): number => ducks.reduce((n, g) => n + g.gain.calls.length, 0);
    const w = createFakeWorld({ phase: 'shop' });
    for (let i = 0; i < 30; i++) {
      ctx.currentTime = 1 + i / 60;
      audio.update(w, events([]), 1 / 60);
    }
    expect(calls()).toBe(0);
    ctx.currentTime = 2;
    audio.update(w, events([{ type: SimEventType.PlayerDamaged }]), 1 / 60);
    for (let i = 1; i < 60; i++) {
      ctx.currentTime = 2 + i / 60;
      audio.update(w, events([]), 1 / 60);
    }
    const afterDuck = calls();
    expect(afterDuck).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) {
      ctx.currentTime = 4 + i / 60;
      audio.update(w, events([]), 1 / 60);
    }
    // Released and settled: one final move back to 0 dB at most, then silence.
    expect(calls() - afterDuck).toBeLessThanOrEqual(ducks.length);
    const settled = calls();
    ctx.currentTime = 5;
    audio.update(w, events([]), 1 / 60);
    expect(calls()).toBe(settled);
    audio.dispose();
  });

  it('renders every boot job off the main thread when a worker is available', async () => {
    const ctx = new FakeAudioContext();
    const jobs: RenderJob[] = [];
    const worker: BufferRenderer = {
      offThread: true,
      render(job) {
        jobs.push(job);
        return Promise.resolve(runJob(job));
      },
      dispose() {
        // Nothing to stop.
      },
    };
    const audio = createAudioSystem(fixtureGameData(), files, {
      createContext: () => ctx.asContext(),
      createRenderer: () => worker,
    });
    await audio.unlock();
    expect(jobs.some((j) => j.kind === 'ir')).toBe(true);
    expect(jobs.some((j) => j.kind === 'instrument')).toBe(true);
    expect(jobs.filter((j) => j.kind === 'cue').length).toBeGreaterThan(80);
    audio.playUi('ui.confirm');
    expect(playsOf(ctx, 'ui.confirm').length).toBe(1);
    audio.dispose();
  });

  it('falls back to the main thread when the worker fails', async () => {
    const ctx = new FakeAudioContext();
    const broken: BufferRenderer = {
      offThread: true,
      render: () => Promise.reject(new Error('worker gone')),
      dispose() {
        // Nothing to stop.
      },
    };
    const audio = createAudioSystem(fixtureGameData(), files, {
      createContext: () => ctx.asContext(),
      createRenderer: () => broken,
    });
    await audio.unlock();
    audio.playUi('ui.confirm');
    expect(playsOf(ctx, 'ui.confirm').length).toBe(1);
    audio.dispose();
  });

  it('plays the title song on the title screen and stingers as one-shot songs', async () => {
    const ctx = new FakeAudioContext();
    const audio = createAudioSystem(fixtureGameData(), files, { createContext: () => ctx.asContext() });
    await audio.unlock();
    const w = createFakeWorld({ phase: 'idle' });
    ctx.currentTime = 1;
    audio.update(w, events([]), 1 / 60);
    const titleNotes = ctx.started.length;
    expect(titleNotes).toBeGreaterThan(0);
    w.phase = 'pulse';
    w.pulse = { ...w.pulse, ticksTotal: 1800, ticksLeft: 1800 };
    ctx.currentTime = 2;
    audio.update(w, events([{ type: SimEventType.PulseStarted }]), 1 / 60);
    ctx.currentTime = 2.1;
    audio.update(w, events([]), 1 / 60);
    // The stinger's low bells start right away (glass_bell samples looped from the bank).
    const fresh = ctx.started.slice(titleNotes).filter((s) => s.startedAt >= 2 && s.startedAt < 2.2);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    audio.dispose();
  });
});
