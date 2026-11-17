# Laporan Balance (M2-01, vertical slice)

Pemilik: Game Designer. Status: M4-03, 2026-11-17 (bagian 9 baru: target kurva Tingkat B; bagian 1 sampai 8 dari M2-01). Sumber angka: `content/data/*.csv` (CSV menang bila berbeda dengan dokumen). Alat: `tools/balance/model.py` (model ekonomi, Python standar) dan `tools/balance/bot/` (bot yang memainkan sim asli).

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
- [Digantikan bagian 9] Bot `good`, 20 seed per kelas, `run_b`: `lantern` menang 80%, `bell` 55% (Warden 49 s, boss 103 s: lemah melawan target tunggal), `blade` 95%. Durasi run menang 14,6 sampai 15,9 menit (target B 15 sampai 20). Tidak ada timeout atau overflow. Angka ini hanya bukti data B bisa dimainkan; tuning B di M3 (HP boss B t15 sekitar 16150 [Asumsi], `bell` perlu daya satu target).

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

## 8. Pertanyaan terbuka (M2-01)

1. Boss mengalahkan 42% run bot `good` yang mencapainya, sedangkan Pulse biasa hampir tanpa luka bagi bot ini. Bila playtest manusia menunjukkan Pulse biasa sudah berat, turunkan HP boss dulu (2500 ke 2200) sebelum menyentuh Pulse.
2. Target GDD 19 "HP tersisa sekitar 50% di Pulse 9" belum terpenuhi oleh bot `good`. Dipertahankan sebagai target manusia; diukur ulang dengan telemetri M4.
3. Hasil bot perlu diulang setelah GP menyelesaikan M2-05 (knockback, affix, event) karena perilaku sim masih bergeser.

## 9. Tingkat B: target kurva kesulitan dan hasil bot (M4-03)

Build rilis 1.0 adalah Tingkat B (`run_b`, 15 Pulse, Warden P4 dan P10, boss P15) dengan Crack 0 saja. Crack bertingkat ikut Tingkat C (pasca 1.0), jadi Crack 0 harus sekaligus ramah pemain baru dan menguji keahlian.

### 9.1 Target (per kelas, bot `good`, minimal 30 seed)

| # | Metrik | Target | Alasan |
|---|---|---|---|
| T1 | Menang | 60 sampai 85% | Bot `good` hampir tidak terluka di Pulse biasa (median damage 0 sesudah P5), jadi angkanya batas atas untuk manusia terampil. Lebih tinggi dari target `run_a` (30 sampai 60%) karena kalah di P14 membuang 15 menit dan tidak ada Crack lebih mudah di bawahnya [Asumsi]. Dicek ulang dengan telemetri playtest |
| T2 | Selisih menang antar kelas | maksimal 15 poin | Pilar 1: tidak ada kelas kelas dua |
| T3 | Kematian di satu Pulse Warden (P4, P10) | maksimal 20% run | Warden P4 adalah ujian pertama yang disengaja, bukan tembok kelas |
| T4 | Kematian di satu Pulse biasa | maksimal 10% run | Tekanan naik rata, tanpa lonjakan tersembunyi |
| T5 | Kalah di boss P15 | maksimal 15% dari run yang mencapainya | Boss adalah puncak, bukan hukuman untuk run 14 Pulse |
| T6 | Durasi run menang (perkiraan, bagian 2) | 12 sampai 16 menit | Brief M4. Waktu di Temper dan the Glazier tidak lagi menambah waktu sim (BUG-013), perkiraan tetap menambah 20 s per toko |
| T7 | Waktu bunuh boss | median 35 sampai 100 s | Fase 2 sempat terlihat, tidak berlarut |
| T8 | Glint terpungut | median 70% atau lebih di setiap Pulse non-boss | CD M3 polish 8 |
| T9 | Pembelian per run | median 22 sampai 30 | Sekitar 2 per toko, 14 toko |
| T10 | Unlit hidup maksimal, `poolOverflow` | di bawah 120, 0 | Anggaran LP |
| T11 | Bot `naive` menang | maksimal 30% | Keahlian harus menentukan hasil. Pengecualian Vintner: bagian 9.4 |

### 9.2 Perubahan angka M4-03

