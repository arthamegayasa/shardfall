// GameData: the typed, converted data every module reads (architecture.md 6.9, 9.4). [Frozen M1 shape]
// Row types are inferred from the table schemas in ./tables, so a column change updates the type.
// buildGameData converts raw JSON (data units) to GameData (ticks, u/tick, turns) once at load.

import type {
  AffixIndex,
  ArenaDef,
  ClassIndex,
  EffectIndex,
  EnemyTypeIndex,
  MementoIndex,
  RiteIndex,
  StatIndex,
  TagIndex,
  WeaponIndex,
} from '../core/index.ts';
import type { RawGameData, RawRow } from './build-raw.ts';
import { outKeyOf } from './schema/index.ts';
import type { ParamsRaw, RowOut, Schema } from './schema/index.ts';
import type { ContentTier, TagId } from './tables/index.ts';
import * as T from './tables/index.ts';

export type ConfigValues = RowOut<(typeof T.configTable)['keys']>;
export type ShopConfig = RowOut<(typeof T.shopTable)['keys']>;
export type StatDef = RowOut<(typeof T.statsTable)['columns']>;
export type ClassDef = RowOut<(typeof T.classesTable)['columns']>;
export type RiteDef = RowOut<(typeof T.ritesTable)['columns']>;
export interface WeaponTierDef {
  /** 1 to 4. Tier 1 is the weapons.csv row itself (empty params). */
  readonly tier: number;
  /** Cumulative bonus params relative to the previous tier. */
  readonly params: ParamsRaw;
  readonly effects: readonly string[];
}
export type WeaponDef = RowOut<(typeof T.weaponsTable)['columns']> & {
  readonly tiers: readonly WeaponTierDef[];
};
export type RarityDef = RowOut<(typeof T.rarityTable)['columns']>;
export type RarityWeightRow = RowOut<(typeof T.rarityWeightsTable)['columns']>;
export type MementoDef = RowOut<(typeof T.mementosTable)['columns']>;
export type EffectDef = RowOut<(typeof T.effectsTable)['columns']>;
export type SynergyDef = RowOut<(typeof T.synergiesTable)['columns']>;
export type LevelUpCardDef = RowOut<(typeof T.levelUpTable)['columns']>;
export type StatusDef = RowOut<(typeof T.statusesTable)['columns']>;
export type EnemyDef = RowOut<(typeof T.enemiesTable)['columns']>;
export type AffixDef = RowOut<(typeof T.affixesTable)['columns']>;
export type BossPhaseDef = RowOut<(typeof T.bossesTable)['columns']>;
export type BossPatternDef = RowOut<(typeof T.bossPatternsTable)['columns']>;
export type BiomeDef = RowOut<(typeof T.biomesTable)['columns']>;
export type PulseSpawnDef = RowOut<(typeof T.waveSpawnsTable)['columns']>;
export type PulseSlotDef = RowOut<(typeof T.wavesTable)['columns']> & {
  readonly spawns: readonly PulseSpawnDef[];
};
export type DifficultyDef = RowOut<(typeof T.difficultyTable)['columns']>;
export type MetaUnlockDef = RowOut<(typeof T.metaUnlocksTable)['columns']>;
export interface TagDef {
  readonly id: TagId;
}

export interface GameDataIndex {
  enemy(id: string): EnemyTypeIndex;
  weapon(id: string): WeaponIndex;
  memento(id: string): MementoIndex;
  cls(id: string): ClassIndex;
  rite(id: string): RiteIndex;
  stat(id: string): StatIndex;
  tag(id: string): TagIndex;
  effect(id: string): EffectIndex;
  affix(id: string): AffixIndex;
  arena(id: string): number;
  biome(id: string): number;
}

