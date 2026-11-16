# Wireframe S03: HUD Pulse

Skala: lihat `01-title.md`, tapi HUD menempel ke tepi viewport nyata (bukan area aman), margin 8 satuan. Spec: `docs/ui/ui-spec.md` bagian 5, S03.

```
+--------------------------------------------------------------------------------------------------+
| [=========42/60======-----]                     Pulse 7                         (*) 128          |
| Lv 4 [=======---------]                          0:24                                            |
|::::::::::::::::::::::::::::::::::::: pita DoF atas (blur) ::::::::::::::::::::::::::::::::::::::::|
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                        AREA MAIN SELALU KOSONG                                   |
|                                         DARI ELEMEN HUD                                          |
|                                                                                                  |
|                                              (Kept)                                              |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|                                                                                                  |
|:::::::::::::::::::::::::::::::::::: pita DoF bawah (blur) :::::::::::::::::::::::::::::::::::::::|
|                                             +------+                                             |
|                                             |######|  isian cooldown dari bawah                  |
|                                             |  4   |  angka = sisa detik                         |
|                                             +------+                                             |
|                                               Space                                              |
+--------------------------------------------------------------------------------------------------+
```

## Lima elemen (dan hanya ini)
| # | Elemen | Posisi | Ukuran (satuan UI) |
|---|---|---|---|
| 1 | HP: bar `kept-blue` plus "42/60" | Kiri atas | 120 x 8 |
| 2 | Level "Lv 4" plus bar XP `kept-gold` | Di bawah HP | 120 x 3 |
| 3 | "Pulse 7" plus timer "0:24" | Tengah atas | Timer skala judul |
| 4 | Ikon Glint plus angka | Kanan atas | Ikon 8 x 8 |
| 5 | Ikon Rite dengan cooldown plus petunjuk tombol | Tengah bawah | 32 x 32 |

## Status
```
HP normal      [==========42/60====------]
HP < 30%       [!=====14/60--------------]   bingkai berdenyut danger-red + ikon retak (!)
HP kena damage [=========|xxx|-----------]   segmen xxx putih menyusut 300 ms

Rite cooldown  +------+      Rite siap  +======+   bingkai kept-gold, denyut sekali
               |      |                 | ICON |
               |##4###|                 |      |
               +------+                 +======+

Timer normal   0:24  (bone)
Timer <= 5 s   0:04  (kept-gold, membesar 1 satuan tiap detik; tidak merah)
```

## Varian Pulse boss tanpa batas waktu [Asumsi]
```
|                              The Lantern-Eater                                                   |
|                         [vvvvvvvvvvvvvvvvvvvvvv--------]   bingkai danger-violet                  |
```
Slot timer diganti bar HP boss. Jumlah elemen tetap lima.

## Elemen sesaat (tanpa input)
```
Banner Warden (2.5 s, di bawah timer):
|                                  +------------------------------+                                |
|                                  |  Gravel-Mother, the Patient  |  bingkai danger-violet         |
|                                  +------------------------------+                                |

Petunjuk Pulse 1 run pertama (di atas ikon Rite, hilang setelah 6 s atau setelah gerak + Rite):
|                                     WASD Move   /   Space Rite                                   |
```
Nama Warden di atas hanya contoh tata letak (milik WR).
