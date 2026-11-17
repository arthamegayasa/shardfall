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
| BUG-006 | Frame arena pertama di profil browser baru menahan loop sekitar 0,4 s setelah HUD Pulse tampil; tombol yang ditekan saat itu hilang (penyebab smoke Edge flaky) | MINOR | DIKETAHUI (rilis 1.0, keputusan Producer M5-04) | M3 | render, perf | AD (M4-01) | `tests/e2e/support/smoke.ts` (menunggu sim berjalan, mencatat jeda), `tests/render/m4-polish.test.ts` (pre-warm), `tests/e2e/m5-release.spec.ts` (BUG-006, `QA_LONG=1`) |
| BUG-007 | Market Cur saat ancang-ancang berwarna merah dengan luminans sama dengan lantai: hilang di grayscale, kontras 1,0:1 | MAYOR | DITUTUP (M5) | M3 | render, asset | AD (M4-01) | `tests/e2e/m3-visual.spec.ts` + `tests/e2e/support/m3_analyze.py`, `tests/e2e/support/m5_windup.py`, `tests/render/m4-polish.test.ts`, `tests/render/entity-layers.test.ts` (windup) |
| BUG-008 | Banner boss atau Warden dari run sebelumnya tetap tampil di run baru | MINOR | DITUTUP (M5) | M3 | ui | UI | `tests/unit/ui/hud-transient.test.ts` (BUG-008), `tests/e2e/m5-release.spec.ts` (BUG-008) |
| BUG-009 | Layar akhir run mengunci input 500 ms juga saat kembali dari The Keeping, dan fokus kembali ke Try Again | MINOR | DITUTUP (M5) | M3 | ui | UI | `tests/unit/ui/focus-nav.test.ts` (BUG-009), `tests/e2e/m5-release.spec.ts` (BUG-009) |
| BUG-010 | A-07: urutan fokus panah di the Glazier antara grid inventaris dan kolom kunci tidak mengikuti urutan visual | MAYOR | DITUTUP (M5) | M3 | a11y, ui | UI | `tests/unit/ui/focus-nav.test.ts` (BUG-010), `tests/e2e/m5-release.spec.ts` (A-07 by search) |
| BUG-011 | Ukuran teks Largest di 1280x720 dan 1366x768: monogram ikon cadangan ("CP") menumpuk dengan nama, efek, dan hotkey kartu | MAYOR | DITUTUP (M3) | M3 | ui, a11y | AD (ikon B) | `tests/e2e/m3-a11y.spec.ts` (A-05 skala 2) |
| BUG-012 | Affix `brood` (Tingkat B) tidak bisa muncul di build Tingkat B: tidak ada Warden B yang memilikinya dan pool acak hanya aktif di Crack 2 ke atas | MINOR | DITUTUP (M5) | M3 | data | GD | `tests/unit/qa/content-b.test.ts` (affix Warden dan pool Crack 2) |
| BUG-013 | Tick sim terus bertambah selama pemain diam di Temper dan the Glazier (3600 tick per 60 s); layar tidak berpindah dan tidak ada timer | MINOR | DITUTUP (M5) | M3 | sim | GP | `tests/unit/sim/choice-idle.test.ts`, `tests/e2e/m3-a11y.spec.ts` (A-12, `QA_LONG=1`) |
| BUG-014 | Panah dari kontrol di tepi kiri melompat ke tombol bar bawah (Reroll, Reset Controls) dan panah sebaliknya tidak kembali | MINOR | DITUTUP (M5-04) | M5 | a11y, ui | UI, LP (M5-03) | `tests/unit/ui/focus-nav.test.ts` (BUG-014), `tests/e2e/m5-release.spec.ts` (A-07 by search, `reversalFails`) |
| BUG-015 | Satu checkpoint replay dari run browser hidup tidak cocok di Node (step 32280 dari 46205); checkpoint sebelum dan sesudahnya serta hasil akhir sama | MINOR | DIKETAHUI (rilis 1.0, keputusan Producer M5-04) | M5 | sim, determinism | LP (diagnosis) | `tests/e2e/m5-release.spec.ts` (M5 release play, D-8 soak `QA_SOAK=1`) |
| BUG-016 | Mode buta warna tidak mengubah palet dunia; uji 1 detik proksi pada simulasi deuteranopia 5 dari 10 (kontrol penglihatan normal 5 dari 5) | MAYOR | DITUTUP (M5-04) | M5 | a11y, render | LP (M5-03), AD (palet final) | `tests/render/cvd-palette.test.ts`, `tests/e2e/support/m5_glance_cvd.py`, `m5_cvd.py`, `m3-visual.spec.ts` (mode warna, `QA_CV`) |
| BUG-017 | Mode Protanopia menurunkan selisih warna badan proyektil pemain vs proyektil musuh di bawah ambang A-04 langkah 3 (CIEDE2000 19,0 terhadap `kept-cyan`, 19,4 terhadap `kept-blue`; ambang 20) | MAYOR | DITUTUP (M5-05) | M5 (M5-04) | a11y, render | LP, AD (palet final) | `tests/e2e/support/m5_cvd.py` (kunci `mode-protan`), `tests/render/cvd-palette.test.ts` |
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
- Status: DITUTUP (M3)
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
- Status: DITUTUP (M3)
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
- Status: DITUTUP (M3)
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
- Status: DITUTUP (M3)
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
- Status: DITUTUP (M3)
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
- Status: DIKETAHUI (dibuka kembali M5; diterima sebagai known issue 1.0 oleh Producer, M5-04)
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

