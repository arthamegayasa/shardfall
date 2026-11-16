# Shardfall: Pelacak Bug

Pemilik: QA Lead. Hanya QA yang mengubah tingkat dan status DITUTUP. Programmer boleh mengubah status ke DIKERJAKAN atau MENUNGGU UJI ULANG dan mengisi kolom perbaikan.
Aturan tingkat dan status: `docs/qa/test-plan.md` bagian 14.

**Tingkat:** BLOCKER, MAYOR, MINOR.
**Status:** TERBUKA, DIKERJAKAN, MENUNGGU UJI ULANG, DITUTUP, DITOLAK, DIKETAHUI.
**Id:** `BUG-001`, `BUG-002`, dan seterusnya, tidak pernah dipakai ulang.

---

## Ringkasan

| Id | Judul | Tingkat | Status | Milestone ditemukan | Area | Pemilik perbaikan | Tes regresi |
|---|---|---|---|---|---|---|---|
| BUG-001 | Ringkasan build (Pause, akhir run) menampilkan build run sebelumnya, atau kosong, selama Pulse 1 | MAYOR | DITUTUP (M3) | M1 | sim, ui | GP | `tests/unit/qa/bugs-m1.test.ts` (2 kasus `it`), `tests/e2e/m3-play.spec.ts` |
| BUG-002 | `favicon.ico` 404 memunculkan `console.error` di Chrome dan Edge sungguhan | MINOR | DITUTUP (M3) | M1 | build | Producer | `tests/e2e/smoke-chrome.spec.ts`, `smoke-msedge.spec.ts` |
| BUG-003 | Teks flavor kartu Memento terpotong elipsis di the Glazier dan hadiah Warden | MINOR | DITUTUP (M3) | M1 | ui | UI | `tests/e2e/screens.spec.ts`, `m3-play.spec.ts` (pemindai layout) |
| BUG-004 | Hook `goToScreen('confirm')` gagal: berakhir di layar `pause` | MINOR | DITUTUP (M3) | M1 | build | LP | Jalur keyboard di `tests/e2e/screens.spec.ts` |
| BUG-005 | Baris Memento di ringkasan build menjorok dibanding baris senjata | MINOR | DITUTUP (M3) | M1 | ui | UI | Screenshot `docs/qa/evidence/M3/play-bell-run-end-build.png` |
| BUG-006 | Frame arena pertama di profil browser baru menahan loop sekitar 0,4 s setelah HUD Pulse tampil; tombol yang ditekan saat itu hilang (penyebab smoke Edge flaky) | MINOR | TERBUKA | M3 | render, perf | LP (usulan) | `tests/e2e/support/smoke.ts` (menunggu sim berjalan, mencatat jeda) |
| BUG-007 | Market Cur saat ancang-ancang berwarna merah dengan luminans sama dengan lantai: hilang di grayscale, kontras 1,0:1 | MAYOR | TERBUKA | M3 | render, asset | AD (usulan), LP bila lewat shader | `tests/e2e/m3-visual.spec.ts` + `tests/e2e/support/m3_analyze.py` |
| BUG-008 | Banner boss atau Warden dari run sebelumnya tetap tampil di run baru | MINOR | TERBUKA | M3 | ui | UI (usulan) | Screenshot saja |
| BUG-009 | Layar akhir run mengunci input 500 ms juga saat kembali dari The Keeping, dan fokus kembali ke Try Again | MINOR | TERBUKA | M3 | ui | UI (usulan) | `tests/e2e/m3-play.spec.ts` (mencatat fokus, menunggu kunci) |
| BUG-010 | A-07: urutan fokus panah di the Glazier antara grid inventaris dan kolom kunci tidak mengikuti urutan visual | MAYOR | TERBUKA | M3 | a11y, ui | UI (usulan) | `tests/e2e/m3-a11y.spec.ts` (A-07, laporan `missing`) |
| BUG-011 | Ukuran teks Largest di 1280x720 dan 1366x768: monogram ikon cadangan ("CP") menumpuk dengan nama, efek, dan hotkey kartu | MAYOR | DITUTUP (M3) | M3 | ui, a11y | AD (ikon B) | `tests/e2e/m3-a11y.spec.ts` (A-05 skala 2) |
| BUG-012 | Affix `brood` (Tingkat B) tidak bisa muncul di build Tingkat B: tidak ada Warden B yang memilikinya dan pool acak hanya aktif di Crack 2 ke atas | MINOR | TERBUKA | M3 | data | GD (usulan) | `tests/unit/qa/content-b.test.ts` (affix Crack 2) |
| BUG-013 | Tick sim terus bertambah selama pemain diam di Temper dan the Glazier (3600 tick per 60 s); layar tidak berpindah dan tidak ada timer | MINOR | TERBUKA | M3 | sim | GP (usulan), LP | `tests/e2e/m3-a11y.spec.ts` (A-12, `QA_LONG=1`) |

