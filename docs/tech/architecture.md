# Shardfall: Arsitektur Teknis

Pemilik: Lead Programmer (LP). Status: draf M0 untuk review Producer dan QA (versi 1, 2026-11-16).
Dokumen terkait: `docs/tech/coding-standards.md` (aturan kode), `docs/pillars.md`, `docs/style-guide.md`, `docs/vision.md`, `docs/gdd.md` dan `docs/systems/data-schema.md` (milik GD, kolom dan arti data).

Penanda: **[Wajib]** tidak boleh dilanggar tanpa persetujuan LP. **[Saran]** boleh disesuaikan pemilik wilayah dengan alasan tertulis. **[Asumsi]** dikalibrasi di M1 atau M2.

Tujuan dokumen ini: GP, UI, AU, AD, LD, dan GD bisa bekerja paralel di M1 tanpa saling menimpa. Caranya: batas folder yang jelas, kontrak TypeScript di satu tempat (`src/core/contracts/`), dan aliran data satu arah.

---

## 1. Ringkasan keputusan

| # | Keputusan | Alasan singkat |
|---|---|---|
| 1 | TypeScript strict, three.js (WebGL2), Vite, Vitest, Playwright, ESLint, Prettier, Web Audio API tanpa library | Sesuai rekomendasi handoff; semua open source berlisensi permisif |
| 2 | **Post-processing ditulis sendiri** (4 pass kecil di atas `WebGLRenderTarget` three.js), tanpa library `postprocessing` | Kebutuhan kita sempit dan khusus: blur pita tepi (bukan DoF berbasis kedalaman), bloom dari piksel emisif, lapisan bahaya digambar sesudah post-processing. Bundle lebih kecil dan urutan pass sepenuhnya terkendali. Cadangan bila macet: `EffectComposer` dari `three/examples/jsm` (sudah ada di paket three, tanpa dependensi baru) |
| 3 | Simulasi deterministik murni di `src/sim`, tick tetap 60 Hz, RNG ber-seed per aliran, tanpa `Math.random`, `Date`, DOM, atau three.js | Bug bisa direproduksi, balance bisa diuji otomatis, sim bisa dijalankan di Node (tes dan tool balance GD) |
| 4 | Render seluruh dunia ke **render target beresolusi virtual** (sekitar 640x360), lalu diperbesar dengan skala integer dan filter nearest | Menjamin satu skala pixel untuk sprite dan tekstur lingkungan (P3-a, P3-b) dan memangkas biaya post-processing |
| 5 | Kamera ortografis, pitch `asin(2/3)` sekitar 41,8 derajat, tetap, tidak berputar, tidak mengikuti pemain secara default | Sesuai style guide 1.4; sudut ini membuat kedalaman lantai terproyeksi tepat 2/3, sehingga tekstur lantai bisa dibuat pas 1 texel = 1 piksel layar |
| 6 | Entitas sim memakai **pool struct-of-arrays (SoA)** berkapasitas tetap dengan slot stabil | Nol alokasi per tick, iterasi cepat, mudah di-hash dan diserialisasi |
| 7 | Tabrakan: lingkaran saja, **spatial hash grid seragam** yang dibangun ulang tiap tick dengan counting sort | Sederhana, deterministik, tanpa alokasi |
| 8 | Data: CSV di `content/data/` diubah tool menjadi satu JSON tervalidasi di `content/generated/`, di-import Vite | Angka balance hanya di data; error data ketahuan saat build, bukan saat main |
| 9 | Pixel art: sprite didefinisikan sebagai JSON (grid karakter plus token palet), dirasterisasi oleh fungsi murni menjadi atlas saat boot. Tool Node yang sama membuat PNG preview dan audit palet | Tanpa file biner di repo, bisa dibuat ulang, audit kode warna (P2-d) otomatis |
| 10 | Audio: sintesis saat runtime. SFX dirender sekali saat boot ke `AudioBuffer` lewat `OfflineAudioContext`; musik dimainkan sequencer lookahead dari data lagu JSON (selaras `docs/audio-direction.md`) | Unduhan nol byte untuk audio, bisa dibuat ulang |
| 11 | UI memakai DOM (TypeScript tanpa framework) di atas canvas | Aksesibilitas (ukuran teks, navigasi keyboard, pembaca layar), bundle kecil |
| 12 | Autosave hanya di awal fase toko, ke `localStorage`, dengan versi save dan migrasi | State kecil (tanpa musuh hidup), tidak bisa dipakai untuk save-scum di tengah Pulse |
| 13 | Hook tes e2e hanya ada di build mode `e2e`, dihapus dari bundle produksi lewat konstanta `__E2E__` dan dicek otomatis | Aturan handoff: flag tes tidak masuk bundle produksi |
| 14 | Deploy statis ke GitHub Pages dengan base path `/shardfall/` lewat GitHub Actions | Keputusan Producer di `docs/tasks.md` |

---

## 2. Stack final

### 2.1 Platform target
- Browser desktop terbaru: Chrome, Edge, Firefox, Safari 16.4 ke atas. **WebGL2 wajib** (three.js modern tidak lagi mendukung WebGL1). Bila WebGL2 tidak tersedia, tampilkan pesan statis yang jelas.
- Keyboard dan mouse; gamepad lewat Gamepad API (opsional).

### 2.2 Dependensi (dipasang LP di M1, bukan sekarang)

| Paket | Jenis | Lisensi (cek ulang saat instal) | Kegunaan |
|---|---|---|---|
| `three` | runtime | MIT | Render WebGL2 |
| `typescript` | dev | Apache-2.0 | Bahasa, typecheck |
| `vite` | dev | MIT | Dev server, build, import JSON |
| `vitest` | dev | MIT | Unit test dan tes determinisme |
| `@playwright/test` | dev | Apache-2.0 | Tes end-to-end dan screenshot |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | dev | MIT (typescript-eslint: cek, sebagian paket BSD-2-Clause) | Lint dan aturan larangan |
| `prettier` | dev | MIT | Format otomatis, mengurangi konflik antar agen |
| `@types/three` | dev | MIT | Tipe three.js |

- Satu-satunya dependensi runtime adalah `three`. Tidak ada library UI, audio, ECS, fisika, atau validasi skema.
- Versi stabil terbaru saat M1, dikunci lewat `package-lock.json`. Semua dicatat di `docs/credits.md` saat dipasang.
- Node 24 dipakai untuk tool. Tool ditulis dalam TypeScript dan dijalankan langsung dengan `node tools/x.ts` (type stripping bawaan Node 24), tanpa `ts-node` atau `tsx`. Konsekuensinya ada di coding standards: hanya sintaks TypeScript yang bisa dihapus (tanpa `enum`, `namespace`, parameter properties) dan import relatif memakai ekstensi `.ts`.

---

## 3. Gambaran besar

```
                 +--------------------------------------------------+
                 |  src/app  (composition root, loop, input, save)  |
                 +--------------------------------------------------+
       InputFrame |  Command (antre)           ^ WorldView (read-only) + FrameEvents
                  v                            |
            +-----------+   events per tick    |
            |  src/sim  | ---------------------+-----> src/render (dunia, VFX)
            |  (murni)  |                      +-----> src/ui     (HUD, toko, menu)
            +-----------+                      +-----> src/audio  (SFX, musik)
                  ^                                        |
                  | GameData (JSON tervalidasi)            | Command (klik toko, pilih kartu)
            +-------------+                                v
            | src/content | <--- content/generated/*.json   app meneruskan ke sim
            +-------------+
```

Aturan aliran [Wajib]:
1. Sim tidak tahu render, UI, atau audio ada. Sim hanya menerima `InputFrame` dan `Command`, dan menghasilkan state (dibaca lewat `WorldView`) serta event.
2. Render, UI, dan audio hanya **membaca** `WorldView` dan event. Satu-satunya cara mengubah game adalah mengirim `Command` lewat `CommandSink`.
3. Render, UI, dan audio tidak saling import. Kebutuhan bersama (misalnya proyeksi dunia ke layar untuk UI) disediakan `src/app` lewat interface di `src/core/contracts/`.

---

## 4. Simulasi deterministik

### 4.1 Tick tetap [Wajib]
- `TICK_RATE = 60`. Satu `step()` sama dengan tepat satu tick (1/60 detik). Semua besaran waktu di sim dalam tick; besaran per detik dari data dikonversi sekali saat load (lihat 9.4).
- Loop di `src/app/loop.ts` memakai `requestAnimationFrame` dan akumulator:
  - `acc += min(frameDeltaMs, 250)`.
  - Selama `acc >= 1000/60` dan tick di frame ini kurang dari `MAX_TICKS_PER_FRAME = 4`: jalankan `sim.step(input)`.
  - Bila batas 4 tick tercapai, sisa akumulator dibuang (game melambat, bukan "spiral of death").
  - Render memakai `alpha = acc / tickMs` untuk interpolasi posisi `prev` ke posisi sekarang.
