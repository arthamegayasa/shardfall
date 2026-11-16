# Laporan Balance (M2-01, vertical slice)

Pemilik: Game Designer. Status: M2-01, 2026-11-17 (menggantikan draf M1-02). Sumber angka: `content/data/*.csv` (CSV menang bila berbeda dengan dokumen). Alat: `tools/balance/model.py` (model ekonomi, Python standar) dan `tools/balance/bot/` (bot yang memainkan sim asli).

## 1. Cara menjalankan

| Perintah | Hasil |
|---|---|
| `python tools/balance/model.py gen` | Menulis `waves.csv` dan `wave_spawns.csv` dari `PROFILES`, `SPAWN_RULES`, baris pembuka dan lonjakan |
| `python tools/balance/model.py check` | Gagal bila kedua CSV beda dari model atau aturan data dilanggar (durasi, id Warden dan boss, telegraf minimum, `alive_cap` di atas anggaran 120). Target GDD 19 dicetak PASS atau WARN |
| `python tools/balance/model.py report` | Tabel Markdown model (Pulse, kurva musuh, harga, DPS senjata) |
| `node tools/balance/bot/run-bots.ts --bot good --seeds 1-100` | Bot memainkan `run_a` dengan sim asli dan data build; mencetak ringkasan dan tabel per Pulse. Opsi: `--bot expert|good|naive`, `--profile`, `--class`, `--data <game-data.json>`, `--json <file>`, `--verbose` |

Urutan setelah mengubah CSV: `python tools/balance/model.py gen` (bila profil berubah), `npm run data:build`, `python tools/balance/model.py check`, lalu bot. 100 seed per bot sekitar 15 s.

## 2. Bot (`tools/balance/bot/`)

Bot hanya membaca `WorldView` dan bertindak lewat `InputFrame` dan `Command`, persis seperti pemain. RNG bot terpisah dari sim.

| Bot | Gerak | Belanja dan kartu |
|---|---|---|
| `expert` | 16 arah plus diam, tiap arah dinilai di 3 horizon (0,15, 0,3, 0,6 s): tubuh Unlit, proyektil musuh (posisi diprediksi), telegraf dan zona bahaya (dibobot waktu sampai kena), dinding, tarikan Glint saat aman, jarak jangkau ke Warden dan boss. Rite ke kerumunan terpadat. Keputusan tiap 2 tick tanpa batas | Tag kelas lalu tag terbanyak, utamakan merge senjata, Fuse otomatis, reroll maks 2 per toko, kartu Temper dengan prioritas dan imbal hasil menurun, Max HP bila HP rendah |
| `good` | Sama dengan `expert` ditambah batas manusia: keputusan tiap 15 tick (0,25 s), jeda persepsi ke aksi 9 tick (0,15 s), jadi reaksi efektif 0,15 sampai 0,4 s (waktu reaksi visual manusia sekitar 0,2 sampai 0,25 s ditambah memilih arah); hanya 8 Unlit terdekat yang dilacak; proyektil baru disadari dalam 5 u; 15% keputusan memakai arah terbaik kedua | Sama dengan `expert` |
| `naive` | Lari dari Unlit terdekat dengan tarikan ke pusat, Rite ke Unlit terdekat (sama dengan QA `dodgerRandom`) | Beli tawaran terjangkau acak, kartu acak |

Batas bot dipilih dari angka reaksi manusia, bukan untuk mengejar persentase menang. Angka bot tidak pernah masuk sim. Perkiraan durasi run = waktu sim + 20 s per toko + 4 s per kartu Temper + 5 s per peti (target CD S-12: toko median 25 s atau kurang) [Asumsi].

## 3. Hasil bot, `run_a`, kelas `lantern`, 100 seed (contentHash ff51169c)

