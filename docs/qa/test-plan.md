# Shardfall: Rencana Tes

Pemilik: QA Lead. Reviewer: Producer. Status: versi 1.1 (2026-11-17), diselaraskan dengan `docs/tech/architecture.md` v2.2 dan review `docs/reviews/M0-lp.md` (perbaikan QA 1 sampai 5).
Dokumen terkait: `docs/pillars.md` (uji pilar), `docs/style-guide.md` (kode warna, kontras, teks), `docs/qa/accessibility.md`, `docs/qa/bugs.md`, `docs/tech/architecture.md` (sumber kebenaran untuk hook, folder tes, perintah, anggaran performa, format replay).

Penanda: **[Asumsi]** perlu dikonfirmasi pemilik wilayah lain. **[Usul ke LP]** butuh dukungan arsitektur atau kode.

Perubahan versi 1.1: hook e2e final `window.__shardfall` (7.2), lokasi tes dan perintah npm final (3), replay emas memakai data fixture (5.3 D-7), format replay merujuk architecture 4.5 (5.1), ambang PF-1 sampai PF-6 dari architecture 13 (9.4), lingkungan dan browser diperbarui (2).

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
| Playwright | `@playwright/test` 1.64.1, dependensi dev proyek (dicek 2026-11-17) |

Mesin ini lebih kuat dari "laptop kelas menengah". Karena itu uji performa memakai profil emulasi (bagian 9.2).

### 2.2 Browser

| Browser | Status di mesin ini | Cara pakai di Playwright | Keterbatasan |
|---|---|---|---|
| Chromium (build Playwright) | Ada di cache Playwright | project `chromium` | Headless memakai render perangkat lunak (SwiftShader) bila GPU tidak dipakai, sehingga angka fps headless tidak sah |
| Google Chrome 157 | Terpasang | `channel: 'chrome'` | Tidak ada |
| Microsoft Edge 157 | Terpasang | `channel: 'msedge'` | Tidak ada |
| Firefox (build Playwright) | `firefox-1555` (Firefox 157) dipasang QA 2026-11-17 lewat `npx playwright install firefox` (izin Producer, tasks.md 2026-11-16) | `test.use({ browserName: 'firefox' })` di `tests/e2e/smoke-firefox.spec.ts` | `page.setViewportSize` macet di build ini pada Windows; tes memakai viewport dari konfigurasi |
| WebKit (build Playwright) | Cache hanya punya `webkit-2336`; Playwright 1.64.1 meminta `webkit-2370`. Unduh WebKit belum diizinkan | `tests/e2e/smoke-webkit.spec.ts` memakai build yang diminta, atau `webkit-2336` sebagai cadangan (hasil indikatif) | Hanya pendekatan Safari, bukan Safari asli |
| Safari asli | Tidak tersedia (butuh macOS) | Tidak bisa | Keputusan Producer 2026-11-16: WebKit Playwright dipakai sebagai proksi, dicatat sebagai keterbatasan |

Spec smoke per browser dilewati otomatis (`test.skip`) bila browser atau build tidak terpasang, sehingga `npm run test:e2e` tetap jalan di mesin lain dan CI (Chromium saja).

## 3. Lapisan tes

Lokasi dan perintah final mengikuti architecture 14 dan 15.1 (beku M1).

| Lapisan | Alat | Lokasi | Perintah | Kapan jalan | Target waktu |
|---|---|---|---|---|---|
| Unit sim dan logika | Vitest (env node) | `tests/unit/<modul>/` | `npm test` | Setiap perubahan | di bawah 30 detik |
| Validasi data dan teks | Vitest + pipeline data | `tests/data/`, `tools/data/lib/check-strings.ts` | `npm test`, `npm run data:check` | Setiap perubahan data atau string | di bawah 10 detik |
| Determinisme | Vitest (env node) | `tests/determinism/`, `tests/unit/sim/determinism.test.ts` (GP), `tests/unit/qa/determinism-qa.test.ts` (QA) | `npm test`, `npm run test:det` | Setiap perubahan sim | di bawah 60 detik |
| Bot run penuh headless | Vitest | `tests/bot/` (architecture), sementara `tests/unit/qa/bot-real-data.test.ts` dan `tests/unit/sim/bot.test.ts` | `npm test` (sementara), `npm run test:bot` | Setiap milestone, dan sebelum laporan QA | di bawah 5 menit untuk 20 seed |
| Audit aset (kode warna, skala) | Vitest + validator AD | `tests/assets/`, `tools/art/check-sprites.ts` | `npm run test:assets`, `npm run art:check` | Setiap perubahan art | di bawah 30 detik |
| End-to-end dan screenshot | Playwright | `tests/e2e/` | `npm run test:e2e` (`build:e2e` lalu Playwright) | Sebelum laporan QA dan sebelum push milestone | di bawah 15 menit |
| Performa | Playwright headed + hook tes | `tests/perf/` | `npm run test:perf` | M2, M3, M4, M5 | sekitar 5 menit per profil |
| Benchmark sim | Vitest bench | `tests/bench/` | `npm run bench` | Bila sim berubah | |
| Manual dan playtest | Checklist di dokumen ini | `docs/qa/` | | Per milestone | sesuai kebutuhan |