Area: `sim`, `render`, `ui`, `audio`, `data`, `save`, `perf`, `a11y`, `compat`, `build`, `asset`.

---

## Detail bug

Salin blok di bawah untuk tiap bug baru. Urutkan dari id terkecil.

```markdown
### BUG-000: <judul singkat, apa yang salah>

- Tingkat: BLOCKER | MAYOR | MINOR
- Status: TERBUKA
- Ditemukan: <tanggal>, <milestone>, oleh <peran>
- Build: <commit atau id build>, <build tes atau rilis>
- Lingkungan: <browser dan versi>, <resolusi>, <profil perangkat P-REF | P-DEV | P-LOW>
- Seed: <seed atau "tidak relevan">
- Replay: <path file replay atau "tidak ada">
- Kelas, bioma, Pulse: <bila relevan>

**Langkah reproduksi**
1.
2.
3.

**Diharapkan:** <perilaku sesuai spec, sebut dokumen dan bagian, misalnya pillars.md P2-f>

**Terjadi:** <perilaku yang terlihat>

**Frekuensi:** <selalu | x dari y percobaan>

**Bukti:** <path screenshot, log, trace, hash>

**Catatan perbaikan (diisi programmer):** <ringkas, tanpa menyalin kode>

**Uji ulang (diisi QA):** <tanggal, build, hasil, path bukti>
```

### BUG-001: Ringkasan build menampilkan build run sebelumnya, atau kosong, selama Pulse 1

- Tingkat: MAYOR
- Status: MENUNGGU UJI ULANG
- Ditemukan: 2026-11-17, M1, oleh QA (M1-09b)
- Build: kerja lokal 2026-11-17 (contentHash 6b395051), build e2e dan sim Node
- Lingkungan: Chromium Playwright 1.64.1, 1920x1080; juga terbukti di sim Node tanpa UI
- Seed: run 1 seed 1, run 2 seed 2 (tes); di browser seed acak dari UI
- Replay: tidak ada (tes unit deterministik)
- Kelas, bioma, Pulse: Lamplighter, The Moth Market, Pulse 1

**Langkah reproduksi**
1. Mulai run, beli satu senjata di the Glazier (contoh Leaping Wick), lalu kalah atau Abandon.
2. Di layar akhir pilih Try Again (run baru).
3. Di Pulse 1 run baru tekan Esc: kolom ARMS di layar Pause.

**Diharapkan:** ringkasan build (ui-spec S06 kolom kanan, S08) menunjukkan build run yang sedang berjalan: hanya senjata awal kelas (Lantern Bolt I), tanpa Memento.

**Terjadi:** ARMS menampilkan Lantern Bolt I dan Leaping Wick I dari run sebelumnya. Pada run pertama setelah halaman dibuka, ARMS kosong (senjata awal tidak tampil). Bila pemain mati di Pulse 1, layar Kept Lost memakai data basi yang sama. Penyebab terlihat: `world.shop.inventory` dan `world.shop.mementos` hanya diisi `refreshShopView` di fase toko (`src/sim/systems/shop.ts`, `src/sim/create-sim.ts`), tidak di `run.start`; `buildSummary` (`src/ui/presenters/run-end.ts`) membacanya.

