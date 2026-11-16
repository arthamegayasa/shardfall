# Review Kreatif M0 (CD)

Reviewer: Creative Director (CD). Tugas: M0-11a. Tanggal: 2026-11-16.
Dasar: `docs/vision.md`, `docs/pillars.md`, `docs/style-guide.md` (ketiganya naik ke versi 1.1 akibat review ini).
Cakupan: rasa, pilar, nama, dan gaya. Angka balance milik GD, arsitektur milik LP; keduanya hanya disentuh bila memengaruhi rasa.

## 0. Ringkasan putusan

| Dokumen | Pemilik | Putusan | Pilar lolos | Pilar dilanggar atau berisiko |
|---|---|---|---|---|
| `docs/gdd.md` | GD | SETUJU DENGAN CATATAN | P1 (P1-a 18%, P1-b 100%, tier IV perilaku baru), P2-e (telegraf tidak pernah dipendekkan), P4-c | Nama: 2 kata terlarang di nama kerja (4.3). HUD saat Warden menahan Pulse belum jelas (P2) |
| `docs/art-direction.md` | AD | SETUJU DENGAN CATATAN | P2-b, P2-c (inti bahaya, cyan), P2-d, P2-f, P3-a, P3-b, P3-d | Burn emas di atas Unlit bisa dikira Glint (P2). Saturasi lantai b3 15,2% melewati batas. Pitch tidak seragam antar dokumen |
| `docs/art-pipeline.md` | AD | SETUJU | P2-d otomatis, P3-a, P3-b, aset dari data | Tidak ada |
| `art/concept/*.png` | AD | SETUJU DENGAN CATATAN | P2 (uji 1 detik versi konsep lolos menurut penilaian CD), P2-b, P3 (rasa panggung) | Identitas b3 lemah; nilai pemain di grayscale belum yang paling terang |
| `docs/audio-direction.md` | AU | SETUJU DENGAN CATATAN | P2-g (kena hit, level up, Memento beda), hierarki 3.2, aturan berulang 3.3, nada "kaca dan gelap" | Hanya penggantian istilah dan satu asumsi ukuran arena |
| `docs/audio-list.md` | AU | SETUJU DENGAN CATATAN | Cakupan Tingkat A lengkap, prioritas benar | Id cue `keepsake` dan beberapa id UI belum selaras dengan UI |
| `docs/narrative/lore-premise.md` | WR | SETUJU | Nada, lore di dalam benda, kode warna punya alasan cerita | Tidak ada |
| `docs/narrative/glossary.md` | WR | SETUJU DENGAN CATATAN | Cek orisinalitas jujur, batas panjang | Perlu diperbarui ke keputusan bagian 1 |
| `docs/levels/arena-design.md` | LD | SETUJU DENGAN CATATAN | P2 (kamera diam, tanpa ancaman di luar layar, siluet tembus pemain), P3-c (pita DoF terkunci geometri), P3-d | Pitch berbeda dari LP dan AD; nama dan warna cahaya belum mengikuti keputusan |
| `docs/ui/ui-spec.md` dan `docs/ui/wireframes/` | UI | SETUJU DENGAN CATATAN | P4-a sampai P4-e, HUD minimal, aksesibilitas kuat, merah hanya untuk bahaya | Istilah UI belum mengikuti keputusan bagian 1 |

Tidak ada TOLAK. Tidak ada pelanggaran kode warna, skala pixel, atau jiplakan. Semua catatan bisa dikerjakan tanpa merombak rancangan.

---

## 1. Keputusan kreatif (final)

