# Wireframe S08: Akhir run

Skala: lihat `01-title.md`. Spec: `docs/ui/ui-spec.md` bagian 5 (S08).

## Kalah

```
+--------------------------------------------------------------------------------------------------+
|..................................................................................................|
|.........................................KEPT LOST................................................|
|..............................Another wakes beneath the glass.....................................|
|..................................................................................................|
|.....+-------------------------------------------+...+------------------------------------------+..|
|.....|  [ic] Felled by Hollow Hound              |...|  BUILD                                   |..|
|.....|                                           |...|  Arms                                    |..|
|.....|  Pulse reached          9 of 20           |...|  [Lh II][Lh I][Sp I][Bw I]               |..|
|.....|  Time                   6:42              |...|                                          |..|
|.....|  Unlit Dissolved        412               |...|  Keepsakes                               |..|
|.....|  Glint Gathered         538               |...|  [k][k][k][k][k][k]                      |..|
|.....|                                           |...|                                          |..|
|.....|  ---------------------------------------  |...|  Tags                                    |..|
|.....|  Silt Earned            + 46              |...|  [Fl] Flame 4/4   [Ed] Edge 2/4          |..|
|.....|  Silt Total               386             |...|                                          |..|
|.....|                                           |...|                                          |..|
|.....|  * New unlock available                   |...|                                          |..|
|.....+-------------------------------------------+...+------------------------------------------+..|
|..................................................................................................|
|..................................................................................................|
|..................................................................................................|
|.......>[ Try Again ]      [ Choose Kept ]      [ Archive ]      [ Title ]..........................|
|..................................................................................................|
+--------------------------------------------------------------------------------------------------+
```

Nama Unlit dan angka adalah contoh tata letak.

## Menang
Sama, dengan judul dari WR (draf "The Light Holds"), baris "Felled by" diganti nama boss yang dikalahkan ("[nama boss] is undone", teks WR), dan "Pulse reached" menampilkan "20 of 20".

## Catatan
- "Felled by" menampilkan ikon dan nama sumber damage terakhir (Unlit, Warden, boss, atau proyektilnya). Tujuannya: pemain selalu bisa menjawab "aku mati karena..." (style guide 5.7).
- Silt Earned menghitung naik dalam 800 ms (langsung bila kurangi efek). Baris Silt hanya tampil bila Silt aktif (Tingkat B).
- "New unlock available" hanya tampil bila saldo Silt kini cukup untuk satu unlock.
- Kunci input 500 ms saat layar muncul.

## Interaksi
| Input | Hasil |
|---|---|
| Kiri/kanan, A/D, hover | Pindah tombol |
| Enter, Space, klik | Jalankan tombol |
| Esc | Tidak ada (harus memilih) |
| Try Again | `AppActions.startRun` dengan kelas (dan Depth) yang sama |
