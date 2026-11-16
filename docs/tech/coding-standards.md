# Shardfall: Standar Kode

Pemilik: Lead Programmer (LP). Status: versi 2, 2026-11-16, diselaraskan dengan `architecture.md` versi 2 (review M0-11b). Berlaku untuk M1.
Berlaku untuk semua kode di `src/`, `tools/`, `tests/`. Dasar: `docs/tech/architecture.md`.

Penanda: **[Wajib]** pelanggaran berarti review PERLU PERBAIKAN. **[Saran]** boleh menyimpang dengan alasan di komentar atau laporan.
Sebagian besar aturan [Wajib] dipaksa otomatis oleh TypeScript, ESLint, atau skrip cek (ditandai **(otomatis)**). Konfigurasinya dibuat LP di M1.

---

## 1. Bahasa dan konfigurasi TypeScript

### 1.1 tsconfig [Wajib] (otomatis)
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],   // tsconfig.sim.json: ["ES2023"] only, no DOM
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

Tiga file di atas `tsconfig.base.json` (opsi bersama): `tsconfig.json` (src, tests, file konfigurasi; `art/**/*.ts` menyusul setelah AD memakai `src/core/math`, M1-05), `tsconfig.sim.json` (`src/sim`, `src/core`, `src/content` tanpa DOM), `tsconfig.tools.json` (`tools/`, `art/**/*.ts`, lingkungan Node dengan `@types/node`). Semua tool ditulis `.ts`; tool `.mjs` yang ada dipindah ke `.ts` di M1.

### 1.2 Akibat `erasableSyntaxOnly` (agar tool jalan langsung di Node 24) [Wajib] (otomatis)
- Tidak ada `enum` dan `const enum`. Pakai objek `as const` plus tipe turunan:
  ```ts
  export const AiState = { Idle: 0, Move: 1, Windup: 2, Attack: 3 } as const;
  export type AiState = (typeof AiState)[keyof typeof AiState];
  ```
- Tidak ada `namespace`, tidak ada parameter properties di constructor (`constructor(private x: number)`).
- Import relatif selalu dengan ekstensi `.ts`: `import { createRng } from '../core/rng.ts';`
- Import tipe memakai `import type` (dipaksa `verbatimModuleSyntax`).

### 1.3 Tipe
- Dilarang `any` (otomatis). Pakai `unknown` lalu persempit.
- `as` (type assertion) hanya di batas sistem (parsing data, JSON, DOM query) dengan komentar alasan. Di hot loop, non-null assertion `arr[i]!` pada typed array **diizinkan** bila index sudah dijamin oleh batas loop; ini satu-satunya pengecualian yang umum.
- Tipe publik modul ditulis eksplisit (parameter dan nilai balik fungsi yang di-export).
- State yang tidak boleh diubah konsumen diekspos sebagai `readonly` atau `ArrayLike<number>`.
- Id dari data memakai branded type (`EnemyTypeIndex`), bukan `number` telanjang, di API publik.

---

## 2. Konvensi penamaan [Wajib]

| Hal | Gaya | Contoh |
|---|---|---|
| File dan folder | `kebab-case` | `spatial-hash.ts`, `shop-screen.ts` |
| File tes | `<nama>.test.ts`, benchmark `<nama>.bench.ts` | `spatial-hash.test.ts` |
| Tipe, interface, kelas | `PascalCase`, tanpa awalan `I` | `WorldView`, `EnemyPool` |
| Fungsi, variabel, properti | `camelCase` | `createSim`, `riteCooldownTicks` |
| Konstanta teknis tingkat modul | `UPPER_SNAKE_CASE` | `TICK_RATE`, `MAX_ENEMIES` |
| Objek konstanta pengganti enum | `PascalCase`, anggota `PascalCase` | `AiState.Windup` |
| Event sim | `PascalCase` bentuk lampau, selaras `docs/audio-list.md` | `SimEventType.EnemyKilled`, `PulseStarted` |
| Boolean | awalan `is`, `has`, `can`, `should` | `isWarden`, `hasTarget` |
| Factory | awalan `create` | `createRenderer`, `createRng` |
| Id data (CSV, JSON arena, string table) | `snake_case`, id kerja GD tanpa awalan wajib. Termasuk tag dan id arena | `swarmer`, `coal_locket`, `flame`, `night_market` |
| Id aset art (sprite, tile, mesh dekorasi, token palet) | `kebab-case` dengan awalan grup AD; tidak dirujuk dari CSV | `unlit-swarmer`, `tile-floor`, `floor-mid` |
| Kunci string table | titik sebagai pemisah, `snake_case` | `shop.reroll`, `keepsake.ember_ring.name` |
| Kolom CSV | `snake_case`; satuan ditentukan skema per kolom (`architecture.md` 9.2), akhiran `_s` dianjurkan untuk waktu bila nama tidak jelas | `cooldown`, `speed`, `telegraph_s`, `content_tier` |
| Variabel GLSL | uniform `u`, attribute `a`, varying `v` | `uTime`, `aUvRect`, `vColor` |

