# Shardfall: Glosarium

Pemilik: Writer (WR). Reviewer: Creative Director (CD). Status: draf M0 (versi 1, 2026-11-16).
Dasar: `docs/vision.md` bagian 5, `docs/style-guide.md` bagian 4.3 dan 4.4, `docs/narrative/lore-premise.md`.

Cara pakai:
- Kolom **EN** adalah teks game (Inggris) dengan kapitalisasi yang wajib.
- Kolom **ID** adalah draf terjemahan untuk kolom `id` di string table. Belum final; lokalisasi penuh di luar 1.0.
- **Status:** `Inti` = keputusan CD di vision.md. `Usulan` = usulan Writer, menunggu persetujuan CD. `Kerja` = nama kerja yang disetujui CD, boleh diganti.
- Identifier kode mengikuti vision.md bagian 5.

## 1. Istilah inti dunia

| EN | ID | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|
| the Pane | Langit Kaca | Kubah kaca yang dulu menjadi langit dan menahan the Unlit | Lore saja, hampir tidak di UI. Selalu "the Pane", huruf P kapital | Inti |
| the Unlit | Yang Padam | Kelaparan tanpa cahaya dari luar the Pane; semua musuh | Tunggal "an Unlit", jamak "the Unlit". Tidak pernah "Unlits". ID tunggal: "sesosok Padam" | Inti |
| Vitrine | Vitrin | Petak tanah yang dibekukan sebuah keping langit; arena | Nama bioma berdiri sendiri, kata "Vitrine" dipakai di judul layar menang. Jamak "Vitrines" | Inti |
| Kept | Tersimpan | Penyintas yang disimpan keping karena sedang memegang cahaya; pemain | Tunggal dan jamak sama: "a Kept", "the Kept". "You are Kept." | Inti |
| the Glazier | Sang Juru Kaca | Pedagang bertopeng; fase toko | Judul layar toko "The Glazier". Tidak pernah ditulis "shop" | Inti |
| Glint | Kerlip | Debu kaca langit; mata uang run sekaligus XP | Tidak dihitung jamak ("12 Glint"). Ganti semua Gold, Coin, XP | Inti |
| Silt | Endapan | Cahaya Kept yang mengendap; mata uang meta | Hanya di layar akhir run dan meta. "40 Silt" | Inti |
| Keepsake | Tanda Mata | Benda yang ikut tersegel di kaca; relic | Ganti kata Relic. Risiko tinggi, lihat bagian 6 | Inti (usul ganti) |
| Warden | Penjaga | Unlit bernama yang menelan banyak benda; elite | Nama Warden tampil saat muncul. Ganti kata Elite | Inti |
| Rite | Ritus | Skill aktif kelas dengan cooldown | Ganti kata Ultimate dan Special. Nama Rite per kelas maks 3 kata | Inti |
| Pulse | Denyut | Satu gelombang, satu denyut cahaya keping | "Pulse 7", tidak pernah "Wave 7" di teks game | Inti |

## 2. Istilah pendukung dunia

| EN | ID | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|
| shard / piece | keping | Pecahan the Pane yang menyegel sebuah Vitrine | Huruf kecil. "Shard" kapital hanya sebagai tag | Usulan |
| crack | retakan | Celah di keping tempat the Unlit merembes dan the Glazier masuk | Huruf kecil. Dipakai di flavor dan baris the Glazier | Usulan |
| motes | serpih gelap | Partikel gelap saat Unlit hancur | Lore dan deskripsi VFX, jarang di UI | Usulan |
| boss | (nama sendiri) | Musuh di Pulse terakhir bioma, dari retakan terdalam | Kata "boss" hanya di dokumen. Di game tampil nama saja | Inti |

## 3. Istilah UI dan loop

