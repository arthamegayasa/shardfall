# Shardfall: Style Guide

Pemilik: Creative Director (CD). Status: dikunci untuk M0 (versi 1.1, 2026-11-16). Daftar perubahan versi 1.1 dari review M0 ada di bagian 6.
Berlaku untuk: Art Director, UI Programmer, Audio Director, Writer, Level Designer, Gameplay Programmer.
Dasar: `docs/vision.md` dan `docs/pillars.md`. Bila bertentangan, pilar yang menang.

Konstrain produksi (keputusan Producer): semua art dibuat dari kode (pixel art sebagai data atau digambar lewat skrip, lingkungan 3D low-poly di three.js), semua audio disintesis (Web Audio atau skrip generator), waktu produksi sangat singkat. Gaya di bawah dirancang agar realistis untuk produksi itu: sprite kecil yang tegas, warna sedikit, dan rasa HD-2D dibawa oleh cahaya dan post-processing.

Penanda: **[Wajib]** tidak boleh dilanggar tanpa persetujuan CD. **[Saran]** boleh disesuaikan pemilik wilayah dengan alasan tertulis. **[Asumsi]** perlu dikalibrasi di M1.

---

## 1. Visual

### 1.1 Prinsip
1. **Sprite tajam, cahaya lembut.** Bentuk yang membawa informasi gameplay (aktor, proyektil, tepi telegraf) selalu tajam dan berpiksel. Cahaya, glow, kabut, dan partikel suasana boleh halus.
2. **Tiga lapis nilai.** Pemain terang, lantai sedang, Unlit gelap. Bahaya punya inti pucat dan cincin berwarna jenuh.
3. **Lingkungan diam, aktor hidup.** Lantai area main saturasi rendah dan polos. Warna jenuh dipakai hanya untuk aktor, efek, dan cahaya.
4. **Sedikit warna, dipakai konsisten.** Palet inti di bawah adalah satu-satunya sumber warna sprite dan UI. Warna lingkungan bioma boleh ditambah AD dalam batas aturan 1.3.

### 1.2 Palet inti (hex) [Wajib]

**Netral dan lingkungan**

| Nama token | Hex | Pakai untuk |
|---|---|---|
| `ink` | `#14121C` | Outline aktor 1 px, teks gelap, bayangan terdalam |
| `night` | `#1C1926` | Latar luar arena, panel UI |
| `shadow` | `#3E3A46` | Bayangan lantai, tepi arena di luar area main |
| `floor-mid` | `#57515A` | Lantai area main (nada gelap) |
| `floor-lit` | `#6B6360` | Lantai area main (nada terang) |
| `stone` | `#8A817A` | Dekorasi tepi, kios, dinding |
| `dust` | `#A39A8C` | Teks sekunder, sorotan lingkungan |
| `bone` | `#EDE6D8` | Teks utama, sorotan terang lingkungan |

**Kubu pemain (Kept): biru, cyan, emas**

| Nama token | Hex | Pakai untuk |
|---|---|---|
| `kept-blue` | `#3D7DFF` | Warna identitas pemain (jubah, badan), bar HP |
| `kept-blue-deep` | `#2449A8` | Bayangan pada sprite pemain |
| `kept-cyan` | `#4FE3F0` | Serangan, proyektil, efek pemain, cincin penanda di bawah kaki |
| `kept-white` | `#F2FBFF` | Inti proyektil pemain, sorotan terkuat |
| `kept-gold` | `#FFC94A` | Hadiah: Glint, level up, Memento, Rite siap, pilihan aktif di UI |
| `glint` | `#FFD966` | Inti butir Glint (dengan outline `ink`) |

**Kubu bahaya (Unlit): merah, magenta, ungu terang**

