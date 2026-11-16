# Shardfall: Desain Arena

Pemilik: Level Designer (LD). Status: versi 2, 2026-11-17 (M1-07). Perbaikan review M0 (CD 2.9, LP bagian LD) sudah diterapkan; ringkasan di bagian 17.
Reviewer: CD (rasa dan pilar), GD (dampak gameplay), LP (bisa diimplementasi).
Dasar: `docs/vision.md`, `docs/pillars.md`, `docs/style-guide.md`, `docs/tech/architecture.md` v2.1 (satuan, kamera, format arena), keputusan di `docs/tasks.md`. Bila bertentangan dalam hal teknis, architecture.md yang berlaku; dalam hal rasa, pilar yang menang (urutan Pilar 2 > 4 > 1 > 3).

Penanda: **[Wajib]** aturan LD yang harus dipatuhi implementasi dan aset. **[Saran untuk X]** keputusan milik peran lain, ini hanya default. **[Asumsi]** perlu dikalibrasi di M1. **[Otomatis]** diperiksa oleh `tools/levels/check-arena.ts`.

Data arena: `content/levels/arena_proto.json` (M1) dan `content/levels/arena_market.json` (draf M2, bioma 1).

---

## 1. Ringkasan keputusan

| Hal | Keputusan |
|---|---|
| Satuan dunia | 1 u = 16 piksel sprite pada arah horizontal layar, 10 piksel pada kedalaman lantai (konstanta `PX_PER_U`, `DEPTH_PX_PER_U`) |
| Kamera | Ortografis, tetap, pitch asin(0.625) = 38.68 derajat, tidak mengikuti pemain. Final (keputusan LP 2026-11-17) |
| Bingkai referensi | 640 x 360 piksel sprite (= 1920 x 1080 pada skala 3x, 1280 x 720 pada 2x) |
| Arena | Persegi panjang bersudut terpotong, 32 x 20 u (512 x 200 px di layar), potongan sudut 3 u, luas 622 u persegi. Final |
| Muat layar | Seluruh arena selalu terlihat dan tajam dalam satu layar |
| Spawn | Pita 1.0 sampai 2.5 u di dalam batas, 8 sektor, selalu dengan telegraf retakan, tidak dalam radius 4 u dari pemain |
| Zona aman | Lingkar awal radius 6 di tengah, panggung boss radius 4, radius pemain 4 |
| Rintangan | Maksimal 4, tinggi maksimal 0.4 u (5 px), cakupan maksimal 5% luas, jarak antar rintangan dan ke batas minimal 4 u, selalu digambar di bawah aktor |
| Dekorasi | Hanya di luar batas dan bibir. Belakang bebas tinggi, samping maksimal 6 u, depan maksimal 0.5 u |
| Geometri antarbioma | Sama untuk semua bioma. Variasi lewat cahaya, dekorasi, dan jenis rintangan |
| Urutan bioma | 1 The Moth Market, 2 Vesper Steps, 3 Stillfire Vineyard (nama final, keputusan CD 2026-11-17) |
| Id | Bioma `biome_market`, `biome_cloister`, `biome_vineyard` (GD). Arena `arena_proto`, `arena_market`, `arena_cloister`, `arena_vineyard` (LD, sama dengan nama file) |

---

## 2. Satuan dunia dan koordinat

### 2.1 Satuan [Wajib]
- **1 u = 16 piksel sprite** pada sumbu X (horizontal layar). Pada 1080p (skala 3x) itu 48 piksel layar.
- Rasa ukuran: pemain tinggi 18 sampai 22 px, sekitar 1.25 u. Unlit kecil sekitar 0.75 u. Boss 64 sampai 96 px, 4 sampai 6 u.
- Semua angka posisi, ukuran arena, zona, rintangan, dan dekorasi di dokumen ini dan di `content/levels/*.json` memakai u. Angka piksel hanya untuk aturan layar.

### 2.2 Sumbu
- Lantai adalah bidang XZ dokumen ini, tinggi ke atas.
- **X** ke kanan layar. **Z positif** ke arah kamera, yaitu ke bawah layar. **Z negatif** = belakang arena = atas layar. Disebut juga utara (Z negatif) dan selatan (Z positif).
- Titik asal (0, 0) ada di tengah arena, di permukaan lantai.
- **Pemetaan ke sim dan JSON:** sumbu `z` dokumen ini sama dengan sumbu `y` sim dan `ArenaDef` (architecture 6.10, 7.1), jadi posisi lantai `[x, z]` di sini ditulis `[x, y]` di JSON dengan angka yang sama; titik cahaya ditulis `[x, h, y]` dengan `h` = tinggi di atas lantai.

### 2.3 Proyeksi ke layar
Pitch final asin(0.625) = 38.68 derajat, sehingga 1 u kedalaman lantai = tepat 10 px (bilangan bulat, lantai bertekstur piksel tidak bergetar setengah piksel).

Rumus resmi ada di architecture 7.1 dan `src/core/projection.ts` (`worldToRef`, `worldToVirtual`). Dokumen ini dan validator memakai konstanta `src/core/constants.ts`, bukan angka sendiri:

```
screenX = originX + REF_ORIGIN_X + PX_PER_U * x                     (REF_ORIGIN_X = 320, PX_PER_U = 16)
screenY = originY + REF_ORIGIN_Y + DEPTH_PX_PER_U * z - HEIGHT_PX_PER_U * h
                                                                      (REF_ORIGIN_Y = 200, DEPTH_PX_PER_U = 10,
                                                                       HEIGHT_PX_PER_U = 16 * cos(38.68) = 12.49)
originX = floor((virtualW - 640) / 2), originY = floor((virtualH - 360) / 2)
```

- Di bingkai referensi 640 x 360, `originX = originY = 0`. Semua koordinat layar di dokumen ini memakai bingkai referensi.
- `REF_ORIGIN_Y = 200` karena target kamera `CAMERA_TARGET` ada di kedalaman -2.
- Sprite aktor adalah billboard menghadap kamera, jadi tinggi sprite tampil 1:1 (tidak terpendekkan).
- Objek 3D vertikal (dekorasi, rintangan) terpendekkan: 1 u tinggi = 12.49 px layar.
- Tekstur lantai: 1 texel = 1/16 u di X dan 1/10 u di kedalaman (architecture 7.2).
- **Rasa gerak vertikal (CD K7):** gerak pemain yang dikendalikan input dikompensasi di sim dengan `player_vertical_screen_ratio` (architecture 7.1). Ini tidak mengubah satu pun angka u di dokumen ini; jarak, zona, dan rintangan tetap jujur di lantai dunia.

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

Biaya yang diterima: arena relatif kecil (622 u persegi), sehingga ruang kiting terbatas. GD mengatur kepadatan dan kecepatan dengan angka ini sebagai batas tetap. Arena tidak membesar per bioma.