**Frekuensi:** selalu (2 dari 2 kasus tes, 1 dari 1 sesi browser)

**Bukti:** `docs/qa/evidence/M1/kb-12-pause.png` (Pause di run baru setelah Try Again, ARMS memuat Leaping Wick dari run sebelumnya); tes `tests/unit/qa/bugs-m1.test.ts` (dijalankan sebagai `it` biasa: "expected [] to deeply equal ['lantern_bolt']" dan "expected ['lantern_bolt','splinter_shot'] to deeply equal ['lantern_bolt']").

**Catatan perbaikan (diisi programmer):** saat memperbaiki, ubah kedua `it.fails` menjadi `it` di `tests/unit/qa/bugs-m1.test.ts`. GP M2-05, 2026-11-17: `run.start` kini mengisi ShopView (inventaris, Memento, tag) dari run yang baru sebelum Pulse 1, dan `debug.grant` menyegarkannya di fase apa pun (`src/sim/create-sim.ts`). Kedua tes kini `it` dan lulus.

**Uji ulang (diisi QA):** 2026-11-17, M3, build kerja lokal (contentHash 2008c1b6, tier B). Kedua tes `bugs-m1.test.ts` lulus. Browser: run Lamplighter lalu run Vintner di halaman yang sama; Pause di Pulse 2 run Vintner hanya menampilkan Harvest Sickle I, tanpa senjata atau Memento run sebelumnya (`docs/qa/evidence/M3/play-blade-pause.png`). DITUTUP.

### BUG-002: `favicon.ico` 404 memunculkan `console.error` di Chrome dan Edge sungguhan

- Tingkat: MINOR
- Status: TERBUKA
- Ditemukan: 2026-11-17, M1, oleh QA (M1-09b)
- Build: `dist-e2e` lokal 2026-11-17; berlaku juga untuk build produksi (index.html sama)
- Lingkungan: Google Chrome 157.0.8103.40 dan Microsoft Edge 157.0.4341.60 (channel Playwright), Chromium Playwright headed; Chromium headless tidak meminta favicon
- Seed: tidak relevan
- Replay: tidak ada

**Langkah reproduksi**
1. `npm run build:e2e`, lalu `npx playwright test tests/e2e/smoke-chrome.spec.ts`.
2. Atau buka build di Chrome biasa dengan DevTools Console terbuka.

**Diharapkan:** nol error konsol saat boot (test-plan 11.2 butir 1, 7.1).

**Terjadi:** "Failed to load resource: the server responded with a status of 404 (Not Found)" untuk `http://127.0.0.1:4175/favicon.ico` (lokasi dari `ConsoleMessage.location`). `index.html` tidak punya `<link rel="icon">`. Di GitHub Pages (`/shardfall/`) browser akan meminta `/favicon.ico` di akar domain dan mendapat 404 yang sama. Semua butir smoke lain di Chrome dan Edge lolos.

**Frekuensi:** selalu (Chrome 1 dari 1, Edge 1 dari 1, Chromium headed 2 dari 2)

**Bukti:** `docs/qa/evidence/M1/smoke-chrome.txt`, `docs/qa/evidence/M1/smoke-msedge.txt` (baris `problems`), log `docs/qa/evidence/M1/logs/test-e2e-final.log`.

**Catatan perbaikan (diisi programmer):** Producer, 2026-11-17: ikon inline di `index.html` (tasks.md Keputusan).

**Uji ulang (diisi QA):** 2026-11-17, M3: smoke Chrome 157 dan Edge 157 tanpa `console.error` dan tanpa respons 4xx (`docs/qa/evidence/M3/logs/test-e2e-m3.log`). DITUTUP.

