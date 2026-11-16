# Shardfall: Arah Art

Pemilik: Art Director (AD). Status: M0, versi 1 (2026-11-16). Reviewer: CD (visual), LP (teknis).
Dasar: `docs/vision.md`, `docs/pillars.md`, `docs/style-guide.md`. Bila bertentangan, pilar dan style guide menang.
Diselaraskan dengan: `docs/tech/architecture.md` (LP: kamera, lapisan, post-processing), `docs/levels/arena-design.md` (LD: arena), `docs/gdd.md` (GD: peran Unlit, kelas, Warden, boss), `docs/narrative/glossary.md` (WR: nama kerja).
Pipeline produksi aset: `docs/art-pipeline.md`. Sumber kebenaran warna: `art/palette.json`.

Penanda: **[Wajib]** tidak boleh dilanggar tanpa persetujuan AD dan CD. **[Saran]** boleh disesuaikan pemilik wilayah dengan alasan tertulis. **[Asumsi]** dikalibrasi di M1 atau M2.

---

## 1. Prinsip

1. **Sprite tajam, cahaya lembut.** Aktor, proyektil, dan tepi telegraf selalu berpiksel tegas. Rasa HD-2D dibawa oleh cahaya, kabut tepi, bloom, dan blur pita tepi.
2. **Tiga lapis nilai.** Sorotan pemain paling terang, lantai sedang, badan Unlit paling gelap. Bahaya punya inti pucat dengan cincin jenuh dan outline `ink`.
3. **Lingkungan diam, aktor hidup.** Lantai area main polos dan netral. Warna jenuh hanya untuk aktor, efek, dan titik cahaya.
4. **Diorama di bawah kaca.** Arena adalah Vitrine: tepian kaca rendah di batas, kilau kaca di sudut layar, dunia di luar batas tenggelam ke kabut.
5. **Keterbatasan terlihat sengaja.** Sprite kecil dengan sedikit warna, dibuat dari data. Tidak meniru aset, menu, atau komposisi game lain.

## 2. Palet

### 2.1 Palet inti [Wajib]
Persis tabel style guide 1.2 (token `ink` sampai `danger-core`, plus rarity). Disimpan di `art/palette.json` bagian `core`. Tidak ada warna sprite atau UI di luar palet inti dan palet bioma.

Token emisif tingkat palet (selalu bersinar, masuk bloom): `glint`, `kept-white`, `danger-core`. Sprite boleh menambah token emisif sendiri lewat field `emissive` (misalnya badan proyektil pemain `kept-cyan`). Proyektil musuh tidak memakai bloom scene karena digambar di lapis bahaya sesudah post-processing (bagian 9).

### 2.2 Aturan warna lingkungan bioma [Wajib]
- Token bioma hanya untuk lingkungan (faksi `env` atau `neutral`). Aktor tidak memakai token bioma.
- Lantai area main: saturasi HSV albedo di bawah 15%, nilai antara `floor-mid` dan `floor-lit`. Hasil akhir setelah cahaya dan grading: median saturasi lantai di area main paling tinggi 15% (diukur di render, bagian 11).
- Warna cahaya (kunci, isi, titik): saturasi HSV di bawah 60% (style guide 1.3).
- Lingkungan tidak memakai hue bahaya (merah, magenta, ungu) dengan saturasi di atas 35%, dan tidak memakai cyan atau emas jenuh. Bara dan nyala lilin boleh hangat oranye, hanya di luar batas arena.
- Warna emisif lingkungan (kertas lentera, lilin, bara) hanya di luar batas arena dan tidak pernah berupa objek kecil di area main.
- Kabut tepi memakai `void` bioma.

### 2.3 Bioma 1: The Moth Market (`biome_market`, id palet `b1`)
Pasar malam festival berlentera yang membeku saat langit jatuh. Nama kerja dari glosarium Writer. Rasa: hangat, ramai yang diam, titik cahaya amber di atas kain lusuh.

