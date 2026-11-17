# Build Rilis, Deploy, dan Cek Bundle

Pemilik: Lead Programmer. Versi 1.0 (M5-01, 2026-11-17). Melengkapi `architecture.md` bagian 13 (anggaran) dan 15 (skrip, CI, deploy).

## 1. Prasyarat

- Node 24 dan npm 11 (`package.json` `engines`).
- `npm ci` dari `package-lock.json`. Satu dependensi runtime: `three`. Sisanya alat dev.
- Browser Playwright hanya untuk tes e2e, tidak untuk build.

## 2. Build rilis

```
npm ci
npm run build          # npm run data, lalu vite build ke dist/
npm run bundle:check   # gerbang rilis, wajib lulus sebelum deploy
npm run preview        # opsional: sajikan dist/ di http://localhost:4173/shardfall/
```

Gerbang lengkap sebelum menyerahkan build: `npm run check` (data, art, arena, audio, format, typecheck, lint, unit, build, bundle). E2E lokal: `npm run test:e2e`.

Hasil `dist/`:

| File | Isi |
|---|---|
| `index.html` | Halaman, favicon inline, memuat chunk awal dari `/shardfall/assets/` |
| `assets/index-*.js`, `assets/index-*.css` | Chunk awal: game, data, string Inggris, three.js |
| `assets/audio-*.js` | Chunk audio (lazy, dimuat saat idle atau gestur pertama) |
| `assets/render-worker-*.js` | Web Worker render audio |
| `assets/id-*.js` | String Indonesia (lazy, hanya `?lang=id`) |
| `third-party-licenses.txt` | Teks lisensi kode pihak ketiga yang masuk build (three, vite, rolldown) |

## 3. Mode build

`vite.config.ts` memilih perilaku dari `command` dan `mode`.

| Perintah | Keluaran | Base | `__E2E__` | `__DEV_TOOLS__` | Source map |
|---|---|---|---|---|---|
| `npm run dev` | server dev | `/` | false | true | inline (dev) |
| `npm run build` | `dist/` | `/shardfall/` | false | false | tidak |
| `npm run preview` | sajikan `dist/` | `/shardfall/` | false | false | tidak |
| `npm run build:e2e` | `dist-e2e/` | `/` | true | true | ya |

- `__E2E__` dan `__DEV_TOOLS__` adalah konstanta `define`. Di build rilis keduanya `false`, jadi hook tes (`src/app/e2e/hooks.ts`, dimuat dengan import dinamis di cabang `__E2E__`), log debug, dan pembeku data dev hilang karena tree shaking.
- `__APP_VERSION__` diisi dari `package.json` `version` dan tampil di baris kredit layar judul (`ui.title.credit_line`, `v{version}`). Satu sumber versi: ubah `package.json`, bukan string.
- Label `Build <hash>` di pojok judul adalah 8 karakter `contentHash` data, untuk melacak laporan bug ke isi data yang tepat.
- `vite preview` berjalan dengan `command = 'serve'`; base `/shardfall/` juga dipakai saat `isPreview` agar preview lokal sama dengan Pages.

## 4. Cek bundle (`npm run bundle:check`)

`tools/bundle/check-bundle.ts` membaca `dist/` setelah build. Gagal (kode keluar 1) bila:

1. JS awal gzip di atas 400 KB, atau halaman pertama gzip di atas 600 KB. Target 300 KB dan 400 KB hanya memberi WARN.
2. Ada `__shardfall` (objek hook e2e) di file JS atau HTML, atau chunk `hooks-*.js`.
3. Ada konstanta build yang tidak terganti: `__E2E__`, `__DEV_TOOLS__`, `__APP_VERSION__`.
4. Build rilis berisi file `.map` atau komentar `sourceMappingURL`.
5. `index.html` memuat URL di luar `/shardfall/`.
6. Ada halaman dev atau tes (`preview.html`, `hd2d.html`, folder `dev/`).
7. `third-party-licenses.txt` tidak ada.

