# Skema Data CSV

Pemilik: Game Designer (isi dan arti kolom). Lead Programmer boleh menyesuaikan format teknis (nama file, tipe, struktur JSON) dengan catatan di `docs/tech/`. Status: usulan M0 versi 1, 2026-11-16.
Terkait: `docs/gdd.md`, `docs/systems/effect-primitives.md`.

## 1. Konvensi

| Aturan | Nilai |
|---|---|
| Lokasi | `content/data/<tabel>.csv`, hasil konversi `content/data/<tabel>.json` (atau satu bundle, keputusan LP) |
| Encoding | UTF-8 tanpa BOM, baris pertama header |
| Pemisah kolom | koma. Nilai yang berisi koma dibungkus tanda kutip ganda |
| Desimal | titik (`0.25`), tanpa pemisah ribuan |
| Daftar dalam sel | dipisah `\|` (contoh `Flame\|Edge`) |
| Parameter dalam sel | `kunci=nilai;kunci=nilai` |
| Boolean | `0` atau `1` |
| Sel kosong | pakai default kolom |
| Komentar | baris yang diawali `#` diabaikan |
| Id | `snake_case`, unik per tabel, tidak berubah setelah dipakai |
| Teks | Tidak ada teks tampil di CSV data. Kolom `*_key` merujuk string table Writer di `content/strings/` |
| Tingkat konten | Kolom `tier` berisi `A`, `B`, atau `C` (tingkat minimum). Build untuk tingkat X memuat baris dengan tier <= X |
| Persen | Disimpan sebagai angka persen untuk stat (`damage_pct=8` berarti +8%), dan sebagai fraksi untuk peluang dan pengali (`chance=0.08`, `dmg_frac=0.4`) |

Validasi minimal di pipeline (usulan untuk `tools/`):
1. Semua rujukan id ada (senjata awal kelas, owner efek, enemy di wave_spawns, pattern boss, target unlock).
2. Enum valid (trigger, action, condition, tag, rarity, tier, role).
3. Kunci `params` dikenal untuk aksi atau arketipe itu.
4. Angka dalam rentang `stats.csv` (min, max).
5. Setiap senjata dan Keepsake punya minimal 1 tag (P1-b).
6. Laporan P1-a: persentase Keepsake dengan `is_flat=1` di pool toko per tingkat.

## 2. Daftar tabel

| Tabel | Isi | Dipakai oleh |
|---|---|---|
| `config.csv` | Konstanta global skalar | semua |
| `stats.csv` | Definisi stat pemain | stat, UI |
| `classes.csv` | Kelas | pilih kelas, run |
| `rites.csv` | Rite | kombat |
| `weapons.csv` | Senjata tier I | kombat, toko |
| `weapon_tiers.csv` | Bonus per tier per senjata | kombat |
| `rarity.csv` | Harga dan pengali per rarity | toko, kombat |
| `rarity_weights.csv` | Bobot rarity per threat | toko, level-up, peti |
| `keepsakes.csv` | Keepsake | toko, peti |
| `effects.csv` | Semua efek primitif | mesin efek |
| `synergies.csv` | Ambang tag | mesin efek, UI |
| `levelup.csv` | Kartu level-up | level-up |
| `shop.csv` | Aturan toko | toko |
| `statuses.csv` | Aturan status | kombat |
| `enemies.csv` | Unlit, Warden, boss | spawner, AI |
| `affixes.csv` | Affix Warden | AI |
| `bosses.csv` | Fase boss | AI boss |
| `boss_patterns.csv` | Pola serangan boss | AI boss |
| `biomes.csv` | Bioma | run, render |
| `waves.csv` | Slot Pulse per profil run | run, spawner |
| `wave_spawns.csv` | Komposisi spawn per Pulse | spawner |
| `difficulty.csv` | Crack 0 sampai 5 | run |
| `meta_unlocks.csv` | Unlock Silt | meta |

## 3. Kolom per tabel

