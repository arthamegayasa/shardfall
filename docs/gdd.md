# Shardfall: Game Design Document

Pemilik: Game Designer (GD). Status: versi 2, 2026-11-17 (perbaikan review M0 CD dan LP, jawaban `docs/specs/gd-answers-m0.md`). Reviewer: CD (rasa, pilar), LP (kelayakan).
Dasar: `docs/vision.md`, `docs/pillars.md`, `docs/style-guide.md` (versi 1.1), keputusan di `docs/tasks.md`. Teknis (satuan, kontrak, format data): `docs/tech/architecture.md` versi 2.
Dokumen pendamping: `docs/systems/effect-primitives.md` (bahasa efek), `docs/systems/data-schema.md` (kolom CSV), `docs/specs/gd-answers-m0.md` (aturan rinci untuk GP).

Perubahan versi 2: Keepsake menjadi Memento; arena 32 x 20 u final; durasi Pulse dari data; aturan spawn, kontak, Burn, merge, jual, gabung Glint, dan urutan akhir Pulse ditetapkan; urutan komposisi stat (5.6); profil M1 `run_a_m1`; HUD Warden saat Pulse ditahan; istilah UI Fuse, Temper, Crack, Vitrine Steady, Light Kept.

## 0. Konvensi

- **Angka** di dokumen ini adalah angka awal. Semua bertanda [Asumsi] kecuali disebut lain. Mulai M1, CSV di `content/data/` yang menang bila berbeda.
- **Nama** item, Memento, Unlit, Warden, boss, dan Rite adalah nama kerja deskriptif. Writer memberi nama final lewat string table. Identifier (`snake_case`) dipakai di data dan kode dan tidak berubah saat nama final diganti. Nama final yang sudah disetujui CD: kelas Lamplighter (`lantern`), Chorister (`bell`), Vintner (`blade`); bioma The Moth Market (`biome_market`), Vesper Steps (`biome_cloister`), Stillfire Vineyard (`biome_vineyard`). Istilah UI: merge tampil "Fuse", panel level-up "Temper", kesulitan "Crack", layar antara bioma "Vitrine Steady", judul menang "Light Kept", layar meta "The Keeping".
- **Tag** ditulis dengan nama tampil (Flame) di dokumen ini; di data id-nya huruf kecil (`flame`, `shard`, `edge`, `echo`, `ward`, `trade`).
- **Satuan jarak `u`**: 1 u = 16 px layar pada sumbu x dan 10 px pada kedalaman lantai (architecture 7.1). 1 tile = 1 u. Pemain tinggi sekitar 1.25 u. Sim bekerja dalam u lantai; piksel hanya di render. **Arena final 32 x 20 u** dengan sudut terpotong 3 u (arena-design 4.1); semua jarak di dokumen ini sudah dikalibrasi ke arena itu.
- **Threat `t`**: tingkat ancaman sebuah Pulse (1 sampai 20). Semua skala (HP musuh, damage musuh, harga, damage proc) memakai `t`, bukan nomor Pulse. Ini yang membuat Tingkat A dan C memakai rumus yang sama.
- **Tingkat konten**: kolom "Tk" di tabel berarti tingkat minimum tempat konten itu muncul (kolom data `content_tier`). A = lantai rilis, B = target, C = plafon (vision.md 7.2). Konten A juga ada di B dan C.
- Simulasi berjalan di tick tetap 60 per detik dengan RNG ber-seed per aliran (architecture 4.3). Semua peluang di dokumen ini digulir di aliran RNG simulasi.

---

## 1. Core loop

```
Pilih kelas -> [ Pulse (20 sampai 40 s) -> akhir Pulse -> hadiah Warden? -> level-up (1 dari 3 per level) -> the Glazier ] x N -> boss -> menang atau mati -> Silt
```

| Detak | Durasi | Yang dilakukan pemain | Yang dirasakan |
|---|---|---|---|
| Bertahan | 20 sampai 40 s per Pulse (boss tanpa batas waktu) | Gerak (WASD), senjata menyerang otomatis, tekan Rite (Space atau klik kanan, arah ke kursor), kejar Glint | Tegang, terbaca, padat di akhir |
| Memilih | sekitar 15 sampai 30 s | Ambil hadiah Warden, pilih kartu level-up (Temper), beli, reroll, kunci, gabung (Fuse), jual | Cepat dan menggoda |
| Merasakan | Pulse berikutnya | Item baru langsung terlihat di arena | Build tumbuh di depan mata |

Aturan inti:
1. HP pulih penuh di awal setiap Pulse (Crack 5 mengubahnya). Setiap Pulse adalah ujian tersendiri; regen dan leech berguna di dalam Pulse. Pemulihan tampil bersama gelombang cahaya pembuka (bar HP terisi bersama cincin cahaya, CD K5), bukan angka yang diam-diam berubah.
2. Glint adalah uang sekaligus XP. Memungut Glint menambah saldo dan XP. Membelanjakan Glint tidak mengurangi XP.
3. Level naik saat Pulse (kilat emas kecil plus suara), tapi kartunya dipilih di awal fase toko.
4. Tidak ada toko sebelum Pulse 1. Run dimulai dengan senjata awal kelas, 0 Glint.
5. Kematian mengakhiri run. Pulse terakhir profil run (`final` = 1) yang selesai berarti menang.

Akhir run:
- **Kalah**: HP 0 memicu gerak lambat 1 s di dalam sim (`death_slowmo_s`), lalu fase `defeat` (layar run-lost dengan "Felled by").
- **Menang**: boss final mati, semua Unlit larut, bahaya hilang, semua Glint di lantai dipungut, jeda 1.5 s (`victory_delay_s`), lalu `victory` ("Light Kept"). Di M1 (tanpa boss) menang saat timer Pulse `final` habis.
- **Abandon** = `defeat` dengan hasil Abandon; dihitung seperti mati untuk Silt.
- Prioritas di tick yang sama: akhir Pulse dan kematian boss final menang atas kematian pemain (urutan tick di 3.6).

Target waktu: Tingkat A sekitar 9 sampai 11 menit, Tingkat C sekitar 17 sampai 20 menit (hitungan di bagian 3.5).

---

## 2. Struktur run per tingkat

Run dijalankan dari **profil run** (`run_profiles.csv`). Setiap profil adalah daftar slot Pulse. Setiap slot punya jenis (`normal`, `warden`, `boss`), bioma, dan threat.

### 2.1 Tingkat C (plafon 1.0): 20 Pulse, 3 bioma

| Bioma (id kerja) | Pulse | Threat | Warden | Boss | Unlit yang muncul |
|---|---|---|---|---|---|
| `biome_market` (pasar berlentera) | 1 sampai 7 | 1 sampai 7 | Pulse 4: `warden_hound` | Pulse 7: `boss_lantern` | swarmer, charger, shooter, tank |
| `biome_cloister` (biara tebing) | 8 sampai 14 | 8 sampai 14 | Pulse 11: `warden_choir` | Pulse 14: `boss_bell` | + exploder, summoner, mote |
| `biome_vineyard` (kebun anggur terbakar) | 15 sampai 20 | 15 sampai 20 | Pulse 17: `warden_bulwark` | Pulse 20: `boss_vine` (final) | + lobber |

Setelah boss non-final: Glint boss, peti Memento, fase toko, layar "Vitrine Steady", lalu Vitrine berikutnya (arena baru, palet cahaya baru). Bioma 2 dan 3 boleh memakai ulang geometri arena bioma 1 dengan palet berbeda (keputusan Producer).

### 2.2 Tingkat B (target): 15 Pulse, 1 bioma, 2 Warden

| Pulse B | Komposisi spawn diambil dari baris C | Catatan |
|---|---|---|
| 1 sampai 6 | C1 sampai C6 | Warden 1 di Pulse 4 |
| 7 sampai 12 | C8 sampai C13 | exploder dan summoner muncul di bioma 1. Warden 2 (`warden_choir`) di Pulse 10 |
| 13 sampai 14 | C15 sampai C16 tanpa lobber | |
| 15 | boss | `boss_lantern` |

Threat di profil B sama dengan nomor Pulse B (1 sampai 15); hanya komposisi spawn yang dipinjam dari baris C. Durasi B13 dan B14: 40 s.

### 2.3 Tingkat A (lantai rilis): 10 Pulse, 1 bioma, 1 Warden, 1 boss

| Pulse | Jenis | Threat | Catatan |
|---|---|---|---|
| 1 sampai 4 | normal | 1 sampai 4 | |
| 5 | warden | 5 | `warden_hound` |
| 6 sampai 9 | normal | 6 sampai 9 | |
| 10 | boss | 10 | `boss_lantern` (final) |

Isi Tingkat A: kelas `lantern`, bioma `biome_market`, 4 Unlit (swarmer, charger, shooter, tank), 1 Warden, 1 boss, 6 senjata, 12 Memento, 3 tag aktif (Flame, Shard, Edge), toko dengan reroll, kunci, gabung, jual, layar akhir run. Tanpa Silt dan tanpa Crack.

Aturan tag tersembunyi: item A boleh membawa tag di luar 3 tag aktif (misalnya Orbit Shards membawa Ward). Di build A, tag yang tidak aktif tidak ditampilkan dan tidak dihitung. Data cukup memakai kolom `content_tier` di `synergies.csv`.

### 2.4 Profil prototipe M1 (`run_a_m1`)

Sama dengan `run_a` kecuali Pulse 5 dan 10, karena Warden dan boss masuk M2. Arena `arena_proto`.

| Pulse | Jenis | t | Durasi (s) | s | c | h | k | Total | Glint mentah | `alive_cap` | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | normal | 5 | 32 | 40 | 10 | 8 | 4 | 62 | 96 | 70 | Dinaikkan agar ekonomi tidak kehilangan 25 Glint Warden |
| 10 | normal | 10 | 45 | 88 | 20 | 20 | 13 | 141 | 233 | 90 | `final` = 1. Baris 9 x 1.25 |

---

## 3. Struktur Pulse

### 3.1 Durasi

Durasi tiap Pulse ditulis langsung di kolom `duration_s` di `waves.csv` (sumber tunggal, tanpa rumus di config). Tingkat A: 20, 23, 26, 29, 32, 35, 38, 40, 40 s (naik 3 s per Pulse, maks 40). Tingkat C memakai kurva sedikit lebih landai di bioma 1 (tabel 3.4). Pulse boss tidak berbatas waktu; HUD mengganti timer dengan bar HP boss (sesuai ui-spec).

### 3.2 Kurva kepadatan di dalam Pulse

Spawner membagi jumlah musuh per Pulse ke sepanjang waktu dengan bobot `w(τ)` (τ = detik sejak Pulse mulai, D = durasi):

| Rentang τ | Bobot w | Rasa |
|---|---|---|
| 0 sampai 3 s | 0.4 | Gelombang cahaya pembuka, pemain sempat bergerak |
| 3 s sampai D minus 6 s | naik linier 0.6 ke 1.3 | Tekanan naik |
| D minus 6 s sampai D minus 2 s | 1.6 | Lonjakan akhir, sama dengan riser musik |
| D minus 2 s sampai D | 0 | Tidak ada spawn baru, pemain bersiap untuk kilatan kaca |

