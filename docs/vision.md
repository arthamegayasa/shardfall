# Shardfall: Visi

Pemilik: Creative Director (CD). Status: dikunci untuk M0 (versi 1, 2026-11-16).
Dokumen terkait: `docs/pillars.md` (pilar dan uji), `docs/style-guide.md` (aturan gaya dan checklist).

Bila dokumen lain bertentangan dengan pilar, pilar yang menang. Bila bertentangan dengan visi atau style guide soal rasa, nama, atau gaya, CD yang memutuskan.

---

## 1. Pitch

> **Shardfall** adalah arena-survival roguelike untuk browser desktop. Kamu adalah seorang Kept, penyintas yang tersegel di dalam pecahan langit kaca. Bertahan dari Pulse demi Pulse kegelapan yang merembes, pungut Glint dari musuh yang hancur, lalu berdagang dengan the Glazier untuk merakit build yang berbeda di setiap run. Mati berarti selesai. Semuanya tampil sebagai diorama kecil di bawah kaca: pixel art tajam, cahaya lentera, dan tepi yang kabur seperti memandang miniatur di lemari pajangan.

Satu kalimat untuk tim: **"Satu run singkat, satu build gila, satu diorama yang terbakar indah."**

Kalimat pengait di dalam game (Inggris): *"The sky broke. The pieces kept us. Now we keep the light."*

### Pengalaman inti dalam 3 detak
1. **Bertahan (Pulse, 20 sampai 40 detik):** bergerak, menghindar, senjata menyerang otomatis, tekan Rite di saat yang tepat. Tegang dan terbaca.
2. **Memilih (the Glazier, beberapa detik):** pilih kartu level-up, beli atau reroll, gabungkan item. Cepat dan menggoda.
3. **Merasakan (Pulse berikutnya):** pilihan tadi langsung terlihat dan terdengar di arena. Build tumbuh di depan mata.

## 2. Target pemain

| Segmen | Siapa | Yang mereka cari | Implikasi |
|---|---|---|---|
| Utama | Pemain survivor-like dan arena roguelike (pernah main genre serangan otomatis dan toko antar gelombang) | Sesi 15 sampai 20 menit, build yang meledak, "satu run lagi" | Loop harus cepat dipahami, toko padat keputusan |
| Kedua | Penggemar estetika HD-2D dan pixel art | Suasana, cahaya, rasa miniatur | Satu bioma harus indah sejak menit pertama |
| Ketiga | Pemain kasual di browser saat istirahat | Tanpa instal, langsung main, bisa jeda kapan saja | Unduhan ringan, tutorial lewat bermain, teks sangat singkat |

- Platform: browser desktop, keyboard dan mouse. Gamepad opsional.
- Usia: 13+ (kekerasan fantasi abstrak, tanpa darah dan gore).
- Bukan target: pemain yang mencari cerita panjang, kompetisi online, atau manajemen inventaris rumit.

## 3. Referensi gaya (tiru gaya saja)

Kita meniru GAYA dan rasa, bukan aset, karakter, nama, lokasi, musik, teks, ikon, atau UI. Output yang terlihat atau terdengar seperti salinan langsung otomatis ditolak.

| Referensi | Yang diambil | Yang tidak diambil |
|---|---|---|
| Brotato dan genre survivor-like | Gelombang berwaktu, serangan otomatis, toko antar gelombang dengan reroll, item bertumpuk | Karakter, ikon, nama item, tata letak UI, angka |
| Roguelike (Hades, Slay the Spire, Risk of Rain) | Permadeath, relic bersinergi, progres meta ringan | Nama relic, karakter, lore, struktur menu |
| Action RPG ringan (Diablo) | Kelas dengan identitas jelas, skill aktif ber-cooldown, rarity loot | Pohon skill raksasa, inventaris grid |
| HD-2D (Octopath Traveler) | Sprite pixel art di panggung 3D, tilt-shift, cahaya dramatis, bloom lembut | Semua aset, nama, musik, jendela dialog, font, menu |
| Dunia nyata: fotografi tilt-shift miniatur | Ilusi "dunia mainan", fokus sempit di tengah | (sumber inspirasi bebas, bukan aset) |
| Dunia nyata: lemari pajangan museum, kaca patri, kaca retak | Bingkai kaca, pantulan tipis, cahaya dari dalam benda | (sumber inspirasi bebas, bukan aset) |
| Dunia nyata: pasar malam berlentera | Cahaya hangat titik-titik, bayangan panjang, kain dan kios | (sumber inspirasi bebas, bukan aset) |

