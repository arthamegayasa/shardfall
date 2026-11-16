# Shardfall: Arsitektur Teknis

Pemilik: Lead Programmer (LP). Status: **versi 2.3, 2026-11-17: kontrak dibekukan di kode oleh M1-01, tambahan aditif M1-09a dan M2-02 (lihat bagian 6, 7.8, dan 19)**. Sumber kebenaran tunggal untuk M1.
Dokumen terkait: `docs/tech/coding-standards.md` (aturan kode), `docs/reviews/M0-lp.md` (putusan review dan arahan perbaikan per pemilik), `docs/pillars.md`, `docs/style-guide.md`, `docs/gdd.md` dan `docs/systems/*.md` (GD: isi dan arti data), `docs/levels/arena-design.md` (LD), `docs/art-pipeline.md` (AD), `docs/audio-direction.md` dan `docs/audio-list.md` (AU), `docs/ui/ui-spec.md` (UI), `docs/qa/test-plan.md` (QA).

Penanda: **[Beku M1]** bagian yang dibekukan untuk M1: perubahan hanya lewat LP, dikumpulkan dan diputuskan sekali per putaran, lalu dicatat di bagian 19. **[Wajib]** tidak boleh dilanggar tanpa persetujuan LP. **[Saran]** boleh disesuaikan pemilik wilayah dengan alasan tertulis. **[Asumsi]** dikalibrasi di M1 atau M2.

Aturan prioritas bila dokumen peran lain berbeda dengan dokumen ini dalam hal teknis (format, kontrak, satuan, nama event, hook, skrip): **dokumen ini yang berlaku** (handoff 4.4, konflik teknis milik LP). Isi desain (angka, aturan main, rasa) tetap milik pemilik masing-masing.

---

## 0. Ringkasan perubahan versi 2

| Hal | Versi 1 | Versi 2 (final) |
|---|---|---|
| Satuan dunia | 1 unit = 1 piksel sprite | **1 u = 16 piksel sprite** (selaras GDD dan LD) |
| Pitch kamera | asin(2/3), sekitar 41,8 derajat | **asin(0,625), sekitar 38,68 derajat**: 1 u kedalaman = tepat 10 px |
| Skala layar | `floor(min(W/640, H/360))` | **`floor(min(W/608, H/296))`** (kotak wajib terlihat LD) |
| Arena | maks 576 x 360 unit | **32 x 20 u, sudut terpotong 3 u**, format JSON LD dengan penyesuaian (9.6) |
| Fase run | tanpa hadiah Warden | tambah fase **`reward`** |
| Event | payload `a`, `b` | tambah kolom **`c`** (sumber terkode), event baru `ProcTriggered`, `BossEnraged`, `AffixApplied`, `GlintSwept`, `SpawnMarked`, dll. |
| Hook tes | `window.__shardfall` versi awal | nama final gabungan usulan QA (6.12) |
| Rasterizer sprite | `src/render/sprites/` | **`src/core/sprite/`** (murni, dipakai render, UI, dan tool) |
| Data audio | `audio/music/*.json` | **`src/audio/music/*.json`, `src/audio/cues/cues.json`** (usulan AU) |
| Istilah | Keepsake | **Memento** di semua identifier (keputusan CD K1): `MementoIndex`, `MementoAcquired`, `mementos.csv` |
| Gerak vertikal | tanpa kompensasi | kompensasi layar pemain dari data (CD K7, rumus 7.1) |
| Upscale | nearest saja | pass akhir fisik: scene dan bahaya nearest, bloom dan pita blur bilinear (7.5) |

---

## 1. Ringkasan keputusan

| # | Keputusan | Alasan singkat |
|---|---|---|
| 1 | TypeScript strict, three.js (WebGL2), Vite, Vitest, Playwright, ESLint, Prettier, Web Audio API tanpa library | Sesuai handoff; semua open source berlisensi permisif |
| 2 | Post-processing ditulis sendiri (pass kecil di atas `WebGLRenderTarget`), tanpa library `postprocessing` | Kebutuhan khusus: blur pita tepi, bloom piksel emisif, lapisan bahaya digambar sesudah post-processing. Cadangan: `EffectComposer` dari `three/examples/jsm` |
| 3 | Simulasi deterministik murni di `src/sim`, tick tetap 60 Hz, RNG ber-seed per aliran, tanpa `Math.random`, `Date`, DOM, atau three.js | Bug bisa direproduksi, balance bisa diuji otomatis, sim jalan di Node |
| 4 | Dunia dirender ke render target beresolusi virtual, lalu diperbesar skala integer dengan filter nearest | Satu skala piksel (P3-a, P3-b), post-processing murah |
| 5 | Kamera ortografis tetap, **pitch asin(0,625) = 38,682 derajat**, **1 u = 16 px lebar dan 10 px kedalaman**, seluruh arena selalu terlihat | Kedalaman lantai bilangan bulat, tekstur lantai tidak bergetar setengah piksel (7.1) |
| 6 | Entitas sim memakai pool struct-of-arrays (SoA) berkapasitas tetap, slot stabil, di-reset kanonik di setiap batas Pulse | Nol alokasi per tick, mudah di-hash, save/load identik |
| 7 | Tabrakan lingkaran, spatial hash grid seragam (sel 2 u) dibangun ulang tiap tick dengan counting sort | Sederhana, deterministik, tanpa alokasi |
| 8 | Data: CSV GD, JSON arena LD, string WR diubah `tools/data/build-data.ts` menjadi satu JSON tervalidasi per tingkat konten | Angka balance hanya di data; error data ketahuan saat build |
| 9 | Pixel art dari data (`art/`), dirasterisasi fungsi murni di `src/core/sprite/` menjadi atlas saat boot | Tanpa PNG di bundle, bisa dibuat ulang, audit kode warna otomatis |
| 10 | Audio sintesis runtime: SFX dirender ke `AudioBuffer` saat boot, musik oleh sequencer lookahead | Unduhan audio 0 byte |
| 11 | UI memakai DOM (TypeScript tanpa framework) di atas canvas | Aksesibilitas, iterasi cepat, bundle kecil |
| 12 | Autosave di awal fase pilihan pasca-Pulse (`reward`, `levelUp`, atau `shop`, mana yang pertama) dan setelah setiap command pilihan | Tidak ada save-scum, pilihan tidak bisa di-reroll lewat muat ulang |
| 13 | Hook tes hanya di build mode `e2e`, dihapus dari bundle produksi lewat `__E2E__` dan dicek otomatis | Aturan handoff |
| 14 | Deploy statis ke GitHub Pages dengan base `/shardfall/` lewat GitHub Actions | Keputusan Producer |

---

## 2. Stack final

### 2.1 Platform target
- Browser desktop terbaru: Chrome, Edge, Firefox, Safari 16.4 ke atas (diproksi WebKit Playwright, keputusan Producer). **WebGL2 wajib**; tanpa WebGL2 tampil pesan statis.
- Keyboard dan mouse; gamepad opsional (M4).
- Viewport minimum didukung: 1280 x 720 piksel CSS.

### 2.2 Dependensi (dipasang LP di M1)

| Paket | Jenis | Lisensi (cek ulang saat instal) | Status | Kegunaan |
|---|---|---|---|---|
| `three` | runtime | MIT | Disetujui | Render WebGL2 |
| `typescript` | dev | Apache-2.0 | Disetujui | Typecheck |
| `vite` | dev | MIT | Disetujui | Dev server, build, import JSON |
| `vitest` | dev | MIT | Disetujui | Unit, data, determinisme, bot |
| `@playwright/test` | dev | Apache-2.0 | Disetujui | E2E, screenshot, performa |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | dev | MIT (sebagian BSD-2-Clause) | Disetujui | Lint |
| `prettier` | dev | MIT | Disetujui | Format |
| `@types/three` | dev | MIT | Disetujui | Tipe three.js |
| `@types/node` | dev | MIT | **Butuh persetujuan Producer** | Typecheck tool Node (`node:fs`, `node:zlib`). Tanpa ini `tsconfig.tools.json` tidak bisa memeriksa `tools/` |
| `@vitest/coverage-v8` | dev | MIT | Opsional, butuh persetujuan Producer | Cakupan kode sim (usulan QA 4.1). Bila tidak dipasang, cakupan dinilai dari daftar perilaku |

- Satu-satunya dependensi runtime adalah `three`.
- Browser Playwright: Chromium sejak M1, Firefox (unduhan CDN Playwright, sudah diizinkan Producer) dan WebKit di M4.
- Tool ditulis TypeScript dan dijalankan `node tools/x.ts` (type stripping Node 24), tanpa `tsx`. Tool `.mjs` milik AD dipindah ke `.ts` di M1 (lihat review).

---

## 3. Gambaran besar

```
                 +--------------------------------------------------------+
                 |  src/app (composition root: boot, loop, input, save,   |
                 |  settings, meta, assets dari art/, hook e2e)           |
                 +--------------------------------------------------------+
       InputFrame |  Command (antre)          ^ WorldView (read-only) + FrameEvents
                  v                           |
            +-----------+  event per tick     |
            |  src/sim  | --------------------+-----> src/render (dunia, VFX, angka damage)
            |  (murni)  |                     +-----> src/ui     (HUD, layar, menu)
            +-----------+                     +-----> src/audio  (SFX, musik)
                  ^                                       |
                  | GameData (JSON tervalidasi)           | Command (toko, kartu, hadiah)
            +-------------+                               v
            | src/content | <--- content/generated/*.json   app meneruskan ke sim
            +-------------+
```

Aturan aliran [Wajib]:
1. Sim tidak tahu render, UI, atau audio ada. Sim hanya menerima `InputFrame` dan `Command`, dan menghasilkan state (lewat `WorldView`) serta event.
2. Render, UI, dan audio hanya membaca `WorldView` dan event. Satu-satunya cara mengubah game adalah `Command` lewat `CommandSink`.
3. Render, UI, dan audio tidak saling import. Kebutuhan bersama disediakan `src/app` lewat interface di `src/core/contracts/`.

---

## 4. Simulasi deterministik

### 4.1 Tick tetap [Wajib]
- `TICK_RATE = 60`. Satu `step()` = tepat satu tick. Semua besaran waktu di sim dalam tick; besaran per detik dari data dikonversi sekali saat load (9.4). `TICK_RATE` adalah konstanta teknis di `src/core/constants.ts`, **bukan** data (tidak ada `tick_rate` di CSV).
- Loop di `src/app/loop.ts`: `acc += min(frameDeltaMs, 250)`; selama `acc >= TICK_MS` dan tick di frame ini kurang dari `maxTicksPerFrame` (4; mode e2e boleh sampai 16 untuk `setTimeScale`), jalankan `sim.step(input)`. Sisa akumulator di atas batas dibuang (game melambat, bukan spiral of death). Render memakai `alpha = acc / TICK_MS`.
- Jeda dan tab tersembunyi menghentikan tick. Sim tidak tahu soal jeda. Hitung mundur 900 ms setelah lanjut dari jeda (ui-spec S06) adalah state app; sim tidak berjalan selama hitung mundur.
- Hit stop dan gerak lambat saat mati diimplementasikan di dalam sim sebagai penghitung tick.

### 4.2 Larangan di `src/sim` [Wajib, dipaksa ESLint dan tsconfig]
- Tidak ada `Math.random`, `Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `crypto`.
- Tidak ada import dari `three`, DOM, `src/render`, `src/ui`, `src/audio`, `src/app`. Tidak ada `import.meta.env`.
- Tidak ada `Math.sin/cos/tan/atan2/exp/log/pow/hypot` dan `**` pecahan. Pakai `src/core/math` (aproksimasi dengan `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`, `Math.imul`, `Math.fround`). Sudut di sim disimpan dalam **putaran** (turns, 1 = 360 derajat); data dalam derajat dikonversi saat load.
- Iterasi dalam urutan slot naik. `sort` wajib memakai pembanding total. **Seri jarak (target terdekat) diputus dengan slot terkecil** (menjawab effect-primitives 6.4).
- `src/sim`, `src/core`, `src/content` di-typecheck dengan `tsconfig.sim.json` tanpa lib DOM.

Cakupan jaminan: determinisme dijamin pada mesin JS yang sama (Node V8, Chrome, Edge). Firefox dan WebKit diuji di M4 (QA D-5) dan hasilnya dilaporkan.

### 4.3 RNG ber-seed per aliran [Wajib] [Beku M1]
- Generator `sfc32`, seed aliran = `splitmix32(hash(runSeed, streamName))`.

| Aliran | Dipakai untuk |
|---|---|
| `spawn` | Jadwal, posisi, sektor, dan jenis spawn |
| `ai` | Keputusan acak AI musuh, pilihan pola boss acak bila ada |
| `combat` | Kritikal, dodge, `chance` efek, sebaran, target acak efek |
| `loot` | Drop Glint, isi peti hadiah Warden dan boss |
| `shop` | Isi toko, reroll, dorongan merge |
| `levelUp` | Kartu level-up dan rarity-nya |

- Reroll toko tidak mengubah spawn Pulse berikutnya (diuji, 14.1).
- State semua aliran ikut di save dan di hash state.
- Keacakan visual dan audio memakai instance `Rng` sendiri dari `src/core/rng` (seed tetap di mode e2e). `Math.random` dilarang di seluruh `src/` dan `art/`.

### 4.4 Fase run [Beku M1]

```
idle --run.start--> pulse --waktu habis (dan Warden mati)--> pulseClear --> [reward] --> [levelUp x N] --> shop
                      |                                                                                   |
                      +--HP 0--> defeat                                     shop --pulse.begin--> pulse --+
                      +--boss final mati--> victory
                      (run.abandon di fase mana pun --> defeat dengan RunOutcome.Abandon)
