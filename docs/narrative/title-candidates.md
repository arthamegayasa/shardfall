# Shardfall: Kandidat Judul Rilis

Pemilik dokumen ini untuk M3: Creative Director (CD), karena Writer belum membuat kandidat. Writer boleh menambah kandidat lewat review CD. Tanggal: 2026-11-17.
Keputusan ada di `docs/reviews/M3-cd.md` bagian 6.

## 1. Kriteria

1. Menyampaikan premis (langit kaca pecah, arena tersegel, cahaya melawan gelap) atau rasa diorama dalam 1 sampai 3 kata.
2. Mudah diucapkan dan dieja dalam bahasa Inggris, terbaca di logo kecil dan ikon tab.
3. Tidak meniru judul atau istilah khas game lain, terutama game di daftar referensi kita (Brotato, Vampire Survivors, Hades, Octopath Traveler, Dark Souls).
4. Bisa dicari: kata yang terlalu umum tenggelam di toko dan mesin pencari.
5. Selaras dengan istilah inti (the Pane, Vitrine, Kept, Glint) tanpa memakai kata terlarang style guide 4.3.

## 2. Metode cek orisinalitas

Pengecekan wajar dari pengetahuan CD, tanpa akses web (agent-rules butir 7). **Ini bukan pencarian merek dagang.** Sebelum rilis publik di luar GitHub Pages, Producer atau Dok wajib mencari judul terpilih di web, Steam, itch.io, dan basis data merek (misalnya USPTO, EUIPO, DJKI). Skala risiko sama dengan glossary bagian 8: Rendah, Sedang, Tinggi.

## 3. Kandidat

| # | Judul | Alasan | Cek orisinalitas (pengetahuan CD) | Risiko | Kelemahan |
|---|---|---|---|---|---|
| 1 | **Shardfall** | Satu kata, langsung menceritakan premis (langit pecah, pecahan jatuh dan menyegel tanah). Sudah dipakai di repo, layar judul, dan build. Bunyi kuat, mudah dieja | Tidak ada game komersial besar bernama Shardfall yang CD ketahui. Kata gabungan ini mudah muncul di proyek kecil (itch.io, game jam, mod, novel fantasi, tabletop) dan di dekat judul lain seperti Shardlight (adventure 2016), Shardbound (game kartu taktik), dan Shardpunk: Verminfall (taktik 2022). Tidak ada yang berfungsi sebagai game arena-survival dengan nama persis sama di pengetahuan CD | Sedang | Generik untuk fantasi; perlu cek web sebelum rilis toko |
| 2 | **Under the Pane** | Mengikat langsung ke istilah inti the Pane dan rasa "di bawah kaca" (Pilar 3). Permainan kata pane dan pain memberi nada pahit yang pas dengan premis | Frasa umum; CD tidak mengetahui game dengan judul ini | Rendah | Kurang memberi sinyal genre aksi. Pemain bisa salah dengar "pain" dan mengira game horor. Pencarian bersaing dengan frasa umum |
| 3 | **Vitrine** | Satu kata, unik untuk game, menegaskan diorama dalam lemari pajangan, sama dengan nama arena di lore | CD tidak mengetahui game besar bernama Vitrine. Kata umum (lemari pajangan, istilah museum dan ritel) | Rendah | Kata asing bagi banyak pemain, ucapan tidak pasti (vi-TREEN). Tenggelam di hasil pencarian ritel dan furnitur |
| 4 | **Lanterns Under Glass** | Menggambar screenshot kita: lentera hangat di dalam kaca. Paling deskriptif untuk rasa HD-2D dan The Moth Market | Gabungan kata umum; CD tidak mengetahui game atau karya terkenal dengan judul ini | Rendah | Tiga kata, panjang untuk logo dan tab. Terdengar seperti game santai atau puzzle, bukan roguelike aksi |
| 5 | **Glasslight** | Satu kata gabungan yang menyatukan kaca (the Pane, Vitrine) dan cahaya (Kept, lentera). Pendek, bisa dicari | CD tidak mengetahui game bernama Glasslight. Kemungkinan dipakai sebagai nama produk lampu atau studio kecil. Dekat dengan pola nama seperti Shardlight | Rendah sampai sedang | Kurang konkret: tidak menyebut kejatuhan langit atau pertarungan |

Kandidat yang dibuang sebelum tabel:
- **Unlit**: judul satu kata yang besar kemungkinan sudah dipakai beberapa game indie; juga nama musuh, jadi membingungkan. Risiko Tinggi.
- **The Kept**: sudah menjadi judul novel (James Scott, 2014) dan beberapa karya lain. Risiko Sedang sampai tinggi.
- **Light Kept**: sudah dipakai sebagai judul layar menang; memakainya sebagai judul game menghabiskan momen itu.

## 4. Keputusan CD

**Judul rilis: Shardfall** (bersyarat). Alasan dan syarat di `docs/reviews/M3-cd.md` bagian 6.

- Syarat: pencarian web, Steam, itch.io, dan merek dagang oleh Producer atau Dok sebelum rilis publik di luar GitHub Pages. Bila ditemukan game aktif atau merek terdaftar bernama Shardfall di kelas game, pakai cadangan.
- Cadangan urutan 1: **Under the Pane**. Cadangan urutan 2: **Lanterns Under Glass**.
- Status `ui.title.name` di string table naik dari "judul kerja" menjadi "judul rilis bersyarat". Tidak ada perubahan teks game.
