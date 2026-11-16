# Skema Data CSV

Pemilik: Game Designer (isi dan arti kolom). Format teknis (dialek CSV, bentuk JSON, tipe) milik Lead Programmer di `docs/tech/architecture.md` versi 2 bagian 9; bila berbeda, architecture yang berlaku. Status: versi 2.1, 2026-11-17 (versi 2: perbaikan review M0 dan jawaban `docs/specs/gd-answers-m0.md`; versi 2.1: M1-02, lihat 0.1).
Terkait: `docs/gdd.md`, `docs/systems/effect-primitives.md`.

## 0. Perubahan versi 2

| Hal | Versi 1 | Versi 2 |
|---|---|---|
| Tingkat konten | kolom `tier` | kolom `content_tier` (`A`, `B`, `C`). `tier` di `weapon_tiers.csv` tetap berarti tier senjata |
| Tag | `Flame`, `source_tag:Flame` | id huruf kecil: `flame`, `shard`, `edge`, `echo`, `ward`, `trade`. Nama tampil lewat `tag.<id>.name` |
| Istilah | Keepsake, `keepsakes.csv` | **Memento**, `mementos.csv`, kunci string `memento.*`, kolom `memento_price`, unlock `memento_pack` |
| `config.csv` | `tick_rate`, `glint_merge_value`, `pulse_dur_*`, `spawn_min_dist` | dihapus. Tambah `pulse_clear_s`, `player_vertical_screen_ratio`, radius per ukuran, kunci telegraf minimum, dan lainnya (3.1) |
| `biomes.csv` | `palette_id` | dihapus (palet dicari lewat id bioma di `art/palette.json`). `arena_id` memakai id LD |
| `wave_spawns.csv` | tanpa sektor | kolom opsional `sectors` |
| `waves.csv` | profil `run_a`, `run_b`, `run_c` | tambah `run_a_m1` (prototipe M1) |
| Bentuk JSON | objek berkunci id | array berurutan, architecture 9.4 |

### 0.1 Perubahan versi 2.1 (M1-02)

| Hal | Isi |
|---|---|
| `content_tier` opsional | Kolom `content_tier` opsional (kosong = A) ditambahkan ke `effects.csv`, `waves.csv`, `wave_spawns.csv` (skema kode `src/content/tables`, menunggu review LP). Alasan: efek pemilik B/C dan profil `run_b`/`run_c` boleh tinggal di file yang sama tanpa menggagalkan build A (pemilik efek tidak ber-ref, dan baris `wave_spawns` tidak ikut cascade kunci `(profile, pulse)`) |
| `waves.csv`, `wave_spawns.csv` | Dihasilkan `python tools/balance/model.py gen` dari tabel `PROFILES` di model. Edit model, bukan CSV |
| Kolom `notes` | Semua tabel baris boleh punya kolom `notes` (diabaikan build) |
| Bioma 2 dan 3 | `arena_id` sementara `arena_market` sampai LD membuat `arena_cloister` dan `arena_vineyard` |
| Kunci `params` | Daftar kunci yang dipakai data ada di bagian 5, untuk registri GP |

## 1. Konvensi

Dialek lengkap: architecture 9.2. Ringkasan untuk penulis data:

| Aturan | Nilai |
|---|---|
| Lokasi | `content/data/<tabel>.csv`, dibangun `tools/data/build-data.ts` menjadi `content/generated/game-data.json` |
| Encoding | UTF-8 tanpa BOM, baris pertama header `snake_case` |
| Pemisah | koma; sel berisi koma dibungkus kutip ganda |
| Desimal | titik (`0.25`), tanpa pemisah ribuan |
| Daftar dalam sel | dipisah `\|` (contoh `flame\|edge`) |
| Parameter dalam sel | `kunci=nilai;kunci=nilai` |
| Syarat efek | `nama:nilai` dipisah `\|` |
| Boolean | `0` atau `1` |
| Sel kosong | default kolom |
| Komentar | baris diawali `#` diabaikan |
| Id | `snake_case`, unik per tabel, tidak berubah setelah dipakai. Berlaku juga untuk tag, bioma (`biome_market`), arena (`arena_proto`) |
| Teks | Tidak ada teks tampil di CSV. Kolom `*_key` merujuk string table Writer |
| Tingkat konten | `content_tier` = tingkat minimum. Build tingkat X memuat baris dengan `content_tier` <= X |
| Persen | Stat berjenis `pct` ditulis sebagai poin persen (`damage_pct=8` = +8%). Peluang dan pengali sebagai pecahan (`chance=0.08`, `dmg_frac=0.4`) |
| Satuan | Ditentukan skema per kolom: waktu detik, jarak u, kecepatan u/s, sudut derajat. Tidak ada piksel di data |
| Urutan baris | Urutan baris = index padat dan urutan pool untuk pengundian RNG. Mengubah urutan baris mengubah hasil seed. Kolom `sort` hanya untuk tampilan |

