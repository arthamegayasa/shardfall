# Review Teknis M0 (Lead Programmer)

Tugas: M0-11b. Reviewer: Lead Programmer (LP). Tanggal: 2026-11-16. Untuk: Producer.
Cakupan: kelayakan teknis, kontrak antar modul, format data, satuan, performa, tes. Angka balance milik GD, visi dan nama milik CD; keduanya hanya disentuh bila berdampak teknis.
Hasil kontrak final ada di `docs/tech/architecture.md` versi 2 (sumber kebenaran tunggal untuk M1, bagian bertanda [Beku M1]). `docs/tech/coding-standards.md` diselaraskan ke versi 2.
Keputusan CD di `docs/reviews/M0-cd.md` yang berdampak teknis sudah diserap: Keepsake menjadi **Memento** di semua identifier (K1), kompensasi gerak vertikal (K7), dukungan sampling bilinear (permintaan AD).

---

## 1. Putusan per dokumen

| Dokumen | Pemilik | Putusan | Inti catatan |
|---|---|---|---|
| `docs/gdd.md` | GD | SETUJU DENGAN CATATAN | Layak dibangun. Kalibrasi jarak ke arena 32 x 20 u, aturan gabung Glint yang menjaga nilai, durasi `pulseClear` di data |
| `docs/systems/data-schema.md` | GD | SETUJU DENGAN CATATAN | Format diterima dengan 6 penyesuaian (`content_tier`, tag huruf kecil, hapus `tick_rate`, `mementos.csv`, `palette_id` dihapus, bentuk JSON array) |
| `docs/systems/effect-primitives.md` | GD | SETUJU DENGAN CATATAN | Layak. Wajib menetapkan urutan komposisi stat. Batas 200 proc dan 24 zona diterima |
| `docs/art-pipeline.md` + `tools/art/` + `art/sprites/` | AD | SETUJU DENGAN CATATAN | Validator jalan (16 sprite, 0 gagal). Aturan texel dan render konsep harus ikut pitch final; tool pindah ke `.ts` di M1 |
| `docs/audio-direction.md` | AU | SETUJU DENGAN CATATAN | Engine dan anggaran disetujui. `arenaHalfWidth` 16 dari data, WAV ke `audio/preview/` |
| `docs/audio-list.md` | AU | SETUJU DENGAN CATATAN | Nama event diselaraskan ke tabel final; kolom `sfxFire` di data senjata ditolak (pemetaan tetap di file AU) |
| `docs/levels/arena-design.md` | LD | SETUJU DENGAN CATATAN | Pitch 38,68 derajat dan arena 32 x 20 u dipilih. Format JSON diterima dengan 6 penyesuaian |
| `docs/ui/ui-spec.md` | UI | SETUJU DENGAN CATATAN | K1 sampai K11 diterima (K2 dan K3 dengan bentuk berbeda). `uiScale` wajib dihitung dalam piksel fisik |
| `docs/qa/test-plan.md` | QA | SETUJU DENGAN CATATAN | Hampir semua usulan diterima. Nama hook dan folder tes mengikuti architecture, replay emas memakai data fixture |

Tidak ada TOLAK. Semua perbaikan wajib di bagian 4 adalah penyelarasan dokumen dan bisa selesai sebelum atau di awal M1 tanpa menahan blok pembuka LP.

---

## 2. Keputusan teknis final (wilayah LP)

### 2.1 Pitch kamera dan satuan dunia
**Dipilih: pitch asin(0,625) = 38,682 derajat (usulan LD). 1 u = 16 px lebar dan tepat 10 px kedalaman.** asin(2/3) dari architecture versi 1 dicabut.

Alasan:
- Versi 1 memakai 1 unit = 1 piksel sprite; di sana asin(2/3) masuk akal (texel lantai 1,5 unit). GDD dan LD memakai 1 u = 16 px, dan itu satuan yang lebih baik untuk data (kecepatan 4,5 u/s, radius 1,6 u). Dengan 16 px per u, asin(2/3) memberi 10,667 px per u kedalaman: tepi tile dan texel lantai jatuh di setengah piksel dan bergetar.
- asin(0,625) memberi bilangan bulat (10 px), tile lantai 16 x 10 px per u, dan tetap "sekitar 40 derajat" (style guide 1.4).
- Biaya: gerak vertikal mentah tampil 62,5% dari horizontal. Ini diatasi keputusan CD K7 (kompensasi layar pemain 80%, rumus deterministik di architecture 7.1, rasio di data GD).