- Jeda (pause) dan tab tersembunyi (`visibilitychange`) menghentikan tick. Sim tidak tahu soal jeda.
- Hit stop dan slow motion gameplay (misalnya saat pemain mati) diimplementasikan **di dalam sim** sebagai penghitung tick, bukan dengan memperlambat loop, agar tetap deterministik.

### 4.2 Larangan di `src/sim` [Wajib, dipaksa ESLint dan tsconfig]
- Tidak ada `Math.random`, `Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `crypto`.
- Tidak ada import dari `three`, DOM (`window`, `document`, `localStorage`), `src/render`, `src/ui`, `src/audio`, `src/app`.
- Tidak ada `import.meta.env` (sim harus bisa jalan di Node murni untuk tool balance).
- Tidak ada `Math.sin`, `Math.cos`, `Math.tan`, `Math.atan2`, `Math.exp`, `Math.log`, `Math.pow`, `Math.hypot`, dan operator `**` dengan pangkat pecahan. Hasil fungsi ini bisa berbeda antar mesin JavaScript. Pakai `src/core/math` (aproksimasi polinomial yang hanya memakai `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`, `Math.imul`, `Math.fround`; semuanya identik di semua mesin).
- Iterasi selalu dalam urutan slot naik. `sort` wajib memakai pembanding total (seri dipecah dengan slot atau id).
- `src/sim` di-typecheck dengan `tsconfig.sim.json` yang `lib`-nya tanpa DOM, sehingga pemakaian DOM gagal dikompilasi.

Cakupan jaminan: determinisme **dijamin** pada mesin JavaScript yang sama (Node V8 untuk tes, Chrome dan Edge). Antar mesin (Firefox, Safari) diusahakan lewat aturan math di atas, dan diuji di M4. Save file tidak bergantung pada ini karena menyimpan state, bukan replay.

### 4.3 RNG ber-seed per aliran [Wajib]
- Generator: `sfc32` (32 bit, state 4 x uint32, cepat, hanya `Math.imul` dan operasi bit). Seed aliran diturunkan dari seed run lewat `splitmix32(hash(runSeed, streamName))`.
- Aliran tetap:

| Aliran | Dipakai untuk |
|---|---|
| `spawn` | Posisi dan urutan spawn, pilihan jenis musuh dalam Pulse |
| `ai` | Keputusan acak AI musuh (jeda, arah strafe) |
| `combat` | Kritikal, proc, sebaran proyektil |
| `loot` | Drop Glint dan hadiah Warden |
| `shop` | Isi penawaran the Glazier dan reroll |
| `levelUp` | Kartu level-up |

- Alasan pemisahan: reroll toko tidak boleh mengubah urutan spawn Pulse berikutnya. Dengan begitu tes balance dan laporan bug stabil, dan pemain tidak bisa "memanipulasi" spawn lewat toko.
- State semua aliran ikut disimpan di save dan masuk ke hash state.
- Keacakan **visual dan audio tidak memakai RNG sim**. Render dan audio memakai instance `Rng` sendiri dari `src/core/rng` (seed tetap di mode e2e agar screenshot stabil, seed bebas di produksi). `Math.random` dilarang di seluruh `src/` agar semua keacakan bisa di-seed.

### 4.4 Fase run (state machine sim)

```
idle --run.start--> pulse --waktu habis--> pulseClear --(ada level tertunda)--> levelUp --> shop
                      |                         \--(tidak ada)----------------------------> shop
                      |                                                                       |
                      +--HP 0--> defeat                         shop --pulse.begin--> pulse --+
                                                         Pulse terakhir selesai --> victory
```

- `RunPhase = 'idle' | 'pulse' | 'pulseClear' | 'levelUp' | 'shop' | 'victory' | 'defeat'`.
- `pulseClear` adalah jeda pendek (durasi dari data) untuk kilatan kaca akhir Pulse dan pemungutan Glint otomatis bila GD menginginkannya.
- Layar menu, pilih kelas, jeda, pengaturan adalah state **app/UI**, bukan sim.
- Aturan pasti (urutan level-up dan toko, merge otomatis atau manual, apakah Glint sisa dipungut otomatis) milik GD di `docs/gdd.md`. State machine di atas adalah kerangka teknis; GP menyesuaikan dengan GDD tanpa mengubah kontrak tanpa LP.

### 4.5 Replay dan reproduksi bug
- Satu run ditentukan sepenuhnya oleh: `contentHash` data, seed run, `classId`, daftar `InputFrame` per tick, dan daftar `Command` beserta tick-nya.
- Build dev dan e2e bisa mengekspor replay JSON (input dikompres run-length). QA melampirkan replay dan seed di laporan bug.

---

## 5. Struktur folder dan kepemilikan

```
src/
  main.ts              LP   entry: memanggil app/boot
  app/                 LP   composition root: boot, loop, input, storage, save, settings, debug overlay, hook e2e
    boot.ts
    loop.ts
    input/             LP   keyboard, gamepad, remap -> InputFrame
    storage.ts         LP   wrapper localStorage yang aman (quota, mode privat)
    save/              LP   envelope, migrasi, autosave
    settings.ts        LP   (UI menampilkan, app menyimpan)
    e2e/               LP   hook tes, hanya di-import bila __E2E__
  core/                LP   MURNI: tanpa DOM, tanpa three. Boleh di-import semua modul
    contracts/         LP   interface antar modul (bagian 6). Perubahan wajib lewat LP
    rng.ts  hash.ts  math/  event-buffer.ts  ids.ts  constants.ts  assert.ts
  content/             LP   (GD mereview) schema DSL, parser CSV, validator, tipe GameData, builder indeks
  sim/                 GP   semua logika game
    create-sim.ts  world.ts  pools/  systems/  spatial-hash.ts  save-codec.ts  state-hash.ts
  render/              AD + LP
    pipeline/          LP   renderer, render target, pass post-processing, upscale, kualitas
    camera.ts          LP
    sprites/           LP + AD  rasterizer (murni), atlas, batch sprite instanced
    shaders/           AD (LP review)  GLSL sprite, lantai, post-processing
    env/               AD   mesh arena dari ArenaDef, dekorasi, cahaya
    vfx/               AD   partikel dan efek dari event
  ui/                  UI   layar, HUD, komponen, presenter (fungsi murni), teks
  audio/               AU   engine (context, bus, voice limit), synth/ (gelombang JS murni), cues/, music/, event-map.ts
audio/
  music/*.json         AU   data lagu untuk sequencer
art/
  palette.json         AD   token palet dari style guide 1.2 (satu sumber kebenaran warna)
  sprites/*.json       AD   definisi sprite
content/
  data/*.csv           GD   angka balance
  levels/*.json        LD   arena
  strings/en.json      WR   string table
  generated/           tool (LP) hasil build data, di-commit, dicek CI
tools/
  data/                LP   build-data.ts, check-strings.ts
  art/                 AD   preview-sprites.ts (PNG), audit-palette.ts
  audio/               AU   validate-music, render preview WAV lewat browser
  balance/             GD   simulasi balance yang memanggil src/sim secara headless
  bundle/              LP   check-bundle.ts (ukuran dan string terlarang)
tests/
  unit/<modul>/        pemilik modul
  determinism/         LP + GP
  e2e/                 QA (LP menyediakan hook)
  fixtures/            pemilik modul (data mini buatan tangan, WorldView palsu)
  support/             LP   bot input deterministik, helper
```

Aturan kepemilikan [Wajib]:
- Hanya pemilik yang mengubah foldernya. Butuh perubahan di folder lain: minta pemiliknya lewat Producer, atau lakukan perubahan minimal dan sebutkan di laporan (agent-rules aturan 3).
- `src/core/contracts/` milik LP. GP, UI, AU, AD mengusulkan perubahan, LP yang menulis. Ini titik kunci agar kerja paralel tidak bertabrakan.
- Setiap modul punya `index.ts` sebagai API publik. Modul lain hanya boleh import dari `index.ts` tersebut (dipaksa ESLint).

Arah import yang diizinkan [Wajib]:

| Modul | Boleh import |
|---|---|
| `core` | tidak ada (hanya dirinya) |
| `content` | `core` |
| `sim` | `core`, `content` (tipe dan fungsi murni) |
| `render` | `core`, `content`, `three` |
| `ui` | `core`, `content` |
| `audio` | `core`, `content` |
| `app` | semuanya |
| `tools/*` | `core`, `content`, `sim` (lewat path relatif dengan ekstensi `.ts`) |

Catatan: `render`, `ui`, `audio` tidak meng-import `sim` sama sekali. Mereka membaca tipe `WorldView` dari `core/contracts`. Dengan begitu UI dan render bisa dikembangkan dengan `WorldView` palsu sebelum sim GP selesai.

---

## 6. Kontrak antar modul (sketsa interface TypeScript inti)

Semua di `src/core/contracts/`. Ini sketsa M0; nama field final mengikuti `docs/gdd.md` dan `docs/systems/data-schema.md`, dan LP menulis versi kodenya di awal M1 sebelum agen lain mulai.

### 6.1 Id dan konstanta

```ts
// src/core/ids.ts
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Dense index into GameData tables. Assigned at load time from string ids. */
export type EnemyTypeIndex = Brand<number, 'EnemyTypeIndex'>;
export type WeaponIndex = Brand<number, 'WeaponIndex'>;
export type KeepsakeIndex = Brand<number, 'KeepsakeIndex'>;
export type ClassIndex = Brand<number, 'ClassIndex'>;
export type StatIndex = Brand<number, 'StatIndex'>;
export type TagIndex = Brand<number, 'TagIndex'>;

