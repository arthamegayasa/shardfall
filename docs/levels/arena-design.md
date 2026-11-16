# Shardfall: Desain Arena

Pemilik: Level Designer (LD). Status: draf M0 untuk review (versi 1, 2026-11-16).
Reviewer: CD (rasa dan pilar), GD (dampak gameplay), LP (bisa diimplementasi).
Dasar: `docs/vision.md`, `docs/pillars.md`, `docs/style-guide.md`, keputusan di `docs/tasks.md`. Bila bertentangan, pilar yang menang (urutan Pilar 2 > 4 > 1 > 3).

Penanda: **[Wajib]** aturan LD yang harus dipatuhi implementasi dan aset. **[Saran untuk X]** keputusan milik peran lain, ini hanya default. **[Asumsi]** perlu dikalibrasi di M1.

---

## 1. Ringkasan keputusan

| Hal | Keputusan |
|---|---|
| Satuan dunia | 1 unit = 16 piksel sprite pada arah horizontal layar |
| Kamera | Ortografis, tetap, pitch 38.68 derajat (sin = 0.625), tidak mengikuti pemain |
| Bingkai referensi | 640 x 360 piksel sprite (= 1920 x 1080 pada skala 3x, 1280 x 720 pada 2x) |
| Arena | Persegi panjang bersudut terpotong, 32 x 20 unit (512 x 200 px di layar), potongan sudut 3 unit, luas 622 unit persegi |
| Muat layar | Seluruh arena selalu terlihat dan tajam dalam satu layar |
| Spawn | Pita 1.0 sampai 2.5 unit di dalam batas, 8 sektor, selalu dengan telegraf retakan, tidak dalam radius 4 unit dari pemain |
| Zona aman | Lingkar awal radius 6 di tengah, panggung boss radius 4, radius pemain 4 |
| Rintangan | Maksimal 4, tinggi maksimal 0.4 unit (5 px), cakupan maksimal 5% luas, jarak antar rintangan dan ke batas minimal 4 unit, selalu digambar di bawah aktor |
| Dekorasi | Hanya di luar batas. Belakang bebas tinggi, samping maksimal 6 unit, depan maksimal 0.5 unit |
| Geometri antarbioma | Sama untuk semua bioma. Variasi lewat cahaya, dekorasi, dan jenis rintangan |
| Urutan bioma | 1 Pasar Malam Berlentera, 2 Biara Tebing, 3 Kebun Anggur Hangus (nama kerja) |

---

## 2. Satuan dunia dan koordinat

### 2.1 Satuan [Wajib]
- **1 unit dunia = 16 piksel sprite** pada sumbu X (horizontal layar). Pada 1080p (skala 3x) itu 48 piksel layar.
- Rasa ukuran: pemain tinggi 18 sampai 22 px, sekitar 1.25 unit. Unlit kecil sekitar 0.75 unit. Boss 64 sampai 96 px, 4 sampai 6 unit.
- Semua angka posisi, ukuran arena, zona, rintangan, dan dekorasi di dokumen ini dan di `content/levels/*.json` memakai unit dunia. Angka piksel hanya untuk aturan layar.

### 2.2 Sumbu
- Lantai adalah bidang XZ, Y ke atas (konvensi three.js).
- **X** ke kanan layar. **Z positif** ke arah kamera, yaitu ke bawah layar. **Z negatif** = belakang arena = atas layar. Disebut juga utara (Z negatif) dan selatan (Z positif).
- Titik asal (0, 0, 0) ada di tengah arena, di permukaan lantai.
- Posisi di lantai ditulis `[x, z]`. Posisi 3D (cahaya) ditulis `[x, y, z]`.

### 2.3 Proyeksi ke layar
Pitch dipilih **38.68 derajat** karena sin(38.68) = 0.625, sehingga 1 unit kedalaman lantai = tepat **10 px** di layar (bilangan bulat, lantai bertekstur piksel tidak bergetar setengah piksel). Ini masih "sekitar 40 derajat" sesuai keputusan CD. [Saran untuk LP dan AD] Bila kalibrasi M1 memilih tepat 40 derajat, 1 unit kedalaman menjadi 10.28 px; semua angka unit di dokumen ini tetap berlaku dan margin layar bergeser kurang dari 6 px (masih dalam toleransi bagian 3.4).

Rumus di bingkai referensi 640 x 360 (piksel sprite), dengan target kamera di `[0, 0, -2]`:

```
layar_x = 320 + 16 * x
layar_y = 200 + 10 * z - 12.5 * y      (12.5 = 16 * cos 38.68, dibulatkan dari 12.49)
```

- Sprite aktor adalah billboard menghadap kamera, jadi tinggi sprite tampil 1:1 (tidak terpendekkan).
- Objek 3D vertikal (dekorasi, rintangan) terpendekkan: 1 unit tinggi = 12.5 px layar.
- Tekstur lantai: kerapatan texel 16 per unit pada X. Pada Z, AD boleh memakai 10 texel per unit agar piksel lantai tampil persegi di layar [Saran untuk AD].

---

## 3. Kamera dan viewport

### 3.1 Keputusan: arena muat satu layar, kamera diam [Wajib]

Kamera **tidak mengikuti pemain**. Seluruh arena plus margin selalu terlihat.

Alasan keterbacaan:
1. **Tidak ada ancaman di luar layar** (Pilar 2). Setiap Unlit, telegraf spawn, dan proyektil selalu terlihat. Tidak perlu panah penunjuk tepi layar, yang menambah kekacauan HUD.
2. **Pita DoF terkunci di layar.** Style guide mewajibkan blur hanya di pita atas dan bawah dan seluruh batas arena selalu tajam (P3-c). Kamera yang mengikuti pemain akan menggeser tepi arena masuk ke pita blur. Dengan kamera diam, syarat ini terpenuhi secara geometris.
3. **Posisi pemain selalu relatif terhadap bingkai yang sama.** Mata pemain belajar peta sekali, sehingga uji screenshot 1 detik (P2-a) lebih mudah lolos.
4. **Identitas diorama** (Pilar 3). Vitrine adalah lemari pajangan; kita memandang seluruh panggung sekaligus, seperti miniatur.
5. **Murah diimplementasi.** Tidak ada logika kamera, culling sederhana, skala piksel konstan.

Biaya yang diterima: arena relatif kecil (622 unit persegi), sehingga ruang kiting terbatas. GD mengatur kepadatan dan kecepatan dengan angka ini sebagai batas tetap. Arena tidak membesar per bioma.

### 3.2 Bingkai referensi dan skala integer [Wajib]
- Bingkai referensi: **640 x 360 piksel sprite**. Semua aturan layar di dokumen ini memakai koordinat bingkai ini (0,0 di kiri atas).
- **Kotak wajib terlihat**: x 16 sampai 624, y 32 sampai 328 (608 x 296 px). Kotak ini memuat arena, margin kepala, bibir depan, dan sedikit dekorasi samping.
- Skala layar = `floor(min(lebar_layar / 608, tinggi_layar / 296))`, minimal 1. Bingkai dipusatkan. Ruang lebih di luar 640 x 360 diisi perpanjangan dekorasi tepi dan kabut `night`, bukan arena yang lebih besar.

