# Wireframe S05: The Glazier (toko)

Skala: lihat `01-title.md`. Spec: `docs/ui/ui-spec.md` bagian 5 (S05) dan 6.1 (kartu baris).
Pembagian lebar (satuan UI): kolom kiri 140, kolom tengah 344, kolom kanan 140, celah 4 x 4. Total 640.

```
+--------------------------------------------------------------------------------------------------+
| The Glazier    Next: Pulse 8                              HP 51/60                 (*) 64 Glint  |
|==================================================================================================|
| +--------------------+ +-[1]--------------------------------------------------+ +--------------+ |
| | +------+           | |>+----+ Ember Ring                    [Fl][Ec]  (*)18 | | ARMS         | |
| | |GLAZ- | "Glass for| | | IC | Hits ignite foes for 4 damage.          [lck] | | +--+--+--+   | |
| | | IER  |  glint,   | | | 32 | Burning foes spread flame on death.           | | |Lh|Lh|Sp|   | |
| | | 48u  |  Kept."   | | +----+ Still warm from a hand that never let go.     | | |II|I |I |   | |
| | +------+           | +------------------------------------------------------+ | +--+--+--+   | |
| |                    | +-[2]--------------------------------------------------+ | |Bw|  |  |   | |
| | TAGS               | | +----+ Ember Lash      [MERGE > II]  [Fl]      (*)12 | | |I |  |  |   | |
| | [Fl] Flame         | | | IC | Lashes the nearest foe for 6 damage.    [lck] | | +--+--+--+   | |
| |  oo+.  2/4  (+1)   | | | 32 | Hits ignite for 2 seconds.                    | |              | |
| | [Ec] Echo          | | +----+                                               | | KEEPSAKES    | |
| |  o+..  1/3  (+1)   | +------------------------------------------------------+ | [k][k][k][k] | |
| | [Ed] Edge          | +-[3]-LOCKED-------------------------------------------+ | [k][k]       | |
| |  oo..  2/4         | |#+----+ Shard Volley                [Sh][Ed]    (*)25 | |              | |
| | [Wa] Ward          | |#| IC | Fires 3 shards in a fan.                [LCK] | |              | |
| |  o..   1/2         | |#| 32 | Shards pierce 1 foe.                          | |              | |
| | [Sh] Shard  New    | |#+----+                                               | |              | |
| |  +...  0/2  (+0)   | +------------------------------------------------------+ |              | |
| |                    | +-[4]--------------------------------------------------+ |              | |
| |                    | | +----+ Iron Psalm                  [Wa]      (/)40   | |              | |
| |                    | | | IC | Gain 1 Armor per Pulse held.            [lck] | |              | |
| |                    | | | 32 | Lose it all when hit by a Warden.             | |              | |
| |                    | | +----+ (redup: Glint belum cukup, ikon Glint coret) | | [ Stats  T ] | |
| +--------------------+ +------------------------------------------------------+ +--------------+ |
| (info fokus) Ember Ring: Flame 2/4 > 3/4. Echo 1/3 > 2/3.                                        |
|==================================================================================================|
| [ Reroll (*)3   R ]     1-4 Buy    L Lock    Tab Groups    Esc Pause      [ Begin Pulse   B ]    |
+--------------------------------------------------------------------------------------------------+
```

Nama item, angka, dan teks di atas adalah contoh tata letak, bukan konten (milik GD dan WR). Jumlah slot senjata (6) dan tawaran (4) adalah [Asumsi] sampai GDD ada.

## Legenda
| Tanda | Arti |
|---|---|
| `>` | Fokus (bingkai `kept-gold`) |
| `(*)18` | Harga dengan ikon Glint, mampu dibeli |
| `(/)40` | Ikon Glint bergaris: belum mampu. Teks harga dan tombol redup abu, bukan merah |
| `[lck]` / `[LCK]` | Gembok terbuka / tertutup. Kartu terkunci juga punya bingkai bergaris `#` |
| `[MERGE > II]` | Membeli akan menggabung dengan item dimiliki, tier tujuan II. Slot `Lh II` di Arms menyala |
| `oo+.` | Pip ambang tag: `o` terisi, `+` pip bayangan dari kartu fokus, `.` kosong |
| `(+1)` | Pratinjau dari kartu yang difokus |
| `New` | Tag belum dimiliki, muncul sementara karena kartu fokus membawanya |

