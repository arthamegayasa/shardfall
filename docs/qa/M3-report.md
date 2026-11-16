# Laporan QA M3: Vertical Slice dan Konten Tingkat B

Tugas: M3-QA. Penguji: QA Lead. Tanggal: 2026-11-17. Untuk: Producer.
Cakupan: kriteria M2 yang dikecualikan dari M1, kriteria keluar M2 (test-plan 13.2), kriteria M3 (test-plan 13.3) untuk konten Tingkat B, audit aksesibilitas A-01 sampai A-12, main per kelas dengan keyboard.

## 1. Kepala

| Item | Nilai |
|---|---|
| Build | Kerja lokal 2026-11-17, belum di-commit; `contentHash` 2008c1b6, tingkat konten B (`content/build.json`), profil default `run_b` (15 Pulse, Warden P4 dan P10, boss P15) |
| Konten | 3 kelas, 8 senjata, 22 Memento, 6 tag (18 ambang), 3 Rite, 5 affix, 10 Unlit (termasuk 2 Warden, 1 boss), 1 bioma (The Moth Market), 5 unlock meta |
| Mesin | Windows 11, Ryzen 7 5800H, RTX 3060 Laptop + AMD Radeon terintegrasi, layar 128 sampai 132 Hz terukur |
| Node, Playwright | Node 24.19.0, `@playwright/test` 1.64.1 |
| Browser | Chromium Playwright (headless dan headed, GPU lewat ANGLE D3D11), Google Chrome 157, Microsoft Edge 157, Firefox Playwright 157, WebKit Playwright (smoke) |
| Profil performa | P-DEV (RTX 3060) dan P-REF (AMD Radeon terintegrasi terkonfirmasi lewat string GPU WebGL, throttling CPU 2x lewat CDP), headed |

Semua path bukti relatif terhadap `docs/qa/evidence/M3/` kecuali disebut lain. Bukti mentah lengkap ada di `tests/out/qa/m3/` (di-gitignore, bisa dibuat ulang dengan perintah di bagian 8).

## 2. Putusan akhir

**GAGAL (formal). Konten Tingkat B dan vertical slice bisa dimainkan penuh, tidak ada BLOCKER.**

Yang lolos dengan bukti: semua konten Tingkat B muncul dan dipakai tanpa error di 3 kelas, run `run_b` bisa dimenangkan tiap kelas, determinisme `run_b` lintas proses, save dan load, unlock lewat Silt, performa jauh di dalam anggaran di P-REF pada kualitas Low, Medium, High, uji 1 detik proksi 4 dari 5, DoF hanya di pita, skala pixel tajam, kontras proyektil musuh dan sorotan pemain, sebagian besar checklist aksesibilitas.

Yang membuat laporan GAGAL (test-plan 1.5 dan 13):
1. **BUG-007 (MAYOR, AD):** Market Cur saat ancang-ancang lebur dengan lantai di grayscale (kontras 1,0:1). M2-05 dan M3-05 GAGAL.
2. **BUG-010 (MAYOR, UI):** urutan fokus panah di the Glazier tidak mengikuti tata letak (A-07).
3. TIDAK DIUJI tanpa pengecualian: DV-6 (tidak ada aturan lint string hardcode), CW-3 (butuh hook isolasi lapis), M3-03 kurva kesulitan (target B tertulis GD belum ada), waktu toko manusia S-12, uji 1 detik manusia (sisa yang sudah diterima Producer).

Kriteria keluar M3 di HANDOFF 4.1: "semua konten scope bisa dimainkan" LOLOS untuk Tingkat B, "tidak ada bug BLOCKER terbuka" LOLOS, "kurva kesulitan sesuai target GD" menunggu GD (angka di bagian 6.4).

## 3. Kriteria M2 yang dikecualikan dari M1 (tasks.md Keputusan 2026-11-17)

