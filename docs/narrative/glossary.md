# Shardfall: Glosarium

Pemilik: Writer (WR). Reviewer: Creative Director (CD). Status: versi 2 (2026-11-17, perbaikan review M0 CD dan tugas M1-08).
Dasar: `docs/vision.md` bagian 5, `docs/style-guide.md` bagian 4.3 dan 4.4, `docs/narrative/lore-premise.md`, keputusan CD di `docs/reviews/M0-cd.md` (K1, K2).
Teks game yang dipakai build ada di `content/strings/en.json` (EN) dan `content/strings/id.json` (ID). Catatan kunci dan parameter: `docs/narrative/string-table.md`.

Perubahan versi 2:
- Keepsake diganti **Memento** (keputusan CD K1). Keepsake kini kata terlarang.
- Temper, Fuse, The Keeping, Vitrine Steady, Light Kept, Crack, tiga bioma, dan tiga kelas naik status menjadi **Inti** (CD K2). Rarity dikunci.
- Nama kerja GD yang memakai kata terlarang diganti: "Ashen Crown" menjadi **Candle Crown**, "Tithe Coin" menjadi **Tithe Shard** (id tetap `ashen_crown`, `tithe_coin`).
- Bagian 6 dan 7 baru: kata yang harus diganti, dan nama konten Tingkat A (senjata, Memento, Unlit, Warden, boss, Rite) berstatus Usulan.

Cara pakai:
- Kolom **EN** adalah teks game (Inggris) dengan kapitalisasi yang wajib.
- Kolom **ID** adalah terjemahan untuk `content/strings/id.json`. Lokalisasi penuh di luar 1.0; ID disiapkan agar kunci sudah sejajar.
- **Status:** `Inti` = keputusan CD (vision.md bagian 5 atau review M0). `Usulan` = usulan Writer, menunggu persetujuan CD. `Kerja` = nama kerja yang disetujui CD, boleh diganti.
- Identifier kode mengikuti vision.md bagian 5 dan architecture.md 9.2 (`snake_case`).

## 1. Istilah inti dunia

| EN | ID | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|
| the Pane | Langit Kaca | Kubah kaca yang dulu menjadi langit dan menahan the Unlit | Lore saja, hampir tidak di UI. Selalu "the Pane", huruf P kapital | Inti |
| the Unlit | Yang Padam | Kelaparan tanpa cahaya dari luar the Pane; semua musuh | Tunggal "an Unlit", jamak "the Unlit". Tidak pernah "Unlits". ID tunggal: "sesosok Padam" | Inti |
| Vitrine | Vitrin | Petak tanah yang dibekukan sebuah keping langit; arena | Nama bioma berdiri sendiri, kata "Vitrine" dipakai di judul "Vitrine Steady". Jamak "Vitrines" | Inti |
| Kept | Tersimpan | Penyintas yang disimpan keping karena sedang memegang cahaya; pemain | Tunggal dan jamak sama: "a Kept", "the Kept". "You are Kept." | Inti |
| the Glazier | Sang Juru Kaca | Pedagang bertopeng; fase toko | Judul layar toko "The Glazier". Tidak pernah ditulis "shop" | Inti |
| Glint | Kerlip | Debu kaca langit; mata uang run sekaligus XP | Tidak dihitung jamak ("12 Glint"). Ganti semua Gold, Coin, XP | Inti |
| Silt | Endapan | Cahaya Kept yang mengendap; mata uang meta | Hanya di layar akhir run dan meta. "40 Silt" | Inti |
| Memento | Kenangan | Benda yang ikut tersegel di kaca; relic | Jamak "Mementos". Identifier `memento`. Ganti kata Relic dan Keepsake | Inti |
| Warden | Penjaga | Unlit bernama yang menelan banyak benda; elite | Nama Warden tampil saat muncul. Ganti kata Elite. Tidak ada Warden tunggal bernama "the Warden" | Inti |
| Rite | Ritus | Skill aktif kelas dengan cooldown | Ganti kata Ultimate dan Special. Nama Rite per kelas maks 3 kata | Inti |
| Pulse | Denyut | Satu gelombang, satu denyut cahaya keping | "Pulse 7", tidak pernah "Wave 7" di teks game | Inti |

