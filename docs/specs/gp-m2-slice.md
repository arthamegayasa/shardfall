# Spec GP: Vertical Slice M2 (M2-05)

Pemilik: Gameplay Programmer (GP). Status: versi 1, 2026-11-17. Reviewer: LP (kode), QA (build), CD (rasa).
Dasar: `docs/m2-creative-brief.md`, `docs/reviews/M1-cd.md` 4 (GP), `docs/reviews/M1-lp.md` 3 (MAYOR 19, 20, MINOR sim), `docs/qa/bugs.md` BUG-001, `docs/gdd.md` 6.2, 14 sampai 16, `docs/systems/effect-primitives.md`. Melanjutkan `docs/specs/gp-core-loop.md`.

## 1. Lingkup

1. BUG-001 dan temuan review LP untuk sim.
2. Event dampak untuk render dan audio, knockback terlihat, hit-stop sebagai event, Glint melesat dengan state animasi di view.
3. Semua affix (`affixes.csv`, Tingkat A, B, dan juga C), boss dengan semua arketipe pola (`boss_patterns.csv`), fase dan mengamuk, telegraf minimum GD. Lunge Orbit tier IV, Glint per kill Tithe Coin.
4. Mesin efek lengkap untuk 30 Memento dan 18 ambang (perbaikan Shard 2 seek, payload trigger per level hit). Perilaku Unlit Tingkat B dan C (exploder, summoner, mote, lobber, Warden choir, Warden bulwark) supaya M3 tinggal data.

## 2. Perbaikan temuan

| Temuan | Perbaikan | Tes |
|---|---|---|
| BUG-001 | `run.start` mengisi ShopView (inventaris dan Memento run ini) sebelum Pulse 1; `debug.grant` juga | `tests/unit/qa/bugs-m1.test.ts` (kini `it`) |
| MAYOR 19 `every_nth @per_target` ke-5 | Slot penghitung dibagikan ke efek aktif menurut urutan evaluasi saat inventaris berubah (maks 4 per run, architecture 8.1). Efek aktif ke-5 gagal deterministik dan menaikkan `poolOverflow` tiap evaluasi | `m2-slice` MAYOR 19 |
| MAYOR 20 angka cadangan | Cadangan pola boss dihapus (semua arketipe diimplementasikan). `rev_s` hilang: serpih diam. Ambang grup tanda medium dibaca dari config `spawn_mark_medium_group` (permintaan GD); tanpa kunci, tanda memakai ukurannya sendiri | `m2-slice`, `spawner` |
| `areaCtx` modul tertimpa | Payload trigger (`radius`, `amount`) disimpan di HitCtx per level; `repeat` area dan rite membaca level hit saat ini | `effects` (Flame 4, Echo) |
| Aliran RNG summon dan trickle | Sektor summon pola dan trickle boss memakai aliran `spawn` | determinisme |
| Info hilang setelah load | Save menyimpan `rewardSourceId` dan `levelsThisPulse` (aditif, opsional); load memulihkan `RewardView.sourceTypeIndex` dan total Temper | `m2-slice` save di hadiah Warden (hash sama) |
| Kolom state belum di-hash | Kini di-hash: penghitung per_target (hanya yang masih menunjuk Unlit hidup), `rewardPending`, `rewardSourceType`, `levelsThisPulse`, `wardenKilled`, `bossKilled`, `bossPatternStep`, state pola boss, slow pemain, koin, lunge, kolom pool baru | determinisme, golden |
| Warden hilang bila pool tanda penuh | Tanda Warden dicoba ulang tick berikutnya | kode |
| Truncation jadwal dan hit-stack | Dihitung di `poolOverflow` | kode |
| SourceRef leech sama dengan Burn | Leech memakai `encodeSource(Status, 100)` | `m2-slice` |
| Pool kartu kosong | Level dihabiskan tanpa fase `levelUp` 0 pilihan | kode |
| Pemindaian 512 slot per proc | `procLive` dihitung ulang sekali per tick Pulse dan dinaikkan per spawn proc | kode |
| `for...of TIMED` | Loop indeks | kode |
| Kilat hit tidak terlihat | `hitFlashTicks` diset 2 tick dan dikurangi di awal update Unlit (sebelumnya 1 tick dan habis di tick yang sama) | `m2-slice` |

`contentHash` tetap tidak dibandingkan saat load: id disimpan sebagai string dan divalidasi satu per satu, jadi save bertahan saat data berubah. [Asumsi] Keputusan ini dicatat untuk LP.

## 3. Event baru untuk render dan audio (aditif)

Payload: `x, y` posisi dunia; kolom kosong = 0. Konstanta di `src/core/contracts/events.ts`.