Konstanta final (`src/core/constants.ts`): `PX_PER_U = 16`, `CAMERA_PITCH_SIN = 0.625`, `DEPTH_PX_PER_U = 10`, `HEIGHT_PX_PER_U = 12.49` (permukaan vertikal saja), bingkai referensi 640 x 360, kotak wajib terlihat x 16 sampai 624 dan y 32 sampai 328, target kamera `[0, 0, -2]`.

### 2.2 Arena dan viewport
- **Arena 32 x 20 u LD dikonfirmasi tanpa koreksi**: tampil 512 x 200 px (x 64 sampai 576, y 100 sampai 300), pas di dalam pita tajam 54 sampai 324 dengan ruang kepala 46 px dan bibir depan 24 px. Batas teknis tetap sampai rilis.
- **Skala dunia diganti ke rumus LD**: `max(1, floor(min(Wp / 608, Hp / 296)))` dalam piksel fisik. Rumus versi 1 (`/640`, `/360`) membuat 1920 x 950 (1080p dengan toolbar browser, kasus paling umum) turun ke skala 2; rumus baru tetap 3.
- **Pita DoF dalam piksel bingkai referensi** (usulan LD diterima): tajam untuk 54 sampai 324.
- **Skala UI terpisah** dari skala dunia (UI tetap kanvas 640 x 360), tapi dihitung dalam piksel fisik agar bulat di layar ber-DPR 1,25 dan 1,5 (umum di laptop Windows).

### 2.3 Konvensi id (menjawab CD)
Bioma `biome_market`, `biome_cloister`, `biome_vineyard`; arena `arena_market`, `arena_cloister`, `arena_vineyard`, `arena_proto` (M1). `b1` sampai `b3` hanya awalan token palet. Id data `snake_case` (termasuk tag: `flame`, bukan `Flame`); id aset art `kebab-case`.

---

## 3. Permintaan kontrak: diterima atau ditolak

### 3.1 UI (ui-spec 12.2)

| # | Putusan | Bentuk final (architecture) |
|---|---|---|
| K1 hadiah Warden | Diterima | Fase `reward`, `RewardView`, command `reward.pick`, event `RewardShown`, `RewardChosen` (4.4, 6.2, 6.4) |
| K2 pratinjau merge | Diterima, bentuk beda | Sim menghitung `ShopOfferView.mergeSlot`, `mergeToTier`, `blockedNoSlot`, `InventorySlotView.canMerge`. Bukan fungsi aturan di `core`, agar aturan hanya di sim. Command baru `shop.merge` |
| K3 pratinjau tag | Diterima, bentuk beda | `synergyTierFor` di `src/content/rules/` (murni, dari data), plus `ShopOfferView.isNewId` untuk aturan "id berbeda" GDD 8.1 |
| K4 penyebab kematian | Diterima | `PlayerDied.c` (SourceRef) dan `WorldView.runStats.killedBy` |
| K5 bar HP boss | Diterima, diperluas | `PulseView.boss` dan `PulseView.warden` (`BigFoeView`), `ticksTotal = 0` untuk Pulse boss, `overtime` |
| K6 Arsip | Diterima | `AppScreen` `archive` dan `credits`, `AppActions.unlock`, `openArchive`, `deleteSaveData`, `UiDeps.meta` |
| K7 pengaturan | Diterima | `Settings` final bertingkat (`graphics`, `audio`, `access`, `keybinds`) di 6.11 |
| K8 kesulitan | Diterima | `difficulty` di `run.start` dan `AppActions.startRun` |
| K9 angka damage | Diterima | Render dari `EnemyDamaged` (bukan `EnemyHit`), lewat `Renderer.applySettings` |
| K10 proyeksi | Sudah ada | `Projector`, ditambah `cssToWorld` untuk bidik mouse |
| K11 suara UI | Diterima | `UiDeps.sound.play(cueId)` diteruskan app ke `AudioSystem.playUi` |

### 3.2 AU