| Resolusi (viewport browser) | Skala | Dunia terlihat (px sprite) | Catatan |
|---|---|---|---|
| 1920 x 1080 | 3 | 640 x 360 | Referensi |
| 1920 x 950 (1080p dengan toolbar browser) | 3 | 640 x 316 | Pita atas dan bawah terpotong sekitar 22 px, arena utuh |
| 1280 x 720 | 2 | 640 x 360 | |
| 1366 x 768 | 2 | 683 x 384 | Dekorasi samping lebih banyak terlihat |
| 1440 x 900 | 2 | 720 x 450 | |
| 2560 x 1440 | 4 | 640 x 360 | |
| 2560 x 1080 (ultrawide) | 3 | 853 x 360 | Dekorasi samping harus ada sampai x = plus minus 28 unit |

### 3.3 Pita layar
| Pita (y di bingkai referensi) | Isi | Tajam? |
|---|---|---|
| 0 sampai 54 | Pita DoF atas: dekorasi belakang tinggi, lentera belakang (bokeh), landmark, HUD atas | Blur |
| 54 sampai 100 | Ruang kepala: tempat kepala aktor di batas belakang, latar belakang bernilai seperti lantai | Tajam |
| 100 sampai 300 | Area main (z dari -10 sampai +10) | Tajam |
| 300 sampai 324 | Bibir depan: bayangan aktor, tepi panggung | Tajam |
| 324 sampai 360 | Pita DoF bawah: dekorasi depan rendah, HUD bawah | Blur |
| Kolom x 0 sampai 64 dan 576 sampai 640 | Kolom samping: bibir arena lalu dekorasi samping | Tajam (tidak kena DoF) |

- 54 px = 15% dari 360 dan 36 px = 10% dari 360, sesuai style guide 1.7. [Saran untuk LP dan AD] Pita DoF didefinisikan dalam piksel bingkai referensi, bukan persen layar, agar tetap benar saat bingkai terpotong atau diperluas.
- Ruang kepala 46 px cukup untuk Warden tertinggi (36 px) berdiri di batas belakang dengan sisa 10 px sebelum pita blur.
- [Saran untuk UI] Zona HUD aman: pita atas (y di bawah 50), pita bawah (y di atas 326), dan sudut kolom samping. HUD di sana tidak pernah menutupi area main.

---

## 4. Arena

### 4.1 Bentuk dan ukuran [Wajib]
- Persegi panjang 32 x 20 unit (x dari -16 sampai 16, z dari -10 sampai 10) dengan **keempat sudut dipotong 3 unit** pada 45 derajat.
- Poligon batas (searah jarum jam dari kiri belakang): `(-13,-10) (13,-10) (16,-7) (16,7) (13,10) (-13,10) (-16,7) (-16,-7)`.
- Luas 622 unit persegi. Diagonal terpanjang sekitar 35 unit. Di layar: 512 x 200 px, dari x 64 sampai 576 dan y 100 sampai 300.
- Alasan sudut terpotong: (1) mengurangi jebakan sudut 90 derajat tempat pemain terkepung tanpa jalan keluar, (2) gema bentuk pecahan kaca dan sudut terpotong panel UI, (3) siluet arena langsung terbaca sebagai "panggung", bukan lantai kotak biasa.
- Rasio 1.6:1 di dunia (2.56:1 di layar) memberi ruang memutar horizontal yang lebar, sesuai layar 16:9 yang sebagian tingginya dipakai pita DoF.

### 4.2 Batas: perilaku [Wajib]
- Pemain dan semua Unlit dijepit di dalam poligon batas (tabrakan padat, tanpa damage). Knockback juga dijepit.
- Tidak ada aktor yang masuk atau keluar lewat batas. Unlit muncul di dalam batas (bagian 5.2).
- Glint tidak pernah jatuh di luar batas: posisi jatuh dijepit minimal 0.5 unit di dalam batas. Glint yang jatuh di atas tapak rintangan digeser ke titik bebas terdekat.
- [Saran untuk GP] Proyektil hilang saat keluar dari batas yang diperlebar 3 unit (masih di area yang terlihat).

### 4.3 Batas: visual [Wajib]
- **Bibir (lip):** pita 1 unit di luar batas dengan nilai lantai yang sama (antara `floor-mid` dan `floor-lit`). Tidak ada dekorasi di bibir. Ini memastikan bagian sprite aktor yang menjorok melewati batas tetap punya latar bernilai lantai.
- **Garis tepi (rim):** tepian kaca rendah tepat di garis batas, tinggi 0.25 unit (3 px layar), tebal tampak minimal 2 px, warna `dust` atau `bone` dengan opasitas sekitar 50%, kontras terhadap lantai dalam minimal 1.5:1. Digambar di lapis lantai (di bawah semua aktor).
- **Di luar bibir:** lantai turun ke `shadow` lalu memudar ke `night` (kabut tepi), mulai 3 unit dan penuh 10 unit di luar batas [Saran untuk AD].
- Lantai area main: polos atau pola sangat halus, saturasi tekstur dasar di bawah 15%, nilai antara `floor-mid` dan `floor-lit` (style guide 1.9).

---

## 5. Zona aman dan zona spawn

### 5.1 Zona aman [Wajib]
| Zona | Bentuk | Aturan |
|---|---|---|
| Lingkar awal | Lingkaran pusat `[0, 0]`, radius 6 | Tanpa rintangan, tanpa titik spawn. Pemain mulai di `[0, 0]` |
| Radius pemain | Lingkaran radius 4 mengikuti pemain | Titik spawn tidak boleh dipilih di dalamnya (diperiksa saat telegraf dimulai) |
| Panggung boss | Lingkaran pusat `[0, -3]`, radius 4 | Tanpa rintangan (bagian 9) |
| Bibir dan pita spawn | Lihat 4.3 dan 5.2 | Tanpa rintangan |

- [Saran untuk GD] Pemain ditempatkan kembali di titik awal pada awal setiap Pulse: `[0, 0]` untuk Pulse biasa, `[0, 5]` untuk Pulse boss. Alasan: fase toko memutus posisi, dan awal Pulse yang sama membuat gelombang cahaya pembuka dari tengah (style guide 1.6) selalu berpusat dekat pemain.
- Radius pemain 4 unit adalah aturan ruang LD. GD boleh mengubahnya demi balance dengan alasan tertulis; batas bawah keterbacaan 3 unit.

### 5.2 Zona spawn [Wajib]
- Spawn utama dari **pita tepi**: 1.0 sampai 2.5 unit ke dalam dari batas, mengelilingi arena.
- Pita dibagi **8 sektor** agar GD bisa mengatur arah datang (kiri-kanan, jepit, mengepung):

