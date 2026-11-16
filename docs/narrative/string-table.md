# Shardfall: Catatan String Table

Pemilik: Writer (WR). Reviewer: CD (teks dan nama), UI dan LP (kunci dan parameter). Status: versi 2 (2026-11-17, tugas M2-08). Versi 1: M1-08.
File: `content/strings/en.json` (teks game, dibaca build data) dan `content/strings/id.json` (Indonesia, kunci sama, dimuat lazy lewat `?lang=id`). Format sesuai architecture.md 9.7: objek JSON datar, kunci bertitik `snake_case`, parameter `{nama}`, baris efek dipisah `\n`.

## 1. Cakupan versi 2

- Semua kunci UI Lampiran A ui-spec, dengan istilah keputusan CD (bagian 3), plus kunci tambahan untuk layar yang sama.
- Konten Tingkat A: kelas `lantern` dan Rite `flare_lantern`, 6 senjata, 12 Memento, tag (6 nama, efek ambang Flame, Shard, Edge), 4 Unlit, `warden_hound`, `boss_lantern`, affix `hasted` dan `volley`, 21 stat, 14 kartu Temper, rarity, status, 3 bioma dengan kalimat pembuka, teks akhir run.
- **Baru di versi 2 (M2-08):**
  - Perbaikan "a 8% chance": `memento.coal_locket.desc` kini "Burns foes on {chance}% of hits." (benar untuk angka berapa pun).
  - 22 baris the Glazier untuk 11 pemicu (bagian 2.1).
  - Banner Warden, boss, akhir Pulse, dan nama dengan julukan (`ui.banner.*`), petunjuk kontrol Pulse 1 (`ui.hud.hint_*`).
  - Nama tampil affix `affix.<id>.name` (opsional untuk UI, misalnya di banner Warden atau panel jeda).
  - **Semua teks Tingkat B dan C** (91 kunci yang dirujuk data, ditambah deskripsi Unlit dan julukan): kelas `bell` (Chorister) dan `blade` (Vintner) beserta peran, pasif, Rite `great_toll` dan `glass_step`, senjata `echo_bell`, 18 Memento B dan C, efek ambang Echo, Ward, Trade, Unlit `exploder`, `summoner`, `mote`, `lobber`, Warden `warden_choir` dan `warden_bulwark`, boss `boss_bell` dan `boss_vine`, affix `veiled`, `blinking`, `brood`, `tar_trail`, `pulsing`, `bulwark`.
  - Review 14 kunci yang ditambahkan LP di M1-09a (bagian 3.1).
- Cek: build tingkat A, B, dan C lolos `check-strings.ts` dengan 0 error dan 0 peringatan (bagian 5).

## 2. Pola kunci

Mengikuti kolom `*_key` di data GD (data-schema v2) dan fixture LP. Bila berbeda dengan pola di ui-spec 11 (`item.*.effect`, `tag.*.tier<n>`), pola di bawah yang berlaku karena dirujuk data.

| Konten | Kunci | Catatan |
|---|---|---|
| Kelas | `class.<id>.name`, `.desc` (tagline 1 baris), `.role` (baris peran di daftar S02), `.passive` | `.role` dan `.passive` tidak dirujuk data, dipakai UI |
| Rite | `rite.<id>.name`, `.desc` | |
| Senjata | `weapon.<id>.name`, `.desc` | |
| Memento | `memento.<id>.name`, `.desc`, `.flavor` | |
| Unlit, Warden, boss | `unlit.<id>` (nama), `unlit.<id>.desc`, `unlit.<id>.epithet` (Warden dan boss) | Nama tanpa akhiran, sesuai `name_key` di `enemies.csv` |
| Affix | `affix.<id>` (efek, dirujuk `affixes.csv`), `affix.<id>.name` (nama tampil, opsional) | |
| Tag | `tag.<id>.name`, `tag.<id>.abbr` (singkatan 2 huruf kartu) | |
| Efek ambang tag | `syn.<tag>.<ambang>` | Untuk "Unlocks: {effect}" di panel Tag |
| Stat | `stat.<id>` | `display_key` di `stats.csv` |
| Kartu Temper | `card.<nama>` | `desc_key` di `levelup.csv` |
| Status, rarity | `status.<id>`, `rarity.<id>` | |
| Bioma | `biome.<id>.name`, `biome.<id>.intro` | Intro tampil sekali saat Vitrine dimulai |
| the Glazier | `glazier.<pemicu>` dan varian `glazier.<pemicu>.<n>` | Bagian 2.1 |
| Banner | `ui.banner.*` | Bagian 3.2 |
| Akhir run penuh | `ending.light_kept.1` sampai `.4` | Satu baris per ketukan (lore-premise 8) |