| Metrik | Target | good | naive | expert |
|---|---|---|---|---|
| Menang | good 30 sampai 60%, naive kalah | **51%** | **0%** | 81% |
| Pulse kematian | Pulse non-boss di bawah 15% | P5 7%, P6 1%, P8 2%, P9 2%, boss 37% | P3 8%, P4 28%, P5 42%, P6 10%, P7+ 12% | boss 19% |
| Durasi run menang (perkiraan) | 8 sampai 10 menit | 9,6 menit (sim 5,9) | | 9,5 menit |
| Waktu bunuh Warden | 15 sampai 25 s | median 20,6 s (13 sampai 31) | 45 s | 18,1 s |
| Waktu bunuh boss | 45 sampai 90 s | median 65,7 s (33 sampai 121) | | 60,6 s |
| Pembelian per run | 16 sampai 22 | median 18 | 4 | 18 |
| Level akhir | 11 sampai 13 | 11 | 4 | 11 |
| Unlit hidup maks satu run | di bawah 120 dan pool 256 | 77 | 62 | 78 |
| `poolOverflow` | 0 | 0 | 0 | 0 |

Tabel per Pulse, bot `good` (median dari run yang mencapai Pulse itu):

| Pulse | Run | Puncak Unlit hidup | Puncak 6 s terakhir | Rata-rata 6 s terakhir | Glint terpungut | Damage diterima |
|---|---|---|---|---|---|---|
| 1 | 100 | 12 | 11 | 5,6 | 89% | 0 |
| 2 | 100 | 17 | 17 | 10,9 | 88% | 0 |
| 3 | 100 | 24,5 | 24 | 16,7 | 84% | 2 |
| 4 | 100 | 26 | 24,5 | 16,8 | 86% | 0 |
| 5 (Warden) | 100 | 24 | 20,5 | 12,0 | 82% | 14 |
| 6 | 93 | 35 | 30 | 20,2 | 83% | 8 |
| 7 | 92 | 40 | 34 | 23,4 | 81% | 8 |
| 8 | 92 | 44 | 40 | 26,4 | 78% | 9 |
| 9 | 90 | 49,5 | 42 | 29,1 | 76% | 9 |
| 10 (boss) | 88 | 9,5 | | | 51% | 42 |

Bacaan:
- Kepadatan memenuhi target CD: sekitar 40 Unlit di 6 detik terakhir Pulse 8, puncak 50 di Pulse 9, sekitar 25 di Pulse 4 sampai 5, Unlit pertama keluar 0,8 s setelah Pulse dibuka. Sebelum M2-01 bot yang sama hanya melihat puncak 21 di 6 detik terakhir Pulse 8.
- Glint terpungut 76 sampai 89% (CD: radius lebih lega bila di bawah 70%). Bot naif 38 sampai 63% karena tidak mengejar Glint.
- Sumber damage utama di Pulse biasa: proyektil Hawker. Di Pulse 5: Hawker, volley dan terjang Brass Collar. Di boss: Snuff Ring (terutama ganda), lalu Ember Rain.
- Boss adalah ujian akhir: 42% run yang mencapainya kalah. Bot `good` jarang terluka di Pulse biasa (median 8 sampai 9 dari sekitar 40 HP), jadi target GDD 19 "HP tersisa turun ke sekitar 50% di Pulse 9" belum tercapai untuk bot ini. Manusia diperkirakan lebih sering terkena; dicek ulang dengan playtest dan telemetri M4.
- Varians bot antar putaran sekitar plus minus 7 poin persentase untuk 100 seed. Sim GP masih berubah selama M2-05 (hasil `good` bergeser dari 44% ke 51% antara dua build dengan data sama). Ulangi bot setelah M2-05 selesai.

## 4. Perubahan angka M2-01 dan alasannya

