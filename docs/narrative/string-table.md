# Shardfall: Catatan String Table

Pemilik: Writer (WR). Reviewer: CD (teks dan nama), UI dan LP (kunci dan parameter). Status: versi 1 (2026-11-17, tugas M1-08).
File: `content/strings/en.json` (teks game, dibaca build data) dan `content/strings/id.json` (Indonesia, kunci sama, belum dibaca build). Format sesuai architecture.md 9.7: objek JSON datar, kunci bertitik `snake_case`, parameter `{nama}`, baris efek dipisah `\n`.

## 1. Cakupan versi 1

- Semua kunci UI Lampiran A ui-spec, dengan istilah keputusan CD (bagian 3), plus beberapa kunci tambahan yang dibutuhkan layar yang sama.
- Konten Tingkat A: kelas `lantern` dan Rite `flare_lantern`, 6 senjata, 12 Memento, tag (6 nama, efek ambang untuk Flame, Shard, Edge), 4 Unlit, `warden_hound`, `boss_lantern`, affix `hasted` dan `volley`, 21 stat, 14 kartu Temper, rarity, status, 3 bioma dengan kalimat pembuka, 8 baris the Glazier, teks akhir run (Kept Lost, Vitrine Steady, Light Kept).
- Tambahan di luar Tingkat A: `weapon.tithe_coin` (nama pengganti wajib dari CD).
- Semua `*_key` di CSV GD untuk baris Tingkat A sudah ada di `en.json` (dicek 2026-11-17). 89 kunci Tingkat B dan C belum ditulis (bagian 6).

## 2. Pola kunci

Mengikuti kolom `*_key` di data GD (data-schema v2) dan fixture LP. Bila berbeda dengan pola di ui-spec 11 (`item.*.effect`, `tag.*.tier<n>`), pola di bawah yang berlaku karena dirujuk data.

| Konten | Kunci | Catatan |
|---|---|---|
| Kelas | `class.<id>.name`, `.desc` (tagline 1 baris), `.role` (baris peran di daftar S02), `.passive` | `.role` dan `.passive` tidak dirujuk data, dipakai UI |
| Rite | `rite.<id>.name`, `.desc` | |
| Senjata | `weapon.<id>.name`, `.desc` | |
| Memento | `memento.<id>.name`, `.desc`, `.flavor` | |
| Unlit, Warden, boss | `unlit.<id>` (nama), `unlit.<id>.desc`, `unlit.<id>.epithet` (Warden dan boss) | Nama tanpa akhiran, sesuai `name_key` di `enemies.csv` |
| Affix | `affix.<id>` | |
| Tag | `tag.<id>.name`, `tag.<id>.abbr` (singkatan 2 huruf kartu) | |
| Efek ambang tag | `syn.<tag>.<ambang>` | Untuk "Unlocks: {effect}" di panel Tag |
| Stat | `stat.<id>` | `display_key` di `stats.csv` |
| Kartu Temper | `card.<nama>` | `desc_key` di `levelup.csv` |
| Status, rarity | `status.<id>`, `rarity.<id>` | |
| Bioma | `biome.<id>.name`, `biome.<id>.intro` | Intro tampil sekali saat Vitrine dimulai |
| the Glazier | `glazier.<pemicu>` | Pemicu: `open`, `first`, `no_glint`, `reroll`, `fuse`, `after_temper`, `warden_fell`, `begin` |
| Akhir run penuh | `ending.light_kept.1` sampai `.4` | Satu baris per ketukan (lore-premise 8) |

## 3. Perubahan kunci dari Lampiran A ui-spec (untuk UI)

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

Kunci baru: `ui.title.version`, `ui.credits.title`, `ui.error.webgl2` (dipakai `src/app/boot.ts`), `ui.common.glint`, `ui.class.passive`, `ui.hud.hp`, `ui.hud.held` (bar HP Warden saat Pulse ditahan, CD K3), `ui.levelup.level`, `ui.levelup.stat_change`, `ui.reward.subtitle`, `ui.confirm.reset_controls`, `ui.confirm.reset_yes`, `ui.settings.quality_low|medium|high`, `ui.settings.remap_gameplay|remap_menu`, `ui.end.won_sub`, `ui.end.steady`, `ui.end.steady_sub`, `ui.end.next_vitrine`.

## 4. Parameter teks efek (diisi dari data, bukan ditulis di teks)

Nilai persen ditulis sebagai angka bulat tanpa tanda persen (tanda ada di teks). Pecahan data (0.08) dikali 100.

| Kunci | Parameter | Sumber data |
|---|---|---|
| `class.lantern.passive` | `{burn_pct}` | `effects.csv` `class_lantern_1` value 1.3, tampil (value - 1) x 100 = 30 |
| `rite.flare_lantern.desc` | `{dmg}` | `rites.csv` `dmg` (x proc_scale bila UI menampilkan nilai berskala) |
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
| `syn.flame.2` | `{chance}` | `chance` x 100 |
| `syn.flame.6` | `{interval}` | `syn_flame_6b interval` |
| `syn.shard.2`, `syn.shard.4` | `{count}` | `count` |
| `syn.shard.6` | `{interval}` | `interval` |
| `syn.edge.2` | `{pct}` | `syn_edge_2a value` x 100 |
| `syn.edge.6` | `{stacks}` | `max_stacks` |
| `card.*` | `{value}` | Kolom rarity `levelup.csv` |

Memento tanpa angka di teks (`torch_glove`, `smolder_boots`) sengaja dibiarkan tanpa parameter: angkanya tidak membantu keputusan di kartu.

## 5. Batas dan cek

- Batas (style guide 4.2, ui-spec 11): nama senjata, Memento, Rite maks 3 kata dan 18 karakter; Unlit maks 2 kata; Warden dan boss maks 3 kata plus julukan; kelas 1 kata; efek maks 2 baris x 40 karakter setelah parameter diisi; flavor 1 baris maks 70 karakter; baris the Glazier maks 45 karakter.
- Cek Writer 2026-11-17: semua kunci `en.json` lolos dengan setiap parameter diisi 4 digit (lebih berat dari nilai data terpanjang), tanpa em dash atau en dash, tanpa kata terlarang style guide 4.3. Skrip cek sementara di luar repo; cek resmi adalah `check-strings.ts` milik LP (belum ada di repo saat ini).
- `id.json` tidak diwajibkan lolos batas EN. Saat ini satu-satunya selisih adalah nama kelas "Penyulut Lentera" (2 kata).

## 6. Belum ditulis (Tingkat B dan C, rencana M2 dan M3)

Dirujuk `content/data/*.csv` tetapi baris datanya di atas Tingkat A, jadi tidak memengaruhi build A: kelas `bell` dan `blade`, Rite `great_toll` dan `glass_step`, senjata `echo_bell`, 18 Memento Tingkat B dan C, efek ambang Echo, Ward, Trade, Unlit `exploder`, `summoner`, `mote`, `lobber`, Warden `warden_choir` dan `warden_bulwark`, boss `boss_bell` dan `boss_vine`, affix `veiled`, `blinking`, `brood`, `tar_trail`, `pulsing`, `bulwark`. Build tingkat B atau C akan gagal cek kunci sampai ini ditulis.