| ID | Kriteria | Putusan | Nilai terukur | Bukti |
|---|---|---|---|---|
| CW-2 | Palet VFX dan partikel per kubu | LOLOS | `art:check`: 79 sprite termasuk 22 sprite VFX `fx-*`, 0 gagal (sisi palet per kubu). Warna VFX di kode diambil dari token palet (`linearRgb(palette, token)`); satu-satunya hex di luar palet di `src/render` adalah warna clear `#000000` dan fallback debug `#ff00ff` untuk token yang hilang | `logs/check-m3.log`; pindai hex QA di bagian 8 |
| CW-4 | Merah UI hanya untuk HP rendah dan peringatan boss; harga tak terjangkau redup | LOLOS | Pemindai DOM di 13 layar: `danger-red` hanya di bingkai bar HP dan ikon retak saat HP rendah (Pulse biasa dan Pulse boss); nol di layar lain. Tawaran tak terjangkau diberi kelas `is-unaffordable`, nama dan harga redup | `cw4-ui-colours.json`, `play-bell-glazier.png` |
| 8.3 | Grayscale pemain > lantai > Unlit, selisih 15 | GAGAL sebagian | Rata-rata adegan puncak: pemain 130, lantai 86, Unlit median 37 (selisih 44 dan 49, lolos). Tetapi Market Cur yang ancang-ancang bernilai 86 sama dengan lantai (BUG-007) | `analysis.json`, `crop-unlit-windup-2x.png` |
| 8.4 | Skala pixel integer, tanpa piksel campuran | LOLOS | 100% blok 3x3 di kotak sprite pemain seragam (deviasi kanal maksimal 2) di Low, High, dan Reduce Effects pada 1920x1080; zoom 400% menunjukkan blok rapi | `analysis.json`, `crop-player-low-4x.png` |
| 8.6 | Inti proyektil musuh tetap warna bahaya di bawah efek pemain terbesar | LOLOS | 8 dari 8 proyektil di bawah flare Rite tetap `danger-magenta` (hue 320) atau putih inti | `analysis.json` (`draworder-rite`) |
| DV-6 | Tidak ada string UI hardcode | TIDAK DIUJI | Tidak ada aturan lint atau tes untuk literal di `src/ui` (`eslint.config.js` hanya melarang API nondeterministik). Pemindai e2e kunci mentah di semua layar: nol | `screens.spec.ts` (rawText) |
| A-06 langkah 3 | Jeda otomatis saat tab tersembunyi | LOLOS (simulasi) | Chromium Playwright menonaktifkan backgrounding: tab kedua dan jendela minimize tetap `visible`. Simulasi lewat jalur handler app (`document.hidden` + `visibilitychange`): tick beku 214 ke 214 selama 1,5 s, lanjut lagi saat terlihat | `a11y-results.json` (E-16) |
| Uji 1 detik proksi | 5 bingkai paling ramai, 4 dari 5 | LOLOS (proksi) | Pemain benar 5 dari 5 (galat 2 sampai 3 px dari 30 px), ancaman benar 4 dari 5 | Bagian 4.1 |

## 4. Kriteria keluar M2 (test-plan 13.2)

| ID | Kriteria | Putusan | Bukti | Perintah |
|---|---|---|---|---|
| M2-01 | Regresi M1 | LOLOS | `npm run check` kode 0; semua tes M1 di `npm run test:e2e` lulus (smoke Edge lulus setelah perbaikan tes, bagian 8) | `npm run check`, `npm run test:e2e` |
| M2-02 | Run bioma pertama penuh dengan Warden dan boss | LOLOS | Bot `run_b` 3 kelas x 2 bot x 20 seed tanpa timeout; cakupan HP penuh 9 dari 9 menang (kedua Warden dan Paper Sun dibunuh, 2 fase, 6 pola); E-13 3 seed; `glance-2-warden.png`, `glance-3-boss.png` | `run-bots.ts`, `content-b.test.ts`, `m3-visual.spec.ts` |
| M2-03 | Performa PF-1 sampai PF-4 | LOLOS | Bagian 4.3 | `QA_PERF=1 [QA_PREF=1] npx playwright test tests/e2e/m3-perf.spec.ts` |
| M2-04 | Keterbacaan 1 detik | LOLOS (proksi) | Bagian 4.1 | Subagent proksi |
| M2-05 | Kontras dan kode warna di screenshot final | GAGAL | 8.2: proyektil musuh 7,21:1 (min, 8 titik), sorotan pemain 7,1 sampai 7,3:1, Unlit median 2,2:1 tetapi P10 1,09:1 (BUG-007). CW-3 TIDAK DIUJI (tidak ada hook isolasi lapis) | `analysis.json` |
| M2-06 | DoF dan kualitas rendah | LOLOS untuk DoF dan Low; CW-3 di Low TIDAK DIUJI | DoF ON vs OFF: 0 piksel berbeda di dalam arena, 57039 di pita atas (alat LP `measure.py --dof`). Low: draw call 13 (Medium 18, High 21), tanpa DoF, bloom, kilau kaca (`qualityProfile`), hash sim sama di semua mode | `peak-low.png`, `peak-high.png`, `analysis.json` |
| M2-07 | Autosave dan lanjut | LOLOS | D-4 `run_b` 3 kelas (save di toko Pulse 3, load, lanjut sampai akhir run: tick, fase, hash sama); E-15 di `full-run.spec.ts` dan `keyboard-play.spec.ts` lulus | `content-b.test.ts`, `npm run test:e2e` |
| M2-08 | Pengaturan E-14, E-16, E-17 | LOLOS | E-14: ubah kualitas, Master, 6 opsi Accessibility dari jeda, hash sama, nilai identik setelah reload. E-16: simulasi (lihat A-06 langkah 3). E-17: 1920x1080, 1280x720, 1366x768 saat Pulse: HUD tampil, nol error | `a11y-results.json` |
| M2-09 | Aksesibilitas slice A-01, A-02, A-03, A-05, A-06 | LOLOS | Bagian 5. A-05 Largest sempat bertumpuk (BUG-011) dan DITUTUP setelah ikon AD masuk | `m3-a11y.spec.ts` |
| M2-10 | Kredit aset | LOLOS | 92 file di `art/sprites`, `art/tiles`, `audio/` semua punya baris di `docs/credits.md`. Catatan: 4 file arena `content/levels/*.json` (data LD) tidak tercantum, di luar cakupan skrip M2-10 | Skrip QA bagian 8 |
| M2-11 | Tidak ada BLOCKER | LOLOS | `bugs.md`: 0 BLOCKER | |

