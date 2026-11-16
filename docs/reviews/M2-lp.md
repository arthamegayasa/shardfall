# Review LP M2: integrasi slice (M2-09) dan aktivasi Tingkat B

Pemilik: Lead Programmer. Tanggal: 2026-11-17. Lingkup: kode wave M2 (pipeline HD-2D, aset dan VFX AD, sim GP `gp-m2-slice.md`, UI v1.2, data GD, musik AU, arena dan teks LD/WR), sambungan lintas peran, dan aktivasi Tingkat B sebagai build default.

**Putusan: LOLOS.** Semua BLOCKER dan MAYOR yang ditemukan sudah diperbaiki di wave ini. Sisa temuan MINOR tercatat dengan pemiliknya.

## 1. Hasil uji

| Perintah | Hasil |
|---|---|
| `npm run check` | Lulus. Data tier B 0 error, 0 peringatan (contentHash `2008c1b6`), 64 file tes, 575 tes lulus (sebelumnya 560) |
| `npm run build` + `bundle:check` | Lulus. JS awal 269,4 KB gzip (sebelum: 298,8 KB termasuk Worker), halaman pertama 275,4 KB, chunk lazy dan Worker 42,4 KB (audio 30,2 KB, string ID 7,5 KB, Worker audio 4,6 KB) |
| `npm run test:e2e` | 18 dari 18 lulus (bagian 6) |
| Bot GD `run_b` | Bagian 5 |
| Screenshot (1920x1080, efek penuh, `tests/out/lp/`) | Pulse ramai (`spawnStress('peak')`), toko, pilih kelas, The Keeping dengan dan tanpa Silt, 8 frame pungut Glint. Dilihat; catatan di bagian 4 |

## 2. Temuan dan perbaikan

### BLOCKER

| # | File | Temuan | Status |
|---|---|---|---|
| B1 | `src/ui/ui-root.ts` (switchTo, lockInput) | `keyboard-play.spec.ts` gagal: Glazier yang dipulihkan lewat Continue memasang kunci input 300 ms (ui-spec 8.4), jadi KeyB yang ditekan segera sesudah Continue ditolak diam-diam. Kunci itu dimaksudkan untuk tombol tertahan dari Pulse, bukan untuk layar yang datang dari menu judul | Diperbaiki: `choiceLockApplies(fromScreenId)` di `src/ui/menu-keys.ts`; layar pilihan yang datang dari `title` tidak dikunci (kembali dari jeda dan pengaturan sudah dikecualikan sejak M1). Tes unit di `tests/unit/ui/focus-nav.test.ts`; e2e keyboard-play lulus tanpa diubah |
| B2 | `tests/unit/qa/support/sim-cli.ts`, `scripted-run.ts` | Setelah profil default menjadi `run_b`, D-5 dan D-2 membandingkan browser (`run_b`) dengan Node (`run_a` terkode) | Diperbaiki: aturan `defaultRunProfile(data)` di `src/content/rules/unlocks.ts` dipakai app dan CLI QA |

### MAYOR

| # | File | Temuan | Status |
|---|---|---|---|
| M1 | `src/sim/systems/spawner.ts:108`, `pickups.ts:90`, `signals.ts:14` | Kunci config GD tidak pernah dibaca: GP membaca `spawnMarkMediumGroup` dan `glintFlySpeedMaxUPerTick` lewat `cfgOpt` (tidak ada di data), sehingga tanda grup sedang dan Glint yang melesat diam-diam mati; `LOW_HP_FRAC` masih konstanta | Diperbaiki: sim membaca `spawn_mark_medium_group_min`, `glint_fly_speed_start`, `glint_fly_accel` (puncak `glint_fly_speed`), `low_hp_frac`. `cfgOpt` dan `LOW_HP_FRAC` dihapus. 4 tes di `tests/unit/sim/lp-m2-integration.test.ts` |
| M2 | `src/app/boot.ts` (`unlock`), `src/sim/systems/shop.ts:204`, `progression.ts:121` | Unlock meta tidak pernah berlaku: `AppActions.unlock` stub `false`, toko membuang semua senjata ber-`unlock_silt`, paket Memento tidak pernah masuk pool walau dibeli | Diperbaiki: `run.start.unlocked`, `RunSave.unlocked`, kolom `weaponOpen`/`mementoOpen` (masuk hash), aturan murni `src/content/rules/unlocks.ts`, `app.unlock` menyimpan meta. Tes unit aturan dan sim, e2e `meta-unlock.spec.ts` |
| M3 | `src/sim/systems/run.ts:410` | Silt hanya dari kill Warden dan boss; suku per Pulse dan bonus menang GDD 17.1 tidak ada kuncinya, jadi run kalah memberi 0 sampai 4 Silt | Diperbaiki: kunci `silt_per_pulse` (1) dan `silt_win` (10) dari GDD 17.1, rumus penuh, tes Silt saat Abandon |
| M4 | `src/render/sprites/entity-layers.ts:383`, `src/render/shaders/post-composite.ts` | Keterbacaan pemain: kilat hit mengganti seluruh sprite dengan `kept-white` (alpha 1), dan bloom dari efek pemain (pungut Glint, cincin, flare Rite) menumpuk di atas sprite. Di Pulse padat pemain sering tampak sebagai siluet putih polos | Diperbaiki: kilat hit menjadi tint 0,6 (`PLAYER_HIT_FLASH_ALPHA`), komposit menahan 85% bloom di piksel yang tertutup mask pemain (`PLAYER_BLOOM_HOLD`). Dicek di 8 frame pungut Glint: frame kena hit kini tetap menampilkan topi dan jubah |
| M5 | `src/audio/index.ts` lewat `src/app/boot.ts` | Kode audio (synth, 14 lagu, cue) ada di chunk awal: JS awal 294 KB, di atas tujuan 280 KB | Diperbaiki: `src/app/lazy-audio.ts` memuat `src/audio` pada gesture pertama atau saat idle (maks 2 s), menyimpan dan memutar ulang settings, arena, jeda, hidden. `bundle:check` membaca `index.html` untuk menentukan file awal; chunk lazy dan Worker dilaporkan terpisah. 2 tes unit |
| M6 | `src/sim/systems/projectiles.ts:421` | Perbaikan GD Homeward Blade (reset memori hit hanya saat berbalik). Ditinjau: benar, `rangeLeft` tidak berkurang saat kembali sehingga cabang `phase 0 -> 1` hanya sekali per lemparan | Disetujui. Tes regresi baru: satu lemparan mengenai target besar maksimal 2 kali (gagal dengan kode lama: 8 hit) |