## Status kartu
```
Taken (setelah beli, slot tidak bergeser):
+-[1]--------------------------------------------------+
|                     Taken                            |
+------------------------------------------------------+

Melewati ambang tag (baris tag di panel kiri bersinar emas):
| [Fl] Flame         |
|  ooo+  3/4 > 4/4   |
|  Unlocks: Burning  |
|  foes explode.     |

Slot penuh (bukan merge):
| | IC | ...                              [No free slot] |
```

## Kolom kanan saat Stats (tombol T)
```
+--------------+
| STATS        |
| HP     51/60 |
| Speed    108 |
| Damage  +12% |
| Rate     +0% |
| Crit      5% |
| Armor      2 |
| Pickup   100 |
| Luck       0 |
|              |
| [ Arms   T ] |
+--------------+
```
Daftar stat dari GD. Saat kartu yang mengubah stat difokus, nilai baru tampil "lama > baru" seperti level-up.

## Grup fokus dan navigasi
```
          [Tags]  <-->  [Offers 1-4]  <-->  [Inventory]
                             |
                       [Bottom bar: Reroll, Begin Pulse]
```
- Panah atas/bawah di Offers berpindah kartu; kiri dari Offers ke Tags, kanan ke Inventory; bawah dari kartu terakhir ke bar bawah.
- Tab dan Shift+Tab berputar: Offers > Inventory > Bottom bar > Tags > Offers.
- Fokus pada slot Inventory menampilkan nama, efek, dan tier di baris info bawah, plus tombol Merge (M) atau Sell (X) bila GD mengizinkan.

## Interaksi
| Input | Hasil | Jumlah input untuk beli |
|---|---|---|
| 1 sampai 4 | Beli slot itu | 1 |
| Fokus kartu lalu Enter | Beli kartu fokus | 2 |
| Klik kartu atau harga | Beli | 1 |
| L, atau klik gembok, atau Shift+angka | Kunci atau buka kunci kartu | |
| R, atau klik Reroll | Reroll tawaran yang tidak terkunci | |
| T | Ganti kolom kanan Arms dan Stats | |
| B, atau Enter pada Begin Pulse | Mulai Pulse berikutnya | |
| Esc | Jeda | |

- Beli gagal (Glint kurang atau slot penuh): kartu bergetar 2 satuan, suara `ui.denied`, live region mengumumkan alasannya. Tidak ada dialog.
- Kunci input 300 ms saat layar muncul.
- Baris info bawah menjelaskan kartu fokus dalam satu kalimat: perubahan tag dan stat. Pemain tidak perlu menghitung.

## Varian ukuran teks Largest (spec 7.3)

```
+--------------------------------------------------------------------------------------------------+
| The Glazier   Next: Pulse 8                                                     (*) 64 Glint     |
| [Fl]2/4(+1)  [Ec]1/3(+1)  [Ed]2/4  [Wa]1/2  [Sh]0/2 New                    HP 51/60             |
|==================================================================================================|
| +-[1]------------------------------------------------------------------------------------------+ |
| |>+----+ Ember Ring                                                    [Fl][Ec]   (*)18  [lck] | |
| | | IC | Hits ignite foes for 4 damage.                                                        | |
| | +----+ Burning foes spread flame on death.                                                   | |
| +----------------------------------------------------------------------------------------------+ |
| +-[2]------------------------------------------------------------------------------------------+ |
| | ...                                                                                          | |
| +----------------------------------------------------------------------------------------------+ |
| +-[3]------------------------------------------------------------------------------------------+ |
| | ...                                                                                          | |
| +----------------------------------------------------------------------------------------------+ |
| +-[4]------------------------------------------------------------------------------------------+ |
| | ...                                                                                          | |
| +----------------------------------------------------------------------------------------------+ |
| (info fokus) Flame 2/4 > 3/4. Echo 1/3 > 2/3.                                                    |
|==================================================================================================|
| [ Reroll (*)3  R ]   [ Arms/Stats  T ]                                [ Begin Pulse  B ]         |
+--------------------------------------------------------------------------------------------------+
```
- Kartu tanpa flavor. Strip tag di bar atas menggantikan panel Tag. T menampilkan Arms, Keepsakes, dan Stats di tempat kartu tawaran; T lagi kembali ke tawaran.
