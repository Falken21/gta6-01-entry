# Costa Serena — Kota Pesisir yang Hidup

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

Game open-world kriminal 3D orisinal untuk bounty make.fun **gta6-01** — "Make GTA 6".
Bukan tiruan GTA: semua nama, karakter, dan cerita adalah ciptaan sendiri.

## Cerita

Rafi, montir kapal di kota pesisir **Costa Serena**, harus melunasi utang kakaknya —
satu misi demi satu misi, dari antar paket di marina sampai pelarian terakhir ke kapal.

## Yang bisa dimainkan

- **Kota hidup**: grid pusat kota, marina dengan air beranimasi dan kapal bergoyang,
  pantai berpasir, palem bergoyang, lalu lintas yang menjaga jalur, pejalan kaki
  yang **panik dan lari** saat ada tembakan, tabrakan, atau kejaran polisi.
- **Mobil**: curi mobil parkir atau mobil yang berhenti (E), menyetir dengan fisika
  berbobot — akselerasi, rem tangan, body roll, roda berbelok & berputar, lampu rem,
  lampu depan malam hari, asap kerusakan.
- **Polisi**: wanted 1–5 bintang, mobil polisi mengejar dan menabrak, bersembunyi
  di balik gedung untuk menurunkan bintang.
- **Misi**: 5 misi cerita berantai + kegiatan sampingan (taksi, balapan, paket kilat).
  Setiap misi punya **objektif sekunder dengan bonus cash**.
- **Radio prosedural** saat menyetir (R ganti stasiun) — synth WebAudio, tanpa aset.
- **Cuaca & waktu**: golden hour, siklus hari, hujan 3D sungguhan (partikel jatuh +
  cipratan + jalan basah mengilap), langit bergradasi, awan, kabut jarak.
- **Visual**: shadow map, ACES tone mapping, tekstur prosedural (aspal aus, fasad
  gedung berjendela menyala, trotoar, pasir, zebra cross), kamera sinematik.

## Kontrol

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Jalan / menyetir |
| Shift | Lari |
| E | Masuk / keluar mobil (curi mobil) |
| F / klik | Tembak |
| Spasi | Pukul / rem tangan |
| M | Mulai misi berikutnya |
| 1 / 2 / 3 | Taksi / balapan / paket kilat |
| R | Ganti stasiun radio |
| N | Bisu |
| P / Esc | Jeda |

## Cara main

Buka `game/index.html` di desktop Chrome — tanpa server, tanpa jaringan.
Progres misi dan kas tersimpan di localStorage.

## Struktur kode (`game/src/`)

Satu berkas, satu tugas: `config`, `city`, `textures`, `traffic`, `pedestrians`,
`player`, `vehicles`, `police`, `combat`, `missions`, `hud`, `audio`, `weather`,
`save`, `main`. Three.js dipakai sebagai satu build modul vendored
(`game/vendor/three.module.min.js`).

## Lisensi

Lihat `LICENSE`.