| Token | Hex | Pakai untuk |
|---|---|---|
| `b1.void` | `#1C1926` | Langit, kabut tepi (sama dengan `night`) |
| `b1.floor-dark` | `#57515A` | Sambungan batu lantai |
| `b1.floor-light` | `#6B6360` | Batu lantai area main |
| `b1.curb` | `#3E3A46` | Tanah di luar bibir arena |
| `b1.wood-dark` | `#3B302C` | Rangka kios, tiang lentera |
| `b1.wood` | `#5C4838` | Meja kios, papan |
| `b1.cloth-indigo` | `#3F4463` | Tenda kios (garis) |
| `b1.cloth-ochre` | `#7E6A4A` | Tenda kios (garis) |
| `b1.cloth-moss` | `#4E5A46` | Tenda kios (garis alternatif) |
| `b1.rope` | `#7A6C5A` | Tali lentera |
| `b1.paper` | `#D9BE92` | Kertas lentera (emisif) |
| `b1.flame` | `#FFE2B0` | Inti nyala lentera (emisif) |
| `b1.glass` | `#B7C3CB` | Tepian kaca, kilau kaca, debu kaca |

### 2.4 Bioma 2: Vesper Steps (`biome_cloister`, `b2`)
Biara bertangga di tebing pada malam bulan. Rasa: dingin, sunyi, lilin kecil di relung.

| Token | Hex | Pakai untuk |
|---|---|---|
| `b2.void` | `#171A24` | Langit, kabut tepi |
| `b2.floor-dark` | `#545458` | Sambungan lantai batu |
| `b2.floor-light` | `#68676A` | Lantai area main |
| `b2.curb` | `#3A3C45` | Tanah di luar bibir |
| `b2.stone-dark` | `#4A4B52` | Dinding belakang |
| `b2.stone` | `#7C7B7F` | Pilar, lengkung |
| `b2.stone-light` | `#A3A1A0` | Tepi pilar terkena bulan |
| `b2.moss` | `#5D6650` | Lumut di kaki dinding |
| `b2.banner` | `#6B5E4E` | Panji pudar |
| `b2.candle` | `#E9D3A8` | Batang lilin (emisif) |
| `b2.flame` | `#FFE9C4` | Nyala lilin (emisif) |
| `b2.glass` | `#B7C3CB` | Kaca |

### 2.5 Bioma 3: Stillfire Vineyard (`biome_vineyard`, `b3`)
Kebun anggur setengah terbakar, bara yang tidak pernah padam di cakrawala. Rasa: abu hangat, cahaya dari belakang.

| Token | Hex | Pakai untuk |
|---|---|---|
| `b3.void` | `#1D1716` | Langit, kabut tepi |
| `b3.floor-dark` | `#55524E` | Sambungan tanah padat |
| `b3.floor-light` | `#67625D` | Lantai area main |
| `b3.curb` | `#3D3633` | Tanah di luar bibir |
| `b3.charred` | `#2E2624` | Tiang dan tunggul hangus |
| `b3.vine-wood` | `#5A4636` | Batang anggur |
| `b3.leaf-dry` | `#6E6A48` | Daun kering |
| `b3.leaf-dead` | `#7A5E42` | Daun mati |
| `b3.ash` | `#8E8780` | Abu, asap tipis |
| `b3.trellis` | `#6D5D4E` | Para-para kayu |
| `b3.ember` | `#E0A070` | Bara di cakrawala dan tunggul (emisif, luar arena saja) |
| `b3.glass` | `#B7C3CB` | Kaca |

Catatan: lantai `b3` sengaja sedikit lebih netral dari draf awal (`#6A635B` menjadi `#67625D`) karena cahaya kunci oranye membuat median saturasi lantai melewati 15% di render uji.

Bioma 2 dan 3 memakai set Unlit yang sama dengan bioma 1 (keputusan Producer dan GD). Unlit tidak diberi palet bioma; yang berubah adalah cahaya dan lingkungan.

## 3. Skala sprite dan proporsi

### 3.1 Satuan [Wajib]
- 1 piksel sprite = 1 unit three.js (LP, architecture 7.1). 1 `u` gameplay = 16 piksel sprite = 1 tile (GDD, LD).
- Skala layar integer saja: 3x di 1920x1080, 2x di 1366x768 dan 1280x720 (LP 7.3). Resolusi virtual sekitar 640x360.
- Satu skala piksel untuk semua sprite dan tekstur di area main (P3-b, toleransi 0).

### 3.2 Ukuran per kelas aktor [Wajib]
Tinggi termasuk outline 1 px. Lebar maksimal adalah batas agar siluet tetap ramping di kerumunan.

