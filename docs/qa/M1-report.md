# Laporan QA M1: Prototipe Main Loop

Tugas: M1-09b. Penguji: QA Lead. Tanggal: 2026-11-17. Untuk: Producer.

## 1. Kepala

| Item | Nilai |
|---|---|
| Milestone | M1 Prototipe main loop |
| Build | Kerja lokal 2026-11-17, belum di-commit; `contentHash` 6b395051, tingkat konten A |
| Mesin | Windows 11, Ryzen 7 5800H, RTX 3060 Laptop + Radeon terintegrasi, layar 144 Hz (test-plan 2.1) |
| Node, npm | Node 24.19.0, npm 11 |
| Playwright | `@playwright/test` 1.64.1 |
| Browser | Chromium Playwright 1248 (headless dan headed), Google Chrome 157.0.8103.40, Microsoft Edge 157.0.4341.60, Firefox Playwright 157.0 (`firefox-1555`, dipasang QA hari ini), WebKit Playwright 27.2 (`webkit-2336`, cadangan: Playwright meminta `webkit-2370`) |
| Profil performa | P-DEV indikatif (headed) dan Chromium headless indikatif. P-REF belum diukur (PF-1 mulai M2) |

## 2. Putusan akhir

**GAGAL (formal), main loop sendiri LOLOS.**

Semua kriteria permainan dan determinisme LOLOS dengan bukti, tidak ada BLOCKER. Laporan tetap GAGAL karena dua hal kecil yang menurut test-plan 13 tidak boleh dianggap lolos:
1. Smoke Chrome dan Edge gagal di butir "nol error konsol" karena `favicon.ico` 404 (BUG-002, MINOR, perbaikan satu baris di `index.html`, pemilik usulan LP). Semua butir smoke lain lolos.
2. Beberapa kriteria test-plan 13.1 TIDAK DIUJI di M1 (uji pilar berbasis gambar M1-07, uji 1 detik proksi, DV-6, A-06 langkah 3). Butuh pengecualian tertulis Producer atau dipindah ke M2.

Jalur ke LOLOS tanpa kerja QA tambahan: LP memperbaiki BUG-002 lalu `npm run test:e2e` diulang, dan Producer menulis pengecualian butir di bagian 9.

## 3. Kriteria keluar M1 (HANDOFF 4.1 dan brief M1-09b)