| EN | ID | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|
| Temper | Tempa | Momen level-up: pilih 1 dari 3 kartu per level | Judul panel level-up. Ganti kata "Level Up" bila CD setuju; bila tidak, pakai "Level Up" | Usulan |
| Fuse | Lebur | Gabungkan dua item sejenis untuk naik tier | Tombol dan label merge di toko | Usulan |
| Reroll | Kocok Ulang | Ganti isi nampan the Glazier | Tombol. Sudah dipakai di style guide | Kerja |
| Begin Pulse | Mulai Denyut | Tombol keluar toko dan mulai Pulse berikutnya | Tombol | Kerja |
| Kept Lost | Tersimpan Pecah | Judul layar mati (akhir run kalah) | Diikuti "Another wakes beneath the glass." | Kerja |
| Vitrine Steady | Vitrin Tenang | Judul layar menang satu bioma | Hanya bila ada bioma berikutnya | Usulan |
| Light Kept | Cahaya Tersimpan | Judul layar akhir run penuh (menang) | Membalik "Kept Lost" | Usulan |
| The Keeping | Penyimpanan | Layar meta tempat Silt dibelanjakan | Membuka kelas dan Keepsake, bukan stat permanen | Usulan |
| tier I, II, III, IV | tingkat I, II, III, IV | Tingkat item hasil Fuse | Tampil angka Romawi. Jumlah tier milik GD | Usulan |
| HP | HP | Ketahanan kaca tubuh Kept | Tetap "HP" demi keterbacaan (Pilar 4). Lore: retakan di tubuh Kept | Usulan |

## 4. Tag sinergi dan rarity

Tag selalu kapital. Jumlah dan efek milik GD; definisi di bawah hanya rasa, untuk menyelaraskan flavor.

| EN | ID | Definisi singkat (rasa) | Catatan pemakaian | Status |
|---|---|---|---|---|
| Flame | Api | Panas, bakar, lentera, sumbu | Flavor menyinggung panas atau api | Kerja |
| Shard | Serpih | Pecahan kaca, pantulan, tembus | Beda dari "shard" huruf kecil (keping langit) | Kerja |
| Edge | Tajam | Sabetan, irisan, jarak dekat | Flavor menyinggung pisau, tepi, pangkas | Kerja |
| Echo | Gema | Ulang, pantul, suara, lonceng | Flavor menyinggung bunyi atau pengulangan | Kerja |
| Ward | Tangkal | Lindung, dorong, perisai cahaya | Jangan tertukar dengan "Warden" (lihat risiko) | Kerja |
| Trade | Niaga | Glint, harga, the Glazier | Flavor menyinggung tawar, timbang, nampan | Kerja |
| Plain | Biasa | Rarity terendah | Warna `#C9C2B6` | Kerja |
| Fine | Halus | Rarity kedua | Warna `#6FD08C` | Kerja |
| Rare | Langka | Rarity ketiga | Warna `#3D7DFF` | Kerja |
| Fabled | Legenda | Rarity tertinggi | Warna `#FFC94A` | Kerja |

Keputusan Writer soal rarity: **pertahankan Plain, Fine, Rare, Fabled.** Kata umum lebih cepat dibaca di uji kartu 3 detik (Pilar 4). Alternatif bertema kaca bila CD ingin rasa lebih kuat: Rough, Clear, Cut, Gilded (urutan naik), dengan risiko lebih lambat dipahami.

## 5. Nama usulan (bioma, kelas)

| EN | ID | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|
| The Moth Market | Pasar Ngengat | Bioma 1: pasar malam festival berlentera | 3 kata. Bioma lantai rilis | Usulan |
| Vesper Steps | Tangga Senja | Bioma 2: biara bertangga di tebing | 2 kata. Tingkat C | Usulan |
| Stillfire Vineyard | Kebun Api Diam | Bioma 3: kebun anggur setengah terbakar | 2 kata. Tingkat C | Usulan |
| Lamplighter | Penyulut Lentera | Kelas: penyulut lentera, aksen emas | 1 kata EN. Kelas awal bila hanya 1 kelas | Usulan |
| Chorister | Penyanyi Kor | Kelas: penyanyi biara, aksen biru | 1 kata EN | Usulan |
| Vintner | Pekebun Anggur | Kelas: pekebun anggur, aksen cyan | 1 kata EN | Usulan |