```

- `RunPhase = 'idle' | 'pulse' | 'pulseClear' | 'reward' | 'levelUp' | 'shop' | 'victory' | 'defeat'`.
- Kode angka fase (untuk payload event): `RunPhaseCode = { idle: 0, pulse: 1, pulseClear: 2, reward: 3, levelUp: 4, shop: 5, victory: 6, defeat: 7 }`.
- `pulseClear`: jeda dari data (GDD 3.3: 1,0 s) untuk kilatan kaca, pemungutan otomatis Glint, dan banner. Pool dikosongkan di awal fase ini (8.1).
- `reward` hanya bila Warden atau boss non-final dikalahkan di Pulse itu. `levelUp` diulang selama ada level tertunda. Urutan ini milik GD (GDD 12) dan sama dengan ui-spec.
- Layar judul, pilih kelas, jeda, pengaturan, Arsip adalah state app/UI, bukan sim.
- Pulse boss tidak berbatas waktu: `PulseView.ticksTotal = 0` dan UI memakai bar HP boss (6.4).

### 4.5 Replay dan reproduksi bug [Beku M1]
Satu run ditentukan oleh: `contentHash`, seed, `classId`, `profile`, `difficulty`, daftar `InputFrame` per tick, dan daftar `Command` beserta tick-nya. Format file:

```jsonc
{
  "format": "shardfall-replay",
  "v": 1,
  "contentHash": "9f3a01c2",          // FNV-1a hex of canonical game-data JSON
  "contentTier": "A",
  "seed": 12345,
  "classId": "lantern",
  "profile": "run_a",
  "difficulty": 0,
  "ticks": 41230,                      // total ticks recorded
  // Run-length encoded InputFrame: [count, moveX, moveY, held, pressed, aimX, aimY]
  "input": [[120, 0, 0, 0, 0, 0, 0], [35, 127, 0, 0, 0, 40, -12]],
  // Commands with the tick at which they were enqueued (applied at the start of the next step)
  "commands": [[0, { "type": "run.start", "seed": 12345, "classId": "lantern", "profile": "run_a", "difficulty": 0 }]],
  // State hash every 60 ticks: [tick, "8 hex chars"]
  "checkpoints": [[60, "1a2b3c4d"], [120, "5e6f7081"]]
}
```

- Dev dan e2e bisa mengekspor dan memuat replay. QA melampirkan replay dan seed di laporan bug.
- Replay tidak membawa `pressed` yang hilang: app me-latch tombol sehingga satu tekan tidak pernah jatuh di antara tick.

---

## 5. Struktur folder dan kepemilikan [Beku M1]

```
src/
  main.ts              LP   entry: memanggil app/boot
  app/                 LP   composition root
    boot.ts  loop.ts  storage.ts  settings.ts  assets.ts (import.meta.glob art/)
    input/             LP   keyboard, mouse aim, gamepad, remap -> InputFrame
    save/              LP   envelope, migrasi, autosave
    meta/              LP   simpan Silt dan unlock (aturan murni dari src/sim/meta)
    e2e/               LP   hook tes, hanya di-import bila __E2E__
  core/                LP   MURNI: tanpa DOM, tanpa three. Boleh di-import semua modul
    contracts/         LP   interface antar modul (bagian 6). Perubahan wajib lewat LP
    sprite/            LP + AD  rasterize.ts, atlas-pack.ts (fungsi murni)
    rng.ts  hash.ts  math/  event-buffer.ts  ids.ts  constants.ts  assert.ts  projection.ts
  content/             LP   (GD mereview) DSL skema, parser CSV, validator, buildGameData, aturan murni turunan data (rules/)
  sim/                 GP   semua logika game
    create-sim.ts  world.ts  capacity.ts  pools/  systems/  effects/  spatial-hash.ts  save-codec.ts  state-hash.ts  meta/
  render/              LP + AD
    pipeline/          LP   renderer, render target, pass, upscale, kualitas
    camera.ts          LP
    sprites/           LP + AD  atlas texture, batch instanced, resolusi id sprite
    shaders/           AD (LP review)
    env/               AD   mesh arena, dekorasi, cahaya
    vfx/               AD   partikel dan efek dari event, angka damage
  ui/                  UI   struktur sesuai ui-spec 12.3
  audio/               AU   engine, synth/, cues/cues.json, music/*.json, event-map.ts
art/                   AD   palette.json, sprites/*.json|ts, tiles/, vfx/, atlas/preview/ (hasil tool), concept/
content/
  build.json           Producer  { "contentTier": "A" } tingkat konten build rilis
  data/*.csv           GD   angka balance
  levels/*.json        LD   arena
  strings/en.json      WR   string table
  generated/           tool (LP), di-commit, dicek CI
audio/preview/         tool (AU), WAV review, di-gitignore
tools/
  data/                LP   build-data.ts, validate-arena.ts, check-strings.ts
  art/                 AD   check-sprites.ts, build-concepts.ts, lib/
  audio/               AU   validate-music.ts, render-cues.ts
  balance/             GD   model dan simulasi balance headless
  bundle/              LP   check-bundle.ts
  qa/                  QA   report.ts
tests/
  unit/<modul>/        pemilik modul
  data/                LP + QA  validasi data dan teks (DV-1 sampai DV-7)
  determinism/         LP + GP
  bot/                 QA + GP  bot headless, bot-config.json
  assets/              AD + QA  audit art (kode warna, skala)
  bench/               LP + GP
  e2e/                 QA   Playwright
  perf/                QA   Playwright headed, profil P-REF
  fixtures/            pemilik modul: data/ (data mini), replays/ (replay emas), fake-world.ts
  support/             LP   bot input deterministik, helper
  out/                 hasil sementara, di-gitignore
```

Aturan kepemilikan [Wajib]:
- Hanya pemilik yang mengubah foldernya. Perubahan minimal di folder lain wajib disebut di laporan (agent-rules 3).
- `src/core/contracts/` milik LP. Peran lain mengusulkan, LP menulis.
- Setiap modul punya `index.ts` sebagai API publik; modul lain hanya import dari sana (ESLint).

Arah import yang diizinkan [Wajib]:

| Modul | Boleh import |
|---|---|
| `core` | tidak ada (hanya dirinya). Pengecualian M1-01: `core/contracts` boleh `import type` `GameData` dari `src/content/game-data.ts` (tipe saja, 19) |
| `content` | `core` |
| `sim` | `core`, `content` |
| `render` | `core`, `content`, `three` |
| `ui` | `core`, `content` |
| `audio` | `core`, `content`, data di `src/audio/**` |
| `app` | semuanya, termasuk `art/**` lewat `import.meta.glob` di `src/app/assets.ts` |
| `art/**/*.ts` (generator sprite) | hanya `src/core/contracts/sprite.ts` dan `src/core/math` |
| `tools/*` | `core`, `content`, `sim`, `art/` (path relatif ber-ekstensi `.ts`, atau `fs` untuk JSON) |

Render dan UI menerima data art (definisi sprite, palet) dari app lewat dependensi, bukan import langsung. UI dan render bisa dikembangkan dengan `WorldView` palsu (`tests/fixtures/fake-world.ts`) sebelum sim selesai.

---

## 6. Kontrak antar modul [Beku M1]

**Status M1-01 (2026-11-17): DIBEKUKAN untuk M1.** Kode kontrak ada di:

| File | Isi |
|---|---|
| `src/core/ids.ts`, `src/core/constants.ts` | 6.1 id bermerek, konstanta teknis, satuan dan kamera |
| `src/core/contracts/source.ts` | 6.1 `SourceKind`, `encodeSource`, `HitKind` |
| `src/core/contracts/input.ts`, `commands.ts` | 6.2 `InputFrame` (dengan `aimX`, `aimY` titik bidik Rite), `Command` (termasuk `shop.merge`, `reward.pick`), `DebugCommand`, `RejectReason` |
| `src/core/contracts/sim.ts` | 6.3 `SimConfig`, `Sim`, `LoadResult`, `CreateSim` |
| `src/core/contracts/world-view.ts` | 6.4 `WorldView` dan semua view pool, `RunPhase` (termasuk `reward`), `RunPhaseCode` |
| `src/core/contracts/events.ts`, `src/core/event-buffer.ts` | 6.5 `SimEventType`, `SimEventReader`, payload bit `EnemyDamaged`, buffer SoA berprioritas |
| `src/core/contracts/render.ts` | 6.6 `Renderer`, `Projector`, `RenderAssets`, `RenderFrame`, `CreateRenderer` |
| `src/core/contracts/ui.ts` | 6.7 `Ui`, `UiDeps`, `AppActions`, `ScreenId`, `MetaView`, `CreateUi` |
| `src/core/contracts/audio.ts` | 6.8 `AudioSystem`, `CreateAudio` |
| `src/content/game-data.ts` | 6.9 `GameData` (tipe baris diturunkan dari skema di `src/content/tables/`) |
| `src/core/contracts/arena.ts` | 6.10 `ArenaDef` |
| `src/core/contracts/save.ts`, `settings.ts` | 6.11 `RunSave`, `MetaSave`, `Settings`, `ActionId`, kunci localStorage. Default di `src/app/settings.ts` |
| `src/core/contracts/e2e.ts` | 6.12 `E2eHooks`, `window.__shardfall` |
| `src/core/contracts/replay.ts`, `sprite.ts`, `palette.ts`, `strings.ts` | 4.5 replay, 10 `SpriteSheetDef`, palet, string table |

Kontrak tanpa DOM diekspor `src/core/index.ts`. Kontrak yang memakai tipe DOM (`render.ts`, `ui.ts`, `e2e.ts`) diekspor terpisah lewat `src/core/dom.ts`, hanya untuk `render`, `ui`, dan `app`; `tsconfig.sim.json` mengecualikannya dan ESLint melarang `sim`, `content`, `audio` meng-import-nya. Factory ditulis sebagai tipe (`CreateSim`, `CreateRenderer`, ...) karena `declare function` tidak bisa diimplementasikan di file lain.

Semua di `src/core/contracts/`. LP menulis versi kodenya di blok pembuka M1 persis seperti di bawah (nama boleh dirapikan, arti tidak).

### 6.1 Id, konstanta, dan sumber terkode

```ts
// src/core/ids.ts
export type Brand<T, B extends string> = T & { readonly __brand: B };
/** Dense indices into GameData tables, assigned at load from string ids (CSV row order). */
export type EnemyTypeIndex = Brand<number, 'EnemyTypeIndex'>;
export type WeaponIndex = Brand<number, 'WeaponIndex'>;
export type MementoIndex = Brand<number, 'MementoIndex'>;
export type ClassIndex = Brand<number, 'ClassIndex'>;
export type RiteIndex = Brand<number, 'RiteIndex'>;
export type StatIndex = Brand<number, 'StatIndex'>;
export type TagIndex = Brand<number, 'TagIndex'>;
export type EffectIndex = Brand<number, 'EffectIndex'>;
export type AffixIndex = Brand<number, 'AffixIndex'>;
export type BossPatternIndex = Brand<number, 'BossPatternIndex'>;
export type StatusIndex = Brand<number, 'StatusIndex'>;
export type LevelUpCardIndex = Brand<number, 'LevelUpCardIndex'>;

// src/core/constants.ts  (technical constants only, never balance numbers)
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_TICKS_PER_FRAME = 4;
export const MAX_TICKS_PER_FRAME_E2E = 16;
// World units and camera: see section 7.1
export const PX_PER_U = 16;                  // screen px per world unit along x
export const CAMERA_PITCH_SIN = 0.625;       // pitch = asin(0.625) = 38.682 deg
export const DEPTH_PX_PER_U = 10;            // PX_PER_U * CAMERA_PITCH_SIN, exact
export const HEIGHT_PX_PER_U = 16 * Math.sqrt(1 - 0.625 * 0.625); // 12.49, vertical meshes only
export const REF_FRAME_W = 640;
export const REF_FRAME_H = 360;
export const REQUIRED_BOX = { x0: 16, y0: 32, x1: 624, y1: 328 } as const; // reference frame px
export const CAMERA_TARGET = { x: 0, h: 0, y: -2 } as const;            // world u (y = floor depth)
export const DOF_SHARP_TOP_PX = 54;          // reference frame y: blur only above this
export const DOF_SHARP_BOTTOM_PX = 324;      // reference frame y: blur only below this
```

```ts
// src/core/contracts/source.ts
/** Who caused a hit, telegraph, or projectile. Packed into one int for SoA columns and event payloads. */
export const SourceKind = {
  None: 0, Weapon: 1, Rite: 2, Effect: 3, Status: 4,
  EnemyContact: 5, EnemyAttack: 6, BossPattern: 7, Affix: 8, Spawn: 9,
} as const;
export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];
/** index is the dense index in the table matching kind (WeaponIndex, RiteIndex, EffectIndex, ...). */
export function encodeSource(kind: SourceKind, index: number): number { return kind * 65536 + index; }
export function sourceKindOf(ref: number): SourceKind { return Math.floor(ref / 65536) as SourceKind; }
export function sourceIndexOf(ref: number): number { return ref % 65536; }

/** Attack shape of a hit, mirrors source_kind in effect-primitives 4. */
export const HitKind = { Projectile: 0, Melee: 1, Area: 2, Chain: 3, Contact: 4, Zone: 5, Dot: 6 } as const;
export type HitKind = (typeof HitKind)[keyof typeof HitKind];
```

### 6.2 Input dan Command (app/UI ke sim)

```ts
// src/core/contracts/input.ts
export const Button = { Rite: 1 << 0 } as const;

export interface InputFrame {
  /** Movement intent, integers in [-127, 127]. Quantized for determinism and compact replays. */
  moveX: number;
  moveY: number;
  /** Bitmask of Button held during this tick. */
  held: number;
  /** Bitmask of Button pressed since the previous tick. Latched by app so a press is never lost. */
  pressed: number;
  /**
   * Rite aim point in world space, quantized to 1/16 u (integer = screen px at x scale).
   * Mouse: cursor projected to the floor. Gamepad: player position + move direction * 4 u.
   */
  aimX: number;
  aimY: number;
}

// src/core/contracts/commands.ts
/** Discrete player decisions. Applied by sim at the start of the next tick, FIFO. */
export type Command =
  | { readonly type: 'run.start'; readonly seed: number; readonly classId: string; readonly profile: string; readonly difficulty: number }
  | { readonly type: 'pulse.begin' }
  | { readonly type: 'reward.pick'; readonly choice: number }
  | { readonly type: 'levelup.pick'; readonly choice: number }
  | { readonly type: 'shop.buy'; readonly offer: number }
  | { readonly type: 'shop.reroll' }
  | { readonly type: 'shop.lock'; readonly offer: number; readonly locked: boolean }
  | { readonly type: 'shop.sell'; readonly inventorySlot: number }
  | { readonly type: 'shop.merge'; readonly inventorySlot: number }
  | { readonly type: 'run.abandon' }
  | DebugCommand;

/** Accepted only when SimConfig.debugCommands is true (dev and e2e builds). Rejected otherwise. */
export type DebugCommand =
  | { readonly type: 'debug.grant'; readonly kind: 'weapon' | 'memento'; readonly id: string; readonly tier: number }
  | { readonly type: 'debug.spawn'; readonly enemyId: string; readonly x: number; readonly y: number; readonly count: number }
  | { readonly type: 'debug.glint'; readonly amount: number }
  | { readonly type: 'debug.setHp'; readonly hp: number }
  | { readonly type: 'debug.endPulse' }                 // M1-09a: a living Warden dies first (reward follows)
  | { readonly type: 'debug.xp'; readonly amount: number };  // M1-09a: XP without Glint

export interface CommandSink { send(cmd: Command): void }

export const RejectReason = {
  WrongPhase: 1, NotEnoughGlint: 2, InvalidSlot: 3, SlotsFull: 4, NotMergeable: 5,
  UnknownId: 6, DebugDisabled: 7, MaxStack: 8,
} as const;
export type RejectReason = (typeof RejectReason)[keyof typeof RejectReason];
```

- Sim memvalidasi setiap command. Command tidak sah diabaikan dan menghasilkan `CommandRejected` (a = `RejectReason`). UI menampilkan status dari `WorldView`, aturan sebenarnya hanya di sim.
- `shop.merge`: menggabung senjata di slot itu dengan salinan id dan tier yang sama (GDD 4.4). Merge otomatis saat membeli dengan slot penuh tetap dilakukan sim di dalam `shop.buy`.
- `difficulty` = level Crack (0 di Tingkat A dan B).

### 6.3 Sim

```ts
// src/core/contracts/sim.ts
export interface SimConfig {
  readonly data: GameData;          // injected; sim never imports JSON
  /** Accept DebugCommand. App sets true only in dev and e2e builds. */
  readonly debugCommands?: boolean;
}

