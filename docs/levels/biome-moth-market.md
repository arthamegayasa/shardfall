# Bioma 1: The Moth Market (`biome_market`, arena `arena_market`)

Pemilik: Level Designer (LD). Status: versi 1 final M2 (2026-11-17, tugas M2-07). Reviewer: CD (rasa), AD (aset), LP (implementasi geometri).
Data: `content/levels/arena_market.json`. Aturan umum (satuan, zona, batas tinggi, cahaya) ada di `docs/levels/arena-design.md`; dokumen ini hanya isi bioma 1 dan katalog aset untuk LP dan AD.

Penanda: **[Wajib]** aturan yang harus dipatuhi mesh dan render. **[Saran untuk X]** default untuk peran lain.

---

## 1. Ringkasan

| Hal | Isi |
|---|---|
| Rasa | Pasar malam festival yang membeku pada detik langit jatuh. Ratusan lentera kertas masih menyala, kain tertahan angin yang tidak selesai bertiup, lentera terbang berhenti di tengah naik |
| Geometri | Sama dengan semua arena: 32 x 20 u, sudut terpotong 3 u, 8 sektor spawn, lingkar awal r 6, panggung boss `[0, -3]` r 4 |
| Landmark | `lantern-gate` (Gerbang Lentera) di atas panggung boss |
| Titik cahaya | 7 dari maksimal 8 (slot ke-8 sengaja kosong untuk cahaya gameplay bila LP butuh, misalnya intro boss) |
| Rintangan | 3 rendah (maks 4): meja kios rebah, sumur bertutup, tumpukan karung |
| Dekorasi | 61 objek dari anggaran 80, 12 beranimasi dari anggaran 12, 22 jenis aset |
| Partikel | Debu kaca di atas arena (40, `bone`), ngengat dan sobekan kertas di zona dekorasi |
| Hasil cek | `node tools/levels/check-arena.ts`: 0 error, 0 peringatan |

## 2. Komposisi layar (bingkai referensi 640 x 360)

```
  y   x 0      64                                                       576     640
  0   +-------+---------------------------------------------------------+-------+
      | tenda | atap pasar  ~lentera terbang~  GERBANG  ~lentera terbang~  atap | tenda |  pita DoF atas (blur):
      |       |   kios  tali lentera kertas  [lentera besar]  tali lentera  kios |       |  semua emisif belakang di sini
 54   +-------+--------- kaki kios dan peti, bernilai lantai (LD-T06) -----+-------+
      |lentera|                                                         |lentera|
      |terbang|   ############ batas belakang z -10 ################   |terbang|
      | kios  |                     panggung boss                       | rak   |
      |garland|                                                         |garland|
      | tiang*|   [meja]                                                | tiang*|
      | kain  |                       P titik awal                      | kain  |
      |keranjg|                                              (sumur)    |keranjg|
      | tong  |      [karung]                                           | tong  |
      |lentera|   ############ batas depan z +10 ##################    |lentera|
      | karung|                                                         | karung|
324   +-------+---------------------------------------------------------+-------+
      | peti   serpih  lentera* jatuh  kertas  lentera  kertas  jatuh  lentera*  tikar |  pita DoF bawah (blur), maks 0.5 u
360   +--------------------------------------------------------------------------+
```

`*` = punya titik cahaya. Kolom samping 64 px = dunia x 16 sampai 20 u; objek di \|x\| di atas 20 hanya terlihat di layar lebar.

## 3. Titik cahaya (urut prioritas) [Wajib]

| # | id | Posisi `[x, h, y]` | Proyeksi layar (px) | Pengali | Kedip | Mesh pemilik |
|---|---|---|---|---|---|---|
| 1 | `back_l` | -10, 2.5, -12 | 160, 48.8 | 1.0 | palet (12%) | `pole_bl` |
| 2 | `back_r` | 10, 2.5, -12 | 480, 48.8 | 1.0 | palet | `pole_br` |
| 3 | `side_l` | -18, 2.2, -2 | 32, 152.5 | 0.9 | palet | `pole_sl` |
| 4 | `side_r` | 18, 2.2, -2 | 608, 152.5 | 0.9 | palet | `pole_sr` |
| 5 | `gate` | 0, 3.5, -12.5 | 320, 31.3 | 1.5 | 6% | `gate` |
| 6 | `front_l` | -9, 0.4, 11.5 | 176, 310.0 | 0.6 | 15% | `lamp_fl` |
| 7 | `front_r` | 9, 0.4, 11.5 | 464, 310.0 | 0.6 | 15% | `lamp_fr` |