export interface GameData {
  readonly meta: {
    readonly schemaVersion: number;
    readonly contentHash: string;
    readonly contentTier: ContentTier;
    /**
     * Tables without a CSV at build time. Keys of a missing key-value table without a default are NaN.
     * createSim must refuse to start a run while a required table is missing.
     */
    readonly missingTables: readonly string[];
  };
  readonly config: ConfigValues;
  readonly shop: ShopConfig;
  readonly stats: readonly StatDef[];
  /** All six tags in fixed order: flame, shard, edge, echo, ward, trade. */
  readonly tags: readonly TagDef[];
  readonly classes: readonly ClassDef[];
  readonly rites: readonly RiteDef[];
  /** Tier params merged from weapon_tiers.csv as tiers[0..3]. */
  readonly weapons: readonly WeaponDef[];
  readonly rarities: readonly RarityDef[];
  readonly rarityWeights: readonly RarityWeightRow[];
  readonly mementos: readonly MementoDef[];
  readonly effects: readonly EffectDef[];
  readonly effectsByOwner: Readonly<Record<string, readonly EffectIndex[]>>;
  readonly synergies: readonly SynergyDef[];
  readonly levelUpCards: readonly LevelUpCardDef[];
  readonly statuses: readonly StatusDef[];
  readonly enemies: readonly EnemyDef[];
  readonly affixes: readonly AffixDef[];
  readonly bossPhases: readonly BossPhaseDef[];
  readonly bossPatterns: readonly BossPatternDef[];
  readonly biomes: readonly BiomeDef[];
  /** waves.csv joined with wave_spawns.csv, per profile in pulse order. */
  readonly profiles: Readonly<Record<string, readonly PulseSlotDef[]>>;
  readonly difficulty: readonly DifficultyDef[];
  readonly metaUnlocks: readonly MetaUnlockDef[];
  readonly arenas: readonly ArenaDef[];
  /** String id to dense index, built at load. Throws on unknown id (load boundary only). */
  readonly index: GameDataIndex;
}

export class UnknownIdError extends Error {
  override readonly name = 'UnknownIdError';
}

function convertRow<S extends Schema>(schema: S, row: RawRow): RowOut<S> {
  const out: Record<string, unknown> = {};
  for (const [name, column] of Object.entries(schema)) {
    const v = row[name];
    out[outKeyOf(name, column)] = v === null || v === undefined ? null : column.toGame(v);
  }
  return out as RowOut<S>;
}

/** Key-value table. A missing key (missing table) becomes its default, null, or NaN. */
function convertKv<S extends Schema>(schema: S, obj: RawRow): RowOut<S> {
  const out: Record<string, unknown> = {};
  for (const [name, column] of Object.entries(schema)) {
    const key = outKeyOf(name, column);
    if (name in obj) {
      const v = obj[name];
      out[key] = v === null || v === undefined ? null : column.toGame(v);
    } else if (column.hasDefault) {
      out[key] = column.toGame(column.defaultValue);
    } else {
      out[key] = column.optional ? null : Number.NaN;
    }
  }
  return out as RowOut<S>;
}

function rowsOf(raw: RawGameData, name: string): readonly RawRow[] {
  const t = raw.tables[name];
  return Array.isArray(t) ? (t as readonly RawRow[]) : [];
}

function kvOf(raw: RawGameData, name: string): RawRow {
  const t = raw.tables[name];
  return t !== undefined && !Array.isArray(t) ? (t as RawRow) : {};
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- B is the branded index type of the table.
function indexer<B>(table: string, ids: readonly string[]): (id: string) => B {
  const map = new Map<string, number>();
  ids.forEach((id, i) => map.set(id, i));
  return (id) => {
    const i = map.get(id);
    if (i === undefined) throw new UnknownIdError(`Unknown ${table} id "${id}"`);
    return i as B;
  };
}

function deepFreeze<V>(v: V): V {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const child of Object.values(v)) deepFreeze(child);
  }
  return v;
}

export interface BuildGameDataOptions {
  /** Deep-freeze the result (dev and tests) so accidental writes throw. */
  readonly freeze?: boolean;
}