Setiap baris di `wave_spawns.csv` boleh membatasi jendela waktunya sendiri (`start_frac`, `end_frac`), misalnya tank baru masuk setelah 30% Pulse, dan arah datangnya (`sectors`). Jadwal spawn dihitung di awal Pulse dari aliran RNG `spawn`, sehingga deterministik.

Algoritma jadwal:
1. Tiap baris dipecah menjadi grup berukuran acak `group_min` sampai `group_max`; grup terakhir dipotong agar total tepat `count`.
2. Waktu tiap grup diambil dari w(τ) yang dipotong ke `[start_frac x D, end_frac x D]` dan ke `[0, D minus 2]` (CDF terbalik). Waktu itu adalah awal telegraf; Unlit keluar 0.8 s kemudian.
3. Jadwal diurutkan menurut waktu; seri diputus urutan baris lalu urutan grup.
4. Satu grup = satu titik; anggota disebar acak dalam 0.5 u. Sektor dipilih acak seragam dari `sectors` (kosong = 8 sektor) dengan aturan tolak arena-design 5.2.

Aturan spawn:
- Titik spawn di pita tepi arena (8 sektor, data LD). Tidak pernah dalam `spawn.playerSafeRadius` (4 u, JSON arena) dari pemain.
- Setiap spawn didahului tanda retak di lantai selama 0.8 s (`spawn_mark_s`). Tanda ini tidak memberi damage dan Unlit tidak bisa dilukai selama tanda. Diameter tanda: kecil 1.0, sedang 1.5, besar 2.0, Warden 3.0 u; grup 3 ekor atau lebih minimal sedang.
- Setelah keluar, Unlit punya masa tenggang 0.3 s (`spawn_grace_s`): tanpa damage kontak dan tanpa memulai serangan, tetapi bisa dilukai.
- Swarmer datang dalam kelompok 3 sampai 6 di satu titik; jenis lain sendiri atau berdua.
- Batas Unlit hidup (`alive_cap` per Pulse di `waves.csv`): 70 (t1 sampai 5), 90 (t6 sampai 10), 110 (t11 sampai 15), 120 (t16 sampai 20). Unlit hidup ditambah tanda spawn aktif dihitung; mote dihitung. Warden, boss, swarmer tetesan boss, dan swarmer Moth Call tidak dihitung.
- Bila penuh, spawn mengantre FIFO dan mulai tandanya saat ada tempat. Spawn yang belum bisa mulai sebelum D minus 2 s dibuang, agar dua detik tenang sebelum akhir Pulse terjaga.
- Unlit tidak dikompensasi gerak vertikal (CD K7 butir 4); ditinjau setelah playtest M1 bila kabur vertikal terlalu mudah.

### 3.3 Akhir Pulse

Di tick timer mencapai 0, berurutan:
1. Kilatan kaca dari tepi arena melarutkan semua Unlit menjadi motes gelap. Unlit yang larut tidak menjatuhkan Glint. Proyektil, telegraf, dan zona milik kedua pihak dihapus; antrean spawn dibuang. Tidak ada damage setelahnya.
2. Efek `on_pulse_end` dievaluasi (misalnya Ledger Page).
3. 50% total nilai Glint yang masih di lantai dipungut otomatis (floor), sisanya padam. Pungutan ini memberi XP tetapi tidak memicu `on_pickup`. Ini menjaga pilihan "kejar Glint atau aman" (vision 4.3) tanpa terasa kejam.
4. Fase `pulseClear` selama 1.0 s (`pulse_clear_s`), lalu antrean pilihan: `reward` (bila Warden atau boss non-final dikalahkan), `levelUp` (satu kartu per level), lalu `shop` (the Glazier). Urutan sama dengan ui-spec dan architecture 4.4.

Awal setiap Pulse: pemain ditempatkan di `playerStart` arena (`[0, 0]` untuk Pulse biasa dan Warden, `[0, 5]` untuk boss), HP penuh (Crack 5: 50% HP yang hilang), muatan Rite penuh, Barrier sampai `barrier_max`, semua cooldown senjata siap. Status, buff, tumpukan Rush, penghitung `every_nth` dan `on_distance` direset.

**Pulse Warden:** Warden muncul di 25% durasi dengan banner nama, di sektor terjauh dari pemain, dengan tanda spawn berdiameter 3 u. Warden tidak dihitung ke batas hidup. Bila timer habis dan Warden masih hidup (waktu tambahan), antrean spawn dibuang, Unlit yang ada tetap menyerang, timer diam di 0:00, dan Pulse baru berakhir saat Warden mati. Selama waktu tambahan, slot timer HUD menjadi bar HP Warden berlabel "Held" (CD K3); sim menyediakan `PulseView.warden` dan `PulseView.overtime` (architecture 6.4). Setelah 20 s waktu tambahan, Warden mendapat affix `hasted` sekali. Warden yang mati sebelum timer 0 tidak mengakhiri Pulse; Pulse lanjut normal sampai timer habis. Warden tidak pernah kabur; hadiahnya selalu bisa diraih.

**Pulse boss:** telegraf panggung boss (radius 4 u) berjalan 2.0 s sejak Pulse mulai (`boss_entry_s`); boss tidak bisa dilukai dan tidak memberi damage sebelum keluar. Selama pertarungan, 2 swarmer muncul tiap 4 s sebagai sumber Glint kecil, dijeda selama ada 24 swarmer tetesan hidup. Setelah 120 s sejak boss keluar, boss mengamuk (jeda antar pola dikurangi 40%, telegraf tidak berubah). Saat boss mati, semua Glint di lantai dipungut otomatis.

### 3.4 Tabel Pulse

Kode jenis: s = swarmer, c = charger, h = shooter, k = tank, x = exploder, u = summoner, l = lobber. Glint mentah = total nilai drop bila semua dipungut. Glint diharapkan = mentah x 0.925 (asumsi pemain memungut 85%, plus 50% dari sisa 15%). Semua [Asumsi], final di `waves.csv` dan `wave_spawns.csv`.

**Tingkat A (profil `run_a`)**

| Pulse | Jenis | t | Durasi (s) | s | c | h | k | Total | Laju (/s) | Glint mentah | Glint diharapkan | Kumulatif | Level akhir |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | normal | 1 | 20 | 26 | | | | 26 | 1.3 | 26 | 24 | 24 | 1 |
| 2 | normal | 2 | 23 | 32 | 4 | | | 36 | 1.6 | 40 | 37 | 61 | 3 |
| 3 | normal | 3 | 26 | 36 | 6 | 4 | | 46 | 1.8 | 56 | 52 | 113 | 4 |
| 4 | normal | 4 | 29 | 40 | 8 | 6 | 2 | 56 | 1.9 | 78 | 72 | 185 | 5 |
| 5 | warden | 5 | 32 | 36 | 8 | 6 | 3 | 53 + W | 1.7 | 104 | 96 | 281 | 6 |
| 6 | normal | 6 | 35 | 50 | 10 | 10 | 4 | 74 | 2.1 | 110 | 102 | 383 | 7 |
| 7 | normal | 7 | 38 | 56 | 12 | 12 | 6 | 86 | 2.3 | 134 | 124 | 507 | 9 |
| 8 | normal | 8 | 40 | 62 | 14 | 14 | 8 | 98 | 2.5 | 158 | 146 | 653 | 10 |
| 9 | normal | 9 | 40 | 70 | 16 | 16 | 10 | 112 | 2.8 | 184 | 170 | 823 | 11 |
| 10 | boss | 10 | bebas | 30 (tetesan) | | | | 30 + B | | 30 | 28 | 851 | 12 |

**Tingkat C (profil `run_c`)**

| Pulse | Bioma | Jenis | t | Durasi (s) | s | c | h | k | x | u | l | Total | Glint mentah | Kumulatif diharapkan | Level akhir |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | market | normal | 1 | 20 | 26 | | | | | | | 26 | 26 | 24 | 1 |
| 2 | market | normal | 2 | 22 | 30 | 4 | | | | | | 34 | 38 | 59 | 2 |
| 3 | market | normal | 3 | 24 | 34 | 6 | 4 | | | | | 44 | 54 | 109 | 4 |
| 4 | market | warden | 4 | 27 | 30 | 6 | 4 | 2 | | | | 42 + W | 85 | 188 | 5 |
| 5 | market | normal | 5 | 30 | 46 | 10 | 8 | 3 | | | | 67 | 97 | 278 | 6 |
| 6 | market | normal | 6 | 33 | 52 | 12 | 10 | 5 | | | | 79 | 121 | 390 | 8 |
| 7 | market | boss | 7 | bebas | 24 (tetesan) | | | | | | | 24 + B | 64 | 449 | 8 |
| 8 | cloister | normal | 8 | 34 | 50 | 10 | 8 | 4 | 8 | | | 80 | 114 | 554 | 9 |
| 9 | cloister | normal | 9 | 36 | 54 | 10 | 10 | 5 | 10 | 2 | | 91 | 135 | 679 | 10 |
| 10 | cloister | normal | 10 | 38 | 58 | 12 | 10 | 6 | 12 | 3 | | 101 | 153 | 821 | 11 |
| 11 | cloister | warden | 11 | 38 | 50 | 10 | 10 | 6 | 10 | 2 | | 88 + W | 161 | 970 | 13 |
| 12 | cloister | normal | 12 | 40 | 66 | 14 | 12 | 8 | 14 | 4 | | 118 | 184 | 1140 | 14 |
| 13 | cloister | normal | 13 | 40 | 72 | 16 | 14 | 9 | 16 | 4 | | 131 | 205 | 1330 | 15 |
| 14 | cloister | boss | 14 | bebas | 30 (tetesan) | | | | | | | 30 + B | 70 | 1395 | 15 |
| 15 | vineyard | normal | 15 | 40 | 70 | 14 | 12 | 9 | 14 | 4 | 6 | 129 | 211 | 1590 | 16 |
| 16 | vineyard | normal | 16 | 40 | 76 | 16 | 14 | 10 | 16 | 5 | 8 | 145 | 241 | 1813 | 18 |
| 17 | vineyard | warden | 17 | 40 | 66 | 14 | 12 | 9 | 14 | 4 | 6 | 125 + W | 232 | 2028 | 19 |
| 18 | vineyard | normal | 18 | 40 | 82 | 18 | 16 | 12 | 18 | 5 | 10 | 161 | 273 | 2281 | 20 |
| 19 | vineyard | normal | 19 | 40 | 90 | 20 | 18 | 14 | 20 | 6 | 12 | 180 | 310 | 2568 | 21 |
| 20 | vineyard | boss | 20 | bebas | 30 (tetesan) | | | | | | | 30 + B | 30 | 2596 | 21 |

Glint mentah di baris Warden sudah termasuk 25 Glint Warden. Baris boss non-final termasuk 40 Glint boss. Mote dari summoner tidak menjatuhkan Glint dan tidak dihitung di kolom Total.

### 3.5 Hitungan waktu run

- Tingkat A: Pulse berwaktu 283 s, boss sekitar 75 s, toko 9 x sekitar 20 s = sekitar 9 menit. Prototipe M1 (`run_a_m1`): Pulse berwaktu 328 s, tanpa boss.
- Tingkat C: Pulse berwaktu 582 s, 3 boss sekitar 225 s, toko 19 x sekitar 20 s = sekitar 20 menit. Bila playtest menunjukkan lebih dari 20 menit, potong Pulse 15 sampai 19 menjadi 36 s.

### 3.6 Urutan dalam satu tick

