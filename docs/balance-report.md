# Laporan Balance (draf M1-02)

Pemilik: Game Designer. Status: draf, 2026-11-17. Sumber angka: `content/data/*.csv` (CSV menang bila berbeda dengan dokumen). Model: `tools/balance/model.py` (Python standar, tanpa dependensi).

## 1. Cara menjalankan

| Perintah | Hasil |
|---|---|
| `python tools/balance/model.py gen` | Menulis `content/data/waves.csv` dan `wave_spawns.csv` dari tabel `PROFILES` (GDD 2 dan 3.4) dan `SPAWN_RULES` |
| `python tools/balance/model.py check` | Gagal (exit 1) bila kedua CSV itu beda dari model atau aturan data dilanggar (durasi, Warden dan boss id, telegraf minimum musuh). Target GDD 19 dicetak PASS atau WARN |
| `python tools/balance/model.py report` | Mencetak tabel di bawah dalam Markdown |

Model membaca semua angka lain (musuh, senjata, harga, rarity, XP, kartu) dari CSV, jadi kurva di laporan ini selalu mengikuti data yang dikirim. Setelah mengubah CSV: `npm run data:build`, lalu `python tools/balance/model.py check`.

## 2. Ringkasan

- Data Tingkat A lengkap: kelas `lantern`, 6 senjata dengan tier II sampai IV, 12 Memento, sinergi Flame, Shard, Edge (ambang 2, 4, 6), 4 Unlit, `warden_hound` dengan affix `volley` dan `hasted`, `boss_lantern` dengan 2 fase dan 6 pola, profil `run_a_m1` dan `run_a`, 14 kartu Temper, toko, config. Baris B dan C juga sudah ditulis dengan `content_tier` yang benar; build tingkat A, B, dan C semuanya 0 error dan 0 peringatan.
- Ekonomi: Glint diharapkan kumulatif A 853 (M1 1031), level akhir 12 (M1 13), sekitar 1 level per Pulse. Pulse 1 memberi 24 Glint, cukup untuk 1 Memento Plain atau 1 senjata Tier I.
- Senjata awal `lantern_bolt` membunuh swarmer dengan satu tembakan (tumbukan + ledakan) sampai t8 (target: t6).
- Warden 15.5 s pada DPS referensi (target 8 sampai 15 s): di batas atas, dibiarkan karena selisih 3% di bawah ketelitian model.
- Boss: dengan HP 1600 model memberi 40 s (target 45 sampai 90 s). **Keputusan: HP dasar `boss_lantern` dinaikkan ke 2000** (A t10 sekitar 5140), hasil model 49 s. GDD 16.1 sudah disesuaikan. Di C t7 hasilnya sekitar 69 s, tetap dalam target.
- Pembelian per run: model 21 (A dan M1), di atas target GDD 19 (12 sampai 18) tetapi sesuai GDD 4.3 ("2 sampai 3 pembelian per toko" = 18 sampai 27 untuk 9 toko). Dua target GDD saling bertentangan; angka harga **tidak** diubah. Usulan: target 19 menjadi 16 sampai 22, diputuskan setelah bot M2 (pertanyaan terbuka).
- P1-a: 3 dari 12 Memento A datar (25%, batas 30%). Pool penuh: 7 dari 30 (23%).

## 3. Asumsi model [Asumsi]

Semua angka kekuatan pemain di bawah adalah model referensi, bukan simulasi kombat. Bot M2 menggantikannya.

| Asumsi | Nilai | Alasan |
|---|---|---|
| Glint terpungut selama Pulse | 85%, sisanya 50% dipungut otomatis (total 92.5%); Pulse boss 100% | GDD 3.4, 3.3 |
| Reroll per toko | 0 (t1 sampai 2), 1 (t3 sampai 6), 2 (t7+) | Pemain wajar mulai mencari sinergi setelah toko kedua |
| Pembelian | Glint dibagi harga tawaran rata-rata (rarity per threat, senjata 35%) | GDD 12 |
| Senjata yang dibeli | Pengali DPS = rata-rata `weapon_dmg_mult / weapon_cd_mult` menurut bobot rarity; salinan di atas 6 slot digabung (efisiensi 0.79) | GDD 4.4: tier II 1.58x vs dua tier I 2.0x |
| Memento | +4% DPS satu target per Memento | Banyak Memento A bersyarat atau untuk kerumunan |
| Kartu Temper | 50% pilihan ke damage atau attack speed (nilai kartu `card_damage` menurut rarity saat itu), 15% ke `max_hp` | Pemain wajar menyeimbangkan |
| Kritikal | +2.5% (crit dasar 5% x 0.5) | `stats.csv` |
| Fokus ke Warden | 70% DPS | Bidik otomatis ke Unlit terdekat |
| Boss | 85% fokus, 75% waktu dalam jangkauan, guard 2 vs hit rata-rata 9 x bonus, ditambah 2.0 s masuk dan 1.5 s transisi fase | GDD 16 |
| DPS senjata satu target | Rumus per arketipe di `Data.weapon_dps` (Burn ledakan Lantern Bolt 30% x 1.3 pasif kelas; Orbit dibatasi kontak ulang 0.5 s) | GDD 5.2, 5.4, 6.1 |