Perbaikan M4-01 (AD, 2026-11-17): renderer membangun arena pertama (`data.arenas[0]` dan biomanya) saat layar judul idle (`requestIdleCallback`, batas 600 ms), lalu merendernya sekali ke target scene offscreen: program shader dikompilasi, tekstur dan shadow map dekor diunggah. `setArena` memakai lingkungan itu bila arena dan bioma sama (`src/render/pipeline/prewarm.ts`, `renderer.ts`). Uji ulang QA: profil Edge baru, ukur jeda tick 14 di frame arena pertama; target di bawah 100 ms. Batas: bila pemain menekan Enter sebelum layar judul idle, pre-warm dilewati (perilaku lama).

**Uji ulang (diisi QA):** 2026-11-17, M5, `dist-e2e` contentHash 977ff134. Diukur di dalam halaman (sampel 4 ms dan rAF) dari layar Pulse sampai tick bertambah, `tests/e2e/m5-release.spec.ts` (BUG-006, `QA_LONG=1`). Edge baru, menunggu 2 s di judul (pre-warm sempat jalan): sim baru berjalan 489 sampai 532 ms setelah layar Pulse, rAF tertahan 506 sampai 514 ms (4 dari 4 peluncuran); Enter langsung: 493 dan 509 ms. Dengan flag GPU: 527 dan 533 ms. Chromium Playwright dengan GPU: 407 dan 423 ms. Pembanding: muat ulang di browser yang sama 2 sampai 8 ms, dan konteks baru di browser yang sama (cache HTTP terpisah, proses GPU sama) 1 sampai 50 ms. Main thread tidak pernah tertahan lebih dari 83 ms. Kesimpulan: jeda tetap sekitar 0,5 s di proses GPU dingin; pre-warm arena tidak cukup, jadi program shader lain (dugaan: aktor, efek, atau post) masih dikompilasi di frame Pulse pertama. Target di bawah 100 ms GAGAL. **DIBUKA KEMBALI (TERBUKA, MINOR).** Tes smoke tetap aman karena menunggu sim berjalan. Usul QA untuk rilis: DIKETAHUI (keputusan Producer). Bukti: `docs/qa/evidence/M5/bug006-edge.json`.

### BUG-007: Market Cur saat ancang-ancang berwarna merah dengan luminans sama dengan lantai

- Tingkat: MAYOR (pelanggaran pilar P2-b dan P2-c, test-plan 14.1)
- Status: DITUTUP (M5)
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

Perbaikan M4-01 (AD, 2026-11-17): tint badan merah dihapus. Saat ancang-ancang (semua Unlit dan Warden, boss memakai pose fase sendiri) outline `ink` 1 px diganti `danger-magenta` yang berdenyut ke campuran 50% `danger-core` tiap 4 tick, lewat atribut per instans `iOutline` di shader sprite (texel warna kunci `ink` saja). Badan tetap `unlit-body` (2,2:1 terhadap lantai). Kontras outline: 2,2:1 terhadap `floor-mid`, 1,7:1 terhadap `floor-lit` (hex mentah), fase terang lebih tinggi; screenshot preview 1280x720 terukur sekitar 2,2:1 terhadap lantai polos. Uji ulang QA: `m3_analyze.py` pada adegan puncak, `unlit_below_1_5` dan crop Market Cur ancang-ancang.

**Uji ulang (diisi QA):** 2026-11-17, M5, `dist-e2e` contentHash 977ff134, Chromium GPU 1920x1080. `m3-visual.spec.ts` 4 dari 4 lulus, lalu `m3_analyze.py` dan alat baru `tests/e2e/support/m5_windup.py` yang memisahkan piksel badan (separuh tergelap sprite, tanpa piksel lantai) dari piksel outline magenta. Market Cur ancang-ancang kini berbadan gelap `unlit-body` dengan outline magenta: badan 2,2:1 terhadap lantai di Low dan Reduce Effects, minimal 1,48:1 di High (halo bloom dari inti emisif tetangga); outline 2,15:1; grayscale badan 33 < lantai 86 < outline 121. Badan tidak lagi selevel lantai (dulu 1,0:1 di semua kualitas). Catatan metrik: `unlit_vs_floor_p10` lama di `m3_analyze.py` masih 1,21 (High) karena patch 7x7 di atas kaki jatuh di inti emisif magenta Hawker atau di outline, bukan badan; crop memperlihatkan badan gelap yang jelas (`docs/qa/evidence/M5/bug007-windup-crop.png`, kiri warna, kanan grayscale, atas High, bawah Low). **DITUTUP.** Bukti: `docs/qa/evidence/M5/bug007-windup.json`.

### BUG-008: Banner boss atau Warden dari run sebelumnya tetap tampil di run baru

- Tingkat: MINOR
- Status: DITUTUP (M5)
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

**Catatan perbaikan (diisi programmer):** UI M4-02, 2026-11-17: banner dan elemen sesaat HUD diukur dalam tick sim, dan `run.start` mengembalikan tick ke 0, jadi `untilTick` dari run lama (contoh 20000) membuat banner tampil lagi di run baru. HUD kini mendeteksi jam sim yang mundur (`runRestarted`) dan membersihkan banner, petunjuk kontrol, getar Rite, dan status HP rendah; `bannerShown` juga menolak banner yang berakhir lebih dari 2,5 detik di depan tick sekarang (`src/ui/presenters/hud-transient.ts`, `src/ui/screens/hud.ts`). Tes unit dua kasus. Probe browser: banner "Paper Sun, the Light-Eater" di Pulse 15 seed 31, Abandon, run baru seed 41 sampai Pulse 7: banner kosong.