### K1. Keepsake diganti Memento. Warden, Glint, Silt dipertahankan
- **Memento** (jamak Mementos) menggantikan Keepsake di teks game, dokumen, data, dan kode. Alasan: Keepsake adalah nama sistem benda di Hades, yang ada di daftar referensi kita, dengan fungsi serupa. Style guide sudah melarang Boon dengan alasan yang sama, jadi Keepsake harus diperlakukan sama. Memento hangat, melankolis, cepat dibaca, dan menurunkan kepadatan kata "keep" (kekhawatiran Writer).
- Identifier: `memento` (bukan `keepsake`) sejak baris kode M1 pertama. Belum ada kode, jadi biayanya hanya di dokumen. Event dan file data ikut (misalnya `MementoAcquired`, `mementos.csv`). LP memegang nama final event, tapi tidak boleh ada campuran `keepsake` dan `memento`.
- Keepsake masuk daftar kata terlarang (style guide 4.3). Cek web Writer di M3 tetap wajib untuk Memento.
- **Warden** dipertahankan: kata umum di banyak franchise tanpa satu pemilik, dan kita memakainya sebagai kategori, bukan satu makhluk. Syarat: tidak ada Warden tunggal bernama "the Warden", dan ikon tag Ward berbeda bentuk dari penanda Warden.
- **Glint** dan **Silt** dipertahankan (risiko rendah; Silt adalah judul game, bukan istilah di dalam game).

### K2. Istilah usulan Writer
| Usulan | Putusan | Catatan |
|---|---|---|
| Temper (level-up) | Disetujui | Judul panel. Subjudul dan HUD tetap "Lv 5" agar cepat dipahami (Pilar 4) |
| Fuse (merge) | Disetujui | Teks tombol dan lencana "Fuse > II". Identifier boleh tetap `merge` |
| The Keeping (layar meta) | Disetujui | Mengganti "Archive" di UI. Tab "Kept" dan "Mementos" |
| Vitrine Steady | Disetujui | Layar antara bioma, bukan akhir run |
| Light Kept | Disetujui | Judul menang. Mengganti draf UI "The Light Holds" |
| The Moth Market, Vesper Steps, Stillfire Vineyard | Disetujui | Nama string table final, dicek ulang di M3. Mengganti nama kerja Indonesia di arena-design |
| Lamplighter, Chorister, Vintner | Disetujui | Siluet di konsep sudah membedakan ketiganya |
| Rarity Plain, Fine, Rare, Fabled | Dikunci | Alternatif bertema kaca ditolak demi uji kartu 3 detik |
| Crack (kesulitan, usulan GD) | Disetujui | Mengganti "Depth" di UI. Diegetik: langit makin retak |

Semua sudah dicatat di `docs/vision.md` bagian 5.

### K3. UI: kartu baris dan slot timer
- **Kartu baris dengan ikon di kiri: disetujui.** Alasan UI benar: efek 2 x 40 karakter pada ukuran teks minimum tidak muat di kartu tegak berdampingan. Style guide 2.1 sudah diubah.
- **Pulse boss: slot timer menjadi bar HP boss: disetujui.** Isian `danger-violet`, nama boss di atasnya, tanpa angka besar.
- **Tambahan CD:** saat Warden menahan Pulse (waktu habis, Warden hidup), slot timer juga menjadi bar HP Warden dengan label "Held", komponen yang sama. Pemain harus selalu tahu apa yang mengakhiri Pulse. Style guide 2.2 sudah diubah.

### K4. Audio: riser 6 detik
Disetujui. Riser menyatu dengan lonjakan spawn GDD (D minus 6 sampai D minus 2 s) dan dua detik tanpa spawn menjadi puncaknya. Style guide 3.1 sudah diubah. Timer HUD tetap menyorot 5 detik terakhir (hitung 5, 4, 3, 2, 1); itu tidak bertentangan.

### K5. GD: HP pulih penuh tiap Pulse, toko tanpa timer
- **HP pulih penuh: sesuai rasa.** Setiap Pulse adalah satu denyut dan satu ujian; ini cocok dengan "cahaya adalah jam" dan sesi singkat. Syarat rasa: pemulihan terlihat dan terdengar sebagai bagian gelombang cahaya pembuka (bar HP terisi bersama cincin cahaya), bukan angka yang diam-diam berubah.
- **Toko tanpa timer: sesuai rasa, dengan pengaman.** Ketegangan datang dari Glint yang terbatas dan biaya reroll yang naik; tanpa jam lebih ramah pemain kasual dan aksesibilitas. Pengaman baru: uji **P4-f** (median waktu toko 25 detik atau kurang di playtest M2; bila di atas 30 detik, CD meninjau ulang). Sudah ditambahkan ke `docs/pillars.md`.

