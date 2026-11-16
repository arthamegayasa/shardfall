// String table check (LP, M1-09a): the real data and en.json pass; broken strings are caught.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RawGameData } from '../../src/content/index.ts';
import { checkStrings } from '../../tools/data/lib/check-strings.ts';

const root = process.cwd();
const raw = JSON.parse(readFileSync('content/generated/game-data.json', 'utf8')) as RawGameData;
const en = JSON.parse(readFileSync('content/strings/en.json', 'utf8')) as Record<string, string>;

describe('check-strings', () => {
  it('passes the shipped data and string table', () => {
    expect(checkStrings(root, raw, en).errors).toEqual([]);
  });

  it('catches unknown placeholders, long lines, long names, dashes and missing keys', () => {
    const { 'ui.shop.reroll': _dropped, ...rest } = en;
    const broken: Record<string, string> = {
      ...rest,
      'memento.coal_locket.desc': 'Hits have a {bogus}% chance to Burn.',
      'memento.whetstone.desc': 'This effect line is far too long to fit on a shop card.',
      'memento.glass_marble.name': 'A Very Long Marble Name',
      'ui.title.begin': `Begin ${String.fromCharCode(0x2014)} now`,
    };
    const errors = checkStrings(root, raw, broken).errors.join('\n');
    expect(errors).toContain('{bogus}');
    expect(errors).toContain('memento.whetstone.desc');
    expect(errors).toContain('memento.glass_marble.name');
    expect(errors).toContain('em or en dash');
    expect(errors).toContain('missing "ui.shop.reroll"');
  });
});