Urutan tetap (deterministik): command, timer Pulse (bila mencapai 0, proses akhir Pulse dan lewati kombat tick itu), gerak dan serangan pemain, kematian Unlit (termasuk boss), lalu damage ke pemain. Akibatnya akhir Pulse dan kematian boss final menang atas kematian pemain di tick yang sama. Seed run dipilih app tiap run dan ditampilkan kecil di layar akhir run untuk laporan bug.

---

## 4. Ekonomi Glint

### 4.1 Sumber Glint

| Sumber | Nilai | Tk |
|---|---|---|
| swarmer | 1 | A |
| charger | 2 | A |
| shooter | 2 | A |
| tank | 5 | A |
| exploder | 1 | B |
| summoner | 3 | B |
| mote | 0 (mencegah farming) | B |
| lobber | 3 | C |
| Warden | 25 (5 butir x 5 di lantai; mati di waktu tambahan: dipungut 100%) | A |
| boss non-final | 40 (8 butir x 5) | C |
| Tithe Coin (senjata) | +1 per kill oleh koin, maksimal 5 + 5 x tier per Pulse | B |
| Memento dan sinergi Trade | lihat bagian 9 dan 10 | B |

Nilai drop tidak diskalakan dengan threat. Pendapatan naik karena jumlah musuh naik (tabel 3.4); harga naik 8% per threat.

Satu Unlit menjatuhkan satu butir bernilai kolom `glint` (tank = 1 butir bernilai 5). `on_pickup` dipicu per butir. Unlit yang mati oleh ledakan exploder tetap menjatuhkan Glint.

**Glint dan XP:** XP hanya bertambah dari Glint yang masuk lewat pungutan butir: pungutan biasa, pengganda Magpie Tin, pungutan otomatis akhir Pulse dan boss, butir dari Lucky Button dan Tithe Coin. Glint langsung (bunga Trade, Ledger Page, hasil jual, pengganti peti kosong) tidak memberi XP.

### 4.2 Memungut

- Radius pungut dasar 1.6 u. Glint di dalam radius tertarik dan terbang ke pemain dengan kecepatan 12 u/s; butir yang sudah tertarik tetap terbang sampai terpungut, pada jarak radius pemain + 0.2 u.
- Glint bertahan di lantai sampai akhir Pulse. Posisi jatuh dijepit minimal 0.5 u di dalam batas arena.
- **Batas butir (menjaga nilai):** bila butir di lantai (yang belum tertarik) akan melebihi `glint_floor_cap` (150), atau pool pickup penuh, nilai Glint baru ditambahkan ke butir lantai terdekat dari titik jatuhnya (seri: slot terkecil). Tidak ada nilai yang hilang dan tidak ada entitas baru. Butir bernilai 5 atau lebih boleh tampil lebih besar (AD).
- Akhir Pulse: 50% nilai sisa dipungut otomatis (Crack 5: 25%).

### 4.3 Harga

`harga = round(harga_dasar x (1 + 0.08 x (t - 1)) x pengali_crack x pengali_memento)`. t = threat Pulse yang baru selesai. `round` = setengah ke atas.

| Jenis | Plain / Tier I | Fine / Tier II | Rare / Tier III | Fabled / Tier IV |
|---|---|---|---|---|
| Memento | 14 | 28 | 50 | 85 |
| Senjata | 16 | 34 | 70 | 130 |

Contoh harga Memento Plain/Fine/Rare/Fabled: t1 14/28/50/85, t5 18/37/66/112, t10 24/48/86/146, t19 34/68/122/207.

Contoh daya beli (dari model GD): setelah Pulse 1 sekitar 24 Glint (1 Memento Plain atau 1 senjata Tier I). Setelah Pulse 9 sekitar 170 Glint (1 Rare plus 1 Fine plus 2 reroll). Rata-rata 2 sampai 3 pembelian per toko.

### 4.4 Reroll, kunci, jual, gabung

| Aturan | Nilai |
|---|---|
| Biaya reroll | `1 + ceil(t / 2)` untuk reroll pertama di toko itu, +1 setiap reroll berikutnya. Reset tiap toko. Contoh t1: 2, 3, 4. t10: 6, 7, 8 |
| Kunci (gembok) | Gratis. Kartu terkunci tidak ikut reroll dan bertahan ke toko berikutnya. Harga dihitung ulang dengan threat baru |
| Jual senjata | `floor(0.4 x harga_dasar_tier x (1 + 0.08 x (t - 1)))`, tanpa pengali Crack dan Memento. Boleh untuk senjata apa saja termasuk senjata awal, kecuali senjata terakhir (minimal 1 senjata). Hitungan tag turun seketika. Memento tidak bisa dijual |
| Gabung (merge, tampil "Fuse") | Gratis, manual lewat tombol Fuse (`shop.merge`): 2 senjata dengan id dan tier sama (di bawah IV) menjadi 1 senjata tier berikutnya. Hasil menempati slot berindeks terkecil dari keduanya |
| Beli salinan | Bila ada slot kosong, salinan menempati slot baru dan **tidak** otomatis bergabung. Bila slot penuh dan ada salinan id dan tier sama, beli langsung menggabung. Bila slot penuh tanpa salinan, beli ditolak ("No free slot") |
| Tanpa rantai | Satu beli atau satu Fuse = satu langkah tier. Tier IV tidak bisa digabung; salinan tier IV menempati slot baru |
| Slot senjata | 6 (grid 3 x 2 di ui-spec). Memento tanpa batas slot |

Alasan merge manual saat slot masih kosong: dua salinan tier I menembak dua kali (DPS sekitar 2.0 x) sedangkan tier II sekitar 1.6 x tetapi menghemat slot dan menuju perilaku tier IV. Itu keputusan build yang nyata, bukan langkah otomatis.

### 4.5 Bunga

Tidak ada bunga di dasar permainan. Menyimpan Glint adalah gaya main yang dibuka oleh tag Trade (Trade 2 memberi bunga, Trade 6 mengubah Glint simpanan menjadi damage). Alasan: menjaga keputusan dasar sederhana, dan membuat Trade terasa sebagai build, bukan pajak wajib.

---

## 5. Stat pemain dan rumus

### 5.1 Daftar stat

| Stat (id) | Dasar | Batas | Arti |
|---|---|---|---|
| `max_hp` | 30 (beda per kelas) | min 1 | HP maksimum |
| `hp_regen` | 0 HP/s | | Pulih per detik, kontinu |
| `armor` | 0 | min -10 | Mengurangi damage diterima (rumus 5.3) |
| `dodge` | 0% | maks 60% | Peluang mengabaikan satu hit |
| `move_speed` | bonus 0% (dasar fisik 4.5 u/s di `config.csv`) | bonus -50% sampai +80% | Kecepatan gerak = 4.5 x (1 + bonus / 100) |
| `damage_pct` | 0% | min -50% | Bonus damage global |
| `attack_speed_pct` | 0% | min -50% | Mempercepat cooldown senjata |
| `crit_chance` | 5% | maks 100% | Peluang kritikal |
| `crit_mult` | 1.5 | | Pengali damage kritikal |
| `area_pct` | 0% | maks +100% | Pengali radius efek area |
| `range_pct` | 0% | min -50%, maks +100% | Jangkauan senjata |
| `projectiles` | 0 | maks +4 | Proyektil tambahan untuk senjata proyektil |
| `pierce` | 0 | maks +5 | Tembus tambahan untuk proyektil |
| `pickup_radius_pct` | 0% (dasar 1.6 u) | maks +200% | Radius pungut Glint |
| `luck` | 0 | min 0 | Menggeser rarity (bagian 13) |
| `leech` | 0% | maks 30% | Peluang tiap hit non-proc memulihkan 1 HP (maks 6 HP/s; semua batas heal per detik dihitung per sumber per detik sim) |
| `rite_haste` | 0% | maks 50% | Mengurangi cooldown Rite |
| `burn_max_stacks` | 1 | maks 5 | Tumpukan Burn maksimum per Unlit |
| `barrier_max` | 0 | maks 3 | Muatan Barrier maksimum (aksi `gain_barrier` selalu boleh mengisi minimal 1) |
| `barrier_recharge` | 0 s (tidak mengisi ulang) | min 4 s | Waktu isi ulang 1 muatan Barrier bila di bawah maksimum |
| `rite_charges` | 1 | maks 2 | Jumlah muatan Rite |

Waktu kebal setelah terkena damage: 0.5 s. Setelah dodge atau Barrier menyerap: 0.2 s (mencegah satu kontak atau kerumunan menghabiskan semua gulir dan muatan dalam beberapa tick). Radius tubuh pemain untuk tumbukan: 0.35 u. HP disimpan pecahan; pemain mati saat HP 0 atau kurang; HUD membulatkan HP ke atas.

**Gerak pemain:** kecepatan langsung tanpa akselerasi, vektor input dinormalisasi. Arah input = arah di layar. Kecepatan layar vertikal = `player_vertical_screen_ratio` (0.8, kalibrasi 0.75 sampai 0.85) kali horizontal, sesuai CD K7 dan rumus architecture 7.1. Akibatnya kecepatan lantai vertikal sekitar 5.76 u/s (4.5 x 0.8 x 1.6). Hanya gerak input pemain (jalan dan dash Rite) yang dikompensasi; jangkauan, area, proyektil, telegraf, dan Unlit tetap jujur di lantai. Pemain dan semua Unlit saling tembus (tumpang tindih = kontak); batas arena dan rintangan padat untuk keduanya; Unlit saling memisah dengan dorongan lembut.

### 5.2 Damage keluar (pemain ke Unlit)

```
hit = dasar x pengali_tier x (1 + Σbonus) x (1 + Σrentan) x (crit ? crit_mult : 1)
akhir = max(hit x 0.25, hit - guard)
```

- `dasar`: damage dasar senjata, atau damage proc (lihat di bawah).
- `Σbonus`: jumlah semua bonus damage aditif: `damage_pct`, bonus tag, bonus bersyarat Memento (misalnya "+30% ke Unlit dekat"). Semua dijumlah lalu dikali sekali.
- `Σrentan`: jumlah semua kerentanan target: Mark (+20%), Kindling Jar (+20% bila terbakar), dan sejenisnya.
- `guard`: pengurang datar milik tank, Warden tertentu, dan boss. Hit kecil tetap memberi minimal 25%. Ini membuat build hit besar (Edge) dan build banyak hit (Shard) punya lawan yang berbeda. Guard berlaku pada semua hit kecuali tick Burn; `execute` mengabaikan guard.
- Damage disimpan sebagai pecahan di simulasi; angka di layar dibulatkan.

**Damage proc** (Rite, efek Memento, sinergi, kecuali bila disebut berasal dari hit):
`dasar_proc = nilai_data x proc_scale(t)`, dengan `proc_scale(t) = 1 + 0.2 x (t - 1)`. Lalu masuk rumus di atas dengan pengali_tier 1. Alasan: Memento dibeli sekali tapi harus tetap relevan sampai Pulse 20.

**Kritikal:** digulir per hit, termasuk hit proc dan Rite, dengan `crit_chance` pemain. Damage-over-time (Burn) tidak bisa kritikal. Efek `on_crit` dari hit proc hanya jalan bila efek itu `allow_proc=1` (effect-primitives 6.2).

