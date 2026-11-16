# Efek Primitif

Pemilik: Game Designer. Status: draf M0 versi 1, 2026-11-16. Reviewer: LP (kelayakan), GP (implementasi).
Terkait: `docs/gdd.md` bagian 8, 9, 10; `docs/systems/data-schema.md` (tabel `effects.csv`).

## 1. Tujuan

Semua Keepsake, ambang sinergi, dan pasif kelas dibangun dari satu set kecil blok yang bisa digabung. GP cukup mengimplementasikan 16 pemicu, 15 syarat, dan 16 aksi; konten baru cukup ditambah lewat CSV tanpa kode baru. Senjata dan Rite tetap punya kode arketipe sendiri (8 senjata, 3 Rite), tetapi serangan mereka memancarkan event yang sama sehingga efek bisa menempel.

## 2. Bentuk satu efek

```
effect = {
  id, trigger, conditions[], chance, icd, max_per_pulse, allow_proc, stack_mode,
  action, params
}
```

| Field | Tipe | Default | Arti |
|---|---|---|---|
| `id` | string | | Unik, `snake_case` |
| `trigger` | enum | | Bagian 3 |
| `conditions` | daftar `nama:nilai` | kosong | Semua harus lolos (AND). Bagian 4 |
| `chance` | 0 sampai 1 | 1 | Peluang setelah syarat lolos |
| `icd` | detik | 0 | Jeda internal per pemilik efek |
| `max_per_pulse` | int | 0 (tanpa batas) | Batas pemicu per Pulse |
| `allow_proc` | 0 atau 1 | lihat 6.2 | Boleh dipicu oleh damage proc |
| `stack_mode` | `value`, `chance`, `none` | `value` | Cara salinan Keepsake bertumpuk (6.3) |
| `action` | enum | | Bagian 5 |
| `params` | `kunci=nilai;kunci=nilai` | | Parameter aksi |

Pemilik efek (owner) adalah Keepsake, ambang sinergi, atau kelas. Satu pemilik boleh punya beberapa efek (contoh: Glass Aegis punya 2).

## 3. Pemicu

| Pemicu | Kapan | Konteks yang tersedia |
|---|---|---|
| `passive` | Selalu, selama dimiliki. Syarat bersifat kontinu dan dievaluasi ulang tiap tick (contoh `time_since_hurt`, `has_barrier`) | pemain |
| `on_hit` | Damage pemain mengenai Unlit | sumber (senjata, tag, kind, is_proc, is_rite), target, damage, crit |
| `on_crit` | Seperti `on_hit`, hanya bila kritikal | sama |
| `on_kill` | Unlit mati oleh damage pemain | posisi, status target, hit pembunuh, crit, jenis target |
| `on_hurt` | Pemain kehilangan HP (setelah armor) | damage, sumber |
| `on_block` | Barrier menyerap hit | muatan tersisa |
| `on_dodge` | Pemain menghindari hit | sumber |
| `on_pickup` | Pemain memungut satu butir Glint | nilai butir |
| `on_rite` | Rite dirapal | rite id, arah |
| `on_area` | Efek area milik pemain meledak (senjata, Rite, atau proc) | posisi, radius, damage, tag |
| `on_projectile_end` | Proyektil pemain habis karena jangkauan atau tembus | posisi, arah, damage, tag |
| `periodic` | Tiap `interval` detik selama Pulse (param `interval`) | pemain |
| `on_distance` | Tiap `distance` u ditempuh pemain (param `distance`) | posisi |
| `on_pulse_start` | Awal Pulse | threat |
| `on_pulse_end` | Akhir Pulse sebelum fase toko | threat, unhurt |
| `on_shop_start` | Fase toko dibuka | Glint tersimpan |

## 4. Syarat