// src/core/constants.ts  (technical constants only, never balance numbers)
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_TICKS_PER_FRAME = 4;
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
}

// src/core/contracts/commands.ts
/** Discrete player decisions. Applied by sim at the start of the next tick, FIFO. */
export type Command =
  | { readonly type: 'run.start'; readonly seed: number; readonly classId: string }
  | { readonly type: 'pulse.begin' }
  | { readonly type: 'levelup.pick'; readonly choice: number }
  | { readonly type: 'shop.buy'; readonly offer: number }
  | { readonly type: 'shop.reroll' }
  | { readonly type: 'shop.lock'; readonly offer: number; readonly locked: boolean }
  | { readonly type: 'shop.sell'; readonly inventorySlot: number }
  | { readonly type: 'run.abandon' };
// Final list follows the GDD (e.g. manual merge). Adding a variant is an LP contract change.

export interface CommandSink {
  send(cmd: Command): void;
}
```

Sim memvalidasi setiap command. Command tidak sah (Glint kurang, fase salah, slot kosong) diabaikan dan menghasilkan event `CommandRejected` dengan kode alasan, agar UI bisa memberi umpan balik. UI boleh menampilkan status "tidak terjangkau" dari `WorldView`, tetapi aturan sebenarnya hanya ada di sim.

### 6.3 Sim

```ts
// src/core/contracts/sim.ts
export interface SimConfig {
  readonly data: GameData;   // injected; sim never imports JSON itself
  readonly arena: ArenaDef;
}

export interface Sim {
  /** Live read-only view. Valid until the next step(). Same object every tick (no allocation). */
  readonly view: WorldView;
  /** Events produced by the most recent step() only. */
  readonly events: SimEventReader;
  enqueue(cmd: Command): void;
  /** Advance exactly one tick. */
  step(input: InputFrame): void;
  /** Only valid in phase 'shop'. Returns null otherwise. */
  save(): RunSave | null;
  load(save: RunSave): LoadResult;
  /** FNV-1a 32-bit hash over the complete sim state, including RNG streams. */
  hash(): number;
}

export type LoadResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'unknownId' | 'badVersion' | 'corrupt' };

// implemented by GP in src/sim/create-sim.ts
export declare function createSim(config: SimConfig): Sim;
```

### 6.4 WorldView: snapshot read-only untuk render dan UI

Prinsip: sim menyimpan state di typed array. `WorldView` memaparkan array itu sebagai `ArrayLike<number>` (index signature `readonly`), jadi render dan UI **tidak bisa menulis** pada level tipe, tanpa biaya salin. View valid sampai `step()` berikutnya; jangan simpan referensi elemen antar frame dengan anggapan nilainya beku.

```ts
// src/core/contracts/world-view.ts
export type RunPhase = 'idle' | 'pulse' | 'pulseClear' | 'levelUp' | 'shop' | 'victory' | 'defeat';

/** Common SoA layout of a fixed-capacity pool with stable slots. */
export interface PoolView {
  readonly capacity: number;
  /** Iterate slots 0..highWater-1 and skip where alive[i] === 0. */
  readonly highWater: number;
  readonly alive: ArrayLike<number>;
  /** Increments every time a slot is reused. Render uses it to reset per-slot animation state. */
  readonly serial: ArrayLike<number>;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  /** Position at the previous tick, for interpolation with alpha. */
  readonly prevX: ArrayLike<number>;
  readonly prevY: ArrayLike<number>;
  readonly radius: ArrayLike<number>;
}

export interface EnemyPoolView extends PoolView {
  readonly typeIndex: ArrayLike<number>;   // EnemyTypeIndex
  readonly hp: ArrayLike<number>;
  readonly maxHp: ArrayLike<number>;
  /** AI state code (idle, move, windup, attack, ...) for animation and telegraph visuals. */
  readonly aiState: ArrayLike<number>;
  readonly aiStateTicks: ArrayLike<number>;
  readonly facing: ArrayLike<number>;      // -1 left, 1 right
  readonly hitFlashTicks: ArrayLike<number>;
  readonly rank: ArrayLike<number>;        // 0 normal, 1 Warden, 2 boss
}

export interface ProjectilePoolView extends PoolView {
  readonly defIndex: ArrayLike<number>;    // which weapon or enemy attack spawned it (picks the sprite)
}

export interface PickupPoolView extends PoolView {
  readonly kind: ArrayLike<number>;        // 0 Glint, more kinds per GDD
  readonly amount: ArrayLike<number>;
  readonly magnetized: ArrayLike<number>;
}

/** Telegraphs (danger) and auras or zones (player) living on the ground. */
export interface AreaPoolView extends PoolView {
  readonly faction: ArrayLike<number>;     // 0 Kept, 1 danger
  readonly shape: ArrayLike<number>;       // 0 circle, 1 line (x2/y2), 2 cone
  readonly x2: ArrayLike<number>;
  readonly y2: ArrayLike<number>;
  readonly ticksLeft: ArrayLike<number>;
  readonly ticksTotal: ArrayLike<number>;  // fill progress = 1 - ticksLeft / ticksTotal
}

export interface PlayerView {
  readonly x: number; readonly y: number; readonly prevX: number; readonly prevY: number;
  readonly radius: number;
  readonly facing: number;
  readonly classIndex: number;
  readonly hp: number; readonly maxHp: number;
  readonly level: number; readonly xp: number; readonly xpToNext: number;
  readonly glint: number;
  readonly riteCooldownTicks: number; readonly riteCooldownMaxTicks: number;
  readonly invulnTicks: number;
  readonly hitFlashTicks: number;
  /** Final stat values, indexed by StatIndex. */
  readonly stats: ArrayLike<number>;
}

export interface PulseView {
  readonly index: number;        // 0-based
  readonly count: number;        // total Pulses in this run
  readonly ticksLeft: number;
  readonly ticksTotal: number;
  readonly isBoss: boolean;
}

export interface ShopOfferView {
  readonly kind: 'empty' | 'weapon' | 'keepsake';
  readonly defIndex: number;
  readonly tier: number;
  readonly price: number;
  readonly locked: boolean;
}

export interface ShopView {
  /** Increments on every change. UI re-renders DOM only when this changes. */
  readonly revision: number;
  readonly offers: readonly ShopOfferView[];
  readonly rerollPrice: number;
  readonly inventory: readonly { readonly weaponIndex: number; readonly tier: number }[];
  readonly keepsakes: ArrayLike<number>;   // KeepsakeIndex list, length = keepsakeCount
  readonly keepsakeCount: number;
  readonly tagCounts: ArrayLike<number>;   // indexed by TagIndex
}

export interface LevelUpView {
  readonly revision: number;
  readonly pending: number;
  readonly choices: readonly { readonly cardIndex: number; readonly rarity: number }[];
}