### 3.2 Bingkai referensi dan skala integer [Wajib]
- Bingkai referensi: **640 x 360 piksel sprite** (`REF_FRAME_W`, `REF_FRAME_H`), 0,0 di kiri atas.
- **Kotak wajib terlihat** (`REQUIRED_BOX`): x 16 sampai 624, y 32 sampai 328 (608 x 296 px). Kotak ini memuat arena, margin kepala, bibir depan, dan sedikit dekorasi samping. Di lantai (h = 0) kotak ini setara x -19 sampai 19 u dan z -16.8 sampai 12.8 u.
- Skala layar = `max(1, floor(min(Wp / 608, Hp / 296)))` dalam piksel fisik (architecture 7.3). Bingkai dipusatkan. Ruang lebih di luar 640 x 360 diisi perpanjangan dekorasi tepi dan kabut `night`, bukan arena yang lebih besar.

| Resolusi (viewport fisik) | Skala | Dunia terlihat (px sprite) | Catatan |
|---|---|---|---|
| 1920 x 1080 | 3 | 640 x 360 | Referensi |
| 1920 x 950 (1080p dengan toolbar browser) | 3 | 640 x 316 | `originY` = -22: pita atas dan bawah terpotong 22 px, kotak wajib utuh |
| 1280 x 720 | 2 | 640 x 360 | |
| 1366 x 768 | 2 | 683 x 384 | Dekorasi samping lebih banyak terlihat |
| 1440 x 900 | 2 | 720 x 450 | |
| 2560 x 1440 | 4 | 640 x 360 | |
| 2560 x 1080 (ultrawide) | 3 | 853 x 360 | Dunia terlihat sampai x plus minus 26.7 u; dekorasi samping disiapkan sampai x plus minus 28 u |

### 3.3 Pita layar
| Pita (y bingkai referensi) | Isi | Tajam? |
|---|---|---|
| 0 sampai 54 | Pita DoF atas: dekorasi belakang tinggi, lentera belakang (bokeh), landmark, HUD atas | Blur |
| 54 sampai 100 | Ruang kepala: tempat kepala aktor di batas belakang, latar belakang bernilai seperti lantai | Tajam |
| 100 sampai 300 | Area main (z dari -10 sampai +10) | Tajam |
| 300 sampai 324 | Bibir depan (sampai y 310) dan bayangan aktor, tepi panggung | Tajam |
| 324 sampai 360 | Pita DoF bawah: dekorasi depan rendah, HUD bawah | Blur |
| Kolom x 0 sampai 64 dan 576 sampai 640 | Kolom samping: bibir arena (sampai x 48 dan 592) lalu dekorasi samping | Tajam (tidak kena DoF) |

- Batas pita tajam memakai `DOF_SHARP_TOP_PX` = 54 dan `DOF_SHARP_BOTTOM_PX` = 324 dalam piksel bingkai referensi (architecture 7.3), bukan persen layar.
- Ruang kepala 46 px cukup untuk Warden tertinggi (36 px) berdiri di batas belakang (kaki y 100, kepala y 64) dengan sisa 10 px sebelum pita blur.
- [Saran untuk UI] Zona HUD aman: pita atas (y di bawah 50), pita bawah (y di atas 326), dan sudut kolom samping. HUD di sana tidak pernah menutupi area main.

### 3.4 Posisi layar penting (dihitung ulang dengan pitch final)
| Benda | Dunia | Layar (bingkai referensi) |
|---|---|---|
| Batas arena | x plus minus 16, z plus minus 10 | x 64 sampai 576, y 100 sampai 300 |
| Tepi luar bibir | x plus minus 17, z plus minus 11 | x 48 dan 592, y 90 dan 310 |
| Titik awal Pulse biasa | `[0, 0]` | (320, 200) |
| Titik awal Pulse boss | `[0, 5]` | (320, 250) |
| Panggung boss | pusat `[0, -3]`, r 4 | pusat (320, 170), x 256 sampai 384, y 130 sampai 210 |
| Rim, tinggi 0.25 u | garis batas | 3.1 px tampak |
| Rintangan, tinggi 0.4 u | | 5.0 px tampak |
| Dekorasi samping belakang, 6 u | | 74.9 px tampak |
| Dekorasi samping depan, 2 u | | 25.0 px tampak |
| Dekorasi depan, 0.5 u di z 11 | | puncak y 303.8 (di bawah 303, tidak menyentuh aktor di batas depan) |
| Lentera belakang `[-10, h 2.5, -12]` | | (160, 48.8), di pita atas |
| Lentera gerbang `[0, h 3.5, -12.5]` | | (320, 31.3), di pita atas |
| Lentera samping `[-18, h 2.2, -2]` | | (32, 152.5), di kolom samping |
| Lentera tanah depan `[-9, h 0.4, 11.5]` | | (176, 310.0), di bawah area main |

---

## 4. Arena

### 4.1 Bentuk dan ukuran [Wajib]
- Persegi panjang 32 x 20 u (x dari -16 sampai 16, z dari -10 sampai 10) dengan **keempat sudut dipotong 3 u** pada 45 derajat.
- Poligon batas, **cembung dan searah jarum jam di layar** dimulai dari kiri belakang: `(-13,-10) (13,-10) (16,-7) (16,7) (13,10) (-13,10) (-16,7) (-16,-7)`. Urutan lain ditolak validator [Otomatis S2].
- Luas 622 u persegi. Diagonal terpanjang sekitar 35 u. Di layar: 512 x 200 px, dari x 64 sampai 576 dan y 100 sampai 300.
- Alasan sudut terpotong: (1) mengurangi jebakan sudut 90 derajat tempat pemain terkepung tanpa jalan keluar, (2) gema bentuk pecahan kaca dan sudut terpotong panel UI, (3) siluet arena langsung terbaca sebagai "panggung", bukan lantai kotak biasa.
- Rasio 1.6:1 di dunia (2.56:1 di layar) memberi ruang memutar horizontal yang lebar, sesuai layar 16:9 yang sebagian tingginya dipakai pita DoF.

### 4.2 Batas: perilaku [Wajib]
- Pemain dan semua Unlit dijepit di dalam poligon batas (tabrakan padat, tanpa damage). Knockback juga dijepit.
- Tidak ada aktor yang masuk atau keluar lewat batas. Unlit muncul di dalam batas (bagian 5.2).
- Glint tidak pernah jatuh di luar batas: posisi jatuh dijepit minimal 0.5 u di dalam batas. Glint yang jatuh di atas tapak rintangan digeser ke titik bebas terdekat.
- [Saran untuk GP] Proyektil hilang saat keluar dari batas yang diperlebar `projectileMargin` = 3 u (masih di area yang terlihat).

### 4.3 Batas: visual [Wajib]
- **Bibir (lip):** pita `lip` = 1 u di luar batas dengan nilai lantai yang sama (antara `floor-mid` dan `floor-lit`). Tidak ada dekorasi di bibir. Ini memastikan bagian sprite aktor yang menjorok melewati batas tetap punya latar bernilai lantai.
- **Garis tepi (rim):** tepian kaca rendah tepat di garis batas, tinggi 0.25 u (3.1 px layar), tebal tampak minimal 2 px, token `dust` dengan opasitas sekitar 50%, kontras terhadap lantai dalam minimal 1.5:1. Digambar di lapis lantai (di bawah semua aktor).
- **Di luar bibir:** lantai turun ke `shadow` lalu memudar ke kabut bioma (`edgeFade`), mulai 3 u dan penuh 10 u di luar batas. Warna kabut dari palet AD [Saran untuk AD].
- Lantai area main: polos atau pola sangat halus, saturasi tekstur dasar di bawah 15%, nilai antara `floor-mid` dan `floor-lit` (style guide 1.9).