## 4. Kurva per Pulse

### 4.1 Profil `run_a_m1` (prototipe M1)

| Pulse | Jenis | t | Durasi (s) | Unlit | Laju (/s) | Glint mentah | Glint diharapkan | Kumulatif | Level akhir | Beli di toko | Reroll | DPS ref |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | normal | 1 | 20 | 26 | 1.3 | 26 | 24 | 24 | 1 | 1 | 0 | 13 |
| 2 | normal | 2 | 23 | 36 | 1.6 | 40 | 37 | 61 | 3 | 2 | 0 | 18 |
| 3 | normal | 3 | 26 | 46 | 1.8 | 56 | 52 | 113 | 4 | 2 | 1 | 29 |
| 4 | normal | 4 | 29 | 56 | 1.9 | 78 | 72 | 185 | 5 | 2 | 1 | 40 |
| 5 | normal | 5 | 32 | 62 | 1.9 | 96 | 89 | 274 | 6 | 3 | 1 | 55 |
| 6 | normal | 6 | 35 | 74 | 2.1 | 110 | 102 | 376 | 7 | 3 | 1 | 79 |
| 7 | normal | 7 | 38 | 86 | 2.3 | 134 | 124 | 500 | 9 | 2 | 2 | 107 |
| 8 | normal | 8 | 40 | 98 | 2.5 | 158 | 146 | 646 | 10 | 3 | 2 | 132 |
| 9 | normal | 9 | 40 | 112 | 2.8 | 184 | 170 | 816 | 11 | 3 | 2 | 164 |
| 10 | normal | 10 | 45 | 141 | 3.1 | 233 | 216 | 1031 | 13 | 0 | 0 | 200 |

Total pembelian: 21. Sisa Glint tak terpakai: 29.

### 4.2 Profil `run_a` (Tingkat A)

| Pulse | Jenis | t | Durasi (s) | Unlit | Laju (/s) | Glint mentah | Glint diharapkan | Kumulatif | Level akhir | Beli di toko | Reroll | DPS ref |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | normal | 1 | 20 | 26 | 1.3 | 26 | 24 | 24 | 1 | 1 | 0 | 13 |
| 2 | normal | 2 | 23 | 36 | 1.6 | 40 | 37 | 61 | 3 | 2 | 0 | 18 |
| 3 | normal | 3 | 26 | 46 | 1.8 | 56 | 52 | 113 | 4 | 2 | 1 | 29 |
| 4 | normal | 4 | 29 | 56 | 1.9 | 78 | 72 | 185 | 5 | 2 | 1 | 40 |
| 5 | warden | 5 | 32 | 53 | 1.7 | 104 | 96 | 281 | 6 | 3 | 1 | 55 |
| 6 | normal | 6 | 35 | 74 | 2.1 | 110 | 102 | 383 | 7 | 3 | 1 | 79 |
| 7 | normal | 7 | 38 | 86 | 2.3 | 134 | 124 | 507 | 9 | 2 | 2 | 107 |
| 8 | normal | 8 | 40 | 98 | 2.5 | 158 | 146 | 653 | 10 | 3 | 2 | 132 |
| 9 | normal | 9 | 40 | 112 | 2.8 | 184 | 170 | 823 | 11 | 3 | 2 | 164 |
| 10 | boss | 10 | boss | 30 |  | 30 | 30 | 853 | 12 | 0 | 0 | 200 |

Total pembelian: 21. Sisa Glint tak terpakai: 36.

### 4.3 Profil `run_b` dan `run_c` (ringkas)