### 2.1 Baris the Glazier (potret toko, 1 baris, maks 45 karakter)

Kunci dasar (`glazier.<pemicu>`) adalah varian 1. Varian tambahan memakai akhiran `.2`, `.3`. Semua kunci dasar versi 1 tetap ada (tidak ada kunci yang diganti nama).

| Pemicu | Kunci | Kapan | Baris EN |
|---|---|---|---|
| `first` | `glazier.first` | Toko pertama di run | I knew the last Kept here. Same eyes. |
| `boss_next` | `glazier.boss_next`, `.2` | Toko sebelum Pulse boss | The next crack is the deepest. Mind it. / Something large is drinking the light. |
| `warden_fell` | `glazier.warden_fell`, `.2` | Toko setelah Warden kalah | A Warden fell. I heard it three cracks away. / That Warden swallowed much. You spilled it. |
| `low_hp` | `glazier.low_hp`, `.2` | Toko dibuka dengan HP di bawah ambang HP rendah UI (30%) | You are cracking, Kept. I can hear it. / Careful. You are more crack than glass. |
| `after_temper` | `glazier.after_temper` | Toko setelah Temper | You came back brighter. Good. |
| `open` | `glazier.open`, `.2`, `.3` | Toko dibuka (cadangan) | Mind the edges. Everything I sell has one. / Still lit, Kept? Then let us deal. / Pieces from other Vitrines. Look closely. |
| `bought` | `glazier.bought`, `.2`, `.3` | Setelah membeli | It suits you. Most things do, briefly. / Carry it well. Its owner could not. / Done. Glass remembers who paid. |
| `reroll` | `glazier.reroll`, `.2`, `.3` | Setelah reroll | Another tray. There are always more cracks. / Not that tray? I have others. / Fine. I will reach into another crack. |
| `no_glint` | `glazier.no_glint`, `.2` | Beli atau reroll ditolak karena Glint kurang | Not enough Glint. The dark has plenty. / Come back heavier. The dark is generous. |
| `fuse` | `glazier.fuse` | Setelah Fuse | Two alike melt into one. Glass remembers. |
| `begin` | `glazier.begin`, `.2` | Tombol Begin Pulse ditekan (tampil singkat saat keluar) | Go. The light is drawing breath. / Go. Keep the light a little longer. |

Aturan pilih [Saran untuk UI]:
- Saat toko dibuka, ambil pemicu pertama yang berlaku menurut urutan tabel: `first`, `boss_next`, `warden_fell`, `low_hp`, `after_temper`, `open`.
- Saat aksi (`bought`, `reroll`, `no_glint`, `fuse`, `begin`), baris berganti ke pemicu aksi itu.
- Varian dipilih deterministik di presentasi (misalnya penghitung per pemicu yang berputar), **bukan** RNG sim, dan tidak pernah baris yang sama dua kali berturut-turut (lore-premise 7).
- Pemilihan varian membaca daftar kunci yang ada (`glazier.<pemicu>`, `.2`, `.3`, berhenti di kunci pertama yang tidak ada), jadi WR boleh menambah varian tanpa perubahan kode.

## 3. Kunci UI

