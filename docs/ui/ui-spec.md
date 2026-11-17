# Shardfall: Spesifikasi UI

Pemilik: UI Programmer (UI). Status: versi 1.3 (M4-02, 2026-11-17), polish dan aksesibilitas. Reviewer: CD (rasa dan gaya), LP (teknis dan kontrak), QA (aksesibilitas).

**Perubahan versi 1.3 (M4-02: BUG-008, BUG-009, BUG-010, QA A-08 dan A-09, review `docs/reviews/M3-cd.md` 7 butir 10):**
- Navigasi panah (8.2, BUG-010): kandidat yang segaris dengan fokus (kotaknya bertumpang di sumbu silang, "beam") selalu menang atas kandidat yang lebih dekat tapi menyamping; membalik langkah yang keluar grup kembali ke elemen asal (memori satu langkah, hilang saat fokus pindah di dalam grup, hover, atau rebuild); elemen tersembunyi (kotak kosong) dilewati. Tes `tests/unit/ui/focus-nav.test.ts` memakai geometri Glazier 1080p nyata.
- Akhir run (S08): kembali dari The Keeping tidak memasang kunci 500 ms dan fokus kembali ke tombol terakhir (BUG-009). Saldo berlabel "Silt Held" sebagai baris statistik. Daftar build yang tidak muat bisa di-scroll (roda mouse, atau panah atas dan bawah saat daftar difokus) dengan tanda "More below" atau "More above"; daftar hanya menjadi titik fokus bila memang tidak muat.
- HUD (S03): banner Warden atau boss dan elemen sesaat lain dibersihkan saat run baru dimulai (jam sim kembali ke 0), dan banner yang berakhir lebih dari 2,5 detik di depan tidak pernah tampil (BUG-008). Padanan visual A-09: baris Lv berkedip emas saat naik level, bar HP menyala putih saat kena hit (durasi dalam tick, membeku saat jeda).
- Kontras A-08: teks kecil yang langsung di atas arena (subjudul, Felled by, label Pulse, Lv, timer, Glint, petunjuk tombol Rite, versi, saldo Silt judul dan The Keeping, baris info toko) memakai pelat `--plate` (ink 90%). Angka tag di panel Tag memakai `bone`, bukan warna tag (Echo biru hanya 4,0:1).
- The Keeping (S09): tombol Unlock di panel detail Memento bila ada paket Silt yang membukanya (pola "Press again" sama, fokus tetap di tombol).
- Judul (S01): kiri bawah petunjuk kontrol dari binding aktif (`ui.title.controls`) dan baris kredit (`ui.title.credit_line`). Font tim mendapat glyph titik tengah U+00B7.

**Perubahan versi 1.2 (M2-06, review `docs/reviews/M1-cd.md` 4 dan `docs/reviews/M1-lp.md` MINOR UI, BUG-003, BUG-005):**
- Font bitmap tim "Shardfall Pixel" aktif (7.2): glyph 5x7 dalam sel 6x9 sebagai data di `src/ui/pixel-font.ts`, dirakit menjadi TrueType kecil saat boot dan didaftarkan lewat `FontFace`. Cadangan monospace bila browser menolak.
- Ikon AD dipakai otomatis (12.4): `src/ui/icons.ts` mencari sprite `icon-<jenis>-<id>` di `UiDeps.art`, dirasterisasi skala integer; fallback monogram nama plus bentuk tag.
- Kartu (6.1): flavor membungkus maksimal 2 baris di kolom isi (BUG-003), lencana Fuse dan harga di kaki kolom samping, ikon 32 satuan (sprite 16 px skala 2).
- Baris build di Jeda dan Akhir run memakai kolom ikon dan pip tetap (BUG-005).
- HUD (S03): Pulse boss sebelum boss muncul menampilkan nama boss dengan bar kosong yang mengisi saat masuk (bukan "0:00"); banner kedatangan Warden dan boss (nama plus julukan), banner "Pulse {n} Held", banner singkat "Pulse {n}", petunjuk kontrol di Pulse 1, ikon dan muatan Rite, getar saat `RiteRejected`.
- The Glazier (S05): potret dan satu baris dari string table (aturan pilih di S05), tombol pintas Sell dan Fuse hanya bekerja pada slot yang difokus, slot terpilih ditandai.
- Temper (S04): "Lv {n}" besar, penghitung antrean kecil terpisah dengan pip.
- Judul (S01): `ui.title.save_lost` tampil bila Continue gagal.
- Pengaturan (S07): remap kontrol penuh, slider bisa diklik dan diseret, panah pilihan bisa diklik, baris Glazier Timer.
- `CommandRejected`: UI tidak lagi memutar `ui.denied` (AU memetakannya dari event) dan tidak mengumumkan alasan yang senyap di AU (`WrongPhase`, `UnknownId`, `DebugDisabled`).
- Ukuran teks Large dan Largest (7.3) dan varian mode warna (9) diterapkan; nilai palet buta warna masih placeholder UI sampai AD.

**Perubahan versi 1.1 (review `docs/reviews/M0-cd.md` 2.10 dan `docs/reviews/M0-lp.md` UI):** Keepsake menjadi Memento (identifier `memento`); Archive menjadi The Keeping di teks (identifier layar tetap `archive`); Depth menjadi Crack; judul menang "Light Kept" plus layar antara Vitrine Steady (Tingkat C); judul level-up "Temper" dengan subjudul "Lv {n}"; Merge menjadi Fuse di teks (identifier dan command tetap `merge`); HUD slot timer menjadi bar HP Warden berlabel "Held" saat Pulse ditahan; bagian 12 memakai kontrak final architecture v2.1; `uiScale` dari piksel fisik; kualitas default Medium; volume 80/70/100/80 plus slider Interface, Mono Audio, Reduce Repeats; id cue UI mengikuti `docs/audio-list.md`; nama event `PlayerDamaged` dan `EnemyDamaged`; id layar `credits`.
Dasar: `docs/pillars.md`, `docs/style-guide.md` bagian 2, `docs/vision.md`. Bila bertentangan, pilar yang menang (Pilar 2 > Pilar 4 > Pilar 1 > Pilar 3).
Wireframe: `docs/ui/wireframes/` (satu file per layar, tautan di tiap bagian).

Penanda: **[Asumsi]** keputusan sementara yang perlu dikonfirmasi pemilik wilayah lain. **[Usulan ke X]** butuh persetujuan peran X.

---

## 1. Prinsip UI

1. **Satu pandangan, satu keputusan.** Setiap layar pilihan menampilkan semua info yang dibutuhkan tanpa scroll, tooltip berlapis, atau pindah layar (P4-e).
2. **HUD diam saat Pulse.** Hanya HP, waktu Pulse, Glint, cooldown Rite, dan level dengan bar XP tipis. Semua di tepi layar (style guide 2.2).
3. **Keyboard penuh, mouse setara.** Setiap aksi bisa dilakukan dengan keyboard saja dan dengan mouse saja. Hover mouse memindahkan fokus, jadi keduanya tidak pernah berselisih.
4. **UI membaca, sim memutuskan.** UI tidak menghitung harga, sinergi, atau hasil merge. UI menampilkan view dari sim dan mengirim command. Sim memvalidasi semuanya.
5. **Tidak ada warna sebagai satu-satunya tanda.** Setiap status juga punya bentuk, ikon, atau teks (mode buta warna, bagian 9).
6. **Animasi tidak pernah memblokir input.** Input saat animasi langsung menyelesaikan animasi itu.

## 2. Teknologi UI (keputusan)

**Keputusan: DOM dan CSS overlay di atas canvas three.js, TypeScript vanilla tanpa framework UI.**

| Opsi | Kelebihan | Kekurangan | Putusan |
|---|---|---|---|
| **DOM/CSS overlay** | Tata letak, wrap teks, fokus, dan event keyboard sudah tersedia di browser. Aksesibilitas (tombol asli, `aria-*`, live region) hampir gratis. Iterasi cepat dengan CSS. Tidak ikut kena post-processing (UI selalu tajam). Screenshot Playwright menangkap DOM dan canvas sekaligus | Ketajaman pixel butuh disiplin (skala integer). DOM yang sering berubah bisa mahal bila tidak hati-hati | **Dipilih** |
| UI di dalam three.js (sprite dan teks di scene) | Satu pipeline render, pixel pasti konsisten | Wrap teks, fokus, input, dan aksesibilitas harus dibangun sendiri. Lambat dikerjakan dalam satu malam. Ikut kena DoF dan bloom bila tidak dipisah | Ditolak |
| Canvas 2D terpisah di atas | Pixel tepat, ringan | Masalah yang sama dengan opsi three.js: fokus, wrap, aksesibilitas manual | Ditolak |

Alasan utama: kecepatan produksi (Producer menetapkan waktu satu malam) dan aksesibilitas (navigasi keyboard penuh, pembaca layar untuk menu). Dua kekurangan DOM ditangani begini:

- **Ketajaman pixel:** semua ukuran memakai satuan UI integer (bagian 7). Ikon dibuat dari data ke `<canvas>` kecil dengan `image-rendering: pixelated`. Font bitmap tim nanti dirender ke canvas per string lewat satu komponen `PixelText`, sehingga mengganti placeholder ke font bitmap tidak menyentuh kode layar.
- **Performa:** DOM HUD kecil (kurang dari 30 elemen). HUD hanya menulis ke DOM bila nilainya berubah. Bar memakai `transform: scaleX()` agar tidak memicu layout ulang. Container HUD memakai `pointer-events: none`.
- **Angka damage tidak memakai DOM.** Jumlahnya bisa ratusan per detik, jadi digambar di three.js oleh render layer (atlas glyph dari font yang sama). UI hanya memiliki pengaturannya. [Usulan ke LP]

Tanpa dependensi npm baru. Preact sempat dipertimbangkan (kecil, nyaman), tapi tidak perlu untuk jumlah layar ini dan butuh izin dependensi. Pola yang dipakai: antarmuka `Screen` sederhana (`mount`, `update(view)`, `unmount`, `onNav`) plus helper kecil pembuat elemen. Keputusan ini sejalan dengan keputusan LP nomor 11 di `docs/tech/architecture.md` (UI DOM tanpa framework di atas canvas, `three` satu-satunya dependensi runtime). Struktur folder induk milik LP; usulan isi `src/ui/` ada di bagian 12.3.

Struktur DOM:

```
#game-root
  canvas#stage            three.js (arena, aktor, angka damage)
  #ui-root                CSS var --u (satuan UI) dan --fs (skala font)
    #hud                  aria-hidden saat Pulse, pointer-events: none
    #screen-layer         satu layar aktif (menu, toko, level-up, dst.)
    #modal-layer          dialog konfirmasi
    #banner-layer         banner sesaat (nama Warden, "Pulse 7 Held")
    #live-region          aria-live="polite" untuk pengumuman pembaca layar
```