| Kelas | Tinggi (px) | Lebar maks (px) | Bingkai (px) | Konsep saat ini |
|---|---|---|---|---|
| Pemain (Kept) | 18 sampai 22, target 20 | 16 | 24 x 24 | `kept-lantern`, `kept-bell`, `kept-blade`: 20 px |
| Unlit kecil (swarmer, mote) | 10 sampai 14 | 14 | 16 x 16 | `unlit-swarmer`: 10 px |
| Unlit sedang (charger, shooter, exploder, summoner, lobber) | 14 sampai 18, selalu lebih pendek dari pemain | 22 | 24 x 24 | 15 sampai 18 px |
| Unlit besar (tank) | 20 sampai 26 | 22 | 32 x 32 | `unlit-tank`: 24 px |
| Warden | 28 sampai 36 | 46 | 48 x 48 | `warden-hound`: 32 px, `warden-choir`: 34 px |
| Boss | 64 sampai 96 | 120 | 128 x 128 | `boss-lantern`: 83 px |
| Glint | 3 sampai 5 | 5 | 8 x 8 | `fx-glint`: 5 px |
| Proyektil musuh | 5 sampai 7 | 7 | 8 x 8 | `fx-shot-danger`: 7 px |
| Proyektil pemain | 3 sampai 6 | 6 | 8 x 8 | `fx-shot-kept`: 4 px |
| Potret the Glazier (UI) | 40 sampai 48 | 48 | 48 x 48 | belum (M2) |

Validator `tools/art/check-sprites.mjs` menolak sprite di luar rentang tinggi ini.

### 3.3 Proporsi semi-chibi pemain [Wajib]
Untuk tinggi 20 px (18 px gambar plus outline):

| Bagian | Piksel (tinggi) | Aturan |
|---|---|---|
| Kepala dan penutup kepala | 6 sampai 7 | Sekitar 1/3 tinggi. Siluet kepala adalah pembeda kelas |
| Wajah | 3 baris, lebar 4 | `bone`, mata 2 piksel `ink` berjarak 2 piksel. Tanpa mulut |
| Badan dan jubah | 8 sampai 9 | Garis tengah aksen (`kept-cyan` atau `kept-gold`) 2 px, tangan 1 px `bone` di sisi |
| Kaki | 2 | `shadow`, dua kaki terpisah 2 px |

- Minimal 15% piksel sprite (termasuk outline) adalah sorotan `kept-cyan`, `kept-gold`, `kept-white`, atau `glint` (style guide 1.3, dicek validator). Konsep: 18 sampai 26%.
- Pembeda kelas (GDD dan glosarium):

| Kelas (id) | Nama kerja | Kunci siluet | Aksen dominan |
|---|---|---|---|
| `lantern` | Lamplighter | Topi bertepi lebar dan datar | Emas |
| `bell` | Chorister | Tudung runcing | Biru dengan list cyan |
| `blade` | Vintner | Pelindung bahu lebar, kepala terbuka | Cyan |

### 3.4 Aturan bentuk Unlit [Wajib]
- Badan `unlit-body`, tepi atas dalam `unlit-rim` (otomatis), outline `ink` (otomatis).
- Mata atau inti selalu warna bahaya: `danger-red` (Unlit biasa), `danger-magenta` (Warden), `danger-violet` (pemanggil dan aura), inti `danger-core`.
- Tepat satu kejanggalan per jenis ("sedikit salah"), terlihat di ukuran asli.
- Unlit sedang lebih pendek dari pemain. Warden kira-kira 1,6 kali pemain. Boss mengisi 4 sampai 6 u.

## 4. Outline dan aturan menggambar piksel [Wajib]