### 3.1 Perubahan kunci dari Lampiran A ui-spec (untuk UI, dari versi 1)

| Lampiran A | Kunci versi 1 | Teks |
|---|---|---|
| `ui.title.archive` | `ui.title.keeping` | The Keeping |
| `ui.end.archive` | `ui.end.keeping` | The Keeping |
| `ui.archive.*` | `ui.keeping.*` | Tab `tab_kept`, `tab_mementos` |
| `ui.archive.tab_keepsakes` | `ui.keeping.tab_mementos` | Mementos |
| `ui.shop.keepsakes` | `ui.shop.mementos` | Mementos |
| `ui.reward.title` | sama | Take a Memento |
| `ui.levelup.title` | sama | Temper (tanpa angka); angka di `ui.levelup.level` "Lv {n}" |
| `ui.shop.merge`, `ui.shop.merge_tier` | sama | Fuse, "Fuse > {tier}" |
| `ui.class.difficulty` | sama | Crack {n} |
| `ui.class.locked` | sama | Unlock in The Keeping |
| `ui.end.won` | sama | Light Kept |
| `ui.hud.hint_move` | sama | "{keys} Move" (binding aktif, ui-spec 6.2) |
| `ui.settings.shop_timer` | sama | Glazier Timer (kata Shop terlarang) |

Review 14 kunci tambahan LP (M1-09a), semuanya dipertahankan: `ui.action.fuse` (Fuse), `ui.action.sell` (Sell), `ui.common.denied` (Not possible now), `ui.credits.body` (placeholder kredit, diganti saat kredit final M5), `ui.settings.mono` (Mono Audio), `ui.settings.reduce_repeats` (Reduce Repeats), `ui.settings.ui_volume` (Interface), `ui.shop.reroll_free` (Free), `ui.shop.sell_for` (Sell for {n} Glint), `ui.tier.1` sampai `.4` (I sampai IV), `ui.title.name` (Shardfall, judul kerja). Semua lolos batas dan tanpa kata terlarang. Satu perbaikan ID: `ui.shop.sell_for` kini "Jual seharga {n} Kerlip" (glosarium: Glint = Kerlip).

### 3.2 Kunci UI baru versi 2 (usulan untuk Lampiran A ui-spec)

| Kunci | Teks EN | Pakai |
|---|---|---|
| `ui.hud.hint_pause` | {key} Pause | Petunjuk kontrol Pulse 1 |
| `ui.hud.hint_auto` | Arms fire on their own | Petunjuk Pulse 1: serangan otomatis |
| `ui.hud.hint_glint` | Pass near Glint to gather it | Petunjuk Pulse 1: memungut |
| `ui.banner.pulse_steady` | Pulse {n} Steady | Banner akhir Pulse (fase `pulseClear`), selaras "Vitrine Steady" |
| `ui.banner.warden` | A Warden Wakes | Baris kecil di atas nama Warden |
| `ui.banner.boss` | The Deepest Crack Opens | Baris kecil di atas nama boss (kata "boss" tidak tampil) |
| `ui.banner.name_epithet` | {name}, {epithet} | Nama plus julukan di banner kedatangan, contoh "Brass Collar, the Thrice-Leaping" |

Kunci yang sudah ada dan dipakai banner: `ui.banner.pulse_held` (Pulse {n} Held), `ui.hud.held` (Held), `unlit.<id>` dan `unlit.<id>.epithet`. Petunjuk Pulse 1 yang sudah ada: `ui.hud.hint_move`, `ui.hud.hint_rite`.

## 4. Parameter teks efek (diisi dari data, bukan ditulis di teks)

Nilai persen ditulis sebagai angka bulat tanpa tanda persen (tanda ada di teks). Pecahan data (0.08) dikali 100. Sumber: `src/content/rules/text-params.ts`.

