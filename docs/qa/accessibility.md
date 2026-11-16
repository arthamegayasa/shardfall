# Shardfall: Checklist Aksesibilitas

Pemilik: QA Lead. Reviewer: Producer. Status: versi 1.1 (2026-11-17): hook dan lokasi tes diselaraskan dengan architecture v2.2; hasil audit M1 di `docs/qa/M1-report.md`.
Implementasi: UI Programmer (pengaturan, menu, fokus), Art Director (palet mode buta warna, efek), Gameplay Programmer (jeda, efek di sim), Audio Director (volume). QA menguji.
Dokumen terkait: `docs/qa/test-plan.md` (hook tes, format bukti), `docs/style-guide.md` (1.3, 1.7, 1.8, 2.3), `docs/pillars.md` (Pilar 2).

Penanda: **[Wajib]** harus lolos untuk keluar M4. **[Saran]** dikerjakan bila waktu cukup, gagal dicatat sebagai MINOR. **[Asumsi]** keputusan sementara QA, bisa diubah pemilik wilayah.

Semua uji di bawah memakai build tes dengan hook `window.__shardfall` dari `npm run build:e2e` (lihat `test-plan.md` 7.2 dan architecture 6.12). Bukti disimpan di `docs/qa/evidence/<milestone>/a11y/`.

---

## Ringkasan checklist

| ID | Butir | Tingkat | Mulai diuji |
|---|---|---|---|
| A-01 | Remap kontrol | [Wajib] | M2 |
| A-02 | Kurangi efek, termasuk keamanan kilat | [Wajib] | M2 |
| A-03 | Matikan angka damage | [Wajib] | M2 |
| A-04 | Mode buta warna dan informasi tidak hanya lewat warna | [Wajib] | M2 (audit warna), M4 (mode) |
| A-05 | Ukuran teks | [Wajib] | M2 |
| A-06 | Jeda kapan saja | [Wajib] | M1 |
| A-07 | Navigasi keyboard penuh | [Wajib] | M1 (alur run), M2 (semua layar) |
| A-08 | Kontras teks dan UI | [Wajib] | M2 |
| A-09 | Isyarat suara punya padanan visual, volume terpisah | [Wajib] | M2 |
| A-10 | Pengaturan tersimpan dan bisa dibuka dari jeda | [Wajib] | M2 |
| A-11 | Hormati preferensi sistem saat pertama dibuka | [Saran] | M4 |
| A-12 | Tekanan waktu di luar Pulse | [Saran] | M2 |

---

## A-01 Remap kontrol [Wajib]

**Syarat**
- Setiap aksi bisa dipetakan ulang: gerak atas, bawah, kiri, kanan, Rite, jeda, konfirmasi, batal, reroll, mulai Pulse, dan navigasi menu.
- Default menyediakan dua set gerak: WASD dan tombol panah. Mouse tidak pernah wajib.
- Konflik (satu tombol untuk dua aksi dalam konteks yang sama) ditolak atau ditukar dengan pemberitahuan yang jelas.
- Ada tombol "kembalikan default". Pemetaan tersimpan setelah muat ulang.
- [Asumsi] Pemetaan memakai `KeyboardEvent.code` (posisi fisik), dan label tombol di layar memakai nama tombol sesuai tata letak keyboard pemain, agar pemain AZERTY dan QWERTZ tetap nyaman.

**Cara uji (Playwright, `tests/e2e/a11y-remap.spec.ts`)**
1. Buka pengaturan kontrol, ubah Rite ke `KeyK`.
2. Mulai Pulse, tekan `K`: snapshot menunjukkan Rite aktif. Tekan tombol Rite lama: tidak ada efek.
3. Muat ulang halaman, mulai run: `K` masih memicu Rite.
4. Coba petakan `KeyK` ke gerak kiri: muncul peringatan konflik atau penukaran, dan tidak ada aksi yang kehilangan tombol tanpa pemberitahuan.
5. Tekan "kembalikan default": tombol Rite default bekerja lagi.
6. Ulangi langkah 2 dengan event yang `code` dan `key`-nya berbeda (simulasi AZERTY: `code: 'KeyQ'`, `key: 'a'`): aksi mengikuti `code`.

