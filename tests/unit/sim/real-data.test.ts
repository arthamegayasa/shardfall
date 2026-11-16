// Real data (content/generated/game-data.json, GD): invariants only, no balance numbers
// (architecture 14.1 D-7, coding-standards 6.3). Skipped while required tables are still missing.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TICK_RATE, toHex8 } from '../../../src/core/index.ts';
import { buildGameData } from '../../../src/content/index.ts';
import type { RawGameData } from '../../../src/content/index.ts';
import { createSim } from '../../../src/sim/index.ts';
import { runBot } from './support/bot.ts';

const raw = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../content/generated/game-data.json'), 'utf8'),
) as RawGameData;
const data = buildGameData(raw, { freeze: true });
const ready =
  data.classes.length > 0 && Object.keys(data.profiles).length > 0 && data.arenas.length > 0;
const MAX_TICKS = TICK_RATE * 60 * 30;

describe.skipIf(!ready)('sim on the real game data', () => {
  it('the bot finishes every profile without errors', () => {
    const cls = data.classes[0]?.id ?? '';
    for (const profile of Object.keys(data.profiles).sort()) {
      const r = runBot(createSim({ data }), { seed: 11, classId: cls, profile }, MAX_TICKS);
      expect(r.outcome, profile).not.toBe('timeout');
    }
  });

  it('is deterministic between two runs (hash compared run to run, never stored)', () => {
    const cls = data.classes[0]?.id ?? '';
    const profile = Object.keys(data.profiles).sort()[0] ?? '';
    const hashes: string[][] = [[], []];
    for (const k of [0, 1]) {
      runBot(createSim({ data }), { seed: 3, classId: cls, profile }, 4000, (s) => {
        if (s.view.tick % 60 === 0) hashes[k]?.push(toHex8(s.hash()));
      });
    }
    expect(hashes[0]?.length).toBeGreaterThan(10);
    expect(hashes[1]).toEqual(hashes[0]);
  });
});