export interface Sim {
  /** Live read-only view. Valid until the next step(). Same object every tick. */
  readonly view: WorldView;
  /** Events produced by the most recent step() only. */
  readonly events: SimEventReader;
  enqueue(cmd: Command): void;
  step(input: InputFrame): void;
  /** Valid in phases reward, levelUp, shop. Returns null otherwise. */
  save(): RunSave | null;
  load(save: RunSave): LoadResult;
  /** FNV-1a 32-bit over the canonical sim state (8.4). */
  hash(): number;
}

export type LoadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unknownId' | 'badVersion' | 'corrupt' };

export declare function createSim(config: SimConfig): Sim;   // GP, src/sim/create-sim.ts
```

Arena tidak lagi disuntikkan terpisah: sim memilih `ArenaDef` dari `GameData.arenas` lewat bioma slot Pulse (`waves.csv` ke `biomes.csv` ke `arena_id`).

### 6.4 WorldView

Prinsip: state di typed array, dipaparkan sebagai `ArrayLike<number>` read-only tanpa salin. View valid sampai `step()` berikutnya.

```ts
// src/core/contracts/world-view.ts
export type RunPhase = 'idle' | 'pulse' | 'pulseClear' | 'reward' | 'levelUp' | 'shop' | 'victory' | 'defeat';

/** Common SoA layout of a fixed-capacity pool with stable slots. Positions in world u. */
export interface PoolView {
  readonly capacity: number;
  /** Iterate 0..highWater-1 and skip where alive[i] === 0. */
  readonly highWater: number;
  readonly alive: ArrayLike<number>;
  /** Increments whenever a slot is reused. Render resets per-slot animation on change. Not hashed. */
  readonly serial: ArrayLike<number>;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly prevX: ArrayLike<number>;
  readonly prevY: ArrayLike<number>;
  readonly radius: ArrayLike<number>;
}

export const EnemyRank = { Normal: 0, Warden: 1, Boss: 2 } as const;
export const StatusBit = { Burn: 1, Slow: 2, Mark: 4 } as const;

export interface EnemyPoolView extends PoolView {
  readonly typeIndex: ArrayLike<number>;     // EnemyTypeIndex
  readonly rank: ArrayLike<number>;          // EnemyRank
  readonly hp: ArrayLike<number>;
  readonly maxHp: ArrayLike<number>;
  /** Shell from affix veiled, 0 when none. */
  readonly shield: ArrayLike<number>;
  /** AI state code (idle, move, windup, attack, recover, ...) for animation and telegraph visuals. */
  readonly aiState: ArrayLike<number>;
  readonly aiStateTicks: ArrayLike<number>;
  readonly facing: ArrayLike<number>;        // -1 left, 1 right
  readonly hitFlashTicks: ArrayLike<number>;
  readonly statusMask: ArrayLike<number>;    // StatusBit
  /** Ticks since spawn, for emerge animation and contact grace. */
  readonly ageTicks: ArrayLike<number>;
}

export interface ProjectilePoolView extends PoolView {
  readonly sourceRef: ArrayLike<number>;     // encodeSource(...), picks sprite and VFX
  readonly vx: ArrayLike<number>;            // u per tick, for 8-direction sprite choice
  readonly vy: ArrayLike<number>;
}

export const PickupKind = { Glint: 0 } as const;
export interface PickupPoolView extends PoolView {
  readonly kind: ArrayLike<number>;
  readonly amount: ArrayLike<number>;
  readonly magnetized: ArrayLike<number>;
}

export const AreaShape = { Circle: 0, Ring: 1, Line: 2, Cone: 3 } as const;
export const TelegraphKind = { Projectile: 1, Charge: 2, Area: 3, BossArea: 4, Ring: 5, Lane: 6, Cone: 7 } as const;

/**
 * Ground areas. Two pools share this layout: dangerAreas (telegraphs, enemy zones, layer L4)
 * and playerZones (fire zones, embers, auras, layer L3).
 * Shape params: Circle: radius. Ring: radius = outer, p0 = inner radius, p1 = gap centre (turns),
 * p2 = gap half width (turns, 0 = no gap). Line: (x2, y2) end point, p0 = half width.
 * Cone: (x2, y2) direction point, p0 = half angle (turns).
 */
export interface AreaPoolView extends PoolView {
  readonly shape: ArrayLike<number>;         // AreaShape
  readonly kind: ArrayLike<number>;          // TelegraphKind for danger, 0 for player zones
  readonly sourceRef: ArrayLike<number>;
  readonly x2: ArrayLike<number>;
  readonly y2: ArrayLike<number>;
  readonly p0: ArrayLike<number>;
  readonly p1: ArrayLike<number>;
  readonly p2: ArrayLike<number>;
  readonly ticksLeft: ArrayLike<number>;
  readonly ticksTotal: ArrayLike<number>;    // fill progress = 1 - ticksLeft / ticksTotal
}

/** Spawn cracks on the floor (no damage), drawn on L4 per arena-design 5.3. */
export interface SpawnMarkPoolView extends PoolView {
  readonly typeIndex: ArrayLike<number>;
  readonly ticksLeft: ArrayLike<number>;
  readonly ticksTotal: ArrayLike<number>;
}

export interface PlayerView {
  readonly x: number; readonly y: number; readonly prevX: number; readonly prevY: number;
  readonly radius: number;
  readonly facing: number;
  readonly classIndex: number;
  readonly hp: number; readonly maxHp: number;
  readonly level: number; readonly xp: number; readonly xpToNext: number;
  readonly glint: number;
  readonly riteIndex: number;
  readonly riteCooldownTicks: number; readonly riteCooldownMaxTicks: number;
  readonly riteCharges: number; readonly riteChargesMax: number;
  readonly barrier: number; readonly barrierMax: number;
  readonly invulnTicks: number;
  readonly hitFlashTicks: number;
  /** Final stat values, indexed by StatIndex. */
  readonly stats: ArrayLike<number>;
}

/** Single big foe for HUD bars: the Warden of a Warden Pulse, or the boss of a boss Pulse. */
export interface BigFoeView {
  readonly active: boolean;
  readonly typeIndex: number;
  readonly hp: number; readonly maxHp: number;
  readonly shield: number;
  readonly phase: number;       // boss: 1, 2, 3. Warden: 1
  readonly enraged: boolean;    // boss enraged, or Warden hasted in overtime
}

export interface PulseView {
  readonly index: number;       // 0-based
  readonly count: number;       // total Pulses in this run profile
  readonly kind: 0 | 1 | 2;     // normal, warden, boss
  readonly threat: number;
  /** 0 and 0 for untimed boss Pulses. */
  readonly ticksLeft: number;
  readonly ticksTotal: number;
  readonly isBoss: boolean;
  /** Timer at 0 but a Warden is still alive (GDD 3.3). */
  readonly overtime: boolean;
  readonly wardenAlive: boolean;
  /** HP bar while the Warden holds the timer (CD review, UI K5). */
  readonly warden: BigFoeView;
  readonly boss: BigFoeView;
}

export const OfferKind = { Empty: 0, Weapon: 1, Memento: 2, Taken: 3 } as const;

export interface ShopOfferView {
  readonly kind: number;        // OfferKind
  readonly defIndex: number;    // WeaponIndex or MementoIndex
  readonly tier: number;        // weapon tier 1..4, or Memento rarity order + 1
  readonly price: number;
  readonly locked: boolean;
  readonly affordable: boolean;
  /** Inventory slot that would merge on purchase, -1 when none. */
  readonly mergeSlot: number;
  readonly mergeToTier: number;
  /** True when no free slot and no merge is possible. */
  readonly blockedNoSlot: boolean;
  /** True when this id is not owned yet, so buying raises each of its tag counts by 1 (GDD 8.1). */
  readonly isNewId: boolean;
}

export interface InventorySlotView {
  readonly weaponIndex: number; // -1 when empty
  readonly tier: number;
  readonly sellPrice: number;
  /** Another slot holds the same id and tier. */
  readonly canMerge: boolean;
}

export interface ShopView {
  /** Increments on every change. UI rebuilds DOM only when this changes. */
  readonly revision: number;
  readonly offers: readonly ShopOfferView[];
  readonly rerollPrice: number;
  readonly freeRerolls: number;
  readonly inventory: readonly InventorySlotView[];   // length = weapon slots
  readonly mementos: readonly { readonly mementoIndex: number; readonly count: number }[]; // acquisition order
  readonly tagCounts: ArrayLike<number>;              // indexed by TagIndex
}

export interface LevelUpView {
  readonly revision: number;
  readonly pending: number;       // levels still to pick, including the current one
  readonly total: number;         // levels gained this Pulse (for "1 of 2")
  readonly choices: readonly { readonly cardIndex: number; readonly rarity: number; readonly value: number }[];
}

export interface RewardView {
  readonly revision: number;
  readonly sourceTypeIndex: number;   // EnemyTypeIndex of the Warden or boss
  readonly choices: readonly { readonly mementoIndex: number; readonly rarity: number }[];
}

export interface RunStatsView {
  readonly kills: number;
  readonly glintEarned: number;
  readonly glintSpent: number;
  readonly pulsesCleared: number;
  readonly runTicks: number;
  readonly silt: number;              // computed at run end
  /** SourceRef of the killing hit, 0 while alive (UI "Felled by", K4). */
  readonly killedBy: number;
  readonly difficulty: number;
}

export interface WorldView {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly phaseRevision: number;
  readonly arenaIndex: number;
  readonly pulse: PulseView;
  readonly player: PlayerView;
  readonly enemies: EnemyPoolView;
  readonly enemyShots: ProjectilePoolView;
  readonly playerShots: ProjectilePoolView;
  readonly pickups: PickupPoolView;
  readonly dangerAreas: AreaPoolView;
  readonly playerZones: AreaPoolView;
  readonly spawnMarks: SpawnMarkPoolView;
  readonly shop: ShopView;
  readonly levelUp: LevelUpView;
  readonly reward: RewardView;
  readonly runStats: RunStatsView;
}
```

Isi `ShopView`, `LevelUpView`, `RewardView` dihitung sim hanya saat revision naik, jadi biaya per tick nol.

### 6.5 Event bus [Beku M1]

- Sim menulis event ke buffer SoA berkapasitas tetap per tick. Event adalah data, bukan callback.
- Setelah tiap `step()`, app menyalin event ke **FrameEvents** (bentuk sama plus kolom `tick`), lalu memberikannya ke render, audio, dan UI sekali per frame.
- Kapasitas: 256 per tick; FrameEvents 1024 (mode e2e 4096). Bila penuh, event prioritas rendah dibuang lebih dulu dan penghitung overflow naik (debug overlay, `getPerf`). Prioritas rendah: `EnemyDamaged`, `WeaponFired`, `ProcTriggered`, `GlintCollected`, `GlintDropped`, `EnemySpawned`. Event lain tidak pernah dibuang.
- Event turunan dibuat konsumen, bukan sim: `ShopOpened`/`ShopClosed` dari `PhaseChanged`; `PurchaseRejected` dari `CommandRejected` dengan `NotEnoughGlint`; `ProjectileHit`, `WardenDamaged`, `BossDamaged` dari `EnemyDamaged` (rank dan `HitKind` di `b`). Pemetaan ke cue ditulis AU di `src/audio/event-map.ts`, pemetaan ke VFX ditulis AD di `src/render/vfx/`.

```ts
// src/core/contracts/events.ts
export const SimEventType = {
  // run and phase
  PhaseChanged: 1, PulseStarted: 2, PulseEnded: 3, RunEnded: 4,
  // player
  PlayerDamaged: 10, PlayerHealed: 11, PlayerDied: 12, PlayerHpLowChanged: 13, DamageBlocked: 14,
  WeaponFired: 15, RiteCast: 16, RiteReady: 17, RiteRejected: 18,
  PlayerLeveledUp: 19, MementoAcquired: 20, SynergyActivated: 21, PlayerDodged: 22,
  BarrierGained: 23, BuffMaxed: 24,
  // enemies and danger
  EnemySpawned: 30, EnemyDamaged: 31, EnemyKilled: 32, EnemyProjectileFired: 33,
  TelegraphStarted: 34, TelegraphResolved: 35,
  WardenSpawned: 36, WardenKilled: 37, BossSpawned: 38, BossPhaseChanged: 39, BossSummoned: 40, BossKilled: 41,
  BossEnraged: 42, AffixApplied: 43, SpawnMarked: 44,
  // pickups
  GlintDropped: 50, GlintCollected: 51, MementoOfferSpawned: 52, GlintSwept: 53,
  // effects
  ProcTriggered: 55,
  // shop, level-up, reward
  LevelUpCardsShown: 60, LevelUpCardChosen: 61,
  ItemBought: 62, ItemSold: 63, ItemMerged: 64, ItemLocked: 65, ShopRerolled: 66,
  CommandRejected: 67, RewardShown: 68, RewardChosen: 69,
  // adaptive music (M1-09a)
  MusicPressureChanged: 70,
} as const;
export type SimEventType = (typeof SimEventType)[keyof typeof SimEventType];

export const RunOutcome = { Defeat: 0, Victory: 1, Abandon: 2 } as const;