**Uji ulang (diisi QA):** 2026-11-17, M5, `dist-e2e` contentHash 977ff134. Tes unit `hud-transient.test.ts` 2 kasus lulus. Browser (`m5-release.spec.ts` BUG-008): seed 31 Pulse 15, banner "Paper Sun, the Light-Eater" tampil; jalur pemain dengan tombol (Esc, Abandon Run, konfirmasi, Try Again): 4 s pertama run baru hanya "Pulse 1" atau kosong. Jalur hook seperti temuan M3 (run baru seed 41 sampai Pulse 7): hanya "Pulse 7" atau kosong. **DITUTUP.** Bukti: `docs/qa/evidence/M5/bug008.txt`.

### BUG-009: Layar akhir run mengunci input 500 ms juga saat kembali dari The Keeping

- Tingkat: MINOR
- Status: DITUTUP (M5)
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

**Catatan perbaikan (diisi programmer):** UI M4-02, 2026-11-17: `choiceLockApplies('archive')` kini false, jadi masuk ke akhir run dari The Keeping tidak memasang kunci 500 ms (kunci tetap berlaku saat layar muncul dari Pulse atau Abandon). UiContext mendapat `returning()`; akhir run mengingat tombol terakhir yang difokus dan memulihkannya saat kembali (`src/ui/menu-keys.ts`, `src/ui/screens/run-end.ts`, `src/ui/ui-root.ts`). Tes unit di `focus-nav.test.ts`. Probe browser: The Keeping, Esc, fokus `end-keeping`, panah kanan lalu Enter langsung membuka Title.

**Uji ulang (diisi QA):** 2026-11-17, M5, `dist-e2e` contentHash 977ff134. Tes unit `focus-nav.test.ts` (BUG-009) lulus. Browser tanpa pointer (`m5-release.spec.ts` BUG-009): The Keeping, Esc, fokus kembali ke `end-keeping`; panah kanan ke Title lalu Enter 36 ms setelah Esc membuka judul (dulu diabaikan dalam 500 ms). Kunci 500 ms tetap berlaku saat layar akhir datang dari Pulse (Enter langsung diabaikan, sesuai ui-spec 8.4). **DITUTUP.** Bukti: `docs/qa/evidence/M5/bug009.txt`.

### BUG-010: Urutan fokus panah di the Glazier tidak mengikuti urutan visual (A-07)

- Tingkat: MAYOR (butir aksesibilitas wajib A-07, accessibility.md bagian format)
- Status: DITUTUP (M5)
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

**Catatan perbaikan (diisi programmer):** UI M4-02, 2026-11-17: navigasi spasial (`src/ui/focus-nav.ts`) kini (1) memilih kandidat yang segaris dengan fokus (beam) sebelum kandidat menyamping yang lebih dekat, sehingga `shop-slot-6` bawah ke Begin Pulse, bukan `shop-lock-3`; (2) mengingat langkah terakhir yang keluar grup sehingga membaliknya kembali ke elemen asal (`shop-lock-3` kanan ke `shop-slot-4`, kiri kembali ke `shop-lock-3`); (3) melewati elemen tersembunyi. Tes unit memakai geometri Glazier 1080p dari screenshot QA, termasuk cek keterjangkauan: setiap kontrol bisa dicapai dari setiap kontrol dengan panah saja. Catatan untuk uji ulang: jalan A-07 di `m3-a11y.spec.ts` (dari titik masuk Tab, kanan 14, kiri 14, bawah 14, atas 14) secara struktur tidak bisa mencapai baris ke-2 sampai ke-4 kolom kunci dan baris bawah grid slot pada urutan spasial apa pun, karena tiap siklus berakhir di kolom tawaran dan Tab selalu masuk ke grup slot di slot 1. Probe dengan jalan yang sama masih melaporkan `missing` 6 elemen itu, walau semuanya tercapai lewat panah (contoh: tawaran 3, kanan, kunci 3, kanan, slot 4). Usul QA: cek keterjangkauan BFS per layar, atau tambah langkah bawah lalu kanan per baris.

**Uji ulang (diisi QA):** 2026-11-17, M5, `dist-e2e` contentHash 977ff134, Chromium 1920x1080, tanpa pointer. Usul UI diterima dengan bentuk lebih ketat: cek keterjangkauan per layar dengan pencarian (`m5-release.spec.ts`, A-07 by search) memakai tombol nyata (panah, Tab, Shift+Tab) dari fokus awal layar, ditambah cek tidak ada jebakan fokus (setiap kontrol bisa kembali ke fokus awal), cek arah (target panah selalu berada di arah tombol), dan cek balik (panah lalu panah sebaliknya). Ini mengukur maksud A-07 (semua kontrol terjangkau, urutan mengikuti tata letak) lebih setia daripada jalan siklus tetap M3, yang secara struktur tidak bisa mencapai sebagian kontrol. Hasil 13 layar (termasuk 4 tab Settings): 0 kontrol tak terjangkau, 0 jebakan, 0 pelanggaran arah. Glazier 19 dari 19. Langkah laporan M3: `shop-begin` atas `shop-slot-6` atas `shop-slot-3` bawah `shop-slot-6` bawah `shop-begin` (bukan `shop-lock-3`); tawaran 3, kanan `shop-lock-3`, kanan `shop-slot-4`, kiri kembali `shop-lock-3`. Tes unit BUG-010 lulus. **DITUTUP.** Sisa temuan cek balik dicatat terpisah sebagai BUG-014 (MINOR). Bukti: `docs/qa/evidence/M5/a07-search.json`.

