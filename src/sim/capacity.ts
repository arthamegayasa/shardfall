// Technical constants of the sim (architecture.md 8.1, 8.3). Pool sizes and spatial rules only,
// never balance numbers: every gameplay number comes from GameData.

/** Fixed pool capacities (architecture 8.1). */
export const ENEMY_CAPACITY = 256;
export const ENEMY_SHOT_CAPACITY = 512;
export const PLAYER_SHOT_CAPACITY = 512;
/** Soft cap of live proc projectiles inside the player shot pool (GD 6.2, architecture 8.1). */
export const PROC_SHOT_SOFT_CAP = 200;
export const PICKUP_CAPACITY = 256;
export const DANGER_AREA_CAPACITY = 64;
export const PLAYER_ZONE_CAPACITY = 32;
/** Soft cap of live player zones (effect-primitives 5, spawn_zone). */
export const PLAYER_ZONE_SOFT_CAP = 24;
export const SPAWN_MARK_CAPACITY = 64;
export const PENDING_ACTION_CAPACITY = 128;
/** Spawn schedule entries per Pulse (groups, not enemies). */
export const SCHEDULE_CAPACITY = 1024;
/** Max effects with every_nth per_target scope per run (architecture 8.1). */
export const PER_TARGET_COUNTER_EFFECTS = 4;
/** Burn stacks stored per enemy slot (stat burn_max_stacks is clamped to this by data, max 5). */
export const BURN_STACK_SLOTS = 5;
/** Enemy serials remembered per projectile for pierce (architecture 8.3). */
export const PIERCE_MEMORY = 8;
/** Max neighbours considered for enemy separation (architecture 8.3). */
export const SEPARATION_NEIGHBOURS = 8;
/** Nesting depth of hit contexts (hit -> proc area -> proc kill area). procDepth stops at 2. */
export const HIT_STACK_DEPTH = 8;

/** Spatial hash cell size in u (architecture 8.3, calibrated in M1). */
export const SPATIAL_CELL_U = 2;

/** Glint and thrown landing points stay this far inside the boundary (arena-design 4.2, LD rule). */
export const EDGE_INSET_U = 0.5;
/** Spawn point attempts per sector before falling back to the farthest sector (arena-design 5.2). */
export const SPAWN_POINT_ATTEMPTS = 8;
/**
 * Fallback spawn band, used only when an arena JSON has no spawn zones (fixture arenas).
 * Inner and outer inset from the boundary bounding box, from arena-design 5.2.
 */
export const SPAWN_BAND_INNER_U = 1;
export const SPAWN_BAND_OUTER_U = 2.5;

/** GlintCollected streak resets after this many ticks without a pickup (architecture 6.5: 500 ms). */
export const GLINT_STREAK_RESET_TICKS = 30;

/** Fixed point used to quantise aim input: world u = aim / AIM_UNITS_PER_U (InputFrame, 1/16 u). */
export const AIM_UNITS_PER_U = 16;

/** Highest weapon tier (weapon_tiers.csv tier 2..4, schema-defined; tier I is the weapons.csv row). */
export const WEAPON_MAX_TIER = 4;
/** Level-up cards per level: "pick 1 of 3" is fixed by the Temper screen (GDD 11.2, ui-spec). */
export const LEVEL_CARD_CHOICES = 3;
/** Rejection sampling attempts for a random point inside a shape before using its centre. */
export const SHAPE_SAMPLE_ATTEMPTS = 16;

/** Ticks an Unlit shows its white hit flash (CD M1 4: 2 frames at 60 Hz). Presentation, not balance. */
export const HIT_FLASH_TICKS = 2;
/**
 * Impact tier thresholds of EnemyDamaged bits 7-8, as fraction of the target's max HP (presentation:
 * VFX size and audio weight). Below the first: Light; then Medium, Heavy, Crushing.
 */
export const IMPACT_MEDIUM_FRAC = 0.1;
export const IMPACT_HEAVY_FRAC = 0.25;
export const IMPACT_CRUSHING_FRAC = 0.5;
/** Affix timer slots per enemy (AffixIndex; affix masks are 31 bits). */
export const AFFIX_TIMER_STRIDE = 32;
