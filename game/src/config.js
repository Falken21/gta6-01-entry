// Costa Serena — config.js
// One job: every tunable constant, the seeded RNG, and small math helpers.
// All gameplay randomness flows through mulberry32 so a seed reproduces a run.
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smooth(t) { return t * t * (3 - 2 * t); }
// Shortest signed angle difference, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
export function range(rng, a, b) { return a + rng() * (b - a); }

// ---- World tuning -------------------------------------------------------
export const CFG = {
  seed: 20261119,
  // City: a 9x9 block grid, 44 m pitch, roads 12 m wide, world spans about +-220 m.
  blockPitch: 44,
  roadWidth: 12,
  gridHalf: 4,            // roads at -4..+4 grid lines
  worldHalf: 212,         // playable bounds
  beachX: -196,           // sand starts west of this line
  waterX: -232,           // marina water plane centre line
  // Player on foot
  walkSpeed: 5.2,
  runSpeed: 9.0,
  playerRadius: 0.55,
  playerHealth: 100,
  // Driving
  carTopSpeed: 34,        // m/s, about 122 km/h
  carAccel: 13,
  carBrake: 26,
  carReverseTop: 9,
  carGrip: 2.4,           // steering authority
  carRadius: 1.7,
  // Police / wanted
  wantedMax: 5,
  wantedDecayDelay: 9,    // seconds without a crime before stars start draining
  wantedDecayRate: 0.12,  // stars per second while hidden
  policeTopSpeed: 36,
  policeSpawnDist: 70,
  // Combat
  pistolDamage: 34,
  pistolCooldown: 0.28,
  pistolRange: 60,
  // Day cycle: one full day is 6 minutes of real time; start at golden hour.
  dayLengthSec: 360,
  startHour: 17.55,
  // Missions
  missionCash: [400, 700, 900, 1200, 2000],
  secondaryBonus: [150, 250, 300, 400, 600],
  // Screenshot scenes
  shotFrames: 60,         // frames to settle a composed shot before freezing
};

export const COLOURS = {
  skyDay: new THREE.Color(0x7fb4dd),
  skyGolden: new THREE.Color(0xff9e57),
  skyDusk: new THREE.Color(0x2c3e63),
  skyNight: new THREE.Color(0x0a1226),
  fogDay: new THREE.Color(0xa8c6de),
  fogGolden: new THREE.Color(0xe8a06a),
  fogNight: new THREE.Color(0x0c1424),
  sunDay: new THREE.Color(0xfff2d8),
  sunGolden: new THREE.Color(0xffb36b),
  sunNight: new THREE.Color(0x5a6f9e),
};