- Outline luar 1 px `ink` dibuat otomatis oleh tool dari bentuk yang digambar (4-tetangga). Penggambar tidak menggambar outline luar.
- Unlit mendapat `unlit-rim` 1 px di tepi atas dalam secara otomatis.
- Tanpa outline: lingkungan, tile, proyektil pemain, VFX pemain.
- **Celah ruang negatif minimal 3 px.** Outline mengisi 1 px di tiap sisi celah, jadi celah 1 sampai 2 px hilang di uji siluet. Lengan, kaki, dan tanduk yang harus terbaca terpisah diberi jarak 3 px atau lebih dari badan. Temuan dari konsep: lengan Warden dan pemanggil menyatu dengan badan sebelum aturan ini.
- **Anggota tubuh 1 px tidak boleh berupa rantai diagonal.** Rantai diagonal menghasilkan outline papan catur. Pakai segmen lurus dengan tangga ortogonal (sambungan horizontal atau vertikal). Outline 8-tetangga sudah diuji dan ditolak sebagai default karena membuat siluet menjadi gumpalan.
- Tanpa anti-aliasing, tanpa piksel setengah transparan di sprite aktor, tanpa rotasi bebas, tanpa skala non-integer. Flip horizontal boleh.
- Kilat kena hit (runtime, bukan bingkai): pemain diisi `kept-white`, Unlit diisi `bone`, 2 bingkai (sekitar 66 ms). Pemain tidak pernah berkedip merah; tanda pemain kena hit ada di tepi layar (style guide 1.8).

## 5. Siluet tiap peran

### 5.1 Unlit [Wajib untuk keterbacaan, bentuk detail boleh berubah di M2]
Uji: isi sprite dengan satu warna gelap; peran harus bisa ditebak. Lihat `art/concept/02-actor-lineup.png` baris kedua.

| Peran (id GDD) | Sprite | Tinggi | Kunci siluet | Kejanggalan | Mata atau inti | Telegraf visual (GDD) |
|---|---|---|---|---|---|---|
| swarmer | `unlit-swarmer` | 10 | Kubah rendah lebar di atas banyak kaki | Tiga mata berjajar | `danger-red` | Tidak ada (serangan sentuh) |
| charger | `unlit-charger` | 16 | Berkaki empat horizontal, kepala ke depan | Kaki dengan lutut berlebih | `danger-red` | Outline dan mata berkedip `danger-red` 0,6 s plus garis arah putus-putus |
| shooter | `unlit-shooter` | 18 | Kepala lentera bulat di atas tangkai tipis | Cahayanya adalah lubang magenta | Inti `danger-core` dalam cincin `danger-magenta` | Inti menyala 0,4 s sebelum menembak |
| tank | `unlit-tank` | 24 | Balok lebar, kepala kecil, kepalan berat | Tanpa wajah, mata di dada | `danger-red` | Tidak ada |
| exploder | `unlit-exploder` | 15 | Bola bengkak di kaki pendek | Satu mata rendah di antara retakan | Retakan `danger-red`, mata `danger-core` | Berkedip makin cepat, lingkaran merah tumbuh ke 1,8 u |
| summoner | `unlit-summoner` | 17 | Bentuk Y, dua lengan terangkat memegang bola | Tanpa kaki, ujung jubah melayang | Bola `danger-violet`, mata `danger-red` | 3 lingkaran ungu kecil 0,8 s sebelum mote muncul |
| mote | belum (M2) | 8 sampai 10 | Tetes kecil dengan ekor | Bergerak terlalu mulus | `danger-violet` | Tidak ada |
| lobber | belum (Tingkat C) | 16 sampai 18 | Bungkuk dengan satu lengan panjang ke atas | Lengan lebih panjang dari badan | `danger-red` | Lingkaran 1,6 u di posisi pemain terisi 1,0 s |

### 5.2 Warden dan boss

| Id GDD | Sprite | Tinggi | Kunci siluet | Kejanggalan | Catatan |
|---|---|---|---|---|---|
| `warden_hound` (bioma 1, dasar charger) | `warden-hound` | 32 | Anjing raksasa dengan duri di punggung | Tiga mata magenta, kaki berlutut ganda | Aura `danger-violet` berupa decal cincin di lantai (runtime). Telegraf terjang sama dengan charger, diulang 3 kali |
| `warden_choir` (bioma 2, dasar shooter) | `warden-choir` (konsep) | 34 | Mahkota berduri, empat lengan panjang | Empat mata, siku berlebih | Inti dada `danger-violet` menyala sebelum kipas 5 proyektil |
| `warden_bulwark` (bioma 3) | belum | 30 sampai 36 | [Saran] perisai lebar setinggi badan | Perisai bermata | Tingkat C |
| `boss_lantern` (bioma 1) | `boss-lantern` | 83 | Lentera sangkar raksasa tergantung pada kait, sulur di bawah | Nyalanya lubang yang menyerap cahaya, mata merah tersebar tidak rata | Inti `danger-violet`/`danger-magenta`/`danger-core` menjadi titik fokus pola serangan |
| `boss_bell`, `boss_vine` | belum | 64 sampai 96 | [Saran] lonceng retak berkaki; pokok anggur yang merangkak | | Tingkat C |