| Syarat | Nilai | Lolos bila |
|---|---|---|
| `source_tag` | tag | Sumber hit membawa tag itu |
| `source_kind` | `projectile`, `melee`, `area`, `chain`, `contact`, `zone`, `dot` | Jenis serangan sumber cocok |
| `source_weapon` | id senjata | Sumber dari senjata itu |
| `target_has_status` | `burn`, `slow`, `mark` | Target punya status itu |
| `target_within` | u | Target dalam jarak itu dari pemain |
| `target_hp_below` | 0 sampai 1 | HP target (sesudah hit) di bawah fraksi itu |
| `target_hp_full` | 1 | HP target penuh sebelum hit |
| `target_is` | `normal`, `warden`, `boss`, `not_boss` | Jenis target |
| `every_nth` | `n` atau `n@scope` (scope: `global`, `per_weapon`, `per_target`) | Pemicu ke-n untuk scope itu. Penghitung reset di awal Pulse |
| `player_hp_below` | 0 sampai 1 | HP pemain di bawah fraksi |
| `time_since_hurt` | detik | Pemain tidak terluka selama minimal sekian detik |
| `has_barrier` | 1 | Pemain punya minimal 1 muatan Barrier |
| `held_glint_at_least` | int | Glint tersimpan minimal sekian |
| `killed_by_crit` | 1 | Hit pembunuh kritikal |
| `unhurt_this_pulse` | 1 | Pemain tidak kehilangan HP selama Pulse ini |

## 5. Aksi

| Aksi | Parameter | Catatan |
|---|---|---|
| `stat_mod` | `stat`, `op` (`add`, `mult`, `min`), `value` | Hanya untuk `passive`. `min` mengambil nilai terkecil yang bukan nol (dipakai untuk waktu isi ulang) |
| `buff` | `stats` (`stat:nilai\|stat:nilai`), `duration`, `max_stacks`, `refresh` (0/1) | Stat sementara. Tumpukan baru menyegarkan durasi bila `refresh=1` |
| `hit_mod` | `mode` (`bonus`, `vuln`, `force_crit`, `crit_mult_add`), `value` | Mengubah hit yang sedang dihitung. Hanya untuk `on_hit`. Lihat urutan 6.1 |
| `apply_status` | `status` (`burn`, `slow`, `mark`, `knockback`), `stacks`, `duration`, `value` | `value`: persen Slow, persen Mark, jarak knockback. Burn memakai 30% damage hit pemicu per detik, atau `dps` bila sumbernya bukan hit |
| `status_rule` | `status`, `rule` (`dmg_mult`, `spread_chance`, `spread_range`, `add_mark`), `value` | Mengubah aturan global sebuah status. Hanya untuk `passive` |
| `spawn_projectile` | `pattern` (`aimed`, `seek_other`, `ring`, `fan`, `split`, `toughest`), `count`, `dmg` atau `dmg_frac`, `speed`, `range`, `pierce`, `origin` (`player`, `target`, `point`), `tags`, `kind` | `dmg` = damage proc (dikali `proc_scale`), `dmg_frac` = fraksi damage hit pemicu |
| `spawn_area` | `shape` (`circle`, `ring`), `radius`, `dmg` atau `dmg_frac`, `delay`, `status`, `knockback`, `origin` | Ledakan sekali. Memicu `on_area` |
| `spawn_zone` | `radius`, `duration`, `tick`, `dmg`, `status`, `origin`, `max_alive` | Zona lantai yang bertahan |
| `execute` | | Membunuh target. Selalu dipasangkan dengan syarat `target_is` |
| `heal` | `amount`, `max_per_sec` | |
| `gain_barrier` | `charges` | Mengisi sampai `max(barrier_max, 1)` |
| `gain_glint` | `mode` (`direct`, `drop`, `same`, `interest`, `formula`), `amount`, `div`, `cap`, `base`, `per_t` | `same` = butir yang dipungut dihitung dua kali. `interest` = floor(Glint tersimpan / `div`), maks `cap`. `formula` = `base + per_t x t` |
| `repeat` | `what` (`area`, `rite`, `hit`), `delay`, `power`, `target` (`same`, `nearest_other`), `range` | Salinan selalu berstatus proc |
| `trigger_weapons` | `scope` (`all` atau tag), `power` | Semua senjata dalam scope langsung menyerang sekali, tanpa mereset cooldown |
| `shop_mod` | `field` (`slots`, `price_mult`, `reroll_delta`, `free_rerolls`), `value` | Hanya untuk `passive`. Dibaca oleh toko |
| `convert` | `from` (`armor`, `held_glint`, stat lain), `to` (stat), `ratio`, `cap` | Hanya untuk `passive`. `to += from x ratio`, maksimal `cap` |