| Kunci | Parameter | Sumber data |
|---|---|---|
| `class.lantern.passive` | `{burn_pct}` | `effects.csv` `class_lantern_1` value 1.3, tampil (value - 1) x 100 = 30 |
| `rite.*.desc` | `{dmg}` | `rites.csv` `dmg` |
| `weapon.*.desc` | `{dmg}`, `{dmg2}`, `{count}` | Kolom `weapons.csv` dengan nama sama, sesudah tier dan stat |
| `weapon.chain_spark.desc` | `{jumps}` | `params.jumps` (ditambah bonus tier) |
| `memento.coal_locket.desc` | `{chance}` | `effects.csv` `chance` x 100 |
| `memento.kindling_jar.desc` | `{pct}` | `hit_mod value` x 100 |
| `memento.ashen_crown.desc` | `{stacks}` | `burn_max_stacks` dasar + `value` (1 + 2 = 3) |
| `memento.glass_marble.desc` | `{pierce}` | `stat_mod value` x tumpukan |
| `memento.prism_lens.desc` | `{nth}`, `{count}`, `{pct}` | `every_nth`, `count`, `dmg_frac` x 100 |
| `memento.shard_pouch.desc` | `{projectiles}` | `stat_mod value` |
| `memento.splinter_comb.desc` | `{pct}` | `dmg_frac` x 100 |
| `memento.whetstone.desc` | `{crit}` | `stat_mod value` x tumpukan |
| `memento.duelist_ribbon.desc` | `{pct}` | `hit_mod value` x 100 |
| `memento.headsman_hook.desc` | `{pct}` | `target_hp_below` x 100 |
| `memento.tuning_fork.desc` | `{duration}` | `apply_status duration` |
| `memento.rite_chime.desc` | `{duration}` | `buff duration` |
| `memento.iron_thimble.desc` | `{armor}` | `stat_mod value` |
| `memento.glass_aegis.desc` | `{dmg}` | `spawn_area dmg` |
| `memento.dust_hourglass.desc` | `{chance}`, `{dmg}` | `chance` x 100, `spawn_projectile dmg` |
| `memento.magpie_tin.desc`, `memento.music_box.desc` | `{chance}` | `chance` x 100 |
| `memento.grinding_wheel.desc` | `{nth}` | `every_nth` |
| `memento.wick_charm.desc` | `{dmg}` | `spawn_area dmg` |
| `memento.cracked_mirror.desc` | `{count}`, `{dmg}` | `spawn_projectile count`, `dmg` |
| `memento.folded_letter.desc` | `{rite_haste}` | `stat_mod value` |
| `memento.echo_shell.desc` | `{rite_charges}` | `stat_mod value` |
| `memento.patched_cloak.desc` | `{hp_regen}` | `stat_mod value` |
| `syn.flame.2` | `{chance}` | `chance` x 100 |
| `syn.flame.6`, `syn.shard.6`, `syn.echo.6` | `{interval}` | `interval` |
| `syn.shard.2`, `syn.shard.4` | `{count}` | `count` |
| `syn.edge.2` | `{pct}` | `syn_edge_2a value` x 100 |
| `syn.edge.6` | `{stacks}` | `max_stacks` |
| `syn.ward.2`, `syn.ward.4` | `{barrier_max}`, `{barrier_recharge}` | `stat_mod value` |
| `syn.ward.6` | `{attack_speed_pct}` | `syn_ward_6b value` |
| `syn.trade.6` | `{pickup_radius_pct}` | `syn_trade_6b value` |
| `card.*` | `{value}` | Kolom rarity `levelup.csv` |

Memento tanpa angka di teks (`torch_glove`, `smolder_boots`) sengaja dibiarkan tanpa parameter: angkanya tidak membantu keputusan di kartu.

### 4.1 Angka yang masih ditulis langsung di teks (belum ada parameter di `text-params.ts`)

Bila GD mengubah angka ini di data, WR wajib memperbarui teks EN dan ID. Usulan untuk LP: tambah parameter bila sempat. Dicek ulang WR 2026-11-17 (M3) terhadap `content/data/*.csv`: semua angka di teks EN dan ID sama dengan data, tidak ada teks yang diubah.