**Lolos bila:** semua langkah sesuai, nol error konsol. Screenshot layar remap disimpan.

## A-02 Kurangi efek dan keamanan kilat [Wajib]

**Syarat**
- Opsi "Reduce Effects" mematikan getar layar, mematikan kilat layar penuh, mengurangi partikel (jumlah partikel suasana dan ledakan paling banyak 30% dari normal [Asumsi]), dan mematikan efek perlambatan saat pemain mati.
- Opsi ini tidak mengubah sim: hash state dengan opsi ON dan OFF identik.
- Opsi ini tidak menghilangkan informasi: telegraf bahaya, kilat kena hit pada sprite, dan tanda tepi layar saat pemain kena hit tetap ada, hanya lebih lembut.
- Keamanan kilat di semua mode, termasuk mode normal: tidak ada kilat umum atau kilat merah lebih dari 3 kali dalam 1 detik (mengikuti WCAG 2.3.1).

**Cara uji**
1. Lewat hook, aktifkan opsi lalu jalankan `spawnStress('peak')` selama 10 detik. `getPerf()` atau snapshot render melaporkan amplitudo getar kamera = 0 di setiap frame dan jumlah partikel aktif paling banyak 30% dari run yang sama dengan opsi OFF (seed sama).
2. Jalankan replay emas dua kali, opsi ON dan OFF: `getStateHash()` di akhir identik.
3. Screenshot `reduce-effects` di tick yang sama dengan `pulse-peak`: telegraf masih terlihat (cek piksel tepi telegraf `danger-red`).
4. Uji kilat: rekam rata-rata luminans relatif seluruh layar dan rata-rata komponen merah tiap frame selama 10 detik di skenario terberat (Rite, ledakan, boss, pemain kena hit berulang), opsi OFF dan ON. Satu kilat = pasangan naik lalu turun (atau sebaliknya) dengan selisih luminans relatif minimal 10% yang mencakup lebih dari 25% layar. Data diambil lewat pembacaan canvas tiap frame di hook [Usul ke LP] atau dari video Playwright.

**Lolos bila:** langkah 1 sampai 3 sesuai, dan di langkah 4 tidak ada jendela 1 detik dengan lebih dari 3 kilat, di kedua mode.

## A-03 Matikan angka damage [Wajib]

**Syarat**
- Opsi "Damage Numbers" ON atau OFF. Saat OFF, tidak ada angka damage yang digambar.
- Saat ON, angka damage tidak pernah menutupi sprite pemain (Pilar 2, kriteria tolak).

**Cara uji**
1. Opsi OFF, jalankan 10 detik Pulse dengan banyak musuh: snapshot render melaporkan 0 objek angka damage di setiap frame; screenshot tidak menampilkan angka.
2. Opsi ON, kondisi sama: ambil 20 screenshot berurutan. Dengan koordinat hook, cek kotak batas sprite pemain: tidak ada piksel angka damage (`bone` atau `kept-gold` dari teks angka) di dalam kotak itu.
3. Muat ulang: nilai opsi tetap.

**Lolos bila:** ketiga langkah sesuai.

## A-04 Mode buta warna dan informasi tidak hanya lewat warna [Wajib]

**Syarat**
- Kode pemain vs bahaya bisa dibedakan tanpa hue: bahaya punya inti pucat dan outline `ink`; pemain punya cincin kaki dan proyektil tanpa outline (style guide 1.3).
- Tidak ada informasi yang disampaikan hanya lewat warna di UI: rarity punya nama tingkat atau pola bingkai yang berbeda, HP rendah punya tanda selain merah (denyut atau ikon), harga yang tidak terjangkau tampil redup dengan tanda tambahan, tag punya ikon bentuk berbeda.
- Mode buta warna [Asumsi: pilihan Off, Protanopia, Deuteranopia, Tritanopia] menggeser palet bahaya dan pemain agar tetap jauh berbeda untuk jenis itu. Palet tiap mode milik AD, tetap mematuhi aturan kubu (tanpa warna pemain di bahaya).