---

## 5. Zona aman dan zona spawn

### 5.1 Zona aman [Wajib]
| Zona (id data) | Bentuk | Aturan |
|---|---|---|
| Lingkar awal (`start`) | Lingkaran pusat `[0, 0]`, radius 6 | Tanpa rintangan, tanpa titik spawn. Pemain mulai di `[0, 0]` [Otomatis Z1, SP2, R7] |
| Radius pemain | Lingkaran radius `playerSafeRadius` = 4 mengikuti pemain | Titik spawn tidak boleh dipilih di dalamnya (diperiksa saat telegraf dimulai, runtime) |
| Panggung boss (`boss_stage`) | Lingkaran pusat `[0, -3]`, radius 4 | Tanpa rintangan (bagian 9) [Otomatis Z2, R7] |
| Bibir dan pita spawn | Lihat 4.3 dan 5.2 | Tanpa rintangan [Otomatis R6, R7] |

- [Saran untuk GD] Pemain ditempatkan kembali di titik awal pada awal setiap Pulse: `[0, 0]` untuk Pulse biasa, `[0, 5]` untuk Pulse boss. Alasan: fase toko memutus posisi, dan awal Pulse yang sama membuat gelombang cahaya pembuka dari tengah (style guide 1.6) selalu berpusat dekat pemain. CD mendukung secara rasa (M0-cd 2.1 butir 4).
- Radius pemain 4 u adalah aturan ruang LD. GD boleh mengubahnya demi balance dengan alasan tertulis; batas bawah keterbacaan 3 u [Otomatis SP3].
- Catatan: dari titik awal Pulse boss `[0, 5]`, sektor `s` berjarak 2.5 u. Sebagian sektor `s` tertolak oleh radius pemain di awal Pulse boss; aturan runtime 5.2 sudah menanganinya (pindah ke sektor terjauh).

### 5.2 Zona spawn [Wajib]
- Spawn utama dari **pita tepi**: 1.0 sampai 2.5 u ke dalam dari batas, mengelilingi arena [Otomatis SP1, diukur dengan sampel grid 0.25 u].
- Pita dibagi **8 sektor** agar GD bisa mengatur arah datang (kiri-kanan, jepit, mengepung). Poligon ditulis searah jarum jam di layar:

| Sektor | Bentuk | Koordinat |
|---|---|---|
| `n` | rect | x -12 sampai 12, z -9 sampai -7.5 |
| `s` | rect | x -12 sampai 12, z 7.5 sampai 9 |
| `e` | rect | x 13.5 sampai 15, z -6 sampai 6 |
| `w` | rect | x -15 sampai -13.5, z -6 sampai 6 |
| `ne` | polygon | (12.5,-9) (15,-6.5) (13.5,-6) (12,-7.5) |
| `se` | polygon | (12,7.5) (13.5,6) (15,6.5) (12.5,9) |
| `sw` | polygon | (-12.5,9) (-15,6.5) (-13.5,6) (-12,7.5) |
| `nw` | polygon | (-15,-6.5) (-12.5,-9) (-12,-7.5) (-13.5,-6) |

- Rect di JSON ditulis `min` dan `max`; validator mengubahnya menjadi poligon searah jarum jam di layar (kiri atas, kanan atas, kanan bawah, kiri bawah).
- Jarak terdekat pita spawn ke titik awal: 7.5 u (sektor `n` dan `s`). Seluruh pita berada 1.0 sampai 2.5 u dari batas (terukur).
- Pemilihan titik: GP mengambil titik acak (RNG simulasi ber-seed) di sektor yang diminta GD. Titik ditolak bila di dalam radius pemain, atau bila lingkaran telegrafnya tidak muat utuh di dalam batas. Bila semua percobaan di sektor itu gagal (misalnya 8 percobaan), pindah ke sektor terjauh dari pemain.
- Jumlah, jenis, dan waktu spawn milik GD. LD hanya menyediakan ruang.
- **Spawn interior** (di luar pita) hanya untuk Unlit yang dipanggil Warden, boss, atau jenis pemanggil. Tetap wajib telegraf dan tetap mematuhi radius pemain, dengan batas bawah `interiorMinPlayerDist` = 2 u [Saran untuk GD].

### 5.3 Telegraf spawn [Wajib secara ruang, durasi milik GD]
- Lore: Unlit merembes lewat retakan. Telegraf adalah **retakan di lantai** yang tumbuh dan bercahaya sebelum Unlit keluar.
- Diameter lingkaran telegraf: Unlit kecil 1.0 u, sedang 1.5, besar 2.0, Warden 3.0. Boss memakai panggung boss.
- Warna dan bentuk mengikuti kode bahaya (style guide 1.3 dan 1.8): tepi solid `danger-violet` atau `danger-red`, isian tumbuh dari tengah, digambar di lapis bahaya L4 (architecture 7.4, P2-f).
- Seluruh lingkaran telegraf harus berada di dalam batas, di area tajam, dan tidak di bawah zona HUD. Ini terjamin bila titik dipilih di pita spawn dengan aturan 5.2.
- [Saran untuk GD] Durasi telegraf spawn minimal 0.8 detik. Unlit yang baru keluar tidak memberi damage sentuh selama sekitar 0.3 detik, agar spawn tepat di sebelah pemain tidak terasa curang.

---

## 6. Rintangan

Tujuan: sedikit variasi jalur tanpa mengorbankan keterbacaan. Arena tetap terasa lapang.

### 6.1 Aturan [Wajib]
| No | Aturan | Angka | Otomatis |
|---|---|---|---|
| R1 | Jumlah per arena | 0 sampai 4. Prototipe M1: 0 | Ya |
| R2 | Tinggi dunia | Maksimal 0.4 u (5.0 px layar, setengah tinggi Unlit terkecil) | Ya |
| R3 | Tapak | Rect sejajar sumbu (sisi pendek minimal 1 u, sisi panjang maksimal 3 u) atau lingkaran (diameter 1 sampai 3 u). Poligon tidak diterima | Ya |
| R4 | Cakupan total | Maksimal 5% luas arena (31.1 u persegi) | Ya |
| R5 | Jarak antar tepi rintangan | Minimal 4 u | Ya |
| R6 | Jarak tepi rintangan ke batas | Minimal 4 u (tidak ada celah sempit di dekat dinding) | Ya |
| R7 | Lokasi terlarang | Lingkar awal, panggung boss, pita spawn, bibir | Ya |
| R8 | Urutan gambar | Rintangan digambar di lapis lantai L0, **selalu di bawah semua aktor, Glint, proyektil, dan telegraf**. Nol piksel aktor tertutup rintangan | Tidak (LD-T04) |
| R9 | Fungsi | Menghalangi gerak pemain dan Unlit (`blocks` wajib berisi `move`). **Tidak** menghalangi proyektil [Asumsi, keputusan akhir GD]; `projectile` memberi peringatan | Ya |
| R10 | Warna | Nilai dekat lantai, tepi atas disorot `dust` agar tapak terbaca. Saturasi di bawah 20%. Tidak memakai hue pemain atau bahaya | Tidak (AD) |
| R11 | Jalur | Tidak wajib simetris, tapi setiap paruh kiri dan kanan arena punya jalur lurus utara-selatan lebar minimal 4 u (dicari di \|x\| sampai 13, bagian arena yang dalam penuh) | Ya |