| Angka | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `affixes.csv` `brood` tier | B | C | BUG-012: pemakai `brood` hanya Warden C (`warden_bulwark`) dan pool acak Crack 2 ke atas, keduanya pasca 1.0. Memasangnya ke Warden B akan mempertebal Warden P4, yang sudah menjadi tembok Chorister, tanpa data playtest. Kode affix tetap utuh untuk C |
| `pickup_radius_base` | 2,0 u | 2,25 u | CD M3 polish 8 (Glint tercecer di akhir Pulse panjang). Glint terpungut Chorister turun ke 68 sampai 69% di P6 dan P12 sebelum perubahan. Dipilih radius, bukan menarik semua Glint saat Pulse ditutup: kepadatan butir terjadi selama Pulse, sedangkan penyapuan akhir Pulse sudah menghapus semua butir lantai. 2,5 u juga diuji: lolos target tetapi memberi pemain pasif terlalu banyak Glint (bagian 9.5) |
| Hand Bell (`echo_bell`) dmg, jeda | 7, 2,2 s | 8, 2,0 s | Chorister mati 33% di Warden P4 (target T3 20%). Daya satu target naik sekitar 25% (4,8 ke 6,0 DPS termasuk gema), tetap jauh di bawah Lantern Bolt (10,8 tanpa Burn). 9 dmg juga diuji: membuat Chorister pasif (bot QA `dodgerRandom`) bertahan di overtime Warden P4 selama 43 menit pada satu seed |

### 9.3 Hasil final (contentHash `f3e7a350`, bot `good` seed 1 sampai 60, `naive` seed 1 sampai 30)

| Metrik | Lamplighter | Chorister | Vintner | Target |
|---|---|---|---|---|
| Menang `good` | 82% (49/60) | 75% (45/60) | 85% (51/60) | T1 60 sampai 85%; T2 selisih 10 poin |
| Kematian Pulse Warden | P4 17%, P10 2% | P4 13%, P10 12% | P4 7% | T3 maksimal 20% |
| Kematian Pulse biasa | 0% | 0% | 0% | T4 maksimal 10% |
| Kalah di boss P15 | 0% | 0% | 9% (5/56) | T5 maksimal 15% |
| Durasi menang (perkiraan) | 14,4 menit (sim 8,6) | 15,4 menit (sim 9,6) | 14,5 menit (sim 8,6) | T6 12 sampai 16 |
| Waktu bunuh boss median | 44 s | 85 s | 41 s | T7 35 sampai 100 s |
| Glint terpungut, Pulse non-boss terendah | 74% | 74% | 84% | T8 70% |
| Pembelian median | 26 | 23 | 26 | T9 22 sampai 30 |
| Unlit hidup maks, overflow | 94, 0 | 101, 0 | 84, 0 | T10 |
| Menang `naive` | 13% | 30% | 70% | T11 maksimal 30% |

Sebelum M4-03 (contentHash `2008c1b6`, seed 1 sampai 30): Lamplighter 83%, Chorister 67% (P4 33%, Warden 39 s), Vintner 80%; Glint terpungut Chorister terendah 68%. Bot `naive` dengan data lama sama persis dengan tabel QA M3 6.1, jadi perubahan sim BUG-013 tidak menggeser hasil bot.

Putusan: ketiga kelas memenuhi T1 sampai T10. T11 lolos untuk Lamplighter dan Chorister (Chorister tepat di batas); Vintner gagal (bagian 9.4).

### 9.4 Vintner dan bot `naive`

Vintner `naive` menang 70% (sama dengan M3). Run menangnya lambat (perkiraan 21,5 menit, sim 15,5 menit, karena Warden dan boss bertahan lama), jadi keahlian terlihat dari waktu, belum dari hasil. Diuji tiga varian (pemulihan maks 3 ke 2 dan ke 1 HP per detik, Max HP 38 ke 32): semuanya menurunkan bot `good` sama banyak dengan `naive` (`good` 60 sampai 70%), jadi tidak memperlebar jarak keahlian dan tidak dipakai. Kemungkinan penyebab: bot `good` menjaga jarak dari tubuh Unlit, cara main yang kurang cocok untuk senjata jarak dekat. Tindak lanjut: playtest manusia Vintner, atau perilaku bot jarak dekat, sebelum menyentuh angka Vintner.

### 9.5 P1-c ragam build: gagal sejak M3 (temuan GD)

`run-bots.ts` kini mencatat tag dominan di toko terakhir (`--class all --all-unlocks`, kelas bergilir per seed seperti QA B-6). Bot `good` memilih secara wajar (tag kelas, lalu tag terbanyak), sesuai definisi P1-c di `docs/pillars.md`.

| Data | Bot | Tag dominan (50 run, seed 1001 sampai 1050) |
|---|---|---|
| Sebelum M4-03 (`2008c1b6` setara) | `good` | edge 54%, flame 26%, shard 10%, echo 8%, ward 2% |
| Sebelum M4-03 | `naive` | edge 40%, flame 34%, shard 16% |
| Final M4-03 (`f3e7a350`) | `good` | edge 56%, flame 26%, shard 12%, echo 6% |
| Final, uji QA B-6 (`dodgerRandom`) | QA | edge 54% (M3: 38%) |

