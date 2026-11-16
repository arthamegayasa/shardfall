# Review CD M3: Putusan Rasa HD-2D (keluar M2) dan Konten Tingkat B

Reviewer: Creative Director (CD). Tanggal: 2026-11-17. Tugas: M3-CD (menutup M2-09 bagian CD).
Dasar: `docs/pillars.md` 1.1, `docs/style-guide.md` (naik ke 1.3 akibat review ini), `docs/m2-creative-brief.md` bagian 4, `docs/reviews/M1-cd.md`, `docs/reviews/M2-lp.md`, build default Tingkat B (`content/build.json` = B, profil `run_b`, contentHash data `2008c1b6`).
Cakupan: rasa, keterbacaan, nama, judul. Angka balance milik GD, arsitektur milik LP, scope milik Producer.

## 0. Putusan

| Bagian | Putusan | Ringkas |
|---|---|---|
| Rasa HD-2D (brief M2, Pilar 3) | **SETUJU** | Diorama di bawah kaca tercapai: pasar festival berlentera, kabut tepi, DoF hanya di pita tepi, pixel tajam satu skala, Rendah tetap terbaca. Slice terasa sama atau lebih hidup dari konsep 03 |
| Brief M2 keseluruhan (S-1 sampai S-17) | **SETUJU DENGAN CATATAN** | Dua [W] lolos sebagian: S-2 grayscale (kilat kena hit Unlit membuat massa Unlit lebih terang dari pemain) dan S-14 (isian zona Rite terukur 37 sampai 58%, batas 25%). Keduanya perbaikan kecil di render, masuk M4 butir 1 dan 3. **M2 boleh keluar**; CD tidak menahan milestone untuk dua butir ini |
| Konten Tingkat B (M3) | **SETUJU DENGAN CATATAN** | Sistem lolos Pilar 1 (3 kelas benar-benar beda cara main, rasio item stat datar 20%). Presentasi kelas B belum final: Rite Chorister dan Vintner memakai animasi lempar lentera milik Festival Flare (efek palsu di titik bidik), sprite kelas B tanpa pose cast dan kena hit, Unlit dan Warden B satu bingkai |
| Keterbacaan arena paling ramai (Pilar 2) | **Lolos dengan catatan** | Pemain selalu ketemu berkat cincin cyan dan siluet K3. Pengganggu terbesar: kilat `bone` penuh pada kelompok Unlit, isian zona bertumpuk, Glint tercecer di akhir Pulse |
| Nama Writer Tingkat B dan C | **Disetujui, 2 diganti** | Cracker menjadi **Squib**, affix Pulsing menjadi **Quaking**. Sisanya status Kerja |
| Judul rilis | **Shardfall** (bersyarat) | Cek web dan merek dagang sebelum rilis publik di luar GitHub Pages. Cadangan Under the Pane |

| Pilar | Status | Ringkas |
|---|---|---|
| P2 Kacau tapi terbaca | Lolos dengan catatan | Proyektil musuh 6,3:1 terhadap lantai, cincin pemain 4,9:1. Kilat Unlit dan zona bertumpuk harus diturunkan |
| P4 Keputusan cepat | Lolos dengan catatan | Toko satu layar, kartu terbaca di 720p. 10 Memento B masih monogram ("IT", "DH", "GW") di build yang ditonton |
| P1 Build baru | Lolos dengan catatan | Kelas, senjata, Warden B mengubah cara main. Rite kelas B belum terlihat berbeda; P1-c (data bot GD) belum ada |
| P3 Diorama | Lolos | Lihat bagian 2 |

## 1. Cara menonton