Gerbang wajib sebelum menyerahkan pekerjaan: `npm run check` (data:check, art:check, levels:check, audio:check, format:check, typecheck, lint, test, build, bundle:check). `test:e2e` lokal dan di CI (Chromium). Semua perintah keluar dengan kode 0 bila lulus dan bukan 0 bila gagal.

Keadaan M1 (2026-11-17): skrip `test:det`, `test:bot`, `test:assets`, `test:perf`, `bench`, `qa:report` belum ada di `package.json` (milik LP). Selama itu tes QA tinggal di `tests/unit/qa/` (ikut `npm test`) dan `tests/e2e/`. [Usul ke LP] Saat `tests/bot/` dan `test:bot` dibuat, `tests/unit/qa/bot-real-data.test.ts` dipindah ke sana.

Hasil sementara (screenshot mentah, replay, trace) masuk `tests/out/` yang di-gitignore. Bukti yang dipakai di laporan ada di `docs/qa/evidence/<milestone>/`.

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
| Warden dan boss | Muncul di Pulse yang ditentukan data; hadiah Warden berupa pilihan Memento |
| Akhir run | Menang setelah Pulse terakhir; kalah saat HP 0; Silt dihitung sesuai data |
| Save dan load | Serialisasi state lalu deserialisasi menghasilkan hash identik; versi save lama ditolak dengan pesan, tidak crash |
| Input | Pemetaan tombol ke aksi memakai tabel remap; aksi yang sama dari dua tombol berbeda menghasilkan state sama |

### 4.3 Validasi data dan teks

| ID | Cek | Lolos bila |
|---|---|---|
| DV-1 | Skema setiap file `content/data/*` | Semua kolom wajib ada, tipe benar, tidak ada id ganda, semua rujukan id valid |
| DV-2 | Tag item (P1-b) | 100% senjata dan Memento punya minimal 1 tag dari daftar tag resmi |
| DV-3 | Batas teks (P4-b, style guide 4.2) | Nama maksimal 3 kata dan 18 karakter; efek maksimal 2 baris dan sekitar 40 karakter per baris; flavor 1 baris maksimal 70 karakter |
| DV-4 | Kata terlarang (style guide 4.3) | Nol kecocokan pada daftar kata terlarang di string table, tidak peka huruf besar kecil |
| DV-5 | Em dash | Nol karakter em dash di string table dan di `docs/` |
| DV-6 | String hardcode | Semua teks UI diambil dari string table; cek: tidak ada literal huruf di komponen UI selain id string [Usul ke LP: aturan lint] |
| DV-7 | Rasio item stat datar (P1-a) | Item yang ditandai stat datar paling banyak 30% pool toko; butuh kolom penanda di data [Asumsi, GD] |

## 5. Tes determinisme

### 5.1 Definisi
- **Hash state:** `Sim.hash()` (architecture 8.4): FNV-1a atas bit float, 8 hex lewat `toHex8`, hanya slot hidup, pool di-reset kanonik di batas Pulse. Di browser dibaca lewat `window.__shardfall.getStateHash()`.
- **Rekaman input (replay):** format final architecture 4.5 (`format: "shardfall-replay"`, `v: 1`, `contentHash`, `contentTier`, `seed`, `classId`, `profile`, `difficulty`, `ticks`, input RLE `[count, moveX, moveY, held, pressed, aimX, aimY]`, `commands` bertick, `checkpoints`). Tick relatif terhadap `run.start` (architecture 19, v2.2 butir 5). Diputar dengan `playReplay` dari `src/sim`; perekam browser `src/app/replay.ts`, ekspor lewat `exportReplay()`.
- **Checkpoint:** hash dicatat tiap 60 tick (`REPLAY_CHECKPOINT_TICKS`), sehingga bila hasil beda, tick pertama yang menyimpang langsung diketahui.

