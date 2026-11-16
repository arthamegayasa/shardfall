# Wireframe S02: Pilih Kept

Skala: lihat `01-title.md`. Spec: `docs/ui/ui-spec.md` bagian 5, S02.

```
+--------------------------------------------------------------------------------------------------+
|  Choose Your Kept                                                                (*) 340 Silt    |
|  ----------------                                                                                |
|  +-----------------------------+   +-----------------------------------------------------------+ |
|  |>[pp] Lantern                |   |  +--------+   LANTERN                                     | |
|  |      Burns what comes close |   |  |        |   "Carries the last warm light."              | |
|  +-----------------------------+   |  | POTRET |                                               | |
|  | [pp] Glasswright            |   |  |  48u   |   HP 60    Speed 100    Armor 2               | |
|  |      Builds walls of shard  |   |  +--------+                                               | |
|  +-----------------------------+   |                                                           | |
|  | [##] ??????    [lock]       |   |  WEAPON                                                   | |
|  |      120 Silt               |   |  [ic] Ember Lash                                          | |
|  +-----------------------------+   |       Lashes the nearest foe for {dmg} damage.            | |
|                                    |       Hits ignite for 2 seconds.                          | |
|                                    |                                                           | |
|                                    |  RITE                                                     | |
|                                    |  [ic] Kindle             12s cooldown                     | |
|                                    |       Bursts flame around the Kept.                       | |
|                                    |       Pushes nearby Unlit away.                           | |
|                                    |                                                           | |
|                                    |  Tags: [Fl] Flame  [Wa] Ward                              | |
|                                    +-----------------------------------------------------------+ |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                    Crack  < 0 >     (hanya bila sudah terbuka, Tingkat C)       |
|                                                                                                  |
|  [ Back  Esc ]                                                          [ Begin  Enter ]         |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

Nama kelas, senjata, dan teks di atas adalah contoh tata letak, bukan konten (milik GD dan WR).

## Kelas terkunci difokus
Panel kanan menampilkan siluet potret, nama "??????" atau nama asli (keputusan WR), biaya Silt, dan tombol `[ Unlock in The Keeping ]` menggantikan Begin. Senjata dan Rite tetap ditampilkan agar pemain tahu yang akan dibuka.

## Grup fokus
1. Daftar kelas (atas/bawah). 2. Crack (kiri/kanan, bila ada). 3. Tombol bawah (kiri/kanan).

## Interaksi
| Input | Hasil |
|---|---|
| Atas/bawah, W/S, hover | Pilih kelas, panel kanan langsung berubah |
| Enter pada daftar kelas atau tombol Begin | Mulai run (`AppActions.startRun`) |
| Kiri/kanan saat fokus di Crack | Ubah tingkat kesulitan |
| Esc | Kembali ke Judul |