## 6. Aturan mesin

### 6.1 Urutan evaluasi satu hit

1. Bangun konteks hit (sumber, target, damage dasar).
2. Efek `hit_mod` dengan `mode=force_crit` dievaluasi.
3. Gulir kritikal (kecuali sudah dipaksa).
4. Efek `hit_mod` lain (`bonus`, `vuln`, `crit_mult_add`) dievaluasi dan dijumlah ke Σbonus dan Σrentan.
5. Hitung damage akhir (gdd.md 5.2), terapkan ke target.
6. Efek `on_hit` lain dan `on_crit` (status, proyektil, area, execute) dievaluasi.
7. Bila target mati: efek `on_kill`.

Urutan antar pemilik tetap dan deterministik: pasif kelas, lalu Keepsake menurut urutan didapat, lalu sinergi menurut urutan tag Flame, Shard, Edge, Echo, Ward, Trade dan ambang naik. Di dalam satu pemilik: urutan baris di `effects.csv`.

### 6.2 Pengaman rekursi

- Damage dari aksi efek (`spawn_projectile`, `spawn_area`, `spawn_zone`, `repeat`, Burn) berstatus **proc**.
- Hit proc hanya memicu efek dengan `allow_proc=1`. Default: `hit_mod` dan `apply_status` = 1, aksi lain = 0.
- Kedalaman rantai maksimal 1: efek yang dipicu oleh proc tidak pernah memicu efek lain lagi, apa pun `allow_proc`-nya.
- Rite bukan proc (Rite memicu `on_hit` biasa), tetapi damage Rite memakai rumus damage proc.
- [Asumsi, angka milik LP] Batas performa: maksimal 200 proyektil proc hidup dan 24 zona hidup; spawn di atas batas dilewati.

### 6.3 Tumpukan Keepsake

| `stack_mode` | Arti |
|---|---|
| `value` | Nilai `stat_mod` dan `value` dikali jumlah salinan |
| `chance` | `chance` dikali jumlah salinan (maks 1) |
| `none` | Salinan tambahan tidak mengubah apa pun (dipakai untuk Keepsake unik) |

### 6.4 RNG dan determinisme

- Semua `chance` dan pilihan target acak memakai aliran RNG `combat` milik simulasi.
- `periodic` memakai timer simulasi yang mulai dari 0 di awal Pulse.
- Target "terdekat" diputus seri dengan id entitas terkecil.

## 7. Contoh pengodean

Format baris mengikuti `effects.csv` (data-schema.md). Kolom yang kosong memakai default.