Bacaan: Edge sudah melewati batas 40% sebelum tugas ini. B-6 lolos tipis di M3 karena bot acak QA sering mati di Pulse 3 sampai 5, sehingga build masih kecil dan tag senjata awal kelas yang menentukan (QA mencatatnya di M3-report 6). Setiap perubahan yang membuat run pasif bertahan lebih lama membuat B-6 gagal di 44 sampai 56%: diuji radius 2,5 saja (48%), Hand Bell 9 saja (44%), radius 2,25 dengan Hand Bell 8 jeda lama (50%), dan kombinasi final (54%). Akar masalah ada di komposisi pool: Edge 9 item (terbanyak, plus senjata awal Vintner), Echo dan Ward 6. Ini risiko yang sudah dicatat CD M3 3.1. Perbaikan butuh keputusan desain pool tag (misalnya menambah item Echo dan Ward, atau mengganti tag kedua satu sampai dua item Edge), di luar M4-03. Tes B-6 tidak dilemahkan dan tetap merah sampai keputusan itu diambil (diselesaikan M4-04, bagian 10).

Bot `naive` M4-03 setelah semua perubahan: Chorister bertahan lebih lama di overtime Warden (hingga beberapa menit) karena overtime tidak punya batas. Dengan Hand Bell 8 tidak ada timeout di 50 run B-6 maupun 90 run `naive`; dengan 9 ada satu (43 menit).

### 9.6 Cara mengulang

```
npm run data:build
node tools/balance/bot/run-bots.ts --bot good --profile run_b --class lantern --seeds 1-60
node tools/balance/bot/run-bots.ts --bot naive --profile run_b --class blade --seeds 1-30
node tools/balance/bot/run-bots.ts --bot good --profile run_b --class all --all-unlocks --seeds 1001-1050
```
Ulangi untuk `bell` dan `blade`. Data default build sudah Tingkat B. Sekitar 20 s per 60 seed.

## 10. M4-04: ragam build (P1-c) dan batas overtime Warden

### 10.1 Perubahan data (P1-c)

Akar masalah bagian 9.5 adalah komposisi pool Tingkat B, bukan angka kekuatan: Edge 9 item, Echo dan Ward 6, dan Echo tidak punya Memento Plain sehingga hampir tidak muncul di toko awal. Pool Rare berisi 3 item Edge dari 5.

| Perubahan | Sebelum | Sesudah | Alasan desain |
|---|---|---|---|
| `splinter_comb` tag | shard, edge | shard, echo | Efeknya serpih yang memantul ke Unlit lain, yaitu gema dari satu hit (sejalan dengan Music Box). Edge tetap memiliki pemicu kritikal lewat sinergi |
| `tuning_fork` rarity | fine | plain | Setiap tag kini punya minimal satu Memento Plain, jadi Echo hadir di toko awal seperti Ward (`iron_thimble`) |
| `music_box`, `patched_cloak` | Tingkat C, paket 3 dan 4 | Tingkat B, paket 2 | Menambah item Echo dan Ward murni ke rilis. Paket 2 di B dulu hanya berisi `grinding_wheel` (biaya 10); kini isinya lengkap dengan biaya penuh 25. `pyre_bell` pindah ke paket 3, `wick_charm` ke paket 4 (biaya C tetap) |

Pool Tingkat B dengan semua unlock (32 item): Flame 7, Shard 8, Edge 8, Echo 8, Ward 7, Trade 6. Teks efek tidak berubah karena string tidak menyebut tag. Ikon kedua Memento baru dibuat sebagai `placeholder` (`art/sprites/icon-memento-music-box.json`, `icon-memento-patched-cloak.json`) agar `art:check` lulus; AD perlu versi final.

### 10.2 Batas overtime Warden

Tanpa batas, bot `naive` Chorister menahan Warden P4 sampai 1020 s (17 menit, seed 1 sampai 60). Aturan baru (`config.csv`, dibaca `src/sim/systems/run.ts`):

| Kunci | Nilai | Arti |
|---|---|---|
| `warden_overtime_decay_s` | 60 | Detik waktu tambahan sebelum Warden meluruh (setelah haste di 20 s). 0 = tanpa batas (default schema) |
| `warden_overtime_decay_len_s` | 15 | Batas atas HP Warden turun linear dari HP maks ke 0. Penyembuhan tidak bisa mengejar |

