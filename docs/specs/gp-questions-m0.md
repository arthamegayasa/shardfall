# Pertanyaan Spec GP untuk GD (M0-10)

Pemilik: Gameplay Programmer (GP). Penerima: Game Designer (GD). Status: M0, 2026-11-16.
Dasar: `docs/gdd.md`, `docs/systems/effect-primitives.md`, `docs/systems/data-schema.md`, `docs/tech/architecture.md`, `docs/levels/arena-design.md`, `docs/ui/ui-spec.md`, `docs/qa/test-plan.md`, `docs/audio-direction.md`.

## Cara menjawab

- Setiap pertanyaan punya **Default**. GD cukup menulis `Q07: setuju` atau `Q07: koreksi ...`. Pertanyaan yang tidak dijawab sebelum GP mulai M1 memakai default dan ditandai `[Asumsi]` di `docs/specs/gp-core-loop.md`.
- Label `[M1]` atau `[M2]` = milestone yang terhalang. Label `[UI]`, `[LD]`, `[LP]`, `[QA]`, `[AU]` = pertanyaan itu juga datang dari laporan peran tersebut (sudah digabung, tanpa duplikat).
- Rujukan bagian ditulis singkat, misalnya "gdd 5.3" atau "arena 5.1".

---

## 1. Gerak

**Q01 [M1] [LD] Satuan dan ukuran arena.** gdd 0 mengasumsikan area main 28 x 18 u; arena 4.1 menetapkan 32 x 20 unit (1 unit = 16 px); architecture 6.9 menulis `ArenaDef` dalam piksel tanah. Apakah semua jarak GDD dipakai apa adanya di arena 32 x 20?
**Default:** 1 u GDD = 1 unit LD. Semua jarak, kecepatan, dan radius GDD dipakai tanpa kalibrasi ulang. Sim bekerja dalam u; konversi ke piksel hanya di render. Bila arena terasa lapang, M1 menyetel kepadatan (GD), bukan jarak.

**Q02 [M1] [LD] Posisi awal Pulse dan rintangan.** (a) Apakah pemain dikembalikan ke titik awal tiap Pulse? (b) Apakah rintangan menghalangi proyektil?
**Default:** (a) Ya: `[0, 0]` untuk Pulse biasa dan Warden, `[0, 5]` untuk boss. (b) Tidak, untuk proyektil pemain dan musuh (arena R9); rintangan hanya menghalangi gerak. Proyektil hilang di luar batas yang diperlebar 3 u.

**Q03 [M1] Tumbukan pemain dengan Unlit.** gdd 5.1 memberi radius pemain 0.35 u tetapi tidak menyebut apakah pemain dan Unlit saling mendorong.
**Default:** Saling tembus; tumpang tindih = kontak. Unlit hanya saling memisah sesama Unlit (dorongan lembut). Batas arena dan rintangan padat untuk keduanya. Pemain tidak pernah terkurung secara fisik oleh kerumunan.

## 2. Kombat dan damage

**Q04 [M1] Damage kontak.** Frekuensi dan sumber saat banyak Unlit menempel tidak tertulis.
**Default:** Tiap tick, bila pemain tidak kebal dan bertumpuk dengan minimal satu Unlit, pemain menerima satu hit dari Unlit dengan damage kontak terbesar (seri: slot terkecil). Dengan kebal 0.5 s, laju maksimal 2 hit kontak per detik. Charger yang sedang menerjang memakai `attack_dmg` (6) sebagai damage kontak, maksimal sekali per terjang.

**Q05 [M1] Kebal, Barrier, dan proyektil yang di-dodge.** gdd 5.3 memberi kebal hanya setelah HP berkurang.
**Default:** Hit yang datang saat kebal diabaikan sebelum gulir dodge (tidak memicu `on_dodge` atau `on_block`). Barrier yang menyerap hit memberi kebal 0.2 s seperti dodge, agar kerumunan tidak menghabiskan semua muatan dalam beberapa tick. Proyektil musuh hancur saat menyentuh pemain, baik kena, di-dodge, maupun diserap.