Validasi minimal (dijalankan build data, architecture 9.3):
1. Semua rujukan id ada (senjata awal, owner efek, enemy di `wave_spawns`, pattern boss, target unlock, arena bioma).
2. Enum valid (trigger, action, condition, tag, rarity, `content_tier`, role, sektor).
3. Kunci `params` dikenal untuk aksi atau arketipe itu.
4. Angka dalam rentang `stats.csv` (min, max).
5. Setiap senjata dan Memento punya minimal 1 tag (P1-b).
6. Laporan P1-a: persentase Memento `is_flat=1` di pool toko per tingkat.
7. `telegraph_s` musuh, affix, dan pola boss tidak di bawah kunci `telegraph_min_*_s` yang sesuai (P2-e).
8. Sumber `convert` tidak boleh menjadi target `convert` lain (mencegah siklus, effect-primitives 6.5).

## 2. Daftar tabel

| Tabel | Isi | Dipakai oleh |
|---|---|---|
| `config.csv` | Konstanta balance global skalar | semua |
| `stats.csv` | Definisi stat pemain | stat, UI |
| `classes.csv` | Kelas | pilih kelas, run |
| `rites.csv` | Rite | kombat |
| `weapons.csv` | Senjata tier I | kombat, toko |
| `weapon_tiers.csv` | Bonus per tier per senjata | kombat |
| `rarity.csv` | Harga dan pengali per rarity | toko, kombat |
| `rarity_weights.csv` | Bobot rarity per threat | toko, level-up, peti |
| `mementos.csv` | Memento | toko, peti |
| `effects.csv` | Semua efek primitif | mesin efek |
| `synergies.csv` | Ambang tag | mesin efek, UI |
| `levelup.csv` | Kartu level-up | level-up |
| `shop.csv` | Aturan toko | toko |
| `statuses.csv` | Aturan status | kombat |
| `enemies.csv` | Unlit, Warden, boss | spawner, AI |
| `affixes.csv` | Affix Warden | AI |
| `bosses.csv` | Fase boss | AI boss |
| `boss_patterns.csv` | Pola serangan boss | AI boss |
| `biomes.csv` | Bioma | run, render, audio |
| `waves.csv` | Slot Pulse per profil run | run, spawner |
| `wave_spawns.csv` | Komposisi spawn per Pulse | spawner |
| `difficulty.csv` | Crack 0 sampai 5 | run |
| `meta_unlocks.csv` | Unlock Silt | meta |

Tabel minimum M1 (M1-02): `config`, `stats`, `classes`, `rites`, `weapons`, `weapon_tiers`, `rarity`, `rarity_weights`, `mementos`, `effects`, `synergies`, `levelup`, `shop`, `statuses`, `enemies`, `biomes`, `waves`, `wave_spawns`. Tabel lain boleh kosong (hanya header) sampai M2.

## 3. Kolom per tabel

### 3.1 `config.csv`

| Kolom | Tipe | Arti |
|---|---|---|
| `key` | id | Nama konstanta, harus dideklarasikan di skema |
| `value` | number | Nilai |
| `notes` | string | Catatan (tidak dibaca game) |

Konstanta teknis (`TICK_RATE`, satuan, kamera, kapasitas pool) ada di kode LP, bukan di sini.

