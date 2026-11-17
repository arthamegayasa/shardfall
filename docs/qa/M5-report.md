# Laporan QA M5: Uji Ulang Bug dan Tes Rilis Final

Tugas: M5-02. Penguji: QA Lead. Tanggal: 2026-11-17. Untuk: Producer.
Cakupan: uji ulang BUG-006 sampai BUG-013 (status MENUNGGU UJI ULANG), tes rilis (check, build, e2e semua browser terpasang, build produksi di base path), kriteria keluar M4 (HANDOFF 4.1, test-plan 13.4) dan M5 (test-plan 13.5), daftar bug yang diketahui.

## 1. Kepala

| Item | Nilai |
|---|---|
| Build | Kerja lokal 2026-11-17 setelah commit `fix(m4)`, `package.json` 1.0.0, `contentHash` 977ff134, tingkat konten B, profil `run_b` (15 Pulse). LP bekerja paralel (versi, README, fallback WebGL2, kredit); angka akhir di bagian 7 dari putaran terakhir |
| Mesin | Windows 11, Ryzen 7 5800H, RTX 3060 Laptop + AMD Radeon terintegrasi |
| Node, Playwright | Node 24.19.0, Playwright 1.64.1 |
| Browser | Chromium Playwright 156 (headless, GPU lewat ANGLE D3D11), Google Chrome 157.0.8103.40, Microsoft Edge 157.0.4341.60, Firefox Playwright 157.0, WebKit Playwright 27.2 (build cadangan webkit-2336, bukan revisi 2370 yang diminta Playwright 1.64.1: proksi Safari, indikatif) |
| Build produksi | `npm run build` lalu `vite preview --outDir dist --base /shardfall/` di `http://127.0.0.1:4180/shardfall/` (sama dengan GitHub Pages) |

Bukti ringkas di `docs/qa/evidence/M5/` (path di laporan ini relatif ke folder itu). Bukti mentah di `tests/out/qa/m5/` dan `tests/out/qa/m3/` (di-gitignore, bisa dibuat ulang dengan perintah bagian 9).

## 2. Putusan

**Putusan rilis QA: TIDAK SIAP.** Kriteria M4: **GAGAL**. Kriteria M5: **GAGAL** (karena nol MAYOR dan pernyataan siap; suite otomatis default lolos, satu tes opt-in `QA_LONG` merah sesuai BUG-006 yang dibuka kembali).

Satu-satunya penghalang: **BUG-016 (MAYOR, baru)**. Butir aksesibilitas wajib A-04 gagal: opsi Color Vision hanya mengubah warna UI, dunia game tidak berubah, dan uji 1 detik proksi pada bingkai simulasi deuteranopia memberi 5 dari 10 (ambang 4 dari 5 per sesi), sementara kontrol penglihatan normal dengan bingkai yang sama 5 dari 5. Pemain selalu ditemukan; yang hilang adalah telegraf merah tepat di bawah pemain, yang di deuteranopia tampak kuning-zaitun.

Selain itu build rilis siap: nol BLOCKER, BUG-007 dan BUG-010 (MAYOR M3) DITUTUP, tes otomatis rilis lolos di Chromium, Chrome, dan Edge (Firefox: semua merah karena alat Playwright atau tes, bagian 7.2), build produksi bersih (nol error konsol) di 5 browser, satu run penuh tiap kelas, Continue, unlock Silt, pengaturan setelah reload, kualitas Low dan Reduce Effects terbukti.

Jalan tercepat ke SIAP (keputusan Producer, cara memperbaiki milik AD dan LP): terapkan palet dunia per mode (arah art-direction 8.3 lewat ganti LUT palet), lalu QA mengulang A-04 langkah 3 dan 5 (sekitar 15 menit, alat sudah ada). Alternatif scope: Producer menerima A-04 sebagai pengecualian tertulis, tetapi QA tidak bisa menyatakan checklist aksesibilitas terpenuhi.

## 3. Uji ulang bug

| Id | Tingkat | Hasil | Bukti utama |
|---|---|---|---|
| BUG-006 | MINOR | **DIBUKA KEMBALI.** Edge profil baru: sim mulai 489 sampai 532 ms setelah layar Pulse, rAF tertahan sekitar 0,5 s, juga setelah menunggu 2 s di judul (pre-warm sudah jalan). Chromium dengan GPU 407 sampai 431 ms. Proses GPU hangat (muat ulang atau konteks baru di browser yang sama): 1 sampai 15 ms. Target di bawah 100 ms gagal; pre-warm arena tidak menutup semua program shader | `bug006-edge.json` |
| BUG-007 | MAYOR | **DITUTUP.** Market Cur ancang-ancang berbadan gelap dengan outline magenta: badan 2,2:1 terhadap lantai (Low, Reduce), minimal 1,48:1 di High (halo bloom), outline 2,15:1; grayscale badan 33 < lantai 86 < outline 121 (dulu badan = lantai, 1,0:1) | `bug007-windup.json`, `bug007-windup-crop.png` |
| BUG-008 | MINOR | **DITUTUP.** Jalur pemain (Esc, Abandon, Try Again) dan jalur hook M3: banner Paper Sun tidak pernah tampil di run baru | `bug008.txt` |
| BUG-009 | MINOR | **DITUTUP.** Kembali dari The Keeping: fokus `end-keeping`, Enter di Title 36 ms setelah Esc diterima; kunci 500 ms dari Pulse tetap berlaku | `bug009.txt` |
| BUG-010 | MAYOR | **DITUTUP.** Pencarian keterjangkauan 13 layar: 0 kontrol tak terjangkau, 0 jebakan, 0 pelanggaran arah. Langkah laporan M3 kini benar (slot 6 bawah ke Begin Pulse; kunci 3 kanan slot 4 kiri kunci 3). Sisa: BUG-014 (MINOR) | `a07-search.json` |
| BUG-012 | MINOR | **DITUTUP.** `brood` tingkat C, 0 kemunculan di data build B; `content-b.test.ts` lulus | `docs/qa/bugs.md` |
| BUG-013 | MINOR | **DITUTUP.** A-12 dengan `QA_LONG=1`: tick tetap 80 selama 60 s di Temper, Glazier, Pause, Settings; `choice-idle.test.ts` 5 kasus lulus | log e2e bagian 7 |

