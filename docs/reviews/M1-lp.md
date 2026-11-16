# Review Kode M1 dan Integrasi (Lead Programmer)

Tugas: M1-09a. Reviewer: Lead Programmer (LP). Tanggal: 2026-11-17. Untuk: Producer.
Cakupan: `src/sim`, `src/content` (termasuk `tables`), `src/ui`, `src/render`, `src/audio`, `tools/` (data, levels, balance, art, audio), integrasi `src/app`. Angka balance tidak diubah. Kontrak tambahan dicatat di `docs/tech/architecture.md` bagian 19 (versi 2.2).

**Putusan: LOLOS.** Tidak ada BLOCKER. Semua MAYOR yang aman diperbaiki LP di putaran ini (bagian 3). Sisa MAYOR yang belum diperbaiki ditandai untuk pemiliknya di M2 dan tidak menghalangi main loop.

---

## 1. Hasil integrasi

Game bisa dimainkan end-to-end di browser dengan sim asli: judul, Begin, pilih Lamplighter, Pulse (gerak WASD, serangan otomatis, Rite Space, Unlit, Glint), Temper, toko the Glazier (beli, kunci, reroll, jual, Fuse), Pulse berikutnya, hadiah Warden (Pulse 5), boss (Pulse 10), layar Light Kept atau Kept Lost, kembali ke judul, Continue dari autosave setelah reload.

| Bagian | Perubahan | File |
|---|---|---|
| Autosave dan Continue | Envelope `shardfall.run.v1` ditulis saat fase pilihan pertama dan setiap revisi toko/Temper/hadiah; dihapus saat run berakhir. Continue memanggil `sim.load` | `src/app/save/run-save.ts`, `src/app/run-watch.ts`, `src/app/boot.ts` |
| Meta | Jumlah run, kelas terakhir, Crack tertinggi, Memento ditemukan. `deleteSaveData` menghapus 3 kunci | `src/app/meta/meta-store.ts` |
| Hitung mundur | 3, 2, 1 selama 900 ms di slot timer saat lanjut dari jeda dalam Pulse; tidak ada saat Abandon | `src/app/boot.ts`, `Ui.setResumeCountdown` |
| Arena | `renderer.setArena` dan `audio.setArena` saat `view.arenaIndex` berubah, bioma dari `biomes.csv` | `src/app/run-watch.ts`, `boot.ts` |
| Profil | Default `run_a` (Warden dan boss). `run_a_m1` tanpa keduanya | `boot.ts` |
| Hook e2e | `goToScreen` (semua layar), `spawnStress`, `loadReplay` (memakai `stressCommands`, `decodeReplay`, `playReplay`), `getPerf().poolOverflow` | `src/app/e2e/hooks.ts` |
| Replay | Perekam memakai jam langkah sendiri; sim memulai tick dari 0 di `run.start`. Replay browser diputar ulang dengan checkpoint cocok | `src/app/replay.ts`, `src/sim/create-sim.ts` |
| Bahasa | `?lang=id` memuat `id.json` secara lazy (4,8 KB gzip), cadangan EN | `boot.ts` |

## 2. Pertanyaan teknis peran yang diputus (final)