### 5.2 Sumber nondeterminisme yang dilarang di kode sim
`Math.random`, `Date.now`, `performance.now`, `new Date`, timer (`setTimeout`, `setInterval`), urutan iterasi objek dengan kunci campuran, dan bergantung pada frame rate render. Larangan final ada di architecture 4.2 (dipaksa ESLint dan `tsconfig.sim.json`), ditambah tes D-6.

Catatan: fungsi seperti `Math.sin`, `Math.exp`, `Math.pow` tidak dijamin identik antar mesin JavaScript. Determinisme dijamin minimal dalam satu mesin (V8: Node, Chrome, Edge). Kesamaan antar browser diuji di D-5 dan hasilnya dilaporkan, bukan diasumsikan.

### 5.3 Daftar tes

| ID | Tes | Cara uji | Lolos bila | Mulai |
|---|---|---|---|---|
| D-1 | Ulang dalam satu proses | Rekam run bot penuh di data asli (sampai menang atau kalah), putar 2 kali dalam satu proses Vitest | Semua hash checkpoint identik | M1 |
| D-2 | Ulang di proses terpisah | `node tests/unit/qa/support/sim-cli.ts` dua kali (child process) untuk run berskrip dan untuk replay | Checkpoint dan hash akhir identik dengan proses Vitest; menangkap state global modul yang bocor | M1 |
| D-3 | Seed benar dipakai | Input sama dengan seed berbeda | Hash akhir berbeda (sanity) | M1 |
| D-4 | Save, load, lanjut | Run A tanpa jeda. Run B: simpan di fase toko Pulse 3, buang state, muat, lanjutkan input sisa | Hash akhir A dan B identik | M2 (sudah ada di `tests/unit/sim/determinism.test.ts`) |
| D-5 | Lintas runtime | Run berskrip yang sama di Node (`sim-cli.ts script`) dan di browser lewat `step` dan `getStateHash` | Hash identik di Node, Chromium, Chrome, Edge. Firefox dan WebKit dicatat sebagai temuan bila berbeda | M1 (V8), M4 (semua) |
| D-6 | Bebas frame rate | Sim lewat `createFixedStep` (accumulator asli loop) dengan dt setara 30, 60, 144 fps, dan dt acak berseed | Hash akhir identik dengan run tick murni, tidak ada tick dibuang | M1 |
| D-7 | Replay emas | 3 replay run penuh memakai **data fixture** `tests/fixtures/data/` (architecture 14.1), disimpan dengan hash akhir yang diharapkan. Lokasi M1: `tests/unit/qa/replays/` [Asumsi QA: architecture menyebut `tests/fixtures/replays/`, di luar wilayah tulis QA pada M1-09b; LP boleh memindah]. Buat ulang hanya dengan `QA_UPDATE_GOLDEN=1` | Hash cocok. Bila perubahan logika sim yang disengaja mengubah hash, replay emas diperbarui dengan alasan tertulis di laporan, bukan dihapus. Perubahan balance GD tidak menyentuhnya | M1 |
| D-8 | Rekam dari permainan nyata | Rekam input dari sesi browser (keyboard nyata dan bot browser E-13) lewat perekam app, putar ulang di Node | Semua checkpoint dan hash akhir identik | M1 |

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

Angka radius, ambang, dan peluang reroll bot adalah konstanta bot di kode tes (`tests/unit/sim/support/bot.ts` milik GP untuk gerak, `tests/unit/qa/support/qa-bot.ts` untuk pilihan acak), bukan di data game.

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

### 7.1 Konfigurasi (architecture 14.3, `playwright.config.ts` milik LP)
- `npm run test:e2e` menjalankan `build:e2e` (keluaran `dist-e2e/`, konstanta `__E2E__` `true`), lalu Playwright. `webServer` menjalankan `vite preview --mode e2e --outDir dist-e2e` di port tetap 4174 dan mematikannya otomatis (aturan agent 11).
- Project: `chromium` (default, viewport 1280x720). Chrome, Edge, Firefox, WebKit lewat spec smoke per browser (`tests/e2e/smoke-*.spec.ts`, `test.use` di tingkat file), dilewati bila tidak terpasang.
- Resolusi: 1920x1080 (utama, lewat `test.use` atau `setViewportSize`), 1280x720, 1366x768 (M2).
- Setiap tes gagal bila ada `console.error`, `pageerror`, request gagal, atau respons HTTP 4xx/5xx (`tests/e2e/support/qa.ts` `watchProblems`).
- Trace dan video hanya disimpan saat gagal (`tests/out/playwright/`).

