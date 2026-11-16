// Fixture data loader for unit tests (architecture.md 14.1 D-7, coding-standards 6.3).
// Builds GameData from tests/fixtures/data/ with the real pipeline, so sim tests never read balance data.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildGameData, buildRaw } from '../../src/content/index.ts';
import type { BuildInput, BuildOutput, ContentTier, GameData } from '../../src/content/index.ts';

export const FIXTURE_DATA_DIR = resolve(import.meta.dirname, '..', 'fixtures', 'data');

function readByExt(dir: string, ext: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).sort()) {
    if (f.endsWith(ext)) out[f.slice(0, -ext.length)] = readFileSync(join(dir, f), 'utf8');
  }
  return out;
}

export function fixtureInput(tier: ContentTier = 'A', dir: string = FIXTURE_DATA_DIR): BuildInput {
  return {
    csv: readByExt(dir, '.csv'),
    levels: readByExt(join(dir, 'levels'), '.json'),
    strings: null,
    contentTier: tier,
  };
}

export function buildFixture(tier: ContentTier = 'A'): BuildOutput {
  return buildRaw(fixtureInput(tier));
}

/** GameData from fixtures. Throws with the build report when the fixtures are invalid. */
export function fixtureGameData(tier: ContentTier = 'A'): GameData {
  const out = buildFixture(tier);
  if (!out.ok) throw new Error(`fixture data invalid:\n${out.report.errors.join('\n')}`);
  return buildGameData(out.data, { freeze: true });
}