## 3. Daftar layar

| ID | Layar | Kapan | Wireframe |
|---|---|---|---|
| S01 | Judul (menu utama) | Saat game dibuka | [01-title.md](wireframes/01-title.md) |
| S02 | Pilih Kept (pilih kelas) | Dari Judul atau akhir run | [02-class-select.md](wireframes/02-class-select.md) |
| S03 | HUD Pulse | Selama Pulse | [03-hud.md](wireframes/03-hud.md) |
| S04 | Pilihan level-up (1 dari 3) | Awal fase toko, sekali per level yang didapat | [04-level-up.md](wireframes/04-level-up.md) |
| S04b | Hadiah Warden (pilih Memento) | Awal fase toko setelah Warden dikalahkan | [04-level-up.md](wireframes/04-level-up.md) |
| S05 | The Glazier (toko) | Antar Pulse | [05-glazier.md](wireframes/05-glazier.md) |
| S06 | Jeda (dengan ringkasan build) | Esc saat Pulse atau toko | [06-pause.md](wireframes/06-pause.md) |
| S06b | Dialog konfirmasi | Aksi yang tidak bisa dibatalkan | [06-pause.md](wireframes/06-pause.md) |
| S07 | Pengaturan | Dari Judul atau Jeda | [07-settings.md](wireframes/07-settings.md) |
| S08 | Akhir run (kalah atau menang) | Kept mati, boss terakhir kalah, atau run ditinggalkan | [08-run-end.md](wireframes/08-run-end.md) |
| S09 | The Keeping (meta dan unlock, identifier `archive`) | Dari Judul atau akhir run | [09-archive.md](wireframes/09-archive.md) |

Elemen sesaat (bukan layar, tanpa input): banner nama Warden atau boss, banner akhir Pulse, petunjuk kontrol di Pulse 1, pesan "jendela terlalu kecil".

**ID layar untuk tes** (dipetakan dari `AppScreen` LP plus `view.phase`; dipakai hook `goToScreen(id)` QA, atribut `data-screen` pada root layar, dan nama screenshot di `test-plan.md` 7.4): `title`, `class-select`, `pulse`, `level-up`, `warden-reward`, `glazier`, `pause`, `confirm`, `settings`, `run-end` (varian `run-lost` dan `run-won`), `archive`, `credits`. Elemen interaktif punya atribut `data-ui` yang stabil (misalnya `data-ui="shop-offer-2"`, `data-ui="shop-reroll"`) agar tes Playwright tidak bergantung pada teks.

Tingkat konten (vision.md 7.2): Tingkat A butuh S01, S03, S04, S05, S06, S07 minimal (kualitas dan volume), S08. Pilih Kept (S02) dan Arsip (S09) baru penting di Tingkat B (3 kelas, Silt). Di Tingkat A, S02 tetap tampil dengan satu kelas agar alur tidak berubah nanti.

## 4. Alur antar layar

```mermaid
stateDiagram-v2
    [*] --> Title
    Title --> ClassSelect: Begin
    Title --> Glazier: Continue (autosave ada)
    Title --> Archive: The Keeping
    Title --> Settings: Settings
    Settings --> Title: Back
    Archive --> Title: Back
    ClassSelect --> Title: Back
    ClassSelect --> Pulse: Begin (run.start)

    state Run {
        Pulse --> Pause: Esc / focus lost
        Pause --> Pulse: Resume
        Pause --> SettingsInRun: Settings
        SettingsInRun --> Pause: Back
        Pause --> Confirm: Abandon Run
        Confirm --> Pause: Stay
        Pulse --> PulseEndBanner: timer 0
        PulseEndBanner --> WardenReward: Warden kalah di Pulse ini
        PulseEndBanner --> LevelUp: ada level baru
        PulseEndBanner --> Glazier: tanpa hadiah
        WardenReward --> LevelUp: ada level baru
        WardenReward --> Glazier
        LevelUp --> LevelUp: masih ada level
        LevelUp --> Glazier: antrean habis
        Glazier --> Pause: Esc
        Glazier --> Pulse: Begin Pulse
    }

    Pulse --> RunEnd: Kept mati / boss terakhir kalah
    Confirm --> RunEnd: Abandon
    RunEnd --> Pulse: Try Again (kelas sama)
    RunEnd --> ClassSelect: Choose Kept
    RunEnd --> Archive: The Keeping
    RunEnd --> Title: Title
```

Versi ASCII (untuk dibaca tanpa renderer):

```
Title --Begin--> ClassSelect --Begin--> [RUN]
  |                  ^                     |
  +--> Archive       |                     v
  +--Continue--> Glazier (autosave)
  +--> Settings      |     +---------> Pulse <-------------------+
                     |     |             |  \--Esc--> Pause --> Settings
                     |     |          timer 0          |  \--> Confirm --Abandon--+
                     |     |             v             |                          |
                     |     |       PulseEndBanner      +--Resume--> (kembali)     |
                     |     |             v                                        |
                     |     |   [WardenReward] -> [LevelUp x N] -> Glazier         |
                     |     |                                         |            |
                     |     +-------------- Begin Pulse --------------+            |
                     |                                                            |
                     |   Kept mati atau boss terakhir kalah --> RunEnd <----------+
                     +----------- Choose Kept ----------------------+
                                  Try Again --> Pulse (kelas sama)
```

Aturan alur:
- **Antrean hadiah.** Sim memberi antrean pilihan di awal fase toko. UI menampilkannya satu per satu sesuai urutan dari sim. [Asumsi] Urutan default: hadiah Warden dulu, lalu level-up, lalu toko. GD boleh mengubah urutan tanpa mengubah UI.
- **Banner akhir Pulse** tampil sekitar 1 detik sambil kilatan kaca melarutkan Unlit (style guide 1.6), lalu layar berikutnya muncul. Banner bisa dilewati dengan input apa pun.
- **Jeda otomatis** saat tab browser kehilangan fokus (`visibilitychange` atau `blur`) selama Pulse. Bisa dimatikan di pengaturan.
- **Tidak ada menu bertingkat lebih dari satu level dalam run** (P4-c). Jeda menampilkan ringkasan build langsung di panelnya, tanpa sub-layar. Pengaturan dari Jeda adalah satu-satunya level kedua, dan berada di luar alur keputusan.
- **Autosave (keputusan LP, architecture.md bagian 12):** run disimpan saat masuk toko dan setelah setiap command toko. Menutup tab di tengah Pulse berarti melanjutkan dari toko terakhir lewat tombol Continue di Judul. Save yang tidak bisa dimuat dibuang dengan pesan singkat (`ui.title.save_lost`), tanpa crash.
- [Asumsi] Meninggalkan run (Abandon) menghasilkan layar akhir run seperti kalah. Apakah tetap dapat Silt adalah aturan GD.

## 5. Isi tiap layar

### S01 Judul
- Latar: arena bioma pertama dalam mode diam (kamera tetap, lentera berkedip, debu kaca melayang). Tidak ada Unlit.
- Judul game (teks besar), kalimat pengait di bawahnya.
- Menu vertikal: Continue (hanya bila ada autosave run), New Run (`ui.title.begin`), The Keeping (Tingkat B), Settings, Credits. Tidak ada tombol Quit (browser).
- Begin saat ada autosave: run lama ditimpa. Karena tidak bisa dibatalkan, Begin memakai pola "Press again" (lihat S09) bila autosave ada.
- Pojok kanan atas: saldo Silt (hanya bila Silt aktif, Tingkat B).
- Pojok kanan bawah: nomor versi build (label kecil `dust`).
- Pojok kiri bawah (M4-02): petunjuk kontrol run dari binding aktif ("WASD Move · Space Rite · Esc Pause") dan baris kredit ("v1.0 · made by an AI team · assets procedural").
- Fokus awal: Continue bila ada, selain itu Begin.

### S02 Pilih Kept
- Kiri: daftar kelas (baris: potret kecil, nama kelas 1 kata, satu baris peran). Kelas terkunci tampil sebagai siluet dengan ikon gembok dan biaya Silt.
- Kanan: panel detail kelas yang difokus: potret besar (sprite 24x24 dirender 2x), nama, satu baris tagline, senjata awal (ikon, nama, efek 2 baris), Rite (ikon, nama, efek 2 baris, cooldown dalam detik), 3 sampai 4 chip stat awal yang paling membedakan.
- Bawah: tombol Begin dan Back. Bila tingkat kesulitan sudah terbuka (Tingkat C): pemilih "Crack" dengan panah kiri dan kanan.
- Kelas terkunci tidak bisa dimulai. Tombol Begin diganti teks "Unlock in The Keeping" dan tombol pintas ke The Keeping.
- Fokus awal: kelas terakhir yang dimainkan.

### S03 HUD Pulse
Hanya elemen ini (style guide 2.2):

| Elemen | Posisi | Isi | Perilaku |
|---|---|---|---|
| HP | Kiri atas | Bar `kept-blue` 120 x 8 satuan, teks "42/60" di dalam atau di kanan bar | Damage: bagian yang hilang berubah putih lalu menyusut dalam 300 ms (chip). Di bawah 30%: bingkai bar berdenyut `danger-red` plus ikon retak kecil (bentuk, bukan hanya warna) |
| Level dan XP | Tepat di bawah HP | Label "Lv 4" plus bar tipis 120 x 3 `kept-gold` | Saat naik level: bar berkedip emas sekali, angka level naik. Level-up tidak membuka layar saat Pulse; pilihan muncul di fase toko |
| Waktu Pulse | Tengah atas | Label kecil "Pulse 7" di atas, timer besar "0:24" angka tabular (atau bar HP boss / Warden "Held", lihat di bawah) | Hitung mundur per detik. 5 detik terakhir: angka `kept-gold`, sedikit membesar tiap detik (mati bila kurangi efek). Tidak memakai merah karena akhir Pulse adalah hal baik |
| Glint | Kanan atas | Ikon Glint 8 x 8 plus angka tabular | Angka naik dengan tick cepat saat memungut. Tidak ada animasi terbang ke HUD (mengurangi kekacauan) |
| Rite | Tengah bawah | Ikon Rite 32 x 32 dengan isian cooldown dari bawah ke atas, sisa detik di tengah, petunjuk tombol di bawah ("Space") | Saat siap: bingkai `kept-gold` dan denyut sekali. Saat ditekan tapi belum siap: ikon bergetar kecil plus suara "denied" |