Uji ulang BUG-008, BUG-009, dan BUG-010 (tes browser) juga lulus di Chrome, Edge, dan Firefox.

Catatan A-07 (usulan UI, diterima dengan bentuk lebih ketat): jalan siklus tetap di `m3-a11y.spec.ts` (Tab lalu kanan, kiri, bawah, atas masing-masing 14) secara struktur tidak bisa mencapai sebagian kontrol pada urutan spasial apa pun, jadi tidak mengukur maksud A-07. Tes baru `A-07 by search` di `tests/e2e/m5-release.spec.ts` menelusuri tiap layar dengan tombol nyata (panah, Tab, Shift+Tab) dari fokus awal sampai tidak ada tombol yang belum dicoba, lalu memeriksa: setiap kontrol terlihat terjangkau, setiap kontrol bisa kembali ke fokus awal (tanpa jebakan), setiap langkah panah menuju arah tombolnya, dan langkah panah dibalik dengan panah sebaliknya. Tiga cek pertama wajib lolos (assert); cek balik dicatat sebagai data dan memunculkan BUG-014. Ini lebih ketat dari M3 (M3 tidak memeriksa jebakan, arah, dan balik), jadi bukan pelemahan. Jalan siklus lama tetap ada tanpa perubahan.

## 4. Bug baru

| Id | Judul | Tingkat | Pemilik usulan |
|---|---|---|---|
| BUG-014 | Panah kiri dari kontrol di tepi kiri melompat ke tombol bar bawah (Reroll, Reset Controls) dan panah kanan tidak kembali (12 dari 175 langkah balik, Glazier dan Settings Controls) | MINOR | UI |
| BUG-015 | Satu checkpoint replay dari run browser hidup tidak cocok di Node (step 32280 dari 46205); checkpoint lain dan hasil akhir sama; 1 dari 14 replay | MINOR | LP (diagnosis) |
| BUG-016 | Mode buta warna tidak mengubah palet dunia; uji 1 detik deuteranopia 5 dari 10 (kontrol 5 dari 5) | MAYOR | AD (palet), LP (LUT) |

Detail, langkah reproduksi, dan bukti ada di `docs/qa/bugs.md`. Alasan tingkat BUG-015: hasil run identik (semua checkpoint lain cocok sampai kemenangan Pulse 15), replay hanya fitur dev dan e2e, dan 13 replay lain (sekitar 2900 checkpoint, termasuk satu run menang 50800 step) cocok penuh. Bila terulang atau divergensinya bertahan, QA menaikkannya ke MAYOR. File replay aslinya tertimpa run berikutnya (kesalahan QA, kini nama file memuat seed); bukti yang tersisa adalah log kegagalan dan probe Node QA di `logs/m5-play-first.txt`.

## 5. Kriteria M4 (HANDOFF 4.1, test-plan 13.4)

| ID | Kriteria | Putusan | Bukti |
|---|---|---|---|
| M4-01 | Bug bash terstruktur | LOLOS dengan catatan | Tiap layar (pencarian A-07, 13 layar), tiap kelas (run penuh dengan tombol nyata, 3 putaran), tiap pengaturan (A-01 sampai A-12, kualitas, Reduce Effects), build produksi 5 browser. Temuan dicatat (BUG-014, 015, 016). Input ekstrem: resize saat Pulse (E-17) lolos; banyak tombol bersamaan dan resize saat toko tidak diuji khusus |
| M4-02 | Nol BLOCKER dan MAYOR terbuka | **GAGAL** | BLOCKER 0. MAYOR terbuka 1: BUG-016 |
| M4-03 | Kompatibilitas | LOLOS | Bagian 7.2: suite e2e penuh lolos di Chromium, Chrome, Edge (satu-satunya merah: retest BUG-006 yang dibuka kembali, dan artefak konfigurasi lintas browser). Firefox: semua kegagalan karena alat atau tes (setViewportSize, CDP), alur inti, determinisme, A-01, A-02, A-03, A-07, A-10, A-11 lolos, smoke produksi bersih. WebKit: smoke e2e dan smoke produksi (proksi Safari, build cadangan). Safari asli TIDAK DIUJI (tidak ada Mac, keputusan Producer 2026-11-16) |
| M4-04 | Checklist aksesibilitas (semua butir wajib) | **GAGAL** | Bagian 6: A-04 gagal (BUG-016); A-01 sampai A-03, A-05 sampai A-10 lolos |
| M4-05 | Durasi run sesuai target GD (bot) | LOLOS | Bot `good` 120 seed per kelas, perkiraan durasi run menang (waktu sim + 20 s per toko + 4 s per kartu + 5 s per peti): Lamplighter 14,4, Chorister 15,3, Vintner 14,5 menit, rata-rata 14,7 menit. Target GD T6 12 sampai 16 menit (`balance-report.md` 9.1). Catatan: HANDOFF 4.1 dan test-plan M4-05 masih menulis 15 sampai 20 menit; 14,7 sedikit di bawah angka lama itu. Waktu toko 20 s adalah asumsi GD, belum diukur pada manusia. Bukti `bots-run_b.txt` |
| M4-06 | Pilar 2 di arena paling ramai | LOLOS (proksi) | P2-b grayscale (BUG-007 DITUTUP), P2-c kontras inti proyektil musuh 7,21:1 dan sorotan pemain 7,1 sampai 7,3:1, P2-d CW-4 lolos, P2-f urutan gambar 8 dari 8. P2-a uji 1 detik proksi penglihatan normal 5 dari 5; konfirmasi manusia tetap sisa untuk Dok (Keputusan 2026-11-17) |
| M4-07 | Pilar 3 di kualitas rendah | LOLOS sebagian | 8.4 skala pixel 100% blok seragam di Low; 8.5 DoF mati di Low (M3, tidak berubah). CW-3 TIDAK DIUJI (tidak ada hook isolasi lapis, pertanyaan M3) |
| M4-08 | Performa dan memori | TIDAK DIUKUR ULANG | PF-1 sampai PF-4 dan PF-7 lolos di M3 (p95 8,2 ms di GPU terintegrasi). M5 tidak mengulang uji performa headed; tes stres e2e indikatif lolos. PF-5 dan PF-6 (memori) tidak punya alat ukur |
| M4-09 | Uji ulang perbaikan | LOLOS | BUG-007 dan BUG-010 diverifikasi ulang dengan tes regresi (unit dan e2e) |