Alasan R9: proyektil yang tiba-tiba berhenti di benda rendah sulit dibaca dan menambah kasus kematian yang tidak bisa dijelaskan. Rintangan berfungsi sebagai pembelok arus kerumunan, bukan pelindung.

[Saran untuk GP] Unlit menghindari rintangan dengan steering sederhana (dorongan menjauh dari tapak lingkaran atau kotak). Dengan jarak minimal 4 u, tidak ada kantong yang menjebak kerumunan.

---

## 7. Dekorasi

### 7.1 Zona dekorasi dan batas tinggi [Wajib]
Dekorasi **hanya di luar batas dan di luar bibir** (seluruh tapak minimal `lip` = 1 u dari batas) [Otomatis D1]. Tidak ada dekorasi di dalam arena. Tapak dekorasi = persegi panjang `pos` plus minus `footprintHalf`, diputar `rotYDeg`.

| Zona (`zone`) | Lokasi seluruh tapak | Tinggi dunia maksimal | Alasan |
|---|---|---|---|
| Belakang (`back`) | z kurang dari atau sama dengan -11 | Bebas (boleh keluar layar atas) | Selalu di belakang aktor, jatuh di pita DoF atas. Tempat landmark dan bokeh lentera |
| Samping belakang (`side`) | \|x\| minimal 17, tepi depan tapak z di bawah 2 | 6 u (74.9 px) | Membingkai panggung, tidak tumpang tindih kolom arena |
| Samping depan (`side`) | \|x\| minimal 17, tepi depan tapak z minimal 2 | 2 u (25.0 px) | Style guide 1.9: dekorasi tinggi tidak di sisi bawah layar |
| Depan (`front`) | z minimal 11 | 0.5 u (6.2 px), puncak tetap di y 303 atau lebih bawah | Tidak menyentuh aktor di batas depan |

- Zona samping belakang dan samping depan memakai `zone: "side"` yang sama; batas tingginya ditentukan oleh tepi depan tapak (z terbesar), sehingga tapak yang melewati z 2 memakai batas 2 u [Otomatis D2].
- Siluet dekorasi samping (termasuk bagian yang menjorok) tidak boleh masuk ke \|x\| di bawah 17, yaitu tetap 16 px dari garis batas di layar.
- **Pita latar belakang** (layar y 54 sampai 100, x 64 sampai 576): bagian dekorasi belakang yang tampak di sini wajib bernilai seperti lantai, luminans relatif antara 0.078 dan 0.142 (rentang `floor-mid` sampai `floor-lit` plus minus 10%). Alasan: kepala aktor di batas belakang menumpuk di atas pita ini. Terlalu gelap membuat Unlit hilang, terlalu terang membuat sorotan pemain hilang. Contoh: kaki Gerbang Lentera di z -12.5 tampil di y 75, jadi tekstur bagian bawahnya wajib bernilai lantai (LD-T06).
- Tidak ada sumber cahaya atau benda emisif yang posisi layarnya jatuh di pita latar belakang atau di area main. Lentera belakang digantung cukup tinggi sehingga tampil di pita DoF atas (y di bawah 54) sebagai bokeh [Otomatis L3 untuk titik cahaya; emisif mesh dicek AD].

### 7.2 Warna dan bentuk [Wajib]
- Low-poly dengan tekstur piksel dari palet. Kerapatan texel sama dengan sprite (16 texel per u). **Dekorasi tidak diskalakan**; variasi ukuran lewat varian mesh, agar skala piksel tetap satu (P3-b). Field skala apa pun ditolak [Otomatis S1].
- Palet tekstur lingkungan: saturasi HSV maksimal 40% untuk warna di rentang hue biru-cyan (170 sampai 250 derajat) dan merah-magenta-ungu (270 sampai 360 dan 0 sampai 10 derajat). Ini menjaga hue pemain dan bahaya tetap milik aktor.
- Emisif lingkungan (lentera, bara, lilin): hue 20 sampai 38 derajat (amber), saturasi maksimal 60%. Emas jenuh (hue 40 sampai 55) hanya untuk Glint dan hadiah.
- Saturasi dan kontras dekorasi tidak boleh melebihi aktor (P3 kriteria tolak).

### 7.3 Elemen bergerak dan partikel [Wajib]
- Minimal 3 jenis elemen bergerak per bioma (P3-d), semuanya di zona dekorasi.
- Partikel ambien yang melayang di atas area main (`area: "arena"`, debu kaca): maksimal 40 sekaligus, ukuran 1 px sprite, opasitas maksimal 25%, token hanya `bone` atau `dust`. **Tidak pernah emas** agar tidak dikira Glint, tidak pernah cyan atau merah [Otomatis P1].
- Partikel lain (bara, kertas, kabut, salju kaca, ngengat) hanya di zona dekorasi (`area: "decor"`).

### 7.4 Anggaran [Wajib, disetujui LP]
- Objek dekorasi maksimal 80 per arena (instancing dianjurkan), elemen beranimasi maksimal 12, titik cahaya dinamis maksimal 8 [Otomatis D4, L1].
- Dekorasi untuk ultrawide (sampai \|x\| = 28) dihitung dalam anggaran yang sama; LOD rendah boleh untuk objek di \|x\| di atas 20.

---

## 8. Cahaya

- **Warna dan intensitas cahaya milik AD** di `art/palette.json` entri bioma (`contentId` = id bioma GD): cahaya kunci, cahaya isi, kabut, grading, dan preset titik cahaya. JSON arena hanya menyimpan posisi titik cahaya, pengali intensitas opsional, kedip opsional, dan jarak `edgeFade` (architecture 6.10, 9.6).
- Per bioma: 1 cahaya kunci terarah plus 1 cahaya isi berwarna kontras (style guide 1.6). [Wajib]
- Elevasi cahaya kunci 35 sampai 70 derajat, agar lantai area main terang merata dan bayangan dekorasi tidak jatuh panjang menutupi arena. [Wajib]
- Titik cahaya ditempatkan di zona dekorasi: belakang (posisi layar di pita atas), samping (kolom samping), atau depan rendah (pita bawah). Tidak ada titik cahaya di dalam batas [Otomatis L2] dan tidak ada yang terproyeksi ke kotak x 64 sampai 576, y 54 sampai 303 [Otomatis L3, LD-T10]. [Wajib]
- **Urutan prioritas titik cahaya** [Wajib]: kualitas Rendah memakai 4 titik pertama. Empat pertama dipilih simetris kiri-kanan agar lantai tetap rata (LD-T05) saat kualitas turun.
- **Kerataan lantai** [Wajib]: setelah semua cahaya dan grading, rasio luminans blok lantai paling terang terhadap paling gelap di dalam batas maksimal 1.6:1 (rasio bawaan `floor-lit` terhadap `floor-mid` adalah 1.31:1). Saturasi blok lokal 8x8 maksimal 25%, median render maksimal 15% (style guide 1.9). Uji kontras P2-c dijalankan pada blok terang dan blok gelap.
- **Titik asal Pulse:** gelombang cahaya pembuka Pulse berasal dari `pulseOrigin` = `[0, 0]`. Efek ini milik AD dan GP.