## 6. Cahaya per bioma [Wajib]

Konvensi arah: azimut di bidang lantai dilihat dari kamera, 0 = dari sisi kamera (depan), 90 = dari kanan layar, 180 = dari belakang (sisi jauh), 270 = dari kiri layar. Elevasi dalam derajat di atas lantai. Intensitas relatif, kunci bioma 1 = 1,0.

| Bioma | Cahaya kunci | Cahaya isi | Titik cahaya | Lantai terang setelah kunci plus isi |
|---|---|---|---|---|
| b1 Moth Market | `#DCA466` amber redup, az 225 (kiri belakang), el 50, I 1,0, sat 54% | `#6F86B8` biru bulan, az 45 (kanan depan), el 35, I 0,45, sat 40% | Lentera `#E8B070`, I 0,8, radius 56 px (3,5 u), kedip 12%, sat 52% | `#6B6360` menjadi `#5A514C` |
| b2 Vesper Steps | `#A7B4CC` cahaya bulan perak, az 150 (kanan belakang), el 60, I 0,9, sat 18% | `#C99B6A` lilin hangat, az 300 (kiri depan, rendah), el 20, I 0,35, sat 47% | Lilin `#E2B47E`, I 0,6, radius 40 px, kedip 18%, sat 44% | `#68676A` menjadi `#555356` |
| b3 Stillfire Vineyard | `#C98A5A` bara dari cakrawala, az 180 (belakang), el 20, I 0,8, sat 55% | `#8C97A0` abu fajar, az 20 (depan atas), el 55, I 0,5, sat 12% | Bara `#D9955E`, I 0,55, radius 44 px, kedip 25%, sat 57% | `#67625D` menjadi `#58514A` |

Aturan:
- Tepat 1 cahaya kunci terarah plus 1 cahaya isi berwarna kontras per bioma (style guide 1.6). Lentera, lilin, dan bara adalah titik cahaya lokal di tepi arena, maksimal 8 aktif (LP 7.6) di kualitas Sedang dan Tinggi, 4 di Rendah.
- Permukaan hanya mengambil sebagian hue cahaya [Asumsi, M2]: di render konsep 15% hue cahaya diteruskan ke permukaan, sisanya menjadi terang netral. Ini yang menjaga lantai tetap netral (median saturasi 3,6 sampai 15,2%).
- Kecerahan dasar lantai di pusat arena sekitar 0,88 kali albedo. Pusat arena mendapat cahaya Pulse tambahan yang samar (pecahan di atas arena).
- Aktor Kept tidak pernah lebih gelap dari 70% warna dasarnya. Unlit tidak dijepit. Sprite menerima cahaya per instance di posisi kaki (LP 7.6).
- Kedip titik cahaya: noise halus 2 sampai 4 Hz, amplitudo sesuai tabel. Tidak pernah berkedip penuh (keamanan kilat, accessibility A-02).
- **Cahaya sebagai jam Pulse:** awal Pulse = cincin cahaya `b?.glass` mengembang dari pusat arena ke batas dalam 0,6 s, opasitas 35% lalu memudar, plus naik terang lantai 10% yang turun lagi dalam 1 s. Akhir Pulse = kilat kaca: garis retakan terang `bone` di tepi arena selama 0,25 s, lalu Unlit larut menjadi motes gelap. Kilat akhir mencakup kurang dari 25% luas layar dan hanya sekali (A-02).

## 7. Post-processing [Wajib]

Urutan pass milik LP (architecture 7.5): scene, bloom, tilt-shift plus komposit (vignette, grading, kilau kaca), lapis bahaya, upscale. Nilai art di bawah dalam piksel virtual (640x360).