### 5.1 Kriteria M5 (test-plan 13.5, HANDOFF 4.1)

| ID | Kriteria | Putusan | Bukti |
|---|---|---|---|
| M5-01 | Build rilis lulus semua tes | LOLOS dengan catatan | `npm run check` akhir kode 0 (654 tes unit); `npm run test:e2e` default di build akhir: 52 tes, 39 lulus, 12 dilewati (opt-in), 1 gagal (`full-run` kalah saat fast-forward overtime Warden tanpa HP diisi, seed acak UI; tes diperbaiki, ulang 4 dari 4 lulus); e2e Chromium, Chrome, Edge lolos (7.2). Opt-in `QA_LONG`: retest BUG-006 merah (bug MINOR terbuka) |
| M5-02 | Replay emas di build rilis | LOLOS | Replay emas lulus di `npm test` (Node, sumber yang sama); D-5 browser vs Node identik di Chromium, Chrome, Edge, Firefox dari build tes commit yang sama |
| M5-03 | Tidak ada kode atau flag tes di bundle | LOLOS | 7.1 |
| M5-04 | Smoke rilis semua browser | LOLOS | 7.3: 5 browser, 0 error konsol, 0 permintaan gagal, base path benar |
| M5-05 | Kredit lengkap | LOLOS (skrip QA) | Skrip M2-10 diperluas ke `art/sprites`, `art/tiles`, `art/vfx`, `audio/`, `content/levels`: 104 file, 0 tanpa baris di `docs/credits.md` (setelah pekerjaan kredit LP). Pemeriksaan Producer tetap diperlukan |
| M5-06 | Daftar bug yang diketahui | GAGAL | Daftar terisi (BUG-006, BUG-014, BUG-015), tetapi syarat nol BLOCKER dan MAYOR gagal karena BUG-016 |
| M5-07 | Teks final | LOLOS | `data:check` string 0 error 0 peringatan (DV-3 sampai DV-5) |
| M5-08 | Pernyataan siap QA | **GAGAL** | Putusan TIDAK SIAP (bagian 2) |

## 6. Checklist aksesibilitas (accessibility.md)

| ID | Butir | Putusan | Bukti M5 |
|---|---|---|---|
| A-01 | Remap | LOLOS | `m3-a11y.spec.ts` A-01 lulus di 4 browser |
| A-02 | Kurangi efek, kilat | LOLOS | A-02 langkah 4 lulus; Reduce Effects dipakai di run Vintner dan tersimpan setelah reload |
| A-03 | Matikan angka damage | LOLOS | A-03 lulus |
| A-04 | Buta warna, info bukan hanya warna | **GAGAL** | Langkah 3 (token palet, Machado 2009): inti bahaya vs lantai 4,84 sampai 6,48:1 di ketiga simulasi, CIEDE2000 badan proyektil pemain vs musuh 31,8 / 21,4 / 76,5 (protan / deutan / tritan, ambang 20), rarity tetangga punya pip. Langkah 4 (UI non-warna) lolos di M3. Langkah 5 deuteranopia: 3 dari 5 dan 2 dari 5 (dua proksi baru), kontrol normal 5 dari 5. Mode tidak mengubah dunia (`peak-deutan` sama dengan `peak-high` kecuali fase animasi). BUG-016. Bukti `a04-glance-deutan.json`, `a04-cvd-tokens.json`, `glance-deutan-b.png` |
| A-05 | Ukuran teks | LOLOS | 3 skala x 6 layar x 3 resolusi, 0 temuan |
| A-06 | Jeda kapan saja | LOLOS | A-06 dan E-16 lulus |
| A-07 | Navigasi keyboard penuh | LOLOS | Pencarian 13 layar (bagian 3), alur main penuh tanpa pointer di `m3-play.spec.ts`, BUG-009 dan BUG-010 DITUTUP; BUG-014 MINOR |
| A-08 | Kontras teks dan fokus | LOLOS | Diukur pertama kali (1280x720, teks Normal, piksel layar sebenarnya, ambang Otsu per kotak teks): 7 bingkai (judul, Temper, Glazier, akhir run, Settings Accessibility, HUD di puncak tengah dan tepi gelap), 143 teks, teks isi terendah 4,61:1 (ambang 4,5), teks redup terendah 4,59:1 (ambang 2), bingkai fokus `kept-gold` 7,4 sampai 10,7:1 (ambang 3). Bukti `a08-contrast.json`. Batas: satu resolusi dan skala Normal |
| A-09 | Padanan visual suara, volume terpisah | LOLOS dengan catatan | Master 0: kena hit (bar HP menyala putih dan turun, beda rata-rata 20,8), naik level (baris Lv berkedip emas, 36,3), akhir Pulse (timer 0:03 besar, 40,0), kedatangan Warden dan boss (banner nama, 44,5 dan 44,3), telegraf selalu visual, Memento didapat lewat layar hadiah atau toko. Akhir Pulse tidak punya tanda khusus selain timer (riser dan tick hanya audio): cukup karena timer selalu tampil, saran ke UI bila ada waktu. Gain bus tidak terbaca lewat hook; slider Master, Music, SFX, UI terpisah dan tersimpan (E-14), pemetaan fader ke gain 0 diuji unit (`mix.test.ts`). Bukti `a09.json`, `a09-sheet.png` |
| A-10 | Pengaturan dari jeda, tersimpan | LOLOS | E-14 lulus; reload di tes main rilis: kualitas Low dan Reduce Effects identik setelah reload |
| A-11 | Preferensi sistem [Saran] | LOLOS | A-11 lulus |
| A-12 | Tanpa batas waktu di luar Pulse [Saran] | LOLOS | `QA_LONG=1`, tick beku di 4 konteks (BUG-013 DITUTUP) |

