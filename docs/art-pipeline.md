# Shardfall: Pipeline Art

Pemilik: Art Director (AD). Status: M0, versi 1 (2026-11-16). Reviewer: LP (teknis), CD (visual).
Arah visual: `docs/art-direction.md`. Kontrak teknis: `docs/tech/architecture.md` bagian 7 dan 10 (LP).

Tim tidak punya tool menggambar. Semua art dibuat dari data dan kode: sprite pixel art sebagai grid karakter, lingkungan 3D dari primitif three.js dengan tekstur piksel prosedural, VFX dari parameter. Semua bisa dibuat ulang dan diaudit otomatis.

---

## 1. Alur

```
art/palette.json ─┐
art/sprites/*.json ┼─> validasi (tools/art/check-sprites.mjs) ─> rasterizer murni ─> atlas (shelf packer) + manifest
art/sprites/*.ts  ─┤                                            │                     │
art/tiles/*.json  ─┘                                            │                     ├─> runtime: DataTexture saat boot (LP)
                                                                │                     └─> tool: art/atlas/preview/atlas.png + atlas.json
                                                                └─> lembar preview art/atlas/preview/sprites.png
```

- **Runtime (keputusan LP):** saat boot, semua sprite dirasterisasi dan dipak ke satu atlas `DataTexture` (filter nearest, tanpa mipmap). Tidak ada PNG sprite di repo atau di bundle.
- **Tool (AD):** rasterizer yang sama dipakai di Node untuk validasi, lembar preview, dan atlas review. Di M0 rasterizer prototipe ada di `tools/art/lib/sprite.mjs`. Di M1 LP memindahkannya ke `src/render/sprites/rasterize.ts` (fungsi murni, tanpa DOM) dan tool meng-import dari sana, sehingga hasil tool dan game identik.
- Node 24 menjalankan `.mjs` dan `.ts` langsung (type stripping). Tanpa dependensi npm.

## 2. Lokasi file dan penamaan [Wajib]

| Path | Isi | Pemilik |
|---|---|---|
| `art/palette.json` | Token inti, token emisif, grup kubu, palet dan cahaya bioma | AD |
| `art/sprites/<id>.json` | Sprite buatan tangan | AD |
| `art/sprites/<id>.ts` | Sprite prosedural (generator). Default export berbentuk sama dengan JSON | AD |
| `art/sprites/sprite-types.ts` | Tipe `SpriteSheetDef` (dasar LP plus ekstensi AD) | AD, LP review |
| `art/tiles/<id>.json` | Tile lantai dan tekstur lingkungan | AD |
| `art/vfx/<id>.json` | Parameter VFX dan partikel (mulai M2) | AD |
| `art/atlas/preview/` | Hasil tool: `sprites.png`, `atlas.png`, `atlas.json`. Dibuat ulang, boleh di-commit untuk review | Dibuat tool |
| `art/concept/` | Konsep mood dan `measurements.json` | Dibuat tool |
| `tools/art/` | Skrip pipeline | AD |
| `src/render/shaders/`, `src/render/vfx/` | GLSL dan VFX runtime (M2) | AD, LP review |

Penamaan:
- Id sprite kebab-case dengan awalan grup: `kept-`, `unlit-`, `warden-`, `boss-`, `fx-`, `prop-`, `tile-`, `icon-`. Nama file = id.
- Id sprite memetakan id data GD (snake_case) dengan aturan: `swarmer` menjadi `unlit-swarmer`, `warden_hound` menjadi `warden-hound`, `boss_lantern` menjadi `boss-lantern`, kelas `lantern` menjadi `kept-lantern`. Nama tampil tidak pernah dipakai di id.
- Nama animasi standar: `idle`, `walk`, `attack`, `windup` (ancang-ancang atau telegraf pada sprite), `cast` (Rite), `variants` (khusus tile). Kilat kena hit, kematian, dan aura adalah efek runtime, bukan animasi sprite.

## 3. Format sprite

### 3.1 Field
Dasar sesuai `SpriteSheetDef` LP (architecture 10). Field bertanda AD adalah ekstensi yang tidak mengubah keluaran rasterizer.