- Empat pertama simetris, dipakai kualitas Rendah. Gerbang tetap terbaca di Rendah lewat mesh emisif.
- Lentera lain (tali, lentera terbang, rak, lentera tanah tanpa `lightId`, lentera jatuh) hanya **mesh emisif plus bloom**, bukan cahaya dinamis. Ini menjaga anggaran 8 titik dan biaya per piksel.
- Warna dan intensitas dasar dari `art/palette.json` `b1.point` (AD).

## 4. Rintangan (3) [Wajib]

| id | Aset | Bentuk | Tinggi | Catatan |
|---|---|---|---|---|
| `stall_table_1` | `tipped-stall-table` | rect x -9.5 sampai -6.5, y -5.75 sampai -4.25 (3 x 1.5) | 0.4 | Meja kios rebah datar, papan menghadap atas |
| `well_1` | `covered-well` | lingkaran `[9, 4]` r 1 | 0.4 | Bibir batu bundar, tutup kayu |
| `sacks_1` | `sack-pile` | rect x -7 sampai -5, y 4.25 sampai 5.75 (2 x 1.5) | 0.35 | Karung gandum rebah |

Cakupan 1.71% luas, semua minimal 4 u dari batas, di luar lingkar awal, panggung boss, dan pita spawn. Jalur utara-selatan terlebar: barat 5 u (x -5 sampai 0), timur 8 u (x 0 sampai 8), aturan R11 minimal 4 u. Mesh rintangan sejajar sumbu panjang rect (tanpa rotasi di data).

## 5. Katalog aset untuk LP dan AD [Wajib]

Konvensi:
- `pos` = pusat tapak di lantai. Tapak = `pos` plus minus `footprintHalf` (sebelum rotasi). **Mesh tidak boleh melewati tapak dan tinggi yang dideklarasikan**; satu jenis aset = satu mesh (tanpa skala, arena-design 7.2). Bila jenis yang sama dipakai dengan deklarasi berbeda, mesh mengikuti deklarasi terkecil.
- `rotYDeg`: putaran di sumbu vertikal. Pada 0, sisi depan mesh menghadap kamera (+y). **90 = depan menghadap +x (kanan layar), 270 = menghadap -x.** Jadi kios samping kiri (90) dan kanan (270) sama-sama menghadap arena. Tapak dicek simetris, jadi arah tanda hanya memengaruhi mesh.
- Low-poly: kotak, prisma 6 sampai 8 sisi, bidang miring. Tekstur piksel 16 texel per u dari palet `b1.*` (AD). Ukuran di kolom "Bentuk" dalam u.
- **Emisif belakang** [Wajib]: setiap bagian emisif dekorasi `back` yang berada di \|x\| sampai 16 harus terproyeksi ke y di bawah 54 px (pita DoF atas). Tinggi minimal bagian emisif pada kedalaman `y`: `h_min = (146 + 10 y) / 12.49`. Contoh: y -11.75 butuh 2.28 u, y -12 butuh 2.08 u, y -12.7 butuh 1.52 u, y -13.3 butuh 1.04 u.
- **Pita latar belakang** [Wajib, LD-T06]: bagian dekorasi belakang yang tampak di y 54 sampai 100 (kaki kios, peti, keranjang, tiang gerbang bawah) bernilai seperti lantai setelah cahaya, luminans relatif 0.078 sampai 0.142. `b1.cloth-indigo` dan `b1.wood-dark` mentah di bawah rentang ini; AD menaikkan nilainya di bagian bawah atau mengandalkan cahaya `back_l`, `back_r`, `gate`.

### 5.1 Landmark