| Permintaan | Putusan |
|---|---|
| Bus `ui` di `VolumeSettings` | Diterima. Nilai bulat 0 sampai 100, plus `mono`, `reduceRepeats`, `muteWhenUnfocused` di `Settings.audio`. Default 80/70/100/80 dari AU |
| Nama event payload vs `SimEventType` | Diselaraskan: tabel payload final di architecture 6.5. Kolom ketiga `c` ditambah untuk sumber |
| `ProcTriggered` | Diterima: `a = EffectIndex`, `b = jumlah`. Cue dipetakan dari id efek (`syn_flame_4`). Rush penuh memakai `BuffMaxed` |
| Sumber damage (ledakan `lantern_bolt`, kontak `orbit_shards`) | Diterima: `EnemyDamaged.c` = SourceRef (senjata, Rite, efek, status), `b` bit 4-6 = `HitKind` (proyektil, area, dll.) |
| Penanda mengamuk boss | Diterima sebagai event terpisah `BossEnraged`. Warden `hasted` lewat `AffixApplied` |
| `sfxFire` di data senjata | **Ditolak**. CSV GD tidak memuat kolom audio; pemetaan id ke cue di `src/audio/event-map.ts` atau `cues.json`, dengan tes cakupan |
| Data di `src/audio/` | Diterima (architecture versi 1 menyebut `audio/music/`, dikoreksi) |
| `arenaHalfWidth` dari data | Diterima: `AudioSystem.setArena(arena)`; arena final memberi 16, bukan 14 |
| Tambahan dari LP | `GlintSwept` untuk pungutan otomatis akhir Pulse, `SpawnMarked` untuk retakan spawn |

### 3.3 AD

| Permintaan | Putusan |
|---|---|
| `art/**/*.ts` di tsconfig | Diterima: masuk `tsconfig.json` (dibundel) dan `tsconfig.tools.json`. Generator hanya boleh import `src/core/contracts/sprite.ts` dan `src/core/math` |
| Import JSON dari `art/` | Diterima, hanya di `src/app/assets.ts` (`import.meta.glob`) dan tool (`fs`). Render dan UI menerima art lewat dependensi |
| Skrip `art:check`, `art:preview`, `art:concepts` | Diterima; `art:check` masuk `npm run check` |
| Sampling bilinear bloom dan blur | Diterima: pass akhir di resolusi fisik, bloom dan pita blur bilinear, area tajam dan bahaya nearest (architecture 7.5) |
| Rasterizer dipindah LP | Diterima, lokasi **`src/core/sprite/`** (bukan `src/render/sprites/`) agar render, UI (ikon), dan tool memakai fungsi yang sama |
| `SpriteSheetDef` | Tipe kanonik pindah ke `src/core/contracts/sprite.ts`, termasuk ekstensi AD; `art/sprites/sprite-types.ts` menjadi re-export |
| Atlas berindeks palet M2 | Disetujui |
| Cahaya bioma | `art/palette.json` menjadi satu sumber kunci, isi, kabut, grading, dan preset titik cahaya. JSON arena LD hanya posisi |

### 3.4 QA (test-plan 7.2, 5, 9)

| Usulan | Putusan |
|---|---|
| Objek `window.__SHARDFALL_TEST__`, flag `VITE_TEST_HOOKS` | Diganti: `window.__shardfall`, konstanta `__E2E__` pada `npm run build:e2e` |
| `setSeed`, `startRun(classId, biomeId)` | Digabung: `startRun({ seed, classId, profile, difficulty })` |
| `pause`, `resume`, `step`, `setTimeScale` | Diterima sebagai `pauseLoop`, `resumeLoop`, `step`, `setTimeScale` (0,25 sampai 16) |
| `getStateHash`, `getSnapshot`, `getScreenPositions`, `getPerf`, `goToScreen`, `spawnStress`, `grantItem`, `loadReplay`, `exportReplay` | Diterima dengan nama sama, tipe di architecture 6.12. Perubahan state lewat `DebugCommand` yang ditolak sim di build produksi |
| `hashState` FNV-1a atas bit float | Diterima: `Sim.hash()`, 8 hex, hanya slot hidup, pool di-reset kanonik di batas Pulse agar D-4 lolos |
| Format replay | Ditetapkan: architecture 4.5 (RLE input, command bertick, checkpoint tiap 60 tick) |
| D-7 replay emas | Diterima dengan syarat: memakai data fixture, bukan data asli |
| Folder tes, perintah npm | Diterima dengan penyesuaian: `tests/determinism/`, `tests/bot/`, `tests/data/`, `tests/assets/`, `tests/perf/`; perintah `test`, `test:det`, `test:bot`, `test:assets`, `test:e2e`, `test:perf`, `qa:report` |
| P-REF dan ambang performa | P-REF diterima. Ambang final: p95 16,7 ms, p99 25 ms, rata-rata 58 fps di Sedang; sim p95 4 ms (architecture 13) |
| `@vitest/coverage-v8` | Layak secara teknis, butuh persetujuan Producer |
| Aturan lint string hardcode (DV-6) | Ditunda: di M1 dicek lewat review dan tes kunci; aturan otomatis bila sempat di M2 |

