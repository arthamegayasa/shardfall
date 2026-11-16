# Shardfall: Daftar Cue Audio

Pemilik: Audio Director (AU). Status: versi 1.1 (2026-11-17), perbaikan review M0 dan status implementasi M1-06 (bagian 12). Reviewer: CD (rasa), LP (teknis).
Pasangan: `docs/audio-direction.md` (palet, instrumen, mix, struktur musik, format data).
Selaras dengan: `docs/gdd.md` (isi Tingkat A, senjata, Unlit, Warden, boss, toko) dan `docs/tech/architecture.md` 6.5 (`SimEventType`).

---

## 1. Konvensi

### 1.1 Id cue [Wajib]
- Format: `<domain>.<subjek>.<aksi>[.<varian>]`, huruf kecil, `snake_case` di tiap segmen.
- Domain: `sfx` (suara dunia dari sim, sfx bus), `ui` (antarmuka, ui bus), `mus` (musik dan stinger, music bus), `amb` (ambience, sfx bus slot khusus).
- **Id stabil.** Setelah dipakai di kode atau data, id tidak diganti nama. Cue yang tidak dipakai lagi ditandai `deprecated` di `src/audio/cues/cues.json`, bukan dihapus diam-diam.
- Kode dan data merujuk cue hanya lewat id, tidak lewat nama file atau resep.
- Id konten (senjata, Unlit, Warden, boss, kelas) memakai id kerja GDD (`lantern_bolt`, `warden_hound`, `boss_lantern`), bukan nama tampil, agar tidak berubah saat Writer mengganti nama.

### 1.2 Kolom tabel

| Kolom | Arti |
|---|---|
| Tk | Tingkat konten (vision.md 7.2, gdd.md 2): **A** wajib lantai rilis, **B** target, **C** plafon |
| Pemicu | Event dari `SimEventType` (architecture.md 6.5) atau dari UI, beserta syaratnya |
| P | Prioritas 1 (tertinggi) sampai 6, U = bus ui (audio-direction 8.3) |
| Durasi | Perkiraan panjang suara. "telegraf" berarti mengikuti durasi telegraf dari sim |
| Poli | `maxVoices` / `minIntervalMs` |
| dB | Puncak target dBFS (`gainDb`) dengan fader 100%, referensi `sfx.player.hit` = -6 |
| Sintesis | Resep singkat. Detail parameter disetel di M1 dan M2 |

### 1.3 Event dan field yang dibutuhkan audio
Payload final: `x`, `y`, `a`, `b`, `c` (architecture.md 6.5). `c` biasanya SourceRef (`encodeSource(kind, index)`). Pemetaan ke cue: `src/audio/cues/routes.json` (data) dan `src/audio/event-map.ts` (logika). Tes memeriksa setiap `SimEventType` dirutekan atau dinyatakan diam.

| Event | Yang dipakai audio | Cue |
|---|---|---|
| `PhaseChanged` | `a` fase baru | masuk `shop`: `ui.glazier.arrive`. Musik dari `WorldView.phase` |
| `PulseStarted`, `PulseEnded` | (musik dari `WorldView.pulse`) | `sfx.pulse.start_wave` + `mus.stinger.pulse_start`; `sfx.pulse.end_flash` + `mus.stinger.pulse_end` |
| `RunEnded` | `a` `RunOutcome` | `mus.stinger.victory` atau `mus.stinger.defeat` |
| `PlayerDamaged` | | `sfx.player.hit`, ducking `player_hit` |
| `PlayerHealed`, `DamageBlocked`, `PlayerDied` | | `sfx.player.heal`, `sfx.player.block`, `sfx.player.death` (efek lambat) |
| `PlayerHpLowChanged` | `a` 1 masuk, 0 keluar | `sfx.player.lowhp` berulang tiap 1 s selama fase `pulse` |
| `WeaponFired` | `a` `WeaponIndex` | `routes.weapons.fireById`, cadangan `fireByArchetype` |
| `RiteCast`, `RiteReady`, `RiteRejected` | `a` `RiteIndex`, `x` titik bidik | per `archetype` Rite; `sfx.rite.ready` (diam 1.5 s setelah `PulseStarted`); `ui.rite.denied` |
| `PlayerLeveledUp`, `MementoAcquired` | | `sfx.levelup`, `sfx.memento.gain` |
| `SynergyActivated` | `b` ambang 2, 4, 6 | `sfx.synergy.activate` digeser 0, +5, +12 semitone |
| `BuffMaxed` | | `sfx.proc.rush_full` (Rush penuh, Edge 6) |
| `EnemyDamaged` | `b` bit 0 kritikal, bit 2-3 rank, bit 4-6 `HitKind`; `c` sumber | rank Warden `sfx.warden.hurt`, boss `sfx.boss.hurt`, kritikal `sfx.weapon.hit_crit`, senjata dengan dampak sendiri dan `HitKind` bukan proyektil `routes.weapons.impactByArchetype`, lainnya `sfx.weapon.hit`. Diam untuk `Dot`, `Zone`, sumber `Status` dan `Rite` |
| `EnemyKilled` | `a` `EnemyTypeIndex`, `b` rank | rank normal: `routes.enemies.deathById`, cadangan `deathBySize` (`sizeClass`). Warden dan boss lewat event masing-masing |
| `EnemyProjectileFired` | `c` sumber | `sfx.enemy.shooter.fire`; diam bila sumber `Affix` (suara volley dari `TelegraphResolved`) |
| `TelegraphStarted`, `TelegraphResolved` | `a` `TelegraphKind`, `b` durasi tick, `c` sumber | `BossPattern`: per `archetype` pola; `Affix`: per id affix; terjang `EnemyAttack` milik musuh peran `warden`: cue Warden (naik 2 semitone per terjang beruntun); lainnya per `TelegraphKind`. Durasi `b / 60` s untuk cue `live`. Telegraf memicu ducking `telegraph` |
| `WardenSpawned`, `WardenKilled` | | `sfx.warden.arrive` + `mus.stinger.warden`; `sfx.warden.death` |
| `BossSpawned`, `BossPhaseChanged`, `BossEnraged`, `BossSummoned`, `BossKilled` | | `sfx.boss.intro`, `sfx.boss.phase`, `sfx.boss.enrage`, `sfx.boss.summon`, `sfx.boss.death` |
| `AffixApplied` | `a` `AffixIndex` | `hasted`: `sfx.warden.hasted` |
| `SpawnMarked` | | `sfx.enemy.spawn` (retakan spawn) |
| `GlintCollected` | `b` panjang rentetan | `sfx.glint.pickup`, nada dari `glintLadder` lagu aktif; bila `b` 0, penghitung audio dengan reset 500 ms |
| `GlintSwept`, `MementoOfferSpawned` | | `sfx.glint.sweep`, `sfx.reward.drop` |
| `ProcTriggered` | `a` `EffectIndex` | `routes.procs.byOwner` (`owner` efek, misalnya `syn_flame_4`), cadangan `byAction` |
| `LevelUpCardsShown`, `LevelUpCardChosen`, `RewardShown` | | `ui.card.reveal`, `ui.card.pick`, `ui.reward.reveal` |
| `ItemBought`, `ItemSold`, `ShopRerolled` | | `ui.shop.buy`, `ui.shop.sell`, `ui.shop.reroll` |
| `ItemMerged` | `b` tier baru | `ui.shop.merge` (Fuse) digeser 0, +7, +12 semitone untuk tier II, III, IV |
| `ItemLocked` | `b` 1 kunci, 0 buka | `ui.shop.lock`, buka kunci -4 semitone |
| `CommandRejected` | `a` `RejectReason` | `ui.denied`, kecuali `WrongPhase`, `UnknownId`, `DebugDisabled` |
| `PlayerDodged`, `BarrierGained`, `EnemySpawned`, `GlintDropped`, `RewardChosen` | | Sengaja diam (dinyatakan di `routes.silent`) |