| Angka | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| Baris spawn per Pulse berwaktu | 1 baris per jenis, jendela seragam | + baris pembuka (4 sampai 6 swarmer di tau 0) + baris lonjakan (swarmer dasar x min(1,25, 0,4 + 0,1 t), Warden x 0,5, di 55 sampai 100% durasi, grup 4 sampai 7) | Spawner menaruh grup seragam per baris; kurva w(tau) GDD 3.2 (tekanan naik, lonjakan akhir) dibangun dari baris. Unlit pertama dalam 1 s (CD M1 4.1) |
| Swarmer dasar `run_a` P1 sampai P9 | 26, 32, 36, 40, 36, 50, 56, 62, 70 | 18, 24, 28, 28, 30, 40, 46, 52, 58 | Sebagian jumlah pindah ke lonjakan. Total Unlit per Pulse naik 19 sampai 64% |
| Shooter `run_a` P5 sampai P9, tank P5 | 6, 10, 12, 14, 16; 3 | 4, 12, 14, 17, 20; 2 | Ancaman jarak jauh di Pulse akhir; Pulse Warden diberi ruang |
| `enemy_hp_lin`, `enemy_hp_quad` | 0,12, 0,006 | 0,18, 0,015 | Daya pemain naik sekitar 10 kali per run, HP Unlit dulu 2,6 kali: bot melihat Unlit akhir mati sebelum menyentuh pemain. t10 kini 3,83. Swarmer tetap mati 1 tembakan Lantern Bolt sampai t6 |
| `enemy_dmg_lin` | 0,07 | 0,1 | Kontak dan proyektil akhir harus terasa (t10 = 1,9) |
| Swarmer gerak, kontak | 2,6 u/s, 3 | 3,4 u/s, 4 | Pada 2,6 u/s (58% pemain) kerumunan tidak pernah memotong jalur kabur. 3,4 = 75% pemain, tetap bisa dihindari |
| Charger jeda, terjang, gerak | 3 s, 6, 2,0 | 2,5 s, 7, 2,2 | Tekanan arah lebih sering |
| Shooter jeda, kecepatan peluru, damage | 2,8 s, 5,5 u/s, 4 | 2,2 s, 6 u/s, 5 | Pemaksa gerak utama di Pulse biasa |
| `warden_hound` HP, terjang | 380, 10 | 360, 8 | Satu terjang dulu sekitar 45% HP di Pulse 5; bot `good` mati 22% di Pulse 5. Kini 7%, Warden 21 s |
| `boss_lantern` HP | 2000 | 2500 | Dengan kurva HP baru: t10 sekitar 9590 HP, median 66 s |
| Snuff Ring | celah 60 derajat, 5 u/s, telegraf 1,0 s, dmg 9; ganda berjeda 0,8 s | celah 90 derajat, 4 u/s, telegraf 1,2 s, dmg 8; ganda berjeda 1,0 s | Celah lama hanya terjangkau dari sekitar 2 u dari boss (tidak adil, P2). Kini sekitar 4 u |
| Ember Rain dmg | 10 | 9 | Boss membunuh lebih dari setengah run yang mencapainya |
| Harga dasar Memento / senjata | 14/28/50/85, 16/34/70/130 | 18/36/65/110, 21/44/90/170 | Glint per run naik sekitar 34% (853 ke 1125 di model). Pembelian bot kembali ke 18 |
| `xp_base`, `xp_per_level` | 15, 10 | 20, 13 | Sama x1,3: tetap sekitar 1 level per Pulse (level akhir 11 sampai 12) |
| `pickup_radius_base` | 1,6 u | 2,0 u | Pulse padat menyebar Glint lebih luas; rasa memungut (CD) |
| `glint_fly_speed` | 12 u/s tetap | puncak 20 u/s | Glint melesat |
| `glint_fly_speed_start`, `glint_fly_accel` | tidak ada | 3 u/s, 60 u/s^2 | Mulai pelan lalu melesat, tiba sekitar 0,3 s dari tepi radius. Butuh kode GP (bagian 6) |
| Smolder Boots `max_alive` | 6 | 4 | CD M1 4 [S]: maksimal 4 tambalan bara sekaligus (keterbacaan, K5) |
| `spawn_mark_medium_group_min` | angka 3 di `spawner.ts` | `config.csv` 3 | Temuan LP M1 MAYOR 20 |
| `low_hp_frac` | `LOW_HP_FRAC` 0,3 di `src/core/constants.ts` | `config.csv` 0,3 | Ambang balance milik GD (temuan LP M1, butir 2.3) |
| Target GDD 19 | Warden 8 sampai 15 s, pembelian 12 sampai 18, bot wajar menang 50 sampai 65% | Warden 15 sampai 25 s, pembelian 16 sampai 22, bot baik 30 sampai 60%, durasi run 8 sampai 10 menit, kepadatan, Glint terpungut 70%+ | Selaras brief M2 dan GDD 4.3 (sekitar 2 pembelian per toko). Menutup pertanyaan terbuka M1-02 nomor 1 |