### 3.5 LD (format JSON arena)
Diterima dengan penyesuaian (architecture 6.10, 9.6): id dan nama file `snake_case` (`arena_market`, `arena_proto`); `units`, `camera`, `nameKey` dihapus (konstanta global dan nama dari bioma); `lighting.key`, `fill`, warna titik cahaya pindah ke palet AD; warna memakai token palet; `floor.pattern` menjadi `floor.tileId`; poligon wajib berurutan dan cembung; titik cahaya urut prioritas (kualitas Rendah memakai 4 pertama). Validator LD-T01 dan LD-T10 ditulis LP sebagai bagian build data. Anggaran 80 dekorasi, 12 animasi, 8 titik cahaya disetujui.

### 3.6 GD (skema CSV)
- **`waves.csv` dan `wave_spawns.csv` tetap terpisah** (lebih mudah diedit), digabung saat build menjadi `profiles[profile][i].spawns[]` dengan kunci gabungan `(profile, pulse)` tervalidasi.
- **Bentuk JSON**: satu bundle per tingkat konten, setiap tabel menjadi array dalam urutan baris CSV (bukan objek berkunci id), karena urutan pool menentukan hasil pengundian RNG. `effectsByOwner` dibangun saat load. Tier difilter saat build dari `content/build.json`.
- Format `params` `k=v;k=v`, persen stat sebagai poin, peluang sebagai pecahan, boolean 0/1, tabel kunci-nilai bertipe per kunci: diterima.
- Satuan ditentukan skema per kolom; nama kolom GD (`cooldown`, `speed`, `duration_s`) diterima. Aturan akhiran `_sec`/`_px` versi 1 dicabut.

### 3.7 GD (batas performa)
Diterima semua: **200 proyektil proc hidup** (batas lunak di pool proyektil pemain berkapasitas 512), **24 zona hidup** (pool zona pemain 32), **150 Glint di lantai** (`glint_floor_cap`, pool pickup 256). Spawn di atas batas dilewati secara deterministik dan dihitung sebagai overflow (QA memantau). Tambahan LP: pool aksi tertunda 128 (untuk `repeat` dan gema) dan maksimal 4 efek `every_nth` ber-scope `per_target` per run.

---

## 4. Arahan perbaikan per pemilik

Label: **[Wajib]** harus selesai sebelum pemilik mulai kerja M1 di area itu. **[Saran]** boleh ditolak dengan alasan tertulis.

### GD (`gdd.md`, `data-schema.md`, `effect-primitives.md`)
1. [Wajib] `data-schema.md`: kolom tingkat konten `tier` (A/B/C) menjadi `content_tier` di semua tabel. `tier` di `weapon_tiers.csv` tetap (tier senjata).
2. [Wajib] Tag di CSV memakai id huruf kecil (`flame|edge`, `source_tag:flame`). Nama tampil lewat `tag.<id>.name`.
3. [Wajib] Hapus `tick_rate` dari `config.csv` (konstanta teknis LP). Tambah kunci `pulse_clear_s` (1,0, GDD 3.3) dan `player_vertical_screen_ratio` (0,8, CD K7).
4. [Wajib] `keepsakes.csv` menjadi `mementos.csv`, dan istilah Memento di ketiga dokumen (selaras CD K1).
5. [Wajib] `biomes.csv`: hapus `palette_id` (palet dicari lewat `contentId`), nilai `arena_id` `arena_market`, `arena_cloister`, `arena_vineyard` (M1: `arena_proto`).
6. [Wajib] `effect-primitives.md`: tetapkan urutan komposisi stat, misalnya `(dasar + Σadd) x Πmult`, lalu `min`, lalu `convert` dari nilai sumber final, lalu jepit min dan max `stats.csv`. Tanpa ini GP harus menebak dan hasil build bisa berbeda dari model GD.
7. [Wajib] GDD 4.2: aturan gabung Glint di atas 150 butir yang **menjaga total nilai** dan deterministik (misalnya: dua butir tertua digabung menjadi satu bernilai jumlahnya, diulang sampai di bawah batas).
8. [Wajib] GDD 0 dan 22: ganti asumsi 28 x 18 u dengan arena 32 x 20 u dan periksa ulang jarak (jarak jaga shooter, summoner, lobber, radius spawn) di CSV.
9. [Wajib] `data-schema.md` bagian 4: rujuk architecture 9.4 (array berurutan, tier difilter saat build) sebagai bentuk JSON final.
10. [Saran] Kolom opsional `sectors` di `wave_spawns.csv` (kosong = semua sektor) agar arah datang dari LD bisa dipakai.
11. [Saran] Kunci `telegraph_min_projectile_s`, `telegraph_min_charge_s`, `telegraph_min_area_s`, `telegraph_min_boss_s` di `config.csv` agar validator menegakkan P2-e otomatis.
12. [Saran] Konfirmasi: urutan `reward` lalu `levelUp` lalu `shop`; arti `shop.merge` (gabung manual dua salinan di inventaris); rintangan tidak menghalangi proyektil; pemain kembali ke titik awal tiap Pulse.