**Q06 [M1] Kritikal dan guard untuk proc dan Rite.**
**Default:** Hit proc dan Rite boleh kritikal memakai `crit_chance` pemain; hanya Burn yang tidak. Guard berlaku pada semua hit kecuali tick Burn. Efek `on_crit` dari hit proc hanya jalan bila `allow_proc=1` (Splinter Comb dan Edge 4 tidak). Glass Step "3 hit berikutnya" = 3 hit senjata non-proc berikutnya.

**Q07 [M1] Burn: dasar, tumpukan, angka yang hilang.** (a) "30% damage hit pemicu" diambil dari tahap mana di rumus 5.2? (b) Sumber non-hit tanpa param `dps` (zona Rite Flare, bara Smolder Boots, nova Flame 6 dengan dmg 0) tidak punya angka. (c) Cara penyegaran tumpukan.
**Default:** (a) 30% dari `hit` sesudah Σbonus dan Σrentan, sebelum crit dan guard. Tick Burn tidak menerapkan ulang Σbonus dan Σrentan, hanya pengali `status_rule` (pasif lantern x1.3). (b) `dps = 2 x proc_scale(t)` per tumpukan, kunci config baru `burn_dps_nonhit`. (c) Aplikasi baru menambah tumpukan bila di bawah maks; bila penuh, tumpukan terlemah diganti bila yang baru lebih kuat. Tiap aplikasi menyegarkan durasi semua tumpukan target ke 3 s. Tick tiap 0.5 s sejak aplikasi pertama.

**Q08 [M1] Knockback terhadap AI dan boss.**
**Default:** Knockback tidak membatalkan ancang-ancang (garis telegraf ikut bergeser bersama musuh). Unlit yang sedang menerjang tidak terkena knockback. `kb_resist` boss tidak tertulis: default 1.0 (kebal). Knockback dijepit batas arena dan rintangan.

## 3. Senjata dan tier

**Q09 [M1] Penargetan dan jangkauan.**
**Default:** Cooldown turun sampai 0 lalu menunggu; senjata menembak di tick pertama ada Unlit dalam jangkauan (tidak menembak ke udara). Jangkauan = jarak akuisisi sekaligus jarak tempuh maksimum proyektil. Dua salinan senjata yang sama membidik sendiri-sendiri (boleh target sama). Cooldown senjata siap di awal Pulse.

**Q10 [M1] Lantern Bolt: dua damage.**
**Default:** Tumbukan 8 ke Unlit pertama yang disentuh (kind `projectile`), lalu ledakan 6 radius 1.3 ke semua Unlit di radius, termasuk target tumbukan (kind `area`, memicu `on_area`). Burn berasal dari ledakan. Bila tidak kena apa pun, meledak di akhir jangkauan. Satu tembakan bisa memicu dua `on_hit` pada target yang sama (penting untuk `every_nth`).

**Q11 [M1] Stat apa berlaku ke arketipe apa.**
**Default:** `projectiles` berlaku ke `projectile`, `bolt_explode`, `boomerang`, `coin`; tidak ke `arc`, `orbit`, `chain`, `ring_echo`. `pierce` ke `projectile` dan `coin`. Radius orbit dan cincin Echo Bell memakai `area_pct`, bukan `range_pct`. `range_pct` hanya jarak akuisisi dan tempuh (Arc Blade setengah). `attack_speed_pct` pada Orbit Shards memperpendek kontak ulang 0.5 s, bukan mempercepat putaran. `source_kind` Orbit Shards = `melee`.

**Q12 [M1] [UI] [LP] Merge otomatis atau manual, dan aturan jual.** gdd 4.4 jelas untuk slot penuh, tetapi tidak untuk slot yang masih kosong; ui-spec menyiapkan tombol Merge manual (M) dan Sell (X).
**Default:** Merge otomatis saat beli bila ada salinan id dan tier sama (tier di bawah IV), walau slot masih kosong. Berantai dalam satu beli (I + I = II, lalu II + II = III). Tidak ada command merge manual. Salinan tier IV menempati slot baru. Jual: boleh untuk senjata apa saja termasuk senjata awal, kecuali senjata terakhir (minimal 1 senjata). Harga jual 40% harga tier pada threat toko, floor. Keepsake tidak bisa dijual.

## 4. Rite