**Akhiran satuan** wajib pada identifier kode bila nilai punya satuan: `Ticks`, `Sec`, `Ms`, `U` (unit dunia, 1 u = 16 px), `Px` (piksel virtual layar), `PerTick`, `PerSec`. Contoh: `windupTicks`, `speedUPerTick`, `rangeU`, `offsetPx`. Sudut di sim disimpan dalam putaran (`...Turns`); di render boleh radian; nilai derajat bernama `...Deg`.

Istilah game di identifier mengikuti `docs/vision.md` bagian 5: `pulse` (boleh `wave` di kode internal), `glint`, `keepsake`, `warden`, `rite`, `glazier` atau `shop`, `unlit` atau `enemy`, `kept` atau `player`.

---

## 3. Aturan modul [Wajib]

1. **Arah import** mengikuti tabel di `architecture.md` bagian 5 (otomatis, ESLint `no-restricted-imports` per folder). Ringkas: `core` tidak meng-import apa pun; `sim` hanya `core` dan `content`; `render`, `ui`, `audio` tidak saling import dan tidak meng-import `sim`; hanya `app` yang merakit semuanya.
2. **API publik lewat `index.ts`**: modul lain hanya boleh meng-import `src/<modul>/index.ts` (otomatis). Isi folder lain dianggap privat.
3. **Kontrak di `src/core/contracts/` milik LP.** Butuh field atau command baru: tulis usulan di laporan; jangan mengubah kontrak sendiri.
4. **Named export saja**, tanpa `export default` (otomatis). Kecuali file konfigurasi yang mewajibkan default (`vite.config.ts`, `eslint.config.js`, `playwright.config.ts`).
5. **Tanpa state global yang bisa diubah** di luar `src/app`. Modul meng-export factory (`createX(deps)`) yang menerima dependensi lewat parameter. Ini membuat tes mudah dan mencegah ketergantungan tersembunyi.
6. **Tanpa efek samping saat import**: file tidak boleh menjalankan kerja (membuat AudioContext, menyentuh DOM, membaca localStorage) di level atas modul. Tabel konstanta murni (misalnya tabel trig) boleh.
7. **Satu tanggung jawab per file**, idealnya di bawah sekitar 400 baris. File sistem sim mengikuti pola `systems/<nama>.ts` dengan satu fungsi `update<Nama>(world, ...)`.
8. **Tanpa siklus import** (otomatis bila memungkinkan; aturan `import/no-cycle` butuh plugin ESLint tambahan, jadi LP memutuskan di M1 apakah memakai plugin itu atau skrip cek kecil di `tools/`).

---

## 4. Larangan [Wajib]

### 4.1 Angka balance di kode
- **Tidak ada angka balance hardcode** di mana pun. Angka balance adalah apa pun yang mungkin ingin diubah GD: HP, damage, kecepatan, harga, durasi, cooldown, jumlah spawn, peluang, radius serangan, skala kesulitan, XP, hadiah. Semuanya dari `GameData`.
- Literal yang **boleh**: `0`, `1`, `-1`, `2` untuk matematika dasar, `0.5` untuk setengah, index array, dan konstanta teknis yang diberi nama di file konstanta modul (`src/core/constants.ts`, `src/sim/capacity.ts`, konfigurasi render) dengan komentar.
- Konstanta visual (warna, ukuran pita DoF, kekuatan bloom) bukan balance, tetapi tetap diberi nama di konfigurasi render atau `art/palette.json`, tidak tersebar sebagai literal.
- Reviewer: setiap literal numerik di `src/sim` selain yang diizinkan di atas adalah temuan MAYOR.
- Tes tidak boleh menyalin angka dari data asli sebagai harapan; baca dari data atau pakai fixture (lihat 6.3).

