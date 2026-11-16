// weapons.csv, weapon_tiers.csv, rarity.csv, rarity_weights.csv, mementos.csv (data-schema 3.5 to 3.9).

import { col, defineTable } from '../schema/index.ts';
import { SOURCE_KINDS, TAGS, WEAPON_ARCHETYPES, WEAPON_TARGETING } from './enums.ts';

export const weaponsTable = defineTable({
  name: 'weapons',
  required: true,
  columns: {
    id: col.id(),
    name_key: col.key(),
    desc_key: col.key(),
    content_tier: col.contentTier(),
    tags: col.list(col.enumOf(TAGS), { min: 1 }),
    archetype: col.enumOf(WEAPON_ARCHETYPES),
    kind: col.enumOf(SOURCE_KINDS),
    targeting: col.enumOf(WEAPON_TARGETING),
    dmg: col.float({ min: 0 }),
    dmg2: col.optional(col.float({ min: 0 })),
    cooldown: col.seconds(),
    range: col.u({ min: 0 }),
    speed: col.uPerSec({ min: 0, default: 0 }),
    radius: col.optional(col.u({ min: 0 })),
    proj_radius: col.optional(col.u({ min: 0 })),
    count: col.int({ min: 0, default: 1 }),
    pierce: col.int({ min: 0, default: 0 }),
    knockback: col.u({ min: 0, default: 0 }),
    params: col.params({ by: 'archetype' }),
    unlock_silt: col.int({ min: 0, default: 0 }),
  },
});

/** Merged into weapons[i].tiers at build (architecture 9.4). Tier I is the weapons.csv row. */
export const weaponTiersTable = defineTable({
  name: 'weapon_tiers',
  required: true,
  key: ['weapon_id', 'tier'],
  columns: {
    weapon_id: col.ref('weapons'),
    tier: col.int({ min: 2, max: 4 }),
    params: col.params(),
    effects: col.list(col.token()),
  },
});

export const rarityTable = defineTable({
  name: 'rarity',
  required: true,
  columns: {
    id: col.id(),
    order: col.int({ min: 0 }),
    color_token: col.str(),
    memento_price: col.int({ min: 0 }),
    weapon_price: col.int({ min: 0 }),
    weapon_dmg_mult: col.float({ min: 0 }),
    weapon_cd_mult: col.float({ min: 0 }),
  },
});

export const rarityWeightsTable = defineTable({
  name: 'rarity_weights',
  required: true,
  key: ['t_min'],
  columns: {
    t_min: col.int({ min: 0 }),
    t_max: col.int({ min: 0 }),
    plain: col.float({ min: 0 }),
    fine: col.float({ min: 0 }),
    rare: col.float({ min: 0 }),
    fabled: col.float({ min: 0 }),
  },
});

export const mementosTable = defineTable({
  name: 'mementos',
  required: true,
  columns: {
    id: col.id(),
    name_key: col.key(),
    desc_key: col.key(),
    flavor_key: col.optional(col.key()),
    content_tier: col.contentTier(),
    rarity: col.ref('rarity'),
    tags: col.list(col.enumOf(TAGS), { min: 1 }),
    max_stack: col.int({ min: 1, default: 1 }),
    /** 'default' or a meta_unlocks id (checked by the mementos validator). */
    unlock: col.token({ default: 'default' }),
    is_flat: col.bool({ default: false }),
    price_override: col.optional(col.int({ min: 0 })),
    sort: col.int({ default: 0 }),
  },
});
