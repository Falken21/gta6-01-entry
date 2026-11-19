// Costa Serena — player.js
// One job: Rafi on foot. Third-person walk/run with an orbiting camera,
// collision against buildings, and entering/exiting cars (E). The camera
// is cinematic: it lags behind acceleration and widens its FOV at speed.
import * as THREE from 'three';
import { CFG, clamp, lerp, angleDiff, mulberry32, pick } from './config.js';

const SHIRTS = [0x2e6f8e, 0x8a1f1f, 0x3a5f3a];

export function createPlayer(scene, spawn, seed = CFG.seed) {
  const rng = mulberry32(seed + 303);
  // Rafi: teal work shirt, dark jeans, boots — consistent in every scene.
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e6f8e, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.9 });
  const legGeo = new THREE.BoxGeometry(0.17, 0.8, 0.19);
  legGeo.translate(0, -0.4, 0);
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.12, 0.8, 0);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.12, 0.8, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
  torso.position.y = 1.11;
  const armGeo = new THREE.BoxGeometry(0.13, 0.58, 0.15);
  armGeo.translate(0, -0.29, 0);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.32, 1.38, 0);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.32, 1.38, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin);
  head.position.y = 1.58;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }));
  hair.position.y = 1.6;
  // a pistol in the right hand when armed
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.4, metalness: 0.7 }));
  gun.position.set(0.32, 1.12, 0.18);
  gun.visible = false;
  for (const m of [legL, legR, torso, armL, armR, head]) m.castShadow = true;
  g.add(legL, legR, torso, armL, armR, head, hair, gun);
  g.position.set(spawn.x, 0, spawn.z);
  scene.add(g);

  const player = {
    model: g,
    pos: g.position,
    heading: spawn.heading,
    speed: 0,
    health: CFG.playerHealth,
    armed: false,
    inCar: null,
    walkPhase: 0,
    camYaw: spawn.heading + Math.PI,
    camPitch: 0.32,
    camDist: 7.5,
    shake: 0,
    update(dt, input, colliders, camera) {
      if (this.inCar) {
        // Camera follows the car; the body hides inside it.
        g.visible = false;
        this.updateCarCamera(dt, camera);
        return;
      }
      g.visible = true;
      const run = input.run ? CFG.runSpeed : CFG.walkSpeed;
      let mx = 0, mz = 0;
      if (input.forward) mz += 1;
      if (input.back) mz -= 1;
      if (input.left) mx -= 1;
      if (input.right) mx += 1;
      const moving = mx !== 0 || mz !== 0;
      // Movement is relative to the camera yaw.
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      let dx = 0, dz = 0;
      if (moving) {
        dx = (mx * cos - mz * sin);
        dz = (mx * sin + mz * cos);
        const len = Math.hypot(dx, dz);
        dx /= len; dz /= len;
        const targetHeading = Math.atan2(dx, dz);
        this.heading += angleDiff(this.heading, targetHeading) * Math.min(1, dt * 12);
        this.speed = lerp(this.speed, run, Math.min(1, dt * 10));
      } else {
        this.speed = lerp(this.speed, 0, Math.min(1, dt * 10));
      }
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      // building collision: circle vs AABB
      let blocked = false;
      for (const c of colliders) {
        if (nx > c.minX - CFG.playerRadius && nx < c.maxX + CFG.playerRadius &&
            nz > c.minZ - CFG.playerRadius && nz < c.maxZ + CFG.playerRadius) { blocked = true; break; }
      }
      if (!blocked) {
        this.pos.x = clamp(nx, -CFG.worldHalf, CFG.worldHalf);
        this.pos.z = clamp(nz, -CFG.worldHalf, CFG.worldHalf);
      } else {
        this.speed *= 0.3;
      }
      // walk cycle
      this.walkPhase += dt * (2 + this.speed * 1.9);
      const swing = Math.sin(this.walkPhase) * clamp(this.speed / 5, 0, 1) * 0.65;
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.85; armR.rotation.x = swing * 0.85;
      g.rotation.y = this.heading;
      g.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.04 * clamp(this.speed / 5, 0, 1);
      gun.visible = this.armed;
      if (this.armed) armR.rotation.x = -1.2;
      // third-person camera: orbit behind the player
      this.updateFootCamera(dt, camera);
    },
    updateFootCamera(dt, camera) {
      const target = new THREE.Vector3(this.pos.x, 1.6, this.pos.z);
      const dist = this.camDist;
      const cx = target.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
      const cz = target.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
      const cy = target.y + Math.sin(this.camPitch) * dist;
      const desired = new THREE.Vector3(cx, cy, cz);
      camera.position.lerp(desired, Math.min(1, dt * 8));
      camera.lookAt(target);
      this.applyShake(camera, dt);
      if (camera.fov !== 62) { camera.fov = lerp(camera.fov, 62, dt * 4); camera.updateProjectionMatrix(); }
    },
    updateCarCamera(dt, camera) {
      const car = this.inCar;
      if (!car) return;
      const back = 9.5 + Math.abs(car.speed) * 0.12;
      const up = 3.6 + Math.abs(car.speed) * 0.02;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const tx = car.pos.x - fx * back, tz = car.pos.z - fz * back;
      const desired = new THREE.Vector3(tx, up, tz);
      camera.position.lerp(desired, Math.min(1, dt * 5));
      camera.lookAt(car.pos.x + fx * 6, 1.4, car.pos.z + fz * 6);
      this.applyShake(camera, dt);
      // FOV widens with speed — the cinematic rush.
      const targetFov = 62 + clamp(Math.abs(car.speed) / CFG.carTopSpeed, 0, 1) * 14;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = lerp(camera.fov, targetFov, dt * 3);
        camera.updateProjectionMatrix();
      }
    },
    applyShake(camera, dt) {
      if (this.shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * this.shake;
        camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
        this.shake = lerp(this.shake, 0, Math.min(1, dt * 6));
      }
    },
    addShake(amount) { this.shake = Math.min(0.9, this.shake + amount); },
    enterCar(car) {
      this.inCar = car;
      car.driver = 'player';
      this.pos.set(car.pos.x, 0, car.pos.z);
      g.visible = false;
    },
    exitCar() {
      const car = this.inCar;
      if (!car) return;
      car.driver = null;
      car.speed = 0;
      this.inCar = null;
      // step out to the driver's side
      const side = 2.4;
      this.pos.set(
        car.pos.x + Math.cos(car.heading) * side,
        0,
        car.pos.z - Math.sin(car.heading) * side,
      );
      this.heading = car.heading;
      this.camYaw = car.heading + Math.PI;
      g.visible = true;
    },
    damage(amount) {
      this.health = Math.max(0, this.health - amount);
      this.addShake(0.4);
      return this.health <= 0;
    },
    heal(amount) { this.health = Math.min(CFG.playerHealth, this.health + amount); },
    reset(spawn) {
      this.health = CFG.playerHealth;
      this.pos.set(spawn.x, 0, spawn.z);
      this.heading = spawn.heading;
      this.camYaw = spawn.heading + Math.PI;
      if (this.inCar) { this.inCar.driver = null; this.inCar = null; }
      g.visible = true;
    },
  };
  return player;
}
