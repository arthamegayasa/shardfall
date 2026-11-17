# Shardfall: Pipeline Art

Pemilik: Art Director (AD). Status: versi 1.2 (2026-11-17, M2-03). Reviewer: LP (teknis), CD (visual).
Arah visual: `docs/art-direction.md`. Kontrak teknis: `docs/tech/architecture.md` bagian 7 dan 10 (LP).

Tim tidak punya tool menggambar. Semua art dibuat dari data dan kode: sprite pixel art sebagai grid karakter, lingkungan 3D dari primitif three.js dengan tekstur piksel prosedural, VFX dari parameter. Semua bisa dibuat ulang dan diaudit otomatis.

---

## 1. Alur

```
art/palette.json ─┐
art/sprites/*.json ┼─> validasi (tools/art/check-sprites.ts) ─> src/core/sprite ─> atlas (shelf packer) + manifest
art/sprites/*.ts  ─┤                                            │                     │
art/tiles/*.json  ─┘                                            │                     ├─> runtime: DataTexture saat boot (LP)
                                                                │                     └─> tool: art/atlas/preview/atlas.png + atlas.json
                                                                └─> lembar preview art/atlas/preview/sprites.png
```

- **Runtime (keputusan LP):** saat boot, semua sprite dirasterisasi dan dipak ke satu atlas `DataTexture` (filter nearest, tanpa mipmap). Tidak ada PNG sprite di repo atau di bundle.
- **Tool (AD):** `tools/art/check-sprites.ts` memakai rasterizer dan packer runtime `src/core/sprite/` (`compileSprite`, `packAtlas`, `frameToRgba`), jadi validasi, lembar preview, atlas review, dan game identik.
- Pengecualian (keputusan M2-03, temuan LP M1): perender konsep mood `tools/art/build-concepts.mjs` dan `lib/scene.mjs` tetap `.mjs` bersama rasterizer referensi M0 `lib/sprite.mjs` dan `lib/atlas.mjs`. **Tidak dihapus**: tes kesetaraan LP `tests/unit/core/sprite.test.ts` masih mengimpor `sprite.mjs` dan `atlas.mjs` dan membandingkan setiap sprite (termasuk semua aset M2) dengan rasterizer runtime; `npm run art:concepts` masih memakai `build-concepts.mjs`. Tidak dipakai pipeline produksi, dikecualikan dari lint. Bisa dipensiunkan bila LP menganggap tes kesetaraan sudah tidak perlu.
- Node 24 menjalankan `.ts` langsung (type stripping). Tanpa dependensi npm.

## 2. Lokasi file dan penamaan [Wajib]

| Path | Isi | Pemilik |
|---|---|---|
| `art/palette.json` | Token inti, token emisif, grup kubu, palet dan cahaya bioma | AD |
| `art/sprites/<id>.json` | Sprite buatan tangan | AD |
| `art/sprites/<id>.ts` | Sprite prosedural (generator). Default export berbentuk sama dengan JSON | AD |
| `art/sprites/sprite-types.ts` | Re-export tipe kanonik dari `src/core/contracts/sprite.ts` (LP) | AD, LP review |
| `art/tiles/<id>.json` | Tile lantai dan tekstur lingkungan | AD |
| `art/vfx/<id>.json` | Parameter VFX dan partikel (mulai M2) | AD |
| `art/atlas/preview/` | Hasil tool: `sprites.png`, `atlas.png`, `atlas.json`. Dibuat ulang, boleh di-commit untuk review | Dibuat tool |
| `art/concept/` | Konsep mood dan `measurements.json` | Dibuat tool |
| `tools/art/` | Skrip pipeline (`check-sprites.ts`, `lib/*.ts`; konsep M0 `.mjs`) | AD |
| `src/render/sprites/` | Batch sprite instanced, pemetaan id, pemilihan bingkai, lapisan entitas | LP + AD |
| `src/render/shaders/`, `src/render/vfx/` | Shader sprite dan area, telegraf, angka damage | AD, LP review |
| `tests/render/` | Tes logika pemetaan render, adegan palsu, preview Playwright (`npm run art:shot`) | AD |