- HUD berada di pita atas dan bawah layar, yang juga merupakan pita DoF (style guide 1.7). Overlay DOM tidak ikut blur, jadi HUD tetap tajam, dan tengah arena bebas.
- Margin HUD 8 satuan dari tepi viewport. HUD menempel ke tepi viewport nyata, bukan ke area aman 640x360, agar layar lebar tidak membuat HUD masuk ke tengah.
- **Slot timer berubah isi, jumlah elemen tetap (style guide 2.2, CD K3):**
  - **Pulse boss** (`pulse.isBoss`, `ticksTotal = 0`): slot timer menjadi bar HP boss dari `pulse.boss` (`BigFoeView`): nama boss di atas (`enemy.nameKey`), isian `danger-violet`, bingkai tipis, tanpa angka besar. Fase boss tampil sebagai pip kecil (1 sampai 3).
  - **Warden menahan Pulse** (`pulse.overtime` dan `pulse.wardenAlive`): komponen bar yang sama dari `pulse.warden`, label "Held" (`ui.hud.held`) di atas bar plus nama Warden. Pemain selalu tahu bahwa Pulse berakhir saat Warden jatuh.
  - Mengamuk (`enraged`) menambah ikon kecil di kanan bar (bentuk, bukan hanya warna).
- **Pulse boss sebelum boss muncul** (`isBoss` dan `boss.active` false): slot berisi nama boss yang diharapkan (slot profil di `GameData.profiles` dengan indeks Pulse ini, cadangan musuh pertama berperan `boss`) dan bar kosong berbingkai netral; bar mengisi dalam 600 ms saat boss aktif. Tidak pernah "0:00".
- **Elemen sesaat di HUD** (diukur dalam tick sim, jadi membeku saat jeda; `src/ui/presenters/hud-transient.ts`):
  - Banner Warden atau boss dari `WardenSpawned` dan `BossSpawned`: nama plus julukan (`unlit.<id>.epithet`, bila ada) di bawah slot timer, bingkai `danger-violet`, 2.5 detik, tanpa input.
  - Banner "Pulse {n} Held" (`ui.banner.pulse_held`) 2.5 detik saat slot timer berubah menjadi bar Warden.
  - Banner singkat "Pulse {n}" 1.2 detik saat `PulseStarted` (CD M1 4 [S]); tidak pernah menutupi banner kedatangan yang masih tampil.
  - Petunjuk kontrol di Pulse 1 (setiap run, [Asumsi]: MetaView tidak membawa jumlah run): `ui.hud.hint_move` dan `ui.hud.hint_rite` dari binding aktif ("WASD Move", "Space Rite") di atas ikon Rite, memudar setelah 6 detik atau setelah pemain bergerak 1 u dan memakai Rite.
  - Slot Rite: ikon Rite AD, angka muatan di sudut bila Rite punya lebih dari satu muatan, getar 250 ms saat `RiteRejected` (mati bila kurangi efek).
- Bukan milik HUD: kilat merah di tepi layar saat kena hit (VFX, style guide 1.8), angka damage (three.js).

### S04 Pilihan level-up
- Judul "Temper", subjudul "Lv 5" (Pilar 4: angka level tetap cepat dibaca), dan di bawahnya penghitung antrean kecil terpisah "1 of 2" (`ui.levelup.queue`) dengan pip per level (pip hanya sampai 8 level; lebih dari itu hanya teks), bila ada lebih dari satu level (review M1 CD dan LP).
- 3 kartu bertumpuk vertikal di tengah (format kartu baris, bagian 6.1). Setiap kartu: ikon stat besar, nama, efek 1 sampai 2 baris, angka tombol pintas 1, 2, 3.
- Ringkasan stat kecil di kanan: nilai stat sekarang. Saat kartu difokus, stat yang terdampak menampilkan nilai baru ("Speed 110 > 118" dengan nilai baru `kept-gold`). Ini menjawab "apa yang berubah" tanpa hitungan (P4-a).
- [Asumsi] Tidak ada reroll level-up. Bila GD menambahkannya, tombol Reroll muncul di bawah kartu dengan pola yang sama seperti toko.
- Kunci input 300 ms saat layar muncul (bagian 8.4).
- Fokus awal: kartu 1.

### S04b Hadiah Warden
- Sama dengan S04, judul "Take a Memento" plus nama Warden yang dikalahkan sebagai subjudul.
- Kartu Memento menampilkan baris tag dan flavor (warna `dust`), sama seperti kartu toko, tanpa harga.
- Jumlah pilihan dari data GD (layout mendukung 2 sampai 3).

### S05 The Glazier
Layar paling penting. Semua di satu layar tanpa scroll (P4-e, kriteria tolak Pilar 4).

| Area | Isi |
|---|---|
| Bar atas | Judul "The Glazier", label "Next: Pulse 8", HP sekarang (bila ada penyembuhan antar Pulse), saldo Glint besar di kanan |
| Kolom kiri | Potret the Glazier (48 x 48) dan satu baris ucapan pendek (opsional, dari WR). Di bawahnya **panel Tag**: satu baris per tag yang dimiliki (ikon tag, nama, pip ambang, angka "3/4") |
| Kolom tengah | **4 kartu tawaran** bertumpuk vertikal (jumlah dari data GD, layout mendukung 3 sampai 5). Format kartu baris (6.1) dengan harga, tombol gembok, dan lencana Fuse bila berlaku |
| Kolom kanan | **Inventaris**: slot senjata (grid 3 x 2, slot kosong terlihat), Memento (grid ikon kecil). Tombol "Stats" mengganti isi kolom ini menjadi daftar stat (tetap di layar yang sama, bukan menu baru) |
| Bar bawah | Tombol Reroll dengan biaya Glint, tombol Begin Pulse di kanan bawah, petunjuk tombol |

Perilaku keputusan cepat:
- **Pratinjau sinergi.** Saat kartu tawaran difokus, panel Tag menampilkan pip bayangan "+1" pada tag milik kartu itu. Bila pembelian akan melewati ambang, baris tag itu bersinar emas dan menampilkan satu baris efek ambang baru ("Unlocks: ..."). Tag yang belum dimiliki muncul sementara di panel dengan tanda "New".
- **Pratinjau Fuse.** Bila tawaran sama dengan item yang dimiliki dan bisa digabung (`ShopOfferView.mergeSlot >= 0`), kartu menampilkan lencana "Fuse > II" (tier dari `mergeToTier`). Slot senjata yang akan tergabung ikut menyala.
- **Tidak mampu beli.** Harga dan tombol beli tampil abu redup dengan ikon Glint bergaris miring. Tidak memakai merah (style guide 1.3). Menekan beli tetap memberi umpan balik "Not enough Glint" (getar kecil plus suara denied plus pengumuman pembaca layar).
- **Slot penuh.** Bila senjata baru tidak muat dan tidak bisa merge, kartu menampilkan "No free slot" di tempat lencana. Aturan jual atau ganti adalah milik GD. Aksi Sell dan Fuse ada di slot inventaris (fokus slot, tekan X atau M, atau klik tombol kecil di slot), bukan di menu baru. Slot dengan `canMerge` menampilkan tombol Fuse.
- **Gembok.** Ikon gembok di setiap kartu. Kartu terkunci punya bingkai bergaris dan ikon gembok tertutup. Aturan gembok (bertahan setelah reroll, gratis atau tidak) milik GD.
- **Setelah membeli,** slot kartu berubah menjadi kosong bertuliskan "Taken" (tidak bergeser), agar posisi kartu lain dan tombol pintasnya tetap sama.
- **Sell dan Fuse (review M1 LP):** tombol pintas X dan M hanya bekerja pada slot inventaris yang sedang difokus; di tempat lain memberi umpan balik "denied". Tombol Sell dan Fuse di bar bawah bekerja pada slot terakhir yang difokus (slot terpilih ditandai bingkai emas ganda); memfokus tawaran menghapus pilihan slot. Tombol tampil redup bila tidak ada slot yang bisa dijual atau di-Fuse.
- **Potret dan baris the Glazier** (CD M1 4, `src/ui/presenters/glazier-line.ts`): potret dari sprite `icon-portrait-glazier` (fallback topeng kaca CSS). Satu baris dari string table WR (`glazier.<pemicu>`), dipilih deterministik agar screenshot dan replay sama: saat kunjungan dibuka, `warden_fell` bila hadiah Warden tampil sejak Pulse terakhir, `first` di kunjungan pertama run, selain itu bergantian `open` dan `after_temper` (bila ada Temper) menurut nomor Pulse. Reaksi: `reroll` (ShopRerolled), `fuse` (ItemMerged), `no_glint` (CommandRejected NotEnoughGlint). Varian WR `glazier.<pemicu>.1` sampai `.9` otomatis masuk kumpulan; indeks = benih modulo jumlah varian (benih: nomor Pulse untuk pembuka, revisi toko untuk reaksi). Kembali dari jeda tidak mengganti baris.
- **Langkah beli:** fokus kartu lalu Enter (2 input), atau tekan angka slot (1 input), atau satu klik pada tombol harga (P4-c).
- [Asumsi] Toko tanpa batas waktu. Bila GD menambahkan timer, timer tampil di bar atas di sebelah judul.
- Fokus awal: kartu tawaran pertama yang mampu dibeli. Bila tidak ada, tombol Begin Pulse.

### S06 Jeda
- Lapisan gelap di atas arena yang membeku (opasitas 60%).
- Kiri: menu Resume, Settings, Abandon Run.
- Kanan: ringkasan build hanya-baca: senjata dan tiernya, Memento (fokus atau hover menampilkan nama, efek, dan flavor di panel kecil di bawah grid), panel Tag, stat utama, Pulse sekarang dan waktu run.
- Esc atau P menutup jeda (Resume). Fokus awal: Resume.
- **Lanjut dari jeda saat Pulse:** hitung mundur singkat "3, 2, 1" di slot timer selama total 900 ms sebelum sim berjalan lagi, agar pemain tidak langsung kena damage (saran QA A-06). Tombol gerak yang ditahan selama hitung mundur sudah dihitung sehingga pemain bisa langsung bergerak saat sim jalan. Dari jeda di toko atau level-up tidak ada hitung mundur.
- Jeda tersedia di Pulse, level-up, hadiah Warden, toko, dan saat banner Warden atau boss tampil (A-06).

### S06b Dialog konfirmasi
- Dipakai hanya untuk aksi yang tidak bisa dibatalkan dan bukan bagian alur keputusan cepat: Abandon Run, reset pengaturan, hapus data simpan.
- Judul pertanyaan, dua tombol. Fokus awal selalu pada pilihan aman ("Stay"). Esc sama dengan pilihan aman.
- Membeli, reroll, dan memilih kartu tidak pernah memakai dialog (kriteria tolak Pilar 4).

