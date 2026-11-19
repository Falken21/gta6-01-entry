// Costa Serena — traffic.js
// Civilian cars following the road network: lane discipline, junction pauses,
// keeping a gap to the car ahead, parked cars along kerbs (stealable).
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, mulberry32, clamp } from './config.js';
import { Car } from './vehicles.js';

const KINDS = ['sedan', 'hatch', 'taxi', 'sedan', 'pickup', 'hatch'];
const COLORS = [0xc0392b, 0x2e6fb0, 0xe0a030, 0x3a9e6a, 0xd8d8d8, 0x22262c, 0x8e44ad];

export class Traffic {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.cars = []; this.parked = [];
    const r = mulberry32(202);
    const pitch = WORLD.block + WORLD.road;
    // moving traffic: pick a road axis + lane offset, cruise with stops
    for (let i = 0; i < 16; i++) {
      const vertical = r() < 0.5;
      const lane = (Math.floor(r() * 7) - 3) * pitch;
      const along = (r() - 0.5) * 340;
      const x = vertical ? lane + (r() < 0.5 ? 3.4 : -3.4) : along;
      const z = vertical ? along : lane + (r() < 0.5 ? 3.4 : -3.4);
      const heading = vertical ? (x > lane ? Math.PI : 0) : (z > lane ? -Math.PI / 2 : Math.PI / 2);
      const car = new Car(scene, KINDS[i % KINDS.length], COLORS[Math.floor(r() * COLORS.length)], x, z, heading);
      car.cruise = 7 + r() * 5; car.axis = vertical ? 'z' : 'x'; car.dir = vertical ? (x > lane ? -1 : 1) : (z > lane ? -1 : 1);
      car.wait = 0; car.lane = lane;
      this.cars.push(car);
    }
    // parked cars along kerbs — the stealable fleet
    for (let i = 0; i < 14; i++) {
      const lane = (Math.floor(r() * 7) - 3) * pitch;
      const along = (r() - 0.5) * 330;
      const vertical = r() < 0.5;
      const x = vertical ? lane + 5.6 : along;
      const z = vertical ? along : lane + 5.6;
      if (z > 195) continue;
      const heading = vertical ? 0 : Math.PI / 2;
      const car = new Car(scene, KINDS[(i + 2) % KINDS.length], COLORS[Math.floor(r() * COLORS.length)], x, z, heading);
      car.speed = 0; this.parked.push(car);
    }
  }
  nearestStealable(x, z, maxD = 4.5) {
    let best = null, bd = maxD;
    for (const c of this.parked) {
      const d = Math.hypot(c.group.position.x - x, c.group.position.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    for (const c of this.cars) {
      if (Math.abs(c.speed) > 1) continue;
      const d = Math.hypot(c.group.position.x - x, c.group.position.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  update(dt, t, playerCar, policeCars) {
    const pitch = WORLD.block + WORLD.road;
    for (const car of this.cars) {
      // car ahead on same lane?
      let gap = 999;
      for (const o of this.cars) {
        if (o === car) continue;
        const dx = o.group.position.x - car.group.position.x, dz = o.group.position.z - car.group.position.z;
        const ahead = car.axis === 'z' ? dz * car.dir : dx * car.dir;
        const lateral = car.axis === 'z' ? Math.abs(dx) : Math.abs(dz);
        if (ahead > 0 && ahead < gap && lateral < 3) gap = ahead;
      }
      if (playerCar) {
        const dx = playerCar.group.position.x - car.group.position.x, dz = playerCar.group.position.z - car.group.position.z;
        const ahead = car.axis === 'z' ? dz * car.dir : dx * car.dir;
        const lateral = car.axis === 'z' ? Math.abs(dx) : Math.abs(dz);
        if (ahead > 0 && ahead < gap && lateral < 3.5) gap = ahead;
      }
      // junction pause: near a crossing, sometimes yield
      const pos = car.axis === 'z' ? car.group.position.z : car.group.position.x;
      const nearJunction = Math.abs(((pos % pitch) + pitch) % pitch - pitch / 2) < 9;
      if (car.wait > 0) car.wait -= dt;
      else if (nearJunction && Math.sin(car.group.position.x * 0.37 + car.group.position.z * 0.53) > 0.86) car.wait = 1.5;
      const want = (gap < 9 || car.wait > 0) ? 0 : car.cruise;
      const target = { throttle: want > Math.abs(car.speed) ? 0.7 : 0, steer: 0, brake: want === 0 };
      car.update(dt, target, t);
      // keep on lane, wrap at city edge
      const p = car.group.position;
      if (car.axis === 'z') { p.x = car.lane + (car.dir > 0 ? -3.4 : 3.4); if (Math.abs(p.z) > 260) p.z = -Math.sign(p.z) * 260; }
      else { p.z = car.lane + (car.dir > 0 ? -3.4 : 3.4); if (Math.abs(p.x) > 260) p.x = -Math.sign(p.x) * 260; }
    }
    for (const c of this.parked) c.update(dt, null, t);
  }
  setNight(n) { for (const c of [...this.cars, ...this.parked]) c.setNight(n); }
}