### 4.1 Uji 1 detik (test-plan 10, brief S-1)

Lima bingkai 1920x1080 kualitas High dengan GPU (`m3-visual.spec.ts`): G1 Pulse puncak (78 Unlit, 14 telegraf), G2 Warden Pulse 4, G3 boss Paper Sun dengan 5 telegraf, G4 telegraf bertumpuk tepat di atas pemain (6 Market Cur dan 4 Hawker di sekeliling), G5 Pulse 13 setelah 20 s. Diperkecil ke 480x270 dan diburamkan ringan, diacak, lalu diberikan ke **satu subagent baru tanpa konteks** (proksi). Kunci jawaban dari hook. Radius lolos 30 px (2 x tinggi sprite pemain 15 px di 480x270).

| Gambar | Adegan | Galat pemain (px) | Galat ancaman (px) | Lolos | Catatan proksi |
|---|---|---|---|---|---|
| a | G1 puncak | 2,5 | 12,4 | Ya | "cahaya cyan di tengah cincin musuh" |
| b | G3 boss | 2,8 | 47,5 | Tidak (ancaman) | Proksi menunjuk orb boss; ancaman terdekat adalah lingkaran telegraf yang berpusat di pemain. Pemain ditemukan dengan keyakinan 2/5 |
| c | G2 Warden | 2,1 | 5,3 | Ya | |
| d | G4 bertumpuk | 2,5 | 11,0 | Ya | Proksi: garis X merah "menutupi" pemain, ditemukan lewat cincin putih; keyakinan 2/5 |
| e | G5 Pulse 13 | 2,1 | 9,9 | Ya | Unlit yang menempel ke pemain membuat outline sulit dibaca |

**Hasil: 4 dari 5 (LOLOS, proksi).** Konfirmasi manusia tetap sisa (Keputusan Producer 2026-11-16). Catatan untuk CD (bukan bug): di G4 garis tepi telegraf digambar di atas isian sprite pemain; siluet tembus (outline putih dan cincin kaki cyan) tetap di atas sesuai K3 M1-cd, dan proksi tetap menemukan pemain, tetapi keyakinannya rendah (`crop-stack-4x.png`). Bukti: `glance-proxy-sheet.png`, `glance-score.json`, `glance-4-stack.png`.

### 4.2 Kontras, grayscale, dan buta warna (8.2, 8.3, A-04 langkah 3)

Diukur oleh `tests/e2e/support/m3_analyze.py` di screenshot GPU 1920x1080. Lantai = median warna arena jauh dari aktor dan telegraf (sekitar 10 ribu sampel).

| Ukuran | Ambang | Nilai | Putusan |
|---|---|---|---|
| Inti proyektil musuh vs lantai | 4,5:1 semua titik | min 7,21:1 (8 titik) | LOLOS |
| Sorotan pemain vs lantai | 3,5:1 | 7,09 sampai 7,31:1 | LOLOS |
| Badan Unlit vs lantai | median 2:1, P10 1,5:1 (S-3) | median 2,2:1, P10 1,09:1 (High), 1,21:1 (Low), min 1,0:1 | GAGAL (BUG-007) |
| Grayscale pemain > lantai > Unlit | selisih 15 | 130 > 86 > 37 (rata-rata); Market Cur ancang-ancang 86 = lantai | GAGAL sebagian |
| Simulasi Machado 2009 keparahan 1 (protan, deutan, tritan) | inti bahaya 4,5:1 | 7,34 / 7,14 / 7,22:1; sorotan pemain 7,0 sampai 7,2:1 | LOLOS |

Mode buta warna di Settings hanya menukar token CSS UI (placeholder ui-spec 9); dunia game tidak berubah (Protan identik piksel dengan Off). Palet mode milik AD di M4 (accessibility.md A-04 "M4 (mode)").

### 4.3 Performa (test-plan 9, PF-1 sampai PF-4, PF-7)

Skenario: Pulse 11 (40 s), `spawnStress('peak')`, Unlit dijaga di 120 lewat `debug.spawn` tiap 200 ms dan HP penuh; pemanasan 5 s, ukur 30 s dengan perekam rAF independen dan `getPerf()`; headed, 1920x1080, Reduce Effects mati.