| Aset | Pakai | Tapak (W x D) | Tinggi | Bentuk low-poly | Emisif | Animasi |
|---|---|---|---|---|---|---|
| `lantern-gate` | `gate` | 5 x 1 | 5.5 | Dua tiang kayu 0.4 x 0.4 setinggi 4.6, balok lintang 5 x 0.4 x 0.3 di h 4.3, atap pelana kecil di atas balok, lentera kertas besar segi 8 (r 0.6, tinggi 0.9) di puncak h 4.6 sampai 5.5 dengan retak terang, 2 lentera kecil tergantung di bawah balok h 3.0 sampai 3.4 | Lentera besar dan 2 lentera kecil (semua di atas h 2.1, aman) | Kedip lewat titik cahaya `gate` saja |

### 5.2 Dekorasi belakang (`back`, tinggi bebas)

| Aset | Pakai | Tapak | Tinggi | Bentuk low-poly | Emisif | Animasi |
|---|---|---|---|---|---|---|
| `stall-awning` | `stall_b1` sampai `b4`, `stall_bfl`, `stall_bfr` | 4 x 2 | 2.8 | Meja dagang 4 x 0.8 x 0.9 di depan, 4 tiang, atap kain miring (depan h 2.2, belakang h 2.8) dengan valance bergerigi. Barang dagangan berupa kotak kecil di meja. Warna kain bergilir indigo, oker, lumut per instans (indeks material, bukan skala) | Tidak ada | Tidak (blur di pita atas) |
| `lantern-pole` | `pole_bl`, `pole_br`, `pole_sl`, `pole_sr` | 0.5 x 0.5 | 2.6 | Tiang 0.15 x 0.15, lengan pendek, lentera kertas bulat segi 6 (r 0.2) di poros tiang pada h 2.15 sampai 2.55 | Lentera (di belakang: h 2.15 di y -12 aman) | Kedip lewat titik cahaya |
| `lantern-string` | `lantern_string_l`, `_r` | 9 x 0.2 | 3.2 | Tali melengkung dari h 3.2 di kedua ujung, 7 lentera kertas kecil (0.25 x 0.3) menggantung; lentera terendah minimal h 1.6 | Semua lentera | `lantern-sway` |
| `floating-lanterns` | `floating_l`, `floating_r` (juga di samping) | 3 x 1 | 4.8 | 4 lentera langit kertas (kotak 0.4 x 0.4 x 0.5, dasar terbuka bercahaya) berhenti di tengah naik pada h 2.6 sampai 4.8, tanpa tali | Semua lentera | `lantern-sway` (ayun lambat plus naik turun 0.05 u) |
| `crate-stack` | `crates_bl`, `crates_br` | 2 x 1.5 | 1.5 | 3 peti kayu bertumpuk piramida | Tidak | Tidak |
| `crate-low` | `crate_bc` (juga di samping) | 1.2 x 1 | 0.8 | 1 peti plus 1 peti kecil di atasnya | Tidak | Tidak |
| `basket-stack` | `baskets_bc` (juga di samping) | 1 x 1 | 0.9 | 2 sampai 3 keranjang anyaman segi 6 bertumpuk | Tidak | Tidak |
| `market-roofline` | `roof_bl`, `roof_br` | 10 x 2 | 6 | Deret 3 atap pelana kayu gelap dengan dinding pendek, latar paling belakang | Tidak (boleh 1 sampai 2 jendela kecil emisif redup) | Tidak |
| `festival-tent` | `tent_bl`, `tent_br` (juga di samping jauh) | 3 x 3 | 4 | Tenda limas segi 6 bergaris kain, tiang tengah dengan panji kecil | Tidak | Tidak |

### 5.3 Dekorasi samping (`side`, \|x\| minimal 17; tinggi maks 6 u, atau 2 u bila tapak mencapai y 2)