### 3.1 `config.csv`

| Kolom | Tipe | Arti |
|---|---|---|
| `key` | string | Nama konstanta |
| `value` | number | Nilai |
| `notes` | string | Catatan (tidak dibaca game) |

Kunci awal: `tick_rate` 60, `player_base_speed` 4.5, `pickup_radius_base` 1.6, `glint_fly_speed` 12, `glint_floor_cap` 150, `glint_merge_value` 5, `pulse_end_collect_frac` 0.5, `iframes_hurt` 0.5, `iframes_dodge` 0.2, `player_radius` 0.35, `armor_k` 15, `armor_max_reduction` 0.85, `guard_min_frac` 0.25, `proc_growth` 0.2, `enemy_hp_lin` 0.12, `enemy_hp_quad` 0.006, `enemy_dmg_lin` 0.07, `price_growth` 0.08, `xp_base` 15, `xp_per_level` 10, `spawn_mark_s` 0.8, `spawn_min_dist` 4, `warden_spawn_frac` 0.25, `warden_overtime_haste_s` 20, `boss_enrage_s` 120, `boss_enrage_gap_mult` 0.6, `boss_trickle_every_s` 4, `boss_trickle_count` 2, `pulse_dur_base` 20, `pulse_dur_step` 2.5, `pulse_dur_max` 40, `extra_projectile_spread_deg` 12, `weapon_slots` 6, `leech_heal_cap_per_s` 6.

### 3.2 `stats.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | string | `armor` |
| `base` | number | `0` |
| `min` | number | `-10` |
| `max` | number | kosong = tanpa batas |
| `unit` | enum `flat`, `pct`, `u`, `u_per_s`, `per_s`, `s` | `flat` |
| `display_key` | string | `stat.armor` |
| `show_in_ui` | 0/1 | `1` |

### 3.3 `classes.csv`

| Kolom | Tipe | Contoh (`lantern`) |
|---|---|---|
| `id` | string | `lantern` |
| `name_key`, `desc_key` | string | `class.lantern.name` |
| `tier` | A/B/C | `A` |
| `accent` | enum `blue`, `cyan`, `gold` | `gold` |
| `tag` | tag | `Flame` |
| `start_weapon` | id senjata | `lantern_bolt` |
| `rite_id` | id rite | `flare_lantern` |
| `max_hp` | number | `30` |
| `stat_mods` | params | `area_pct=10` |
| `unlock_silt` | int, 0 = terbuka | `0` |
| `sort` | int | `1` |

Pasif kelas ditulis di `effects.csv` dengan `owner` = id kelas.

### 3.4 `rites.csv`

| Kolom | Tipe | Contoh (`flare_lantern`) |
|---|---|---|
| `id` | string | `flare_lantern` |
| `name_key`, `desc_key` | string | |
| `archetype` | enum `throw_zone`, `ring`, `dash` | `throw_zone` |
| `cooldown` | s | `12` |
| `dmg` | number (proc) | `20` |
| `radius` | u | `3` |
| `params` | params | `max_range=6;flight_s=0.35;zone_s=4;zone_tick=0.5;slow=30;status=burn` |

### 3.5 `weapons.csv`

| Kolom | Tipe | Contoh (`splinter_shot`) |
|---|---|---|
| `id` | string | `splinter_shot` |
| `name_key`, `desc_key` | string | |
| `tier` | A/B/C | `A` |
| `tags` | daftar tag | `Shard` |
| `archetype` | enum `bolt_explode`, `projectile`, `arc`, `orbit`, `chain`, `boomerang`, `ring_echo`, `coin` | `projectile` |
| `kind` | enum source_kind | `projectile` |
| `targeting` | enum `nearest`, `self`, `nearest_dir` | `nearest` |
| `dmg` | number | `6` |
| `dmg2` | number | kosong (ledakan sekunder, mis. Lantern Bolt 6) |
| `cooldown` | s | `0.7` |
| `range` | u | `7` |
| `speed` | u/s | `14` |
| `radius` | u | kosong |
| `count` | int | `1` |
| `pierce` | int | `0` |
| `knockback` | u | `0` |
| `params` | params | kosong (mis. Chain Spark `jumps=3;jump_range=2.8;burn_chance=0.2`) |
| `unlock_silt` | int | `0` |

