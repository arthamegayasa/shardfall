// Sim fixture data (GP, M1-03): tests/unit/sim/fixtures/data, built with the real pipeline.
// Richer than tests/fixtures/data: full run profiles (run_a with Warden and boss, run_a_m1), the 12
// tier A Mementos, synergies 2/4/6. Invented values close to the GDD; not balance data (D-7).

import { resolve } from 'node:path';
import { buildGameData, buildRaw } from '../../../../src/content/index.ts';
import type { ContentTier, GameData } from '../../../../src/content/index.ts';
import { fixtureInput } from '../../../support/fixture-data.ts';

export const SIM_FIXTURE_DIR = resolve(import.meta.dirname, '..', 'fixtures', 'data');

const cache = new Map<ContentTier, GameData>();

export function simFixtureData(tier: ContentTier = 'A'): GameData {
  const hit = cache.get(tier);
  if (hit !== undefined) return hit;
  const out = buildRaw(fixtureInput(tier, SIM_FIXTURE_DIR));
  if (!out.ok) throw new Error(`sim fixture data invalid:\n${out.report.errors.join('\n')}`);
  const data = buildGameData(out.data, { freeze: true });
  cache.set(tier, data);
  return data;
}