| Sektor | Bentuk | Koordinat |
|---|---|---|
| `n` | rect | x -12 sampai 12, z -9 sampai -7.5 |
| `s` | rect | x -12 sampai 12, z 7.5 sampai 9 |
| `e` | rect | x 13.5 sampai 15, z -6 sampai 6 |
| `w` | rect | x -15 sampai -13.5, z -6 sampai 6 |
| `ne` | polygon | (12.5,-9) (15,-6.5) (13.5,-6) (12,-7.5) |
| `se` | polygon | (12.5,9) (12,7.5) (13.5,6) (15,6.5) |
| `sw` | polygon | (-12.5,9) (-15,6.5) (-13.5,6) (-12,7.5) |
| `nw` | polygon | (-12.5,-9) (-12,-7.5) (-13.5,-6) (-15,-6.5) |

- Jarak terdekat pita spawn ke titik awal: 7.5 unit (sektor `n` dan `s`).
- Pemilihan titik: GP mengambil titik acak (RNG simulasi ber-seed) di sektor yang diminta GD. Titik ditolak bila di dalam radius pemain, atau bila lingkaran telegrafnya tidak muat utuh di dalam batas. Bila semua percobaan di sektor itu gagal (misalnya 8 percobaan), pindah ke sektor terjauh dari pemain.
- Jumlah, jenis, dan waktu spawn milik GD. LD hanya menyediakan ruang.
- **Spawn interior** (di luar pita) hanya untuk Unlit yang dipanggil Warden, boss, atau jenis pemanggil. Tetap wajib telegraf dan tetap mematuhi radius pemain, dengan batas bawah 2 unit [Saran untuk GD].

### 5.3 Telegraf spawn [Wajib secara ruang, durasi milik GD]
- Lore: Unlit merembes lewat retakan. Telegraf adalah **retakan di lantai** yang tumbuh dan bercahaya sebelum Unlit keluar.
- Diameter lingkaran telegraf: Unlit kecil 1.0 unit, sedang 1.5, besar 2.0, Warden 3.0. Boss memakai panggung boss.
- Warna dan bentuk mengikuti kode bahaya (style guide 1.3 dan 1.8): tepi solid `danger-violet` atau `danger-red`, isian tumbuh dari tengah, digambar di lapis bahaya (di atas efek pemain, P2-f).
- Seluruh lingkaran telegraf harus berada di dalam batas, di area tajam, dan tidak di bawah zona HUD. Ini terjamin bila titik dipilih di pita spawn dengan aturan 5.2.
- [Saran untuk GD] Durasi telegraf spawn minimal 0.8 detik. Unlit yang baru keluar tidak memberi damage sentuh selama sekitar 0.3 detik, agar spawn tepat di sebelah pemain tidak terasa curang.

---

## 6. Rintangan

Tujuan: sedikit variasi jalur tanpa mengorbankan keterbacaan. Arena tetap terasa lapang.

### 6.1 Aturan [Wajib]
| No | Aturan | Angka |
|---|---|---|
| R1 | Jumlah per arena | 0 sampai 4. Prototipe M1: 0 |
| R2 | Tinggi dunia | Maksimal 0.4 unit (sekitar 5 px layar, setengah tinggi Unlit terkecil) |
| R3 | Tapak | Persegi panjang sejajar sumbu (sisi pendek minimal 1 unit, sisi panjang maksimal 3 unit) atau lingkaran (diameter 1 sampai 3 unit) |
| R4 | Cakupan total | Maksimal 5% luas arena (31 unit persegi) |
| R5 | Jarak antar tepi rintangan | Minimal 4 unit |
| R6 | Jarak tepi rintangan ke batas | Minimal 4 unit (tidak ada celah sempit di dekat dinding) |
| R7 | Lokasi terlarang | Lingkar awal, panggung boss, pita spawn, bibir |
| R8 | Urutan gambar | Rintangan digambar di lapis lantai, **selalu di bawah semua aktor, Glint, proyektil, dan telegraf**. Nol piksel aktor tertutup rintangan |
| R9 | Fungsi | Menghalangi gerak pemain dan Unlit. **Tidak** menghalangi proyektil [Asumsi, keputusan akhir GD] |
| R10 | Warna | Nilai dekat lantai, tepi atas disorot `dust` agar tapak terbaca. Saturasi di bawah 20%. Tidak memakai hue pemain atau bahaya |
| R11 | Simetri | Tidak wajib simetris, tapi setiap sisi kiri dan kanan arena punya jalur lebar minimal 4 unit dari utara ke selatan |

Alasan R9: proyektil yang tiba-tiba berhenti di benda rendah sulit dibaca dan menambah kasus kematian yang tidak bisa dijelaskan. Rintangan berfungsi sebagai pembelok arus kerumunan, bukan pelindung.

[Saran untuk GP] Unlit menghindari rintangan dengan steering sederhana (dorongan menjauh dari tapak lingkaran atau kotak). Dengan jarak minimal 4 unit, tidak ada kantong yang menjebak kerumunan.

---

## 7. Dekorasi

### 7.1 Zona dekorasi dan batas tinggi [Wajib]
Dekorasi **hanya di luar batas dan di luar bibir** (lebih dari 1 unit dari batas). Tidak ada dekorasi di dalam arena.

| Zona | Lokasi seluruh tapak | Tinggi dunia maksimal | Alasan |
|---|---|---|---|
| Belakang | z kurang dari atau sama dengan -11 | Bebas (boleh keluar layar atas) | Selalu di belakang aktor, jatuh di pita DoF atas. Tempat landmark dan bokeh lentera |
| Samping belakang | \|x\| minimal 17, z di bawah 2 | 6 unit (75 px) | Membingkai panggung, tidak tumpang tindih kolom arena |
| Samping depan | \|x\| minimal 17, z minimal 2 | 2 unit (25 px) | Style guide 1.9: dekorasi tinggi tidak di sisi bawah layar |
| Depan | z minimal 11 | 0.5 unit (6 px) | Puncaknya tetap di bawah y 303, tidak menyentuh aktor di batas depan |

- Siluet dekorasi samping (termasuk bagian yang menjorok) tidak boleh masuk ke \|x\| di bawah 17, yaitu tetap 16 px dari garis batas di layar.
- **Pita latar belakang** (layar y 54 sampai 100, x 64 sampai 576): bagian dekorasi belakang yang tampak di sini wajib bernilai seperti lantai, luminans relatif antara 0.078 dan 0.142 (rentang `floor-mid` sampai `floor-lit` plus minus 10%). Alasan: kepala aktor di batas belakang menumpuk di atas pita ini. Terlalu gelap membuat Unlit hilang, terlalu terang membuat sorotan pemain hilang.
- Tidak ada sumber cahaya atau benda emisif yang posisi layarnya jatuh di pita latar belakang atau di area main. Lentera belakang digantung cukup tinggi sehingga tampil di pita DoF atas (y di bawah 54) sebagai bokeh.