export interface WorldView {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly phaseRevision: number;
  readonly pulse: PulseView;
  readonly player: PlayerView;
  readonly enemies: EnemyPoolView;
  readonly enemyShots: ProjectilePoolView;
  readonly playerShots: ProjectilePoolView;
  readonly pickups: PickupPoolView;
  readonly areas: AreaPoolView;
  readonly shop: ShopView;
  readonly levelUp: LevelUpView;
  readonly runStats: { readonly kills: number; readonly glintEarned: number; readonly silt: number };
}
```

### 6.5 Event bus: sim ke render (VFX), audio, dan UI

- Sim menulis event ke buffer SoA berkapasitas tetap selama satu tick. Event adalah data, bukan callback; sim tidak punya daftar listener.
- Setelah tiap `step()`, app menyalin event tick itu ke **FrameEvents** (buffer yang sama bentuknya, plus kolom `tick`). Setelah semua tick di frame selesai, app memberikan FrameEvents ke `render`, `audio`, dan `ui`, lalu mengosongkannya.
- Kapasitas: 256 event per tick, 1024 per frame. Bila penuh, event prioritas rendah (misalnya `WeaponFired`, `EnemyDamaged`) dibuang dulu dan penghitung overflow naik (terlihat di debug overlay). Event prioritas tinggi (`PlayerDamaged`, `TelegraphStarted`, `RunEnded`) tidak pernah dibuang.
- `ShopOpened`, `ShopClosed` di `docs/audio-list.md` diturunkan dari `PhaseChanged` (a = fase baru). `PurchaseRejected` adalah `CommandRejected` dengan kode alasan Glint kurang. `ProjectileHit`, `WardenDamaged`, `BossDamaged` adalah `EnemyDamaged` dengan rank dan sumber di payload. Pemetaan ini ditulis AU di `src/audio/event-map.ts`.

```ts
// src/core/event-buffer.ts and src/core/contracts/events.ts
// Names are past tense and match docs/audio-list.md (AU) where possible.
export const SimEventType = {
  // run and phase
  PhaseChanged: 1, PulseStarted: 2, PulseEnded: 3, RunEnded: 4,
  // player
  PlayerDamaged: 10, PlayerHealed: 11, PlayerDied: 12, PlayerHpLowChanged: 13, DamageBlocked: 14,
  WeaponFired: 15, RiteCast: 16, RiteReady: 17, RiteRejected: 18,
  PlayerLeveledUp: 19, KeepsakeAcquired: 20, SynergyActivated: 21,
  // enemies and danger
  EnemySpawned: 30, EnemyDamaged: 31, EnemyKilled: 32, EnemyProjectileFired: 33,
  TelegraphStarted: 34, TelegraphResolved: 35,
  WardenSpawned: 36, WardenKilled: 37, BossSpawned: 38, BossPhaseChanged: 39, BossSummoned: 40, BossKilled: 41,
  // pickups
  GlintDropped: 50, GlintCollected: 51, KeepsakeOfferSpawned: 52,
  // shop and level-up
  LevelUpCardsShown: 60, LevelUpCardChosen: 61,
  ItemBought: 62, ItemSold: 63, ItemMerged: 64, ItemLocked: 65, ShopRerolled: 66,
  CommandRejected: 67,
} as const;
export type SimEventType = (typeof SimEventType)[keyof typeof SimEventType];

/** Read side shared by sim events (one tick) and frame events (all ticks of a frame). */
export interface SimEventReader {
  readonly count: number;
  readonly type: ArrayLike<number>;   // SimEventType
  readonly x: ArrayLike<number>;      // world position (0 when not applicable)
  readonly y: ArrayLike<number>;
  readonly a: ArrayLike<number>;      // payload, meaning per type (table below)
  readonly b: ArrayLike<number>;
}
```

Arti payload (dilengkapi GP di spec M1, perubahan lewat LP):

| Event | a | b |
|---|---|---|
| `PhaseChanged` | kode fase baru | kode fase lama |
| `PlayerDamaged` | damage | hp setelah kena |
| `PlayerHpLowChanged` | 1 masuk HP rendah, 0 keluar | |
| `EnemyDamaged` | damage | bit 0 kritikal, bit 1-2 rank, bit 3 dari proyektil |
| `EnemyKilled` | EnemyTypeIndex | rank |
| `EnemyProjectileFired`, `WeaponFired` | defIndex | jumlah proyektil |
| `TelegraphStarted` | jenis telegraf | durasi (tick) |
| `TelegraphResolved` | jenis telegraf | |
| `GlintCollected` | jumlah | panjang rentetan (untuk pitch naik AU) |
| `PlayerLeveledUp` | level baru | |
| `KeepsakeAcquired` | KeepsakeIndex | |
| `SynergyActivated` | TagIndex | ambang |
| `CommandRejected` | kode alasan | |
| `RunEnded` | 1 menang, 0 kalah | Silt didapat |

### 6.6 Render

```ts
// src/core/contracts/render.ts
export interface RenderFrame {
  readonly view: WorldView;
  readonly alpha: number;              // interpolation factor in [0, 1)
  readonly events: SimEventReader;     // frame events
  /** Render clock in seconds, derived from sim tick + alpha (not wall clock) so screenshots are stable. */
  readonly timeSec: number;
}

export interface Projector {
  /** Integer scale: one virtual pixel = pixelScale physical pixels. */
  readonly pixelScale: number;
  /** World ground position to CSS pixels relative to the canvas, for UI overlays. Writes into out. */
  worldToCss(x: number, y: number, out: { x: number; y: number }): void;
}

export interface Renderer {
  resize(physicalWidth: number, physicalHeight: number): void;
  setQuality(q: QualitySettings): void;
  setReducedEffects(on: boolean): void;
  setArena(arena: ArenaDef): void;
  render(frame: RenderFrame): void;
  readonly projector: Projector;
  dispose(): void;
}

export declare function createRenderer(canvas: HTMLCanvasElement, assets: RenderAssets): Renderer;
```

### 6.7 UI

```ts
// src/core/contracts/ui.ts
export type AppScreen = 'title' | 'classSelect' | 'run' | 'paused' | 'settings' | 'runEnd';

export interface AppActions {
  startRun(classId: string): void;   // app picks the seed
  continueRun(): void;               // load autosave
  pause(): void;
  resume(): void;
  openSettings(): void;
  applySettings(s: Settings): void;
  quitToTitle(): void;
}

export interface UiDeps {
  readonly root: HTMLElement;
  readonly strings: StringTable;
  readonly data: GameData;
  readonly commands: CommandSink;
  readonly app: AppActions;
  readonly projector: Projector;
}

export interface Ui {
  setScreen(screen: AppScreen): void;
  /** Called every frame. Shop and level-up screens are derived from view.phase. */
  update(view: WorldView, events: SimEventReader): void;
  dispose(): void;
}

export declare function createUi(deps: UiDeps): Ui;
```

### 6.8 Audio

```ts
// src/core/contracts/audio.ts
export interface VolumeSettings { readonly master: number; readonly music: number; readonly sfx: number }

export interface AudioSystem {
  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): Promise<void>;
  /** Called every frame. Maps events to cues and drives adaptive music from view (phase, pulse.ticksLeft). */
  update(view: WorldView, events: SimEventReader, dtSec: number): void;
  playUi(cueId: string): void;
  setVolumes(v: VolumeSettings): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}

export declare function createAudio(): AudioSystem;
```

### 6.9 Data dan arena

```ts
// src/content (types inferred from the schema DSL; sketch only)
export interface GameData {
  readonly meta: { readonly schemaVersion: number; readonly contentHash: string };
  readonly stats: readonly StatDef[];
  readonly tags: readonly TagDef[];
  readonly classes: readonly ClassDef[];
  readonly enemies: readonly EnemyDef[];
  readonly weapons: readonly WeaponDef[];
  readonly keepsakes: readonly KeepsakeDef[];
  readonly levelUpCards: readonly LevelUpCardDef[];
  readonly pulses: readonly PulseDef[];
  readonly shop: ShopConfig;
  readonly arenas: readonly ArenaDef[];
  /** String id to dense index, built at load. */
  readonly index: {
    enemy(id: string): EnemyTypeIndex;
    weapon(id: string): WeaponIndex;
    keepsake(id: string): KeepsakeIndex;
    // ...
  };
}