Penamaan:
- Id sprite kebab-case dengan awalan grup: `kept-`, `unlit-`, `warden-`, `boss-`, `fx-`, `prop-`, `tile-`, `icon-`. Nama file = id.
- Id sprite memetakan id data GD (snake_case) dengan aturan: `swarmer` menjadi `unlit-swarmer`, `warden_hound` menjadi `warden-hound`, `boss_lantern` menjadi `boss-lantern`, kelas `lantern` menjadi `kept-lantern`. Nama tampil tidak pernah dipakai di id.
- Id proyektil pemain: `fx-shot-<id senjata kebab>` (`splinter_shot` menjadi `fx-shot-splinter-shot`).
- Nama animasi standar: `idle`, `walk`, `attack`, `windup` (ancang-ancang atau telegraf pada sprite), `cast` (Rite), `variants` (khusus tile). Khusus efek: `dir4` (4 orientasi garis di layar: datar, naik, tegak, turun), `grow` (bingkai menurut progres 0 sampai 1), `normal` dan `crit` (`fx-digits`, indeks bingkai = digit). Kilat kena hit, kematian, dan aura adalah efek runtime, bukan animasi sprite.

### 2.1 Set sprite M1 [Wajib, dicek `art:check`]

| Kebutuhan | Sprite | Animasi | Lapis |
|---|---|---|---|
| Pemain Lamplighter (`lantern`) | `kept-lantern` | `idle` 2, `walk` 4 | L2 |
| Unlit Tingkat A | `unlit-swarmer`, `unlit-charger`, `unlit-shooter`, `unlit-tank` | `idle` 2 (swarmer, shooter) atau `idle` 1 plus `walk` 2 | L2 |
| Warden dan boss | `warden-hound`, `boss-lantern` | `idle` 1 plus `walk` 2; boss `idle` 2 | L2 |
| Proyektil pemain per senjata | `fx-shot-lantern-bolt`, `fx-shot-splinter-shot` (`dir4`), `fx-shot-arc-blade`, `fx-shot-orbit-shards`, `fx-shot-chain-spark`, `fx-shot-returning-glaive`, cadangan `fx-shot-kept` | 1 sampai 4 | L3 |
| Proyektil musuh | `fx-shot-danger` | 1 | L4 |
| Glint | `fx-glint` | 2 | L2 |
| Burn pada Unlit | `fx-burn` | 2 | L3 |
| Retakan spawn | `fx-spawn-crack` | `grow` 4, anchor di tengah retakan | L4 |
| Angka damage | `fx-digits` | `normal` 10, `crit` 10 | L3 |
| Telegraf lingkaran, cincin, garis, kerucut; zona pemain | shader `src/render/shaders/area.ts` | progres dari pool | L4 / L3 |
| Lantai | `tile-floor` | `variants` 2 | L0 |

Set M2 (wajib, dicek `art:check`): semua di atas plus animasi `cast` dan `hit` (pemain), `windup` (4 Unlit), `windup` dan `attack` (Warden), `idle2`, `windup`, `windup2` (boss), jumlah bingkai minimal per brief CD, dan sprite VFX `fx-spark`, `fx-trail`, `fx-glint-trail`, `fx-mote`, `fx-shard`, `fx-glass-shard`, `fx-flare`, `fx-ember`, `fx-rise`, `fx-star`. Generator boleh memakai helper grid (`blank`, `fit`, `shift`, `paste`, `recolor`, `flipX`, `replaceRows`, `fillWhere`) dari `art/sprites/sprite-types.ts`, satu-satunya modul selain `src/core/math` yang boleh diimpor generator.

