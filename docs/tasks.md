# Shardfall: Daftar Tugas dan Status

Pemilik file: Producer. Hanya Producer yang menulis file ini.

## Status milestone

| Milestone | Status | Catatan |
|---|---|---|
| M0 Konsep dan pilar | SELESAI | Semua dokumen SETUJU / SETUJU DENGAN CATATAN, pilar dan style guide v1.1 dikunci CD |
| M1 Prototipe main loop | SELESAI | Run 10 Pulse playable, determinisme terbukti, 17 e2e lulus, review LP LOLOS |
| M2 Vertical slice HD-2D | BERJALAN | Brief: docs/m2-creative-brief.md |
| M3 Konten penuh | BELUM | |
| M4 Polish dan QA | BELUM | |
| M5 Rilis | BELUM | |

## Mode kerja

- Dok memberi mandat penuh (2026-11-16): eksekusi mandiri tanpa bertanya, Producer memutuskan scope dan perbaikan. Semua tahap di-push ke repo publik `github.com/arthamegayasa/shardfall`.
- Hanya Producer yang menjalankan git. Subagent mengikuti `docs/team/agent-rules.md`.
- Prompt peran ada di `docs/team/HANDOFF.md` bagian 3. Alur milestone di bagian 4.

## Tugas M0

| ID | Tugas | Pemilik | Reviewer | Status |
|---|---|---|---|---|
| M0-01 | vision.md, pillars.md, style-guide.md | CD | Producer (scope) | SELESAI (scope disetujui Producer) |
| M0-02 | gdd.md | GD | CD, LP | SETUJU DENGAN CATATAN, GD menjawab Q01-Q41 |
| M0-03 | architecture.md, coding-standards.md | LP | Producer | SETUJU DENGAN CATATAN (perbaikan dibawa ke tugas M1) |
| M0-04 | art-direction.md, art-pipeline.md, konsep mood | AD | CD | SETUJU DENGAN CATATAN (perbaikan dibawa ke tugas M1) |
| M0-05 | audio-direction.md, audio-list.md | AU | CD | SETUJU DENGAN CATATAN (perbaikan dibawa ke tugas M1) |
| M0-06 | lore-premise.md, glossary.md | WR | CD | SETUJU DENGAN CATATAN (perbaikan dibawa ke tugas M1) |
| M0-07 | arena-design.md | LD | CD | SETUJU DENGAN CATATAN (perbaikan dibawa ke tugas M1) |
| M0-08 | ui-spec.md, wireframe | UI | CD | SETUJU DENGAN CATATAN (perbaikan dibawa ke tugas M1) |
| M0-09 | test-plan.md, accessibility.md | QA | Producer | SETUJU DENGAN CATATAN (perbaikan dibawa ke tugas M1) |
| M0-10 | Pertanyaan spec untuk GD | GP | GD | SELESAI (docs/specs/gp-questions-m0.md) |
| M0-11 | Review kreatif dan teknis M0 | CD, LP | Producer | SELESAI (docs/reviews/M0-cd.md, M0-lp.md) |

## Tugas M1

| ID | Tugas | Pemilik | Reviewer | Status |
|---|---|---|---|---|
| M1-00 | Jawab pertanyaan GP, perbaikan review M0 di gdd dan data-schema | GD | LP | SELESAI |
| M1-01 | Kerangka proyek, kontrak, pipeline data, CI, deploy Pages | LP | QA | SELESAI |
| M1-02 | Data M1 (CSV) dan model balance | GD | LP | SELESAI |
| M1-03 | Core loop sim | GP | LP, QA | SELESAI |
| M1-04 | HUD, toko, level-up, akhir run | UI | LP, CD | SELESAI |
| M1-05 | Placeholder berskala benar | AD | CD, LP | SELESAI |
| M1-06 | SFX placeholder | AU | CD, LP | SELESAI |
| M1-07 | Arena prototipe | LD | CD, LP | SELESAI |
| M1-08 | String table awal | WR | CD | SELESAI |
| M1-09 | Review kode, uji build, catatan rasa main | LP, QA, CD | Producer | SELESAI (LP LOLOS, QA LOLOS setelah favicon diperbaiki, CD SETUJU DENGAN CATATAN) |

## Tugas M2

| ID | Tugas | Pemilik | Reviewer | Status |
|---|---|---|---|---|
| M2-01 | Data slice: kepadatan, Glint, Warden, boss, tuning bot | GD | CD, LP | BERJALAN |
| M2-02 | Pipeline render HD-2D dan lingkungan diorama | LP | CD, QA | BERJALAN |
| M2-03 | Aset final slice, VFX, ikon, potret Glazier | AD | CD, LP | BERJALAN |
| M2-04 | Musik bioma 1 (Pulse, toko, boss), overlay Warden, SFX final | AU | CD, LP | BERJALAN |
| M2-05 | Event dampak, knockback, Warden affix, pola boss, BUG-001, MAYOR M1 | GP | LP, QA | BERJALAN |
| M2-06 | UI final slice, ikon, pengaturan, remap | UI | CD, LP | BERJALAN |
| M2-07 | arena_market final | LD | CD | BERJALAN |
| M2-08 | Teks slice, baris Glazier, perbaikan string | WR | CD | BERJALAN |
| M2-09 | Integrasi dan review LP, uji performa dan keterbacaan QA, putusan HD-2D CD | LP, QA, CD | Producer | BELUM |