**Q13 [M1] Muatan, bidikan, dan batas Rite.**
**Default:** Semua muatan penuh di awal Pulse, isi ulang satu per satu, cooldown mulai saat dirapal. Input Rite di luar fase pulse diabaikan. Flare: titik jatuh = kursor, dijepit maks 6 u dan di dalam batas; tanpa kursor (gamepad) 6 u ke arah gerak terakhir. Glass Step berhenti di batas arena dan rintangan, menembus Unlit, damage sekali per Unlit yang dilewati.

## 5. Spawner dan Pulse

**Q14 [M1] Durasi Pulse bertentangan.** Rumus gdd 3.1 (langkah 2.5 s) memberi 20, 22.5, 25, ...; tabel 3.4 dan hitungan 283 s di 3.5 memakai langkah 3 s (20, 23, 26, ..., 40). Config juga punya `pulse_dur_step` 2.5.
**Default:** Kolom `duration_s` di `waves.csv` yang berlaku (nilai tabel 3.4). Kunci `pulse_dur_*` di config hanya untuk tool balance, atau dihapus.

**Q15 [M1] Algoritma jadwal spawn.** gdd 3.2 memberi bobot w(τ), grup, dan jendela per baris, tetapi tidak cara menggabungkannya.
**Default:** Tiap baris `wave_spawns` dipecah menjadi grup (ukuran acak `group_min` sampai `group_max`, grup terakhir dipotong agar total tepat `count`). Waktu tiap grup diambil dari w(τ) yang dipotong ke jendela `[start_frac, end_frac] x D` dan ke `[0, D minus 2]`. Waktu itu adalah awal telegraf; Unlit keluar 0.8 s kemudian. Satu grup = satu titik. Sektor dipilih acak seragam per grup dengan aturan tolak arena 5.2; tidak ada kolom sektor di M1 (GD boleh menambah kolom `sectors` nanti).

**Q16 [M1] [LD] Telegraf spawn dan masa tenggang.** LD mengusulkan telegraf minimal 0.8 s plus sekitar 0.3 s tanpa damage sentuh setelah Unlit keluar.
**Default:** Setuju: telegraf 0.8 s, lalu 0.3 s tanpa damage kontak dan tanpa memulai serangan (kunci config baru `spawn_grace_s`). Unlit bisa dilukai selama masa tenggang, tidak selama telegraf.

**Q17 [M1] Batas Unlit hidup.**
**Default:** Unlit hidup ditambah telegraf spawn aktif dihitung. Spawn yang tertahan mengantre FIFO; antrean dibuang saat Pulse berakhir. Mote dihitung; summoner tidak memanggil bila penuh (tidak mengantre). Warden, boss, dan swarmer tetesan boss tidak dihitung. Batas dibaca dari kolom `alive_cap`.

**Q18 [M1] Akhir dan awal Pulse.**
**Default:** Pada tick timer mencapai 0: semua Unlit larut; proyektil, telegraf, dan zona milik kedua pihak dihapus; antrean spawn dibuang; tidak ada damage setelahnya. Auto-pungut 50% = floor dari jumlah nilai semua butir, tidak memicu `on_pickup`, tetapi memberi XP. Durasi `pulseClear` 1.0 s (kunci config baru `pulse_clear_s`). Awal Pulse: HP penuh, Rite penuh, Barrier penuh sampai `barrier_max`, semua status, buff, tumpukan Rush, serta penghitung `every_nth` dan `on_distance` direset.

**Q19 [M1] Pengganti Warden dan boss di M1.** gdd 20 butir 7 menyebut "Pulse 10 = 45 s padat" tanpa komposisi.
**Default:** Pulse 5 = komposisi tabel A baris 5 tanpa Warden, 32 s. Pulse 10 = 45 s, komposisi baris 9 dikali 1.25 (s 88, c 20, h 20, k 13), `alive_cap` 90. Mohon GD menulis dua baris ini di data (misalnya profil `run_a_m1`).

## 6. AI musuh dan telegraf

**Q20 [M1] Radius tumbukan yang hilang.** GDD dan skema tidak memberi radius Unlit maupun proyektil.
**Default (u):** small 0.3, medium 0.4, large 0.6, warden 0.9, boss 1.6; proyektil musuh 0.2; proyektil pemain 0.15. Ditulis per `size_class` di config, boleh dioverride kolom `radius` di `enemies.csv` dan `weapons.csv`.