Di 0 Warden mati sebagai kill Warden biasa: peti hadiah dan Glint tetap diberikan (GDD 3.3: Warden tidak kabur, hadiah selalu bisa diraih), tanpa efek `on_kill` dan tanpa sumber. Pulse Warden paling lama 75 s melewati timer. Dipilih meluruh, bukan Pulse ditutup tanpa hadiah, karena pemain yang bertahan 60 s melawan Warden hasted sudah membayar dengan waktu dan risiko; menghukum dua kali hanya memukul build lemah.

Pengaruh: bot `good` tidak pernah mencapai peluruhan (Warden terlama 77 s sejak muncul), hasil `good` identik. Bot `naive` Chorister seed 1 sampai 60: tanpa batas menang 22% (Warden maks 1020 s); mulai 45 s 23%; 60 s 27% (maks 103 s); 90 s 20%. Selisihnya di dalam derau 60 seed.

### 10.3 Hasil (contentHash `977ff134`)

P1-c, tag dominan di toko terakhir (`--class all --all-unlocks`):

| Bot dan seed | Sebelum (`f3e7a350`) | Sesudah |
|---|---|---|
| QA B-6 `dodgerRandom`, 1001 sampai 1050 | edge 54% | edge 36%, flame 26%, echo 20%, shard 14%, ward 2%, trade 2% |
| `good`, 1001 sampai 1050 | edge 56% | flame 34%, edge 32%, echo 32%, shard 2% |
| `good`, 2001 sampai 2100 | edge 48% | echo 37%, edge 29%, flame 28%, shard 5%, ward 1% |

Matriks `run_b` default unlock (paket terkunci, jadi hanya `splinter_comb` dan `tuning_fork` berpengaruh), bot `good` seed 1 sampai 120:

| Metrik | Lamplighter | Chorister | Vintner | Target |
|---|---|---|---|---|
| Menang `good` | 80% | 78% | 85% | T1 60 sampai 85%; T2 selisih 7 poin |
| Kematian Pulse Warden | P4 14%, P10 5% | P4 18%, P10 3% | P4 3% | T3 maksimal 20% |
| Kematian Pulse biasa | P5 1% | P12 1% | 0% | T4 maksimal 10% |
| Kalah di boss P15 | 0% | 1% | 12% (14/116) | T5 maksimal 15% |
| Durasi menang (perkiraan) | 14,4 menit | 15,3 menit | 14,5 menit | T6 12 sampai 16 |
| Waktu bunuh boss median | 43 s | 84 s | 39 s | T7 35 sampai 100 s |
| Glint terpungut terendah (non-boss) | 74% | 74% | 83% | T8 70% |
| Pembelian median | 26,5 | 23 | 26 | T9 22 sampai 30 |
| Unlit hidup maks, overflow | 81, 0 | 111, 0 | 99, 0 | T10 |
| Menang `naive` (seed 1 sampai 30) | 23% | 30% | 77% | T11 maksimal 30% (Vintner: 9.4) |

Semua T1 sampai T10 lolos. Catatan derau: dengan seed 1 sampai 60 saja, Vintner kalah di boss 19% (11/58); data lama (`f3e7a350`) pada seed 61 sampai 180 dan data baru memberi angka yang sama (8 kekalahan boss dari 115), jadi 60 seed terlalu sedikit untuk T5. Tabel ini memakai 120 seed.

Catatan ukur B-6: bot acak sering mati di Pulse 3 sampai 5, dan seri dipecah menurut urutan data tag (flame, shard, edge, echo, ward, trade). Pada set seed lain (4001 sampai 4075, 7001 sampai 7075) Flame tetap 44 sampai 49% untuk bot acak, terutama dari run Lamplighter yang mati dini dan seri yang dimenangkan Flame. Tes B-6 (seed tetap) lolos dengan margin 2 run; perubahan konten berikutnya bisa menggesernya lagi (lihat pertanyaan terbuka di laporan).

Uji QA M3-02 (setiap pola boss muncul) juga peka terhadap kekuatan build acak: varian tanpa promosi Tingkat C butuh seed tambahan sampai 40 (batas tes 25); varian final butuh sampai 21.

### 10.4 Cara mengulang

```
npm run data:build
node tools/balance/bot/run-bots.ts --bot good --profile run_b --class all --all-unlocks --seeds 1001-1050
node tools/balance/bot/run-bots.ts --bot good --profile run_b --class lantern --seeds 1-120
node tools/balance/bot/run-bots.ts --bot naive --profile run_b --class bell --seeds 1-30
npx vitest run tests/unit/qa/content-b.test.ts -t B-6
npx vitest run tests/unit/sim/warden-overtime.test.ts
```