## 7. Tes rilis

### 7.1 Check, build, bundle

| Perintah | Hasil |
|---|---|
| `npm run check` (awal) | Kode 0: data B 0 error 0 peringatan (contentHash 977ff134), string 0 error, 93 sprite 0 gagal, 4 arena, audio 11,5 KB, format, typecheck, lint, 70 file 649 tes, build, bundle: JS awal 276,3 KB gzip (target 300) |
| `npm run check` (akhir, setelah perubahan LP: versi 1.0.0, README, fallback WebGL2, kredit) | Kode 0: data B 0 error (977ff134), 93 sprite, 4 arena, audio 11,5 KB, format, typecheck, lint, 71 file 654 tes, build, bundle: JS awal 276,4 KB gzip (target 300), halaman pertama 282,9 KB, lazy 42,9 KB. Bundle `index-DqENpJrR.js` sama dengan yang diuji smoke produksi (`logs/check-final.txt`) |
| `npm run build` | Kode 0 (`dist/`, base `/shardfall/`) |
| M5-03 bundle | `bundle:check` lolos; pencarian manual di `dist/`: `__shardfall` 0, `__E2E__` 0, `__DEV_TOOLS__` 0, `goToScreen` 0, `spawnStress` 0, `grantSilt` 0, `exportReplay` 0, `pauseLoop` 0. Nama command `debug.*` ada di sim tetapi ditolak `DebugDisabled` di produksi (dicek di kode bundle). Smoke produksi: `window.__shardfall` tidak ada di 5 browser |

### 7.2 End-to-end per browser

| Browser | Perintah | Hasil |
|---|---|---|
| Chromium Playwright (akhir) | `npm run test:e2e` setelah semua perbaikan tes, build akhir | 52 tes: 39 lulus, 12 dilewati (opt-in), 1 gagal: `full-run.spec.ts` (tes LP M1) kalah di overtime Warden karena HP hanya diisi sebelum `debug.endPulse`, sedangkan sejak M4-04 overtime bisa sampai 75 s; seed dari UI acak, lolos di 4 putaran sebelumnya. Tes diperbaiki (HP diisi selama menunggu Pulse berakhir), ulang `--repeat-each 4`: 4 dari 4 lulus |
| Chromium Playwright | `QA_LONG=1 npm run test:e2e` | 51 tes: 39 lulus, 8 dilewati (3 performa opt-in, 5 smoke produksi tanpa URL), 4 gagal. Tiga gagal karena tes QA yang basi setelah perubahan M4 (D-5 mengharapkan tick 3600 padahal tick kini berhenti di toko, BUG-013; helper `reach` A-10 menekan kanan di baris slider; bot `m3-play` mati di Pulse 1 Chorister), diperbaiki di tes tanpa menurunkan ambang (bagian 8) lalu ulang: 3 dari 3 lulus. Satu gagal sesuai bug: retest BUG-006 (dibuka kembali) |
| Google Chrome 157 | `npx playwright test -c tests/out/qa/m5/browsers.config.mts --project=chrome` | 52 tes: 39 lulus, 12 dilewati (opt-in: A-12, 3 performa, 5 produksi, BUG-006, main rilis, soak; dijalankan terpisah di Chromium), 1 gagal karena konfigurasi QA, bukan game: `smoke-firefox.spec.ts` mewarisi channel `chrome` dari project ("Unsupported firefox channel"). Smoke Firefox sendiri lolos di project Firefox dan di suite Chromium. D-5 Chrome vs Node identik, E-13 3 seed dan D-8 cocok di Node |
| Microsoft Edge 157 | idem `--project=msedge` | 52 tes: 39 lulus, 12 dilewati (sama), 1 gagal karena konfigurasi QA yang sama (`smoke-firefox` dengan channel `msedge`). Smoke Edge: sim berjalan 1031 ms setelah layar Pulse (BUG-006, tes menunggu), D-5 identik |
| Firefox Playwright 157 | idem `--project=firefox` | 52 tes: 27 lulus, 12 dilewati, 13 gagal, semuanya karena alat atau tes, bukan game: 7 karena `page.setViewportSize` macet di Playwright Firefox di mesin ini (masalah yang sama sejak M1: screens 3, A-05 3, E-17), 1 karena CDP hanya ada di Chromium (simulasi tab tersembunyi E-16; jalur handler sudah lolos di Chromium), 2 karena channel `chrome` dan `msedge` diwarisi project, 2 karena `requestfailed` chunk audio lazy yang dibatalkan saat tes memuat ulang halaman di `boot()` (D-8 dan A-06; cek determinisme D-8 sendiri lolos, ulang D-8 lulus penuh), 1 karena tes `m3-play` menekan Enter di dalam kunci 500 ms layar akhir yang memang disengaja (tes diperbaiki, ulang lulus). Determinisme lintas engine: D-5 identik dengan Node, E-13 3 seed dan D-8 cocok di Node. Smoke produksi Firefox 0 error |
| WebKit Playwright (proksi Safari) | `smoke-webkit.spec.ts` (bagian dari suite) dan smoke produksi | Smoke lolos dengan build cadangan 2336 (revisi 2370 tidak terpasang). Build Windows ini tidak punya `AudioContext`: game berjalan tanpa suara dan mencatat peringatan "audio unlock failed" (bukan error). Batas lingkungan, bukan bug game |

Konfigurasi lintas browser `tests/out/qa/m5/browsers.config.mts` (tidak masuk repo) memakai `playwright.config.ts` apa adanya dan hanya mengganti project browser.

### 7.3 Build produksi (M5-04, nol error konsol)

`m5-prod.spec.ts` dengan `QA_PROD_URL`, tombol saja: judul, New Run, kelas pertama, gerak, Rite, jeda, lanjut.

