# Shardfall 1.0.0: Catatan Rilis

Tanggal build: 2026-11-17. Ditulis LP (M5-01). Main di `https://arthamegayasa.github.io/shardfall/`.

Status bug di dokumen ini diambil dari `docs/qa/bugs.md` pada 2026-11-17 pagi, saat QA masih menjalankan tes rilis M5. Daftar akhir "Bug yang diketahui" diisi QA di `docs/qa/bugs.md`; bila berbeda, yang berlaku adalah milik QA.

## 1. Isi rilis

Rilis 1.0 memakai scope Tingkat B (Keputusan Producer 2026-11-17).

- **Mode:** run 15 Pulse di bioma The Moth Market (arena `arena_market`), Warden di Pulse 4 (Brass Collar) dan Pulse 10 (Velvet Cowl), boss Paper Sun di Pulse 15 dengan dua fase.
- **Kelas:** Lamplighter (awal), Vintner, Chorister, masing-masing dengan pasif dan Rite sendiri (Festival Flare, Glass Step, Great Toll).
- **Isi:** 8 senjata dengan tier I sampai IV dan Fuse, 24 Memento (18 awal, 6 dari dua paket The Keeping), 6 tag dengan sinergi, kartu Temper per level, toko the Glazier dengan reroll, kunci, Fuse, dan jual. Unlit: swarmer, charger, shooter, tank, exploder, summoner, mote.
- **Meta:** Silt dari setiap run, The Keeping untuk membuka Vintner, Chorister, senjata Tithe Shard, dan dua paket Memento.
- **Simpan:** autosave di toko (lanjut setelah tab ditutup), pengaturan dan meta di localStorage.
- **Tampilan dan suara:** HD-2D (sprite pixel di panggung 3D, bloom, depth of field, cahaya dinamis, bayangan), kualitas grafis rendah, sedang, tinggi. Musik adaptif dan SFX disintesis saat runtime.
- **Aksesibilitas:** remap semua tombol, ukuran teks tiga tingkat, kurangi efek dan keamanan kilat, slider guncangan layar, angka damage bisa dimatikan, mode buta warna (protan, deutan, tritan) dengan isyarat bentuk, panel solid, volume terpisah, audio mono, kurangi suara berulang, jeda atau bisu saat jendela tidak fokus, navigasi keyboard penuh, jeda kapan saja, mengikuti preferensi reduced motion sistem.
- **Bahasa:** UI Inggris. Tabel Indonesia tersedia lewat `?lang=id` (tidak ada opsi di Settings, Keputusan 2026-11-17).
- **Teknis:** versi tampil di layar judul (`v1.0.0`). Layar pesan ramah bila WebGL2 tidak ada atau renderer gagal. Game tetap jalan bila localStorage diblokir (data hanya bertahan selama sesi). Bundle awal 276 KB gzip. Lisensi pihak ketiga di `third-party-licenses.txt`.

## 2. Keterbatasan yang diketahui

### Bug yang belum ditutup QA

Semua bug terbuka berstatus MENUNGGU UJI ULANG: perbaikan sudah ada dan punya tes regresi, tinggal dikonfirmasi QA.

| Id | Tingkat | Ringkasan | Catatan |
|---|---|---|---|
| BUG-007 | MAYOR | Market Cur saat ancang-ancang sulit dibedakan dari lantai di grayscale | Diperbaiki AD M4-01. Wajib lolos uji ulang sebelum rilis (kriteria M4: nol MAYOR) |
| BUG-010 | MAYOR | Urutan fokus panah di the Glazier tidak mengikuti urutan visual (A-07) | Diperbaiki UI. Wajib lolos uji ulang sebelum rilis |
| BUG-006 | MINOR | Frame arena pertama di profil browser baru bisa menahan loop sekitar 0,4 s; tombol yang ditekan saat itu hilang | Pre-warm render ditambahkan AD M4-01 |
| BUG-008 | MINOR | Banner boss atau Warden run sebelumnya bisa tetap tampil di run baru | Diperbaiki UI |
| BUG-009 | MINOR | Layar akhir run mengunci input 500 ms juga saat kembali dari The Keeping | Diperbaiki UI |
| BUG-012 | MINOR | Affix `brood` tidak bisa muncul di Tingkat B | Data GD |
| BUG-013 | MINOR | Tick sim bertambah saat diam di Temper dan toko | Diperbaiki GP; waktu run di layar akhir kini tidak menghitung waktu memilih |

