# Wireframe S09: Arsip (meta dan unlock)

Skala: lihat `01-title.md`. Spec: `docs/ui/ui-spec.md` bagian 5 (S09).

## Tab Keepsakes

```
+--------------------------------------------------------------------------------------------------+
|  Archive                                                                         (*) 386 Silt    |
|                                                                                                  |
|  Q [ Kept ]  [*Keepsakes*]  E                                     12/30 found                    |
|  +-----------------------------------------------+  +------------------------------------------+ |
|  |  [k] [k] [k] [k] [k] [k] [k] [k]              |  |  +------+   Ember Ring                    | |
|  |                                               |  |  | ICON |   Fine                          | |
|  |  [k] [k] [k] [k]>[k] [?] [?] [k]              |  |  | 48u  |   [Fl] Flame  [Ec] Echo         | |
|  |                                               |  |  +------+                                 | |
|  |  [?] [?] [k] [?] [?] [?] [?] [?]              |  |                                          | |
|  |                                               |  |  Hits ignite foes for 4 damage.          | |
|  |  [?] [?] [?] [?] [?] [?]                      |  |  Burning foes spread flame on death.     | |
|  |                                               |  |                                          | |
|  |                                               |  |  Still warm from a hand that never let   | |
|  |                                               |  |  go.                                     | |
|  |                                               |  |                                          | |
|  |                                               |  |                                          | |
|  |                                               |  |                                          | |
|  +-----------------------------------------------+  +------------------------------------------+ |
|                                                                                                  |
|  [ Back  Esc ]                                                                                   |
+--------------------------------------------------------------------------------------------------+
```

- `[k]` = ditemukan (ikon penuh). `[?]` = belum ditemukan (siluet `shadow`, panel detail "Not yet found").
- Flavor tampil penuh di Arsip (boleh wrap karena ruang cukup; batas 70 karakter tetap).
- Keepsake yang bisa dibuka dengan Silt (aturan GD) menampilkan tombol `[ Unlock  120 Silt ]` di panel detail.

## Tab Kept

```
|  Q [*Kept*]  [ Keepsakes ]  E                                                                    |
|  +-----------------------------+  +-------------------------------------------------------------+ |
|  | [pp] Lantern       Owned    |  |  (panel detail kelas sama dengan S02)                       | |
|  | [pp] Glasswright   Owned    |  |                                                             | |
|  |>[##] ??????        120 Silt |  |                         [ Unlock  120 Silt ]                | |
|  +-----------------------------+  +-------------------------------------------------------------+ |
```

## Konfirmasi belanja Silt (tanpa dialog)
```
Tekan 1:   [ Unlock  120 Silt ]
           -> [ Press again ]    (3 detik, bingkai kept-gold)
Tekan 2:   terbuka: ikon berkilau emas 400 ms, saldo berkurang, suara ui.unlock
Timeout:   kembali ke [ Unlock  120 Silt ]
Silt kurang: tombol redup, ikon Silt bergaris, tekan = ui.denied
```

## Interaksi
| Input | Hasil |
|---|---|
| Q / E, klik tab | Ganti tab |
| Panah, WASD, hover | Pindah fokus di grid atau daftar |
| Kanan dari grid | Fokus ke tombol Unlock di panel detail (bila ada) |
| Enter | Unlock (dua kali tekan) |
| Esc | Kembali ke layar asal (Judul atau Akhir run) |