### BUG-003: Teks flavor kartu Memento terpotong elipsis di the Glazier dan hadiah Warden

- Tingkat: MINOR
- Status: TERBUKA
- Ditemukan: 2026-11-17, M1, oleh QA (M1-09b)
- Build: `dist-e2e` lokal 2026-11-17
- Lingkungan: Chromium Playwright, 1920x1080 dan 1280x720, skala teks Normal
- Seed: `goToScreen` (seed hook 1) dan sesi keyboard (seed acak)
- Kelas, bioma, Pulse: Lamplighter, Pulse 1 sampai 5

**Langkah reproduksi**
1. Buka the Glazier atau hadiah Warden dengan Memento Kindling Jar, Glass Marble, atau Coal Locket di tawaran.
2. Lihat baris flavor (abu redup) di kartu.

**Diharapkan:** flavor 1 baris maksimal 70 karakter tampil utuh (style guide 4.2, cek string resmi meloloskannya).

**Terjadi:** "Dry twigs saved for the festival bonfire. They want to..." dan "A child's marble. A little of the sky is trapped insid..." terpotong `text-overflow: ellipsis` (`.sf-ui .card-flavor`, `src/ui/ui.css`), karena kolom samping kartu (tag dan harga) memakan lebar. Teks 56 sampai 62 karakter.

**Frekuensi:** selalu untuk teks flavor di atas sekitar 54 karakter

**Bukti:** `docs/qa/evidence/M1/kb-07-glazier.png`, `docs/qa/evidence/M1/warden-reward-1280x720-chromium.png`, `docs/qa/evidence/M1/screens-layout-1920x1080.json`, `docs/qa/evidence/M1/kb-layout.json`.

**Catatan perbaikan (diisi programmer):** pilihan UI: izinkan 2 baris flavor, atau sesuaikan batas cek string dengan lebar kartu nyata (keputusan UI dan WR).

**Uji ulang (diisi QA):** 2026-11-17, M3: flavor kini dibungkus 2 baris (contoh Magpie Tin, Coal Locket, Prayer Chime di `docs/qa/evidence/M3/play-bell-glazier.png`); pemindai layout tidak menemukan `card-flavor` terpotong di toko dan hadiah Warden pada 3 kelas dan 3 ukuran teks Normal dan Large. DITUTUP.

### BUG-004: Hook `goToScreen('confirm')` gagal: berakhir di layar `pause`

- Tingkat: MINOR (alat tes, bukan permainan)
- Status: TERBUKA
- Ditemukan: 2026-11-17, M1, oleh QA (M1-09b)
- Build: `dist-e2e` lokal 2026-11-17
- Lingkungan: Chromium Playwright, 1920x1080 dan 1280x720
- Seed: seed hook 1

**Langkah reproduksi**
1. `await window.__shardfall.pauseLoop()`.
2. `await window.__shardfall.goToScreen('confirm')`.

**Diharapkan:** promise selesai dengan layar `confirm` (architecture 6.12).

**Terjadi:** ditolak dengan `goToScreen("confirm") ended on "pause" (phase pulse)`. Dugaan: `build('confirm')` di `src/app/e2e/hooks.ts` mengklik `[data-ui="pause-abandon"]` sebelum layar Pause dirender (tidak ada frame di antara `app.pause()` dan klik). Jalur pemain (Esc, panah ke Abandon Run, Enter) bekerja dan dipakai tes.

**Frekuensi:** selalu (2 dari 2)

**Bukti:** log kegagalan pertama `tests/e2e/screens.spec.ts` (sebelum diganti jalur keyboard), screenshot dialog lewat keyboard `docs/qa/evidence/M1/confirm-1280x720-chromium.png`.

**Catatan perbaikan (diisi programmer):**

**Uji ulang (diisi QA):** 2026-11-17, M3, `dist-e2e` tier B: `pauseLoop()` lalu `goToScreen('confirm')` selesai tanpa penolakan (probe QA sekali pakai). DITUTUP.