---

## 2. Format data SFX (`src/audio/cues/cues.json`) [Wajib]

File berisi `{ "cues": [ ... ] }`. Resep sintesis adalah data (`layers`), dirender DSP murni `src/audio/synth/` saat boot dan oleh `tools/audio/render-cues.ts` untuk preview.

```json
{
  "id": "sfx.weapon.fire.bolt",
  "tier": "A",
  "bus": "sfx",
  "priority": 6,
  "mode": "buffer",
  "sampleRate": 24000,
  "gainDb": -24,
  "durationMs": 60,
  "attackMs": 2,
  "maxVoices": 4,
  "minIntervalMs": 40,
  "pitchJitter": 0.06,
  "gainJitterDb": 2,
  "lowpassHz": 7000,
  "send": { "room": 0 },
  "pan": "worldX",
  "coalesce": { "windowMs": 30, "maxBoostDb": 3 },
  "ladder": null,
  "duck": null,
  "layers": [
    { "kind": "tone", "wave": "sine", "freq": 520, "freqEnd": 380, "glideMs": 40, "decayMs": 50 },
    { "kind": "noise", "durMs": 10, "decayMs": 10, "gainDb": -18, "filter": { "type": "hp", "freq": 5000 } }
  ]
}
```

- `mode`: `buffer` (dirender dari DSP murni saat boot, default) atau `live` (dirender saat dipicu dengan durasi dari payload, di-cache per 50 ms).
- `pan`: `center`, `worldX` (mengikuti posisi x dunia relatif arena), atau angka tetap.
- `ladder`: `{ "source": "song", "resetMs": 500 }` memakai `glintLadder` lagu aktif.
- `duck`: id aturan ducking di audio-direction 8.5 (`player_hit`, `telegraph`, `reward`, `big_moment`).
- `delayMs`: jeda dari event ke bunyi (misalnya ledakan lentera Rite yang mendarat 0.35 s setelah dilempar).
- `sampleRate`: sample rate buffer (default 24000; cue panjang dan `live` 16000 demi anggaran memori).
- `layers`: resep. Jenis `tone` (gelombang `sine`, `triangle`, `saw`, `square`, `pulse12`, `pulse25`; `freq` Hz atau nama nada, `freqEnd`, `glideMs`, `detuneCents`, `tremoloHz`, `vibratoHz`, `fm`), `noise` (`white` atau `pink`), `grains` (butir kaca atau derak acak), `pluck` (Karplus-Strong). Semua jenis: `startMs`, `durMs`, `attackMs`, `env` (`decay`, `flat`, `swell`), `decayMs`, `releaseMs`, `gainDb`, `filter` (`lp`, `hp`, `bp` dengan sapuan `freqEnd`), `repeat` (pengulangan dengan langkah pitch dan gain). `gainDb` cue adalah puncak akhir buffer setelah normalisasi.
- `loop` dan `params` dari draf M0 tidak dipakai. Suara berulang (`sfx.player.lowhp`) diulang engine.

### 2.1 Pemetaan event (`src/audio/cues/routes.json`)
Tabel `simple` (event ke daftar cue), `silent` (event yang sengaja diam), dan tabel per domain: `weapons`, `enemies`, `rites`, `procs`, `telegraphs`, `affixApplied`, `enemyShots`, `glint`, `synergy`, `merge`, `lock`, `rejected`, `phaseEnter`, `runEnded`. Nilai `null` berarti sengaja tanpa suara. `node tools/audio/validate.ts` dan tes unit menolak id cue yang tidak ada dan event yang tidak dirutekan.

---