| Aset | Pakai | Tapak | Tinggi | Bentuk low-poly | Emisif | Animasi |
|---|---|---|---|---|---|---|
| `side-stall` | `stall_sl`, `stall_sr`, `stall_sfl`, `stall_sfr` | 3 x 3 | 3 | Kios menghadap arena (rot 90 atau 270): meja depan, atap kain miring, satu lentera kertas kecil di sudut depan h 2.2 | Lentera sudut (kolom samping, bebas) | `cloth-sway` pada valance (`stall_sl`, `stall_sr`) |
| `paper-garland` | `garland_sl`, `garland_sr` | 0.2 x 3.2 (rot 90) | 2.6 | Tali bendera kertas segitiga dan potongan kertas bentuk ngengat, dari sudut kios (h 2.6) ke tiang lentera, titik terendah h 1.9 | Tidak | `cloth-sway` (kertas berkibar) |
| `floating-lanterns` | `floating_sl`, `floating_sr` | 3 x 1 | 4.8 | Sama dengan 5.2 | Ya | `lantern-sway` |
| `vendor-cart` | `cart_sl`, `cart_sfr` | 2.5 x 1.5 | 1.8 | Gerobak: 2 roda segi 8, bak kotak, pegangan, kanopi kain kecil | Tidak | Tidak |
| `lantern-rack` | `rack_sr`, `rack_sfl` | 1.5 x 1 | 2.4 | Rak kayu bentuk A dengan 6 lentera kertas kecil dijual, tergantung h 1.2 sampai 2.2 | Semua lentera (kolom samping, bebas) | Tidak |
| `cloth-rolls` | `cloth_rolls_sl`, `_sr` | 1.5 x 1 | 1 | Gulungan kain bersandar (silinder segi 6) | Tidak | Tidak |
| `basket-stack` | `baskets_sl`, `_sr` | 1 x 1 | 0.9 | Lihat 5.2 | Tidak | Tidak |
| `barrel-cluster` | `barrels_sl`, `_sr`, `_sfl`, `_sfr` | 2 x 2 | 1.2 | 3 tong segi 8 | Tidak | Tidak |
| `ground-lantern` | `lamp_sl`, `lamp_sr` | 0.5 x 0.5 | 0.4 | Lentera kertas pendek di tanah, segi 6 | Ya | Tidak |
| `sack-pile-low` | `sacks_sl`, `_sr` | 1.5 x 1.5 | 0.8 | Tumpukan karung | Tidak | Tidak |
| `crate-low` | `crate_sl`, `crate_sr` | 1.2 x 1 | 0.8 | Lihat 5.2 | Tidak | Tidak |
| `festival-tent` | `tent_sfl`, `tent_sfr` | 3 x 3 | 4 | Lihat 5.2 (hanya layar lebar) | Tidak | Tidak |

### 5.4 Dekorasi depan (`front`, maks 0.5 u, puncak di y 303 atau lebih bawah)

| Aset | Pakai | Tapak | Tinggi | Bentuk low-poly | Emisif | Animasi |
|---|---|---|---|---|---|---|
| `ground-lantern` | `lamp_fl`, `lamp_fr`, `lamp_fc` | 0.5 x 0.5 | 0.4 | Lihat 5.3 | Ya (bokeh di pita bawah) | Kedip lewat titik cahaya (`fl`, `fr`) |
| `frozen-paper` | `paper_f1`, `paper_f2` | 3 x 1 | 0.05 | 5 sampai 7 lembar kertas festival (quad datar) melayang sangat rendah di atas tanah | Tidak | `paper-drift` |
| `fallen-lantern` | `fallen_lantern_f1`, `_f2` | 0.8 x 0.6 | 0.35 | Lentera kertas penyok rebah miring | Redup (50% emisif lentera biasa) | Tidak |
| `woven-mat` | `mat_f1` | 2.5 x 1.2 | 0.05 | Tikar dagang dengan barang dilukis di tekstur | Tidak | Tidak |
| `glass-shards` | `shards_fl`, `shards_fr` | 2 x 1 | 0.1 | 4 sampai 6 keping kaca langit pipih, token `b1.glass`. **Bukan emas dan tanpa kilau emas** agar tidak dikira Glint | Tidak | Tidak |

### 5.5 Rintangan (lapis L0, selalu di bawah aktor)

| Aset | Tapak | Tinggi | Bentuk low-poly |
|---|---|---|---|
| `tipped-stall-table` | 3 x 1.5 | 0.4 | Daun meja papan rebah plus 2 kaki menjulur rendah; tepi atas disorot `dust` |
| `covered-well` | lingkaran r 1 | 0.4 | Bibir batu segi 10, tutup papan bundar |
| `sack-pile` | 2 x 1.5 | 0.35 | 4 karung rebah |

Warna rintangan dekat nilai lantai, saturasi di bawah 20% (arena-design R10).

## 6. Animasi dan partikel [Wajib]

