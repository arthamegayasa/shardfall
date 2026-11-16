// biomes.csv, waves.csv, wave_spawns.csv, difficulty.csv, meta_unlocks.csv (data-schema 3.19 to 3.23).

import { col, defineTable } from '../schema/index.ts';
import { META_UNLOCK_KINDS, PULSE_KINDS, RUN_PROFILES, SPAWN_SECTORS } from './enums.ts';

export const biomesTable = defineTable({
  name: 'biomes',
  required: true,
  columns: {
    id: col.id(),
    name_key: col.key(),
    content_tier: col.contentTier(),
    /** Arena id from content/levels/<id>.json (LD). */
    arena_id: col.ref('arenas'),
    /** AU music cue id (src/audio/music). Not checked here. */
    music_id: col.token(),
  },
});

/** Joined with wave_spawns into GameData.profiles[profile][i] (architecture 9.4). */
export const wavesTable = defineTable({
  name: 'waves',
  required: true,
  key: ['profile', 'pulse'],
  columns: {
    profile: col.enumOf(RUN_PROFILES),
    pulse: col.int({ min: 1 }),
    kind: col.enumOf(PULSE_KINDS),
    biome: col.ref('biomes'),
    threat: col.int({ min: 1, max: 20 }),
    /** Empty for boss Pulses (untimed): 0 ticks. */
    duration_s: col.seconds({ default: 0 }),
    warden_id: col.optional(col.ref('enemies')),
    boss_id: col.optional(col.ref('enemies')),
    alive_cap: col.int({ min: 1, max: 120 }),
    final: col.bool({ default: false, as: 'isFinal' }),
  },
});

export const waveSpawnsTable = defineTable({
  name: 'wave_spawns',
  required: true,
  key: [],
  columns: {
    profile: col.enumOf(RUN_PROFILES),
    pulse: col.int({ min: 1 }),
    enemy_id: col.ref('enemies'),
    count: col.int({ min: 0 }),
    start_frac: col.float({ min: 0, max: 1 }),
    end_frac: col.float({ min: 0, max: 1 }),
    group_min: col.int({ min: 1, default: 1 }),
    group_max: col.int({ min: 1, default: 1 }),
    /** Empty = all sectors. */
    sectors: col.list(col.enumOf(SPAWN_SECTORS)),
  },
});

export const difficultyTable = defineTable({
  name: 'difficulty',
  required: false,
  key: ['level'],
  columns: {
    level: col.int({ min: 0, max: 5 }),
    enemy_hp_mult: col.float({ min: 0 }),
    enemy_dmg_mult: col.float({ min: 0 }),
    spawn_mult: col.float({ min: 0 }),
    enemy_speed_mult: col.float({ min: 0 }),
    price_mult: col.float({ min: 0 }),
    warden_extra_affixes: col.int({ min: 0 }),
    boss_hp_mult: col.float({ min: 0 }),
    boss_gap_mult: col.float({ min: 0 }),
    pulse_heal_frac: col.float({ min: 0, max: 1 }),
    pulse_end_collect_frac: col.float({ min: 0, max: 1 }),
    silt_mult: col.float({ min: 0 }),
  },
});

export const metaUnlocksTable = defineTable({
  name: 'meta_unlocks',
  required: false,
  columns: {
    id: col.id(),
    kind: col.enumOf(META_UNLOCK_KINDS),
    targets: col.list(col.token(), { min: 1 }),
    cost_silt: col.int({ min: 0 }),
    content_tier: col.contentTier(),
    cost_silt_b: col.optional(col.int({ min: 0 })),
  },
});