| Nama token | Hex | Pakai untuk |
|---|---|---|
| `unlit-body` | `#241A30` | Badan semua Unlit (siluet gelap) |
| `unlit-rim` | `#5B3A78` | Sorotan tepi atas badan Unlit, agar bentuk terbaca |
| `danger-red` | `#FF3B4E` | Telegraf area, mata Unlit, peringatan HP rendah |
| `danger-magenta` | `#FF2E9A` | Proyektil musuh, mata Warden |
| `danger-violet` | `#B44CFF` | Serangan khusus, aura Warden dan boss, pemanggil |
| `danger-core` | `#FFE3EE` | Inti pucat proyektil musuh |

**Rarity (tanpa warna bahaya)**

| Tingkat | Hex |
|---|---|
| Plain | `#C9C2B6` |
| Fine | `#6FD08C` |
| Rare | `#3D7DFF` |
| Fabled | `#FFC94A` |

Rasio kontras yang sudah dicek pada hex mentah (luminans WCAG): `danger-core` vs `floor-mid` 6.4:1, vs `floor-lit` 4.9:1. `kept-cyan` vs `floor-lit` 3.8:1. `unlit-body` vs `floor-mid` 2.2:1, vs `floor-lit` 2.8:1. Teks `bone` pada panel `night` 13.9:1. Uji final tetap pada screenshot setelah cahaya dan grading (Pilar 2, P2-c).

### 1.3 Kode warna pemain vs bahaya [Wajib]
- Pemain dan semua efeknya hanya memakai biru, cyan, emas, putih, dan netral. **Nol piksel merah, magenta, atau ungu.**
- Unlit dan semua bahaya hanya memakai `unlit-body`, `unlit-rim`, merah, magenta, ungu terang, `danger-core`, dan `ink`. **Nol piksel biru, cyan, atau emas.**
- Emas berarti "hadiah atau baik untuk pemain". Merah berarti "bahaya sekarang". Jangan pakai merah di UI untuk hal yang bukan bahaya (misalnya harga yang Glint-nya belum cukup ditampilkan abu redup, bukan merah).
- Sprite pemain: minimal 15% piksel adalah sorotan terang (`kept-cyan`, `kept-gold`, atau `kept-white`) agar pemain lolos uji grayscale.
- Proyektil musuh selalu tiga lapis: inti `danger-core`, cincin `danger-magenta` (atau merah atau ungu), outline `ink`. Bentuk bulat atau simetris agar tidak perlu diputar.
- Proyektil pemain: inti `kept-white`, badan `kept-cyan`, tanpa outline (membedakan dari proyektil musuh secara bentuk juga).
- Emas kecil di area main selalu berarti Glint atau hadiah. Penanda status milik pemain yang menempel di atas Unlit (Burn dan sejenisnya) memakai `kept-cyan` dan `kept-white` ("api kaca biru"), bukan emas. Isian area api milik pemain (ledakan Lantern Bolt, zona Rite) boleh `kept-gold` dengan opasitas maksimal 25%.
- Audit P2-d dilakukan per kepemilikan sprite dan VFX, bukan per tumpang tindih di layar: efek pemain yang digambar di atas Unlit tetap efek pemain.
- Cahaya lingkungan hangat (lentera) memakai amber redup, bukan emas jenuh. Batas: saturasi cahaya lingkungan di bawah 60% dan tidak pernah dipakai sebagai warna objek kecil di area main.
- Mode buta warna (milik QA dan UI): kode tetap dibedakan juga oleh bentuk dan nilai (inti pucat plus outline untuk bahaya, cincin kaki untuk pemain), bukan hanya hue.