## 2. Istilah pendukung dunia

| EN | ID | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|
| shard / piece | keping | Pecahan the Pane yang menyegel sebuah Vitrine | Huruf kecil. "Shard" kapital hanya sebagai tag | Usulan |
| crack | retakan | Celah di keping tempat the Unlit merembes dan the Glazier masuk | Huruf kecil di flavor dan baris the Glazier. "Crack" kapital hanya untuk kesulitan | Usulan |
| motes | serpih gelap | Partikel gelap saat Unlit hancur | Lore dan deskripsi VFX, jarang di UI | Usulan |
| boss | (nama sendiri) | Musuh di Pulse terakhir bioma, dari retakan terdalam | Kata "boss" hanya di dokumen. Di game tampil nama saja | Inti |
| foe | musuh | Kata pendek untuk Unlit di baris efek | Hanya di baris efek agar cepat dibaca (contoh style guide 4.1). Nama dan flavor memakai "Unlit" | Usulan |

## 3. Istilah UI dan loop

| EN | ID | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|
| Temper | Tempa | Momen level-up: pilih 1 dari 3 kartu per level | Judul panel level-up. Subjudul dan HUD tetap "Lv 5" | Inti |
| Fuse | Lebur | Gabungkan dua item sejenis untuk naik tier | Tombol dan lencana "Fuse > II". Identifier boleh tetap `merge` | Inti |
| Reroll | Kocok Ulang | Ganti isi nampan the Glazier | Tombol | Kerja |
| Begin Pulse | Mulai Denyut | Tombol keluar toko dan mulai Pulse berikutnya | Tombol | Kerja |
| Kept Lost | Tersimpan Pecah | Judul layar mati (akhir run kalah) | Diikuti "Another wakes beneath the glass." | Kerja |
| Vitrine Steady | Vitrin Tenang | Judul layar antara bioma (bukan akhir run) | Hanya bila ada bioma berikutnya (Tingkat C) | Inti |
| Light Kept | Cahaya Tersimpan | Judul layar akhir run penuh (menang) | Membalik "Kept Lost". Mengganti draf "The Light Holds" | Inti |
| The Keeping | Penyimpanan | Layar meta tempat Silt dibelanjakan | Mengganti "Archive" di UI. Tab "Kept" dan "Mementos" | Inti |
| Crack | Retak | Tingkat kesulitan | Mengganti "Depth" di UI: "Crack 2". Diegetik: langit makin retak | Inti |
| Held | Tertahan | Label bar HP Warden saat Pulse ditahan | Slot timer HUD (CD K3) | Usulan |
| tier I, II, III, IV | tingkat I, II, III, IV | Tingkat item hasil Fuse | Tampil angka Romawi. Jumlah tier milik GD | Usulan |
| HP | HP | Ketahanan kaca tubuh Kept | Tetap "HP" demi keterbacaan (Pilar 4). Lore: retakan di tubuh Kept | Usulan |

## 4. Tag sinergi, status, dan rarity

Tag selalu kapital. Jumlah dan efek milik GD; definisi di bawah hanya rasa, untuk menyelaraskan flavor.