export function buildGameData(raw: RawGameData, opts: BuildGameDataOptions = {}): GameData {
  const rows = <S extends Schema>(name: string, schema: S): RowOut<S>[] =>
    rowsOf(raw, name).map((r) => convertRow(schema, r));

  const weapons: WeaponDef[] = rowsOf(raw, 'weapons').map((r) => ({
    ...convertRow(T.weaponsTable.columns, r),
    tiers: (Array.isArray(r['tiers']) ? (r['tiers'] as RawRow[]) : []).map((t) => ({
      tier: Number(t['tier']),
      params: (t['params'] ?? {}) as ParamsRaw,
      effects: (t['effects'] ?? []) as readonly string[],
    })),
  }));

  const profiles: Record<string, PulseSlotDef[]> = {};
  for (const [p, slots] of Object.entries(raw.profiles)) {
    profiles[p] = slots.map((s) => ({
      ...convertRow(T.wavesTable.columns, s),
      spawns: s.spawns.map((sp) => convertRow(T.waveSpawnsTable.columns, sp)),
    }));
  }

  const effects = rows('effects', T.effectsTable.columns);
  const effectsByOwner: Record<string, EffectIndex[]> = {};
  effects.forEach((e, i) => {
    (effectsByOwner[e.owner] ??= []).push(i as EffectIndex);
  });

  const stats = rows('stats', T.statsTable.columns);
  const classes = rows('classes', T.classesTable.columns);
  const rites = rows('rites', T.ritesTable.columns);
  const mementos = rows('mementos', T.mementosTable.columns);
  const enemies = rows('enemies', T.enemiesTable.columns);
  const affixes = rows('affixes', T.affixesTable.columns);
  const biomes = rows('biomes', T.biomesTable.columns);
  const tags: TagDef[] = T.TAGS.map((id) => ({ id }));

  const data: GameData = {
    meta: {
      schemaVersion: raw.schemaVersion,
      contentHash: raw.contentHash,
      contentTier: raw.contentTier,
      missingTables: raw.missingTables,
    },
    config: convertKv(T.configTable.keys, kvOf(raw, 'config')),
    shop: convertKv(T.shopTable.keys, kvOf(raw, 'shop')),
    stats,
    tags,
    classes,
    rites,
    weapons,
    rarities: rows('rarity', T.rarityTable.columns),
    rarityWeights: rows('rarity_weights', T.rarityWeightsTable.columns),
    mementos,
    effects,
    effectsByOwner,
    synergies: rows('synergies', T.synergiesTable.columns),
    levelUpCards: rows('levelup', T.levelUpTable.columns),
    statuses: rows('statuses', T.statusesTable.columns),
    enemies,
    affixes,
    bossPhases: rows('bosses', T.bossesTable.columns),
    bossPatterns: rows('boss_patterns', T.bossPatternsTable.columns),
    biomes,
    profiles,
    difficulty: rows('difficulty', T.difficultyTable.columns),
    metaUnlocks: rows('meta_unlocks', T.metaUnlocksTable.columns),
    arenas: raw.arenas,
    index: {
      enemy: indexer<EnemyTypeIndex>(
        'enemy',
        enemies.map((e) => e.id),
      ),
      weapon: indexer<WeaponIndex>(
        'weapon',
        weapons.map((w) => w.id),
      ),
      memento: indexer<MementoIndex>(
        'memento',
        mementos.map((m) => m.id),
      ),
      cls: indexer<ClassIndex>(
        'class',
        classes.map((c) => c.id),
      ),
      rite: indexer<RiteIndex>(
        'rite',
        rites.map((r) => r.id),
      ),
      stat: indexer<StatIndex>(
        'stat',
        stats.map((s) => s.id),
      ),
      tag: indexer<TagIndex>(
        'tag',
        tags.map((t) => t.id),
      ),
      effect: indexer<EffectIndex>(
        'effect',
        effects.map((e) => e.id),
      ),
      affix: indexer<AffixIndex>(
        'affix',
        affixes.map((a) => a.id),
      ),
      arena: indexer<number>(
        'arena',
        raw.arenas.map((a) => a.id),
      ),
      biome: indexer<number>(
        'biome',
        biomes.map((b) => b.id),
      ),
    },
  };
  return opts.freeze === true ? deepFreeze(data) : data;
}
