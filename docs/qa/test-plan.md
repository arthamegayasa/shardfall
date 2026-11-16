# Shardfall: Rencana Tes

Pemilik: QA Lead. Reviewer: Producer. Status: draf M0 (versi 1, 2026-11-16).
Dokumen terkait: `docs/pillars.md` (uji pilar), `docs/style-guide.md` (kode warna, kontras, teks), `docs/qa/accessibility.md`, `docs/qa/bugs.md`, `docs/tech/architecture.md` (milik LP, belum ada saat dokumen ini ditulis).

Penanda: **[Asumsi]** perlu dikonfirmasi pemilik wilayah lain. **[Usul ke LP]** butuh dukungan arsitektur atau kode.

---

## 1. Prinsip

1. Uji build yang sebenarnya. Membaca kode bukan bukti. Setiap putusan LOLOS butuh bukti nyata: log perintah, screenshot, file hasil, atau hash.
2. Tes tidak dilemahkan agar lulus. Ambang hanya berubah lewat keputusan tertulis pemilik angka (GD untuk balance, LP untuk anggaran performa, CD untuk pilar) dan dicatat di laporan.
3. Angka balance hanya dari file data. Tes membaca data, tidak menyalin angka ke kode tes, kecuali fixture kecil khusus tes yang diberi nama `fixture`.
4. Setiap bug BLOCKER atau MAYOR yang diperbaiki mendapat tes regresi yang menyebut id bug di nama tes (contoh `it('BUG-012: glint not lost on merge', ...)`).
5. Bila sebuah kriteria tidak bisa diuji, putusannya TIDAK DIUJI, bukan LOLOS. TIDAK DIUJI dihitung GAGAL untuk kriteria keluar milestone kecuali Producer mengecualikannya secara tertulis.

## 2. Lingkungan uji

### 2.1 Mesin yang tersedia (dicek 2026-11-16)

| Item | Nilai |
|---|---|
| OS | Windows 11 |
| CPU | AMD Ryzen 7 5800H |
| GPU | NVIDIA RTX 3060 Laptop (diskret) dan AMD Radeon terintegrasi |
| RAM | 28 GB |
| Layar | 2560x1440, 144 Hz |
| Node, npm | Node 24, npm 11 |
| Playwright | 1.65.1 (lewat `npx`, belum terpasang sebagai dependensi proyek) |

Mesin ini lebih kuat dari "laptop kelas menengah". Karena itu uji performa memakai profil emulasi (bagian 9.2).

### 2.2 Browser

| Browser | Status di mesin ini | Cara pakai di Playwright | Keterbatasan |
|---|---|---|---|
| Chromium (build Playwright) | Ada di cache Playwright | project `chromium` | Headless memakai render perangkat lunak (SwiftShader) bila GPU tidak dipakai, sehingga angka fps headless tidak sah |
| Google Chrome 157 | Terpasang | `channel: 'chrome'` | Tidak ada |
| Microsoft Edge 157 | Terpasang | `channel: 'msedge'` | Tidak ada |
| Firefox 143 | Terpasang di sistem | Tidak bisa dipakai Playwright (Playwright butuh build Firefox khususnya) | Build Firefox Playwright tidak ada di cache. Sampai terpasang, Firefox diuji manual dengan checklist smoke (bagian 11) |
| WebKit (build Playwright) | Ada di cache (`webkit-2336`), versi belum tentu cocok dengan Playwright yang akan dipasang LP | project `webkit` | Hanya pendekatan Safari, bukan Safari asli |
| Safari asli | Tidak tersedia (butuh macOS) | Tidak bisa | Kriteria M4 "lolos di Safari" tidak bisa diverifikasi penuh. Lihat pertanyaan terbuka |

Memasang build Firefox Playwright (`npx playwright install firefox`) mengunduh dari CDN Playwright, bukan npm registry. [Asumsi] Ini butuh izin Producer karena aturan jaringan.

## 3. Lapisan tes

| Lapisan | Alat | Lokasi [Usul ke LP] | Kapan jalan | Target waktu |
|---|---|---|---|---|
| Unit sim dan logika | Vitest (env node) | `tests/unit/` | Setiap perubahan, `npm test` | di bawah 30 detik |
| Validasi data | Vitest | `tests/data/` | Setiap perubahan data atau string | di bawah 10 detik |
| Determinisme | Vitest (env node) | `tests/sim/determinism.test.ts` | Setiap perubahan sim | di bawah 60 detik |
| Bot run penuh headless | Vitest atau skrip Node | `tests/sim/bot/` | Setiap milestone, dan sebelum laporan QA | di bawah 5 menit untuk 20 seed |
| Audit aset (kode warna, skala) | Vitest | `tests/assets/` | Setiap perubahan art | di bawah 30 detik |
| End-to-end dan screenshot | Playwright | `tests/e2e/` | Sebelum laporan QA dan sebelum push milestone | di bawah 10 menit |
| Performa | Playwright headed + hook tes | `tests/perf/` | M2, M3, M4, M5 | sekitar 5 menit per profil |
| Manual dan playtest | Checklist di dokumen ini | `docs/qa/` | Per milestone | sesuai kebutuhan |

Perintah npm yang diusulkan [Usul ke LP, LP pemilik `package.json`]: `test`, `test:det`, `test:bot`, `test:assets`, `test:e2e`, `test:perf`, `qa:report`. Semua harus keluar dengan kode 0 bila lulus dan bukan 0 bila gagal.

Hasil sementara (screenshot mentah, CSV bot, trace) masuk `tests/out/` yang di-gitignore. Bukti yang dipakai di laporan disalin ke `docs/qa/evidence/<milestone>/`.

## 4. Unit test (Vitest)

