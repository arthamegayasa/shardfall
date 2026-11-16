// enemies.csv, affixes.csv, bosses.csv, boss_patterns.csv (data-schema 3.15 to 3.18).

import { col, defineTable } from '../schema/index.ts';
import { BOSS_PATTERN_ARCHETYPES, ENEMY_ROLES, SIZE_CLASSES } from './enums.ts';

export const enemiesTable = defineTable({
  name: 'enemies',
  required: true,
  columns: {
    id: col.id(),
    name_key: col.key(),
    content_tier: col.contentTier(),
    role: col.enumOf(ENEMY_ROLES),
    /** AI archetype id; keys of params are validated per behavior by the params registry (GP). */
    behavior: col.token(),
    size_class: col.enumOf(SIZE_CLASSES),
    /** Empty = config enemy_radius_<size_class>. */
    radius: col.optional(col.u({ min: 0 })),
    hp: col.float({ min: 0 }),
    speed: col.uPerSec({ min: 0 }),
    contact_dmg: col.float({ min: 0, default: 0 }),
    attack_dmg: col.float({ min: 0, default: 0 }),
    glint: col.int({ min: 0, default: 0 }),
    guard: col.float({ min: 0, default: 0 }),
    kb_resist: col.float({ min: 0, max: 1, default: 0 }),
    telegraph_s: col.seconds({ default: 0 }),
    params: col.params({ by: 'behavior' }),
    affixes: col.list(col.ref('affixes')),
    silt: col.int({ min: 0, default: 0 }),
  },
});

export const affixesTable = defineTable({
  name: 'affixes',
  required: false,
  columns: {
    id: col.id(),
    content_tier: col.contentTier(),
    telegraph_s: col.seconds({ default: 0 }),
    params: col.params(),
    desc_key: col.key(),
    random_pool: col.bool({ default: false }),
  },
});

export const bossesTable = defineTable({
  name: 'bosses',
  required: false,
  key: ['boss_id', 'phase'],
  columns: {
    boss_id: col.ref('enemies'),
    phase: col.int({ min: 1, max: 3 }),
    hp_below: col.float({ min: 0, max: 1 }),
    gap_s: col.seconds(),
    cycle: col.list(col.ref('boss_patterns'), { min: 1 }),
    min_crack: col.int({ min: 0, default: 0 }),
    transition_s: col.seconds({ default: 0 }),
  },
});

export const bossPatternsTable = defineTable({
  name: 'boss_patterns',
  required: false,
  columns: {
    id: col.id(),
    boss_id: col.ref('enemies'),
    archetype: col.enumOf(BOSS_PATTERN_ARCHETYPES),
    telegraph_s: col.seconds(),
    dmg: col.float({ min: 0, default: 0 }),
    params: col.params({ by: 'archetype' }),
  },
});