/** Read side shared by sim events (one tick) and frame events (all ticks of a frame). */
export interface SimEventReader {
  readonly count: number;
  readonly type: ArrayLike<number>;   // SimEventType
  readonly x: ArrayLike<number>;      // world u (0 when not applicable)
  readonly y: ArrayLike<number>;
  readonly a: ArrayLike<number>;      // payload, meaning per type (table below)
  readonly b: ArrayLike<number>;
  readonly c: ArrayLike<number>;      // usually a SourceRef (encodeSource)
}
```

Arti payload (final; kolom kosong = 0). `x, y` selalu posisi dunia kejadian bila relevan.

| Event | a | b | c |
|---|---|---|---|
| `PhaseChanged` | `RunPhaseCode` baru | kode lama | |
| `PulseStarted` | index Pulse | jenis (0 normal, 1 warden, 2 boss) | |
| `PulseEnded` | index Pulse | 1 bila pemain tidak terluka di Pulse ini | |
| `RunEnded` | `RunOutcome` | Silt didapat | |
| `PlayerDamaged` | damage setelah armor | HP sesudah | SourceRef |
| `PlayerHealed` | jumlah | | SourceRef (efek, leech, kelas) |
| `PlayerDied` | | | SourceRef hit pembunuh |
| `PlayerHpLowChanged` | 1 masuk, 0 keluar (HP <= `LOW_HP_FRAC` x maks saat `pulse`; 0 saat keluar `pulse`) | | |
| `MusicPressureChanged` | 1 masuk, 0 keluar (Unlit normal hidup >= `music_pressure_frac` x `alive_cap`, lepas di bawah `music_pressure_release_frac`; 0 di luar `pulse` dan di Pulse boss) | | |
| `DamageBlocked` | sisa muatan Barrier | | SourceRef penyerang |
| `PlayerDodged` | | | SourceRef penyerang |
| `WeaponFired` | `WeaponIndex` | jumlah proyektil | slot inventaris |
| `RiteCast` | `RiteIndex` (x, y = titik bidik) | | |
| `RiteReady`, `RiteRejected` | `RiteIndex` | | |
| `PlayerLeveledUp` | level baru | | |
| `MementoAcquired` | `MementoIndex` | urutan rarity (0 Plain sampai 3 Fabled) | |
| `SynergyActivated` | `TagIndex` | ambang (2, 4, 6) | |
| `BarrierGained` | muatan sekarang | | |
| `BuffMaxed` | `EffectIndex` | tumpukan | |
| `EnemySpawned` | `EnemyTypeIndex` | rank | |
| `EnemyDamaged` | damage | bit 0 kritikal, bit 1 proc, bit 2-3 rank, bit 4-6 `HitKind` | SourceRef |
| `EnemyKilled` | `EnemyTypeIndex` | rank | SourceRef hit pembunuh |
| `EnemyProjectileFired` | `EnemyTypeIndex` | jumlah proyektil | SourceRef serangan |
| `TelegraphStarted` | `TelegraphKind` | durasi (tick) | SourceRef serangan (`EnemyAttack`, `BossPattern`, `Affix`) |
| `TelegraphResolved` | `TelegraphKind` | | SourceRef serangan |
| `SpawnMarked` | `EnemyTypeIndex` | durasi tanda (tick) | |
| `WardenSpawned`, `WardenKilled`, `BossSpawned`, `BossKilled` | `EnemyTypeIndex` | | |
| `BossPhaseChanged` | fase baru (1 sampai 3) | fase lama | |
| `BossEnraged` | `EnemyTypeIndex` | | |
| `BossSummoned` | `EnemyTypeIndex` yang dipanggil | jumlah | SourceRef pola |
| `AffixApplied` | `AffixIndex` | slot musuh | |
| `GlintDropped` | jumlah | | |
| `GlintCollected` | jumlah | panjang rentetan (reset 500 ms tanpa pungutan) | |
| `GlintSwept` | jumlah dipungut otomatis | jumlah padam | |
| `MementoOfferSpawned` | rarity tertinggi di peti | | |
| `ProcTriggered` | `EffectIndex` | jumlah instans (proyektil, target) | |
| `LevelUpCardsShown` | jumlah kartu | | |
| `LevelUpCardChosen` | `LevelUpCardIndex` | rarity | |
| `ItemBought` | `OfferKind` | defIndex | tier |
| `ItemSold` | `WeaponIndex` | tier | Glint didapat |
| `ItemMerged` | `WeaponIndex` | tier baru | |
| `ItemLocked` | slot tawaran | 1 terkunci, 0 dibuka | |
| `ShopRerolled` | biaya | | |
| `CommandRejected` | `RejectReason` | | |
| `RewardShown` | jumlah pilihan | | |
| `RewardChosen` | `MementoIndex` | | |

Aturan `ProcTriggered`: dipancarkan untuk setiap efek yang aksinya terlihat atau terdengar (`spawn_projectile`, `spawn_area`, `spawn_zone`, `repeat`, `trigger_weapons`, `gain_barrier`, `gain_glint`, `execute`, `heal`). Tidak dipancarkan untuk `stat_mod`, `hit_mod`, `apply_status`, `status_rule`, `shop_mod`, `convert` (terlalu sering atau tidak terlihat). Rush penuh (Edge 6) memakai `BuffMaxed`. Cue dan VFX dipetakan dari id efek (`GameData.effects[a].id`, misalnya `syn_flame_4`), bukan dari kode angka khusus.

### 6.6 Render

```ts
// src/core/contracts/render.ts
export interface RenderFrame {
  readonly view: WorldView;
  readonly alpha: number;            // interpolation factor in [0, 1)
  readonly events: SimEventReader;   // frame events
  /** Render clock in seconds from sim tick + alpha (not wall clock) so screenshots are stable. */
  readonly timeSec: number;
}

export interface Projector {
  /** Integer world scale: one virtual pixel = pixelScale physical pixels. */
  readonly pixelScale: number;
  /** World floor position (u) to CSS pixels relative to the canvas. Writes into out. */
  worldToCss(x: number, y: number, out: { x: number; y: number }): void;
  /** CSS pixels to world floor position (u), for mouse aim. Writes into out. */
  cssToWorld(cssX: number, cssY: number, out: { x: number; y: number }): void;
}

export interface RenderAssets {
  readonly sprites: readonly SpriteSheetDef[];
  readonly palette: PaletteDef;
  readonly tiles: readonly SpriteSheetDef[];
}

export interface Renderer {
  resize(physicalWidth: number, physicalHeight: number): void;
  /** Quality, reduce effects, damage numbers, screen shake, colour vision. */
  applySettings(s: Settings): void;
  setArena(arena: ArenaDef, biomeId: string): void;
  render(frame: RenderFrame): void;
  readonly projector: Projector;
  /** renderer.info snapshot for debug overlay and getPerf. */
  stats(): { readonly drawCalls: number; readonly triangles: number };
  dispose(): void;
}

export type CreateRenderer = (canvas: HTMLCanvasElement, assets: RenderAssets, data: GameData) => Renderer;  // M1-01: + data (19)
```

### 6.7 UI

```ts
// src/core/contracts/ui.ts
export type AppScreen = 'title' | 'classSelect' | 'run' | 'paused' | 'settings' | 'runEnd' | 'archive' | 'credits';

/** Test and DOM ids per ui-spec 3 (data-screen attribute). */
export type ScreenId =
  | 'title' | 'class-select' | 'pulse' | 'level-up' | 'warden-reward' | 'glazier'
  | 'pause' | 'confirm' | 'settings' | 'run-end' | 'archive' | 'credits';

export interface AppActions {
  startRun(classId: string, difficulty: number): void;   // app picks seed and profile
  continueRun(): void;
  pause(): void;
  resume(): void;
  openSettings(): void;
  openArchive(): void;
  applySettings(s: Settings): void;                       // also handles fullscreen (user gesture)
  unlock(unlockId: string): boolean;                      // meta, Tingkat B
  deleteSaveData(): void;
  quitToTitle(): void;
}

export interface UiSound { play(cueId: string): void }   // K11, forwarded by app to AudioSystem.playUi

export interface MetaView {
  readonly silt: number;
  readonly unlocked: readonly string[];        // meta_unlocks ids and class ids
  readonly mementosFound: readonly string[];
  readonly highestDifficultyWon: number;       // -1 when none
  readonly lastClassId: string;
  readonly hasRunSave: boolean;
}

export interface UiDeps {
  readonly root: HTMLElement;
  readonly strings: StringTable;
  readonly data: GameData;
  readonly commands: CommandSink;
  readonly app: AppActions;
  readonly projector: Projector;
  readonly sound: UiSound;
  readonly settings: () => Settings;
  readonly meta: () => MetaView;
  /** Pixel art for icons and portraits, rasterized by src/core/sprite. */
  readonly art: RenderAssets;
}

export interface Ui {
  setScreen(screen: AppScreen): void;
  /** Called every frame. reward, levelUp, shop screens derive from view.phase. */
  update(view: WorldView, events: SimEventReader): void;
  readonly activeScreenId: ScreenId;
  dispose(): void;
}

export declare function createUi(deps: UiDeps): Ui;
```

### 6.8 Audio

```ts
// src/core/contracts/audio.ts
/** Integer 0..100 per bus. AU applies gain = (v / 100) ^ 2. */
export interface VolumeSettings { readonly master: number; readonly music: number; readonly sfx: number; readonly ui: number }

export interface AudioSystem {
  /** Must be called from a user gesture (autoplay policy). */
  unlock(): Promise<void>;
  /** Called every frame. Maps events to cues and drives adaptive music from view. */
  update(view: WorldView, events: SimEventReader, dtSec: number): void;
  playUi(cueId: string): void;
  applySettings(s: Settings['audio']): void;
  /** Arena bounds for worldX panning (audio-direction 8.6). */
  setArena(arena: ArenaDef): void;
  setPaused(paused: boolean): void;
  /** Tab hidden or window unfocused; AU suspends when muteWhenUnfocused. */
  setHidden(hidden: boolean): void;
  dispose(): void;
}

export type CreateAudio = (data: GameData) => AudioSystem;  // M1-01: + data (19)
```

### 6.9 Data (GameData)

```ts
// src/content (types inferred from the schema DSL; shape fixed here)
export interface GameData {
  readonly meta: { readonly schemaVersion: number; readonly contentHash: string; readonly contentTier: 'A' | 'B' | 'C' };
  readonly config: ConfigValues;               // typed key-value from config.csv
  readonly shop: ShopConfig;                   // typed key-value from shop.csv
  readonly stats: readonly StatDef[];
  readonly tags: readonly TagDef[];            // from synergies.csv distinct tags, order flame, shard, edge, echo, ward, trade
  readonly classes: readonly ClassDef[];
  readonly rites: readonly RiteDef[];
  readonly weapons: readonly WeaponDef[];      // tier params merged from weapon_tiers.csv as tiers[0..3]
  readonly rarities: readonly RarityDef[];
  readonly rarityWeights: readonly RarityWeightRow[];
  readonly mementos: readonly MementoDef[];
  readonly effects: readonly EffectDef[];
  readonly effectsByOwner: Readonly<Record<string, readonly EffectIndex[]>>;
  readonly synergies: readonly SynergyDef[];
  readonly levelUpCards: readonly LevelUpCardDef[];
  readonly statuses: readonly StatusDef[];
  readonly enemies: readonly EnemyDef[];
  readonly affixes: readonly AffixDef[];
  readonly bossPhases: readonly BossPhaseDef[];
  readonly bossPatterns: readonly BossPatternDef[];
  readonly biomes: readonly BiomeDef[];
  readonly profiles: Readonly<Record<string, readonly PulseSlotDef[]>>; // waves.csv joined with wave_spawns.csv
  readonly difficulty: readonly DifficultyDef[];
  readonly metaUnlocks: readonly MetaUnlockDef[];
  readonly arenas: readonly ArenaDef[];
  /** String id to dense index, built at load. Throws on unknown id (load boundary only). */
  readonly index: {
    enemy(id: string): EnemyTypeIndex; weapon(id: string): WeaponIndex; memento(id: string): MementoIndex;
    cls(id: string): ClassIndex; rite(id: string): RiteIndex; stat(id: string): StatIndex; tag(id: string): TagIndex;
    effect(id: string): EffectIndex; affix(id: string): AffixIndex; arena(id: string): number; biome(id: string): number;
  };
}

export interface PulseSlotDef {
  readonly pulse: number; readonly kind: 'normal' | 'warden' | 'boss'; readonly biome: string; readonly threat: number;
  readonly durationTicks: number;            // 0 for boss
  readonly wardenId: string | null; readonly bossId: string | null;
  readonly aliveCap: number; readonly isFinal: boolean;
  readonly spawns: readonly { readonly enemyId: string; readonly count: number; readonly startFrac: number; readonly endFrac: number;
                              readonly groupMin: number; readonly groupMax: number; readonly sectors: readonly string[] }[];
}
```

Aturan murni turunan data yang dipakai sim dan UI sekaligus ada di `src/content/rules/` (LP menulis, GD mereview): `synergyTierFor(count, thresholds)` (K3), `priceFor(baseKind, rarity, threat, mults)`, `rerollPriceFor(t, n, delta)`. UI memakainya hanya untuk pratinjau; nilai yang berlaku tetap dari `WorldView`.

### 6.10 Arena (ArenaDef)

```ts
// content/levels/<id>.json, owned by LD. All distances in world u. Floor positions are [x, y] where y is
// the floor depth axis (arena-design calls it z; +y points toward the camera, down the screen).
export type Vec2 = readonly [number, number];
export type Shape =
  | { readonly type: 'rect'; readonly min: Vec2; readonly max: Vec2 }
  | { readonly type: 'circle'; readonly center: Vec2; readonly radius: number }
  | { readonly type: 'polygon'; readonly points: readonly Vec2[] };   // convex, consistent winding

export interface ArenaDef {
  readonly schemaVersion: 1;
  readonly id: string;                       // snake_case, equals file name, referenced by biomes.csv arena_id
  readonly arena: {
    readonly boundary: readonly Vec2[];      // convex polygon, clockwise on screen
    readonly lip: number;
    readonly rim: { readonly height: number; readonly colorToken: string; readonly opacity: number };
    readonly projectileMargin: number;
    readonly floor: { readonly baseToken: string; readonly altToken: string; readonly tileId: string };
  };
  readonly playerStart: { readonly default: Vec2; readonly boss: Vec2 };
  readonly pulseOrigin: Vec2;
  readonly safeZones: readonly { readonly id: string; readonly shape: Shape; readonly blocks: readonly ('obstacle' | 'spawn' | 'decor')[] }[];
  readonly spawn: {
    readonly playerSafeRadius: number;
    readonly interiorMinPlayerDist: number;
    readonly zones: readonly { readonly id: string; readonly shape: Shape }[];   // 8 sectors n, s, e, w, ne, se, sw, nw
  };
  readonly bossStage: { readonly shape: Shape; readonly landmarkId: string; readonly floorRingContrastMax: number };
  readonly lighting: {
    readonly edgeFade: { readonly startOutside: number; readonly endOutside: number };   // colour = palette biome fog
    /** Max 8, in priority order: Low quality uses the first 4. Colour and base intensity from palette biome point preset. */
    readonly points: readonly { readonly id: string; readonly pos: readonly [number, number, number]; readonly intensityMul?: number; readonly flicker?: number }[];
  };
  readonly obstacles: readonly { readonly id: string; readonly kind: string; readonly shape: Shape; readonly height: number; readonly blocks: readonly ('move' | 'projectile')[] }[];
  readonly decor: readonly {
    readonly id: string; readonly kind: string; readonly zone: 'back' | 'side' | 'front'; readonly pos: Vec2;
    readonly rotYDeg: number; readonly height: number; readonly footprintHalf: Vec2; readonly anim?: string; readonly lightId?: string;
  }[];
  readonly ambient: { readonly particles: readonly { readonly kind: string; readonly area: 'arena' | 'decor'; readonly max: number; readonly colorToken: string; readonly opacity: number; readonly sizePx: number }[] };
}
```

- Sim membaca: `arena.boundary`, `projectileMargin`, `playerStart`, `pulseOrigin`, `safeZones`, `spawn`, `bossStage.shape`, `obstacles`. Render membaca sisanya.
- Cahaya kunci, cahaya isi, kabut, grading, dan preset titik cahaya diambil dari `art/palette.json` entri bioma (`contentId` = id bioma GD). Satu sumber, milik AD. Posisi titik cahaya milik LD.

### 6.11 Save, meta, dan pengaturan

```ts
// src/core/contracts/save.ts
export type RngStreamName = 'spawn' | 'ai' | 'combat' | 'loot' | 'shop' | 'levelUp';

