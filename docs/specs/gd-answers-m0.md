# Jawaban GD atas Pertanyaan Spec GP (M1-00)

Pemilik: Game Designer (GD). Penerima: Gameplay Programmer (GP), Lead Programmer (LP). Tanggal: 2026-11-17.
Menjawab: `docs/specs/gp-questions-m0.md` (Q01 sampai Q41). Keputusan di sini final untuk angka dan aturan sistem; sudah diterapkan ke `docs/gdd.md` versi 2, `docs/systems/data-schema.md` versi 2, `docs/systems/effect-primitives.md` versi 2.
Format teknis (nama tipe, event, pool) mengikuti `docs/tech/architecture.md` versi 2. Angka baru bertanda [Asumsi] sampai dikalibrasi lewat model M1-02 dan playtest M1.

Prioritas M1 (Q01, Q04, Q07, Q12, Q14, Q15, Q20, Q23, Q27, Q30) dijawab lengkap di bawah.

---

## 1. Gerak

**Q01: setuju dengan koreksi.** 1 u GDD = 1 u LD = 16 px lebar layar (10 px kedalaman). Sim bekerja dalam u lantai; piksel hanya di render. Arena final 32 x 20 u, sudut terpotong 3 u. Hasil kalibrasi ulang:
- Tetap: kecepatan pemain dan Unlit, jangkauan senjata (6 sampai 7 u), jarak jaga shooter 5 sampai 7 u, summoner 6 sampai 8 u, lobber 6 sampai 9 u, pemicu terjang charger 6 u, radius pungut 1.6 u, Flare maks 6 u, nova Flame 6 4 u.
- Jarak jaga yang jatuh di luar batas: Unlit berhenti di batas (dijepit) dan menerima jarak lebih dekat. Tidak mencari titik lain.
- Jarak aman spawn: satu sumber, `spawn.playerSafeRadius` di JSON arena (4 u). Kunci `spawn_min_dist` dihapus dari `config.csv`.
- Snuff Ring (`boss_lantern`): radius maksimum 10 menjadi **19 u** (menutup seluruh arena dari panggung boss `[0, -3]`), kecepatan 4 menjadi **5 u/s**. Celah adalah satu-satunya jalan aman.
- Kepadatan: arena sekitar 23% lebih luas dari asumsi lama. Jumlah musuh tabel 3.4 tetap untuk M1; model M1-02 dan playtest yang memutuskan penambahan, bukan jarak.
- Gerak vertikal pemain dikompensasi di sim (architecture 7.1), `player_vertical_screen_ratio` 0.8. Akibatnya gerak vertikal di lantai sekitar 5.76 u/s. Unlit tidak dikompensasi (CD K7 butir 4); ditinjau setelah playtest M1 bila kabur vertikal terlalu mudah.

**Q02: setuju.** (a) Pemain kembali ke `playerStart` arena tiap Pulse: `[0, 0]` untuk Pulse biasa dan Warden, `[0, 5]` untuk boss. (b) Rintangan tidak menghalangi proyektil pemain maupun musuh; LD mengisi `blocks: ["move"]` untuk semua rintangan. Proyektil hilang di luar batas yang diperlebar `projectileMargin` (3 u) atau saat jangkauannya habis.

**Q03: setuju.** Pemain dan semua Unlit (termasuk Warden dan boss) saling tembus; tumpang tindih = kontak. Unlit saling memisah dengan dorongan lembut. Batas dan rintangan padat untuk keduanya.

## 2. Kombat dan damage

**Q04: setuju dengan penegasan.** Tiap tick, bila pemain tidak kebal dan bertumpuk dengan minimal satu Unlit yang tidak sedang masa tenggang spawn, pemain menerima satu hit dengan `contact_dmg` terbesar di antara yang bertumpuk (seri: slot terkecil), dikali `dm(t)` dan pengali Crack. Kebal 0.5 s membatasi 2 hit kontak per detik. Charger yang sedang menerjang memakai `attack_dmg` sebagai damage kontak, maksimal sekali per terjang. Exploder punya kontak 0.