| Kunci | Nilai awal | Arti | Sumber |
|---|---|---|---|
| `player_base_speed` | 4.5 | u/s horizontal | GDD 5.1 |
| `player_vertical_screen_ratio` | 0.8 | Kecepatan layar vertikal pemain relatif horizontal (rentang kalibrasi 0.75 sampai 0.85) | CD K7, architecture 7.1 |
| `player_radius` | 0.35 | u | GDD 5.1 |
| `pickup_radius_base` | 1.6 | u | GDD 4.2 |
| `glint_fly_speed` | 12 | u/s | GDD 4.2 |
| `glint_collect_dist_add` | 0.2 | Butir terpungut pada jarak `player_radius` + nilai ini | jawaban GD |
| `glint_floor_cap` | 150 | Butir di lantai sebelum aturan gabung | GDD 4.2 |
| `pulse_end_collect_frac` | 0.5 | Pungutan otomatis akhir Pulse | GDD 3.3 |
| `pulse_clear_s` | 1.0 | Durasi fase `pulseClear` | GDD 3.3 |
| `iframes_hurt` | 0.5 | Kebal setelah kehilangan HP | GDD 5.3 |
| `iframes_dodge` | 0.2 | Kebal setelah dodge | GDD 5.3 |
| `iframes_block` | 0.2 | Kebal setelah Barrier menyerap | Q05 |
| `knockback_s` | 0.1 | Waktu sebar dorongan | Q08 |
| `armor_k` | 15 | Konstanta rumus armor | GDD 5.3 |
| `armor_max_reduction` | 0.85 | | GDD 5.3 |
| `guard_min_frac` | 0.25 | | GDD 5.2 |
| `proc_growth` | 0.2 | `proc_scale(t)` | GDD 5.2 |
| `burn_dps_nonhit` | 2 | DPS Burn per tumpukan dari sumber non-hit, dikali `proc_scale` | Q07 |
| `enemy_hp_lin` | 0.12 | `hp(t)` | GDD 5.5 |
| `enemy_hp_quad` | 0.006 | `hp(t)` | GDD 5.5 |
| `enemy_dmg_lin` | 0.07 | `dm(t)` | GDD 5.3 |
| `price_growth` | 0.08 | | GDD 4.3 |
| `xp_base` | 15 | | GDD 11.1 |
| `xp_per_level` | 10 | | GDD 11.1 |
| `extra_projectile_spread_deg` | 12 | | GDD 5.2 |
| `weapon_slots` | 6 | | GDD 4.4 |
| `leech_heal_cap_per_s` | 6 | | GDD 5.1 |
| `spawn_mark_s` | 0.8 | Telegraf spawn | GDD 3.2 |
| `spawn_grace_s` | 0.3 | Tanpa damage kontak dan serangan setelah keluar | Q16 |
| `spawn_group_spread` | 0.5 | Radius sebar anggota grup (u) | Q15 |
| `spawn_mark_diam_small` | 1.0 | u | arena-design 5.3 |
| `spawn_mark_diam_medium` | 1.5 | u | arena-design 5.3 |
| `spawn_mark_diam_large` | 2.0 | u | arena-design 5.3 |
| `spawn_mark_diam_warden` | 3.0 | u | arena-design 5.3 |
| `spawn_quiet_end_s` | 2 | Tanpa telegraf spawn baru di detik terakhir Pulse | GDD 3.2 |
| `enemy_radius_small` | 0.3 | u | Q20 |
| `enemy_radius_medium` | 0.4 | u | Q20 |
| `enemy_radius_large` | 0.6 | u | Q20 |
| `enemy_radius_warden` | 0.9 | u | Q20 |
| `enemy_radius_boss` | 1.6 | u | Q20 |
| `enemy_shot_radius` | 0.2 | u | Q20 |
| `player_shot_radius` | 0.15 | u | Q20 |
| `telegraph_min_projectile_s` | 0.4 | P2-e | GDD 14.1 |
| `telegraph_min_charge_s` | 0.6 | P2-e | GDD 14.1 |
| `telegraph_min_area_s` | 0.8 | P2-e | GDD 14.1 |
| `telegraph_min_boss_s` | 1.0 | P2-e | GDD 14.1 |
| `music_pressure_frac` | 0.6 | Fraksi `alive_cap` untuk tekanan musik | Q21 |
| `music_pressure_release_frac` | 0.5 | | Q21 |
| `warden_spawn_frac` | 0.25 | | GDD 15.1 |
| `warden_overtime_haste_s` | 20 | | GDD 3.3 |
| `boss_entry_s` | 2.0 | Telegraf panggung boss | Q35 |
| `boss_enrage_s` | 120 | | GDD 3.3 |
| `boss_enrage_gap_mult` | 0.6 | | GDD 3.3 |
| `boss_trickle_every_s` | 4 | | GDD 3.3 |
| `boss_trickle_count` | 2 | | GDD 3.3 |
| `boss_trickle_max_alive` | 24 | | Q35 |
| `death_slowmo_s` | 1.0 | | Q38 |
| `victory_delay_s` | 1.5 | | Q38 |

