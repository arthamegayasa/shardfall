# Brief Kreatif M2: Vertical Slice The Moth Market

Pemilik: Creative Director (CD). Status: versi 1, 2026-11-17. Berlaku untuk semua peran M2.
Dasar: `docs/pillars.md`, `docs/style-guide.md` 1.2, `docs/art-direction.md`, `docs/levels/arena-design.md` 12.2, `docs/audio-direction.md`, review rasa M1 `docs/reviews/M1-cd.md`.
Scope dan jadwal milik Producer. Brief ini hanya menyatakan apa yang harus terasa, apa yang final, dan bagaimana CD menilai.

## 0. Target dalam satu kalimat

> Satu run Lamplighter di The Moth Market terasa seperti memandang pasar festival beku di dalam lemari kaca: lentera hangat di tepi, Unlit gelap yang ramai di tengah, dan setiap tembakan, Rite, dan Glint terasa di tangan.

Uji akhir CD: bila screenshot slice disandingkan dengan `art/concept/03-arena-lantern-market.png`, slice harus terasa sama atau lebih hidup, dengan keterbacaan yang sama.

## 1. Apa yang HARUS terasa

### 1.1 Rasa HD-2D (Pilar 3), resep yang sudah disepakati
| Unsur | Arah rasa | Nilai acuan (pemilik angka) |
|---|---|---|
| Diorama 3D low-poly bertekstur pixel | Lantai ubin aus, bibir arena, garis tepi kaca, kios beratap kain, Gerbang Lentera di atas panggung boss. Tekstur satu skala dengan sprite | LD 12.2, AD 10 |
| Cahaya lentera sebagai titik cahaya | Kolam hangat di tepi arena, tidak pernah di tengah. Pusat arena netral dan terbaca | Kunci `#DCA466` az 225 el 50, isi `#6F86B8`, lentera `#E8B070` 3,5 u kedip 12%, maks 8 titik (AD 6) |
| Bayangan sprite | Elips `ink` lembut di bawah setiap aktor; cincin kaki cyan untuk pemain | Style guide 1.5, 1.6 |
| Kabut | Tepi luar memudar ke gelap, seperti cahaya yang tidak sampai ke luar kaca | 3 u sampai 10 u di luar batas (AD 7) |
| DoF pita tepi | Hanya pita atas dan bawah kabur; seluruh arena tajam | 54 dan 36 px virtual (AD 7) |
| Bloom lembut | Hanya benda emisif: lentera, efek pemain, Glint, inti bahaya. Disampel bilinear saat upscale | AD 7, LP |
| Vignette | Sudut gelap lembut | 20% di sudut |
| Kilau kaca | Garis pantulan tipis bergerak pelan di sudut kiri atas dan kanan bawah. Tanda tangan visual | 8 sampai 12%, mati di Rendah |
| Hidup | Kain bergoyang, tali lentera berayun, kertas melayang beku, ngengat di zona dekorasi, debu kaca samar di atas arena (tidak pernah emas) | Minimal 3 elemen (P3-d) |

### 1.2 Arena hidup tapi terbaca (Pilar 2 menang atas Pilar 3)
- Lantai area main median saturasi paling tinggi 15% setelah cahaya, blok 8x8 paling tinggi 25%.
- Tidak ada dekorasi tinggi di sisi bawah layar atau di dalam area main.
- Bahaya selalu yang paling kontras; efek pemain di bawah bahaya; telegraf tidak pernah menyembunyikan pemain (K3 M1).
- Emas kecil di area main hanya berarti Glint atau hadiah (angka kritikal cyan, K4 M1).

### 1.3 Rasa main (perbaikan M1 yang wajib terasa)
- **Kacau:** layar penuh di akhir Pulse tengah dan akhir. Puncak sekitar 40 Unlit hidup di Pulse 8 sampai 9 dengan build wajar (angka milik GD).
- **Dampak:** proyektil pemain terlihat, Unlit berkedip putih saat kena, pecah jadi motes saat mati, Rite adalah efek pemain paling besar.
- **Cahaya adalah jam:** Pulse dibuka gelombang cahaya dari pusat, ditutup kilat kaca yang melarutkan Unlit. Musik, cahaya, dan timer bergerak bersama (riser 6 s, timer emas 5 s).
- **Pedagang, bukan menu:** the Glazier punya potret bertopeng dan satu baris suara saat toko dibuka. Toko tetap satu layar dan cepat.
- **Memungut itu enak:** Glint melesat ke pemain dengan percepatan, nada naik beruntun.

