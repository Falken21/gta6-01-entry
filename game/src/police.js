// Costa Serena — police.js
// One job: the wanted system. Crimes raise stars (1–5); police cars spawn
// at the city's edges and pursue with ramming and pinning behaviour; break
// line of sight and the heat cools until the stars drain. Light bars flash
// red/blue and throw coloured pools on the road at night.
import * as THREE from 'three';
import { CFG, clamp, angleDiff, mulberry32, pick, range } from './config.js';
import { createCar } from './vehicles.js';

export function createPolice(scene, city, seed = CFG.seed) {
  const rng = mulberry32(seed + 404);
  const cars = [];
  let wanted = 0;            // float 0..5; HUD shows ceil
  let lastCrimeAt = -999;
  let time = 0;
  let flashPhase = 0;

  function stars() { return Math.ceil(wanted - 0.001); }

  function addCrime(level, x, z) {
    wanted = clamp(wanted + level, 0, CFG.wantedMax);
    lastCrimeAt = time;
  }

  function spawnPoliceCar(targetPos) {
    // Spawn on a road 60–90 m away, roughly behind the player's motion.
    const road = city.roads[Math.floor(rng() * city.roads.length)];
    let best = null, bd = 1e9;
    for (let tries = 0; tries < 12; tries++) {
      const t = range(rng, -200, 200);
      const p = road.axis === 'x' ? { x: t, z: road.line } : { x: road.line, z: t };
      const d = Math.hypot(p.x - targetPos.x, p.z - targetPos.z);
      if (d > 60 && d < bd) { bd = d; best = p; }
    }
    if (!best) best = { x: targetPos.x + 70, z: targetPos.z };
    const near = city.nearestRoad(best.x, best.z);
    const car = createCar(scene, 'police', near.x, near.z,
      Math.atan2(targetPos.x - near.x, targetPos.z - near.z), 0x1c1f24, rng);
    car.driver = 'police';
    // fake red/blue light pools on the road
    const poolGeo = new THREE.CircleGeometry(3.2, 16);
    const redPool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
      color: 0xff2222, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const bluePool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
      color: 0x2244ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    redPool.rotation.x = -Math.PI / 2; bluePool.rotation.x = -Math.PI / 2;
    redPool.position.y = 0.05; bluePool.position.y = 0.05;
    car.model.add(redPool); car.model.add(bluePool);
    car.pools = { red: redPool.material, blue: bluePool.material };
    cars.push(car);
    return car;
  }

  function update(dt, player, playerCar, onRam) {
    time += dt;
    flashPhase += dt * 9;
    const target = playerCar || player;
    const tx = target.pos.x, tz = target.pos.z;
    // keep the fleet sized to the wanted level
    const want = stars();
    while (cars.length < want && cars.length < 5) spawnPoliceCar(target.pos);
    while (cars.length > want) {
      const c = cars.pop();
      c.destroy();
    }
    // heat cools when hidden: no crime recently and no police close
    let nearest = 999;
    for (const c of cars) nearest = Math.min(nearest, Math.hypot(c.pos.x - tx, c.pos.z - tz));
    if (wanted > 0 && time - lastCrimeAt > CFG.wantedDecayDelay && nearest > 45) {
      wanted = Math.max(0, wanted - CFG.wantedDecayRate * dt);
    }
    // pursuit: steer toward the player, ram on contact
    for (const car of cars) {
      const dx = tx - car.pos.x, dz = tz - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const desired = Math.atan2(dx, dz);
      const steer = clamp(angleDiff(car.heading, desired) * 1.6, -1, 1);
      const targetSpeed = dist < 6 ? CFG.policeTopSpeed * 0.6 : CFG.policeTopSpeed;
      const throttle = car.speed < targetSpeed ? 0.9 : -0.4;
      car.update(dt, { throttle, steer, handbrake: false }, city.colliders);
      // ram: push the player's car and shake the camera
      if (playerCar && dist < 3.4) {
        const push = 9 * dt;
        playerCar.pos.x += (dx / dist) * push * 0.4;
        playerCar.pos.z += (dz / dist) * push * 0.4;
        playerCar.speed *= 0.94;
        playerCar.damage = Math.min(1, playerCar.damage + 0.02);
        onRam?.(Math.abs(car.speed));
      }
      if (!playerCar && dist < 2.2) {
        // on foot: a cop car that catches Rafi knocks him down hard
        onRam?.(Math.abs(car.speed) * 2);
      }
      // light bar flash: alternate red/blue
      const u = car.model.userData;
      if (u.lightBar) {
        const on = Math.sin(flashPhase) > 0;
        u.lightBar.userData.red.emissiveIntensity = on ? 3 : 0.2;
        u.lightBar.userData.blue.emissiveIntensity = on ? 0.2 : 3;
        car.pools.red.opacity = on ? 0.22 : 0.05;
        car.pools.blue.opacity = on ? 0.05 : 0.22;
      }
    }
  }

  function clearAll() {
    for (const c of cars) c.destroy();
    cars.length = 0;
    wanted = 0;
  }

  return { cars, stars, addCrime, update, clearAll, get wanted() { return wanted; }, set wanted(v) { wanted = clamp(v, 0, 5); lastCrimeAt = time; } };
}