| Browser | Judul interaktif | Error konsol, pageerror, 4xx | Permintaan di luar base path | Catatan |
|---|---|---|---|---|
| Chromium GPU 156 | 773 ms | 0 | 0 | |
| Chrome 157 | 774 ms | 0 | 0 | |
| Edge 157 | 869 ms | 0 | 0 | |
| Firefox 157 | 1299 ms | 0 | 0 | 3 peringatan browser (WEBGL_debug_renderer_info usang, BiquadFilterNode) |
| WebKit 27.2 (cadangan) | 919 ms | 0 | 0 | Peringatan audio unlock (tanpa `AudioContext`) |

Bukti `prod-smoke.txt`. Hook e2e tidak ada di kelima browser, WebGL2 tersedia.

### 7.4 Main rilis per kelas (tombol nyata, loop dipercepat 4x)

`m5-release.spec.ts` "M5 release play" (`QA_LONG=1`), 1920x1080, GPU, tiga putaran (9 run). Bot sama dengan E-13 (W, A, S, D, Space, digit, B), keputusan Temper, peti, dan toko lewat tombol; hook hanya `setTimeScale(4)`, membaca snapshot, dan `grantSilt` berlabel untuk melengkapi biaya unlock.

| Butir | Hasil |
|---|---|
| Run penuh tiap kelas sampai menang atau kalah | 9 dari 9 selesai di layar akhir run (diassert). Menang Pulse 15: Chorister (putaran 1, 46196 step), Vintner (putaran 2, kualitas Low dan Reduce Effects, 50800 step). Kalah: Lamplighter P3 dan P4, Vintner P4 dan satu kali di putaran 1, Chorister P2 dan P4; hasil Lamplighter putaran 1 tidak tercatat karena log putaran itu terhenti di BUG-015. Silt bertambah tiap run (41 per menang) |
| Autosave dan Continue | Muat ulang di Glazier pertama, Continue dari judul dengan tombol: hash sama (`30dfaa7a` dan `0fab68c1` di dua putaran), Pulse dan Glint sama, run berlanjut sampai akhir |
| Unlock Silt | Vintner dibeli di The Keeping (6 Silt, sebagian dari run), Chorister (60 Silt, ditambah `grantSilt`), lalu dimainkan dari pilih kelas |
| Pengaturan setelah reload | Kualitas Low dan Reduce Effects diubah di Settings dengan tombol, reload: JSON pengaturan identik, kelas `reduce-effects` aktif |
| Kualitas Low | Draw call 10 sampai 11 (Low) vs 19 (High) di Pulse 1 |
| Replay di Node | 5 dari 6 replay run tanpa Continue cocok penuh; 1 replay punya satu checkpoint tidak cocok (BUG-015) |

Bukti `play-log.txt` (putaran terakhir), `logs/m5-play-first.txt` (BUG-015).

## 8. Perubahan tes

Tidak ada ambang yang dilonggarkan dan tidak ada tes yang dihapus.

- `tests/e2e/determinism.spec.ts` D-5: cek `tick === 3600` diganti `tick === tick Node` plus 60 checkpoint wajib. Sejak BUG-013 tick tidak naik di toko, jadi 3600 step berakhir di tick 1260. Checkpoint hash tiap 60 step tetap harus identik dengan Node (diperiksa: 60 dari 60 sama).
- `tests/e2e/m3-a11y.spec.ts` A-10: pindah tab Settings dengan E (tombol tab resmi) karena helper `reach` menekan kanan di baris slider (mengubah nilai, bukan fokus). Keterjangkauan tab dibuktikan oleh pencarian A-07.
- `tests/e2e/full-run.spec.ts` (tes LP M1, perubahan kecil QA): `endPulse` mengisi HP selama menunggu Pulse berakhir; Pulse Warden kini bisa berlanjut di overtime sampai 75 s (M4-04) sementara Kept diam. Tidak ada assert yang diubah.
- `tests/e2e/m3-play.spec.ts`: HP diisi ulang (berlabel) bila di bawah 40% selama Pulse 1; tes ini memeriksa alur keyboard, bukan bertahan hidup. Catatan untuk GD: dodger skrip Chorister mati di Pulse 1 satu kali di M5 (tidak pernah di M3). Ditambah jeda 550 ms setelah Abandon sebelum menekan tombol di layar akhir (kunci 500 ms dari Pulse memang disengaja; di Firefox tombol tes jatuh di dalamnya).
- Baru: `tests/e2e/m5-release.spec.ts` (A-07 by search, BUG-008, BUG-009; opt-in `QA_LONG=1`: BUG-006, main rilis; opt-in `QA_SOAK=1`: soak D-8), `tests/e2e/m5-a11y.spec.ts` (A-08, A-09), `tests/e2e/m5-prod.spec.ts` (opt-in `QA_PROD_URL`), `tests/e2e/support/m5_contrast.py`, `m5_cvd.py`, `m5_glance_cvd.py`, `m5_windup.py`.
- Metrik `unlit_vs_floor_p10` di `m3_analyze.py` tidak diubah; untuk BUG-007 QA menambah `m5_windup.py` yang mengukur piksel badan secara terpisah (patch 7x7 lama jatuh di inti emisif atau outline). Kedua angka dilaporkan.
- Kode produksi tidak diubah.

## 9. Perintah yang dijalankan

