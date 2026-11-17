// Costa Serena — civilian traffic: cars follow the road graph, keep lanes and
// gaps, stop at junctions when another car is close, and park along kerbs.
import { CFG, makeRng, clamp, damp, dist2D, angDiff } from './config.js';
import { createCar, updateCar } from './vehicles.js';

export function createTraffic(scene, city, rng) {
  const cars = [];
  const parked = [];
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'pickup'];

  function randomEdge() {
    const keys = [...city.nodes.keys()];
    const a = keys[Math.floor(rng.next() * keys.length)];
    const nbs = city.adjacency.get(a);
    if (!nbs || !nbs.length) return null;
    return { from: city.nodes.get(a), to: city.nodes.get(nbs[Math.floor(rng.next() * nbs.length)]) };
  }

  function spawnCar() {
    const e = randomEdge();
    if (!e) return null;
    const heading = Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z);
    const lane = 2.4; // right-hand lane offset
    const px = e.from.x + Math.cos(heading) * lane;
    const pz = e.from.z - Math.sin(heading) * lane;
    const car = createCar(rng.pick(types), px, pz, heading, rng);
    car.driver = 'traffic';
    car.speed = CFG.traffic.speed * (0.8 + rng.next() * 0.4);
    car.edge = e;
    car.edgeT = 0;
    car.stopped = false;
    scene.add(car.model.group);
    cars.push(car);
    return car;
  }

  for (let i = 0; i < CFG.traffic.count; i++) spawnCar();

  // parked cars along kerbs
  for (let i = 0; i < 10; i++) {
    const e = randomEdge();
    if (!e) continue;
    const heading = Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z);
    const side = rng.chance(0.5) ? 1 : -1;
    const t = 0.2 + rng.next() * 0.6;
    const px = e.from.x + (e.to.x - e.from.x) * t + Math.cos(heading) * 4.2 * side;
    const pz = e.from.z + (e.to.z - e.from.z) * t - Math.sin(heading) * 4.2 * side;
    const car = createCar(rng.pick(types), px, pz, heading + (side > 0 ? 0 : Math.PI), rng);
    car.driver = null;
    scene.add(car.model.group);
    parked.push(car);
  }

  function carAhead(c, list) {
    let best = Infinity;
    for (const o of list) {
      if (o === c) continue;
      const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      const fwd = dx * fx + dz * fz;
      if (fwd > 0 && fwd < CFG.traffic.gap + 6) {
        const lat = Math.abs(dx * fz - dz * fx);
        if (lat < 2.6 && fwd < best) best = fwd;
      }
    }
    return best;
  }

  function update(dt, playerCar, policeCars) {
    const all = [...cars, ...parked, ...(playerCar ? [playerCar] : []), ...policeCars];
    for (const c of cars) {
      // advance along current edge
      const e = c.edge;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      const tx = e.to.x + Math.cos(c.heading) * 2.4;
      const tz = e.to.z - Math.sin(c.heading) * 2.4;
      const dx = tx - c.pos.x, dz = tz - c.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const steer = clamp(angDiff(c.heading, wantHeading) * 1.8, -1, 1);
      const gap = carAhead(c, all);
      let throttle = 0.55;
      if (gap < CFG.traffic.gap) throttle = 0;
      if (dist < 3) {
        // reached the junction: pick the next edge (no U-turn unless dead end)
        const curKey = `${e.to.x},${e.to.z}`;
        const nbs = city.adjacency.get(curKey) || [];
        const fromKey = `${e.from.x},${e.from.z}`;
        const opts = nbs.filter((k) => k !== fromKey);
        const nextKey = opts.length ? opts[Math.floor(rng.next() * opts.length)] : (nbs[0] || fromKey);
        const next = city.nodes.get(nextKey);
        c.edge = { from: e.to, to: next };
        continue;
      }
      const res = updateCar(c, { throttle, steer, handbrake: false }, dt, city.colliders, null);
      if (res.crashed) { c.speed = 0; }
      // keep lane discipline: gently pull back toward the lane line
      c.speed = damp(c.speed, CFG.traffic.speed * (throttle > 0 ? 1 : 0), 1.5, dt);
      if (throttle === 0) c.speed = damp(c.speed, 0, 3, dt);
    }
  }

  return { cars, parked, update, spawnCar };
}