### 7.2 Warna dan bentuk [Wajib]
- Low-poly dengan tekstur piksel dari palet. Kerapatan texel sama dengan sprite (16 texel per unit). **Dekorasi tidak diskalakan**; variasi ukuran lewat varian mesh, agar skala piksel tetap satu (P3-b).
- Palet tekstur lingkungan: saturasi HSV maksimal 40% untuk warna di rentang hue biru-cyan (170 sampai 250 derajat) dan merah-magenta-ungu (270 sampai 360 dan 0 sampai 10 derajat). Ini menjaga hue pemain dan bahaya tetap milik aktor.
- Emisif lingkungan (lentera, bara, lilin): hue 20 sampai 38 derajat (amber), saturasi maksimal 60%. Emas jenuh (hue 40 sampai 55) hanya untuk Glint dan hadiah.
- Saturasi dan kontras dekorasi tidak boleh melebihi aktor (P3 kriteria tolak).

### 7.3 Elemen bergerak dan partikel [Wajib]
- Minimal 3 jenis elemen bergerak per bioma (P3-d), semuanya di zona dekorasi.
- Partikel ambien yang melayang di atas area main (debu kaca): maksimal 40 sekaligus, ukuran 1 px sprite, opasitas maksimal 25%, warna hanya `bone` atau `dust`. **Tidak pernah emas** agar tidak dikira Glint, tidak pernah cyan atau merah.
- Partikel lain (bara, kertas, kabut, salju kaca) hanya di zona dekorasi.

### 7.4 Anggaran [Asumsi, angka final LP]
- Objek dekorasi maksimal 80 per arena (instancing dianjurkan), elemen beranimasi maksimal 12, titik cahaya dinamis maksimal 8.
- Dekorasi untuk ultrawide (sampai \|x\| = 28) dihitung dalam anggaran yang sama; LOD rendah boleh untuk objek di \|x\| di atas 20.

---

## 8. Cahaya

- Per bioma: 1 cahaya kunci terarah plus 1 cahaya isi berwarna kontras (style guide 1.6). [Wajib]
- Elevasi cahaya kunci 35 sampai 70 derajat, agar lantai area main terang merata dan bayangan dekorasi tidak jatuh panjang menutupi arena. [Wajib]
- Titik cahaya (lentera dan sejenisnya) ditempatkan di zona dekorasi: belakang (posisi layar di pita atas), samping (kolom samping), atau depan rendah (pita bawah). Tidak ada titik cahaya di dalam batas. [Wajib]
- **Kerataan lantai** [Wajib]: setelah semua cahaya dan grading, rasio luminans blok lantai paling terang terhadap paling gelap di dalam batas maksimal 1.6:1 (rasio bawaan `floor-lit` terhadap `floor-mid` adalah 1.31:1). Saturasi hasil render lantai maksimal 25%. Uji kontras P2-c dijalankan pada blok terang dan blok gelap.
- **Titik asal Pulse:** gelombang cahaya pembuka Pulse berasal dari `[0, 0]` (data `pulseOrigin`). Efek ini milik AD dan GP.
- Warna dan intensitas akhir milik AD. Nilai di bagian 12 dan contoh JSON adalah titik awal.

---

## 9. Panggung boss

- **Lokasi:** lingkaran pusat `[0, -3]`, radius 4, di tengah belakang arena. Di layar: tepat di bawah landmark bioma (gerbang, menara, rumah peras), sehingga boss muncul dari "jantung" diorama.
- **Di Pulse biasa:** hanya lantai, tanpa rintangan. Boleh punya cincin pola lantai yang sangat halus (kontras terhadap lantai maksimal 1.15:1) agar pemain yang jeli mengenalinya, tanpa mengganggu keterbacaan.
- **Masuknya boss:** retakan besar di panggung (telegraf radius 4, durasi milik GD), cincin `danger-violet` menyala, lalu boss keluar. Pemain mulai di `[0, 5]`, 8 unit dari pusat panggung.
- **Batas gerak boss:** boss boleh bergerak ke seluruh arena, tapi kaki boss dijepit pada `z >= (H - 140) / 10`, dengan H = tinggi sprite boss dalam px. Contoh: H 96 px berarti z minimal -4.4; H 64 px berarti z minimal -7.6. Alasan: kepala boss tidak boleh masuk pita DoF atas (sisa minimal 6 px).
- **Pemain tertutup aktor besar:** bila sprite boss atau Warden menutupi pemain, pemain digambar ulang sebagai siluet tembus `kept-cyan` (outline atau isian 50%) di atas aktor besar itu. Pemain tidak pernah hilang dari layar (Pilar 2). [Wajib, implementasi milik LP dan AD]
- Tidak ada arena boss terpisah dan tidak ada transisi kamera. Ini menjaga scope dan konsistensi ukuran.

---

## 10. Ringkasan urutan gambar (untuk LP dan AD)

Dari bawah ke atas, aturan yang menyangkut level:
1. Lantai luar, bibir, lantai area main, cincin panggung boss.
2. Garis tepi (rim) dan rintangan (selalu di bawah aktor).
3. Cincin penanda pemain dan bayangan elips aktor.
4. Dekorasi belakang dan samping (dalam praktik selalu di belakang aktor karena posisinya).
5. Aktor, Glint (urut kedalaman).
6. Efek pemain.
7. Telegraf dan proyektil musuh (P2-f).
8. Siluet tembus pemain bila tertutup aktor besar.
9. Dekorasi depan rendah (tidak pernah tumpang tindih dengan aktor karena aturan 7.1).
10. Post-processing (DoF pita, bloom, vignette, kilau kaca), lalu HUD.

---

## 11. Aturan keterbacaan yang bisa diuji