| Perintah | Hasil |
|---|---|
| `npm run check` | Kode 0 (7.1) |
| `npm run build:e2e`, `npm run build` | Kode 0 |
| `npx vitest run` (6 file tes bug: hud-transient, focus-nav, choice-idle, m4-polish, entity-layers, content-b) | 80 dari 80 lulus |
| `node tools/balance/bot/run-bots.ts --bot good --profile run_b --class <kelas> --seeds 1-120` dan `--bot naive --seeds 1-60` | 6 baris, 0 timeout, `poolOverflow` 0 (`bots-run_b.txt`) |
| `npx playwright test tests/e2e/m3-visual.spec.ts` lalu `python tests/e2e/support/m3_analyze.py`, `m5_windup.py` | 4 dari 4; BUG-007 |
| `python tests/e2e/support/m5_cvd.py`, `m5_glance_cvd.py make/score` + 3 subagent proksi baru (2 deuteranopia, 1 kontrol) | A-04 |
| `npx playwright test tests/e2e/m5-a11y.spec.ts` lalu `python tests/e2e/support/m5_contrast.py` | 2 dari 2; A-08, A-09 |
| `npx playwright test tests/e2e/m5-release.spec.ts` (dengan `QA_LONG=1`, `QA_SOAK=1`) | A-07 search, BUG-008, BUG-009, main rilis lulus; BUG-006 gagal (dibuka kembali); soak 4 run valid cocok (2 run soak berakhir sebelum mulai karena race di tes, diperbaiki) |
| `QA_LONG=1 npm run test:e2e` | 7.2 |
| `npx playwright test -c tests/out/qa/m5/browsers.config.mts --project=chrome`, `msedge`, `firefox`, lalu ulang D-8 dan `m3-play` di Firefox | 7.2; ulang 2 dari 2 lulus (`logs/e2e-summary.txt`) |
| `vite preview --outDir dist --base /shardfall/ --port 4180` + `QA_PROD_URL=... npx playwright test -c tests/out/qa/m5/prod.config.mts` | 5 dari 5 (7.3); server dimatikan |

## 10. Bug yang diketahui untuk rilis

Diusulkan di `docs/qa/bugs.md` bagian "Bug yang diketahui" (status DIKETAHUI menunggu keputusan Producer): BUG-006 (jeda sekitar 0,5 s di Pulse pertama sesi browser), BUG-014 (lompatan panah kiri di tepi kiri Glazier dan Settings Controls), BUG-015 (replay dev, satu checkpoint). BUG-016 (MAYOR) tidak boleh masuk daftar ini.

Batas pengujian yang diketahui (bukan bug): Safari asli tidak diuji; WebKit Playwright memakai build cadangan tanpa Web Audio; uji 1 detik dan waktu toko belum dikonfirmasi manusia; CW-3 dan memori PF-5, PF-6 tidak punya alat ukur; A-08 diukur di satu resolusi dan skala teks Normal.

## 11. Daftar file

- Dokumen: `docs/qa/M5-report.md` (baru), `docs/qa/bugs.md` (uji ulang BUG-006 sampai BUG-013, BUG-014 sampai BUG-016, daftar bug diketahui, status detail BUG-001 sampai BUG-005 dan BUG-011 diselaraskan dengan tabel), `docs/qa/accessibility.md` (versi 1.2: alat uji M5), `docs/qa/evidence/M5/` (bukti ringkas).
- Tes: `tests/e2e/m5-release.spec.ts`, `tests/e2e/m5-a11y.spec.ts`, `tests/e2e/m5-prod.spec.ts`, `tests/e2e/support/m5_contrast.py`, `m5_cvd.py`, `m5_glance_cvd.py`, `m5_windup.py` (baru); `tests/e2e/determinism.spec.ts`, `tests/e2e/m3-a11y.spec.ts`, `tests/e2e/m3-play.spec.ts`, `tests/e2e/full-run.spec.ts` (bagian 8).
- Kode produksi: tidak diubah.

## 12. Ringkasan lolos dan gagal

Lolos: semua uji ulang kecuali BUG-006 (6 DITUTUP termasuk kedua MAYOR M3), check dan build, e2e penuh di Chromium, Chrome, Edge, e2e Firefox tanpa kegagalan yang berasal dari game, smoke WebKit, build produksi tanpa error di 5 browser, bundle tanpa kode tes, run penuh tiap kelas sampai menang atau kalah, Continue, unlock, pengaturan setelah reload, Low dan Reduce Effects, durasi run sesuai target GD, A-01 sampai A-03 dan A-05 sampai A-12 termasuk A-08 dan A-09 yang pertama kali diukur. Gagal: A-04 (BUG-016, MAYOR), sehingga M4-02, M4-04, dan putusan rilis gagal. MINOR terbuka: BUG-006 (dibuka kembali), BUG-014, BUG-015.

## 13. Pertanyaan terbuka

1. Producer: BUG-016 diperbaiki sebelum rilis (AD dan LP, palet dunia per mode) atau A-04 diberi pengecualian tertulis? Tanpa salah satunya QA tetap TIDAK SIAP.
2. Producer: setujui BUG-006, BUG-014, BUG-015 sebagai DIKETAHUI untuk rilis?
3. Producer dan GD: target durasi run resmi untuk keluar M4: 12 sampai 16 menit (GD T6) atau 15 sampai 20 menit (HANDOFF 4.1, test-plan M4-05)? Bot rata-rata 14,7 menit.
4. LP: diagnosis BUG-015 (nilai ber-hash yang sempat berbeda satu checkpoint) dan BUG-006 (program shader yang belum ikut pre-warm).
5. Producer: izinkan unduh WebKit Playwright revisi 2370 agar proksi Safari tidak memakai build cadangan?

---

## Uji ulang M5-04

Tugas: M5-04 (uji ulang fokus). Penguji: QA Lead. Tanggal: 2026-11-17. Build: kerja lokal setelah perubahan LP M5-03 (`focus-nav.ts`, `cvd-palette.ts`, pola bahaya), `package.json` 1.0.0, contentHash 977ff134, tingkat B. Mesin, Node, Playwright sama dengan bagian 1. Keputusan Producer yang dipakai: BUG-006, BUG-014 (bila belum beres), BUG-015 diterima sebagai known issues 1.0; target durasi resmi 12 sampai 16 menit untuk 15 Pulse; A-04 langkah 5 diuji di mode yang sesuai.

### M5-04.1 Putusan