### Batas rilis yang disengaja

- Hanya desktop dengan keyboard dan mouse. Belum ada dukungan gamepad atau layar sentuh.
- Butuh WebGL2. Browser lama atau GPU yang diblokir mendapat layar pesan, bukan game.
- Safari asli belum diuji: WebKit Playwright dipakai sebagai proksi (Keputusan 2026-11-16).
- Bila localStorage diblokir (mode privat tertentu, cookie dimatikan), progres Silt, pengaturan, dan autosave hilang saat tab ditutup. Tidak ada pesan ke pemain tentang hal ini.
- Crack (tingkat kesulitan) belum ada; 1.0 hanya Crack 0.
- Layar Credits di dalam game berisi ringkasan singkat; daftar lengkap ada di `docs/credits.md` dan `third-party-licenses.txt`.
- Determinisme: BUG-015 (1 checkpoint replay dari 14 berbeda di Node, hasil akhir run tetap sama) masih terbuka. Penyebab belum ditemukan.
- Frame Pulse pertama bisa tertahan sekitar 0,5 detik pada profil browser baru (BUG-006, MINOR).
- Dua ikon Memento (Music Box, Patched Cloak) masih versi sementara buatan GD; beberapa sprite proyektil dan FX berstatus `placeholder` di data art meski sudah dipakai sejak M1.
- Durasi run menang diperkirakan 14 sampai 16 menit dari simulasi bot; target resmi untuk 15 Pulse adalah 12 sampai 16 menit (Keputusan Producer; target handoff 15 sampai 20 menit berlaku untuk 20 Pulse Tingkat C). Belum dikonfirmasi dengan run manusia.
- Keseimbangan Vintner: bot `naive` menang 70%, run menangnya lambat (sekitar 21 menit). Butuh playtest manusia.

## 3. Yang belum diuji manusia

Semua pengujian sampai 1.0 dikerjakan agen dan bot. Sisa untuk Dok atau penguji manusia (Keputusan 2026-11-17):

1. Uji pandangan 1 detik (P2-a): baru dikerjakan penguji proksi.
2. Uji telinga audio dan uji orisinalitas dengar musik (A-6).
3. Rasa input: respons gerak, Rite, dan navigasi menu dengan tangan manusia.
4. Run lengkap manusia untuk durasi, tingkat kesulitan, dan keseimbangan tiga kelas.
5. Cek web dan merek dagang nama "Shardfall" sebelum rilis komersial (cadangan: Under the Pane).
6. Safari asli di macOS atau iOS, dan GPU di luar mesin uji.
7. Mode buta warna dan ukuran teks Largest oleh pemain yang membutuhkannya.

## 4. Rencana pasca 1.0 (Tingkat C)

Draf data dan arena Tingkat C sudah ada di repo dan dibuang otomatis oleh pipeline data di build B.

- Dua bioma baru: Vesper Steps (`arena_cloister`, boss `boss_bell`) dan Stillfire Vineyard (`arena_vineyard`, boss `boss_vine`), memakai ulang Unlit dengan palet cahaya berbeda, plus layar antara bioma Vitrine Steady.
- Run 20 Pulse dan sekitar 30 Memento (6 Memento C di `mementos.csv`, paket 3 dan 4 di `meta_unlocks.csv`).
- Crack 1 sampai 5 (`difficulty.csv`) sebagai kesulitan bertingkat dan sumber Silt tambahan.
- Musik dan art untuk dua bioma baru, Warden dan Unlit lain yang masih berstatus konsep.
- Kandidat lain di luar Tingkat C: opsi bahasa di Settings, dukungan gamepad, layar Credits lengkap di dalam game, pesan ke pemain saat penyimpanan tidak tersedia.

Lisensi tetap hak cipta proyek (all rights reserved) sampai Dok memilih lisensi terbuka.