### 3.6 `weapon_tiers.csv`

Satu baris per senjata per tier II sampai IV (tier I = baris `weapons.csv`). Pengali umum ada di `rarity.csv`; tabel ini hanya bonus khusus.

| Kolom | Tipe | Contoh |
|---|---|---|
| `weapon_id` | id senjata | `splinter_shot` |
| `tier` | 2, 3, 4 | `4` |
| `params` | params (kumulatif terhadap tier sebelumnya) | `fan_every_n=3;fan_count=3` |
| `effects` | daftar owner efek | kosong |

### 3.7 `rarity.csv`

| Kolom | Tipe | Plain | Fine | Rare | Fabled |
|---|---|---|---|---|---|
| `id` | string | `plain` | `fine` | `rare` | `fabled` |
| `order` | int | 0 | 1 | 2 | 3 |
| `color_token` | string | `rarity-plain` | `rarity-fine` | `rarity-rare` | `rarity-fabled` |
| `keepsake_price` | int | 14 | 28 | 50 | 85 |
| `weapon_price` | int | 16 | 34 | 70 | 130 |
| `weapon_dmg_mult` | number | 1.0 | 1.5 | 2.2 | 3.2 |
| `weapon_cd_mult` | number | 1.00 | 0.95 | 0.90 | 0.85 |

### 3.8 `rarity_weights.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `t_min`, `t_max` | int | `1`, `3` |
| `plain`, `fine`, `rare`, `fabled` | number | `78`, `20`, `2`, `0` |

### 3.9 `keepsakes.csv`

| Kolom | Tipe | Contoh (`prism_lens`) |
|---|---|---|
| `id` | string | `prism_lens` |
| `name_key`, `desc_key`, `flavor_key` | string | `keepsake.prism_lens.name` |
| `tier` | A/B/C | `A` |
| `rarity` | id rarity | `rare` |
| `tags` | daftar tag | `Shard` |
| `max_stack` | int | `1` |
| `unlock` | `default` atau id `meta_unlocks` | `default` |
| `is_flat` | 0/1 (kuota P1-a) | `0` |
| `price_override` | int, kosong = dari rarity | kosong |
| `sort` | int | `7` |

Efek ditulis di `effects.csv` dengan `owner` = id Keepsake.

### 3.10 `effects.csv`

Definisi lengkap tiap kolom dan enum di `effect-primitives.md`.

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | string | `prism_lens_1` |
| `owner` | id Keepsake, kelas, atau `syn_<tag>_<n>` | `prism_lens` |
| `trigger` | enum | `on_hit` |
| `conditions` | daftar `nama:nilai` | `source_kind:projectile\|every_nth:5@global` |
| `chance` | 0 sampai 1 | kosong (1) |
| `icd` | s | kosong |
| `max_per_pulse` | int | kosong |
| `allow_proc` | 0/1 | kosong (default per aksi) |
| `stack_mode` | `value`, `chance`, `none` | `none` |
| `action` | enum | `spawn_projectile` |
| `params` | params | `pattern=split;count=3;dmg_frac=0.4;origin=target` |

Parameter pemicu ikut di `params` (`interval` untuk `periodic`, `distance` untuk `on_distance`).

### 3.11 `synergies.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `tag` | enum tag | `Flame` |
| `threshold` | 2, 4, 6 | `4` |
| `tier` | A/B/C (tingkat tempat tag aktif) | `A` |
| `owner` | string | `syn_flame_4` |
| `desc_key` | string | `syn.flame.4` |