### MINOR (terbuka, pemilik dalam kurung)

1. (AD) 10 Memento Tingkat B (`tuning_fork`, `rite_chime`, `iron_thimble`, `glass_aegis`, `collector_pin`, `dust_hourglass`, `lucky_button`, `magpie_tin`, `haggler_seal`, `grinding_wheel`) dan 2 Rite (`great_toll`, `glass_step`) belum punya ikon; UI memakai monogram (terlihat di toko: "CP"). UI sudah memakai ikon AD lewat `buildIconAtlas`/`iconImage` di semua kartu, slot, HUD Rite, pilih kelas (potret `kept-*`, ikon senjata dan Rite), dan The Keeping.
2. (AU) `src/audio/audio-system.ts:182`: bila `ctx.resume()` menggantung (aktivasi ketat ala Safari), `unlock()` berikutnya mengembalikan promise yang sama dan tidak pernah memanggil `resume()` lagi. Dimitigasi prefetch idle (chunk biasanya sudah ada sebelum gesture pertama, jadi unlock jalan sinkron di dalam gesture). Saran: panggil `resume()` ulang bila `unlock()` dipanggil saat masih tertunda.
3. (AU) Cue `ui.unlock` belum ada; The Keeping memakai `ui.confirm`.
4. (GP) `projectiles.ts:213` `rememberHit`: saat ring penuh indeks timpa `(n + tick) % M`, bukan entri tertua. Aman untuk determinisme, tapi namanya menyesatkan.
5. (GP) `boss.ts:37-43` buffer scratch dan cache `WeakMap` tingkat modul dibagi antar instance sim. Aman selama satu thread; catat bila sim pindah ke Worker.
6. (WR, LP) Parameter teks: 11 teks kini memakai angka dari data (`class.bell.passive` `{mark}`, `class.blade.passive`, `rite_chime`, `glass_aegis`, `collector_pin`, `lucky_button`, `haggler_seal`, `pyre_bell`, `wick_charm`, `patched_cloak`, `ledger_page`), cek string B dan C 0 error. Sisa angka tertulis: `rite.glass_step.desc` (3 hit), `weapon.echo_bell.desc`, `syn.echo.*`, `syn.ward.6`, `syn.trade.*`, `affix.*`. WR perlu memperbarui `docs/narrative/string-table.md` 4.1.
7. (GD) `classes.csv` dan `weapons.csv` kolom `unlock_silt` menduplikasi biaya di `meta_unlocks.csv`. Aturan kini memakai `meta_unlocks` (kolom lama hanya cadangan bila tidak ada baris unlock). Sarankan satu sumber.
8. (UI) The Keeping versi minimal (satu daftar unlock, saldo, pola "Press again" 3 s). Tab Mementos, penghitung "found", dan potret detail S09 tetap tugas UI M3.
9. (QA) `smoke-msedge.spec.ts` gagal sekali di suite penuh (KeyD bergerak 0 u, loop tampaknya tertahan), lulus 4 dari 4 saat dijalankan sendiri. Pantau sebagai flaky.

## 3. Sambungan lintas peran (A1 sampai A7)