- Build e2e ke scratchpad (`npx vite build --mode e2e --outDir <scratchpad>/dist-cd`), `vite preview` di port 4791 dari folder itu, dimatikan setelah selesai (proses node juga dihentikan). `dist-e2e` milik QA dan `content/generated` tidak disentuh.
- Skrip Playwright sendiri (di scratchpad, bukan di repo) memakai hook `window.__shardfall`: loop dijeda, sim dilangkahkan 15 tick per langkah dengan input gerak angka delapan, Rite tiap 4 s, HP dipulihkan bila di bawah 60%. Toko diisi Glint debug 50 sampai 200 per kunjungan dan membeli tawaran 1 sampai 4, jadi build lebih kuat dari pemain wajar.
- Direkam: run Lamplighter penuh `run_b` seed 7 (Pulse 1 awal, Temper, toko, Warden P4 Brass Collar, Pulse 9 penuh, Warden P10 Velvet Cowl, Pulse 14 penuh, boss P15 Paper Sun sampai mati, Light Kept), Kept Lost, pilih kelas, The Keeping dengan 0 dan 120 Silt, Chorister dan Vintner (Pulse 1, 5 bingkai Rite, `spawnStress('peak')`). Semua di 1280x720 dan 1920x1080 kualitas Tinggi: 176 screenshot. Tambahan `spawnStress('peak')`, `peak-boss`, dan toko di Tinggi, Sedang, Rendah, dan Tinggi plus kurangi efek di kedua ukuran: 32 screenshot.
- Dilihat juga: `tests/out/render/` (DoF on dan off, peak per kualitas), `tests/out/lp/`, `docs/ui/screens/m2/`, `art/atlas/preview/*.png`.
- Pengukuran: median warna dan rasio kontras WCAG dengan Python pada screenshot; diff piksel DoF on dan off.
- Jumlah Unlit hidup terukur: Pulse 9 puncak 39 (detik 34), Pulse 14 puncak 37, Warden P10 dengan 14 Unlit dan 11 proyektil musuh. Target brief sekitar 40 di Pulse 8 sampai 9: tercapai.
- Bukti tersimpan: `docs/reviews/evidence/M3-cd/` (8 gambar). Sisa screenshot hanya di scratchpad.
- Batas jujur: audio tidak didengar, rasa input tidak dirasakan tangan manusia, uji 1 detik dan uji miniatur memakai CD sebagai proksi. Snapshot tiap 15 tick sejajar dengan tick zona 30 tick, jadi frekuensi kilat di screenshot lebih tinggi dari rata-rata; masalahnya tetap nyata (bagian 3.3).

## 2. Putusan rasa HD-2D terhadap brief M2 bagian 4

