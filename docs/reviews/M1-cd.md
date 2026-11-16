# Catatan Rasa Main M1 (CD)

Reviewer: Creative Director (CD). Tugas: M1-09c. Tanggal: 2026-11-17.
Dasar: `docs/pillars.md` 1.1, `docs/style-guide.md` (naik ke 1.2 akibat review ini), `docs/vision.md` (naik ke 1.2), build M1 dengan sim asli.
Cakupan: rasa main, keterbacaan, skala dan kamera, kode warna, nama. Angka balance milik GD, arsitektur milik LP; disentuh hanya bila memengaruhi rasa.

## 0. Putusan

**Main loop terasa benar secara struktur dan keterbacaan, belum secara dampak dan kepadatan. Putusan: SETUJU DENGAN CATATAN.** M1 boleh keluar. Daftar perbaikan rasa di bagian 4 wajib masuk M2 dan diuji ulang di putusan rasa HD-2D M2.

| Pilar | Status di M1 | Ringkas |
|---|---|---|
| P2 Kacau tapi terbaca | Lolos, satu risiko | Bahaya paling terbaca di layar. Telegraf yang bertumpuk bisa menutupi pemain (4.1) |
| P4 Keputusan cepat | Lolos dengan catatan | Toko satu layar, cepat dipindai. Ikon kosong, flavor terpotong |
| P1 Build baru | Belum bisa dinilai | Item terlihat di arena (zona api, orbit, proyektil), tapi dampak senjata pemain lemah secara visual |
| P3 Diorama | Belum ada (sesuai rencana) | Lantai datar tanpa cahaya, dekorasi, bayangan, post-processing. Ini isi M2 |

Uji P2-a versi placeholder (CD sebagai proksi, keputusan Producer): 4 dari 5 screenshot lolos (pemain dan ancaman terdekat ketemu dalam sekitar 1 detik). Gagal: stres 1080p, saat tumpukan telegraf terjang mewarnai pemain merah.

## 1. Cara menonton

- Build e2e dibuat ke folder scratchpad (`vite build --mode e2e --outDir <scratchpad>`) agar tidak menimpa `dist-e2e` yang dipakai QA. `content/generated` tidak disentuh.
- Skrip Playwright sendiri (di scratchpad, bukan di repo): mulai run lewat klik UI, lalu sim dilangkahkan 30 tick (0,5 s) per screenshot dengan input gerak angka delapan dan Rite tiap 4 s. Pulse 1, 3, 5 (Warden), 8, dan 10 (boss) direkam penuh: 273 screenshot 1280x720 plus log jumlah aktor per 0,5 s. Toko dibeli dengan Glint debug 80 per toko, jadi build bot lebih kuat dari pemain wajar.
- Tambahan: 1920x1080 dan 1366x768 (skala), preset `spawnStress('peak')`, ukur kecepatan gerak di layar, 6 bingkai Rite, `tests/out/e2e/*.png`, `art/atlas/preview/sprites.png`, `art/concept/03-arena-lantern-market.png`.
- Audio tidak didengar. Dinilai dari nama, durasi, dan sample rate di `audio/preview/` serta `docs/audio-direction.md`.
- Batas jujur: rasa input (latensi, akselerasi) tidak bisa dirasakan tanpa tangan manusia. Penilaian gerak di bawah memakai pengukuran dan bingkai berurutan.

## 2. Catatan rasa per aspek

### 2.1 Gerak
- Terukur di 720p: 144 px/s ke samping (4,5 u/s), 115,2 px/s ke atas atau bawah, diagonal 90 dan 90 px/s. Rasio vertikal 0,80 dan diagonal 45 derajat di layar, tepat sesuai K7. **Rasio 0,80 dikunci** (`player_vertical_screen_ratio`).
- Menyeberang arena sekitar 7 s. Cukup untuk menghindar dengan sengaja; tidak terasa lambat di bingkai berurutan.
- Pemain belum punya cincin kaki dan bayangan (style guide 1.5, 1.6). Di kerumunan, cincin kaki adalah jangkar posisi paling murah. Wajib M2.