### 1.4 Skala pixel dan ukuran sprite
- **Satu skala pixel untuk semua sprite dan tekstur lingkungan.** [Wajib]
- Skala layar [Asumsi, kalibrasi M1]: 1 piksel sprite = 3 piksel layar pada 1920x1080, 2 piksel layar pada 1280x720 dan 1366x768. Hanya kelipatan integer.
- Kerapatan texel lantai dan dekorasi sama dengan kerapatan piksel sprite di layar. [Wajib]
- Kamera: tetap, miring sekitar 40 derajat dari horizontal, tidak berputar. [Saran untuk LP dan AD] Kamera ortografis agar skala pixel konstan di seluruh area main. Sprite aktor berupa billboard menghadap kamera.
- **Rasa gerak terhadap kemiringan kamera** [Wajib secara rasa, implementasi milik LP dan GP, angka milik GD]: kamera miring membuat gerak ke atas dan bawah layar tampak lebih lambat (faktor kedalaman sekitar 0.63 sampai 0.67). Arah yang diputuskan:
  1. Arah input sama dengan arah di layar: W+D tampak bergerak diagonal 45 derajat di layar.
  2. Kecepatan layar pemain ke atas atau bawah ditargetkan 80% dari kecepatan ke samping (rentang kalibrasi M1: 75 sampai 85%). Tanpa kompensasi terasa berat; kompensasi penuh (100%) membuat lantai terasa rata dan menghilangkan rasa miniatur.
  3. Kompensasi hanya pada gerak yang dikendalikan input pemain (jalan dan dash Rite). Bentuk area, jangkauan, proyektil, dan telegraf tetap jujur di lantai dunia (lingkaran tetap lingkaran di lantai dan tampil elips). Yang terlihat selalu sama dengan yang terjadi (Pilar 2).
  4. Unlit tidak dikompensasi secara default. GD boleh menambah kompensasi yang sama pada Unlit bila playtest menunjukkan kabur vertikal terlalu mudah.
  5. Rasio disimpan di data agar CD bisa menyetel rasa di M1 tanpa mengubah kode.

| Aktor | Tinggi sprite (px) | Bingkai (px) |
|---|---|---|
| Pemain (Kept), semi-chibi sekitar 3 kepala | 18 sampai 22 | 24 x 24 |
| Unlit kecil (perenang massal) | 10 sampai 14 | 16 x 16 |
| Unlit sedang (penerjang, penembak, peledak) | 14 sampai 18, selalu lebih pendek dari pemain | 24 x 24 |
| Unlit besar (tank) | 20 sampai 26 | 32 x 32 |
| Warden | 28 sampai 36 | 48 x 48 |
| Boss | 64 sampai 96 | 128 x 128 |
| Glint | 3 sampai 5 | 8 x 8 |
| Proyektil musuh | 5 sampai 7 | 8 x 8 |
| Proyektil pemain | 3 sampai 6 | 8 x 8 |
| Potret the Glazier (UI toko) | 40 sampai 48 | 48 x 48 |

Aturan bentuk:
- Siluet harus terbaca di ukuran asli. Uji: isi sprite dengan satu warna gelap; jenis aktor masih bisa ditebak.
- Tiap kelas pemain punya siluet kepala atau bahu yang berbeda (misalnya tudung, topi lebar, pelindung bahu) dan aksen warna dominan berbeda di dalam palet pemain (satu condong biru, satu cyan, satu emas).
- Unlit "sedikit salah": tambahkan satu kejanggalan per jenis (sendi berlebih, mata di tempat aneh, bayangan yang tidak cocok bentuknya). Mata atau inti selalu berwarna bahaya.
- Animasi minimal [Saran]: idle 2 sampai 4 bingkai, jalan 4 bingkai, serang 2 sampai 3 bingkai, kena hit = kilat putih 2 bingkai. Tidak ada skala non-integer dan rotasi bebas pada sprite. Rasa tumbukan dibawa oleh kilat, getar offset, knockback, dan partikel.

### 1.5 Outline [Wajib]
- Semua aktor (pemain, Unlit, Warden, boss, Glint, proyektil musuh) punya outline luar 1 px warna `ink`.
- Unlit tambah 1 px `unlit-rim` di tepi atas dalam agar siluet gelap tidak hilang di outline gelap.
- Lingkungan, tile, dan proyektil pemain tanpa outline.
- Pemain punya cincin penanda di lantai: elips tipis `kept-cyan` dengan opasitas sekitar 50%, digambar di bawah semua aktor.