### 3.12 `levelup.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | string | `card_damage` |
| `stat` | id stat | `damage_pct` |
| `plain`, `fine`, `rare`, `fabled` | number | `5`, `8`, `12`, `18` |
| `tier` | A/B/C | `A` |
| `weight` | number | `1` |
| `desc_key` | string | `card.damage` |

### 3.13 `shop.csv`

Format kunci dan nilai seperti `config.csv`.

| Kunci | Nilai awal |
|---|---|
| `slots` | 4 |
| `weapon_chance` | 0.35 |
| `class_tag_weight` | 1.5 |
| `owned_tag_weight` | 1.25 |
| `merge_push_chance` | 0.15 |
| `sell_frac` | 0.4 |
| `reroll_base_add` | 1 |
| `reroll_t_div` | 2 |
| `reroll_step` | 1 |
| `lock_free` | 1 |
| `bad_luck_shops` | 3 |
| `bad_luck_min_t` | 6 |
| `warden_chest_choices` | 3 |
| `warden_chest_min_rarity` | `fine` |
| `boss_chest_min_rarity` | `rare` |

### 3.14 `statuses.csv`

| Kolom | Tipe | Contoh (`burn`) |
|---|---|---|
| `id` | enum `burn`, `slow`, `mark`, `knockback` | `burn` |
| `duration` | s | `3` |
| `tick` | s | `0.5` |
| `params` | params | `dps_frac=0.3;ignores_guard=1;can_crit=0` |

### 3.15 `enemies.csv`

Unlit biasa, Warden, dan boss di satu tabel.

| Kolom | Tipe | Contoh (`charger`) |
|---|---|---|
| `id` | string | `charger` |
| `name_key` | string | `unlit.charger` |
| `tier` | A/B/C | `A` |
| `role` | enum `swarmer`, `charger`, `shooter`, `tank`, `exploder`, `summoner`, `mote`, `lobber`, `warden`, `boss` | `charger` |
| `behavior` | enum arketipe AI (sama dengan role untuk Unlit biasa, mis. `warden_hound`, `boss_lantern`) | `charger` |
| `size_class` | enum `small`, `medium`, `large`, `warden`, `boss` | `medium` |
| `hp` | number (t1) | `16` |
| `speed` | u/s | `2.0` |
| `contact_dmg` | number | `3` |
| `attack_dmg` | number | `6` |
| `glint` | int | `2` |
| `guard` | number | `0` |
| `kb_resist` | 0 sampai 1 | `0.2` |
| `telegraph_s` | s | `0.6` |
| `params` | params | `trigger_range=6;charge_speed=10;charge_s=0.45;recover_s=0.8;cooldown=3` |
| `affixes` | daftar id affix | kosong (Warden: `volley`) |
| `silt` | int | `0` (Warden 4, boss 8) |

### 3.16 `affixes.csv`

| Kolom | Tipe | Contoh (`blinking`) |
|---|---|---|
| `id` | string | `blinking` |
| `tier` | A/B/C | `B` |
| `telegraph_s` | s | `0.8` |
| `params` | params | `interval=6;min_dist=3` |
| `desc_key` | string | `affix.blinking` |
| `random_pool` | 0/1 (boleh dipilih acak di Crack 2+) | `1` (`hasted` = 0 karena dipakai waktu tambahan) |

### 3.17 `bosses.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `boss_id` | id enemy | `boss_lantern` |
| `phase` | int | `2` |
| `hp_below` | 0 sampai 1 (fase mulai saat HP di bawah) | `0.5` |
| `gap_s` | s | `1.4` |
| `cycle` | daftar id pattern | `ember_rain_8\|snuff_ring_double\|lantern_lanes\|moth_call` |
| `min_crack` | int | `0` (fase 3 `boss_vine`: 4) |
| `transition_s` | s | `1.5` |