**Cooldown senjata:** `cd = cd_dasar x pengali_cd_tier / (1 + attack_speed_pct / 100)`, minimum 0.1 s.

**Area:** `radius = radius_dasar x (1 + area_pct / 100)`.

**Jangkauan:** `jangkauan = dasar x (1 + range_pct / 100)`. Untuk senjata jarak dekat (Arc Blade) efeknya setengah.

**Proyektil tambahan:** disebar dalam kipas dengan jarak 12 derajat.

### 5.3 Damage masuk (Unlit ke pemain)

```
hit = damage_dasar_musuh x dm(t) x pengali_crack
1. Gulir dodge: peluang = min(dodge, 60%). Lolos -> tidak ada damage (pemicu on_dodge).
2. Barrier: bila ada muatan, satu muatan habis dan hit diserap penuh (pemicu on_block).
3. Armor: damage = max(1, hit x pengali_armor)
   armor >= 0: pengali_armor = 15 / (15 + armor)     (armor 5 = -25%, armor 15 = -50%, armor 45 = -75%)
   armor < 0:  pengali_armor = 1 + (-armor) / 15
   Pengurangan maksimum 85%.
4. Kebal 0.5 s (pemicu on_hurt).
```

Hit yang datang saat pemain kebal diabaikan sebelum langkah 1 (tidak memicu `on_dodge` atau `on_block`). Barrier yang menyerap memberi kebal 0.2 s. Proyektil musuh hancur saat menyentuh pemain dalam semua kasus (kena, di-dodge, diserap, atau saat kebal). Slow dari `tar_trail` bukan hit dan tetap berlaku saat kebal.

`dm(t) = 1 + 0.07 x (t - 1)` (t20 = 2.33).

**Damage kontak:** tiap tick, bila pemain tidak kebal dan bertumpuk dengan minimal satu Unlit yang tidak dalam masa tenggang spawn, pemain menerima satu hit dengan `contact_dmg` terbesar di antara yang bertumpuk (seri: slot terkecil). Dengan kebal 0.5 s, laju maksimal 2 hit kontak per detik dari kerumunan. Charger yang sedang menerjang memakai `attack_dmg` sebagai damage kontak, maksimal sekali per terjang.

### 5.4 Status

| Status | Efek | Tumpuk | Catatan |
|---|---|---|---|
| Burn | Tiap tumpukan memberi DPS selama 3 s, tick tiap 0.5 s sejak aplikasi pertama, mengabaikan guard, tidak kritikal. DPS dari hit = 30% `hit` sesudah Σbonus dan Σrentan, sebelum crit dan guard. DPS dari sumber non-hit (zona Flare, bara, nova Flame 6) = 2 x `proc_scale(t)` (`burn_dps_nonhit`). Tick hanya dikali pengali `status_rule` (pasif `lantern` x1.3) | Sampai `burn_max_stacks` (dasar 1). Aplikasi baru menambah tumpukan bila di bawah maks; bila penuh, tumpukan terlemah diganti bila yang baru lebih kuat. Tiap aplikasi menyegarkan durasi semua tumpukan target ke 3 s | Visual: api kaca biru kecil di atas Unlit (`kept-cyan` dan `kept-white`, style guide 1.3 versi 1.1), bukan emas, agar tidak dikira Glint |
| Slow | Kecepatan Unlit -X% | Tidak, ambil yang terkuat | Durasi dari sumber |
| Mark | Target menerima +20% damage (masuk Σrentan) | Tidak | 4 s kecuali disebut lain |
| Knockback | Dorong X u menjauh, dikali (1 - kb_resist), disebar selama 0.1 s (`knockback_s`) | | Tidak membatalkan ancang-ancang. Unlit yang sedang menerjang kebal. Dijepit batas dan rintangan |

Status hanya diberikan pemain ke Unlit. Unlit tidak memberi status ke pemain kecuali `tar_trail` (Slow pada pemain, zona terlihat).

### 5.5 Skala musuh

`hp(t) = 1 + 0.12 x (t - 1) + 0.006 x (t - 1)^2` (t1 = 1.00, t5 = 1.58, t10 = 2.57, t15 = 3.86, t20 = 5.45).
Damage musuh memakai `dm(t)`. Kecepatan musuh tidak diskalakan threat (keterbacaan); hanya Crack 4 yang menambah kecepatan.

### 5.6 Komposisi stat

Stat final pemain = dasar (`stats.csv`, `max_hp` dari kelas), lalu `+ Σadd` (stat kelas, kartu level-up, `stat_mod add`, buff), lalu `x Π mult`, lalu `min` (nilai terkecil bukan nol), lalu dijepit min dan max `stats.csv`, lalu `convert` dari nilai sumber yang sudah dijepit, lalu target `convert` dijepit ulang. Definisi lengkap: effect-primitives 6.5. Stat persen disimpan sebagai poin persen. Kartu `max_hp` juga menambah HP sekarang sebesar nilainya.

---

## 6. Senjata (skill auto-attack)

Semua senjata menyerang otomatis, membidik Unlit terdekat dalam jangkauan kecuali disebut lain (seri: slot terkecil). 6 slot. Tier I sampai IV sama dengan rarity Plain sampai Fabled.

Aturan tembak: cooldown turun sampai 0 lalu menunggu; senjata menembak di tick pertama ada Unlit dalam jangkauan (tidak menembak ke udara). Jangkauan = jarak akuisisi sekaligus jarak tempuh maksimum proyektil. Salinan senjata yang sama membidik sendiri-sendiri. Cooldown semua senjata siap di awal Pulse. Proyektil pemain dan musuh tidak dihalangi rintangan; proyektil hilang saat jangkauannya habis atau keluar dari batas arena yang diperlebar `projectileMargin` (3 u).

### 6.1 Daftar senjata

| id | Nama kerja | Tag | Peran | Tk | Dmg | CD (s) | Jangkauan (u) | Perilaku tier I |
|---|---|---|---|---|---|---|---|---|
| `lantern_bolt` | Lantern Bolt | Flame | AoE lambat, starter kelas `lantern` | A | 8 tumbukan + 6 ledakan | 1.3 | 6.5 | Bola api 8 u/s, meledak radius 1.3 u, memberi Burn |
| `splinter_shot` | Splinter Shot | Shard | DPS satu target yang andal | A | 6 | 0.7 | 7 | Serpih 14 u/s, pierce 0 |
| `arc_blade` | Arc Blade | Edge | Ledakan jarak dekat, starter kelas `blade` | A | 14 | 1.15 | 2.2 | Sapuan busur 120 derajat ke arah musuh terdekat, knockback 0.6 u |
| `orbit_shards` | Orbit Shards | Shard, Ward | Pertahanan zona | A | 5 per kontak | (kontak ulang 0.5 s per target) | radius orbit 1.8 | 2 serpih mengorbit, 1 putaran per 1.6 s |
| `chain_spark` | Chain Spark | Echo, Flame | Banyak target | A | 8 | 1.3 | 6 | Petir lompat 3 kali (jarak lompat 2.8 u), tiap hit 20% Burn |
| `returning_glaive` | Returning Glaive | Edge, Echo | Tembus garis | A | 9 | 1.8 | 6 | Bilah terbang 9 u/s lalu kembali, tembus semua, kena sekali saat pergi dan sekali saat pulang |
| `echo_bell` | Echo Bell | Echo, Ward | Kontrol kerumunan, starter kelas `bell` | B | 7 | 2.2 | radius 2.6 | Cincin di sekitar pemain, knockback 1.0 u, gema setelah 0.5 s dengan 50% damage |
| `tithe_coin` | Tithe Coin | Trade, Shard | Ekonomi plus damage | B | 7 | 0.9 | 6 | Koin 12 u/s. Kill oleh koin menjatuhkan +1 Glint (batas per Pulse 5 + 5 x tier) |

Jumlah senjata per tag: Flame 2, Shard 3, Edge 2, Echo 3, Ward 2, Trade 1.

Catatan nama: "Tithe Coin" memakai kata Coin yang tidak dipakai di game (CD 2.1); Writer memberi nama final, id `tithe_coin` tetap.

**Lantern Bolt, dua damage:** tumbukan 8 ke Unlit pertama yang disentuh (jenis `projectile`), lalu ledakan 6 radius 1.3 u ke semua Unlit di radius termasuk target tumbukan (jenis `area`, memicu `on_area`). Burn berasal dari ledakan. Bila tidak kena apa pun, meledak di akhir jangkauan. Satu tembakan bisa memicu dua `on_hit` pada target yang sama.

Radius tumbukan proyektil pemain 0.15 u (`player_shot_radius`), boleh dioverride per senjata (`proj_radius`).

### 6.2 Tier dan merge

Pengali umum:

| Tier | Rarity | Pengali damage | Pengali CD | Cara dapat |
|---|---|---|---|---|
| I | Plain | 1.0 | 1.00 | Toko, awal kelas |
| II | Fine | 1.5 | 0.95 | Gabung 2 x I, atau toko |
| III | Rare | 2.2 | 0.90 | Gabung 2 x II, atau toko |
| IV | Fabled | 3.2 | 0.85 | Gabung 2 x III, atau toko (jarang) |

Bonus khusus per senjata (kumulatif). Tier IV selalu menambah perilaku baru, bukan hanya angka (Pilar 1):

| Senjata | Tier II | Tier III | Tier IV (perilaku baru) |
|---|---|---|---|
| Lantern Bolt | radius +0.15 u | radius +0.3 u | Ledakan meninggalkan zona api 1.5 u selama 2 s |
| Splinter Shot | | pierce +1 | Tiap tembakan ke-3 menjadi kipas 3 serpih |
| Arc Blade | | busur 160 derajat | Tiap sapuan ke-3 berputar 360 derajat |
| Orbit Shards | 3 serpih | 4 serpih | Tiap 4 s serpih melesat keluar 4 u lalu kembali ke orbit |
| Chain Spark | 4 lompatan | 5 lompatan | 7 lompatan, boleh kembali ke target pertama |
| Returning Glaive | | kecepatan +20% | Melempar 2 bilah ke arah berlawanan |
| Echo Bell | | radius 3.0 u | Bergema dua kali |
| Tithe Coin | | | Koin memantul ke 1 target lagi, kill memberi +2 Glint |

Bonus tier ditulis sebagai parameter senjata di `weapon_tiers.csv` (kolom `params`), karena tiap senjata sudah punya kode arketipe sendiri. Kolom `effects` tersedia bila sebuah tier perlu efek primitif tambahan.

Aturan merge, beli salinan, dan jual: bagian 4.4.

### 6.3 Stat yang berlaku per arketipe

| Stat | Berlaku ke | Catatan |
|---|---|---|
| `projectiles` | `projectile`, `bolt_explode`, `boomerang`, `coin` | Tidak ke `arc`, `orbit`, `chain`, `ring_echo` |
| `pierce` | `projectile`, `coin` | |
| `area_pct` | ledakan, busur Arc Blade, radius orbit Orbit Shards, cincin Echo Bell, zona | |
| `range_pct` | jarak akuisisi dan tempuh | Arc Blade setengah efek |
| `attack_speed_pct` | cooldown semua senjata | Orbit Shards: memperpendek kontak ulang 0.5 s, bukan mempercepat putaran |

Jenis sumber (`kind`) Orbit Shards = `melee`.

---

## 7. Kelas dan Rite