## 6. Cek orisinalitas istilah utama

Metode: pengecekan wajar berdasarkan pengetahuan Writer, tanpa web. Hasil ini **bukan** pencarian merek dagang. Ulangi dengan pencarian web dan basis data toko (Steam, itch.io) di M3 sebelum CD mengunci nama.

Skala risiko: **Rendah** = kata umum, tidak dikenal sebagai istilah khas game. **Sedang** = dipakai menonjol di game lain dengan fungsi berbeda, atau mirip istilah terkenal. **Tinggi** = istilah khas game lain dengan fungsi serupa, terutama game yang ada di daftar referensi kita.

| Istilah | Temuan | Risiko | Saran |
|---|---|---|---|
| **Keepsake** | Nama sistem benda yang dibawa pemain di Hades (dan Hades II). Hades adalah referensi roguelike kita, dan fungsinya serupa (benda pemberi efek pasif) | **Tinggi** | Usul ganti. Kandidat: **Memento** (hangat, melankolis, mudah dibaca; "Mementos" di Persona 5 adalah nama tempat, bukan item), **Inclusion** (istilah benda yang terperangkap di kaca atau ambar, lore paling tepat, tapi kurang lazim). Writer merekomendasikan Memento. Sampai CD memutuskan, dokumen tetap memakai Keepsake |
| **Warden** | Mob terkenal di Minecraft; juga kata umum di banyak game (kelas, gelar) | Sedang | Boleh dipertahankan karena kata umum dan fungsinya beda. Alternatif bila ingin aman: **Bellwether** (pemimpin kawanan). Juga dekat dengan tag "Ward"; bedakan ikon |
| **Glint** | Kata umum. Mirip makna dengan "Glimmer", mata uang di Destiny, tapi kata berbeda | Rendah sampai sedang | Pertahankan |
| **Silt** | Judul game indie 2022 (puzzle bawah air), bukan istilah di dalam game | Rendah sampai sedang | Pertahankan. Alternatif bila perlu: **Lees** (endapan anggur, cocok bioma 3) |
| **the Unlit** | Kata sifat umum. Rasanya dekat dengan "Unkindled" dan "Ashen One" dari seri Dark Souls, tapi katanya berbeda | Rendah | Pertahankan. Jangan memakai "Unkindled", "Ashen", atau "Hollow" di teks |
| **Shardfall** (judul kerja) | Kata gabungan yang mudah muncul di produk lain; Writer tidak yakin bebas. Ada judul mirip seperti Shardlight dan Shardbound | Sedang | Sudah dijadwalkan: 5 kandidat judul di `title-candidates.md` (M3), dicek web |
| the Pane, Vitrine, Kept, the Glazier, Rite, Pulse | Kata umum atau istilah profesi; tidak dikenal sebagai istilah khas game tertentu | Rendah | Pertahankan |
| Flame, Shard, Edge, Echo, Ward, Trade | Kata generik yang dipakai banyak game sebagai elemen atau kategori | Rendah | Pertahankan |
| Plain, Fine, Rare, Fabled | Kata umum. "Fine" dipakai sebagai tingkat kualitas di beberapa MMO, tapi bukan susunan yang sama | Rendah | Pertahankan |
| Temper, Fuse, The Keeping | Istilah kerajinan kaca dan kata umum | Rendah | Pertahankan |
| The Moth Market, Vesper Steps, Stillfire Vineyard | Tidak dikenal sebagai lokasi game lain | Rendah | Cek ulang di M3 |
| Lamplighter, Chorister, Vintner | Nama profesi umum. "Lamplighter" muncul sebagai nama tokoh atau judul kecil di beberapa karya | Rendah | Pertahankan |

Risiko tambahan (bukan jiplakan): motif "keep" muncul di Kept, Keepsake, The Keeping, dan Light Kept. Ini benang merah yang disengaja, tapi bisa membingungkan pemain baru. Bila Keepsake diganti Memento, kepadatan kata "keep" turun dan risiko ini ikut berkurang.