### K6. AD: cara ukur badan Unlit dan saturasi lantai b3
- **Badan Unlit diukur per aktor: disetujui dengan syarat.** Median piksel badan tiap aktor minimal 2:1 dan persentil 10 tiap aktor minimal 1,5:1, outline `ink` dan rim utuh. Piksel di bawah isian telegraf bahaya tidak dihitung, karena telegraf sendiri sudah menandai bahaya. P2-c di pillars sudah diubah. Angka per aktor diukur ulang di M2 pada screenshot game.
- **Saturasi lantai: batas tetap.** Median render paling tinggi 15%, target desain 13% atau kurang. b3 (15,2%) belum lolos; diperbaiki sebelum produksi b3 (Tingkat C), tidak menahan M0. b1 (14,5%) lolos tapi tanpa ruang; dicek ulang di M2 dengan three.js. Batas lokal blok 8x8 paling tinggi 25% (dari LD) diterima sebagai pelengkap. Style guide 1.9 sudah menyatukan ketiga cara ukur ini.
- Cahaya kunci b1 `#DCA466` (koreksi AD atas saran CD) disetujui.

### K7. Rasa gerak vertikal akibat kemiringan kamera
Arah rasa diputuskan, implementasi milik LP dan GP, angka milik GD. Dicatat di style guide 1.4:
1. Arah input sama dengan arah di layar (W+D tampak 45 derajat).
2. Kecepatan layar pemain ke atas atau bawah ditargetkan 80% dari kecepatan ke samping, kalibrasi M1 di rentang 75 sampai 85%. Tanpa kompensasi (sekitar 63 sampai 67%) terasa berat. Kompensasi penuh membuat lantai terasa rata dan menghapus rasa miniatur.
3. Kompensasi hanya pada gerak yang dikendalikan input pemain (jalan dan dash Rite). Bentuk area, jangkauan, proyektil, dan telegraf tetap jujur di lantai dunia, jadi yang terlihat sama dengan yang terjadi (Pilar 2).
4. Unlit tidak dikompensasi secara default; GD boleh menambahkannya bila kabur vertikal terlalu mudah.
5. Rasio disimpan di data agar bisa disetel di M1 tanpa mengubah kode.

---

## 2. Review per dokumen

### 2.1 `docs/gdd.md` (GD): SETUJU DENGAN CATATAN
Lolos:
- Pilar 1 kuat: tag di semua item, stat datar 17 sampai 18% dari pool, tier IV selalu perilaku baru, sinergi tiap ambang terlihat (nova, fragmen, tebasan, Barrier, kilau emas). Kelas beda senjata, Rite, pasif, dan stat.
- Pilar 2: tabel telegraf minimum dan aturan "kesulitan tidak memendekkan telegraf" adalah komitmen yang tepat. Tanda retak spawn 0,8 s dan zona 4 u dari pemain mencegah kematian yang terasa curang.
- Rasa: 50% Glint sisa dipungut otomatis menjaga pilihan "kejar Glint atau aman" tanpa kejam. Rite siap di awal Pulse dan cooldown pendek membuat Rite dipakai, bukan disimpan.

Catatan:
1. Nama kerja **Ashen Crown** memakai kata terlarang (Ashen) dan **Tithe Coin** memakai Coin (kata mata uang yang sudah kita ganti). Writer memberi nama final; GD cukup tahu bahwa id boleh tetap.
2. Istilah Keepsake menjadi Memento (K1), merge tampil sebagai Fuse, kesulitan Crack.
3. Saat Warden menahan Pulse, HUD menampilkan bar HP Warden (K3). GD memastikan view menyediakan HP Warden (bersama permintaan UI K5).
4. CD mendukung secara rasa usul LD: pemain kembali ke titik awal tiap Pulse, karena gelombang cahaya pembuka berpusat di dekat pemain. Keputusan tetap milik GD.
5. Visual Burn mengikuti style guide 1.3 versi baru (api kaca biru, bukan emas).