**Cara uji**
1. Ambil screenshot `pulse-peak`, `glazier`, dan `level-up` di mode Off dan di tiap mode buta warna.
2. Terapkan simulasi buta warna (matriks Machado 2009, keparahan 1,0, untuk protanopia, deuteranopia, tritanopia) ke tiap screenshot lewat canvas di tes Playwright.
3. Pada tiap gambar hasil simulasi, ukur:
   - Kontras inti proyektil musuh vs lantai (rumus WCAG) minimal 4,5:1.
   - Selisih warna (CIEDE2000) antara proyektil pemain dan proyektil musuh minimal 20 [Asumsi], diukur dari sampel 3x3 di pusat objek.
   - Selisih warna antar bingkai rarity yang bersebelahan (Plain dan Fine, Fine dan Rare, Rare dan Fabled) minimal 10 [Asumsi], atau bila kurang, ada pembeda non-warna yang terlihat di screenshot.
4. Audit manual daftar elemen UI berwarna: untuk tiap elemen catat pembeda non-warnanya. Elemen tanpa pembeda non-warna = gagal.
5. Uji 1 detik versi proksi (test-plan bagian 10) pada 5 screenshot hasil simulasi deuteranopia di mode Off.

**Lolos bila:** langkah 3 lolos untuk semua mode pada mode yang sesuai (mode Deuteranopia diuji dengan simulasi deuteranopia, dan seterusnya), mode Off lolos kontras inti bahaya di ketiga simulasi, langkah 4 tanpa elemen gagal, langkah 5 minimal 4 dari 5.

## A-05 Ukuran teks [Wajib]

**Syarat**
- Opsi ukuran teks dengan minimal 3 tingkat skala integer (misalnya 1x, 1,5x dibulatkan ke skala integer terdekat, 2x dari skala dasar). Font tetap di skala integer (style guide 2.3).
- Di skala default, tinggi huruf besar minimal 14 piksel layar di semua resolusi yang didukung.
- Di skala terbesar pada 1280x720, tidak ada teks terpotong, bertumpuk, atau keluar panel di HUD, toko, level-up, pengaturan, dan akhir run. Toko tidak boleh memaksa scroll untuk pilihan utama (Pilar 4).

**Cara uji**
1. Untuk tiap tingkat skala dan tiap resolusi (1920x1080, 1366x768, 1280x720), ambil screenshot `glazier`, `level-up`, `settings`, `pulse-start`, `run-lost`.
2. Bila UI berbasis DOM: cek otomatis tiap elemen teks `scrollWidth <= clientWidth` dan `scrollHeight <= clientHeight`, dan kotak batas teks tidak saling tumpang tindih. Bila UI digambar di canvas: hook mengembalikan kotak batas tiap teks dan panelnya, dengan cek yang sama.
3. Ukur tinggi huruf besar "H" di screenshot skala default 1280x720.
4. Pilih kartu toko dengan efek terpanjang di data: teks utuh terbaca di skala terbesar.

**Lolos bila:** nol pelanggaran di langkah 2, tinggi huruf besar minimal 14 piksel di langkah 3, langkah 4 utuh. Screenshot skala terbesar disimpan sebagai `text-scale-max-*.png`.

## A-06 Jeda kapan saja [Wajib]

**Syarat**
- Tombol jeda (default `Esc` dan `P`) bekerja di Pulse, di layar level-up, di toko, dan saat Warden atau boss muncul.
- Saat jeda: tick sim berhenti, timer Pulse dan timer toko (bila ada) berhenti, input gameplay diabaikan, audio dipelankan atau dijeda.
- Game terjeda otomatis saat tab tersembunyi atau jendela kehilangan fokus.
- Melanjutkan tidak membuat pemain langsung kena damage dari input yang tertahan; [Saran] hitung mundur singkat sebelum lanjut, dan tidak berlaku di Reduce Effects bila mengganggu.