### 4.1 Aturan
- Kode simulasi diuji tanpa three.js, DOM, Web Audio, atau `window`. Bila sebuah tes sim butuh salah satunya, itu tanda kebocoran lapisan dan dilaporkan ke LP.
- Tes sim memakai seed eksplisit. Tidak ada tes yang bergantung waktu nyata.
- Satu file tes per modul sim. Nama `*.test.ts`.
- Cakupan baris kode sim target minimal 80% [Asumsi]. Butuh `@vitest/coverage-v8`, yang merupakan dependensi baru; LP memutuskan. Bila tidak dipasang, cakupan dinilai lewat daftar perilaku di 4.2.

### 4.2 Perilaku yang wajib punya tes

| Area | Contoh perilaku yang diuji |
|---|---|
| RNG | Seed sama menghasilkan urutan sama; cabang RNG terpisah (spawn, drop, toko) tidak saling memengaruhi; RNG bot dan audio terpisah dari RNG sim |
| Tick tetap | Satu tick memajukan waktu tepat 1/60 detik [Asumsi tick 60/detik]; akumulator frame tidak pernah menjalankan tick parsial |
| Gerak dan tabrakan | Pemain tidak keluar batas arena; kecepatan diagonal tidak lebih cepat dari lurus; dorongan musuh tidak menembus dinding |
| Serangan otomatis | Senjata memilih target sesuai aturan GDD; cooldown dihormati; proyektil hilang di batas arena |
| Damage | Rumus damage, kritikal, armor sesuai GDD dan data; HP tidak pernah negatif di state; kematian tepat saat HP 0 |
| Rite | Tidak bisa dipakai saat cooldown; cooldown mulai saat dipakai |
| Spawn Pulse | Jadwal spawn mengikuti data; jumlah musuh tidak melewati batas entitas; Pulse berakhir tepat di waktunya |
| Glint | Drop sesuai data; pungut menambah mata uang dan XP sekaligus; Glint di lantai saat Pulse berakhir ditangani sesuai GDD |
| Level-up | Ambang XP dari data; tiap level memberi satu pilihan kartu di awal toko |
| Toko (the Glazier) | Harga dari data; beli mengurangi Glint dengan tepat; tidak bisa beli bila Glint kurang; reroll menaikkan harga sesuai data; merge dua item sejenis menaikkan tier |
| Sinergi tag | Ambang tag aktif tepat di jumlah yang ditentukan data; melepas item menonaktifkan efek |
| Warden dan boss | Muncul di Pulse yang ditentukan data; hadiah Warden berupa pilihan Keepsake |
| Akhir run | Menang setelah Pulse terakhir; kalah saat HP 0; Silt dihitung sesuai data |
| Save dan load | Serialisasi state lalu deserialisasi menghasilkan hash identik; versi save lama ditolak dengan pesan, tidak crash |
| Input | Pemetaan tombol ke aksi memakai tabel remap; aksi yang sama dari dua tombol berbeda menghasilkan state sama |

### 4.3 Validasi data dan teks

| ID | Cek | Lolos bila |
|---|---|---|
| DV-1 | Skema setiap file `content/data/*` | Semua kolom wajib ada, tipe benar, tidak ada id ganda, semua rujukan id valid |
| DV-2 | Tag item (P1-b) | 100% senjata dan Keepsake punya minimal 1 tag dari daftar tag resmi |
| DV-3 | Batas teks (P4-b, style guide 4.2) | Nama maksimal 3 kata dan 18 karakter; efek maksimal 2 baris dan sekitar 40 karakter per baris; flavor 1 baris maksimal 70 karakter |
| DV-4 | Kata terlarang (style guide 4.3) | Nol kecocokan pada daftar kata terlarang di string table, tidak peka huruf besar kecil |
| DV-5 | Em dash | Nol karakter em dash di string table dan di `docs/` |
| DV-6 | String hardcode | Semua teks UI diambil dari string table; cek: tidak ada literal huruf di komponen UI selain id string [Usul ke LP: aturan lint] |
| DV-7 | Rasio item stat datar (P1-a) | Item yang ditandai stat datar paling banyak 30% pool toko; butuh kolom penanda di data [Asumsi, GD] |

## 5. Tes determinisme

### 5.1 Definisi
- **Hash state:** fungsi `hashState(state)` yang menserialisasi seluruh state sim dengan urutan kunci tetap, lalu menghitung hash 32 bit atau 64 bit (misalnya FNV-1a). Bilangan float dimasukkan lewat representasi bit-nya, bukan teks berpembulatan. [Usul ke LP]
- **Rekaman input (replay):** file JSON berisi versi format, versi data, seed, kelas, dan daftar input per tick. Input gerak dikuantisasi (misalnya arah 8 mata angin atau vektor dibulatkan) agar rekaman kecil dan bebas float acak. Aksi toko dan level-up dicatat dengan tick dan id pilihan.
- **Checkpoint:** hash dicatat tiap 60 tick, sehingga bila hasil beda, tick pertama yang menyimpang langsung diketahui.

### 5.2 Sumber nondeterminisme yang dilarang di kode sim
`Math.random`, `Date.now`, `performance.now`, `new Date`, timer (`setTimeout`, `setInterval`), urutan iterasi objek dengan kunci campuran, dan bergantung pada frame rate render. Cek otomatis lewat aturan ESLint `no-restricted-globals` dan `no-restricted-properties` pada folder sim [Usul ke LP], ditambah tes D-6.

Catatan: fungsi seperti `Math.sin`, `Math.exp`, `Math.pow` tidak dijamin identik antar mesin JavaScript. Determinisme dijamin minimal dalam satu mesin (V8: Node, Chrome, Edge). Kesamaan antar browser diuji di D-5 dan hasilnya dilaporkan, bukan diasumsikan.

### 5.3 Daftar tes