### 2.2 `docs/art-direction.md` (AD): SETUJU DENGAN CATATAN
Lolos: palet dan aturan kubu tepat; bukti terukur (inti bahaya 5,1 sampai 5,4:1, cyan 4,0 sampai 4,2:1) dan perbaikan dari render gagal pertama (lantai 0,88 albedo, hue cahaya 15%, proyektil musuh tanpa bloom) adalah kerja yang benar. Aturan celah 3 px dan larangan rantai diagonal menjaga siluet. Kilat kena hit pemain tidak pernah merah: tepat.

Catatan:
1. **Burn di atas Unlit** memakai `kept-gold`. Di kerumunan, puluhan titik emas kecil di atas Unlit bersaing dengan Glint, padahal emas kecil di area main harus berarti "pungut aku". Ganti menjadi `kept-cyan` dan `kept-white`. Isian area api (ledakan Lantern Bolt, zona Rite) boleh tetap emas maksimal 25% (style guide 1.3).
2. Saturasi lantai b3 diperbaiki ke target 13% sebelum produksi b3 (K6).
3. Pitch: art-pipeline mengikuti LP (asin(2/3), 41,8 derajat), arena-design memakai 38,68 derajat. Satu nilai harus disepakati LP, LD, dan AD sebelum kontrak M1 dibekukan (lihat perbaikan wajib LP).
4. Dukungan rasa untuk permintaan AD ke LP (bloom dan blur pita tepi disampel bilinear saat upscale): tanpa itu halo tampil sebagai blok dan rasa HD-2D hilang. Keputusan teknis tetap milik LP.

### 2.3 `docs/art-pipeline.md` (AD): SETUJU
Semua aset dari data, validator menangkap pelanggaran kubu dan ukuran, preview tiga baris (warna, siluet, grayscale) memudahkan review. Tidak ada catatan wajib.

### 2.4 `art/concept/*.png` (AD): SETUJU DENGAN CATATAN
Dilihat langsung: `02-actor-lineup.png`, `03-arena-lantern-market.png`, `04-biome-moods.png`, `05-readability-check.png`.

Lolos:
- 03: pemain langsung ketemu dalam sekitar 1 detik; telegraf terjang (outline merah plus garis putus) dan lingkaran peledak sangat terbaca; proyektil musuh magenta berinti pucat paling menonjol; aura Warden ungu jelas. Deretan kios dan lentera di pita atas memberi rasa panggung. Garis tepi kaca arena terbaca.
- 02: tiga kelas punya siluet berbeda (topi lebar, tudung runcing, bahu lebar). Peran Unlit bisa ditebak dari siluet datar. Boss lentera sangkar kuat sebagai titik fokus.
- 05: tiga lapis nilai terpisah.

Catatan:
1. **b3 (Stillfire Vineyard) lemah identitasnya.** Latar teralis terbaca sebagai pagar atau grid yang ramai, dan lantai b1 serta b3 hampir sama. Perkuat lewat siluet (rumah peras, sulur, tunggul), cahaya bara di cakrawala, dan grading, bukan dengan menaikkan saturasi lantai. Tingkat C, dikerjakan saat produksi b3.
2. **Nilai pemain di grayscale** masih setara dengan Glint dan proyektil, bukan yang paling terang. Uji 1 detik di konsep tetap lolos karena posisi dan warna. Di M2, bila P2-a gagal, naikkan dulu cincin kaki pemain (lebih terang atau tepi `kept-white`) sebelum mengubah sprite.
3. Konsep 2D belum bisa membuktikan rasa diorama (DoF, kedalaman). P3-c dan P3-e diuji di M2 dengan three.js.

### 2.5 `docs/audio-direction.md` (AU): SETUJU DENGAN CATATAN
Lolos dan kuat: pusat nada D untuk semua lagu dan tangga Glint dari lagu aktif; pemisahan kubu lewat nada (konsonan lawan tritone, pita 1 sampai 3 kHz untuk bahaya); stinger akhir Pulse naik ke D mayor ("cahaya menang"); musik toko F lydian yang sedikit ganjil cocok untuk pedagang bertopeng; kena hit berupa retak kaca, selaras lore Kept yang setengah kaca. Motif ditulis sendiri; uji orisinalitas dengar tetap dijadwalkan M2 (A-6).