### S07 Pengaturan
Empat tab dalam satu layar: Graphics, Audio, Controls, Accessibility. Perubahan langsung berlaku dan langsung disimpan, tanpa tombol Apply.

| Tab | Opsi | Nilai (default tebal) |
|---|---|---|
| Graphics | Quality | Low, **Medium**, High. Default Medium (target perangkat P-REF, review LP). Low mematikan DoF, bloom, kilau kaca (P3-f) |
| | Screen shake | 0 sampai 100, langkah 10, **100** |
| | Fullscreen | **Off**, On |
| Audio | Master, Music, Sound Effects, Interface | 0 sampai 100, langkah 10. Default **80 / 70 / 100 / 80** (AU). Masing-masing bisa 0 (A-09). Interface = bus `ui` |
| | Mono Audio | **Off**, On (AU 8.7) |
| | Reduce Repeats | **Off**, On (AU 8.7: meredam SFX berulang) |
| | Mute when unfocused | Off, **On** |
| Controls | Remap gameplay: Move Up, Move Down, Move Left, Move Right, Rite, Pause | Default di bagian 8.1. Tiap aksi punya 2 binding |
| | Remap menu: Confirm, Back, Reroll, Lock, Begin Pulse, Stats | Default di bagian 8.1 |
| | Reset controls | Dengan konfirmasi |
| Accessibility | Text size | **Normal**, Large, Largest (bagian 7.3) |
| | Reduce effects | **Off**, On (default On bila `prefers-reduced-motion`, A-11) |
| | Damage numbers | **On**, Off |
| | Color vision | **Off**, Protanopia, Deuteranopia, Tritanopia (palet milik AD) |
| | Pause when unfocused | Off, **On** |
| | Show flavor text | **On**, Off |
| | Solid panels | **Off**, On (panel opasitas 100%, tanpa kilau kaca) |
| | Shop timer (hanya bila GD memberi timer toko) | **On**, Off, atau Extended (A-12) |

- Remap: pilih aksi, teks berubah menjadi "Press a key", tombol berikutnya menjadi binding. Esc membatalkan perekaman. Bila tombol sudah dipakai aksi lain dalam konteks yang sama, kedua binding ditukar dan ditampilkan catatan singkat ("Swapped with Rite.").
- Pemetaan memakai `KeyboardEvent.code` (posisi fisik), label tombol di layar memakai nama tombol sesuai tata letak keyboard pemain (mengikuti QA A-01).
- **Jalur aman menu:** Confirm dan Back bisa di-remap, tapi Enter dan Esc selalu tetap berfungsi sebagai Confirm dan Back di layar menu, sebagai cadangan tetap yang tidak bisa dihapus. Pemain tidak pernah bisa mengunci dirinya keluar dari menu.
- Disimpan oleh app di `localStorage` kunci `shardfall.settings.v1` (architecture.md bagian 12). UI hanya menampilkan dan memanggil `AppActions.applySettings` dengan objek `Settings` baru (bertingkat `graphics`, `audio`, `access`, `keybinds`; architecture 6.11). Default ada di `src/app/settings.ts` (LP).
- M2 (M2-06): semua tab fungsional. Controls: dua kolom (Gameplay: gerak, Rite, jeda; Menus), dua tombol binding per aksi. Klik atau Enter pada binding memulai perekaman ("Press a key", juga di catatan bar bawah), tombol berikutnya menjadi binding, Esc batal, tombol modifier diabaikan. Tukar binding hanya di dalam konteks yang sama ("Swapped with {action}."). Reset Controls memakai pola "Press again" 3 detik (tanpa dialog). Default disalin di `src/ui/presenters/remap.ts` karena UI tidak boleh mengimpor app; tes `tests/unit/ui/remap.test.ts` menjaga salinan sama dengan `src/app/settings.ts`.
- Mouse: klik atau seret strip takik slider mengatur nilai langsung; klik panah "<" dan ">" pada baris pilihan. Baris Glazier Timer (On, Extended, Off) di Accessibility, disimpan sekarang dan dipakai bila GD memberi toko timer.

### S08 Akhir run
- Judul besar: kalah "Kept Lost" dengan subjudul "Another wakes beneath the glass." atau menang "Light Kept" (teks final dari WR). Tingkat C: setelah boss bioma yang bukan terakhir tampil layar antara "Vitrine Steady" (bukan akhir run), memakai tata letak yang sama dengan tombol Continue. Teks contoh dari style guide 4.1.
- **Penyebab kematian:** "Felled by [nama Unlit atau Warden]" plus ikon sumbernya. Mendukung uji "aku mati karena..." (style guide 5.7).
- Statistik ringkas: Pulse tercapai dari total, waktu run, Unlit dilarutkan, Glint dikumpulkan.
- Build akhir: ikon senjata dengan tier, ikon Memento, 1 sampai 2 tag dominan.
- Silt didapat: angka naik dari 0 dalam sekitar 800 ms (langsung bila kurangi efek), saldo baru. Bila ada yang kini bisa dibuka, label "New unlock available" dengan tombol ke The Keeping.
- Tombol: Try Again (kelas sama, fokus awal), Choose Kept, The Keeping (Tingkat B), Title.
- Kunci input 500 ms saat layar muncul, agar tombol yang ditekan saat mati tidak langsung memulai run baru. Kembali dari The Keeping tidak dikunci dan fokus kembali ke tombol terakhir (BUG-009).
- Saldo Silt setelah run sebagai baris berlabel "Silt Held" (CD M3 10). Daftar build yang tidak muat: scroll di dalam panel, tanda "More below" atau "More above" di bawah daftar, panah atas dan bawah menggulir saat daftar difokus lalu keluar ke tombol di tepinya.

### S09 The Keeping (identifier `archive`)
- Dua tab: Kept dan Mementos. Saldo Silt di kanan atas.
- Tab Kept: daftar kelas seperti S02 dengan status (dimiliki atau terkunci plus biaya). Fokus kelas terkunci menampilkan tombol Unlock dengan biaya.
- Tab Mementos: grid ikon semua Memento. Yang sudah ditemukan tampil penuh; yang belum tampil sebagai siluet dengan "Not yet found". Panel detail di kanan: ikon besar, nama, efek, tag, flavor. Memento yang bisa dibuka dengan Silt (aturan GD) punya tombol Unlock.
- **Konfirmasi belanja Silt tanpa dialog:** tekan Unlock sekali, tombol berubah menjadi "Press again" selama 3 detik; tekan lagi untuk membuka. Satu pola, ramah keyboard dan pembaca layar.
- Penghitung "12/30 found" di atas grid.
- M4-02: tombol Unlock di bawah teks panel detail Memento, tampil hanya bila Memento yang difokus dibuka oleh paket Silt (`meta_unlocks` jenis `memento_pack`) yang belum dimiliki. Kanan dari grid memfokus tombol itu; label "Unlock  20 Silt", lalu "Press again"; redup bila Silt kurang.

## 6. Komponen bersama

### 6.1 Kartu baris (item, Memento, level-up)

Satu komponen untuk toko, level-up, hadiah Warden, dan detail Arsip.

```
+-[1]--------------------------------------------------------------+
| +------+  Ember Ring                          [Fl][Ec]   (o) 12  |
| | ICON |  Hits ignite foes for 4 damage.                 [lock]  |
| | 32px |  Burning foes spread flame on death.                    |
| +------+  Still warm from a hand that never let go.     [Merge>II]|
+------------------------------------------------------------------+
```

- **Ikon besar di kiri, bukan di atas.** Alasan: efek boleh 2 baris x 40 karakter (style guide 2.4). Pada skala font minimum yang sah, 40 karakter memakan 240 satuan UI (480 piksel di 720p, 720 piksel di 1080p). Tiga kartu tegak berdampingan tidak muat di 1280 atau 1920 piksel tanpa melanggar ukuran teks atau batas 2 baris. Kartu baris bertumpuk juga membuat nama sejajar kiri sehingga mata bisa memindai ke bawah. [Usulan ke CD] Ini menyimpang dari urutan "ikon besar di atas" di style guide 2.1; isi dan urutan baca lainnya sama.
- Bingkai kartu memakai warna rarity, plus **pip rarity** di sudut kiri atas (Plain 0, Fine 1, Rare 2, Fabled 3) agar rarity tidak hanya dibedakan warna.
- Nama (`kept-white`), efek 2 baris (`bone`), flavor (`dust`, bisa disembunyikan di pengaturan) di bawah efek dalam kolom isi, membungkus maksimal 2 baris tanpa elipsis (BUG-003). Kolom samping: chip tag bertumpuk (ikon tag AD atau bentuk per tag, plus singkatan 2 huruf), lalu di kaki kolom lencana Fuse, tanda gembok, dan harga (ikon Glint AD plus angka tabular).
- Ikon besar: kotak 34 satuan (isi 32), sprite AD 16 x 16 dirender skala 2. Fallback: monogram 2 huruf dari nama tampil (misalnya "LB") dalam warna tag pertama, plus bentuk tag di sudut.
- Bingkai panel, tombol, dan kartu: 1 satuan dengan sudut tangga 1 piksel dan satu piksel bingkai di anak tangga dalam (tajam di semua skala), kilau kaca tipis sebagai gradien latar. Panel utama punya dua garis kilau di sudut kiri atas (mati bila kurangi efek atau panel solid).
- Fokus: bingkai `kept-gold` 1 satuan plus kartu naik 2 satuan (tanpa naik bila kurangi efek).
- Ukuran: lebar 344 satuan, tinggi minimal 44 satuan; dengan flavor 2 baris sekitar 55 satuan. Large dan Largest: lebar penuh kolom.
- Masuk: stagger 60 ms per kartu (naik 4 satuan plus fade, 160 ms). Dimatikan oleh kurangi efek.

### 6.2 Komponen lain
- **Panel:** `night` opasitas 90%, bingkai 1 satuan `bone` opasitas 60%, sudut terpotong miring 2 satuan (CSS `clip-path`). Kilau kaca opsional di sudut kiri atas panel utama.
- **Tombol:** teks 1 sampai 2 kata kerja, petunjuk tombol di kanan dalam kurung siku ("Reroll [R]"). Nonaktif: teks `dust` opasitas 50%.
- **Slider:** bar dengan 11 takik (0 sampai 100), angka di kanan. Kiri/kanan mengubah 10.
- **Toggle dan pilihan:** nilai dengan panah kiri dan kanan ("< Large >"), bukan dropdown.
- **Baris tag:** ikon tag, nama, pip ambang (pip penuh `kept-gold`, pip kosong garis `dust`), angka "3/4". Setiap tag punya bentuk ikon berbeda (bukan hanya warna). Ikon dari AD.
- **Petunjuk tombol:** selalu memakai binding aktif, bukan teks tetap. Saat gamepad aktif (M4), ikon tombol gamepad.