Kunci yang dihapus di versi 2: `tick_rate` (konstanta LP), `glint_merge_value` (aturan gabung baru), `pulse_dur_base`, `pulse_dur_step`, `pulse_dur_max` (durasi dari `waves.csv`), `spawn_min_dist` (sumber tunggal: `spawn.playerSafeRadius` di JSON arena).

### 3.2 `stats.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | id | `armor` |
| `base` | number | `0` |
| `min` | number | `-10` |
| `max` | number | kosong = tanpa batas |
| `unit` | enum `flat`, `pct`, `u`, `u_per_s`, `per_s`, `s` | `flat` |
| `display_key` | string | `stat.armor` |
| `show_in_ui` | 0/1 | `1` |

`move_speed` dan `pickup_radius_pct` adalah bonus persen (dasar 0); nilai fisik = konstanta dasar di `config.csv` x (1 + stat / 100). Urutan komposisi stat: effect-primitives 6.5.

### 3.3 `classes.csv`

| Kolom | Tipe | Contoh (`lantern`) |
|---|---|---|
| `id` | id | `lantern` |
| `name_key`, `desc_key` | string | `class.lantern.name` |
| `content_tier` | A/B/C | `A` |
| `accent` | enum `blue`, `cyan`, `gold` | `gold` |
| `tag` | id tag | `flame` |
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
| `id` | id | `flare_lantern` |
| `name_key`, `desc_key` | string | |
| `content_tier` | A/B/C | `A` |
| `archetype` | enum `throw_zone`, `ring`, `dash` | `throw_zone` |
| `cooldown` | s | `12` |
| `dmg` | number (proc) | `20` |
| `radius` | u | `3` |
| `params` | params | `max_range=6;flight_s=0.35;zone_radius=3;zone_s=4;zone_tick=0.5;slow=30;status=burn` |

### 3.5 `weapons.csv`

| Kolom | Tipe | Contoh (`splinter_shot`) |
|---|---|---|
| `id` | id | `splinter_shot` |
| `name_key`, `desc_key` | string | |
| `content_tier` | A/B/C | `A` |
| `tags` | daftar id tag | `shard` |
| `archetype` | enum `bolt_explode`, `projectile`, `arc`, `orbit`, `chain`, `boomerang`, `ring_echo`, `coin` | `projectile` |
| `kind` | enum source_kind | `projectile` |
| `targeting` | enum `nearest`, `self`, `nearest_dir` | `nearest` |
| `dmg` | number | `6` |
| `dmg2` | number | kosong (ledakan sekunder, mis. Lantern Bolt 6) |
| `cooldown` | s | `0.7` |
| `range` | u | `7` |
| `speed` | u/s | `14` |
| `radius` | u (area atau orbit) | kosong |
| `proj_radius` | u, kosong = `player_shot_radius` | kosong |
| `count` | int | `1` |
| `pierce` | int | `0` |
| `knockback` | u | `0` |
| `params` | params | kosong (mis. Chain Spark `jumps=3;jump_range=2.8;burn_chance=0.2`) |
| `unlock_silt` | int | `0` |

Stat yang berlaku per arketipe: GDD 6.3.

### 3.6 `weapon_tiers.csv`

Satu baris per senjata per tier II sampai IV (tier I = baris `weapons.csv`). Pengali umum ada di `rarity.csv`; tabel ini hanya bonus khusus. Digabung saat build menjadi `tiers[0..3]`.

| Kolom | Tipe | Contoh |
|---|---|---|
| `weapon_id` | id senjata | `splinter_shot` |
| `tier` | 2, 3, 4 (tier senjata) | `4` |
| `params` | params (kumulatif terhadap tier sebelumnya) | `fan_every_n=3;fan_count=3` |
| `effects` | daftar owner efek | kosong |

### 3.7 `rarity.csv`