### 1.6 Cahaya
- Per bioma: 1 cahaya kunci terarah plus 1 cahaya isi berwarna kontras. [Wajib]
- Bioma pertama (pasar berlentera) [Saran untuk AD]: kunci hangat amber redup (sekitar `#E0A458`) dari arah kiri belakang atas, isi biru bulan redup (sekitar `#6F86B8`), lentera sebagai titik cahaya hangat di tepi arena.
- Sprite menerima cahaya, tapi aktor punya batas terang minimum agar tidak tenggelam di area gelap [Saran: aktor tidak pernah lebih gelap dari 70% warna dasarnya]. Unlit tidak terpengaruh batas ini karena memang gelap.
- Bayangan: tiap aktor punya bayangan lantai elips `ink` dengan opasitas rendah. Bayangan nyata (shadow map) hanya untuk dekorasi dan hanya bila anggaran performa LP mengizinkan.
- **Cahaya sebagai jam Pulse** [Wajib secara rasa, detail milik AD dan GP]: Pulse dibuka gelombang cahaya dari tengah arena; akhir Pulse ditandai kilatan kaca yang melarutkan Unlit menjadi motes gelap. Kecerahan lingkungan boleh naik pelan sepanjang Pulse, tapi tidak boleh mengubah nilai lantai sampai melanggar P2-c.
- Titik cahaya dinamis dibatasi jumlahnya (angka milik LP). Efek pemain memakai bloom, bukan cahaya dinamis.

### 1.7 Post-processing, DoF, dan bingkai kaca
- **Tilt-shift DoF hanya di pita tepi** [Wajib]: blur di sekitar 15% layar atas dan 10% layar bawah, dengan transisi lembut. Seluruh batas arena main selalu tajam.
- Kabut atau gelap jarak: tepi luar arena memudar ke `night`, seperti cahaya yang tidak sampai ke luar kaca.
- Bloom: ambang tinggi, hanya untuk benda emisif (efek pemain, Glint, inti bahaya, lentera). Bloom tidak boleh membuat inti proyektil musuh tertutup cahaya efek pemain.
- Vignette: lembut, sekitar 15 sampai 25% di sudut.
- **Kilau kaca** (tanda tangan visual): garis pantulan tipis dan sangat transparan di sudut atau tepi layar, bergerak pelan. Tidak pernah masuk area tengah.
- Grading warna per bioma boleh, selama uji Pilar 2 tetap lolos di hasil akhir.
- Pengaturan kualitas rendah mematikan DoF, bloom, dan kilau kaca. Opsi "kurangi efek" mengurangi getar layar, kilat, dan partikel.

### 1.8 VFX dan telegraf
- Telegraf area: isian `danger-red` opasitas 25 sampai 35% dengan tepi solid tegas. Isian tumbuh dari tengah ke tepi selama waktu telegraf, sehingga pemain membaca kapan serangan kena.
- Telegraf terjang: mata dan outline musuh berkedip `danger-red` saat ancang-ancang, plus garis arah tipis bila serangannya lurus.
- Peledak: berkedip makin cepat sebelum meledak.
- Efek pemain dibatasi opasitas dan ukurannya agar tidak menutupi bahaya. Efek pemain digambar di bawah lapis bahaya.
- Angka damage: dari pemain = `bone` kecil, kritikal = `kept-gold`. Damage yang diterima pemain = kilat merah tipis di tepi layar plus suara, bukan angka besar di atas pemain. Angka damage bisa dimatikan.
- Kematian Unlit: pecah menjadi motes gelap yang memudar cepat (kurang dari 0.3 detik), tidak menumpuk di lantai.
- Kematian pemain: Kept pecah menjadi serpihan kaca biru dan cyan, layar melambat sebentar.