**Q21 [M1] [AU] Ambang tekanan musik.** audio-direction memakai "lebih dari 60 Unlit hidup". Dengan `alive_cap` 70 di t1 sampai 5, angka 60 hampir tidak tercapai di awal run dan terlalu sering di Tingkat C.
**Default:** `pressureAdd` aktif saat Unlit hidup minimal 60% `alive_cap` Pulse itu (A: 42, lalu 54 mulai t6), lepas di bawah 50%. Kunci config baru `music_pressure_frac` 0.6. Sim memancarkan event saat ambang dilewati.

## 7. Glint dan pickup

**Q22 [M1] Butir per drop.**
**Default:** Satu butir per Unlit dengan nilai = kolom `glint` (tank = 1 butir bernilai 5). Warden = 5 butir bernilai 5. `on_pickup` dipicu per butir.

**Q23 [M1] [LP] Batas butir di lantai.** gdd 4.2 (lebih dari 150 butir: yang tertua digabung jadi butir bernilai 5) bertentangan dengan architecture 8.1 (pool penuh: digabung ke Glint terdekat), dan "bernilai 5" tidak menjaga total nilai.
**Default:** Bila butir di lantai akan melebihi 150, Glint baru ditambahkan ke butir terdekat dari titik jatuhnya (nilai dijumlah, tidak ada nilai hilang). Kunci `glint_merge_value` dihapus.

**Q24 [M2] Glint yang memberi XP.** gdd 1 butir 2 hanya menyebut "memungut Glint".
**Default:** XP hanya dari Glint yang masuk lewat pungutan butir: pungutan biasa, pengganda Magpie Tin, auto-pungut akhir Pulse dan boss, butir dari Lucky Button dan Tithe Coin. Glint langsung (bunga Trade, Ledger Page, hasil jual, pengganti peti kosong) tidak memberi XP.

## 8. XP dan level-up

**Q25 [M1] Gulir kartu level-up.**
**Default:** Kartu tiap level digulir saat layarnya ditampilkan (sesudah pilihan sebelumnya diterapkan), dengan threat Pulse yang baru selesai dan luck saat itu. 3 stat berbeda; stat yang sudah di batas maks tidak ditawarkan. Kartu `max_hp` juga menambah HP sekarang. Level tertunda tidak bisa dilewati atau disimpan untuk nanti.

## 9. Toko

**Q26 [M1] [UI] Konfirmasi angka toko dan level-up.**
**Default (setuju GDD dan ui-spec):** 4 tawaran (5 dengan Trade 4), 6 slot senjata, Keepsake tanpa batas slot, toko tanpa timer, tanpa reroll dan tanpa skip level-up.

**Q27 [M1] [UI] [LP] Urutan antrean setelah Pulse.**
**Default:** Timer 0, `pulseClear` 1.0 s, hadiah Warden (bila ada), kartu level-up satu per level, lalu toko. State machine architecture 4.4 belum punya fase hadiah Warden; LP perlu menambah fase `wardenReward` (lihat Catatan untuk LP).

**Q28 [M1] Isi tawaran.**
**Default:** Tidak ada id ganda dalam satu set tawaran, termasuk kartu terkunci. Kartu senjata tetap bisa muncul saat slot penuh dan tidak bisa merge (beli ditolak, UI menampilkan "No free slot"). Bobot tag kelas dan tag dimiliki dikalikan (maks x1.875). Dorongan merge memilih seragam di antara senjata milik pemain dengan tier di bawah IV. Pool rarity kosong: turun satu tingkat; bila Plain juga kosong, naik. `round` di rumus harga = setengah ke atas.

**Q29 [M1] Slot terbeli dan kartu terkunci.**
**Default:** Slot yang dibeli kosong sampai reroll atau toko berikutnya. Reroll mengisi semua slot tak terkunci, termasuk yang kosong. Toko berikutnya mengisi semua slot tak terkunci tanpa biaya. Kartu terkunci yang menjadi tidak sah (Keepsake unik sudah didapat dari peti, tumpukan sudah penuh) diganti saat toko dibuka.

## 10. Keepsake dan efek primitif