### BUG-011: Ukuran teks Largest: monogram ikon cadangan menumpuk dengan teks kartu

- Tingkat: MAYOR (butir aksesibilitas wajib A-05)
- Status: DITUTUP (M3)
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
- Status: DITUTUP (M5)
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

GD, 2026-11-17 (M4-03): `brood` dipindah ke tier C (`content/data/affixes.csv`). Pemakainya hanya Warden C `warden_bulwark` dan pool acak Crack 2 ke atas, keduanya pasca 1.0 (scope dikunci di B). Memberikannya ke Warden B akan mempertebal Warden P4 tanpa data playtest. Build B kini tidak memuat `brood`; pool acak B = `volley`, `veiled`, `blinking`. Kode affix tidak berubah. `npm run data:check` 0 error. Alasan lengkap: `docs/balance-report.md` 9.2. QA: ulangi `content-b.test.ts` (uji Crack 2 kini memakai pool tanpa `brood`; cakupan `brood` di C lewat data C).

**Uji ulang (diisi QA):** 2026-11-17, M5, contentHash 977ff134. `content/data/affixes.csv`: `brood` tingkat C; `content/generated/game-data.json` (build B) memuat 0 kemunculan `brood`. `content-b.test.ts` lulus, termasuk uji Crack 2 tanpa error (12 seed). Keputusan GD (pindah ke C) sesuai scope Tingkat B. **DITUTUP.**

### BUG-013: Tick sim terus bertambah selama pemain diam di Temper dan the Glazier

- Tingkat: MINOR (A-12 [Saran]; tidak ada efek terlihat yang ditemukan)
- Status: DITUTUP (M5)
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

GP, 2026-11-17 (M4-03): tidak disengaja, dan berdampak gameplay: kondisi efek "tidak terluka N s" (`effects/conditions.ts`) dan cooldown efek memakai `world.tick`, jadi diam di toko bisa mengisinya. Perbaikan di `src/sim/create-sim.ts` `step()`: di fase `levelUp`, `shop`, dan `reward` step tetap berjalan (perintah diproses, replay tetap menghitung step) tetapi `world.tick` dan `runStats.runTicks` tidak naik. Deterministik: hasil hanya bergantung pada urutan step dan perintah; diam 0 atau 60 s di Temper dan toko kini memberi Pulse berikutnya yang identik (hash sama). Tes regresi `tests/unit/sim/choice-idle.test.ts` (5 kasus, merah sebelum perbaikan). Golden replay `golden-22.json` diregenerasi (`QA_UPDATE_GOLDEN=1`): input dan perintah identik, hanya checkpoint dan hash akhir berubah karena tick tidak lagi naik di fase pilihan; seed 11 dan 33 tidak berubah. Cek tick A-12 dikembalikan dari `expect.soft` ke `expect` (maksud tes asli kini terpenuhi). Efek samping: waktu run di layar akhir tidak lagi menghitung waktu di Temper dan toko. QA: jalankan ulang A-12 dengan `QA_LONG=1`.

**Uji ulang (diisi QA):** 2026-11-17, M5, `dist-e2e` contentHash 977ff134. `QA_LONG=1 npm run test:e2e`: A-12 lulus dengan cek tick keras, diam 60 s per konteks: Temper tick 80 ke 80, Glazier 80 ke 80, Pause 80 ke 80, Settings 80 ke 80, layar tidak berpindah. `choice-idle.test.ts` 5 kasus lulus. Efek samping yang diketahui: tes QA D-5 lama memeriksa tick 3600 setelah 3600 step; kini tick berhenti di 1260 saat run masuk toko. QA menyesuaikan cek itu ke tick Node (hash tiap 60 step tetap harus identik), bukan pelonggaran. **DITUTUP.**


### BUG-014: Panah dari kontrol di tepi kiri melompat ke tombol bar bawah dan tidak kembali

- Tingkat: MINOR (semua kontrol tetap terjangkau dan arah benar; urutan terasa melompat)
- Status: DITUTUP (M5-04)
- Ditemukan: 2026-11-17, M5, oleh QA
- Build: `dist-e2e` contentHash 977ff134
- Lingkungan: Chromium Playwright dengan GPU, 1920x1080
- Seed: seed hook (`goToScreen`)

**Langkah reproduksi**
1. Buka the Glazier (fokus Begin Pulse), Tab ke tawaran 1.
2. Panah kiri: fokus pindah ke Reroll di pojok kiri bawah layar.
3. Panah kanan: fokus ke Sell, bukan kembali ke tawaran 1.
4. Settings, tab Controls: dari kolom tombol pertama (contoh Move Up 1) panah kiri ke Reset Controls di pojok kiri bawah, panah kanan ke Back. Dari Pause 2 (kolom kiri baris terakhir) panah bawah ke Fuse 1 di tabel kanan, panah atas ke Stats 1.

**Diharapkan:** A-07 dan ui-spec 8.2: urutan mengikuti tata letak; langkah yang keluar grup dibalik kembali ke elemen asal (perbaikan BUG-010). Di tepi kiri, panah kiri sebaiknya diam atau pindah ke elemen di baris yang sama.

**Terjadi:** 12 dari 175 langkah balik gagal di 13 layar: Glazier 4 (tawaran 1 sampai 4, kiri ke Reroll, kanan ke Sell), Settings Controls 8 (7 dari kolom tombol pertama dan tab Graphics ke Reset Controls lalu Back, 1 dari Pause 2 ke Fuse 1 lalu Stats 1). Target selalu berada di arah tombol (0 pelanggaran arah) dan tidak ada jebakan fokus.