| EN | ID | Definisi singkat (rasa) | Catatan pemakaian | Status |
|---|---|---|---|---|
| Flame | Api | Panas, bakar, lentera, sumbu | Flavor menyinggung panas atau api. Tingkat A | Kerja |
| Shard | Serpih | Pecahan kaca, pantulan, tembus | Beda dari "shard" huruf kecil (keping langit). Tingkat A | Kerja |
| Edge | Tajam | Sabetan, irisan, jarak dekat | Flavor menyinggung pisau, tepi, pangkas. Tingkat A | Kerja |
| Echo | Gema | Ulang, pantul, suara, lonceng | Tingkat B | Kerja |
| Ward | Tangkal | Lindung, dorong, perisai cahaya | Jangan tertukar dengan "Warden". Tingkat B | Kerja |
| Trade | Niaga | Glint, harga, the Glazier | Tingkat B | Kerja |
| Burn | Terbakar | Status api pada Unlit | Kapital di baris efek: "Hits Burn foes" | Usulan |
| Slow | Lambat | Status memperlambat Unlit | Kapital di baris efek | Usulan |
| Mark | Tanda | Status: Unlit menerima damage lebih | Kapital di baris efek | Usulan |
| Rush | Deru | Tumpukan dari Edge 6 | Kapital di baris efek | Usulan |
| Plain | Biasa | Rarity terendah | Warna `#C9C2B6` | Inti |
| Fine | Halus | Rarity kedua | Warna `#6FD08C` | Inti |
| Rare | Langka | Rarity ketiga | Warna `#3D7DFF` | Inti |
| Fabled | Legenda | Rarity tertinggi | Warna `#FFC94A` | Inti |

Rarity dikunci CD (K2): alternatif bertema kaca ditolak demi uji kartu 3 detik.

## 5. Bioma dan kelas (final, CD K2)

| EN | ID | Id data | Definisi singkat | Catatan pemakaian | Status |
|---|---|---|---|---|---|
| The Moth Market | Pasar Ngengat | `biome_market` | Bioma 1: pasar malam festival berlentera | 3 kata. Bioma lantai rilis | Inti |
| Vesper Steps | Tangga Senja | `biome_cloister` | Bioma 2: biara bertangga di tebing | 2 kata. Tingkat C | Inti |
| Stillfire Vineyard | Kebun Api Diam | `biome_vineyard` | Bioma 3: kebun anggur setengah terbakar | 2 kata. Tingkat C | Inti |
| Lamplighter | Penyulut Lentera | `lantern` | Kelas: penyulut lentera, aksen emas | 1 kata EN. Kelas Tingkat A | Inti |
| Chorister | Penyanyi Kor | `bell` | Kelas: penyanyi biara, aksen biru | 1 kata EN. Tingkat B | Inti |
| Vintner | Pekebun Anggur | `blade` | Kelas: pekebun anggur, aksen cyan | 1 kata EN. Tingkat B | Inti |

Nama bioma dan kelas tetap dicek ulang dengan web di M3 (CD bagian 5).

## 6. Kata yang harus diganti di nama kerja

| Nama kerja | Masalah | Pengganti | Id (tetap) | Status |
|---|---|---|---|---|
| Keepsake | Nama sistem Hades (CD K1) | Memento | `memento` | Inti |
| Ashen Crown | "Ashen" kata terlarang (style guide 4.3, Dark Souls) | Candle Crown | `ashen_crown` | Usulan |
| Tithe Coin | "Coin" istilah mata uang yang sudah diganti Glint | Tithe Shard | `tithe_coin` | Usulan |
| Headsman Hook | Tidak terlarang; diganti karena terlalu suram dan tanpa benang lore | Pruning Hook | `headsman_hook` | Usulan |
| Returning Glaive | "Glaive" senjata lempar khas beberapa franchise | Homeward Blade | `returning_glaive` | Usulan |

## 7. Nama konten Tingkat A (usulan Writer, M1-08)

Id tetap dari GD (`docs/gdd.md` v2). Nama mengikuti batas style guide 4.2. Teks lengkap (efek, flavor) ada di string table.

