import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../src/ui/strings.ts';
import { tierKey } from '../../../src/ui/presenters/content.ts';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const UI_SRC = join(ROOT, 'src', 'ui');

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts') && name !== 'cues.ts') out.push(p);
  }
  return out;
}

/** Every literal 'ui.*' string key used by UI code (cue ids live in cues.ts and are excluded). */
function usedUiKeys(): string[] {
  const keys = new Set<string>();
  for (const f of tsFiles(UI_SRC)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/'(ui\.[a-z0-9_.]+)'/g)) {
      if (m[1] !== undefined) keys.add(m[1]);
    }
  }
  return [...keys].sort();
}

/** Keys listed in ui-spec Lampiran A (the contract with WR for UI strings). */
function appendixKeys(): Set<string> {
  const spec = readFileSync(join(ROOT, 'docs', 'ui', 'ui-spec.md'), 'utf8');
  const start = spec.indexOf('## Lampiran A');
  expect(start).toBeGreaterThan(0);
  const keys = new Set<string>();
  for (const m of spec.slice(start).matchAll(/`(ui\.[a-z0-9_.]+)`/g)) {
    if (m[1] !== undefined) keys.add(m[1]);
  }
  return keys;
}

describe('UI translator', () => {
  const table = {
    'ui.hud.pulse': 'Pulse {n}',
    'ui.x.one': '{count} foe',
    'ui.x.other': '{count} foes',
  };

  it('fills parameters from the string table', () => {
    expect(createTranslator(table).t('ui.hud.pulse', { n: 7 })).toBe('Pulse 7');
  });

  it('picks plural forms by count', () => {
    const { t } = createTranslator(table);
    expect(t('ui.x', { count: 1 })).toBe('1 foe');
    expect(t('ui.x', { count: 3 })).toBe('3 foes');
  });

  it('falls back to the key itself in release and [[key]] in dev, and records it', () => {
    const rel = createTranslator(table);
    expect(rel.t('ui.title.begin')).toBe('ui.title.begin');
    expect(rel.missing()).toEqual(['ui.title.begin']);
    expect(createTranslator(table, { dev: true }).t('ui.title.begin')).toBe('[[ui.title.begin]]');
  });
});

describe('UI string keys', () => {
  it('lists every ui.* key used by UI code in ui-spec Lampiran A', () => {
    const listed = appendixKeys();
    const missing = usedUiKeys().filter((k) => !listed.has(k));
    expect(missing).toEqual([]);
  });

  it('lists the composed tier keys in Lampiran A', () => {
    const listed = appendixKeys();
    for (const tier of [1, 2, 3, 4]) expect(listed.has(tierKey(tier))).toBe(true);
  });

  it('never writes the retired term keepsake in UI code (CD K1)', () => {
    for (const f of tsFiles(UI_SRC))
      expect(readFileSync(f, 'utf8').toLowerCase()).not.toContain('keepsake');
  });
});
