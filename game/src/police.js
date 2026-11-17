// Costa Serena — wanted system and police pursuit.
// Stars 1-5: crimes raise them, hiding drains them. Police cars spawn at the
// road edges, pursue with ramming behaviour, and bust Rafi on foot when close.
import { CFG, clamp, damp, dist2D, angDiff, makeRng } from './config.js';
import { createCar, updateCar } from './vehicles.js';

export function createPolice(scene, city, rng) {
  const cars = [];
  let wanted = 0;
  let heat = 0; // 0..1, how "hot" the pursuit is
  let unseenT = 0; // seconds since any police could see the player
  let decayT = 0;
  let sirenOn = false;

  function spawnCarNear(px, pz) {
    // pick a road point 60-90m away, on a road
    for (let tries = 0; tries < 12; tries++) {
      const x = CFG.roads.avenues[Math.floor(rng.next() * CFG.roads.avenues.length)];
      const z = CFG.roads.streets[Math.floor(rng.next() * CFG.roads.streets.length)];
      if (dist2D(x, z, px, pz) < CFG.police.spawnDist) continue;
      if (dist2D(x, z, px, pz) > 130) continue;
      const car = createCar('police', x, z, Math.atan2(px - x, pz - z), rng);
      car.driver = 'police';
      car.speed = 12;
      scene.add(car.model.group);
      cars.push(car);
      return car;
    }
    return null;
  }

  function setWanted(n, reason) {
    const before = wanted;
    wanted = clamp(n, 0, 5);
    if (wanted > before) { unseenT = 0; decayT = 0; }
    return wanted;
  }
  function addWanted(n, reason) { return setWanted(wanted + n, reason); }

  function update(dt, player, playerCar, city, onBusted, onCrash) {
    const px = playerCar ? playerCar.pos.x : player.pos.x;
    const pz = playerCar ? playerCar.pos.z : player.pos.z;
    // desired police count scales with stars
    const wantCount = wanted === 0 ? 0 : Math.min(1 + Math.floor(wanted / 2), CFG.police.maxCars);
    while (cars.length < wantCount) {
      if (!spawnCarNear(px, pz)) break;
    }
    // remove extras when wanted drops
    while (cars.length > wantCount) {
      const c = cars.pop();
      c.model.group.parent?.remove(c.model.group);
    }
    // visibility: any police within 55m and roughly facing the player counts as seen
    let seen = false;
    for (const c of cars) {
      if (dist2D(c.pos.x, c.pos.z, px, pz) < 55) { seen = true; break; }
    }
    if (seen) { unseenT = 0; decayT = 0; }
    else {
      unseenT += dt;
      if (unseenT > CFG.wanted.decayDelay) {
        decayT += dt;
        if (decayT > CFG.wanted.decayPerStar && wanted > 0) {
          wanted -= 1; decayT = 0;
          if (wanted === 0) unseenT = 0;
        }
      }
    }
    sirenOn = wanted > 0 && cars.length > 0;
    heat = damp(heat, wanted > 0 ? 1 : 0, 1.2, dt);

    // pursuit: steer toward the player, ram when close; on foot, bust when adjacent
    for (const c of cars) {
      const dx = px - c.pos.x, dz = pz - c.pos.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const steer = clamp(angDiff(c.heading, wantHeading) * 2.2, -1, 1);
      const throttle = d > 6 ? 1 : 0.7;
      const res = updateCar(c, { throttle, steer, handbrake: false }, dt, city.colliders, (s) => onCrash?.(s, c));
      // ram the player's car
      if (playerCar && d < 3.4) {
        playerCar.speed *= 0.92;
        playerCar.damage = clamp(playerCar.damage + 0.02, 0, 1);
        c.speed *= 0.8;
        onCrash?.(Math.abs(playerCar.speed), c);
      }
      // bust: on foot, slow, police adjacent
      if (!playerCar && d < 2.6 && player.speed < 2) {
        onBusted?.();
      }
      // lightbar flash (red/blue alternate)
      const lb = c.model.group.userData.lightbar;
      if (lb) {
        const phase = Math.floor(performance.now() / 260) % 2 === 0;
        lb.redMat.emissiveIntensity = phase ? 3 : 0.1;
        lb.blueMat.emissiveIntensity = phase ? 0.1 : 3;
      }
      c.model.setNight(true);
    }
    return { wanted, sirenOn };
  }

  function clearAll(sceneRef) {
    for (const c of cars) sceneRef.remove(c.model.group);
    cars.length = 0;
    wanted = 0; heat = 0; unseenT = 0; decayT = 0;
  }

  return {
    cars,
    get wanted() { return wanted; },
    get sirenOn() { return sirenOn; },
    setWanted, addWanted, update, clearAll,
  };
}