## 7. Skala UI, layout, dan tipografi

### 7.1 Satuan UI
- **Kanvas desain: 640 x 360 satuan UI.** Satu satuan UI = `uiScale` piksel **fisik**.
- `uiScale = max(2, floor(min(Wp / 640, Hp / 360)))` dengan `Wp x Hp` = ukuran viewport CSS dikali `devicePixelRatio` (review LP, architecture 7.3).
- CSS: `--u = uiScale / devicePixelRatio` px. Dengan begitu satu satuan UI tetap bulat di layar ber-DPR 1,25 dan 1,5 (umum di laptop Windows); tanpa ini UI buram.
- Skala UI terpisah dari skala dunia: pada 1920 x 950 fisik dunia berskala 3 dan UI berskala 2, disengaja.
  - 1920 x 1080: 3. 1280 x 720 dan 1366 x 768: 2. 2560 x 1440: 4. Sesuai style guide 1.4 (1 piksel sprite = 3 piksel layar di 1080p, 2 di 720p).
- Semua ukuran di CSS ditulis sebagai kelipatan `var(--u)` (misalnya `calc(var(--u) * 8)`). Tidak ada ukuran pecahan.
- Layar menu memakai area aman 640 x 360 di tengah viewport. HUD menempel ke tepi viewport nyata.
- Viewport minimum yang didukung: 1280 x 720. [Asumsi] Di bawah itu `uiScale` tetap 2 dan pesan kecil "Enlarge the window to play" tampil bila layout tidak muat. Game tetap berjalan.
- Rasio selain 16:9 (16:10, ultrawide): area aman tetap di tengah, ruang sisa diisi arena.

### 7.2 Font
- **Final (M2):** font bitmap tim "Shardfall Pixel" (glyph 5x7 dalam sel 6x9, ASCII 32 sampai 126, huruf kecil dengan descender 2 baris). Data glyph ada di `src/ui/pixel-font.ts`; saat boot UI merakitnya menjadi file TrueType kecil (satu kontur persegi per deret piksel, sekitar 13 KB, tanpa unduhan) dan mendaftarkannya lewat `FontFace`. Teks tetap teks DOM asli, jadi wrap, fokus, dan pembaca layar tidak berubah (komponen `PixelText` canvas tidak diperlukan). Kelas `has-pixel-font` dipasang setelah font diterima.
- CSS: `font-size` isi = 9 x `--f` dan `line-height` sama, sehingga satu piksel font = `--f` = bilangan bulat piksel fisik. Judul 18 x `--f` (skala 2), judul utama 27 x `--f`. Label kecil memakai `--fs` = `max(2, fontScale - 1)` piksel fisik. Tanpa bold sintetis (`font-synthesis: none`); penekanan memakai warna.
- **Cadangan:** font sistem monospace `ui-monospace, "Cascadia Mono", Consolas, monospace` bila `FontFace` gagal. Keputusan Producer melarang unduhan font eksternal.
- **Skala font** (piksel layar per piksel font): isi `fs = uiScale` (3 di 1080p, 2 di 720p); label kecil `max(2, uiScale - 1)`; judul `uiScale + 1` sampai `uiScale + 3`. Tinggi huruf besar minimum 14 piksel layar (style guide 2.3).
- Untuk placeholder, `font-size` diatur agar tinggi baris sama dengan 9 piksel font kali skala, sehingga layout tidak berubah saat font bitmap masuk.

### 7.3 Ukuran teks besar
Tiga tingkat, semua skala integer (memenuhi QA A-05):

| Tingkat | Skala font isi | 1080p (tinggi huruf besar) | 720p (tinggi huruf besar) | Layout |
|---|---|---|---|---|
| Normal | `uiScale` | 3x (21 px) | 2x (14 px) | Standar |
| Large | `uiScale + 1` | 4x (28 px) | 3x (21 px) | Varian Large |
| Largest | `uiScale + 2` | 5x (35 px) | 4x (28 px) | Varian Largest |

Wadah teks diukur dalam piksel layar dari skala font, bukan dari satuan UI, karena skala font tidak selalu kelipatan `uiScale`. Satu baris efek 40 karakter butuh 240 px font kali skala (sel 6 px x 40).

- **Varian Large:**
  - Toko: kolom kiri dan kanan menyempit menjadi ikon plus angka (panel Tag menampilkan ikon dan "3/4" tanpa nama; nama muncul di baris info bawah saat difokus). Kolom tengah melebar.
  - Level-up, hadiah, Arsip, Pilih Kept: kartu dan panel detail melebar ke seluruh area aman.
  - HUD: elemen membesar sesuai skala font, posisi sama.
- **Varian Largest:**
  - Toko: kolom tawaran memakai hampir seluruh lebar area aman. Flavor disembunyikan di kartu toko (tetap tampil di Arsip dan panel detail Jeda). Panel Tag pindah menjadi satu strip ikon plus angka di bar atas, sehingga Glint, harga, dan tag tetap terlihat di layar yang sama (P4-e). Inventaris dan Stats tampil di tempat kolom tawaran lewat tombol T (toggle di layar yang sama, bukan menu baru). Pratinjau tag kartu fokus tetap tampil di strip dan di baris info bawah.
  - Layar lain: satu kolom, panel detail di bawah daftar bila tidak muat di samping.
- QA menguji ketiga tingkat di 1280 x 720, 1366 x 768, dan 1920 x 1080. Wadah teks memakai `overflow: hidden` agar cek otomatis `scrollWidth <= clientWidth` di A-05 bermakna.
- **Implementasi M2:** Large dan Largest menyembunyikan kolom kiri toko (potret, baris, panel Tag) dan menampilkan strip tag ringkas (chip plus "1/2") di bar atas; label "Next: Pulse" disembunyikan. Largest juga menyembunyikan flavor kartu toko, dan kolom inventaris tidak tampil: tombol Stats (T) mengganti tawaran dengan inventaris, Memento, dan stat. Daftar stat Jeda dua kolom (tiga di Largest). Badan Pengaturan boleh scroll di Large dan Largest; fokus keyboard menjaga barisnya terlihat.

## 8. Interaksi keyboard dan mouse

### 8.1 Pemetaan default

| Konteks | Aksi | Keyboard | Mouse |
|---|---|---|---|
| Pulse | Gerak | WASD dan panah | (tidak ada) |
| Pulse | Rite | Space (binding kedua kosong) | Klik kanan [Asumsi] |
| Pulse | Jeda | Esc (cadangan: P) | (tidak ada) |
| Menu umum | Pindah fokus | Panah dan WASD | Hover |
| Menu umum | Pilih | Enter atau Space | Klik kiri |
| Menu umum | Kembali atau tutup | Esc atau Backspace | Tombol Back di layar |
| Menu umum | Pindah grup fokus | Tab dan Shift+Tab | (tidak ada) |
| Menu dengan tab | Ganti tab | Q dan E | Klik tab |
| Level-up, hadiah | Pilih kartu langsung | 1, 2, 3 | Klik kartu |
| Toko | Beli slot N | 1 sampai 5 | Klik tombol harga atau kartu |
| Toko | Gembok kartu yang difokus | L (atau Shift+angka slot) | Klik ikon gembok |
| Toko | Reroll | R | Klik Reroll |
| Toko | Ganti Inventaris/Stats | T | Klik Stats |
| Toko | Mulai Pulse | B | Klik Begin Pulse |
| Toko | Merge atau Sell item terfokus di inventaris (bila GD mengizinkan) | M / X | Klik tombol di slot |
| Slider, pilihan | Ubah nilai | Kiri dan kanan | Klik atau seret |

- WASD ikut menavigasi menu agar tangan tidak perlu pindah saat masuk toko. Tombol pintas toko dipilih agar tidak bertabrakan dengan WASD (R, L, T, B, M, X tidak dipakai untuk gerak).
- Space di level-up dan toko tidak memicu Rite. Space di menu adalah "pilih" dan tunduk pada kunci input (8.4).
- [Asumsi] Gamepad (opsional, M4): stik kiri atau D-pad navigasi, A pilih, B kembali, X gembok, Y reroll, Start jeda, bahu kiri dan kanan ganti tab.

### 8.2 Model fokus (navigasi keyboard penuh)
- Setiap layar dibagi menjadi **grup fokus** (misalnya toko: tawaran, inventaris, panel Tag, bar bawah). Panah bergerak secara spasial di dalam grup; di tepi grup, panah pindah ke grup tetangga sesuai arah. Tab dan Shift+Tab melompat antar grup.
- Aturan spasial (M4-02, BUG-010): kandidat harus berada penuh di luar tepi fokus ke arah itu; yang segaris (beam) menang atas yang menyamping; skor sisanya jarak utama plus 2 kali jarak silang. Membalik langkah yang keluar grup kembali ke elemen asal. Elemen tersembunyi tidak pernah menjadi tujuan.
- Fokus selalu terlihat: bingkai `kept-gold`. Tidak ada keadaan tanpa fokus di layar menu.
- Hover mouse memindahkan fokus. Mouse keluar dari elemen tidak menghapus fokus.
- Setiap layar mendefinisikan fokus awal (tercantum di bagian 5) dan mengingat fokus terakhir saat kembali dari sub-layar (misalnya Pengaturan ke Jeda).
- Elemen nonaktif tetap bisa difokus (agar pemain bisa membaca alasannya), tapi pilihannya menghasilkan umpan balik "denied".
- Implementasi memakai elemen `<button>` asli dan `tabindex` terkelola (roving tabindex per grup), sehingga pembaca layar mengikuti fokus yang sama.

### 8.3 Perilaku Esc per layar

| Layar | Esc |
|---|---|
| Judul | Tidak ada |
| Pilih Kept, Arsip, Pengaturan | Kembali ke layar sebelumnya |
| Pulse | Buka Jeda |
| Jeda | Resume |
| Level-up, hadiah | Buka Jeda (pilihan wajib, tidak bisa dilewati) |
| The Glazier | Buka Jeda |
| Dialog konfirmasi | Pilihan aman |
| Remap menunggu tombol | Batal |
| Akhir run | Tidak ada (harus memilih tombol) |