| Efek | Nilai | Catatan |
|---|---|---|
| Tilt-shift DoF | Pita atas 54 px (15%), pita bawah 36 px (10%). Radius blur 0 di batas pita, naik dengan smoothstep ke maksimal 2 px virtual (6 px layar di 1080p) di tepi layar | Seluruh batas arena dan bibir 1 u di luar batas berada di luar pita (P3-c). Pita didefinisikan dalam piksel bingkai referensi, bukan persen layar (usul LD disetujui) |
| Bloom | Hanya piksel emisif (nilai HDR di atas 1,0). Intensitas 0,8, radius sekitar 3 px virtual | Efek pemain di-cap agar halonya tidak mengubah lantai lebih dari sekitar 30% terang di sekitar proyektil musuh |
| Vignette | Gelap 20% di sudut, mulai di jarak normal 0,55 dari pusat | Lembut, tidak menyentuh area tengah |
| Grading | Per bioma: bayangan ditarik ke `lift`, sorotan ke `gain`, kekuatan 0,08 | Nilai di `art/palette.json` |
| Kilau kaca | 2 sampai 3 garis diagonal tipis (1 sampai 2 px layar) di sudut kiri atas dan kanan bawah saja, opasitas 8 sampai 12%, warna `glass`, bergeser pelan sekitar 4 px layar per detik | Tidak pernah masuk area tengah. Mati di kualitas Rendah |
| Kabut tepi | Mulai 3 u di luar batas, penuh di 10 u, ke `void` bioma. Sisi belakang (dekorasi) memudar setengah laju | Arah LD 4.2 |

Permintaan AD ke LP [Saran, M2]: bloom dan hasil blur pita tepi dihitung di resolusi virtual, tapi disampel bilinear saat pass upscale (sprite tetap nearest). Tanpa ini, halo bloom dan blur pita tampil sebagai blok 3x3 di 1080p dan rasa HD-2D hilang. Biaya: satu tekstur tambahan di pass upscale. Render konsep memakai cara ini.

Kualitas grafis mengikuti tabel LP 7.7. Rendah mematikan DoF, bloom, dan kilau kaca tanpa mengubah kode warna atau lapisan (P3-f).

## 8. VFX

### 8.1 Kode warna efek [Wajib]
| Kubu | Warna yang boleh | Bentuk |
|---|---|---|
| Pemain (L3) | `kept-white` inti, `kept-cyan` badan, `kept-gold` hadiah, `kept-blue` untuk bayangan efek. Netral boleh | Tanpa outline. Opasitas area maksimal 60%, garis maksimal 2 px virtual. Bloom boleh |
| Bahaya (L4) | `danger-core` inti, `danger-red`/`danger-magenta`/`danger-violet` cincin dan isian, `ink` outline | Inti pucat plus cincin jenuh plus outline. Bulat atau simetris, tidak diputar |

### 8.2 Daftar efek inti

| Efek | Lapis | Visual | Durasi |
|---|---|---|---|
| Proyektil pemain | L3 | 4x4 `kept-white`/`kept-cyan`, jejak 3 sampai 4 piksel cyan memudar | Selama terbang |
| Percikan hit pemain | L3 | 3 sampai 5 piksel `kept-white` memencar | 0,15 s |
| Burn pada Unlit | L3 | Lidah api 2x3 `kept-gold` dan `kept-white` di atas kepala Unlit (efek milik pemain, bukan bagian sprite Unlit) | Selama status |
| Ledakan Lantern Bolt, zona api Rite | L3 | Isian `kept-gold` 25%, tepi `kept-white` putus-putus | Sesuai GDD |
| Glint jatuh dan dipungut | L2/L3 | Glint 2 bingkai berkilau; saat dipungut terbang ke pemain dengan jejak emas 2 piksel | 0,2 s |
| Level up, Keepsake | L3 | Cincin `kept-gold` mengembang dari kaki pemain, 8 piksel naik | 0,5 s |
| Rite siap | UI dan L1 | Cincin kaki pemain berdenyut emas satu kali | 0,3 s |
| Telegraf area | L4 | Isian `danger-red` 30% tumbuh dari tengah ke tepi selama waktu telegraf, tepi solid 1 px | Sesuai GDD |
| Telegraf terjang | L4 | Outline dan mata berkedip `danger-red`, garis arah putus-putus (3 px isi, 3 px kosong) | 0,6 s |
| Telegraf spawn (retakan) | L4 | Retakan bercabang `danger-violet` tumbuh dari titik, tepi lingkaran solid (diameter dari LD) | Sesuai LD |
| Proyektil musuh | L4 | `fx-shot-danger` 7x7, tiga lapis | Selama terbang |
| Aura Warden | L1 | Cincin `danger-violet` 70% plus isian 14%, radius 1,75 u | Selama hidup |
| Kematian Unlit | L3 | 4 sampai 8 motes `unlit-body` dan `unlit-rim` memencar dan memudar | Kurang dari 0,3 s |
| Pemain kena hit | Layar | Kilat tepi layar `danger-red` tipis 6 px virtual, sprite kilat `kept-white` | 0,2 s |
| Kematian pemain | L3 | Serpihan kaca `kept-blue` dan `kept-cyan`, layar melambat | 0,8 s |
| Suasana | L0/L3 | Debu kaca `glass` melayang (semua bioma), ngengat di sekitar lentera (b1), abu di berkas bulan (b2), bara naik (b3) | Terus menerus |