**Q30 [M1] on_kill dan rantai proc.** Pengaman effect-primitives 6.2 membuat kill oleh tick Burn (proc) hanya memicu efek `allow_proc=1`. Akibatnya Flame 4 ("Unlit yang mati saat terbakar meledak", aksi `spawn_area`, default `allow_proc=0`) hampir tidak pernah jalan.
**Default:** Kill oleh tick Burn dan oleh `execute` dihitung sebagai kill kedalaman 0: memicu semua `on_kill` (`killed_by_crit` = 0). Ledakan Flame 4 yang membunuh Unlit lain berkedalaman 1 dan tidak memicu apa pun lagi. Unlit yang mati oleh ledakan exploder menjatuhkan Glint, tetapi `on_kill` tidak dipicu.

**Q31 [M1] Param efek yang hilang atau ambigu.**
**Default:** `every_nth` tanpa scope = `global` (Prism Lens). `on_distance` ikut menghitung jarak dash Glass Step. Splinter Comb `seek_other` = Unlit terdekat selain target dalam 6 u, tanpa tembakan bila tidak ada; `dmg_frac` dihitung dari damage akhir hit pemicu sesudah crit. Serpih kecil Shard 2: 12 u/s, jangkauan 3 u, ke 2 Unlit terdekat lain dalam 4 u, sisanya arah acak (aliran `combat`). Bara Smolder Boots: `max_alive` 6. Hit dari bara dan zona = `source_kind` `zone`.

## 11. Sinergi

**Q32 [M1] Hitungan tag.**
**Default:** Tag kelas tidak menambah hitungan (hanya bobot toko). Senjata awal ikut dihitung. Jual menurunkan hitungan seketika. Ambang aktif dan nonaktif langsung di toko, sehingga UI menampilkannya sebelum Pulse. Tag di luar tingkat build tidak dihitung.

## 12. Warden

**Q33 [M2] Hadiah Warden.** gdd 4.1 (25 Glint pecah jadi 5 butir) dan 15.1 ("Hadiah Warden: 25 Glint") bisa dibaca sebagai drop di lantai atau hadiah di layar.
**Default:** 25 Glint jatuh sebagai 5 butir di lantai; layar hadiah hanya berisi peti Keepsake (plus Silt di B dan C). Bila Warden mati di waktu tambahan, butirnya dipungut 100%. Peti: wajib pilih 1, tanpa skip, tanpa id ganda. Bila Keepsake sah kurang dari 3, tampilkan yang ada; bila 0, ganti 25 Glint langsung.

**Q34 [M2] Spawn Warden dan waktu tambahan.**
**Default:** Warden tidak dihitung ke batas hidup; muncul di sektor terjauh dari pemain dengan telegraf 0.8 s berdiameter 3 u. Saat timer 0 dan Warden masih hidup: antrean spawn dibuang, Unlit yang ada tetap menyerang. Warden mati sebelum timer 0: Pulse lanjut normal sampai timer habis. `hasted` ditambahkan sekali setelah 20 s waktu tambahan.

## 13. Boss

**Q35 [M2] Masuk, amuk, dan tetesan.**
**Default:** Telegraf panggung berjalan 2.0 s sejak Pulse mulai; boss tidak bisa dilukai dan tidak memberi damage sebelum keluar. Amuk 120 s dihitung sejak boss keluar. Tetesan 2 swarmer tiap 4 s berjalan sampai boss mati tanpa batas jumlah (angka 30 di tabel 3.4 hanya estimasi) dan menjatuhkan Glint normal, sama dengan swarmer Moth Call.

**Q36 [M2] Transisi fase.**
**Default:** HP boss tidak bisa turun di bawah ambang fase sampai pola yang sedang berjalan selesai dan transisi 1.5 s lewat; boss kebal selama transisi, jadi fase 2 tidak bisa dilewati dengan burst. Boss diam selama telegraf dan eksekusi pola, bergerak hanya di jeda.

