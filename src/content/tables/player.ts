// stats.csv, classes.csv, rites.csv, levelup.csv (data-schema 3.2 to 3.4, 3.12). Columns owned by GD.

import { col, defineTable } from '../schema/index.ts';
import { ACCENTS, RITE_ARCHETYPES, STAT_UNITS, TAGS } from './enums.ts';

export const statsTable = defineTable({
  name: 'stats',
  required: true,
  columns: {
    id: col.id(),
    base: col.float({ default: 0 }),
    min: col.optional(col.float()),
    max: col.optional(col.float()),
    unit: col.enumOf(STAT_UNITS),
    display_key: col.key(),
    show_in_ui: col.bool({ default: true }),
  },
});

export const classesTable = defineTable({
  name: 'classes',
  required: true,
  columns: {
    id: col.id(),
    name_key: col.key(),
    desc_key: col.key(),
    content_tier: col.contentTier(),
    accent: col.enumOf(ACCENTS),
    tag: col.enumOf(TAGS),
    start_weapon: col.ref('weapons'),
    rite_id: col.ref('rites'),
    max_hp: col.float({ min: 1 }),
    stat_mods: col.params(),
    unlock_silt: col.int({ min: 0, default: 0 }),
    sort: col.int({ default: 0 }),
  },
});

export const ritesTable = defineTable({
  name: 'rites',
  required: true,
  columns: {
    id: col.id(),
    name_key: col.key(),
    desc_key: col.key(),
    content_tier: col.contentTier(),
    archetype: col.enumOf(RITE_ARCHETYPES),
    cooldown: col.seconds(),
    dmg: col.float({ min: 0, default: 0 }),
    radius: col.u({ min: 0, default: 0 }),
    params: col.params({ by: 'archetype' }),
  },
});

export const levelUpTable = defineTable({
  name: 'levelup',
  required: true,
  columns: {
    id: col.id(),
    stat: col.ref('stats'),
    plain: col.float(),
    fine: col.float(),
    rare: col.float(),
    fabled: col.float(),
    content_tier: col.contentTier(),
    weight: col.float({ min: 0, default: 1 }),
    desc_key: col.key(),
  },
});