### BUG-005: Baris Memento di ringkasan build menjorok dibanding baris senjata

- Tingkat: MINOR
- Status: TERBUKA
- Ditemukan: 2026-11-17, M1, oleh QA (M1-09b)
- Build: `dist-e2e` lokal 2026-11-17
- Lingkungan: Chromium Playwright, 1280x720
- Seed: 101 (E-13)

**Langkah reproduksi**
1. Ambil satu Memento (contoh Glass Marble), lalu buka Pause atau kalah.
2. Bandingkan tepi kiri teks di ARMS dan MEMENTOS.

**Diharapkan:** kolom rata kiri yang sama (ui-spec S06 dan S08).

**Terjadi:** nama Memento bergeser sekitar 6 px ke kanan; diduga elemen `rarityPips` kosong untuk rarity terendah tetap memakan ruang (`src/ui/screens/pause.ts`, layar akhir).

**Frekuensi:** selalu

**Bukti:** `docs/qa/evidence/M1/e13-seed101-end.png`.

**Catatan perbaikan (diisi programmer):**

**Uji ulang (diisi QA):** 2026-11-17, M3: di layar akhir run Chorister, "Hand Bell" (ARMS) dan "Magpie Tin" (MEMENTOS) rata kiri pada kolom yang sama (`docs/qa/evidence/M3/play-bell-run-end-build.png`). DITUTUP.

### BUG-006: Frame arena pertama di profil browser baru menahan loop sekitar 0,4 s setelah HUD Pulse tampil

- Tingkat: MINOR
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: `dist-e2e` lokal 2026-11-17 (contentHash 2008c1b6, tier B)
- Lingkungan: Microsoft Edge 157 (channel Playwright, profil baru per tes), 1280x720
- Seed: acak dari UI
- Replay: tidak ada
- Kelas, bioma, Pulse: Lamplighter, The Moth Market, Pulse 1

**Langkah reproduksi**
1. `npm run build:e2e`, buka build di Edge dengan profil kosong (cache shader dingin).
2. Enter di judul, Enter di pilih kelas.
3. Segera tahan D selama 500 ms.

**Diharapkan:** begitu HUD Pulse (timer 0:20) tampil, input gerak berlaku (test-plan 11.2 butir 3).

**Terjadi:** layar sudah `pulse` dan timer tampil, tetapi sim tetap di fase `idle` dan tick tidak bertambah sekitar 400 ms (rAF tertahan selama frame arena pertama dirender). Tombol yang ditekan dan dilepas di jendela itu tidak pernah sampai ke sim: pemain bergerak 0 u. Ini penyebab `smoke-msedge.spec.ts` gagal sesekali di suite penuh (MINOR 9 di review M2 LP): `npm run test:e2e` pertama M3 gagal tepat di butir ini.

**Frekuensi:** 1 dari 4 peluncuran Edge di probe QA (tick 14 beku 400 ms dengan fase `idle`), 1 dari 1 suite penuh pertama M3. Peluncuran berikutnya dengan cache hangat tidak menahan.

**Bukti:** log probe dicatat di `docs/qa/M3-report.md` bagian 4.6; kegagalan suite `docs/qa/evidence/M3/logs/test-e2e-m3-first.log` (KeyD bergerak 0 u).

**Catatan perbaikan (diisi programmer):** usul QA, keputusan LP: kompilasi program shader HD-2D lebih awal (di layar judul atau pilih kelas), atau tahan HUD dan timer sampai frame arena pertama selesai. Tes smoke sudah diubah QA agar menunggu fase `pulse` dan tick bertambah sebelum menekan tombol, dan mencatat jedanya.

**Uji ulang (diisi QA):**

### BUG-007: Market Cur saat ancang-ancang berwarna merah dengan luminans sama dengan lantai