| Field | Wajib | Arti |
|---|---|---|
| `id` | ya | Lihat bagian 2 |
| `class` | ya (AD) | Kelas ukuran: `kept`, `unlit-small`, `unlit-medium`, `unlit-large`, `warden`, `boss`, `glint`, `projectile-danger`, `projectile-kept`, `portrait`, `prop`, `tile`, `vfx-kept`, `vfx-danger`, `icon`. Dipakai validator rentang tinggi |
| `faction` | ya | `kept`, `unlit`, `neutral`, `env`. Menentukan token yang boleh dipakai (P2-d) |
| `frameW`, `frameH` | ya | Bingkai dari tabel ukuran art-direction 3.2 |
| `anchor` | ya | Titik kaki dalam bingkai. Konvensi `{ x: floor(frameW / 2), y: frameH - 1 }` |
| `legend` | tidak | Karakter tambahan atau pengganti di atas legenda bawaan (3.2) |
| `outline` | ya | `ink`: outline 1 px otomatis, plus `unlit-rim` otomatis untuk faksi `unlit`. `none`: tanpa outline |
| `outlineMode` | tidak (AD) | `4` (bawaan) atau `8` |
| `mirror` | tidak (AD) | `true`: baris = setengah kiri, dicerminkan. `'odd'`: kolom terakhir menjadi kolom tengah bersama |
| `emissive` | tidak (AD) | Token tambahan yang bersinar untuk sprite ini |
| `status` | ya (AD) | `concept`, `placeholder`, `final` |
| `note` | tidak (AD) | Satu baris: peran, kunci siluet, kejanggalan |
| `animations` | ya | `{ nama: { frames, ticksPerFrame, loop } }`. `frames` = array bingkai, tiap bingkai = array baris sama panjang. `ticksPerFrame` dalam tick sim 60 Hz |

Grid tidak menggambar outline luar. Tool menambah 1 px di setiap sisi, memangkas baris dan kolom kosong, lalu menaruh hasilnya di tengah bawah bingkai.

### 3.2 Legenda bawaan

| Karakter | Token | Karakter | Token |
|---|---|---|---|
| `.` | transparan | `B` | `kept-blue` |
| `k` | `ink` | `b` | `kept-blue-deep` |
| `n` | `night` | `c` | `kept-cyan` |
| `h` | `shadow` | `w` | `kept-white` |
| `f` | `floor-mid` | `g` | `kept-gold` |
| `l` | `floor-lit` | `y` | `glint` |
| `t` | `stone` | `u` | `unlit-body` |
| `d` | `dust` | `r` | `unlit-rim` |
| `e` | `bone` | `R` | `danger-red` |
| | | `m` | `danger-magenta` |
| | | `v` | `danger-violet` |
| | | `p` | `danger-core` |

Token bioma ditulis `b1.wood`, `b2.stone`, dan seterusnya, lewat `legend`. Tile yang dipakai ulang antar bioma ditulis dengan token `b1.` dan diganti awalannya oleh renderer (contoh `tile-floor`).

### 3.3 Contoh (dipotong dari `art/sprites/unlit-swarmer.json`)

```json
{
  "id": "unlit-swarmer",
  "class": "unlit-small",
  "faction": "unlit",
  "frameW": 16,
  "frameH": 16,
  "anchor": { "x": 8, "y": 15 },
  "outline": "ink",
  "mirror": "odd",
  "status": "concept",
  "note": "Role swarmer. Low wide dome on many legs. Wrong: three red eyes in a row.",
  "animations": {
    "idle": {
      "ticksPerFrame": 10,
      "loop": true,
      "frames": [
        ["....uu", "..uuuu", ".uuuuu", ".uRuuR", "uuuuuu", "uuuuuu", ".u.u.u", ".u.u.u"],
        ["....uu", "..uuuu", ".uuuuu", ".uRuuR", "uuuuuu", "uuuuuu", "u.u.u.", "u.u.u."]
      ]
    }
  }
}
```

Dengan `mirror: 'odd'`, baris `".uRuuR"` menjadi `".uRuuRuuRu."` (11 px). Setelah outline: 13 x 10 px.

### 3.4 Sprite prosedural
Untuk bentuk besar atau berulang (boss, tekstur organik), tulis generator TS yang menghitung grid dengan matematika sederhana dan deterministik (tanpa `Math.random`; pakai hash atau rumus). Contoh: `art/sprites/boss-lantern.ts` (elips sangkar, inti berlapis, sulur sinus). Keluaran tetap grid karakter yang divalidasi sama seperti JSON.

### 3.5 Animasi [Saran]
| Animasi | Bingkai | `ticksPerFrame` |
|---|---|---|
| `idle` | 2 sampai 4 | 10 sampai 20 |
| `walk` | 4 | 6 sampai 8 |
| `attack`, `windup` | 2 sampai 3 | 4 sampai 6 |
| Boss `idle` | 2 | 20 sampai 30 |

Bingkai animasi disusun dari bingkai dasar dengan perubahan kecil (kaki bergeser 1 px, badan naik 1 px). Rasa tumbukan dibawa efek runtime (kilat, getar offset integer, knockback, partikel), bukan bingkai tambahan.

## 4. Aturan menggambar data [Wajib]