Setiap kelas beda senjata awal, Rite, pasif, dan stat awal (kriteria tolak Pilar 1). Nama tampil final disetujui CD (Lamplighter, Chorister, Vintner); id di bawah tidak bergantung pada nama.

| id | Nama tampil | Tk | Aksen | Tag kelas | Senjata awal | HP | Modifier stat | Pasif |
|---|---|---|---|---|---|---|---|---|
| `lantern` | Lamplighter | A | emas | Flame | `lantern_bolt` | 30 | area +10% | Damage Burn +30% |
| `bell` | Chorister | B | biru | Echo | `echo_bell` | 32 | armor +1, rite_haste +10% | Unlit yang terkena knockback dari pemain diberi Mark 2 s |
| `blade` | Vintner | B | cyan | Edge | `arc_blade` | 38 | armor +2, move_speed +5%, range -15% | Kill dalam 2.5 u memulihkan 1 HP (maks 3 HP/s) |

Tag kelas memberi bobot x1.5 untuk item bertag sama di toko (bagian 12).

### 7.1 Rite

Rite siap di awal setiap Pulse dengan semua muatan penuh. Muatan diisi ulang satu per satu; timer isi ulang berjalan selama muatan di bawah maksimum. Input Rite di luar fase `pulse` diabaikan. Titik bidik dari `InputFrame.aimX/aimY` (mouse: kursor di lantai; gamepad: posisi pemain + arah gerak x 4 u). Damage Rite adalah damage proc (memakai `proc_scale`) dan boleh kritikal, tetapi Rite bukan proc untuk mesin efek.

- Flare: jatuh di titik bidik, dijepit maks 6 u dari pemain dan 0.5 u di dalam batas.
- Glass Step: ke arah titik bidik (bila titik bidik sama dengan posisi pemain: arah hadap). Jarak memakai faktor kompensasi vertikal yang sama dengan gerak. Berhenti di batas dan rintangan, menembus Unlit, damage sekali per Unlit yang dilewati. "3 hit berikutnya" = 3 hit senjata non-proc berikutnya dalam 2.5 s. Jarak dash ikut dihitung `on_distance`.

| Rite id | Kelas | CD (s) | Efek | Telegraf atau umpan balik |
|---|---|---|---|---|
| `flare_lantern` | lantern | 12 | Lempar lentera ke kursor (maks 6 u, mendarat 0.35 s). Ledakan 3 u, 20 dmg proc, Burn. Meninggalkan zona api 3 u selama 4 s: Unlit di dalam terkena Burn tiap 0.5 s dan Slow 30% | Lingkaran target emas di lantai saat lentera terbang |
| `great_toll` | bell | 11 | Cincin raksasa 4.5 u di sekitar pemain, 25 dmg proc, knockback 2.5 u, Slow 50% 2 s | Gelombang cincin cyan |
| `glass_step` | blade | 5 | Lari kilat 4.5 u dalam 0.18 s ke arah kursor, kebal 0.35 s, 15 dmg proc ke Unlit yang dilewati, 3 hit berikutnya dalam 2.5 s pasti kritikal | Bayangan kaca tertinggal di jalur |

Rite terasa sebagai tombol penyelamat (Toll, Step) atau alat ofensif terencana (Flare). Ketiganya punya cooldown pendek agar dipakai sering, bukan disimpan.

---

## 8. Tag sinergi

### 8.1 Cara hitung

- Jumlah tag = jumlah **id berbeda** senjata dan Memento milik pemain yang membawa tag itu. Gabung tidak mengubah hitungan; menumpuk Memento yang sama tidak menambah hitungan. Alasan: mendorong keragaman (Pilar 1) dan menghindari insentif aneh untuk tidak menggabung.
- Senjata awal ikut dihitung. Tag kelas tidak menambah hitungan (hanya bobot toko). Tag di luar tingkat build tidak dihitung.
- Hitungan berubah seketika saat beli dan jual di toko, sehingga ambang aktif atau nonaktif terlihat di UI sebelum Pulse.
- Ambang 2, 4, 6. Efek kumulatif (ambang 4 juga punya efek ambang 2).
- Setiap ambang harus terlihat atau terdengar di arena (P1-e).

### 8.2 Efek ambang

| Tag | Tk | 2 | 4 | 6 | Gaya main yang dibuka |
|---|---|---|---|---|---|
| Flame | A | Semua hit +10% peluang Burn (senjata non-Flame ikut membakar) | Unlit yang mati saat terbakar meledak: 1.5 u, 6 dmg proc, menyebar Burn | Unlit terbakar terkena Mark. Tiap 6 s nova api 4 u dari pemain membakar semua Unlit di dalamnya | Bakar lalu biarkan api menjalar; bermain di tengah kerumunan |
| Shard | A | Kill oleh proyektil memecah 2 serpih kecil (40% damage hit) | Proyektil Shard pecah menjadi 3 fragmen (40%) saat habis jangkauan atau habis tembus | Tiap 2 s, Glass Lance (garis tembus, 25 dmg proc) menembak Unlit dengan HP tertinggi di layar | Layar penuh serpih, tetap punya jawaban untuk tank dan Warden |
| Edge | A | Hit dalam 2.5 u +25% damage dan knockback 0.5 u | Kritikal melepaskan gelombang tebasan lurus (3 u, tembus, 50% damage hit) | Tiap kritikal memberi 1 tumpukan Rush (+5% attack speed, +3% gerak, 3 s, maks 10). Pada 10 tumpukan pemain berkilau emas | Berani dekat, kejar kritikal |
| Echo | B | Serangan area berulang sekali setelah 0.5 s dengan 35% damage | Rite dirapal ulang 1 s kemudian dengan 50% kekuatan | Tiap 8 s semua senjata langsung menembak sekali lagi | Ritme: semua terjadi dua kali |
| Ward | B | Barrier: 1 muatan menyerap 1 hit, isi ulang 14 s | barrier_max +1, isi ulang 10 s | +2% damage per poin armor. Selama Barrier aktif, attack speed +20% | Pertahanan yang berubah menjadi serangan |
| Trade | B | Bunga: di awal toko +1 Glint per 8 Glint tersimpan (maks 12) | Reroll pertama tiap toko gratis. Toko menampilkan 5 kartu | +1% damage per 10 Glint tersimpan (maks +50%). Radius pungut +50% | Menabung sebagai senjata |

Tingkat A memakai Flame, Shard, Edge. Tingkat B dan C memakai keenamnya.

Distribusi tag di pool penuh (senjata + Memento, id berbeda): Flame 9, Shard 9, Edge 9, Echo 10, Ward 9, Trade 7. Setiap tag punya minimal 7 item, jadi ambang 6 bisa dicapai tetapi butuh komitmen. Di Tingkat A tiap tag punya 6 sampai 7 item, jadi ambang 6 adalah puncak langka.

---

## 9. Memento

Aturan:
- Memento tanpa batas slot, tidak bisa dijual.
- `Tumpuk` = jumlah salinan maksimum. Memento unik (1) hilang dari pool setelah dimiliki. Tumpukan menambah nilai stat atau peluang per salinan.
- Setiap Memento punya minimal 1 tag (P1-b).
- Efek ditulis sebagai rangkaian efek primitif (bagian 10). Kolom "Primitif" adalah ringkasan; definisi lengkap di `effects.csv`.
- Kolom "Datar" = efek stat tanpa syarat (dihitung untuk kuota P1-a).

| # | id | Nama kerja | Tag | Rarity | Tumpuk | Tk | Efek (teks pendek) | Primitif | Datar |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `coal_locket` | Coal Locket | Flame | Plain | 3 | A | Hit 8% peluang Burn | on_hit, chance 0.08: apply_status burn | |
| 2 | `kindling_jar` | Kindling Jar | Flame | Fine | 1 | A | Unlit terbakar menerima +20% damage | on_hit, target_has_status burn: hit_mod vuln +0.2 | |
| 3 | `torch_glove` | Torch Glove | Flame, Edge | Fine | 1 | A | Hit senjata Edge selalu Burn | on_hit, source_tag edge: apply_status burn | |
| 4 | `ashen_crown` | Ashen Crown (nama kerja, kata terlarang; nama final WR) | Flame | Fabled | 1 | A | Burn menumpuk sampai 3 | passive: stat_mod burn_max_stacks +2 | |
| 5 | `smolder_boots` | Smolder Boots | Flame | Plain | 1 | A | Tiap 3 u berjalan, jatuhkan bara (1 u, 2 s) yang membakar | on_distance 3: spawn_zone burn | |
| 6 | `glass_marble` | Glass Marble | Shard | Plain | 2 | A | Proyektil pierce +1 | passive: stat_mod pierce +1 | Ya |
| 7 | `prism_lens` | Prism Lens | Shard | Rare | 1 | A | Tiap proyektil ke-5 pecah jadi 3 saat kena (40%) | on_hit, source_kind projectile, every_nth 5: spawn_projectile split 3 | |
| 8 | `shard_pouch` | Shard Pouch | Shard | Fabled | 1 | A | Senjata proyektil +1 proyektil | passive: stat_mod projectiles +1 | Ya |
| 9 | `splinter_comb` | Splinter Comb | Shard, Edge | Fine | 1 | A | Kritikal menembak serpih ke Unlit lain (50%) | on_crit: spawn_projectile seek_other | |
| 10 | `whetstone` | Whetstone | Edge | Plain | 3 | A | Crit +5% | passive: stat_mod crit_chance +5 | Ya |
| 11 | `duelist_ribbon` | Duelist Ribbon | Edge | Fine | 1 | A | Hit ke Unlit ber-HP penuh +50% damage | on_hit, target_hp_full: hit_mod bonus +0.5 | |
| 12 | `headsman_hook` | Headsman Hook | Edge | Rare | 1 | A | Hit membunuh Unlit biasa di bawah 12% HP | on_hit, target_is normal, target_hp_below 0.12: execute | |
| 13 | `tuning_fork` | Tuning Fork | Echo | Fine | 1 | B | Serangan area memberi Slow 30% 1.5 s | on_hit, source_kind area: apply_status slow | |
| 14 | `rite_chime` | Rite Chime | Echo, Ward | Fine | 1 | B | Rite memberi 1 Barrier dan +25% attack speed 4 s | on_rite: gain_barrier 1, buff attack_speed_pct | |
| 15 | `iron_thimble` | Iron Thimble | Ward | Plain | 5 | B | Armor +3 | passive: stat_mod armor +3 | Ya |
| 16 | `glass_aegis` | Glass Aegis | Ward | Rare | 1 | B | 1 Barrier di awal Pulse. Barrier pecah melepas gelombang 3 u (10 dmg proc) | on_pulse_start: gain_barrier 1; on_block: spawn_area | |
| 17 | `collector_pin` | Collector Pin | Trade, Ward | Fine | 1 | B | Memungut Glint memulihkan 1 HP (maks 4 HP/s) | on_pickup, icd 0.25: heal 1 | |
| 18 | `dust_hourglass` | Dust Hourglass | Shard, Trade | Fine | 1 | B | Memungut Glint 15% peluang menembak serpih (6 dmg proc) | on_pickup, chance 0.15: spawn_projectile aimed | |
| 19 | `lucky_button` | Lucky Button | Trade, Edge | Rare | 1 | B | Kill kritikal menjatuhkan +1 Glint | on_kill, killed_by_crit: gain_glint drop 1 | |
| 20 | `magpie_tin` | Magpie Tin | Trade | Plain | 3 | B | Pungutan Glint 15% peluang bernilai ganda | on_pickup, chance 0.15: gain_glint same | Ya |
| 21 | `haggler_seal` | Haggler Seal | Trade | Fine | 1 | B | Harga -10%, reroll -1 (min 1) | passive: shop_mod price_mult 0.9, reroll_delta -1 | Ya |
| 22 | `grinding_wheel` | Grinding Wheel | Edge, Echo | Rare | 1 | B | Tiap hit ke-4 tiap senjata pasti kritikal | on_hit, every_nth 4 per_weapon: hit_mod force_crit | |
| 23 | `pyre_bell` | Pyre Bell | Flame, Echo | Rare | 1 | C | Tick Burn 10% peluang melompat ke Unlit terdekat (2.5 u) | status_rule burn spread_chance 0.1 | |
| 24 | `wick_charm` | Wick Charm | Flame, Ward | Fine | 1 | C | Saat terluka, cincin api 3 u (10 dmg proc, Burn), jeda 3 s | on_hurt, icd 3: spawn_area burn | |
| 25 | `cracked_mirror` | Cracked Mirror | Shard, Ward | Rare | 1 | C | Saat dodge atau Barrier menyerap, tembak 8 serpih melingkar (6 dmg proc) | on_dodge dan on_block: spawn_projectile ring 8 | |
| 26 | `music_box` | Music Box | Echo | Rare | 1 | C | Kill 10% peluang mengulang hit pembunuh ke Unlit terdekat (4 u) | on_kill, chance 0.1: repeat hit | |
| 27 | `folded_letter` | Folded Letter | Echo | Plain | 3 | C | Cooldown Rite -10% | passive: stat_mod rite_haste +10 | Ya |
| 28 | `echo_shell` | Echo Shell | Echo | Fabled | 1 | C | Rite punya 2 muatan | passive: stat_mod rite_charges +1 | |
| 29 | `patched_cloak` | Patched Cloak | Ward | Fine | 1 | C | Setelah 4 s tanpa terluka, pulih 2 HP/s | passive, time_since_hurt 4: stat_mod hp_regen +2 | |
| 30 | `ledger_page` | Ledger Page | Trade | Rare | 1 | C | Menyelesaikan Pulse tanpa terluka memberi 10 + 3 x t Glint | on_pulse_end, unhurt_this_pulse: gain_glint | |