| ID | Uji | Hasil | Bukti |
|---|---|---|---|
| S-1 [W] | Screenshot 1 detik | **Lolos (proksi CD), 4 dari 5 cepat, 1 lambat.** Pemain dan ancaman terdekat ketemu di P9 detik 34, Warden P10, boss fase 2, stres 1080p. P14 detik 37,5 butuh lebih dari 1 detik: Unlit yang berkedip `bone` menempel di pemain | `p09-busy-1280-high.png`, `p14-busy-1920-high.png` |
| S-2 [W] | Grayscale | **Lolos sebagian.** Lantai sedang, Unlit gelap, proyektil musuh terlihat. Saat kilat kena hit, kelompok Unlit `bone` menjadi benda paling terang di bingkai, lebih terang dari pemain | `p14-busy-gray-crop.png` |
| S-3 [W] | Kontras | **Lolos.** Inti proyektil musuh 6,3:1, cincin cyan pemain 4,9:1, badan Unlit median 2,2:1 (Porter, Lampmoth, Market Cur). P10 per aktor belum diukur rapi oleh CD; AD dan QA melengkapi | Pengukuran pada `p09-busy-1280-high.png` |
| S-4 [W] | Telegraf | **Lolos (pengamatan).** Lajur terjang Market Cur, cincin sumbu Squib (Cracker), cincin tujuan Blinking Velvet Cowl, cincin Snuff ganda Paper Sun, tanda spawn ungu. Lajur di atas pemain tidak menyembunyikannya (siluet K3 bekerja). Durasi formal milik GP dan QA | `p09-flash-crop.png`, `p15-paper-sun-phase2-1280.png` |
| S-5 [W] | Apa yang baru terjadi | **Lolos visual.** Level up cincin emas, Memento cincin cyan plus putih, kena hit tint putih 0,6. Suara tidak didengar | Kode `effects.ts`, screenshot |
| S-6 [W] | DoF di bingkai saja | **Lolos.** Diff `hd2d-dof-on` dan `-off` hanya di baris 0 sampai 161 dan 975 sampai 1079 (54 dan 36 px virtual x3). Area main nol beda | `tests/out/render/` |
| S-7 [W] | Checklist diorama | **Lolos dengan satu sisa.** Kunci dan isi, kabut dan vignette tepi, lentera sebagai titik cahaya, bayangan elips aktor, kios, bendera, Gerbang Lentera. Kilau kaca sudut tidak terlihat jelas di screenshot diam CD; AD menyerahkan satu crop bukti (M4 butir 11) | Screenshot run |
| S-8 [W] | Miniatur | **Lolos (proksi).** Kesan pertama: mainan pasar malam di dalam lemari kaca. Konfirmasi manusia tetap sisa | |
| S-9 [W] | Kualitas Rendah | **Lolos.** Tinggi, Sedang, Rendah, dan kurangi efek memakai kode warna dan susunan yang sama; Rendah hanya kehilangan lembutnya | `quality-high-med-low-reduce-1920.png` |
| S-10 [W] | Pixel tajam, satu skala | **Lolos.** Zoom 300% nearest: blok seragam, aktor, Glint, dan tekstur sama skala | `p09-flash-crop.png` |
| S-11 [W] | Kartu 3 detik, dampak 5 detik | **Lolos dengan catatan.** Kartu terbaca. Monogram Memento B memperlambat pengenalan | Toko P4 |
| S-12 [W] | Toko singkat | **Belum diukur** (butuh tangan manusia). QA | |
| S-13 [W] | Sinergi terlihat | **Sebagian.** Ambang terlihat di panel Tag; Burn biru dan proc terlihat di arena. Echo, Ward, Trade belum dicek CD | |
| S-14 [W] | Rasa M1 | **Lolos sebagian.** Proyektil pemain terbaca, Rite Lamplighter efek terbesar, Unlit berkedip dan pecah, Glint melesat, kritikal cyan. **Gagal: isian zona Rite 37% sendirian, 58% saat bertumpuk** (batas 25%; tambalan sisa 25%) | Pengukuran pada P4 dan stres |
| S-15 [W] | Musik dan suara | **Tidak dinilai CD** (tanpa pendengar). Data AU dan LP lolos | |
| S-16 [S] | Ragam build manusia | **Belum.** Butuh 3 run manusia | |
| S-17 [W] | Aset tercatat | Tidak diaudit ulang CD; LP melaporkan lolos | |

Kesimpulan rasa: HD-2D Shardfall sudah punya identitas. Kontras hangat lentera di tepi dan pusat netral bekerja persis seperti brief; kios bergaris dan pita lampu di atas arena memberi rasa pasar tanpa menyentuh area main. Yang belum: momen "kacau" kini terbaca, tapi kilat putih pada kelompok Unlit dan zona emas yang menumpuk membuat titik paling terang di layar kadang bukan pemain.

## 3. Review konten Tingkat B

### 3.1 Pilar 1: setiap run build baru

