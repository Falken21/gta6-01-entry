# Costa Serena

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

**Costa Serena** — game open-world kriminal 3D original untuk bounty make.fun
**gta6-01** ("Make GTA 6"). Kota pantai fiktif yang hidup: jalan kaki dan
menyetir, lalu lintas, pejalan kaki, polisi dengan sistem wanted 1–5 bintang,
misi cerita, dan siklus siang–malam dengan hujan.

## Cerita

Rafi, montir kapal di Costa Serena, harus melunasi utang kakaknya sebelum
orang yang salah datang menagih. Lima misi membawanya dari bengkel ke
pelabuhan, balapan pantai, kerja kapal di marina, sampai pelarian terakhir
di gerbang utara — dengan objektif sekunder berbonus cash di tiap misi.

## Cara main

| Kontrol | Aksi |
|---|---|
| WASD / panah | Jalan kaki / menyetir |
| Mouse (drag) | Putar kamera |
| E | Masuk / keluar mobil (curi mobil parkir atau yang berhenti) |
| Klik | Tembak |
| Spasi | Rem tangan |
| Shift | Lari |
| N | Mulai / lanjut misi |
| R | Radio synth nyala / mati |
| M | Bisu |
| P | Jeda |

## Sistem

- **Kota prosedural** — grid jalan, gedung berfasad tekstur dengan jendela
  menyala di malam hari, palem bergoyang, marina dengan perahu, pantai & laut
  beranimasi.
- **Lalu lintas** — mobil sipil menjaga lajur dan jarak, mobil parkir bisa
  dicuri (pengemudi kabur).
- **Pejalan kaki** — terartikulasi, berjalan di trotoar, duduk di bangku, dan
  **panik/lari** saat ada tembakan, tabrakan, atau kejaran polisi.
- **Mobil** — model multi-bagian: kabin berkaca, roda berputar & membelok,
  lampu rem, lampu depan, asap kerusakan; fisika berbobot (body roll, grip).
- **Polisi** — wanted 1–5, mobil patroli mengejar dan menjepit, lightbar
  merah-biru memantul di jalan; sembunyi sampai bintang padam.
- **Misi** — 5 misi cerita + kerja sampingan (taksi, balap, paket kilat);
  tiap misi punya objektif sekunder dengan bonus cash.
- **Cuaca** — golden hour, siklus hari, hujan partikel 3D dengan percikan,
  jalan basah memantul (roughness turun + genangan).
- **Audio** — semua suara disintesis WebAudio: mesin per RPM, sirene,
  ambience kota, dan **radio synth prosedural** saat menyetir.
- **Visual** — ACES tone mapping, bayangan PCFSoft, fog jarak, tekstur
  prosedural (aspal aus, fasad, trotoar, pasir, zebra cross), kamera
  sinematik (FOV melebar dengan kecepatan, shake saat tabrakan).

## Teknis

- `game/` — statis, tanpa build step, **nol request jaringan** saat bermain.
- `game/vendor/three.module.min.js` — three.js 0.180.0 (vendored).
- `main.ts` — hand-in: menyalin `game/` + `screenshots/` ke output dan
  menulis `dossier.json` via `buildDossier` dari `vendor/makefun-game.ts`.
- Screenshot deterministik: `game/index.html?shot=chase|walk|coast|night&seed=<n>`.

Dibangun untuk make.fun gta6-01 · © 2026 Falken21 · MIT