Ringkasan:
- Per tingkat: A 12 (nomor 1 sampai 12), B +10 (13 sampai 22) = 22, C +8 = 30.
- Rarity penuh: Plain 7, Fine 11, Rare 9, Fabled 3. Rarity A: Plain 4, Fine 4, Rare 2, Fabled 2.
- Tag di Memento: Flame 7, Shard 6, Edge 7, Echo 7, Ward 7, Trade 6.
- Tag di Tingkat A (senjata + Memento): Flame 2 + 5 = 7, Shard 2 + 4 = 6, Edge 2 + 5 = 7.

---

## 10. Efek primitif (ringkasan)

Semua efek Memento, sinergi, dan pasif kelas dirakit dari satu set primitif. Tidak ada logika unik per item. Definisi lengkap, parameter, urutan evaluasi, dan pengaman rekursi ada di `docs/systems/effect-primitives.md`.

Satu efek = **pemicu** + **syarat** (nol atau lebih) + **peluang dan jeda internal** + **aksi** + **parameter**.

| Kelompok | Daftar |
|---|---|
| Pemicu (16) | `passive`, `on_hit`, `on_crit`, `on_kill`, `on_hurt`, `on_block`, `on_dodge`, `on_pickup`, `on_rite`, `on_area`, `on_projectile_end`, `periodic`, `on_distance`, `on_pulse_start`, `on_pulse_end`, `on_shop_start` |
| Syarat (15) | `source_tag`, `source_kind`, `source_weapon`, `target_has_status`, `target_within`, `target_hp_below`, `target_hp_full`, `target_is`, `every_nth`, `player_hp_below`, `time_since_hurt`, `has_barrier`, `held_glint_at_least`, `killed_by_crit`, `unhurt_this_pulse` |
| Aksi (16) | `stat_mod`, `buff`, `hit_mod`, `apply_status`, `status_rule`, `spawn_projectile`, `spawn_area`, `spawn_zone`, `execute`, `heal`, `gain_barrier`, `gain_glint`, `repeat`, `trigger_weapons`, `shop_mod`, `convert` |

Contoh: Flame 4 = `on_kill` + `target_has_status burn` + `spawn_area(radius 1.5, dmg 6, status burn)` dengan `allow_proc=1`, sehingga api menjalar paling banyak dua langkah.

Aturan rantai (effect-primitives 6.2): setiap hit dan kill membawa kedalaman. Hit senjata, Rite, dan kontak = 0; damage dari efek dan tick Burn = proc. Kill oleh tick Burn hanya memicu `on_kill` yang `allow_proc=1`. Kill oleh `execute` dihitung sebagai kill oleh hit pemicunya. Kematian Unlit oleh ledakan exploder tidak memicu `on_kill` (bukan damage pemain), tetapi tetap menjatuhkan Glint. Trade 6 = `passive` + `convert(from held_glint, to damage_pct, ratio 0.1, cap 50)` dan `stat_mod pickup_radius_pct +50`.

---

## 11. Level-up

### 11.1 Kurva XP

XP untuk naik dari level L ke L+1: `15 + 10 x L` (25, 35, 45, ...). Total XP ke level 10: 585. Target: sekitar 1 level per Pulse (tabel 3.4: level 12 di akhir Tingkat A, level 21 di akhir Tingkat C).

### 11.2 Kartu

Di fase `levelUp` (panel "Temper", subjudul "Lv n"), untuk setiap level yang didapat: pilih 1 dari 3 kartu stat. Kartu tiap level digulir saat layarnya tampil (sesudah pilihan sebelumnya diterapkan), dengan threat Pulse yang baru selesai dan luck saat itu (aliran `levelUp`). 3 kartu selalu stat berbeda; stat yang sudah di batas maks tidak ditawarkan. Kartu `max_hp` juga menambah HP sekarang. Tanpa reroll dan tanpa skip; level tertunda tidak bisa disimpan (sesuai ui-spec). Rarity kartu digulir dengan tabel rarity bagian 13.

| Kartu (stat) | Plain | Fine | Rare | Fabled |
|---|---|---|---|---|
| `max_hp` | +4 | +7 | +11 | +16 |
| `hp_regen` (HP/s) | +0.2 | +0.35 | +0.55 | +0.8 |
| `armor` | +1 | +2 | +3 | +5 |
| `dodge` (%) | +2 | +4 | +6 | +9 |
| `move_speed` (%) | +3 | +5 | +8 | +12 |
| `damage_pct` (%) | +5 | +8 | +12 | +18 |
| `attack_speed_pct` (%) | +4 | +7 | +11 | +16 |
| `crit_chance` (%) | +2 | +4 | +6 | +9 |
| `area_pct` (%) | +5 | +9 | +13 | +19 |
| `range_pct` (%) | +5 | +9 | +13 | +19 |
| `pickup_radius_pct` (%) | +10 | +18 | +27 | +40 |
| `luck` | +4 | +8 | +12 | +18 |
| `leech` (%) | +1 | +2 | +3 | +5 |
| `rite_haste` (%) | +4 | +7 | +10 | +14 |

Kartu level-up memang stat datar; ia di luar pool toko sehingga tidak masuk kuota P1-a. Kedalaman build datang dari toko dan sinergi.

---

## 12. Toko (the Glazier)

Urutan fase: `reward` (bila ada) -> `levelUp` -> `shop`. Toko tanpa batas waktu (keputusan GD, disetujui CD K5, selaras ui-spec): ketegangan datang dari Glint yang terbatas, bukan dari jam. Alasan tambahan: aksesibilitas dan pemain kasual browser. Pengaman: uji P4-f milik CD (median waktu toko 25 s atau kurang di playtest M2).

| Aturan | Nilai |
|---|---|
| Kartu tawaran | 4 (5 dengan Trade 4) |
| Jenis per kartu | Senjata 35%, Memento 65% |
| Rarity per kartu | Tabel bagian 13 |
| Bobot tag kelas | Item dengan tag kelas x1.5 |
| Bobot tag dimiliki | Item yang berbagi tag dengan build (jumlah tag minimal 1) x1.25 |
| Dorongan merge | Bila pemain punya senjata tier di bawah IV, 15% kartu senjata menjadi salinan senjata milik pemain dengan tier yang sama |
| Pengecualian | Memento unik yang dimiliki dan Memento yang sudah tumpukan penuh tidak muncul. Konten di luar tingkat build dan konten terkunci meta tidak muncul. Tidak ada id ganda dalam satu set tawaran, termasuk kartu terkunci |
| Slot penuh | Kartu senjata tetap bisa muncul saat slot penuh tanpa kemungkinan merge; beli ditolak dan UI menampilkan "No free slot" |
| Bobot gabungan | Bobot tag kelas dan tag dimiliki dikalikan (maks x1.875). Dorongan merge memilih seragam di antara senjata milik pemain dengan tier di bawah IV |
| Pool rarity kosong | Turun satu rarity; bila Plain juga kosong, naik |
| Slot terbeli | Tampil "Taken" dan kosong sampai reroll atau toko berikutnya. Reroll dan toko berikutnya mengisi semua slot tak terkunci. Kartu terkunci yang menjadi tidak sah (Memento unik sudah didapat dari peti, tumpukan penuh) diganti saat toko dibuka |
| Beli | 1 klik pada harga, atau angka slot (P4-c) |
| Kunci, reroll, jual, gabung | Bagian 4.4 |

Bobot tag dimiliki membantu sinergi terbentuk tanpa memaksa satu build. P1-c (tidak ada tag dominan di lebih dari 40% run bot) adalah pengamannya; bila gagal, turunkan pengali ini lebih dulu.

---

## 13. Rarity loot (Plain, Fine, Rare, Fabled)

Rarity dipakai di tiga tempat: Memento (rarity tetap per item), senjata (rarity = tier), kartu level-up (rarity = besar nilai).

### 13.1 Bobot dasar per threat

| Threat | Plain | Fine | Rare | Fabled |
|---|---|---|---|---|
| 1 sampai 3 | 78 | 20 | 2 | 0 |
| 4 sampai 6 | 60 | 30 | 9 | 1 |
| 7 sampai 10 | 45 | 35 | 16 | 4 |
| 11 sampai 14 | 32 | 38 | 23 | 7 |
| 15 sampai 20 | 22 | 38 | 30 | 10 |

Luck: bobot Fine, Rare, Fabled dikali `(1 + luck / 100)`, Plain tetap. Gulir rarity dulu, lalu item dari pool rarity itu. Bila pool rarity itu kosong, turun satu rarity; bila Plain juga kosong, naik. Untuk senjata, rarity yang digulir menjadi tier tawaran.

### 13.2 Peti hadiah

| Sumber | Isi | Aturan rarity |
|---|---|---|
| Warden | Pilih 1 dari 3 Memento (wajib pilih 1, tanpa id ganda). Memento sah kurang dari 3: tampilkan yang ada; 0: ganti 25 Glint langsung | Bobot Plain = 0 (minimal Fine) |
| Boss non-final (C) | Pilih 1 dari 3 Memento | Bobot Plain dan Fine = 0 (minimal Rare) |