| Bagian | Temuan | Status |
|---|---|---|
| Kelas | Lamplighter (Flame, jarak jauh, zona bakar), Chorister (Echo dan Ward, cincin dorong, Mark pada musuh terdorong, Rite Great Toll), Vintner (Edge, sabit jarak dekat, dash Glass Step dengan 3 kritikal pasti, heal saat bunuh dekat). Senjata awal, Rite, pasif, dan tag berbeda; kriteria tolak "beda stat saja" tidak kena | Lolos |
| Rite kelas B | `src/render/vfx/effects.ts:300` memperlakukan semua `RiteCast` sebagai lemparan lentera: jejak terbang dari pemain ke titik bidik, lalu ledakan pendaratan. Great Toll (cincin 4,5 u di sekitar pemain) dan Glass Step (dash 4,5 u) tampil sebagai lemparan kecil ke titik yang tidak terjadi apa-apa. Ini melanggar P4-d (dampak terlihat) dan P2 (yang terlihat harus sama dengan yang terjadi) | **Wajib M4** butir 2 |
| Senjata | 8 senjata, semua mengubah perilaku. Hand Bell (cincin dorong plus gema) dan Tithe Shard (ekonomi) menambah dua cara main baru | Lolos |
| Memento | 22 Memento A plus B. Stat datar menurut kolom `is_flat`: Glass Marble, Pocket of Sky, Whetstone, Iron Thimble, Magpie Tin, Haggler's Seal. Pool toko B = 8 senjata plus 22 Memento = 30; item datar 6 = **20%**, di bawah batas P1-a 30% | Lolos |
| Tag | Jumlah item per tag di pool A plus B: Flame 7, Shard 8, Edge 9, Echo 6, Ward 6, Trade 6 (3 Trade di balik unlock). Ambang 6 untuk Echo, Ward, Trade hanya tercapai dengan duplikat senjata. Risiko tag B menjadi pilihan kelas dua | GD memantau di P1-c |
| P1-c | Data dominasi tag bot 50 run belum diserahkan GD (`M2-lp.md` bagian 5 hanya menang dan kematian) | Wajib GD sebelum keluar M3 |
| Unlit B | Squib (Cracker) meledak setelah sumbu bercincin merah, Crier memanggil Midge dari jauh. Keduanya memaksa gerak berbeda dari Unlit A (bunuh dulu atau menjauh, kejar penyeru). Sprite `unlit-exploder`, `unlit-summoner`, dan `warden-choir` hanya 1 bingkai idle; Midge perlu dicek punya sprite sendiri | Sistem lolos, art belum final |
| Warden | Brass Collar (terjang beruntun, volley) dan Velvet Cowl (kipas tembakan, blink bertanda, cangkang) terasa berlawanan: satu menuntut menghindar lateral, satu menuntut menutup jarak. Dua Warden dalam satu run memberi dua ujian berbeda | Lolos |
| Boss | Paper Sun dipakai sebagai boss P15 `run_b`. Fase 2 terbaca, kematian besar ada. Satu boss untuk Tingkat B sesuai scope | Lolos |
| Identitas kelas di arena | Ketiga kelas tampil sebagai sosok biru; siluet berbeda (topi lebar, tudung, jubah lebar) tapi kecil di 720p. `kept-bell` dan `kept-blade` hanya idle 2 dan jalan 4, tanpa cast dan kena hit (kena hit memakai tint, jadi tetap aman) | M4 butir 4 |

### 3.2 Pilar 4: keputusan cepat

- Toko 720p: 4 tawaran, panel Tag dengan titik ambang, inventaris kanan, footer "Unlocks: ..." memberi alasan membeli. Lolos P4-e.
- Memento B tanpa ikon di build yang ditonton (monogram di toko, The Keeping, akhir run). File ikon AD sudah ada di `art/sprites/icon-memento-*.json` dengan waktu lebih baru dari atlas, jadi kemungkinan hanya atlas belum dibangun ulang. M4 butir 5.
- Teks: "Rites grant 1 Barrier and +25% Attack\nSpeed for 4s." memotong "Attack Speed" di dua baris; Torch Glove "Edge weapon hits always Burn." janggal. M4 butir 6.
- Pilih kelas dan The Keeping jelas: harga, status, "Unlock in The Keeping". Urutan Vintner 6 Silt sebelum Chorister 60 Silt sesuai asumsi LP; angka milik GD.
- Light Kept: baris "161 Silt" tanpa label (saldo). Daftar inventaris terpotong di bawah tanpa tanda scroll. M4 butir 10.

### 3.3 Pilar 2 di arena paling ramai (P9 detik 34, P14 detik 37,5, stres 1080p)