### 1.9 Lingkungan dan arena (untuk LD dan AD)
- Area main: lantai polos atau pola sangat halus, nilai antara `floor-mid` dan `floor-lit`. Saturasi diukur tiga cara [Wajib]: (a) albedo tekstur di bawah 15% HSV; (b) median saturasi lantai area main pada render akhir paling tinggi 15%, dengan target desain 13% atau kurang agar ada ruang untuk variasi cahaya three.js; (c) blok 8x8 piksel mana pun di area main paling tinggi 25% (kolam cahaya lentera di tepi).
- Dekorasi tinggi hanya di tepi luar arena dan di sisi atas layar (latar jauh), tidak di sisi bawah layar agar tidak menutupi aktor.
- Low-poly dengan tekstur piksel dari palet. Jumlah objek dekorasi mengikuti anggaran LP.
- Minimal 3 elemen bergerak di lingkungan (lentera berkedip, debu kaca melayang, kain bergoyang) agar diorama terasa hidup.

---

## 2. UI

### 2.1 Gaya panel: "label lemari pajangan"
- Panel: `night` dengan opasitas sekitar 90%, bingkai tipis 1 piksel skala UI warna `bone` opasitas sekitar 60%.
- Sudut terpotong miring 2 piksel (seperti tepi pecahan kaca), bukan sudut bulat.
- Satu garis kilau kaca tipis di sudut kiri atas panel utama (opsional, bisa dimatikan bersama efek).
- Elemen terpilih atau fokus: bingkai `kept-gold`. Elemen tidak aktif: teks `dust` dengan opasitas 50%.
- Kartu item berbentuk **baris**: ikon besar (32 satuan) di kiri, lalu nama, maksimal 2 baris efek, flavor opsional, baris tag (ikon kecil tag), harga dengan ikon Glint di kanan. Kartu ditumpuk vertikal agar efek 2 x 40 karakter muat pada ukuran teks minimum dan nama sejajar kiri untuk dipindai. Bingkai kartu memakai warna rarity plus pip rarity (bukan hanya warna).
- Merah di UI hanya untuk bahaya nyata (HP rendah, boss datang).
- Tidak meniru jendela, menu, atau tata letak game lain.

### 2.2 HUD saat Pulse [Wajib]
Hanya: HP, waktu Pulse, jumlah Glint, cooldown Rite. Boleh ditambah bar XP tipis. Tidak ada elemen lain. HUD di tepi layar, tidak di tengah.

Slot waktu Pulse berubah isi, jumlah elemen tetap:
- **Pulse boss** (tanpa batas waktu): slot waktu menjadi bar HP boss dengan nama boss di atasnya. Isian `danger-violet`, bingkai tipis, tanpa angka besar.
- **Warden menahan Pulse** (waktu habis, Warden masih hidup): slot waktu menjadi bar HP Warden dengan label "Held" (string table), komponen yang sama dengan bar boss. Pemain selalu tahu apa yang harus dilakukan agar Pulse berakhir.

### 2.3 Tipografi
- **Font bitmap pixel buatan tim**, didefinisikan sebagai data (glyph sekitar 5x7 di sel 6x9), huruf besar, huruf kecil, angka, dan tanda baca dasar. Dicatat di `docs/credits.md`. [Saran untuk AD dan UI] Placeholder M1 boleh memakai font sistem sans-serif.
- Hanya dirender di skala integer. Angka memakai lebar tetap (tabular) agar timer dan Glint tidak bergoyang.
- Ukuran pada 1080p: teks isi 3x (tinggi huruf besar sekitar 21 piksel layar), label kecil 2x, judul 4x sampai 6x. Pada 720p: isi 2x. Tidak ada teks dengan tinggi huruf besar di bawah 14 piksel layar.
- Warna teks: utama `bone`, sekunder `dust`, sorotan `kept-gold`.
- Opsi ukuran teks (aksesibilitas) memperbesar skala integer.

### 2.4 Aturan teks singkat [Wajib]
- Nama item, Memento, skill: maksimal 3 kata dan maksimal 18 karakter.
- Efek: maksimal 2 baris, sekitar 40 karakter per baris. Kata kerja di depan, angka eksplisit.
- Flavor Memento: maksimal 1 baris, maksimal 70 karakter, tampil warna `dust` di bawah efek. Boleh disembunyikan.
- Judul layar 1 sampai 2 kata ("The Glazier", "Pulse 7", "Kept Lost").
- Tombol: 1 sampai 2 kata kerja ("Reroll", "Begin Pulse").
- Semua teks dari string table Writer, tidak di-hardcode.

