# Credits dan Lisensi

Setiap aset dan dependensi wajib tercatat di sini.

## Aset

| File | Pembuat atau sumber | Lisensi | Catatan |
|---|---|---|---|
| `art/palette.json` | Tim Shardfall (AD), ditulis tangan dari style guide | Lisensi proyek (belum ditetapkan) | Palet inti dan 3 palet bioma, cahaya |
| `art/sprites/*.json` (14 sprite konsep: kept, unlit, warden, fx) | Tim Shardfall (AD), grid data ditulis tangan | Lisensi proyek (belum ditetapkan) | Status concept, dasar placeholder M1 |
| `art/sprites/boss-lantern.ts` | Tim Shardfall (AD), generator prosedural | Lisensi proyek (belum ditetapkan) | Konsep boss bioma 1 |
| `art/tiles/tile-floor.json` | Tim Shardfall (AD), grid data ditulis tangan | Lisensi proyek (belum ditetapkan) | Tile lantai 16x16, 2 varian |
| `art/concept/*.png`, `art/concept/01-palette-biomes.svg`, `art/concept/measurements.json` | Dibuat oleh `tools/art/build-concepts.mjs` (Tim Shardfall, AD) | Lisensi proyek (belum ditetapkan) | Konsep mood M0, bisa dibuat ulang |
| `art/atlas/preview/*` | Dibuat oleh `tools/art/check-sprites.mjs` (Tim Shardfall, AD) | Lisensi proyek (belum ditetapkan) | Lembar preview dan atlas review |

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