1. **Kilat kena hit Unlit**: `entity-layers.ts:483` mengganti seluruh sprite Unlit dengan `bone` (alpha 1) selama 2 tick, dan `areas.ts:349` memicunya pada setiap tick zona. Tick zona dan Burn serentak untuk semua Unlit di dalam zona, jadi gumpalan 5 sampai 10 Lampmoth berkedip putih bersamaan. Di grayscale gumpalan itu lebih terang dari pemain; di warna ia mirip kilat putih pemain. Velvet Cowl dan Brass Collar juga berubah menjadi patung putih penuh. Ini kebalikan tiga lapis nilai. Perbaikan di style guide 1.3: tint `bone` maksimal 50% (Warden dan boss 35%), tanpa kilat dari tick berkala.
2. **Zona pemain bertumpuk**: zona Rite segar 37% efektif, zona yang bertumpuk dengan ledakan Lantern Bolt 58%. Zona menjadi bentuk terbesar dan terterang di arena, dan gumpalan Unlit di atasnya kehilangan kontras.
3. **Angka damage** berkumpul tepat di samping kotak pemain ("213 22 55 10" di P14). Aturan "tidak di dalam kotak pemain" terpenuhi, tapi kerumunan angka adalah noise terbesar kedua di dekat pemain.
4. **Glint tercecer**: 354 Glint di P14 dan puluhan butir emas di lantai di akhir Pulse. Emas tetap satu arti, tetapi kepadatannya menambah noise di grayscale. Angka milik GD.
5. **Siluet K3 bekerja**: lajur terjang merah di atas pemain tidak menyembunyikannya. Pertahankan.
6. **Kemungkinan bug**: banner "Paper Sun, the Light-Eater" masih tampil di Pulse 1 run baru (Chorister dan Vintner) setelah run sebelumnya menang. Terjadi lewat hook `startRun` e2e; QA memastikan dengan alur nyata Light Kept lalu Try Again.

## 4. Nama yang menunggu dari Writer

Status naik dari Usulan menjadi **Kerja** (disetujui CD, cek web sebelum dikunci di M5). Cek di bawah adalah pengetahuan CD, bukan pencarian web.

| Nama | Id | Putusan | Catatan |
|---|---|---|---|
| Hand Bell | `echo_bell` | Disetujui | Benda nyata Chorister, lebih baik dari kata tag di nama |
| Prayer Chime | `rite_chime` | Disetujui | Nada biara ringan, cocok bioma 2 |
| Chapel Pane | `glass_aegis` | Disetujui | "pane" huruf kecil bergema dengan the Pane, flavor menjelaskannya sebagai jendela. Gema itu disengaja |
| Haggler's Seal | `haggler_seal` | Disetujui | Apostrof terbukti tampil di font (The Keeping) |
| Cracker | `exploder` | **Diganti: Squib** | "Cracker" juga hinaan rasial dalam slang Amerika. Squib adalah petasan kecil yang mendesis lalu meletup, dan "damp squib" berarti gagal meletup, pas dengan "Fell it first and it fizzles out." ID: Petasan (tetap). Squib juga istilah di Harry Potter, tetapi kata Inggris umum yang jauh lebih tua; risiko Rendah |
| Crier | `summoner` | Disetujui | |
| Midge | `mote` | Disetujui | Berpasangan dengan Lampmoth |
| Pitcher | `lobber` (C) | Disetujui | Makna ganda kendi dan pelempar |
| Velvet Cowl, the Hymn-Thief | `warden_choir` | Disetujui | Julukan hanya di banner |
| Iron Yoke, the Unbowed | `warden_bulwark` (C) | Disetujui | "Unbowed" kata umum, walau dikenal dari moto keluarga di Game of Thrones; satu kata, bukan nama. Cek web sebelum C dikunci |
| Vesper Bell, the Ever-Ringing | `boss_bell` (C) | Disetujui | "Vesper bell" istilah nyata |
| Rootmother, the Unpruned | `boss_vine` (C) | Disetujui | Kata gabungan, risiko Rendah sampai sedang; cek web sebelum C dikunci |
| Great Toll, Glass Step | Rite B | Disetujui | |
| Tuning Fork, Iron Thimble, Collector Pin, Dust Hourglass, Lucky Button, Magpie Tin, Grinding Wheel | Memento B | Disetujui | Nama kerja GD dipertahankan |
| Pyre Bell, Wick Charm, Cracked Mirror, Music Box, Folded Letter, Echo Shell, Patched Cloak, Ledger Page | Memento C | Disetujui | |
| Banner: "A Warden Wakes", "The Deepest Crack Opens", "Pulse {n} Steady", "Pulse {n} Held", "{name}, {epithet}" | `ui.banner.*` | Disetujui | Nada pas, kata "boss" tidak tampil |
| Affix: Hasted, Volley, Veiled, Blinking, Brood, Tar Trail, Bulwark | `affix.*.name` | Disetujui | |
| Affix: Pulsing | `pulsing` (C) | **Diganti: Quaking** | "Pulse" adalah istilah inti gelombang; Warden "Pulsing" membingungkan pembacaan cepat banner. ID: Bergetar. Efek tetap "Every 5s, sends out a shockwave after a red ring." |

