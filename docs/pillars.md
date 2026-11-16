# Shardfall: Pilar Desain

Pemilik: Creative Director (CD). Status: dikunci untuk M0 (versi 1, 2026-11-16).

Pilar mengalahkan semua dokumen lain. Setiap fitur, aset, dan teks harus lolos uji pilar yang relevan sebelum disetujui. Penomoran mengikuti handoff agar rujukan seperti "Pilar 2" di kriteria milestone tetap sama.

## Urutan saat pilar bertentangan

**Pilar 2 > Pilar 4 > Pilar 1 > Pilar 3.**

- Keterbacaan selalu menang atas keindahan. Efek yang indah tapi menutupi bahaya dibuang atau dikurangi.
- Kecepatan keputusan menang atas kedalaman build di UI. Kedalaman boleh ada di sistem, bukan di teks.
- Bila ragu, pilih versi yang lebih sederhana dan lebih terbaca.

Cara memakai uji: setiap uji punya pemilik pelaksana dan milestone pertama kali dijalankan. Hasil dicatat di review CD atau laporan QA dengan bukti (screenshot, data, atau log).

---

## Pilar 1. Setiap run adalah build baru

**Pernyataan:** run terasa berbeda karena pilihan pemain, bukan hanya angka acak. Item yang dibeli mengubah cara bermain: apa yang ditembakkan, ke mana, kapan, atau bagaimana pemain bergerak.

**Kenapa:** inilah alasan pemain menekan "satu run lagi".

### Uji konkret

| ID | Uji | Cara verifikasi | Lolos bila | Pelaksana, mulai |
|---|---|---|---|---|
| P1-a | Rasio item pengubah gaya | Hitung di data GD: item (senjata, skill, Keepsake) yang efeknya hanya stat datar tanpa syarat | Item stat datar paling banyak 30% dari pool toko; sisanya mengubah perilaku atau punya syarat | GD dan CD, M0 (GDD) dan tiap update data |
| P1-b | Tag di setiap item | Cek kolom tag di CSV | 100% senjata dan Keepsake punya minimal 1 tag sinergi | GD, M1 |
| P1-c | Ragam build bot | Simulasi atau bot 50 run ber-seed dengan pilihan acak yang wajar | Tidak ada satu tag yang menjadi tag dominan di lebih dari 40% run | GD dengan QA, M3 |
| P1-d | Ragam build manusia | 3 run berurutan dengan kelas sama, catat 3 item yang paling memengaruhi run | Minimal 2 dari 3 run punya tag dominan berbeda, dan penguji bisa menyebut beda cara mainnya dalam satu kalimat | CD, M2 |
| P1-e | Sinergi terlihat | Kumpulkan ambang tag pertama di satu run | Efek sinergi terlihat atau terdengar di arena (bukan hanya angka di menu) | CD, M2 |

### Kriteria tolak
- Item yang seluruh efeknya "+X% stat" tanpa syarat, bila kuota 30% pengisi sudah penuh.
- Sinergi yang hanya menambah angka tanpa perubahan perilaku atau visual.
- Satu build atau satu item yang jelas selalu terbaik di semua run (dibuktikan P1-c atau P1-d).
- Kelas yang hanya beda stat awal tanpa beda senjata awal dan Rite.

---

## Pilar 2. Kacau tapi tetap terbaca

**Pernyataan:** seramai apa pun layar, pemain selalu tahu di mana dia, apa yang berbahaya, dan apa yang baru terjadi.

**Kenapa:** genre ini menang atau kalah di keterbacaan. Kematian yang tidak dipahami terasa curang.

### Uji konkret