---

## 9. Panggung boss

- **Lokasi:** lingkaran pusat `[0, -3]`, radius 4, di tengah belakang arena. Di layar: tepat di bawah landmark bioma (gerbang, menara, rumah peras), sehingga boss muncul dari "jantung" diorama.
- **Di Pulse biasa:** hanya lantai, tanpa rintangan. Boleh punya cincin pola lantai yang sangat halus (kontras terhadap lantai maksimal `floorRingContrastMax` = 1.15:1) agar pemain yang jeli mengenalinya, tanpa mengganggu keterbacaan.
- **Masuknya boss:** retakan besar di panggung (telegraf radius 4, durasi milik GD), cincin `danger-violet` menyala, lalu boss keluar. Pemain mulai di `[0, 5]`, 8 u dari pusat panggung dan 4 u dari tepinya [Otomatis Z2].
- **Batas gerak boss:** boss boleh bergerak ke seluruh arena, tapi kaki boss dijepit pada `z >= (H - 140) / 10`, dengan H = tinggi sprite boss dalam px. Turunan: kaki di y = 200 + 10z, kepala di y kaki dikurangi H (billboard 1:1), kepala wajib di y 60 atau lebih bawah (pita tajam 54 plus sisa 6 px). Contoh: H 96 px berarti z minimal -4.4; H 64 px berarti z minimal -7.6.
- **Pemain tertutup aktor besar:** bila sprite boss atau Warden menutupi pemain, pemain digambar ulang sebagai siluet tembus `kept-cyan` (outline 50%) di akhir lapis L4 (architecture 7.4). Pemain tidak pernah hilang dari layar (Pilar 2). [Wajib, implementasi milik LP dan AD, M2]
- Tidak ada arena boss terpisah dan tidak ada transisi kamera. Ini menjaga scope dan konsistensi ukuran.
- `bossStage.landmarkId` adalah id aset landmark AD. Arena prototipe memakai `none` (tanpa landmark).

---

## 10. Ringkasan urutan gambar (untuk LP dan AD)

Dari bawah ke atas, aturan yang menyangkut level (lapis L0 sampai L4 architecture 7.4):
1. L0: lantai luar, bibir, lantai area main, cincin panggung boss, garis tepi (rim), rintangan (selalu di bawah aktor), dekorasi low-poly.
2. L1: cincin penanda pemain dan bayangan elips aktor.
3. L2: aktor dan Glint (urut kedalaman kaki). Dekorasi belakang dan samping dalam praktik selalu di belakang aktor karena posisinya; dekorasi depan rendah tidak pernah tumpang tindih aktor karena aturan 7.1.
4. L3: efek pemain.
5. Post-processing (DoF pita, bloom, vignette, kilau kaca).
6. L4: telegraf, tanda spawn, proyektil musuh, lalu siluet tembus pemain bila tertutup aktor besar.
7. HUD.

---

## 11. Aturan keterbacaan yang bisa diuji

| ID | Uji | Cara verifikasi | Lolos bila | Pelaksana, mulai |
|---|---|---|---|---|
| LD-T01 | Validator data arena | `node tools/levels/check-arena.ts` (LD, sekarang) dan validator build `tools/data/validate-arena.ts` (LP, architecture 9.6) membaca `content/levels/*.json` dan memeriksa angka [Wajib] bagian 4 sampai 9 | Nol error | LD (skrip) sekarang, LP di build data, M1 |
| LD-T02 | Arena utuh di layar | Screenshot Playwright di 1280x720, 1366x768, 1920x950, 1920x1080, 2560x1440 | Seluruh poligon batas plus bibir terlihat; skala integer sesuai tabel 3.2 | QA, M1 |
| LD-T03 | Area main tajam | Screenshot DoF ON dan OFF, bandingkan piksel di kotak x 64 sampai 576, y 54 sampai 324 | Nol piksel berbeda (melengkapi P3-c) | AD dan LP, M2 |
| LD-T04 | Dekorasi dan rintangan tidak menutupi aktor | Tempatkan aktor uji tertinggi tiap kelas ukuran pada grid 1 u di seluruh arena termasuk tepat di batas; render mask aktor dengan dan tanpa dekorasi plus rintangan | Nol piksel aktor tertutup | QA dengan LP, M2 (versi geometri lewat LD-T01 di M1) |
| LD-T05 | Lantai rata | Bagi area main menjadi blok 8x8 px pada screenshot final | Rasio luminans blok terang ke gelap maksimal 1.6:1; saturasi HSV tiap blok maksimal 25% | AD, M2 |
| LD-T06 | Pita latar belakang | Ukur luminans relatif tiap blok 8x8 di y 54 sampai 100, x 64 sampai 576 | Semua blok antara 0.078 dan 0.142 | AD, M2 |
| LD-T07 | Batas terlihat | Screenshot grayscale ramai; penguji menelusuri batas dengan jari | Garis tepi tampak utuh minimal 2 px, kontras ke lantai dalam minimal 1.5:1, penguji menelusuri seluruh batas dalam 5 detik | QA, M1 |
| LD-T08 | Spawn adil | Simulasi ber-seed 1000 spawn dengan pemain bergerak acak | Jarak titik spawn ke pemain saat telegraf dimulai minimal 4 u (2 untuk spawn interior); 100% lingkaran telegraf di dalam batas | GP dan QA, M1 |
| LD-T09 | Partikel ambien bukan Glint | Audit data partikel (otomatis P1) dan screenshot | Maksimal 40 partikel di atas area main, 1 px, opasitas maksimal 25%, nol piksel partikel ber-hue emas, cyan, atau merah | LD (data), AD (screenshot), M2 |
| LD-T10 | Tidak ada cahaya di area main | Proyeksikan posisi semua titik cahaya dengan `worldToRef` (otomatis L3) | Tidak ada yang jatuh di x 64 sampai 576, y 54 sampai 303 | LD (skrip) dan LP (build), M1 |
| LD-T11 | Palet lingkungan | Audit palet tekstur dekorasi dan lantai | Sesuai 7.2 (saturasi biru-cyan dan merah-ungu maksimal 40%, emisif amber 20 sampai 38 derajat maksimal 60%) | AD, M2 |
| LD-T12 | Pemain tidak pernah hilang | Screenshot dengan pemain di belakang boss dan Warden | Siluet tembus pemain terlihat, penguji menunjuk pemain dalam 1 detik | QA dan CD, M2 |
| LD-T13 | Elemen diorama | Checklist per bioma | Minimal 3 elemen bergerak, landmark di atas panggung boss, bokeh lentera atau ekuivalen di pita atas | CD, M2 |

### 11.1 Skrip cek keterbacaan `tools/levels/check-arena.ts`
- Perintah: `node tools/levels/check-arena.ts` (semua arena), `node tools/levels/check-arena.ts arena_market` (satu arena), `node tools/levels/check-arena.ts --self-test` (21 kasus rusak sengaja, tiap aturan wajib terdeteksi). Exit 1 bila ada error; peringatan tidak menggagalkan.
- Logika aturan murni di `tools/levels/lib/legibility.ts` (angka aturan di objek `LD`), geometri di `tools/levels/lib/geometry.ts`. Proyeksi dan konstanta dari `src/core` agar sama persis dengan render. LP boleh memanggil `checkArena` dari build data.

