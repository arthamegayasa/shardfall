# Credits dan Lisensi

Setiap aset dan dependensi wajib tercatat di sini.

## Aset

| File | Pembuat atau sumber | Lisensi | Catatan |
|---|---|---|---|
| `art/palette.json` | Tim Shardfall (AD), ditulis tangan dari style guide | Buatan tim, hak cipta proyek | Palet inti dan 3 palet bioma, cahaya. 1.1: lantai b3 dinetralkan, `point.rangeU` |
| `art/sprites/kept-*.json`, `unlit-*.json`, `warden-*.json` (3 kelas, 6 Unlit, 2 Warden) | Tim Shardfall (AD), grid data ditulis tangan | Buatan tim, hak cipta proyek | `kept-lantern`, 4 Unlit Tingkat A, `warden-hound`: placeholder M1 dengan animasi (M1-05). Sisanya konsep |
| `art/sprites/boss-lantern.ts` | Tim Shardfall (AD), generator prosedural | Buatan tim, hak cipta proyek | Boss bioma 1, placeholder M1, 2 bingkai idle, trig dari `src/core/math` |
| `art/sprites/fx-glint.json`, `fx-shot-danger.json`, `fx-shot-kept.json` | Tim Shardfall (AD), grid data ditulis tangan | Buatan tim, hak cipta proyek | Glint, proyektil musuh, proyektil pemain cadangan |
| `art/sprites/fx-shot-lantern-bolt.json`, `fx-shot-splinter-shot.json`, `fx-shot-arc-blade.json`, `fx-shot-orbit-shards.json`, `fx-shot-chain-spark.json`, `fx-shot-returning-glaive.json` | Tim Shardfall (AD), grid data ditulis tangan (M1-05) | Buatan tim, hak cipta proyek | Proyektil pemain per senjata Tingkat A |
| `art/sprites/fx-burn.json`, `fx-spawn-crack.json`, `fx-digits.json` | Tim Shardfall (AD), grid data ditulis tangan (M1-05) | Buatan tim, hak cipta proyek | Api Burn cyan, retakan spawn, digit angka damage 3x5 |
| `art/tiles/tile-floor.json` | Tim Shardfall (AD), grid data ditulis tangan | Buatan tim, hak cipta proyek | Tile lantai 16x16, 2 varian |
| `src/render/shaders/sprite.ts`, `src/render/shaders/area.ts` | Tim Shardfall (AD), kode GLSL | Buatan tim, hak cipta proyek | Shader sprite billboard dan area telegraf (M1-05) |
| `art/concept/*.png`, `art/concept/01-palette-biomes.svg`, `art/concept/measurements.json` | Dibuat oleh `tools/art/build-concepts.mjs` (Tim Shardfall, AD) | Buatan tim, hak cipta proyek | Konsep mood M0, dibuat ulang di M1-05 dengan proyeksi final |
| `art/atlas/preview/*` | Dibuat oleh `tools/art/check-sprites.ts` (Tim Shardfall, AD) | Buatan tim, hak cipta proyek | Lembar preview dan atlas review |
| `src/audio/cues/cues.json` (87 resep SFX, UI, stinger), `src/audio/cues/routes.json` | Tim Shardfall (AU), resep sintesis ditulis tangan | Buatan tim, hak cipta proyek | Dirender DSP `src/audio/synth/` saat boot, tanpa sampel rekaman |
| `src/audio/music/instruments.json`, `mus.biome1.pulse.json`, `mus.shop.json` | Tim Shardfall (AU), melodi dan progresi orisinal (audio-direction 5) | Buatan tim, hak cipta proyek | Uji orisinalitas dengar A-6 dijadwalkan M2 |
| `audio/preview/sfx/*.wav`, `audio/preview/music/*.wav` | Dibuat oleh `tools/audio/render-cues.ts` (Tim Shardfall, AU) | Buatan tim, hak cipta proyek | Hanya review, di-gitignore, bisa dibuat ulang |

## Dependensi

| Paket | Lisensi | Kegunaan |
|---|---|---|
| `three` 0.187.0 (runtime) | MIT | Render WebGL2 |
| `typescript` 6.0.3 (dev) | Apache-2.0 | Typecheck. Versi 7 belum didukung typescript-eslint |
| `vite` 8.3.5 (dev) | MIT | Dev server, build, import JSON |
| `vitest` 5.1.0 (dev) | MIT | Unit, data, determinisme |
| `@playwright/test` 1.64.1 (dev) | Apache-2.0 | E2E dan screenshot |
| `eslint` 10.14.0 (dev) | MIT | Lint |
| `typescript-eslint` 8.72.1 (dev) | MIT | Aturan lint TypeScript |
| `@eslint/js` 10.0.1 (dev) | MIT | Aturan lint dasar |
| `globals` 17.14.0 (dev) | MIT | Daftar global browser dan Node untuk lint |
| `prettier` 3.9.10 (dev) | MIT | Format kode |
| `@types/three` 0.187.0 (dev) | MIT | Tipe three.js |
| `@types/node` 26.6.6 (dev) | MIT | Tipe Node untuk `tools/` dan tes |
