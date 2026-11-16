import { describe, expect, it } from 'vitest';
import { PRIORITY_UI, parseCueTable, validateCueJson } from '../../../src/audio/cue-data.ts';
import { cuesJson } from './audio-fixtures.ts';

const layer = { kind: 'tone', wave: 'sine', freq: 440 };

describe('cues.json', () => {
  it('is valid', () => {
    expect(validateCueJson(cuesJson)).toEqual([]);
  });

  it('contains every core M1 cue', () => {
    const t = parseCueTable(cuesJson);
    const core = [
      'sfx.weapon.fire.bolt',
      'sfx.weapon.fire.lob',
      'sfx.weapon.fire.arc',
      'sfx.weapon.fire.chain',
      'sfx.weapon.fire.glaive',
      'sfx.weapon.orbit.contact',
      'sfx.weapon.impact.burst',
      'sfx.player.hit',
      'sfx.weapon.hit',
      'sfx.enemy.death.small',
      'sfx.enemy.charger.windup',
      'sfx.telegraph.area',
      'sfx.glint.pickup',
      'sfx.levelup',
      'ui.shop.buy',
      'ui.shop.reroll',
      'ui.shop.merge',
      'ui.confirm',
      'sfx.pulse.start_wave',
      'sfx.pulse.end_flash',
      'sfx.warden.arrive',
      'mus.stinger.defeat',
      'mus.stinger.victory',
      'sfx.memento.gain',
    ];
    for (const id of core) expect(t.indexOf.has(id), id).toBe(true);
  });

  it('keeps repeating player attacks quiet and short (audio-direction 9.2)', () => {
    const t = parseCueTable(cuesJson);
    for (const c of t.cues) {
      if (!c.id.startsWith('sfx.weapon.fire.')) continue;
      expect(c.priority, c.id).toBe(6);
      expect(c.gainDb, c.id).toBeLessThanOrEqual(-24);
      expect(c.durationMs, c.id).toBeLessThan(100);
      expect(c.maxVoices, c.id).toBeLessThanOrEqual(4);
      expect(c.sendRoom, c.id).toBe(0);
    }
  });
});

describe('parseCueTable', () => {
  it('applies defaults to optional fields', () => {
    const t = parseCueTable({
      cues: [{ id: 'sfx.a.b', bus: 'sfx', priority: 3, durationMs: 50, gainDb: -10, layers: [layer] }],
    });
    const c = t.cues[0];
    expect(c?.maxVoices).toBe(1);
    expect(c?.mode).toBe('buffer');
    expect(c?.pan).toBe('center');
    expect(c?.coalesceMaxBoostDb).toBe(0);
    expect(c?.sampleRate).toBe(24000);
  });

  it('maps ui priority "U" to the ui pool priority', () => {
    const t = parseCueTable({
      cues: [{ id: 'ui.a.b', bus: 'ui', priority: 'U', durationMs: 50, gainDb: -20, layers: [layer] }],
    });
    expect(t.cues[0]?.priority).toBe(PRIORITY_UI);
  });

  it('reports bad ids, duplicates, unknown layer kinds, and bad notes', () => {
    const errors = validateCueJson({
      cues: [
        { id: 'Bad Id', bus: 'sfx', priority: 3, durationMs: 50, gainDb: -10, layers: [layer] },
        { id: 'sfx.a.b', bus: 'sfx', priority: 3, durationMs: 50, gainDb: -10, layers: [{ kind: 'laser' }] },
        { id: 'sfx.a.b', bus: 'sfx', priority: 3, durationMs: 50, gainDb: -10, layers: [layer] },
        { id: 'sfx.c.d', bus: 'sfx', priority: 3, durationMs: 50, gainDb: -10, layers: [{ ...layer, freq: 'H9' }] },
        { id: 'ui.e.f', bus: 'ui', priority: 2, durationMs: 50, gainDb: -10, layers: [layer] },
      ],
    });
    expect(errors.some((e) => e.includes('Bad Id'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown kind'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicate'))).toBe(true);
    expect(errors.some((e) => e.includes('bad frequency'))).toBe(true);
    expect(errors.some((e) => e.includes('priority "U"'))).toBe(true);
  });

  it('throws listing every problem', () => {
    expect(() => parseCueTable({ cues: [{ id: 'sfx.a.b' }] })).toThrow(/Invalid cues.json/);
  });
});