### 8.4 Pengaman input
- **Kunci input** saat layar pilihan muncul: 300 ms untuk level-up, hadiah, dan toko; 500 ms untuk akhir run. Fokus terlihat, tapi pilihan belum diterima.
- **Tombol tertahan dari Pulse tidak dihitung.** Tombol yang sudah ditekan sebelum layar muncul harus dilepas dan ditekan lagi.
- Begin Pulse tidak memakai dialog. Pengamannya: tombol pintas khusus (B), bukan Enter global, dan Enter hanya memulai bila fokus ada di tombol Begin Pulse.

### 8.5 Umpan balik suara UI
UI memancarkan id cue lewat `UiDeps.sound.play(cueId)` (app meneruskan ke `AudioSystem.playUi`; UI tidak meng-import `src/audio`). **Sumber kebenaran id cue adalah `docs/audio-list.md` bagian 9** (review CD 2.6). UI hanya memicu cue yang berasal dari interaksi menu; cue yang punya event sim (`ui.shop.buy` dari `ItemBought`, `ui.shop.reroll`, `ui.shop.merge`, `ui.shop.lock`, `ui.shop.sell`, `ui.card.reveal`, `ui.card.pick`, `ui.glazier.arrive`, `ui.reward.reveal`) dipetakan AU dari event, jadi UI tidak memutarnya agar tidak dobel.

| Cue | Dipicu UI saat |
|---|---|
| `ui.focus` | Fokus atau hover pindah (dibatasi maksimal satu per 40 ms) |
| `ui.confirm` | Tombol menu umum ditekan |
| `ui.back` | Kembali atau tutup |
| `ui.denied` | Aksi ditolak di UI (kunci input, tombol nonaktif) dan saat `CommandRejected` |
| `ui.pulse.begin` | Begin Pulse |
| `ui.pause.open`, `ui.pause.close` | Jeda dibuka, ditutup |
| `ui.slider.tick` | Slider berubah |
| `ui.toggle` | Pilihan atau saklar berubah |
| `ui.class.select` | Kelas dipilih (Tingkat B) |
| `ui.end.tally` | Hitungan Silt di akhir run (Tingkat B) |
| `ui.unlock` | Unlock di The Keeping (Tingkat B) |

## 9. Aksesibilitas

| Fitur | Perilaku |
|---|---|
| Ukuran teks | Normal, Large, Largest (bagian 7.3). Skala integer, layout varian per tingkat |
| Kurangi efek | Mematikan geser dan stagger panel, naik kartu, denyut timer, kilau kaca di panel, getar tombol, angka Silt yang menghitung naik. Perubahan status tetap terlihat seketika. Default On bila sistem meminta `prefers-reduced-motion`. Getar layar dan kilat juga dikurangi oleh sistem lain (LP, AD) |
| Angka damage | Toggle On/Off. Render layer membaca pengaturan ini |
| Mode warna (Color vision) | Off, Protanopia, Deuteranopia, Tritanopia (sesuai QA A-04). UI menukar token warna lewat CSS variable (`[data-cv]` di `ui.css`). M2: varian placeholder UI untuk penanda UI (rarity Fine biru muda dan Rare biru tua di protan dan deutan, merah bahaya UI menjadi magenta; Plain lebih gelap dan Fine oranye di tritan); nilai final milik AD, diuji QA. Selain itu, UI **tidak pernah memakai warna sebagai satu-satunya tanda**: rarity punya pip, tidak mampu beli punya ikon Glint bergaris, gembok punya ikon, HP rendah punya ikon retak dan denyut, tag punya bentuk ikon berbeda, fokus punya bingkai tebal |
| Panel solid | Panel opasitas 100% untuk keterbacaan di atas arena yang ramai |
| Jeda saat tidak fokus | Default On |
| Pembaca layar | Menu memakai tombol asli dengan label teks. Live region mengumumkan hasil aksi toko ("Bought Ember Ring. 12 Glint left.", "Not enough Glint."). HUD `aria-hidden` saat Pulse agar tidak membanjiri pembaca layar. Ini dukungan dasar, bukan target sertifikasi |
| Navigasi keyboard penuh | Bagian 8.2. Semua layar bisa diselesaikan tanpa mouse |
| Kontras teks | `bone` pada `night` 13.9:1, `dust` pada `night` minimal 4.5:1 (QA ukur). Tidak ada teks penting dengan `dust` opasitas 50%. M4-02: kasus terburuk dihitung UI di atas arena putih penuh: panel (night 90% di atas redup 50 sampai 60%) `dust` 5,5:1, `bone` 12:1, `kept-blue` 4,0:1 (karena itu tidak dipakai untuk teks); teks tanpa panel memakai pelat ink 90% (`dust` 5,1:1, `bone` 11:1, `kept-gold` 9:1). Judul besar tanpa pelat di atas redup 60%: `bone` 3,9:1, `kept-gold` 3,2:1 (ambang 3:1) |
| Padanan visual suara (A-09) | Naik level: baris Lv emas sesaat. Kena hit: bar HP putih sesaat (plus kilat tepi VFX). Pulse hampir habis: timer emas. Boss atau Warden datang: banner. Dapat Memento: layar hadiah. Telegraf bahaya: render (AD, GP) |

QA memiliki `docs/qa/accessibility.md`; spec ini adalah sisi implementasi UI.

## 10. Animasi ringan

| Elemen | Animasi | Durasi | Kurangi efek |
|---|---|---|---|
| Panel masuk | Fade plus geser 4 satuan | 120 ms | Fade 80 ms saja |
| Kartu level-up dan toko muncul | Stagger per kartu | 60 ms antar kartu, total maksimal 300 ms | Muncul bersamaan |
| Fokus kartu | Naik 2 satuan plus bingkai emas | 80 ms | Bingkai saja |
| Beli | Kartu memudar ke "Taken", ikon terbang singkat ke slot inventaris | 200 ms | Langsung |
| Reroll | Kartu berputar balik (flip via skala Y, bukan rotasi bebas sprite) | 150 ms | Langsung |
| Merge | Slot berkedip putih lalu ikon tier baru | 200 ms | Langsung |
| Ambang tag tercapai | Baris tag berkilau emas | 400 ms | Bingkai emas statis 400 ms |
| Rite siap | Denyut bingkai emas sekali | 250 ms | Bingkai emas tanpa denyut |
| HP chip | Bagian hilang putih lalu menyusut | 300 ms | Langsung |
| Timer 5 detik terakhir | Membesar 1 satuan tiap detik | 150 ms | Hanya warna emas |
| Angka Silt | Hitung naik | 800 ms | Langsung |

- Semua animasi memakai CSS transform dan opacity saja. Input selama animasi menyelesaikan animasi seketika.
- Ikon pixel tidak pernah diskalakan non-integer atau diputar. Efek naik dan geser memakai offset integer satuan UI.

## 11. Aturan teks dan string table

- **Semua teks dari `content/strings/en.json`.** UI memanggil `t(key, params)`. Tidak ada string tampil yang di-hardcode di kode UI.
- [Usulan ke WR dan LP] Format: objek JSON datar, kunci bertitik, nilai string Inggris. Parameter dengan kurung kurawal: `"ui.hud.pulse": "Pulse {n}"`. Bentuk jamak dengan akhiran `.one` dan `.other` bila perlu. Kolom Indonesia boleh disiapkan nanti di `id.json` dengan kunci yang sama (vision.md 7.4).
- **Angka balance tidak ditulis di teks.** Efek memakai parameter yang diisi dari data: `"item.ember_ring.effect": "Hits ignite foes for {burn} damage.\nBurning foes spread flame on death."`. Mengubah angka di data tidak perlu mengubah teks (agent-rules aturan 8). [Usulan ke GD dan WR]
- Pola kunci konten (final, mengikuti WR dan kolom data): nama dan efek dari kolom `name_key`, `desc_key`, `flavor_key` (`weapon.<id>.name|desc`, `memento.<id>.name|desc|flavor`, `rite.<id>.name|desc`, `class.<id>.name|desc`), nama musuh dari `name_key` (`unlit.<id>`), kartu Temper dari `desc_key` (`card.<stat>`, parameter `{value}`) dengan nama stat dari `display_key` (`stat.<id>`), sinergi dari `desc_key` (`syn.<tag>.<n>`), plus pola tetap `tag.<id>.name`, `tag.<id>.abbr`, `class.<id>.role`, `class.<id>.passive`. Kunci UI memakai awalan `ui.`.
- Baris efek dipisah dengan `\n` oleh Writer, bukan di-wrap otomatis, agar batas 2 baris bisa dicek.
- **Kunci hilang:** di build dev tampil `[[kunci]]` mencolok; di build rilis tampil kuncinya saja dan peringatan di console.
- **Tes otomatis (UI dengan QA, M1):** setiap kunci yang dipakai UI ada di `en.json`; setiap nama maksimal 3 kata dan 18 karakter; setiap efek maksimal 2 baris dan 40 karakter per baris setelah parameter diisi nilai terpanjang dari data; flavor maksimal 70 karakter; tidak ada em dash dan kata terlarang style guide 4.3 (P4-b).
- Daftar kunci UI ada di Lampiran A, diselaraskan dengan string table WR. Helper: `src/ui/strings.ts` (`createTranslator`, di atas `formatString` dari `src/content`).

## 12. Kontrak UI ke simulasi

Sumber kebenaran: `docs/tech/architecture.md` bagian 3, 6.2, 6.4, 6.5, 6.7 (milik LP, file kontrak di `src/core/contracts/`). Bagian ini hanya mencatat cara UI memakainya dan apa yang masih kurang.

### 12.1 Cara UI memakai kontrak LP
- UI membaca `WorldView` (hanya-baca, valid sampai `step()` berikutnya) dan `SimEventReader` setiap frame lewat `Ui.update(view, events)`. UI tidak menyimpan referensi elemen view antar frame.
- UI mengubah game hanya lewat `CommandSink.send(cmd)`. Command yang ditolak sim menghasilkan event `CommandRejected` (kode alasan), dan UI menampilkan umpan balik "denied" (getar, suara, live region).
- Gerak dan Rite lewat `InputFrame` dari app, bukan command UI.
- Layar menu, pilih kelas, jeda, pengaturan, Arsip adalah state app (`AppScreen`, `AppActions`). Layar level-up, hadiah, dan toko diturunkan dari `view.phase` (`levelUp`, `shop`) seperti ditetapkan LP. Banner akhir Pulse memakai fase `pulseClear`.
- DOM toko dan level-up hanya dibangun ulang bila `shop.revision` atau `levelUp.revision` berubah. HUD menulis ke DOM hanya bila nilai yang ditampilkan berubah.
- Teks memakai `UiDeps.strings` (`StringTable`); nama dan efek konten diambil dari `GameData` lewat id string.