| # | Kriteria | Putusan | Bukti | Perintah |
|---|---|---|---|---|
| K1 | Run 10 Pulse bisa dimainkan penuh: gerak, serangan otomatis, Rite, spawn, Glint, level-up, toko, menang atau kalah | LOLOS | Pulse 1 dimainkan real time dengan tombol keyboard nyata (`kb-03` sampai `kb-05`, `kb-log.txt`); Temper lewat panah + Enter (`level-up-*.png`); toko beli 1 tombol, reroll R, mulai B (`kb-07`, `kb-08`, `smoke-glazier-*.png`); kalah (`kb-11-run-lost.png`, E-13 3 seed); menang lewat UI sampai boss (`full-run.spec.ts`, `tests/out/e2e/13-run-won.png`) dan di sim data asli (B-1b seed 3 dan 8, 10 Pulse, boss mati) | `npm run test:e2e`, `npx vitest run tests/unit/qa` |
| K2 | Simulasi deterministik (seed dan input sama, hash sama), termasuk replay browser diputar di Node | LOLOS | D-1, D-2, D-3, D-6, D-7 (`tests/unit/qa/determinism-qa.test.ts`); D-5 Chromium vs Node 60 checkpoint identik (`d5-chromium.json`); D-5 juga identik di Chrome, Edge, Firefox, WebKit (`smoke-*.txt` butir 8); D-8 keyboard nyata 260 tick (`d8-keyboard.json`) dan 3 run penuh E-13 (6859 sampai 8542 tick) cocok di Node, `mismatchAt -1` (`e13-seed*.txt`); D-4 dari GP lulus | `npm test`, `npm run test:e2e` |
| K3 | Bot headless menyelesaikan run | LOLOS | B-1: 20 dari 20 seed `dodger+random` selesai (semua kalah, Pulse 4 sampai 9), B-2: nol pelanggaran invarian, B-3: 10 dari 10 bot diam kalah, B-4: 1735x waktu nyata (target 20x) | `npx vitest run tests/unit/qa/bot-real-data.test.ts --silent=false` |
| K4 | Tidak ada error console | GAGAL (hanya Chrome dan Edge sungguhan, BUG-002 favicon). Nol error di semua 13 tes Chromium Playwright headless, Firefox, dan WebKit | `logs/test-e2e-final.log`, `smoke-chrome.txt`, `smoke-msedge.txt` | `npm run test:e2e` |
| K5 | Autosave dan Continue | LOLOS | Reload di the Glazier, Continue punya fokus awal, Enter melanjutkan: Pulse, Glint, level, HP sama dan **hash state identik** (`6b5033eb` = `6b5033eb`, tick 1725); `kb-09`, `kb-10` | `tests/e2e/keyboard-play.spec.ts` |
| K6 | Navigasi keyboard tanpa mouse di layar utama | LOLOS (alur run) | Judul, pilih kelas, Pulse, Temper, the Glazier, Pause, Settings, akhir run, Continue, Try Again hanya dengan keyboard; pencatat pointer mencatat nol event `pointerdown`, `mousedown`, `pointermove`, `wheel` | `tests/e2e/keyboard-play.spec.ts` |
| K7 | Smoke WebKit dan Firefox | LOLOS (WebKit indikatif) | Firefox 157: butir 1 sampai 4, 8, 9 lolos, nol error, 90,5 fps; WebKit 27.2 (`webkit-2336`, revisi tidak cocok): semua lolos, nol error, 64,6 fps | `tests/e2e/smoke-firefox.spec.ts`, `smoke-webkit.spec.ts` |
| K8 | Uji stres jumlah musuh puncak, catat fps | LOLOS (indikatif, bukan PF-1) | Unlit dijaga di sekitar 120 (rata-rata 111 sampai 115). Headless: sekitar 42 fps, frame terkuantisasi 16,7/33,4 ms. Headed P-DEV: 131,7 fps (laju layar 144 Hz), p95 8,1 ms, p99 8,4 ms. Sim p95 0,2 ms (anggaran 4 ms). Draw call 6, segitiga sekitar 850, `eventOverflow` 0, `poolOverflow` 0 | `tests/e2e/screens.spec.ts` (stres), `QA_HEADED=1 npx playwright test tests/e2e/screens.spec.ts -g stress --headed` |
| K9 | Semua tes lulus | GAGAL | `npm run check` kode 0 (49 file, 342 lulus, 2 expected fail BUG-001). `npm run test:e2e`: 2 tes gagal (smoke Chrome dan Edge, BUG-002), sisanya lulus | `logs/check-final.log`, `logs/test-e2e-final.log` |

Semua path bukti relatif terhadap `docs/qa/evidence/M1/` kecuali disebut lain.

## 4. Kriteria test-plan 13.1

| ID | Kriteria | Putusan | Bukti atau alasan |
|---|---|---|---|
| M1-01 | Run 10 Pulse selesai (B-1, B-2, B-3) | LOLOS | K3 |
| M1-02 | Fitur main loop E-02 sampai E-11 di Chromium 1920x1080 | LOLOS | E-02 judul ke Pulse dengan keyboard; E-03 HUD (HP, timer, Glint, Rite); E-04 tiap tombol gerak 100 sampai 130 px ke arah benar; E-05 Rite mulai cooldown 12 s, tekan ulang tanpa efek; E-06 musuh muncul dan Glint naik; E-07 akhir Pulse ke Temper atau the Glazier; E-08 beli 1 tombol, reroll mengganti isi, Fuse (full-run); E-09 B memulai Pulse 2; E-10 kalah lalu Try Again memulai run baru (HP penuh, Pulse 1); E-11 menang (full-run); E-12 jeda di Pulse, Temper, the Glazier: tick, timer, posisi beku 2 s |
| M1-03 | E-13 minimal 3 seed | LOLOS | Seed 101, 202, 303: kalah di Pulse 5, 5, 4 tanpa error, layar akhir tampil |
| M1-04 | Determinisme | LOLOS | K2 |
| M1-05 | Pemeriksaan proyek | GAGAL | `check` lolos; `test:e2e` gagal 2 tes karena BUG-002 |
| M1-06 | DV-1 sampai DV-6 | DV-1 sampai DV-5 LOLOS, DV-6 TIDAK DIUJI | `data:check` dan cek string resmi 0 error 0 peringatan (skema, rujukan, batas teks, kata terlarang, dash). DV-6 (lint string hardcode) ditunda LP ke M2 (review M0-lp 3.4); e2e memindai kunci mentah di semua layar: nol |
| M1-07 | Uji pilar M1 | TIDAK DIUJI sebagian | E-08 (P4-c) dan DV-3 (P4-b) LOLOS. CW-1 sebagian lewat `art:check` (kelas palet per sprite, 0 gagal). CW-2, CW-4, 8.3, 8.4, 8.6, uji 1 detik proksi belum dikerjakan (analisis gambar dan penguji proksi). Usul: pindah ke M2 bersama M2-04 dan M2-05 |
| M1-08 | Screenshot per layar 1920x1080 dan 1280x720 | LOLOS | 15 layar x 2 resolusi (`<layar>-<w>x<h>-chromium.png`), dilihat QA; temuan BUG-003, BUG-005; pemindai layout: hanya flavor terpotong |
| M1-09 | Smoke Chrome dan Edge butir 1 sampai 4 | GAGAL | Butir 1 "nol error konsol" gagal karena BUG-002; butir 2 sampai 4 lolos; D-5 identik |
| M1-10 | A-06 jeda, A-07 alur run | LOLOS sebagian | A-06 langkah 1, 2, 4 lolos di Pulse, Temper, the Glazier; langkah 3 (tab tersembunyi) dan konteks Warden TIDAK DIUJI. A-07 alur run lolos tanpa mouse; urutan fokus judul logis; Settings punya 4 tab, panah bawah mencapai 5 baris di tab Graphics |
| M1-11 | Nol BLOCKER terbuka | LOLOS | `docs/qa/bugs.md`: 0 BLOCKER, 1 MAYOR, 4 MINOR |