| ID | Uji | Cara verifikasi | Lolos bila | Pelaksana, mulai |
|---|---|---|---|---|
| P2-a | Uji screenshot 1 detik | Ambil screenshot di detik paling ramai (jumlah musuh puncak). Tampilkan 1 detik ke penguji yang belum melihatnya, lalu minta ia menunjuk pemain dan ancaman terdekat | Penguji menunjuk keduanya dengan benar di minimal 4 dari 5 screenshot | QA dan CD, M2 (versi placeholder di M1) |
| P2-b | Uji grayscale | Ubah screenshot ramai ke grayscale | Tiga lapis nilai jelas terpisah: pemain paling terang, lantai sedang, Unlit paling gelap. Proyektil musuh tetap terlihat | AD, M1 |
| P2-c | Kontras terukur | Ukur rasio kontras luminans (rumus WCAG) pada screenshot final, bukan pada hex mentah | Inti proyektil musuh vs lantai minimal 4.5:1. Sorotan pemain (cyan, emas, putih) vs lantai minimal 3.5:1. Badan Unlit vs lantai minimal 2:1 | AD dan QA, M2 |
| P2-d | Kode warna tidak tertukar | Audit palet tiap sprite dan VFX | Nol piksel merah, magenta, atau ungu terang pada pemain dan efeknya. Nol piksel biru, cyan, atau emas pada Unlit dan bahaya | AD (otomatis lewat skrip bila bisa), M1 |
| P2-e | Bahaya selalu ditelegrafkan | Rekam serangan setiap jenis musuh, Warden, dan boss | Setiap serangan yang memberi damage punya tanda visual sebelum kena (durasi minimum ditentukan GD; saran CD minimal 0.4 detik untuk serangan area). Serangan sentuh biasa tidak perlu telegraf | GP dan CD, M2 |
| P2-f | Urutan gambar | Cek render order | Proyektil musuh dan telegraf digambar di atas efek pemain. Efek pemain tidak pernah menutupi proyektil musuh | LP dan AD, M1 |
| P2-g | Apa yang baru terjadi | Saat pemain kena hit, level up, atau dapat Keepsake | Masing-masing punya tanda visual dan suara yang berbeda dan bisa dikenali tanpa melihat HUD | CD, M2 |

### Kriteria tolak
- Efek pemain (proyektil, ledakan, bloom) menutupi proyektil atau telegraf musuh.
- Warna pemain dipakai musuh atau sebaliknya.
- Dekorasi di area main yang bisa menutupi aktor, atau lantai area main dengan pola ramai atau saturasi tinggi.
- Damage yang diterima pemain tanpa sumber yang terlihat.
- Angka damage yang menutupi sprite pemain (dan tidak bisa dimatikan).
- Screenshot ramai yang gagal P2-a.

---

## Pilar 3. Diorama di bawah kaca (HD-2D)

**Pernyataan:** pixel art tajam di panggung 3D dengan kedalaman, kabut, dan cahaya. Arena terasa seperti miniatur hidup di dalam lemari pajangan. Blur hanya di bingkai, area main selalu tajam.

**Kenapa:** ini identitas visual Shardfall, dan alasan diegetiknya adalah the Vitrine.

### Uji konkret

| ID | Uji | Cara verifikasi | Lolos bila | Pelaksana, mulai |
|---|---|---|---|---|
| P3-a | Pixel tajam | Zoom 400% pada screenshot | Setiap piksel sprite tampil sebagai blok persegi seragam. Tidak ada blur, tidak ada piksel setengah, tidak ada skala non-integer atau rotasi bebas pada sprite | AD dan LP, M1 |
| P3-b | Satu skala pixel | Bandingkan ukuran satu piksel sprite pemain, musuh, Glint, dan dekorasi di layar | Semua sama, toleransi 0 di area main | AD, M1 |
| P3-c | DoF di bingkai saja | Bandingkan screenshot efek ON dan OFF | Hanya pita tepi atas dan bawah yang kabur. Seluruh area main (batas arena) identik tajamnya antara ON dan OFF | AD dan LP, M2 |
| P3-d | Elemen diorama | Checklist di screenshot bioma | Ada: 1 cahaya kunci, 1 cahaya isi, kabut atau gelap di tepi, minimal 3 elemen lingkungan yang bergerak (misalnya lentera berkedip, debu kaca melayang, kain bergoyang), kilau kaca di tepi layar | CD, M2 |
| P3-e | Uji "miniatur" | Tunjukkan screenshot 3 detik ke penguji, tanya "seperti apa ini?" | Penguji menyebut kata yang setara dengan miniatur, diorama, mainan, atau lemari kaca | CD, M2 |
| P3-f | Bisa dikurangi | Pengaturan kualitas rendah | Rendah mematikan DoF, bloom, dan kilau kaca, tapi kode warna dan keterbacaan tetap sama | LP dan QA, M2 |