Catatan:
1. `arenaHalfWidth` diasumsikan 14 (GDD). Arena LD 32 u, jadi 16. Ambil dari data arena, jangan konstanta.
2. Ganti istilah Keepsake di cue dan teks ke Memento (lihat audio-list).
3. [Opsional] `sfx.player.lowhp` berupa detak jantung adalah klise. Pertimbangkan derit kaca atau retakan yang berdetak pelan, lebih sesuai Kept yang setengah kaca.

### 2.6 `docs/audio-list.md` (AU): SETUJU DENGAN CATATAN
Lolos: cakupan Tingkat A lengkap, satu suara untuk banyak proyektil (volley, lanes), coalescing, slot cadangan prioritas 1 dan 2.

Catatan:
1. Id cue `sfx.keepsake.gain` menjadi `sfx.memento.gain`, event `Keepsake*` menjadi `Memento*` (selaras LP). Id belum dipakai kode, jadi aturan "id stabil" belum berlaku.
2. Id UI di ui-spec 8.5 (`ui.buy`, `ui.reroll`, `ui.lock`, `ui.merge`, `ui.levelup_pick`, `ui.keepsake_pick`) berbeda dengan audio-list (`ui.shop.buy`, `ui.card.pick`, dan seterusnya). Sumber kebenaran id cue adalah audio-list; UI menyesuaikan.

### 2.7 `docs/narrative/lore-premise.md` (WR): SETUJU
Nada tepat: ringkas, misterius, hangat. Kebenaran tersembunyi konsisten dan tidak dijelaskan di game. "The Pane hanya meneruskan biru dan emas" memberi kode warna alasan cerita yang indah. Kelas sebagai "jenis cahaya yang dipegang" mengikat kelas, bioma, dan lore. Baris the Glazier punya suara yang jelas dan tidak menjanjikan mekanik. Akhir "Light Kept" membalik "Kept Lost" dengan baik. Satu-satunya penyesuaian (Keepsake menjadi Memento) ikut dikerjakan di glossary.

### 2.8 `docs/narrative/glossary.md` (WR): SETUJU DENGAN CATATAN
Lolos: cek orisinalitas jujur soal batasnya, kolom ID siap, rarity dipertahankan dengan alasan Pilar 4.

Catatan: perbarui status ke keputusan bagian 1 (Memento, Temper, Fuse, The Keeping, Vitrine Steady, Light Kept, Crack, nama bioma dan kelas menjadi Inti). Tambahkan Ashen dan Coin sebagai nama yang harus diganti di nama kerja GD.

### 2.9 `docs/levels/arena-design.md` (LD): SETUJU DENGAN CATATAN
Lolos dan kuat: kamera diam dengan seluruh arena di layar adalah keputusan terbaik untuk Pilar 2 dan Pilar 3 sekaligus (tanpa ancaman di luar layar, pita DoF terkunci, diorama dipandang utuh). Sudut terpotong menggemakan pecahan kaca dan panel UI. Pita latar belakang bernilai lantai, debu kaca tidak pernah emas, dan siluet tembus pemain di balik aktor besar adalah aturan keterbacaan yang tepat. Validator LD-T01 sampai LD-T13 membuat aturan bisa diuji.

Catatan:
1. Nama bioma memakai nama final (K2): The Moth Market, Vesper Steps, Stillfire Vineyard. Id data mengikuti satu konvensi yang ditetapkan LP (sekarang ada tiga: `biome_market`, `night-market`, `b1`).
2. Warna cahaya contoh (`#E0A458`, saturasi 61%) melewati batas 60%. Pakai nilai AD (`#DCA466`); warna cahaya milik AD.
3. Pitch 38,68 derajat bertentangan dengan LP (41,8 derajat). Hitung ulang kotak layar dan pita setelah LP memutuskan.
4. Rasa gerak vertikal mengikuti K7.