**Q05: setuju.** Hit saat kebal diabaikan sebelum gulir dodge (tidak memicu `on_dodge` atau `on_block`). Barrier yang menyerap memberi kebal 0.2 s (kunci baru `iframes_block`). Proyektil musuh hancur saat menyentuh pemain dalam semua kasus, termasuk saat kebal. Slow dari `tar_trail` bukan hit dan tetap berlaku saat kebal.

**Q06: setuju.** Hit proc dan Rite boleh kritikal dengan `crit_chance` pemain; tick Burn tidak. Guard berlaku pada semua hit kecuali tick Burn. `execute` mengabaikan guard. `on_crit` dari hit proc hanya jalan bila `allow_proc=1`. Glass Step "3 hit berikutnya" = 3 hit senjata non-proc berikutnya dalam 2.5 s.

**Q07: setuju, dengan angka.**
- (a) Dasar Burn = 30% dari `hit` sesudah Σbonus dan Σrentan, sebelum crit dan guard. Tick Burn tidak menerapkan ulang Σbonus dan Σrentan; hanya pengali `status_rule dmg_mult` (pasif `lantern` x1.3).
- (b) Sumber non-hit (zona Rite Flare, bara Smolder Boots, nova Flame 6): `dps = burn_dps_nonhit x proc_scale(t)` per tumpukan, `burn_dps_nonhit` = 2 [Asumsi].
- (c) Aplikasi baru menambah tumpukan bila di bawah `burn_max_stacks`; bila penuh, tumpukan terlemah diganti bila yang baru lebih kuat. Tiap aplikasi menyegarkan durasi semua tumpukan target ke 3 s. Tick tiap 0.5 s sejak aplikasi pertama (setiap tick memberi `dps x 0.5` per tumpukan).

**Q08: setuju dengan tambahan.** Knockback tidak membatalkan ancang-ancang. Unlit yang sedang menerjang kebal knockback. `kb_resist` boss 1.0, Warden 0.9. Jarak dorong = nilai x (1 minus `kb_resist`), disebar selama 0.1 s (kunci baru `knockback_s`) agar terbaca, dan dijepit batas serta rintangan.

## 3. Senjata dan tier

**Q09: setuju.** Cooldown turun ke 0 lalu menunggu target dalam jangkauan; tidak menembak ke udara. Jangkauan = jarak akuisisi dan jarak tempuh maksimum. Salinan senjata yang sama membidik sendiri-sendiri. Semua cooldown siap di awal Pulse.

**Q10: setuju.** Tumbukan 8 (`projectile`) ke Unlit pertama, lalu ledakan 6 radius 1.3 u (`area`, memicu `on_area`) yang juga mengenai target tumbukan. Burn dari ledakan. Tanpa tumbukan, meledak di akhir jangkauan. Satu tembakan bisa memicu dua `on_hit` pada target yang sama.

**Q11: setuju.** `projectiles` berlaku ke `projectile`, `bolt_explode`, `boomerang`, `coin`. `pierce` ke `projectile` dan `coin`. Radius orbit dan cincin Echo Bell memakai `area_pct`. `range_pct` hanya akuisisi dan tempuh (Arc Blade setengah). `attack_speed_pct` pada Orbit Shards memperpendek kontak ulang 0.5 s. `kind` Orbit Shards = `melee`.

**Q12: koreksi.** Merge (tampil sebagai Fuse):
- Saat beli dengan slot kosong tersedia: salinan menempati slot baru, **tidak** otomatis bergabung. Pemain menggabung manual lewat `shop.merge` (architecture 6.2). Alasan: dua salinan tier I menembak dua kali (DPS lebih tinggi), sedangkan Fuse menghemat slot dan menuju perilaku tier IV. Itu keputusan build yang nyata.
- Saat beli dengan slot penuh: merge otomatis bila ada salinan id dan tier sama (tier di bawah IV). Bila tidak bisa, beli ditolak (`SlotsFull`).
- Tidak berantai: satu beli atau satu `shop.merge` = satu langkah tier. Hasil merge menempati slot dengan indeks terkecil dari keduanya; slot lain kosong.
- `shop.merge(slot)` menggabung slot itu dengan slot berindeks terkecil lain yang berisi id dan tier sama. Tier IV tidak bisa digabung; salinan tier IV menempati slot baru.
- Jual: senjata apa saja termasuk senjata awal, kecuali senjata terakhir (minimal 1). Harga jual = `floor(sell_frac x weapon_price(tier) x (1 + 0.08 x (t minus 1)))`, `sell_frac` 0.4, tanpa pengali Crack dan Memento. Memento tidak bisa dijual.