| ID | Tes | Cara uji | Lolos bila | Mulai |
|---|---|---|---|---|
| D-1 | Ulang dalam satu proses | Jalankan replay yang sama 2 kali berturut-turut dalam satu proses Vitest, N = 36.000 tick (10 menit sim) atau sampai run selesai | Semua hash checkpoint identik | M1 |
| D-2 | Ulang di proses terpisah | Jalankan replay di 2 proses Node terpisah (`node` dua kali atau dua worker) | Hash akhir identik; menangkap state global modul yang bocor | M1 |
| D-3 | Seed benar dipakai | Replay sama dengan seed berbeda | Hash akhir berbeda (sanity) | M1 |
| D-4 | Save, load, lanjut | Run A tanpa jeda. Run B: simpan di fase toko Pulse 3, buang state, muat, lanjutkan input sisa | Hash akhir A dan B identik | M2 |
| D-5 | Lintas runtime | Replay di Node lalu di Chromium lewat hook tes (`step` dan `getStateHash`) | Hash identik di Node, Chromium, Chrome, Edge. Firefox dan WebKit dicatat sebagai temuan bila berbeda | M1 (V8), M4 (semua) |
| D-6 | Bebas frame rate | Jalankan sim lewat loop render tiruan dengan dt variabel setara 30, 60, 144 fps, dan dt acak berseed | Hash akhir identik dengan run tick murni | M1 |
| D-7 | Replay emas | Simpan 3 replay di `tests/fixtures/replays/` beserta hash yang diharapkan | Hash cocok. Bila perubahan sim yang disengaja mengubah hash, replay emas diperbarui dengan alasan tertulis di laporan, bukan dihapus | M1 |
| D-8 | Rekam dari permainan nyata | Rekam input dari sesi browser (bot di browser, bagian 7), putar ulang di Node | Hash akhir identik | M1 |

## 6. Bot dan simulasi run penuh headless

### 6.1 Tujuan
1. Membuktikan run bisa selesai (menang atau kalah) tanpa crash, macet, atau state rusak.
2. Menghasilkan data balance untuk GD (kurva kesulitan, panjang run, ragam build). QA melaporkan angka, GD menentukan target dan tuning.

### 6.2 Aturan bot
- Bot hanya membaca state lewat API baca publik dan mengirim aksi lewat jalur input yang sama dengan pemain. Bot tidak menyentuh state langsung, tidak curang.
- Bot punya RNG sendiri, diturunkan dari seed run, sehingga satu pasangan (seed, jenis bot) selalu menghasilkan run yang sama. Setiap run bot bisa diputar ulang sebagai replay.
- Bot berjalan di sim headless tanpa render dengan kecepatan penuh.

### 6.3 Jenis bot

| Bot | Perilaku | Fungsi |
|---|---|---|
| `idle` | Diam, tidak membeli apa pun | Batas bawah: harus kalah sebelum Pulse terakhir. Bila menang, game terlalu mudah |
| `dodger` | Arah gerak = jumlah vektor tolak dari musuh dan proyektil dalam radius tertentu, ditambah tolak dari dinding; bila aman, bergerak ke Glint terdekat; pakai Rite bila jumlah musuh dalam radius melewati ambang | Bot dasar untuk uji selesai dan balance |
| `dodger+random` | `dodger` di arena, di toko membeli item acak yang terjangkau, memilih kartu level-up acak, reroll dengan peluang tetap | Bot utama uji run penuh dan P1-c |
| `dodger+focus` (M3) | Seperti di atas, tapi bobot pilihan condong ke satu tag yang dipilih acak di awal | Membandingkan kekuatan tiap tag |

Angka radius, ambang, dan peluang reroll bot disimpan di file konfigurasi bot `tests/sim/bot/bot-config.json`, bukan di data game.

### 6.4 Tes bot

| ID | Tes | Cara uji | Lolos bila | Mulai |
|---|---|---|---|---|
| B-1 | Run selesai | 20 seed x bot `dodger+random` | 20 dari 20 run berakhir menang atau kalah sebelum batas tick (jumlah Pulse x durasi Pulse maksimal x 60, ditambah waktu toko), tanpa exception | M1 |
| B-2 | Invarian state | Cek tiap 60 tick di B-1 | Tidak ada NaN atau Infinity; HP di antara 0 dan maks; Glint tidak negatif; jumlah entitas di bawah batas LP; tidak ada entitas di luar arena | M1 |
| B-3 | Bot diam kalah | 10 seed x bot `idle` | Tidak ada yang menang | M1 |
| B-4 | Kecepatan sim | Ukur waktu B-1 | Sim headless minimal 20 kali lebih cepat dari waktu nyata [Asumsi], agar 50 run muat dalam beberapa menit | M1 |
| B-5 | Laporan balance | 50 seed per kelas, keluarkan CSV | CSV lengkap terbit; perbandingan dengan target GD dilaporkan. Lolos atau gagal kurva ditentukan terhadap target tertulis GD | M3 (versi awal M1) |
| B-6 | Ragam build (P1-c) | 50 run `dodger+random` | Tidak ada satu tag yang menjadi tag dominan di lebih dari 40% run | M3 |
| B-7 | Matriks konten | Tiap kombinasi kelas x bioma, 5 seed | Semua run selesai tanpa exception | M3 |

Kolom CSV balance: `seed, bot, class, biome, outcome, pulse_reached, sim_seconds, glint_earned, glint_spent, level, items, dominant_tag, damage_taken_per_pulse, cause_of_death`.

## 7. End-to-end Playwright

### 7.1 Konfigurasi [Usul ke LP]
- Uji build produksi lewat `vite preview`, bukan server dev. Server dijalankan oleh opsi `webServer` Playwright sehingga otomatis mati setelah tes (aturan agent 11).
- Project default: `chromium`. Project tambahan: `chrome` (`channel: 'chrome'`), `msedge` (`channel: 'msedge'`), `webkit` (bila build cocok), `firefox` (bila build terpasang).
- Resolusi: 1920x1080 (utama), 1280x720, 1366x768.
- Setiap tes gagal bila ada `console.error`, `pageerror`, atau request gagal.
- Trace dan video hanya disimpan saat gagal.

