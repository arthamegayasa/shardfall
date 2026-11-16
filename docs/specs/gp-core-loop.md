# Spec GP: Core Loop Simulasi (M1-03)

Pemilik: Gameplay Programmer (GP). Status: versi 1, 2026-11-17. Reviewer: LP (kode), QA (build).
Dasar: `docs/tech/architecture.md` v2.1 (kontrak beku di `src/core/contracts/`), `docs/gdd.md` v2, `docs/systems/effect-primitives.md` v2, `docs/systems/data-schema.md` v2, `docs/specs/gd-answers-m0.md`.

## 1. Lingkup

Implementasi `createSim` di `src/sim/` menggantikan stub: state run dan fase (sesuai `RunPhase` kontrak: `idle`, `pulse`, `pulseClear`, `reward`, `levelUp`, `shop`, `victory`, `defeat`; pilih kelas adalah state app), gerak, senjata Tingkat A dengan tier, Rite, spawner, AI 4 Unlit, Warden dan boss dasar, proyektil, spatial hash, damage dan stat, Glint, XP dan level-up, toko, mesin efek, akhir run, event, save dan load, hash state, helper hook e2e. Semua angka dari `GameData`; konstanta teknis (kapasitas pool, sel grid) di `src/sim/capacity.ts`.

## 2. Struktur kode

| File | Isi |
|---|---|
| `create-sim.ts` | Factory, urutan tick, command, debug command |
| `world.ts`, `pools.ts`, `ctx.ts` | State (WorldView langsung dari pool SoA), state run, konteks hit |
| `sim-data.ts`, `codes.ts` | Tabel turunan dari GameData (tier senjata, efek, kode) |
| `arena.ts`, `spatial-hash.ts` | Batas poligon cembung, sektor spawn, grid 2 u |
| `stats.ts` | Komposisi stat effect-primitives 6.5 |
| `effects/` | Owner, hitungan tag, sinergi, 15 syarat, 16 pemicu, 16 aksi, `procDepth` |
| `systems/` | player, weapons, projectiles, enemy-shots, enemies, boss, spawner, areas, combat, pickups, xp, progression, shop, run |
| `state-hash.ts`, `save-codec.ts`, `e2e-support.ts` | Hash 8.4, save 6.11, stress dan replay |

Urutan tick (GDD 3.6): command, timer Pulse (akhir Pulse melewati kombat), gerak dan Rite pemain, spawner dan tanda, boss, AI Unlit, senjata, proyektil pemain, zona, status, aksi tertunda, efek berkala, kematian boss (menang atas kematian pemain), area bahaya, proyektil musuh, kontak, pickup.

## 3. Kontrak param (nama kunci yang dibaca sim)

Kunci yang hilang tidak diganti angka di kode: perilaku itu nonaktif. GD sudah memakai nama yang sama untuk kelas, Rite, senjata, tier, status.