## 4. Rite

**Q13: setuju dengan penyesuaian kontrak.** Semua muatan penuh di awal Pulse; isi ulang satu per satu, timer berjalan selama muatan di bawah maksimum. Input Rite di luar fase `pulse` diabaikan. Titik bidik dari `InputFrame.aimX/aimY` (gamepad: posisi pemain + arah gerak x 4 u, architecture 6.2). Flare jatuh di titik bidik, dijepit maks 6 u dari pemain dan 0.5 u di dalam batas. Glass Step ke arah titik bidik (bila titik bidik sama dengan posisi pemain: arah hadap), jarak memakai faktor kompensasi vertikal, berhenti di batas dan rintangan, menembus Unlit, damage sekali per Unlit yang dilewati.

## 5. Spawner dan Pulse

**Q14: setuju.** Kolom `duration_s` di `waves.csv` yang berlaku. Kunci `pulse_dur_base`, `pulse_dur_step`, `pulse_dur_max` dihapus dari `config.csv`. Rumus 2.5 s di GDD 3.1 dihapus. Tingkat A: 20, 23, 26, 29, 32, 35, 38, 40, 40.

**Q15: setuju dengan kolom sektor.**
1. Tiap baris `wave_spawns` dipecah menjadi grup: ukuran acak seragam `group_min` sampai `group_max` (aliran `spawn`), grup terakhir dipotong agar total tepat `count`.
2. Waktu tiap grup diambil dari w(τ) (GDD 3.2) yang dipotong ke `[start_frac x D, end_frac x D]` dan ke `[0, D minus 2]`, lewat CDF terbalik. Waktu itu = awal telegraf; Unlit keluar 0.8 s kemudian.
3. Jadwal diurutkan menurut waktu, seri diputus urutan baris lalu urutan grup.
4. Satu grup = satu titik. Anggota grup ditempatkan acak dalam radius 0.5 u dari titik. Diameter telegraf mengikuti ukuran terbesar di grup (`spawn_mark_diam_*`); grup 3 ekor atau lebih memakai minimal ukuran medium.
5. Sektor dipilih acak seragam per grup dari kolom baru `sectors` (daftar `n|s|e|w|ne|se|sw|nw`, kosong = 8 sektor), dengan aturan tolak arena 5.2.

**Q16: setuju.** Telegraf 0.8 s (`spawn_mark_s`), lalu 0.3 s tanpa damage kontak dan tanpa memulai serangan (`spawn_grace_s`). Unlit bisa dilukai selama masa tenggang, tidak selama telegraf.

**Q17: setuju dengan tambahan.** Unlit hidup + telegraf spawn aktif dihitung ke `alive_cap`. Spawn tertahan mengantre FIFO; antrean yang belum bisa mulai telegraf sebelum D minus 2 s dibuang (detik tenang sebelum akhir Pulse tetap terjaga). Mote dihitung; summoner tidak memanggil bila penuh. Warden, boss, swarmer tetesan boss, dan swarmer Moth Call tidak dihitung.

**Q18: setuju.** Urutan di tick timer 0: semua Unlit larut; proyektil, telegraf, dan zona kedua pihak dihapus; antrean spawn dibuang; efek `on_pulse_end` dievaluasi; lalu pungutan otomatis 50% (floor dari total nilai, tanpa `on_pickup`, memberi XP). `pulseClear` 1.0 s (kunci baru `pulse_clear_s`). Awal Pulse: HP penuh (Crack 5: 50% HP hilang), Rite penuh, Barrier sampai `barrier_max`, semua status, buff, tumpukan Rush, penghitung `every_nth` dan `on_distance` direset, pemain di `playerStart`. Pemulihan HP tampil bersama gelombang cahaya pembuka (CD K5).