### 8.3 Batas dan aksesibilitas [Wajib]
- Jumlah partikel mengikuti batas LP 7.7 (300, 600, 1000).
- "Reduce Effects" (A-02): partikel suasana dan ledakan maksimal 30%, tanpa getar layar, tanpa kilat layar penuh. Telegraf dan kilat kena hit tetap ada, lebih lembut.
- Keamanan kilat: tidak ada efek yang berkedip lebih dari 3 kali per detik di area lebih dari 25% layar. Kedip exploder yang makin cepat hanya pada sprite kecil, jadi aman.
- Mode buta warna (A-04) [Asumsi, palet final di M4 setelah simulasi Machado 2009]: arah awal:
  - Protanopia dan deuteranopia: `danger-red` digeser ke merah kemagentaan yang lebih terang dan inti bahaya tetap `danger-core`; `kept-gold` tetap. Pembeda utama tetap nilai (inti pucat plus outline gelap) dan bentuk.
  - Tritanopia: `danger-violet` digeser ke magenta agar tidak dekat dengan `kept-blue`; cyan pemain digeser sedikit ke hijau kebiruan.
  - Semua mode tetap mematuhi aturan kubu dan diuji ulang P2-c dengan screenshot tersimulasi.

## 9. Urutan lapisan

Mengikuti LP architecture 7.4 [Wajib]: L0 lantai dan dekorasi, L1 decal lantai (bayangan, cincin pemain, aura Warden), L2 aktor dan Glint diurutkan menurut kaki, L3 efek pemain, L4 bahaya (isian dan tepi telegraf, proyektil musuh) digambar sesudah seluruh post-processing. Konsekuensi art: kilau proyektil musuh tidak berasal dari bloom scene; bila perlu kilau, digambar di shader L4 sendiri. Render konsep sudah memakai urutan ini.

## 10. Lingkungan dan dekorasi

- Arena dan zona dekorasi milik LD (`docs/levels/arena-design.md`): arena 32 x 20 u bersudut terpotong 3 u, dekorasi hanya di luar batas, belakang bebas tinggi, samping maksimal 6 u, depan maksimal 0,5 u.
- Bibir 1 u di luar batas bernilai lantai. Tepian kaca di garis batas: `dust` sekitar 50%, sekitar 2 px tampak.
- Low-poly dari primitif three.js dengan tekstur piksel prosedural (detail di `docs/art-pipeline.md` bagian 6).
- Minimal 3 elemen bergerak per bioma (P3-d):

| Bioma | Elemen bergerak |
|---|---|
| b1 | Lentera berkedip dan berayun pelan, ngengat mengitari lentera, kain tenda bergoyang, debu kaca |
| b2 | Lilin berkedip, panji bergoyang, abu atau debu di berkas bulan, debu kaca |
| b3 | Bara naik dari cakrawala dan tunggul, asap tipis, daun kering bergetar, debu kaca |

- Kontras dan saturasi lingkungan tidak boleh melebihi aktor (P3 kriteria tolak). Dekorasi belakang berada di pita blur atas sehingga otomatis lebih lembut.

## 11. Bukti dari konsep (render CPU, bukan game)

Diukur oleh `tools/art/build-concepts.mjs` pada gambar akhir setelah post-processing. Rasio WCAG, piksel sprite terhadap median lantai di sekitarnya (jendela 15 px). Data lengkap di `art/concept/measurements.json`.