| Aksi UI | Command atau aksi app (kontrak final) |
|---|---|
| New Run di Judul, Begin di Pilih Kept | `AppActions.startRun(classId, difficulty)` (app memilih seed dan profil, lalu `run.start`) |
| Continue di Judul (bila `MetaView.hasRunSave`) | `AppActions.continueRun()` |
| Pilih Memento hadiah Warden | `{ type: 'reward.pick', choice }` (index ke `RewardView.choices`) |
| Pilih kartu Temper (level-up) | `{ type: 'levelup.pick', choice }` |
| Beli tawaran | `{ type: 'shop.buy', offer }` |
| Reroll | `{ type: 'shop.reroll' }` |
| Gembok | `{ type: 'shop.lock', offer, locked }` |
| Jual senjata di slot | `{ type: 'shop.sell', inventorySlot }` |
| Fuse senjata di slot | `{ type: 'shop.merge', inventorySlot }` |
| Begin Pulse | `{ type: 'pulse.begin' }` |
| Abandon Run (setelah konfirmasi) | `{ type: 'run.abandon' }` |
| Jeda, lanjut, pengaturan, The Keeping, ke Judul | `AppActions.pause/resume/openSettings/openArchive/applySettings/quitToTitle` |

### 12.2 Kontrak final (architecture v2.1, dibekukan M1)
Semua permintaan K1 sampai K11 versi 1 sudah diputuskan LP (`docs/reviews/M0-lp.md` 3.1). Bentuk final yang dipakai UI:

| # | Kebutuhan | Bentuk final | Dipakai di |
|---|---|---|---|
| K1 | Hadiah Warden | Fase `reward`, `WorldView.reward` (`RewardView`: `revision`, `sourceTypeIndex`, `choices[{ mementoIndex, rarity }]`), command `reward.pick`, event `RewardShown`, `RewardChosen` | S04b |
| K2 | Pratinjau Fuse | Sim menghitung `ShopOfferView.mergeSlot`, `mergeToTier`, `blockedNoSlot`, dan `InventorySlotView.canMerge`. Command `shop.merge`. UI tidak menghitung aturan | Lencana Fuse, slot menyala, tombol Fuse |
| K3 | Pratinjau tag | `synergyTierFor(count, thresholds)` di `src/content/rules/` (murni, dari `GameData.synergies`) plus `ShopOfferView.isNewId` (aturan id berbeda GDD 8.1). Jumlah tag dari `ShopView.tagCounts` | Panel Tag, pip "+1", "Unlocks:" |
| K4 | Penyebab kematian | `PlayerDied.c` (SourceRef) dan `WorldView.runStats.killedBy`, didekode dengan `sourceKindOf` / `sourceIndexOf` | "Felled by" di S08 |
| K5 | Bar HP boss dan Warden | `PulseView.boss` dan `PulseView.warden` (`BigFoeView`: `active`, `typeIndex`, `hp`, `maxHp`, `shield`, `phase`, `enraged`), `ticksTotal = 0` untuk Pulse boss, `overtime`, `wardenAlive` | Slot timer HUD |
| K6 | The Keeping dan kredit | `AppScreen` `archive` dan `credits`, `AppActions.unlock`, `openArchive`, `deleteSaveData`, `UiDeps.meta` (`MetaView`) | S01, S09 |
| K7 | Pengaturan | `Settings` bertingkat final (`graphics`, `audio` dengan bus `ui`, `mono`, `reduceRepeats`, `muteWhenUnfocused`, `access`, `keybinds` dua binding per `ActionId`) | S07 |
| K8 | Kesulitan | `difficulty` di `run.start` dan `AppActions.startRun` (Crack) | S02 |
| K9 | Angka damage | Render dari `EnemyDamaged` lewat `Renderer.applySettings`; bukan DOM | (tidak ada di UI) |
| K10 | Proyeksi | `Projector` (plus `cssToWorld` untuk bidik mouse); HUD minimal tidak memakainya | (masa depan) |
| K11 | Suara UI | `UiDeps.sound.play(cueId)` diteruskan app ke `AudioSystem.playUi`. Id dari audio-list (8.5) | 8.5 |
| (baru) | Art ikon dan potret | `UiDeps.art` (`RenderAssets`), dirasterisasi `src/core/sprite` (12.4) | Kartu, slot, HUD Rite, Glint, potret Glazier |

Perubahan kontrak berikutnya hanya lewat LP (architecture 19). Usulan UI yang tersisa dicatat di laporan tugas, bukan di sini.

### 12.4 Ikon dan potret (M2)
UI tidak boleh mengimpor `src/render` (lint architecture 5), jadi ikon datang dari `UiDeps.art.sprites` yang dimuat app dari `art/sprites/*.json|ts`. `src/ui/icons.ts` mencari id berurutan: `icon-<jenis>-<id kebab>` (jenis `weapon`, `memento`, `stat`, `rite`, `tag`; kartu Temper memakai `icon-card-<stat>` atau `icon-stat-<stat>`), lalu `icon-<id>`, lalu sprite kelas `icon` apa pun yang berakhiran `-<id>`. Potret: `portrait-<nama>`, `icon-portrait-<nama>`, atau kelas `portrait` yang memuat nama. Glint: `icon-glint`. Raster di-cache per id; skala integer terbesar yang muat di kotak (satuan UI). Sprite yang rusak atau belum ada jatuh ke monogram, jadi layar tidak menunggu art.

### 12.3 Presenter murni
Logika tampilan (format waktu "0:24", "lama > baru" untuk stat, status mampu beli, isi baris info toko) ditulis sebagai fungsi murni di `src/ui/presenters/` yang menerima `WorldView` dan `GameData`, sehingga bisa diuji Vitest dengan `WorldView` palsu (`tests/fixtures/`) tanpa DOM.

Isi `src/ui/` (M1-04, implementasi):

```
src/ui/
  index.ts           public API: createUi (dev builds show [[key]] for missing strings)
  ui-root.ts         layers, UI scale, screen router, keyboard and mouse routing, live region
  ui.css             palette tokens and all screen styles (sizes in --u and --f)
  scale.ts           uiScale from physical pixels, font scale with text size
  strings.ts         createTranslator over formatString, missing-key fallback
  format.ts          clock, seconds, integers, stat values, key labels
  focus-nav.ts       pure spatial navigation and group cycling
  focus.ts           DOM focus list: roving tabindex, hover focus, click activate, input lock
  menu-keys.ts       key to menu intent (Enter and Esc as fixed safe path)
  cues.ts            UI cue ids from audio-list
  dom.ts             tiny element builders
  presenters/        pure view models: phase, hud, shop, choices, run-end, settings, content
  screens/           title, class-select, hud, choice (Temper and reward), glazier, pause (with
                     confirm), settings, run-end, info (The Keeping and Credits placeholders)
  dev/preview.html   dev-server-only harness on the fake world (never bundled)
```

Tes presenter dan navigasi ada di `tests/unit/ui/` (lokasi standar coding-standards 6.1; `vite.config.ts` hanya menjalankan `tests/unit/**`).

**Pratinjau dengan data palsu:** jalankan `npm run dev`, buka `http://localhost:5173/src/ui/dev/preview.html`. Parameter `?screen=` menerima `title`, `class`, `pulse`, `held`, `boss`, `pending`, `warden`, `reward`, `levelup`, `queue`, `glazier`, `pause`, `settings`, `lost`, `won`; tambahan `&text=0|1|2`, `&cv=protan|deutan|tritan`, `&reduce=1`, `&savelost=1`. Harness memakai `tests/fixtures/fake-world.ts`, sim palsu kecil untuk command toko dan pilihan, data, string, dan art asli bila build-nya valid (cadangan: fixture tes).

## 13. Rencana verifikasi (untuk M1 dan seterusnya)

| Uji | Cara | Milestone |
|---|---|---|
| Teks dan kunci (P4-b) | Vitest atas `en.json` dan daftar kunci yang dipakai UI | M1 |
| Langkah beli (P4-c) | Playwright: beli satu item dengan 1 tombol angka, dengan fokus plus Enter, dan dengan 1 klik | M1 |
| Satu run hanya keyboard | Playwright: Judul sampai Begin Pulse kedua tanpa mouse | M1 |
| Kunci input | Playwright: tekan 1 sebelum 300 ms di level-up, pastikan tidak ada pilihan | M1 |
| HUD minimal | Screenshot: hanya 5 elemen HUD, tengah layar kosong | M1 |
| Screenshot layout (A-05) | Playwright di 1280 x 720, 1366 x 768, dan 1920 x 1080, tiga tingkat ukuran teks, semua layar; tidak ada teks terpotong, bertumpuk, atau scroll | M2 |
| Uji kartu 3 detik (P4-a) | CD bersama penguji | M2 |
| Mode warna | Screenshot tiap mode, cek tanda non-warna | M4 |

---

## Lampiran A. Kunci string UI (kontrak dengan WR)

Sumber teks final: `content/strings/en.json` (milik WR). Tabel ini mencatat kunci `ui.*` yang dipakai kode `src/ui/` dan status tiap kunci di string table per 2026-11-17 (M2-06: semua kunci ada di `en.json`; kunci yang belum dipakai UI disimpan untuk Tingkat B dan C). Kunci non-UI yang dibaca UI: `glazier.<pemicu>` (dan varian `.1` sampai `.9`), `unlit.<id>.epithet`. Kolom teks berisi teks WR bila sudah ada, atau draf usulan UI bila kunci baru (WR memutuskan teks final dalam batas style guide 2.4 dan 4.3). Tes `tests/unit/ui/strings.test.ts` gagal bila kode memakai kunci `ui.*` yang tidak tercantum di sini. Kunci yang belum ada di string table tampil sebagai nama kunci (rilis) atau `[[kunci]]` (dev) sampai WR menambahkannya.

Kunci konten tidak tercantum di sini; UI memakai kolom data (`name_key`, `desc_key`, `flavor_key`, `display_key`) dan pola WR `tag.<id>.name`, `tag.<id>.abbr`, `class.<id>.role`, `class.<id>.passive`. Id cue suara (`ui.focus` dan lainnya) bukan kunci string; daftarnya di bagian 8.5 dan `src/ui/cues.ts`.