### 3.18 `boss_patterns.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | string | `ember_rain_5` |
| `boss_id` | id enemy | `boss_lantern` |
| `archetype` | enum `target_circles`, `ring_gap`, `summon`, `lanes`, `spiral`, `blink_slam`, `lines`, `cone`, `charge_lane` | `target_circles` |
| `telegraph_s` | s (min 1.0 untuk serangan besar, 0.6 untuk cone) | `1.0` |
| `dmg` | number | `10` |
| `params` | params | `count=5;radius=1.5;spread=3` |

### 3.19 `biomes.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | string | `biome_market` |
| `name_key` | string | `biome.market` |
| `tier` | A/B/C | `A` |
| `arena_id` | id dari LD | `arena_market` |
| `palette_id` | id dari AD | `palette_market` |
| `music_id` | id dari AU | `music_market` |

### 3.20 `waves.csv`

Satu baris per slot Pulse per profil run.

| Kolom | Tipe | Contoh |
|---|---|---|
| `profile` | enum `run_a`, `run_b`, `run_c` | `run_a` |
| `pulse` | int | `5` |
| `kind` | enum `normal`, `warden`, `boss` | `warden` |
| `biome` | id bioma | `biome_market` |
| `threat` | int 1 sampai 20 | `5` |
| `duration_s` | s, kosong untuk boss | `32` |
| `warden_id` | id enemy | `warden_hound` |
| `boss_id` | id enemy | kosong |
| `alive_cap` | int | `70` |
| `final` | 0/1 | `0` |

### 3.21 `wave_spawns.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `profile` | profil | `run_a` |
| `pulse` | int | `4` |
| `enemy_id` | id enemy | `tank` |
| `count` | int | `2` |
| `start_frac` | 0 sampai 1 | `0.3` |
| `end_frac` | 0 sampai 1 | `0.9` |
| `group_min`, `group_max` | int | `1`, `1` (swarmer `3`, `6`) |

Untuk Pulse boss, baris tetesan memakai `start_frac=0` dan jadwal dari `config.csv` (`boss_trickle_*`); kolom `count` diabaikan.

### 3.22 `difficulty.csv`

| Kolom | Tipe | Crack 3 (kumulatif) |
|---|---|---|
| `level` | int 0 sampai 5 | `3` |
| `enemy_hp_mult` | number | `1.15` |
| `enemy_dmg_mult` | number | `1.2` |
| `spawn_mult` | number | `1.15` |
| `enemy_speed_mult` | number | `1.0` |
| `price_mult` | number | `1.1` |
| `warden_extra_affixes` | int | `1` |
| `boss_hp_mult` | number | `1.0` |
| `boss_gap_mult` | number | `1.0` |
| `pulse_heal_frac` | 0 sampai 1 (bagian HP hilang yang dipulihkan) | `1.0` |
| `pulse_end_collect_frac` | 0 sampai 1 | `0.5` |
| `silt_mult` | number | `1.75` |

Kolom ditulis sebagai nilai kumulatif per level agar game tidak perlu menjumlah.

### 3.23 `meta_unlocks.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | string | `pack_keepsake_1` |
| `kind` | enum `class`, `weapon`, `keepsake_pack` | `keepsake_pack` |
| `targets` | daftar id | `dust_hourglass\|lucky_button\|haggler_seal` |
| `cost_silt` | int | `20` |
| `tier` | A/B/C | `B` |
| `cost_silt_b` | int, biaya bila build B (isi paket lebih sedikit) | kosong (paket 2: `10`) |

Crack tidak ada di tabel ini; Crack n terbuka setelah menang di Crack n minus 1.

## 4. Bentuk JSON (usulan, LP boleh mengubah)

- Satu objek per tabel, dikunci `id` (atau kunci gabungan seperti `run_a:5`).
- `params` dan `stat_mods` diurai menjadi objek, daftar `|` menjadi array, angka menjadi number.
- `effects.csv` dikelompokkan per `owner` agar mesin efek memuat efek sebuah Keepsake dalam satu langkah.
- Baris dengan tier di atas target build dibuang saat build, sehingga bundle A tidak memuat konten B dan C.
