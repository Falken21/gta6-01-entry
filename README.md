# Costa Serena — Open-World Crime Game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

Entry **make.fun gta6-01** — game kriminal open-world 3D original berbahasa Indonesia,
dibangun dengan three.js (tanpa aset eksternal: semua tekstur, suara, dan musik
disintesis prosedural di dalam game).

## Cerita

**Rafi**, mekanik kapal yang kakaknya berutang pada orang yang salah, harus
menyelesaikan lima misi melintasi kota pesisir **Costa Serena**: antar paket ke
marina, kabur dari kejaran polisi, taksi kilat, balap pantai, dan pelarian terakhir.
Curi mobil, hindari bintang wanted, dan kejar bonus objektif sekunder di tiap misi.

## Yang ada di dalam game

- **Kota hidup**: grid jalan dengan marka dan zebra cross, gedung berfasad dengan
  jendela menyala di malam hari, palem bergoyang, marina dengan perahu yang
  mengapung, pantai berpasir, dan laut beranimasi.
- **Lalu lintas & pejalan kaki**: mobil sipil menjaga jalur dan jarak, sopir kabur
  saat mobilnya dicuri; pejalan kaki berartikulasi yang **panik dan lari** saat ada
  tembakan, tabrakan, atau kejaran polisi di dekatnya.
- **Kendaraan multi-bagian**: kabin berkaca, roda berputar dan membelok, lampu rem
  dan lampu depan, body roll/pitch, asap kerusakan — bukan kotak kaku.
- **Polisi & wanted 1–5 bintang**: mobil polisi mengejar dan menabrak, strobo
  merah-biru, sirene mengikuti jarak; bersembunyi cukup lama menurunkan bintang.
- **Misi + sampingan**: 5 misi cerita berpenanda suar, timer, dan **objektif
  sekunder + bonus cash** (tanpa tabrakan, di bawah waktu target, mobil mulus).
- **Cuaca & siklus hari**: golden hour, siang, malam, dan hujan dengan partikel
  3D, angin, serta **jalan basah yang memantulkan cahaya**.
- **Suara synth**: deru mesin mengikuti RPM, sirene, klakson, tembakan, dan
  **radio prosedural** yang hanya berbunyi saat menyetir (M untuk bisu).
- **HUD lengkap**: bintang wanted, kesehatan, cash, objektif + jarak, kecepatan,
  dan minimap hidup (jalan, pemain, polisi, penanda misi). Progres tersimpan
  otomatis di localStorage.

## Kontrol

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Jalan / menyetir |
| E | Masuk & keluar mobil (curi mobil parkir) |
| F / klik mouse | Tembak (jalan kaki) |
| Shift | Lari |
| Spasi | Rem tangan |
| Drag mouse | Orbit kamera |
| P / Esc | Jeda / lanjut |
| M | Bisu / hidupkan suara |
| Enter | Mulai misi |
| R | Ulang setelah game over |

## Cara main

Sajikan `game/` dengan server statis apa pun, lalu buka `game/index.html` di
desktop Chrome. Tanpa permintaan jaringan saat bermain — semua yang dimuat
adalah berkas di bawah `game/`.

```bash
cd game && python3 -m http.server 8123
# buka http://127.0.0.1:8123/index.html
```

Mode screenshot deterministik: `?shot=chase|walk|coast|night&seed=<n>`.

## Struktur kode (`game/src/`, satu berkas satu tugas)

`config.js` konstanta & RNG · `textures.js` tekstur prosedural · `city.js` kota &
collider · `vehicles.js` model & fisika mobil · `traffic.js` lalu lintas &
mobil parkir · `pedestrians.js` pejalan kaki & kepanikan · `player.js` kontrol
Rafi · `police.js` wanted & pengejaran · `combat.js` tembakan · `missions.js`
rantai misi & bonus · `hud.js` HUD & minimap · `audio.js` suara & radio synth ·
`weather.js` siklus hari, hujan & jalan basah · `save.js` penyimpanan ·
`main.js` boot, loop & kamera.

Semua nama, karakter, tempat, dan cerita adalah karya original — bukan dari
franchise game mana pun.