**Q37 [M2] Angka pola `boss_lantern` yang hilang.**
**Default:** Ember Rain: lingkaran pertama tepat di posisi pemain, sisanya acak dalam 3 u tanpa tumpang tindih. Snuff Ring: tebal 0.6 u, arah celah acak seragam (aliran `ai`); cincin ganda di fase 2 berjeda 0.8 s dengan celah berbeda minimal 90 derajat. Lantern Lanes: lebar jalur 1.2 u, jalur horizontal (sejajar sumbu x) di posisi z acak, proyektil berjarak 0.6 u dengan kecepatan 8 u/s. Moth Call: 6 swarmer dari sektor tepi acak.

## 14. Akhir run

**Q38 [M1] Alur menang, kalah, dan Abandon.**
**Default:** HP 0: slow motion 1 s di dalam sim, lalu fase `defeat`. Boss final mati: semua Unlit larut, bahaya hilang, Glint dipungut 100%, jeda 1.5 s, lalu `victory`. M1 (tanpa boss): menang saat timer Pulse 10 habis. Abandon = `defeat` dengan layar run-lost.

## 15. Meta

**Q39 [M3, kontrak sejak M2] [UI] Silt dan Abandon.**
**Default:** Silt dihitung dan diberikan sekali saat run berakhir (menang, kalah, Abandon) dengan rumus gdd 17.1. Abandon dihitung seperti mati (hanya Pulse yang selesai). Run yang tidak pernah dilanjutkan setelah tab ditutup tidak memberi Silt. Tingkat A tidak menghitung Silt sama sekali.

## 16. Determinisme

**Q40 [M1] Prioritas di tick yang sama.**
**Default:** Urutan per tick: command, timer Pulse (bila 0, proses akhir Pulse dan lewati kombat tick itu), gerak dan serangan pemain, kematian Unlit (termasuk boss), lalu damage ke pemain. Jadi akhir Pulse dan kematian boss final menang atas kematian pemain di tick yang sama. Seed run dipilih app tiap run dan ditampilkan kecil di layar akhir run untuk laporan bug; tidak ada input seed oleh pemain di 1.0.

**Q41 [M1] [QA] Target tertulis untuk tes.**
**Default:** (a) Kurva kesulitan = tabel gdd 19, ditambah: tidak ada Pulse non-boss dengan lebih dari 15% kematian bot wajar, dan median HP tersisa di akhir Pulse turun bertahap dari sekitar 90% (Pulse 1) ke sekitar 50% (Pulse 9). (b) Penanda stat datar = kolom `is_flat` di `keepsakes.csv`; senjata tidak pernah dihitung datar. (c) Jumlah musuh puncak = `alive_cap` Pulse terakhir profil (A 90, C 120) plus Warden atau boss. (d) Telegraf minimum = tabel gdd 14.1 plus telegraf spawn 0.8 s.

---

## Keputusan GP sendiri (tidak perlu dijawab, GD boleh veto)

- Gerak: kecepatan langsung tanpa akselerasi, vektor input dinormalisasi (diagonal tidak lebih cepat), sim isotropik. Kompensasi visual sumbu kedalaman (architecture 18) urusan render bila perlu.
- HP pemain dan Unlit disimpan pecahan; pemain mati saat HP 0 atau kurang; HUD menampilkan HP pemain dibulatkan ke atas.
- Batas heal per detik (leech 6, Collector Pin 4, pasif blade 3): jatah per detik sim, per sumber, reset tiap 60 tick sejak awal Pulse. Leech hanya dari hit non-proc.
- Charger: arah terkunci saat ancang-ancang mulai, terjang berhenti di batas arena. Shooter: membidik posisi pemain saat menembak (tanpa prediksi), mundur bila pemain lebih dekat dari 5 u.
- Glint yang sudah tertarik tetap terbang sampai terpungut; terpungut saat jarak ke pemain paling jauh radius pemain plus 0.2 u.

## Catatan untuk LP (bukan pertanyaan GD)

- `InputFrame` belum memuat titik bidik kursor; Rite butuh `aimX`, `aimY` dalam u (Q13).
- State machine 4.4 butuh fase `wardenReward` sebelum `levelUp` (Q27).
- Bila Q12 disetujui, command merge manual tidak diperlukan; `shop.sell` tetap.
- `ArenaDef` memakai piksel tanah, LD dan GDD memakai unit 16 px (Q01). Pitch kamera juga beda (architecture 41.8 derajat, arena 38.68 derajat); di luar wilayah GP.