| Event | a | b | c | Kapan |
|---|---|---|---|---|
| `RiteLanded: 71` | `RiteIndex` | radius (u) | jumlah Unlit kena | Flare mendarat (setelah `flight_s`), Toll dan Glass Step saat dirapal, juga gema Echo 4 |
| `HitStop: 72` | kekuatan `HitStopStrength` (1 kecil, 2 sedang, 3 besar) | alasan `HitStopReason` | SourceRef atau EnemyTypeIndex | Rite mendarat dan kena (1), pemain kena (1), execute (1), Warden mati (2), fase boss (2), boss mati (3), pemain mati (3). Sim tidak berhenti; render/app memilih durasi dan melewatinya di "kurangi efek" |
| `EnemyKnockedBack: 73` | jarak sesudah resist (u) | arah (turns) | SourceRef hit | Setiap knockback yang benar-benar mendorong. Prioritas rendah |
| `EnemyDissolved: 74` | `EnemyTypeIndex` | rank | | Akhir Pulse, tiap Unlit hidup (kilat kaca penutup). Prioritas rendah |
| `AffixTriggered: 75` | `AffixIndex` | `AffixAction` (1 cangkang tumbuh, 2 cangkang pecah, 3 blink mendarat, 4 brood, 5 pulse, 6 tar, 7 haste) | slot musuh atau jumlah | Affix bertindak |
| `BossPatternStarted: 76` | index pola (`bossPatterns`) | fase | SourceRef pola | Awal tiap pola (pose dan cue per id pola) |
| `EnemyExploded: 77` | `EnemyTypeIndex` | radius | SourceRef | Exploder meledak (bukan kill) |
| `GlintPulled: 78` | nilai butir | | | Butir mulai melesat ke pemain. Prioritas rendah |

Tambahan aditif lain:
- `EnemyDamaged.b` bit 7-8: tingkat dampak `ImpactTier` (0 ringan, 1 sedang, 2 berat, 3 menghancurkan) dari damage dibagi HP maks target (ambang presentasi 10%, 25%, 50% di `src/sim/capacity.ts`). Baca `(b >> DAMAGE_IMPACT_SHIFT) & 3`.
- `PickupPoolView.flyTicks` (opsional): tick sejak butir mulai terbang (0 di lantai). Kecepatan dari `x - prevX`.
- `WeaponFired` juga dipancarkan saat lunge Orbit tier IV dimulai.
- `RunSaveV1.rewardSourceId`, `RunSaveV1.levelsThisPulse` (opsional).
- `src/core/event-buffer.ts`: tiga event baru di daftar prioritas rendah.

Knockback terlihat dari posisi pool (disebar `knockback_s`) ditambah `EnemyKnockedBack`.

## 4. Warden dan affix (GDD 15.2)

| Affix | Implementasi | Telegraf |
|---|---|---|
| `hasted` | `speedMult x (1 + move_pct/100)`; ditambahkan di waktu tambahan | tidak perlu |
| `volley` | Setelah tiap rangkaian serangan (semua perilaku yang menyerang) | cincin, minimum proyektil |
| `veiled` | Cangkang `shell_frac x HP maks` menyerap lebih dulu (juga Burn dan ledakan); tumbuh ulang setelah `regrow_s` tanpa damage | cangkang terlihat (`shield`) |
| `blinking` | Tiap `interval`: titik `min_dist` dari pemain arah acak (aliran `ai`), dijepit di arena, mendarat setelah `telegraph_s` | lingkaran di tujuan |
| `brood` | Tiap `interval`: `count` x `summon_id` di cincin sekeliling Warden, masing-masing dengan tanda spawn | tanda spawn |
| `tar_trail` | Tiap `drop_every`: genangan `radius` selama `duration`, Slow `slow`% pada pemain (terkuat menang) | terlihat sejak muncul, tanpa event telegraf |
| `pulsing` | Tiap `interval`: Strike lingkaran `radius` yang mengikuti Warden, dmg x dm(t) | minimum area |
| `bulwark` | Guard `+guard_add`, kebal knockback bila `kb_immune=1` | tidak perlu |

Crack 2+: `warden_extra_affixes` affix acak dari pool `random_pool=1` tanpa duplikat (aliran `spawn`). Timer affix menunggu masa tenggang spawn; cangkang tidak.

## 5. Boss (GDD 16)

Semua langkah yang memberi damage ditelegrafkan dulu, minimal `telegraph_min_boss_s` (cone: `telegraph_min_charge_s`). Boss diam selama pola. `BossPatternStarted` di awal pola.

| Arketipe | Implementasi |
|---|---|
| `target_circles` | Lingkaran pertama tepat di pemain bila `first_on_player=1`; sisanya seragam di cakram `spread`, menolak tumpang tindih (percobaan terbatas, deterministik) |
| `ring_gap` | Seperti M1 (celah berbeda minimal `min_gap_diff_deg`) |
| `lanes` | Seperti M1 (tanpa closure di tick) |
| `summon` | Boss menyala selama telegraf; tanda spawn dimulai `telegraph - spawn_mark_s` agar selesai bersama telegraf; sektor dari aliran `spawn` |
| `spiral` | Inti menyala, lalu `rate` tembakan/s per lengan selama `duration`, `arms` lengan; satu putaran per durasi kecuali `turns` diberikan (permintaan GD) |
| `blink_slam` | Strike di posisi pemain; boss mendarat di sana saat strike resolve |
| `lines` | `count` garis dari boss ke tepi arena (yang pertama ke pemain), Strike garis; `fan_*` menambah kipas (kombo fase 3) |
| `cone` | Kipas `count` proyektil `fan_deg`; tiap ulangan punya telegraf sendiri, jeda `repeat_gap_s` |
| `charge_lane` | Jalur dari boss melewati pemain ke tepi, lalu boss menerjang `speed`, satu hit per terjang |