### LD (`arena-design.md`)
1. [Wajib] Bagian 14: ikuti architecture 6.10 dan 9.6 (id `snake_case`, tanpa `units`, `camera`, `nameKey`, tanpa `lighting.key` dan `fill`, warna sebagai token, `floor.tileId`, titik cahaya `{ id, pos, intensityMul?, flicker? }` urut prioritas). Contoh JSON diperbarui; arena M1 bernama `arena_proto`.
2. [Wajib] Bagian 2.3: rumus layar merujuk konstanta architecture 7.1 (faktor tinggi 12,49, offset `originX` dan `originY` untuk bingkai selain 640 x 360). Sumbu `z` LD sama dengan `y` sim; tulis satu kalimat pemetaan.
3. [Wajib] Poligon sektor spawn dan batas ditulis berurutan searah jarum jam di layar (validator menolak urutan bebas).
4. [Wajib] Nama bioma final dan warna cahaya contoh mengikuti CD dan AD (cahaya kini milik palet AD).
5. [Saran] Hapus kalimat alternatif "tepat 40 derajat": pitch sudah final.

### AD (`art-pipeline.md`, `tools/art/`, `art/`)
1. [Wajib] `art-pipeline.md` 6.2: aturan texel untuk pitch final: 1 texel = 1/16 u di x dan 1/10 u di kedalaman (tile 16 x 16 texel menutupi 1 x 1,6 u, atau tile 16 x 10 menutupi 1 x 1 u). Hapus angka asin(2/3) dan 1,5 unit.
2. [Wajib] `tools/art/lib/scene.mjs`: `FORESHORTEN = 2 / 3` menjadi `10 / 16`, lalu buat ulang konsep dan `measurements.json` agar uji rasa CD memakai proyeksi yang benar.
3. [Wajib] `art/palette.json`: `point.radiusPx` menjadi `rangeU` (unit dunia). Entri bioma menjadi satu-satunya sumber cahaya kunci, isi, kabut, grading, dan preset titik cahaya.
4. [Wajib, M1] Tool `.mjs` dipindah ke `.ts` dan meng-import rasterizer dan packer dari `src/core/sprite/` setelah LP memportingnya; `sprite-types.ts` menjadi re-export dari `src/core/contracts/sprite.ts`. Diagram bagian 1 dan serah terima bagian 10 menyebut lokasi baru.
5. [Wajib, M1] `art/sprites/boss-lantern.ts`: ganti `Math.sin` dengan `src/core/math` agar piksel identik lintas browser.
6. [Saran] Daftar placeholder sprite untuk proyektil per senjata, agar `sprite-ids.ts` bisa diuji cakupannya di M1.

### AU (`audio-direction.md`, `audio-list.md`)
1. [Wajib] `audio-list.md` 1.3 dan pemicu cue: pakai tabel event final architecture 6.5. Khususnya: `ProcTriggered` (a = `EffectIndex`, cue per id efek), Rush penuh lewat `BuffMaxed`, mengamuk lewat `BossEnraged`, Warden `hasted` lewat `AffixApplied`, `sfx.glint.sweep` lewat `GlintSwept`, sumber dampak lewat `EnemyDamaged.c` dan bit `HitKind`, telegraf memakai `c` untuk sumber.
2. [Wajib] `audio-list.md` 4.1: hapus "kolom data senjata `sfxFire`"; pemetaan senjata ke cue tinggal di file AU dan diuji cakupannya terhadap `GameData`.
3. [Wajib] `audio-direction.md` 8.6: `arenaHalfWidth` dari `AudioSystem.setArena` (16 u untuk arena final).
4. [Wajib] Ekspor WAV ke `audio/preview/` (di-gitignore), bukan `audio/sfx/` dan `audio/music/`.
5. [Wajib] Istilah Memento (`sfx.memento.gain`, `MementoAcquired`), selaras CD.
6. [Wajib] Perintah final: `audio:check` (validator musik dan `cues.json`, masuk `check`) dan `audio:render`; tool ditulis `.ts`. Ducking dipicu `PlayerDamaged` (bukan `PlayerHit`).