## 2. Apa yang FINAL di M2

| Bagian | Isi final | Pemilik |
|---|---|---|
| Kelas | Lamplighter: sprite final dengan idle 2 sampai 4 bingkai, jalan 4 bingkai (hadap kiri dan kanan dengan flip), pose Rite 2 bingkai, kilat kena hit 2 bingkai, pecah kaca saat mati. Lantern Bolt dan Festival Flare final | AD, GP |
| Unlit | Lampmoth, Market Cur, Hawker, Porter: jalan 2 sampai 4 bingkai, bingkai ancang-ancang yang terbaca, kilat kena hit, motes saat mati. Satu kejanggalan "sedikit salah" per jenis terlihat | AD, GP |
| Warden | Brass Collar, the Thrice-Leaping: banner kedatangan dengan julukan, aura ungu, tiga terjang bertelegraf, volley, bar "Held", peti Memento | AD, GP, UI |
| Boss | Paper Sun, the Light-Eater: intro 3 s di panggung boss, 2 fase, 6 pola semuanya bertelegraf, transisi fase, kematian besar | AD, GP, AU |
| Arena | `arena_market` lengkap: lantai, bibir, rim kaca, 35 dekorasi tepi (10 beranimasi), 3 rintangan, 7 titik cahaya, Gerbang Lentera | LD, AD |
| Render | Pipeline 1.1 lengkap, kualitas Rendah, Sedang, Tinggi, opsi kurangi efek | LP, AD |
| VFX inti | Proyektil pemain (6 senjata), Rite, zona api (K5), Burn api kaca biru, sinergi Flame, Shard, Edge terlihat di arena, kilat kena hit, motes, Glint dan tarikan, angka damage (K4, batas jumlah), gelombang pembuka, kilat penutup, telegraf semua serangan, tanda spawn, kematian pemain | AD, LP |
| Musik | Pulse bioma 1 adaptif 4 lapis dengan fade dan riser, toko, boss (fase 1 dan 2), overlay Unlit saat Warden hidup, stinger awal, akhir, Warden, boss, menang, kalah | AU |
| SFX | Hierarki style guide 3.2 lengkap untuk semua aktor slice, Rite mendarat, kena hit Unlit | AU |
| UI | HUD final dengan ikon (HP, timer atau bar boss atau "Held", Glint, Rite dengan muatan, bar XP), the Glazier dengan potret dan baris, Temper, hadiah Memento, jeda, pengaturan (kualitas, kurangi efek, getar, angka damage, volume, ukuran teks), akhir run Light Kept dan Kept Lost. Semua ikon item dan kartu final | UI, AD |
| Teks | Semua string slice final dalam batas style guide 4.2, nama status Kerja | WR |

## 3. Yang BOLEH placeholder

- Kelas Chorister dan Vintner, bioma 2 dan 3, Unlit Tingkat B (tidak muncul di slice).
- The Keeping (layar meta), Silt, kredit: fungsional, gaya sederhana.
- Layar judul: boleh memakai arena slice sebagai latar dan tanpa musik judul (atau loop toko pelan).
- Font: font sistem monospace boleh tetap bila font bitmap tim belum selesai, asal skala integer dan tinggi huruf besar minimal 14 px layar.
- Bayangan nyata (shadow map) dekorasi: boleh tidak ada; bayangan elips aktor wajib.
- Teks Indonesia, gamepad, mode buta warna lanjutan di luar yang sudah ada.

## 4. Uji penerimaan (putusan rasa HD-2D CD)

Semua di build slice final, 1920x1080 dan 1280x720, kualitas Tinggi kecuali disebut. SETUJU butuh semua [W] lolos.

