# Credits dan Lisensi

Setiap aset dan dependensi wajib tercatat di sini.

## Aset

| File | Pembuat atau sumber | Lisensi | Catatan |
|---|---|---|---|
| `art/palette.json` | Tim Shardfall (AD), ditulis tangan dari style guide | Buatan tim, hak cipta proyek | Palet inti dan 3 palet bioma, cahaya. 1.1: lantai b3 dinetralkan, `point.rangeU` |
| `art/sprites/fx-glint.json`, `fx-shot-danger.json`, `fx-shot-kept.json` | Tim Shardfall (AD), grid data ditulis tangan | Buatan tim, hak cipta proyek | Glint, proyektil musuh, proyektil pemain cadangan |
| `art/sprites/fx-shot-lantern-bolt.json`, `fx-shot-splinter-shot.json`, `fx-shot-arc-blade.json`, `fx-shot-orbit-shards.json`, `fx-shot-chain-spark.json`, `fx-shot-returning-glaive.json` | Tim Shardfall (AD), grid data ditulis tangan (M1-05) | Buatan tim, hak cipta proyek | Proyektil pemain per senjata Tingkat A |
| `art/sprites/fx-burn.json`, `fx-spawn-crack.json`, `fx-digits.json` | Tim Shardfall (AD), grid data ditulis tangan (M1-05, M2-03) | Buatan tim, hak cipta proyek | Api Burn cyan 3 bingkai, retakan spawn, digit damage 3x5 dan kritikal 4x6 cyan |
| `art/sprites/kept-lantern.ts`, `unlit-swarmer.ts`, `unlit-charger.ts`, `unlit-shooter.ts`, `unlit-tank.ts`, `warden-hound.ts` | Tim Shardfall (AD), generator grid dari data (M2-03) | Buatan tim, hak cipta proyek | Aktor final vertical slice: Lamplighter (idle, walk, cast, hit), 4 Unlit Tingkat A (walk, windup), Brass Collar (walk, windup, attack) |
| `art/sprites/kept-bell.json`, `kept-blade.json`, `unlit-exploder.json`, `unlit-summoner.json`, `warden-choir.json` | Tim Shardfall (AD), grid data ditulis tangan | Buatan tim, hak cipta proyek | Kelas Tingkat B (idle dan walk M2-03; cast 2 dan hit 2 M4-01), Unlit dan Warden lain masih konsep |
| `art/sprites/boss-lantern.ts` | Tim Shardfall (AD), generator prosedural | Buatan tim, hak cipta proyek | Paper Sun, final M2-03: fase 1 dan 2 (idle, windup), trig dari `src/core/math` |
| `art/sprites/sprite-types.ts` | Tim Shardfall (AD), kode | Buatan tim, hak cipta proyek | Re-export tipe sprite dan helper grid generator (M2-03) |
| `art/sprites/fx-spark.json`, `fx-trail.json`, `fx-glint-trail.json`, `fx-mote.json`, `fx-shard.json`, `fx-glass-shard.json`, `fx-flare.json`, `fx-ember.json`, `fx-rise.json`, `fx-star.json` | Tim Shardfall (AD), grid data ditulis tangan (M2-03) | Buatan tim, hak cipta proyek | Partikel VFX inti: percikan hit, ekor proyektil dan Glint, kematian Unlit, kematian pemain, Rite, bara zona, level up, Memento |
| `art/sprites/icon-*.json` (44 file: 8 senjata, 12 Memento, 1 Rite, 14 stat, 6 tag, Glint, Silt, potret the Glazier) | Tim Shardfall (AD, digambar subagent pixel art atas brief AD), grid data | Buatan tim, hak cipta proyek | Ikon UI final M2-03, atlas di `src/core/sprite/icons.ts` |
| `art/sprites/icon-memento-tuning-fork.json`, `icon-memento-rite-chime.json`, `icon-memento-iron-thimble.json`, `icon-memento-glass-aegis.json`, `icon-memento-collector-pin.json`, `icon-memento-dust-hourglass.json`, `icon-memento-lucky-button.json`, `icon-memento-magpie-tin.json`, `icon-memento-haggler-seal.json`, `icon-memento-grinding-wheel.json`, `icon-rite-great-toll.json`, `icon-rite-glass-step.json` (12 file) | Tim Shardfall (AD), grid data ditulis tangan (M3) | Buatan tim, hak cipta proyek | Ikon 10 Memento Tingkat B dan Rite Chorister (Great Toll) serta Vintner (Glass Step). `art:check` kini mewajibkan ikon Memento dan Rite Tingkat A dan B |
| `art/sprites/icon-memento-music-box.json`, `icon-memento-patched-cloak.json` | Tim Shardfall (GD M4-04), grid data ditulis tangan, status `placeholder` | Buatan tim, hak cipta proyek | Ikon sementara dua Memento yang naik ke Tingkat B (P1-c). AD menggantinya dengan versi final |
| `src/ui/pixel-font.ts` (font "Shardfall Pixel") | Tim Shardfall (UI), glyph 5x7 dalam sel 6x9 ditulis tangan sebagai data, dirakit menjadi TrueType saat boot (M2-06) | Buatan tim, hak cipta proyek | Font UI; tidak memakai atau meniru font lain, tanpa unduhan |
| `src/ui/ui.css` (bingkai panel, bentuk tag, topeng cadangan the Glazier) | Tim Shardfall (UI), CSS (M2-06) | Buatan tim, hak cipta proyek | Sudut tangga, kilau kaca, bentuk per tag; topeng hanya tampil bila potret AD tidak ada |
| `art/tiles/tile-floor.json` | Tim Shardfall (AD), grid data ditulis tangan | Buatan tim, hak cipta proyek | Tile lantai 16x16, 2 varian |
| `src/render/shaders/sprite.ts`, `src/render/shaders/area.ts` | Tim Shardfall (AD), kode GLSL | Buatan tim, hak cipta proyek | Shader sprite billboard (M2-03: cahaya per instance, emisif, kilat, larut dither) dan area telegraf |
| `src/render/env/*` (tekstur pixel prosedural, mesh low-poly dekorasi), `src/render/shaders/env-*.ts`, `post-*.ts`, `lighting.ts`, `player-mask.ts`, `shadow-depth.ts` | Tim Shardfall (LP), kode dan GLSL (M2-02) | Buatan tim, hak cipta proyek | Lingkungan diorama dari data arena dan palet, latar langit dan kubah kaca, partikel suasana, cahaya, post-processing. Tanpa gambar unduhan |
| `src/render/vfx/effects.ts`, `particles.ts` | Tim Shardfall (AD), kode | Buatan tim, hak cipta proyek | VFX inti dari event (M2-03) |
| `art/concept/*.png`, `art/concept/01-palette-biomes.svg`, `art/concept/measurements.json` | Dibuat oleh `tools/art/build-concepts.mjs` (Tim Shardfall, AD) | Buatan tim, hak cipta proyek | Konsep mood M0, dibuat ulang di M1-05 dengan proyeksi final |
| `art/atlas/preview/*` | Dibuat oleh `tools/art/check-sprites.ts` (Tim Shardfall, AD) | Buatan tim, hak cipta proyek | Lembar preview dan atlas review |
| `src/audio/cues/cues.json` (101 resep SFX, UI, riser termasuk `ui.unlock` M3 dan Rite `sfx.rite.impact.bell`, `sfx.rite.impact.blade` M4; 5 stinger lama deprecated), `src/audio/cues/routes.json` | Tim Shardfall (AU), resep sintesis ditulis tangan (M1-06, M2-04) | Buatan tim, hak cipta proyek | Dirender DSP `src/audio/synth/` saat boot (Web Worker), tanpa sampel rekaman |
| `src/audio/music/instruments.json` (18 instrumen), `mus.title`, `mus.biome1.pulse`, `mus.overlay.unlit`, `mus.shop`, `mus.biome1.boss`, `mus.end`, 8 `mus.stinger.*` (`src/audio/music/*.json`) | Tim Shardfall (AU), melodi, kontramelodi, dan progresi orisinal (audio-direction 5, 14) | Buatan tim, hak cipta proyek | Uji orisinalitas dengar A-6 butuh pendengar manusia, tetap terbuka |
| `audio/preview/sfx/*.wav`, `audio/preview/music/*.wav`, `audio/preview/stingers/*.wav` | Dibuat oleh `tools/audio/render-cues.ts` (Tim Shardfall, AU) | Buatan tim, hak cipta proyek | Hanya review, di-gitignore, bisa dibuat ulang |

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