| Butir | Keputusan |
|---|---|
| A1 kunci config | Sim membaca kunci data GD apa adanya. Dengan `glint_fly_accel` 0 butir terbang di kecepatan puncak (perilaku M1), bukan di kecepatan awal |
| A2 Homeward Blade | Disetujui (M6) |
| A3 KeyB setelah Continue | B1 |
| A4 bundle | M5. Target 280 KB tercapai (269,4 KB dengan data B) |
| A5 keterbacaan | M4 |
| A6 ikon dan petunjuk | Ikon AD sudah dipakai di semua kartu; pilih kelas kini menampilkan potret dan ikon senjata/Rite. `MetaView.runs?` (aditif): petunjuk kontrol hanya di Pulse 1 run pertama |
| A7 parameter teks | MINOR 6. Parameter baru di `ownerTextParams`: kunci param numerik apa pun dengan namanya sendiri, `mark`, `spread_pct`, `discount_pct`, `reroll_less`, stat buff (`attack_speed_pct`), `icd`, `hurt_s` |

## 4. Tingkat B sebagai build default

- `content/build.json` `{ "contentTier": "B" }`. Profil app dari `defaultRunProfile`: `run_b` (15 Pulse, Warden P4 dan P10, boss P15).
- 3 kelas, 8 senjata, 22 Memento, 6 tag (data GD). Lamplighter terbuka; Chorister 60 Silt, Vintner lewat `unlock_blade`.
- **[Asumsi] `unlock_blade.cost_silt_b` = 6** (kolom khusus B, biaya C tetap 40). Alasan: bot naive `run_b` kalah dengan median 3 Silt per run, sehingga pada biaya 40 pemain baru butuh sekitar 13 run kalah. Dengan 6, kelas kedua terbuka setelah 1 sampai 2 run. Dicatat di baris komentar `meta_unlocks.csv`. GD menyetel ulang di M3.
- Silt diberikan sekali di akhir run (menang, kalah, Abandon) dan disimpan di `shardfall.meta.v1`. Layar akhir run menampilkan Silt didapat, saldo, "New unlock available", dan tombol The Keeping. Judul menampilkan saldo Silt.
- Pilih kelas: 3 kelas dengan potret; kelas terkunci gelap dengan harga Silt; Begin menjadi "Unlock in The Keeping" dan membuka The Keeping. Kembali dari The Keeping ke layar asal.
- Screenshot: Pulse ramai tetap terbaca (pemain biru dengan cincin cyan di tengah kerumunan dan telegraf), toko menampilkan Memento B dengan parameter data, The Keeping menampilkan saldo, status per baris (dapat dibeli, kurang Silt dicoret, dimiliki).

## 5. Bot GD `run_b` (20 seed per baris, data `2008c1b6`)

| Kelas | Bot | Menang | Silt median per run (kalah / menang) | Kematian |
|---|---|---|---|---|
| lantern | naive | 25% | 3 / 41 | P3 x4, P4 x7, P5 x2, P6, P10 |
| lantern | good | 80% | 3 / 41 | P4 x3, P10 |
| bell | naive | 10% | 3 / 41 | P3 x4, P4 x13, P6 |
| bell | good | 55% | 3 / 41 | P4 x8, P10 |
| blade | naive | 70% | 5,5 / 41 | P4 x3, P5, P6, P10 |
| blade | good | 95% | 3 / 41 | P4 |

Menang memberi 41 Silt (15 + 8 + 8 + 10, sama dengan contoh GDD 17.1). Warden P4 adalah dinding utama bagi bot naive. `tools/balance/bot/run-bots.ts` kini mencetak baris Silt per run.

## 6. E2E

- `meta-unlock.spec.ts` (baru): kelas terkunci, Silt lewat hook `grantSilt`, beli Vintner dengan pola "Press again", kembali ke pilih kelas, mulai run `run_b` sebagai Vintner, `run.start.unlocked` = `['unlock_blade']`.
- `keyboard-play.spec.ts` lulus tanpa perubahan tes.
- `npm run test:e2e` suite penuh: 18 dari 18 lulus (4,9 menit), termasuk D-5, D-8, full-run, keyboard-play, smoke Chrome, Edge, Firefox, WebKit.

## 7. Catatan untuk QA

- Golden replay `tests/unit/qa/replays/golden-*.json` dibuat ulang dengan `QA_UPDATE_GOLDEN=1`. Alasan: (1) tanda spawn grup 3 atau lebih kini memakai radius sedang (kunci `spawn_mark_medium_group_min` akhirnya dibaca), sehingga titik spawn bergeser; (2) hash state memuat kolom unlock run. Bukan regresi; sebelum regenerasi divergensi pertama muncul di tick 120 sampai 180 tepat karena tanda grup.
- Hook baru `window.__shardfall.grantSilt(n)` hanya ada di build e2e (dibuat di cabang `__E2E__` boot).