**Frekuensi:** selalu.

**Bukti:** `docs/qa/evidence/M5/a07-search.json` (`reversalFails` per layar), screenshot `docs/qa/evidence/M5/a07-glazier.png`.

**Catatan perbaikan (diisi programmer):** LP, 2026-11-17 (M5-03), `src/ui/focus-nav.ts`. (1) Panah kiri atau kanan hanya keluar grup ke kontrol di baris yang sama: dalam beam, atau celah vertikal paling banyak 2 kali tinggi fokus (agar kolom kunci Glazier tetap ke grid slot di sebelahnya). Di tepi tanpa kontrol sebaris, panah diam (tawaran 1 sampai 4 kiri, kolom tombol pertama Controls kiri). (2) Membalik langkah yang keluar grup kini selalu kembali ke asal, juga bila grup tujuan punya kandidat sendiri ke arah itu (Pause 2 bawah ke Fuse 1, atas kembali ke Pause 2). Tes unit `tests/unit/ui/focus-nav.test.ts` (4 kasus BUG-014, merah sebelum perbaikan; 24 kasus lulus). E2E lokal `m5-release.spec.ts` A-07 by search: 13 layar, 0 tak terjangkau, 0 jebakan, 0 pelanggaran arah, balik 0 gagal (Glazier 34/34, Controls 60/60). QA: ulangi A-07 by search.

**Uji ulang (diisi QA):** 2026-11-17, M5-04, `dist-e2e` contentHash 977ff134 dengan perubahan LP M5-03, Chromium 1920x1080, tanpa pointer. `npx playwright test tests/e2e/m5-release.spec.ts -g "A-07 by search"`: 13 layar, 0 kontrol tak terjangkau, 0 jebakan, 0 pelanggaran arah, langkah balik 0 gagal dari 158 (Glazier 34/34, Settings Controls 60/60; dulu 12 gagal dari 175). Tawaran 1 sampai 4 di Glazier dan kolom tombol pertama Controls: panah kiri tidak lagi melompat ke bar bawah. Langkah laporan BUG-010 tetap benar. Tes unit `focus-nav.test.ts` lulus di `npm run check`. **DITUTUP.** Bukti: `docs/qa/evidence/M5/logs/m504-a07-search.txt`.

### BUG-015: Satu checkpoint replay dari run browser hidup tidak cocok di Node

- Tingkat: MINOR (hasil run identik; replay hanya fitur dev dan e2e; tidak terulang di 10 run berikutnya. Dinaikkan ke MAYOR bila terulang atau bila divergensinya bertahan)
- Status: DIKETAHUI (diterima sebagai known issue 1.0 oleh Producer, M5-04; diagnosis LP tetap terbuka)
- Ditemukan: 2026-11-17, M5, oleh QA
- Build: `dist-e2e` contentHash 977ff134 (sebelum perubahan LP M5)
- Lingkungan: Chromium Playwright dengan GPU, 1920x1080, kualitas Low, Reduce Effects ON, loop hidup `setTimeScale(4)`
- Seed: 1274301690 (dipilih UI), kelas Chorister, `run_b`
- Replay: hilang (file `tests/out/qa/m5-bell.json` tertimpa run berikutnya; sejak itu nama file memuat seed)
- Kelas, bioma, Pulse: Chorister, The Moth Market, Pulse 11 (menang di Pulse 15)

**Langkah reproduksi**
1. `QA_LONG=1 npx playwright test tests/e2e/m5-release.spec.ts -g "M5 release play"` (bot tombol nyata, seed acak per run).
2. Run Chorister diekspor dengan `exportReplay()` dan diputar di proses Node (`sim-cli.ts replay`).

**Diharapkan:** D-8: setiap checkpoint replay rekaman browser cocok di Node (architecture 4.2, test-plan 5.3).

**Terjadi:** `mismatchAt` 32280 dari 46205 step: hash Node `b2f0b455`, browser `bdae4bd5`. Checkpoint 32220 dan 32340 cocok, begitu juga semua checkpoint sampai 46200 (menang di step 46196), jadi state tidak menyimpang permanen. Saat itu fase Pulse 11 berjalan, HP 43 penuh, tidak ada command di sekitar step itu. Dugaan QA: nilai ber-hash yang ditimpa sim tiap tick sempat berbeda satu kali (sumber di luar input dan command yang direkam), atau hash diambil pada saat yang berbeda. Cara memperbaiki milik LP.

**Frekuensi:** 1 dari 14 replay browser yang diperiksa di M5 (sekitar 2900 checkpoint): 3 E-13, D-8, 6 run tes main rilis (2 menang Pulse 15), 4 run soak D-8 (`docs/qa/evidence/M5/d8-soak.json`, semua cocok).

**Bukti:** kegagalan tes dan probe Node QA (hash per checkpoint di sekitar step 32280) di `docs/qa/evidence/M5/logs/m5-play-first.txt`; soak `docs/qa/evidence/M5/d8-soak.json`.