WR memperbarui `content/strings/en.json` (`unlit.exploder` = "Squib", `affix.pulsing.name` = "Quaking"), `id.json` (`affix.pulsing.name` = "Bergetar"), glossary bagian 8 dan 9, dan string table. Identifier data tetap.

## 5. Pertanyaan kreatif terbuka

**Q1. Isian zona Rite 25% emas olive, turunkan ke 20%?** Ya, sebagai nilai nominal. Pengukuran CD di render: zona Rite segar 37% efektif, bertumpuk 58%, tambalan sisa 25%. Angka 25% di shader menjadi lebih tinggi setelah cahaya lentera, bloom, dan tumpukan. Keputusan (style guide 1.3): nominal 20%, zona pemain bertumpuk tampil seperti satu isian, dan batas tetap diukur di screenshot (maksimal 25% efektif termasuk kedip). Rona olive diterima: itu hasil jujur emas di atas lantai hangat, dan tepi `kept-cyan` solid sudah menandai kepemilikan.

**Q2. Pose cast 17 px.** [Asumsi] Pertanyaannya: bolehkah pose cast kelas (termasuk kelas B) bertinggi 17 px, di bawah tabel 18 sampai 22 px. Boleh untuk pose sesaat (maksimal 2 bingkai atau 0,3 s) seperti merunduk sebelum dash atau mengayun lonceng. Syarat: anchor kaki tidak berubah (cincin cyan tidak melompat), siluet kepala kelas tetap terbaca, dan minimal 15% piksel sorotan tetap ada. Idle dan jalan tetap 18 sampai 22 px. Pose yang menjulang ke atas (Lamplighter mengangkat lentera, 20 px) juga sah.

**Q3. Potret Glazier disembunyikan di ukuran teks besar.** Disetujui. Aksesibilitas dan keterbacaan menang atas identitas pedagang (urutan pilar P2 > P4 > P1 > P3). Judul "The Glazier" tetap ada, jadi rasa bertemu pedagang tidak hilang seluruhnya. Tidak perlu kerja tambahan.

## 6. Judul rilis

Kandidat dan cek orisinalitas: `docs/narrative/title-candidates.md` (Shardfall, Under the Pane, Vitrine, Lanterns Under Glass, Glasslight).

**Keputusan: Shardfall tetap menjadi judul rilis, bersyarat.**
- Alasan: satu kata yang menceritakan premis, sudah melekat di build, repo, dan layar judul; CD tidak mengetahui game komersial besar dengan nama persis sama. Risiko Sedang karena kata gabungan generik dan dekat dengan Shardlight dan Shardbound, bukan karena konflik yang diketahui.
- Syarat: Producer atau Dok mencari di web, Steam, itch.io, dan basis data merek dagang sebelum rilis publik di luar GitHub Pages. Bila ada game aktif atau merek terdaftar di kelas game dengan nama sama, pakai **Under the Pane**, lalu **Lanterns Under Glass**.
- Tanda tangan kreatif rilis tetap di M5.

## 7. Polish M4 paling berdampak (urut prioritas)

Masing-masing kecil dan bisa diverifikasi dengan satu screenshot atau satu tes.