Prinsip: utamakan referensi dunia nyata untuk motif visual. Referensi game hanya untuk mekanik genre dan teknik tampilan.

## 4. Apa yang membuat Shardfall berbeda

1. **Diorama yang punya alasan.** Arena benar-benar sebuah Vitrine: sepetak dunia yang membeku di bawah pecahan kaca. Tilt-shift, kabut tepi, dan pantulan kaca bukan sekadar filter, tapi cara kita melihat lemari pajangan. Tepi layar menampilkan kilau kaca tipis sebagai tanda tangan visual.
2. **Cahaya adalah jam.** Satu Pulse sama dengan satu denyut cahaya pecahan. Pulse dibuka dengan gelombang cahaya dari tengah arena dan ditutup dengan kilatan kaca yang membakar habis the Unlit. Ritme gameplay, cahaya, dan musik adalah satu hal yang sama.
3. **Glint adalah uang sekaligus XP, dan harus dipungut.** Setiap pecahan debu kaca adalah pilihan kecil: kejar Glint ke dekat bahaya, atau aman dan miskin.
4. **Musuh yang sedikit salah.** The Unlit meniru bentuk hal-hal yang pernah diterangi: serigala dengan terlalu banyak sendi, lentera yang menyerap terang. Siluet gelap dengan mata berwarna bahaya, mudah dibedakan dari pemain yang terang.
5. **Lore di dalam benda.** Cerita hanya ada di nama dan satu baris deskripsi Keepsake, Warden, dan bioma. Tanpa cutscene. Pemain merangkai sendiri apa yang terjadi saat langit jatuh.
6. **Dibuat sepenuhnya dari kode.** Pixel art didefinisikan sebagai data, audio disintesis. Gaya dirancang agar keterbatasan ini terlihat sengaja: sprite kecil yang tegas, cahaya dan post-processing yang membawa rasa HD-2D.

## 5. Istilah inti (keputusan CD, wajib dipakai tim)

Semua usulan handoff dipertahankan. Istilah ini dipakai di dokumen, kode (identifier Inggris), dan teks game. Writer boleh mengusulkan perubahan lewat review CD, bukan mengganti sepihak.

| Istilah (Inggris, di game) | Arti | Pemakaian | Identifier kode (saran) |
|---|---|---|---|
| **the Pane** | Kubah kaca yang dulu menjadi langit | Lore saja, jarang muncul di UI | `pane` |
| **the Unlit** | Kegelapan lapar di luar the Pane; semua musuh | Kata benda jamak dan tunggal ("an Unlit", "the Unlit") | `unlit`, `enemy` |
| **Vitrine** | Arena: sepetak tanah tersegel di bawah pecahan | Nama bioma diawali konteks ini | `vitrine`, `biome` |
| **Kept** | Pemain, penyintas yang disimpan pecahan | "You are Kept." Kelas adalah jenis Kept | `kept`, `player` |
| **the Glazier** | Pedagang bertopeng; fase toko | Judul layar toko | `glazier`, `shop` |
| **Glint** | Debu kaca: mata uang run sekaligus XP | Ikon kecil emas, angka di HUD | `glint` |
| **Silt** | Mata uang meta setelah run | Layar akhir run dan meta | `silt` |
| **Keepsake** | Relic: benda yang ikut tersegel di kaca | Kartu toko, hadiah Warden | `keepsake` |
| **Warden** | Elite bernama | Nama Warden tampil saat muncul | `warden` |
| **Rite** | Skill aktif kelas dengan cooldown | Ikon HUD cooldown | `rite` |
| **Pulse** | Satu gelombang | "Pulse 3", bukan "Wave 3" | `pulse`, `wave` boleh di kode internal |