### 2.2 Serangan
- Proyektil Lantern Bolt terlihat sebagai titik cyan 2 sampai 3 px layar. Serangan otomatis hampir tidak terlihat; dampak dibawa sepenuhnya oleh angka damage. Rasa "aku menembak" lemah.
- Kena hit pada Unlit tidak punya kilat putih yang terbaca di 0,5 s sampling; kematian Unlit langsung hilang. Kilat pemain kena hit (siluet putih penuh) sudah ada dan bagus.
- Rite (Festival Flare): percikan cyan kecil, lalu elips emas datar muncul seketika dan diam. Tidak ada kilat, gelombang, atau pertumbuhan. Rite adalah tombol paling "besar" milik pemain dan saat ini terasa paling kecil.
- Zona api pemain (Rite, jejak Smolder Boots) memakai isian emas sekitar 37% (terukur: `#A2865B` di atas `#6B6360`), melewati batas 25%, dengan tepi putus-putus putih. Zona menjadi benda paling terang dan paling luas di layar, bersaing dengan pemain, dan bahasa garis putus-putus mirip telegraf.

### 2.3 Tempo Pulse
- Struktur benar: timer jelas, 5 detik terakhir emas, Pulse terakhir bioma berganti ke bar HP boss bernama ("Paper Sun"), Warden menjeda Pulse dengan "Held".
- Kepadatan rendah. Unlit hidup bersamaan terukur: Pulse 1 maksimal 5, Pulse 3 maksimal 12, Pulse 5 maksimal 14, Pulse 8 maksimal 14 (bot kuat, jadi angka ini batas bawah). Konsep 03 menunjukkan sekitar 50. Layar terasa "survival yang sepi", bukan "kacau tapi terbaca". 3 detik pertama Pulse 1 kosong.
- Pembuka dan penutup Pulse belum punya cahaya (gelombang cahaya pembuka, kilat kaca penutup). Unlit hilang begitu saja saat Pulse selesai. "Cahaya adalah jam" (vision 4.2) belum terasa.
- Glint banyak tertinggal di lantai (21 butir di akhir Pulse 1 dengan bot yang tidak mengejar). Pungut otomatis 50% di akhir tetap berjalan. Rasa memungut harus memuaskan (lihat 4).

### 2.4 Toko dan Temper
- The Glazier satu layar, kartu baris terbaca, tag dan Glint terlihat (P4-e lolos), beli satu klik. "Taken" tanpa menggeser kartu bekerja.
- Ikon kartu kosong atau singkatan tag. Flavor terpotong dengan elipsis ("...trapped insid..."), padahal batas 70 karakter. Label Temper "Lv 2 1 of 12" membingungkan.
- Belum ada potret dan baris the Glazier di layar. Toko terasa seperti menu, belum seperti bertemu pedagang bertopeng.

### 2.5 Keterbacaan
- Kuat: proyektil musuh magenta berinti pucat (inti vs lantai 4,9:1 terukur) adalah benda paling menonjol. Mata merah dan magenta Unlit, siluet Porter, Hawker, Market Cur, dan Paper Sun langsung terbaca. Telegraf terjang merah, cincin Snuff boss, dan tanda spawn ungu jelas.
- Risiko 1: telegraf terjang yang bertumpuk menambah opasitas dan menutupi pemain (720p Pulse 8, dan stres 1080p). Pemain harus selalu terlihat (Pilar 2).
- Risiko 2: angka damage menumpuk di stres dan menempel di kepala pemain bila Unlit menempel. Angka kritikal emas duduk di sebelah Glint emas (lihat keputusan K4).

### 2.6 Skala sprite dan kamera
- Skala integer terkonfirmasi: 2x di 1280x720 dan 1366x768, 3x di 1920x1080. Arena 32 x 20 u muat utuh (sekitar 80% lebar, 56% tinggi layar). **Kamera dan skala dikunci untuk M2**, tanpa zoom.
- Ruang kosong di atas arena (sekitar 28% tinggi layar) adalah tempat pita latar kios dan lentera (LD 12.2). Jangan dipakai HUD.
- Ukuran aktor sesuai tabel style guide 1.4: Lampmoth jelas lebih kecil dari pemain, Porter dan Brass Collar lebih besar, Paper Sun mendominasi tanpa menutupi area main.