- Tingkat: MAYOR (pelanggaran pilar P2-b dan P2-c, test-plan 14.1)
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: `dist-e2e` lokal 2026-11-17 (contentHash 2008c1b6, tier B)
- Lingkungan: Chromium Playwright headless dengan GPU (ANGLE D3D11, RTX 3060), 1920x1080, kualitas Low, Medium, High
- Seed: 5, `spawnStress('peak')`, 60 tick
- Kelas, bioma, Pulse: Lamplighter, The Moth Market, adegan puncak

**Langkah reproduksi**
1. `npx playwright test tests/e2e/m3-visual.spec.ts -g "peak scene"`.
2. `python tests/e2e/support/m3_analyze.py`.
3. Lihat `unlit_below_1_5` di `peak-high` dan crop Market Cur yang sedang ancang-ancang (merah).

**Diharapkan:** badan Unlit per aktor median 2:1 dan P10 1,5:1 terhadap lantai (brief M2 S-3), urutan grayscale pemain > lantai > Unlit (test-plan 8.3, brief S-2).

**Terjadi:** Market Cur dalam ancang-ancang digambar penuh `danger-red` gelap, contoh piksel badan (160, 39, 53): grayscale 86, lantai 86, kontras 1,0 sampai 1,03:1. Di adegan puncak 9 sampai 12 dari 78 Unlit di bawah 1,5:1; P10 1,09 (High), 1,21 (Low). Median semua Unlit 2,2:1 lolos. Dalam warna aktor ini justru mencolok, tetapi di grayscale dan bagi pemain dengan kepekaan merah rendah ia lebur dengan lantai tepat saat akan menerjang.

**Frekuensi:** selalu, di semua kualitas (bukan efek post).

**Bukti:** `docs/qa/evidence/M3/crop-unlit-windup-2x.png`, `docs/qa/evidence/M3/analysis.json`, `docs/qa/evidence/M3/peak-high.png`.

**Catatan perbaikan (diisi programmer):** usul QA, keputusan AD dan CD: pertahankan badan gelap `unlit-body` dan beri tanda ancang-ancang lewat rim, mata, atau outline merah, atau naikkan luminans tint jelas di atas lantai.

**Uji ulang (diisi QA):**

### BUG-008: Banner boss atau Warden dari run sebelumnya tetap tampil di run baru

- Tingkat: MINOR
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: `dist-e2e` lokal 2026-11-17, Chromium Playwright dengan GPU, 1920x1080
- Seed: 31 (boss), lalu 41 (run baru)

**Langkah reproduksi**
1. Masuk Pulse 15 sampai banner "Paper Sun, the Light-Eater" tampil.
2. Dalam waktu sekitar 3 s waktu nyata, akhiri run (Abandon) dan mulai run baru.
3. Lihat bagian atas layar di Pulse run baru.

**Diharapkan:** banner kedatangan hanya tampil untuk boss atau Warden yang sedang datang di run yang berjalan.

**Terjadi:** banner boss run sebelumnya masih tampil di atas Pulse 7 run baru (Pulse biasa). Banner tampaknya diatur waktu nyata dan tidak dibersihkan saat run berakhir. Ditemukan lewat hook (run diganti dalam satu detik); jalur pemain (Abandon cepat setelah intro boss) belum diulang manual.

**Frekuensi:** 1 dari 1 (jalur hook).

**Bukti:** `docs/qa/evidence/M3/glance-4-stack.png`.

**Catatan perbaikan (diisi programmer):**

**Uji ulang (diisi QA):**

### BUG-009: Layar akhir run mengunci input 500 ms juga saat kembali dari The Keeping

- Tingkat: MINOR
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: `dist-e2e` lokal 2026-11-17, Chromium Playwright, 1920x1080

**Langkah reproduksi**
1. Akhiri run dengan Silt (Abandon setelah beberapa Pulse), pilih The Keeping di layar akhir run.
2. Tekan Esc untuk kembali ke layar akhir run.
3. Segera tekan panah kanan sampai Title lalu Enter.