Istilah tambahan yang diputuskan:
- **Tag sinergi** (nama kerja disetujui): Flame, Shard, Edge, Echo, Ward, Trade. Jumlah dan efek milik Game Designer.
- **Tingkat rarity** (nama kerja, Writer boleh mengusulkan pengganti): Plain, Fine, Rare, Fabled. Warna di style guide. Tidak ada rarity berwarna ungu, merah, atau magenta karena warna itu milik bahaya.
- **Boss** di dokumen tetap "boss". Di game, boss tampil dengan namanya sendiri tanpa kata "Boss".
- Kata "Shardfall" adalah nama kerja. [Asumsi] Nama ini mungkin sudah dipakai produk lain. Writer mengecek dan menyiapkan kandidat judul di M3, CD memilih di M5.

## 6. Nada

Fantasi gelap yang ringkas, sedikit misterius, dan melankolis hangat. Dunia sudah berakhir, tapi cahaya kecil masih dijaga. Bukan grimdark, bukan gore, bukan lelucon atau meme. Kekerasan abstrak: musuh pecah jadi motes gelap, pemain pecah jadi serpihan kaca.

## 7. Batas scope kreatif versi 1.0

Producer memutuskan scope dan jadwal. Bagian ini adalah batas kreatif dan rekomendasi CD, disesuaikan dengan keputusan Producer: semua art prosedural, semua audio disintesis, waktu produksi satu malam, browser desktop.

### 7.1 Urutan prioritas kreatif
1. Rasa main loop (gerak, serangan, tempo Pulse, toko).
2. Keterbacaan (Pilar 2).
3. Satu bioma yang indah (Pilar 3).
4. Jumlah konten.

### 7.2 Tingkat konten (rekomendasi untuk Producer)

| Tingkat | Isi | Arti |
|---|---|---|
| **A. Lantai rilis** | 1 kelas lengkap, 1 bioma lengkap dan indah, sekitar 10 Pulse, 4 jenis Unlit, 1 Warden, 1 boss, sekitar 6 senjata atau skill auto-attack, sekitar 12 Keepsake, 3 tag sinergi aktif, toko dengan reroll dan merge, layar akhir run | Ini sudah "game". Jangan rilis di bawah ini |
| **B. Target** | 3 kelas, 1 bioma sangat dipoles, sekitar 15 sampai 20 Pulse, 6 jenis Unlit, 2 Warden, 8 skill auto-attack, sekitar 20 Keepsake, 6 tag, Silt dan buka kelas | Tambah hanya bila A sudah terasa benar |
| **C. Plafon 1.0 (handoff)** | 3 bioma dengan boss masing-masing, 20 Pulse, sekitar 30 Keepsake, tingkat kesulitan bertingkat | Hanya bila waktu tersisa. Bioma tambahan boleh berbagi set Unlit dengan palet cahaya berbeda |

Arah CD untuk bioma pertama: **pasar malam berlentera yang membeku saat langit jatuh**. Alasan: cahaya titik hangat paling kuat membawa rasa HD-2D dengan aset sederhana, kontras alami dengan the Unlit yang gelap, dan cocok dengan lore. Level Designer memutuskan detail dan nama final dalam batas ini.

### 7.3 Masuk 1.0
- Satu arena tertutup per bioma, kamera tetap miring, tidak berputar.
- Sprite pixel art kecil (pemain sekitar 20 px tinggi) di lingkungan 3D low-poly.
- Lore lewat nama dan satu baris deskripsi.
- Musik adaptif sederhana (lapisan intensitas) dan SFX sintesis.
- Pengaturan: kualitas grafis, volume, kurangi efek, matikan angka damage.

### 7.4 Di luar 1.0 (jangan dikerjakan)
- Cutscene, dialog bercabang, pengisi suara.
- Multiplayer, leaderboard online, akun.
- Peta prosedural, kamera berputar, karakter 3D.
- Pohon skill, inventaris grid, crafting.
- Versi mobile dan kontrol sentuh.
- Lokalisasi penuh (kolom Indonesia di string table boleh disiapkan).

## 8. Keputusan visi yang mengikat tim (ringkas)

1. Pemain dan efeknya: biru, cyan, emas. Bahaya musuh: merah, magenta, ungu terang. Tidak pernah ditukar. Detail di style guide.
2. Satu skala pixel untuk semua sprite. Sprite tidak pernah diskalakan non-integer atau diputar bebas.
3. Area main selalu tajam. Blur hanya di tepi atas dan bawah layar.
4. Teks game: nama maksimal 3 kata, efek maksimal 2 baris.
5. Semua aset dibuat dari kode atau CC0 dan tercatat di `docs/credits.md`.