| Profil | Kualitas | GPU | Unlit min/rata/maks | Frame rata | p95 | p99 | fps | Sim tick p95 | Draw call | Segitiga |
|---|---|---|---|---|---|---|---|---|---|---|
| P-REF | Low | AMD Radeon (ANGLE D3D11) | 84 / 115 / 130 | 7,64 ms | 8,2 | 8,5 | 130,9 | 0,5 ms | 13 | 8571 |
| P-REF | Medium | AMD Radeon | 72 / 115,5 / 132 | 7,68 | 8,2 | 8,5 | 130,2 | 0,8 | 18 | 8792 |
| P-REF | High | AMD Radeon | 86 / 114,1 / 132 | 7,66 | 8,2 | 8,5 | 130,5 | 0,7 | 21 | 8629 |
| P-DEV | Low | RTX 3060 | 85 / 112,5 / 124 | 7,59 | 8,1 | 8,4 | 131,7 | 0,2 | 13 | 8655 |
| P-DEV | Medium | RTX 3060 | 83 / 111,8 / 126 | 7,59 | 8,1 | 8,4 | 131,7 | 0,2 | 18 | 9082 |
| P-DEV | High | RTX 3060 | 93 / 112 / 134 | 7,59 | 8,1 | 8,4 | 131,7 | 0,2 | 21 | 8433 |

PF-1 (p95 16,7 ms, p99 25 ms) LOLOS, PF-2 (Low p99 20 ms) LOLOS, PF-3 (sim p95 4 ms) LOLOS, PF-7 (60 draw call, 100 ribu segitiga) LOLOS. Frame dibatasi laju layar (sekitar 131 Hz), jadi semua kualitas tampak sama; ruang kepala sebenarnya tidak terukur di sini. `eventOverflow` 0 dan `poolOverflow` 0 di semua run. PF-4 (judul interaktif): lihat bagian 8 (log smoke). P-REF memakai flag `--force_low_power_gpu`; GPU terintegrasi terkonfirmasi lewat `WEBGL_debug_renderer_info`, bukan diasumsikan.

### 4.4 Pengaturan kualitas berfungsi

Low, Medium, High memberi gambar dan beban render berbeda (draw call 13, 18, 21; 389 ribu sampai 439 ribu piksel berbeda dari Low) dengan hash sim identik (`35aa7f27` di 8 mode). Catatan: `playwright.config.ts` mengemulasi `prefers-reduced-motion`, sehingga Reduce Effects aktif secara default di tes (A-11 bekerja); tes visual menyetelnya mati secara eksplisit.

### 4.5 Waktu toko (brief S-12, P4-f)

TIDAK DIUJI untuk manusia. Bukti proksi: satu toko butuh 1 tombol untuk beli (Digit), 1 untuk reroll (R), 1 untuk mulai (B); keluar toko skrip 0,85 sampai 1,0 s. Estimasi GD tetap 20 s per toko (`balance-report.md`). Median 25 s atau kurang perlu playtest manusia.

### 4.6 Smoke Edge flaky (BUG-006)

Probe 4 peluncuran Edge: peluncuran pertama `screen=pulse phase=idle tick=14` beku 400 ms setelah Begin, lalu sim jalan; peluncuran lain mulai dalam 100 ms. Tombol yang ditekan di jendela itu hilang. `smoke.ts` kini menunggu fase `pulse` dan tick bertambah, dan mencatat jedanya (bukan pelonggaran: butir 3 tetap mewajibkan gerak lebih dari 0).

## 5. Aksesibilitas (accessibility.md)