`content/data/biomes.csv`: `biome_market` memakai `arena_market` (diubah LD untuk M2-07; bot dijalankan di arena ini, tanpa tabrakan rintangan karena sim belum memakai rintangan).

## 5. Tingkat B (data siap, balance M3)

- `node tools/data/build-data.ts --tier B --out tests/out/game-data-b.json`: 0 error, 0 peringatan. Tingkat C juga 0 error.
- Isi B: profil `run_b` 15 Pulse (Warden P4 `warden_hound`, P10 `warden_choir`, boss P15), 3 kelas (`lantern`, `bell` 60 Silt, `blade` 40 Silt, unlock lewat `meta_unlocks`), 8 senjata, 22 Memento, 6 tag dengan 18 ambang sinergi, 3 Rite, 14 kartu Temper, Silt dari Warden dan boss, 5 baris `meta_unlocks` B.
- Bot `good`, 20 seed per kelas, `run_b`: `lantern` menang 80%, `bell` 55% (Warden 49 s, boss 103 s: lemah melawan target tunggal), `blade` 95%. Durasi run menang 14,6 sampai 15,9 menit (target B 15 sampai 20). Tidak ada timeout atau overflow. Angka ini hanya bukti data B bisa dimainkan; tuning B di M3 (HP boss B t15 sekitar 16150 [Asumsi], `bell` perlu daya satu target).

## 6. Kebutuhan ke peran lain

| Untuk | Isi |
|---|---|
| GP | Baca `cfg.glintFlySpeedStartUPerTick` dan `cfg.glintFlyAccel` (u/s^2, bagi `TICK_RATE`^2 untuk u/tick^2) di `pickups.ts`: kecepatan butir mulai dari start, naik per tick sampai `glintFlySpeedUPerTick`. Ganti angka 3 di `spawner.ts` `markRadiusFor` dengan `cfg.spawnMarkMediumGroupMin`. Ganti `LOW_HP_FRAC` di `signals.ts` dengan `cfg.lowHpFrac`. Semua kunci punya default perilaku lama |
| GP (sudah diperbaiki GD, mohon ditinjau) | `projectiles.ts`: boomerang mereset memori hit setiap tick saat kembali (karena `rangeLeft` tetap di bawah 0), sehingga Homeward Blade mengenai target besar sekali per tick (bot: 424 DPS ke boss, boss mati 7,5 s). Perbaikan satu blok: reset hanya saat berbalik (`phase` 0 ke 1) |
| LP | Kunci `low_hp_frac` dan `spawn_mark_medium_group_min` di `config.csv` (skema `src/content/tables/config.ts`). `LOW_HP_FRAC` di `src/core/constants.ts` boleh dihapus setelah GP memakai kunci data. Kunci `glint_fly_accel` memakai `col.float` karena skema belum punya satuan u/s^2 |
| QA | Ulangi `npx vitest run tests/unit/qa/bot-real-data.test.ts` setelah data ini. Bot GD ada di `tools/balance/bot/` bila QA ingin bot yang menghindar dan berbelanja sesuai tag |

## 7. Model ekonomi (referensi)

Model membaca semua angka dari CSV. Daya pemain di model adalah asumsi [Asumsi] (bagian asumsi tidak berubah dari M1-02: pungut 85%, reroll 0 sampai 2, Memento +4% DPS, kartu 50% ofensif). Bot di bagian 3 menggantikan model untuk keputusan balance; model tetap dipakai untuk kurva harga dan Glint.

### 7.1 Profil `run_a`