| Tabel | Diskriminator | Kunci |
|---|---|---|
| weapons | `bolt_explode` | `explode_status`; tier: `radius_add`, `fire_zone_radius`, `fire_zone_s` |
| weapons | `projectile` | tier: `pierce_add`, `count_add`, `fan_every_n`, `fan_count` |
| weapons | `arc` | `arc_deg`; tier: `arc_deg_add`, `spin_every_n` |
| weapons | `orbit` | `rev_s` (cooldown = kontak ulang); tier: `count_add` |
| weapons | `chain` | `jumps`, `jump_range`, `burn_chance`; tier: `jumps_add`, `allow_return` |
| weapons | `boomerang` | tier: `speed_pct_add`, `blades` |
| weapons | `ring_echo` | `echo_delay`, `echo_frac`, `echo_count`; tier: `radius_add`, `echo_count_add` |
| semua tier | | `<kolom>_add` menambah kolom dasar (`dmg`, `dmg2`, `range`, `radius`, `count`, `pierce`, `knockback`); kunci lain menimpa |
| rites | `throw_zone` | `max_range`, `flight_s`, `zone_radius`, `zone_s`, `zone_tick`, `slow`, `status` |
| rites | `ring` | `knockback`, `slow`, `slow_s` |
| rites | `dash` | `dash_dist`, `iframes_s`, `crit_hits`, `crit_window_s` (`radius` = setengah lebar) |
| enemies | `charger` | `trigger_range`, `charge_speed`, `charge_s`, `recover_s`, `cooldown` (ancang-ancang = `telegraph_s`) |
| enemies | `shooter` | `keep_min`, `keep_max`, `shot_speed`, `shot_life`, `cooldown` |
| enemies | `warden_hound` | kunci charger + `charges`, `charge_gap_s`, `rest_s` |
| enemies | semua | `drop_count` (jumlah butir Glint; Warden 5, boss 8; kosong = 1) |
| affixes | `volley` / `hasted` | `count`, `dmg`, `shot_speed`, `shot_life` / `move_pct` |
| boss_patterns | `target_circles` | `count`, `radius`, `spread` |
| boss_patterns | `ring_gap` | `rings`, `ring_gap_s`, `thickness`, `speed`, `max_radius`, `gap_deg`, `min_gap_diff_deg` |
| boss_patterns | `lanes` | `count`, `width`, `y_min`, `y_max`, `min_sep`, `spacing`, `speed` |
| boss_patterns | `summon` | `enemy_id`, `count` |
| statuses | `burn` / `mark` | `dps_frac` / `vuln` |
| effects | per aksi | sesuai effect-primitives 5; `spawn_projectile` wajib `speed` dan `range` (bila kosong, diambil dari senjata pemicu) |

Registri `PARAMS_REGISTRY` belum saya isi agar CSV GD yang sedang ditulis tidak tertolak; usulan entri ada di laporan.

## 4. Kriteria keberhasilan (semua punya tes di `tests/unit/sim/`)