| ID | Uji | Cara verifikasi | Lolos bila | Pelaksana, mulai |
|---|---|---|---|---|
| LD-T01 | Validator data arena | Skrip membaca `content/levels/*.json` dan memeriksa semua angka [Wajib] di bagian 4 sampai 9 (R1 sampai R7, zona dekorasi dan tinggi, jumlah titik cahaya, sektor spawn di dalam pita, zona aman bebas rintangan, tanpa skala dekorasi) | Nol pelanggaran | LP atau QA (skrip), M1 |
| LD-T02 | Arena utuh di layar | Screenshot Playwright di 1280x720, 1366x768, 1920x950, 1920x1080, 2560x1440 | Seluruh poligon batas plus bibir terlihat; skala integer sesuai tabel 3.2 | QA, M1 |
| LD-T03 | Area main tajam | Screenshot DoF ON dan OFF, bandingkan piksel di kotak x 64 sampai 576, y 54 sampai 324 | Nol piksel berbeda (melengkapi P3-c) | AD dan LP, M2 |
| LD-T04 | Dekorasi dan rintangan tidak menutupi aktor | Tempatkan aktor uji tertinggi tiap kelas ukuran pada grid 1 unit di seluruh arena termasuk tepat di batas; render mask aktor dengan dan tanpa dekorasi plus rintangan | Nol piksel aktor tertutup | QA dengan LP, M2 (versi geometri lewat LD-T01 di M1) |
| LD-T05 | Lantai rata | Bagi area main menjadi blok 8x8 px pada screenshot final | Rasio luminans blok terang ke gelap maksimal 1.6:1; saturasi HSV tiap blok maksimal 25% | AD, M2 |
| LD-T06 | Pita latar belakang | Ukur luminans relatif tiap blok 8x8 di y 54 sampai 100, x 64 sampai 576 | Semua blok antara 0.078 dan 0.142 | AD, M2 |
| LD-T07 | Batas terlihat | Screenshot grayscale ramai; penguji menelusuri batas dengan jari | Garis tepi tampak utuh minimal 2 px, kontras ke lantai dalam minimal 1.5:1, penguji menelusuri seluruh batas dalam 5 detik | QA, M1 |
| LD-T08 | Spawn adil | Simulasi ber-seed 1000 spawn dengan pemain bergerak acak | Jarak titik spawn ke pemain saat telegraf dimulai minimal 4 unit (2 untuk spawn interior); 100% lingkaran telegraf di dalam batas | GP dan QA, M1 |
| LD-T09 | Partikel ambien bukan Glint | Audit data partikel dan screenshot | Maksimal 40 partikel di atas area main, 1 px, opasitas maksimal 25%, nol piksel partikel ber-hue emas, cyan, atau merah | AD, M2 |
| LD-T10 | Tidak ada cahaya di area main | Proyeksikan posisi semua titik cahaya ke layar dengan rumus 2.3 | Tidak ada yang jatuh di x 64 sampai 576, y 54 sampai 303 | LP (di validator), M1 |
| LD-T11 | Palet lingkungan | Audit palet tekstur dekorasi dan lantai | Sesuai 7.2 (saturasi biru-cyan dan merah-ungu maksimal 40%, emisif amber 20 sampai 38 derajat maksimal 60%) | AD, M2 |
| LD-T12 | Pemain tidak pernah hilang | Screenshot dengan pemain di belakang boss dan Warden | Siluet tembus pemain terlihat, penguji menunjuk pemain dalam 1 detik | QA dan CD, M2 |
| LD-T13 | Elemen diorama | Checklist per bioma | Minimal 3 elemen bergerak, landmark di atas panggung boss, bokeh lentera atau ekuivalen di pita atas | CD, M2 |

---

## 12. Tiga bioma

Nama di bawah adalah nama kerja deskriptif. Nama final dari Writer (diselaraskan CD). Identifier data memakai id Inggris.

### 12.1 Urutan dan alasan
| Urutan | Nama kerja | id | Busur rasa |
|---|---|---|---|
| 1 | Pasar Malam Berlentera | `night-market` | Hangat, ramah, mudah dibaca. Mengajarkan aturan |
| 2 | Biara Tebing | `cliff-monastery` | Dingin, sunyi, terbuka. Tekanan naik |
| 3 | Kebun Anggur Hangus | `burnt-vineyard` | Panas tertahan, duka, klimaks |

- Ketiganya memakai geometri arena yang sama (bagian 4). Yang berbeda: cahaya, dekorasi tepi, landmark, jenis dan posisi rintangan, partikel. Ini sesuai keputusan scope Producer: bioma tambahan memakai ulang Unlit dengan palet cahaya berbeda.
- Bioma 1 adalah Tingkat A dan harus paling dipoles. Bioma 2 dan 3 adalah Tingkat C.

### 12.2 Bioma 1: Pasar Malam Berlentera (`night-market`)
- **Tema:** pasar malam yang membeku pada detik langit jatuh. Lentera kertas tergantung miring di tengah ayunan, kain tenda tertahan angin yang tidak pernah selesai bertiup.
- **Suasana:** hangat dan meriah yang mendadak sunyi. Cahaya kecil yang masih dijaga.
- **Cahaya** [Saran untuk AD]: kunci amber redup `#E0A458` dari kiri belakang atas (elevasi sekitar 50 derajat). Isi biru bulan redup `#6F86B8` dari kanan depan. Lentera `#E6AE6A` (hue 33, saturasi 54%). 7 titik cahaya: gerbang, 2 lentera belakang, 2 lentera samping, 2 lentera tanah depan.
- **Landmark (atas panggung boss):** Gerbang Lentera, gerbang kayu dengan satu lentera besar retak di puncaknya.
- **Dekorasi tepi:**
  - Belakang: deretan kios dengan atap kain, tiang lentera, tali lentera kertas, tumpukan peti.
  - Samping: kios samping, tiang lentera, gulungan kain; di samping depan hanya tong dan karung rendah.
  - Depan: lentera tanah, kertas berserakan, serpih kaca di tanah.
- **Rintangan (3):** meja kios rebah (rect 3 x 1.5), sumur bertutup (lingkaran r 1), tumpukan karung rendah (rect 2 x 1.5). Total 1.7% luas.
- **Elemen bergerak:** lentera berkedip, kain tenda bergoyang pelan, kertas melayang beku berputar lambat (di depan), debu kaca di atas arena.
- **Lantai:** batu ubin aus, nada `floor-mid` sampai `floor-lit`, nat sangat halus.
- Cocok dengan Unlit: lentera yang menyerap terang.

### 12.3 Bioma 2: Biara Tebing (`cliff-monastery`)
- **Tema:** pelataran biara di bibir tebing, membeku saat lonceng sedang berdentang. Sisi depan arena adalah jurang berkabut.
- **Suasana:** dingin, khidmat, berangin, kesepian.
- **Cahaya** [Saran untuk AD]: kunci bulan pucat `#AEB8C8` (saturasi 13%) dari kanan belakang atas. Isi lilin hangat `#B98A62` dari kiri. Kabut `#2A2E3A`. Saturasi cahaya isi dijaga di bawah 50% agar lantai tidak bergeser ke biru (warna pemain).
- **Landmark:** menara lonceng dengan lonceng yang retak, tepat di atas panggung boss.
- **Dekorasi tepi:**
  - Belakang: dinding biara, gapura, lentera batu, bendera doa berwarna kusam (krem, abu, oker; bukan biru jenuh atau merah).
  - Samping: pilar patah, patung tanpa wajah, lentera batu.
  - Depan: pagar batu rendah (tinggi 0.4) lalu jurang dan kabut. Zona depan memang harus rendah, dan jurang mengisinya secara alami.
- **Rintangan (2 sampai 3):** alas pilar patah (lingkaran r 1), bangku batu rendah (rect 3 x 1).
- **Elemen bergerak:** kabut naik dari jurang, bendera doa berkibar, nyala lilin, serpih kaca turun seperti salju (hanya di zona dekorasi; di atas arena tetap aturan debu kaca 7.3).
- **Lantai:** lempeng batu dingin, nada abu sedikit hangat agar tidak biru.