### 7.2 Hook tes [Usul ke LP]
Objek `window.__SHARDFALL_TEST__` hanya ada di build tes (misalnya flag build `VITE_TEST_HOOKS=1`) dan tidak pernah ada di build rilis (dicek di M5-03). Fungsi minimal:

| Fungsi | Guna |
|---|---|
| `setSeed(seed)`, `startRun(classId, biomeId)` | Run yang bisa diulang |
| `pause()`, `resume()`, `step(ticks)`, `setTimeScale(x)` | Membekukan atau mempercepat sim untuk screenshot dan tes cepat |
| `getStateHash()`, `getSnapshot()` | Determinisme dan pengecekan state (posisi pemain, musuh, proyektil, layar aktif, Glint, HP, tick) |
| `getScreenPositions()` | Koordinat layar pemain, ancaman terdekat, proyektil musuh, untuk uji 1 detik dan kontras |
| `loadReplay(json)`, `exportReplay()` | Putar dan rekam input |
| `getPerf()` | Frame time per frame (rolling 600 frame), waktu tick sim, jumlah draw call, jumlah entitas |
| `goToScreen(id)` | Lompat ke layar tertentu untuk screenshot |
| `spawnStress(presetId)` | Memuat skenario arena paling ramai |
| `grantItem(id)` | Memberi item untuk uji konten |

Selama LP belum menulis `docs/tech/architecture.md`, tabel ini adalah usulan. Bila LP memakai nama lain, rencana ini mengikuti LP.

### 7.3 Skenario

| ID | Skenario | Lolos bila | Mulai |
|---|---|---|---|
| E-01 | Boot | Layar judul tampil dalam 5 detik di `vite preview`, nol error konsol, WebGL2 aktif | M1 |
| E-02 | Mulai run | Judul ke pilih kelas ke Pulse 1 hanya dengan keyboard | M1 |
| E-03 | HUD | Snapshot dan screenshot menunjukkan HP, waktu Pulse, Glint, cooldown Rite (plus bar XP bila ada), dan tidak ada elemen HUD lain | M1 |
| E-04 | Gerak | Tahan tiap tombol arah 0,5 detik; posisi pemain berubah ke arah yang benar | M1 |
| E-05 | Rite | Tekan tombol Rite; snapshot menunjukkan Rite aktif dan cooldown berjalan; tekan lagi saat cooldown tidak berefek | M1 |
| E-06 | Serangan otomatis, spawn, Glint | Dalam 10 detik Pulse 1: musuh muncul, ada musuh mati, Glint muncul, Glint dipungut menambah angka HUD | M1 |
| E-07 | Akhir Pulse ke level-up ke toko | Saat waktu habis: layar level-up muncul bila naik level, lalu layar the Glazier | M1 |
| E-08 | Beli, reroll, merge | Beli satu item dengan maksimal 2 input (P4-c); reroll mengganti isi toko; merge dua item sejenis menaikkan tier | M1 |
| E-09 | Mulai Pulse berikutnya | Tombol "Begin Pulse" memulai Pulse 2 | M1 |
| E-10 | Kalah | Lewat replay atau hook, HP pemain habis; layar akhir run kalah tampil; tombol ulang memulai run baru | M1 |
| E-11 | Menang | Lewat replay emas atau `step` cepat, Pulse terakhir selesai; layar menang tampil | M1 |
| E-12 | Jeda | Esc saat Pulse, saat toko, saat level-up: tick tidak bertambah selama 2 detik; lanjut kembali normal | M1 |
| E-13 | Run penuh lewat browser | Bot `dodger+random` versi browser membaca `getSnapshot` dan menekan tombol keyboard asli lewat Playwright, dengan `setTimeScale` dipercepat, sampai run selesai | M1 |
| E-14 | Pengaturan tersimpan | Ubah volume, kualitas, kurangi efek, angka damage; muat ulang halaman; nilai tetap | M2 |
| E-15 | Autosave dan lanjut | Di toko Pulse 3, muat ulang halaman; tombol lanjut membawa ke toko yang sama dengan Glint, item, dan hash state sama | M2 |
| E-16 | Kehilangan fokus | Pindah tab (`visibilitychange`) saat Pulse; game terjeda otomatis | M2 |
| E-17 | Ubah ukuran jendela | Ubah viewport saat Pulse dari 1920x1080 ke 1280x720; skala pixel tetap integer, HUD tetap terlihat, tidak ada error | M2 |

### 7.4 Screenshot per layar
Untuk tiap milestone sejak M1, set screenshot berikut diambil di Chromium pada 1920x1080 dan 1280x720 (M4: semua browser yang tersedia):

`title`, `class-select`, `pulse-start`, `pulse-peak`, `level-up`, `glazier`, `pause`, `settings`, `run-lost`, `run-won`, lalu sejak M2: `warden-appear`, `boss`, `quality-low`, `reduce-effects`, `text-scale-max`, dan tiap mode buta warna.

- Nama file: `docs/qa/evidence/<milestone>/<screen>-<lebar>x<tinggi>-<browser>.png`.
- Seed tetap, sim dibekukan dengan `pause` di tick yang tetap agar screenshot bisa diulang.
- Perbandingan visual otomatis (`toHaveScreenshot`) hanya dipakai di mesin dan browser yang sama, karena render WebGL berbeda antar GPU. Toleransi ditulis di konfigurasi, bukan dilonggarkan diam-diam. Perbedaan dibahas dengan AD sebelum baseline diperbarui.

## 8. Uji pilar otomatis dan semi-otomatis

