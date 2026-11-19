// Costa Serena — traffic.js
// One job: civilian traffic. Cars follow the road grid in lanes, stop at
// junctions, keep a gap to the car ahead; parked cars line the kerbs and
// can be stolen. Traffic never leaves the roads.
import * as THREE from 'three';
import { CFG, clamp, angleDiff, mulberry32, pick, range } from './config.js';
import { createCar, CAR_TYPES } from './vehicles.js';

const CIV_TYPES = ['sedan', 'hatch', 'taxi', 'pickup', 'sport'];

export function createTraffic(scene, city, seed = CFG.seed) {
  const rng = mulberry32(seed + 101);
  const cars = [];
  const parked = [];
  const P = CFG.blockPitch, RW = CFG.roadWidth;

  function lanePos(road, t, side) {
    // Right-hand traffic: offset +3.1 m to the right of travel direction.
    if (road.axis === 'x') return { x: t, z: road.line + side * 3.1 };
    return { x: road.line + side * 3.1, z: t };
  }
  function headingOf(road, dir) {
    if (road.axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    return dir > 0 ? 0 : Math.PI;
  }
  function randomRoad() {
    return city.roads[Math.floor(rng() * city.roads.length)];
  }

  function spawnMoving() {
    const road = randomRoad();
    const dir = rng() < 0.5 ? 1 : -1;
    const t = range(rng, -200, 200);
    const p = lanePos(road, t, dir > 0 ? 1 : -1);
    const type = pick(rng, CIV_TYPES);
    const colour = pick(rng, CAR_TYPES[type].colours);
    const car = createCar(scene, type, p.x, p.z, headingOf(road, dir), colour, rng);
    car.driver = 'traffic';
    car.cruise = range(rng, 8, 14);
    car.road = road; car.dir = dir; car.t = t;
    car.wait = 0;
    cars.push(car);
    return car;
  }

  for (let i = 0; i < 14; i++) spawnMoving();

  // Parked cars along kerbs, some with drivers who bail when stolen.
  for (let i = 0; i < 12; i++) {
    const road = randomRoad();
    const t = range(rng, -190, 190);
    const side = rng() < 0.5 ? 1 : -1;
    const p = lanePos(road, t, side * 1.55);
    const type = pick(rng, CIV_TYPES);
    const colour = pick(rng, CAR_TYPES[type].colours);
    const car = createCar(scene, type, p.x, p.z, headingOf(road, side), colour, rng);
    car.driver = 'parked';
    car.occupied = rng() < 0.4;
    parked.push(car);
  }

  function update(dt, playerCar, policeCars) {
    // Moving traffic: follow the road, pause at junctions, mind the gap.
    for (const car of cars) {
      if (car.driver === 'player') continue;
      const road = car.road;
      // Near a junction? Roll through slowly or wait briefly.
      const nearJunction = Math.abs(((car.t % P) + P) % P - P / 2) < 4 || Math.abs(((car.t % P) + P) % P) < 4;
      // Actually: junction lines sit at multiples of P; distance to nearest one:
      const mod = ((car.t % P) + P) % P;
      const distJ = Math.min(mod, P - mod);
      if (distJ < 5 && car.wait <= 0 && rng() < 0.002) car.wait = range(rng, 0.8, 2.2);
      if (car.wait > 0) { car.wait -= dt; car.update(dt, { throttle: 0, steer: 0, handbrake: true }, city.colliders); continue; }
      // Gap to the car ahead on the same road + direction.
      let gap = 999;
      for (const other of cars) {
        if (other === car || other.road !== road || other.dir !== car.dir) continue;
        const ahead = (other.t - car.t) * car.dir;
        if (ahead > 0 && ahead < gap) gap = ahead;
      }
      const target = gap < 12 ? 0 : car.cruise * (distJ < 8 ? 0.55 : 1);
      const throttle = car.speed < target ? 0.7 : (car.speed > target + 1 ? -0.6 : 0);
      // Physics step first (speed, wheels, lights), then pin the car to its
      // lane — the physics move along the heading is overwritten by the lane
      // position, so the car never drifts off the road.
      car.update(dt, { throttle, steer: 0, handbrake: false }, city.colliders);
      car.t += car.dir * car.speed * dt;
      if (car.t > 220 || car.t < -220) {
        // Reached the end: turn onto a crossing road.
        const cross = pick(rng, city.roads.filter(r => r.axis !== road.axis));
        car.road = cross;
        car.dir = rng() < 0.5 ? 1 : -1;
        car.t = range(rng, -180, 180);
        const p = lanePos(cross, car.t, car.dir > 0 ? 1 : -1);
        car.pos.x = p.x; car.pos.z = p.z;
        car.heading = headingOf(cross, car.dir);
      } else {
        const p = lanePos(road, car.t, car.dir > 0 ? 1 : -1);
        car.pos.x = p.x; car.pos.z = p.z;
        car.heading = headingOf(road, car.dir);
        car.model.position.copy(car.pos);
        car.model.rotation.y = car.heading - Math.PI / 2;
      }
    }
    // Parked cars do not move, but their wheels/lights still tick.
    for (const car of parked) {
      if (car.driver === 'player') continue;
      car.update(dt, { throttle: 0, steer: 0, handbrake: true }, city.colliders);
    }
  }

  function nearestParked(x, z, maxDist = 5) {
    let best = null, bd = maxDist;
    for (const car of parked) {
      if (car.driver === 'player') continue;
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bd) { bd = d; best = car; }
    }
    // Also allow stealing a stopped traffic car.
    for (const car of cars) {
      if (car.driver === 'player' || Math.abs(car.speed) > 0.5) continue;
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  function allCars() { return [...cars, ...parked]; }

  return { cars, parked, update, nearestParked, allCars, spawnMoving };
}