| Kode | Memeriksa | Bagian |
|---|---|---|
| S1 | Struktur `ArenaDef`, field tidak dikenal (termasuk `units`, `camera`, `nameKey`, skala), id `snake_case` unik, `id` sama dengan nama file | 14, architecture 6.10 |
| S2 | Semua poligon cembung dan searah jarum jam di layar; rect `min` lebih kecil dari `max` | 4.1, 5.2 |
| S3 | Batas di dalam bingkai 32 x 20 u, bibir minimal 1 u | 4 |
| S4 | Warna sebagai token palet yang ada (bukan hex), id aset `kebab-case`, `tileId` ada di `art/tiles` (peringatan) | 14 |
| Z1, Z2 | Titik awal di dalam batas dan lingkar awal; panggung boss di dalam batas dan dilindungi zona aman; titik awal boss 4 u dari panggung; kontras cincin maksimal 1.15 | 5.1, 9 |
| SP1 sampai SP3 | 8 sektor lengkap, seluruh sektor di pita 1.0 sampai 2.5 u, tidak menyentuh zona aman yang memblokir spawn, radius pemain minimal 3 | 5 |
| R1 sampai R7, R9, R11 | Aturan rintangan | 6.1 |
| D1 sampai D4 | Tapak di luar bibir, zona dan tinggi, `lightId` valid, anggaran 80 dan 12 | 7 |
| L1 sampai L5 | Maks 8 titik cahaya, di luar batas, proyeksi LD-T10, kedip 0 sampai 1, `edgeFade` | 7.1, 8 |
| P1 | Partikel di atas area main | 7.3 |

---

## 12. Tiga bioma

Nama final disetujui CD (keputusan 2026-11-17), tampil hanya lewat string table (`biome.<id>.name`). Nama landmark di bawah masih deskriptif; nama tampil final dari Writer. Warna cahaya di bawah adalah nilai palet AD (`art/palette.json`, art-direction 6) dan dicantumkan hanya sebagai rujukan.

### 12.1 Urutan dan alasan
| Urutan | Nama final | Bioma (GD) | Arena (LD) | Busur rasa |
|---|---|---|---|---|
| 1 | The Moth Market | `biome_market` | `arena_market` (M1 memakai `arena_proto`) | Hangat, ramah, mudah dibaca. Mengajarkan aturan |
| 2 | Vesper Steps | `biome_cloister` | `arena_cloister` | Dingin, sunyi, terbuka. Tekanan naik |
| 3 | Stillfire Vineyard | `biome_vineyard` | `arena_vineyard` | Panas tertahan, duka, klimaks |

- Ketiganya memakai geometri arena yang sama (bagian 4). Yang berbeda: cahaya, dekorasi tepi, landmark, jenis dan posisi rintangan, partikel. Ini sesuai keputusan scope Producer: bioma tambahan memakai ulang Unlit dengan palet cahaya berbeda.
- Bioma 1 adalah Tingkat A dan harus paling dipoles. Bioma 2 dan 3 adalah Tingkat C.

### 12.2 Bioma 1: The Moth Market (`biome_market`, arena `arena_market`)
- **Tema:** pasar malam festival yang membeku pada detik langit jatuh. Ratusan lentera kertas masih menyala, kain tenda tertahan angin yang tidak pernah selesai bertiup, ngengat beku mengitari cahaya.
- **Suasana:** hangat dan meriah yang mendadak sunyi. Cahaya kecil yang masih dijaga.
- **Cahaya** (palet AD `b1`): kunci amber redup `#DCA466` dari kiri belakang atas (azimut 225, elevasi 50). Isi biru bulan `#6F86B8` dari kanan depan (elevasi 35). Lentera `#E8B070`, radius 3.5 u, kedip 12%.
- **Titik cahaya (7, urut prioritas):** `back_l`, `back_r`, `side_l`, `side_r` (empat pertama, simetris, dipakai kualitas Rendah), lalu `gate`, `front_l`, `front_r`. Gerbang tetap terbaca di kualitas Rendah lewat mesh emisif dan bloom.
- **Landmark (atas panggung boss):** Gerbang Lentera (`lantern-gate`), gerbang kayu dengan satu lentera besar retak di puncaknya.
- **Dekorasi tepi (35 objek, 10 beranimasi):**
  - Belakang: gerbang, 4 kios beratap kain, 2 tiang lentera, 2 tali lentera kertas, 2 tumpukan peti, 2 kios jauh untuk ultrawide, 2 deret atap pasar tinggi di z -15 (latar pita atas).
  - Samping: kios samping, tiang lentera, gulungan kain; di samping depan hanya tong dan karung rendah. Kios dan tong tambahan di \|x\| 23 sampai 24 untuk ultrawide.
  - Depan: 2 lentera tanah, 2 kertas melayang beku, 2 serpih kaca di tanah.
- **Rintangan (3):** meja kios rebah (rect 3 x 1.5), sumur bertutup (lingkaran r 1), tumpukan karung rendah (rect 2 x 1.5). Cakupan 1.71% luas, semua minimal 4.25 u dari batas dan di luar lingkar awal dan panggung boss (terukur).
- **Elemen bergerak:** kain tenda bergoyang (`cloth-sway`), tali lentera berayun (`lantern-sway`), kertas melayang beku berputar lambat (`paper-drift`), kedip lentera, ngengat di zona dekorasi, debu kaca di atas arena.
- **Lantai:** batu ubin aus, nada `floor-mid` sampai `floor-lit`, nat sangat halus (`tile-floor`).
- Cocok dengan Unlit: lentera yang menyerap terang.

### 12.3 Bioma 2: Vesper Steps (`biome_cloister`, arena `arena_cloister`)
- **Tema:** pelataran biara bertangga di bibir tebing, membeku saat lonceng sedang berayun dan ibadah senja belum selesai. Sisi depan arena adalah jurang berkabut.
- **Suasana:** dingin, khidmat, berangin, kesepian.
- **Cahaya** (palet AD `b2`): kunci bulan perak `#A7B4CC` dari kanan belakang (azimut 150, elevasi 60). Isi lilin hangat `#C99B6A` dari kiri depan rendah. Lilin `#E2B47E`.
- **Landmark:** menara lonceng dengan lonceng yang retak, tepat di atas panggung boss.
- **Dekorasi tepi:**
  - Belakang: dinding biara, gapura, lentera batu, bendera doa berwarna kusam (krem, abu, oker; bukan biru jenuh atau merah).
  - Samping: pilar patah, patung tanpa wajah, lentera batu.
  - Depan: pagar batu rendah (tinggi 0.4) lalu jurang dan kabut. Zona depan memang harus rendah, dan jurang mengisinya secara alami.
- **Rintangan (2 sampai 3):** alas pilar patah (lingkaran r 1), bangku batu rendah (rect 3 x 1).
- **Elemen bergerak:** kabut naik dari jurang, bendera doa berkibar, nyala lilin, serpih kaca turun seperti salju (hanya di zona dekorasi; di atas arena tetap aturan debu kaca 7.3).
- **Lantai:** lempeng batu dingin, nada abu sedikit hangat agar tidak biru.