### 7.2 Hook tes (final, architecture 6.12)
Objek `window.__shardfall` (`E2eHooks`, `version: 1`) hanya ada di build `npm run build:e2e` (konstanta `__E2E__`), dimuat lewat dynamic import di `src/app/boot.ts`, dan hilang total dari build produksi (dicek `bundle:check`: string `__shardfall` dan chunk `hooks`). Perubahan state memakai `DebugCommand` yang ditolak sim di build produksi.

| Fungsi | Guna |
|---|---|
| `ready()` | Menunggu app siap |
| `startRun({ seed, classId, profile?, difficulty? })` | Run yang bisa diulang (profil default app `run_a`). Mengakhiri run aktif lebih dulu |
| `pauseLoop()`, `resumeLoop()` | Menghentikan atau menyalakan loop rAF; saat berhenti tes yang mengendalikan waktu |
| `step(ticks, input?)` | Menjalankan tick sinkron dengan `InputFrame` parsial, lalu merender satu frame (`step(0)` hanya merender) |
| `setTimeScale(x)` | 0,25 sampai 16 (di atas 4 tick per frame hanya di e2e) |
| `send(cmd)` | Mengirim `Command` atau `DebugCommand` (`debug.endPulse`, `debug.glint`, `debug.xp`, `debug.setHp`, `debug.spawn`, `debug.grant`) |
| `getStateHash()` | 8 hex dari `Sim.hash()` |
| `getSnapshot()` | `screen`, `phase`, `tick`, `pulseIndex`, `hp`, `maxHp`, `glint`, `level`, posisi pemain, jumlah entitas per pool |
| `getScreenPositions()` | Posisi CSS pemain, musuh (dengan `rank`), proyektil musuh, area bahaya |
| `goToScreen(id)` | Membangun state sah lewat command lalu menampilkan layar (`title`, `class-select`, `pulse`, `level-up`, `warden-reward`, `glazier`, `pause`, `confirm`, `settings`, `run-end`, `run-lost`, `run-won`, `archive`, `credits`) |
| `spawnStress('peak' \| 'peak-boss')` | Komposisi Pulse normal terakhir (atau boss) plus build akhir run. Satu kali spawn; uji stres menambah musuh sendiri agar puncak bertahan |
| `grantItem(id, tier?)` | Memberi senjata atau Memento |
| `loadReplay(replay)`, `exportReplay()` | Putar dan rekam (format architecture 4.5) |
| `getPerf()` | `frameMs` (avg, p95, p99, max, rolling 600 frame), `simTickMs`, `drawCalls`, `triangles`, `eventOverflow`, `poolOverflow` |

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

Anggaran resmi milik LP dan sudah ditetapkan di architecture 13 (beku M1). Tabel 9.4 menyalin ambang itu.

### 9.2 Profil perangkat
| Profil | Isi | Pakai untuk |
|---|---|---|
| P-REF (laptop menengah, emulasi) | Browser dipaksa ke GPU terintegrasi AMD Radeon (pengaturan grafis Windows per aplikasi "Power saving"), throttling CPU 2x lewat CDP `Emulation.setCPUThrottlingRate`, jendela 1920x1080, kualitas default | Kriteria lolos performa |
| P-DEV | GPU diskret RTX 3060, tanpa throttling | Pembanding, tidak dipakai untuk lolos |
| P-LOW | P-REF dengan kualitas Rendah | Membuktikan kualitas rendah memberi ruang performa |

P-REF diterima LP sebagai profil acuan (architecture 13): GPU terintegrasi AMD Radeon (Power saving), throttling CPU 2x lewat CDP, 1920 x 1080, kualitas Sedang, headed. Layar 144 Hz: fps dibatasi rAF pada laju layar, jadi ambang dihitung terhadap frame time 16,7 ms, dan laju layar dicatat di laporan.

