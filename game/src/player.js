// Costa Serena — Rafi, the player: third-person on-foot controller (walk/run,
// camera-relative movement, articulated walk cycle) and entering/exiting cars.
// Rafi's look is locked by the character bible: late-20s boat mechanic, dark
// hair, white tee, dark jeans, red thread bracelet on his left wrist.
import * as THREE from 'three';
import { CFG, clamp, damp, dist2D, resolveCircleAABB } from './config.js';
import { makePedModel } from './pedestrians.js';

export function createPlayer(scene, rng, start) {
  // Rafi reuses the articulated figure with his locked outfit.
  const model = makePedModel(rng);
  // override to Rafi's outfit: white tee, dark jeans, dark hair
  model.group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (o.geometry?.parameters?.width === 0.52) o.material = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.9 });
    }
  });
  // red thread bracelet on the left wrist
  const bracelet = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 12), new THREE.MeshStandardMaterial({ color: 0xc22a1a, roughness: 0.7 }));
  bracelet.rotation.x = Math.PI / 2;
  bracelet.position.y = -0.5;
  model.armL.pivot.add(bracelet);

  model.group.position.set(start.x, 0, start.z);
  scene.add(model.group);
  return {
    model, pos: model.group.position,
    heading: 0, speed: 0, phase: 0,
    health: CFG.player.health, cash: 0,
    car: null, // car object when driving
    alive: true,
  };
}

// input: {f,b,l,r,run} in camera-relative space; camYaw is the camera yaw.
export function updatePlayer(player, input, camYaw, dt, city, cars, onEnterCar, onExitCar) {
  if (!player.alive) return;
  if (player.car) return; // driving is handled by vehicles.updateCar
  let mx = 0, mz = 0;
  if (input.f) mz += 1;
  if (input.b) mz -= 1;
  if (input.r) mx += 1;
  if (input.l) mx -= 1;
  const moving = mx !== 0 || mz !== 0;
  const targetSpeed = moving ? (input.run ? CFG.player.runSpeed : CFG.player.walkSpeed) : 0;
  player.speed = damp(player.speed, targetSpeed, 10, dt);
  if (moving) {
    const len = Math.hypot(mx, mz); mx /= len; mz /= len;
    // camera-relative: forward is -Z of camera yaw
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    const want = Math.atan2(wx, wz);
    let dh = want - player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    player.heading += clamp(dh, -10 * dt, 10 * dt);
    player.pos.x += Math.sin(player.heading) * player.speed * dt;
    player.pos.z += Math.cos(player.heading) * player.speed * dt;
  }
  // building collision
  for (const box of city.colliders) {
    const res = resolveCircleAABB(player.pos.x, player.pos.z, CFG.player.radius, box);
    if (res) { player.pos.x += res.x; player.pos.z += res.z; }
  }
  player.pos.x = clamp(player.pos.x, -CFG.world.halfX, CFG.world.beachX0 + 6);
  player.pos.z = clamp(player.pos.z, -CFG.world.halfZ, CFG.world.halfZ);
  // walk cycle
  player.phase += dt * player.speed * 2.1;
  const s = Math.sin(player.phase) * clamp(player.speed / CFG.player.walkSpeed, 0, 1) * 0.6;
  player.model.legL.pivot.rotation.x = s;
  player.model.legR.pivot.rotation.x = -s;
  player.model.armL.pivot.rotation.x = -s * 0.8;
  player.model.armR.pivot.rotation.x = s * 0.8;
  player.model.group.rotation.y = player.heading;
  player.model.group.position.y = Math.abs(Math.sin(player.phase)) * 0.05;
}

export function nearestCar(player, cars, maxDist = 3.2) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    const d = dist2D(player.pos.x, player.pos.z, c.pos.x, c.pos.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

export function enterCar(player, car) {
  player.car = car;
  car.driver = 'player';
  player.model.group.visible = false;
  return car;
}

export function exitCar(player) {
  const car = player.car;
  if (!car) return null;
  player.car = null;
  car.driver = null;
  car.speed = 0;
  // step out to the left side
  const sx = Math.cos(car.heading), sz = -Math.sin(car.heading);
  player.pos.x = car.pos.x + sx * 2.2;
  player.pos.z = car.pos.z + sz * 2.2;
  player.model.group.visible = true;
  player.model.group.position.set(player.pos.x, 0, player.pos.z);
  return car;
}