Analisis gambar dilakukan di dalam browser lewat canvas (`createImageBitmap` lalu `getImageData`) di dalam tes Playwright, sehingga tidak perlu dependensi baru. Alternatif `pngjs` di Node butuh izin LP.

### 8.1 Kode warna (P2-d)

| ID | Cek | Cara uji | Lolos bila | Mulai |
|---|---|---|---|---|
| CW-1 | Palet sprite dari data | Tes Vitest membaca data piksel setiap sprite. Sprite diberi kubu (pemain atau bahaya) di metadata | Sprite pemain hanya memakai warna dari himpunan pemain plus netral; sprite bahaya hanya dari himpunan bahaya plus `ink`. Toleransi 0 | M1 |
| CW-2 | Palet VFX dan partikel | Tes yang sama untuk definisi warna VFX di data atau kode | Sama dengan CW-1 | M1 |
| CW-3 | Screenshot terisolasi | Lewat hook, render hanya lapis pemain lalu hanya lapis bahaya di atas latar netral, cahaya bioma aktif | Pada lapis pemain: nol piksel dengan hue 265 sampai 15 derajat (ungu, magenta, merah) dengan saturasi di atas 50% dan nilai di atas 40%. Pada lapis bahaya: nol piksel dengan hue 40 sampai 60 derajat atau 180 sampai 230 derajat (emas, cyan, biru) dengan saturasi dan nilai yang sama. Ambang hue [Asumsi], dikalibrasi bersama AD di M1 | M2 |
| CW-4 | UI | Audit screenshot UI | Merah (`danger-red`) hanya muncul pada HP rendah dan peringatan boss; harga yang tidak terjangkau tampil abu redup | M1 |

### 8.2 Kontras terukur (P2-c)
- Ambil screenshot `pulse-peak` dengan sim dibekukan. Hook memberi koordinat layar inti proyektil musuh, sorotan pemain, dan badan Unlit.
- Sampel warna rata-rata dari 3x3 piksel layar di pusat objek (setara satu piksel sprite) dan dari cincin lantai berjarak 2 piksel sprite di sekitarnya.
- Hitung rasio kontras luminans relatif WCAG: `(L1 + 0,05) / (L2 + 0,05)`.
- Lolos bila: inti proyektil musuh vs lantai minimal 4,5:1; sorotan pemain vs lantai minimal 3,5:1; badan Unlit vs lantai minimal 2:1. Diukur di minimal 10 titik per jenis, semua titik harus lolos (nilai terendah dilaporkan).

### 8.3 Uji grayscale (P2-b)
Screenshot `pulse-peak` diubah ke luminans. Rata-rata luminans piksel pemain, lantai, dan Unlit dihitung dari mask posisi hook. Lolos bila urutan pemain > lantai > Unlit dengan selisih minimal 15 (skala 0 sampai 255) di tiap pasangan [Asumsi, dikalibrasi bersama AD], dan semua proyektil musuh tetap terdeteksi (kontras inti vs lantai lolos 8.2 setelah grayscale).

### 8.4 Skala pixel (P3-a, P3-b)
Ambil screenshot dengan sprite pemain, Unlit, Glint, dan dekorasi lantai di posisi yang diketahui. Ukur panjang blok warna seragam di tepi sprite. Lolos bila setiap blok berukuran tepat kelipatan skala yang aktif (3 piksel layar di 1080p, 2 di 720p, sesuai kalibrasi LP dan AD) dengan toleransi 0, dan tidak ada piksel warna campuran di tepi sprite (tanda filter linear atau skala non-integer).

### 8.5 DoF hanya di bingkai (P3-c)
Screenshot yang sama dengan efek ON dan OFF. Lolos bila seluruh area di dalam batas arena identik per piksel antara ON dan OFF (selain bloom pada objek emisif, yang dimask lewat hook), dan perbedaan hanya ada di pita atas sekitar 15% dan bawah sekitar 10%.

### 8.6 Urutan gambar (P2-f)
Lewat hook, posisikan proyektil musuh tepat di bawah efek pemain terbesar (ledakan atau aura). Lolos bila piksel inti proyektil musuh tetap berwarna `danger-core` (setelah cahaya, toleransi kecil) di screenshot.

## 9. Uji performa

### 9.1 Metrik
- fps rata-rata dan 1% low (persentil 99 frame time), dari `getPerf()`.
- Waktu tick sim persentil 95.
- Jumlah draw call dan entitas aktif.
- Heap JavaScript (`performance.memory` di Chromium) di awal dan akhir.
- Waktu muat sampai layar judul interaktif.
- Ukuran bundle (dari output build).

Anggaran resmi milik LP. Bila LP belum menetapkan, dipakai ambang sementara di 9.4 dan ditandai [Asumsi].

### 9.2 Profil perangkat
| Profil | Isi | Pakai untuk |
|---|---|---|
| P-REF (laptop menengah, emulasi) | Browser dipaksa ke GPU terintegrasi AMD Radeon (pengaturan grafis Windows per aplikasi "Power saving"), throttling CPU 2x lewat CDP `Emulation.setCPUThrottlingRate`, jendela 1920x1080, kualitas default | Kriteria lolos performa |
| P-DEV | GPU diskret RTX 3060, tanpa throttling | Pembanding, tidak dipakai untuk lolos |
| P-LOW | P-REF dengan kualitas Rendah | Membuktikan kualitas rendah memberi ruang performa |

[Asumsi] P-REF adalah perkiraan laptop menengah. LP boleh mengganti definisinya. Layar 144 Hz: fps dibatasi rAF pada laju layar, jadi ambang dihitung terhadap frame time 16,7 ms, dan laju layar dicatat di laporan.