1. **Registri params**: diisi dari GP spec 3, data-schema 5, effect-primitives 5 (`src/content/params-registry.ts`). Kunci opsional, tipe dan rentang divalidasi. Build A, B, C: 0 error.
2. **Q21 tekanan musik**: event baru `MusicPressureChanged: 70` (a = 1 masuk, 0 keluar) dari `config.csv` `music_pressure_frac` dan `music_pressure_release_frac`, menghitung Unlit normal hidup. AU memakai event ini di `levelFor` (tidak lagi menghitung musuh sendiri).
3. **`PlayerHpLowChanged`**: dipancarkan sim (`src/sim/systems/signals.ts`), ambang `LOW_HP_FRAC = 0.3` (ui-spec S03) sebagai konstanta presentasi di `src/core/constants.ts`. GD boleh memindahkannya ke `config.csv`.
4. **`FakeWorld`**: `Omit<Mutable<WorldView>, 'pulse' | 'player'> & {...}` sehingga tes bisa menulis `w.pulse.*` dan `w.player.*` langsung. `tests/unit/ui/writable.ts` boleh dihapus UI di M2.
5. **`content_tier` opsional** di `effects`, `waves`, `wave_spawns`: disetujui. Ditambah validasi: tier `wave_spawns` wajib sama dengan baris `waves`-nya.
6. **Cek string resmi**: `tools/data/lib/check-strings.ts`, jalan di `npm run data` dan `data:check`: kunci dari data dan UI ada, nama maks 3 kata dan 18 karakter, Unlit maks 2 kata, kelas 1 kata, efek maks 2 baris x 40 karakter setelah diisi nilai data, flavor 1 baris 70 karakter, baris Glazier 45 karakter, tanpa em/en dash, kata terlarang sebagai peringatan, `id.json` diselaraskan (peringatan).
7. **Placeholder teks**: `src/content/rules/text-params.ts` (`{chance}`, `{pct}`, `{burn_pct}`, `{stacks}`, `{nth}`, `{count}`, `{interval}`, `{pierce}`, `{crit}`, `{projectiles}`), dipakai UI dan cek string. Parameter numerik senjata (`{jumps}`) dari `params`.
8. **Urutan event kalah**: `PlayerDied` (tick mati) lalu `PhaseChanged` ke `defeat` lalu `RunEnded` (setelah `death_slowmo_s`). Dikunci tes.
9. **Kunci string UI**: 14 kunci yang diminta UI di ui-spec (Lampiran A, "minta WR") belum ada di `en.json`; LP menambahkannya ke `en.json` dan `id.json` memakai teks usulan ui-spec. Tidak ada kunci mentah di semua layar (dicek e2e).
10. **`levels:check`, `audio:check`, `bundle:check`**: skrip npm baru, masuk `check` (masing-masing di bawah 1 detik). `check` kini juga menjalankan `format:check` dan `build`.

## 3. Temuan dan perbaikan

Kolom Status: DIPERBAIKI (oleh LP di M1-09a) atau M2 (pemilik).

### BLOCKER
Tidak ada.

### MAYOR

