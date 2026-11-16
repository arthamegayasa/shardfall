# Shardfall: Daftar Tugas dan Status

Pemilik file: Producer. Hanya Producer yang menulis file ini.

## Status milestone

| Milestone | Status | Catatan |
|---|---|---|
| M0 Konsep dan pilar | BERJALAN | Dimulai 2026-11-16 |
| M1 Prototipe main loop | BELUM | |
| M2 Vertical slice HD-2D | BELUM | |
| M3 Konten penuh | BELUM | |
| M4 Polish dan QA | BELUM | |
| M5 Rilis | BELUM | |

## Mode kerja

- Dok memberi mandat penuh (2026-11-16): eksekusi mandiri tanpa bertanya, Producer memutuskan scope dan perbaikan. Semua tahap di-push ke repo publik `github.com/arthamegayasa/shardfall`.
- Hanya Producer yang menjalankan git. Subagent mengikuti `docs/team/agent-rules.md`.
- Prompt peran ada di `docs/team/HANDOFF.md` bagian 3. Alur milestone di bagian 4.

## Tugas M0

| ID | Tugas | Pemilik | Reviewer | Status |
|---|---|---|---|---|
| M0-01 | vision.md, pillars.md, style-guide.md | CD | Producer (scope) | BERJALAN |
| M0-02 | gdd.md | GD | CD, LP | BELUM |
| M0-03 | architecture.md, coding-standards.md | LP | Producer | BELUM |
| M0-04 | art-direction.md, art-pipeline.md, konsep mood | AD | CD | BELUM |
| M0-05 | audio-direction.md, audio-list.md | AU | CD | BELUM |
| M0-06 | lore-premise.md, glossary.md | WR | CD | BELUM |
| M0-07 | arena-design.md | LD | CD | BELUM |
| M0-08 | ui-spec.md, wireframe | UI | CD | BELUM |
| M0-09 | test-plan.md, accessibility.md | QA | Producer | BELUM |
| M0-10 | Pertanyaan spec untuk GD | GP | GD | BELUM |
| M0-11 | Review kreatif dan teknis M0 | CD, LP | Producer | BELUM |

## Keputusan

| Tanggal | Keputusan | Pemilik | Alasan |
|---|---|---|---|
| 2026-11-16 | Repo publik GitHub `arthamegayasa/shardfall`, push tiap tahap | Producer | Permintaan Dok |
| 2026-11-16 | Deploy build web ke GitHub Pages sejak M1 agar selalu ada versi yang bisa dimainkan | Producer | Dok ingin game langsung bisa dimainkan saat bangun |
| 2026-11-16 | Aset art dan audio dibuat prosedural lewat skrip di repo (pixel art dari data, audio Web Audio sintesis) | Producer (scope) | Lisensi bersih, bisa dibuat ulang, tanpa pembelian |