**Q19: koreksi angka.** Profil baru `run_a_m1` di `waves.csv` (dipakai M1, sama dengan `run_a` kecuali dua baris):
- Pulse 5: normal, t5, 32 s, s 40, c 10, h 8, k 4 (total 62, Glint mentah 96), `alive_cap` 70. Komposisi dinaikkan agar ekonomi tidak kehilangan 25 Glint Warden.
- Pulse 10: normal, t10, 45 s, s 88, c 20, h 20, k 13 (total 141, Glint mentah 233), `alive_cap` 90, `final` 1.
GD menulis baris ini di M1-02.

## 6. AI musuh dan telegraf

**Q20: setuju.** Radius (u) per `size_class` di `config.csv`: `enemy_radius_small` 0.3, `enemy_radius_medium` 0.4, `enemy_radius_large` 0.6, `enemy_radius_warden` 0.9, `enemy_radius_boss` 1.6; `enemy_shot_radius` 0.2; `player_shot_radius` 0.15. Override opsional: kolom `radius` di `enemies.csv`, kolom `proj_radius` di `weapons.csv`. Kelas ukuran: small = swarmer, mote, exploder; medium = charger, shooter, summoner, lobber; large = tank.

**Q21: setuju.** Tekanan musik aktif saat Unlit hidup minimal 60% `alive_cap` (`music_pressure_frac` 0.6), lepas di bawah 50% (`music_pressure_release_frac` 0.5). Telegraf spawn tidak dihitung. Sim memancarkan event saat ambang dilewati (nama event milik LP).

## 7. Glint dan pickup

**Q22: setuju.** Satu butir per Unlit bernilai kolom `glint`. Warden 5 butir x 5. Boss non-final 8 butir x 5. `on_pickup` per butir.

**Q23: setuju (aturan final).** Bila butir di lantai (tidak sedang tertarik) akan melebihi `glint_floor_cap` (150), atau pool pickup penuh, nilai Glint baru ditambahkan ke butir lantai terdekat dari titik jatuhnya (seri: slot terkecil). Tidak ada nilai yang hilang, tidak ada entitas baru, deterministik. Kunci `glint_merge_value` dihapus. Butir bernilai 5 atau lebih boleh tampil lebih besar (AD).

**Q24: setuju.** XP hanya dari Glint lewat pungutan butir (termasuk pengganda Magpie Tin, pungutan otomatis akhir Pulse dan boss, butir Lucky Button dan Tithe Coin). Glint langsung (bunga Trade, Ledger Page, jual, pengganti peti kosong) tidak memberi XP.

## 8. XP dan level-up

**Q25: setuju.** Kartu digulir saat layarnya tampil, dengan threat Pulse yang baru selesai dan luck saat itu (aliran `levelUp`). 3 stat berbeda; stat yang sudah di batas maks tidak ditawarkan. Kartu `max_hp` juga menambah HP sekarang. Level tertunda tidak bisa dilewati atau disimpan.

## 9. Toko

**Q26: setuju.** 4 tawaran (5 dengan Trade 4), 6 slot senjata, Memento tanpa batas slot, toko tanpa timer (pengaman P4-f milik CD), tanpa reroll dan skip level-up.

**Q27: setuju.** Timer 0, `pulseClear` 1.0 s, `reward` (bila Warden atau boss non-final dikalahkan), `levelUp` satu per level, lalu `shop`. Fase `reward` sudah ada di architecture 4.4.

**Q28: setuju.** Tidak ada id ganda dalam satu set tawaran, termasuk kartu terkunci. Kartu senjata tetap muncul saat slot penuh tanpa merge (UI "No free slot", `blockedNoSlot`). Bobot tag kelas dan tag dimiliki dikalikan (maks x1.875). Dorongan merge memilih seragam di antara senjata milik dengan tier di bawah IV. Pool rarity kosong: turun satu tingkat; bila Plain kosong, naik. `round` = setengah ke atas.

