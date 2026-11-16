// Real game data for QA tests (M1-09b): content/generated/game-data.json built with the real loader.
// Tests on real data check validity, invariants, and determinism only; no balance numbers are copied
// here (test-plan 1.3, architecture 14.2).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGameData } from '../../../../src/content/index.ts';
import type { GameData, RawGameData } from '../../../../src/content/index.ts';

let cached: GameData | null = null;

export function realGameData(): GameData {
  if (cached !== null) return cached;
  const raw = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, '../../../../content/generated/game-data.json'),
      'utf8',
    ),
  ) as RawGameData;
  cached = buildGameData(raw, { freeze: true });
  return cached;
}

/** Axis-aligned bounds of an arena boundary polygon (world units). */
export function arenaBounds(
  data: GameData,
  index: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const b = data.arenas[index]?.arena.boundary ?? [[0, 0]];
  const xs = b.map((p) => p[0]);
  const ys = b.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