## 5. Perintah yang dijalankan

| Perintah | Hasil |
|---|---|
| `npm run check` (awal) | Kode 0: data A 0 error, string 0 error, 25 sprite, 2 arena, audio 7,8 KB, format, typecheck, lint, 332 tes (46 file), build, bundle (JS awal 244,9 KB gzip) |
| `npm run build` | Kode 0 |
| `npm run test:e2e` (awal, sebelum tes QA) | 4 dari 4 lulus |
| `npx playwright install firefox` (sekali) | Firefox 157 (`firefox-1555`) terpasang |
| `npx vitest run tests/unit/qa --silent=false` | 12 lulus (termasuk 2 expected fail BUG-001), sekitar 3,5 s |
| `QA_UPDATE_GOLDEN=1 npx vitest run tests/unit/qa/determinism-qa.test.ts -t golden` (sekali, membuat replay emas) | 3 replay emas data fixture (seed 11, 22, 33), semua run penuh sampai menang |
| `QA_HEADED=1 npx playwright test tests/e2e/screens.spec.ts -g stress --headed` | Angka P-DEV di K8; tes gagal di akhir karena favicon (BUG-002, hanya headed) |
| `npm run check` (akhir) | Kode 0: 49 file, 342 lulus, 2 expected fail; build dan bundle lolos (`logs/check-final.log`) |
| `npm run test:e2e` (akhir) | Kode 1: 15 lulus, 2 gagal (BUG-002), detail bagian 10 |

## 6. Temuan baru

| Id | Judul | Tingkat | Pemilik usulan |
|---|---|---|---|
| BUG-001 | Ringkasan build (Pause, akhir run) menampilkan build run sebelumnya atau kosong selama Pulse 1 | MAYOR | GP |
| BUG-002 | `favicon.ico` 404 memunculkan `console.error` di Chrome dan Edge sungguhan | MINOR | LP |
| BUG-003 | Teks flavor kartu Memento terpotong elipsis | MINOR | UI (WR bila memendekkan) |
| BUG-004 | Hook `goToScreen('confirm')` gagal | MINOR | LP |
| BUG-005 | Baris Memento menjorok di ringkasan build | MINOR | UI |

Temuan MINOR yang sudah ada di review LP dan terlihat lagi (tidak dicatat ulang): slot Rite tanpa ikon saat siap, ikon kartu kosong, label Temper "1 of 13" saat banyak level tertunda.

## 7. Catatan untuk GD (data balance, bukan bug)

QA melaporkan angka; target milik GD (test-plan 6.1).
- Bot `dodger+random`, data asli `run_a`, 20 seed: 0 menang. Pulse yang dicapai: 11 seed mati di Pulse 5 (Warden), sisanya di Pulse 7 sampai 10. Bot browser E-13: 3 dari 3 mati di Pulse 4 sampai 5.
- Sesi keyboard real time Pulse 1 (bot penghindar sederhana, bukan pemain manusia): 10 sampai 18 Glint setelah Pulse 1. Di 2 dari 3 sesi tidak ada tawaran the Glazier yang terjangkau (harga terendah 14).
- Kedua angka berasal dari bot yang menghindar, bukan dari pemain yang mengejar Glint. Konfirmasi manusia diperlukan sebelum menyimpulkan kesulitan.