| # | File:baris (saat review) | Temuan | Pemilik | Status |
|---|---|---|---|---|
| 1 | `src/sim/systems/combat.ts:211` | Kill boss tidak mengisi `rewardSourceType`: boss non-final (run B/C) memakai peti Warden | GP | DIPERBAIKI |
| 2 | `src/sim/state-hash.ts:261` | Hash memuat nilai serial musuh di memori pierce; serial tidak di-reset/save, hash berbeda setelah load (D-4 palsu) | GP | DIPERBAIKI (hash kecocokan serial) |
| 3 | `src/sim/save-codec.ts:106` | `applySave` tanpa validasi: `load(null)` throw, `pulseIndex` di luar profil atau fase pilihan tanpa pilihan membuat soft-lock | GP | DIPERBAIKI (`validateSave`, try/catch, `corrupt`) |
| 4 | `src/sim/create-sim.ts:519` | `PhaseChanged` dari `load` terhapus oleh `events.clear()` step berikutnya | GP | DIPERBAIKI |
| 5 | `src/content/build-raw.ts:735` | `boss_id`/`warden_id` tidak dicek perannya: boss bukan boss membuat Pulse boss tidak pernah selesai | LP | DIPERBAIKI |
| 6 | `src/content/tables/run.ts:113` | Tier `wave_spawns` tidak dicek terhadap `waves` | LP | DIPERBAIKI |
| 7 | `src/content/params-registry.ts:23` | Registri kosong, salah ketik kunci diam-diam mematikan fitur | GP + LP | DIPERBAIKI |
| 8 | `src/sim/create-sim.ts:430` | `trickleType` (findIndex + closure) tiap tick | GP | DIPERBAIKI (cache per Pulse) |
| 9 | `src/sim/systems/boss.ts:27` | `bossPhases` filter + sort + `.find` tiap tick boss | GP | DIPERBAIKI (cache, loop indeks) |
| 10 | `src/sim/effects/engine.ts:113` | `tagsOf` split string tiap proc | GP | DIPERBAIKI (mask saat load) |
| 11 | `src/sim/stats.ts:29,87,101` | `recomputeStats` mengalokasi (entries, split, findIndex) di tengah Pulse | GP | DIPERBAIKI (pra-resolusi di `sim-data`) |
| 12 | `src/sim/systems/spawner.ts:111` | Closure `tryIn` per grup spawn | GP | DIPERBAIKI |
| 13 | `src/render/pipeline/renderer.ts:153` | `stats()` hanya menghitung pass upscale (selalu 1 draw call), anggaran 60 draw call tidak bisa gagal | LP | DIPERBAIKI (`info.autoReset = false`) |
| 14 | `src/render/pipeline/renderer.ts:127` | `setArena` tidak membuang geometri/material lantai lama | LP + AD | DIPERBAIKI (juga di `dispose`) |
| 15 | `src/ui/screens/hud.ts:110` | Teks HP ditulis ke DOM tiap frame saat regen (pembanding float) | UI | DIPERBAIKI |
| 16 | `src/ui/ui-root.ts:95` | Toggle Flavor membangun ulang layar Settings, fokus hilang | UI | DIPERBAIKI |
| 17 | `src/app/replay.ts`, `create-sim.ts` | Replay browser tidak cocok di Node (tick absolut, state run menyimpan tick dunia) | LP | DIPERBAIKI |
| 18 | `src/app/boot.ts` | Continue, autosave, meta, hitung mundur, setArena, hook e2e belum ada | LP | DIPERBAIKI |
| 19 | `src/sim/sim-data.ts:330` | Efek `every_nth @per_target` ke-5 diam-diam tidak pernah jalan | GP | M2: error build atau hitung di `poolOverflow` |
| 20 | `src/sim/systems/boss.ts:285`, `weapons.ts:339`, `spawner.ts:97` | Cadangan angka di kode: radius serangan pola cadangan `p.radius * 4`, `rev_s` default 1, ambang grup 3 untuk tanda medium | GP + GD | M2: pindah ke data atau matikan perilaku bila kunci hilang. Data saat ini mengisi `rev_s`; ambang 3 sesuai GDD 3.2 |

### MINOR (dicatat untuk M2)

