// Measured SFX rules (audio-direction 5.2, 9.1, 9.2) and the buffer budget (2.2, test A-7).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGameData } from '../../../src/content/index.ts';
import type { RawGameData } from '../../../src/content/index.ts';
import { parseInstruments } from '../../../src/audio/cue-data.ts';
import { liveWarmupPairs } from '../../../src/audio/event-map.ts';
import { createBiquad, renderCue } from '../../../src/audio/synth/index.ts';
import { BUFFER_BUDGET_BYTES, measureBudget } from '../../../tools/audio/lib/budget.ts';
import { instrumentsJson, realCues, routes } from './audio-fixtures.ts';

/** Share of the energy between 1 and 3 kHz, the band reserved for danger. */
function dangerBandShare(buf: Float32Array, sr: number): number {
  const hp = createBiquad();
  const lp = createBiquad();
  hp.set('hp', 1000, 0.707, sr);
  lp.set('lp', 3000, 0.707, sr);
  let all = 0;
  let band = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] ?? 0;
    all += x * x;
    const y = lp.process(hp.process(x));
    band += y * y;
  }
  return all > 0 ? band / all : 0;
}

describe('SFX rules', () => {
  const cues = realCues().cues.filter((c) => !c.deprecated);

  it('keeps player attacks and hits out of the danger band (audio-direction 5.2)', () => {
    const own = cues.filter((c) => c.id.startsWith('sfx.weapon.'));
    expect(own.length).toBeGreaterThanOrEqual(10);
    for (const c of own) {
      expect(dangerBandShare(renderCue(c, c.sampleRate), c.sampleRate), c.id).toBeLessThan(0.25);
    }
  });

  it('puts every Tier A danger windup mainly in the danger band', () => {
    const windups = cues.filter((c) => c.tier === 'A' && c.priority === 2 && c.mode === 'live');
    expect(windups.length).toBeGreaterThanOrEqual(9);
    for (const c of windups) {
      expect(dangerBandShare(renderCue(c, c.sampleRate), c.sampleRate), c.id).toBeGreaterThan(0.3);
    }
  });

  it('follows the repeat rules for attacks, hits, deaths, and Glint (audio-direction 9.2)', () => {
    const repeated = cues.filter(
      (c) =>
        c.id.startsWith('sfx.weapon.') ||
        c.id.startsWith('sfx.enemy.death.') ||
        c.id === 'sfx.glint.pickup',
    );
    for (const c of repeated) {
      expect(c.maxVoices, c.id).toBeLessThanOrEqual(4);
      expect(c.minIntervalMs, c.id).toBeGreaterThanOrEqual(35);
      // Tank deaths are rare and keep "a little room" (audio-list 5); every other repeat is dry.
      if (c.id === 'sfx.enemy.death.large') expect(c.sendRoom).toBeLessThanOrEqual(0.2);
      else expect(c.sendRoom, c.id).toBe(0);
      if (c.id.startsWith('sfx.weapon.fire.')) {
        expect(c.durationMs, c.id).toBeLessThanOrEqual(80);
        expect(c.gainDb, c.id).toBeLessThanOrEqual(-24);
        expect(c.pitchJitter, c.id).toBeCloseTo(0.06, 6);
      }
    }
  });

  it('keeps the Rite landing the loudest player sound and hits far below the player hit', () => {
    const db = (id: string): number => cues.find((c) => c.id === id)?.gainDb ?? 0;
    expect(db('sfx.rite.impact.lantern')).toBeGreaterThan(db('sfx.weapon.fire.lob'));
    expect(db('sfx.rite.impact.lantern')).toBeGreaterThanOrEqual(db('sfx.levelup'));
    expect(db('sfx.player.hit') - db('sfx.weapon.hit')).toBeGreaterThanOrEqual(18);
  });
});

describe('buffer budget (A-7)', () => {
  it('stays under 8 MB with every boot buffer rendered', () => {
    const raw = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../content/generated/game-data.json'), 'utf8'),
    ) as RawGameData;
    const warmup = liveWarmupPairs(buildGameData(raw), routes);
    const r = measureBudget(realCues(), parseInstruments(instrumentsJson), warmup);
    expect(r.totalBytes).toBeLessThan(BUFFER_BUDGET_BYTES);
    expect(r.liveBytes).toBeGreaterThan(0);
  });
});
