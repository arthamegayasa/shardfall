# Aturan Kerja Subagent Shardfall

Berlaku untuk setiap subagent yang di-spawn Producer. Baca file ini sebelum mulai.

## Lingkungan
- Root proyek: `D:\T3 Projects\Shardfall` (Windows). Shell: Git Bash atau PowerShell. Node 24, npm 11, Python 3.13.
- Peranmu didefinisikan di `docs/team/HANDOFF.md` bagian 3 (cari judul peranmu). Ikuti prompt peran itu.
- Status dan keputusan proyek ada di `docs/tasks.md` (milik Producer, jangan diubah). Baca bagian Keputusan sebelum mulai.

## Aturan mutlak
1. **Jangan menjalankan perintah git** (commit, push, checkout, reset, stash, dll). Producer yang meng-commit.
2. **Jangan menulis `docs/tasks.md`.**
3. **Subagent lain bekerja paralel di folder yang sama.** Hanya ubah file yang menjadi milikmu sesuai brief. Jangan menghapus atau menimpa pekerjaan orang lain. Bila perlu perubahan kecil di file milik orang lain demi integrasi, lakukan seminimal mungkin dan sebutkan di laporan.
4. **Jangan menambah dependensi npm** kecuali brief mengizinkan. Bila butuh, tulis di laporan.
5. **Tidak ada pertanyaan ke pengguna.** Pengguna sedang tidak tersedia. Ambil keputusan sendiri di wilayah peranmu, tandai asumsi dengan `[Asumsi]`, dan tulis pertanyaan terbuka di laporan. Untuk wilayah peran lain, pilih default yang paling masuk akal dan sebutkan.
6. Aset hanya buatan tim (skrip, generator prosedural, kode) atau CC0. Tidak menjiplak aset, nama, musik, teks, atau UI game lain. Setiap aset baru dicatat di `docs/credits.md`.
7. Tidak ada posting ke luar, tidak ada pembelian, tidak ada akses jaringan selain yang sudah disiapkan (npm registry hanya untuk yang diizinkan).
8. Angka balance hanya dari file data. Jangan mengubah angka agar tes lulus.
9. Bahasa dokumen tim: Indonesia, jelas dan ringkas, **tanpa em dash**. Kode, komentar, identifier, nama file: Inggris. Teks di dalam game: Inggris.
10. Saat menjalankan typecheck atau tes, fokus pada file milikmu. Error di file yang sedang dikerjakan subagent lain bukan tanggung jawabmu, tapi sebutkan di laporan.
11. Jangan menjalankan server dev yang dibiarkan hidup. Bila perlu server untuk tes, matikan setelah selesai.

## Laporan akhir (wajib, ringkas)
Balas Producer dengan:
- Daftar file dibuat atau diubah.
- Keputusan penting yang diambil.
- Perintah yang dijalankan dan hasilnya (bila ada kode atau tes).
- Putusan review (bila kamu reviewer): SETUJU / SETUJU DENGAN CATATAN / TOLAK, atau LOLOS / PERLU PERBAIKAN, atau LOLOS / GAGAL.
- Pertanyaan terbuka dalam satu daftar.
Maksimal sekitar 400 kata. Detail panjang taruh di file dokumen, bukan di laporan.