## Keputusan

| Tanggal | Keputusan | Pemilik | Alasan |
|---|---|---|---|
| 2026-11-16 | Repo publik GitHub `arthamegayasa/shardfall`, push tiap tahap | Producer | Permintaan Dok |
| 2026-11-16 | Deploy build web ke GitHub Pages sejak M1 agar selalu ada versi yang bisa dimainkan | Producer | Dok ingin game langsung bisa dimainkan saat bangun |
| 2026-11-16 | Aset art dan audio dibuat prosedural lewat skrip di repo (pixel art dari data, audio Web Audio sintesis) | Producer (scope) | Lisensi bersih, bisa dibuat ulang, tanpa pembelian |
| 2026-11-16 | Scope 1.0: Tingkat A (vision.md 7.2) adalah lantai rilis wajib, Tingkat B target berkomitmen, Tingkat C dikejar bila waktu cukup (bioma tambahan memakai ulang Unlit dengan palet cahaya berbeda). GD merancang struktur data untuk C sejak awal | Producer | Waktu produksi satu malam, prioritas rasa main dan keterbacaan |
| 2026-11-16 | Font: font bitmap pixel buatan tim (data di kode) bila sempat; placeholder dan cadangan memakai font sistem monospace. Tidak mengunduh font eksternal | Producer | Lisensi bersih, tanpa jaringan |
| 2026-11-16 | Kamera ortografis miring sekitar 40 derajat, 1 px sprite = 3 px layar di 1080p sebagai titik awal kalibrasi M1 | CD (usul), LP dan AD kalibrasi | style-guide.md |
| 2026-11-16 | Lisensi proyek: hak cipta Dok (all rights reserved) sampai Dok memilih lisensi terbuka. Kolom lisensi aset di credits: "Buatan tim, hak cipta proyek" | Producer | Langkah paling aman dan bisa diubah kapan saja oleh Dok |
| 2026-11-16 | Safari asli tidak tersedia di Windows: WebKit Playwright dipakai sebagai proksi, dicatat sebagai keterbatasan. Unduh Firefox Playwright diizinkan | Producer | Alat tes gratis, tanpa pembelian |
| 2026-11-16 | Uji screenshot 1 detik (P2-a): subagent proksi selama produksi; konfirmasi manusia (Dok) dicatat sebagai sisa setelah rilis | Producer | Dok tidak tersedia malam ini |
| 2026-11-16 | Tab ditutup di tengah Pulse: lanjut dari autosave toko terakhir. Diterima | Producer | Sesuai architecture.md |
| 2026-11-16 | Urutan M1: blok pembuka LP (kerangka dan kontrak dibekukan) lebih dulu, lalu peran lain paralel. Dependensi npm usulan LP disetujui (three, typescript, vite, vitest, @playwright/test, eslint, typescript-eslint, @eslint/js, globals, prettier, @types/three) | Producer | architecture.md bagian 16 |
| 2026-11-17 | Keepsake diganti Memento (identifier `memento`). Istilah Temper, Fuse, The Keeping, Crack, Vitrine Steady, Light Kept, bioma The Moth Market / Vesper Steps / Stillfire Vineyard, kelas Lamplighter / Chorister / Vintner disetujui | CD | Risiko nama sistem Hades; docs/reviews/M0-cd.md |
| 2026-11-17 | Kamera pitch asin(0.625) = 38.68 derajat, 1 u = 16 px lebar dan 10 px kedalaman, arena 32 x 20 u | LP | docs/reviews/M0-lp.md |
| 2026-11-17 | @types/node disetujui. @vitest/coverage-v8 tidak dipakai | Producer | Hemat dependensi |
| 2026-11-17 | Perbaikan dokumen kecil dari review M0 untuk WR, AD, AU, LD, UI, QA dikerjakan sebagai langkah pertama tugas M1 masing-masing, bukan putaran terpisah | Producer | Hemat waktu, tidak menghalangi M1 |
| 2026-11-17 | Keluar M1: butir test-plan 13.1 berbasis gambar (CW-2, CW-4, 8.3, 8.4, 8.6), uji 1 detik proksi, DV-6, A-06 langkah 3 dikecualikan dari M1 dan wajib diuji di M2 | Producer | Bergantung pada visual final M2 |
| 2026-11-17 | Favicon 404 (BUG-002) diperbaiki Producer dengan ikon inline di index.html | Producer | Integrasi kecil |
| 2026-11-17 | Profil default build: `run_a` (10 Pulse, Warden P5, boss P10) | Producer | run_a_m1 tidak punya Warden dan boss |
| 2026-11-17 | Unduh WebKit Playwright terbaru diizinkan | Producer | Alat tes gratis |
| 2026-11-17 | Opsi bahasa di Settings: tidak di 1.0 (EN saja di UI, `?lang=id` tetap tersedia) | Producer | Hemat scope |