### UI (`ui-spec.md`)
1. [Wajib] Bagian 12: ganti tabel K1 sampai K11 dengan bentuk final di bagian 3.1 dokumen ini (fase `reward`, `shop.merge`, field `ShopOfferView` dan `InventorySlotView`, `synergyTierFor`, `runStats.killedBy`, `PulseView.boss` dan `warden`, `Settings` bertingkat, `UiDeps.sound`, `meta`, `art`).
2. [Wajib] Bagian 7.1: `uiScale` dihitung dari piksel fisik (CSS x `devicePixelRatio`), lalu `--u = uiScale / devicePixelRatio` px. Tanpa ini UI buram di DPR 1,25 dan 1,5.
3. [Wajib] Bagian 5 S07: kualitas default **Medium** (bukan High, target P-REF); volume default 80/70/100/80 (AU); tambah slider volume UI (Interface), toggle Mono Audio, dan Reduce Repeats (AU 8.7, [Wajib] AU).
4. [Wajib] Nama event: `PlayerHit` menjadi `PlayerDamaged`, `EnemyHit` menjadi `EnemyDamaged`. Id layar `credits` ditambah ke daftar tes.
5. [Wajib] Istilah Memento sesuai CD.

### QA (`test-plan.md`)
1. [Wajib] Bagian 7.2: ganti dengan interface final architecture 6.12 (`window.__shardfall`, `__E2E__`, `startRun(opts)`, `pauseLoop`, `resumeLoop`).
2. [Wajib] Bagian 3: lokasi tes dan perintah final (architecture 14, 15.1).
3. [Wajib] D-7: replay emas memakai data fixture `tests/fixtures/data/`.
4. [Wajib] Bagian 9.4: PF-1 sampai PF-4 memakai ambang architecture 13.
5. [Wajib] Bagian 5.1: format replay merujuk architecture 4.5.

### Producer
1. Setujui `@types/node` (dev, MIT): tanpa paket ini `tsconfig.tools.json` tidak bisa memeriksa tool Node.
2. Putuskan `@vitest/coverage-v8` (opsional).
3. Pemilik `content/build.json` (`contentTier`, awal `A`).
4. Catat di `docs/tasks.md`: pitch asin(0,625) dan 1 u = 16 px (menggantikan baris "kalibrasi M1" kamera), arena 32 x 20 u final, kontrak architecture versi 2 dibekukan untuk M1.

### LP (diri sendiri, blok pembuka M1)
1. Tulis `src/core/contracts/` persis architecture 6, termasuk `SourceRef`, `Settings` default, `E2eHooks`.
2. Porting rasterizer dan packer AD ke `src/core/sprite/` dengan tes kesetaraan terhadap keluaran tool AD sekarang.
3. Validator arena (LD-T01, LD-T10) dan DSL skema dengan registri `params`.

---

## 5. Catatan kelayakan (tidak menuntut perubahan dokumen)

- Mesin efek (16 pemicu, 15 syarat, 16 aksi) layak dengan `procDepth` per hit, pool aksi tertunda, dan stat yang dihitung ulang hanya saat inputnya berubah (architecture 8.5).
- Burn sampai 5 tumpukan per Unlit muat sebagai kolom SoA tetap (5 x 256 slot).
- Skenario puncak (120 musuh, 450 proyektil, 24 zona, 150 Glint) masuk anggaran: tabrakan lewat grid 19 x 13 sel, satu `InstancedMesh` per lapis.
- Pola boss dengan cincin bercelah (Snuff Ring) dan jalur (Lantern Lanes) tercakup `AreaShape` Ring dan Line.
- Validator sprite AD dijalankan LP: `node tools/art/check-sprites.mjs --no-preview` menghasilkan 16 sprite, 0 gagal, exit 0.

## 6. Pertanyaan terbuka
1. Producer: persetujuan `@types/node` dan keputusan `@vitest/coverage-v8`.
2. GD: urutan komposisi stat dan aturan gabung Glint (perbaikan wajib 6 dan 7); konfirmasi butir saran 12.
3. CD dan GD: nilai akhir `player_vertical_screen_ratio` setelah build M1 (rentang 0,75 sampai 0,85).
