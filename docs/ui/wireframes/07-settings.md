# Wireframe S07: Pengaturan

Skala: lihat `01-title.md`. Spec: `docs/ui/ui-spec.md` bagian 5 (S07) dan 9 (aksesibilitas).

## Tab Accessibility (contoh)

```
+--------------------------------------------------------------------------------------------------+
|  Settings                                                                                        |
|                                                                                                  |
|  Q [ Graphics ]  [ Audio ]  [ Controls ]  [*Accessibility*]  E                                   |
|  +--------------------------------------------------------------------------------------------+  |
|  |                                                                                            |  |
|  | > Text Size                         <  Normal  >   (Normal, Large, Largest)                |  |
|  |   Reduce Effects                    <  Off     >                                           |  |
|  |   Damage Numbers                    <  On      >                                           |  |
|  |   Color Vision                      <  Off     >   (Off, Protanopia, Deuteranopia, Tritanopia)|  |
|  |   Pause When Away                   <  On      >                                           |  |
|  |   Flavor Text                       <  On      >                                           |  |
|  |   Solid Panels                      <  Off     >                                           |  |
|  |                                                                                            |  |
|  |  ----------------------------------------------------------------------------------------  |  |
|  |  Pratinjau: kartu contoh dan teks contoh tampil di sini dengan ukuran teks dan mode warna  |  |
|  |  yang sedang dipilih, agar efek pengaturan langsung terlihat.                              |  |
|  |  +-------------------------------------------------------------+                           |  |
|  |  | +----+ Ember Ring                       [Fl][Ec]     (*)18  |                           |  |
|  |  | | IC | Hits ignite foes for 4 damage.                       |                           |  |
|  |  | +----+ Burning foes spread flame on death.                  |                           |  |
|  |  +-------------------------------------------------------------+                           |  |
|  |                                                                                            |  |
|  +--------------------------------------------------------------------------------------------+  |
|                                                                                                  |
|  [ Back  Esc ]                                                                                   |
+--------------------------------------------------------------------------------------------------+
```

## Tab lain (isi panel saja)

```
Graphics                                        Audio
| > Quality          <  High  >          |      | > Master     [=========--]  80   |
|   Screen Shake     [==========] 100    |      |   Music      [=========--]  80   |
|   Fullscreen       <  Off   >          |      |   Sound FX   [=========--]  80   |
|   (Low: tanpa DoF, bloom, kilau kaca)  |      |   Mute When Away   <  On  >      |

Controls
| > Move Up          [ W     ]  [ Up    ]                       |
|   Move Down        [ S     ]  [ Down  ]                       |
|   Move Left        [ A     ]  [ Left  ]                       |
|   Move Right       [ D     ]  [ Right ]                       |
|   Rite             [ Space ]  [ ---   ]                       |
|   Pause            [ Esc   ]  [ P     ]                       |
|   Confirm          [ Enter ]  [ Space ]  (Enter tetap aktif)  |
|   Back             [ Esc   ]  [ Bksp  ]  (Esc tetap aktif)    |
|   Reroll           [ R     ]  [ ---   ]                       |
|   Lock             [ L     ]  [ ---   ]                       |
|   Begin Pulse      [ B     ]  [ ---   ]                       |
|   Stats            [ T     ]  [ ---   ]                       |
|                                                               |
|   [ Reset Controls ]                                          |
|                                                               |
| Saat menunggu:     [ Press a key ]   Esc batal               |
| Bila bentrok:      "Swapped with Rite." (catatan 2 detik)    |
```

## Interaksi
| Input | Hasil |
|---|---|
| Q / E, klik tab | Ganti tab |
| Atas/bawah | Pindah baris |
| Kiri/kanan | Ubah nilai (pilihan berputar, slider langkah 10) |
| Enter pada binding | Mulai remap |
| Enter pada Reset Controls | Dialog konfirmasi |
| Esc | Kembali (ke Judul atau Jeda, sesuai asal) |

- Semua perubahan langsung berlaku dan tersimpan. Tidak ada tombol Apply.
- Confirm dan Back bisa di-remap, tapi Enter dan Esc selalu tetap bekerja di menu sebagai cadangan tetap.
- Opsi Shop Timer hanya muncul bila GD memberi timer pada toko.
- Bila dibuka dari Jeda, arena tetap membeku di belakang.