## 3. SFX pemain dan Rite

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `sfx.player.hit` | A | `PlayerDamaged` | 1 | 250 ms | 1 / 120 | -6 | Retak kaca kering: burst noise highpass 2 kHz 40 ms, sine 900 ke 280 Hz dalam 120 ms, thump sine 80 Hz 90 ms. Tengah, pitch jitter 0.02. Ducking `player_hit` |
| `sfx.player.hit_heavy` | B | `PlayerDamaged` dengan damage minimal 25% HP maks | 1 | 350 ms | 1 / 120 | -5 | Varian `player.hit` satu kuart lebih rendah, retak 80 ms lebih panjang. Menggantikan `player.hit`, bukan ditumpuk |
| `sfx.player.lowhp` | A | `PlayerHpLowChanged` rendah, diulang engine tiap 1.0 s sampai tidak rendah atau fase bukan `pulse` | 3 | 300 ms per ketuk | 1 / 500 | -24 | Derit kaca berdetak pelan (saran CD, bukan detak jantung): dua ketuk sine 60 Hz lalu 50 Hz, ditambah bisikan kaca bandpass 4.5 kHz. Sengaja di luar pita bahaya |
| `sfx.player.death` | A | `PlayerDied` | 1 | 1.8 s | 1 / - | -6 | Kaca pecah besar: burst noise lebar, 12 butir sine acak 2 sampai 6 kHz berdenting jatuh (peluruhan 0.3 sampai 0.9 s), sweep turun. Ducking `big_moment`, master lowpass efek lambat |
| `sfx.player.heal` | A bila ada Memento heal di build A, selain itu B (pasif `blade`) | `PlayerHealed` (coalesce 200 ms) | 4 | 300 ms | 1 / 200 | -18 | Dua sine lembut naik A5 ke D6 dengan shimmer tipis |
| `sfx.player.block` | B | `DamageBlocked` (Barrier dari Ward) | 3 | 180 ms | 2 / 80 | -14 | "Ting" kaca tumpul: sine 1.2 kHz ditambah noise pendek bandpass 4 kHz, room kecil |
| `sfx.rite.ready` | A | `RiteReady`, kecuali dalam 1.5 s setelah `PulseStarted` (Rite selalu siap di awal Pulse, gdd 7.1, jadi tidak perlu ditandai) | 3 | 300 ms | 1 / - | -14 | `glass_bell` kecil D6 dan A6 bersamaan, tengah |
| `sfx.rite.cast.lantern` | A | `RiteCast` Rite `flare_lantern` | 3 | 400 ms | 1 / - | -12 | Lemparan: whoosh noise bandpass naik 400 Hz ke 2 kHz, denting `glass_bell` A5 kecil (lentera berayun) |
| `sfx.rite.impact.lantern` | A | `RiteCast` `flare_lantern`, `delayMs` 350 (lentera mendarat) | 3 | 700 ms | 1 / - | -10 | Ledakan hangat: noise lowpass 2.5 kHz menyapu turun, thump sine 70 Hz, `glass_bell` D5 dan A5 pecah. Tanpa tritone (milik pemain) |
| `sfx.rite.zone.lantern` | B | Zona api `flare_lantern` aktif 4 s | 5 | loop 4 s | 1 / - | -26 | Derak api lembut: klik noise lowpass 3 kHz acak 6 per detik, dengung noise lowpass 300 Hz. `mode: live` |
| `sfx.rite.cast.bell` | B | `RiteCast` `great_toll` | 3 | 900 ms | 1 / - | -10 | Dentang `glass_bell` rendah D3 dan A3 dengan sapuan noise melebar |
| `sfx.rite.cast.blade` | B | `RiteCast` `glass_step` | 3 | 250 ms | 1 / - | -12 | Sabetan kaca cepat: noise bandpass 600 Hz ke 5 kHz dalam 150 ms, butir kaca tinggi |
| `ui.rite.denied` | A | `RiteRejected` (tombol Rite ditekan saat cooldown) | U | 90 ms | 1 / 150 | -22 | Klik tumpul triangle 220 Hz 60 ms. Bukan suara bahaya |

---

## 4. SFX serangan pemain (berulang, aturan audio-direction 9.2)

Semua cue di bagian ini: `pitchJitter` 0.06, `gainJitterDb` 2, `send.room` 0, lowpass 6 sampai 8 kHz, attack minimal 2 ms, pan `center` untuk tembakan dari pemain dan `worldX` untuk dampak. Pita utama 250 sampai 800 Hz.

### 4.1 Pemetaan senjata GDD ke cue
CSV GD tidak memuat kolom audio (keputusan LP). Pemetaan di `routes.json`: `weapons.fireById` (cue dan `semis` opsional), cadangan `weapons.fireByArchetype` per kolom `archetype`. Dampak sendiri per arketipe di `weapons.impactByArchetype` (`bolt_explode` ledakan, `orbit` kontak).

| Senjata (gdd 6.1) | Tk | Cue tembak | `semis` | Catatan |
|---|---|---|---|---|
| `lantern_bolt` | A | `sfx.weapon.fire.lob` | 0 | Ledakan saat tumbukan memakai `sfx.weapon.impact.burst` |
| `splinter_shot` | A | `sfx.weapon.fire.bolt` | +3 | Paling sering berbunyi (CD 0.7 s), dijaga paling pelan |
| `arc_blade` | A | `sfx.weapon.fire.arc` | 0 | |
| `orbit_shards` | A | (tanpa suara tembak) | | Hanya `sfx.weapon.orbit.contact` saat kontak |
| `chain_spark` | A | `sfx.weapon.fire.chain` | 0 | |
| `returning_glaive` | A | `sfx.weapon.fire.glaive` | 0 | Tanpa suara saat kembali, agar tidak dobel |
| `echo_bell` | B | `sfx.weapon.fire.ring` | 0 | |
| `tithe_coin` | B | `sfx.weapon.fire.bolt` | +7 | Ditambah `params.coin` (denting tipis 4.5 kHz) |