### 4.2 Determinisme sim (otomatis, ESLint pada `src/sim/**` dan tsconfig tanpa DOM)
- Tidak ada `Math.random` (dilarang di **seluruh** `src/` dan `art/`; pakai `createRng` dari `src/core/rng.ts`). Generator sprite di `art/` juga memakai `src/core/math` untuk trig agar piksel identik lintas browser.
- Di `src/sim`: tidak ada `Date`, `performance`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `crypto`, `import.meta.env`, DOM, `three`.
- Di `src/sim`: tidak ada `Math.sin`, `Math.cos`, `Math.tan`, `Math.atan2`, `Math.exp`, `Math.log`, `Math.pow`, `Math.hypot`, `Math.cbrt`, dan `**` dengan pangkat bukan bilangan bulat. Pakai `src/core/math`.
- Tidak ada iterasi `for...in`. Tidak ada iterasi `Set` atau `Map` yang urutan sisipnya bergantung pada hal non-deterministik.
- `Array.prototype.sort` wajib dengan pembanding total (seri dipecah dengan slot atau id).
- Keacakan visual dan audio tidak memakai RNG sim.

### 4.3 Umum (otomatis bila bisa)
- Tidak ada `console.log` di `src/` yang ter-commit. Pakai logger di `src/app` (level debug dihapus di produksi). `console.warn` dan `console.error` hanya lewat logger.
- Tidak ada `==` dan `!=` (pakai `===`), tidak ada `var`, tidak ada `delete` pada objek, tidak ada `eval` atau `new Function`.
- Tidak ada promise yang mengambang (`@typescript-eslint/no-floating-promises`).
- Tidak ada teks pemain di kode. Semua teks dari string table (`content/strings/en.json`), termasuk teks tombol dan pesan error yang terlihat pemain.
- Tidak ada aset biner yang ditulis tangan atau diunduh. Aset dibuat dari data dan skrip di repo.
- Tidak ada dependensi npm baru tanpa izin LP dan Producer (agent-rules aturan 4).
- Tidak ada kode atau flag tes di bundle produksi. Hook tes hanya di balik `__E2E__` (lihat 6.5).
- Tidak ada path absolut ke aset. Hormati base path `/shardfall/`.

---

## 5. Aturan performa [Wajib]

Hot loop = apa pun yang berjalan per tick (seluruh `sim.step`) atau per frame (render, update HUD, audio update), dan apa pun yang dipanggil per entitas.

1. **Nol alokasi di hot loop.** Dilarang di dalamnya: literal objek dan array (`{}`, `[]`), `new`, closure dan arrow function baru, spread (`...`), destructuring yang membuat objek, template string dan konkatenasi string, `Array.prototype.map/filter/forEach/reduce/slice/concat`, `Object.keys/entries`, iterator `for...of` pada array (pakai loop index biasa).
2. **Alokasikan sekali, pakai ulang.** Typed array, vektor scratch (`const tmp = new Vector3()` di level modul render), buffer hasil query. Fungsi yang mengembalikan nilai majemuk menulis ke parameter `out`.
3. **Data musuh, proyektil, pickup di pool SoA** (`architecture.md` bagian 8). Tidak ada objek per entitas di sim.
4. **Bentuk objek stabil.** Semua field diinisialisasi di constructor atau factory; tidak menambah atau menghapus properti setelahnya. Satu fungsi menerima satu bentuk objek (hindari polimorfisme di hot path).
5. **Tidak ada `try/catch` di hot loop.** Validasi di batas (load data, command), bukan per tick.
6. **Render**: tidak ada `new Material`, `new Geometry`, `new Texture` per frame. Update atribut instanced lewat typed array plus update range. Tidak ada perubahan yang memicu kompilasi ulang shader saat main (jumlah cahaya tetap per kualitas). Matriks dihitung manual bila lebih murah daripada scene graph.
7. **UI**: sentuh DOM hanya bila nilai berubah (bandingkan dengan nilai terakhir atau `revision`). Tidak ada `innerHTML` per frame. Tidak ada layout thrash (baca layout lalu tulis berselang-seling). Animasi lewat CSS `transform` dan `opacity`.
8. **Audio**: node dibuat per putar SFX itu wajar (Web Audio dirancang begitu), tetapi buffer dirender sekali dan batas voice dihormati.
9. **Ukur sebelum mengoptimasi lebih jauh.** Klaim performa di review disertai angka dari debug overlay, benchmark, atau profil.