| ID | Butir | Putusan | Nilai terukur | Bukti | Bug |
|---|---|---|---|---|---|
| A-01 | Remap | LOLOS | Rite ke K lewat keyboard: K cast, Space tidak; tetap setelah reload; K ke Move Left menukar ("Swapped with Rite.", Rite jadi A); reset default dengan "Press again"; event `code: KeyW`, `key: z` menggerakkan ke atas | `a01-remap.png`, `a11y-results.json` | |
| A-02 | Kurangi efek dan kilat | LOLOS | Hash sim sama ON dan OFF; telegraf tetap (1315 vs 1316 piksel merah); Reduce mematikan DoF, bloom, kilau, shake (`qualityProfile`, draw call 13). Uji kilat 480 frame (buka Pulse, Rite, kerumunan, tutup Pulse, fase boss): area berubah terbesar dalam satu frame 4,8% (normal), 6,7% (reduce); 0 transisi di atas 25% layar, 0 kilat umum, 0 kilat merah. Jumlah partikel dan amplitudo shake tidak terbaca lewat hook (dinilai dari profil kode) | `flash-dmg.json` | |
| A-03 | Matikan angka damage | LOLOS | OFF: perbedaan dengan ON hanya di area digit (5868 piksel di kotak 429x102), tersimpan setelah reload. ON: 20 frame, tidak ada digit di atas sprite pemain (dicek visual di frame terburuk). Metode diff per frame hanya indikatif: faktor interpolasi render berbeda antar boot sehingga Unlit bergeser | `flash-dmg.json` | |
| A-04 | Buta warna dan info bukan hanya warna | LOLOS untuk bagian M2 (audit warna, simulasi); mode TIDAK DIUJI (M4) | Simulasi tiga jenis lolos kontras (4.2). UI: rarity punya pip, tak terjangkau punya kelas dan redup, HP rendah punya ikon retak, tag punya bentuk ikon berbeda. Mode hanya mengubah token UI | `cw4-ui-colours.json` | |
| A-05 | Ukuran teks | LOLOS | 3 skala x 6 layar (Glazier, Temper, Settings, Pulse, akhir run, hadiah Warden) x 3 resolusi: 0 teks terpotong, bertumpuk, atau keluar layar. Run pertama: Largest bertumpuk karena monogram "CP" (BUG-011), hilang setelah ikon AD masuk. Tinggi huruf besar 14 px di 1280x720 skala Normal (ambang 14) | `a05-scale2-glazier-1280x720.png` | BUG-011 (DITUTUP) |
| A-06 | Jeda kapan saja | LOLOS | Esc dan P di Pulse, Temper, Glazier, Pulse Warden: tick dan posisi beku 2 s sambil D ditahan; tab tersembunyi lewat simulasi (3) | `a11y-results.json` | |
| A-07 | Navigasi keyboard penuh | GAGAL | 10 layar: semua elemen interaktif tercapai (Glazier: semua tercapai lewat urutan lain), fokus selalu terlihat, Esc kembali satu langkah (judul tetap judul, akhir run tetap). Urutan panah Glazier salah (BUG-010). Alur main penuh 3 kelas tanpa pointer: nol event pointer | `a11y-results.json`, `play-log.txt` | BUG-010 |
| A-08 | Kontras teks UI | TIDAK DIUJI | Belum diukur per glyph; dijadwalkan M4 | | |
| A-09 | Padanan visual suara, volume terpisah | TIDAK DIUJI sebagian | Slider Master, Music, SFX, UI ada dan tersimpan (E-14). Gain bus audio tidak terbaca lewat hook | | |
| A-10 | Pengaturan dari jeda | LOLOS | Lihat E-14 (M2-08) | `a11y-results.json` (A-10/E-14) | |
| A-11 | Hormati preferensi sistem | LOLOS | `reduce`: Reduce Effects aktif; `no-preference`: mati | `a11y-results.json` | |
| A-12 | Tanpa batas waktu di luar Pulse | LOLOS untuk layar; GAGAL untuk cek tick ([Saran]) | Diam 60 s: layar tidak berpindah di Temper, Glazier, Pause, Settings. Tick beku di Pause dan Settings, tetapi naik 3600 di Temper dan Glazier. Tidak ada timer toko, jadi opsi timer toko tidak relevan | `a11y-results.json` | BUG-013 |

## 6. Kriteria M3 (test-plan 13.3)

| ID | Kriteria | Putusan | Bukti | Perintah |
|---|---|---|---|---|
| M3-01 | Regresi M1 dan M2 | LOLOS | `npm run check` kode 0 (607 tes); e2e: semua tes regresi lulus, satu-satunya merah adalah A-12 baru (BUG-013, MINOR) | `npm run check`, `QA_LONG=1 npm run test:e2e` |
| M3-02 | Semua konten bisa dimainkan | LOLOS | 6.1 sampai 6.3 | `npx vitest run tests/unit/qa` |
| M3-03 | Kurva kesulitan | TIDAK DIUJI (menunggu target B GD) | Angka di 6.4 | `run-bots.ts` |
| M3-04 | Ragam build | LOLOS (tipis) | B-6: 50 run, tag dominan di toko terakhir: edge 19, flame 19, shard 5, echo 4, ward 3 (maksimal 38%, ambang 40%). Seri dipecah ke urutan data, jadi flame sedikit diuntungkan; bot sering mati di Pulse 3 sampai 5 sehingga build kecil | `content-b.test.ts` |
| M3-05 | Keterbacaan dan kontras konten penuh | GAGAL | Uji 1 detik LOLOS (proksi); kontras Unlit GAGAL (BUG-007). Tingkat B hanya punya satu bioma | Bagian 4.1, 4.2 |
| M3-06 | Validasi data DV-1 sampai DV-7 | DV-1 sampai DV-5 dan DV-7 LOLOS, DV-6 TIDAK DIUJI | `data:check` tier B 0 error 0 peringatan, string 0 error; P1-a: 6 dari 22 Memento datar (27%, batas 30%) | `npm run data:check` |
| M3-07 | Performa tidak turun | LOLOS | 4.3 | |
| M3-08 | Tidak ada BLOCKER | LOLOS | `bugs.md` | |

### 6.1 Matriks kelas x `run_b` (B-7, B-1, B-2)

- QA `dodgerRandom`, 3 kelas x 5 seed x (tanpa unlock dan semua unlock) = 30 run: 30 selesai (8 menang), 0 timeout, 0 pelanggaran invarian.
- Cakupan HP penuh (QA, semua unlock): 3 kelas x 3 seed = 9 dari 9 menang 15 Pulse, Silt 41 per run menang.
- Bot GD (`tools/balance/bot/run-bots.ts`), 20 seed per baris, 0 timeout, `poolOverflow` 0. Angka identik dengan tabel review M2 LP (regresi determinisme lintas waktu):