### Kriteria tolak
- Sprite blur, bergerigi akibat rotasi, atau dengan skala pixel campur.
- DoF atau tilt-shift menyentuh area main.
- Adegan rata tanpa kedalaman (tanpa kabut, tanpa cahaya terarah).
- Lingkungan lebih menarik perhatian daripada aktor (saturasi atau kontras lingkungan melebihi aktor).
- Aset yang meniru aset, menu, atau komposisi khas game lain.

---

## Pilar 4. Keputusan cepat, dampak terasa

**Pernyataan:** pilihan di toko dan level-up dipahami dalam hitungan detik dan terasa di Pulse berikutnya.

**Kenapa:** fase toko harus tegang dan menyenangkan, bukan membaca manual.

### Uji konkret

| ID | Uji | Cara verifikasi | Lolos bila | Pelaksana, mulai |
|---|---|---|---|---|
| P4-a | Uji kartu 3 detik | Tampilkan satu kartu item atau level-up selama 3 detik, lalu minta penguji menyebut efeknya | Benar pada minimal 4 dari 5 kartu acak | CD, M2 |
| P4-b | Batas teks | Cek string table | Nama maksimal 3 kata (dan maksimal 18 karakter), efek maksimal 2 baris (maksimal sekitar 40 karakter per baris), tanpa wajib membuka tooltip | Writer dan UI, M1 |
| P4-c | Langkah beli | Hitung input | Membeli satu item maksimal 2 klik atau 2 tombol dari layar toko. Tidak ada menu bertingkat lebih dari 1 level selama run | UI, M1 |
| P4-d | Dampak terlihat | Beli item baru, mulai Pulse berikutnya | Dalam 5 detik pertama Pulse, item baru terlihat atau terdengar di arena (proyektil baru, aura, suara, perubahan sprite atau efek). Pengecualian: item pengisi stat datar (kuota Pilar 1) | CD, M2 |
| P4-e | Info yang cukup | Saat memilih, pemain melihat Glint yang dimiliki, harga, dan tag yang sudah terkumpul tanpa pindah layar | Semua tampil di layar toko yang sama | UI dan CD, M2 |

### Kriteria tolak
- Efek lebih dari 2 baris, atau efek yang hanya bisa dipahami lewat tooltip berlapis.
- Menu bertingkat, konfirmasi berlebihan, atau perbandingan item yang menuntut hitungan.
- Item yang dampaknya tidak terlihat sama sekali di arena (di luar kuota pengisi).
- Layar toko yang memaksa scroll untuk melihat pilihan utama.

---

## Ringkasan uji per milestone

| Milestone | Uji wajib |
|---|---|
| M0 | P1-a (di GDD), batas teks P4-b (di style guide dan rancangan UI) |
| M1 | P1-b, P2-b, P2-d, P2-f, P3-a, P3-b, P4-b, P4-c, P2-a versi placeholder |
| M2 | Semua uji kecuali P1-c |
| M3 | P1-c, ulangi P2-a dan P2-c dengan konten penuh |
| M4 | Ulangi seluruh Pilar 2 di arena paling ramai dan seluruh P3 di kualitas rendah |