| Jenis | Id | Nama EN | Nama ID | Nama kerja GD | Status |
|---|---|---|---|---|---|
| Rite | `flare_lantern` | Festival Flare | Suar Festival | Flare | Usulan |
| Senjata | `lantern_bolt` | Lantern Bolt | Peluru Lentera | Lantern Bolt | Usulan (tetap) |
| Senjata | `splinter_shot` | Sky Splinter | Serpih Langit | Splinter Shot | Usulan |
| Senjata | `arc_blade` | Harvest Sickle | Arit Panen | Arc Blade | Usulan |
| Senjata | `orbit_shards` | Glass Halo | Lingkar Kaca | Orbit Shards | Usulan |
| Senjata | `chain_spark` | Leaping Wick | Sumbu Melompat | Chain Spark | Usulan |
| Senjata | `returning_glaive` | Homeward Blade | Bilah Pulang | Returning Glaive | Usulan |
| Senjata (Tk B) | `tithe_coin` | Tithe Shard | Serpih Upeti | Tithe Coin | Usulan |
| Memento | `coal_locket` | Coal Locket | Liontin Arang | Coal Locket | Usulan (tetap) |
| Memento | `kindling_jar` | Kindling Jar | Stoples Ranting | Kindling Jar | Usulan (tetap) |
| Memento | `torch_glove` | Torch Glove | Sarung Obor | Torch Glove | Usulan (tetap) |
| Memento | `ashen_crown` | Candle Crown | Mahkota Lilin | Ashen Crown | Usulan |
| Memento | `smolder_boots` | Smolder Boots | Sepatu Bara | Smolder Boots | Usulan (tetap) |
| Memento | `glass_marble` | Glass Marble | Kelereng Kaca | Glass Marble | Usulan (tetap) |
| Memento | `prism_lens` | Prism Lens | Lensa Prisma | Prism Lens | Usulan (tetap) |
| Memento | `shard_pouch` | Pocket of Sky | Saku Langit | Shard Pouch | Usulan |
| Memento | `splinter_comb` | Splinter Comb | Sisir Serpih | Splinter Comb | Usulan (tetap) |
| Memento | `whetstone` | Whetstone | Batu Asah | Whetstone | Usulan (tetap) |
| Memento | `duelist_ribbon` | Duelist Ribbon | Pita Duelis | Duelist Ribbon | Usulan (tetap) |
| Memento | `headsman_hook` | Pruning Hook | Kait Pangkas | Headsman Hook | Usulan |
| Unlit | `swarmer` | Lampmoth | Ngengat Lampu | swarmer | Usulan |
| Unlit | `charger` | Market Cur | Anjing Pasar | charger | Usulan |
| Unlit | `shooter` | Hawker | Penjaja | shooter | Usulan |
| Unlit | `tank` | Porter | Kuli Panggul | tank | Usulan |
| Warden | `warden_hound` | Brass Collar, the Thrice-Leaping | Kalung Kuningan, Si Tiga Lompatan | warden_hound | Usulan |
| Boss | `boss_lantern` | Paper Sun, the Light-Eater | Matahari Kertas, Si Pemakan Cahaya | boss_lantern | Usulan |

Alasan singkat:
- Unlit memakai bentuk yang mereka telan, selalu sedikit salah (lore 2.3). Semua nama Unlit Tingkat A diambil dari isi pasar festival: ngengat lampu, anjing pasar, penjaja yang melempar dagangan, kuli yang memikul beban. Tidak ada kata api atau emas di nama Unlit, karena emas berarti hadiah.
- Warden memakai benda yang ia telan sebagai nama (lore 3): kalung kuningan seekor anjing. Julukan menyinggung terjang beruntun.
- Paper Sun adalah lentera festival raksasa yang kini menelan terang (benih boss di lore 5).
- Senjata dan Memento baru mengikat ke kelas dan lore: arit panen (Vintner), sumbu dan lilin (Lamplighter), langit dan kaca (Kept).

## 8. Cek orisinalitas istilah utama