**Q29: setuju.** Slot terbeli kosong (`Taken`) sampai reroll atau toko berikutnya. Reroll dan toko berikutnya mengisi semua slot tak terkunci. Kartu terkunci yang menjadi tidak sah diganti saat toko dibuka.

## 10. Memento dan efek primitif

**Q30: koreksi (tanpa kasus khusus).** Mekanisme `procDepth` architecture 8.5 tetap tanpa pengecualian:
- Kill oleh tick Burn = kill berkedalaman 1 (proc): hanya `on_kill` dengan `allow_proc=1` yang jalan.
- `syn_flame_4` (Flame 4) diberi `allow_proc=1` secara eksplisit. Akibatnya: kill senjata pada Unlit terbakar meledak (kedalaman 1); kill oleh ledakan itu pada Unlit terbakar meledak sekali lagi (kedalaman 2); ledakan kedalaman 2 tidak memicu apa pun. Api menjalar dua langkah, terbatas.
- Kill oleh `execute` dihitung sebagai kill oleh hit pemicunya (kedalaman dan status crit hit itu), jadi `on_kill` jalan normal.
- Unlit yang mati oleh ledakan exploder menjatuhkan Glint, tetapi `on_kill` tidak dipicu (bukan damage pemain).

**Q31: setuju.** `every_nth` tanpa scope = `global`. `on_distance` menghitung jarak lantai, termasuk dash Glass Step. Splinter Comb: Unlit terdekat selain target dalam 6 u, tanpa tembakan bila tidak ada; `dmg_frac` dari damage akhir hit pemicu sesudah crit. Serpih kecil Shard 2: 12 u/s, jangkauan 3 u, ke 2 Unlit terdekat lain dalam 4 u, sisanya arah acak (aliran `combat`). Bara Smolder Boots `max_alive` 6. Hit dari bara dan zona = `kind` `zone`.

## 11. Sinergi

**Q32: setuju.** Tag kelas tidak menambah hitungan. Senjata awal dihitung. Jual menurunkan hitungan seketika. Ambang aktif dan nonaktif langsung di toko. Tag di luar tingkat build tidak dihitung.

## 12. Warden

**Q33: setuju.** 25 Glint jatuh sebagai 5 butir di lantai; layar `reward` hanya berisi peti Memento (plus Silt di B dan C). Warden mati di waktu tambahan: butirnya dipungut 100%. Peti wajib pilih 1, tanpa id ganda. Memento sah kurang dari 3: tampilkan yang ada; 0: ganti 25 Glint langsung.

**Q34: setuju.** Warden tidak dihitung ke batas hidup; muncul di 25% durasi di sektor terjauh dari pemain dengan telegraf diameter 3 u. Timer 0 dan Warden hidup: antrean spawn dibuang, Unlit yang ada tetap menyerang, HUD menampilkan bar HP Warden berlabel "Held" (`PulseView.warden`, `overtime`). Warden mati sebelum timer 0: Pulse lanjut normal. `hasted` ditambahkan sekali setelah 20 s waktu tambahan.

## 13. Boss

**Q35: setuju dengan batas.** Telegraf panggung (radius 4 u) 2.0 s sejak Pulse mulai (kunci baru `boss_entry_s`); boss tidak bisa dilukai dan tidak memberi damage sebelum keluar. Amuk 120 s sejak boss keluar. Tetesan 2 swarmer tiap 4 s sampai boss mati, menjatuhkan Glint normal, dijeda bila swarmer tetesan hidup mencapai 24 (kunci baru `boss_trickle_max_alive`).

**Q36: setuju.** HP boss tidak turun di bawah ambang fase sampai pola berjalan selesai dan transisi 1.5 s lewat; boss kebal selama transisi. Boss diam selama telegraf dan eksekusi pola, bergerak hanya di jeda.