## 8. Perubahan ambang atau baseline

- Tidak ada ambang yang dilonggarkan. Ambang performa test-plan 9.4 kini salinan architecture 13 (perbaikan review M0, bukan pelonggaran).
- Baseline baru: 3 replay emas D-7 di `tests/unit/qa/replays/` (data fixture). Lokasi berbeda dari architecture 14.1 (`tests/fixtures/replays/`) karena di luar wilayah tulis QA; LP boleh memindah.
- Smoke per browser dilewati bila browser tidak terpasang (CI hanya Chromium); itu bukan pelonggaran karena di mesin QA semua browser terpasang dan dijalankan.

## 9. Pertanyaan dan permintaan ke Producer

1. Pengecualian tertulis untuk M1-07 (CW-2, CW-4, 8.3, 8.4, 8.6, uji 1 detik proksi), DV-6, dan A-06 langkah 3: setuju dipindah ke M2?
2. BUG-002: tugaskan LP (satu baris `<link rel="icon">` di `index.html`), lalu QA mengulang smoke Chrome dan Edge.
3. Izin unduh WebKit Playwright `webkit-2370` agar smoke WebKit tidak lagi indikatif?
4. BUG-001 (MAYOR) dijadwalkan untuk GP di awal M2 atau sebelum push M1?
5. LP: buat skrip `test:bot` dan folder `tests/bot/`, lalu pindahkan `tests/unit/qa/bot-real-data.test.ts` (saat ini ikut `npm test`, sekitar 3 s).

## 10. Hasil `npm run test:e2e` akhir

`npm run test:e2e` kode 1, 5,1 menit (`logs/test-e2e-final.log`, `logs/exit-codes.txt`): **15 lulus, 2 gagal.**

| Spec | Tes | Hasil |
|---|---|---|
| `smoke.spec.ts`, `full-run.spec.ts` (LP) | 4 | Lulus |
| `keyboard-play.spec.ts` | Alur keyboard penuh 1920x1080 | Lulus (39 s) |
| `determinism.spec.ts` | D-5, D-8 | Lulus |
| `browser-bot.spec.ts` | E-13 seed 101, 202, 303 | Lulus |
| `screens.spec.ts` | Set screenshot 1920x1080, 1280x720; stres | Lulus (stres headless: rata-rata 116 dan 114 Unlit, 43 fps) |
| `smoke-firefox.spec.ts`, `smoke-webkit.spec.ts` | Smoke | Lulus |
| `smoke-chrome.spec.ts`, `smoke-msedge.spec.ts` | Smoke | **Gagal**: hanya `console.error` 404 `favicon.ico` (BUG-002); butir 1 sampai 4, 8, 9 lain lolos, D-5 identik |

## 11. Daftar file dibuat atau diubah QA

- Dokumen: `docs/qa/test-plan.md` (v1.1), `docs/qa/accessibility.md` (v1.1), `docs/qa/bugs.md`, `docs/qa/M1-report.md`, bukti di `docs/qa/evidence/M1/` (screenshot, JSON, log).
- Tes e2e: `tests/e2e/keyboard-play.spec.ts`, `determinism.spec.ts`, `browser-bot.spec.ts`, `screens.spec.ts`, `smoke-chrome.spec.ts`, `smoke-msedge.spec.ts`, `smoke-firefox.spec.ts`, `smoke-webkit.spec.ts`, `support/qa.ts`, `support/node-sim.ts`, `support/smoke.ts`.
- Tes unit: `tests/unit/qa/bot-real-data.test.ts`, `determinism-qa.test.ts`, `bugs-m1.test.ts`, `support/qa-bot.ts`, `support/record.ts`, `support/real-data.ts`, `support/scripted-run.ts`, `support/sim-cli.ts`, `replays/golden-11.json`, `golden-22.json`, `golden-33.json`.
- Kode produksi: tidak diubah.

## 12. Ringkasan lolos dan gagal

Main loop bisa dimainkan penuh dengan keyboard, deterministik lintas proses dan lima browser, autosave dan Continue mempertahankan hash, bot headless dan browser menyelesaikan run tanpa error, stres 120 musuh jauh di bawah anggaran sim. Gagal formal hanya karena favicon 404 di Chrome dan Edge (MINOR) dan butir test-plan yang belum diuji tanpa pengecualian. Satu MAYOR (ringkasan build basi) tidak menghalangi keluar M1 tetapi perlu diperbaiki.