Pengecualian: kode yang berjalan sekali (boot, load data, membuka layar toko, membangun DOM layar) boleh memakai gaya fungsional biasa demi keterbacaan.

---

## 6. Format tes [Wajib]

### 6.1 Lokasi dan nama
- Unit: `tests/unit/<modul>/<nama-file-yang-diuji>.test.ts`. Validasi data dan teks: `tests/data/`. Determinisme: `tests/determinism/*.test.ts`. Bot: `tests/bot/` (konfigurasi `bot-config.json`). Audit aset: `tests/assets/`. Benchmark: `tests/bench/*.bench.ts`. E2E: `tests/e2e/*.spec.ts` dan performa `tests/perf/` (milik QA). Fixture: `tests/fixtures/` (`data/`, `replays/`, `fake-world.ts`). Helper: `tests/support/`. Hasil sementara: `tests/out/` (gitignore).
- Tes regresi bug menyebut id bug di nama tes: `it('BUG-012: glint not lost on merge', ...)` (QA test-plan 1).

### 6.2 Struktur
```ts
import { describe, expect, it } from 'vitest';
import { createSpatialHash } from '../../../src/sim/spatial-hash.ts';

describe('spatial hash', () => {
  it('returns only items whose cell overlaps the query circle', () => {
    // Arrange
    const grid = createSpatialHash({ widthU: 38, depthU: 26, cellU: 2, capacity: 8 });
    // Act
    // ...
    // Assert
    expect(count).toBe(2);
  });
});
```
- `describe` = unit yang diuji. `it` = perilaku dalam kalimat Inggris: "does X when Y".
- Pola Arrange, Act, Assert. Satu perilaku per `it`.
- Tes deterministik: seed tetap, tanpa waktu nyata, tanpa jaringan, tanpa urutan antar tes.
- Snapshot test hanya untuk keluaran kecil dan stabil (misalnya pesan error validasi), tidak untuk state besar.
- Lingkungan Vitest: Node. Logika UI yang perlu diuji dipisah ke fungsi presenter murni (tanpa DOM) agar bisa diuji di Node; interaksi DOM nyata diuji lewat Playwright.

### 6.3 Data di tes
- Unit test sim memakai fixture kecil buatan tangan di `tests/fixtures/data/`, bukan data asli.
- Tes yang memakai data asli hanya memeriksa validitas, referensi, determinisme, dan invarian, bukan angka balance.
- Dilarang mengubah angka di `content/data` agar tes lulus. Bila tes dan desain bertentangan, laporkan ke Producer untuk GD.

### 6.4 Wajib ada tes untuk
- Setiap sistem sim dan setiap kriteria keberhasilan di spec GP (handoff 3.7).
- Determinisme (`architecture.md` 14.1) sejak M1.
- Parser CSV, validator skema, migrasi save, RNG, spatial hash, math deterministik.
- Setiap perbaikan bug logika: tes regresi yang gagal sebelum perbaikan.

### 6.5 Hook e2e
- Hanya di `src/app/e2e/`, di-import dinamis di balik `if (__E2E__)`. Tidak ada `if (isTest)` di modul lain; modul lain menyediakan API biasa yang dipakai hook.
- Setiap hook baru dicatat di interface `E2eHooks` (`architecture.md` 6.12). Objek global `window.__shardfall`. Perubahan state di luar aturan main (beri item, spawn, set HP) hanya lewat `DebugCommand` yang diterima sim bila `SimConfig.debugCommands` bernilai true.

---

## 7. Komentar, dokumentasi, dan error