| Kunci | Teks (WR atau draf UI) | Status |
|---|---|---|
| `ui.action.back` | Back | Ada |
| `ui.action.begin_pulse` | Begin Pulse | Ada |
| `ui.action.confirm` | Confirm | Ada |
| `ui.action.fuse` | Fuse | Ada |
| `ui.action.lock` | Lock | Ada |
| `ui.action.move_down` | Move Down | Ada |
| `ui.action.move_left` | Move Left | Ada |
| `ui.action.move_right` | Move Right | Ada |
| `ui.action.move_up` | Move Up | Ada |
| `ui.action.pause` | Pause | Ada |
| `ui.action.reroll` | Reroll | Ada |
| `ui.action.rite` | Rite | Ada |
| `ui.action.sell` | Sell | Ada |
| `ui.action.stats` | Stats | Ada |
| `ui.banner.pulse_held` | Pulse {n} Held | Ada |
| `ui.class.begin` | Begin | Ada |
| `ui.class.cooldown` | {s}s cooldown | Ada |
| `ui.class.difficulty` | Crack {n} | Ada (belum dipakai M1) |
| `ui.class.locked` | Unlock in The Keeping | Ada (belum dipakai M1) |
| `ui.class.passive` | Passive | Ada |
| `ui.class.rite` | Rite | Ada |
| `ui.class.title` | Choose Your Kept | Ada |
| `ui.class.weapon` | Weapon | Ada |
| `ui.common.back` | Back | Ada |
| `ui.common.denied` | Not possible now | Ada |
| `ui.common.glint` | {n} Glint | Ada (belum dipakai M1) |
| `ui.common.press_again` | Press again | Ada |
| `ui.common.silt` | {n} Silt | Ada (belum dipakai M1) |
| `ui.common.small_window` | Enlarge the window to play | Ada |
| `ui.confirm.abandon` | Abandon this run? | Ada |
| `ui.confirm.abandon_yes` | Abandon | Ada |
| `ui.confirm.reset_controls` | Reset all controls? | Ada |
| `ui.confirm.reset_yes` | Reset | Ada |
| `ui.confirm.stay` | Stay | Ada |
| `ui.credits.assets` | All art, music, and sound were made by the team in code: procedural pixel art, low-poly scenes, and synthesized audio. No outside assets. | Ada (M5-03) |
| `ui.credits.body` | Shardfall was made by a team of AI agents. | Ada (M5-03, teks final) |
| `ui.credits.licenses` | Notices for third-party software are in third-party-licenses.txt. | Ada (M5-03) |
| `ui.credits.title` | Credits | Ada |
| `ui.end.again` | Try Again | Ada |
| `ui.end.build` | Final build | Ada (M4-02, label pembaca layar daftar build) |
| `ui.end.choose` | Choose Kept | Ada |
| `ui.end.felled_by` | Felled by {name} | Ada |
| `ui.end.glint` | Glint Gathered | Ada |
| `ui.end.keeping` | The Keeping | Ada (belum dipakai M1) |
| `ui.end.lost` | Kept Lost | Ada |
| `ui.end.lost_sub` | Another wakes beneath the glass. | Ada |
| `ui.end.more_above` | More above | Ada (M4-02) |
| `ui.end.more_below` | More below | Ada (M4-02) |
| `ui.end.new_unlock` | New unlock available | Ada (belum dipakai M1) |
| `ui.end.next_vitrine` | Next Vitrine | Ada (belum dipakai M1) |
| `ui.end.pulse_reached` | Pulse {n} of {total} | Ada |
| `ui.end.silt` | Silt Earned | Ada |
| `ui.end.silt_held` | Silt Held | Ada (M4-02, CD M3 10) |
| `ui.end.steady` | Vitrine Steady | Ada (belum dipakai M1) |
| `ui.end.steady_sub` | The last crack seals. The light stops pulsing and simply shines. | Ada (belum dipakai M1) |
| `ui.end.time` | Time | Ada |
| `ui.end.title` | Title | Ada |
| `ui.end.unlit` | Unlit Dissolved | Ada |
| `ui.end.won` | Light Kept | Ada |
| `ui.end.won_sub` | The last crack seals. The light stops pulsing and simply shines. | Ada |
| `ui.error.webgl2` | This game needs WebGL2. Please open it in a current browser. | Ada (belum dipakai M1) |
| `ui.hud.held` | Held | Ada |
| `ui.hud.hint_move` | {keys} Move | Ada |
| `ui.hud.hint_rite` | {key} Rite | Ada |
| `ui.hud.hp` | {hp}/{max} | Ada |
| `ui.hud.level` | Lv {n} | Ada |
| `ui.hud.pulse` | Pulse {n} | Ada |
| `ui.keeping.found` | {n}/{total} found | Ada (tab Mementos M3) |
| `ui.keeping.tab_kept` | Kept | Ada (tab M3) |
| `ui.keeping.tab_mementos` | Mementos | Ada (tab M3) |
| `ui.keeping.title` | The Keeping | Ada |
| `ui.keeping.unknown` | Not yet found | Ada |
| `ui.keeping.unknown_name` | ??? | Baru M3 (nama Memento yang belum ditemukan, ID sama) |
| `ui.keeping.unlock` | Unlock | Ada (belum dipakai M1) |
| `ui.keeping.owned` | Owned | Ada (LP M2-09, The Keeping minimal) |
| `ui.keeping.kind_class` | Kept | Ada (LP M2-09) |
| `ui.keeping.kind_weapon` | Weapon | Ada (LP M2-09) |
| `ui.keeping.kind_pack` | Mementos | Ada (LP M2-09) |
| `ui.keeping.no_silt` | Not enough Silt | Ada (LP M2-09) |
| `ui.keeping.unlocked` | {name} unlocked. | Ada (LP M2-09) |
| `ui.keeping.empty` | Nothing to unlock yet. | Ada (LP M2-09) |
| `ui.levelup.level` | Lv {n} | Ada |
| `ui.levelup.queue` | {i} of {total} | Ada |
| `ui.levelup.stat_change` | {stat} {old} > {new} | Ada |
| `ui.levelup.title` | Temper | Ada |
| `ui.pause.abandon` | Abandon Run | Ada |
| `ui.pause.resume` | Resume | Ada |
| `ui.pause.settings` | Settings | Ada |
| `ui.pause.title` | Paused | Ada |
| `ui.reward.subtitle` | Spilled from {name} | Ada |
| `ui.reward.title` | Take a Memento | Ada |
| `ui.settings.color_vision` | Color Vision | Ada |
| `ui.settings.cv_deutan` | Deuteranopia | Ada |
| `ui.settings.cv_off` | Off | Ada |
| `ui.settings.cv_protan` | Protanopia | Ada |
| `ui.settings.cv_tritan` | Tritanopia | Ada |
| `ui.settings.damage_numbers` | Damage Numbers | Ada |
| `ui.settings.extended` | Extended | Ada |
| `ui.settings.flavor` | Flavor Text | Ada |
| `ui.settings.fullscreen` | Fullscreen | Ada |
| `ui.settings.master` | Master | Ada |
| `ui.settings.mono` | Mono Audio | Ada |
| `ui.settings.music` | Music | Ada |
| `ui.settings.mute_unfocused` | Mute When Away | Ada |
| `ui.settings.off` | Off | Ada |
| `ui.settings.on` | On | Ada |
| `ui.settings.pause_unfocused` | Pause When Away | Ada |
| `ui.settings.press_key` | Press a key | Ada |
| `ui.settings.quality` | Quality | Ada |
| `ui.settings.quality_high` | High | Ada |
| `ui.settings.quality_low` | Low | Ada |
| `ui.settings.quality_medium` | Medium | Ada |
| `ui.settings.reduce_effects` | Reduce Effects | Ada |
| `ui.settings.reduce_repeats` | Reduce Repeats | Ada |
| `ui.settings.remap_gameplay` | Gameplay | Ada |
| `ui.settings.remap_menu` | Menus | Ada |
| `ui.settings.reset_controls` | Reset Controls | Ada |
| `ui.settings.sfx` | Sound Effects | Ada |
| `ui.settings.shake` | Screen Shake | Ada |
| `ui.settings.shop_timer` | Glazier Timer | Ada |
| `ui.settings.solid_panels` | Solid Panels | Ada |
| `ui.settings.swapped` | Swapped with {action}. | Ada |
| `ui.settings.tab_access` | Accessibility | Ada |
| `ui.settings.tab_audio` | Audio | Ada |
| `ui.settings.tab_controls` | Controls | Ada |
| `ui.settings.tab_graphics` | Graphics | Ada |
| `ui.settings.text_large` | Large | Ada |
| `ui.settings.text_largest` | Largest | Ada |
| `ui.settings.text_normal` | Normal | Ada |
| `ui.settings.text_size` | Text Size | Ada |
| `ui.settings.title` | Settings | Ada |
| `ui.settings.ui_volume` | Interface | Ada |
| `ui.shop.begin` | Begin Pulse | Ada |
| `ui.shop.bought` | Bought {name}. {n} Glint left. | Ada |
| `ui.shop.lock` | Lock | Ada |
| `ui.shop.mementos` | Mementos | Ada |
| `ui.shop.merge` | Fuse | Ada |
| `ui.shop.merge_tier` | Fuse > {tier} | Ada |
| `ui.shop.next` | Next: Pulse {n} | Ada |
| `ui.shop.no_glint` | Not enough Glint | Ada |
| `ui.shop.reroll` | Reroll | Ada |
| `ui.shop.reroll_free` | Free | Ada |
| `ui.shop.sell` | Sell | Ada |
| `ui.shop.sell_for` | Sell for {n} Glint | Ada |
| `ui.shop.slots_full` | No free slot | Ada |
| `ui.shop.stats` | Stats | Ada |
| `ui.shop.tag_new` | New | Ada |
| `ui.shop.tag_unlocks` | Unlocks: {effect} | Ada |
| `ui.shop.tags` | Tags | Ada |
| `ui.shop.taken` | Taken | Ada |
| `ui.shop.title` | The Glazier | Ada |
| `ui.shop.unlock` | Unlock | Ada |
| `ui.shop.weapons` | Arms | Ada |
| `ui.tier.1` | I | Ada |
| `ui.tier.2` | II | Ada |
| `ui.tier.3` | III | Ada |
| `ui.tier.4` | IV | Ada |
| `ui.title.begin` | Begin | Ada |
| `ui.title.continue` | Continue | Ada |
| `ui.title.controls` | {move} Move · {rite} Rite · {pause} Pause | Ada (M4-02) |
| `ui.title.credit_line` | v1.0 · made by an AI team · assets procedural | Ada (M4-02) |
| `ui.title.credits` | Credits | Ada |
| `ui.title.keeping` | The Keeping | Ada |
| `ui.title.name` | Shardfall | Ada |
| `ui.title.save_lost` | The last run could not be restored. | Ada |
| `ui.title.settings` | Settings | Ada |
| `ui.title.tagline` | The sky broke. The pieces kept us. Now we keep the light. | Ada |
| `ui.title.version` | Build {version} | Ada |