| ID | Uji | Lolos bila | Pilar | Pelaksana |
|---|---|---|---|---|
| S-1 [W] | Screenshot 1 detik, 5 bingkai paling ramai (termasuk Warden, boss, dan telegraf bertumpuk di dekat pemain) | Pemain dan ancaman terdekat ditunjuk benar di minimal 4 dari 5 | P2-a | QA, CD (proksi subagent; konfirmasi Dok sebagai sisa) |
| S-2 [W] | Grayscale screenshot ramai | Pemain paling terang, lantai sedang, Unlit paling gelap, proyektil musuh terlihat | P2-b | AD |
| S-3 [W] | Kontras terukur di screenshot | Inti proyektil musuh 4,5:1, sorotan pemain 3,5:1, badan Unlit per aktor median 2:1 dan P10 1,5:1 | P2-c | AD, QA |
| S-4 [W] | Telegraf | Setiap serangan Unlit, Brass Collar, dan Paper Sun yang memberi damage punya tanda sebelum kena; telegraf bertumpuk tidak menyembunyikan pemain | P2-e, K3 | GP, CD |
| S-5 [W] | Apa yang baru terjadi | Kena hit, level up, dapat Memento masing-masing beda visual dan suara | P2-g | CD |
| S-6 [W] | DoF di bingkai saja | Diff piksel di dalam batas arena antara DoF ON dan OFF sama dengan nol (bloom dan efek lain dikunci) | P3-c | AD, LP |
| S-7 [W] | Checklist diorama | 1 kunci, 1 isi, kabut tepi, minimal 3 elemen bergerak, kilau kaca di tepi, lentera sebagai titik cahaya, bayangan aktor | P3-d | CD |
| S-8 [W] | Miniatur | Penguji (3 detik) menyebut miniatur, diorama, mainan, atau lemari kaca | P3-e | CD (proksi; sisa untuk manusia) |
| S-9 [W] | Kualitas Rendah | DoF, bloom, kilau kaca mati; kode warna dan S-1 tetap lolos | P3-f | LP, QA |
| S-10 [W] | Pixel tajam dan satu skala | Zoom 400%: blok piksel seragam, skala sama untuk aktor, Glint, tekstur | P3-a, P3-b | AD |
| S-11 [W] | Kartu 3 detik dan dampak 5 detik | Efek kartu disebut benar 4 dari 5; item baru terlihat atau terdengar dalam 5 s Pulse berikutnya | P4-a, P4-d | CD |
| S-12 [W] | Toko singkat | Median waktu toko 25 s atau kurang | P4-f | QA, CD |
| S-13 [W] | Sinergi terlihat | Ambang pertama Flame, Shard, Edge terlihat atau terdengar di arena | P1-e | CD |
| S-14 [W] | Rasa M1 | Proyektil pemain terlihat, Rite efek pemain terbesar, Unlit berkedip dan pecah, gelombang pembuka dan kilat penutup ada, Glint melesat, angka kritikal cyan, zona pemain 25% atau kurang | M1-cd 4 | CD |
| S-15 [W] | Musik dan suara | Pulse naik intensitas dan riser terdengar dari data, toko tenang, boss beda, Warden menambah overlay; SFX berulang mengikuti 3.3 | Style 3 | AU, CD |
| S-16 [S] | Ragam build manusia | 3 run Lamplighter, minimal 2 tag dominan berbeda | P1-d | CD |
| S-17 [W] | Aset tercatat | Semua aset slice di `docs/credits.md`, dibuat dari kode | Style 5 | Semua |

Performa dan anggaran milik LP; CD tidak memberi SETUJU bila kualitas Tinggi menurunkan keterbacaan demi performa tanpa memakai pengaturan kualitas.

## 5. Urutan kerja yang disarankan (untuk Producer)

1. Paralel tanpa saling menunggu: LP plus AD pipeline cahaya dan post; LD arena; AD sprite aktor dan ikon; AU boss dan overlay; WR string slice; GD kepadatan dan tarikan Glint.
2. Begitu pipeline ada: AD VFX inti dan zona (K4, K5), LP K3 dan batas angka.
3. GP dan UI mengikat event dan layar saat aset tiap bagian siap.
4. QA dan CD menjalankan bagian 4. CD menulis putusan di `docs/reviews/M2-cd.md`.

## 6. Jangan dikerjakan di M2
Konten Tingkat B dan C, bioma 2 dan 3, zoom kamera, kamera berputar, cutscene, dialog, efek yang menyentuh area main (DoF, kabut, kilau), merah atau ungu di efek pemain, emas sebagai warna angka atau status di atas Unlit.