### 12.4 Bioma 3: Stillfire Vineyard (`biome_vineyard`, arena `arena_vineyard`)
- **Tema:** kebun anggur bertingkat yang setengah terbakar saat panen. Api berhenti di tengah lereng, membeku tapi masih berpendar. Separuh sulur masih hijau kusam, separuh hangus.
- **Suasana:** panas yang tertahan, duka, akhir yang membara.
- **Cahaya** (palet AD `b3`): kunci bara `#C98A5A` dari belakang, isi abu fajar `#8C97A0` dari depan atas, bara `#D9955E`. Catatan LD: palet AD saat ini memberi kunci b3 elevasi 20 derajat, di bawah batas LD 35 derajat (bagian 8). Perlu diselaraskan dengan AD sebelum produksi b3 (Tingkat C): naikkan elevasi kunci, atau jadikan cahaya cakrawala sebagai cahaya isi.
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

### 13.1 Denah dari atas (dunia), The Moth Market (`arena_market`)
Satu kolom = 0.5 u, satu baris = 1 u (kira-kira proporsional karena huruf lebih tinggi dari lebarnya). Utara (belakang, atas layar) di atas. Angka kiri = z, angka atas = x.

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

Legenda: `#` batas dan garis tepi. `.` lantai area main. `~` pita spawn (8 sektor). `:` tepi lingkar awal (r 6). `b` tepi panggung boss (r 4). `P` titik awal Pulse biasa. `p` titik awal Pulse boss. `B` pusat panggung boss. `O` rintangan. `_` bibir (1 u, tanpa dekorasi). `D` dekorasi belakang (tinggi bebas). `d` dekorasi samping belakang (maks 6 u). `c` dekorasi samping depan (maks 2 u). `f` dekorasi depan (maks 0.5 u). Spasi di luar = lantai luar memudar ke kabut. `arena_proto` sama tanpa `O`, `D`, `d`, `c`, `f`.

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
    | 64 px|      AREA MAIN 512 x 200 px (32 x 20 u)         | 64 px|
    | deko-|                  P  titik awal                  | deko-|
    | rasi |                                                 | rasi |
300 |      | ##### batas depan (z = +10) ################### |      |
    |      | bibir depan sampai y 310, bayangan aktor        |      |
324 +------+------------------------------------------------+------+
    | PITA DoF BAWAH (blur): lentera tanah, kertas, HUD bawah      |
360 +--------------------------------------------------------------+
    x 0   64                                              576   640