Metode: pengecekan wajar berdasarkan pengetahuan Writer, tanpa web. Hasil ini **bukan** pencarian merek dagang. Ulangi dengan pencarian web dan basis data toko (Steam, itch.io) di M3 sebelum CD mengunci nama.

Skala risiko: **Rendah** = kata umum, tidak dikenal sebagai istilah khas game. **Sedang** = dipakai menonjol di game lain dengan fungsi berbeda, atau mirip istilah terkenal. **Tinggi** = istilah khas game lain dengan fungsi serupa, terutama game yang ada di daftar referensi kita.

| Istilah | Temuan | Risiko | Saran |
|---|---|---|---|
| **Memento** | Kata umum. "Mementos" di Persona 5 adalah nama tempat, bukan sistem benda | Rendah sampai sedang | Dipakai (CD K1). Cek web wajib di M3 |
| **Keepsake** | Nama sistem benda di Hades, fungsi serupa | Tinggi | Diganti Memento. Masuk daftar kata terlarang |
| **Warden** | Mob terkenal di Minecraft; juga kata umum | Sedang | Dipertahankan (CD K1) sebagai kategori. Ikon tag Ward beda bentuk dari penanda Warden |
| **Glint** | Kata umum. Mirip makna dengan "Glimmer" (Destiny), kata berbeda | Rendah sampai sedang | Pertahankan |
| **Silt** | Judul game indie 2022, bukan istilah di dalam game | Rendah sampai sedang | Pertahankan |
| **the Unlit** | Kata sifat umum. Dekat rasa dengan "Unkindled" dan "Ashen One" (Dark Souls), kata berbeda | Rendah | Pertahankan. Jangan memakai "Unkindled", "Ashen", "Hollow", atau "Cinder" di teks |
| **Shardfall** (judul kerja) | Kata gabungan yang mudah muncul di produk lain. Ada judul mirip seperti Shardlight dan Shardbound | Sedang | 5 kandidat judul di `title-candidates.md` (M3), dicek web |
| Candle Crown, Tithe Shard | Gabungan kata umum. Tidak dikenal sebagai item khas game | Rendah | Usulan |
| Lampmoth, Market Cur, Hawker, Porter | Kata umum atau gabungan sederhana. "Stray" sengaja dihindari karena judul game 2022 | Rendah | Usulan, cek web M3 |
| Brass Collar, Paper Sun | Gabungan kata umum. "Paper Sun" mungkin dipakai sebagai judul lagu atau buku, bukan istilah game yang dikenal | Rendah | Usulan, cek web M3 |
| Sky Splinter, Harvest Sickle, Glass Halo, Leaping Wick, Homeward Blade, Festival Flare | Gabungan kata umum | Rendah | Usulan |
| Pocket of Sky, Pruning Hook, Glass Lance | Kata umum | Rendah | Usulan |
| the Pane, Vitrine, Kept, the Glazier, Rite, Pulse | Kata umum atau istilah profesi | Rendah | Pertahankan |
| Flame, Shard, Edge, Echo, Ward, Trade | Kata generik | Rendah | Pertahankan |
| Plain, Fine, Rare, Fabled | Kata umum | Rendah | Dikunci CD |
| Temper, Fuse, The Keeping, Crack | Istilah kerajinan kaca dan kata umum | Rendah | Inti |
| The Moth Market, Vesper Steps, Stillfire Vineyard | Tidak dikenal sebagai lokasi game lain | Rendah | Cek ulang di M3 |
| Lamplighter, Chorister, Vintner | Nama profesi umum | Rendah | Inti |

Contoh nama di style guide 4.1 ("Ember Ring", "Ferry Token", "Unsent Letter") sengaja tidak dipakai agar contoh gaya tidak menjadi konten.

Motif "keep" kini hanya muncul di Kept, The Keeping, dan Light Kept. Penggantian Keepsake dengan Memento menurunkan kepadatan kata "keep" sesuai harapan.