Pemetaan id data ke sprite ada di `src/render/sprites/sprite-ids.ts` dengan urutan cadangan: id sendiri, lalu `behavior`, lalu `role`, lalu sprite per `size_class`. Kelas dan senjata tanpa sprite memakai `kept-lantern` dan `fx-shot-kept`. Tes `tests/render/sprite-ids.test.ts` memastikan semua id Tingkat A punya sprite sendiri (data GD asli juga sudah tercakup penuh).

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
Untuk bentuk besar atau berulang (boss, tekstur organik), tulis generator TS yang menghitung grid dengan matematika sederhana dan deterministik: tanpa `Math.random`, trigonometri hanya lewat `src/core/math` (`sinTurns`, `cosTurns`), jarak dengan `Math.sqrt` (bukan `Math.hypot`). Generator hanya boleh import `src/core/contracts/sprite.ts` (lewat `sprite-types.ts`) dan `src/core/math`; ESLint memaksa ini. Contoh: `art/sprites/boss-lantern.ts` (elips sangkar, inti berlapis, sulur sinus dua fase). Keluaran tetap grid karakter yang divalidasi sama seperti JSON. `art/**/*.ts` masuk `tsconfig.json`, `tsconfig.tools.json`, dan lint.

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
- Implementasi: `src/core/sprite/atlas-pack.ts`, dipakai runtime dan tool. Referensi M0 `tools/art/lib/atlas.mjs` hanya untuk tes kesetaraan.

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
- **Texel lantai selalu persegi di layar: 1 texel = 1/16 u di x dan 1/10 u di kedalaman** (pitch final asin(0,625), architecture 7.2). Tile 16 x 16 texel menutupi 1 x 1,6 u; tile 16 x 10 texel menutupi tepat 1 x 1 u. Keputusan AD: `tile-floor` tetap 16 x 16 texel (1 x 1,6 u), karena pola batu persegi di layar lebih tenang dan ulangan tile lebih jarang terlihat.
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
| Atlas aktor dan efek (RGBA) | 1024 x 1024 | 4 MB (1 MB bila R8 berindeks di M2) | 512 x 128 untuk 24 sprite (M1-05) |
| Tile dan tekstur lingkungan per bioma | 512 x 512 | 1 MB | 1 tile 16x16 x 2 varian |
| Atlas VFX dan partikel | 256 x 256 | 0,25 MB | belum |
| Font bitmap dan ikon UI | 512 x 256 | 0,5 MB | belum (UI) |
| Total tekstur art aktif | | 8 MB atau kurang | |

Render target post-processing adalah anggaran LP. Unduhan: nol byte PNG untuk sprite. Data sprite dan palet sekarang 19 KB mentah, 3,6 KB gzip; target seluruh data art 1.0 maksimal 40 KB gzip.

## 8. Preview dan review

| Perintah | Hasil | Waktu |
|---|---|---|
| `npm run art:preview` | Validasi semua sprite dan tile, `art/atlas/preview/sprites.png` (warna, siluet, grayscale, semua bingkai, 4x), `atlas.png` dan `atlas.json`. Exit 1 bila ada pelanggaran | sekitar 1 detik |
| `npm run art:check` | Validasi saja, termasuk set sprite M1 (2.1). Bagian dari `npm run check` | sekitar 1 detik |
| `npm run art:concepts` | Lima konsep mood di `art/concept/` plus `measurements.json` | sekitar 5 detik |
| `npm run art:shot` | Renderer asli pada dunia palsu (`tests/render/fake-scene.ts`) di Chromium headless, screenshot `tests/out/render-preview-1920x1080.png` dan `-1280x720.png`. Vite mode `test`, tidak menulis `content/generated` | sekitar 10 detik |

Yang dicek validator: token tidak dikenal, baris tidak sama panjang, token di luar kubu (P2-d), tinggi di luar rentang kelas, bingkai tidak muat, sorotan pemain di bawah 15%, id bukan kebab-case, id ganda, nama file sama dengan id, sprite dan animasi wajib M1 (2.1). Uji negatif sudah dijalankan (Unlit memakai cyan, Kept memakai merah, Unlit kecil terlalu tinggi, karakter tidak dikenal) dan semuanya tertangkap.


Cara CD mereview: buka `art/atlas/preview/sprites.png` (baris 1 warna, baris 2 siluet datar, baris 3 grayscale), screenshot render `tests/out/render-preview-1920x1080.png` (buat ulang dengan `npm run art:shot`), dan konsep di `art/concept/`. Mulai M2, screenshot game sungguhan menggantikan render konsep untuk uji P2 dan P3.