### 2.7 Kode warna
- Audit visual: tidak ada merah, magenta, atau ungu di pemain dan efeknya; tidak ada biru, cyan, atau emas di Unlit. Lolos.
- Pelanggaran batas: zona api pemain emas 37% (batas 25%). Angka kritikal emas melanggar semangat "emas kecil di area main = Glint atau hadiah" (diputus di K4).
- Saturasi median lantai area main 10,3% (batas 15%). Lantai masih tanpa cahaya; dicek ulang setelah cahaya M2.

### 2.8 Audio (dari data, tidak didengar)
- Lengkap untuk loop M1: 4 lapis Pulse bioma 1 (L0 dan L1 35,6 s, L2 dan L3 19,1 s), musik toko 27,8 s, riser tepat 6,0 s, stinger awal dan akhir Pulse, Warden, menang, kalah. SFX serangan otomatis 46 sampai 80 ms (aturan di bawah 80 ms terpenuhi), kena hit 163 ms, Glint 90 ms.
- Belum ada: lagu boss (Pulse boss memakai loop Pulse level maksimal), judul, overlay Unlit Warden, fade lapisan. Masuk M2.
- `sfx.player.lowhp` berupa derit kaca, bukan detak jantung: diterima, terima kasih.
- Uji telinga A-1 sampai A-6 dan uji orisinalitas melodi butuh pendengar. Tetap terbuka.

## 3. Keputusan kreatif

### K1. Nama Writer (glossary versi 2, string table versi 1): semua disetujui
Status di glossary dan string table naik menjadi **Kerja** (disetujui CD, cek web wajib M3 sebelum dikunci).

| Nama | Untuk | Putusan | Catatan |
|---|---|---|---|
| Candle Crown | `ashen_crown` | Disetujui | Menghapus Ashen. Lilin dan mahkota festival cocok Flame |
| Tithe Shard | `tithe_coin` | Disetujui | Tag Shard ada di item, jadi kata Shard di nama jujur |
| Festival Flare | Rite `flare_lantern` | Disetujui | Mengikat Rite ke pasar festival |
| Sky Splinter | `splinter_shot` | Disetujui | |
| Harvest Sickle | `arc_blade` | Disetujui | Benang ke Vintner |
| Glass Halo | `orbit_shards` | Disetujui | Cek web M3 (kata Halo) |
| Leaping Wick | `chain_spark` | Disetujui | Kata "Leaping" juga di julukan Warden; diterima karena konteks berbeda dan tidak tampil di arena |
| Homeward Blade | `returning_glaive` | Disetujui | Menghapus Glaive |
| Pocket of Sky | `shard_pouch` | Disetujui | |
| Pruning Hook | `headsman_hook` | Disetujui | Lebih hangat, benang kebun |
| Lampmoth | `swarmer` | Disetujui | Pas dengan The Moth Market |
| Market Cur | `charger` | Disetujui | "Cur" agak kuno tapi terbaca dan bernada |
| Hawker | `shooter` | Disetujui | |
| Porter | `tank` | Disetujui | |
| Brass Collar, the Thrice-Leaping | `warden_hound` | Disetujui | Julukan hanya di banner kedatangan; bar "Held" dan HUD cukup "Brass Collar" |
| Paper Sun, the Light-Eater | `boss_lantern` | Disetujui | Siluet di game sudah membuktikan nama |
| Glass Lance | proc Shard 6 | Disetujui | |
| Held | label bar Warden | Disetujui | Juga banner "Pulse {n} Held" |
| Glazier Timer | opsi pengaturan | Disetujui | Hanya bila P4-f memintanya; label sudah aman dari kata Shop |
| Nama kerja GD dipertahankan: Lantern Bolt, Coal Locket, Kindling Jar, Torch Glove, Smolder Boots, Glass Marble, Prism Lens, Splinter Comb, Whetstone, Duelist Ribbon | | Disetujui | Tidak ada kata terlarang |

Satu catatan teks untuk WR: "a 8% chance" (temuan LP) diperbaiki sebelum string slice dibekukan.