### 2.10 `docs/ui/ui-spec.md` dan `docs/ui/wireframes/` (UI): SETUJU DENGAN CATATAN
Lolos dan kuat: toko satu layar tanpa scroll dengan pratinjau sinergi dan Fuse (P4-e), beli 1 sampai 2 input (P4-c), "Taken" tanpa menggeser kartu, tidak mampu beli memakai abu dan ikon coret (bukan merah), HUD lima elemen di pita tepi, "Felled by" untuk uji "aku mati karena...", tiga ukuran teks tetap skala integer, navigasi keyboard penuh.

Catatan (istilah, semua di string table dan wireframe):
1. "Take a Keepsake" menjadi "Take a Memento"; tab dan label Keepsakes menjadi Mementos.
2. "Archive" menjadi "The Keeping" (S01, S08, S09, `ui.class.locked`).
3. "Depth" menjadi "Crack".
4. "The Light Holds" menjadi "Light Kept"; tambahkan layar antara "Vitrine Steady" (Tingkat C).
5. Judul level-up "Level {n}" menjadi "Temper", subjudul "Lv {n}".
6. Label "Merge" dan lencana "MERGE > II" menjadi "Fuse" dan "Fuse > II".
7. HUD: varian bar HP Warden saat Pulse ditahan (K3). Perluas permintaan kontrak K5 agar mencakup Warden.
8. Id cue UI mengikuti audio-list (lihat 2.6).

---

## 3. Perbaikan wajib per pemilik

Wajib sebelum kontrak dan string table M1 dibekukan, kecuali disebut lain.

**Writer (WR)**
1. `glossary.md`: ganti Keepsake dengan Memento (EN, ID, definisi, risiko); ubah status Temper, Fuse, The Keeping, Vitrine Steady, Light Kept, Crack, tiga bioma, tiga kelas menjadi Inti.
2. `lore-premise.md`: ganti Keepsake dengan Memento di semua tempat.
3. String table M1: nama final pengganti "Ashen Crown" dan "Tithe Coin".

**Lead Programmer (LP)**
1. Putuskan satu pitch kamera (LP 41,8 lawan LD 38,68 derajat) bersama LD dan AD, catat di architecture.md.
2. Identifier `memento` di kontrak (event, tipe, nama file data), bukan `keepsake`.
3. Satu konvensi id bioma untuk GD, LD, AD.
4. Rasio gerak vertikal pemain dari data (K7), bersama GP.

**Game Designer (GD)**
1. Ganti Keepsake dengan Memento di gdd.md dan data-schema.md (bersama identifier LP).
2. View menyediakan HP Warden saat Pulse ditahan (bersama UI K5).
3. Putuskan kompensasi Unlit hanya bila playtest M1 memintanya (K7 butir 4).

**Art Director (AD)**
1. art-direction.md 8.2: Burn pada Unlit memakai `kept-cyan` dan `kept-white`, bukan `kept-gold`.
2. Saturasi lantai b3 ke 13% atau kurang sebelum produksi b3 (Tingkat C). Cek ulang b1 di M2.
3. Ukur P2-c badan Unlit per aktor di M2 dengan cara baru.

**Audio Director (AU)**
1. Id cue dan event Keepsake menjadi Memento.
2. `arenaHalfWidth` dari data arena.

**Level Designer (LD)**
1. Nama bioma final di arena-design.md 12.
2. Warna cahaya contoh mengikuti AD (`#DCA466`).
3. Hitung ulang kotak layar setelah pitch LP diputuskan.

**UI Programmer (UI)**
1. Delapan perubahan istilah dan HUD di 2.10.

---

## 4. Perubahan pada dokumen CD
- `docs/vision.md` versi 1.1: Memento, istilah UI, nama bioma dan kelas, alasan Warden.
- `docs/pillars.md` versi 1.1: P2-c per aktor, uji baru P4-f.
- `docs/style-guide.md` versi 1.1: daftar perubahan di bagian 6.

## 5. Pertanyaan terbuka
1. Nama Memento belum dicek web dan basis data toko; Writer mengulang cek di M3 (Memento, nama bioma, nama kelas).
2. Pitch kamera final (LP) memengaruhi faktor kedalaman dan karena itu titik awal kompensasi K7.
3. Uji orisinalitas dengar motif audio (A-6) dijadwalkan M2 karena belum ada render audio.