- Bahasa Inggris untuk kode, komentar, identifier, nama file, pesan commit.
- Fungsi dan tipe yang di-export punya TSDoc singkat bila namanya belum cukup menjelaskan. Komentar menjelaskan **mengapa**, bukan mengulang apa yang dilakukan kode.
- `TODO` wajib berisi pemilik dan id tugas: `// TODO(GP, M2-07): telegraph for charger`.
- Error data dan konfigurasi: gagal cepat saat build atau boot dengan pesan jelas (`file:baris:kolom`).
- Error runtime yang bisa dipulihkan (localStorage penuh, AudioContext gagal, save rusak): tangani di batas `src/app`, catat lewat logger, game tetap jalan.
- `assert(cond, msg)` dari `src/core/assert.ts` dipakai di batas (load, command), tidak di hot loop.

---

## 8. Format kode

- Prettier (otomatis): 2 spasi, kutip tunggal, titik koma, `printWidth` 100, trailing comma `all`.
- ESLint: `@eslint/js` recommended, `typescript-eslint` strict-type-checked plus aturan larangan di bagian 4 dan arah import di bagian 3.
- GLSL: shader di file `.glsl` (di-import sebagai string lewat `?raw` Vite) atau template string di file `.ts` khusus shader. Satu shader per file.
- Akhir baris LF (`.gitattributes` dan `.editorconfig` dibuat LP di M1).

---

## 9. Cara menjalankan cek

Prasyarat: Node 24, `npm ci` sekali setelah M1 membuat `package.json`.

| Perintah | Kapan |
|---|---|
| `npm run check` | **Wajib hijau sebelum menyerahkan pekerjaan.** Menjalankan data:check, format:check, typecheck, lint, test, build, bundle:check |
| `npm test -- tests/unit/sim` | Saat bekerja, fokus ke modul sendiri |
| `npx vitest --watch tests/unit/ui` | Mode watch saat bekerja |
| `npm run typecheck` | Setelah mengubah tipe atau kontrak |
| `npm run lint -- --fix` lalu `npm run format` | Sebelum menyerahkan |
| `npm run data` | Setelah mengubah CSV, level, atau string (GD, LD, WR) |
| `npm run test:e2e` | QA, dan siapa pun yang mengubah alur layar atau hook |
| `npm run bench` | GP dan LP setelah mengubah sistem sim yang berat |

Aturan saat agen bekerja paralel (agent-rules aturan 10 dan 11):
- Bila `check` gagal di file milik agen lain yang sedang dikerjakan, sebutkan di laporan; jangan memperbaikinya diam-diam.
- Jangan biarkan `npm run dev` atau `preview` hidup setelah selesai.
- Jangan menjalankan perintah git.

---

## 10. Review kode

Reviewer: LP untuk semua kode (handoff 3.3). Format temuan: label, file dan baris, masalah, arahan perbaikan. Putusan: **LOLOS** atau **PERLU PERBAIKAN**.

| Label | Arti | Contoh |
|---|---|---|
| BLOCKER | Salah, merusak determinisme, crash, melanggar aturan mutlak, atau hook tes masuk produksi | `Math.random` di sim, angka balance hardcode di sistem kombat, import `three` di sim, tes dilemahkan agar lulus |
| MAYOR | Melanggar standar [Wajib] atau anggaran performa, tes kurang untuk kriteria spec | Alokasi di hot loop, import menembus `index.ts` modul lain, sistem tanpa tes |
| MINOR | Penamaan, komentar, keterbacaan, saran | Akhiran satuan hilang, fungsi terlalu panjang |

Satu BLOCKER atau MAYOR terbuka berarti PERLU PERBAIKAN. MINOR boleh dicatat untuk putaran berikutnya.

### Checklist pembuat (jalankan sendiri sebelum menyerahkan)
- [ ] `npm run check` hijau (atau kegagalan di file agen lain disebutkan).
- [ ] Hanya file milik sendiri yang diubah, atau perubahan di file lain minimal dan disebutkan.
- [ ] Tidak ada angka balance hardcode, tidak ada teks pemain hardcode.
- [ ] Tidak ada `Math.random`; sim tanpa waktu nyata, DOM, three.
- [ ] Tidak ada alokasi di hot loop.
- [ ] Tes untuk setiap perilaku baru dan setiap perbaikan bug.
- [ ] Tidak ada dependensi baru tanpa izin; aset baru tercatat di `docs/credits.md`.
- [ ] Usulan perubahan kontrak ditulis di laporan, bukan langsung diubah.