**Diharapkan:** kembali dari menu tidak dikunci (aturan `choiceLockApplies` M2-09 untuk layar dari judul, jeda, pengaturan), dan fokus kembali ke tombol The Keeping.

**Terjadi:** `RUN_END_LOCK_MS` (500 ms) dipasang di setiap `enter()` layar akhir run (`src/ui/screens/run-end.ts`), termasuk saat kembali dari The Keeping; Enter di jendela itu diabaikan diam-diam. Fokus kembali ke Try Again.

**Frekuensi:** selalu (2 dari 2 di `m3-play.spec.ts` sebelum tes diberi jeda).

**Bukti:** `docs/qa/evidence/M3/play-log.txt` (baris "focus after returning from The Keeping: end-again").

**Catatan perbaikan (diisi programmer):**

**Uji ulang (diisi QA):**

### BUG-010: Urutan fokus panah di the Glazier tidak mengikuti urutan visual (A-07)

- Tingkat: MAYOR (butir aksesibilitas wajib A-07, accessibility.md bagian format)
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: `dist-e2e` lokal 2026-11-17, Chromium Playwright, 1920x1080
- Seed: seed hook 1 (`goToScreen('glazier')`)

**Langkah reproduksi**
1. Buka the Glazier (fokus awal Begin Pulse).
2. Panah atas dua kali (ke `shop-slot-6`, lalu `shop-slot-3`), panah bawah, panah bawah, kanan, kiri.

**Diharapkan:** navigasi panah mengikuti tata letak (A-07: kiri ke kanan, atas ke bawah); kanan lalu kiri kembali ke elemen asal.

**Terjadi:** urutan tercatat `shop-slot-6` bawah ke `shop-lock-3` (melompat dari panel inventaris kanan ke kolom kunci di tengah), `shop-lock-3` kanan ke `shop-slot-4`, `shop-slot-4` kiri ke `shop-lock-2` (bukan kembali ke `shop-lock-3`). Semua kontrol tetap bisa dicapai dengan keyboard dan fokus selalu terlihat; layar lain lolos A-07.

**Frekuensi:** selalu.

**Bukti:** urutan di `docs/qa/M3-report.md` bagian 5 (A-07), `docs/qa/evidence/M3/a11y-results.json`.

**Catatan perbaikan (diisi programmer):**

**Uji ulang (diisi QA):**

### BUG-011: Ukuran teks Largest: monogram ikon cadangan menumpuk dengan teks kartu

- Tingkat: MAYOR (butir aksesibilitas wajib A-05)
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: `dist-e2e` lokal 2026-11-17, Chromium Playwright, 1280x720 dan 1366x768, ukuran teks Largest

**Langkah reproduksi**
1. Settings, Accessibility, Text Size: Largest.
2. Buka the Glazier atau hadiah Warden dengan Memento yang belum punya ikon AD (contoh Collector Pin).

**Diharapkan:** tidak ada teks bertumpuk di skala terbesar pada 1280x720 (A-05).

**Terjadi:** monogram cadangan ("CP", `span.icon-mono`) ikut membesar dan menumpuk dengan hotkey, nama, dan efek kartu. Skala Normal dan Large bersih di 3 resolusi. Akan hilang sendiri bila semua ikon Memento dan Rite B dari AD terpasang; tetap perlu batas ukuran monogram selama cadangan dipakai.

**Frekuensi:** selalu untuk item tanpa ikon AD.

**Bukti:** pemindai layout run pertama M3 (`docs/qa/M3-report.md` bagian 5); screenshot setelah perbaikan `docs/qa/evidence/M3/a05-scale2-glazier-1280x720.png`.

**Catatan perbaikan (diisi programmer):** AD menambah ikon 10 Memento dan 2 Rite Tingkat B selama M3 (art:check 91 sprite), jadi monogram cadangan tidak lagi dipakai untuk item B.