---

## 3. Audio

### 3.1 Nada
"Kaca dan gelap": kecil, jernih, sedikit dingin, dengan inti hangat. Rasa orkestra kecil yang disintesis plus sentuhan chiptune.

Palet suara yang realistis untuk sintesis Web Audio [Saran untuk AU]:
- Lonceng kaca: FM atau sinus berlapis dengan peluruhan panjang. Motif utama.
- Pad senar: gelombang gergaji yang difilter lowpass dengan chorus pelan.
- Petik: Karplus-Strong untuk harpa atau kecapi kecil.
- Perkusi: sinus dengan pitch turun cepat (gendang rendah), noise terfilter (snare, gesekan).
- Lead chiptune: gelombang pulse atau square untuk melodi pendek.
- Drone rendah untuk the Unlit.

Musik:
- Musik Pulse: modus minor (aeolian atau dorian), sekitar 110 sampai 125 BPM [Asumsi], loop 8 sampai 16 birama, 3 lapis intensitas (dasar, perkusi, melodi atau arpeggio) plus riser 6 detik terakhir Pulse (selaras lonjakan spawn GDD; dua detik terakhir tanpa spawn menjadi puncak riser).
- Musik toko: tenang, sekitar 70 sampai 80 BPM, jarang, lonceng kaca dan petik.
- Motif tanda tangan: awal Pulse = lonceng kaca rendah; akhir Pulse = akor kaca naik; the Glazier datang = denting kecil plus dengung topeng.
- Semua melodi dibuat tim. Dilarang memakai, me-remix, atau meniru melodi berhak cipta.

### 3.2 Hierarki SFX (prioritas tertinggi dulu) [Wajib]
1. Pemain kena hit.
2. Telegraf bahaya musuh (serangan area, terjang, peledak).
3. Level up dan dapat Memento.
4. Pungut Glint.
5. Unlit mati.
6. Serangan otomatis pemain.

Suara bahaya menempati pita frekuensi tengah (sekitar 1 sampai 3 kHz) dengan bentuk naik, dan tidak pernah dipakai untuk hal milik pemain. Suara pemain kena hit menurunkan sejenak (ducking) semua suara lain.

### 3.3 Aturan SFX berulang [Wajib]
Berlaku untuk serangan otomatis, Unlit mati, dan pungut Glint:
- Durasi pendek: serangan otomatis di bawah 80 ms, tanpa ekor reverb panjang.
- Pelan: serangan otomatis sekitar 18 dB di bawah suara pemain kena hit [Asumsi, final di mix M4].
- Variasi acak tiap putar: pitch sekitar plus minus 6%, volume sekitar plus minus 2 dB. Keacakan audio tidak memakai RNG simulasi.
- Batas suara bersamaan: maksimal 4 instans SFX yang sama; jeda minimum sekitar 40 ms antar pemicu SFX yang sama.
- Serangan lembut (tanpa klik tajam), frekuensi tinggi dipotong lowpass sekitar 6 sampai 8 kHz.
- Pungut Glint beruntun: pitch naik bertahap dalam rentetan, kembali ke dasar setelah jeda singkat.
- Uji telinga: putar 10 menit tanpa henti; bila melelahkan atau menusuk, tolak.

---

## 4. Tulisan

### 4.1 Nada
Fantasi gelap yang ringkas, sedikit misterius, melankolis hangat. Kalimat pendek, benda konkret, kata kerja kuat. Dunia diceritakan lewat benda dan nama, bukan penjelasan. Teks game berbahasa Inggris.

Contoh arah (ilustrasi gaya, bukan konten final):
- Nama Memento: "Ember Ring", "Ferry Token", "Unsent Letter".
- Efek: "Hits ignite foes. Burning foes spread flame on death."
- Flavor: "Still warm from a hand that never let go."
- Akhir run: "Kept Lost. Another wakes beneath the glass."