### 4.2 Cue

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `sfx.weapon.fire.bolt` | A | `WeaponFired` senjata arketipe `projectile` atau `coin` | 6 | 60 ms | 4 / 40 | -25 | "Thup" kaca: sine 520 ke 380 Hz dalam 40 ms, noise highpass 5 kHz sangat tipis 10 ms |
| `sfx.weapon.fire.lob` | A | `WeaponFired` | 6 | 80 ms | 3 / 60 | -24 | "Fup" hangat: noise lowpass 900 Hz attack 5 ms, sine 260 ke 200 Hz |
| `sfx.weapon.impact.burst` | A | `EnemyDamaged` dengan `c` senjata arketipe `bolt_explode` dan `HitKind` bukan proyektil (coalesce 40 ms) | 6 | 80 ms | 3 / 60 | -23 | "Fwump": noise lowpass 1.2 kHz attack 4 ms, sine 140 Hz 60 ms |
| `sfx.weapon.fire.arc` | A | `WeaponFired` | 6 | 75 ms | 4 / 50 | -24 | Whoosh noise bandpass menyapu 400 ke 900 Hz dalam 70 ms, Q 1.2 |
| `sfx.weapon.orbit.contact` | A | `EnemyDamaged` dengan `c` senjata arketipe `orbit` | 6 | 50 ms | 3 / 80 | -27 | Tick lembut triangle 600 Hz 30 ms |
| `sfx.weapon.fire.chain` | A | `WeaponFired` | 6 | 80 ms | 3 / 60 | -24 | Derak pendek: 3 klik noise bandpass 700 Hz berjarak 15 ms (satu per lompatan), lowpass 6 kHz. Bukan zap tajam |
| `sfx.weapon.fire.glaive` | A | `WeaponFired` | 6 | 80 ms | 3 / 60 | -24 | Desing berputar: sine 450 Hz dengan tremolo 30 Hz, noise bandpass 1 kHz tipis |
| `sfx.weapon.fire.ring` | B | `WeaponFired` | 6 | 80 ms | 3 / 60 | -24 | Sine 330 dan 495 Hz 50 ms dengan pengulangan pendek 30 ms (slapback) pada minus 8 dB |
| `sfx.weapon.hit` | A | `EnemyDamaged` tidak kritikal, sumber senjata proyektil atau sabetan | 6 | 50 ms | 3 / 50 | -27 | Thud lembut: noise lowpass 900 Hz 30 ms, sine 180 Hz 40 ms. Coalesce 30 ms |
| `sfx.weapon.hit_crit` | A | `EnemyDamaged` kritikal | 5 | 80 ms | 2 / 80 | -22 | `weapon.hit` ditambah denting sine 4.5 kHz 40 ms (di atas pita bahaya) |

Status Burn, Slow, dan Mark sengaja tanpa suara per tick (terlalu sering). Hanya visual.

### 4.3 Proc sinergi (Pilar 1, P1-e: sinergi terlihat atau terdengar)

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `sfx.proc.flame_burst` | A | `ProcTriggered` efek milik `syn_flame_4` (Unlit terbakar mati meledak) | 5 | 120 ms | 3 / 60 | -21 | Pop api: noise lowpass 1.8 kHz, sine 120 Hz, derak tipis. Coalesce 40 ms |
| `sfx.proc.flame_nova` | A | `ProcTriggered` efek milik `syn_flame_6` (tiap 6 s) | 3 | 600 ms | 1 / - | -14 | Hembusan melingkar: noise lowpass menyapu 300 Hz ke 3 kHz lalu turun, thump lembut |
| `sfx.proc.shard_split` | A | `ProcTriggered` efek milik `syn_shard_2`, `syn_shard_4`, cadangan aksi `spawn_projectile` | 6 | 50 ms | 3 / 60 | -27 | Butir kaca kecil: sine 5 kHz 20 ms, sangat pelan |
| `sfx.proc.glass_lance` | A | `ProcTriggered` efek milik `syn_shard_6` (tiap 2 s) | 3 | 300 ms | 1 / - | -15 | Tusukan kaca: sine 700 Hz naik ke 1 kHz dengan FM ringan, noise highpass 6 kHz |
| `sfx.proc.edge_wave` | A | `ProcTriggered` efek milik `syn_edge_4` | 5 | 100 ms | 3 / 80 | -22 | Whoosh tajam pendek: noise bandpass 500 ke 1.2 kHz |
| `sfx.proc.rush_full` | A | `BuffMaxed` (Rush 10 tumpukan, Edge 6) | 3 | 500 ms | 1 / 2000 | -15 | Kilau emas: `shimmer` ditambah `glass_bell` A6 |
| `sfx.proc.echo_repeat` | B | `ProcTriggered` pengulangan Echo | 6 | sama dengan cue asal | 2 / 100 | asal -6 | Cue asal diputar ulang lewat lowpass 2.5 kHz (rasa gema) |
| `sfx.proc.barrier_up` | B | `ProcTriggered` Barrier terisi (Ward) | 4 | 300 ms | 1 / - | -18 | Dengung kaca naik sine 400 ke 800 Hz |
| `sfx.proc.interest` | B | `ProcTriggered` bunga Trade di awal toko | U | 400 ms | 1 / - | -18 | Tangga Glint naik 4 nada |

---

## 5. SFX the Unlit dan bahaya