| Kelas | Bot | Menang | Kematian | Silt median kalah / menang | Unlit hidup maks | Durasi menang perkiraan |
|---|---|---|---|---|---|---|
| lantern | naive | 25% | P3 x4, P4 x7, P5 x2, P6, P10 | 3 / 41 | 79 | 20,1 menit |
| lantern | good | 80% | P4 x3, P10 | 3 / 41 | 75 | 14,6 menit |
| bell | naive | 10% | P3 x4, P4 x13, P6 | 3 / 41 | 77 | 28,5 menit |
| bell | good | 55% | P4 x8, P10 | 3 / 41 | 82 | 15,9 menit |
| blade | naive | 70% | P4 x3, P5, P6, P10 | 5,5 / 41 | 107 | 21,2 menit |
| blade | good | 95% | P4 | 3 / 41 | 91 | 14,5 menit |

### 6.2 Konten Tingkat B muncul dan dipakai (M3-02)

| Konten | Hasil | Bukti |
|---|---|---|
| Unlit | 10 dari 10 muncul di `run_b`: swarmer, charger, shooter, tank, exploder, summoner, mote (dari summoner), warden_hound, warden_choir, boss_lantern | `qa-unit-m3.log` |
| Warden dan boss | Kedua Warden dibunuh, Paper Sun dibunuh dengan transisi ke fase 2; 6 dari 6 pola boss dimulai | idem |
| Affix | Data Warden B: volley, blinking, veiled dipasang; hasted dipasang saat overtime. `brood` hanya muncul di Crack 2 (uji terpisah 12 seed, dipasang dan memicu summon tanpa error) dan tidak bisa muncul di Tingkat B (BUG-012) | idem |
| Rite | flare_lantern, great_toll, glass_step di-cast oleh kelasnya | idem |
| Senjata | 8 dari 8 ditawarkan dan menembak; tiap senjata menembak dan mengenai target dalam 5 s Pulse berikutnya | idem |
| Memento | 22 dari 22 ditawarkan di toko atau peti. 17 terlihat efeknya dalam 5 s (proc, stat, damage, status, Barrier, heal, Glint, harga toko). 5 berbasis peluang atau pungutan baru terlihat di uji padat 20 s: coal_locket (Burn 8%), prism_lens (tiap hit proyektil ke-5), dust_hourglass (15% saat pungut), lucky_button (kill kritikal), magpie_tin (15% saat pungut). Catatan untuk CD dan GD terhadap S-11 "terlihat dalam 5 s" | idem |
| Sinergi | 18 dari 18 ambang aktif saat jumlah tag mencapai ambang (diberi lewat `debug.grant`); di main bot alami 17 dari 18 (echo 6 tidak tercapai) | idem |
| Unlock | Tanpa unlock: tithe_coin, dust_hourglass, lucky_button, haggler_seal, grinding_wheel tidak pernah ditawarkan (4 run); dengan unlock semuanya muncul | idem |
| Silt dan The Keeping | Run Lamplighter yang Abandon di Pulse 7 memberi 6 Silt (tercatat di `shardfall.meta.v1` dan tampil di layar akhir run); Vintner dibeli di The Keeping dengan pola "Press again" lalu dimainkan. Chorister dibeli dengan Silt dari hook `grantSilt` (60 Silt di atas hasil satu run) | `play-log.txt`, `play-lantern-run-end.png`, `play-lantern-keeping.png` |

### 6.3 Determinisme regresi (`run_b`)

| Tes | Hasil |
|---|---|
| D-1 per kelas | Run bot penuh diputar ulang 2 kali, semua checkpoint cocok: lantern menang 54323 tick (905 checkpoint), bell kalah 18029 tick, blade menang 54286 tick |
| D-2 per kelas | Replay 4 menit diputar di proses Node terpisah: `mismatchAt -1`, hash akhir sama |
| D-4 per kelas | Save di toko Pulse 3, load di sim baru, lanjut sampai akhir run: tick, fase, hash sama |
| D-5, D-8, E-13 | Lulus di suite e2e (Chromium vs Node identik; replay keyboard nyata dan 3 run bot browser cocok di Node) |
| D-1, D-2, D-3, D-6, D-7 lama | Lulus di `npm test`; replay emas tidak diubah |
| Hash mode tampilan | 8 mode kualitas, efek, dan warna memberi hash sim sama (`35aa7f27`) |
| Bot GD | Tabel 6.1 identik dengan review M2 LP |

### 6.4 Angka kurva untuk GD (bukan putusan)