### 4.2 Panjang nama dan efek [Wajib]

| Jenis | Batas |
|---|---|
| Item, Memento, skill, Rite | Maksimal 3 kata, maksimal 18 karakter |
| Unlit (jenis musuh) | Maksimal 2 kata |
| Warden dan boss | Nama maksimal 3 kata, boleh dengan julukan pendek ("the Many-Jointed") |
| Kelas | 1 kata |
| Bioma (Vitrine) | Maksimal 3 kata |
| Efek | Maksimal 2 baris, sekitar 40 karakter per baris |
| Flavor | 1 baris, maksimal 70 karakter |

Gaya efek: kata kerja di depan, angka eksplisit, istilah konsisten dengan glosarium, tanpa kata "you" bila bisa dihindari. Flavor harus selaras dengan efek mekanik (efek api, flavor menyinggung panas atau api).

### 4.3 Kata terlarang (teks game)
- Nama dan istilah khas game lain: Octopath, Traveler (sebagai nama kelas atau gelar), Brotato, Square Enix, Materia, Estus, Boon, Keepsake (sistem Hades), Soul (sebagai mata uang), Unkindled, Ashen, Hollow, dan sejenisnya. Writer mengecek setiap istilah utama terhadap game lain.
- Istilah generik yang sudah kita ganti: Wave (pakai Pulse), Shop atau Store (pakai the Glazier), Gold, Coin, XP, EXP (pakai Glint), Relic (pakai Memento), Elite (pakai Warden), Ultimate atau Special (pakai Rite).
- Klise: "ancient evil", "chosen one", "destiny", "darkness falls", "hero".
- Gaul dan meme: "OP", "epic", "loot", "lol", "noob", "GG".
- Kekerasan grafis: blood, gore, guts, dan sejenisnya.
- Tanda baca: tanpa em dash, baik di teks game maupun dokumen tim.

### 4.4 Kapitalisasi istilah
the Pane, the Unlit (an Unlit), Vitrine, Kept, the Glazier, Glint, Silt, Memento (jamak Mementos), Warden, Rite, Pulse, Temper, Fuse, The Keeping, Crack. Tag sinergi selalu kapital: Flame, Shard, Edge, Echo, Ward, Trade. Kata "crack" huruf kecil (retakan) tetap boleh di flavor; "Crack" kapital hanya untuk tingkat kesulitan.

---

## 5. Checklist review per disiplin

CD memakai checklist ini untuk putusan SETUJU, SETUJU DENGAN CATATAN, atau TOLAK. Pembuat menjalankan checklist sendiri sebelum menyerahkan. Satu butir [Wajib] gagal berarti minimal SETUJU DENGAN CATATAN; pelanggaran kode warna, skala pixel, atau jiplakan berarti TOLAK.

### 5.1 Art (sprite dan lingkungan)
- [ ] Hanya warna dari palet inti (atau palet bioma yang disetujui).
- [ ] Kode warna benar: nol merah, magenta, ungu di pemain; nol biru, cyan, emas di Unlit.
- [ ] Satu skala pixel, tanpa skala non-integer atau rotasi bebas, filter nearest-neighbor.
- [ ] Ukuran sprite sesuai tabel 1.4; musuh kecil lebih pendek dari pemain.
- [ ] Outline `ink` 1 px pada aktor; `unlit-rim` pada Unlit.
- [ ] Siluet terbaca saat diisi satu warna.
- [ ] Lolos uji grayscale (P2-b).
- [ ] Dibuat dari kode atau data, skrip ada di repo, tercatat di `docs/credits.md`.
- [ ] Tidak menyerupai aset game lain.

### 5.2 Cahaya, post-processing, VFX
- [ ] 1 cahaya kunci plus 1 cahaya isi per bioma.
- [ ] DoF hanya di pita tepi; area main tajam (P3-c).
- [ ] Bloom tidak menutupi inti bahaya.
- [ ] Efek pemain digambar di bawah bahaya (P2-f).
- [ ] Telegraf jelas, isian tumbuh menunjukkan waktu.
- [ ] Kualitas rendah dan opsi kurangi efek berfungsi tanpa merusak kode warna.