Semua telegraf: pita 1 sampai 3 kHz, bentuk naik, tritone atau noise, `send.room` 0.2, pan `worldX`. Telegraf memicu ducking `telegraph` (sfx prioritas 5 sampai 6, minus 4 dB). Durasi telegraf dari gdd 14.1: proyektil 0.4 s, terjang 0.6 s, area 0.8 s, serangan besar boss 1.0 s.

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `sfx.enemy.spawn` | A | `SpawnMarked` (tanda retak spawn muncul 0.8 s sebelum Unlit keluar, gdd 3.2), coalesce 150 ms | 5 | 250 ms | 2 / 150 | -26 | "Rembes": noise bandpass 400 naik ke 700 Hz dengan swell, tanpa transien. Bukan suara bahaya (tanda spawn tidak memberi damage) |
| `sfx.enemy.death.small` | A | `EnemyKilled` swarmer, mote | 5 | 120 ms | 4 / 40 | -21 | Motes gelap: pop noise lowpass 1.5 kHz 30 ms, sine 220 ke 110 Hz 80 ms. Coalesce 30 ms, maxBoost 3 dB |
| `sfx.enemy.death.medium` | A | `EnemyKilled` charger, shooter, exploder, summoner, lobber | 5 | 180 ms | 3 / 50 | -20 | Seperti small, satu kuart lebih rendah, ditambah crunch noise bandpass 800 Hz 50 ms |
| `sfx.enemy.death.large` | A | `EnemyKilled` tank | 4 | 300 ms | 2 / 80 | -17 | Thump sine 70 Hz, crunch lebih panjang, sedikit room |
| `sfx.enemy.charger.windup` | A | `TelegraphStarted` jenis terjang (charger, `warden_hound`) | 2 | telegraf (0.6 s) | 3 / 100 | -12 | Square 700 Hz naik ke 1.6 kHz sepanjang telegraf lewat bandpass 1.5 kHz, tremolo 18 Hz. `mode: live` |
| `sfx.enemy.charger.dash` | A | `TelegraphResolved` jenis terjang | 4 | 200 ms | 3 / 80 | -16 | Whoosh noise bandpass 500 ke 1.5 kHz cepat |
| `sfx.enemy.shooter.windup` | A | `TelegraphStarted` jenis proyektil | 2 | telegraf (0.4 s) | 3 / 120 | -13 | "Tarik napas": dua sine bertritone 1.25 kHz dan 1.77 kHz, pitch naik 4 semitone, noise tipis. `mode: live` |
| `sfx.enemy.shooter.fire` | A | `EnemyProjectileFired` | 2 | 100 ms | 4 / 60 | -13 | Chirp naik square 1.0 ke 1.8 kHz dalam 80 ms lewat bandpass 1.4 kHz |
| `sfx.enemy.tank.step` | B (opsional) | Tank bergerak, satu per 1.2 s per tank, maks 1 bersamaan | 6 | 150 ms | 1 / 1200 | -28 | Dentum rendah sine 55 Hz, lowpass 150 Hz. Hanya bila uji telinga lolos |
| `sfx.enemy.exploder.fuse` | B | `TelegraphStarted` jenis sumbu, berhenti di `TelegraphResolved` atau saat exploder mati | 2 | telegraf (0.8 s) | 3 / - | -14 | Bip square 25 ms, jarak bip menyusut eksponensial 300 ke 60 ms, pitch naik 1.7 ke 2.4 kHz. `mode: live` |
| `sfx.enemy.exploder.blast` | B | `TelegraphResolved` jenis sumbu | 2 | 400 ms | 3 / 60 | -9 | Burst noise dengan lowpass menyapu 4 kHz ke 300 Hz, thump sine 90 ke 40 Hz |
| `sfx.telegraph.area` | A (dipakai boss dan affix), B (Unlit) | `TelegraphStarted` jenis area tanpa cue khusus | 2 | telegraf (0.8 s atau lebih) | 4 / 80 | -11 | Swell dua saw bertritone (D5 dan G#5) lewat bandpass menyapu 900 Hz ke 2.6 kHz seiring isian telegraf tumbuh, gain naik, berhenti tegas. `mode: live` |
| `sfx.telegraph.area_impact` | A | `TelegraphResolved` jenis area | 2 | 350 ms | 4 / 60 | -10 | Thump sine 70 Hz ditambah crunch noise bandpass 1.2 kHz |
| `sfx.enemy.summon` | B | `TelegraphStarted` lingkaran panggil summoner atau affix `brood` | 2 | telegraf (0.8 s) | 2 / 200 | -14 | Reverse swell noise ditambah 2 nada pertama Motif Rembes pada `brass_low` |
| `sfx.telegraph.blink` | B | `TelegraphStarted` affix `blinking` | 2 | telegraf (0.8 s) | 1 / - | -12 | Swell kaca tritone tinggi di posisi tujuan (pan `worldX`) |

---

## 6. SFX Warden dan boss

### 6.1 `warden_hound` (A) dan Warden lain

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `sfx.warden.arrive` | A | `WardenSpawned` (25% durasi Pulse 5) | 2 | 1.5 s | 1 / - | -9 | Retak kaca panjang turun ditambah geram formant "oh" 150 Hz. Bersamaan dengan `mus.stinger.warden` |
| `sfx.warden.charge.windup` | A | `TelegraphStarted` terjang dari Warden (3 beruntun) | 2 | telegraf (0.6 s) | 2 / 100 | -10 | `charger.windup` satu oktaf lebih rendah ditambah geram formant. Tiap terjang dalam rangkaian naik 2 semitone (penanda hitungan 1, 2, 3) |
| `sfx.warden.charge.dash` | A | `TelegraphResolved` terjang dari Warden | 2 | 250 ms | 2 / 80 | -11 | Whoosh berat noise bandpass 300 ke 1.2 kHz, thump |
| `sfx.warden.volley.windup` | A | `TelegraphStarted` affix `volley` (cincin ungu 0.6 s) | 2 | telegraf (0.6 s) | 1 / - | -11 | Swell cluster `glass_bell` gelap C#6 dan D6 dengan tremolo, naik |
| `sfx.warden.volley.fire` | A | `TelegraphResolved` affix `volley` (8 proyektil) | 2 | 200 ms | 1 / - | -12 | Satu suara untuk 8 proyektil: chirp `shooter.fire` dilapis 3 dengan detune, bukan 8 suara |
| `sfx.warden.hasted` | A | `AffixApplied` dengan affix `hasted` (waktu tambahan) | 2 | 600 ms | 1 / - | -12 | Geram naik cepat formant, ditambah tick cepat |
| `sfx.warden.hurt` | A | `EnemyDamaged` rank Warden | 5 | 80 ms | 1 / 150 | -22 | Thunk tumpul triangle 160 Hz |
| `sfx.warden.death` | A | `WardenKilled` | 3 | 1.6 s | 1 / - | -9 | Crunch gelap turun, lalu `glass_bell` D5 dan A5 (hadiah) |
| `sfx.reward.drop` | A | `MementoOfferSpawned` (peti hadiah Warden) | 3 | 900 ms | 1 / - | -12 | `shimmer` naik ditambah `glass_bell` D6 |
| `sfx.warden.fan.windup` | B | `TelegraphStarted` kipas `warden_choir` | 2 | telegraf (0.4 s) | 1 / - | -11 | `shooter.windup` lebih lebar (3 sine bertritone) |

### 6.2 `boss_lantern` (A)

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `sfx.boss.intro` | A | `BossSpawned` (2 s setelah Pulse 10 mulai) | 2 | 3.0 s | 1 / - | -8 | Swell `unlit_drone`, `choir` formant, gulungan timpani, "hisapan" cahaya (noise highpass menyapu turun). Ducking `big_moment` |
| `sfx.boss.ember_rain.windup` | A | `TelegraphStarted` pola Ember Rain (5 atau 8 lingkaran, 1.0 s) | 2 | telegraf | 1 / - | -10 | Satu suara untuk semua lingkaran: `telegraph.area` dengan 3 lapis detune dan derak api naik |
| `sfx.boss.ember_rain.impact` | A | `TelegraphResolved` Ember Rain | 2 | 500 ms | 1 / - | -9 | Rentetan 3 thump berjarak 40 ms, crunch |
| `sfx.boss.snuff_ring.windup` | A | `TelegraphStarted` Snuff Ring (1.0 s) | 2 | telegraf | 2 / 300 | -10 | Swell tritone rendah D4 dan G#4 dengan bandpass naik, napas noise |
| `sfx.boss.snuff_ring.wave` | A | `TelegraphResolved` Snuff Ring (cincin melebar) | 2 | 800 ms | 2 / 300 | -10 | Whoosh melebar: noise bandpass turun 2 kHz ke 400 Hz selama cincin melebar, pan melebar dari posisi boss |
| `sfx.boss.lanes.windup` | A | `TelegraphStarted` Lantern Lanes (fase 2, 1.0 s) | 2 | telegraf | 1 / - | -10 | Tiga nada tritone naik bertumpuk (satu per jalur) |
| `sfx.boss.lanes.fire` | A | `TelegraphResolved` Lantern Lanes (deret proyektil) | 2 | 1.0 s | 1 / - | -12 | Rentetan chirp `shooter.fire` cepat 12 per detik, digabung satu suara, lowpass 3 kHz agar tidak menusuk |
| `sfx.boss.summon` | A | `BossSummoned` (Moth Call, 6 swarmer) | 2 | 800 ms | 1 / - | -12 | Reverse swell ditambah Motif Rembes, kepak noise bandpass 300 Hz bergetar |
| `sfx.boss.phase` | A | `BossPhaseChanged` ke fase 2 (jeda 1.5 s, cahaya berkedip) | 2 | 1.5 s | 1 / - | -8 | Retak kaca besar ditambah stab `brass_low`, lalu diam singkat mengikuti cahaya berkedip. Bersamaan dengan `mus.stinger.boss_phase` |
| `sfx.boss.enrage` | A | `BossEnraged` (setelah 120 s) | 2 | 1.0 s | 1 / - | -9 | Geram formant naik, ditambah `brass_low` tritone |
| `sfx.boss.hurt` | A | `EnemyDamaged` rank boss | 5 | 80 ms | 1 / 200 | -22 | Thunk 120 Hz |
| `sfx.boss.death` | A | `BossKilled` | 1 | 3.5 s | 1 / - | -6 | Runtuhan kaca panjang: cascade butir sine 2 sampai 7 kHz, sweep noise turun, thump. Ducking `big_moment` |
| `sfx.boss.bell.*`, `sfx.boss.vine.*` | C | Pola `boss_bell` dan `boss_vine` (gdd 16.2, 16.3) | 2 | | | | Diturunkan dari resep yang sama per jenis telegraf (area, cincin, jalur) dengan `params` berbeda |

---

## 7. SFX ekonomi, hadiah, dan alur Pulse

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `sfx.glint.pickup` | A | `GlintCollected` (coalesce 30 ms) | 4 | 90 ms | 4 / 35 | -20 | Denting sine dengan FM ringan (indeks 0.4). Nada dari `glintLadder` lagu aktif, anak tangga dari `b` (panjang rentetan) atau penghitung audio dengan reset 500 ms. `pitchJitter` 0.01, `send.room` 0 |
| `sfx.glint.sweep` | A | `GlintSwept` (pungutan otomatis 50% Glint di akhir Pulse, gdd 3.3, dan saat boss mati) | 4 | 800 ms | 1 / - | -18 | Glissando 12 nada tangga Glint berjarak 40 ms |
| `sfx.levelup` | A | `PlayerLeveledUp` | 3 | 700 ms | 1 / 300 | -10 | Arpeggio `chip_lead` D5 G5 A5 D6 masing-masing 50 ms, dobel `glass_bell` D6, `shimmer` emas. Tengah. Ducking `reward` |
| `sfx.memento.gain` | A | `MementoAcquired` | 3 | 1.1 s | 1 / - | -10 | `glass_bell` rendah D4 dan A4 (indeks FM tinggi, lambat), `shimmer` terbalik, "tok" tutup kaca (sine 400 Hz 20 ms). Rarity Fabled menambah oktaf D6. Ducking `reward` |
| `sfx.synergy.activate` | A (Flame, Shard, Edge), B (Echo, Ward, Trade) | `SynergyActivated` (ambang 2, 4, 6) | 3 | 900 ms | 1 / 500 | -11 | Dasar: akor `glass_bell` D, A, E tersebar; ambang 4 menambah oktaf, ambang 6 menambah `shimmer`. Lapisan warna per tag: Flame = derak noise; Shard = butir kaca tinggi; Edge = dering logam FM rasio 1:1.41; Echo = pengulangan delay 3 kali; Ward = dengung rendah swell; Trade = tick cerah bertangga |
| `sfx.pulse.start_wave` | A | `PulseStarted` | 3 | 900 ms | 1 / - | -14 | Gelombang cahaya: whoosh sine rendah menyapu, pan dari tengah melebar. Bersamaan dengan `mus.stinger.pulse_start` |
| `sfx.pulse.tick` | A (opsional, bisa dimatikan bila riser sudah cukup) | 3, 2, dan 1 detik sebelum akhir Pulse (dari `WorldView.pulse.ticksLeft`), tidak saat Warden menahan timer | 3 | 120 ms | 1 / 500 | -18 | Tick `glass_bell` E6 pendek |
| `sfx.pulse.end_flash` | A | `PulseEnded` | 3 | 1.2 s | 1 / - | -12 | Kilatan kaca: swell noise highpass 300 ms, retak terang, lalu larutan massal (20 pop gelap lowpass tersebar 600 ms) |

---

## 8. Ambience

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `amb.biome1.bed` | B (disarankan bila waktu cukup) | Arena `biome_market` aktif (Pulse dan toko), fade 2 s | slot amb | loop | 1 / - | -32 | Angin pink noise lowpass 400 Hz dengan LFO lambat, derak lentera acak (klik lowpass 3 kHz, 2 sampai 6 per detik), derit kaca acak tiap 6 sampai 12 s (sine 3 sampai 5 kHz glide tipis). `mode: live` |
| `amb.shop.mask_hum` | B | `ShopOpened` sampai `ShopClosed` | slot amb | loop | 1 / - | -34 | Dengung formant "mm" F2 sangat pelan, napas noise |
| `amb.biome2.bed`, `amb.biome3.bed` | C | Bioma 2 dan 3 | slot amb | loop | 1 / - | -32 | Varian resep `biome1.bed` (angin tebing; derak api) |

---

## 9. UI

Semua di ui bus, `send.room` 0.1 sampai 0.2, pan tengah, dipicu lewat `AudioSystem.playUi` atau event toko, tidak terpengaruh ducking sim kecuali `big_moment`.

| Id | Tk | Pemicu | P | Durasi | Poli | dB | Sintesis |
|---|---|---|---|---|---|---|---|
| `ui.focus` | A | Fokus atau hover berpindah | U | 30 ms | 2 / 40 | -30 | Tick sine 1.8 kHz 15 ms, sangat pelan |
| `ui.confirm` | A | Tombol dikonfirmasi (umum) | U | 120 ms | 2 / 60 | -20 | Dua nada triangle E5 lalu A5 |
| `ui.back` | A | Batal atau kembali | U | 100 ms | 2 / 60 | -22 | Dua nada triangle A5 lalu E5 |
| `ui.denied` | A | Aksi tidak sah, termasuk `CommandRejected` (Glint kurang dan alasan lain) | U | 140 ms | 1 / 150 | -22 | Dua ketuk tumpul sine 180 Hz. Tidak di pita bahaya, tidak tajam (selaras aturan "merah hanya untuk bahaya") |
| `ui.glazier.arrive` | A | `PhaseChanged` ke `shop` | U | 1.2 s | 1 / - | -16 | Motif Glazier: `glass_bell` E6 lalu B5, dengung formant "mm" F2 1 s |
| `ui.reward.reveal` | A | Layar pilihan hadiah Warden tampil | U | 600 ms | 1 / - | -16 | `shimmer` ditambah tiga lonceng D5, A5, D6 |
| `ui.shop.buy` | A | `ItemBought` | U | 350 ms | 2 / 80 | -16 | Denting kaca ditambah tangga Glint turun 3 nada (Glint dibelanjakan) |
| `ui.shop.reroll` | A | `ShopRerolled` | U | 300 ms | 2 / 120 | -18 | 4 tick noise bandpass cepat ditambah slide, rasa kartu dikocok |
| `ui.shop.merge` | A | `ItemMerged` | U | 700 ms | 1 / 200 | -14 | Dua sine 880 dan 900 Hz berdenyut lalu menyatu ke 890 Hz, diikuti denting terang. Tier lebih tinggi = denting lebih tinggi (II D6, III A6, IV D7) |
| `ui.shop.lock` | A | `ItemLocked` (kunci dan buka kunci) | U | 120 ms | 1 / 80 | -22 | Klik logam FM pendek; buka kunci memakai pitch 4 semitone lebih rendah |
| `ui.shop.sell` | A | `ItemSold` | U | 250 ms | 1 / 80 | -18 | Tangga Glint naik 3 nada |
| `ui.card.reveal` | A | `LevelUpCardsShown` | U | 400 ms | 1 / - | -18 | Tiga lonceng lembut D5, G5, A5 berjarak 80 ms |
| `ui.card.pick` | A | `LevelUpCardChosen` | U | 400 ms | 1 / 150 | -15 | Denting emas `glass_bell` D6 dengan shimmer |
| `ui.pulse.begin` | A | Tombol Begin Pulse | U | 200 ms | 1 / - | -18 | Swell pendek naik, disusul `mus.stinger.pulse_start` |
| `ui.pause.open` | A | Menu jeda dibuka | U | 150 ms | 1 / - | -22 | Sine turun D5 ke A4, lembut |
| `ui.pause.close` | A | Menu jeda ditutup | U | 150 ms | 1 / - | -22 | Sine naik A4 ke D5 |
| `ui.slider.tick` | A | Slider volume digeser (pratinjau lewat bus yang diatur) | U | 60 ms | 1 / 60 | -20 | Denting `glass_bell` kecil A5 |
| `ui.toggle` | A | Saklar opsi | U | 60 ms | 1 / 60 | -24 | Klik triangle 900 Hz |
| `ui.class.select` | B | Memilih kelas | U | 300 ms | 1 / - | -16 | Akor `glass_bell` khas kelas: `lantern` D dan A, `bell` G dan D, `blade` A dan E |
| `ui.end.tally` | B | Hitungan Silt di layar akhir | U | 50 ms | 2 / 40 | -22 | Tick bertangga memakai tangga Glint |
| `ui.unlock` | B | Kelas atau Memento terbuka dengan Silt | U | 800 ms | 1 / - | -14 | Varian `sfx.memento.gain` lebih terang |

---

## 10. Musik

| Id | Tk | Pemicu | Kunci, tempo | Panjang | Lapisan dan catatan |
|---|---|---|---|---|---|
| `mus.title` | A | Layar judul (state app) | D dorian, 84 BPM | 8 birama loop (22.9 s) | Pad, bass panjang, Motif Cahaya pada `glass_bell` |
| `mus.biome1.pulse` | A | `PulseStarted` bukan boss | D dorian, 116 BPM | 16 birama loop (33.1 s) | L0 sampai L3, riser, data lengkap di audio-direction 7.5 |
| `mus.overlay.unlit` | A | `WardenSpawned` sampai `WardenKilled` | ikut tuan rumah | siklus 4 birama | Drone D1 dan G#1, Motif Rembes |
| `mus.shop` | A | Keluar dari `pulseClear` ke `levelUp` atau `shop`, sampai `pulse.begin` | F lydian, 76 BPM | 8 birama loop (25.3 s) | Pad, petik, melodi lonceng. Toko tanpa batas waktu (gdd 12), jadi tanpa lapisan intensitas |
| `mus.biome1.boss` | A | `PulseStarted` boss (Pulse 10, `boss_lantern`) | D phrygian, 132 BPM | 16 birama loop (29.1 s) | Level menurut fase boss (audio-direction 6.6) |
| `mus.end` | A | Setelah stinger `victory` atau `defeat` | D dorian, 72 BPM | 8 birama loop (26.7 s) | Data `mus.title` tanpa melodi |
| `mus.riser.pulse_end` | A | 6 s sebelum akhir Pulse (selaras lonjakan spawn gdd 3.2), tidak saat Warden masih hidup, tidak di Pulse boss | ikut kunci D | 6 s, berhenti tegas | Instrumen `riser` |
| `mus.stinger.pulse_start` | A | `PulseStarted` | D | 2.5 s | Lonceng kaca rendah |
| `mus.stinger.pulse_end` | A | `PulseEnded` | D mayor | 2.5 s | Akor kaca naik |
| `mus.stinger.warden` | A | `WardenSpawned` | tritone D dan G# | 2 s | Brass rendah, cluster lonceng |
| `mus.stinger.boss_intro` | A | `BossSpawned` | D phrygian | 3 s | Drone, choir, timpani, Motif Rembes |
| `mus.stinger.boss_phase` | A | `BossPhaseChanged` (fase 2 dan mengamuk) | Eb di atas D | 1.5 s | Stab brass dan choir |
| `mus.stinger.boss_defeated` | A | `BossKilled` | ke D mayor | 4 s | Cascade lonceng turun, akor D mayor |
| `mus.stinger.victory` | A | `RunEnded` menang | D mayor, 84 BPM | sekitar 6 s | Motif Cahaya versi mayor |
| `mus.stinger.defeat` | A | `RunEnded` kalah | D minor, 72 BPM | sekitar 4 s | Lonceng saja, tanpa resolusi |
| `mus.biome2.pulse`, `mus.biome2.boss` | C | Bioma 2 | D aeolian, 104 BPM | 16 birama | Engine dan instrumen sama, choir lebih banyak |
| `mus.biome3.pulse`, `mus.biome3.boss` | C | Bioma 3 | D minor harmonik, 124 BPM | 16 birama | Petik dan perkusi kering |

`mus.shop` dipakai bersama oleh semua bioma (identitas the Glazier konsisten). Bioma C boleh punya varian `mus.shop.<biome>` bila waktu cukup.

---

## 11. Ringkasan cakupan

Jumlah baris cue: Tingkat A 95 (termasuk 15 cue musik dan stinger), Tingkat B 20, Tingkat C 4 (baris C berparameter untuk bioma 2 dan 3).

Pemetaan Tingkat A (gdd 2.3) ke cue:

| Kebutuhan Tingkat A | Cue |
|---|---|
| Kelas `lantern` dan Rite `flare_lantern` | `sfx.rite.ready`, `sfx.rite.cast.lantern`, `sfx.rite.impact.lantern`, `ui.rite.denied`, cue pemain di bagian 3 |
| 4 Unlit: swarmer, charger, shooter, tank | `sfx.enemy.spawn`, `death.small`, `death.medium`, `death.large`, `charger.windup`, `charger.dash`, `shooter.windup`, `shooter.fire` |
| `warden_hound` dengan affix `volley` dan `hasted` | `sfx.warden.*` (A), `sfx.reward.drop`, `ui.reward.reveal`, `mus.overlay.unlit`, `mus.stinger.warden` |
| `boss_lantern` (Ember Rain, Snuff Ring, Moth Call, Lantern Lanes, fase 2, mengamuk) | `sfx.boss.*` (A), `sfx.telegraph.area*`, `mus.biome1.boss`, `mus.stinger.boss_*` |
| 6 senjata A | Tabel 4.1: `fire.lob`, `impact.burst`, `fire.bolt`, `fire.arc`, `orbit.contact`, `fire.chain`, `fire.glaive`, `weapon.hit`, `weapon.hit_crit` |
| 12 Memento, tag Flame, Shard, Edge | `sfx.memento.gain`, `sfx.synergy.activate`, `sfx.proc.*` (A) |
| Toko dengan reroll, kunci, gabung, jual | `ui.glazier.arrive`, `ui.shop.buy`, `ui.shop.reroll`, `ui.shop.lock`, `ui.shop.merge`, `ui.shop.sell`, `ui.denied`, `ui.card.*`, `mus.shop` |
| 10 Pulse (Pulse 5 Warden, Pulse 10 boss) | `mus.biome1.pulse` dengan level per nomor Pulse, `sfx.pulse.*`, `sfx.glint.*`, `mus.riser.pulse_end`, `mus.stinger.pulse_*` |
| Layar judul dan akhir run | `mus.title`, `mus.stinger.victory`, `mus.stinger.defeat`, `mus.end`, cue `ui.*` umum |

---

## 12. Status implementasi M1 (M1-06)

- `src/audio/cues/cues.json` berisi **87 cue**: semua cue SFX dan UI Tingkat A di bagian 3 sampai 7 dan 9, kecuali yang tercatat di bawah, ditambah `sfx.player.block`, `sfx.weapon.fire.ring` (Tingkat B, murah), stinger `mus.stinger.pulse_start`, `pulse_end`, `warden`, `victory`, `defeat`, dan `mus.riser.pulse_end` (dirender sebagai buffer di music bus).
- Musik: `mus.biome1.pulse` (L0 sampai L3) dan `mus.shop` dimainkan sequencer.
- Belum ada (M2 atau Tingkat B): `mus.title`, `mus.end`, `mus.biome1.boss`, `mus.overlay.unlit`, `mus.stinger.boss_*`, `sfx.player.hit_heavy`, `sfx.rite.zone.lantern`, `sfx.rite.cast.bell`, `sfx.rite.cast.blade`, `sfx.proc.echo_repeat`, `sfx.proc.barrier_up`, `sfx.proc.interest`, `sfx.enemy.tank.step`, `sfx.enemy.exploder.*`, `sfx.enemy.summon`, `sfx.telegraph.blink`, `sfx.warden.fan.windup`, `sfx.pulse.tick` (opsional), `ui.class.select`, `ui.end.tally`, `ui.unlock`, ambience `amb.*`.
- Preview: `node tools/audio/render-cues.ts` menulis `audio/preview/sfx/<cue-id>.wav` dan `audio/preview/music/<lagu>.L<level>.wav`. Validasi: `node tools/audio/validate.ts`.
- Cue UI yang dipicu tombol (bukan event sim) diputar UI lewat `UiDeps.sound.play(cueId)`: `ui.focus`, `ui.confirm`, `ui.back`, `ui.toggle`, `ui.slider.tick`, `ui.pause.open`, `ui.pause.close`, `ui.pulse.begin`. Cue toko dan kartu dipicu event sim; bila UI juga memutarnya saat klik, `minIntervalMs` mencegah bunyi ganda.