| Pulse | Jenis | t | Durasi (s) | Unlit | Laju (/s) | Glint mentah | Glint diharapkan | Kumulatif | Level akhir | Beli di toko |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | normal | 1 | 20 | 31 | 1,6 | 31 | 29 | 29 | 1 | 1 |
| 2 | normal | 2 | 23 | 46 | 2,0 | 50 | 46 | 75 | 2 | 1 |
| 3 | normal | 3 | 26 | 62 | 2,4 | 72 | 67 | 142 | 4 | 3 |
| 4 | normal | 4 | 29 | 71 | 2,4 | 93 | 86 | 228 | 5 | 2 |
| 5 | warden | 5 | 32 | 63 | 2,0 | 108 | 100 | 327 | 6 | 2 |
| 6 | normal | 6 | 35 | 113 | 3,2 | 153 | 142 | 469 | 7 | 3 |
| 7 | normal | 7 | 38 | 137 | 3,6 | 189 | 175 | 644 | 9 | 3 |
| 8 | normal | 8 | 40 | 161 | 4,0 | 226 | 209 | 853 | 10 | 3 |
| 9 | normal | 9 | 40 | 184 | 4,6 | 262 | 242 | 1095 | 12 | 4 |
| 10 | boss | 10 | boss | 30 | | 30 | 30 | 1125 | 12 | 0 |

Total pembelian model: 22 (bot `good`: 18). `run_b` model: 37 pembelian; `run_c`: 44 (ditinjau M3).

### 7.2 Kurva musuh

| t | hp(t) | dm(t) | HP swarmer | HP charger | HP shooter | HP tank | Kontak swarmer | Terjang charger |
|---|---|---|---|---|---|---|---|---|
| 1 | 1,00 | 1,00 | 6 | 16 | 10 | 60 | 4,0 | 7,0 |
| 3 | 1,42 | 1,20 | 9 | 23 | 14 | 85 | 4,8 | 8,4 |
| 5 | 1,96 | 1,40 | 12 | 31 | 20 | 118 | 5,6 | 9,8 |
| 7 | 2,62 | 1,60 | 16 | 42 | 26 | 157 | 6,4 | 11,2 |
| 9 | 3,40 | 1,80 | 20 | 54 | 34 | 204 | 7,2 | 12,6 |
| 10 | 3,83 | 1,90 | 23 | 61 | 38 | 230 | 7,6 | 13,3 |
| 15 | 6,46 | 2,40 | 39 | 103 | 65 | 388 | 9,6 | 16,8 |
| 20 | 9,84 | 2,90 | 59 | 157 | 98 | 590 | 11,6 | 20,3 |

### 7.3 Harga

| t | Memento P | F | R | Fb | Senjata I | II | III | IV | Reroll 1, 2, 3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 18 | 36 | 65 | 110 | 21 | 44 | 90 | 170 | 2, 3, 4 |
| 5 | 24 | 48 | 86 | 145 | 28 | 58 | 119 | 224 | 4, 5, 6 |
| 9 | 30 | 59 | 107 | 180 | 34 | 72 | 148 | 279 | 6, 7, 8 |
| 15 | 38 | 76 | 138 | 233 | 45 | 93 | 191 | 360 | 9, 10, 11 |

### 7.4 Target model (`model.py check`)

Semua PASS: swarmer 1 tembakan sampai t6, pembelian 22 (16 sampai 22), Warden 18,3 s pada DPS referensi, boss 82 s, level akhir 12, Pulse 1 memberi 29 Glint (harga termurah 18).

## 8. Pertanyaan terbuka

1. Boss mengalahkan 42% run bot `good` yang mencapainya, sedangkan Pulse biasa hampir tanpa luka bagi bot ini. Bila playtest manusia menunjukkan Pulse biasa sudah berat, turunkan HP boss dulu (2500 ke 2200) sebelum menyentuh Pulse.
2. Target GDD 19 "HP tersisa sekitar 50% di Pulse 9" belum terpenuhi oleh bot `good`. Dipertahankan sebagai target manusia; diukur ulang dengan telemetri M4.
3. Hasil bot perlu diulang setelah GP menyelesaikan M2-05 (knockback, affix, event) karena perilaku sim masih bergeser.