- `run_b` (15 Pulse, B1 sampai 6 = C1 sampai 6, B7 sampai 12 = C8 sampai 13, B13 sampai 14 = C15 sampai 16 tanpa lobber): Total pembelian: 32. Sisa Glint tak terpakai: 48.
- `run_c` (20 Pulse, 3 bioma): Total pembelian: 39. Sisa Glint tak terpakai: 55.
- Catatan: DPS referensi B dan C tumbuh lebih cepat daripada HP musuh di paruh akhir (model tidak memodelkan kerumunan). Pertarungan `boss_lantern` di B t15 sekitar 38 s (di bawah target); `boss_bell` C t14 sekitar 48 s, `boss_vine` C t20 sekitar 47 s. Warden C: `warden_hound` t4 sekitar 19 s (di atas target, pemain baru punya 1 sampai 2 senjata), `warden_choir` t11 sekitar 10 s, `warden_bulwark` t17 sekitar 12 s. Ditinjau di M3 dengan bot.

## 5. Kurva musuh

| t | hp(t) | dm(t) | proc_scale | HP swarmer | HP charger | HP shooter | HP tank | Kontak swarmer | Kontak tank | Terjang charger |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1.00 | 1.00 | 1.0 | 6 | 16 | 10 | 60 | 3.0 | 7.0 | 6.0 |
| 2 | 1.13 | 1.07 | 1.2 | 7 | 18 | 11 | 68 | 3.2 | 7.5 | 6.4 |
| 3 | 1.26 | 1.14 | 1.4 | 8 | 20 | 13 | 76 | 3.4 | 8.0 | 6.8 |
| 4 | 1.41 | 1.21 | 1.6 | 8 | 23 | 14 | 85 | 3.6 | 8.5 | 7.3 |
| 5 | 1.58 | 1.28 | 1.8 | 9 | 25 | 16 | 95 | 3.8 | 9.0 | 7.7 |
| 6 | 1.75 | 1.35 | 2.0 | 10 | 28 | 18 | 105 | 4.1 | 9.5 | 8.1 |
| 7 | 1.94 | 1.42 | 2.2 | 12 | 31 | 19 | 116 | 4.3 | 9.9 | 8.5 |
| 8 | 2.13 | 1.49 | 2.4 | 13 | 34 | 21 | 128 | 4.5 | 10.4 | 8.9 |
| 9 | 2.34 | 1.56 | 2.6 | 14 | 38 | 23 | 141 | 4.7 | 10.9 | 9.4 |
| 10 | 2.57 | 1.63 | 2.8 | 15 | 41 | 26 | 154 | 4.9 | 11.4 | 9.8 |
| 12 | 3.05 | 1.77 | 3.2 | 18 | 49 | 30 | 183 | 5.3 | 12.4 | 10.6 |
| 15 | 3.86 | 1.98 | 3.8 | 23 | 62 | 39 | 231 | 5.9 | 13.9 | 11.9 |
| 17 | 4.46 | 2.12 | 4.2 | 27 | 71 | 45 | 267 | 6.4 | 14.8 | 12.7 |
| 20 | 5.45 | 2.33 | 4.8 | 33 | 87 | 54 | 327 | 7.0 | 16.3 | 14.0 |

## 6. Harga

| t | Memento P | Memento F | Memento R | Memento Fb | Senjata I | Senjata II | Senjata III | Senjata IV | Reroll 1, 2, 3 | Rata-rata tawaran | Jual senjata I |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 14 | 28 | 50 | 85 | 16 | 34 | 70 | 130 | 2, 3, 4 | 18.6 | 6 |
| 3 | 16 | 32 | 58 | 99 | 19 | 39 | 81 | 151 | 3, 4, 5 | 21.6 | 7 |
| 5 | 18 | 37 | 66 | 112 | 21 | 45 | 92 | 172 | 4, 5, 6 | 31.7 | 8 |
| 7 | 21 | 41 | 74 | 126 | 24 | 50 | 104 | 192 | 5, 6, 7 | 44.8 | 9 |
| 9 | 23 | 46 | 82 | 139 | 26 | 56 | 115 | 213 | 6, 7, 8 | 49.7 | 10 |
| 10 | 24 | 48 | 86 | 146 | 28 | 58 | 120 | 224 | 6, 7, 8 | 52.1 | 11 |
| 12 | 26 | 53 | 94 | 160 | 30 | 64 | 132 | 244 | 7, 8, 9 | 68.3 | 12 |
| 15 | 30 | 59 | 106 | 180 | 34 | 72 | 148 | 276 | 9, 10, 11 | 88.7 | 13 |
| 19 | 34 | 68 | 122 | 207 | 39 | 83 | 171 | 317 | 11, 12, 13 | 102.1 | 15 |