| id | owner | trigger | conditions | chance | icd | stack_mode | action | params |
|---|---|---|---|---|---|---|---|---|
| `coal_locket_1` | `coal_locket` | on_hit | | 0.08 | | chance | apply_status | status=burn;stacks=1;duration=3 |
| `kindling_jar_1` | `kindling_jar` | on_hit | target_has_status:burn | | | none | hit_mod | mode=vuln;value=0.2 |
| `headsman_hook_1` | `headsman_hook` | on_hit | target_is:normal\|target_hp_below:0.12 | | | none | execute | |
| `glass_aegis_1` | `glass_aegis` | on_pulse_start | | | | none | gain_barrier | charges=1 |
| `glass_aegis_2` | `glass_aegis` | on_block | | | | none | spawn_area | shape=circle;radius=3;dmg=10;knockback=1;origin=player |
| `patched_cloak_1` | `patched_cloak` | passive | time_since_hurt:4 | | | none | stat_mod | stat=hp_regen;op=add;value=2 |
| `syn_flame_4` | `syn_flame_4` | on_kill | target_has_status:burn | | | none | spawn_area | shape=circle;radius=1.5;dmg=6;status=burn;origin=target |
| `syn_shard_4` | `syn_shard_4` | on_projectile_end | source_tag:Shard | | | none | spawn_projectile | pattern=split;count=3;dmg_frac=0.4;origin=point |
| `syn_shard_6` | `syn_shard_6` | periodic | | | | none | spawn_projectile | interval=2;pattern=toughest;count=1;dmg=25;pierce=99;speed=20 |
| `syn_echo_2` | `syn_echo_2` | on_area | | | | none | repeat | what=area;delay=0.5;power=0.35 |
| `syn_ward_2a` | `syn_ward_2` | passive | | | | none | stat_mod | stat=barrier_max;op=add;value=1 |
| `syn_ward_2b` | `syn_ward_2` | passive | | | | none | stat_mod | stat=barrier_recharge;op=min;value=14 |
| `syn_trade_2` | `syn_trade_2` | on_shop_start | | | | none | gain_glint | mode=interest;div=8;cap=12 |
| `syn_trade_6a` | `syn_trade_6` | passive | | | | none | convert | from=held_glint;to=damage_pct;ratio=0.1;cap=50 |
| `class_lantern_1` | `lantern` | passive | | | | none | status_rule | status=burn;rule=dmg_mult;value=1.3 |
| `class_blade_1` | `blade` | on_kill | target_within:2.5 | | | none | heal | amount=1;max_per_sec=3 |

## 8. Pemetaan semua pemilik

Ringkasan agar GP bisa mengecek cakupan. Teks efek lengkap di gdd.md.

| Pemilik | Pemicu dan aksi |
|---|---|
| Flame 2 | on_hit: apply_status burn (chance 0.1) |
| Flame 4 | on_kill + target_has_status burn: spawn_area |
| Flame 6 | passive: status_rule burn add_mark; periodic 6: spawn_area radius 4, status burn, dmg 0 |
| Shard 2 | on_kill + source_kind projectile: spawn_projectile split 2 |
| Shard 4 | on_projectile_end + source_tag Shard: spawn_projectile split 3 |
| Shard 6 | periodic 2: spawn_projectile toughest |
| Edge 2 | on_hit + target_within 2.5: hit_mod bonus 0.25; apply_status knockback 0.5 |
| Edge 4 | on_crit: spawn_projectile aimed, range 3, pierce 99, dmg_frac 0.5, kind melee |
| Edge 6 | on_crit: buff attack_speed_pct 5 dan move_speed 3, 3 s, maks 10 |
| Echo 2 | on_area: repeat area 0.35 |
| Echo 4 | on_rite: repeat rite, delay 1, power 0.5 |
| Echo 6 | periodic 8: trigger_weapons all |
| Ward 2 | passive: stat_mod barrier_max +1, barrier_recharge min 14 |
| Ward 4 | passive: stat_mod barrier_max +1, barrier_recharge min 10 |
| Ward 6 | passive: convert armor ke damage_pct ratio 2; passive + has_barrier: stat_mod attack_speed_pct +20 |
| Trade 2 | on_shop_start: gain_glint interest |
| Trade 4 | passive: shop_mod free_rerolls +1, shop_mod slots +1 |
| Trade 6 | passive: convert held_glint; stat_mod pickup_radius_pct +50 |
| Kelas `lantern` | passive: status_rule burn dmg_mult 1.3 |
| Kelas `bell` | passive: status_rule knockback add_mark 2 |
| Kelas `blade` | on_kill + target_within 2.5: heal 1 |
| Keepsake 1 sampai 30 | Kolom "Primitif" di gdd.md bagian 9 |

Semua 30 Keepsake, 18 ambang sinergi, dan 3 pasif kelas tercakup oleh 16 pemicu, 15 syarat, dan 16 aksi di atas.
