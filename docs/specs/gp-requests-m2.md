# Permintaan Data dan Kontrak dari GP (M2-05)

Pemilik: GP. Untuk: GD (data), LP (skema dan kontrak). Tanggal: 2026-11-17.
Semua kunci di bawah sudah dibaca sim. Bila kunci tidak ada, perilakunya nonaktif (tidak ada angka cadangan di kode).

## Untuk GD (angka)

| # | Tabel dan kunci | Arti | Nilai usulan | Tanpa kunci |
|---|---|---|---|---|
| 1 | `config.csv` `spawn_mark_medium_group` (int) | Grup sebesar ini atau lebih memakai tanda spawn minimal medium (GDD 3.2) | 3 (GDD 3.2) | Tanda memakai ukuran jenisnya sendiri. **Prioritas tinggi**: tanpa ini tanda grup swarmer lebih kecil dari M1 |
| 2 | `config.csv` `glint_fly_accel` (float, u/s^2) | Percepatan Glint yang melesat ke pemain (CD M1 4 butir 2) | GD memilih, misal 40 | Kecepatan konstan `glint_fly_speed` |
| 3 | `config.csv` `glint_fly_speed_max` (u/s) | Batas kecepatan Glint saat dipercepat | GD memilih, misal 24 | Tanpa batas selama terbang |
| 4 | `boss_patterns.csv` `spiral` param `turns` | Putaran lengan spiral selama `duration` | 1 | 1 putaran per durasi |
| 5 | `weapon_tiers.csv` `orbit_shards` tier 4 param `lunge_s` | Lama melesat keluar dan kembali | opsional | Waktu tempuh pada kecepatan orbit (sekitar 1 s dengan data sekarang) |
| 6 | `effects.csv` `smolder_boots_1` `max_alive` | CD M1 4 [S]: maksimal 4 tambalan sekaligus | 4 | tetap 6 |

## Keputusan GP yang perlu dikonfirmasi GD

1. [Asumsi] Exploder yang meledak sendiri tidak dihitung kill dan tidak menjatuhkan Glint.
2. [Asumsi] Panggilan summoner dan affix `brood` tidak dihitung ke `alive_cap`.
3. Timer affix (blinking, brood, pulsing, tar) mulai setelah masa tenggang spawn; interval pertama dihitung dari spawn.
4. Telegraf data di bawah minimum kategori dinaikkan ke minimum (`telegraph_min_*`). Data sekarang tidak ada yang di bawah.

## Untuk LP (skema, registri, kontrak)

1. `src/content/tables/config.ts`: deklarasikan `spawn_mark_medium_group` (int, min 1), `glint_fly_accel` (float, min 0, kunci GameData `glintFlyAccel`), `glint_fly_speed_max` (uPerSec, kunci `glintFlySpeedMaxUPerTick`). Sim membacanya lewat `cfgOpt` dengan nama kunci itu.
2. `src/content/params-registry.ts`: tambah `turns` (number) ke `boss_patterns.spiral`.
3. Build data: error bila lebih dari 4 Memento dengan `every_nth @per_target` bisa aktif bersamaan (sim kini menghitungnya di `poolOverflow`, tidak diam).
4. `docs/tech/architecture.md` bagian 6.5 dan 19: catat event 71 sampai 78, bit dampak `EnemyDamaged.b` 7-8, `PickupPoolView.flyTicks`, `RunSaveV1.rewardSourceId` dan `levelsThisPulse`, tiga event prioritas rendah baru di `event-buffer.ts`. Detail di `docs/specs/gp-m2-slice.md` 3.
5. `contentHash` save tetap tidak dibandingkan (id string divalidasi). Mohon konfirmasi.