| Kunci | Angka tertulis (EN / ID) | Sumber data | Nilai data saat ini |
|---|---|---|---|
| `rite.glass_step.desc` | 3 hit | `rites.csv` `glass_step` `crit_hits` | 3 |
| `weapon.echo_bell.desc` | once, half power / sekali, separuh kuat | `weapons.csv` `echo_bell` `echo_count`, `echo_frac` | 1, 0.5 (tier 4 `echo_count_add=1` tidak disebut di teks dasar) |
| `syn.echo.2` | 0.5s, 35% | `effects.csv` `syn_echo_2` `delay`, `power` | 0.5, 0.35 |
| `syn.echo.4` | 1s, half power / 1 detik, separuh | `syn_echo_4` `delay`, `power` | 1, 0.5 |
| `syn.ward.6` | +2% per Armor | `syn_ward_6a` `ratio` | 2 |
| `syn.trade.2` | 1 per 8, up to 12 | `syn_trade_2` `div`, `cap` | 8, 12 |
| `syn.trade.4` | first reroll free, 1 more offer | `syn_trade_4a` `free_rerolls`, `syn_trade_4b` `slots` | 1, 1 |
| `syn.trade.6` | 1% per 10, max 50% | `syn_trade_6a` `ratio`, `cap` | 0.1, 50 |
| `affix.blinking` | 6s | `affixes.csv` `blinking` `interval` | 6 |
| `affix.brood` | 3 Midges, 7s | `brood` `count`, `interval` | 3, 7 |
| `affix.pulsing` | 5s | `pulsing` `interval` | 5 |

Teks `affix.hasted`, `affix.volley`, `affix.veiled`, `affix.tar_trail`, `affix.bulwark` tidak memuat angka.

Sudah memakai parameter dari data sejak M2-09 (keluar dari daftar ini): `class.bell.passive` (`{mark}`), `class.blade.passive`, `memento.rite_chime.desc`, `memento.glass_aegis.desc`, `memento.collector_pin.desc`, `memento.lucky_button.desc`, `memento.haggler_seal.desc`, `memento.pyre_bell.desc`, `memento.wick_charm.desc`, `memento.patched_cloak.desc`, `memento.ledger_page.desc`. `rite.great_toll.desc` hanya memakai `{dmg}`.

## 5. Batas dan cek

- Batas (style guide 4.2, ui-spec 11): nama senjata, Memento, Rite maks 3 kata dan 18 karakter; Unlit maks 2 kata; Warden dan boss maks 3 kata plus julukan; kelas 1 kata; efek maks 2 baris x 40 karakter setelah parameter diisi; flavor 1 baris maks 70 karakter; baris the Glazier maks 45 karakter.
- Cek resmi: `tools/data/lib/check-strings.ts` (LP), jalan di `npm run data:build` dan `npm run data:check` untuk tingkat build (A). Hasil 2026-11-17: 0 error, 0 peringatan.
- Tingkat B dan C dicek WR dengan memanggil `checkStrings` yang sama pada data hasil `buildRaw` tingkat B dan C (skrip sementara di luar repo): 0 error, 0 peringatan untuk keduanya.
- `id.json` tidak diwajibkan lolos batas EN. Selisih yang diketahui: nama kelas "Penyulut Lentera" dan "Penyanyi Kor", "Pekebun Anggur" (2 kata), dan beberapa baris efek ID lebih dari 40 karakter. Kunci dan parameter ID sama dengan EN (dicek build, 0 peringatan).

## 6. Belum ditulis

- Teks M3: kandidat judul rilis (`docs/narrative/title-candidates.md`), meta-progression (`ui.keeping.*` detail unlock, nama paket Memento `pack_memento_*` bila UI menampilkannya), transisi bioma.
- Nama landmark arena tidak tampil di game; tidak butuh kunci.