export interface RunSaveV1 {
  readonly v: 1;
  readonly contentHash: string;
  readonly seed: number;
  readonly classId: string;
  readonly profile: string;
  readonly difficulty: number;
  readonly phase: 'reward' | 'levelUp' | 'shop';
  readonly pulseIndex: number;           // index of the Pulse just cleared
  readonly tick: number;
  readonly rng: Readonly<Record<RngStreamName, readonly [number, number, number, number]>>;
  readonly player: { readonly hp: number; readonly level: number; readonly xp: number; readonly glint: number };
  /** String ids, not indices, so a save survives data reordering. Slot order preserved. */
  readonly weapons: readonly ({ readonly id: string; readonly tier: number } | null)[];
  readonly mementos: readonly { readonly id: string; readonly count: number }[];   // acquisition order (effect order)
  readonly levelUpPicks: readonly { readonly cardId: string; readonly rarity: number }[];
  readonly pendingLevelUps: number;
  readonly levelUpChoices: readonly { readonly cardId: string; readonly rarity: number }[];
  readonly rewardChoices: readonly string[];
  readonly shop: {
    readonly offers: readonly { readonly kind: 'empty' | 'weapon' | 'memento' | 'taken'; readonly id: string; readonly tier: number; readonly locked: boolean }[];
    readonly rerollCount: number;
    readonly freeRerollsUsed: number;
  };
  /** Per-run effect state that survives between Pulses (counters with run scope). Empty in Tingkat A. */
  readonly effectState: Readonly<Record<string, number>>;
  readonly runStats: { readonly kills: number; readonly glintEarned: number; readonly glintSpent: number; readonly pulsesCleared: number; readonly runTicks: number };
}
export type RunSave = RunSaveV1;

export interface MetaSaveV1 {
  readonly v: 1;
  readonly silt: number;
  readonly unlocked: readonly string[];
  readonly mementosFound: readonly string[];
  readonly highestDifficultyWon: number;
  readonly lastClassId: string;
  readonly runs: number;
}

export type ActionId =
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'rite' | 'pause'
  | 'confirm' | 'back' | 'reroll' | 'lock' | 'beginPulse' | 'stats' | 'merge' | 'sell';

export interface Settings {
  readonly v: 1;
  readonly graphics: { readonly quality: 'low' | 'medium' | 'high'; readonly screenShake: number; readonly fullscreen: boolean };
  readonly audio: VolumeSettings & { readonly mono: boolean; readonly reduceRepeats: boolean; readonly muteWhenUnfocused: boolean };
  readonly access: {
    readonly textScale: 0 | 1 | 2;              // Normal, Large, Largest
    readonly reduceEffects: boolean;
    readonly damageNumbers: boolean;
    readonly colorVision: 'off' | 'protan' | 'deutan' | 'tritan';
    readonly pauseWhenUnfocused: boolean;
    readonly showFlavor: boolean;
    readonly solidPanels: boolean;
    readonly shopTimer: 'on' | 'off' | 'extended';   // unused while the shop is untimed (GDD 12)
  };
  /** KeyboardEvent.code values, two bindings per action, null = empty. */
  readonly keybinds: Readonly<Record<ActionId, readonly [string | null, string | null]>>;
}
```

Default `Settings` (ditulis LP di `src/app/settings.ts`): kualitas `medium`, getar 100, layar penuh mati; volume master 80, music 70, sfx 100, ui 80 (nilai AU); mono mati, kurangi suara berulang mati, mute saat tidak fokus hidup; ukuran teks Normal, kurangi efek = `prefers-reduced-motion`, angka damage hidup, mode warna mati, jeda saat tidak fokus hidup, flavor hidup, panel solid mati, `shopTimer` `on`; keybind sesuai ui-spec 8.1.

### 6.12 Hook tes e2e (hanya mode e2e) [Beku M1]

```ts
// src/app/e2e/hooks.ts, loaded via dynamic import only when __E2E__ is true
export interface E2eSnapshot {
  readonly screen: ScreenId; readonly phase: RunPhase; readonly tick: number;
  readonly pulseIndex: number; readonly hp: number; readonly maxHp: number; readonly glint: number; readonly level: number;
  readonly player: { readonly x: number; readonly y: number };
  readonly counts: { readonly enemies: number; readonly enemyShots: number; readonly playerShots: number; readonly pickups: number; readonly dangerAreas: number; readonly playerZones: number };
}

