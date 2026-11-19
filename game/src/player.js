// Costa Serena — player.js
// Rafi di jalan kaki: kontrol third-person, kamera orbit + tabrakan kamera,
// masuk/keluar mobil (E), lari, dan animasi jalan yang terartikulasi.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { collideCircle } from './city.js';

const SKIN = 0xc98a5a;

export function createPlayer(W) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), jacket);
  torso.position.y = 1.1; torso.castShadow = true; g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xd8b23a, roughness: 0.8 }));
  vest.position.y = 1.16; g.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin);
  head.position.y = 1.58; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
  cap.position.y = 1.68; g.add(cap);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const ap = new THREE.Group(); ap.position.set(side * 0.28, 1.36, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), jacket);
    arm.position.y = -0.3; arm.castShadow = true; ap.add(arm);
    g.add(ap); arms.push(ap);
    const lp = new THREE.Group(); lp.position.set(side * 0.13, 0.84, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.82, 0.16), pants);
    leg.position.y = -0.41; leg.castShadow = true; lp.add(leg);
    g.add(lp); legs.push(lp);
  }
  g.position.set(0, 0, -102);
  W.scene.add(g);

  const P = {
    group: g, pos: g.position,
    heading: 0.4, camYaw: 0.4, camPitch: 0.32, camDist: 7.5,
    health: CFG.playerHealth, cash: CFG.startCash,
    onFoot: true, car: null, moving: false, speedNow: 0,
    arms, legs, torso,
    update(dt, input, t) {
      if (!P.onFoot) return;
      const run = input.run;
      const spd = run ? CFG.runSpeed : CFG.walkSpeed;
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let mz = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      const len = Math.hypot(mx, mz);
      P.moving = len > 0;
      if (len > 0) {
        mx /= len; mz /= len;
        // gerak relatif kamera: W = arah pandang kamera, D = kanan layar
        const sin = Math.sin(P.camYaw), cos = Math.cos(P.camYaw);
        const wx = -mx * cos + mz * sin;
        const wz = mx * sin + mz * cos;
        const want = Math.atan2(wx, wz);
        let dh = want - P.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        P.heading += dh * Math.min(1, dt * 10);
        P.speedNow = spd;
        P.pos.x += Math.sin(P.heading) * spd * dt;
        P.pos.z += Math.cos(P.heading) * spd * dt;
        collideCircle(P.pos, CFG.playerRadius, W.city.colliders);
        P.pos.x = Math.max(-208, Math.min(208, P.pos.x));
        P.pos.z = Math.max(-148, Math.min(148, P.pos.z));
      } else P.speedNow = 0;
      const swing = P.moving ? Math.sin(t * (run ? 11 : 7)) * (run ? 0.8 : 0.55) : 0;
      P.legs[0].rotation.x = swing; P.legs[1].rotation.x = -swing;
      P.arms[0].rotation.x = -swing * 0.7; P.arms[1].rotation.x = swing * 0.7;
      P.torso.rotation.x = P.moving ? (run ? 0.12 : 0.06) : 0;
      g.rotation.y = P.heading;
    },
    // kamera third-person dengan orbit + tabrakan terhadap gedung
    updateCamera(dt) {
      const target = P.onFoot ? P.pos : (P.car ? P.car.pos : P.pos);
      const cy = P.onFoot ? P.camYaw : (P.car ? P.car.heading : P.camYaw);
      const pitch = P.onFoot ? P.camPitch : 0.24;
      const dist = P.onFoot ? P.camDist : 9;
      const cx = target.x - Math.sin(cy) * Math.cos(pitch) * dist;
      const cz = target.z - Math.cos(cy) * Math.cos(pitch) * dist;
      const cyy = (P.onFoot ? 1.8 : 2.2) + Math.sin(pitch) * dist;
      // tarik kamera bila menembus gedung (raycast sederhana: cek AABB)
      let d = dist;
      for (const c of W.city.colliders) {
        if (cx > c.minX - 0.5 && cx < c.maxX + 0.5 && cz > c.minZ - 0.5 && cz < c.maxZ + 0.5) { d = dist * 0.45; break; }
      }
      const fx = target.x - Math.sin(cy) * Math.cos(pitch) * d;
      const fz = target.z - Math.cos(cy) * Math.cos(pitch) * d;
      W.camera.position.lerp(new THREE.Vector3(fx, cyy, fz), Math.min(1, dt * 8));
      const look = new THREE.Vector3(target.x, (P.onFoot ? 1.5 : 1.6), target.z);
      if (P.car) look.add(new THREE.Vector3(Math.sin(P.car.heading) * 4, 0, Math.cos(P.car.heading) * 4));
      W.camera.lookAt(look);
      // FOV melebar dengan kecepatan mobil
      const targetFov = P.car ? 58 + Math.min(12, Math.abs(P.car.speed) * 0.3) : 58;
      if (Math.abs(W.camera.fov - targetFov) > 0.1) {
        W.camera.fov += (targetFov - W.camera.fov) * Math.min(1, dt * 3);
        W.camera.updateProjectionMatrix();
      }
    },
    enterCar(car) {
      P.car = car; P.onFoot = false;
      car.driver = 'player'; car.stolen = true;
      g.visible = false;
      W.playerCar = car;
      W.events.emit('car-stolen', { type: car.type });
    },
    exitCar() {
      if (!P.car) return;
      const car = P.car;
      car.driver = 'parked';
      P.onFoot = true; P.car = null;
      const side = 2.2;
      P.pos.set(car.pos.x + Math.cos(car.heading) * side, 0, car.pos.z - Math.sin(car.heading) * side);
      g.visible = true;
      W.playerCar = null;
    },
    damage(amount) {
      P.health -= amount;
      W.events.emit('player-hurt', { health: P.health });
      if (P.health <= 0) W.events.emit('game-over', { reason: 'Rafi tumbang.' });
    },
  };
  return P;
}