**Catatan perbaikan (diisi programmer):** LP, 2026-11-17 (M5-03), diagnosis singkat, belum diperbaiki (status tetap TERBUKA). Yang sudah disingkirkan: (1) beda floating point antar mesin: sim hanya memakai operasi yang dibulatkan tepat (`Math.sqrt`, `floor`, `round`, `min`, `max`, `abs`) plus trig sendiri `src/core/math`, tanpa `Math.sin`, `pow`, `exp`, `hypot`. (2) `-0` dari `quantizeAim` (aim di (-1/32, 0] memberi `-0`, JSON menyimpannya sebagai `0`, dan hasher membedakan `-0` dari `0`): diuji di Node dengan 6 replay QA (`m5-bell`, 2 soak bell, `m5-blade`, soak lantern, `e13-seed101`), semua aim 0 diganti `-0`: 0 checkpoint berbeda, hasil akhir sama. Jalur ini tidak mencapai state ber-hash. (3) Command tanpa rekaman: tes main rilis tidak mengirim command lewat hook, dan `send` hook lewat `commands.send` (direkam). (4) Penulisan ke view sim dari render, UI, atau audio: tidak ditemukan. Urutan di loop: hash diambil tepat setelah `sim.step` di `runTick`, sebelum render. Dugaan tersisa: nilai ber-hash yang dihitung dari sesuatu di luar replay pada satu tick, belum terlokalisasi. Usul langkah berikut (LP atau GP, perubahan kecil di `src/app/replay.ts` dan `src/sim/state-hash.ts`, hanya build dev/e2e): saat checkpoint, simpan juga hash per subsistem (pemain, musuh, proyektil, zona, run, RNG) agar kejadian berikut langsung menunjuk subsistem yang berbeda. Tidak diperbaiki karena penyebab belum jelas (aturan brief: hanya bila jelas dan aman bagi determinisme).

**Uji ulang (diisi QA):**

### BUG-016: Mode buta warna tidak mengubah palet dunia; telegraf di bawah pemain sulit dikenali pada deuteranopia

- Tingkat: MAYOR (butir aksesibilitas wajib A-04 gagal: langkah 5 di bawah 4 dari 5, syarat mode menggeser palet bahaya dan pemain tidak terpenuhi)
- Status: DITUTUP (M5-04)
- Ditemukan: 2026-11-17, M5, oleh QA
- Build: `dist-e2e` contentHash 977ff134
- Lingkungan: Chromium Playwright dengan GPU (RTX 3060), 1920x1080, kualitas High
- Seed: adegan uji 1 detik `m3-visual.spec.ts` (seed tetap di tes)

**Langkah reproduksi**
1. `npx playwright test tests/e2e/m3-visual.spec.ts`: tangkapan `peak-high` dan `peak-deutan` (Color Vision Deuteranopia) di `tests/out/qa/m3/` berbeda hanya pada fase animasi sprite; telegraf, proyektil, dan pemain memakai warna yang sama. Tritan identik kecuali ikon Rite.
2. `python tests/e2e/support/m5_glance_cvd.py make`: lima bingkai uji 1 detik disimulasikan deuteranopia (Machado 2009, keparahan 1,0), diperkecil ke 480x270, diacak.
3. Berikan ke subagent proksi baru tanpa konteks (prompt sama dengan M3, tanpa menyebut warna), skor dengan `m5_glance_cvd.py score`.

**Diharapkan:** accessibility.md A-04: mode buta warna menggeser palet bahaya dan pemain sesuai jenisnya; langkah 5 (uji 1 detik proksi pada 5 bingkai simulasi deuteranopia) minimal 4 dari 5.

**Terjadi:** mode Color Vision hanya menukar token warna UI (`[data-cv]`), dunia game tidak berubah. Dua proksi deuteranopia: 3 dari 5 dan 2 dari 5 (total 5 dari 10). Pemain selalu ditemukan (10 dari 10, galat 2 sampai 7 px); yang gagal adalah ancaman terdekat ketika telegraf merah tepat di bawah pemain (boss, tumpukan X) atau Unlit yang menempel: di simulasi telegraf merah tampak kuning-zaitun dan proksi memilih Unlit atau berkas lain 37 sampai 48 px jauhnya. Kontrol penglihatan normal dengan bingkai yang sama: 5 dari 5 (proksi menyebut "red X warning sits right on the player"). Ukuran lain lolos: inti proyektil musuh vs lantai 7,14:1 (deutan), selisih CIEDE2000 badan proyektil pemain vs musuh 21,4 (deutan, ambang 20), tetapi rata-rata warna sprite proyektil 17,0 (deutan) dan inti pucat keduanya 3,5 (inti memang sama-sama pucat menurut style guide 1.3, jadi ukuran 3x3 di pusat tidak dipakai untuk putusan).

**Frekuensi:** selalu (mode tidak menyentuh palet dunia); proksi 2 dari 2 sesi di bawah ambang.

**Bukti:** `docs/qa/evidence/M5/a04-glance-deutan.json` (kunci, jawaban, skor kedua proksi dan kontrol), `docs/qa/evidence/M5/a04-cvd-tokens.json`, contoh bingkai `docs/qa/evidence/M5/glance-deutan-b.png`.

**Catatan perbaikan (diisi programmer):** usul QA, keputusan AD dan LP: terapkan arah art-direction 8.3 (protan dan deutan: `danger-red` telegraf digeser ke merah kemagentaan yang lebih terang; tritan: `danger-violet` ke magenta) lewat ganti LUT palet per mode (art-pipeline sudah merancang LUT), lalu QA mengulang langkah 3 dan 5 untuk ketiga mode. Alternatif scope (Producer): hapus atau ganti nama opsi agar tidak menjanjikan palet dunia, tetapi langkah 5 tetap harus lolos di mode Off.