Target B tertulis yang ada: durasi run menang 15 sampai 20 menit (`balance-report.md` 5). Bot `good`: 14,5 sampai 15,9 menit (blade dan lantern sedikit di bawah 15). Warden P4 adalah dinding utama bot `naive` (dan `good` untuk bell: 8 dari 9 kematian). Main keyboard skrip QA: setelah Pulse 1, Lamplighter dan Vintner punya 13 sampai 16 Glint dan tawaran pertama tidak terjangkau (sama dengan catatan M1). Target win rate per kelas untuk B belum tertulis.

## 7. Main sendiri lewat Playwright (keyboard)

Satu tes, 1920x1080, High, GPU, tanpa pointer (`m3-play.spec.ts`), per kelas: judul, pilih kelas, Pulse 1 real time dengan tombol nyata (sekitar 20 s, 55 sampai 74 perubahan tombol, Rite 1 sampai 3 kali), Temper, Glazier (Digit1, R), Pulse 2 (6 s), Pause, Abandon, layar akhir run, The Keeping. Semua screenshot dilihat QA.

Temuan visual dan UX:
- BUG-008 banner boss sisa run sebelumnya (`glance-4-stack.png`).
- BUG-009 kunci input dan fokus saat kembali dari The Keeping.
- Ikon untuk 10 Memento B dan 2 Rite B belum ada saat main pertama (monogram "MT", "PC", "CP", slot Rite "9T" karena angka cooldown di atas monogram "GT"): MINOR 1 review M2 LP. AD memasangnya selama M3 (art:check 79 lalu 91 sprite); ulang A-05 menunjukkan ikon tampil.
- Layar akhir run: pemain terlihat di celah antar panel (dunia di belakang). Kosmetik, tidak dicatat.
- BUG-001, BUG-003, BUG-005 terverifikasi beres (bagian 9).

## 8. Perintah yang dijalankan

| Perintah | Hasil |
|---|---|
| `npm run check` (awal) | Kode 0: data B 0 error, string 0 error, 79 sprite 0 gagal, 4 arena, audio 11,2 KB, format, typecheck, lint, 64 file 575 tes, build, bundle (JS awal 269,4 KB gzip) |
| `npm run test:e2e` (awal) | Kode 1: 17 lulus, 1 gagal (smoke Edge, BUG-006) |
| `node tools/balance/bot/run-bots.ts --bot naive|good --profile run_b --class lantern|bell|blade --seeds 1-20` | 6 baris, kode 0 (tabel 6.1) |
| `node tests/render/hd2d/capture.ts` lalu `python tests/render/hd2d/measure.py --dof ...` | Kode 0; DoF di dalam arena 0 piksel |
| `npx vitest run tests/unit/qa --silent=false` (akhir) | Kode 0: 4 file, 28 tes lulus (`content-b.test.ts` 16 tes, sekitar 70 s) (`logs/qa-unit-m3.log`) |
| `npx playwright test tests/e2e/m3-visual.spec.ts`, `m3-play.spec.ts`, `m3-a11y.spec.ts` | Visual 4 dari 4, main 1 dari 1, a11y 12 dari 12 lulus (A-12 opt-in) |
| `QA_PERF=1 npx playwright test tests/e2e/m3-perf.spec.ts` dan dengan `QA_PREF=1` | 3 dari 3 dan 3 dari 3 lulus (4.3) |
| `python tests/e2e/support/m3_analyze.py`, `python tests/e2e/support/m3_flash.py` | `analysis.json`, `flash-dmg.json` |
| Subagent proksi uji 1 detik (satu, tanpa konteks) | 4.1 |
| Pindai hex warna di `src/render`, skrip kredit `art/` dan `audio/` (sekali pakai) | 3, 4 |
| `QA_LONG=1 npm run test:e2e` (akhir) | Kode 1, 10,8 menit: 34 lulus, 3 dilewati (perf opt-in), 2 gagal: smoke Edge (kalah di Pulse 1 saat fast-forward diam, masalah tes, diperbaiki dengan HP penuh, ulang lulus) dan A-12 (tick naik di Temper, BUG-013; cek tick kini `expect.soft`, tes tetap merah). Smoke: judul interaktif Chrome 968 ms, Firefox 1842 ms, WebKit 1457 ms (PF-4 lolos, ambang 5 s); D-5 identik di Chrome dan Edge; nol error konsol di semua browser (`logs/test-e2e-m3.log`) |
| `npm run check` (akhir) | Kode 0: data B 0 error, 91 sprite 0 gagal (ikon B dari AD masuk), 66 file 607 tes, build, bundle JS awal 271,9 KB gzip (`logs/check-m3.log`) |

## 9. Temuan baru dan uji ulang

