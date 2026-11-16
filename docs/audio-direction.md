# Shardfall: Arah Audio

Pemilik: Audio Director (AU). Status: versi 1.2 (2026-11-17), perbaikan review M0 (`docs/reviews/M0-cd.md`, `M0-lp.md`), engine M1-06 (bagian 13), musik bioma 1 dan SFX final slice M2-04 (bagian 14). Reviewer: CD (rasa), LP (teknis dan ukuran).
Dasar: `docs/vision.md`, `docs/pillars.md`, `docs/style-guide.md` bagian 3, keputusan Producer di `docs/tasks.md`.
Pasangan dokumen: `docs/audio-list.md` (daftar semua cue dengan id, pemicu, prioritas, durasi, polifoni).

Penanda: **[Wajib]** keputusan AU yang mengikat implementasi. **[Saran]** boleh diubah pemilik wilayah lain (LP untuk engine) dengan alasan tertulis. **[Asumsi]** perlu dikalibrasi atau dikonfirmasi peran lain.

---

## 0. Ringkasan keputusan

1. **Semua audio disintesis di runtime dengan Web Audio API.** Build 1.0 tidak mengirim file audio sama sekali. Musik dan SFX didefinisikan sebagai data JSON plus resep sintesis di kode. Unduhan audio sekitar 0 KB, kode dan data audio di bawah 40 KB.
2. **SFX dirender sekali ke AudioBuffer saat boot** dari fungsi DSP murni (Float32Array, sesuai `docs/tech/architecture.md` bagian 11) di Web Worker (M2), lalu diputar sebagai buffer murah. Musik dan stinger dimainkan oleh sequencer dengan penjadwalan lookahead.
3. **Pusat nada seluruh musik bioma 1 adalah D.** Pulse: D dorian 116 BPM. Toko: F lydian 76 BPM (berbagi nada D, E, G, A, B). Boss: D phrygian 132 BPM. Karena semua berpusat di D, SFX bernada (hadiah, Glint) selalu cocok dengan musik.
4. **Musik adaptif 4 lapis intensitas** (L0 sampai L3) yang naik seiring progres Pulse dan nomor Pulse, ditambah riser 6 detik terakhir (selaras lonjakan spawn di `docs/gdd.md` 3.2), stinger akhir Pulse, dan overlay Unlit saat Warden hidup.
5. **Tiga bus utama: music, sfx, ui**, plus dua bus reverb kirim (hall, room). Prioritas SFX 1 sampai 6 mengikuti style guide 3.2, voice stealing, dan ducking saat pemain kena hit.
6. **Bahasa nada yang memisahkan kubu:** suara pemain dan hadiah memakai nada konsonan D, E, G, A, B dan pita rendah-tengah atau tinggi lembut. Suara bahaya memakai tritone (G#) atau noise di pita 1 sampai 3 kHz dengan bentuk naik. Ini padanan audio dari kode warna biru lawan merah.

---

## 1. Nada dan prinsip

Nada dari style guide: **"kaca dan gelap"**. Kecil, jernih, sedikit dingin, dengan inti hangat. Orkestra kecil yang disintesis plus sentuhan chiptune.

Prinsip [Wajib]:
1. **Keterbacaan dulu (Pilar 2).** Bila suara indah menutupi telegraf bahaya atau suara pemain kena hit, suara indah itu yang dikurangi.
2. **Diorama di bawah kaca.** Reverb pendek yang terang (seperti ruang kaca kecil) untuk SFX. Reverb hall yang lebih panjang hanya untuk musik dan stinger. Tidak ada reverb pada suara berulang.
3. **Cahaya adalah jam.** Musik mengikuti denyut Pulse: dibuka lonceng kaca rendah, makin padat menjelang akhir, ditutup akor kaca naik. Ritme gameplay, cahaya, dan musik adalah satu hal.
4. **Berulang ribuan kali tanpa melelahkan.** Suara serangan otomatis, Unlit mati, dan pungut Glint pendek, pelan, divariasikan, dan dibatasi jumlahnya.
5. **Orisinal.** Semua melodi, progresi, dan pola ditulis tim di dokumen ini. Dilarang memakai, me-remix, atau meniru melodi berhak cipta. Referensi gaya hanya berupa rasa (orkestra kecil plus chiptune), bukan lagu tertentu.

---

## 2. Teknologi, format, dan anggaran

### 2.1 Keputusan format [Wajib]
- **Tidak ada file audio di build 1.0.** Sumber kebenaran audio mengikuti struktur folder di `docs/tech/architecture.md`:
  - Data musik: `src/audio/music/<cue-id>.json` (satu file per lagu, format di bagian 7), diimpor Vite.
  - Data SFX: `src/audio/cues/cues.json` (satu file, format di `docs/audio-list.md` bagian 2).
  - DSP murni (osilator, FM, Karplus-Strong, noise, filter, envelope, IR): `src/audio/synth/`. Tanpa API Web Audio, agar bisa dijalankan di Node.
  - Engine (context, bus, voice limit, scheduler) dan `src/audio/event-map.ts`: `src/audio/`.
  - Data pemetaan event ke cue: `src/audio/cues/routes.json` (dibaca `src/audio/event-map.ts`).
  - Skrip alat: `tools/audio/render-cues.ts` (ekspor WAV untuk review CD) dan `tools/audio/validate.ts` (validator `cues.json`, `routes.json`, instrumen, dan lagu; uji A-5). Keduanya jalan langsung dengan `node`.
- Ekspor WAV hanya ke `audio/preview/` (di-gitignore, tidak di-commit, tidak dikirim di build): `audio/preview/sfx/<cue-id>.wav` dan `audio/preview/music/<lagu>.L<level>.wav`.

### 2.2 Anggaran [Wajib, angka final dicek LP di M1]

| Hal | Anggaran |
|---|---|
| File audio di build | 0 KB |
| Kode audio (engine, instrumen, resep SFX), min+gzip | di bawah 25 KB |
| Data JSON musik dan SFX, gzip | di bawah 15 KB |
| Memori buffer pra-render (SFX, Karplus-Strong, IR reverb, noise) | di bawah 8 MB |
| Waktu render SFX saat boot | di bawah 300 ms, async setelah input pertama |
| Voice musik bersamaan | maksimal 20 not |
| Instans SFX bersamaan (global) | maksimal 24, ditambah 6 untuk bus ui |
| Beban thread audio di laptop kelas menengah | target di bawah 15% satu core [Asumsi, diukur LP] |
| CPU audio di thread utama saat Pulse | di bawah 1 ms per frame (architecture.md bagian 11) |

### 2.3 Arsitektur runtime [Saran untuk LP]
- **AudioContext dibuka (resume) pada input pengguna pertama** (klik atau tombol di layar judul). Sebelum itu tidak ada suara, dan tidak ada error.
- **SFX:** setiap resep SFX adalah fungsi DSP murni yang menghasilkan Float32Array pada sample rate perangkat, diisi ke AudioBuffer saat boot (bertahap agar layar judul tidak beku). Saat dipicu, engine membuat AudioBufferSourceNode, mengatur playbackRate untuk variasi pitch, lalu menyambung ke gain, panner, dan bus. Ini jauh lebih murah daripada membangun graf osilator per hit, dan resep yang sama bisa diekspor ke WAV di Node.
- SFX yang panjangnya bergantung pada data sim (telegraf, sumbu peledak), `mode: live`, dirender dari DSP murni saat dipicu dengan durasi dari payload, lalu di-cache per durasi yang dibulatkan ke 50 ms. Render 1 detik audio cukup murah, dan cache membuat render ulang jarang.
- Filter dan envelope di DSP murni memakai implementasi biquad dan ramp sendiri (rumus standar RBJ), bukan BiquadFilterNode. Node Web Audio hanya dipakai untuk pemutaran, gain bus, panner, ducking, kompresor master, dan konvolusi reverb.
- **Musik:** sequencer membaca data lagu, menjadwalkan not memakai `AudioContext.currentTime` dengan lookahead 100 ms dan timer sekitar 25 ms. Tidak pernah memakai `setTimeout` untuk ketepatan waktu not.
- **Loop tanpa celah** otomatis karena sequencer menjadwalkan per step pada jam audio. Ekor reverb dan release dibiarkan menyeberang batas loop.
- Tab tersembunyi: `AudioContext.suspend()` saat `visibilitychange` hidden (opsi default menyala), `resume()` saat kembali. Game juga dijeda oleh sistem lain.

### 2.4 Jebakan Web Audio yang harus dihindari [Wajib]
- **Karplus-Strong tidak bisa dibuat dengan DelayNode umpan balik** untuk nada di atas sekitar 345 Hz, karena delay di dalam siklus minimal satu render quantum (128 frame). Solusi: hitung gelombang petik di JavaScript (Float32Array) saat boot, simpan sebagai buffer per nada dasar, geser pitch dengan playbackRate maksimal plus minus 6 semitone.
- `exponentialRampToValueAtTime` tidak boleh menuju 0. Pakai 0.0001 atau `setTargetAtTime`.
- Setiap perubahan gain dijadwalkan dengan ramp minimal 5 ms untuk mencegah klik.
- Jangan membuat node baru per frame untuk suara kontinu. Node dibuat per not atau per instans, lalu dilepas setelah selesai (`onended`).
- Gelombang pulse dengan duty 12.5% dan 25% dibuat dengan `PeriodicWave` (koefisien Fourier), bukan dua osilator yang dikurangkan.

---

## 3. Palet suara: blok pembangun

Semua suara dibangun dari blok berikut. Tidak ada sampel rekaman.

Keputusan AU tentang implementasi [Wajib]: **SFX** memakai padanan DSP murni dari tiap blok (fungsi di `src/audio/synth/`). **Instrumen musik** dimainkan sebagai node Web Audio langsung sesuai kolom implementasi di bawah, kecuali `pluck` (buffer Karplus-Strong dari DSP murni) dan IR reverb (dari DSP murni). Alasan: not musik butuh envelope dan filter yang bereaksi per not dan per tempo, sedangkan SFX butuh biaya putar minimal. **Diubah di M1:** instrumen musik kini juga dari DSP murni lewat sampler (lihat 13.2 butir 2).

| Blok | Implementasi Web Audio | Dipakai untuk |
|---|---|---|
| Osilator dasar | OscillatorNode: sine, triangle, sawtooth, square | Bass, pad, brass, lead |
| Pulse chiptune | OscillatorNode dengan PeriodicWave duty 12.5%, 25%, 50% | Lead dan arpeggio chiptune |
| Supersaw kecil | 3 sawtooth dengan detune minus 7, 0, plus 7 cent | Pad senar |
| FM | Sine modulator ke `frequency` sine carrier lewat GainNode (indeks) | Lonceng kaca, logam, Glint |
| Noise | Buffer white noise dan pink noise 2 detik, dibuat sekali, diputar loop dari offset acak | Perkusi, desis, angin, retak kaca |
| Filter | BiquadFilterNode lowpass, highpass, bandpass, peaking dengan envelope pada `frequency` | Bentuk timbre, sweep riser |
| Envelope | AudioParam `setValueAtTime`, `linearRampToValueAtTime`, `setTargetAtTime` (ADSR) | Semua not |
| LFO | OscillatorNode lambat ke AudioParam lewat GainNode | Vibrato, tremolo, gerak filter pad |
| Chorus | 2 DelayNode 8 sampai 15 ms dengan LFO 0.3 Hz pada delayTime | Pad senar, choir |
| Petik Karplus-Strong | Dihitung di JS saat boot, disimpan sebagai buffer | Harpa atau kecapi kecil |
| Formant | Saw lewat 2 sampai 3 bandpass paralel (vokal "ah" atau "mm") | Choir, dengung topeng the Glazier |
| Waveshaper | WaveShaperNode kurva tanh ringan | Kehangatan brass, distorsi tipis Unlit |
| Reverb konvolusi | ConvolverNode dengan IR sintetis (bagian 3.1) | Bus hall dan room |
| Panning | StereoPannerNode | Posisi horizontal di layar |

### 3.1 Impulse response sintetis [Wajib]
IR dibuat dengan DSP murni saat boot, stereo, kanal kiri dan kanan memakai seed `Rng` audio berbeda agar lebar.

Algoritma per kanal:
1. Panjang `n = sampleRate * length`. Isi `ir[i] = (rand * 2 - 1) * 10^(-3 * t / RT60)` dengan `t = i / sampleRate` (meluruh ke minus 60 dB pada RT60).
2. Gelapkan ekor: lewatkan lowpass satu kutub yang koefisiennya makin kecil seiring waktu (frekuensi potong turun dari sekitar 12 kHz ke 2.5 kHz di akhir).
3. Pre-delay: nol di awal sepanjang `preDelay`.
4. Pantulan awal "kaca": beberapa impuls tajam dengan sedikit penekanan frekuensi tinggi pada waktu tertentu.
5. Normalisasi energi agar level kirim konsisten antar IR.

| IR | RT60 | Pre-delay | Pantulan awal | Bus |
|---|---|---|---|---|
| `ir.hall` "kubah kaca" | 2.4 s | 20 ms | 23, 37, 51 ms | Musik dan stinger |
| `ir.room` "lemari pajangan" | 0.6 s | 8 ms | 11, 17 ms | SFX penting (prioritas 1 sampai 4) dan ui |

---

## 4. Katalog instrumen

Versi sintesis dari "orkestra plus synth atau chiptune". Parameter adalah titik awal; AU menyetel di M1 dan M2. Nama instrumen adalah id stabil yang dipakai data musik.

| Id instrumen | Peran orkestra | Resep sintesis | Envelope (A, D, S, R) | Catatan |
|---|---|---|---|---|
| `glass_bell` | Lonceng kaca, celesta. **Suara tanda tangan** | FM: carrier sine, modulator rasio 3.5 (tak harmonis, berkilau kaca), indeks 2.0 meluruh ke 0.3 dalam 0.8 s. Ditambah sine kedua rasio 2.76 pada minus 12 dB | 2 ms, 1.8 s eksponensial, 0, 0.6 s | Kirim hall tinggi (0.5). Highpass 200 Hz |
| `string_pad` | Senar sustain | Supersaw kecil (3 saw, detune plus minus 7 cent) ke lowpass 1.4 kHz Q 0.7, LFO 0.15 Hz pada cutoff plus minus 300 Hz, chorus | 0.4 s, 0, 1.0, 0.8 s | Tulang punggung harmoni. Highpass 120 Hz agar tidak menumpuk dengan bass |
| `brass` | Brass pendek (stab) | 2 square detune plus minus 4 cent ke lowpass dengan envelope filter: 400 Hz naik ke 2.4 kHz dalam 60 ms lalu turun ke 1.4 kHz. Pitch scoop minus 30 cent ke 0 dalam 40 ms. Waveshaper tanh ringan | 30 ms, 0.25 s, 0.6, 0.15 s | Untuk stab akor dan lead L3 |
| `brass_low` | Trombon atau tuba gelap | Seperti `brass` satu oktaf lebih rendah, lowpass maksimum 900 Hz | 60 ms, 0.4 s, 0.7, 0.3 s | Motif Unlit, intro boss |
| `pluck` | Harpa, kecapi | Karplus-Strong pra-render: burst noise 10 ms lewat rata-rata dua sampel, redaman 0.996. Buffer per nada C dan F# tiap oktaf, digeser pitch | bawaan buffer, R 0.2 s | Musik toko, judul |
| `chip_lead` | Melodi chiptune | Pulse duty 25% ke lowpass 5 kHz. Vibrato 5 Hz plus minus 10 cent mulai setelah 150 ms | 5 ms, 0.1 s, 0.6, 80 ms | Dobel melodi di L3 bila brass terlalu berat |
| `chip_arp` | Arpeggio chiptune | Pulse duty 12.5% ke lowpass 3.5 kHz | 2 ms, 60 ms, 0.3, 40 ms | L2, not pendek 16-an |
| `sub_bass` | Kontrabas, timpani rendah sustain | Sine plus triangle satu oktaf di atas pada minus 12 dB, lowpass 300 Hz | 8 ms, 0.2 s, 0.8, 0.1 s | Mono, pan 0 |
| `choir` | Paduan suara "ah" | Supersaw ke 3 bandpass paralel 700 Hz, 1150 Hz, 2600 Hz (formant "ah"), chorus | 0.5 s, 0, 1.0, 1.0 s | Boss fase 2, stinger boss |
| `unlit_drone` | Drone gelap | 2 saw pada D1 dan G#1 (tritone) ke lowpass 220 Hz dengan LFO 0.07 Hz, ditambah pink noise bandpass 300 Hz pada minus 18 dB ("napas") | 1.5 s, 0, 1.0, 2.0 s | Overlay Warden, boss L0 |
| `kit` (perkusi) | Gendang, snare, simbal | Lihat tabel 4.1 | per bagian | Satu instrumen dengan lajur (lane) |
| `riser` | Crescendo orkestra | Pink noise lewat bandpass Q 4 yang menyapu 300 Hz ke 4 kHz eksponensial, ditambah saw glide D3 ke D4, gain minus 30 ke minus 10 dB | sepanjang durasi, berhenti tegas | Lihat bagian 6.4 |
| `shimmer` | Gesekan simbal, kilau | 8 sine acak 3 sampai 7 kHz dengan detune acak, envelope swell | 0.3 s, 0, 1.0, 1.2 s | Akhir Pulse, Memento |

### 4.1 Lajur `kit`

| Lajur | Resep | Durasi |
|---|---|---|
| `kick` | Sine pitch 120 Hz turun ke 48 Hz dalam 120 ms, klik noise lowpass 2 kHz 5 ms | 250 ms |
| `tom` | Sine 170 Hz turun ke 95 Hz dalam 150 ms, sedikit noise lowpass 1 kHz (rasa frame drum) | 300 ms |
| `snare` | Noise bandpass 1.8 kHz Q 0.8 plus triangle 185 Hz badan, peluruhan 120 ms | 160 ms |
| `hat` | Noise highpass 7 kHz, lowpass 11 kHz (dipotong agar tidak menusuk), peluruhan 30 ms | 40 ms |
| `hat_open` | Seperti `hat`, peluruhan 160 ms | 200 ms |
| `shaker` | Noise bandpass 5 kHz, attack 15 ms, peluruhan 50 ms | 70 ms |
| `timp` | Sine 73 Hz (D2) dengan pitch naik 3 cent lalu stabil, plus noise lowpass 400 Hz, peluruhan 1.2 s | 1.4 s |

---

## 5. Bahasa musik

### 5.1 Pusat nada dan tangga nada [Wajib]

| Lagu | Kunci dan modus | Nada | Tempo | Rasa |
|---|---|---|---|---|
| Pulse bioma 1 | D dorian | D E F G A B C | 116 BPM | Minor yang hangat (B natural memberi cahaya di tengah gelap) |
| Toko (the Glazier) | F lydian | F G A B C D E | 76 BPM | Mengambang, kaca, sedikit ganjil seperti pedagang bertopeng |
| Boss bioma 1 | D phrygian | D Eb F G A Bb C | 132 BPM | Gelap, mendesak, aksen 3+3+2 |
| Judul dan layar akhir | D dorian | sama dengan Pulse | 84 BPM (akhir 72 BPM) | Tenang, melankolis hangat |
| Bioma 2 [Tingkat C] | D aeolian | D E F G A Bb C | 104 BPM | Biara di tebing, choir lebih banyak |
| Bioma 3 [Tingkat C] | D minor harmonik | D E F G A Bb C# | 124 BPM | Kebun terbakar, petik dan perkusi kering |

Alasan semua berpusat di D: transisi antar layar terasa satu keluarga, dan SFX bernada bisa dibuat dari nada netral yang cocok di semua lagu.

### 5.2 Aturan nada untuk SFX [Wajib]
- **SFX hadiah dan pemain** (level up, Memento, Rite siap, sinergi) memakai hanya nada D, G, A, dan E dalam voicing sus atau kuint. Nada ini ada di semua lagu bioma 1, jadi tidak pernah bentrok.
- **Tangga Glint** diambil dari data lagu aktif (`glintLadder`), karena Glint sering berbunyi saat musik paling padat:
  - Pulse (D dorian) dan toko (F lydian): D6 E6 G6 A6 B6 D7 E7 G7.
  - Boss (D phrygian): D6 F6 G6 A6 C7 D7 F7 G7.
- **SFX bahaya** tidak memakai nada konsonan. Pilihan: tritone (D lawan G#), cluster semitone, atau noise berbentuk. Pita utama 1 sampai 3 kHz, bentuk naik (pitch atau filter naik menuju saat kena).
- **Suara serangan otomatis pemain** tidak menempati 1 sampai 3 kHz sebagai pita utama. Energinya di 250 sampai 800 Hz ("thup" lembut) dengan sedikit udara di atas 4 kHz. Pita 1 sampai 3 kHz dicadangkan untuk bahaya.

### 5.3 Motif [Wajib, orisinal]

Notasi: `NADA:durasi` dengan durasi dalam step 16-an (4 step = 1 ketukan, 16 step = 1 birama 4/4). `r` = diam. Oktaf ilmiah (C4 = do tengah). Tiap birama dipisah `|`.

**Motif Cahaya (`motif.light`).** Motif utama game, "Now we keep the light". Lompatan turun kuart, turun bertangga, lalu naik ke B natural dorian yang memberi rasa harapan.

```
Birama 1 (Dm) | D5:4  A4:4  G4:2  F4:2  G4:4
Birama 2 (G)  | A4:6  B4:2  C5:4  A4:4
Birama 3 (Bb) | D5:4  F5:2  E5:2  D5:4  C5:4
Birama 4 (C)  | D5:12 r:4
```

Jawaban motif (birama 5 sampai 8):

```
Birama 5 (Dm) | F5:4  E5:2  D5:2  C5:4  A4:4
Birama 6 (G)  | B4:4  C5:2  D5:2  G4:8
Birama 7 (Am) | E5:4  C5:4  A4:2  B4:2  C5:4
Birama 8 (A7) | A4:8  G4:2  A4:2  E4:4
```

**Motif Rembes (`motif.seep`).** Motif the Unlit. Turun kromatis dan mendarat di tritone. Dipakai overlay Warden, intro boss, stinger Warden.

```
| D4:4  C#4:4  C4:4  G#3:4
```

**Motif Glazier (`motif.glazier`).** Denting kecil dua nada (turun kuart) lalu dengung topeng.

```
| E6:2  B5:6  r:8          (glass_bell, lalu dengung formant "mm" pada F2 selama 1 s)
```

**Varian:**
- Kemenangan: Motif Cahaya birama 1 sampai 4 dalam D mayor (F menjadi F#, C menjadi C#), brass plus lonceng, tempo 84 BPM.
- Kekalahan: birama 1 dan 5 Motif Cahaya dimainkan lonceng saja, 72 BPM, berakhir di D rendah tanpa resolusi.
- Boss: birama 1 utuh (agar dikenali), lalu dibelokkan ke phrygian (lihat data boss di 7.6).

Uji orisinalitas [Wajib]: sebelum M2, CD dan AU mendengarkan motif dan menolak bila mirip melodi yang dikenal. Hasil dicatat di review CD.

### 5.4 Progresi akor

Simbol: `Dm` minor, `G` mayor, `A7` dominan, `maj7`, `m7`, `sus4`, `sus2`, `6`. Satu akor per birama.

| Lagu | Bagian | Progresi (8 birama) |
|---|---|---|
| Pulse | A | Dm, G, Bb, C, Dm, G, Am, A7 |
| Pulse | B | Bb, C, Am, Dm, G, Bb, Csus4, A7 |
| Toko | A | Fmaj7, G, Em7, Am7, Dm7, G6, Fmaj7, Csus2 |
| Boss | A | Dm, Eb, Dm, Cm, Bb, Eb, Gm, A |
| Boss | B | Dm, Eb, F, Eb, Dm, Cm, Bb, A |
| Judul | A | sama dengan Pulse A |

Catatan teori: G mayor adalah warna khas dorian. Bb dipinjam dari aeolian sebagai bayangan. A7 di birama 8 memberi dorongan kembali ke Dm di awal loop. Di atas akor Bb, melodi memakai Bb, tidak pernah B natural.

---

## 6. Struktur musik adaptif

### 6.1 Alur state musik

Fase mengikuti `RunPhase` di `docs/tech/architecture.md` 4.4 (`idle`, `pulse`, `pulseClear`, `reward`, `levelUp`, `shop`, `victory`, `defeat`). Fase `reward` (pilihan Memento dari Warden) memakai musik toko seperti `levelUp`. Layar judul dan jeda adalah state app.

```
Judul (mus.title, fase idle; fade in 1.5 s)
  -> startRun: fade 1 s
Fase pulse, Pulse non-boss (mus.biome1.pulse)
  awal: mus.stinger.pulse_start + loop mulai di level dasar
  sepanjang Pulse: level naik di batas birama
  Warden hidup: overlay mus.overlay.unlit, level minimal 2
  Tekanan: event MusicPressureChanged (sim, config.csv), ditahan minimal 2 birama
  T minus 6 s: mus.riser.pulse_end (dilewati bila Warden masih hidup)
  T = 0 (PulseEnded, masuk pulseClear): loop berhenti (fade 80 ms, pad dan reverb dibiarkan meluruh), mus.stinger.pulse_end
Fase pulseClear: hanya stinger, sfx.pulse.end_flash, sfx.glint.sweep
Fase levelUp atau shop (yang lebih dulu, mus.shop)
  saat keluar dari pulseClear: ui.glazier.arrive, mus.shop fade in 2 s
  levelUp ke shop: musik terus tanpa putus
  pulse.begin (masuk fase pulse): mus.shop fade out 0.6 s, kembali ke Pulse
Pulse boss (mus.biome1.boss, sejak PulseStarted di L0)
  BossSpawned: mus.stinger.boss_intro, loop boss L1
  BossPhaseChanged ke fase 2: mus.stinger.boss_phase, jeda loop 1.5 s, level 3
  BossEnraged: mus.stinger.boss_phase, level 4
  BossKilled: loop berhenti, mus.stinger.boss_defeated (menggantikan stinger akhir Pulse)
Akhir run
  fase victory: mus.stinger.victory lalu mus.end (mulai setelah ekor stinger)
  fase defeat (PlayerDied): efek lambat, mus.stinger.defeat lalu mus.end
  Layar judul setelah run: fase tetap victory atau defeat, jadi mus.end terus berbunyi
```

### 6.2 Lapisan intensitas Pulse

| Level | Nama | Lapisan yang berbunyi | Rasa |
|---|---|---|---|
| L0 | Dasar | Pad senar, bass panjang, lonceng kaca tiap 2 birama | Tenang, siaga |
| L1 | Denyut | L0 tanpa bass panjang, plus bass jalan, kick, tom, hat 8-an | Mulai bergerak |
| L2 | Dorongan | L1 plus snare, hat 16-an, stab brass, arpeggio chiptune | Padat, berbahaya |
| L3 | Puncak | L2 plus lead Motif Cahaya (brass dengan dobel lonceng), timpani | Klimaks |

### 6.3 Aturan level [Wajib, angka di data lagu]
Level dihitung tiap frame dari snapshot sim (read-only), tapi hanya diterapkan di batas birama berikutnya:

```
pulseNumber = view.pulse.index + 1                         (index di WorldView 0-based)
progress    = 1 - view.pulse.ticksLeft / view.pulse.ticksTotal
enemiesAlive, wardenAlive = hitung dari view.enemies (alive, rank 1 = Warden)
level = min(max,
            baseByPulse(pulseNumber)
          + progressAdd(progress)
          + pressureAdd(enemiesAlive))
bila wardenAlive: level = max(level, wardenAliveMinLevel)
```

Nilai awal untuk `mus.biome1.pulse`:
- `baseByPulse`: Pulse 1 sampai 3 = 0, Pulse 4 sampai 7 = 1, Pulse 8 ke atas = 2.
- `progressAdd`: plus 1 pada 35% durasi, plus 2 pada 70% durasi.
- `pressureAdd`: plus 1 selama event `MusicPressureChanged` menyatakan ramai (ambang milik sim di `config.csv`, GD Q21), ditahan minimal 2 birama. Diubah di M2: lagu tidak lagi menyimpan jumlah Unlit; validator menolak `pressure.enemiesAlive`.
- Maksimal 3.

Akibatnya Pulse 1 berjalan L0, L1, L2. Pulse 4 berjalan L1, L2, L3. Pulse akhir sudah L3 sejak 35%. Pemain merasakan run makin panas.

Aturan transisi:
- Naik level: lapisan baru fade in selama 1 ketukan, mulai tepat di downbeat birama.
- Turun level (hanya karena tekanan berkurang): fade out 2 ketukan di batas birama. Progres dan nomor Pulse tidak pernah menurunkan level di tengah Pulse.
- Pindah bagian A ke B mengikuti `form` lagu, tidak bergantung pada level.

### 6.4 Riser dan akhir Pulse [Wajib]
- Riser `mus.riser.pulse_end` mulai saat `view.pulse.ticksLeft / 60 <= 6.0 s`, dijadwalkan pada step 16-an terdekat. Riser berakhir tegas tepat di akhir Pulse, tanpa ekor. Enam detik dipilih agar riser menyatu dengan lonjakan spawn GDD (D minus 6 s sampai D minus 2 s); dua detik terakhir tanpa spawn menjadi puncak riser.
- **Warden menahan timer** (gdd 3.3): bila Warden masih hidup saat sisa waktu 6 s, riser tidak dimulai. Musik tetap di level minimal 2 dengan overlay Unlit. Saat Warden mati dan Pulse berakhir, langsung ke stinger akhir. Saat Warden mendapat `hasted` (20 s waktu tambahan), level naik ke 3.
- **Pulse boss** tidak berbatas waktu, jadi tidak ada riser dan tidak ada `sfx.pulse.tick`.
- Waktu dihitung dari waktu sim, bukan dari jam musik, karena durasi Pulse ditentukan GD. Musik tidak harus berada di akhir birama saat Pulse selesai; stinger akhir menutupi potongan.
- Saat `PulseEnded`: semua lapisan loop fade out 80 ms (pad 400 ms), `mus.stinger.pulse_end` berbunyi, bersamaan dengan `sfx.pulse.end_flash`.
- [Opsional] tiga detik terakhir `sfx.pulse.tick` di atas riser.

### 6.5 Toko
- `mus.shop` tanpa perkusi di L0: pad lembut, petik, melodi lonceng jarang.
- Toko tanpa batas waktu (gdd 12), jadi musik toko tidak punya lapisan intensitas. Ketegangan datang dari keputusan, bukan dari jam.
- Musik toko dimulai dari birama 1 setiap kali toko dibuka (pemain mengenali "jeda").

### 6.6 Boss
- Level boss ditentukan fase, bukan progres waktu: fase 1 = L1, naik ke L2 setelah 30 detik atau HP boss di bawah 75% [Asumsi], fase 2 (HP 50% ke bawah, gdd 16.1) = L3. Jeda 1.5 s pembuka fase 2 diisi `mus.stinger.boss_phase`; loop berhenti selama jeda lalu masuk lagi di downbeat bagian berikutnya. Mengamuk (setelah 120 s) = **L4** (lapisan rage: kick ganda, hat 16-an, brass rendah tritone, choir panjang). Diubah di M2: fase, HP, dan mengamuk dibaca dari `view.pulse.boss` (BigFoeView); event `BossPhaseChanged` hanya memicu jeda. Angka ada di `intensity.boss` lagu boss.
- L0 boss (dipakai saat intro 3 detik): drone Unlit plus choir.
- Saat boss memanggil anak (summon), tidak ada perubahan level; hanya SFX.

### 6.7 Overlay Unlit (Warden)
`mus.overlay.unlit` mengikuti tempo dan jam lagu tuan rumah. Lapisan: `unlit_drone` pada D1 dan G#1, plus Motif Rembes dengan `brass_low` setiap 4 birama (dua varian bergantian), dan cluster kaca C#6 dan D6 tiap 8 birama. Fade in 2 ketukan saat Warden hidup (`view.pulse.wardenAlive`), fade out 1 birama saat mati.

### 6.8 Kematian pemain dan jeda
- Kematian (`PlayerDied`, fase `defeat`): master lowpass menyapu ke 300 Hz dalam 1.2 s selama efek lambat, music bus turun 12 dB, `sfx.player.death`, lalu `mus.stinger.defeat` saat layar akhir.
- Jeda (`AudioSystem.setPaused(true)`): music bus lowpass 800 Hz dan minus 6 dB, SFX dari sim berhenti karena sim berhenti. Bus ui tetap normal.

---

## 7. Format data sequencer [Wajib]

Satu file JSON per lagu di `src/audio/music/`. Validator di `tools/audio/validate.ts` (M1, usul skrip `audio:check`) mengecek semua aturan di 7.2 sampai 7.4.

### 7.1 Field tingkat lagu

| Field | Tipe | Arti |
|---|---|---|
| `id` | string | Id cue, sama dengan `docs/audio-list.md` |
| `bpm` | number | Tempo |
| `meter` | [number, number] | Birama, 1.0 hanya [4, 4] |
| `stepsPerBeat` | number | Resolusi grid, 4 (16-an) |
| `key` | {root, mode} | Informasi dan validasi nada |
| `glintLadder` | string[] | Tangga nada `sfx.glint.pickup` saat lagu ini aktif (opsional) |
| `form` | string[] | Urutan bagian dalam satu loop, misalnya ["A", "B"] |
| `sections` | map | Nama bagian ke `{ "chords": [...] }`, satu akor per birama |
| `intensity` | object | Aturan level (6.3), opsional untuk lagu tanpa lapisan |
| `layers` | object[] | Lapisan instrumen |

### 7.2 Field lapisan

| Field | Tipe | Arti |
|---|---|---|
| `id` | string | Nama lapisan unik di lagu |
| `instrument` | string | Id instrumen dari bagian 4 |
| `minLevel` / `maxLevel` | number | Lapisan berbunyi bila `minLevel <= level <= maxLevel` (default 0 dan 3) |
| `gainDb` | number | Level lapisan di music bus |
| `send` | {hall?, room?} | Jumlah kirim reverb 0 sampai 1 |
| `pan` | number | minus 1 sampai 1 |
| `everyBars` | number | Lapisan hanya berbunyi di birama ke-1 dari tiap kelompok N birama (default 1) |
| `type` | string | `chord`, `chordRoot`, `arp`, `melody`, `drum`, `note` |
| `octave` | number | Oktaf dasar untuk `chord`, `chordRoot`, `arp` |
| `voicing` | string | `close` (akar, ters, kuin, dan sept bila ada, bertumpuk naik) atau `open` (akar, kuin, ters satu oktaf di atas, sept satu oktaf di atas) |
| `rhythm` | string | Pola 16 karakter per birama (7.3) untuk `chord`, `chordRoot`, `note` |
| `noteSteps` | number | Panjang not bila tidak diatur `_` (default 1) |
| `tokens` | string | Untuk `arp`: indeks nada akor (7.4) |
| `stepLen` | number | Untuk `arp`: step per token |
| `lanes` | map | Untuk `drum`: nama lajur `kit` ke pola 16 karakter |
| `bySection` | map | Untuk `melody`: nama bagian ke array string birama |
| `bars` | string[] | Untuk `melody`: daftar birama yang diputar bergiliran (dipakai bersama `everyBars`) |
| `notes` | string[] | Untuk `note`: nada tetap (drone) |
| `double` | {instrument, octave, gainDb} | Dobel melodi dengan instrumen lain |

### 7.3 Tata bahasa pola ritme
Satu karakter per step, panjang tepat 16 per birama.

| Karakter | Arti |
|---|---|
| `X` | Pukulan aksen, velocity 1.0 |
| `x` | Pukulan normal, velocity 0.75 |
| `.` | Ghost, velocity 0.4 |
| `_` | Tahan not sebelumnya (tie) |
| `-` | Diam atau lepas |

### 7.4 Tata bahasa melodi dan arpeggio
- **Melodi:** token dipisah spasi, `NADA:step` atau `r:step`. Nada dengan `#` atau `b` (misalnya `C#5`, `Bb4`). Akhiran `!` setelah step berarti aksen (`D5:4!`). Jumlah step per string birama harus tepat 16. Jumlah string per bagian harus sama dengan jumlah akor bagian itu.
- **Arpeggio:** token adalah indeks nada akor aktif. `0` akar, `1` ters (atau sus), `2` kuin, `3` sept bila ada, bila tidak ada akar satu oktaf di atas. Akhiran `+` naik satu oktaf, `-` turun satu oktaf. `r` diam. Jumlah token kali `stepLen` harus 16.
- **Akor yang didukung parser:** akar (C sampai B dengan `#` atau `b`) ditambah salah satu: kosong (mayor), `m`, `7`, `maj7`, `m7`, `6`, `sus2`, `sus4`, `dim`.

### 7.5 Contoh lengkap: `mus.biome1.pulse`

```json
{
  "id": "mus.biome1.pulse",
  "bpm": 116,
  "meter": [4, 4],
  "stepsPerBeat": 4,
  "key": { "root": "D", "mode": "dorian" },
  "glintLadder": ["D6", "E6", "G6", "A6", "B6", "D7", "E7", "G7"],
  "form": ["A", "B"],
  "sections": {
    "A": { "chords": ["Dm", "G", "Bb", "C", "Dm", "G", "Am", "A7"] },
    "B": { "chords": ["Bb", "C", "Am", "Dm", "G", "Bb", "Csus4", "A7"] }
  },
  "intensity": {
    "max": 3,
    "baseByPulse": [
      { "fromPulse": 1, "level": 0 },
      { "fromPulse": 4, "level": 1 },
      { "fromPulse": 8, "level": 2 }
    ],
    "progressSteps": [
      { "atProgress": 0.35, "add": 1 },
      { "atProgress": 0.7, "add": 2 }
    ],
    "pressure": { "enemiesAlive": 60, "add": 1, "holdBars": 2 },
    "wardenAliveMinLevel": 2,
    "quantize": "bar",
    "fadeInBeats": 1,
    "fadeOutBeats": 2,
    "riser": { "cue": "mus.riser.pulse_end", "secondsBeforeEnd": 6, "skipIfWardenAlive": true }
  },
  "layers": [
    {
      "id": "bell_mark", "instrument": "glass_bell", "minLevel": 0,
      "gainDb": -20, "send": { "hall": 0.5 }, "everyBars": 2,
      "type": "chordRoot", "octave": 5, "rhythm": "X---------------"
    },
    {
      "id": "pad", "instrument": "string_pad", "minLevel": 0,
      "gainDb": -16, "send": { "hall": 0.35 },
      "type": "chord", "octave": 3, "voicing": "close", "rhythm": "X_______________"
    },
    {
      "id": "bass_hold", "instrument": "sub_bass", "minLevel": 0, "maxLevel": 0,
      "gainDb": -14, "type": "chordRoot", "octave": 2, "rhythm": "X_______x_______"
    },
    {
      "id": "bass_drive", "instrument": "sub_bass", "minLevel": 1,
      "gainDb": -13, "type": "chordRoot", "octave": 2, "rhythm": "X__x__x_X__x_x__"
    },
    {
      "id": "perc_base", "instrument": "kit", "minLevel": 1, "gainDb": -15,
      "send": { "hall": 0.1 }, "type": "drum",
      "lanes": {
        "kick": "X-------X-x-----",
        "tom":  "----x-------x---",
        "hat":  "--x---x---x---x-"
      }
    },
    {
      "id": "perc_drive", "instrument": "kit", "minLevel": 2, "gainDb": -16,
      "send": { "hall": 0.1 }, "type": "drum",
      "lanes": {
        "snare": "----X-------X---",
        "hat":   "-.-.-.-.-.-.-.-."
      }
    },
    {
      "id": "brass_stab", "instrument": "brass", "minLevel": 2,
      "gainDb": -15, "send": { "hall": 0.25 },
      "type": "chord", "octave": 3, "voicing": "open",
      "rhythm": "X-----x---X-----", "noteSteps": 2
    },
    {
      "id": "arp", "instrument": "chip_arp", "minLevel": 2,
      "gainDb": -19, "send": { "hall": 0.2 }, "pan": 0.2,
      "type": "arp", "octave": 4, "stepLen": 1,
      "tokens": "0 1 2 0+ 1 2 0+ 2 0 1 2 0+ 1+ 0+ 2 1"
    },
    {
      "id": "lead", "instrument": "brass", "minLevel": 3,
      "gainDb": -12, "send": { "hall": 0.3 },
      "type": "melody",
      "double": { "instrument": "glass_bell", "octave": 1, "gainDb": -22 },
      "bySection": {
        "A": [
          "D5:4 A4:4 G4:2 F4:2 G4:4",
          "A4:6 B4:2 C5:4 A4:4",
          "D5:4 F5:2 E5:2 D5:4 C5:4",
          "D5:12 r:4",
          "F5:4 E5:2 D5:2 C5:4 A4:4",
          "B4:4 C5:2 D5:2 G4:8",
          "E5:4 C5:4 A4:2 B4:2 C5:4",
          "A4:8 G4:2 A4:2 E4:4"
        ],
        "B": [
          "F5:6 D5:2 F5:4 G5:4",
          "E5:6 C5:2 E5:4 G5:4",
          "A5:4 G5:2 E5:2 C5:4 E5:4",
          "D5:12 r:4",
          "B4:4 D5:4 G5:4 F5:2 E5:2",
          "D5:4 F5:4 E5:2 D5:2 C5:4",
          "F5:4 G5:4 F5:4 C5:4",
          "E5:4 C#5:4 A4:4 r:4"
        ]
      }
    },
    {
      "id": "timpani", "instrument": "kit", "minLevel": 3, "gainDb": -14,
      "send": { "hall": 0.3 }, "everyBars": 4, "type": "drum",
      "lanes": { "timp": "X-----------x-x-" }
    }
  ]
}
```

Panjang loop: 16 birama pada 116 BPM = 33.1 detik. Pulse Tingkat A berdurasi 20 sampai 40 detik (`min(40, 20 + 2.5 x (n - 1))`, gdd 3.1), jadi loop diputar sekitar 0.6 sampai 1.2 kali dan Pulse pendek tidak pernah mendengar pengulangan.

### 7.6 Data ringkas lagu lain (diisi penuh ke JSON di M2)

**`mus.shop`** (F lydian, 76 BPM, form ["A"], 8 birama = 25.3 detik)

| Lapisan | Instrumen | Level | Pola |
|---|---|---|---|
| `pad` | `string_pad` (lowpass diturunkan ke 900 Hz lewat param instrumen) | 0 | chord, oktaf 3, close, `X_______________` |
| `bass` | `sub_bass` | 0 | chordRoot, oktaf 2, `X_______________`, gainDb -18 |
| `pluck_arp` | `pluck` | 0 | arp, oktaf 4, stepLen 2, tokens `0 2 1+ 2 0+ 2 1+ 2` |
| `bell_melody` | `glass_bell` | 0 | melody, lihat di bawah |

Melodi toko (bagian A), birama 5 dan 6 mengutip bentuk Motif Cahaya:

```
"C5:4 E5:4 A5:8",
"B5:8 A5:4 G5:4",
"G5:12 r:4",
"E5:4 G5:4 C6:8",
"A5:4 E5:4 D5:2 C5:2 D5:4",
"E5:6 B4:2 D5:8",
"C5:4 E5:4 G5:4 A5:4",
"G5:16"
```

**`mus.biome1.boss`** (D phrygian, 132 BPM, form ["A", "B"], 16 birama = 29.1 detik, `glintLadder` D6 F6 G6 A6 C7 D7 F7 G7)

| Lapisan | Instrumen | Level | Pola |
|---|---|---|---|
| `drone` | `unlit_drone` | 0 | note, `["D1", "G#1"]`, `X_______________` |
| `choir_pad` | `choir` | 0 | chord, oktaf 3, close, `X_______________` |
| `bass_ostinato` | `sub_bass` | 1 | chordRoot, oktaf 2, `X-----x-----x---` (3+3+2) |
| `perc` | `kit` | 1 | kick `X-----X-----X---`, snare `----X-------X--x`, hat `x.x.x.x.x.x.x.x.` |
| `brass_ostinato` | `brass` | 2 | chord, oktaf 3, open, `X-----X-----X---`, noteSteps 2 |
| `arp` | `chip_arp` | 2 | arp, oktaf 4, stepLen 1, tokens `0 1 2 1 0 1 2 1 0+ 2 1 2 0+ 2 1 2` |
| `lead` | `brass` dobel `choir` | 3 | melody hanya bagian A, bagian B diam (tanya jawab dengan arp) |
| `timpani` | `kit` | 3 | `timp`: `X-----X-----X---`, everyBars 2 |

Lead boss (bagian A):

```
"D5:4 A4:4 G4:2 F4:2 G4:4",
"G4:6 Bb4:2 Eb5:4 D5:4",
"F5:4 Eb5:2 D5:2 C5:4 A4:4",
"C5:6 Bb4:2 G4:8",
"D5:4 F5:4 D5:4 Bb4:4",
"Eb5:6 D5:2 Bb4:4 G4:4",
"G4:4 Bb4:4 D5:4 C5:2 Bb4:2",
"A4:8 Bb4:4 A4:4"
```

Lead bagian B: 8 string `"r:16"`.

**`mus.overlay.unlit`** (mengikuti tempo tuan rumah)

```json
{
  "id": "mus.overlay.unlit",
  "followsHost": true,
  "layers": [
    { "id": "drone", "instrument": "unlit_drone", "gainDb": -18,
      "type": "note", "notes": ["D1", "G#1"], "rhythm": "X_______________" },
    { "id": "seep", "instrument": "brass_low", "gainDb": -16, "everyBars": 4,
      "type": "melody", "bars": ["D4:4 C#4:4 C4:4 G#3:4"] }
  ]
}
```

**`mus.title`**: D dorian 84 BPM, form ["A"], akor Pulse A, lapisan `pad`, `bass_hold`, dan melodi `glass_bell` memakai 8 birama Motif Cahaya (sama dengan lead Pulse bagian A). **`mus.end`** memakai data `mus.title` dengan `bpm` 72 dan tanpa lapisan melodi.

**Stinger** (data JSON pendek dengan `form` satu bagian tanpa loop, atau resep langsung):

| Id | Isi |
|---|---|
| `mus.stinger.pulse_start` | `glass_bell` D2 dan D3 bersamaan (indeks FM 3.0), A3 pada +0.25 s lebih pelan, `kit.timp` lembut. 2.5 s |
| `mus.stinger.pulse_end` | "Akor kaca naik": `glass_bell` D4, A4, D5, F#5, A5 dipetik naik berjarak 60 ms, plus `shimmer`. F# memberi D mayor, cahaya menang. 2.5 s |
| `mus.stinger.warden` | `brass_low` D2 dan G#2 swell 1.2 s, cluster `glass_bell` C#6 dan D6. 2 s |
| `mus.stinger.boss_intro` | `unlit_drone` swell, `choir` Dm, gulungan `timp` 16-an 2 detik, Motif Rembes pada `brass_low`. 3 s |
| `mus.stinger.boss_phase` | Stab `brass` dan `choir` akor Eb di atas bass D (bentrok b9), `timp` X. 1.5 s |
| `mus.stinger.boss_defeated` | Cascade `glass_bell` turun acak di nada D phrygian selama 2 s, mendarat di akor D mayor penuh (`string_pad`, `glass_bell`). 4 s |
| `mus.stinger.victory` | Motif Cahaya birama 1 sampai 4 versi D mayor, `brass` plus `glass_bell`, pad D mayor, 84 BPM. Sekitar 6 s |
| `mus.stinger.defeat` | `glass_bell` saja: `D5:8 A4:4 G4:4 | F4:8 E4:4 D4:4`, 72 BPM, ekor hall panjang. Sekitar 4 s |

---

## 8. Mix

### 8.1 Bus [Wajib]

```
musik (sequencer, stinger)      -> music bus  --\
sfx sim (prioritas 1 sampai 6) -> sfx bus    ---+-> master gain -> kompresor -> limiter -> output
ui                             -> ui bus     --/
kirim:  hall (ir.hall)  <- music, stinger
        room (ir.room)  <- sfx prioritas 1 sampai 4, ui
        return hall dan room masuk ke bus asal masing-masing (hall ke music, room ke sfx)
```

- Ambience (`amb.*`, Tingkat B) masuk sfx bus dengan slot sendiri (2 instans), tidak ikut voice stealing.
- Master: DynamicsCompressor (threshold minus 14 dB, ratio 3, knee 6, attack 5 ms, release 120 ms), lalu kompresor kedua sebagai limiter (threshold minus 3 dB, ratio 20, attack 1 ms, release 50 ms). Target puncak di bawah minus 1 dBFS.
- Master lowpass (BiquadFilter, normalnya 20 kHz) untuk efek lambat saat mati dan jeda.

### 8.2 Gain staging [Wajib, final di mix M4]
Level `gainDb` di data SFX adalah puncak target dalam dBFS dengan fader bus 100%. Referensi: `sfx.player.hit` = minus 6 dBFS.

| Kelas suara | Puncak target |
|---|---|
| Pemain kena hit | -6 |
| Telegraf bahaya, ledakan peledak | -9 sampai -12 |
| Level up, Memento, Rite | -10 sampai -14 |
| Pungut Glint | -20 |
| Unlit mati | -21 |
| Serangan otomatis pemain | -24 (18 dB di bawah kena hit, sesuai style guide 3.3) |
| Hit proyektil ke musuh | -27 |
| Ambience | -32 |
| Musik (jumlah semua lapisan L3) | puncak sekitar -14, rata-rata sekitar -22 |
| UI | -18 sampai -30 |

Target loudness keseluruhan sekitar minus 16 LUFS terintegrasi pada pengaturan default, diukur dari rekaman 5 menit permainan di M4 [Asumsi].

### 8.3 Prioritas dan voice stealing [Wajib]
Prioritas mengikuti style guide 3.2 (1 tertinggi):

| Prioritas | Kelas |
|---|---|
| 1 | Pemain kena hit, pemain mati, boss mati |
| 2 | Telegraf dan serangan bahaya (musuh, Warden, boss), kedatangan Warden dan boss |
| 3 | Level up, Memento, sinergi, Rite, alur Pulse |
| 4 | Pungut Glint, heal |
| 5 | Unlit mati, spawn, hit kritikal, boss atau Warden terluka |
| 6 | Serangan otomatis pemain, hit proyektil biasa |
| U | Bus ui, slot terpisah (6 instans), tidak bersaing dengan SFX sim |

Aturan:
1. Tiap cue punya `maxVoices` dan `minIntervalMs` (lihat `docs/audio-list.md`). Pemicu di dalam jeda minimum dibuang, bukan diantre.
2. Batas global 24 instans sfx. Bila penuh, cue baru mencuri instans tertua dengan prioritas lebih rendah (angka lebih besar). Bila tidak ada, cue baru dibuang.
3. 4 slot dicadangkan untuk prioritas 1 dan 2. Suara bahaya dan kena hit tidak pernah gagal berbunyi.
4. Instans yang dicuri di-fade out 10 ms (tidak dipotong mentah).

### 8.4 Penggabungan pemicu (coalescing) [Wajib]
Sim bisa mengirim puluhan event sejenis dalam satu frame (ledakan membunuh 20 Unlit). Engine menggabungkan event dengan cue yang sama dalam jendela `coalesce.windowMs` menjadi satu putaran, dengan tambahan gain `+1 dB` per penggandaan jumlah, maksimal `maxBoostDb` (biasanya plus 3 dB). Hasilnya terdengar "lebih besar", bukan "lebih banyak klik".

### 8.5 Ducking [Wajib]

| Pemicu | Target | Turun | Attack | Tahan | Release |
|---|---|---|---|---|---|
| `sfx.player.hit` (event `PlayerDamaged`) | music bus | -6 dB | 10 ms | 150 ms | 300 ms |
| `sfx.player.hit` | sfx prioritas 4 sampai 6 | -8 dB | 10 ms | 150 ms | 300 ms |
| Telegraf prioritas 2 aktif | sfx prioritas 5 sampai 6 | -4 dB | 20 ms | selama telegraf, maks 600 ms | 200 ms |
| `sfx.levelup`, `sfx.memento.gain` | music bus | -4 dB | 30 ms | 300 ms | 600 ms |
| `sfx.boss.intro`, `sfx.boss.death`, `sfx.player.death` | music bus | -12 dB | 50 ms | durasi cue | 1.5 s |
| `sfx.boss.intro`, `sfx.boss.death`, `sfx.player.death` | sfx prioritas 3 sampai 6 | -10 dB | 50 ms | durasi cue | 1.5 s |

Ducking dibuat dengan GainNode khusus per kelompok (bukan sidechain kompresor) agar murah dan bisa diprediksi.

### 8.6 Panning [Wajib]
- Suara milik pemain (kena hit, Rite, level up, Memento, serangan otomatis yang berasal dari pemain) di tengah.
- Suara di dunia (Unlit mati, telegraf, tembakan musuh, Glint) dipan menurut posisi x dunia dari payload event, relatif terhadap arena: `pan = clamp((x - arenaCenterX) / arenaHalfWidth, -1, 1) * 0.6`. `arenaCenterX` dan `arenaHalfWidth` diambil dari `ArenaDef.arena.boundary` lewat `AudioSystem.setArena(arena)`, bukan konstanta. Arena final 32 x 20 u, jadi `arenaHalfWidth` 16; sebelum `setArena` dipanggil engine memakai pusat 0 dan lebar setengah 16. Audio tidak butuh proyeksi render (audio tidak boleh import render).
- Kamera tetap memperlihatkan seluruh area main, jadi tidak ada kasus "di luar layar" untuk aktor di arena.
- Tidak ada atenuasi jarak lain (arena kecil, kamera tetap).
- Opsi audio mono memaksa semua pan ke 0.

### 8.7 Opsi pemain [Wajib, UI dan QA mengimplementasi tampilan]

| Opsi | Default | Catatan |
|---|---|---|
| Master, Musik, SFX, UI | 80%, 70%, 100%, 80% | Kurva: `gain = (v / 100)^2`, 0% berarti mute penuh. `VolumeSettings` final punya master, music, sfx, ui (nilai bulat 0 sampai 100) |
| Audio mono | mati | Untuk pendengar satu telinga |
| Kurangi suara berulang | mati | `maxVoices` prioritas 5 sampai 6 dibagi dua, gain minus 3 dB |
| Mute saat tab tersembunyi | nyala | `AudioContext.suspend()` |

Saat slider digeser, putar pratinjau `ui.slider.tick` lewat bus yang diatur (slider musik memutar lonceng pendek di music bus).

---

## 9. Aturan desain SFX

### 9.1 Hierarki dan pita frekuensi [Wajib]

| Kelas | Pita utama | Bentuk | Catatan |
|---|---|---|---|
| Pemain kena hit | Lebar: thump 80 Hz, retak 2 sampai 6 kHz | Transien tajam, turun | Paling jelas, memicu ducking |
| Bahaya | 1 sampai 3 kHz | Naik (pitch atau filter), tritone atau noise | Tidak pernah dipakai untuk hal milik pemain |
| Hadiah | 1.2 sampai 5 kHz, nada D G A E | Lonceng, arpeggio naik | Konsonan, hangat |
| Glint | 1.1 sampai 3.2 kHz (D6 sampai G7), sangat pendek | Denting naik bertangga | Pendek agar tidak bersaing dengan telegraf yang panjang |
| Unlit mati | 100 sampai 1500 Hz | "Pop" gelap turun | Tidak berkilau (kilau milik pemain) |
| Serangan otomatis | 250 sampai 800 Hz, sedikit di atas 4 kHz | Lembut, pendek | Lowpass 6 sampai 8 kHz |

Catatan: Glint secara frekuensi bersinggungan dengan pita bahaya. Ini diterima karena bentuknya sangat berbeda (denting nada konsonan 90 ms lawan swell tritone yang naik ratusan ms), levelnya 8 sampai 11 dB lebih rendah, dan telegraf menduck prioritas 5 sampai 6. QA memverifikasi di uji keterbacaan audio (bagian 11).

### 9.2 Aturan SFX berulang (dari style guide 3.3) dalam bentuk field data [Wajib]
Berlaku untuk serangan otomatis, hit proyektil, Unlit mati, pungut Glint.

| Aturan style guide | Field data | Nilai |
|---|---|---|
| Durasi pendek, tanpa ekor reverb | `durationMs`, `send.room` | Serangan otomatis di bawah 80 ms, `send.room` = 0 |
| Pelan | `gainDb` | Serangan otomatis -24 (18 dB di bawah kena hit) |
| Variasi pitch plus minus 6% | `pitchJitter` | 0.06 (Glint 0.01 karena memakai tangga nada) |
| Variasi volume plus minus 2 dB | `gainJitterDb` | 2 |
| Keacakan tidak memakai RNG sim | (engine) | Engine memakai instance `Rng` milik audio dari `src/core/rng` (`Math.random` dilarang di `src/`, architecture.md 4.3) |
| Maksimal 4 instans | `maxVoices` | maksimal 4 |
| Jeda minimum sekitar 40 ms | `minIntervalMs` | minimal 35 sampai 40 |
| Serangan lembut, lowpass 6 sampai 8 kHz | `attackMs`, `lowpassHz` | attack minimal 2 ms, lowpass 6000 sampai 8000 |
| Glint beruntun naik bertahap | `ladder` | `{ "source": "song", "resetMs": 500 }` |

### 9.3 Senjata yang belum diketahui
SFX serangan dibuat per **arketipe** (bolt, lob, arc, chain, glaive, ring, kontak orbit), bukan per senjata, agar senjata baru tidak menunggu audio. CSV GD tidak memuat kolom audio (keputusan LP, review M0). Pemetaan ada di file AU `src/audio/cues/routes.json`: `weapons.fireById` (id senjata ke cue plus opsional `semis`, geser pitch 0 sampai 7 semitone agar dua senjata berarketipe sama terdengar beda), lalu `weapons.fireByArchetype` sebagai cadangan per kolom `archetype` di `weapons.csv`. `null` berarti sengaja tanpa suara (misalnya `orbit_shards`). Tes `tests/unit/audio/event-map.test.ts` memeriksa setiap id di `GameData` build punya cue atau `null` yang dinyatakan. Pemetaan senjata GDD ada di `docs/audio-list.md` 4.1.

### 9.4 Kekhasan suara penting (Pilar 2, uji P2-g) [Wajib]
Kena hit, level up, dan dapat Memento harus bisa dibedakan dengan mata tertutup:
- Kena hit: transien retak kaca kering, turun, tanpa nada, memicu ducking. Sekitar 250 ms.
- Level up: arpeggio chiptune cepat naik D5 G5 A5 D6, cerah, sekitar 700 ms.
- Memento: lonceng rendah lambat D4 dan A4 lalu kilau terbalik dan "tok" tutup kaca, sekitar 1.1 s. Lebih rendah dan lebih lambat dari level up, tanpa arpeggio.

---

## 10. Integrasi dengan simulasi

Kontrak mengikuti `docs/tech/architecture.md` bagian 6.4 (`WorldView`), 6.5 (event bus, `SimEventType`), 6.8 (`AudioSystem`), dan 11. Nama dan payload event mengikuti tabel final architecture 6.5. Bila LP mengubah nama, AU mengganti kolom pemicu di daftar cue dan `routes.json`; id cue tidak berubah.

Prinsip [Wajib]:
1. **Audio hanya pendengar.** Sim deterministik tidak pernah membaca apa pun dari audio. Audio boleh dimatikan total (tes headless, bot balance) tanpa mengubah hasil sim. Audio tidak meng-import `sim` atau `render`.
2. **Event per frame.** `AudioSystem.update(view, events, dtSec)` dipanggil tiap frame dengan FrameEvents (semua tick di frame itu). Audio membunyikan cue segera (`currentTime` plus offset sekitar 5 ms). Event dengan cue sama di satu frame digabung (8.4).
3. **Pemetaan event ke cue** ada di `src/audio/cues/routes.json` (data) dan `src/audio/event-map.ts` (logika). Event turunan sesuai architecture.md 6.5: masuk fase `shop` dari `PhaseChanged`; penolakan dari `CommandRejected` (`ui.denied`, kecuali `WrongPhase`, `UnknownId`, `DebugDisabled`); hit Warden dan boss dari `EnemyDamaged` (rank di bit 2-3 `b`).
4. **Payload `x`, `y`, `a`, `b`, `c`** (`c` biasanya SourceRef dari `encodeSource`). Field lain diturunkan dari data: ukuran Unlit dari `sizeClass` lewat `EnemyTypeIndex`; cue serangan dari `routes.json` lewat `WeaponIndex`; sumber dampak (ledakan `lantern_bolt`, kontak `orbit_shards`) dari `EnemyDamaged.c` (senjata) dan `HitKind` di bit 4-6 `b`; sumber telegraf dari `c` (`EnemyAttack` dengan peran musuh, `BossPattern` dengan `archetype` pola, `Affix` dengan id affix); proc dari `ProcTriggered.a` (`EffectIndex`, dipetakan lewat `owner` efek seperti `syn_flame_4`, cadangan per `action`); Rush penuh dari `BuffMaxed`; boss mengamuk dari `BossEnraged`; Warden `hasted` dari `AffixApplied`; pungutan otomatis dari `GlintSwept`; retakan spawn dari `SpawnMarked`.
5. **Snapshot musik dari `WorldView`** (read-only): `phase`, `pulse.index`, `pulse.ticksLeft`, `pulse.ticksTotal`, `pulse.isBoss`, jumlah Unlit hidup dan keberadaan Warden atau boss dari `enemies` (`alive`, `rank`), HP boss untuk naik ke L2. Fase boss dilacak dari event `BossPhaseChanged`. Jeda datang dari `setPaused`.
6. **Telegraf memakai durasi dari sim** (`b` pada `TelegraphStarted` dalam tick). Cue `mode: live` dirender sepanjang `b / 60` detik agar puncak suara jatuh tepat saat serangan kena.
7. **Tangga Glint:** bila sim mengisi `b` pada `GlintCollected` dengan panjang rentetan, audio memakainya sebagai anak tangga. Bila 0, audio memakai penghitung sendiri dengan reset 500 ms.
8. **Efek lambat saat mati:** selama fase `defeat` sebelum layar akhir, SFX baru diputar dengan playbackRate 0.7 dan master lowpass aktif. Musik tidak diperlambat, hanya difilter.
9. **Event UI** (fokus, klik, slider) datang dari UI lewat `AudioSystem.playUi(cueId)`, bukan dari sim.

---

## 11. Uji dan kriteria review

| Uji | Cara | Lolos bila | Pelaksana, mulai |
|---|---|---|---|
| A-1 Telinga 10 menit | Putar arena paling ramai 10 menit nonstop | Tidak melelahkan atau menusuk (style guide 3.3) | AU dan QA, M1 (placeholder), M4 (final) |
| A-2 Mata tertutup | Penguji mendengar acak 10 pemicu: kena hit, level up, Memento, telegraf | Minimal 9 dari 10 benar (P2-g) | CD, M2 |
| A-3 Bahaya di tengah kekacauan | Rekam detik paling ramai, minta penguji menekan tombol saat mendengar telegraf | Semua telegraf terdeteksi | QA, M2 |
| A-4 Loop | Biarkan tiap lagu berputar 3 loop | Tanpa celah, klik, atau lonjakan level di batas loop | AU, M2 |
| A-5 Validator data | `node tools/audio/validate.ts` pada semua JSON audio | Tiap birama 16 step, akor dikenal, instrumen dikenal, jumlah birama sama dengan jumlah akor | AU, M1 (masuk CI bila LP setuju) |
| A-6 Orisinalitas | CD dan AU mendengar semua motif dan melodi | Tidak mirip melodi yang dikenal | CD, M2 dan M3 |
| A-7 Anggaran | Ukur ukuran bundle audio, memori buffer, waktu render boot, beban CPU | Sesuai tabel 2.2 | LP, M1 dan M4 |
| A-8 Determinisme | Jalankan sim yang sama dengan audio aktif dan mati | Hash state akhir identik | LP dan QA, M1 |

---

## 12. Rencana per milestone

| Milestone | Pekerjaan audio |
|---|---|
| M1 | SELESAI (M1-06): engine (bus, buffer SFX, prioritas, ducking, panning), 87 cue placeholder, validator, preview WAV, sequencer dengan `mus.biome1.pulse` L0 sampai L3 dan `mus.shop`. Lihat bagian 13 |
| M2 | Musik bioma 1 penuh (Pulse 4 lapis, toko, boss, overlay, stinger), seluruh SFX Tingkat A final, uji A-1 sampai A-6 |
| M3 | SFX Tingkat B (kelas tambahan, Unlit tambahan, Warden kedua, ambience), musik bioma 2 dan 3 bila Tingkat C dikejar |
| M4 | Mix akhir, loudness, opsi volume, uji telinga ulang, cek anggaran |
| M5 | Cek kredit: semua audio buatan tim, tercatat di `docs/credits.md` |

---

## 13. Implementasi M1 (M1-06)

### 13.1 Peta file

| File | Isi |
|---|---|
| `src/audio/index.ts` | `createAudio(data)` sesuai kontrak `CreateAudio`, mengimpor data JSON |
| `src/audio/audio-system.ts` | Orkestrasi: unlock, update per frame, pengaturan, jeda, tab tersembunyi, efek mati |
| `src/audio/engine.ts` | Graf Web Audio 8.1, pemutaran SFX dengan voice pool, cache cue `live` |
| `src/audio/music-player.ts` | Sequencer lookahead dan sampler instrumen |
| `src/audio/music-director.ts` | Lagu per fase, level intensitas, riser (murni) |
| `src/audio/event-map.ts`, `triggers.ts` | Event sim ke trigger cue, penggabungan per frame (murni) |
| `src/audio/voices.ts`, `ducking.ts`, `mix-math.ts`, `cue-data.ts` | Voice limit, ducking, rumus mix, parser data (murni) |
| `src/audio/synth/` | DSP murni: osilator PolyBLEP, noise, biquad RBJ, Karplus-Strong, FM, IR, mixdown |
| `src/audio/music/song.ts` | Validasi dan kompilasi lagu, not per birama (murni) |
| `src/audio/cues/cues.json`, `routes.json` | Resep 87 cue dan pemetaan event |
| `src/audio/music/*.json` | Instrumen dan lagu `mus.biome1.pulse`, `mus.shop` |

### 13.2 Keputusan implementasi
1. **Resep cue adalah data.** Setiap cue punya `layers` (tone, noise, grains, pluck dengan envelope, filter, glide, FM, repeat) yang dirender DSP murni yang sama di browser dan Node. AU menyetel suara tanpa mengubah kode.
2. **Instrumen musik memakai sampler, bukan node Web Audio per not** (mengubah keputusan bagian 3). Tiap instrumen dirender sekali per nada referensi (satu per oktaf, geser pitch maksimal 6 semitone), lalu sequencer memutar buffer dengan envelope release. Alasan: satu jalur DSP untuk game dan preview WAV, CPU per not sangat murah, data tetap kecil. Kekurangan: filter tidak bereaksi per not; diterima untuk M1, dievaluasi di M2.
3. **Sample rate per cue.** SFX default 24 kHz, cue panjang tanpa isi di atas 8 kHz dan cue `live` 16 kHz, instrumen 8 sampai 32 kHz. Browser me-resample saat putar. Ekor di bawah -66 dB dipotong.
4. **Penggabungan per frame.** Event dengan cue sama di satu frame menjadi satu putaran dengan tambahan +1 dB per penggandaan (8.4); `minIntervalMs` menangani antar frame.
5. **Cue `live` dipanaskan saat boot** untuk durasi telegraf yang ada di data (`liveWarmupPairs`), agar telegraf pertama tidak memicu render di thread utama.
6. **Lapisan intensitas berganti di batas birama tanpa fade 1 ketukan** (6.3). Fade lapisan masuk M2.
7. **Pulse boss memakai loop Pulse di level maksimal** sampai `mus.biome1.boss` dibuat di M2.
8. **`sfx.player.lowhp` memakai derit kaca berdetak pelan** (saran opsional CD), bukan detak jantung: dua ketuk rendah 60 dan 50 Hz plus bisikan kaca 4.5 kHz, di luar pita bahaya, diulang tiap 1 detik selama HP rendah dan fase `pulse`.

### 13.3 Anggaran terukur (Node 24 dan Chromium headless, mesin pengembangan)

| Hal | Anggaran | Terukur |
|---|---|---|
| Data JSON audio gzip | di bawah 15 KB | 7.8 KB |
| Memori buffer (SFX, instrumen, IR) | di bawah 8 MB | sekitar 7.7 MB, ditambah sekitar 0.5 MB cache telegraf |
| Render boot | di bawah 300 ms, bertahap | sekitar 280 ms di Node; `unlock()` sekitar 450 ms di Chromium headless (bertahap, UI tidak beku) |
| CPU `update` per frame | di bawah 1 ms | median 0.1 ms; frame `PulseStarted` sekitar 1.7 ms (sekali per Pulse) |

### 13.4 Belum ada (masuk M2)
Lagu boss, judul, akhir, overlay Unlit, fade lapisan, uji A-1 sampai A-6 dengan telinga, cue Tingkat B lain (`hit_heavy`, exploder, summoner, ambience), `sfx.pulse.tick` opsional. Status M2: bagian 14.

---

## 14. Implementasi M2 (M2-04)

### 14.1 Musik bioma 1 lengkap
| Lagu | Isi | Panjang loop |
|---|---|---|
| `mus.title` | D dorian 84 BPM, A dan B. Motif Cahaya di lonceng (A), melodi B Pulse di pluck dengan dobel lonceng (B), arpeggio pluck | 16 birama, 45.7 s |
| `mus.biome1.pulse` | D dorian 116 BPM, 11 lapisan, 4 level. Baru: motif lonceng L0 sampai L2 (kepala Motif Cahaya), kontramelodi `chip_lead` hanya L2, pola drum, bass, brass, arpeggio berganti per birama dengan fill di birama 4 dan 8 tiap bagian | 16 birama, 33.1 s |
| `mus.overlay.unlit` | Drone, Motif Rembes 2 varian, cluster kaca, di jam tuan rumah | siklus 8 birama |
| `mus.shop` | F lydian 76 BPM, A dan B baru. Bagian B dibuka kutipan Motif Glazier (E6 B5) dan pluck gema; tanpa perkusi | 16 birama, 50.5 s |
| `mus.biome1.boss` | D phrygian 132 BPM, 5 level (L0 intro sampai L4 mengamuk). Lead A dobel choir, jawaban `chip_lead` di B (tanya jawab) | 16 birama, 29.1 s |
| `mus.end` | D dorian 72 BPM, pad, bass, pluck lambat, lonceng tiap 4 birama | 16 birama, 53.3 s |
| 8 stinger | `pulse_start`, `pulse_end`, `warden`, `boss_intro`, `boss_phase`, `boss_defeated`, `victory`, `defeat` | sekali main |

Keputusan AU [Wajib]:
1. **Stinger adalah lagu sekali main** (`"oneShot": true`), bukan buffer. Alasan: memakai instrumen yang sama dengan loop (warna konsisten) dan menghemat sekitar 1.1 MB memori. Cue lama `mus.stinger.*` di `cues.json` ditandai `deprecated` (id stabil). Pemetaan event ke stinger ada di `routes.json` `stingers`.
2. **Variasi frasa:** `rhythm`, `lanes`, dan `tokens` boleh berupa daftar pola yang bergilir per birama loop; `sections` membatasi lapisan ke bagian tertentu. Tidak ada lapisan yang hanya mengulang satu birama.
3. **Fade lapisan di batas birama:** satu GainNode per lapisan. Naik level: fade in 1 ketukan dari downbeat. Turun level: fade out 2 ketukan, dan lapisan yang keluar hanya membawa not di 2 ketukan pertama.
4. **`gainDb` tingkat lagu** untuk gain staging (Pulse dan boss minus 5 dB): puncak L3 preview sekitar minus 12 dBFS dengan hall, sesuai 8.2.
5. **Riser** diperkaya: kuint A3 ke A4 dan gulungan snare yang dipercepat ke akhir; tetap berhenti tegas.
6. Instrumen baru: `choir`, `brass_low`, `unlit_drone`, `chip_lead`, `shimmer`. Instrumen sustain (`string_pad`, `sub_bass`, `brass`, `choir`, `brass_low`, `unlit_drone`, `chip_lead`) memakai **loop sampel** dengan crossfade equal-power (field `loop` di `instruments.json`); playback memakai `AudioBufferSourceNode.loop`.

### 14.2 SFX final slice
| Hal | Perubahan |
|---|---|
| Dampak (event GP M2-05) | `RiteLanded` memicu `sfx.rite.impact.lantern` di posisi mendarat (jeda tebakan 350 ms dihapus). Bit impact `EnemyDamaged` berat atau remuk memakai `sfx.weapon.hit_heavy`. `AffixTriggered`: cangkang pecah, cangkang tumbuh, blink. `EnemyExploded`: `sfx.enemy.exploder.blast`. Diam: `HitStop`, `EnemyKnockedBack`, `EnemyDissolved` (sudah di `sfx.pulse.end_flash`), `BossPatternStarted` (telegraf sudah bersuara), `GlintPulled` |
| Paper Sun per pola | `routes.telegraphs.bossPatternById`: `ember_rain_8` badai bara (windup 3 saw tritone, 5 dentum), `snuff_ring_double` windup minus 2 semitone dan dua gelombang, `moth_call` kepak ngengat tritone. Pola lain lewat arketipe |
| Affix Warden | `volley` dan `hasted` (A) tetap; disiapkan `blinking` (`sfx.telegraph.blink`), `brood` (`sfx.enemy.summon`), `veiled` (cangkang) |
| Polesan terukur | `sfx.weapon.hit` dan `hit_crit` (thud plus tik 4.8 kHz di atas pita bahaya), kematian Unlit dengan butir motes gelap, ledakan Rite dengan sub dan pecahan kaca (suara pemain terbesar). `fire.chain` dan `fire.arc` dikeluarkan dari pita 1 sampai 3 kHz; `warden.charge.windup` dan `moth_call` dimasukkan ke pita bahaya. Diuji otomatis: serangan dan hit pemain di bawah 25% energi pita bahaya, windup bahaya Tingkat A di atas 30% |

### 14.3 Perbaikan temuan LP M1
| Temuan | Perbaikan | Bukti |
|---|---|---|
| `boot()` tidak cek `disposed` | Cek setelah `resume()` dan setelah tiap job render; context ditutup | Tes fake AudioContext |
| Detak HP rendah saat jeda | Tidak berbunyi saat `setPaused(true)`; lanjut 1 periode setelah jeda ditutup | Tes |
| 5 `setTargetAtTime` tiap frame | Gain duck hanya disentuh saat nilainya berubah lebih dari 0.05 dB | Tes: 0 panggilan saat diam |
| Alokasi kecil tiap frame | `PlayRequest` dipakai ulang, `NoteBuffer` menyimpan objek not, `stopCue` tanpa array literal dan sekali per Warden, tanpa closure sort | Tes: pool not stabil setelah satu loop |
| Render live di thread utama, cache dikosongkan penuh | Cache LRU (buang satu per satu); miss diputar dari durasi terdekat yang ujungnya disejajarkan ke saat kena, render baru di Worker | Kode dan tes engine lewat sistem |
| `pressure.enemiesAlive` | Dihapus; `"pressure": { "source": "MusicPressureChanged", "add": 1, "holdBars": 2 }`, latch tahan 2 birama | Tes validator dan latch |

### 14.4 Kinerja dan anggaran (terukur, `node tools/audio/render-cues.ts`)
| Hal | Anggaran | Terukur |
|---|---|---|
| Memori buffer | di bawah 8 MB | 7.05 MB (SFX 3.16, warmup telegraf 0.45, instrumen 2.33, IR 1.11) |
| Render boot | tidak membekukan frame | Web Worker (chunk 4.6 KB gzip); 298 ms total di Node. Cadangan tanpa Worker: thread utama per job dengan jeda MessageChannel, job terpanjang 24.5 ms |
| Data JSON audio gzip | di bawah 15 KB | 11.1 KB |
| Chromium headless | | Worker dibuat, tanpa error; tidak ada long task baru saat unlock di atas biaya frame render headless |

### 14.5 Preview dan uji
- `node tools/audio/render-cues.ts [filter] [--dry]`: SFX ke `audio/preview/sfx/`, musik ke `audio/preview/music/` (tiap level, timeline Pulse 4 dengan fade dan riser, timeline tekanan, overlay Warden, timeline boss dengan jeda fase), stinger ke `audio/preview/stingers/`. Musik memakai hall reverb offline (konvolusi FFT dengan `ir.hall`).
- `npm run audio:check` memvalidasi juga bahwa stinger di `routes.json` menunjuk file lagu.
- Sambungan loop instrumen diuji otomatis (lompatan sampel maksimal di bawah 1.6 kali persentil 99.9).
- Belum bisa: uji telinga A-1, A-2, A-3, A-6 butuh pendengar manusia.
