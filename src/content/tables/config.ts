// config.csv and shop.csv: typed key-value tables (data-schema 3.1, 3.13). Keys owned by GD.
// Every key must be declared here; unknown keys are errors. Technical constants live in src/core/constants.ts.

import { col, defineKvTable } from '../schema/index.ts';

// Return types are inferred on purpose: they carry the literal `as` type the key derivation needs.
const frac = () => col.float({ min: 0, max: 1 });
const sec = () => col.seconds({ min: 0 });
const dist = () => col.u({ min: 0 });

export const configTable = defineKvTable({
  name: 'config',
  required: true,
  keys: {
    player_base_speed: col.uPerSec({ min: 0 }),
    player_vertical_screen_ratio: col.float({ min: 0.5, max: 1 }),
    player_radius: dist(),
    pickup_radius_base: dist(),
    /** Top speed of a magnetized Glint piece. */
    glint_fly_speed: col.uPerSec({ min: 0 }),
    /** Speed of a piece the tick it is magnetized (GD M2-01). */
    glint_fly_speed_start: col.uPerSec({ min: 0, default: 12 }),
    /** u/s^2 in data and GameData (no tick conversion): divide by TICK_RATE^2 for u/tick^2 (GD M2-01). */
    glint_fly_accel: col.float({ min: 0, default: 0 }),
    glint_collect_dist_add: dist(),
    glint_floor_cap: col.int({ min: 1 }),
    pulse_end_collect_frac: frac(),
    pulse_clear_s: sec(),
    iframes_hurt: sec(),
    iframes_dodge: sec(),
    iframes_block: sec(),
    knockback_s: sec(),
    armor_k: col.float({ min: 0 }),
    armor_max_reduction: frac(),
    guard_min_frac: frac(),
    proc_growth: col.float({ min: 0 }),
    burn_dps_nonhit: col.float({ min: 0 }),
    enemy_hp_lin: col.float(),
    enemy_hp_quad: col.float(),
    enemy_dmg_lin: col.float(),
    price_growth: col.float(),
    xp_base: col.float({ min: 0 }),
    xp_per_level: col.float({ min: 0 }),
    extra_projectile_spread_deg: col.deg({ min: 0 }),
    weapon_slots: col.int({ min: 1 }),
    leech_heal_cap_per_s: col.perSec({ min: 0 }),
    spawn_mark_s: sec(),
    spawn_grace_s: sec(),
    spawn_group_spread: dist(),
    spawn_mark_diam_small: dist(),
    spawn_mark_diam_medium: dist(),
    spawn_mark_diam_large: dist(),
    spawn_mark_diam_warden: dist(),
    /** Groups of this size or more use at least the medium spawn mark (GDD 3.2, GD M2-01). */
    spawn_mark_medium_group_min: col.int({ min: 1, default: 3 }),
    spawn_quiet_end_s: sec(),
    enemy_radius_small: dist(),
    enemy_radius_medium: dist(),
    enemy_radius_large: dist(),
    enemy_radius_warden: dist(),
    enemy_radius_boss: dist(),
    enemy_shot_radius: dist(),
    player_shot_radius: dist(),
    telegraph_min_projectile_s: sec(),
    telegraph_min_charge_s: sec(),
    telegraph_min_area_s: sec(),
    telegraph_min_boss_s: sec(),
    music_pressure_frac: frac(),
    music_pressure_release_frac: frac(),
    warden_spawn_frac: frac(),
    warden_overtime_haste_s: sec(),
    boss_entry_s: sec(),
    boss_enrage_s: sec(),
    boss_enrage_gap_mult: col.float({ min: 0 }),
    boss_trickle_every_s: sec(),
    boss_trickle_count: col.int({ min: 0 }),
    boss_trickle_max_alive: col.int({ min: 0 }),
    death_slowmo_s: sec(),
    /** PlayerHpLowChanged threshold as a fraction of max HP (ui-spec S03, GD M2-01). */
    low_hp_frac: col.float({ min: 0, max: 1, default: 0.3 }),
    victory_delay_s: sec(),
  },
});

export const shopTable = defineKvTable({
  name: 'shop',
  required: true,
  keys: {
    slots: col.int({ min: 1 }),
    weapon_chance: frac(),
    class_tag_weight: col.float({ min: 0 }),
    owned_tag_weight: col.float({ min: 0 }),
    merge_push_chance: frac(),
    sell_frac: frac(),
    reroll_base_add: col.float({ min: 0 }),
    reroll_t_div: col.float({ min: 0 }),
    reroll_step: col.float({ min: 0 }),
    bad_luck_shops: col.int({ min: 0 }),
    bad_luck_min_t: col.int({ min: 0 }),
    warden_chest_choices: col.int({ min: 1 }),
    warden_chest_min_rarity: col.ref('rarity'),
    boss_chest_min_rarity: col.ref('rarity'),
  },
});