### 9.3 Skenario "arena paling ramai"
- `spawnStress('peak')`: jumlah musuh puncak dari data Pulse terakhir (GD), ditambah build pemain akhir run dengan proyektil terbanyak, Warden atau boss aktif, semua efek ON.
- Alternatif yang lebih jujur: replay bot di tick dengan jumlah entitas tertinggi dari data B-5.
- Browser dijalankan headed dengan GPU (bukan headless), pemanasan 5 detik, pengukuran 30 detik.

### 9.4 Tes performa

| ID | Tes | Lolos bila [Asumsi bila LP belum menetapkan] | Mulai |
|---|---|---|---|
| PF-1 | fps arena paling ramai, P-REF | Rata-rata minimal 55 fps dan 1% low minimal 40 fps | M2 |
| PF-2 | fps arena paling ramai, P-LOW | Rata-rata minimal 60 fps (atau laju layar) dan 1% low minimal 50 fps | M2 |
| PF-3 | Waktu tick sim | Persentil 95 di bawah 4 ms di P-REF | M2 |
| PF-4 | Waktu muat | Layar judul interaktif dalam 5 detik dari `vite preview` lokal dengan cache kosong | M2 |
| PF-5 | Kebocoran memori | 3 run berturut-turut dengan bot browser; heap di awal run ke-3 tidak lebih dari 20% di atas awal run ke-1 setelah garbage collection | M4 |
| PF-6 | Ukuran bundle | Sesuai anggaran LP | M4 |

Catatan: angka fps dari Chromium headless (render perangkat lunak) tidak pernah dipakai sebagai bukti performa.

## 10. Uji keterbacaan screenshot 1 detik (P2-a)

### 10.1 Pengambilan gambar
1. Jalankan 5 seed berbeda dengan bot browser. Untuk tiap seed, bekukan sim di tick dengan jumlah musuh tertinggi di Pulse paling ramai.
2. Simpan screenshot 1920x1080 dan jawaban benar dari hook: koordinat pemain dan koordinat ancaman terdekat (musuh atau proyektil musuh terdekat ke pemain, atau telegraf yang sedang aktif bila ada).

### 10.2 Penguji dan prosedur
- Penguji manusia (Dok atau orang lain yang belum melihat build) adalah standar. Penguji melihat tiap gambar selama 1 detik di penampil sederhana (`tests/manual/glance.html` [Usul], gambar tampil 1000 ms lalu diganti layar kosong), lalu mengklik posisi pemain dan ancaman terdekat di layar kosong.
- Bila manusia tidak tersedia (M1, M2), dipakai penguji proksi: subagent baru yang belum pernah melihat build, diberi gambar yang diperkecil ke 480x270 dan diburamkan ringan (meniru pandangan sekilas), lalu diminta memberi koordinat. Hasil proksi dicatat sebagai "proksi" dan harus dikonfirmasi penguji manusia sebelum keluar M4.

### 10.3 Lolos bila
Klik pemain jatuh dalam radius 2 kali tinggi sprite pemain di layar dari pusat pemain, dan klik ancaman jatuh dalam radius yang sama dari ancaman terdekat (atau ancaman lain yang jaraknya ke pemain paling banyak 1,2 kali jarak ancaman terdekat), pada minimal 4 dari 5 gambar. Semua klik, gambar, dan jawaban benar disimpan di `docs/qa/evidence/<milestone>/glance/`.

## 11. Kompatibilitas browser

### 11.1 Matriks
| Browser | M1 | M2 | M3 | M4 | M5 |
|---|---|---|---|---|---|
| Chromium Playwright | Otomatis penuh | Otomatis penuh | Otomatis penuh | Otomatis penuh | Otomatis penuh |
| Chrome | Smoke otomatis | Smoke otomatis | Smoke otomatis | Otomatis penuh | Otomatis penuh |
| Edge | Smoke otomatis | Smoke otomatis | Smoke otomatis | Otomatis penuh | Otomatis penuh |
| Firefox | Tidak wajib | Smoke manual | Smoke manual | Otomatis penuh bila build terpasang, bila tidak smoke manual lengkap | Sama dengan M4 |
| WebKit Playwright | Tidak wajib | Tidak wajib | Smoke otomatis bila build cocok | Otomatis penuh bila build cocok | Sama dengan M4 |
| Safari asli | Tidak bisa | Tidak bisa | Tidak bisa | TIDAK DIUJI kecuali ada Mac | Sama dengan M4 |

### 11.2 Checklist smoke per browser
1. Layar judul tampil, nol error konsol, WebGL2 tersedia.
2. Audio mulai setelah input pertama pengguna (kebijakan autoplay), tidak ada error audio.
3. Keyboard: gerak, Rite, jeda, navigasi menu.
4. Satu Pulse penuh sampai toko, beli satu item, mulai Pulse 2.
5. Simpan di toko, muat ulang, lanjut (sejak M2).
6. Jeda otomatis saat tab tersembunyi.
7. Ubah ukuran jendela dan layar penuh.
8. Hash determinisme replay emas (D-5) dicatat.
9. fps rata-rata selama 30 detik Pulse biasa dicatat (sanity, bukan kriteria performa).

Smoke manual Firefox dijalankan oleh QA dengan membuka build `vite preview` di Firefox sistem, mencatat tiap butir dengan screenshot. [Asumsi] Agen QA bisa membuka Firefox lewat baris perintah dan mengambil screenshot; bila tidak bisa, butir ini TIDAK DIUJI dan dilaporkan.

## 12. Aksesibilitas
Checklist dan cara uji ada di `docs/qa/accessibility.md`. Kriteria per milestone di bagian 13 merujuk id di sana (A-01 dan seterusnya).

## 13. Kriteria LOLOS atau GAGAL per milestone

Semua kriteria di bawah wajib. Satu GAGAL atau TIDAK DIUJI berarti laporan milestone GAGAL, kecuali Producer mengecualikan secara tertulis.

### 13.1 M1 Prototipe main loop