### 12.4 Bioma 3: Kebun Anggur Hangus (`burnt-vineyard`)
- **Tema:** kebun anggur yang setengah terbakar saat langit jatuh. Separuh sulur masih hijau kusam, separuh hangus. Bara beku melayang di udara.
- **Suasana:** panas yang tertahan, duka, akhir yang membara.
- **Cahaya** [Saran untuk AD]: kunci bara `#C98D55` (hue 29, saturasi 58%) dari kanan belakang, elevasi minimal 35 derajat. Isi abu kehijauan senja `#7C8A80`. Kabut asap `#2B2422`.
- **Landmark:** rumah peras anggur yang hangus dengan kincir patah.
- **Dekorasi tepi:**
  - Belakang: rumah peras, tiang asap, barisan tong.
  - Samping: barisan teralis sulur (makin rendah ke depan), gerobak terbakar.
  - Depan: tunggul sulur rendah, abu, serpih kaca.
- **Rintangan (3 sampai 4):** tong rebah (rect 2 x 1), tunggul besar (lingkaran r 1), potongan tembok batu rendah (rect 3 x 1).
- **Elemen bergerak:** kolom asap, bara beku melayang (amber, di zona dekorasi saja), daun bergoyang, debu kaca di atas arena.
- **Aturan khusus:** api dan bara memakai amber dan oranye redup, **tidak pernah merah** (merah milik bahaya). Tidak ada nyala api di dalam batas.
- **Lantai:** tanah padat dan abu, saturasi sangat rendah.

### 12.5 Transisi antarbioma (M3)
Kilatan kaca putih, layar memudar ke `night`, lalu bioma berikutnya muncul dari tengah dengan gelombang cahaya Pulse pertama. Detail di M3 bersama AD.

---

## 13. Diagram ASCII

### 13.1 Denah dari atas (dunia), bioma 1
Satu kolom = 0.5 unit, satu baris = 1 unit (kira-kira proporsional karena huruf lebih tinggi dari lebarnya). Utara (belakang, atas layar) di atas. Angka kiri = z, angka atas = x.

```
     -20     -16     -12     -8      -4      0       4       8       12      16      20
     |       |       |       |       |       |       |       |       |       |       |
 -13 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
 -12 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
 -11 DDDDDDDDDDDDDD_____________________________________________________DDDDDDDDDDDDDD
 -10 ddddddd     __#####################################################__     ddddddd
  -9 ddddddd   __#...~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...#__   ddddddd
  -8 ddddddd __#..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...#__ ddddddd
  -7 dddddd__#..~~~~.........................b........................~~~~...#__dddddd
  -6 dddddd__#.~~~~.....................bb...:...bb.....................~~~~.#__dddddd
  -5 dddddd__#.~~~~.......OOOOOOO......:...........:....................~~~~.#__dddddd
  -4 dddddd__#.~~~~..................:b.............b:..................~~~~.#__dddddd
  -3 dddddd__#.~~~~................:.b.......B.......b.:................~~~~.#__dddddd
  -2 dddddd__#.~~~~...............:...b.............b...:...............~~~~.#__dddddd
  -1 dddddd__#.~~~~....................b...........b....................~~~~.#__dddddd
   0 dddddd__#.~~~~..............:......bb...P...bb......:..............~~~~.#__dddddd
   1 dddddd__#.~~~~..........................b..........................~~~~.#__dddddd
   2 cccccc__#.~~~~...............:.....................:...............~~~~.#__cccccc
   3 cccccc__#.~~~~................:...................:.......O........~~~~.#__cccccc
   4 cccccc__#.~~~~..................:...............:.......OOOOO......~~~~.#__cccccc
   5 cccccc__#.~~~~............OOOOO...:.....p.....:...........O........~~~~.#__cccccc
   6 cccccc__#.~~~~..........................:..........................~~~~.#__cccccc
   7 cccccc__#..~~~~..................................................~~~~...#__cccccc
   8 ccccccc __#..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...#__ ccccccc
   9 ccccccc   __#...~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...#__   ccccccc
  10 ccccccc     __#####################################################__     ccccccc
  11 cccccccfffffff_____________________________________________________fffffffccccccc
  12 cccccccfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffccccccc
  13 cccccccfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffccccccc
```

Legenda: `#` batas dan garis tepi. `.` lantai area main. `~` pita spawn (8 sektor). `:` tepi lingkar awal (r 6). `b` tepi panggung boss (r 4). `P` titik awal Pulse biasa. `p` titik awal Pulse boss. `B` pusat panggung boss. `O` rintangan. `_` bibir (1 unit, tanpa dekorasi). `D` dekorasi belakang (tinggi bebas). `d` dekorasi samping belakang (maks 6 unit). `c` dekorasi samping depan (maks 2 unit). `f` dekorasi depan (maks 0.5 unit). Spasi di luar = lantai luar memudar ke `night`.

### 13.2 Komposisi layar (bingkai referensi 640 x 360 px sprite)

```
  y
  0 +--------------------------------------------------------------+
    | PITA DoF ATAS (blur): lentera belakang = bokeh, landmark,    |
    | atap kios, HUD atas                                          |
 54 +------+------------------------------------------------+------+
    |      | ruang kepala 46 px: latar bernilai lantai      |      |
100 | kolom| ##### batas belakang (z = -10) ################ |kolom |
    | sam- |             b  panggung boss  b                 | sam- |
    | ping |                                                 | ping |
    | 64 px|      AREA MAIN 512 x 200 px (32 x 20 unit)      | 64 px|
    | deko-|                  P  titik awal                  | deko-|
    | rasi |                                                 | rasi |
300 |      | ##### batas depan (z = +10) ################### |      |
    |      | bibir depan 24 px: bayangan aktor               |      |
324 +------+------------------------------------------------+------+
    | PITA DoF BAWAH (blur): lentera tanah, kertas, HUD bawah      |
360 +--------------------------------------------------------------+
    x 0   64                                              576   640
```

---

## 14. Usulan format JSON data arena

Lokasi: `content/levels/<id>.json`, satu file per arena. LP boleh menyesuaikan nama field dan struktur; yang harus dipertahankan adalah isinya (satuan unit dunia, bentuk zona, batas, cahaya, dekorasi, rintangan) agar validator LD-T01 bisa berjalan.

### 14.1 Konvensi
- Semua jarak dalam unit dunia. Posisi lantai `[x, z]`, posisi 3D `[x, y, z]`.
- Warna hex string `"#RRGGBB"`.
- Bentuk (`shape`) seragam untuk zona, rintangan, dan zona aman:
  - `{ "type": "rect", "min": [x, z], "max": [x, z] }`
  - `{ "type": "circle", "center": [x, z], "radius": r }`
  - `{ "type": "polygon", "points": [[x, z], ...] }` (cembung, urutan titik bebas)
