// Costa Serena — config, seeded RNG and shared math helpers.
// All gameplay randomness flows through makeRng so runs are reproducible.
import * as THREE from 'three';

export const CFG = {
  seed: 20261117,
  world: { halfX: 170, halfZ: 150, seaX: 168, beachX0: 148 },
  roads: { avenues: [-140, -100, -60, -20, 20, 60, 100, 140], streets: [-120, -80, -40, 0, 40, 80, 120], width: 10, sidewalk: 3.2 },
  player: { walkSpeed: 4.2, runSpeed: 7.4, radius: 0.55, health: 100 },
  car: { accel: 14, brake: 26, reverseAccel: 9, maxSpeed: 38, maxReverse: 10, grip: 2.6, drag: 0.35 },
  traffic: { count: 14, speed: 9, gap: 7 },
  peds: { count: 26 },
  police: { maxCars: 5, chaseSpeed: 34, spawnDist: 70 },
  wanted: { decayDelay: 9, decayPerStar: 14 },
  day: { startHour: 17.5, dayLengthSec: 480 }, // full 24h in 8 minutes
  shots: {
    chase: { hour: 17.6, rain: 0, wanted: 3, mode: 'car' },
    walk: { hour: 10.5, rain: 0, wanted: 0, mode: 'foot' },
    coast: { hour: 13.0, rain: 0, wanted: 0, mode: 'car' },
    night: { hour: 21.5, rain: 1, wanted: 2, mode: 'car' },
  },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function angLerp(a, b, t) { return a + angDiff(a, b) * t; }

// Circle (x,z,r) vs AABB {minX,maxX,minZ,maxZ}: push the circle out, return hit flag.
export function resolveCircleAABB(px, pz, r, box) {
  const cx = clamp(px, box.minX, box.maxX);
  const cz = clamp(pz, box.minZ, box.maxZ);
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), z: (dz / d) * (r - d), hit: true };
  }
  // Centre inside the box: push out along the smallest penetration axis.
  const pl = px - box.minX + r, pr = box.maxX - px + r;
  const pt = pz - box.minZ + r, pb = box.maxZ - pz + r;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: -pl, z: 0, hit: true };
  if (m === pr) return { x: pr, z: 0, hit: true };
  if (m === pt) return { x: 0, z: -pt, hit: true };
  return { x: 0, z: pb, hit: true };
}

export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