| Ukuran | Syarat | b1 | b2 | b3 |
|---|---|---|---|---|
| Inti proyektil musuh vs lantai, minimum | 4,5:1 (P2-c) | 5,24 | 5,11 | 5,35 |
| Cyan pemain vs lantai, minimum | 3,5:1 (P2-c) | 4,17 | 4,00 | 4,22 |
| Inti proyektil pemain vs lantai, minimum | 3,5:1 | 6,35 | 6,08 | 6,45 |
| Badan Unlit vs lantai, median | 2:1 (P2-c) | 2,29 | 2,26 | 2,15 |
| Badan Unlit vs lantai, persentil 10 | 2:1 | 1,85 | 1,87 | 1,96 |
| Median saturasi lantai area main | di bawah 15% | 14,5% | 3,6% | 15,2% |

Temuan:
1. Render pertama gagal (inti bahaya 3,77:1, cyan 3,16:1, saturasi lantai 28%). Penyebab: lantai terlalu terang, halo bloom proyektil musuh menaikkan terang lantai di sekitarnya, dan hue cahaya hangat diteruskan penuh. Perbaikan yang sekarang menjadi aturan: kecerahan lantai sekitar 0,88 albedo, hue cahaya 15% ke permukaan, proyektil musuh tanpa bloom scene (lapis L4).
2. Badan Unlit di bawah 2:1 di sekitar 10% piksel, terutama di bawah isian telegraf merah, di kolam cahaya lentera, dan di dalam aura Warden. Median lolos. Usulan: P2-c untuk badan Unlit diukur per aktor (median), dan rim `unlit-rim` plus outline `ink` menjaga bentuk di area terang. Perlu persetujuan CD (pertanyaan terbuka).
3. Median saturasi lantai b3 15,2%, tepat di batas. Kalibrasi lanjut di M2 dengan cahaya three.js sungguhan.
4. Uji nilai (`art/concept/05-readability-check.png`): tiga lapis terpisah. Sorotan pemain, Glint, dan proyektil terang; lantai sedang; Unlit gelap (P2-b versi konsep).

## 12. Konsep mood

| File | Isi | Untuk CD lihat |
|---|---|---|
| `art/concept/01-palette-biomes.svg` | Palet inti, palet 3 bioma, cahaya kunci, isi, titik dengan saturasi, lantai setelah cahaya dengan rasio kontras, strip keterbacaan | Harmoni palet dan perbedaan rasa antar bioma |
| `art/concept/02-actor-lineup.png` | Semua sprite konsep dalam warna, siluet datar, dan grayscale (4x), plus barisan skala di skala game 3x dengan boss | Siluet kelas dan peran, skala relatif |
| `art/concept/03-arena-lantern-market.png` | Layar arena b1 1920x1080 pada detik ramai: 43 swarmer dan Unlit lain, Warden, telegraf, proyektil, Glint | Rasa diorama, keterbacaan (uji 1 detik versi konsep) |
| `art/concept/04-biome-moods.png` | Arena yang sama di 3 bioma (1280x720 per panel) | Rasa cahaya per bioma |
| `art/concept/05-readability-check.png` | Arena b1 dalam grayscale dan peta tiga nilai | P2-b |

Semua dibuat ulang dengan `node tools/art/build-concepts.mjs` (sekitar 5 detik). Konsep tidak memakai HUD (milik UI) dan memakai pendekatan layar 2D dari kamera ortografis, bukan three.js.

## 13. Keputusan AD di dokumen ini

1. Palet tiga bioma dan cahaya kunci, isi, titik seperti bagian 2 dan 6.
2. Cahaya kunci b1 `#DCA466` (bukan `#E0A458` dari saran style guide) karena `#E0A458` bersaturasi HSV 61%, melewati batas 60%. Masih "sekitar" saran CD.
3. Outline otomatis 4-tetangga, aturan celah 3 px, dan larangan rantai diagonal.
4. Kilat kena hit: `kept-white` untuk pemain, `bone` untuk Unlit.
5. Proyektil musuh tanpa bloom scene; kilau bahaya di shader L4 bila diperlukan.
6. Nama sprite mengikuti id GDD (`unlit-swarmer` untuk `swarmer`, dan seterusnya) dan nama kerja bioma dari glosarium.