### 9.3 Skenario "arena paling ramai"
- Skenario puncak architecture 13: 120 musuh, 150 proyektil musuh, 300 proyektil pemain (200 proc), 24 zona, 150 Glint, partikel penuh.
- `spawnStress('peak')` atau `'peak-boss'`: komposisi Pulse normal terakhir (dibatasi `alive_cap`) atau boss, ditambah build akhir run. Karena build itu membersihkan musuh dalam beberapa detik, uji stres QA menambah Unlit lewat `debug.spawn` tiap 200 ms sampai 120 dan menjaga HP penuh (`tests/e2e/screens.spec.ts`).
- Alternatif yang lebih jujur: replay bot di tick dengan jumlah entitas tertinggi dari data B-5.
- Browser dijalankan headed dengan GPU (bukan headless), pemanasan 5 detik, pengukuran 30 detik.

### 9.4 Tes performa

| ID | Tes | Lolos bila (architecture 13) | Mulai |
|---|---|---|---|
| PF-1 | Frame time skenario puncak, P-REF Sedang (`getPerf()`, pemanasan 5 s, ukur 30 s) | p95 16,7 ms atau kurang, p99 25 ms atau kurang (1% low 40 fps), rata-rata 58 fps atau laju layar | M2 |
| PF-2 | Frame time skenario puncak, P-REF Rendah | p99 20 ms atau kurang | M2 |
| PF-3 | Waktu tick sim di puncak | p95 4 ms atau kurang di P-REF (`getPerf().simTickMs`); 2 ms di Node mesin dev (`tests/bench/sim-peak.bench.ts`) | M2 (angka indikatif dicatat sejak M1) |
| PF-4 | Waktu muat | Layar judul interaktif dalam 5 s dari `vite preview` lokal cache kosong (M2); 2 s pada 10 Mbps (M4) | M2 |
| PF-5 | Memori | Heap stabil di bawah 150 MB; awal run ke-3 maksimal 20% di atas run ke-1 setelah garbage collection | M4 |
| PF-6 | Ukuran bundle gzip (`bundle:check`) | JS awal target 300 KB (gagal 400 KB); data dan string 40 KB (80); art 40 KB (60); audio 15 KB (25); halaman pertama 400 KB (600) | M1 (otomatis di `check`) |
| PF-7 | Draw call dan segitiga | 60 draw call dan 100 ribu segitiga atau kurang (`getPerf().drawCalls`, `triangles`) | M2 |

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

Sejak M1 butir 1 sampai 4, 8, dan 9 otomatis di `tests/e2e/smoke-{chrome,msedge,firefox,webkit}.spec.ts` (`tests/e2e/support/smoke.ts`), dengan build Firefox Playwright yang sudah terpasang. Butir 8 wajib identik untuk Chrome dan Edge (V8) dan hanya dicatat untuk Firefox dan WebKit. Butir 5 sampai 7 manual atau mulai M2.

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
| M1-05 | Pemeriksaan proyek | `npm run check` (termasuk typecheck, lint, test, build, bundle:check) dan `npm run test:e2e` | Keluar dengan kode 0; log disimpan |
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
| M3-02 | Semua konten bisa dimainkan | B-7 (matriks kelas x bioma); untuk tiap item dan Memento: `grantItem` lalu jalankan 5 detik Pulse | Semua run selesai; tiap item memicu minimal satu event efek di sim dalam 5 detik tanpa exception (proksi P4-d, kecuali item stat datar) |
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
| M5-03 | Tidak ada kode atau flag tes di bundle | `npm run bundle:check` (string `__shardfall` dan chunk `hooks` di `dist/`), ditambah pencarian manual nama fungsi hook dan `__E2E__`; cek ukuran bundle | Nol kecocokan |
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
| LP | Sudah dipenuhi di architecture v2.2 (hash, replay, hook, `__E2E__`, lint sim, folder, perintah, anggaran). Sisa: skrip `test:bot`, `test:det`, `test:perf`, `qa:report`; perbaikan `goToScreen('confirm')` (BUG-004) | Bagian 3, 5, 7, 9 |
| LP | Keputusan dependensi: `@vitest/coverage-v8` (opsional), build Firefox Playwright (unduhan CDN) | 4.1, 2.2 |
| GD | Target kurva kesulitan tertulis, kolom penanda item stat datar, jumlah musuh puncak, durasi minimum telegraf | B-5, DV-7, 9.3 |
| AD | Metadata kubu per sprite, kalibrasi ambang hue dan selisih grayscale | CW-1, CW-3, 8.3 |
| UI | Penamaan layar untuk `goToScreen`, akses fokus keyboard, pengaturan aksesibilitas | 7.4, `accessibility.md` |
| Producer | Keputusan Safari asli, izin unduh build Firefox Playwright, siapa penguji manusia untuk P2-a | 2.2, 10, 13.4 |
