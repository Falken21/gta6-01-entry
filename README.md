# Costa Serena — make.fun gta6-01 entry

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Falken21/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty ("Make GTA 6").
Sun-soaked coastal city, living traffic, pedestrians, a five-mission story, wanted
levels with police pursuit, day/night cycle and rain — all in one offline
Three.js game with zero network requests.

## The game

**Costa Serena** is a city of our own invention: palm-lined boulevards, a marina,
art-deco hotels, a downtown grid and beaches. You are **Rafi**, a 27-year-old boat
mechanic whose younger brother Dimas owes money to the wrong people. Five story
missions — a marina meeting, a timed delivery, losing a police dragnet, a coastal
street race, and a final boat getaway — are the only way to clear the debt.

- **Drive anything**: steal any parked or stopped car (sedan, taxi, pickup, police
  cruiser) — each with weight, body roll, spinning and steering wheels, brake
  lights, headlight cones at night and damage smoke.
- **Living city**: traffic that keeps lanes and gaps, articulated pedestrians who
  walk, wait and flee, a day cycle with golden hour and lit windows at night,
  rain with wet-road sheen, an animated marina.
- **Wanted system**: crimes raise 1–5 stars; police cars spawn and pursue with
  ramming behaviour. Break line of sight and hide to cool down — or get busted.
- **Combat**: fists and a pistol, with consequences.
- **Side work**: package pickups (+$50) scattered around the city.
- **Sound**: fully synthesised WebAudio — engine by RPM, two-tone sirens, city
  ambience. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Run |
| Mouse drag | Orbit camera |
| E | Enter / exit car (or board the boat) |
| Space | Handbrake |
| F | Punch |
| Click | Shoot |
| N | Start next mission |
| M | Mute |
| Esc / P | Pause |

## Play it

Open `game/index.html` in a desktop browser — no build step, no server needed
(a static server works too). Everything loads from `game/` or data URIs.

Deterministic screenshot scenes: `game/index.html?shot=chase|walk|coast|night&seed=42`.

## Hand-in

`main.ts` (Node 22, no dependencies) copies `game/` and `screenshots/` into
`$MAKEFUN_OUTPUT_DIR` and writes `dossier.json` via the kit's
`vendor/makefun-game.ts`:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/costa-serena-out node main.ts
```

## Credits

Built with Three.js (vendored `game/vendor/three.module.min.js` + `three.core.min.js`,
r180). All art is procedural — canvas-painted textures and code-built models.
All names, places and story are original; no GTA names, logos or assets.