**Cara uji (Playwright; M1: `tests/e2e/keyboard-play.spec.ts` fungsi `checkPause` untuk Pulse, Temper, dan the Glazier; langkah 3 dan konteks Warden mulai M2 di `tests/e2e/a11y-pause.spec.ts`)**
1. Di tiap konteks (Pulse, level-up, toko, kemunculan Warden lewat replay): tekan `Esc`, catat `tick` dan sisa timer dari snapshot, tunggu 2 detik waktu nyata, catat lagi.
2. Saat jeda, tahan tombol gerak 1 detik: posisi pemain tidak berubah.
3. Saat Pulse, buka tab kedua (`context.newPage()` lalu `bringToFront()`) agar tab game tersembunyi: snapshot tab game menunjukkan jeda dan tick tidak bertambah. Bila browser headless tidak mengubah `visibilityState`, uji di mode headed.
4. Lanjutkan: tick bertambah lagi, HP pemain di 10 tick pertama setelah lanjut sama dengan sebelum jeda bila tidak ada musuh yang menyentuh pemain di posisi itu.

**Lolos bila:** tick dan timer tidak berubah selama jeda di semua konteks, langkah 2 sampai 4 sesuai.

## A-07 Navigasi keyboard penuh [Wajib]

**Syarat**
- Semua layar dan semua kontrol bisa dipakai hanya dengan keyboard: judul, pilih kelas, Pulse, level-up, toko (beli, reroll, merge, mulai Pulse), jeda, pengaturan (setiap kontrol termasuk slider dan remap), akhir run, meta.
- Fokus selalu terlihat (bingkai `kept-gold`, style guide 2.1), urutannya logis (kiri ke kanan, atas ke bawah), dan tidak ada jebakan fokus.
- `Esc` atau tombol batal selalu kembali satu langkah atau menutup layar saat ini.

**Cara uji (Playwright; M1 alur run: `tests/e2e/keyboard-play.spec.ts` dengan pencatat pointer `installPointerBlocker`; semua layar dan semua kontrol mulai M2 di `tests/e2e/a11y-keyboard.spec.ts`)**
1. Pasang pemblokir: tes gagal bila ada event `mousedown`, `click` dari pointer, atau `pointermove` yang dikirim tes. Seluruh tes hanya memakai `page.keyboard`.
2. Alur: boot, pilih kelas, Pulse 1 (bot keyboard sederhana), level-up pilih kartu, toko beli satu item, reroll, mulai Pulse 2, jeda, buka pengaturan, ubah setiap kontrol satu kali, tutup, lanjut, kalah lewat hook, layar akhir run, ulang.
3. Di tiap layar, tekan `Tab` (atau tombol navigasi yang dipetakan) berulang sampai kembali ke elemen awal: catat urutan fokus dan screenshot tiap fokus. Hitung jumlah elemen interaktif yang terlihat vs yang bisa difokus.
4. Di tiap layar, cek kontras indikator fokus terhadap latar di sebelahnya (lihat A-08).

**Lolos bila:** alur langkah 2 selesai tanpa mouse, setiap elemen interaktif yang terlihat bisa difokus, urutan fokus sesuai urutan visual, fokus selalu terlihat, tidak ada layar yang tidak bisa ditinggalkan dengan keyboard.

## A-08 Kontras teks dan UI [Wajib]

**Syarat**
- Teks isi (`bone` dan `dust` di atas panel) minimal 4,5:1 terhadap latar panel yang sebenarnya (setelah opasitas panel dan latar game di belakangnya).
- Teks besar (judul, tinggi huruf besar minimal 24 piksel layar) minimal 3:1.
- Indikator fokus dan bingkai kontrol aktif minimal 3:1 terhadap warna di sebelahnya.
- Elemen yang sengaja tidak aktif (teks `dust` opasitas 50%) dikecualikan dari 4,5:1 seperti aturan WCAG, tapi harus tetap terbaca: minimal 2:1 [Asumsi].
- Kontras gameplay mengikuti Pilar 2 P2-c (diuji di `test-plan.md` 8.2).