**Putusan rilis QA: TIDAK SIAP.** Kriteria M4: **GAGAL** (M4-02, M4-04). Kriteria M5: **GAGAL** (M5-06, M5-08). Satu-satunya penghalang: **BUG-017 (MAYOR, baru)**: di mode Protanopia, selisih CIEDE2000 badan proyektil pemain vs cincin proyektil musuh 19,0 (`kept-cyan`) dan 19,4 (`kept-blue`), sedangkan ambang A-04 langkah 3 adalah 20. Selisihnya kecil, tetapi ambang tertulis dan QA tidak melonggarkannya setelah hasil keluar.

BUG-016 DITUTUP dan BUG-014 DITUTUP. Semua tes otomatis rilis lolos.

Jalan tercepat ke SIAP (keputusan Producer): (a) LP atau AD mengganti satu nilai, `danger-magenta` mode Protanopia di `src/render/pipeline/cvd-palette.ts` (QA menemukan 347 kandidat di keluarga merah sampai violet yang memenuhi ambang; pilihan nilai milik AD), lalu QA menjalankan `m5_cvd.py` dan uji 1 detik protan (sekitar 10 menit); atau (b) Producer memberi pengecualian tertulis untuk A-04 langkah 3 mode Protanopia (selisih sekitar 1 satuan, pembeda non-warna proyektil tetap ada). Dengan (b) QA menulis A-04 sebagai LOLOS DENGAN PENGECUALIAN dan putusan menjadi SIAP.

### M5-04.2 Uji ulang bug

| Id | Hasil | Bukti |
|---|---|---|
| BUG-016 (MAYOR) | **DITUTUP.** Dunia kini berubah per mode (0,75 sampai 1,23% piksel berubah di G3 dan G4 dibanding Off; telegraf jadi pita bergaris pucat), state hash sama di semua mode (7c7dfee6). A-04 langkah 5 di mode Deuteranopia dengan bingkai tangkapan QA sendiri (`QA_CV=deutan`) dan simulasi deuteranopia, satu proksi baru tanpa konteks: **4 dari 5** (ambang 4). G3 boss dan G4 tumpukan X yang gagal di M5 kini lolos (galat ancaman 7,5 dan 13,3 px). Gagal: G5, Unlit menempel tepat di pemain (0,8 px), jawaban 30,8 px (radius 30) | `m504-a04-glance.json`, `m504-glance-deutan-boss.png` |
| BUG-014 (MINOR) | **DITUTUP.** A-07 by search: 13 layar, 0 tak terjangkau, 0 jebakan, 0 pelanggaran arah, balik 158 dari 158 (dulu 12 gagal dari 175); Glazier 34/34, Controls 60/60 | `logs/m504-a07-search.txt` |
| BUG-006 (MINOR) | Tidak diuji ulang (tidak ada perubahan kode). DIKETAHUI sesuai keputusan Producer | bagian 3 |
| BUG-015 (MINOR) | Tidak diuji ulang (belum diperbaiki). DIKETAHUI sesuai keputusan Producer. Di suite e2e M5-04, E-13 3 seed dan D-8 cocok di Node | `logs/m504-e2e-chromium.txt` |

### M5-04.3 A-04 per mode

Langkah 3 (`m5_cvd.py`, kini membaca palet tiap mode dari `cvd-palette.ts`), simulasi jenis yang sama dengan mode:

| Mode | Inti bahaya vs lantai (ambang 4,5) | Badan proyektil pemain vs musuh: cyan / biru / putih (ambang 20) | Langkah 5 uji 1 detik proksi |
|---|---|---|---|
| Off (3 simulasi) | 4,84 sampai 6,48 | tidak diwajibkan (protan 31,8 / 16,2 / 40,1) | M5: kontrol normal 5 dari 5 |
| Protanopia | 4,84 dan 6,28 | **19,0 / 19,4 / 26,6 GAGAL** (BUG-017) | 4 dari 5 (indikatif) |
| Deuteranopia | 4,92 dan 6,48 | 26,2 / 35,5 / 27,5 | **4 dari 5 (resmi)** |
| Tritanopia | 4,84 dan 6,33 | 76,5 / 71,6 / 38,9 | 5 dari 5 (indikatif) |

Indikatif: sesi 2 dan 3 dari proksi yang sama (hanya satu subagent diizinkan), jadi tata letak adegan sudah pernah dilihat. Langkah 4 (UI non-warna) tidak berubah sejak M3, lolos. Rarity Plain vs Fine di simulasi deutan 9,5 tetap punya pip (sama dengan M5). Putusan A-04: **GAGAL**, hanya karena langkah 3 mode Protanopia.

### M5-04.4 Tes rilis

| Perintah | Hasil |
|---|---|
| `npm run check` | Kode 0 (putaran kedua; putaran pertama gagal di `format:check` karena edit QA di `m3-visual.spec.ts`, diperbaiki dengan Prettier): data B 0 error (977ff134), string 0 error, sprite, 4 arena, audio 11,5 KB, format, typecheck, lint, 72 file 668 tes, build, bundle JS awal 277,2 KB gzip (target 300), halaman pertama 283,6 KB. `logs/m504-check.txt` |
| `npm run test:e2e` (Chromium) | **52 tes: 40 lulus, 12 dilewati (opt-in), 0 gagal** (13,0 menit). Termasuk E-13 3 seed, D-5, D-8, full run dengan Continue, A-07 by search, BUG-008, BUG-009, A-08, A-09, smoke Chrome, Edge, Firefox, WebKit. `logs/m504-e2e-chromium.txt`. Suite penuh di Chrome, Edge, Firefox tidak diulang (13 menit per browser; perubahan hanya render dan fokus UI, smoke tiap browser lolos di suite ini dan di produksi) |
| `QA_CV=<mode> npx playwright test tests/e2e/m3-visual.spec.ts -g "glance frames"` untuk deutan, protan, tritan | 3 dari 3 lulus, 0 masalah konsol |
| Smoke produksi `m5-prod.spec.ts` (`vite preview --outDir dist --base /shardfall/ --port 4180`) | **5 dari 5 lulus**: Chromium GPU, Chrome 157, Edge 157, Firefox 157, WebKit cadangan. Judul interaktif 805 sampai 1764 ms, 0 error konsol, 0 permintaan di luar base path, hook e2e tidak ada, WebGL2 ada. Hanya peringatan: Firefox `WEBGL_debug_renderer_info`, WebKit tanpa `AudioContext` (sama dengan M5). Putaran pertama gagal 5 dari 5 karena Git Bash mengubah argumen `--base /shardfall/` menjadi path Windows (alat QA, bukan build); diulang dengan `MSYS_NO_PATHCONV=1`. Server dimatikan. `logs/m504-prod-smoke.txt` |