## 9. Menambah atau mengubah sprite

1. Tulis `art/sprites/<id>.json` (atau `.ts` untuk generator) mengikuti bagian 3 dan 4.
2. Jalankan `npm run art:preview` sampai 0 failing.
3. Lihat `art/atlas/preview/sprites.png`: siluet terbaca, grayscale tiga lapis.
4. Tambah baris di `docs/credits.md` (file, "Tim Shardfall (AD), data prosedural", lisensi proyek, catatan).
5. Laporkan ke CD dengan path preview.

## 10. Render entitas M1 (M1-05)

- `src/render/sprites/entity-layers.ts` membaca `WorldView` dan event frame, lalu mengisi lima batch instanced: zona pemain (area, L3 di lantai), aktor L2 (pemain, Unlit, Warden, boss, Glint; uji dan tulis depth dari kaki), efek pemain L3 (proyektil, Burn, angka damage), area bahaya L4 (telegraf dan cincin spawn), sprite bahaya L4 (retakan spawn, proyektil musuh). L4 ada di scene terpisah yang digambar terakhir; saat post-processing LP datang, scene ini pindah ke `dangerRT` tanpa perubahan art.
- Sprite: `shaders/sprite.ts`, kaki diproyeksikan lalu dibulatkan ke piksel virtual, quad dibangun di piksel bulat (cermin TS: `frame-select.ts` `spriteQuad`, dites). Flip horizontal untuk hadap kiri. Kilat kena hit mengisi sprite dengan `kept-white` (pemain) atau `bone` (Unlit).
- Area: `shaders/area.ts`, bentuk dihitung di ruang piksel layar, tepi tepat 1 px lewat `fwidth`, isian datar tanpa anti-aliasing.
- Semua id sprite diselesaikan sekali saat dibuat; `update()` hanya membaca typed array dan menulis buffer instance (tanpa alokasi per frame). Kapasitas tetap; instance di atas kapasitas dibuang dan dihitung (`overflow()`).
- Pemain menghadap arah gerak horizontal (sprite tidak simetris), `walk` saat bergerak, `idle` saat diam. Unlit memakai `facing` dari view.
- Tes: `tests/render/` (pemilihan bingkai, orientasi `dir4` di ruang layar, hadap, penempatan quad, tata letak digit, cakupan id, isi tiap lapis dari dunia palsu).

## 11. Sisa (dari M1)

- Port `build-concepts.mjs` dan `lib/scene.mjs` ke `.ts` (atau pensiunkan setelah screenshot game menggantikan konsep).
- Cahaya sprite per instance (Kept minimal 70%), bayangan elips L1, cincin kaki pemain, jejak proyektil, aura Warden, kematian Unlit, animasi `windup` dari `aiState` setelah kode state AI GP stabil.

- Status M2-03: cahaya sprite per instance, bayangan elips L1, cincin kaki, jejak proyektil dan Glint, aura Warden, kematian Unlit, animasi `windup` dari `aiState` selesai (bagian 13). Port atau pensiun `.mjs` lihat bagian 1.

## 12. Ikon UI dan potret (M2-03)