| Id animasi | Dipakai | Gerak | Batas |
|---|---|---|---|
| `cloth-sway` | Valance kios samping, `paper-garland` | Sway verteks pada bagian kain saja, fase acak per instans (seed dari id, bukan RNG sim) | Amplitudo maks 0.08 u, periode 2.5 sampai 4 s |
| `lantern-sway` | `lantern-string`, `floating-lanterns` | Bandul per lentera di titik gantung (lentera terbang: titik pivot maya 1 u di atasnya) plus naik turun 0.05 u untuk lentera terbang | Maks 4 derajat, periode 3 sampai 5 s |
| `paper-drift` | `frozen-paper` | Putar lambat di sumbu vertikal plus naik turun kecil | 1 putaran per 20 sampai 30 s, naik turun 0.03 u |

- 12 objek beranimasi (batas 12): `lantern_string_l`, `_r`, `floating_l`, `_r`, `_sl`, `_sr`, `stall_sl`, `stall_sr`, `garland_sl`, `garland_sr`, `paper_f1`, `paper_f2`. Kios belakang sengaja diam karena jatuh di pita blur.
- Elemen bergerak P3-d (minimal 3): kain dan kertas berkibar, lentera berayun dan melayang, kertas berputar, kedip 7 titik cahaya, ngengat, debu kaca.
- Opsi "kurangi efek" [Saran untuk LP]: animasi dekorasi boleh tetap, tetapi amplitudo dibagi dua; partikel ngengat dan kertas dimatikan.

| Partikel | Area | Maks | Token | Opasitas | Ukuran |
|---|---|---|---|---|---|
| `glass-dust` | `arena` | 40 | `bone` | 0.2 | 1 px |
| `moth` | `decor` | 16 | `dust` | 0.6 | 2 px |
| `paper-scrap` | `decor` | 8 | `b1.paper` | 0.7 | 2 px |

Ngengat dan sobekan kertas hanya di zona dekorasi (di luar bibir), berkerumun dekat lentera samping dan belakang. Debu kaca di atas arena tidak pernah emas, cyan, atau merah.

## 7. Anggaran dan LOD [Wajib]

| Hal | Pakai | Batas |
|---|---|---|
| Objek dekorasi | 61 | 80 |
| Beranimasi | 12 | 12 |
| Titik cahaya | 7 | 8 |
| Jenis aset (mesh unik) | 22 dekorasi, 3 rintangan, 1 landmark | Tidak ada batas; instancing per jenis dianjurkan |

- Objek di \|x\| di atas 20 (layar lebar saja, boleh LOD rendah atau tidak dirender saat dunia terlihat lebih sempit): `stall_bfl`, `stall_bfr`, `tent_sfl`, `tent_sfr`, `stall_sfl`, `stall_sfr`, `rack_sfl`, `cart_sfr`, `barrels_sfl`, `barrels_sfr`.
- Bayangan nyata dekorasi boleh tidak ada di M2 (brief 3). Bila ada, panjang bayangan dibatasi elevasi kunci 50 derajat dan tidak masuk area main lebih dari 1 u.

## 8. Uji yang terkait bioma ini

| Uji | Status |
|---|---|
| LD-T01 data (`check-arena.ts`) | Lulus, 0 error |
| LD-T10 cahaya di luar area main | Lulus (proyeksi tabel 3) |
| LD-T13 elemen diorama | Data siap: 3 jenis animasi plus kedip dan 3 partikel, landmark di atas panggung boss, bokeh di pita atas. Penilaian visual CD setelah LP merender |
| LD-T04, LD-T05, LD-T06, LD-T09, LD-T11 | Butuh render final (AD, QA) |

## 9. Asumsi dan pertanyaan

- [Asumsi] Arah `rotYDeg` mengikuti konvensi bagian 5 (90 = depan menghadap +x). LP mengunci saat membangun mesh; bila berbeda, LD membalik nilai di data.
- [Asumsi] Jenis animasi `lantern-sway` dipakai juga untuk lentera terbang agar LP cukup membuat 3 jenis animasi.
- [Saran untuk AD] Nama tampil landmark tidak dibutuhkan di game (tidak ada label). Nama kerja dokumen: Gerbang Lentera.