[Asumsi, M3 bila perlu] Pengaman nasib buruk: bila 3 toko berturut-turut pada t6 ke atas tanpa tawaran Rare atau lebih tinggi, toko berikutnya menjamin 1 tawaran Rare+.

---

## 14. Musuh (the Unlit)

### 14.1 Aturan telegraf (Pilar 2, P2-e)

| Jenis serangan | Telegraf minimum | Bentuk |
|---|---|---|
| Kontak biasa | Tidak perlu | Badan musuh adalah tandanya |
| Proyektil | 0.4 s | Inti musuh menyala magenta |
| Terjang | 0.6 s | Mata dan outline berkedip merah plus garis arah |
| Area (ledakan, lemparan, hantaman) | 0.8 s | Isian merah tumbuh dari tengah ke tepi (style guide 1.8) |
| Serangan besar boss | 1.0 s | Isian merah atau penanda jalur |

Telegraf tidak pernah dipendekkan oleh threat, Crack, atau affix. Tingkat kesulitan menambah jumlah dan kecepatan, bukan mengurangi waktu membaca.

### 14.2 Daftar Unlit

Angka HP dan damage pada threat 1 (dikali `hp(t)` dan `dm(t)`).

| id | Peran | Tk | HP | Gerak (u/s) | Kontak | Serangan | Glint | Guard | Tahan knockback | Perilaku dan telegraf |
|---|---|---|---|---|---|---|---|---|---|---|
| `swarmer` | Perenang massal | A | 6 | 2.6 | 3 | | 1 | 0 | 0 | Mengejar lurus dengan sedikit liuk, saling menjaga jarak. Datang berkelompok 3 sampai 6 |
| `charger` | Penerjang | A | 16 | 2.0 | 3 | Terjang 6 | 2 | 0 | 0.2 | Dalam 6 u: ancang-ancang 0.6 s (kedip merah plus garis arah), terjang 10 u/s selama 0.45 s (4.5 u), pulih 0.8 s, jeda 3 s |
| `shooter` | Penembak | A | 10 | 1.7 | 2 | Proyektil 4 | 2 | 0 | 0 | Menjaga jarak 5 sampai 7 u. Ancang-ancang 0.4 s (inti menyala), 1 proyektil 5.5 u/s ke posisi pemain, umur 2.5 s, jeda 2.8 s |
| `tank` | Tank | A | 60 | 1.2 | 7 | | 5 | 2 | 0.8 | Mengejar pelan, menjadi tembok yang memecah jalur. Tanpa serangan khusus |
| `exploder` | Peledak | B | 8 | 3.0 | 0 | Ledakan 10 | 1 | 0 | 0 | Dalam 1.6 u: sumbu 0.8 s (kedip makin cepat, lingkaran merah tumbuh ke 1.8 u, gerak 50%). Meledak lalu mati. Ledakan juga melukai Unlit lain 20 dmg. Bila dibunuh sebelum sumbu habis: tidak meledak |
| `summoner` | Pemanggil | B | 26 | 1.4 | 2 | | 3 | 0 | 0.3 | Menjaga jarak 6 sampai 8 u. Tiap 5 s: 3 lingkaran ungu kecil 0.8 s di sekitarnya, lalu 3 mote muncul. Maks 6 mote hidup per summoner |
| `mote` | Panggilan | B | 3 | 3.3 | 2 | | 0 | 0 | 0 | Hanya dari summoner, affix `brood`, dan boss. Mengejar cepat |
| `lobber` | Artileri zona | C | 14 | 1.3 | 2 | Lemparan 7 | 3 | 0 | 0.2 | Menjaga jarak 6 sampai 9 u. Tiap 3.5 s: lingkaran 1.6 u di posisi pemain terisi selama 1.0 s, lalu mendarat |

Tingkat A: swarmer, charger, shooter, tank (satu untuk tiap sumbu: massa, ledakan arah, jarak jauh, ketahanan). Tingkat B: +exploder, summoner (6 jenis tempur + mote). Tingkat C: +lobber.

Bioma 2 dan 3 memakai set Unlit yang sama dengan palet berbeda (keputusan Producer). Statistik tidak berubah per bioma; threat yang membuatnya lebih keras.

### 14.3 Ukuran dan perilaku umum

| Kelas ukuran | Radius tumbukan (u) | Unlit |
|---|---|---|
| small | 0.3 | swarmer, mote, exploder |
| medium | 0.4 | charger, shooter, summoner, lobber |
| large | 0.6 | tank |
| warden | 0.9 | semua Warden |
| boss | 1.6 | semua boss |

Proyektil musuh berradius 0.2 u. Radius ada di `config.csv` per kelas ukuran dan boleh dioverride kolom `radius` di `enemies.csv`.

- Jarak jaga (shooter, summoner, lobber) yang jatuh di luar batas arena: Unlit berhenti di batas dan menerima jarak lebih dekat.
- Shooter membidik posisi pemain saat menembak (tanpa prediksi) dan mundur bila pemain lebih dekat dari 5 u.
- Charger mengunci arah saat ancang-ancang mulai; terjang berhenti di batas arena. Selama menerjang kebal knockback.
- Unlit menghindari rintangan dengan dorongan sederhana; rintangan tidak menghalangi proyektil (arena-design R9).
- Telegraf dan masa tenggang spawn: bagian 3.2.

---

## 15. Warden dan affix

### 15.1 Warden

Warden adalah versi besar dari peran dasar dengan pola sendiri dan affix tetap. Muncul di 25% durasi Pulse Warden.

| id | Tk | Dasar | HP (t1) | Gerak | Kontak | Pola | Affix tetap | Posisi |
|---|---|---|---|---|---|---|---|---|
| `warden_hound` | A | charger | 380 | 2.4 | 6 | 3 terjang beruntun (masing-masing ancang-ancang 0.6 s, jeda 0.4 s, dmg 10), lalu istirahat 2.5 s | `volley` | A: Pulse 5 (t5, HP sekitar 600). C: Pulse 4 (t4, sekitar 535) |
| `warden_choir` | B | shooter | 520 | 1.6 | 4 | Kipas 5 proyektil (ancang-ancang 0.4 s, dmg 5) tiap 2.4 s | `blinking`, `veiled` | B: Pulse 10 (t10, sekitar 1335). C: Pulse 11 (t11, sekitar 1455) |
| `warden_bulwark` | C | tank | 750 | 1.3 | 9 | Hantaman tiap 4 s (lingkaran 2.5 u, 0.9 s, dmg 12) | `brood`, `tar_trail` | C: Pulse 17 (t17, sekitar 3345) |

Guard Warden: hound 0, choir 0, bulwark 5. Tahan knockback semua Warden 0.9.

Hadiah Warden: 25 Glint sebagai 5 butir di lantai (bagian 4.1), lalu layar `reward` berisi peti Memento (bagian 13.2) dan +4 Silt (B dan C).

### 15.2 Affix

| id | Efek | Telegraf | Tk |
|---|---|---|---|
| `hasted` | Gerak +35% | Tidak perlu (tidak memberi damage sendiri) | A (dipakai di waktu tambahan) |
| `volley` | Setelah tiap rangkaian serangan, cincin 8 proyektil (dmg 4) | Cincin ungu menyala 0.6 s | A |
| `veiled` | Cangkang menyerap damage sebesar 20% HP maks, tumbuh ulang setelah 6 s tanpa terkena damage | Cangkang ungu terlihat | B |
| `blinking` | Tiap 6 s berpindah ke dekat pemain (tidak di atas pemain, minimal 3 u) | Lingkaran ungu di tujuan 0.8 s | B |
| `brood` | Tiap 7 s memanggil 3 mote | Lingkaran ungu 0.8 s | B |
| `tar_trail` | Meninggalkan genangan gelap 1 u selama 3 s yang memberi Slow 35% pada pemain | Zona terlihat sejak muncul | C |
| `pulsing` | Tiap 5 s gelombang kejut 3 u (dmg 8) | Cincin merah tumbuh 0.8 s | C |
| `bulwark` | Guard +4, kebal knockback | Tidak perlu | C |

Crack 2 ke atas: tiap Warden mendapat 1 affix acak tambahan dari pool tingkat build, tanpa duplikat.

---

## 16. Boss per bioma

Boss tampil dengan nama sendiri tanpa kata "boss". HP dikali `hp(t)`, damage dikali `dm(t)`. Pola berputar dalam siklus tetap dengan jeda antar pola. Boss diam selama telegraf dan eksekusi pola, bergerak hanya di jeda. Tahan knockback boss 1.0 (kebal).

Transisi fase: HP boss tidak bisa turun di bawah ambang fase sampai pola yang sedang berjalan selesai dan transisi 1.5 s lewat (cahaya berkedip, boss diam dan kebal). Jadi fase 2 tidak bisa dilewati dengan burst, dan pemain sempat membaca perubahan.

### 16.1 `boss_lantern` (bioma 1, Tk A)

HP dasar 2000 (C t7 sekitar 3880, A t10 sekitar 5140, B t15 sekitar 7720; naik dari 1600 oleh model M1-02 karena pertarungan A terlalu singkat, `docs/balance-report.md`). Guard 2. Gerak 1.0 u/s, kontak 10. Ukuran besar: Unlit lentera yang menyerap cahaya.

| Pola | Telegraf | Efek |
|---|---|---|
| Ember Rain | 5 lingkaran 1.5 u terisi 1.0 s: lingkaran pertama tepat di posisi pemain, sisanya acak dalam 3 u tanpa tumpang tindih | Tiap lingkaran dmg 10 |
| Snuff Ring | Garis cincin plus celah 60 derajat ditandai 1.0 s | Cincin tebal 0.6 u melebar 5 u/s dari boss sampai 19 u (menutup seluruh arena 32 x 20 u), dmg 9. Arah celah acak seragam (aliran `ai`). Aman hanya di celah |
| Moth Call | Tanda spawn biasa 0.8 s | 6 swarmer dari sektor tepi acak (tidak dihitung ke batas hidup) |

Fase 1 (HP di atas 50%): Ember Rain, Snuff Ring, Ember Rain, Moth Call; jeda 2.0 s.
Fase 2 (50% ke bawah): jeda 1.4 s; Ember Rain 8 lingkaran; Snuff Ring dua kali beruntun berjeda 0.8 s dengan celah berbeda minimal 90 derajat; tambah **Lantern Lanes**: 3 jalur horizontal lebar 1.2 u di posisi y lantai acak antara -9 dan 9 (jarak antar jalur minimal 3 u) ditandai 1.0 s, lalu deret proyektil berjarak 0.6 u, 8 u/s, dari sisi acak per jalur menyusuri jalur (dmg 6).

### 16.2 `boss_bell` (bioma 2, Tk C)

HP dasar 2000 (t14 sekitar 7140). Guard 3. Diam di tengah arena, berpindah dengan `blinking`.

| Pola | Telegraf | Efek |
|---|---|---|
| Toll Waves | 3 cincin konsentris dengan celah berbeda ditandai 1.0 s | Cincin berurutan, jarak 0.6 s, dmg 10 |
| Choir Spiral | Boss berputar dan inti menyala 1.0 s | Spiral proyektil 3 s, 10 tembakan/s, 4 u/s, dmg 6 |
| Bell Drop | Lingkaran 2.5 u di posisi tujuan 1.0 s | Boss berpindah dan menghantam, dmg 14 |
| Call Choir | Tanda spawn 0.8 s | 2 summoner |