## 7. DPS senjata

| Senjata | Tk | Tier I | Tier II | Tier III | Tier IV |
|---|---|---|---|---|---|
| `lantern_bolt` | A | 13.1 | 20.7 | 32.0 | 49.4 |
| `splinter_shot` | A | 8.6 | 13.5 | 21.0 | 32.3 |
| `arc_blade` | A | 12.2 | 19.2 | 29.8 | 45.8 |
| `orbit_shards` | A | 6.2 | 9.9 | 15.3 | 23.5 |
| `chain_spark` | A | 7.6 | 12.0 | 18.6 | 28.6 |
| `returning_glaive` | A | 10.0 | 15.8 | 24.4 | 37.6 |
| `echo_bell` | B | 4.8 | 7.5 | 11.7 | 18.0 |
| `tithe_coin` | B | 7.8 | 12.3 | 19.0 | 29.3 |

Catatan: `orbit_shards` dan `chain_spark` rendah untuk satu target karena perannya kerumunan (pengali kerumunan tidak dimodelkan). `echo_bell` (B) paling rendah satu target; peran kontrol kerumunan, tinjau saat Tingkat B.

## 8. Target GDD 19

| Target | Status | Nilai model |
|---|---|---|
| Starter one-shots swarmer to t6 | PASS | one-shot up to t8 |
| Purchases per run A 12-18 | WARN | 21 (run_a) |
| Purchases per run M1 12-18 | WARN | 21 (run_a_m1) |
| Warden kill 8-15 s | WARN | 15.5 s at ref DPS 55 |
| Boss fight 45-90 s | PASS | 49 s at ref DPS 200 |
| About 1 level per Pulse (A end ~ L11-13) | PASS | L12 |
| Pulse 1 buys at least 1 item | PASS | 24 Glint vs 14 |

## 9. Keputusan di M1-02

1. HP `boss_lantern` 1600 menjadi 2000 (bagian 2).
2. `content_tier` opsional di `effects.csv`, `waves.csv`, `wave_spawns.csv` (data-schema 0.1), skema kode diubah di `src/content/tables/effects.ts` dan `run.ts`, menunggu review LP.
3. `waves.csv` dan `wave_spawns.csv` dihasilkan model. Aturan spawn: swarmer grup 3 sampai 6 (3 sampai 5 di t1 sampai 3), charger dan shooter 1 sampai 2 (masuk setelah 10% dan 15% Pulse), tank 1 (30% sampai 90%), exploder 1 sampai 2, summoner 1 (20% sampai 85%), lobber 1 (20% sampai 95%). Baris tetesan boss: swarmer, grup 2, `count` nominal.
4. `stats.csv` `barrier_recharge` min 0 (bukan 4): dasar 0 berarti tidak mengisi ulang, dan jepit min 4 akan membuatnya mengisi tiap 4 s. Batas 4 s GDD berlaku untuk nilai bukan nol (semua sumber 10 atau 14 s).
5. Bioma 2 dan 3 memakai `arena_market` sampai LD membuat arena sendiri. `biome_market` memakai `arena_proto` untuk M1.
6. Pola `summon` boss (Moth Call, Call Choir, Seed Pods) memakai telegraf 1.0 s agar lolos `telegraph_min_boss_s`; tanda spawn 0.8 s berjalan di dalamnya.
7. `desc_key` kartu crit dan pickup disamakan dengan string WR (`card.crit`, `card.pickup`).

## 10. Pertanyaan terbuka

1. Target pembelian per run (GDD 19: 12 sampai 18) bertentangan dengan GDD 4.3 (2 sampai 3 per toko). Usulan 16 sampai 22 setelah bot M2.
2. LP: setuju dengan kolom `content_tier` opsional di tiga tabel? Alternatif: validator pemilik efek dan join profil yang sadar tingkat.
3. GP: kunci `params` di data-schema 5 menjadi isi registri; bila nama lain lebih cocok, tulis di `docs/specs/gp-*.md`.
4. Dua sumber durasi knockback (`config.csv knockback_s` dan `statuses.csv knockback.duration`, keduanya 0.1). Usulan: sim memakai `config`.
5. `boss_hp_mult` Crack 4 dikali bersama `enemy_hp_mult` Crack 1? Usulan GD: ya (kumulatif), dicatat untuk M3.
6. WR: kunci `affix.hasted` dan `affix.volley` belum ada di `content/strings/en.json`.