| Id | Judul | Tingkat | Pemilik usulan |
|---|---|---|---|
| BUG-006 | Frame arena pertama menahan loop sekitar 0,4 s setelah HUD Pulse tampil (smoke Edge flaky) | MINOR | LP |
| BUG-007 | Market Cur ancang-ancang lebur dengan lantai (grayscale 86 = 86, kontras 1,0:1) | MAYOR | AD (LP bila lewat shader) |
| BUG-008 | Banner boss atau Warden sisa run sebelumnya tampil di run baru | MINOR | UI |
| BUG-009 | Akhir run mengunci input 500 ms saat kembali dari The Keeping, fokus ke Try Again | MINOR | UI |
| BUG-010 | Urutan fokus panah Glazier tidak mengikuti tata letak (A-07) | MAYOR | UI |
| BUG-011 | Teks Largest bertumpuk dengan monogram ikon cadangan (A-05) | MAYOR, DITUTUP di M3 | AD (ikon B masuk) |
| BUG-012 | Affix `brood` tidak terjangkau di Tingkat B | MINOR | GD |
| BUG-013 | Tick sim terus bertambah saat diam di Temper dan Glazier (layar tidak berpindah) | MINOR | GP, LP |

Uji ulang: BUG-001 (MAYOR), BUG-002, BUG-003, BUG-004, BUG-005, BUG-011 (MAYOR) DITUTUP. MINOR 9 review M2 LP (smoke Edge flaky) dijelaskan oleh BUG-006.

## 10. Perubahan ambang atau baseline

- Tidak ada ambang yang dilonggarkan. Replay emas tidak diubah.
- `tests/e2e/support/smoke.ts`: menunggu sim benar-benar berjalan sebelum butir 3 (BUG-006); syarat gerak lebih dari 0 tetap.
- `tests/e2e/support/qa.ts`: folder bukti mentah default kini `tests/out/qa` (env `QA_EVIDENCE` untuk menimpa), supaya menjalankan suite tidak menulis ulang bukti M1 yang sudah di-commit. Bukti laporan disalin manual ke `docs/qa/evidence/<milestone>/`.
- `m3-perf.spec.ts` dan A-12 bersifat opt-in (`QA_PERF=1`, `QA_LONG=1`) karena headed atau lama.

## 11. Daftar file dibuat atau diubah QA

- Dokumen: `docs/qa/M3-report.md` (baru), `docs/qa/bugs.md` (BUG-006 sampai BUG-012, uji ulang BUG-001 sampai BUG-005), `docs/qa/evidence/M3/` (bukti ringkas).
- Tes unit: `tests/unit/qa/content-b.test.ts` (baru: B-7, B-6, cakupan konten, affix, unlock, item 5 s, sinergi, D-1, D-2, D-4 `run_b`), `tests/unit/qa/support/qa-bot.ts` (opsi aditif `unlocked`, `difficulty`, `observe`).
- Tes e2e: `tests/e2e/m3-visual.spec.ts`, `m3-play.spec.ts`, `m3-a11y.spec.ts`, `m3-perf.spec.ts` (baru), `support/m3.ts`, `support/kb.ts` (dipindah dari `keyboard-play.spec.ts`), `support/m3_analyze.py`, `support/m3_flash.py` (baru), `support/qa.ts`, `support/smoke.ts`, `keyboard-play.spec.ts` (impor `kb.ts`, tanpa perubahan perilaku).
- Kode produksi: tidak diubah.

## 12. Ringkasan lolos dan gagal

Tingkat B bisa dimainkan penuh: 3 kelas menang `run_b`, semua Unlit, Warden, pola boss, senjata, Memento, sinergi, dan unlock bekerja tanpa error; determinisme `run_b` utuh lintas proses dan save/load; performa sekitar 130 fps dengan p99 8,5 ms di GPU terintegrasi plus CPU 2x pada 120 Unlit di semua kualitas; DoF hanya di pita, pixel tajam, kontras proyektil musuh 7:1 juga di simulasi buta warna; uji 1 detik proksi 4 dari 5; remap, jeda, kurangi efek, angka damage, preferensi sistem lolos. Gagal formal karena satu pelanggaran pilar keterbacaan (Market Cur ancang-ancang), satu butir aksesibilitas wajib (urutan fokus Glazier), dan butir yang belum bisa diuji (DV-6, CW-3, kurva B, waktu toko manusia). Nol BLOCKER.

## 13. Pertanyaan terbuka

1. Producer: kecualikan atau jadwalkan DV-6 (aturan lint string UI, LP), CW-3 (hook isolasi lapis pemain dan bahaya, LP), A-08 dan A-09 (M4)?
2. GD: target tertulis kurva Tingkat B (win rate per kelas dan bot, Pulse kematian) agar M3-03 bisa diputus; dan keputusan `brood` (BUG-012).
3. CD: apakah 5 Memento berbasis peluang yang tidak terlihat dalam 5 s (S-11) diterima; apakah tint merah ancang-ancang dihitung bahasa telegraf (BUG-007) atau harus mengikuti aturan badan Unlit.
4. CD: garis tepi telegraf di atas isian sprite pemain (G4, keyakinan proksi 2/5) diterima sesuai K3, atau perlu siluet lebih tebal?
5. LP: izinkan cara resmi membaca `document.hidden` di headed Chromium (flag `--disable-backgrounding-occluded-windows` dimatikan di tes) agar A-06 langkah 3 tidak perlu simulasi?
