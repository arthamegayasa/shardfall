# Shardfall: Pelacak Bug

Pemilik: QA Lead. Hanya QA yang mengubah tingkat dan status DITUTUP. Programmer boleh mengubah status ke DIKERJAKAN atau MENUNGGU UJI ULANG dan mengisi kolom perbaikan.
Aturan tingkat dan status: `docs/qa/test-plan.md` bagian 14.

**Tingkat:** BLOCKER, MAYOR, MINOR.
**Status:** TERBUKA, DIKERJAKAN, MENUNGGU UJI ULANG, DITUTUP, DITOLAK, DIKETAHUI.
**Id:** `BUG-001`, `BUG-002`, dan seterusnya, tidak pernah dipakai ulang.

---

## Ringkasan

| Id | Judul | Tingkat | Status | Milestone ditemukan | Area | Pemilik perbaikan | Tes regresi |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Area: `sim`, `render`, `ui`, `audio`, `data`, `save`, `perf`, `a11y`, `compat`, `build`, `asset`.

---

## Detail bug

Salin blok di bawah untuk tiap bug baru. Urutkan dari id terkecil.

```markdown
### BUG-000: <judul singkat, apa yang salah>

- Tingkat: BLOCKER | MAYOR | MINOR
- Status: TERBUKA
- Ditemukan: <tanggal>, <milestone>, oleh <peran>
- Build: <commit atau id build>, <build tes atau rilis>
- Lingkungan: <browser dan versi>, <resolusi>, <profil perangkat P-REF | P-DEV | P-LOW>
- Seed: <seed atau "tidak relevan">
- Replay: <path file replay atau "tidak ada">
- Kelas, bioma, Pulse: <bila relevan>

**Langkah reproduksi**
1.
2.
3.

**Diharapkan:** <perilaku sesuai spec, sebut dokumen dan bagian, misalnya pillars.md P2-f>

**Terjadi:** <perilaku yang terlihat>

**Frekuensi:** <selalu | x dari y percobaan>

**Bukti:** <path screenshot, log, trace, hash>

**Catatan perbaikan (diisi programmer):** <ringkas, tanpa menyalin kode>

**Uji ulang (diisi QA):** <tanggal, build, hasil, path bukti>
```

---

## Bug yang diketahui (untuk rilis)

Diisi saat M5. Hanya bug MINOR berstatus DIKETAHUI yang boleh ada di sini. BLOCKER dan MAYOR tidak boleh dibawa ke rilis.

| Id | Ringkasan untuk pemain (Inggris) | Solusi sementara |
|---|---|---|
| | | |