Angka M5-01 (2026-11-17): JS awal 276,4 KB, halaman pertama 282,9 KB, lazy dan worker 42,9 KB.

Pemeriksaan manual tambahan M5-01 pada `dist/` (semua nol): `__shardfall`, `__E2E__`, `__DEV_TOOLS__`, `sourceMappingURL`, `localhost`, path disk lokal. Sisa yang diterima:

- Penangan perintah `debug.*` di sim tetap ada di bundle karena sim dipakai bersama tes Node. Di rilis sim dibuat dengan `debugCommands: false`, jadi setiap perintah debug ditolak (`DebugDisabled`). Tidak ada jalur dari halaman ke command sink selain UI.
- Catatan deskripsi di JSON sprite ikut terbundel sebagai string. Tidak berbahaya, ukurannya kecil.

## 5. Kompatibilitas saat start

- Tanpa WebGL2: `boot.ts` mengecek `getContext('webgl2')` sebelum membuat apa pun dan menampilkan layar penuh `ui.error.webgl2`.
- WebGL2 ada tetapi renderer gagal dibuat (GPU diblokir, batas konteks): pesan yang sama, error tercatat di konsol.
- Error lain saat boot: `main.ts` memanggil `reportBootFailure`, layar `ui.error.boot`, lalu error tetap dilempar agar terlihat di konsol dan tes (`pageerror`).
- localStorage diblokir, penuh, atau tidak ada: `src/app/storage.ts` memakai salinan memori untuk sesi itu. Pengaturan, meta, dan autosave tidak bertahan setelah tab ditutup, tetapi game tetap jalan. Tes: `tests/unit/app/storage.test.ts`.
- Diverifikasi M5-01 di Chromium dan Firefox Playwright terhadap `dist/`: judul menampilkan `v1.0.0`, run bisa dimulai dengan localStorage diblokir, layar fallback tampil saat WebGL2 dimatikan dan saat konteks kanvas game gagal.

## 6. Deploy GitHub Pages

- Workflow `.github/workflows/pages.yml` berjalan pada push ke `main` (dan manual): `npm ci`, `npm run build`, `npm run bundle:check`, unggah `dist/`, deploy. Bila cek bundle gagal, tidak ada deploy.
- Pengaturan repo sekali saja: Settings, Pages, Source = GitHub Actions.
- URL: `https://arthamegayasa.github.io/shardfall/`. Nama repo menentukan base. Bila repo diganti nama, ubah `base` di `vite.config.ts` dan `PAGES_BASE` di `tools/bundle/check-bundle.ts`.
- CI (`.github/workflows/ci.yml`) pada push dan PR: typecheck, lint, unit, `data:check`, build, `bundle:check`. E2E dan perf hanya lokal.
- Rilis 1.0: naikkan `version` di `package.json` (dan dua entri akar di `package-lock.json`), jalankan `npm run check`, lalu Producer meng-commit dan push. Tag git (misalnya `v1.0.0`) dibuat Producer.

## 7. Rollback

Pages selalu menyajikan hasil deploy terakhir. Untuk mundur: revert commit di `main` lalu push, atau jalankan ulang workflow Pages secara manual dari commit lama (`workflow_dispatch` pada ref tersebut).

## 8. Masalah umum

| Gejala | Penyebab | Tindakan |
|---|---|---|
| Halaman putih, aset 404 di preview | Base salah | Pakai `npm run preview` (base `/shardfall/`), buka `/shardfall/` |
| `bundle:check` gagal: `__shardfall` | Hook e2e lolos ke rilis | Pastikan impor hook hanya di cabang `if (__E2E__)` |
| `bundle:check` gagal: ukuran | Chunk awal membengkak | Pindahkan modul berat ke import dinamis (pola `lazy-audio.ts`) |
| `data:check` gagal setelah edit CSV | `content/generated/` basi | `npm run data` |
