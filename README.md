# Costa Serena

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty — a
sun-soaked coastal city you explore on foot and by car, with traffic,
pedestrians, a wanted system with pursuing police, combat, and a five-mission
story. Everything is original: our own city, characters, vehicles, names and
story. Nothing is copied from any commercial game.

## The game

You are **Rafi**, a boat mechanic in Costa Serena whose brother owes money to
the wrong people. Five story missions pull you through the city — a first
delivery for Dario, a police escape at the marina, a taxi shift for Mira, a
coastal street race against Kiko's clock, and a final night boat job in the
rain that settles the debt. Every mission carries a **secondary objective**
worth bonus cash: deliver without a scratch, escape in under 90 seconds, drive
a clean taxi shift, beat 75 seconds on the race, finish the last job with zero
wanted stars.

Between missions the city stays alive: civilian traffic keeps its lanes and
stops at junctions, pedestrians walk the pavements and **panic and run** when
gunfire, crashes or a chase erupt nearby, the sun moves through a full day
cycle — golden hour, dusk windows, night headlights — and rain rolls in with
wet-road sheen. Steal any parked car (drivers bail out), drive with weight and
body roll, and watch the wanted stars climb when someone sees the theft.

## How to play

Open `game/index.html` in a desktop browser. No build step, no network: the
game is static files, and every texture, sound and model is generated in code.

- **WASD** — walk / drive · **Shift** — run · **Space** — handbrake
- **E** — enter / exit a car (steal any parked one)
- **2** then **click / F** — pistol · **V** — melee
- **M** — start the next story mission · **T** — taxi fare · **U** — package pickup
- **R** — procedural radio while driving · **N** — mute · **P / Esc** — pause
- Drag the mouse to orbit the camera, scroll to zoom.

Progress (cash, unlocked missions) saves in the browser.

## Inside the build

- `game/src/config.js` — tuning constants and the seeded RNG
- `game/src/textures.js` — procedural canvas textures: worn asphalt, lit-window facades, pavements, sand, crosswalks, water
- `game/src/city.js` — road grid, buildings, palms, streetlights, marina, beach
- `game/src/traffic.js` — civilian cars in lanes, parked cars to steal
- `game/src/pedestrians.js` — articulated walkers with panic and flight
- `game/src/player.js` — Rafi on foot and the cinematic chase camera
- `game/src/vehicles.js` — car models and arcade driving physics
- `game/src/police.js` — wanted stars 1–5, pursuit and ramming, heat cooldown
- `game/src/combat.js` — hitscan pistol, melee, tracers
- `game/src/missions.js` — the five-mission story chain and side jobs
- `game/src/hud.js` — HUD, live minimap, title / pause / game-over screens
- `game/src/audio.js` — WebAudio synthesis: engine, sirens, procedural radio
- `game/src/weather.js` — day cycle, gradient sky, clouds, rain
- `game/src/save.js` — localStorage persistence
- `game/src/main.js` — boot, game loop, input, screenshot scenes
- `game/vendor/three.module.min.js` — vendored three.js 0.180.0
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` via `buildDossier`

## Screenshots

Four real renders of the running game, taken from its deterministic scenes
(`?shot=<scene>&seed=<n>`):

1. `chase.jpg` — police pursuit at golden hour, full HUD
2. `walk.jpg` — Rafi on foot in downtown Costa Serena
3. `coast.jpg` — coastal drive in daylight
4. `night.jpg` — the night boat job in the rain

## License

SPDX-License-Identifier: MIT — see `LICENSE`.