// content/levels/<id>.json, owned by LD. Units: ground pixels (1 unit = 1 sprite pixel).
export interface ArenaDef {
  readonly id: string;
  readonly width: number;                 // ground x extent, see 7.3 for limits
  readonly depth: number;                 // ground y extent
  readonly playerStart: { readonly x: number; readonly y: number };
  readonly spawnZones: readonly { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly safeRadius: number;            // no spawns within this distance of the player
  readonly obstacles: readonly { readonly shape: 'circle' | 'rect'; readonly x: number; readonly y: number; readonly r?: number; readonly w?: number; readonly h?: number }[];
  readonly decor: readonly { readonly propId: string; readonly x: number; readonly y: number; readonly z?: number }[];
  readonly lights: {
    readonly key: { readonly color: string; readonly intensity: number; readonly dir: readonly [number, number, number] };
    readonly fill: { readonly color: string; readonly intensity: number; readonly dir: readonly [number, number, number] };
    readonly points: readonly { readonly x: number; readonly y: number; readonly z: number; readonly color: string; readonly intensity: number; readonly radius: number }[];
  };
}
```

`ArenaDef.lights` dan `decor` hanya dibaca render. `spawnZones`, `obstacles`, ukuran, dan `safeRadius` dibaca sim. Angka kepadatan spawn tetap milik GD di CSV.

### 6.10 Save dan pengaturan

```ts
// src/core/contracts/save.ts
export interface RunSaveV1 {
  readonly v: 1;
  readonly contentHash: string;
  readonly seed: number;
  readonly classId: string;
  readonly pulseIndex: number;
  readonly tick: number;
  readonly rng: Readonly<Record<RngStreamName, readonly [number, number, number, number]>>;
  readonly player: { readonly hp: number; readonly level: number; readonly xp: number; readonly glint: number; readonly pendingLevelUps: number };
  /** String ids, not indices, so a save survives data reordering. */
  readonly weapons: readonly { readonly id: string; readonly tier: number }[];
  readonly keepsakes: readonly string[];
  readonly shop: { readonly offers: readonly { readonly kind: string; readonly id: string; readonly tier: number; readonly locked: boolean }[]; readonly rerollCount: number };
  readonly levelUp: { readonly choiceIds: readonly string[] };
  readonly runStats: { readonly kills: number; readonly glintEarned: number };
}
export type RunSave = RunSaveV1;

export type RngStreamName = 'spawn' | 'ai' | 'combat' | 'loot' | 'shop' | 'levelUp';

export interface Settings {
  readonly v: 1;
  readonly quality: 'low' | 'medium' | 'high';
  readonly volumes: VolumeSettings;
  readonly reduceEffects: boolean;
  readonly damageNumbers: boolean;
  readonly textScale: number;            // integer step, 0 = default
  readonly colorblindMode: 'off' | 'protan' | 'deutan' | 'tritan';
  readonly keybinds: Readonly<Record<string, readonly string[]>>;
}
```

### 6.11 Hook tes e2e (hanya mode e2e)

```ts
// src/app/e2e/hooks.ts, loaded via dynamic import only when __E2E__ is true
export interface E2eHooks {
  readonly version: 1;
  ready(): Promise<void>;
  startRun(seed: number, classId: string): void;
  /** Stop the rAF loop; from now on the test drives time. */
  pauseLoop(): void;
  step(ticks: number, input?: Partial<InputFrame>): void;
  send(cmd: Command): void;
  hash(): number;
  /** Small JSON summary: phase, pulse index, hp, glint, enemy count. */
  snapshot(): Readonly<Record<string, number | string>>;
  /** Deterministic stress scene: about 120 enemies plus 300 projectiles. */
  scenario(name: 'peak' | 'shop' | 'levelUp'): void;
  frameStats(): { readonly avgMs: number; readonly p95Ms: number; readonly maxMs: number };
}
declare global { interface Window { __shardfall?: E2eHooks } }
```

---

## 7. Render HD-2D

### 7.1 Kamera [Wajib]
- **Ortografis**, menghadap ke pusat arena, **pitch = asin(2/3) sekitar 41,81 derajat** dari horizontal, yaw 0, tidak pernah berputar.
- Konsekuensi: panjang di sumbu kedalaman lantai (sim `y`) tampil 2/3 di layar. Sumbu `x` tampil 1:1.
- Satuan dunia: **1 unit = 1 piksel sprite**. Frustum ortografis = ukuran resolusi virtual dalam unit, sehingga 1 unit di sumbu `x` = 1 piksel virtual.
- Default: kamera **tetap** di pusat arena dan seluruh arena terlihat (sesuai style guide "seluruh batas arena main selalu tajam"). Kamera mengikuti pemain dengan clamp hanya bila LD membuat arena lebih besar dari batas 7.3, dan itu perlu persetujuan LP dan CD.
- Pemetaan sim ke three.js: sim `(x, y)` di lantai menjadi three `(x, 0, y)`; tinggi (`z` di data dekorasi) menjadi three `y`.

### 7.2 Sprite billboard dan skala integer [Wajib]
- Sprite aktor adalah quad yang **tegak di titik kakinya dan menghadap kamera**: bidangnya tegak lurus arah pandang kamera (condong ke belakang sekitar 41,8 derajat dari vertikal, sama dengan pitch kamera). Hasilnya sama dengan sprite tegak yang tingginya dikoreksi, sehingga setiap piksel sprite tampil persis 1 piksel virtual. Sprite tidak pernah diputar bebas atau diskalakan non-integer.
- Karena bidang sprite tegak lurus arah pandang ortografis, seluruh quad punya kedalaman yang sama dengan titik kakinya. Urutan depan-belakang antar aktor otomatis benar berdasarkan posisi kaki.
- **Snap piksel di vertex shader**: posisi kaki diproyeksikan, dibulatkan ke piksel virtual, lalu sudut quad ditambahkan dalam piksel bulat. Sprite tetap tajam walau posisi sim pecahan dan diinterpolasi.
- Flip horizontal untuk `facing` diizinkan (cermin piksel, bukan rotasi).
- Tekstur lantai: texel di sumbu kedalaman dibuat 1,5 unit (karena 1,5 x 2/3 = 1 piksel layar), sehingga kerapatan texel lantai sama dengan kerapatan piksel sprite (style guide 1.4). Untuk permukaan vertikal dekorasi (tampil x cos 41,81 = 0,745) kerapatan tidak bisa persis; dekorasi hanya di tepi arena sehingga P3-b (toleransi 0 di area main) tetap terpenuhi. Dekorasi datar yang penting boleh dibuat sebagai billboard juga. Detail milik AD di `docs/art-pipeline.md`.

### 7.3 Resolusi virtual dan batas arena [Wajib]
- `pixelScale = max(1, min(floor(W / 640), floor(H / 360)))`, dengan `W x H` dalam **piksel fisik** (ukuran CSS x `devicePixelRatio`).
- Resolusi virtual = `floor(W / pixelScale) x floor(H / pixelScale)`. Contoh: 1920x1080 menjadi skala 3, virtual 640x360. 1366x768 menjadi skala 2, virtual 683x384. 2560x1440 menjadi skala 4, virtual 640x360. Sisa piksel di tepi diisi warna `night`.
- Ini sesuai style guide 1.4 (3x di 1080p, 2x di 720p).
- Batas teknis arena untuk LD (agar seluruh area main berada di luar pita DoF pada resolusi virtual terkecil 640x360):
  - Pita blur: 15% atas (54 piksel) dan 10% bawah (36 piksel). Wilayah tajam = 270 piksel layar.
  - Kedalaman lantai area main maksimal **360 unit** (tampil 240 piksel, menyisakan ruang untuk tinggi sprite di tepi belakang).
  - Lebar area main maksimal **576 unit** (32 piksel margin kiri dan kanan untuk HUD).
  - [Asumsi] Kalibrasi di M1 bersama CD dan LD setelah melihat build nyata.

### 7.4 Lapisan gambar (P2-f) [Wajib]

| Lapis | Isi | Depth | Catatan |
|---|---|---|---|
| L0 | Lantai, dekorasi low-poly | tulis dan uji | Opaque |
| L1 | Decal lantai: bayangan elips aktor, cincin pemain | uji, tanpa tulis | Di bawah semua aktor |
| L2 | Aktor: pemain, Unlit, Warden, boss, Glint | tulis dan uji | Diurutkan alami oleh depth kaki |
| L3 | Efek pemain: proyektil pemain, aura, percikan hit, angka damage | tanpa depth | Blending aditif atau alpha, ukuran dan opasitas dibatasi |
| L4 | Bahaya: isian dan tepi telegraf, proyektil musuh | tanpa depth | **Digambar sesudah post-processing**, selalu di atas L3 |

L0 sampai L3 masuk ke render target scene, lalu bloom, tilt-shift, vignette, dan grading. L4 digambar di atas hasil itu, jadi bloom efek pemain tidak pernah menutupi inti proyektil musuh dan telegraf tidak pernah kabur. Kilau bahaya yang diinginkan dibuat di sprite atau shader L4 sendiri.

### 7.5 Pipeline post-processing (ditulis sendiri)

Semua pass berjalan pada resolusi virtual (atau setengahnya untuk bloom), lalu satu pass upscale nearest ke canvas.

1. **Scene pass**: L0 sampai L3 ke `sceneRT` (HalfFloat, resolusi virtual). Piksel emisif (palet bertanda emisif, efek pemain, Glint, lentera) ditulis dengan nilai di atas 1.0.
2. **Bloom**: ambang tinggi (hanya nilai di atas 1.0), downsample ke 1/2 dan 1/4, blur Gaussian terpisah, upsample. Kualitas sedang: hanya 1/2.
3. **Tilt-shift dan komposit** (2 pass): blur horizontal lalu vertikal dengan radius yang bergantung pada `y` layar (nol di wilayah tengah, naik halus di pita 15% atas dan 10% bawah); pass kedua juga menambahkan bloom, vignette, grading per bioma, dan kilau kaca tepi. Hasil ke `postRT`.
4. **Danger pass**: L4 langsung ke `postRT`.
5. **Upscale**: `postRT` ke canvas dengan skala integer dan filter nearest.

Shader post-processing ditulis AD (LP review); struktur pass, render target, dan urutan milik LP.

### 7.6 Sprite, atlas, dan cahaya
- Semua aktor dalam satu atlas digambar dengan **satu `InstancedMesh` per lapis** (L2 aktor, L3 efek pemain, L4 bahaya, L1 decal). Atribut per instance: posisi kaki, rect UV, flip, flash, faktor terang minimum. Target draw call per frame: 60 atau kurang.
- Cahaya sprite dihitung di vertex shader per instance pada posisi kaki: ambient plus cahaya kunci plus cahaya isi plus titik cahaya (maksimal 8 di kualitas tinggi). Aktor Kept dijepit minimal 70% terang warna dasarnya (style guide 1.6); Unlit tidak.
- Lingkungan memakai material three.js standar ringan (`MeshLambertMaterial`) atau shader AD, dengan jumlah titik cahaya tetap per kualitas agar shader tidak dikompilasi ulang saat main.
- Bayangan aktor: decal elips instanced (L1). Shadow map hanya untuk dekorasi dan hanya di kualitas tinggi.
- [Saran untuk M2] Atlas berindeks palet: tekstur R8 berisi indeks palet plus tekstur LUT palet (256x1) dengan flag emisif per entri. Murah untuk kilat putih, varian palet bioma, dan mode buta warna. M1 boleh memakai atlas RGBA biasa.

### 7.7 Pengaturan kualitas grafis

| Fitur | Rendah | Sedang (default) | Tinggi |
|---|---|---|---|
| Tilt-shift DoF | mati | hidup | hidup |
| Bloom | mati | 1 level (1/2 res) | 2 level (1/2 dan 1/4) |
| Kilau kaca tepi | mati | hidup | hidup |
| Vignette dan grading | hidup | hidup | hidup |
| Titik cahaya dinamis | 4 | 8 | 8 |
| Shadow map dekorasi | mati | mati | hidup |
| Batas partikel suasana dan VFX | 300 | 600 | 1000 |

- Rendah tidak mengubah kode warna, lapisan, atau keterbacaan (P3-f).
- "Kurangi efek" (aksesibilitas) terpisah dari kualitas: mengurangi getar layar, kilat, dan partikel, di semua tingkat kualitas.
- [Asumsi] Saran turun ke Rendah ditampilkan (tidak dipaksa) bila p95 frame time di atas 20 ms selama 5 detik pertama Pulse. Bisa ditunda ke M4.

---

## 8. Pooling entitas, struktur data musuh, dan tabrakan

### 8.1 Pool SoA berkapasitas tetap [Wajib]
- Setiap jenis entitas punya pool sendiri dengan kolom typed array (`Float64Array` untuk posisi dan kecepatan, `Int32Array` untuk penghitung, `Uint8Array` untuk flag). Dialokasikan sekali saat `createSim`.
- Slot stabil: slot tidak bergeser selama entitas hidup. Slot bebas disimpan di stack free list (LIFO, deterministik). `highWater` = slot tertinggi yang pernah dipakai plus 1; iterasi `0..highWater-1` dengan cek `alive`.
- `serial[slot]` naik setiap slot dipakai ulang, agar render tahu animasi harus di-reset.
- Kapasitas awal (konstanta teknis di `src/sim/capacity.ts`, bukan balance):

| Pool | Target puncak (anggaran performa) | Kapasitas |
|---|---|---|
| Musuh | 120 | 256 |
| Proyektil musuh | 150 | 512 |
| Proyektil pemain | 150 | 512 |
| Pickup (Glint) | 200 | 512 |
| Area (telegraf, aura) | 30 | 64 |

- Bila pool penuh: musuh dan proyektil baru tidak di-spawn dan penghitung debug naik (harus nol di data normal; QA memantau). Pickup Glint baru **digabung** ke Glint terdekat agar nilai tidak hilang. [Asumsi] GD mengonfirmasi perilaku penggabungan ini.
- Tidak ada objek per entitas, tidak ada closure per entitas, tidak ada `new` di dalam tick.

### 8.2 Kolom musuh (sketsa, GP menyesuaikan)
`alive, serial, typeIndex, x, y, prevX, prevY, vx, vy, radius, hp, maxHp, aiState, aiStateTicks, aiTimer, targetX, targetY, facing, hitFlashTicks, knockbackX, knockbackY, statusMask, statusTicks (beberapa kolom), rank`.
Data per jenis (kecepatan, HP dasar, damage, jarak serang) dibaca dari `GameData.enemies[typeIndex]`, tidak disalin ke tiap slot kecuali nilai yang bisa berubah per individu (misalnya HP setelah skala Pulse).

### 8.3 Spatial hash
- Grid seragam di atas batas arena, ukuran sel **32 unit** [Asumsi, dikalibrasi M1; sekitar 2 kali radius musuh umum].
- Dibangun ulang tiap tick dengan counting sort: `cellCount` (Int32Array), `cellStart` (prefix sum), `cellItems` (Int32Array berkapasitas pool). Urutan item dalam sel = urutan slot naik, jadi deterministik.
- Entitas di luar batas dijepit ke sel tepi.
- Query lingkaran menulis hasil ke array scratch yang sudah dialokasikan dan mengembalikan jumlah. Tidak ada callback per query di hot loop.
- Pemakaian:
  - Proyektil pemain vs musuh: query grid musuh.
  - Pemisahan antar musuh (dorongan lembut): query grid musuh, maksimal 8 tetangga diperiksa per musuh agar biaya terbatas.
  - Pencarian target terdekat untuk serangan otomatis: query grid musuh dengan radius bertambah.
  - Proyektil musuh dan sentuhan musuh vs pemain: loop linear (hanya 1 pemain), cukup murah.
- Bentuk tabrakan hanya lingkaran (dan rintangan arena lingkaran atau persegi). Pierce proyektil memakai daftar kecil serial musuh yang sudah kena (ukuran tetap, maksimal 8) agar tidak kena dua kali.

### 8.4 Hash state
`state-hash.ts` (GP, LP review) menghitung FNV-1a 32 bit atas semua kolom pool sampai `highWater`, state pemain, fase, state toko, dan state semua aliran RNG. Float di-hash lewat view `Uint32Array` atas `Float64Array` bersama. Hanya dipakai di tes dan debug, bukan tiap tick produksi.

---

## 9. Alur data: CSV ke JSON

### 9.1 Alur
```
content/data/*.csv  (GD)      \
content/levels/*.json (LD)     >--  tools/data/build-data.ts  -->  content/generated/game-data.json
content/strings/en.json (WR)  /     (parse, validasi skema,         content/generated/strings.json
                                     cek referensi, hitung hash)
                                                 |
                       src/app/boot.ts  import JSON (Vite)  -->  src/content buildGameData()  -->  sim, render, ui, audio
```

### 9.2 Dialek CSV [Wajib] (LP menetapkan format; GD menetapkan kolom dan arti di `docs/systems/data-schema.md`)
- UTF-8 tanpa BOM, pemisah koma, baris pertama header `snake_case`.
- Desimal memakai titik. Tidak ada pemisah ribuan.
- Baris yang diawali `#` adalah komentar. Baris kosong diabaikan.
- Daftar dalam satu sel dipisah `|` (contoh `Flame|Edge`).
- Kolom `id` wajib, `snake_case`, unik per tabel. Referensi ke tabel lain memakai id.
- Persentase ditulis sebagai pecahan (`0.15`), kecuali skema menyatakan lain.
- Besaran waktu ditulis dalam **detik** dan kecepatan dalam **unit per detik** di CSV (lebih mudah dibaca GD). Build mengubahnya ke tick dan unit per tick. Nama kolom memakai akhiran satuan: `_sec`, `_per_sec`, `_px`.
- Tanda kutip ganda hanya untuk sel yang mengandung koma (RFC 4180).
- Bila `data-schema.md` dari GD berbeda dengan butir di atas, GD dan LP menyelaraskan; LP memutuskan format teknis, GD memutuskan isi.

### 9.3 Skema dan validasi
- Skema ditulis sebagai DSL kecil di `src/content/schema/` (contoh: `col.id()`, `col.int({ min: 0 })`, `col.float({ min: 0, max: 1 })`, `col.enum([...])`, `col.ref('enemies')`, `col.list(col.ref('tags'))`, `col.optional(...)`). Tipe TypeScript `EnemyDef` dan lainnya diturunkan otomatis dari skema, jadi tipe dan validasi tidak bisa berbeda. Tanpa dependensi (tidak memakai zod).
- Validasi: tipe, rentang, enum, keunikan id, referensi antar tabel, kolom wajib, kolom tidak dikenal (error, bukan diam-diam diabaikan).
- Error dilaporkan sebagai `file:baris:kolom pesan` dan menggagalkan build.
- `check-strings.ts` memeriksa string table: semua kunci yang dirujuk data ada, dan batas P4-b (nama maksimal 3 kata dan 18 karakter, efek maksimal 2 baris dan sekitar 40 karakter per baris, flavor maksimal 70 karakter). Ini mengotomasi uji pilar P4-b.
- `contentHash` = FNV-1a dari JSON kanonik, disimpan di JSON, save, dan replay.

### 9.4 Konversi saat load
- `buildGameData(raw)` di `src/content` membangun indeks id ke index padat, mengubah detik ke tick (`Math.round(sec * 60)`) dan unit per detik ke unit per tick, lalu membekukan objek (`Object.freeze` di dev).
- Sim tidak pernah meng-import JSON. App meng-import JSON dan menyuntikkan `GameData` ke `createSim`. Tes memakai data fixture kecil buatan tangan; tool balance GD membaca JSON lewat `fs`.

### 9.5 Commit dan dev
- `content/generated/` **di-commit** agar diff data terlihat saat review dan build tidak bergantung pada urutan skrip. `npm run data:check` di CI gagal bila hasil build berbeda dari yang di-commit.
- Saat `npm run dev`, plugin Vite kecil (inline di `vite.config.ts`) menjalankan ulang build data saat CSV, level, atau string berubah, lalu memuat ulang halaman. GD bisa mengubah angka dan langsung melihat hasilnya.

---

## 10. Pixel art prosedural

- Palet: `art/palette.json` berisi token dari style guide 1.2 (nama token ke hex, plus flag emisif). Ini satu-satunya sumber warna sprite.
- Definisi sprite: `art/sprites/<id>.json` (milik AD). Format teknis minimum:

```ts
export interface SpriteSheetDef {
  readonly id: string;
  /** Used by the palette audit (P2-d): kept may not use danger tokens, unlit may not use blue, cyan, or gold. */
  readonly faction: 'kept' | 'unlit' | 'neutral' | 'env';
  readonly frameW: number;
  readonly frameH: number;
  /** Feet position inside the frame, in pixels. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Single character to palette token. '.' is transparent. */
  readonly legend: Readonly<Record<string, string>>;
  readonly outline?: 'ink' | 'none';   // auto 1 px ink outline, plus unlit-rim for unlit
  readonly animations: Readonly<Record<string, {
    readonly frames: readonly (readonly string[])[];  // each frame = rows of legend characters
    readonly ticksPerFrame: number;
    readonly loop: boolean;
  }>>;
}
```

- AD boleh memperkaya format (misalnya layer, mirror otomatis, generator skrip) di `docs/art-pipeline.md` selama keluaran rasterizer tetap sama.
- Rasterizer `src/render/sprites/rasterize.ts` adalah fungsi murni: `SpriteSheetDef + palette` menjadi `{ width, height, rgba: Uint8Array }` per frame. Tanpa DOM.
- Saat boot, semua sprite dirasterisasi dan dipak ke satu atlas (packer shelf sederhana, urutan deterministik berdasarkan id), diunggah sebagai `DataTexture` dengan filter nearest dan tanpa mipmap. Perkiraan: kurang dari 20 ms untuk beberapa ratus bingkai.
- `tools/art/preview-sprites.ts` memakai rasterizer yang sama dan encoder PNG kecil (`zlib` bawaan Node) untuk membuat lembar preview di `art/atlas/preview/` bagi review CD. `tools/art/audit-palette.ts` menjalankan uji P2-d dan aturan 15% sorotan pemain secara otomatis.
- Animasi sprite memakai jam render yang diturunkan dari tick sim, sehingga screenshot e2e stabil.

---

## 11. Audio sintesis runtime

- `AudioContext` dibuat dan di-`resume` pada gesture pertama pengguna (layar judul menyediakannya).
- Graf bus: `master -> { music, sfx, ui }` dengan `GainNode`; ducking singkat semua bus lain saat `PlayerHit` (style guide 3.2).
- Rincian engine mengikuti `docs/audio-direction.md` bagian 2.3 dan 2.4 (AU) dan disetujui LP:
  - **SFX**: resep dirender sekali saat boot ke `AudioBuffer` lewat `OfflineAudioContext`, lalu diputar dengan `AudioBufferSourceNode` (variasi pitch lewat `playbackRate`). SFX yang durasinya bergantung pada sim (telegraf, sumbu peledak) disintesis langsung. Batas 4 instans per cue, jeda minimum 40 ms per cue (style guide 3.3). Keacakan audio memakai instance `Rng` milik audio, bukan RNG sim.
  - **Karplus-Strong** dan gelombang lain yang tidak bisa dibuat dengan node dihitung di JavaScript sebagai `Float32Array` saat boot (fungsi murni di `src/audio/synth/`).
  - **Musik**: sequencer membaca data lagu (JSON di `audio/music/`, di-import Vite), menjadwalkan not pada `AudioContext.currentTime` dengan lookahead 100 ms dan timer sekitar 25 ms. Lapis intensitas dan riser dikendalikan dari `view.phase` dan `view.pulse.ticksLeft`.
  - Preview WAV untuk review CD dibuat lewat browser (skrip Playwright di `tools/audio/`), karena `OfflineAudioContext` tidak ada di Node.
- Kepemilikan: AU menulis seluruh `src/audio/` (engine dan resep) di dalam kontrak `AudioSystem` (bagian 6.8). LP memiliki kontrak dan mereview struktur engine.
- Pemetaan event ke cue ada di `src/audio/event-map.ts`, merujuk id di `docs/audio-list.md` (milik AU).
- Anggaran: inisialisasi audio (render semua SFX) di bawah 300 ms di laptop menengah, dikerjakan bertahap agar tidak membekukan layar judul. CPU audio saat Pulse di bawah 1 ms per frame di thread utama (sebagian besar kerja ada di thread audio browser).
- Ukuran file audio di bundle: nol.

---

## 12. Autosave, meta, dan pengaturan

| Kunci localStorage | Isi | Kapan ditulis |
|---|---|---|
| `shardfall.run.v1` | Envelope `{ app, v, savedAt, run: RunSave }` | Saat fase berubah ke `shop` (setelah level-up selesai dipilih bila level-up muncul sebelum toko, sesuai GDD), dan setelah setiap command toko. Dihapus saat run berakhir |
| `shardfall.meta.v1` | Silt, kelas dan Keepsake yang terbuka, statistik | Saat run berakhir |
| `shardfall.settings.v1` | `Settings` | Saat pengaturan diterapkan |

- Simpan setelah setiap command toko (beli, reroll, kunci) mencegah save-scum reroll: memuat ulang tidak mengembalikan Glint atau penawaran lama.
- Tidak ada save di tengah Pulse. Menutup tab di tengah Pulse berarti melanjutkan dari toko terakhir. [Asumsi] Producer dan GD menerima perilaku ini; alternatifnya adalah run hilang.
- `savedAt` ditulis oleh app (boleh memakai `Date`), bukan oleh sim.
- **Versi dan migrasi**: `v` pada envelope dan pada `RunSave`. `src/app/save/migrations.ts` berisi fungsi `vN -> vN+1`. Save yang tidak bisa dimigrasi atau merujuk id yang sudah tidak ada dibuang dengan pesan singkat di UI, tidak membuat game crash.
- Save menyimpan **id string**, bukan index, agar perubahan urutan data tidak merusak save. `contentHash` berbeda tidak otomatis membuang save; yang menentukan adalah apakah semua id masih ada.
- `storage.ts` membungkus semua akses dalam try/catch (mode privat, kuota penuh) dengan fallback memori, dan tidak pernah melempar error ke game.

---

## 13. Anggaran performa

Mesin acuan "laptop kelas menengah" [Asumsi]: CPU 4 core generasi 2020 ke atas, GPU terintegrasi kelas Intel Iris Xe atau AMD Radeon Vega 7, layar 1920x1080, Chrome terbaru.

| Ukuran | Anggaran | Cara ukur |
|---|---|---|
| Frame rate | 60 fps stabil di skenario puncak (120 musuh, 300 proyektil, partikel penuh) pada kualitas Sedang; kualitas Rendah 60 fps di GPU kelas Intel UHD 620 | Debug overlay (F3 di dev dan e2e), skenario `peak` |
| Frame time p95 | 16,7 ms atau kurang; tidak ada frame di atas 33 ms selama 60 detik puncak | `frameStats()` hook e2e, pengukuran manual di mesin acuan |
| Sim per tick (puncak) | 2 ms atau kurang di Node pada mesin dev; 4 ms di mesin acuan | Benchmark Vitest `tests/bench/sim-peak.bench.ts` |
| CPU render per frame | 4 ms atau kurang | Debug overlay |
| GPU per frame | 8 ms atau kurang (Sedang) | Profil manual DevTools |
| Draw call | 60 atau kurang | `renderer.info` di overlay |
| Segitiga | 100 ribu atau kurang | `renderer.info` |
| Alokasi | Nol alokasi di hot loop sim dan render; tidak ada GC mayor terlihat selama 60 detik puncak | DevTools Performance, review kode |
| Heap JS | Stabil (tidak naik terus) dan di bawah 150 MB | DevTools Memory |
| Boot sampai layar judul | 2 detik atau kurang di koneksi 10 Mbps | Playwright dengan throttling, M4 |

### Ukuran bundle (gzip)
| Bagian | Target | Batas gagal CI |
|---|---|---|
| JavaScript awal (termasuk three.js) | 300 KB | 400 KB |
| JSON data dan string | 40 KB | 80 KB |
| Total transfer halaman pertama | 400 KB | 600 KB |

- `tools/bundle/check-bundle.ts` mengukur ukuran gzip setiap file di `dist/` (zlib bawaan Node) dan gagal bila melewati batas.
- three.js di-import dengan named import (`import { WebGLRenderer } from 'three'`) agar tree-shaking maksimal. Import dari `three/examples/jsm` hanya per file yang benar-benar dipakai.

---

## 14. Strategi tes

| Lapis | Alat | Lokasi | Pemilik | Isi |
|---|---|---|---|---|
| Unit | Vitest (lingkungan Node) | `tests/unit/<modul>/` | Pemilik modul | Sistem sim, RNG, spatial hash, math, parser CSV, skema, rasterizer, presenter UI, DSP audio, migrasi save |
| Determinisme | Vitest | `tests/determinism/` | LP + GP | Lihat di bawah |
| Kontrak data | Vitest | `tests/unit/content/` | LP | Data asli lolos validasi, semua referensi ada, string lolos P4-b |
| Benchmark | Vitest bench | `tests/bench/` | LP + GP | Tick sim puncak |
| End-to-end | Playwright | `tests/e2e/` | QA | Alur run, screenshot, autosave dan lanjut, pengaturan, performa |

### 14.1 Tes determinisme [Wajib sejak M1]
1. **Ulang identik**: seed dan skrip input sama dijalankan dua kali dalam proses yang sama; hash state dibandingkan setiap 60 tick sampai 10 Pulse. Harus sama persis.
2. **Save lalu load**: run A berjalan terus; run B disimpan di toko Pulse 3, dibuat sim baru, di-load, lalu dilanjutkan dengan input yang sama. Hash akhir A dan B harus sama.
3. **Isolasi aliran RNG**: menambah reroll toko tidak mengubah hash posisi spawn Pulse berikutnya (dibandingkan pada subset state spawn).
4. **Seed berbeda**: dua seed berbeda menghasilkan hash berbeda (cek kewarasan).
5. **Bot headless**: bot deterministik (`tests/support/bot.ts`, RNG sendiri) memainkan 10 Pulse dengan data asli tanpa exception dan tanpa overflow pool.

Tidak ada "golden hash" yang disimpan, karena hash akan berubah setiap kali GD mengubah data. Yang diuji adalah kesamaan antar jalan, bukan nilai tetap.

### 14.2 Aturan tes yang terkait balance
- Unit test sim memakai **data fixture kecil** di `tests/fixtures/data/`, bukan data asli, agar perubahan balance tidak merusak tes logika.
- Tes yang memakai data asli hanya memeriksa validitas, determinisme, dan invarian (misalnya "Pulse selesai saat waktu habis"), bukan angka.
- Angka balance tidak pernah diubah agar tes lulus (agent-rules aturan 8).

### 14.3 E2E dan hook tes yang tidak masuk bundle produksi [Wajib]
- `vite.config.ts` mendefinisikan `__E2E__` sebagai `true` hanya saat `vite build --mode e2e`, dan `false` di mode lain.
- `src/app/boot.ts`: `if (__E2E__) { const m = await import('./e2e/hooks.ts'); m.install(...) }`. Di build produksi blok ini dihapus total oleh minifier, termasuk chunk hooks.
- Playwright menjalankan build e2e lewat `vite preview` (bukan dev server), port tetap, server dimatikan setelah tes.
- `check-bundle.ts` menggagalkan CI bila build produksi mengandung string penanda `__shardfall` atau file chunk `hooks`.
- Screenshot stabil: loop dihentikan (`pauseLoop`), waktu digerakkan dengan `step`, RNG visual di-seed tetap, jam render dari tick, animasi CSS dimatikan lewat emulasi `prefers-reduced-motion`.
- Browser: Chromium sejak M1; Firefox dan WebKit ditambahkan di M4 (sesuai kriteria keluar M4).

---

## 15. Build, skrip, CI, dan deploy

### 15.1 Skrip npm (dibuat LP di M1)

| Skrip | Isi |
|---|---|
| `npm run dev` | Vite dev server (dengan plugin data watch) |
| `npm run build` | Build data, lalu `vite build` produksi (base `/shardfall/`) |
| `npm run build:e2e` | `vite build --mode e2e` ke `dist-e2e/` |
| `npm run preview` | `vite preview` |
| `npm run data` | `node tools/data/build-data.ts` |
| `npm run data:check` | Build data ke memori dan bandingkan dengan `content/generated/` |
| `npm run typecheck` | `tsc -p tsconfig.json` + `tsc -p tsconfig.sim.json` + `tsc -p tsconfig.tools.json` |
| `npm run lint` | ESLint seluruh repo |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest run (unit, kontrak data, determinisme) |
| `npm run test:e2e` | Build e2e lalu Playwright |
| `npm run bench` | Vitest bench |
| `npm run bundle:check` | Ukuran gzip dan string terlarang di `dist/` |
| `npm run art:preview` / `art:audit` | Tool AD |
| `npm run check` | `data:check`, `format:check`, `typecheck`, `lint`, `test`, `build`, `bundle:check` berurutan. Wajib hijau sebelum menyerahkan pekerjaan |

### 15.2 CI (GitHub Actions, dibuat LP di M1, Producer meng-commit)
- `ci.yml` pada `pull_request` dan `push` ke `main`: `npm ci`, `npm run check`, `npm run test:e2e` (Chromium). `concurrency` per branch dengan `cancel-in-progress`, `timeout-minutes` sekitar 15. Runner GitHub-hosted (pekerjaan singkat).
- `deploy.yml` pada `push` ke `main` setelah CI hijau: build produksi, `actions/upload-pages-artifact`, `actions/deploy-pages`.

### 15.3 GitHub Pages
- `vite.config.ts`: `base: '/shardfall/'` untuk build produksi, `'/'` untuk dev.
- Kode tidak memakai path absolut. Aset yang di-import Vite otomatis mendapat base path; bila perlu URL manual, pakai `import.meta.env.BASE_URL` (hanya di `src/app`).
- Satu halaman tanpa router, sehingga tidak perlu fallback 404.
- Pages diaktifkan dengan sumber "GitHub Actions" di pengaturan repo (langkah Producer).

---

## 16. Rencana kerja paralel M1 (usulan untuk Producer)

1. **LP lebih dulu (blok pembuka)**: kerangka Vite dan TypeScript, konfigurasi lint dan format, `src/core` lengkap (kontrak bagian 6, rng, hash, math, event buffer), `src/content` (DSL skema, parser CSV, build data) dengan skema awal dari `data-schema.md`, loop app, `WorldView` palsu di `tests/fixtures/fake-world.ts`, skrip `check`, CI. Kontrak dibekukan untuk M1 setelah blok ini.
2. **Lalu paralel tanpa tabrakan**:
   - GP: `src/sim/**`, `tests/unit/sim/`, `tests/determinism/` (bersama LP).
   - UI: `src/ui/**`, dikembangkan dengan `WorldView` palsu.
   - AD: `art/palette.json`, `art/sprites/**`, `src/render/shaders/`, `src/render/env/`, `src/render/vfx/`, `tools/art/`.
   - LP: `src/render/pipeline/`, `camera.ts`, `sprites/` (bersama AD), integrasi `src/app`.
   - AU: `src/audio/**`, `tools/audio/`.
   - GD: `content/data/*.csv`, `tools/balance/`.
   - LD: `content/levels/*.json` sesuai `ArenaDef`.
   - WR: `content/strings/en.json`.
3. Integrasi di `src/app/boot.ts` hanya oleh LP. Permintaan perubahan kontrak dikumpulkan dan diputuskan LP sekali per putaran.

---

## 17. Risiko teknis dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kontrak berubah di tengah M1 | Agen saling menunggu atau menimpa | Kontrak dibekukan setelah blok pembuka LP; perubahan dikumpulkan |
| Pita DoF terlalu sempit atau terlalu lebar setelah dilihat | Rasa HD-2D kurang atau area main kabur | Parameter pita di konfigurasi render, dikalibrasi CD di M1 dan M2 |
| Gerak vertikal tampak lebih lambat (proyeksi 2/3) | Rasa gerak tidak simetris | Dikaji CD dan GD di M1; bila perlu, kompensasi dilakukan di data kecepatan atau di pemetaan sumbu, keputusan LP |
| GPU terintegrasi lemah | Di bawah 60 fps | Resolusi virtual rendah, kualitas Rendah, batas titik cahaya dan partikel |
| Determinisme lintas browser | Replay beda antar browser | Aturan math 4.2; save tidak bergantung pada replay |
| Ukuran three.js | Bundle melewati target | Named import, cek bundle di CI, analisis chunk saat melewati target |

---

## 18. Pertanyaan terbuka untuk peran lain

- GD: konfirmasi perilaku Glint saat pool pickup penuh (digabung ke Glint terdekat), urutan level-up dan toko, merge manual atau otomatis (memengaruhi daftar `Command`).
- GD dan CD: apakah kecepatan gerak vertikal perlu kompensasi visual karena proyeksi 2/3.
- LD dan CD: batas arena 576 x 360 unit dengan kamera tetap; apakah cukup luas.
- Producer: menutup tab di tengah Pulse melanjutkan dari toko terakhir; apakah diterima.
- AD: setuju atlas berindeks palet untuk M2, dan format `SpriteSheetDef` minimum di bagian 10.