- Sumber: `art/sprites/icon-<jenis>-<id data kebab>.json`, kelas `icon` (frame 16x16 kartu, 8x8 inline) atau `portrait` (48x48), faksi `kept` atau `neutral`, outline `ink`, satu animasi `icon` satu bingkai.
- Jenis: `weapon` (semua senjata Tingkat A dan B), `memento` (Tingkat A dan B), `rite` (Tingkat A dan B), `stat` (stat kartu Temper `levelup.csv` Tingkat A), `tag` (6 tag, 8x8), plus `icon-glint`, `icon-silt`, `icon-portrait-glazier`. Daftar wajib dibaca `art:check` dari `content/data/*.csv`, jadi baris data baru tanpa ikon langsung gagal.
- Atlas: `src/core/sprite/icons.ts` (murni, tanpa DOM): `buildIconAtlas(sprites, palette)` memak bingkai pertama semua ikon (lebar 256) dengan packer runtime dan manifest JSON `{ version, image, width, height, filter, icons: { id: { x, y, w, h, size, ox, oy } } }`; `iconImage(atlas, id, scale)` memberi piksel siap `ImageData` (persegi `size x scale`, ikon di tengah); `iconSpriteId(kind, dataId)`; `isUiArt(src)`.
- DOM: `src/render/sprites/icons.ts` `createIconProvider(assets, doc)` dengan `getIcon(id, scale)` (canvas baru, `image-rendering: pixelated`), `getIconDataUrl(id, scale)` (cache), `iconFor(kind, dataId, scale)`. Diekspor dari `src/render/index.ts`. Catatan: `src/ui` tidak boleh mengimpor `src/render` (ESLint), jadi UI memakai fungsi core langsung atau menerima provider dari `src/app`.
- Atlas game (`sprites/atlas-texture.ts`) melewatkan ikon dan potret.
- Review: `npm run art:preview` menulis `art/atlas/preview/icons.png` dan `icons-atlas.png` plus `icons-atlas.json`. `node tools/art/check-sprites.ts --icons` memvalidasi ikon saja.

## 13. Shader sprite dan VFX (M2-03)

- Cahaya: `createEntityLayers(..., { lighting: { glsl: SCENE_LIGHTING_GLSL, uniforms: sceneLighting.uniforms } })` (antarmuka LP di `src/render/shaders/lighting.ts`). Vertex shader memanggil `sfSpriteLight(kaki, minLevel)` sekali per instance: mode `SpriteLight.Kept` (min 0,7), `Unlit` (min 0), `None` (efek). Tanpa `lighting` sprite tampil warna palet.
- Emisif: atlas game menulis alpha 200 (`EMISSIVE_ALPHA_BYTE`) untuk token emisif palet dan `emissive` per sprite; texel ini tidak diterangi dan dikali `entities.emissiveGain.value` (LP menaikkannya saat bloom aktif).
- Kilat kena hit: `iFlash` (pemain `kept-white`, Unlit tint `bone` 0,5, Warden dan boss 0,35, level up emas, Memento putih). M4: kilat Unlit hanya dari hit benturan; tick zona dan Burn tidak berkedip (`src/render/sprites/actor-flash.ts` mencocokkan event `EnemyDamaged` ke slot).
- Outline ancang-ancang (M4, BUG-007): `iOutline` mengganti texel warna kunci `ink` dengan `danger-magenta` yang berdenyut ke `danger-core`; badan Unlit tetap gelap.
- Zona pemain (M4): alpha shader dihitung dari isian efektif di layar (`zoneFillAlpha`, Rite 20%, jejak 12%) karena blending linear membuat alpha 0,25 tampil sekitar 37%. Batch zona memakai `merge`: lingkaran yang bertumpuk tampil sebagai satu isian dan satu outline.
- Rite per arketipe (M4): `throw_zone` terbang dan mendarat, `ring` cincin cyan tumbuh ke radius nyata dalam 0,25 s, `dash` 3 bayangan kaca cyan sepanjang jalur. Pose `cast` dan `hit` kelas B ada di `kept-bell` dan `kept-blade`.
- Larut: `iParams.z` 0 sampai 1, ambang dither Bayer 4x4 pada texel atlas, tepi 1 texel memakai warna flash.
- VFX: `src/render/vfx/effects.ts` (event ke partikel, terbang Rite, cincin lantai, hantu Unlit mati), `particles.ts` (pool SoA tetap 600, gerak dalam piksel layar bulat, hash deterministik, tanpa `Math.random`). Reduce Effects menurunkan semburan ke 30%. Lapis: dekal L1 (`decals`, `fxAreas`), efek L3; semua di bawah L4.
- Preview: `npm run art:shot` merender arena `arena_market` asli (lingkungan dan cahaya LP) dengan dunia palsu dan garis waktu efek (`tests/render/preview/preview.ts`).