| ID | Kriteria | Cara uji | Lolos bila |
|---|---|---|---|
| M1-01 | Run 10 Pulse bisa selesai | B-1, B-2, B-3 | Semua lolos |
| M1-02 | Semua fitur main loop ada | E-02 sampai E-11 | Semua lolos di Chromium 1920x1080 |
| M1-03 | Run penuh lewat browser dengan input asli | E-13 | Minimal 3 seed selesai menang atau kalah tanpa error konsol |
| M1-04 | Determinisme | D-1, D-2, D-3, D-5 (Node, Chromium), D-6, D-7, D-8 | Semua lolos |
| M1-05 | Pemeriksaan proyek | `npm run typecheck`, `npm run lint`, `npm test` (nama perintah mengikuti LP) | Ketiganya keluar dengan kode 0; log disimpan |
| M1-06 | Validasi data | DV-1 sampai DV-6 | Semua lolos |
| M1-07 | Uji pilar M1 | CW-1, CW-2, CW-4, 8.3 (P2-b), 8.4 (P3-a, P3-b), 8.6 (P2-f), E-08 (P4-c), DV-3 (P4-b), uji 1 detik versi proksi | Semua lolos; uji 1 detik minimal 4 dari 5 |
| M1-08 | Screenshot per layar | 7.4 set M1 di 1920x1080 dan 1280x720 | Semua file ada dan dilihat QA; temuan masuk `bugs.md` |
| M1-09 | Smoke Chrome dan Edge | 11.2 butir 1 sampai 4 | Semua lolos |
| M1-10 | Aksesibilitas dasar | A-06 (jeda), A-07 bagian alur run | Lolos sesuai cara uji di `accessibility.md` |
| M1-11 | Tidak ada BLOCKER terbuka | Baca `bugs.md` | Nol BLOCKER berstatus TERBUKA |

### 13.2 M2 Vertical slice HD-2D

| ID | Kriteria | Cara uji | Lolos bila |
|---|---|---|---|
| M2-01 | Semua kriteria M1 tetap lolos (regresi) | Ulang tes M1 | Semua lolos |
| M2-02 | Run bioma pertama penuh dengan Warden dan boss | B-1 di data slice, E-13, screenshot `warden-appear` dan `boss` | Semua lolos |
| M2-03 | Performa | PF-1, PF-2, PF-3, PF-4 | Lolos ambang LP (atau ambang sementara 9.4) |
| M2-04 | Keterbacaan 1 detik | Bagian 10 | Minimal 4 dari 5 (proksi boleh, ditandai) |
| M2-05 | Kontras dan kode warna di screenshot final | 8.2, CW-3 | Semua titik lolos |
| M2-06 | DoF dan kualitas rendah | 8.5 (P3-c); P3-f: screenshot kualitas Rendah dibandingkan Tinggi | DoF hanya di bingkai; kualitas Rendah mematikan DoF, bloom, kilau kaca, dan CW-3 serta 8.2 tetap lolos di Rendah |
| M2-07 | Autosave dan lanjut | D-4, E-15 | Lolos |
| M2-08 | Pengaturan | E-14, E-16, E-17 | Lolos |
| M2-09 | Aksesibilitas slice | A-01, A-02, A-03, A-05, A-06 | Lolos |
| M2-10 | Kredit aset | Skrip membandingkan semua file aset di `art/`, `audio/`, dan generator di `tools/` dengan entri `docs/credits.md` | Setiap aset punya entri |
| M2-11 | Tidak ada BLOCKER terbuka | `bugs.md` | Nol BLOCKER |

### 13.3 M3 Konten penuh

| ID | Kriteria | Cara uji | Lolos bila |
|---|---|---|---|
| M3-01 | Regresi M1 dan M2 | Ulang semua tes otomatis | Semua lolos |
| M3-02 | Semua konten bisa dimainkan | B-7 (matriks kelas x bioma); untuk tiap item dan Keepsake: `grantItem` lalu jalankan 5 detik Pulse | Semua run selesai; tiap item memicu minimal satu event efek di sim dalam 5 detik tanpa exception (proksi P4-d, kecuali item stat datar) |
| M3-03 | Kurva kesulitan | B-5 untuk tiap kelas | Angka berada di dalam target tertulis GD; QA melaporkan, GD menyatakan sesuai atau tidak |
| M3-04 | Ragam build | B-6 (P1-c) | Tidak ada tag dominan di lebih dari 40% run |
| M3-05 | Keterbacaan dan kontras dengan konten penuh | Bagian 10, 8.2 di bioma paling ramai | Lolos |
| M3-06 | Validasi data penuh | DV-1 sampai DV-7 di seluruh data | Semua lolos |
| M3-07 | Performa tidak turun | PF-1 sampai PF-4 di bioma paling ramai | Lolos |
| M3-08 | Tidak ada BLOCKER terbuka | `bugs.md` | Nol BLOCKER |

### 13.4 M4 Polish dan QA

| ID | Kriteria | Cara uji | Lolos bila |
|---|---|---|---|
| M4-01 | Bug bash | Sesi bug bash terstruktur: tiap layar, tiap kelas, tiap bioma, tiap pengaturan, input ekstrem (tekan banyak tombol bersamaan, jeda berulang, ubah ukuran jendela saat toko) | Semua temuan tercatat di `bugs.md` dengan tingkat |
| M4-02 | Nol BLOCKER dan MAYOR | `bugs.md` | Nol BLOCKER dan nol MAYOR berstatus TERBUKA |
| M4-03 | Kompatibilitas | Matriks 11.1 kolom M4, D-5 semua browser | Chrome, Edge, Chromium lolos otomatis penuh; Firefox lolos otomatis atau smoke manual lengkap; WebKit lolos bila tersedia; Safari asli sesuai keputusan Producer |
| M4-04 | Checklist aksesibilitas | Seluruh `accessibility.md` | Semua butir wajib lolos |
| M4-05 | Panjang run | Dari B-5: median durasi run yang mencapai Pulse terakhir (menang atau mati di Pulse terakhir), termasuk waktu toko rata-rata dari playtest; ditambah minimal 1 run manusia bila tersedia | Median 15 sampai 20 menit |
| M4-06 | Pilar 2 penuh di arena paling ramai | P2-a (manusia), P2-b, P2-c, P2-d, P2-f | Lolos |
| M4-07 | Pilar 3 di kualitas rendah | 8.4, 8.5, CW-3 di P-LOW | Lolos |
| M4-08 | Performa dan memori | PF-1 sampai PF-6 | Lolos |
| M4-09 | Uji ulang perbaikan | Setiap bug BLOCKER dan MAYOR yang ditutup sejak M3 diverifikasi ulang dan punya tes regresi bila menyangkut logika | Semua terverifikasi |