| Kolom | Tipe | Plain | Fine | Rare | Fabled |
|---|---|---|---|---|---|
| `id` | id | `plain` | `fine` | `rare` | `fabled` |
| `order` | int | 0 | 1 | 2 | 3 |
| `color_token` | string | `rarity-plain` | `rarity-fine` | `rarity-rare` | `rarity-fabled` |
| `memento_price` | int | 14 | 28 | 50 | 85 |
| `weapon_price` | int | 16 | 34 | 70 | 130 |
| `weapon_dmg_mult` | number | 1.0 | 1.5 | 2.2 | 3.2 |
| `weapon_cd_mult` | number | 1.00 | 0.95 | 0.90 | 0.85 |

### 3.8 `rarity_weights.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `t_min`, `t_max` | int | `1`, `3` |
| `plain`, `fine`, `rare`, `fabled` | number | `78`, `20`, `2`, `0` |

### 3.9 `mementos.csv`

| Kolom | Tipe | Contoh (`prism_lens`) |
|---|---|---|
| `id` | id | `prism_lens` |
| `name_key`, `desc_key`, `flavor_key` | string | `memento.prism_lens.name` |
| `content_tier` | A/B/C | `A` |
| `rarity` | id rarity | `rare` |
| `tags` | daftar id tag | `shard` |
| `max_stack` | int | `1` |
| `unlock` | `default` atau id `meta_unlocks` | `default` |
| `is_flat` | 0/1 (kuota P1-a) | `0` |
| `price_override` | int, kosong = dari rarity | kosong |
| `sort` | int | `7` |

Efek ditulis di `effects.csv` dengan `owner` = id Memento.

### 3.10 `effects.csv`

Definisi lengkap tiap kolom dan enum di `effect-primitives.md`.

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | id | `prism_lens_1` |
| `owner` | id Memento, kelas, atau `syn_<tag>_<n>` | `prism_lens` |
| `trigger` | enum | `on_hit` |
| `conditions` | daftar `nama:nilai` | `source_kind:projectile\|every_nth:5@global` |
| `chance` | 0 sampai 1 | kosong (1) |
| `icd` | s | kosong |
| `max_per_pulse` | int | kosong |
| `allow_proc` | 0/1 | kosong (default per aksi) |
| `stack_mode` | `value`, `chance`, `none` | `none` |
| `action` | enum | `spawn_projectile` |
| `params` | params | `pattern=split;count=3;dmg_frac=0.4;origin=target` |
| `content_tier` | A/B/C, opsional (kosong = A) | `A`. Samakan dengan tingkat pemiliknya |

Parameter pemicu ikut di `params` (`interval` untuk `periodic`, `distance` untuk `on_distance`).

### 3.11 `synergies.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `tag` | id tag | `flame` |
| `threshold` | 2, 4, 6 | `4` |
| `content_tier` | A/B/C (tingkat tempat tag aktif) | `A` |
| `owner` | id | `syn_flame_4` |
| `desc_key` | string | `syn.flame.4` |

Urutan tag (`GameData.tags`): `flame`, `shard`, `edge`, `echo`, `ward`, `trade`.

### 3.12 `levelup.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | id | `card_damage` |
| `stat` | id stat | `damage_pct` |
| `plain`, `fine`, `rare`, `fabled` | number | `5`, `8`, `12`, `18` |
| `content_tier` | A/B/C | `A` |
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
| `bad_luck_shops` | 3 |
| `bad_luck_min_t` | 6 |
| `warden_chest_choices` | 3 |
| `warden_chest_min_rarity` | `fine` |
| `boss_chest_min_rarity` | `rare` |

`lock_free` dihapus (kunci selalu gratis, aturan GDD 4.4).

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
| `id` | id | `charger` |
| `name_key` | string | `unlit.charger` |
| `content_tier` | A/B/C | `A` |
| `role` | enum `swarmer`, `charger`, `shooter`, `tank`, `exploder`, `summoner`, `mote`, `lobber`, `warden`, `boss` | `charger` |
| `behavior` | enum arketipe AI (sama dengan role untuk Unlit biasa, mis. `warden_hound`, `boss_lantern`) | `charger` |
| `size_class` | enum `small`, `medium`, `large`, `warden`, `boss` | `medium` |
| `radius` | u, kosong = `enemy_radius_<size_class>` | kosong |
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
| `id` | id | `blinking` |
| `content_tier` | A/B/C | `B` |
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
| `id` | id | `ember_rain_5` |
| `boss_id` | id enemy | `boss_lantern` |
| `archetype` | enum `target_circles`, `ring_gap`, `summon`, `lanes`, `spiral`, `blink_slam`, `lines`, `cone`, `charge_lane` | `target_circles` |
| `telegraph_s` | s (min `telegraph_min_boss_s`, cone min `telegraph_min_charge_s`) | `1.0` |
| `dmg` | number | `10` |
| `params` | params | `count=5;radius=1.5;spread=3` |