1. Hanya token palet. Faksi `kept`: netral dan token pemain. Faksi `unlit`: `ink`, `unlit-body`, `unlit-rim`, token bahaya. Faksi `env` dan `neutral`: netral dan token bioma, tanpa warna kubu.
2. Celah ruang negatif yang harus terbaca minimal 3 px (outline mengisi 1 px di tiap sisi).
3. Anggota tubuh 1 px memakai segmen lurus dengan tangga ortogonal, bukan rantai diagonal.
4. Pemain: minimal 15% sorotan (`kept-cyan`, `kept-gold`, `kept-white`, `glint`).
5. Semua bingkai satu animasi berukuran sama; tinggi akhir dalam rentang kelas.
6. Unlit: tepat satu kejanggalan, mata atau inti berwarna bahaya.
7. Tanpa piksel semi-transparan di sprite aktor.

## 5. Atlas dan manifest

### 5.1 Packer [Wajib]
- Shelf packer deterministik: bingkai diurutkan menurut tinggi menurun, lalu id, nama animasi, indeks. Lebar 512 px, naik ke 1024 bila tidak muat dalam tinggi 1024. Tinggi dibulatkan ke pangkat dua.
- Padding 1 px transparan antar bingkai. Cukup karena filter nearest, tanpa mipmap, dan koordinat UV memakai piksel bulat.
- Bingkai disimpan sebagai rect terpangkas plus offset di dalam bingkai (hemat ruang).
- Implementasi tool: `tools/art/lib/atlas.mjs`. Runtime memakai algoritme yang sama.

### 5.2 Skema manifest

```json
{
  "version": 1,
  "image": "atlas.png",
  "width": 512,
  "height": 128,
  "padding": 1,
  "filter": "nearest",
  "sprites": {
    "unlit-swarmer": {
      "class": "unlit-small",
      "faction": "unlit",
      "frameW": 16,
      "frameH": 16,
      "anchor": { "x": 8, "y": 15 },
      "animations": {
        "idle": {
          "ticksPerFrame": 10,
          "loop": true,
          "frames": [
            { "x": 280, "y": 1, "w": 13, "h": 10, "ox": 1, "oy": 6 },
            { "x": 294, "y": 1, "w": 13, "h": 10, "ox": 1, "oy": 6 }
          ]
        }
      }
    }
  }
}
```

`x, y, w, h` = rect di atlas. `ox, oy` = posisi kiri atas rect di dalam bingkai. Titik kaki di layar = posisi aktor; sudut quad = posisi kaki dikurangi `anchor` ditambah `ox, oy`, semua piksel bulat (LP 7.2).

### 5.3 Atlas berindeks palet (M2)
AD setuju usul LP (architecture 7.6): atlas R8 berisi indeks palet plus LUT palet 256x1. Usul detail: indeks 1 sampai 127 = token warna, bit tertinggi (128) = versi emisif token yang sama, indeks 0 = transparan. Keuntungan: kilat kena hit (ganti LUT per instance), mode buta warna (ganti LUT), varian palet bioma, dan emisif per sprite tanpa tekstur kedua. M1 memakai atlas RGBA biasa.

## 6. Lingkungan 3D low-poly

### 6.1 Geometri
- Hanya primitif three.js dengan segmen rendah: `BoxGeometry` (kios, peti, dinding), `CylinderGeometry` 6 sampai 8 segmen (tiang, pilar, tong), `ConeGeometry` 4 sampai 6 segmen (atap, tenda), `PlaneGeometry` (lantai, kain, panji), `TorusGeometry` kasar (tepian kaca bila perlu).
- Dekorasi didefinisikan sebagai data per bioma (`content/levels/*.json` milik LD untuk posisi; bentuk dan material dari AD), dibangun saat load dan digabung per material agar draw call rendah.
- Anggaran: lingkungan maksimal 20 ribu segitiga dan 15 draw call per bioma (dari total LP 100 ribu segitiga, 60 draw call).

### 6.2 Tekstur piksel prosedural [Wajib]
- Tile dan tekstur lingkungan adalah grid karakter seperti sprite (`art/tiles/`), dirasterisasi saat boot ke `DataTexture` nearest tanpa mipmap.
- **Texel lantai selalu persegi di layar.** Dengan pitch kamera θ, satu texel menempati 1 unit di sumbu x dan `1 / sin θ` unit di sumbu kedalaman. Pada pitch LP asin(2/3): 1,5 unit (tile 16x16 texel = 16 x 24 unit dunia, tampil 16 x 16 px layar). Aturan ini tetap berlaku bila pitch akhir berubah (lihat pertanyaan terbuka).
- Tile punya animasi `variants` (2 sampai 4 varian). Renderer memilih varian per sel dengan hash posisi sel, deterministik, agar pola tidak berulang terlihat.
- Permukaan vertikal tampil x cos θ (sekitar 0,745). Kerapatannya tidak persis, jadi permukaan vertikal hanya di dekorasi di luar batas. Dekorasi yang harus tajam persis (lentera, lilin) dibuat sebagai billboard sprite faksi `env`.
- Lantai area main: dua nada lantai saja, sambungan putus-putus, tanpa pola ramai.