### 5.3 UI
- [ ] HUD Pulse hanya HP, waktu, Glint, cooldown Rite (plus bar XP opsional).
- [ ] Panel bergaya label lemari pajangan, sudut terpotong, bingkai tipis.
- [ ] Teks dari string table, lolos batas panjang 2.4.
- [ ] Font di skala integer; tinggi huruf besar minimal 14 piksel layar.
- [ ] Merah hanya untuk bahaya nyata.
- [ ] Beli item maksimal 2 input; tidak ada menu bertingkat (P4-c).
- [ ] Lolos uji kartu 3 detik (P4-a).

### 5.4 Audio
- [ ] Disintesis, skrip generator ada di `tools/audio/`, tercatat di `docs/credits.md`.
- [ ] Melodi orisinal, tidak mirip melodi yang dikenal.
- [ ] Hierarki SFX 3.2 terdengar: bahaya dan kena hit paling jelas.
- [ ] SFX berulang mengikuti 3.3 dan lolos uji telinga 10 menit.
- [ ] Musik Pulse punya lapis intensitas dan riser akhir; musik toko tenang.
- [ ] Loop tanpa celah atau klik.

### 5.5 Tulisan
- [ ] Bahasa Inggris, nada sesuai 4.1.
- [ ] Batas panjang 4.2 terpenuhi.
- [ ] Tidak ada kata terlarang 4.3, tidak ada em dash.
- [ ] Istilah dan kapitalisasi sesuai 4.4 dan glosarium.
- [ ] Flavor selaras dengan efek mekanik.
- [ ] Nama orisinal, sudah dicek tidak dipakai game lain.

### 5.6 Level dan arena
- [ ] Lantai area main polos, saturasi rendah, nilai sesuai 1.9.
- [ ] Dekorasi tinggi hanya di tepi luar dan sisi atas layar.
- [ ] Minimal 3 elemen lingkungan bergerak.
- [ ] Batas arena jelas terlihat; seluruh area main di luar pita DoF.
- [ ] Tidak meniru lokasi atau peta game lain.

### 5.7 Rasa main (GD, GP)
- [ ] Gerak responsif, pemain bisa menghindar dengan sengaja.
- [ ] Setiap serangan musuh yang berbahaya ditelegrafkan (P2-e).
- [ ] Pulse terasa naik intensitas menjelang akhir; toko terasa jeda tegang yang singkat.
- [ ] Item baru terasa di Pulse berikutnya (P4-d).
- [ ] Tidak ada upgrade stat datar di luar kuota pengisi (P1-a).
- [ ] Kematian selalu bisa dijelaskan pemain ("aku mati karena...").

---

## 6. Perubahan versi 1.1 (review M0, 2026-11-16)

Sumber dan alasan: `docs/reviews/M0-cd.md`.

| Bagian | Perubahan |
|---|---|
| Semua | Keepsake diganti Memento (risiko nama sistem Hades) |
| 1.3 | Penanda status pemain di atas Unlit memakai cyan dan putih, bukan emas; isian area api pemain boleh emas maksimal 25%; audit P2-d per kepemilikan |
| 1.4 | Arah rasa gerak terhadap kemiringan kamera (target kecepatan vertikal layar 80%) |
| 1.9 | Saturasi lantai diukur tiga cara: albedo, median render, blok 8x8 |
| 2.1 | Kartu item berbentuk baris, ikon di kiri |
| 2.2 | Slot waktu menjadi bar HP boss atau bar HP Warden saat Pulse ditahan |
| 3.1 | Riser 6 detik (bukan sekitar 5) |
| 4.3 | Kata terlarang ditambah Keepsake, Unkindled, Ashen, Hollow |
| 4.4 | Kapitalisasi Temper, Fuse, The Keeping, Crack |