export interface E2eHooks {
  readonly version: 1;
  ready(): Promise<void>;
  startRun(opts: { readonly seed: number; readonly classId: string; readonly profile?: string; readonly difficulty?: number }): void;
  /** Stop the rAF loop; from now on the test drives time. */
  pauseLoop(): void;
  resumeLoop(): void;
  step(ticks: number, input?: Partial<InputFrame>): void;
  /** 0.25 to 16. Above 4 ticks per frame only in e2e (MAX_TICKS_PER_FRAME_E2E). */
  setTimeScale(scale: number): void;
  send(cmd: Command): void;
  /** 8 lowercase hex chars of Sim.hash(). */
  getStateHash(): string;
  getSnapshot(): E2eSnapshot;
  /** CSS pixel positions relative to the canvas, from Projector. */
  getScreenPositions(): {
    readonly player: { readonly x: number; readonly y: number };
    readonly enemies: readonly { readonly x: number; readonly y: number; readonly rank: number }[];
    readonly enemyShots: readonly { readonly x: number; readonly y: number }[];
    readonly dangerAreas: readonly { readonly x: number; readonly y: number }[];
  };
  /** Builds the needed state (debug commands, AppActions), then resolves when the screen is shown. */
  goToScreen(id: ScreenId | 'run-lost' | 'run-won'): Promise<void>;
  /** Deterministic stress scene built from debug commands. 'peak': last normal Pulse composition + late-run build. */
  spawnStress(preset: 'peak' | 'peak-boss'): void;
  grantItem(id: string, tier?: number): void;
  loadReplay(replay: unknown): void;
  exportReplay(): unknown;
  getPerf(): {
    readonly frameMs: { readonly avg: number; readonly p95: number; readonly p99: number; readonly max: number };  // rolling 600 frames
    readonly simTickMs: { readonly avg: number; readonly p95: number };
    readonly drawCalls: number; readonly triangles: number;
    readonly eventOverflow: number; readonly poolOverflow: number;
  };
}
declare global { interface Window { __shardfall?: E2eHooks } }
```

- Nama objek global final: `window.__shardfall` (bukan `__SHARDFALL_TEST__`). Flag build final: konstanta `__E2E__`, `true` hanya pada `vite build --mode e2e` (bukan variabel `VITE_TEST_HOOKS`).
- Hook hanya memakai API biasa (`Sim`, `AppActions`, `Projector`, `DebugCommand`). Tidak ada `if (isTest)` di modul lain.
- `goToScreen` membuat state lewat command biasa dan debug, sehingga screenshot selalu menunjukkan state yang sah.

---

## 7. Render HD-2D

### 7.1 Satuan dunia dan kamera [Wajib] [Beku M1]
- **1 u = 16 px** (piksel sprite = piksel virtual) pada sumbu x layar. 1 tile = 1 u. Pemain sekitar 1,25 u (20 px).
- Kamera **ortografis**, yaw 0, tidak berputar, tidak mengikuti pemain. **Pitch = asin(0,625) = 38,682 derajat** dari horizontal.
- Konsekuensi proyeksi (bingkai referensi 640 x 360, target kamera `[x 0, h 0, y -2]`):
  ```
  screenX = originX + 320 + 16 * x
  screenY = originY + 200 + 10 * y - 12.49 * h        (h = height above floor, vertical meshes only)
  originX = floor((virtualW - 640) / 2), originY = floor((virtualH - 360) / 2)
  ```
  1 u kedalaman lantai = **tepat 10 px**. Sprite aktor adalah billboard sehingga tingginya tampil 1:1.
- **Alasan memilih 38,68 derajat, bukan asin(2/3):** dengan 1 u = 16 px, asin(2/3) memberi 10,667 px per u kedalaman (pecahan), sehingga tepi tile dan texel lantai jatuh di posisi setengah piksel dan bergetar saat diinterpolasi. 38,68 derajat memberi bilangan bulat, tile lantai 16 x 10 px per u, dan tetap "sekitar 40 derajat" sesuai style guide 1.4. Kerugian kecil: gerak vertikal tampil 62,5% dari horizontal (risiko 17, dievaluasi CD dan GD di M1).
- Sumbu: sim `(x, y)` di lantai, `y` positif ke arah kamera (bawah layar). Sama dengan `[x, z]` di arena-design. three.js: sim `(x, y)` menjadi `(x, 0, y)`, tinggi `h` menjadi three `y`.
- **Kompensasi gerak vertikal pemain (CD K7, final secara teknis):** tanpa kompensasi, gerak ke atas atau bawah tampil 62,5% dari ke samping. Hanya gerak yang dikendalikan input pemain (jalan dan dash Rite) dikompensasi; area, jangkauan, proyektil, telegraf, dan Unlit tetap jujur di lantai dunia. Rumus di sim (GP), dengan `r = player_vertical_screen_ratio` dari `config.csv` (GD, awal 0,8, kalibrasi 0,75 sampai 0,85):
  ```
  d = normalize(moveX, moveY)                       // input direction = desired SCREEN direction
  k = 1 / sqrt(d.x^2 + (d.y / r)^2)                 // ellipse radius: screen speed r * S vertically, S sideways
  vx = d.x * k * speed                              // world u per tick
  vy = d.y * k * speed * (PX_PER_U / DEPTH_PX_PER_U) // = 1.6: converts screen-proportional speed back to floor u
  ```
  Hasilnya: arah di layar sama dengan arah input (W+D tampil 45 derajat), kecepatan layar vertikal = `r` kali horizontal. Dash Rite (`glass_step`) memakai faktor yang sama untuk jaraknya. Hanya `Math.sqrt`, jadi deterministik. Nilai `r` = 0,625 setara gerak isotropik di lantai.
- `src/core/projection.ts` berisi rumus di atas sebagai fungsi murni (dipakai render, validator arena, tool art, dan hook e2e).

### 7.2 Sprite billboard dan skala integer [Wajib]
- Sprite aktor adalah quad tegak di titik kaki, tegak lurus arah pandang kamera. Setiap piksel sprite tampil tepat 1 piksel virtual. Tanpa rotasi bebas atau skala non-integer; flip horizontal boleh.
- Kedalaman seluruh quad = kedalaman titik kaki, jadi urutan depan-belakang otomatis benar.
- Snap piksel di vertex shader: kaki diproyeksikan, dibulatkan ke piksel virtual, sudut quad ditambahkan dalam piksel bulat.
- **Tekstur lantai: 1 texel = 1/16 u di x dan 1/10 u di kedalaman** (texel tampil persegi 1 x 1 px). Tile 16 x 16 texel menutupi 1 x 1,6 u; tile 16 x 10 texel menutupi tepat 1 x 1 u. Pilihan bentuk tile milik AD.
- Permukaan vertikal tampil 12,49 px per u (tidak bulat): hanya untuk dekorasi di luar batas. Dekorasi yang harus tajam persis memakai billboard sprite `env`.

### 7.3 Viewport, skala, dan pita DoF [Wajib] [Beku M1]
- **Skala dunia** `pixelScale = max(1, floor(min(Wp / 608, Hp / 296)))`, dengan `Wp x Hp` piksel fisik (CSS x `devicePixelRatio`). 608 x 296 = kotak wajib terlihat LD (x 16 sampai 624, y 32 sampai 328 bingkai referensi).
- Resolusi virtual = `floor(Wp / pixelScale) x floor(Hp / pixelScale)`. Bingkai referensi dipusatkan dengan `originX`, `originY` bulat (7.1). Ruang lebih diisi dekorasi tepi dan kabut `night`.

| Viewport (fisik) | Skala | Virtual | Catatan |
|---|---|---|---|
| 1920 x 1080 | 3 | 640 x 360 | Referensi |
| 1920 x 950 (toolbar browser) | 3 | 640 x 316 | Pita atas dan bawah terpotong 22 px, kotak wajib utuh |
| 1280 x 720 | 2 | 640 x 360 | |
| 1366 x 768 | 2 | 683 x 384 | |
| 2560 x 1440 | 4 | 640 x 360 | |
| 2560 x 1080 | 3 | 853 x 360 | Dekorasi samping sampai x plus minus 28 u |

- **Arena final: 32 x 20 u** (x -16 sampai 16, y -10 sampai 10), sudut dipotong 3 u, tampil 512 x 200 px di x 64 sampai 576 dan y 100 sampai 300. Ini batas teknis tetap untuk M1 sampai rilis; arena lebih besar butuh persetujuan LP, CD, dan LD.
- **Pita DoF didefinisikan dalam piksel bingkai referensi**, bukan persen layar: blur nol untuk `54 <= y <= 324`, naik halus ke atas dan ke bawah dari sana. Kolom samping (x di bawah 64 dan di atas 576) di dalam rentang y itu tetap tajam.
- **Skala UI terpisah** dari skala dunia: UI memakai `uiScale` ui-spec 7.1 (kanvas 640 x 360), dihitung dari **piksel fisik** lalu `--u = uiScale / devicePixelRatio` px CSS, agar satuan UI tetap bulat di layar ber-DPR 1,25 atau 1,5. Pada 1920 x 950, dunia berskala 3 dan UI berskala 2; ini disengaja.

### 7.4 Lapisan gambar (P2-f) [Wajib]

| Lapis | Isi | Depth | Catatan |
|---|---|---|---|
| L0 | Lantai, bibir, rim, rintangan, dekorasi low-poly | tulis dan uji | Opaque. Rintangan selalu di bawah aktor (LD R8) |
| L1 | Decal lantai: bayangan elips aktor, cincin pemain | uji, tanpa tulis | |
| L2 | Aktor: pemain, Unlit, Warden, boss, Glint | tulis dan uji | Urut alami oleh depth kaki |
| L3 | Efek pemain: proyektil pemain, zona pemain, aura, percikan, angka damage | tanpa depth | Aditif atau alpha, dibatasi |
| L4 | Bahaya: telegraf, tanda spawn, proyektil musuh; lalu siluet tembus pemain bila tertutup aktor besar | tanpa depth | **Digambar sesudah post-processing** |

Siluet tembus pemain (LD 9): pemain digambar ulang di akhir L4 dengan uji depth `GREATER` terhadap depth scene (hanya bagian yang tertutup), sebagai outline `kept-cyan` 50%. M2.

### 7.5 Pipeline post-processing (ditulis sendiri)
1. **Scene pass**: L0 sampai L3 ke `sceneRT` (HalfFloat, resolusi virtual). Piksel emisif ditulis di atas 1,0.
2. **Bloom**: ambang di atas 1,0, downsample ke `bloomRT` 1/2 (dan 1/4 di Tinggi), blur Gaussian terpisah.
3. **Tilt-shift** (2 pass, horizontal lalu vertikal) dari `sceneRT` ke `blurRT` (resolusi virtual), radius dari `y` bingkai referensi (7.3).
4. **Danger pass**: L4 (dan siluet pemain) ke `dangerRT` (RGBA8 transparan, resolusi virtual), terpisah dari scene.
5. **Pass akhir di resolusi fisik canvas**, per piksel layar:
   - area tajam (`54 <= y_ref <= 324`): `texelFetch(sceneRT)` nearest, persis;
   - pita DoF: campuran `sceneRT` nearest dan `blurRT` **bilinear** menurut bobot pita;
   - tambah `bloomRT` **bilinear**, lalu vignette, grading bioma, kilau kaca tepi;
   - terakhir `dangerRT` nearest dengan alpha di atas semuanya.

Keputusan sampling [Wajib, permintaan AD art-direction 8 dan dukungan CD diterima]: bloom dan blur dihitung di resolusi virtual tetapi disampel **bilinear di pass akhir**, sehingga halo dan pita blur halus di 1080p (bukan blok 3 x 3), sementara sprite, tile, area tajam, dan lapisan bahaya tetap nearest. Karena area tajam dibaca dengan `texelFetch`, LD-T03 (nol piksel berbeda dengan DoF hidup dan mati) bisa lolos. Bahaya digambar sesudah bloom, jadi bloom tidak pernah menutupi L4 (P2-f). Biaya: satu pass layar penuh dengan 4 sampai 5 fetch per piksel, di bawah 1 ms di P-REF [Asumsi, diukur M2]. Atlas sprite dan tile tanpa mipmap.

### 7.6 Sprite, atlas, dan cahaya
- Satu atlas (shelf packer `src/core/sprite/atlas-pack.ts`, urutan dan perilaku sama dengan `tools/art/lib/atlas.mjs` AD), satu `InstancedMesh` per lapis. Atribut instance: posisi kaki, rect UV, offset, flip, flash, terang minimum. Target draw call 60 atau kurang.
- Resolusi id sprite dari id data: `src/render/sprites/sprite-ids.ts` (aturan AD art-pipeline 2: `swarmer` ke `unlit-swarmer`, `warden_hound` ke `warden-hound`, kelas `lantern` ke `kept-lantern`). Tes data memeriksa setiap musuh dan kelas di `GameData` punya sprite atau placeholder yang dinyatakan.
- Cahaya sprite di vertex shader per instance: ambient, kunci, isi, titik cahaya (maks 8). Kept dijepit minimal 70% terang (style guide 1.6).
- Lingkungan `MeshLambertMaterial` atau shader AD dengan jumlah titik cahaya tetap per kualitas. Anggaran lingkungan AD: 20 ribu segitiga dan 15 draw call per bioma. Dekorasi maks 80 objek, 12 beranimasi (LD 7.4, disetujui).
- M2: atlas berindeks palet R8 + LUT 256 x 1 (disetujui AD, art-pipeline 5.3). M1 RGBA.

### 7.7 Pengaturan kualitas grafis

| Fitur | Rendah | Sedang (default) | Tinggi |
|---|---|---|---|
| Tilt-shift DoF | mati | hidup | hidup |
| Bloom | mati | 1 level (1/2) | 2 level (1/2 dan 1/4) |
| Kilau kaca tepi | mati | hidup | hidup |
| Vignette dan grading | hidup | hidup | hidup |
| Titik cahaya dinamis | 4 (4 pertama di JSON arena) | 8 | 8 |
| Shadow map dekorasi (statis, dirender sekali per arena) | mati | 1024, 1 tap | 2048, PCF 4 tap |
| Batas partikel suasana dan VFX | 300 | 600 | 1000 |

- Default **Sedang** (target P-REF). Rendah tidak mengubah kode warna, lapisan, atau keterbacaan (P3-f).
- "Kurangi efek" terpisah dari kualitas: mematikan DoF, bloom, kilau kaca, dan getar layar, melunakkan kilat Pulse (40%), partikel suasana 30%. `screenShake` 0 sampai 100 mengalikan amplitudo getar.
- M2-02: shadow map dekorasi hidup di Sedang karena statis (dirender sekali per `setArena` atau ganti kualitas), jadi biayanya hanya satu sampel per piksel lingkungan. Logika di `src/render/pipeline/quality.ts` (dites).

### 7.8 Implementasi M2-02 (pipeline HD-2D)

Modul (pemilik LP kecuali disebut):

| Modul | Isi |
|---|---|
| `src/render/pipeline/renderer.ts` | Urutan frame: cahaya dan lingkungan, shadow map statis bila kotor, scene L0 sampai L3 ke `sceneRT` (HalfFloat plus `DepthTexture`), L4 ke `dangerRT`, mask pemain, post, komposit |
| `src/render/pipeline/scene-lighting.ts`, `lights.ts` | Uniform cahaya bersama: kunci, isi, ambient (warna dinormalkan ke luminans 1, hanya 20% hue ke permukaan), titik lentera dari data arena (posisi `[x, h, y]`, `intensityMul`, `flicker`) dengan warna dan jangkauan dari palet, `uCenterLevel` untuk menormalkan cahaya sprite |
| `src/render/shaders/lighting.ts` | Chunk GLSL `SCENE_LIGHTING_GLSL`: `sfLight(p, n)`, `sfShadow(p)`, `sfSpriteLight(feet, minLevel)` |
| `src/render/env/*` | Diorama dari `ArenaDef` saat runtime: lantai satu quad (tile AD, texel 1/16 x 1/10 u, varian, cermin, nada per batu), bibir, tanah luar, kabut tepi, rim kaca, dekorasi per `kind` LD (primitif low-poly digabung jadi satu draw call), rintangan (tanpa tulis depth, LD R8), latar langit dan kubah kaca pecah, partikel suasana dari `ambient.particles`, tekstur pixel prosedural dari token bioma |
| `src/render/post/*`, `src/render/shaders/post-*.ts` | Bloom (1/2, dan 1/4 di Tinggi), tilt-shift 2 pass (radius dari baris referensi, `band.ts` dites), komposit fisik |
| `src/render/pipeline/danger-rules.ts` | K3: isian bertumpuk dibatasi 35% di komposit (piksel `dangerRT` premultiplied dengan alpha di bawah 1 dianggap isian), deteksi bahaya menutupi pemain |
| `src/render/pipeline/shake.ts`, `pulse-light.ts`, `damage-cap.ts` | Getar layar (trauma, offset piksel virtual bulat), cahaya buka dan tutup Pulse, batas angka damage (dipakai `vfx/damage-numbers.ts` AD) |

Antarmuka cahaya sprite (dipakai AD): `createEntityLayers(..., { lighting: { glsl: SCENE_LIGHTING_GLSL, uniforms: lighting.uniforms } })`; shader sprite memanggil `sfSpriteLight(iPos, 0.7)` untuk Kept dan `0.0` untuk Unlit, per instance di vertex shader (warna konstan per quad, piksel tetap tajam). Texel emisif sprite dikali `entities.emissiveGain` (renderer: 1,6 saat bloom hidup, 1 saat mati) agar melewati ambang bloom 1,0.

Siluet tembus pemain: pemain digambar ulang sendiri ke `maskRT` (r = cakupan, g = tertutup scene yang lebih dekat, dari `DepthTexture`). Komposit menggambar outline `kept-white` 1 px plus cincin kaki `kept-cyan` di atas L4 bila `playerCoveredByDanger`, dan outline `kept-cyan` 50% di sekitar bagian yang tertutup aktor besar. Butuh hook `EntityLayers.playerSprite` dari AD (opsional; tanpa hook hanya cincin kaki).

Render perangkat lunak (SwiftShader di e2e headless dan CI, llvmpipe): dideteksi dari `WEBGL_debug_renderer_info`, kualitas dibatasi Rendah dan kanvas dirender di resolusi virtual lalu diperbesar CSS `image-rendering: pixelated` (title 87 ms menjadi 31 ms per frame di SwiftShader). Render yang dipanggil beruntun dalam kurang dari 4 ms (loop `step` e2e) digabung menjadi satu render di animation frame berikutnya agar antrean GPU tidak menumpuk. Build memakai plugin `tools/build/glsl-minify.ts` (komentar dan indentasi template `/* glsl */` dibuang) demi anggaran bundle.

Ekstensi tes: objek renderer punya `debug.overrideQuality(partial | null)` (bukan bagian kontrak `Renderer` beku) untuk uji S-6 / LD-T03 (DoF mati, bloom tetap). Bukti: `tests/render/hd2d/capture.ts` plus `measure.py --dof` memberi 0 piksel berbeda di x 64 sampai 576, y 54 sampai 324.

---

## 8. Pooling entitas dan tabrakan

### 8.1 Pool SoA berkapasitas tetap [Wajib] [Beku M1]
- Kolom typed array (`Float64Array` posisi dan kecepatan, `Int32Array` penghitung, `Uint8Array` flag), dialokasikan sekali di `createSim`. Slot stabil, free list LIFO.
- **Reset kanonik**: saat masuk `pulseClear`, semua pool entitas dikosongkan dan di-reset (highWater 0, free list ke urutan awal). Dengan begitu state setelah load identik dengan state run tanpa jeda (QA D-4). `serial` tidak di-reset dan tidak di-hash.
- Kapasitas (konstanta teknis `src/sim/capacity.ts`):

| Pool | Puncak normal | Batas lunak | Kapasitas |
|---|---|---|---|
| Musuh | 120 (`alive_cap` data, maks 120) | | 256 |
| Proyektil musuh | 150 | | 512 |
| Proyektil pemain (senjata + proc) | 300 | **proc hidup maks 200** (GD 6.2 diterima) | 512 |
| Pickup | 150 butir di lantai (`glint_floor_cap` data) + yang terbang | | 256 |
| Area bahaya (telegraf) | 30 | | 64 |
| Zona pemain | 24 | **maks 24 hidup** (GD 6.2 diterima) | 32 |
| Tanda spawn | 40 | | 64 |
| Aksi tertunda (`repeat`, gema, `delay`) | 40 | | 128 |
| Penghitung `every_nth` per target | | maks 4 efek ber-scope `per_target` per run | 4 x 256 |

- Spawn di atas batas lunak dilewati (deterministik); penghitung overflow naik dan harus nol di data normal (QA memantau lewat `getPerf().poolOverflow`).
- Glint di atas `glint_floor_cap`: butir tertua (urut tick jatuh lalu slot) digabung **dengan nilai total terjaga**; aturan tepatnya milik GD (GDD 4.2). Tidak ada Glint yang hilang karena pool.
- Tidak ada objek, closure, atau `new` per entitas di dalam tick.

### 8.2 Kolom musuh (sketsa, GP menyesuaikan di luar view)
`alive, serial, typeIndex, rank, x, y, prevX, prevY, vx, vy, radius, hp, maxHp, shield, guard, aiState, aiStateTicks, aiTimer, targetX, targetY, facing, hitFlashTicks, knockbackX, knockbackY, statusMask, burnDps[5], burnTicks[5], slowPct, slowTicks, markTicks, ageTicks, affixMask`.
Data per jenis dibaca dari `GameData.enemies[typeIndex]`; hanya nilai per individu yang disimpan di slot.

### 8.3 Spatial hash
- Grid seragam di atas batas arena diperlebar `projectileMargin`, **sel 2 u** [Asumsi, kalibrasi M1]. Untuk arena 32 x 20 u plus margin 3 u: 19 x 13 sel.
- Dibangun ulang tiap tick dengan counting sort; urutan item dalam sel = slot naik.
- Query menulis ke array scratch dan mengembalikan jumlah; tanpa callback di hot loop. Pemisahan antar musuh maks 8 tetangga. Pierce memakai daftar serial musuh yang sudah kena (maks 8).
- Batas arena adalah poligon cembung; penjepitan pemain, musuh, knockback, dan Glint ke dalam poligon (Glint 0,5 u di dalam, LD 4.2).

### 8.4 Hash state [Beku M1]
`src/sim/state-hash.ts` (GP, LP review): FNV-1a 32 bit atas, berurutan: tick, fase, state RNG semua aliran, state pemain, state toko, level-up, hadiah, inventaris, Memento, penghitung efek, lalu setiap pool: hanya slot hidup dalam urutan slot, semua kolom kecuali `serial`. Float di-hash lewat bit (`Float64Array` dan `Uint32Array` bersama). Dipakai di tes, replay (checkpoint tiap 60 tick), dan hook e2e; tidak dipanggil tiap tick di produksi. Ditampilkan sebagai 8 karakter hex huruf kecil.

### 8.5 Mesin efek (catatan kelayakan untuk GP)
- Setiap hit membawa `procDepth`: 0 hit asli, 1 hasil efek. Efek hanya dipicu oleh hit `procDepth 0`, atau `procDepth 1` bila `allow_proc = 1`; aksi yang dipicu dari `procDepth 1` menghasilkan `procDepth 2` yang tidak memicu apa pun (effect-primitives 6.2). Kolom `procDepth` ada di pool proyektil, zona, dan aksi tertunda.
- Aksi tertunda (`repeat`, gema `echo_bell`, `delay` di `spawn_area`) masuk pool aksi tertunda, diproses urut tick jatuh tempo lalu urutan masuk.
- Stat final dihitung ulang hanya saat input berubah (inventaris, buff, kartu, syarat `passive` kontinu yang berganti nilai), bukan tiap tick.
- Urutan komposisi stat (`add`, `mult`, `min`, `convert`, batas) ditetapkan GD di effect-primitives (perbaikan wajib, lihat review).

---

## 9. Alur data

### 9.1 Alur
```
content/data/*.csv (GD)        \
content/levels/*.json (LD)      >-- tools/data/build-data.ts --> content/generated/game-data.json
content/strings/en.json (WR)    |   (parse, validasi skema,       content/generated/strings.json
content/build.json (Producer)  /     validasi arena LD-T01, cek referensi, filter tingkat, hash)
                                               |
           src/app/boot.ts import JSON (Vite) --> src/content buildGameData() --> sim, render, ui, audio
```

- Build data memuat baris dengan `content_tier <= contentTier` dari `content/build.json`. Tool dan tes boleh membangun tingkat lain dengan `node tools/data/build-data.ts --tier C --out tests/out/game-data-c.json`.

### 9.2 Dialek CSV [Wajib] [Beku M1]
LP menetapkan format; GD menetapkan kolom dan arti di `docs/systems/data-schema.md`. Bila berbeda, butir di bawah yang berlaku.
- UTF-8 tanpa BOM, pemisah koma, header `snake_case`. Kutip ganda RFC 4180 hanya untuk sel berisi koma.
- Desimal titik, tanpa pemisah ribuan. Baris diawali `#` komentar; baris kosong diabaikan. Sel kosong = default kolom.
- Daftar dalam sel dipisah `|`. Parameter dalam sel `kunci=nilai;kunci=nilai`. Syarat efek `nama:nilai` dipisah `|`. Boolean `0` atau `1`.
- **Konvensi id bioma dan arena (satu konvensi, menjawab CD):** bioma `biome_market`, `biome_cloister`, `biome_vineyard` (GD); arena `arena_market`, `arena_cloister`, `arena_vineyard`, `arena_proto` (LD, nama file sama). Nama tampil (The Moth Market, dll.) hanya di string table. `b1`, `b2`, `b3` di `art/palette.json` hanya awalan token palet, bukan id.
- Tabel Memento bernama `mementos.csv` (bukan `keepsakes.csv`); kolom dan kunci string memakai `memento` (keputusan CD K1).
- **Id data `snake_case`**, unik per tabel, tidak berubah setelah dipakai. Ini berlaku juga untuk **tag** (`flame`, `shard`, `edge`, `echo`, `ward`, `trade`, bukan `Flame`), id arena (`arena_market`, `arena_proto`), dan id bioma (`biome_market`). Nama tampil hanya lewat string table.
- **Kolom tingkat konten bernama `content_tier`** (`A`, `B`, `C`), bukan `tier`, agar tidak tertukar dengan tier senjata (I sampai IV, kolom `tier` di `weapon_tiers.csv`).
- **Satuan ditentukan skema per kolom**, bukan akhiran nama. Nama kolom GD diterima apa adanya (`cooldown` detik, `speed` u/s, `range` u). Kolom baru dianjurkan berakhiran `_s` untuk waktu bila nama tidak jelas. Tidak ada satuan piksel di data.
- Persen: stat berjenis `pct` ditulis sebagai poin persen (`damage_pct=8` = +8%); peluang dan pengali sebagai pecahan (`chance=0.08`). Sesuai usulan GD.
- Tabel kunci-nilai (`config.csv`, `shop.csv`): setiap kunci dideklarasikan di skema dengan tipe (number atau id). Kunci tidak dikenal = error. `config.csv` tidak memuat konstanta teknis (`tick_rate` dihapus).
- **Urutan baris CSV adalah urutan index padat** dan urutan pool untuk pengundian RNG. Kolom `sort` hanya untuk tampilan UI.

### 9.3 Skema dan validasi
- DSL kecil di `src/content/schema/` (`col.id()`, `col.int({ min })`, `col.float({ min, max })`, `col.seconds()`, `col.uPerSec()`, `col.enum([...])`, `col.ref('enemies')`, `col.list(...)`, `col.params(registry)`, `col.optional(...)`). Tipe TypeScript diturunkan dari skema. Tanpa zod.
- `col.params(registry)`: kunci `params` divalidasi per `archetype` senjata, per `behavior` musuh, per `archetype` pola boss, dan per `action` efek. Registri kunci ditulis GP bersama implementasi arketipe dan direview LP.
- Validasi: tipe, rentang (termasuk `stats.csv` min dan max), enum, keunikan id, referensi antar tabel, kunci gabungan `(profile, pulse)`, kolom wajib, kolom tidak dikenal (error), minimal 1 tag per senjata dan Memento (P1-b), laporan P1-a dari `is_flat`.
- Telegraf minimum (P2-e): bila GD menambah kunci `telegraph_min_*_s` di `config.csv`, validator menolak `telegraph_s` di bawahnya.
- Error dilaporkan `file:baris:kolom pesan` dan menggagalkan build.
- `check-strings.ts`: semua kunci yang dirujuk data dan UI ada; batas P4-b; kata terlarang; em dash (QA DV-3 sampai DV-5).
- `contentHash` = FNV-1a 32 bit hex dari JSON kanonik, disimpan di JSON, save, dan replay.

### 9.4 Bentuk JSON dan konversi saat load [Beku M1]
- Satu bundle `content/generated/game-data.json`: setiap tabel menjadi **array** dalam urutan baris CSV (bukan objek berkunci id, agar urutan pasti). `params` diurai menjadi objek, daftar menjadi array, angka menjadi number. `weapon_tiers.csv` digabung ke senjata (`tiers[0..3]`). `waves.csv` dan `wave_spawns.csv` **tetap dua file CSV** (lebih mudah diedit GD) dan digabung saat build menjadi `profiles[profile][i].spawns[]`. `effects` tetap array; `effectsByOwner` dibangun saat load.
- `buildGameData(raw)` di `src/content`: indeks id ke index, detik ke tick (`Math.round(sec * 60)`), u/s ke u/tick, derajat ke putaran, lalu `Object.freeze` di dev.
- Sim tidak pernah meng-import JSON. App menyuntikkan `GameData`. Tes memakai fixture kecil; tool balance membaca JSON lewat `fs`.

### 9.5 Commit dan dev
- `content/generated/` di-commit. `npm run data:check` gagal bila hasil build berbeda dari yang di-commit.
- `npm run dev`: plugin Vite inline menjalankan ulang build data saat CSV, level, atau string berubah.

### 9.6 Format arena (dari usulan LD 14, disesuaikan) [Beku M1]
Isi usulan LD diterima. Penyesuaian LP (tipe lengkap di 6.10):
1. `id` dan nama file `snake_case` (`arena_market.json`, `arena_proto.json`); `biomes.csv` `arena_id` merujuk id ini.
2. Field `units` dan `camera` **dihapus** dari JSON: satuan dan kamera adalah konstanta global (`src/core/constants.ts`), satu sumber. Validator memakai konstanta itu.
3. `lighting.key`, `lighting.fill`, warna `edgeFade`, dan warna titik cahaya **pindah ke `art/palette.json`** entri bioma (sudah ada di sana, milik AD). JSON arena hanya menyimpan posisi titik cahaya (urut prioritas, maks 8) dan jarak `edgeFade`.
4. Warna di JSON arena memakai **token palet** (`rim.colorToken: "dust"`, `floor.baseToken: "floor-mid"`), bukan hex. `floor.pattern` menjadi `floor.tileId` (id tile AD, misalnya `tile-floor`).
5. Poligon wajib berurutan (searah jarum jam di layar) dan cembung; urutan bebas tidak diterima.
6. `kind` rintangan dan dekorasi adalah id aset AD (`kebab-case`); validator memeriksa keberadaannya setelah registri mesh AD ada (M2).

Validator `tools/data/validate-arena.ts` (LP) menjalankan LD-T01 dan LD-T10 sebagai bagian build data: R1 sampai R7, zona dekorasi dan tinggi, maks 8 titik cahaya, sektor spawn di dalam pita dan di dalam batas, zona aman bebas rintangan, proyeksi titik cahaya tidak jatuh di x 64 sampai 576 dan y 54 sampai 303.

### 9.7 String table
Format usulan UI diterima: `content/strings/en.json` objek JSON datar, kunci bertitik `snake_case`, parameter `{nama}`, jamak dengan akhiran `.one` dan `.other`, baris efek dipisah `\n` oleh WR. Pola kunci konten sesuai ui-spec 11 dengan id data `snake_case` (`biome.biome_market.name` atau kunci dari kolom `name_key`, `tag.flame.name`). Kunci hilang: dev menampilkan `[[kunci]]`, rilis menampilkan kunci dan peringatan konsol.

---

## 10. Pixel art prosedural [Beku M1 untuk format]

- Palet: `art/palette.json` (AD) berisi token inti, emisif, grup kubu, dan entri bioma (env, cahaya, kabut, grading). Satu-satunya sumber warna. Entri bioma dicari lewat `contentId` = id bioma GD; `biomes.csv` tidak perlu kolom `palette_id`.
- Definisi sprite: `art/sprites/<id>.json` atau `<id>.ts` (generator, default export bentuk sama). Tipe kanonik `SpriteSheetDef` (termasuk ekstensi AD: `class`, `outlineMode`, `mirror`, `emissive`, `status`, `note`) dipindah ke `src/core/contracts/sprite.ts` (LP menulis, AD mengusulkan perubahan). `art/sprites/sprite-types.ts` menjadi re-export agar import generator tidak berubah.
- Id sprite `kebab-case` dengan awalan grup (aturan AD). Id aset tidak dirujuk dari CSV; pemetaan dari id data lewat `sprite-ids.ts` (7.6).
- Rasterizer `src/core/sprite/rasterize.ts` (fungsi murni: mirror, rim, outline 4 atau 8 tetangga, pangkas, validasi kubu) dan packer `src/core/sprite/atlas-pack.ts`. Diporting LP dari `tools/art/lib/sprite.mjs` dan `atlas.mjs` di M1 dengan perilaku identik; tool AD lalu meng-import modul ini sehingga tool dan game identik.
- Saat boot `src/app/assets.ts` memuat `art/palette.json`, `art/sprites/*`, `art/tiles/*` lewat `import.meta.glob` (eager), lalu render dan UI merasterisasi lewat `src/core/sprite`. Atlas diunggah sebagai `DataTexture` nearest tanpa mipmap.
- Generator sprite wajib deterministik lintas mesin: tanpa `Math.random`, dan memakai `src/core/math` untuk trig (bukan `Math.sin`), agar piksel sama di semua browser.
- Animasi memakai jam render dari tick sim.
- Skrip AD: `art:check` (validasi, masuk `check`), `art:preview` (lembar preview), `art:concepts` (konsep mood).

---

## 11. Audio sintesis runtime

- `AudioContext` dibuat dan di-`resume` pada gesture pertama.
- Graf bus final mengikuti audio-direction 8.1: `music`, `sfx`, `ui` ke master, kompresor, limiter; kirim `hall` dan `room`; master lowpass untuk jeda dan mati. Ducking per kelompok dengan `GainNode` (audio-direction 8.5); pemicu `sfx.player.hit` dari event `PlayerDamaged`.
- Lokasi data final (usulan AU diterima): `src/audio/music/<cue-id>.json`, `src/audio/cues/cues.json`, DSP murni `src/audio/synth/` (tanpa Web Audio, bisa di Node). WAV review dibuat ke `audio/preview/` (di-gitignore, tidak di-commit).
- **Tidak ada kolom audio di CSV GD.** Pemetaan id senjata, musuh, Warden, boss, efek, dan pola ke cue (`sfxFire`, `sfxPitchSemis`, dll.) ditulis AU di `src/audio/event-map.ts` atau `cues.json`, dikunci id data. Tes AU memeriksa setiap id di `GameData` tingkat build punya cue atau fallback yang dinyatakan.
- Panning `worldX`: `pan = clamp((x - cx) / halfWidth, -1, 1) * 0.6`, dengan `cx` dan `halfWidth` dari `ArenaDef.arena.boundary` lewat `setArena` (arena final: `halfWidth` 16 u).
- Batas: SFX 24 instans + 6 ui, musik 20 not, render SFX boot di bawah 300 ms bertahap, CPU thread utama di bawah 1 ms per frame, kode audio min+gzip di bawah 25 KB, data audio gzip di bawah 15 KB, buffer di bawah 8 MB (disetujui).
- Audio hanya pendengar: hash sim identik dengan audio hidup atau mati (AU A-8).

---

## 12. Autosave, meta, dan pengaturan

| Kunci localStorage | Isi | Kapan ditulis |
|---|---|---|
| `shardfall.run.v1` | Envelope `{ app, v, savedAt, run: RunSave }` | Saat masuk fase pilihan pertama pasca-Pulse (`reward`, `levelUp`, atau `shop`) dan setelah setiap command `reward.pick`, `levelup.pick`, dan command toko. Dihapus saat run berakhir |
| `shardfall.meta.v1` | `MetaSaveV1` | Saat run berakhir dan saat unlock |
| `shardfall.settings.v1` | `Settings` | Saat pengaturan diterapkan |

- Pilihan level-up, hadiah, dan isi toko tersimpan di save, jadi muat ulang tidak mengganti pilihan (anti save-scum).
- Menutup tab di tengah Pulse melanjutkan dari save terakhir (diterima Producer).
- `savedAt` ditulis app. Migrasi `vN -> vN+1` di `src/app/save/migrations.ts`. Save yang tidak bisa dimuat dibuang dengan pesan (`ui.title.save_lost`), tanpa crash.
- Save menyimpan id string. `contentHash` berbeda tidak otomatis membuang save; yang menentukan adalah apakah semua id masih ada.
- `storage.ts` membungkus semua akses dalam try/catch dengan fallback memori.
- Meta (Silt, unlock): aturan murni di `src/sim/meta/` (GP, dari `meta_unlocks.csv`), disimpan app. Tingkat A tanpa Silt.

---

## 13. Anggaran performa [Beku M1]

Profil acuan **P-REF** (dari QA 9.2, diterima): mesin QA dengan GPU terintegrasi AMD Radeon (Power saving), throttling CPU 2x lewat CDP, jendela 1920 x 1080, kualitas Sedang, headed. Angka fps headless tidak sah.

| Ukuran | Anggaran (lolos) | Cara ukur |
|---|---|---|
| Frame time skenario puncak, P-REF Sedang | p95 16,7 ms atau kurang, p99 25 ms atau kurang (1% low 40 fps), rata-rata 58 fps atau laju layar | `getPerf()`, `spawnStress('peak')`, pemanasan 5 s, ukur 30 s (QA PF-1) |
| Frame time skenario puncak, P-REF Rendah | p99 20 ms atau kurang | QA PF-2 |
| Sim per tick (puncak) | p95 4 ms di P-REF; 2 ms di Node mesin dev | `getPerf().simTickMs`, `tests/bench/sim-peak.bench.ts` |
| Bot headless | minimal 20x waktu nyata | QA B-4 |
| CPU render per frame | 4 ms atau kurang | Debug overlay |
| Draw call / segitiga | 60 / 100 ribu atau kurang | `renderer.stats()` |
| Alokasi | Nol di hot loop sim dan render | DevTools, review |
| Heap | Stabil, di bawah 150 MB; run ke-3 maks 20% di atas run ke-1 | QA PF-5 |
| Boot sampai judul interaktif | 5 s lokal `vite preview` cache kosong (M2); 2 s pada 10 Mbps (M4) | QA PF-4, Playwright throttling |

Skenario puncak = 120 musuh, 150 proyektil musuh, 300 proyektil pemain (200 proc), 24 zona, 150 Glint, partikel penuh.

### Ukuran bundle (gzip)
| Bagian | Target | Batas gagal CI |
|---|---|---|
| JavaScript awal (termasuk three.js, kode audio) | 300 KB | 400 KB |
| JSON data dan string | 40 KB | 80 KB |
| Data art (sprite, tile, palet) | 40 KB | 60 KB |
| Data audio (musik, cue) | 15 KB | 25 KB |
| Total transfer halaman pertama | 400 KB | 600 KB |

`tools/bundle/check-bundle.ts` mengukur gzip setiap file di `dist/` dan gagal bila melewati batas, atau bila build produksi mengandung string `__shardfall` atau chunk `hooks`.

---

## 14. Strategi tes [Beku M1 untuk lokasi dan perintah]

| Lapis | Alat | Lokasi | Pemilik | Perintah |
|---|---|---|---|---|
| Unit | Vitest (Node) | `tests/unit/<modul>/` | Pemilik modul | `npm test` |
| Validasi data dan teks | Vitest | `tests/data/` | LP + QA | `npm test` |
| Determinisme | Vitest | `tests/determinism/` | LP + GP | `npm test`, `npm run test:det` |
| Audit aset | Vitest | `tests/assets/` | AD + QA | `npm test`, `npm run test:assets` |
| Bot headless | Vitest | `tests/bot/` | QA + GP | `npm run test:bot` |
| Benchmark | Vitest bench | `tests/bench/` | LP + GP | `npm run bench` |
| E2E | Playwright | `tests/e2e/` | QA | `npm run test:e2e` |
| Performa | Playwright headed | `tests/perf/` | QA | `npm run test:perf` |

### 14.1 Tes determinisme (QA 5.3, final)
1. D-1 ulang identik dalam satu proses, checkpoint tiap 60 tick.
2. D-2 ulang di proses Node terpisah (child process).
3. D-3 seed berbeda menghasilkan hash berbeda.
4. D-4 save lalu load di fase pilihan Pulse 3: hash akhir sama (bergantung reset kanonik 8.1).
5. D-5 Node vs Chromium lewat `step` dan `getStateHash`.
6. D-6 bebas frame rate: loop tiruan dt 30, 60, 144 fps dan dt acak berseed.
7. D-7 **replay emas memakai data fixture** (`tests/fixtures/data/`) dan disimpan di `tests/fixtures/replays/` dengan hash yang diharapkan. Karena memakai fixture, perubahan balance GD tidak mengubah hash; perubahan logika sim yang disengaja wajib memperbarui replay dengan alasan tertulis. Tes dengan data asli hanya membandingkan antar jalan, tidak menyimpan hash.
8. D-8 replay dari sesi browser diputar di Node.
9. Isolasi aliran RNG: reroll tambahan tidak mengubah subset state spawn Pulse berikutnya.
10. AU A-8: hash identik dengan audio hidup dan mati.

### 14.2 Aturan tes terkait balance
Unit test sim memakai fixture kecil. Tes data asli hanya validitas, referensi, determinisme, invarian. Angka balance tidak pernah diubah agar tes lulus.

### 14.3 E2E dan hook [Wajib]
- `vite.config.ts` mendefinisikan `__E2E__` `true` hanya di `vite build --mode e2e` (keluaran `dist-e2e/`).
- `boot.ts`: `if (__E2E__) { const m = await import('./e2e/hooks.ts'); m.install(...) }`. Hilang total dari build produksi; dicek `bundle:check`.
- Playwright: `webServer` menjalankan `vite preview --outDir dist-e2e` dengan port tetap, dimatikan otomatis. Project `chromium` (M1), `chrome`, `msedge`; `firefox` dan `webkit` di M4. Tes gagal pada `console.error`, `pageerror`, atau request gagal. Trace dan video hanya saat gagal.
- Screenshot stabil: `pauseLoop`, `step`, RNG visual tetap, jam render dari tick, `prefers-reduced-motion` diemulasi untuk animasi CSS.
- Hasil sementara di `tests/out/` (gitignore); bukti laporan di `docs/qa/evidence/<milestone>/`.

---

## 15. Build, skrip, CI, dan deploy

### 15.1 Skrip npm final [Beku M1]

| Skrip | Isi | Pemilik isi |
|---|---|---|
| `dev` | Vite dev server dengan plugin data watch | LP |
| `build` | `npm run data` lalu `vite build` produksi (base `/shardfall/`) | LP |
| `build:e2e` | `vite build --mode e2e --outDir dist-e2e` | LP |
| `preview` | `vite preview` | LP |
| `data` | `node tools/data/build-data.ts` | LP |
| `data:check` | Build data ke memori, bandingkan dengan `content/generated/` | LP |
| `typecheck` | `tsc -p tsconfig.json`, `tsconfig.sim.json`, `tsconfig.tools.json` | LP |
| `lint` | ESLint seluruh repo | LP |
| `format` / `format:check` | Prettier | LP |
| `test` | Vitest: unit, data, determinisme cepat, aset | LP |
| `test:det` | Vitest `tests/determinism` lengkap (termasuk D-2) | LP |
| `test:bot` | Vitest `tests/bot` (B-1 sampai B-4) | QA |
| `test:assets` | Vitest `tests/assets` | AD + QA |
| `test:e2e` | `build:e2e` lalu Playwright `tests/e2e` | QA |
| `test:perf` | `build:e2e` lalu Playwright `tests/perf` (headed, manual di mesin QA) | QA |
| `bench` | Vitest bench | LP |
| `bundle:check` | `node tools/bundle/check-bundle.ts`: ukuran gzip dan string terlarang di `dist/` | LP |
| `art:check` | `node tools/art/check-sprites.ts --no-preview` | AD |
| `art:preview` | `node tools/art/check-sprites.ts` | AD |
| `art:concepts` | `node tools/art/build-concepts.ts` | AD |
| `audio:check` | `node tools/audio/validate.ts` (A-5, cues, routes, lagu, anggaran gzip) | AU |
| `levels:check` | `node tools/levels/check-arena.ts` (LD-T01, LD-T10) | LD |
| `audio:render` | Playwright merender WAV ke `audio/preview/` | AU |
| `qa:report` | `node tools/qa/report.ts` | QA |
| `check` | `data:check`, `art:check`, `audio:check`, `format:check`, `typecheck`, `lint`, `test`, `build`, `bundle:check` berurutan. **Wajib hijau sebelum menyerahkan pekerjaan** | LP |

Selama skrip atau tool milik peran lain belum ada di M1, `check` melewatinya dengan pesan jelas (bukan gagal diam-diam), dan LP menyalakannya begitu tool tersedia.

**Keadaan M1-09a:** `check` = `data:check` (termasuk cek string), `art:check`, `levels:check`, `audio:check`, `format:check`, `typecheck`, `lint`, `test`, `build`, `bundle:check`. `test:e2e` tetap terpisah (lokal).

**Keadaan M1-01 (lama):** `check` = `typecheck`, `lint`, `test`, `data:check` (brief M1-01). `art:check` masih menjalankan `tools/art/check-sprites.mjs` sampai AD memindah tool ke `.ts` (M1-05), lalu masuk `check` bersama `format:check`, `build`, `bundle:check`, dan `audio:check`. `data:build` adalah alias `data`. CI menjalankan `typecheck`, `lint`, `test`, `data:check` saja; e2e hanya lokal (brief M1-01, menggantikan 15.3 untuk M1).

### 15.2 tsconfig
- `tsconfig.json`: `src/` (kecuali yang hanya di sim config), `tests/`, `art/**/*.ts`, file konfigurasi. Lib DOM.
- `tsconfig.sim.json`: `src/sim`, `src/core`, `src/content`. Lib ES2023 tanpa DOM.
- `tsconfig.tools.json`: `tools/`, `art/**/*.ts`. Lingkungan Node (`@types/node`, menunggu persetujuan Producer).

### 15.3 CI (GitHub Actions)
- `ci.yml` pada `pull_request` dan `push` ke `main`: `npm ci`, `npm run check`, `npm run test:bot`, `npm run test:e2e` (Chromium). `concurrency` per branch dengan `cancel-in-progress`, `timeout-minutes` sekitar 15.
- `deploy.yml` pada `push` ke `main` setelah CI hijau: build produksi, `actions/upload-pages-artifact`, `actions/deploy-pages`.

### 15.4 GitHub Pages
`base: '/shardfall/'` untuk produksi, `'/'` untuk dev. Tanpa path absolut; URL manual memakai `import.meta.env.BASE_URL` (hanya di `src/app`). Satu halaman tanpa router. Pages bersumber "GitHub Actions" (langkah Producer).

---

## 16. Rencana kerja paralel M1

1. **LP lebih dulu (blok pembuka)**: kerangka Vite dan TypeScript, lint dan format, `src/core` lengkap (kontrak bagian 6, rng, hash, math, event buffer, projection, sprite rasterizer dan packer), `src/content` (DSL skema, parser CSV, build data, validator arena), loop app, `tests/fixtures/fake-world.ts`, skrip `check`, CI. Kontrak dibekukan setelah blok ini.
2. **Lalu paralel**:
   - GP: `src/sim/**`, `tests/unit/sim/`, `tests/determinism/` (bersama LP), registri `params`.
   - UI: `src/ui/**` dengan `WorldView` palsu.
   - AD: `art/**`, `tools/art/` (dipindah ke `.ts`), `src/render/shaders/`, `env/`, `vfx/`.
   - LP: `src/render/pipeline/`, `camera.ts`, `sprites/`, integrasi `src/app`.
   - AU: `src/audio/**`, `tools/audio/`.
   - GD: `content/data/*.csv` sesuai dialek 9.2, `tools/balance/`.
   - LD: `content/levels/arena_proto.json` sesuai 6.10 dan 9.6.
   - WR: `content/strings/en.json`.
   - QA: `tests/e2e/`, `tests/bot/`, `tests/data/` (bersama LP).
3. Integrasi `src/app/boot.ts` hanya oleh LP. Permintaan perubahan kontrak dikumpulkan dan diputuskan LP sekali per putaran.

---

## 17. Risiko teknis dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kontrak berubah di tengah M1 | Agen saling menunggu | Bagian bertanda [Beku M1]; perubahan dikumpulkan, dicatat di 19 |
| Gerak vertikal tampak 62,5% dari horizontal | Rasa gerak tidak simetris | Dikaji CD dan GD di M1. Sim tetap isotropik (adil dan deterministik); kompensasi bila perlu di data kecepatan |
| Pita DoF terlalu sempit atau lebar | Rasa HD-2D kurang atau area main kabur | Pita dalam piksel bingkai referensi di konfigurasi render, dikalibrasi CD |
| GPU terintegrasi lemah | Di bawah 60 fps | Resolusi virtual, kualitas Rendah, batas cahaya dan partikel |
| Determinisme lintas browser | Replay beda antar browser | Aturan math 4.2, uji D-5, save tidak bergantung replay |
| Mesin efek meledak (rantai proc) | Lonjakan CPU atau pool penuh | `procDepth`, batas lunak 200 proc dan 24 zona, aksi tertunda berkapasitas tetap |
| Ukuran three.js | Bundle melewati target | Named import, `bundle:check` di CI |
| DPR non-integer (1,25, 1,5) | UI atau dunia buram | Skala dihitung dalam piksel fisik (7.3) |

---

## 18. Pertanyaan terbuka

- Producer: setujui `@types/node` (diperlukan untuk typecheck tool) dan putuskan `@vitest/coverage-v8` (opsional).
- GD: urutan komposisi stat; aturan tepat penggabungan Glint di atas batas; kalibrasi jarak GDD ke arena 32 x 20 u; kolom `sectors` di `wave_spawns.csv` (opsional, default semua sektor).
- GD: nilai `player_vertical_screen_ratio` di `config.csv` (awal 0,8 sesuai CD K7).
- GD: apakah rintangan menghalangi proyektil (LD R9, default tidak) dan apakah pemain kembali ke titik awal tiap Pulse (default ya, usulan LD).

---

## 19. Log perubahan kontrak

| Tanggal | Versi | Perubahan | Alasan |
|---|---|---|---|
| 2026-11-16 | 1 | Draf awal M0 | |
| 2026-11-16 | 2 | Review M0 (M0-11b): Memento, konvensi id bioma dan arena, kompensasi gerak vertikal, pass akhir bilinear untuk bloom dan blur, satuan 16 px per u, pitch asin(0,625), skala dari kotak wajib LD, fase `reward`, kolom event `c`, event baru, K1 sampai K11, Settings final, hook e2e final, format arena dan CSV final, skrip final. Detail per peran di `docs/reviews/M0-lp.md` | Menyelaraskan semua dokumen M0 sebelum M1 |
| 2026-11-17 | 2.1 | M1-01, kontrak dibekukan di kode (daftar file di awal bagian 6). Penyesuaian: (1) `CreateRenderer` dan `CreateAudio` menerima `GameData` agar index padat di `WorldView` dan event bisa dipetakan ke id sprite, VFX, dan cue; (2) `core/contracts` boleh `import type` `GameData` dari `src/content` (pengecualian arah import, tipe saja); (3) kontrak ber-DOM dipisah ke `src/core/dom.ts`; (4) factory ditulis sebagai tipe; (5) `PaletteDef.point` menerima `rangeU` atau `radiusPx` sampai AD memigrasi palet; (6) tiga konstanta tambahan: `MAX_FRAME_DELTA_MS`, `REF_ORIGIN_X/Y`, `ARENA_MAX_HALF_W_U/D_U`; (7) kunci GameData diturunkan otomatis dari nama kolom CSV: camelCase plus akhiran satuan (`cooldown` jadi `cooldownTicks`, `speed` jadi `speedUPerTick`, `range` jadi `rangeU`), `final` jadi `isFinal` | Integrasi blok pembuka M1 |
| 2026-11-17 | 2.2 | M1-09a, integrasi dan review M1. Tambahan aditif: (1) event `MusicPressureChanged: 70` (Q21) dan emisi `PlayerHpLowChanged` di sim (`src/sim/systems/signals.ts`), ambang HP rendah konstanta presentasi `LOW_HP_FRAC = 0.3` di `src/core/constants.ts` (ui-spec S03, GD boleh memindah ke `config.csv`); (2) `Sim.poolOverflow`; (3) `Ui.setResumeCountdown(n)` untuk hitung mundur 900 ms (state app); (4) `DebugCommand` `debug.xp`, dan `debug.endPulse` membunuh Warden hidup lebih dulu; (5) tick sim dimulai ulang di `run.start` (jam relatif run: replay browser cocok dengan Node, state run yang menyimpan tick absolut tidak bergantung lama layar judul); (6) hash state memakai kecocokan serial (bukan nilai serial) untuk memori pierce; (7) `Sim.load` memvalidasi bentuk save (`corrupt`, bukan throw) dan memancarkan `PhaseChanged` di step berikutnya; (8) registri `params` diisi (GP spec 3, data-schema 5, effect-primitives 5); (9) validasi data: peran `warden_id`/`boss_id` dan kesamaan `content_tier` `wave_spawns` dengan `waves`; (10) cek string resmi (`tools/data/lib/check-strings.ts`) di pipeline data; (11) parameter teks efek dari data (`src/content/rules/text-params.ts`), satu sumber untuk UI dan cek; (12) profil default app `run_a` (bukan `run_a_m1`, yang tanpa Warden dan boss); (13) `?lang=id` memuat `content/strings/id.json` secara lazy dengan cadangan EN; (14) `content_tier` opsional di `effects`, `waves`, `wave_spawns` disetujui. Detail di `docs/reviews/M1-lp.md` | Game bisa dimainkan end-to-end, pertanyaan teknis peran M1 ditutup |
| 2026-11-17 | 2.3 | M2-02, pipeline HD-2D (bagian 7.8). Aditif: (1) tabel kualitas 7.7: shadow map dekorasi statis di Sedang (1024) dan Tinggi (2048 PCF); (2) antarmuka cahaya sprite `SCENE_LIGHTING_GLSL` plus `SceneLighting.uniforms`, `emissiveGain`; (3) `renderer.debug.overrideQuality` untuk tes; (4) hook opsional `EntityLayers.playerSprite` (AD) untuk siluet tembus; (5) aturan K3 di komposit | Vertical slice HD-2D |