**Uji ulang (diisi QA):** 2026-11-17, M3, ulang `m3-a11y.spec.ts`: skala Largest 0 teks terpotong, bertumpuk, atau keluar layar di 6 layar x 3 resolusi; Chapel Pane dan item B lain tampil dengan ikon. DITUTUP. Catatan: batas ukuran monogram tetap disarankan ke UI bila cadangan dipakai lagi (MINOR, tidak dicatat terpisah).

### BUG-012: Affix `brood` tidak bisa muncul di build Tingkat B

- Tingkat: MINOR (konten scope B yang tidak terjangkau, bukan crash)
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: data tier B, contentHash 2008c1b6

**Langkah reproduksi**
1. Baca `content/data/affixes.csv` (`brood`, tier B, `random_pool` 1) dan `content/data/enemies.csv` (Warden B: `warden_hound` volley, `warden_choir` blinking dan veiled).
2. `content/data/difficulty.csv`: komentar "Tier A and B use level 0 only"; `warden_extra_affixes` baru 1 di Crack 2.
3. Jalankan `npx vitest run tests/unit/qa/content-b.test.ts`: cakupan Crack 0 tidak pernah memasang `brood`, uji Crack 2 memasangnya tanpa error.

**Diharapkan:** setiap konten Tingkat B bisa muncul di build Tingkat B (kriteria M3), atau ditandai tier C.

**Terjadi:** `brood` hanya bisa datang dari pool acak Crack 2 ke atas, yang tidak tersedia di Tingkat B. Kode affix bekerja (Crack 2: dipasang dan memicu summon `mote`).

**Frekuensi:** selalu.

**Bukti:** keluaran `[QA M3 affixes]` di `docs/qa/evidence/M3/logs/qa-unit-m3.log`.

**Catatan perbaikan (diisi programmer):** keputusan GD (scope): pindahkan `brood` ke tier C, beri ke Warden B, atau buka Crack di B.

**Uji ulang (diisi QA):**

### BUG-013: Tick sim terus bertambah selama pemain diam di Temper dan the Glazier

- Tingkat: MINOR (A-12 [Saran]; tidak ada efek terlihat yang ditemukan)
- Status: TERBUKA
- Ditemukan: 2026-11-17, M3, oleh QA
- Build: `dist-e2e` lokal 2026-11-17, Chromium Playwright, 1920x1080
- Seed: acak dari UI

**Langkah reproduksi**
1. `QA_LONG=1 npx playwright test tests/e2e/m3-a11y.spec.ts -g A-12`.
2. Atau: mulai run, naik level, diam 60 s di Temper; catat `getSnapshot().tick` sebelum dan sesudah.

**Diharapkan:** accessibility.md A-12: layar dan tick tidak berubah saat diam di Temper, Glazier, Pause, Settings.

**Terjadi:** layar tidak berpindah di keempat konteks (tidak ada timer). Tick sim bertambah 3600 per 60 s di Temper (146 ke 3746) dan Glazier (4521 ke 8121); di Pause dan Settings tetap. Belum terlihat efek gameplay; dampak yang mungkin: statistik waktu run dan panjang replay ikut bertambah selama menu pilihan.

**Frekuensi:** selalu.

**Bukti:** `docs/qa/evidence/M3/a11y-results.json` (A-12).

**Catatan perbaikan (diisi programmer):** GP atau LP memutuskan: bila disengaja, QA mengubah cek A-12 menjadi "layar tidak berubah"; bila tidak, hentikan step sim di fase pilihan.

**Uji ulang (diisi QA):**

---

## Bug yang diketahui (untuk rilis)

Diisi saat M5. Hanya bug MINOR berstatus DIKETAHUI yang boleh ada di sini. BLOCKER dan MAYOR tidak boleh dibawa ke rilis.

| Id | Ringkasan untuk pemain (Inggris) | Solusi sementara |
|---|---|---|
| | | |