### 3.19 `biomes.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | id | `biome_market` |
| `name_key` | string | `biome.biome_market.name` |
| `content_tier` | A/B/C | `A` |
| `arena_id` | id arena LD | `arena_market` (M1: `arena_proto`) |
| `music_id` | id dari AU | `music_market` |

Id bioma: `biome_market`, `biome_cloister`, `biome_vineyard`. Arena: `arena_market`, `arena_cloister`, `arena_vineyard`, `arena_proto`. Palet dan cahaya dicari lewat id bioma di `art/palette.json` (milik AD).

### 3.20 `waves.csv`

Satu baris per slot Pulse per profil run.

| Kolom | Tipe | Contoh |
|---|---|---|
| `profile` | enum `run_a_m1`, `run_a`, `run_b`, `run_c` | `run_a` |
| `pulse` | int, mulai 1 | `5` |
| `kind` | enum `normal`, `warden`, `boss` | `warden` |
| `biome` | id bioma | `biome_market` |
| `threat` | int 1 sampai 20 | `5` |
| `duration_s` | s, kosong untuk boss (sumber tunggal durasi Pulse) | `32` |
| `warden_id` | id enemy | `warden_hound` |
| `boss_id` | id enemy | kosong |
| `alive_cap` | int, maks 120 | `70` |
| `final` | 0/1 (Pulse terakhir; selesai = menang) | `0` |
| `content_tier` | A/B/C, opsional (kosong = A) | `run_a_m1` dan `run_a` = A, `run_b` = B, `run_c` = C |

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
| `sectors` | daftar sektor `n`, `s`, `e`, `w`, `ne`, `se`, `sw`, `nw`; kosong = semua | kosong |
| `content_tier` | A/B/C, opsional (kosong = A), sama dengan baris `waves.csv`-nya | `A` |

Kunci gabungan `(profile, pulse)` harus ada di `waves.csv`. Untuk Pulse boss, baris tetesan memakai `start_frac=0` dan jadwal dari `config.csv` (`boss_trickle_*`); kolom `count` diabaikan.

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

Kolom ditulis sebagai nilai kumulatif per level agar game tidak perlu menjumlah. Tingkat A dan B hanya memakai baris level 0.

### 3.23 `meta_unlocks.csv`

| Kolom | Tipe | Contoh |
|---|---|---|
| `id` | id | `pack_memento_1` |
| `kind` | enum `class`, `weapon`, `memento_pack` | `memento_pack` |
| `targets` | daftar id | `dust_hourglass\|lucky_button\|haggler_seal` |
| `cost_silt` | int | `20` |
| `content_tier` | A/B/C | `B` |
| `cost_silt_b` | int, biaya bila build B (isi paket lebih sedikit) | kosong (paket 2: `10`) |

Crack tidak ada di tabel ini; Crack n terbuka setelah menang di Crack n minus 1.

## 4. Bentuk JSON

Final di architecture 9.4: satu bundle `content/generated/game-data.json`, setiap tabel menjadi array dalam urutan baris CSV, `params` menjadi objek, daftar menjadi array, `weapon_tiers.csv` digabung ke senjata (`tiers[0..3]`), `waves.csv` dan `wave_spawns.csv` digabung menjadi `profiles[profile][i].spawns[]`, `effectsByOwner` dibangun saat load, baris di atas `contentTier` build dibuang saat build. Konversi satuan (detik ke tick, derajat ke putaran) di `buildGameData`.

## 5. Kunci `params` yang dipakai data (M1-02)

Untuk registri `src/content/params-registry.ts` (GP). Arti mengikuti GDD dan effect-primitives. Waktu dalam detik, jarak dalam u, kecepatan dalam u/s, sudut dalam derajat, persen sebagai poin persen. Bila GP butuh nama lain, GP menulis `docs/specs/gp-*.md` dan GD mengganti CSV; jangan dua nama untuk satu arti.