### 13.5 M5 Rilis

| ID | Kriteria | Cara uji | Lolos bila |
|---|---|---|---|
| M5-01 | Build rilis lulus semua tes | Seluruh suite otomatis terhadap build rilis | Semua lolos |
| M5-02 | Replay emas di build rilis | D-7 lewat `vite preview` build rilis (tanpa hook, hash dibaca lewat jalur debug yang disetujui LP, atau dari build tes dengan commit yang sama) | Hash cocok |
| M5-03 | Tidak ada kode atau flag tes di bundle | Cari di `dist/` string `__SHARDFALL_TEST__`, nama fungsi hook, dan flag tes; cek ukuran bundle | Nol kecocokan |
| M5-04 | Smoke rilis semua browser | 11.2 di semua browser yang tersedia | Lolos |
| M5-05 | Kredit lengkap | Skrip M2-10 dan pemeriksaan Producer | Setiap aset buatan tim atau CC0 dan tercatat |
| M5-06 | Daftar bug yang diketahui | Bagian "Bug yang diketahui" di `bugs.md` diisi semua bug MINOR terbuka | Lengkap, nol BLOCKER dan MAYOR |
| M5-07 | Teks final | DV-3, DV-4, DV-5 di string table final | Lolos |
| M5-08 | Pernyataan siap QA | Laporan `docs/qa/M5-report.md` | Putusan LOLOS dengan semua bukti terlampir |

## 14. Bug

### 14.1 Tingkat
| Tingkat | Definisi | Contoh |
|---|---|---|
| BLOCKER | Game tidak bisa dimulai, crash, run tidak bisa selesai, data save hilang atau rusak, determinisme rusak, atau pelanggaran lisensi aset | Exception saat masuk toko; replay emas menghasilkan hash berbeda di Node |
| MAYOR | Fitur inti salah atau sangat mengganggu, pelanggaran pilar (kode warna, keterbacaan, DoF di area main), performa di bawah anggaran, butir aksesibilitas wajib gagal | Proyektil musuh tertutup ledakan pemain; remap tombol tidak tersimpan |
| MINOR | Salah kecil yang tidak menghalangi permainan | Teks terpotong 1 piksel di 1366x768; ikon salah warna rarity |

QA menentukan tingkat. Programmer yang ditunjuk Producer menentukan cara memperbaiki.

### 14.2 Status
TERBUKA, DIKERJAKAN, MENUNGGU UJI ULANG, DITUTUP (terverifikasi QA), DITOLAK (bukan bug, dengan alasan), DIKETAHUI (MINOR yang sengaja dibawa ke rilis, keputusan Producer).

Format lengkap ada di `docs/qa/bugs.md`. Setiap bug wajib punya langkah reproduksi, seed dan replay bila menyangkut run, build atau commit, browser, hasil yang diharapkan dan yang terjadi, serta bukti.

## 15. Format laporan milestone

File: `docs/qa/<milestone>-report.md` (contoh `docs/qa/M1-report.md`). Isi:

1. **Kepala:** milestone, tanggal, commit atau id build, mesin dan profil, browser dan versinya, versi Playwright.
2. **Putusan akhir:** LOLOS atau GAGAL.
3. **Tabel kriteria:** kolom `ID | Kriteria | Putusan (LOLOS, GAGAL, TIDAK DIUJI) | Bukti (path file) | Perintah`.
4. **Perintah yang dijalankan:** perintah persis dan ringkasan keluaran (jumlah tes lulus dan gagal, kode keluar).
5. **Temuan baru:** daftar id bug yang dibuat di `bugs.md`.
6. **Perubahan ambang atau baseline:** bila ada, dengan alasan dan pemilik keputusan.
7. **Daftar file** yang dibuat atau diubah QA.
8. **Ringkasan lolos dan gagal** dalam beberapa baris.
9. **Pertanyaan terbuka** dalam satu daftar.

## 16. Kebutuhan dari peran lain

| Dari | Kebutuhan | Untuk |
|---|---|---|
| LP | `hashState`, format replay, hook tes 7.2, flag build tes, aturan lint sim, struktur folder tes, perintah npm, anggaran performa | Bagian 5, 7, 9 |
| LP | Keputusan dependensi: `@vitest/coverage-v8` (opsional), build Firefox Playwright (unduhan CDN) | 4.1, 2.2 |
| GD | Target kurva kesulitan tertulis, kolom penanda item stat datar, jumlah musuh puncak, durasi minimum telegraf | B-5, DV-7, 9.3 |
| AD | Metadata kubu per sprite, kalibrasi ambang hue dan selisih grayscale | CW-1, CW-3, 8.3 |
| UI | Penamaan layar untuk `goToScreen`, akses fokus keyboard, pengaturan aksesibilitas | 7.4, `accessibility.md` |
| Producer | Keputusan Safari asli, izin unduh build Firefox Playwright, siapa penguji manusia untuk P2-a | 2.2, 10, 13.4 |
