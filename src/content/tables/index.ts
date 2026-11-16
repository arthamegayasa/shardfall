// Table registry. To add a table: define it in one of these files (or a new one), add it to TABLES,
// and, when sim/UI need it typed, add a field to GameData in ../game-data.ts.
// Column changes: GD edits the column lists (content owner), LP reviews (format owner).

import type { AnyTableDef } from '../schema/index.ts';
import { configTable, shopTable } from './config.ts';
import { affixesTable, bossesTable, bossPatternsTable, enemiesTable } from './enemies.ts';
import { effectsTable, statusesTable, synergiesTable } from './effects.ts';
import {
  mementosTable,
  rarityTable,
  rarityWeightsTable,
  weaponsTable,
  weaponTiersTable,
} from './items.ts';
import { classesTable, levelUpTable, ritesTable, statsTable } from './player.ts';
import {
  biomesTable,
  difficultyTable,
  metaUnlocksTable,
  waveSpawnsTable,
  wavesTable,
} from './run.ts';

export * from './config.ts';
export * from './enemies.ts';
export * from './effects.ts';
export * from './enums.ts';
export * from './items.ts';
export * from './player.ts';
export * from './run.ts';

/** Every table the pipeline knows, in build order (order does not affect output). */
export const TABLES: readonly AnyTableDef[] = [
  configTable,
  shopTable,
  statsTable,
  classesTable,
  ritesTable,
  weaponsTable,
  weaponTiersTable,
  rarityTable,
  rarityWeightsTable,
  mementosTable,
  effectsTable,
  synergiesTable,
  levelUpTable,
  statusesTable,
  enemiesTable,
  affixesTable,
  bossesTable,
  bossPatternsTable,
  biomesTable,
  wavesTable,
  waveSpawnsTable,
  difficultyTable,
  metaUnlocksTable,
];