```

---

## 14. Format JSON data arena

Format final ada di architecture 6.10 (tipe `ArenaDef`, `src/core/contracts/arena.ts`) dan 9.6. Bagian ini menjelaskan isinya dari sisi LD.

### 14.1 Konvensi
- Lokasi `content/levels/<id>.json`, satu file per arena, `id` `snake_case` sama dengan nama file (`arena_proto`, `arena_market`). `biomes.csv` kolom `arena_id` merujuk id ini.
- Semua jarak dalam u. Posisi lantai `[x, y]` (y = z dokumen ini), titik cahaya `[x, h, y]`.
- Tidak ada `units`, `camera`, `nameKey`: satuan dan kamera adalah konstanta `src/core/constants.ts`, nama tampil datang dari bioma lewat string table.
- Tidak ada warna hex. Warna memakai **token palet** (`dust`, `floor-mid`, `floor-lit`, `bone`). Cahaya kunci, isi, kabut, dan warna titik cahaya ada di `art/palette.json` (AD).
- Bentuk (`shape`) seragam untuk zona, rintangan, dan zona aman:
  - `{ "type": "rect", "min": [x, y], "max": [x, y] }`
  - `{ "type": "circle", "center": [x, y], "radius": r }`
  - `{ "type": "polygon", "points": [[x, y], ...] }`: cembung, **searah jarum jam di layar** (urutan bebas ditolak).
- `kind` rintangan dan dekorasi serta `landmarkId` adalah id aset AD `kebab-case`. Keberadaannya diperiksa setelah registri mesh AD ada (M2).
- Id data lain (zona aman, rintangan, dekorasi, titik cahaya) `snake_case`, unik per daftar.
- Tidak ada angka balance (jumlah spawn, durasi telegraf, kepadatan) di file arena. Itu di data GD.

### 14.2 Field
| Field | Tipe | Isi |
|---|---|---|
| `schemaVersion` | int | 1 |
| `id` | string | Id arena, sama dengan nama file |
| `arena.boundary` | array `[x, y]` | Poligon batas, cembung, searah jarum jam di layar |
| `arena.lip` | number | Lebar bibir (1) |
| `arena.rim` | object | `height` (0.25), `colorToken` (`dust`), `opacity` (0.5) |
| `arena.projectileMargin` | number | Perlebaran batas untuk menghapus proyektil (3) |
| `arena.floor` | object | `baseToken`, `altToken` (token palet), `tileId` (id tile AD, `tile-floor`) |
| `playerStart` | object | `default`, `boss` sebagai `[x, y]` |
| `pulseOrigin` | `[x, y]` | Asal gelombang cahaya Pulse |
| `safeZones` | array | `id`, `shape`, `blocks` (`obstacle`, `spawn`, `decor`) |
| `spawn.playerSafeRadius` | number | 4 |
| `spawn.interiorMinPlayerDist` | number | 2 |
| `spawn.zones` | array | `id` (`n`, `s`, `e`, `w`, `ne`, `se`, `sw`, `nw`), `shape` |
| `bossStage` | object | `shape`, `landmarkId` (id aset AD, `none` untuk prototipe), `floorRingContrastMax` (1.15) |
| `lighting.edgeFade` | object | `startOutside`, `endOutside` (u dari batas); warna = kabut palet bioma |
| `lighting.points` | array | Maks 8, **urut prioritas** (Rendah memakai 4 pertama): `id`, `pos` [x, h, y], `intensityMul` (opsional, pengali preset palet), `flicker` (opsional, 0 sampai 1, menimpa preset palet) |
| `obstacles` | array | `id`, `kind`, `shape`, `height`, `blocks` (`move`; `projectile` hanya bila GD memutuskan) |
| `decor` | array | `id`, `kind`, `zone` (`back`, `side`, `front`), `pos` [x, y], `rotYDeg`, `height`, `footprintHalf` [hx, hy], `anim` (opsional), `lightId` (opsional) |
| `ambient.particles` | array | `kind`, `area` (`arena` atau `decor`), `max`, `colorToken`, `opacity`, `sizePx` |

`height` dan `footprintHalf` pada dekorasi adalah nilai deklarasi untuk validator. AD memastikan mesh tidak melebihinya. Tidak ada field skala.

### 14.3 Contoh: `content/levels/arena_proto.json` (diringkas)

```json
{
  "schemaVersion": 1,
  "id": "arena_proto",
  "arena": {
    "boundary": [[-13, -10], [13, -10], [16, -7], [16, 7], [13, 10], [-13, 10], [-16, 7], [-16, -7]],
    "lip": 1,
    "rim": { "height": 0.25, "colorToken": "dust", "opacity": 0.5 },
    "projectileMargin": 3,
    "floor": { "baseToken": "floor-mid", "altToken": "floor-lit", "tileId": "tile-floor" }
  },
  "playerStart": { "default": [0, 0], "boss": [0, 5] },
  "pulseOrigin": [0, 0],
  "safeZones": [
    { "id": "start", "shape": { "type": "circle", "center": [0, 0], "radius": 6 }, "blocks": ["obstacle", "spawn", "decor"] },
    { "id": "boss_stage", "shape": { "type": "circle", "center": [0, -3], "radius": 4 }, "blocks": ["obstacle", "decor"] }
  ],
  "spawn": {
    "playerSafeRadius": 4,
    "interiorMinPlayerDist": 2,
    "zones": [
      { "id": "n", "shape": { "type": "rect", "min": [-12, -9], "max": [12, -7.5] } },
      { "id": "ne", "shape": { "type": "polygon", "points": [[12.5, -9], [15, -6.5], [13.5, -6], [12, -7.5]] } }
    ]
  },
  "bossStage": { "shape": { "type": "circle", "center": [0, -3], "radius": 4 }, "landmarkId": "none", "floorRingContrastMax": 1.15 },
  "lighting": { "edgeFade": { "startOutside": 3, "endOutside": 10 }, "points": [] },
  "obstacles": [],
  "decor": [],
  "ambient": { "particles": [] }
}
```

(Enam sektor lain dihilangkan di contoh; lihat tabel 5.2 dan file asli.) Contoh dekorasi, titik cahaya, dan rintangan lengkap ada di `content/levels/arena_market.json`, misalnya:

```json
{ "id": "back_l", "pos": [-10, 2.5, -12], "intensityMul": 1.0 }
{ "id": "well_1", "kind": "covered-well", "shape": { "type": "circle", "center": [9, 4], "radius": 1 }, "height": 0.4, "blocks": ["move"] }
{ "id": "pole_bl", "kind": "lantern-pole", "zone": "back", "pos": [-10, -12], "rotYDeg": 0, "height": 3.0, "footprintHalf": [0.25, 0.25], "lightId": "back_l" }
```

---

## 15. Arena prototipe M1 dan draf M2

### 15.1 `arena_proto` (M1)
- Geometri final (bagian 4), 8 sektor spawn, zona aman, titik awal, **tanpa rintangan, tanpa dekorasi, tanpa titik cahaya, tanpa partikel**. Lantai `floor-mid` dan `floor-lit` dengan garis tepi `dust`. Cahaya kunci dan isi dari palet bioma yang memakainya (M1: `biome_market`). `landmarkId` = `none`.
- Tujuannya menyetel rasa main loop dan ukuran sebelum hiasan.
- `biomes.csv` (GD) memakai `arena_proto` untuk `biome_market` selama M1.
- Uji M1: LD-T01 dan LD-T10 lewat skrip (lulus), LD-T02, LD-T07, LD-T08 oleh QA dan GP.
- Bila M1 menunjukkan arena terlalu sempit atau terlalu lapang, yang diubah adalah kecepatan dan kepadatan (GD), bukan ukuran arena, kecuali CD, GD, LD, dan LP sepakat. Ukuran arena terkunci oleh bingkai layar dan pita DoF.

### 15.2 `arena_market` (draf M2, bioma 1)
- Geometri dan zona sama dengan `arena_proto`. Tambahan: 3 rintangan, 35 dekorasi tepi (10 beranimasi), 7 titik cahaya urut prioritas, landmark `lantern-gate`, partikel debu kaca (arena) dan ngengat (dekorasi). Lulus skrip cek (lihat 15.3).
- Sudah ikut build data (tidak dirujuk `biomes.csv` sampai M2). Saat M2, GD mengganti `arena_id` `biome_market` menjadi `arena_market`.
- **Daftar id aset untuk AD (M2)**, tinggi dan tapak sesuai deklarasi di JSON:
  - Landmark: `lantern-gate`.
  - Rintangan: `tipped-stall-table`, `covered-well`, `sack-pile`.
  - Dekorasi: `stall-awning`, `lantern-pole`, `lantern-string`, `crate-stack`, `market-roofline`, `side-stall`, `cloth-rolls`, `barrel-cluster`, `sack-pile-low`, `ground-lantern`, `frozen-paper`, `glass-shards`.
  - Animasi: `cloth-sway`, `lantern-sway`, `paper-drift`. Partikel: `glass-dust`, `moth`.
- Blockout visual dan penyesuaian bersama AD dikerjakan di M2.

### 15.3 Hasil cek (2026-11-17)
| Arena | Error | Cakupan rintangan | Pita spawn | Spawn ke titik awal | Jarak dekorasi ke batas | Titik cahaya | Dekorasi (animasi) |
|---|---|---|---|---|---|---|---|
| `arena_proto` | 0 | 0% | 1.0 sampai 2.5 u | 7.5 u | tidak ada | 0 | 0 (0) |
| `arena_market` | 0 | 1.71% | 1.0 sampai 2.5 u | 7.5 u | minimal 1.2 u | 7 | 35 (10) |

---

## 16. Asumsi dan serah terima

Asumsi yang perlu dikonfirmasi:
- [Asumsi] Rintangan tidak menghalangi proyektil (GD memutuskan).
- [Asumsi] Pemain kembali ke titik awal tiap Pulse (GD memutuskan; CD mendukung).
- [Asumsi] Batas tinggi dekorasi samping ditentukan oleh tepi depan tapak (7.1).

Yang dibutuhkan dari peran lain:
- **GD:** durasi telegraf spawn, aturan sektor per Pulse (kolom opsional `sectors` di `wave_spawns.csv`, saran LP), kecepatan pemain dan Unlit yang cocok dengan arena 32 x 20 u, keputusan proyektil dan rintangan, `arena_id` `biome_market` ke `arena_market` di M2.
- **LP:** validator build `tools/data/validate-arena.ts` (boleh memanggil `checkArena` dari `tools/levels/lib/legibility.ts`), implementasi siluet tembus pemain.
- **AD:** mesh dan tile sesuai daftar id 15.2 dengan tinggi dan tapak tidak melebihi deklarasi; elevasi kunci b3 (12.4).
- **UI:** penempatan HUD di zona aman HUD (3.3).
- **Writer:** nama tampil landmark (Gerbang Lentera, menara lonceng, rumah peras) bila ingin tampil di game.

---

## 17. Log perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1 | 2026-11-16 | Draf M0 |
| 2 | 2026-11-17 | Perbaikan review M0: format JSON mengikuti architecture 6.10 dan 9.6 (id `snake_case`, tanpa `units`, `camera`, `nameKey`, `lighting.key` dan `fill`; token warna; `floor.tileId`; titik cahaya urut prioritas); rumus layar merujuk konstanta architecture 7.1 dan pemetaan `z` ke `y`; poligon searah jarum jam di layar (sektor `se` dan `nw` diurutkan ulang); nama bioma final; warna cahaya mengikuti palet AD (`#DCA466`); alternatif 40 derajat dihapus; posisi layar dihitung ulang dengan 12.49 px per u tinggi (3.4); data `arena_proto` dan draf `arena_market`; skrip cek `tools/levels/check-arena.ts` |
