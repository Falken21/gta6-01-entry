// Costa Serena — traffic.js
// Lalu lintas sipil: mobil mengikuti loop persegi di sekitar blok, menjaga
// lajur & jarak dengan mobil di depan; mobil parkir di tepi jalan yang
// bisa dicuri (pengemudi kabur saat dicuri).
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { createVehicle, CAR_TYPES } from './vehicles.js';

const TRAFFIC_COLORS = [0x8a2f2a, 0x2a6ea8, 0xd8d2c4, 0x4a5a3a, 0x6a4a7a, 0x3a3a3a, 0xc2c8cc, 0x7a5a28];

export function createTraffic(W) {
  const cars = [];
  const parked = [];
  const types = ['sedan', 'hatch', 'taxi', 'pickup', 'van', 'sport'];

  function loopAroundBlock(bx, bz, margin = 13) {
    // loop persegi searah jarum jam di jalan sekitar satu blok
    return [
      { x: bx - margin, z: bz - margin }, { x: bx + margin, z: bz - margin },
      { x: bx + margin, z: bz + margin }, { x: bx - margin, z: bz + margin },
    ];
  }
  function spawnTrafficCar(i) {
    const ax = CFG.avenues[1 + (i % (CFG.avenues.length - 2))];
    const sz = CFG.streets[i % CFG.streets.length];
    const type = types[i % types.length];
    const wps = loopAroundBlock(ax + 30, sz + 30, 16);
    const v = createVehicle(W, type, wps[0].x, wps[0].z, 0, {
      color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
      driver: 'traffic',
      ai: { waypoints: wps, idx: 1, speed: 7 + W.rng() * 4 },
    });
    cars.push(v);
    return v;
  }
  for (let i = 0; i < CFG.trafficCars; i++) spawnTrafficCar(i);

  // mobil parkir di tepi jalan (bisa dicuri)
  for (let i = 0; i < CFG.parkedCars; i++) {
    const ax = CFG.avenues[i % CFG.avenues.length];
    const sz = CFG.streets[Math.floor(i / CFG.avenues.length) % CFG.streets.length] + 24;
    const type = types[(i + 2) % types.length];
    const heading = (i % 2 === 0) ? 0 : Math.PI;
    const v = createVehicle(W, type, ax + 5.2, sz, heading, {
      color: TRAFFIC_COLORS[(i + 3) % TRAFFIC_COLORS.length],
      driver: 'parked',
    });
    parked.push(v);
  }

  function nearestStealable(x, z, maxD = 4) {
    let best = null, bd = maxD;
    for (const v of [...parked, ...cars]) {
      if (v.driver === 'player' || v.stolen) continue;
      if (v.driver === 'traffic' && v.speed > 0.5) continue; // hanya mobil berhenti
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  function update(dt) {
    // jarak antar mobil: perlambat bila terlalu dekat dengan yang di depan
    for (const v of cars) {
      let slow = false;
      for (const o of cars) {
        if (o === v) continue;
        const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 9) {
          const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
          const dot = (dx * fx + dz * fz) / Math.max(d, 0.01);
          if (dot > 0.6) { slow = true; break; }
        }
      }
      // jangan tabrak pemain yang sedang jalan di jalan
      if (W.player) {
        const dx = W.player.pos.x - v.pos.x, dz = W.player.pos.z - v.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 7) {
          const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
          if ((dx * fx + dz * fz) / Math.max(d, 0.01) > 0.6) slow = true;
        }
      }
      v.ai.slowFor = slow;
      v.update(dt);
    }
    for (const v of parked) v.update(dt);
  }

  return { cars, parked, update, nearestStealable };
}