LP, 2026-11-17 (M5-03): diperbaiki di render, hanya tampilan (state hash sama di semua mode: `m3-visual.spec.ts` peak 7c7dfee6 untuk Off, protan, deutan, tritan; draw call sama). (1) Palet dunia per mode `src/render/pipeline/cvd-palette.ts`: hanya token bahaya yang diganti, token pemain dan netral tidak pernah berubah. Protan `danger-red #FF7381`, `danger-magenta #F27BA6`, `danger-violet #E68CC4`; deutan `#E65087`, `#F2368C`, `#CC70A0`; tritan `danger-violet #E600D6` (arah art-direction 8.3). Dipilih dengan simulasi Machado 2009 (matriks sama dengan `m5_cvd.py`) untuk menaikkan jarak CIEDE2000 terkecil ke semua token pemain: deutan merah vs `kept-gold` 18,2 ke 28,0, isian telegraf vs zona Rite 7,1 ke 15,0, violet vs `kept-blue` 2,6 ke 18,0; protan violet vs biru 5,0 ke 15,5, magenta 13,0 ke 19,0, kontras merah di lantai 1,52 ke 2,36. [Asumsi] Nilai hex usul LP, AD pemilik palet final (bisa dipindah ke `art/palette.json`). (2) Renderer merasterisasi ulang atlas sprite dari palet mode saat Color Vision berubah (mata Unlit, cincin proyektil musuh, mata Warden), dan membangun ulang warna telegraf, boss, spawn, aura Warden, dan outline ancang-ancang (`recolorSpriteAtlas`, `EntityLayers.setPalette`). Lapis L4 ikut. (3) Pola bahaya di setiap mode buta warna (`src/render/shaders/area.ts`): tepi telegraf, boss, dan spawn 2 px bergaris tiap 3 px antara warna bahaya dan tint pucat (dekat `danger-core`), isian pita diagonal 4 px (35% dan 60% alpha gaya). Zona pemain tetap polos, jadi garis berarti bahaya walau hue tidak membantu. Mode Off tidak berubah. Tes unit `tests/render/cvd-palette.test.ts` (10 kasus). Pemeriksaan LP sendiri (bukan putusan QA): lima bingkai uji 1 detik dari skenario `m3-visual.spec.ts` di mode Deuteranopia, `m5_glance_cvd.py make`, satu proksi baru tanpa konteks, skor `m5_glance_cvd.py score`: 5 dari 5 (galat pemain 4 sampai 7 px, ancaman 6,5 sampai 20,5 px). Simulasi protan dan tritan pada bingkai G4 diperiksa visual: telegraf tampil sebagai pita bergaris pucat, jelas beda dari pemain dan Glint. Catatan untuk QA: langkah 5 A-04 menurut accessibility.md diuji di mode Off; mode Off sengaja tidak diubah (gaya dikunci CD), jadi usul uji ulang langkah 3 dan 5 per mode yang sesuai seperti usul QA di atas.

**Uji ulang (diisi QA):** 2026-11-17, M5-04, `dist-e2e` contentHash 977ff134 dengan perubahan LP M5-03, Chromium GPU (RTX 3060), 1920x1080, High. Bingkai ditangkap QA sendiri (bukan bingkai LP): `QA_CV=<mode> npx playwright test tests/e2e/m3-visual.spec.ts -g "glance frames"` (opsi baru QA: Color Vision diset ke mode itu, nama `cv-<mode>-glance-*`), lalu `m5_glance_cvd.py make --sim <mode> --prefix cv-<mode>-` dengan simulasi jenis yang sama.
1. Dunia kini berubah per mode: dibanding tangkapan mode Off QA dari suite yang sama, 0,75 sampai 1,23% piksel berubah lebih dari 24 level di G3 dan G4 (telegraf, boss, cincin), telegraf tampil sebagai pita bergaris pucat (`m504-glance-deutan-boss.png`). State hash sama di semua mode (`m3-visual.spec.ts` peak 7c7dfee6 untuk Off, protan, deutan, tritan; draw call 21 sama).
2. Langkah 5 (resmi, mode Deuteranopia + simulasi deuteranopia), satu proksi baru tanpa konteks, sesi pertama: **4 dari 5**. Pemain 5 dari 5 (galat 4 sampai 8 px). Adegan yang gagal di M5 kini lolos: G3 boss (ancaman 7,5 px, dulu 47,5) dan G4 tumpukan X (13,3 px). Satu gagal: G5 Pulse 13, ancaman terdekat adalah Unlit yang menempel tepat di pemain (0,8 px), proksi menunjuk berkas 30,8 px jauhnya (radius 30); aturan 1,2 kali jarak terdekat tidak menolong. Tidak terkait palet bahaya.
3. Indikatif (sesi 2 dan 3 proksi yang sama, tata letak adegan sudah pernah dilihat): Protanopia 4 dari 5 (G5 sama), Tritanopia 5 dari 5.
4. Langkah 3 per mode (`m5_cvd.py`, kini membaca palet mode dari `src/render/pipeline/cvd-palette.ts`, kunci `mode-<nama>`): inti bahaya vs lantai 4,84 sampai 6,48:1 di semua mode (ambang 4,5); badan proyektil pemain vs musuh (CIEDE2000, ambang 20): Deuteranopia 26,2 (dulu 21,4), Tritanopia 76,5, **Protanopia 19,0** (Off di simulasi protan 31,8). Kegagalan Protanopia dicatat terpisah sebagai BUG-017, karena berasal dari nilai palet baru, bukan dari masalah BUG-016 (telegraf di bawah pemain).
Masalah BUG-016 (mode tidak menyentuh dunia, telegraf deuteranopia tidak terbaca) terbukti beres. **DITUTUP.** Bukti: `docs/qa/evidence/M5/m504-a04-glance.json`, `m504-a04-cvd-tokens.json`, `m504-glance-deutan-boss.png`.