- Teks yang tampil di game hanya lewat kunci string table Writer (`nameKey`).
- Tidak ada angka balance (jumlah spawn, durasi telegraf, kepadatan) di file arena. Itu di data GD.

### 14.2 Field
| Field | Tipe | Isi |
|---|---|---|
| `schemaVersion` | int | Versi format, mulai 1 |
| `id` | string | id bioma, kebab-case |
| `nameKey` | string | Kunci string table untuk nama Vitrine |
| `order` | int | Urutan bioma dalam run |
| `units.pixelsPerUnit` | int | 16 |
| `camera` | object | `pitchDeg`, `target`, `referenceFramePx`, `requiredBoxPx` [x0, y0, x1, y1] |
| `arena.boundary` | array `[x, z]` | Poligon batas |
| `arena.lip` | number | Lebar bibir (1) |
| `arena.rim` | object | `height`, `color`, `opacity` |
| `arena.projectileMargin` | number | Perlebaran batas untuk menghapus proyektil |
| `arena.floor` | object | `baseColor`, `altColor` (token atau hex), `pattern` |
| `playerStart` | object | `default`, `boss` sebagai `[x, z]` |
| `pulseOrigin` | `[x, z]` | Asal gelombang cahaya Pulse |
| `safeZones` | array | `id`, `shape`, `blocks` (daftar: `obstacle`, `spawn`, `decor`) |
| `spawn.playerSafeRadius` | number | 4 |
| `spawn.interiorMinPlayerDist` | number | 2 |
| `spawn.zones` | array | `id`, `shape` (8 sektor) |
| `bossStage` | object | `shape`, `landmarkId`, `floorRingContrastMax` |
| `lighting.key`, `lighting.fill` | object | `color`, `intensity`, `direction` [x, y, z] (arah datangnya sinar, dari cahaya ke lantai) |
| `lighting.edgeFade` | object | `color`, `startOutside`, `endOutside` (unit dari batas) |
| `lighting.points` | array | `id`, `pos` [x, y, z], `color`, `intensity`, `range`, `flicker` (amplitudo 0 sampai 1) |
| `obstacles` | array | `id`, `kind`, `shape`, `height`, `blocks` (`move`; `projectile` hanya bila GD memutuskan) |
| `decor` | array | `id`, `kind` (varian mesh dari AD), `zone` (`back`, `side`, `front`), `pos` [x, z], `rotYDeg`, `height`, `footprintHalf` [hx, hz], `anim` (opsional), `lightId` (opsional) |
| `ambient.particles` | array | `kind`, `area` (`arena` atau `decor`), `max`, `color`, `opacity`, `sizePx` |

`height` dan `footprintHalf` pada dekorasi adalah nilai deklarasi untuk validator. AD memastikan mesh tidak melebihinya. Tidak ada field skala.

### 14.3 Contoh: `content/levels/night-market.json` (dekorasi diringkas)

