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
| BUG-001 | Ringkasan build (Pause, akhir run) menampilkan build run sebelumnya, atau kosong, selama Pulse 1 | MAYOR | TERBUKA | M1 | sim, ui | GP (usulan) | `tests/unit/qa/bugs-m1.test.ts` (2 kasus `it.fails`) |
| BUG-002 | `favicon.ico` 404 memunculkan `console.error` di Chrome dan Edge sungguhan | MINOR | TERBUKA | M1 | build | LP (usulan) | `tests/e2e/smoke-chrome.spec.ts`, `smoke-msedge.spec.ts` |
| BUG-003 | Teks flavor kartu Memento terpotong elipsis di the Glazier dan hadiah Warden | MINOR | TERBUKA | M1 | ui | UI (usulan), WR bila memendekkan teks | `tests/e2e/screens.spec.ts` (`screens-layout-*.json`) |
| BUG-004 | Hook `goToScreen('confirm')` gagal: berakhir di layar `pause` | MINOR | TERBUKA | M1 | build | LP (usulan) | Jalur keyboard di `tests/e2e/screens.spec.ts` |
| BUG-005 | Baris Memento di ringkasan build menjorok dibanding baris senjata | MINOR | TERBUKA | M1 | ui | UI (usulan) | Screenshot saja |

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
- Status: TERBUKA
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

**Catatan perbaikan (diisi programmer):** saat memperbaiki, ubah kedua `it.fails` menjadi `it` di `tests/unit/qa/bugs-m1.test.ts`.

**Uji ulang (diisi QA):**

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

**Catatan perbaikan (diisi programmer):**

**Uji ulang (diisi QA):**

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

**Uji ulang (diisi QA):**

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

**Uji ulang (diisi QA):**

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

**Uji ulang (diisi QA):**

---

## Bug yang diketahui (untuk rilis)

Diisi saat M5. Hanya bug MINOR berstatus DIKETAHUI yang boleh ada di sini. BLOCKER dan MAYOR tidak boleh dibawa ke rilis.

| Id | Ringkasan untuk pemain (Inggris) | Solusi sementara |
|---|---|---|
| | | |