### 6.3 Material dan cahaya
- Lingkungan: `MeshLambertMaterial` dengan tekstur piksel, atau shader AD sederhana dengan jumlah titik cahaya tetap per kualitas (LP 7.6).
- Kunci = `DirectionalLight`, isi = `DirectionalLight` kedua. Tidak ada `AmbientLight` terpisah; isi berperan sebagai cahaya lingkungan. Nilai di `art/palette.json`.
- Lentera, lilin, bara: `PointLight` (maksimal 8 aktif) plus mesh emisif yang menulis nilai HDR di atas 1,0 agar masuk bloom.
- Bayangan nyata hanya untuk dekorasi di kualitas Tinggi.

## 7. Anggaran tekstur

| Tekstur | Ukuran maksimal | Memori GPU | Saat ini |
|---|---|---|---|
| Atlas aktor dan efek (RGBA) | 1024 x 1024 | 4 MB (1 MB bila R8 berindeks di M2) | 512 x 128 untuk 15 sprite konsep |
| Tile dan tekstur lingkungan per bioma | 512 x 512 | 1 MB | 1 tile 16x16 x 2 varian |
| Atlas VFX dan partikel | 256 x 256 | 0,25 MB | belum |
| Font bitmap dan ikon UI | 512 x 256 | 0,5 MB | belum (UI) |
| Total tekstur art aktif | | 8 MB atau kurang | |

Render target post-processing adalah anggaran LP. Unduhan: nol byte PNG untuk sprite. Data sprite dan palet sekarang 19 KB mentah, 3,6 KB gzip; target seluruh data art 1.0 maksimal 40 KB gzip.

## 8. Preview dan review

| Perintah | Hasil | Waktu |
|---|---|---|
| `node tools/art/check-sprites.mjs` | Validasi semua sprite dan tile, `art/atlas/preview/sprites.png` (warna, siluet, grayscale, semua bingkai, 4x), `atlas.png` dan `atlas.json`. Exit 1 bila ada pelanggaran | di bawah 1 detik |
| `node tools/art/check-sprites.mjs --no-preview` | Validasi saja (untuk CI) | di bawah 1 detik |
| `node tools/art/build-concepts.mjs` | Lima konsep mood di `art/concept/` plus `measurements.json` | sekitar 5 detik |

Yang dicek validator: token tidak dikenal, baris tidak sama panjang, token di luar kubu (P2-d), tinggi di luar rentang kelas, bingkai tidak muat, sorotan pemain di bawah 15%, id bukan kebab-case, id ganda. Uji negatif sudah dijalankan (Unlit memakai cyan, Kept memakai merah, Unlit kecil terlalu tinggi, karakter tidak dikenal) dan semuanya tertangkap.

Usulan skrip npm untuk LP di M1 (package.json milik LP): `art:check` = `node tools/art/check-sprites.mjs --no-preview` (masuk CI), `art:preview` = `node tools/art/check-sprites.mjs`, `art:concepts` = `node tools/art/build-concepts.mjs`.

Cara CD mereview: buka `art/atlas/preview/sprites.png` (baris 1 warna, baris 2 siluet datar, baris 3 grayscale) dan konsep di `art/concept/`. Mulai M2, screenshot game sungguhan dari Playwright menggantikan render konsep untuk uji P2 dan P3.

## 9. Menambah atau mengubah sprite

1. Tulis `art/sprites/<id>.json` (atau `.ts` untuk generator) mengikuti bagian 3 dan 4.
2. Jalankan `node tools/art/check-sprites.mjs` sampai 0 failing.
3. Lihat `art/atlas/preview/sprites.png`: siluet terbaca, grayscale tiga lapis.
4. Tambah baris di `docs/credits.md` (file, "Tim Shardfall (AD), data prosedural", lisensi proyek, catatan).
5. Laporkan ke CD dengan path preview.

## 10. Serah terima ke M1

- LP: pindahkan logika `compileSprite` (mirror, rim, outline 4-tetangga, pangkas, validasi kubu) dari `tools/art/lib/sprite.mjs` ke `src/render/sprites/rasterize.ts`; tool lalu meng-import modul itu. Perilaku dan urutan packer di `tools/art/lib/atlas.mjs` menjadi acuan.
- LP mengizinkan `art/**/*.ts` dan import JSON dari `art/` di tsconfig dan Vite.
- AD di M1: placeholder berskala benar memakai sprite konsep ini (sudah dalam rentang ukuran), plus tile lantai.