**Q37: setuju dengan koreksi Snuff Ring.** Ember Rain: lingkaran pertama di posisi pemain, sisanya acak dalam 3 u tanpa tumpang tindih. Snuff Ring: tebal 0.6 u, melebar 5 u/s sampai 19 u, arah celah acak seragam (aliran `ai`); cincin ganda fase 2 berjeda 0.8 s dengan celah berbeda minimal 90 derajat. Lantern Lanes: 3 jalur horizontal lebar 1.2 u di posisi y lantai acak antara -9 dan 9 dengan jarak antar jalur minimal 3 u, proyektil berjarak 0.6 u, 8 u/s, dari sisi acak per jalur. Moth Call: 6 swarmer dari sektor tepi acak.

## 14. Akhir run

**Q38: setuju.** HP 0: gerak lambat 1 s di dalam sim (`death_slowmo_s`), lalu `defeat`. Boss final mati: semua Unlit larut, bahaya hilang, Glint dipungut 100%, jeda 1.5 s (`victory_delay_s`), lalu `victory`. M1 tanpa boss: menang saat timer Pulse `final` habis. Abandon = `defeat` dengan `RunOutcome.Abandon`.

## 15. Meta

**Q39: setuju.** Silt dihitung sekali saat run berakhir (menang, kalah, Abandon) dengan rumus GDD 17.1; Abandon dihitung seperti mati. Run yang tidak dilanjutkan setelah tab ditutup tidak memberi Silt. Tingkat A tanpa Silt.

## 16. Determinisme

**Q40: setuju.** Urutan per tick: command, timer Pulse (bila 0, proses akhir Pulse dan lewati kombat tick itu), gerak dan serangan pemain, kematian Unlit (termasuk boss), lalu damage ke pemain. Akhir Pulse dan kematian boss final menang atas kematian pemain di tick yang sama. Seed dipilih app tiap run dan ditampilkan kecil di layar akhir run.

**Q41: setuju.** (a) Kurva kesulitan = GDD 19 ditambah: tidak ada Pulse non-boss dengan lebih dari 15% kematian bot wajar; median HP tersisa di akhir Pulse turun bertahap dari sekitar 90% (Pulse 1) ke sekitar 50% (Pulse 9). (b) Penanda stat datar = kolom `is_flat` di `mementos.csv`; senjata tidak pernah datar. (c) Musuh puncak = `alive_cap` maksimum profil (A 90, C 120) plus 1 Warden; Pulse boss di bawah angka itu. (d) Telegraf minimum = GDD 14.1 (kunci `telegraph_min_*_s` di `config.csv`, ditegakkan validator) plus telegraf spawn 0.8 s.

---

## Tanggapan atas keputusan GP sendiri

- **Veto satu butir:** "sim isotropik, kompensasi urusan render" diganti architecture 7.1: kompensasi kecepatan pemain dilakukan di sim dengan `player_vertical_screen_ratio` (0.8). Tumbukan, jangkauan, area tetap dalam u lantai.
- Diterima: kecepatan langsung tanpa akselerasi; HP pecahan dan HUD dibulatkan ke atas; jatah heal per detik per sumber, leech hanya dari hit non-proc; arah terjang charger terkunci; shooter tanpa prediksi dan mundur di bawah 5 u; Glint tertarik tetap terbang, terpungut pada jarak radius pemain + 0.2 u (kunci `glint_collect_dist_add`).

## Konfirmasi butir saran LP (review M0 4, GD butir 10 sampai 12)

- Kolom `sectors` di `wave_spawns.csv`: diterima (Q15).
- Kunci `telegraph_min_projectile_s` 0.4, `telegraph_min_charge_s` 0.6, `telegraph_min_area_s` 0.8, `telegraph_min_boss_s` 1.0: diterima.
- Urutan `reward`, `levelUp`, `shop`: dikonfirmasi (Q27). `shop.merge` = Fuse manual dua salinan di inventaris (Q12). Rintangan tidak menghalangi proyektil dan pemain kembali ke titik awal (Q02).