Fase 2 (50%): spiral dua lengan, Toll Waves 4 cincin.

### 16.3 `boss_vine` (bioma 3, final C, Tk C)

HP dasar 2400 (t20 sekitar 13080). Guard 4. Gerak 1.4 u/s.

| Pola | Telegraf | Efek |
|---|---|---|
| Root Lines | 3 garis dari boss ke tepi arena ditandai 1.0 s | Akar meletus sepanjang garis, dmg 12 |
| Thorn Fan | Ancang-ancang 0.6 s | Kipas 9 proyektil 60 derajat, dmg 7 |
| Trample | Jalur selebar 2 u ditandai 1.0 s | Terjang menyeberang arena, dmg 14 |
| Seed Pods | Tanda spawn 0.8 s | 4 exploder |

Fase 2 (50%): Root Lines 5 garis, Thorn Fan dua kali beruntun. Crack 4 ke atas: fase 3 di 20% (Root Lines dan Thorn Fan bersamaan, jeda 1.2 s).

Hadiah boss: non-final 40 Glint, peti Memento minimal Rare, +8 Silt. Final: menang, +8 Silt, bonus menang.

---

## 17. Meta: Silt

Prinsip: Silt membuka **pilihan**, bukan stat permanen (handoff 2.3 butir 8, glossary "The Keeping"). Tk B ke atas. Tingkat A tidak punya Silt; semua konten A terbuka.

### 17.1 Pendapatan

`Silt = floor((Pulse_selesai x 1 + Warden x 4 + boss x 8 + (menang ? 10 : 0)) x (1 + 0.25 x crack))`

Pulse_selesai menghitung semua Pulse yang selesai, termasuk Pulse Warden dan boss. Silt dihitung dan diberikan sekali saat run berakhir (menang, kalah, atau Abandon; Abandon dihitung seperti mati). Run yang tidak pernah dilanjutkan setelah tab ditutup tidak memberi Silt. Tingkat A tidak menghitung Silt.

Contoh: mati di Pulse 6 Tingkat C (5 Pulse selesai, 1 Warden) = 9. Menang C di Crack 0 = 20 + 12 + 24 + 10 = 66. Menang B = 15 + 8 + 8 + 10 = 41.

### 17.2 Yang dibuka

Terbuka dari awal (B dan C): kelas `lantern`, 7 senjata (6 senjata A + `echo_bell`), 18 Memento (12 Memento A + `tuning_fork`, `rite_chime`, `iron_thimble`, `glass_aegis`, `magpie_tin`, `collector_pin`). Keenam tag terwakili sejak run pertama.

| Unlock | Biaya Silt | Tk |
|---|---|---|
| Kelas `blade` | 40 | B |
| Kelas `bell` | 60 | B |
| Senjata `tithe_coin` | 20 | B |
| Paket Memento 1: `dust_hourglass`, `lucky_button`, `haggler_seal` | 20 | B |
| Paket Memento 2: `grinding_wheel`, `pyre_bell`, `wick_charm` | 25 | B (B hanya berisi `grinding_wheel`, biaya 10) |
| Paket Memento 3: `cracked_mirror`, `music_box`, `folded_letter` | 30 | C |
| Paket Memento 4: `echo_shell`, `patched_cloak`, `ledger_page` | 40 | C |
| Crack 1 sampai 5 | Tidak dibeli: Crack n terbuka setelah menang di Crack n minus 1 | C |

Total C: 235 Silt, sekitar 6 sampai 10 run. Blade dibuka lebih murah dari Bell karena gaya dash paling mudah dipahami setelah Lamplighter.

---

## 18. Tingkat kesulitan (Crack)

"Crack" disetujui CD (langit dan the Pane makin retak). Kumulatif. Tk C.

| Crack | Tambahan | Silt |
|---|---|---|
| 0 | Dasar | x1.00 |
| 1 | HP Unlit +15% | x1.25 |
| 2 | Warden +1 affix acak. Harga +10% | x1.50 |
| 3 | Damage Unlit +20%. Jumlah spawn +15% | x1.75 |
| 4 | Gerak Unlit +10%. HP boss +25%, jeda antar pola boss -20%, `boss_vine` fase 3 | x2.00 |
| 5 | Awal Pulse hanya memulihkan 50% HP yang hilang. Glint padam di akhir Pulse naik (dipungut otomatis 25%) | x2.25 |

Tidak ada Crack yang memendekkan telegraf (14.1).

---

## 19. Target balance (untuk model dan bot M1 sampai M3)

| Metrik | Target |
|---|---|
| Mati di Pulse 1 sampai 2 (bot wajar) | Di bawah 5% |
| Menang Tingkat A, Crack 0, bot wajar | 50 sampai 65% |
| Menang run pertama manusia (A) | 25 sampai 40% |
| Waktu bunuh swarmer oleh senjata awal | 1 hit sampai t6 |
| Waktu bunuh Warden | 8 sampai 15 s |
| Durasi pertarungan boss | 45 sampai 90 s |
| Pembelian per run A | 12 sampai 18 |
| Tag dominan di run bot (P1-c) | Tidak ada tag di atas 40% run |
| Item stat datar di pool toko (P1-a) | Maksimal 30% |

Target tertulis tambahan untuk tes QA:
- Tidak ada Pulse non-boss dengan lebih dari 15% kematian bot wajar.
- Median HP tersisa di akhir Pulse turun bertahap dari sekitar 90% (Pulse 1) ke sekitar 50% (Pulse 9).
- Penanda stat datar = kolom `is_flat` di `mementos.csv`; senjata tidak pernah dihitung datar.
- Musuh puncak = `alive_cap` maksimum profil (A 90, C 120) plus 1 Warden; Pulse boss di bawah angka itu.
- Telegraf minimum = tabel 14.1 (kunci `telegraph_min_*_s`, ditegakkan validator data) plus tanda spawn 0.8 s.

Model awal GD (dipakai untuk tabel 3.4 dan harga) dipindah ke `tools/balance/` di M1 dan menghasilkan CSV.

---

## 20. Fitur minimum prototipe M1

Tujuan M1 (handoff 4.1): run 10 Pulse bisa dimainkan dari awal sampai menang atau kalah dengan art placeholder, deterministik.

| # | Fitur | Isi minimum |
|---|---|---|
| 1 | Gerak pemain | WASD, 4.5 u/s, tumbukan dengan batas arena |
| 2 | Kelas | `lantern` saja |
| 3 | Senjata | 4: `lantern_bolt`, `splinter_shot`, `arc_blade`, `orbit_shards`, tier I sampai IV dengan merge (bonus tier IV boleh menyusul di M2) |
| 4 | Rite | `flare_lantern` |
| 5 | Unlit | swarmer, charger, shooter, tank dengan telegraf placeholder |
| 6 | Spawner | Profil `run_a_m1` (bagian 2.4), 10 Pulse dari `waves.csv` dan `wave_spawns.csv`, algoritma jadwal 3.2, tanda spawn 0.8 s, masa tenggang 0.3 s, batas hidup dan antrean, arena `arena_proto` |
| 7 | Pulse 5 dan 10 | Pulse normal pengganti Warden dan boss sesuai tabel 2.4 (Pulse 10 = 45 s, `final` = 1). Warden dan boss masuk M2 |
| 8 | Glint | Drop, pungut, radius, padam 50% di akhir Pulse, XP |
| 9 | Level-up | Kurva XP, 14 kartu, pilih 1 dari 3 di fase `levelUp` sebelum toko |
| 10 | Toko | 4 kartu, beli, reroll berbiaya naik, kunci, jual, Fuse manual dan merge otomatis saat slot penuh, 6 slot |
| 11 | Memento | 6 untuk menguji mesin efek: `coal_locket` (on_hit + apply_status), `kindling_jar` (hit_mod), `glass_marble` (stat_mod), `splinter_comb` (on_crit + spawn_projectile), `smolder_boots` (on_distance + spawn_zone), `headsman_hook` (execute) |
| 12 | Sinergi | Penghitung tag dan ambang 2 untuk Flame, Shard, Edge |
| 13 | Stat dan rumus | Semua rumus bagian 5 (damage, crit, armor, dodge, Burn, kebal) |
| 14 | Akhir run | Menang setelah Pulse 10, kalah saat HP 0, layar ringkas |
| 15 | Determinisme | Seed dan input sama menghasilkan hasil sama (tes) |
| 16 | Data | Semua angka dari CSV (`data-schema.md`), tidak ada angka balance di kode |

Di luar M1: Warden, boss, affix, Silt, Crack, kelas lain, bioma lain, Echo/Ward/Trade.

---

## 21. Cek pilar

| Uji | Hasil di GDD |
|---|---|
| P1-a | Pool toko penuh: 8 senjata + 30 Memento = 38 item, stat datar 7 (18%). Pool A: 6 senjata + 12 Memento = 18 item, stat datar 3 (17%). Lolos (batas 30%). Penghitungan konservatif: pierce dan proyektil dihitung datar walau terlihat di arena |
| P1-b | 100% senjata dan Memento bertag (tabel 6.1 dan 9) |
| P1-e | Setiap ambang sinergi punya hasil yang terlihat (nova, fragmen, tebasan, gema, Barrier, kilau emas) |
| Kelas | Beda senjata awal, Rite, pasif, dan stat |
| P2-e | Telegraf minimum 14.1, tidak pernah dipendekkan |
| P4-b | Semua nama kerja maksimal 3 kata dan 18 karakter; teks efek final ditulis Writer dalam 2 baris |
| P4-c | Beli 1 input, tanpa menu bertingkat |
| Kode warna | Burn dan efek pemain memakai warna sisi pemain; telegraf dan status musuh memakai warna bahaya (AD memutuskan detail) |

## 22. Ketergantungan ke peran lain

- **LD:** arena 32 x 20 u final dan 8 sektor spawn (arena-design 4 dan 5). Semua rintangan `blocks: ["move"]` (tidak menghalangi proyektil). Arena bioma 2 dan 3.
- **Writer:** nama final semua item, kelas, Rite, Unlit, Warden, boss, Crack, dan teks efek 2 baris dari kolom "Efek".
- **AD:** visual Burn (api kaca biru, bukan emas), Mark, Slow, Barrier, zona api, telegraf boss, butir Glint besar (nilai 5 atau lebih). Warna mengikuti style guide 1.3.
- **UI:** panel tag (3 tag di A, 6 di B dan C), bar HP boss, bar HP Warden "Held" saat waktu tambahan, kartu 5 dengan Trade 4, tombol Fuse, "No free slot".
- **AU:** tekanan musik aktif saat Unlit hidup minimal 60% `alive_cap` Pulse itu, lepas di bawah 50% (`music_pressure_frac`, `music_pressure_release_frac`); sim memancarkan event saat ambang dilewati.
- **LP:** urutan evaluasi efek, `procDepth`, dan komposisi stat (effect-primitives.md), RNG per aliran, aturan batas 150 butir Glint yang menjaga nilai, kompensasi gerak vertikal dari `player_vertical_screen_ratio`.
- **GP:** aturan rinci untuk sim di `docs/specs/gd-answers-m0.md`.
