// Costa Serena — traffic.js
// Lalu lintas sipil: mobil mengikuti grid jalan, menjaga jarak dengan mobil
// di depan, berbelok di persimpangan, plus mobil parkir di tepi jalan yang
// bisa dicuri pemain. Sopir kabur saat mobilnya dicuri.
import { CFG, makeRng, clamp } from './config.js';
import { makeVehicle } from './vehicles.js';

const CIV_KINDS = ['sedan', 'hatch', 'sedan', 'taxi', 'pickup', 'sport', 'hatch'];

export function spawnTraffic(S, THREE) {
  const rng = makeRng(CFG.seed + 21);
  S.traffic = [];
  S.parked = [];
  const roads = [];
  for (let v = -160; v <= 160; v += CFG.roadGap) roads.push(v);
  for (let i = 0; i < 14; i++) {
    const horizontal = rng.chance(0.5);
    const road = roads[Math.floor(rng.next() * roads.length)];
    const along = rng.range(-160, 160);
    const lane = (rng.chance(0.5) ? 1 : -1) * 2.6;
    const dir = rng.chance(0.5) ? 1 : -1;
    const kind = CIV_KINDS[Math.floor(rng.next() * CIV_KINDS.length)];
    const x = horizontal ? along : road + lane;
    const z = horizontal ? road + lane : along;
    const angle = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const v = makeVehicle(S, THREE, kind, x, z, angle);
    v.speed = rng.range(6, 11);
    v.cruise = v.speed;
    v.horizontal = horizontal;
    v.road = road;
    v.dir = dir;
    v.lane = lane;
    S.traffic.push(v);
  }
  // mobil parkir di tepi jalan
  for (let i = 0; i < 10; i++) {
    const road = roads[Math.floor(rng.next() * roads.length)];
    const along = rng.range(-150, 150);
    const side = rng.chance(0.5) ? 1 : -1;
    const kind = CIV_KINDS[Math.floor(rng.next() * CIV_KINDS.length)];
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : road + side * 7.6;
    const z = horizontal ? road + side * 7.6 : along;
    const angle = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const v = makeVehicle(S, THREE, kind, x, z, angle);
    v.speed = 0;
    v.parked = true;
    S.parked.push(v);
  }
}

export function updateTraffic(S, dt) {
  for (const v of S.traffic) {
    // mobil di depan pada jalur yang sama?
    let ahead = null, aheadD = 1e9;
    for (const o of S.traffic) {
      if (o === v) continue;
      if (o.horizontal !== v.horizontal) continue;
      if (Math.abs((o.horizontal ? o.z : o.x) - (v.horizontal ? v.z : v.x)) > 3) continue;
      const d = (o.horizontal ? (o.x - v.x) * v.dir : (o.z - v.z) * v.dir);
      if (d > 0 && d < aheadD) { aheadD = d; ahead = o; }
    }
    let target = v.cruise;
    if (ahead && aheadD < 11) target = aheadD < 6 ? 0 : ahead.speed * 0.8;
    v.speed = v.speed + clamp(target - v.speed, -8 * dt, 5 * dt);
    const step = v.speed * v.dir * dt;
    if (v.horizontal) v.x += step; else v.z += step;
    // sampai ujung jalan: putar balik arah di persimpangan terdekat
    const pos = v.horizontal ? v.x : v.z;
    if (pos * v.dir > 168) {
      v.dir *= -1;
      v.lane *= -1;
      if (v.horizontal) { v.z = v.road + v.lane; v.angle = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { v.x = v.road + v.lane; v.angle = v.dir > 0 ? 0 : Math.PI; }
      if (v.horizontal) v.x = clamp(v.x, -168, 168); else v.z = clamp(v.z, -168, 168);
    }
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.angle;
    v.wheelSpin += (v.speed / 0.36) * dt;
    for (const w of v.mesh.userData.wheels) w.spin.rotation.y = v.wheelSpin;
  }
}

// Mobil terdekat dari sebuah titik (untuk tombol curi mobil / E).
export function nearestVehicle(S, x, z, maxD) {
  let best = null, bestD = maxD;
  for (const v of S.vehicles) {
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}