```json
{
  "schemaVersion": 1,
  "id": "night-market",
  "nameKey": "biome.night_market.name",
  "order": 1,
  "units": { "pixelsPerUnit": 16 },
  "camera": {
    "pitchDeg": 38.68,
    "target": [0, 0, -2],
    "referenceFramePx": [640, 360],
    "requiredBoxPx": [16, 32, 624, 328]
  },
  "arena": {
    "boundary": [[-13, -10], [13, -10], [16, -7], [16, 7], [13, 10], [-13, 10], [-16, 7], [-16, -7]],
    "lip": 1,
    "rim": { "height": 0.25, "color": "#A39A8C", "opacity": 0.5 },
    "projectileMargin": 3,
    "floor": { "baseColor": "#57515A", "altColor": "#6B6360", "pattern": "worn-flagstone" }
  },
  "playerStart": { "default": [0, 0], "boss": [0, 5] },
  "pulseOrigin": [0, 0],
  "safeZones": [
    { "id": "start", "shape": { "type": "circle", "center": [0, 0], "radius": 6 }, "blocks": ["obstacle", "spawn", "decor"] },
    { "id": "boss-stage", "shape": { "type": "circle", "center": [0, -3], "radius": 4 }, "blocks": ["obstacle", "decor"] }
  ],
  "spawn": {
    "playerSafeRadius": 4,
    "interiorMinPlayerDist": 2,
    "zones": [
      { "id": "n", "shape": { "type": "rect", "min": [-12, -9], "max": [12, -7.5] } },
      { "id": "s", "shape": { "type": "rect", "min": [-12, 7.5], "max": [12, 9] } },
      { "id": "e", "shape": { "type": "rect", "min": [13.5, -6], "max": [15, 6] } },
      { "id": "w", "shape": { "type": "rect", "min": [-15, -6], "max": [-13.5, 6] } },
      { "id": "ne", "shape": { "type": "polygon", "points": [[12.5, -9], [15, -6.5], [13.5, -6], [12, -7.5]] } },
      { "id": "se", "shape": { "type": "polygon", "points": [[12.5, 9], [12, 7.5], [13.5, 6], [15, 6.5]] } },
      { "id": "sw", "shape": { "type": "polygon", "points": [[-12.5, 9], [-15, 6.5], [-13.5, 6], [-12, 7.5]] } },
      { "id": "nw", "shape": { "type": "polygon", "points": [[-12.5, -9], [-12, -7.5], [-13.5, -6], [-15, -6.5]] } }
    ]
  },
  "bossStage": {
    "shape": { "type": "circle", "center": [0, -3], "radius": 4 },
    "landmarkId": "lantern-gate",
    "floorRingContrastMax": 1.15
  },
  "lighting": {
    "key": { "color": "#E0A458", "intensity": 1.0, "direction": [0.55, -1.0, 0.45] },
    "fill": { "color": "#6F86B8", "intensity": 0.35, "direction": [-0.6, -0.8, -0.6] },
    "edgeFade": { "color": "#1C1926", "startOutside": 3, "endOutside": 10 },
    "points": [
      { "id": "gate", "pos": [0, 3.5, -12.5], "color": "#E6AE6A", "intensity": 1.2, "range": 9, "flicker": 0.06 },
      { "id": "back-l", "pos": [-10, 2.5, -12], "color": "#E6AE6A", "intensity": 0.8, "range": 7, "flicker": 0.1 },
      { "id": "back-r", "pos": [10, 2.5, -12], "color": "#E6AE6A", "intensity": 0.8, "range": 7, "flicker": 0.1 },
      { "id": "side-l", "pos": [-18, 2.2, -2], "color": "#E6AE6A", "intensity": 0.7, "range": 7, "flicker": 0.1 },
      { "id": "side-r", "pos": [18, 2.2, -2], "color": "#E6AE6A", "intensity": 0.7, "range": 7, "flicker": 0.1 },
      { "id": "front-l", "pos": [-9, 0.4, 11.5], "color": "#E6AE6A", "intensity": 0.5, "range": 5, "flicker": 0.12 },
      { "id": "front-r", "pos": [9, 0.4, 11.5], "color": "#E6AE6A", "intensity": 0.5, "range": 5, "flicker": 0.12 }
    ]
  },
  "obstacles": [
    { "id": "stall-table-1", "kind": "tipped-stall-table", "shape": { "type": "rect", "min": [-9.5, -5.75], "max": [-6.5, -4.25] }, "height": 0.4, "blocks": ["move"] },
    { "id": "well-1", "kind": "covered-well", "shape": { "type": "circle", "center": [9, 4], "radius": 1 }, "height": 0.4, "blocks": ["move"] },
    { "id": "sacks-1", "kind": "sack-pile", "shape": { "type": "rect", "min": [-7, 4.25], "max": [-5, 5.75] }, "height": 0.35, "blocks": ["move"] }
  ],
  "decor": [
    { "id": "gate", "kind": "lantern-gate", "zone": "back", "pos": [0, -12.5], "rotYDeg": 0, "height": 5.5, "footprintHalf": [2.5, 0.5], "lightId": "gate" },
    { "id": "stall-b1", "kind": "stall-awning", "zone": "back", "pos": [-12, -12.5], "rotYDeg": 0, "height": 2.8, "footprintHalf": [2, 1], "anim": "cloth-sway" },
    { "id": "stall-b2", "kind": "stall-awning", "zone": "back", "pos": [-6, -12.2], "rotYDeg": 0, "height": 2.8, "footprintHalf": [2, 1], "anim": "cloth-sway" },
    { "id": "stall-b3", "kind": "stall-awning", "zone": "back", "pos": [6, -12.2], "rotYDeg": 0, "height": 2.8, "footprintHalf": [2, 1], "anim": "cloth-sway" },
    { "id": "stall-b4", "kind": "stall-awning", "zone": "back", "pos": [12, -12.5], "rotYDeg": 0, "height": 2.8, "footprintHalf": [2, 1], "anim": "cloth-sway" },
    { "id": "pole-bl", "kind": "lantern-pole", "zone": "back", "pos": [-10, -12], "rotYDeg": 0, "height": 3.0, "footprintHalf": [0.25, 0.25], "lightId": "back-l" },
    { "id": "pole-br", "kind": "lantern-pole", "zone": "back", "pos": [10, -12], "rotYDeg": 0, "height": 3.0, "footprintHalf": [0.25, 0.25], "lightId": "back-r" },
    { "id": "stall-sl", "kind": "side-stall", "zone": "side", "pos": [-19, -5], "rotYDeg": 90, "height": 3.0, "footprintHalf": [1.5, 1.5], "anim": "cloth-sway" },
    { "id": "stall-sr", "kind": "side-stall", "zone": "side", "pos": [19, -5], "rotYDeg": 270, "height": 3.0, "footprintHalf": [1.5, 1.5], "anim": "cloth-sway" },
    { "id": "pole-sl", "kind": "lantern-pole", "zone": "side", "pos": [-18, -2], "rotYDeg": 0, "height": 2.6, "footprintHalf": [0.25, 0.25], "lightId": "side-l" },
    { "id": "pole-sr", "kind": "lantern-pole", "zone": "side", "pos": [18, -2], "rotYDeg": 0, "height": 2.6, "footprintHalf": [0.25, 0.25], "lightId": "side-r" },
    { "id": "barrels-sl", "kind": "barrel-cluster", "zone": "side", "pos": [-18.5, 5], "rotYDeg": 0, "height": 1.2, "footprintHalf": [1, 1] },
    { "id": "lamp-fl", "kind": "ground-lantern", "zone": "front", "pos": [-9, 11.5], "rotYDeg": 0, "height": 0.4, "footprintHalf": [0.25, 0.25], "lightId": "front-l" },
    { "id": "lamp-fr", "kind": "ground-lantern", "zone": "front", "pos": [9, 11.5], "rotYDeg": 0, "height": 0.4, "footprintHalf": [0.25, 0.25], "lightId": "front-r" },
    { "id": "paper-f", "kind": "frozen-paper", "zone": "front", "pos": [-3, 12], "rotYDeg": 0, "height": 0.05, "footprintHalf": [2, 0.5], "anim": "paper-drift" }
  ],
  "ambient": {
    "particles": [
      { "kind": "glass-dust", "area": "arena", "max": 40, "color": "#EDE6D8", "opacity": 0.2, "sizePx": 1 }
    ]
  }
}
```

Angka di contoh sudah dicek terhadap aturan: ketiga rintangan berjarak minimal 4.25 unit dari batas dan minimal 6.56 unit dari titik awal (di luar lingkar awal r 6), di luar panggung boss, cakupan 10.6 unit persegi (1.7%). Lentera belakang tampil di y 49 dan 31 (pita atas), lentera samping di kolom samping, lentera depan di y 310 (pita bawah).

---

## 15. Arena prototipe M1

- id `proto-box`: geometri final (bagian 4), 8 sektor spawn, zona aman, **tanpa rintangan dan tanpa dekorasi**, lantai `floor-mid` polos dengan garis tepi, 1 cahaya kunci plus 1 cahaya isi. Tujuannya menyetel rasa main loop dan ukuran sebelum hiasan.
- Validator LD-T01 dan uji LD-T02, LD-T07, LD-T08, LD-T10 dijalankan di M1.
- Bila M1 menunjukkan arena terlalu sempit atau terlalu lapang, yang diubah adalah kecepatan dan kepadatan (GD), bukan ukuran arena, kecuali CD, GD, dan LD sepakat. Ukuran arena terkunci oleh bingkai layar dan pita DoF.

---

## 16. Asumsi dan serah terima

Asumsi yang perlu dikalibrasi atau dikonfirmasi:
- [Asumsi] Pitch 38.68 derajat diterima LP dan AD (alternatif 40 derajat aman, lihat 2.3).
- [Asumsi] Rintangan tidak menghalangi proyektil (GD memutuskan).
- [Asumsi] Pemain kembali ke titik awal tiap Pulse (GD memutuskan).
- [Asumsi] Anggaran 80 dekorasi, 12 animasi, 8 titik cahaya (LP memutuskan).
- [Asumsi] Skala integer dengan kotak wajib terlihat 608 x 296 px (LP dan UI memutuskan cara menangani ruang sisa).

Yang dibutuhkan dari peran lain:
- **GD:** durasi telegraf spawn, aturan sektor per Pulse, kecepatan pemain dan Unlit yang cocok dengan arena 32 x 20 unit, keputusan proyektil dan rintangan.
- **LP:** format JSON final, validator LD-T01, implementasi siluet tembus pemain, pita DoF dalam piksel bingkai referensi.
- **AD:** kalibrasi pitch, warna cahaya final, varian mesh dekorasi dan rintangan dengan tinggi sesuai deklarasi.
- **UI:** penempatan HUD di zona aman HUD (3.3).
- **Writer:** nama final tiga Vitrine dan landmark-nya.