### M5-04.5 Kriteria akhir

| ID | Putusan M5-04 | Catatan |
|---|---|---|
| M4-01 | LOLOS dengan catatan | Tidak berubah dari bagian 5 |
| M4-02 | **GAGAL** | BLOCKER 0, MAYOR terbuka 1: BUG-017 (BUG-016 DITUTUP) |
| M4-03 | LOLOS | Tidak berubah; smoke 5 browser lolos ulang |
| M4-04 | **GAGAL** | A-04 langkah 3 mode Protanopia (BUG-017); butir wajib lain lolos, A-07 kini tanpa catatan (BUG-014 DITUTUP) |
| M4-05 | LOLOS | Target resmi 12 sampai 16 menit (keputusan Producer); bot rata-rata 14,7 menit (Lamplighter 14,4, Chorister 15,3, Vintner 14,5). Waktu toko 20 s tetap asumsi GD |
| M4-06 | LOLOS (proksi) | Tidak berubah; mode Off tidak disentuh perbaikan |
| M4-07 | LOLOS sebagian | Tidak berubah (CW-3 tidak punya alat) |
| M4-08 | TIDAK DIUKUR ULANG | Draw call peak 21 sama di semua mode warna |
| M4-09 | LOLOS | BUG-014 dan BUG-016 diverifikasi dengan tes regresi |
| M5-01 | LOLOS | check kode 0, e2e Chromium 0 gagal |
| M5-02 | LOLOS | Replay emas di `npm test`; D-5, D-8, E-13 cocok |
| M5-03 | LOLOS | `bundle:check` lolos, smoke produksi tanpa hook |
| M5-04 | LOLOS | Smoke produksi 5 browser |
| M5-05 | LOLOS (skrip QA) | Tidak berubah; tidak ada aset baru |
| M5-06 | **GAGAL** | Daftar final terisi, tetapi syarat nol MAYOR gagal (BUG-017) |
| M5-07 | LOLOS | `data:check` string 0 error |
| M5-08 | **GAGAL** | Putusan TIDAK SIAP |

### M5-04.6 Daftar known issues final

Sesuai keputusan Producer, status DIKETAHUI di `docs/qa/bugs.md`:

| Id | Ringkasan |
|---|---|
| BUG-006 | Jeda sekitar 0,5 s di Pulse pertama setelah browser baru dibuka; tombol yang ditekan saat itu bisa hilang |
| BUG-015 | Replay dev: satu checkpoint jarang tidak cocok walau hasil run sama; tidak berdampak ke pemain |

BUG-014 tidak masuk daftar (DITUTUP). BUG-017 tidak boleh masuk daftar (MAYOR) kecuali Producer memberi pengecualian tertulis.

Batas pengujian yang diketahui: tetap seperti bagian 10, ditambah: uji 1 detik protan dan tritan hanya indikatif (proksi yang sama), dan bingkai uji 1 detik tidak memuat proyektil musuh.

### M5-04.7 Perubahan tes

Tidak ada ambang yang dilonggarkan, tidak ada tes yang dihapus, kode produksi tidak diubah.
- `tests/e2e/m3-visual.spec.ts`: opsi `QA_CV=<mode>` di tes glance (Color Vision diset ke mode itu, nama `cv-<mode>-glance-*`). Tanpa variabel, perilaku sama dengan sebelumnya.
- `tests/e2e/support/m5_glance_cvd.py`: opsi `--sim`, `--prefix`, `--tag`, `--seed`, dan path keluaran skor. Default sama dengan M5.
- `tests/e2e/support/m5_cvd.py`: juga mengukur palet dunia tiap mode (`mode-<nama>`) dan jarak terkecil token bahaya ke token pemain.
- `docs/qa/accessibility.md` versi 1.3: A-04 langkah 5 di mode Deuteranopia.

### M5-04.8 Daftar file

- Dokumen: `docs/qa/M5-report.md` (bagian ini), `docs/qa/bugs.md` (BUG-014 dan BUG-016 DITUTUP, BUG-006 dan BUG-015 DIKETAHUI, BUG-017 baru, daftar known issues final), `docs/qa/accessibility.md` (1.3).
- Bukti: `docs/qa/evidence/M5/m504-a04-glance.json`, `m504-a04-cvd-tokens.json`, `m504-glance-deutan-boss.png`, `logs/m504-a07-search.txt`, `logs/m504-check.txt`, `logs/m504-e2e-chromium.txt`, `logs/m504-prod-smoke.txt`.
- Tes: `tests/e2e/m3-visual.spec.ts`, `tests/e2e/support/m5_glance_cvd.py`, `tests/e2e/support/m5_cvd.py`.

### M5-04.9 Ringkasan lolos dan gagal

Lolos: BUG-016 (A-04 langkah 5 Deuteranopia 4 dari 5, dunia berubah per mode), BUG-014, check, e2e Chromium tanpa kegagalan, smoke produksi 5 browser, durasi run dalam target resmi. Gagal: A-04 langkah 3 mode Protanopia (BUG-017, MAYOR), sehingga M4-02, M4-04, M5-06, M5-08 gagal.

### M5-04.10 Pertanyaan terbuka

1. Producer: BUG-017 diperbaiki (satu nilai palet oleh AD dan LP, lalu QA uji ulang sekitar 10 menit) atau diberi pengecualian tertulis?
2. AD: nilai palet mode di `cvd-palette.ts` masih usul LP [Asumsi]; disetujui atau dipindah ke `art/palette.json`?
3. Producer: perlu uji 1 detik protan dan tritan dengan proksi baru masing-masing (bukan indikatif)? A-04 tidak mewajibkannya.