### BUG-017: Mode Protanopia menurunkan selisih warna proyektil pemain vs proyektil musuh di bawah ambang A-04

- Tingkat: MAYOR (butir aksesibilitas wajib A-04 langkah 3 gagal di mode yang sesuai, test-plan 14.1. Selisih ke ambang kecil, sekitar 1 satuan CIEDE2000, tetapi ambang tertulis dan QA tidak melonggarkannya setelah hasil keluar)
- Status: TERBUKA
- Ditemukan: 2026-11-17, M5-04, oleh QA
- Build: kerja lokal 2026-11-17 dengan perubahan LP M5-03 (`src/render/pipeline/cvd-palette.ts`), contentHash 977ff134
- Lingkungan: token palet dan sprite proyektil, simulasi Machado 2009 protanopia keparahan 1,0 (sama dengan M5)
- Seed: tidak relevan

**Langkah reproduksi**
1. `python tests/e2e/support/m5_cvd.py out.json`.
2. Baca kunci `mode-protan` (palet mode Protanopia dengan simulasi protanopia).

**Diharapkan:** accessibility.md A-04 langkah 3: selisih CIEDE2000 antara proyektil pemain dan proyektil musuh minimal 20 di tiap mode buta warna dengan simulasi jenisnya (cara M5: warna badan, karena inti keduanya sama-sama pucat).

**Terjadi:** mode Protanopia mengganti `danger-magenta` (cincin `fx-shot-danger`) ke `#F27BA6`. Di simulasi protan, cincin itu berjarak 19,0 dari `kept-cyan` (badan `fx-shot-kept` dan `fx-shot-lantern-bolt`), 19,4 dari `kept-blue`, 26,6 dari `kept-white`; rata-rata warna sprite 15,3 (palet Off 24,2). Dengan palet Off di simulasi protan: cyan 31,8, putih 40,1, tetapi biru 16,2 (pasangan biru tidak diukur di M5). Jadi mode ini menaikkan pasangan terburuk (16,2 ke 19,0) tetapi belum mencapai 20, dan menurunkan pasangan badan utama (31,8 ke 19,0). Deuteranopia (26,2 / 35,5 / 27,5) dan Tritanopia (76,5 / 71,6 / 38,9) lolos. Kontras inti bahaya vs lantai lolos di semua mode.

**Dampak:** pemain protanopia yang memilih mode Protanopia. Pembeda non-warna tetap ada (proyektil musuh berinti pucat dan beroutline `ink`, proyektil pemain tanpa outline, style guide 1.3), dan uji 1 detik protan indikatif 4 dari 5, tetapi bingkai uji 1 detik tidak memuat proyektil musuh, jadi tidak membuktikan butir ini.

**Frekuensi:** selalu (nilai palet).

**Bukti:** `docs/qa/evidence/M5/m504-a04-cvd-tokens.json` (kunci `mode-protan` dan `protan`). Pencarian kasar QA di ruang HSV keluarga merah sampai violet menemukan 347 nilai dengan jarak minimal 20 ke ketiga warna proyektil pemain dan minimal 19 ke semua token pemain, jadi ambang bisa dicapai; pilihan nilai milik AD dan LP.

**Catatan perbaikan (diisi programmer):**

**Uji ulang (diisi QA):**

---

## Bug yang diketahui (untuk rilis)

Diisi saat M5. Hanya bug MINOR berstatus DIKETAHUI yang boleh ada di sini. BLOCKER dan MAYOR tidak boleh dibawa ke rilis.

**Perbaikan dan uji ulang M5-05 (Producer, 2026-11-17):** `danger-magenta` mode Protanopia di `src/render/pipeline/cvd-palette.ts` diganti `#F27BA6` ke `#F47C94` (kandidat terdekat yang memenuhi ambang dengan margin, kontras terhadap `floor-mid` 2,51 vs 2,54 sebelumnya). Diukur dengan alat QA `python tests/e2e/support/m5_cvd.py` (kunci `mode-protan`): CIEDE2000 badan proyektil pemain vs musuh 21,3 (`kept-cyan`), 25,8 (`kept-blue`), 26,1 (`kept-white`), semua di atas ambang 20; inti bahaya vs lantai tetap 6,28 / 4,84. `npm run check` lulus (668 tes). Status: DITUTUP. Catatan: uji 1 detik protan dengan proksi baru tidak diulang (tidak diwajibkan A-04); nilai palet final tetap milik AD.

Final M5-04 (2026-11-17): keputusan Producer menerima BUG-006, BUG-014 (bila belum beres), dan BUG-015 sebagai known issues 1.0. BUG-014 DITUTUP di uji ulang M5-04, jadi tidak masuk daftar. BUG-017 (MAYOR) tidak boleh masuk daftar ini.

| Id | Ringkasan untuk pemain (Inggris) | Solusi sementara |
|---|---|---|
| BUG-006 | The first Pulse after starting the browser can hitch for about half a second while graphics warm up. Keys pressed during that moment may be ignored. | Wait a moment after the Pulse starts, or press the key again. Later Pulses and later sessions in the same browser do not hitch. |
| BUG-015 | (Developer replays only) A recorded replay can very rarely report one checkpoint mismatch even though the run plays back to the same result. No effect on play. | None needed for players. |