### K2. Kamera, skala, rasio gerak dikunci
Pitch 38,68 derajat, 2x di 720p dan 768p, 3x di 1080p, arena seluruhnya di layar, rasio vertikal 0,80. Tidak ada perubahan di M2.

### K3. Telegraf tidak boleh menyembunyikan pemain
Arah rasa (implementasi milik LP dan AD, urutan lapis tetap architecture 7.4):
1. Isian telegraf yang bertumpuk tidak menambah opasitas: gabungan beberapa telegraf tampil seperti satu isian (maksimal 35%).
2. Saat isian telegraf atau proyektil musuh menutupi pemain, siluet tembus pemain (aturan LD yang sudah ada untuk aktor besar) digambar di atas lapis bahaya: outline `kept-white` atau `kept-cyan` 1 px plus cincin kaki.
Style guide 1.8 sudah diubah.

### K4. Angka kritikal: tidak emas (pertanyaan AD)
**Kritikal memakai `kept-cyan` dengan outline `ink`, bukan `kept-gold`.** Angka biasa tetap `bone`.
- Alasan: screenshot stres menunjukkan angka kritikal emas berbaur dengan baris Glint emas. Emas kecil di area main harus tetap satu arti: "pungut aku" atau hadiah. Cyan sudah berarti "seranganku", jadi kritikal terbaca sebagai seranganku yang lebih kuat. Cyan vs lantai 3,8:1 memenuhi P2-c untuk sorotan pemain.
- Pembeda tambahan dari angka biasa: set digit kritikal sendiri yang 1 px lebih besar (misalnya 4x6) atau satu piksel kilau di sudut digit, tanpa skala non-integer. Pilihan bentuk milik AD; bila tidak sempat di M2, warna cyan saja sudah cukup.
- Emas di area main kini hanya: Glint, hadiah (peti Warden, level up, Memento), isian zona api pemain maksimal 25%, kilau Rush penuh pada pemain.
Style guide 1.3 dan 1.8 sudah diubah. AD menyesuaikan `art-direction.md` 8.2 dan 13 butir 7.

### K5. Zona milik pemain
Isian zona api pemain maksimal 25% efektif di render (diukur sebagai campuran di atas lantai, bukan alpha shader). Jejak berulang (Smolder Boots dan sejenisnya) maksimal 15% tanpa tepi. Tepi zona Rite boleh 1 px `kept-cyan` solid, **tidak putus-putus**: garis putus-putus milik bahasa telegraf. Style guide 1.8 sudah diubah.

## 4. Daftar perbaikan rasa masuk M2, per pemilik

Prioritas: **[W]** wajib untuk putusan rasa HD-2D M2, **[S]** sebaiknya.

**Game Designer (GD)**
1. [W] Kepadatan. Target rasa (angka milik GD): Pulse 1 tetap ringan untuk belajar, tetapi Unlit pertama muncul dalam 1 s; puncak Unlit hidup bersamaan sekitar 20 di Pulse 4 sampai 5 dan 40 atau lebih di 6 detik terakhir Pulse 8 sampai 9, dengan build wajar. Verifikasi dengan bot M2 tanpa Glint debug.
2. [W] Rasa memungut Glint: Glint dalam radius melesat ke pemain dengan percepatan (bukan bergeser rata). Radius dan kecepatan milik GD; CD menilai di M2. Pertimbangkan radius dasar lebih lega bila median Glint terpungut di Pulse di bawah 70%.
3. [S] Jumlah jejak Smolder Boots per detik dibatasi agar tidak lebih dari 4 tambalan sekaligus.

**Gameplay Programmer (GP)**
1. [W] Event yang dibutuhkan VFX dan audio untuk dampak: kena hit Unlit (untuk kilat 2 bingkai), kematian dengan posisi (motes), Rite mendarat, Pulse dibuka dan ditutup. Knockback Edge dan tebasan harus terlihat jaraknya.
2. [W] Pemain kembali ke dekat pusat tiap Pulse (dukungan rasa M0) bila GD setuju, agar gelombang cahaya pembuka berpusat di pemain.