| # | Pemilik | Perbaikan | Selesai bila |
|---|---|---|---|
| 1 | LP (render), AD | Kilat kena hit Unlit menjadi tint `bone` 0,5 (Warden dan boss 0,35) di `entity-layers.ts:483`; tick zona dan Burn (`areas.ts:349`, `HitKind.Dot` dan `Zone`) tidak memicu kilat | Grayscale P14 ramai: pemain tetap benda paling terang; tidak ada gumpalan putih penuh |
| 2 | AD, LP | Efek Rite per arketipe di `effects.ts:300`: Great Toll = cincin cyan tumbuh ke 4,5 u di sekitar pemain dalam 0,25 s plus cincin putih kedua; Glass Step = 3 bayangan kaca cyan sepanjang jalur dash. Lintasan dan pendaratan lentera hanya untuk `throw_zone` | 5 bingkai Rite Chorister dan Vintner menunjukkan bentuk sebenarnya; tidak ada ledakan di titik bidik |
| 3 | AD, LP | Isian zona pemain nominal 20%, zona bertumpuk digabung (tidak makin pekat), kedip api maksimal plus minus 3% | Zona Rite segar dan bertumpuk terukur 25% atau kurang di screenshot Tinggi |
| 4 | AD | `kept-bell` dan `kept-blade`: cast 2 bingkai dan kena hit 2 bingkai (pola Lamplighter). `unlit-exploder`, `unlit-summoner`, `warden-choir`: jalan 2 bingkai plus 1 bingkai ancang-ancang. Pastikan Midge punya sprite sendiri lebih kecil dari Lampmoth | Atlas preview menampilkan animasi; `check-sprites` lulus |
| 5 | AD, UI | Bangun ulang atlas ikon agar 10 Memento B tampil dengan ikon, bukan monogram | Toko, The Keeping, akhir run tanpa monogram |
| 6 | WR | Squib dan Quaking (bagian 4); "Rites grant 1 Barrier and\n+25% Attack Speed for 4s."; Torch Glove "Edge hits always Burn foes."; status Kerja di glossary bagian 9 | Cek string B dan C 0 error |
| 7 | QA | Pastikan banner boss lama tidak tampil di run baru (Light Kept lalu Try Again); jalankan P2-a dengan penguji proksi baru pada P14 detik 37,5 setelah butir 1 | Tidak ada banner basi; P2-a 4 dari 5 |
| 8 | GD | Glint tercecer di akhir Pulse panjang: naikkan magnet atau tarik semua Glint saat kilat penutup (angka milik GD) | Median Glint terpungut per Pulse 70% atau lebih pada bot `good` |
| 9 | LP | Batas angka damage dekat pemain: maksimal 4 angka dalam radius 2 u dari pemain, angka biasa terlama dibuang dulu | Screenshot P14: tidak ada tumpukan angka di samping pemain |
| 10 | UI | Akhir run: label saldo ("161 Silt held" atau setara dari WR) dan tanda scroll pada daftar inventaris yang terpotong | Screenshot Light Kept 720p |
| 11 | AD | Bukti kilau kaca sudut di Tinggi: satu crop 1080p sudut kiri atas dan kanan bawah; bila tidak terlihat, naikkan ke 10 sampai 12% sesuai brief | Crop di `tests/out/render/` |
| 12 | AU | Suara Great Toll dan Glass Step berbeda dari Festival Flare (bila masih memakai cue yang sama) dan cue `ui.unlock` | Peta event audio menunjuk cue sendiri per Rite |

## 8. Perubahan pada dokumen CD

- `docs/style-guide.md` 1.3: kilat Unlit (1.4), zona pemain (1.8), bagian 8 baru.
- `docs/vision.md` 1.3: nama Tingkat B dan C, judul rilis bersyarat (bagian 5).
- `docs/narrative/title-candidates.md`: baru (dibuat CD karena belum ada dari Writer).
- `docs/reviews/evidence/M3-cd/`: 8 screenshot bukti.

## 9. Pertanyaan terbuka

1. Uji 1 detik, miniatur, toko singkat, dan ragam build manusia masih memakai proksi atau belum dijalankan. Konfirmasi Dok tetap sisa setelah rilis.
2. Audio (S-15, suara Rite kelas B) belum didengar CD.
3. P1-c (dominasi tag bot) belum ada; tanpa itu Pilar 1 untuk Tingkat B hanya dinilai dari struktur data.
4. Asumsi makna pertanyaan "pose cast 17 px" (bagian 5 Q2); AD mengoreksi bila konteksnya lain.
5. Cek web dan merek dagang judul Shardfall serta nama Tingkat B dan C butuh akses web yang tidak dimiliki subagent.