| File | Temuan | Pemilik |
|---|---|---|
| `src/ui/screens/hud.ts:59` | Slot Rite tanpa ikon dan tanpa getar saat `RiteRejected`; muatan Rite tidak tampil | UI + AD |
| `src/ui/screens/*` | Ikon kartu dan item masih kotak kosong atau singkatan tag | UI + AD |
| `src/ui/screens/glazier.ts:455` | Sell/Fuse lewat tombol pintas bekerja pada slot terakhir yang difokus, walau fokus di tawaran | UI |
| `src/ui/ui-root.ts:252` | Semua `CommandRejected` membunyikan denied dan diumumkan, termasuk alasan yang sengaja senyap di audio | UI |
| `src/ui/presenters/hud.ts:97` | Pulse boss sebelum boss muncul menampilkan "0:00" | UI |
| `src/ui/screens/settings.ts:114` | Slider tidak bisa diubah dengan mouse | UI |
| UI title | Pesan `ui.title.save_lost` belum ada saluran tampil (app mencatat warn dan membuang save) | UI + LP |
| `src/ui/screens/choice.ts` | Label Temper "Lv 2 1 of 12" kurang jelas saat banyak level tertunda | UI |
| `src/audio/audio-system.ts:122,271,280` | `boot()` tidak cek `disposed`; detak HP rendah tidak cek jeda; 5 `setTargetAtTime` tiap frame | AU |
| `src/audio/audio-system.ts:213`, `engine.ts:272`, `song.ts:447` | Alokasi kecil tiap frame (array literal, `for...of`) | AU |
| `src/audio/engine.ts:168` | Render cue berdurasi baru di thread utama, cache dikosongkan penuh di 48 entri | AU |
| `src/audio/music/mus.biome1.pulse.json` | `pressure.enemiesAlive` 60 tidak dipakai lagi (event Q21) | AU |
| `src/render/pipeline/renderer.ts` | Kualitas, kurangi efek, getar, mode warna, `webglcontextlost`, `dangerRT` terpisah | LP + AD (M2) |
| `tools/art/*.mjs` | Tool `.mjs` dan salinan rasterizer di luar `src/core` masih ada | AD |
| `src/sim/effects/engine.ts:455` | `areaCtx` modul bisa tertimpa dispatch bersarang (laten, hanya `syn_echo_2`) | GP |
| `src/sim/save-codec.ts:202,248` | Setelah load: "1 of 2" Temper dan sumber peti hadiah hilang; `contentHash` tidak dibandingkan | GP |
| `src/sim/systems/boss.ts:213,311` | Sektor summon dan trickle memakai aliran `ai`, seharusnya `spawn` | GP |
| `src/sim/systems/boss.ts:44`, `spawner.ts:43`, `combat.ts:29` | Warden bisa hilang diam-diam bila pool tanda penuh; truncation jadwal dan hit-stack tidak dihitung di `poolOverflow` | GP |
| `src/sim/systems/combat.ts:294` | SourceRef leech sama dengan Burn | GP |
| `src/sim/systems/progression.ts:195` | Pool kartu kosong masuk `levelUp` dengan 0 pilihan | GP |
| `src/sim/systems/projectiles.ts:124`, `engine.ts:606` | Pemindaian 512 slot per proc, iterator `for...of TIMED` tiap tick | GP |
| `src/sim/state-hash.ts` | `targetCounter`, `rewardPending`, `bossKilled`, `levelsThisPulse` belum di-hash | GP |
| `src/content/build-raw.ts:440` | Pemilik tier A yang kehilangan semua efek tier B tidak dilaporkan | LP |
| `tools/data/build-data.ts` | `--tier B` tanpa `--out` menimpa `content/generated` | LP |
| `content/strings/en.json` | "a 8% chance" (tata bahasa); 14 kunci tambahan LP perlu review WR | WR |
| `art/palette.json`, `src/render/env` | Bioma, bibir, rim, dekorasi, cahaya belum dirender dari arena | AD (M1-05 lanjutan) |

Sudah diperbaiki juga (MINOR murah): `debug.setHp` menolak NaN dan fase akhir; `run.abandon` ditolak selama jeda kemenangan; pilihan kartu tidak macet setelah `CommandRejected`; `==` di glazier.

## 4. Bukti

| Perintah | Hasil |
|---|---|
| `npm run check` | Lulus: data A 0 error, cek string 0 error, 25 sprite, 2 arena, audio 7,8 KB, format, typecheck, lint, 332 tes (46 file), build, bundle |
| `npm run build` + `bundle:check` | JS awal 244,9 KB gzip (target 300, batas 400), halaman pertama 248,2 KB (target 400), `id` lazy 4,8 KB, tanpa hook e2e |
| `npm run test:e2e` | 4 lulus (run penuh sampai menang dengan Continue, kalah, hook, smoke); `--repeat-each=5` 20 dari 20 lulus |
| Build tingkat B dan C (`--tier B/C --out`) | 0 error dengan registri params |

Tes baru: `tests/unit/sim/integration-m1.test.ts`, `tests/unit/app/save-meta.test.ts`, `tests/data/check-strings.test.ts`, kasus baru di `tests/unit/content/pipeline.test.ts`, `tests/e2e/full-run.spec.ts`. Screenshot tiap layar di `tests/out/e2e/` (diperiksa LP: tidak ada kunci mentah, layar utuh, sprite tampil).