**Cara uji**
1. Ambil screenshot `glazier`, `level-up`, `settings`, `pulse-peak` (HUD), `run-lost`. Untuk HUD, ambil di titik arena paling terang dan paling gelap di belakang HUD.
2. Hook mengembalikan kotak batas teks. Untuk tiap teks: warna teks = rata-rata piksel paling terang (atau paling gelap) di dalam glyph, latar = rata-rata piksel di sekitar kotak teks. Hitung rasio WCAG.
3. Sama untuk bingkai fokus vs piksel panel di sebelahnya.

**Lolos bila:** semua teks dan indikator memenuhi ambang di atas, nilai terendah per layar dilaporkan.

## A-09 Isyarat suara punya padanan visual, volume terpisah [Wajib]

**Syarat**
- Setiap isyarat suara yang membawa informasi (pemain kena hit, telegraf bahaya, level up, dapat Memento, Pulse hampir habis, boss datang) punya padanan visual yang bisa dikenali tanpa suara (Pilar 2 P2-g).
- Volume Master, Musik, dan SFX terpisah, masing-masing bisa 0.

**Cara uji**
1. Matikan Master (0). Lewat replay, picu tiap peristiwa di atas. Screenshot sebelum dan sesudah peristiwa: ada perubahan visual khas untuk tiap peristiwa (dicatat di tabel peristiwa, tanda visual, bukti).
2. Set Musik 0, SFX 100: hook audio melaporkan gain bus musik 0 dan bus SFX tidak 0. Ulangi kebalikannya.

**Lolos bila:** semua peristiwa punya tanda visual, ketiga slider bekerja dan tersimpan.

## A-10 Pengaturan tersimpan dan bisa dibuka dari jeda [Wajib]

**Syarat:** semua opsi aksesibilitas tersedia dari layar judul dan dari menu jeda di tengah run, berlaku langsung tanpa memulai ulang run, dan tersimpan setelah muat ulang.

**Cara uji:** di tengah Pulse, jeda, buka pengaturan, ubah setiap opsi aksesibilitas, lanjutkan. Snapshot menunjukkan efek berlaku pada frame berikutnya dan hash sim tidak berubah karena perubahan opsi tampilan. Muat ulang halaman, cek semua nilai.

**Lolos bila:** semua opsi bisa diubah dari jeda, berlaku langsung, dan tersimpan.

## A-11 Hormati preferensi sistem saat pertama dibuka [Saran]

**Syarat:** saat pertama kali dibuka (belum ada pengaturan tersimpan), `prefers-reduced-motion: reduce` membuat Reduce Effects aktif secara default.

**Cara uji:** konteks Playwright baru dengan `reducedMotion: 'reduce'` dan penyimpanan kosong; buka pengaturan.

**Lolos bila:** Reduce Effects tampil aktif. Konteks dengan `reducedMotion: 'no-preference'` menampilkan nonaktif.

## A-12 Tekanan waktu di luar Pulse [Saran]

**Syarat:** layar level-up, pengaturan, dan jeda tidak punya batas waktu. [Asumsi] Bila GD memberi timer pada fase toko, sediakan opsi aksesibilitas untuk mematikan atau memperpanjang timer toko. Keputusan desain milik GD; QA hanya menguji bila ada.

**Cara uji:** diam di layar level-up, pengaturan, dan jeda selama 60 detik waktu nyata; snapshot menunjukkan layar dan tick tidak berubah. Bila ada timer toko dan opsinya, aktifkan opsi lalu diam 60 detik di toko.

**Lolos bila:** tidak ada layar yang berpindah sendiri, dan opsi timer toko (bila ada) bekerja.

---

## Format hasil audit

Laporan audit aksesibilitas masuk ke laporan milestone (`docs/qa/<milestone>-report.md`) dengan tabel:

`ID | Butir | Putusan (LOLOS, GAGAL, TIDAK DIUJI) | Nilai terukur (misalnya kontras terendah) | Bukti (path) | Bug terkait`

Setiap butir [Wajib] yang GAGAL dicatat di `docs/qa/bugs.md` dengan tingkat MAYOR. Butir [Saran] yang GAGAL dicatat sebagai MINOR.