| Tabel | Diskriminator | Kunci |
|---|---|---|
| `weapons` | `bolt_explode` | `explode_status` |
| | `arc` | `arc_deg` |
| | `orbit` | `rev_s` (detik per putaran) |
| | `chain` | `jumps`, `jump_range`, `burn_chance` |
| | `boomerang` | `hit_out`, `hit_back` (0/1) |
| | `ring_echo` | `echo_delay`, `echo_frac`, `echo_count` |
| | `coin` | `glint_per_kill`, `glint_cap_base`, `glint_cap_per_tier` |
| `weapon_tiers` (tanpa registri) | per senjata | `radius_add`, `fire_zone_radius`, `fire_zone_s`, `pierce_add`, `fan_every_n`, `fan_count`, `arc_deg_add`, `spin_every_n`, `count_add`, `lunge_every_s`, `lunge_dist`, `jumps_add`, `allow_return`, `speed_pct_add`, `blades`, `echo_count_add`, `bounce`, `glint_per_kill_add`. Akhiran `_add` menambah nilai tier sebelumnya |
| `rites` | `throw_zone` | `max_range`, `flight_s`, `zone_radius`, `zone_s`, `zone_tick`, `slow`, `status` |
| | `ring` | `knockback`, `slow`, `slow_s` |
| | `dash` | `dash_dist`, `dash_s`, `iframes_s`, `crit_hits`, `crit_window_s` |
| `enemies` | `swarmer` | `weave_amp`, `weave_hz` |
| | `charger` | `trigger_range`, `charge_speed`, `charge_s`, `recover_s`, `cooldown` |
| | `shooter` | `keep_min`, `keep_max`, `shot_speed`, `shot_life`, `cooldown` |
| | `tank`, `mote` | (kosong) |
| | `exploder` | `trigger_range`, `fuse_s`, `blast_radius`, `fuse_move_mult`, `enemy_dmg` |
| | `summoner` | `keep_min`, `keep_max`, `summon_every`, `summon_count`, `max_summons`, `summon_id` |
| | `lobber` | `keep_min`, `keep_max`, `cooldown`, `zone_radius` |
| | `warden_hound` | `trigger_range`, `charges`, `charge_gap_s`, `charge_speed`, `charge_s`, `rest_s`, `drop_count` |
| | `warden_choir` | `keep_min`, `keep_max`, `fan_count`, `fan_deg`, `shot_speed`, `shot_life`, `cooldown`, `drop_count` |
| | `warden_bulwark` | `slam_every`, `slam_radius`, `drop_count` |
| | `boss_lantern`, `boss_bell`, `boss_vine` | `drop_count` (pola di `bosses.csv`) |
| `affixes` (tanpa registri) | per id | `hasted`: `move_pct`. `volley`: `count`, `dmg`, `shot_speed`, `shot_life`. `veiled`: `shell_frac`, `regrow_s`. `blinking`: `interval`, `min_dist`. `brood`: `interval`, `count`, `summon_id`. `tar_trail`: `radius`, `duration`, `slow`, `drop_every`. `pulsing`: `interval`, `radius`, `dmg`. `bulwark`: `guard_add`, `kb_immune` |
| `boss_patterns` | `target_circles` | `count`, `radius`, `spread`, `first_on_player` |
| | `ring_gap` | `rings`, `ring_gap_s`, `thickness`, `speed`, `max_radius`, `gap_deg`, `min_gap_diff_deg` |
| | `lanes` | `count`, `width`, `y_min`, `y_max`, `min_sep`, `spacing`, `speed` |
| | `summon` | `count`, `enemy_id` |
| | `spiral` | `arms`, `duration`, `rate`, `speed` |
| | `blink_slam` | `radius` |
| | `lines` | `count`, `width`, `fan_count`, `fan_deg`, `fan_dmg`, `fan_speed` |
| | `cone` | `count`, `fan_deg`, `speed`, `repeats`, `repeat_gap_s` |
| | `charge_lane` | `width`, `speed` |
| `effects` | per `action` | Sesuai effect-primitives 5. Parameter pemicu: `interval` (`periodic`), `distance` (`on_distance`). Tambahan: `spawn_projectile` memakai `seek_range`, `tags`, `kind`; `buff.stats` berbentuk `stat:nilai\|stat:nilai` |
