// Costa Serena — config.js
// Satu sumber kebenaran untuk konstanta, seed, dan helper matematika game.
// Semua sistem lain mengimpor dari sini supaya tuning terpusat dan deterministik.
export const CFG = {
  seed: 20261122,
  worldHalf: 210, // kota membentang -210..210 meter di x dan z
  roadGap: 40, // jarak antar jalan pada grid kota
  roadHalfWidth: 5,
  walkSpeed: 4.2,
  runSpeed: 7.5,
  carAccel: 14,
  carBrake: 26,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  carSteerMax: 0.55,
  policeMaxSpeed: 37,
  pedWalkSpeed: 1.4,
  pedRunSpeed: 5.2,
  gravity: 22,
  playerHealthMax: 100,
  wantedMax: 5,
  missionReward: [400, 650, 500, 800, 1500],
  sideBonus: 150,
  saveKey: 'costa-serena-save-v1',
};

export const TAU = Math.PI * 2;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }
export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// RNG deterministik (mulberry32) — screenshot mode memakai seed dari URL.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(a, b) { return a + next() * (b - a); },
    int(a, b) { return Math.floor(a + next() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
  };
}

export const PALETTE = {
  asphalt: 0x2e2f33,
  sidewalk: 0x8a8578,
  sand: 0xd9c08a,
  sea: 0x1d6f8e,
  seaDeep: 0x0e4a66,
  building: [0xc9a06a, 0xb98a7a, 0x9fb4c0, 0xd8cdb4, 0xa88f6d, 0x7e9aa8, 0xe0d3b8, 0x8fa3a0],
  carPaint: [0xb02020, 0x2050b0, 0xe0c020, 0x20a080, 0xd0d0d0, 0x303030, 0x8040a0, 0xe07a20, 0x406080, 0x903030],
  shirt: [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xe0c040, 0xffffff, 0x303030, 0xd88a4a, 0x8a4ad8, 0x40b0b0, 0xc0c0c0],
  skin: [0xe8b98a, 0xc98a5a, 0x8a5a30, 0xf0c8a0, 0xa06a40],
  palmTrunk: 0x7a5a38,
  palmLeaf: 0x2e7a3a,
};