**Art Director (AD)**
1. [W] Cincin kaki pemain dan bayangan elips semua aktor.
2. [W] Proyektil pemain lebih terbaca: inti `kept-white` 3 px plus ekor cyan pendek 2 bingkai, tetap di bawah lapis bahaya.
3. [W] Rite Festival Flare: kilat pelepasan di pemain, gelombang cincin cyan ke titik jatuh, isian zona tumbuh dari tengah 0,2 s, kedip api lembut. Dampak harus terasa paling besar dari semua efek pemain tanpa menutupi bahaya.
4. [W] Kilat putih 2 bingkai pada Unlit kena hit, motes gelap kurang dari 0,3 s saat mati.
5. [W] Gelombang cahaya pembuka Pulse dan kilat kaca penutup (art-direction 6).
6. [W] Zona pemain sesuai K5, angka kritikal sesuai K4.
7. [W] Ikon: Rite, 6 senjata, 12 Memento, 14 kartu Temper, 3 tag. Potret the Glazier 48x48.

**Lead Programmer (LP)**
1. [W] Pipeline HD-2D: cahaya kunci dan isi, titik cahaya lentera, sprite menerima cahaya, DoF pita, bloom, vignette, kilau kaca, kualitas Rendah.
2. [W] K3: isian telegraf tidak bertumpuk, siluet tembus pemain di atas lapis bahaya.
3. [W] Batas angka damage di layar (usul: maksimal sekitar 24, buang angka biasa terlama dulu, kritikal terakhir) dan angka tidak digambar di dalam kotak sprite pemain.
4. [S] Getar layar ringan (render saja, mati di "kurangi efek") untuk pemain kena hit, Warden dan boss mati.

**UI Programmer (UI)**
1. [W] Ikon di HUD Rite, kartu, slot. Flavor tidak terpotong: kartu harus muat 70 karakter atau membungkus satu baris tambahan.
2. [W] Potret dan baris the Glazier di layar toko (1 baris, maksimal 45 karakter, dari string table).
3. [W] Label Temper jelas saat banyak level tertunda (usul: "Lv 2" lalu penghitung kecil "1 / 12").
4. [W] Pulse boss sebelum boss muncul tidak menampilkan "0:00"; tampilkan nama boss dengan bar kosong yang mengisi saat masuk.
5. [S] Banner "Pulse {n}" singkat saat Pulse dibuka, selaras gelombang cahaya.

**Level Designer (LD)**
1. [W] `arena_market` final di game: bibir, garis tepi kaca, pita latar kios dan lentera, Gerbang Lentera, 3 rintangan, minimal 3 elemen bergerak.

**Audio Director (AU)**
1. [W] Lagu boss, overlay Unlit Warden, fade lapisan, stinger boss.
2. [W] Suara Rite mendarat dan Unlit kena hit yang ikut membawa dampak (3.3 tetap berlaku untuk yang berulang).
3. [S] Uji telinga 10 menit dan orisinalitas melodi: butuh pendengar manusia; dicatat sebagai sisa bila tidak ada.

**Writer (WR)**
1. [W] Perbaiki "a 8% chance". Status nama di glossary dan string table menjadi Kerja (K1).

**QA**
1. [W] P2-a dan P4-f di M2 dengan build final slice; tambahkan kasus "telegraf bertumpuk di atas pemain".

## 5. Perubahan pada dokumen CD
- `docs/style-guide.md` 1.2: 1.3 (emas di area main, kritikal), 1.8 (zona pemain, telegraf bertumpuk, siluet tembus, angka damage), bagian 6.
- `docs/vision.md` 1.2: nama konten Tingkat A disetujui (bagian 5).
- `docs/m2-creative-brief.md`: brief kreatif vertical slice.

## 6. Pertanyaan terbuka
1. Rasa input (latensi, akselerasi, berhenti) belum dirasakan tangan manusia. Bila Dok sempat, satu run 5 menit sudah cukup untuk konfirmasi.
2. Uji telinga dan orisinalitas melodi tetap terbuka sampai ada pendengar.
3. Kepadatan dan durasi boss terukur dengan bot yang terlalu kuat. GD memverifikasi dengan bot M2.