Umur proyektil pola tanpa `shot_life` = waktu menyeberang arena (dari ukuran arena, bukan angka). Fase, lantai HP, transisi, mengamuk, dan trickle tetap seperti M1.

## 6. Senjata dan efek

- Orbit IV: tiap `lunge_every_s` serpih melesat `lunge_dist` keluar lalu kembali. Durasi = `lunge_s` bila ada, selain itu waktu tempuh pada kecepatan orbit sendiri (2 pi r / `rev_s`).
- Tithe Coin: kill oleh koin menjatuhkan butir `glint_per_kill + glint_per_kill_add`, maks `glint_cap_base + glint_cap_per_tier x tier` per slot per Pulse; tier IV `bounce` ke target berikut yang belum kena.
- Shard 2: `split` dengan `seek_range` membidik k Unlit terdekat lain, sisanya arah acak (aliran `combat`).
- `repeat what=hit target=same` didukung (selain `nearest_other`).
- Glint: kecepatan awal `glint_fly_speed`, ditambah `glint_fly_accel` per detik sampai `glint_fly_speed_max` bila kunci ada (permintaan GD); tanpa kunci tetap konstan.

## 7. Unlit Tingkat B dan C

| Perilaku | Ringkas |
|---|---|
| `swarmer` | Kini memakai `weave_amp`, `weave_hz` (liuk menyamping) |
| `exploder` | Dalam `trigger_range` menyalakan sumbu `fuse_s` (lingkaran `blast_radius` mengikuti), gerak x `fuse_move_mult`; ledakan melukai pemain (`attack_dmg`) dan Unlit lain (`enemy_dmg`, menjatuhkan Glint, tanpa `on_kill`); dibunuh sebelum sumbu habis = tidak meledak |
| `summoner` | Jaga jarak; tiap `summon_every` memanggil sampai `max_summons` hidup |
| `lobber` | Jaga jarak; Strike lingkaran `zone_radius` di posisi pemain |
| `warden_choir` | Jaga jarak; kipas `fan_count` x `fan_deg` setelah telegraf kerucut |
| `warden_bulwark` | Mengejar; tiap `slam_every` berhenti dan menghantam lingkaran `slam_radius` |

[Asumsi] Exploder yang meledak sendiri tidak dihitung kill dan tidak menjatuhkan Glint. Panggilan summoner dan brood tidak dihitung ke `alive_cap`.

## 8. Kriteria keberhasilan dan tes

| ID | Kriteria | Tes |
|---|---|---|
| M2-K1 | BUG-001: ShopView run sendiri di Pulse 1 dan run baru | `qa/bugs-m1` |
| M2-K2 | per_target ke-5 gagal dan terhitung | `sim/m2-slice` |
| M2-K3 | Save di hadiah Warden: sumber peti dan total Temper bertahan, hash sama | `sim/m2-slice` |
| M2-K4 | Telegraf tidak pernah di bawah minimum kategori | `sim/m2-slice` |
| M2-K5 | Event dampak: tingkat dampak, kilat 2 tick, knockback, RiteLanded, HitStop, EnemyDissolved, GlintPulled dan `flyTicks` | `sim/m2-slice` |
| M2-K6 | Semua affix A, B, C | `sim/m2-slice` |
| M2-K7 | Perilaku exploder, summoner, choir, lobber, bulwark | `sim/m2-slice` |
| M2-K8 | Pola Paper Sun (Ember Rain di pemain, Moth Call tepat waktu) dan semua arketipe Tingkat C | `sim/m2-slice` |
| M2-K9 | Lunge Orbit IV, Tithe Coin cap dan bounce | `sim/m2-slice` |
| M2-K10 | 12 Memento Tingkat A pada data asli, Shard 2 seek | `sim/mementos-a` |
| M2-K11 | Determinisme dengan konten B dan C; bot, determinisme, golden lulus | `sim/m2-slice`, `sim/determinism`, `qa/determinism-qa` |

Fixture sim (`tests/unit/sim/fixtures/data`) mendapat baris Tingkat B dan C (affix, Unlit, `boss_vine` dengan pola uji, `tithe_coin`) dan lima Memento terkunci `pt_1..pt_5` untuk uji per_target. Golden replay QA dibuat ulang dengan `QA_UPDATE_GOLDEN=1`: hash berubah karena kolom state baru di-hash dan perilaku baru (bukan regresi).

## 9. Belum dikerjakan

- Hit-stop yang membekukan sim: tidak, karena mengubah timing Pulse; tersedia sebagai event.
- Uji akselerasi Glint butuh kunci config (belum ada).
- Rintangan arena belum menghalangi gerak Unlit dan dash (di luar M2-05).