| ID | Kriteria | Tes |
|---|---|---|
| K01 | `run.start` masuk `pulse`; timer 0 masuk `pulseClear` selama `pulse_clear_s`, lalu `levelUp` (bila ada level) lalu `shop`; `pulse.begin` memulai Pulse berikut. Command di fase salah ditolak `WrongPhase` | phases |
| K02 | Gerak horizontal = `player_base_speed x (1 + move_speed/100)` per tick; vertikal memakai rumus kompensasi architecture 7.1 dengan `player_vertical_screen_ratio`; pemain dijepit di dalam batas | movement |
| K03 | Senjata menembak hanya bila ada Unlit dalam jangkauan; cooldown = dasar x pengali tier / (1 + attack_speed/100); Lantern Bolt memberi hit tumbukan lalu ledakan area dengan Burn; pengali damage tier dari `rarity.csv` | weapons |
| K04 | Rite: tekan dengan muatan memancarkan `RiteCast`, mendarat setelah `flight_s` di titik bidik yang dijepit `max_range`, meninggalkan zona; tanpa muatan memancarkan `RiteRejected`; isi ulang memakai `cooldown x (1 - rite_haste/100)` | weapons |
| K05 | Spawner: jumlah Unlit per Pulse = jumlah `count` di `wave_spawns`; tanda spawn `spawn_mark_s` sebelum Unlit keluar; tanpa damage kontak selama `spawn_grace_s`; Unlit terhitung tidak melewati `alive_cap`; tidak ada tanda baru di `spawn_quiet_end_s` terakhir | spawner |
| K06 | Setiap serangan Unlit didahului telegraf data: terjang charger (`TelegraphStarted` Charge, durasi `telegraph_s`), tembakan shooter (Projectile), volley Warden (Ring) | spawner |
| K07 | Warden muncul lewat tanda di `warden_spawn_frac` durasi; menahan timer (overtime) sampai mati; kill memberi fase `reward` dengan pilihan minimal rarity `warden_chest_min_rarity` | warden-boss |
| K08 | Boss: telegraf panggung `boss_entry_s`, kebal sebelum keluar; pola memakai telegraf sebelum damage; fase 2 di ambang `hp_below` dengan transisi kebal; boss final mati: menang setelah `victory_delay_s` | warden-boss |
| K09 | Damage keluar: `max(hit x guard_min_frac, hit - guard)`; damage masuk: armor `k/(k+armor)`, kebal `iframes_hurt`, dodge dan Barrier sesuai GDD 5.3 | combat |
| K10 | Burn: dps = `dps_frac x hit`; tick tiap `tick` detik dikali `status_rule dmg_mult` kelas; tumpukan sampai `burn_max_stacks` | combat |
| K11 | Komposisi stat: dasar, tambah, kali, min (terkecil bukan nol), jepit, convert, jepit ulang | combat |
| K12 | Glint: drop di kematian, tertarik dalam radius pungut, terpungut di `player_radius + glint_collect_dist_add`, menambah XP; batas lantai menggabung nilai tanpa kehilangan; akhir Pulse memungut `floor(total x pulse_end_collect_frac)` | economy |
| K13 | XP ke level berikut = `xp_base + xp_per_level x L`; layar level-up memberi 3 kartu stat berbeda; pilihan menambah stat; kartu `max_hp` juga menambah HP | economy |
| K14 | Toko: jumlah tawaran = `slots`; harga = `priceFor`; beli, reroll berbiaya naik, kunci bertahan lewat reroll, jual tidak boleh senjata terakhir, Fuse manual, merge otomatis saat slot penuh, penolakan `NotEnoughGlint` dan `SlotsFull` | economy |
| K15 | Mesin efek: 12 Memento Tingkat A berjalan lewat primitif (contoh diuji: `coal_locket`, `kindling_jar`, `glass_marble`, `headsman_hook`, `splinter_comb`, `smolder_boots`, `ashen_crown`, `whetstone`, `duelist_ribbon`); ambang sinergi 2 aktif dengan `SynergyActivated`; rantai `procDepth` berhenti di kedalaman 2 | effects |
| K16 | Kalah: HP 0 memancarkan `PlayerDied`, `defeat` setelah `death_slowmo_s`; `run.abandon` memberi `RunOutcome.Abandon`; profil tanpa boss menang saat Pulse `final` selesai | phases |
| K17 | Determinisme: seed dan rekaman input sama menghasilkan hash identik tiap 60 tick; seed beda berbeda; replay memutar ulang tanpa selisih; save lalu load di toko menghasilkan hash identik dengan run tanpa jeda; reroll tidak mengubah aliran `spawn` | determinism |
| K18 | Bot sederhana (lari dari musuh terdekat, beli termurah) menyelesaikan run 10 Pulse sampai menang atau kalah tanpa error, cepat (lebih dari 20x waktu nyata) | bot |
| K19 | Data dengan tabel wajib hilang: `createSim` tidak crash dan `run.start` ditolak `UnknownId` | phases |
| K20 | Helper e2e: `stressCommands('peak')` menghasilkan debug command yang diterima sim; `playReplay` mencocokkan checkpoint | e2e-support |

## 5. Penyimpangan dan asumsi

- [Asumsi] Kurva kepadatan w(tau) GDD 3.2 belum punya kunci di `config.csv`; waktu grup diambil seragam dalam jendela `[start_frac, end_frac]` dipotong `spawn_quiet_end_s`. Usul kunci `spawn_curve_*` ke GD dan LP.
- [Asumsi] Gerak lambat saat mati dibuat sebagai pembekuan simulasi selama `death_slowmo_s` (faktor lambat tidak ada di data); render boleh menampilkan efek lambat.
- Belum ada kunci data untuk: ambang HP rendah (`PlayerHpLowChanged` belum dipancarkan), ambang tekanan musik sebagai event (tidak ada event di kontrak beku), cooldown minimum senjata 0.1 s (dipakai minimum 1 tick), Silt per Pulse dan bonus menang (Tingkat A tanpa Silt).
- Perilaku tier IV yang belum dibuat: Orbit Shards lunge (`lunge_every_s`), Tithe Coin Glint per kill (Tingkat B). Pola boss `spiral`, `blink_slam`, `lines`, `cone`, `charge_lane` memakai cadangan satu serangan bertelegraf (M2). Affix selain `volley` dan `hasted` belum aktif (Tingkat B).
- Rite tidak membawa tag (rites.csv tanpa kolom tag).
- Tes di `tests/unit/sim/` (standar LP 6.1) karena `vite.config.ts` hanya memuat `tests/unit/**`; fixture sim lengkap di `tests/unit/sim/fixtures/data/`.
