// Costa Serena — pedestrians.js
// Pejalan kaki terartikulasi berproporsi dewasa: badan, kepala, lengan &
// kaki berayun saat berjalan; duduk di bangku, menunggu di penyeberangan,
// dan PANIK/LARI saat ada tembakan, tabrakan, atau kejaran polisi.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xc23a3a, 0x2a6ea8, 0x3a8a4a, 0xd8b23a, 0x7a4a9a, 0xe8e2d4, 0x2a2a2e, 0xc26a3a];
const PANTS = [0x2a2f3a, 0x4a3a2a, 0x3a3a3a, 0x5a6a7a, 0x6a5a4a];
const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0, 0x6a4526];

function makePerson(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)], roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)], roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(rng() * SKINS.length)], roughness: 0.7 });
  const h = 1.62 + rng() * 0.22;
  const s = h / 1.75;
  // torso (proporsi dewasa: kaki ~55% tinggi)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.62 * s, 0.24 * s), shirt);
  torso.position.y = 1.08 * s; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 10, 8), skin);
  head.position.y = 1.55 * s; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: [0x1a1210, 0x3a2a1a, 0x6a6a6a][Math.floor(rng() * 3)], roughness: 1 }));
  hair.position.y = 1.58 * s; g.add(hair);
  // lengan: pivot di bahu
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26 * s, 1.34 * s, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.58 * s, 0.11 * s), shirt);
    arm.position.y = -0.28 * s; arm.castShadow = true;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 6, 5), skin);
    hand.position.y = -0.58 * s; pivot.add(hand);
    g.add(pivot); arms.push(pivot);
  }
  // kaki: pivot di pinggul
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12 * s, 0.82 * s, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.8 * s, 0.15 * s), pants);
    leg.position.y = -0.4 * s; leg.castShadow = true;
    pivot.add(leg);
    g.add(pivot); legs.push(pivot);
  }
  return { g, arms, legs, torso, head, height: h };
}

export function createPedestrians(W) {
  const list = [];
  const sidewalks = [];
  for (const z of CFG.streets) for (const dz of [-9, 9]) sidewalks.push({ axis: 'x', fixed: z + dz });
  for (const x of CFG.avenues) for (const dx of [-9, 9]) sidewalks.push({ axis: 'z', fixed: x + dx });

  function randomSidewalkPoint() {
    const sw = sidewalks[Math.floor(W.rng() * sidewalks.length)];
    if (sw.axis === 'x') return { x: (W.rng() - 0.5) * 380, z: sw.fixed };
    return { x: sw.fixed, z: (W.rng() - 0.5) * 260 };
  }
  function spawn(i) {
    const p = randomSidewalkPoint();
    const m = makePerson(W.rng);
    m.g.position.set(p.x, 0, p.z);
    W.scene.add(m.g);
    const ped = {
      ...m, pos: m.g.position,
      heading: W.rng() * Math.PI * 2,
      speed: 1.1 + W.rng() * 0.9,
      target: randomSidewalkPoint(),
      state: 'walk',           // walk | sit | panic | flee-car
      panicT: 0, phase: W.rng() * 6.28,
      sitT: W.rng() < 0.15 ? 20 + W.rng() * 40 : 0,
    };
    list.push(ped);
    return ped;
  }
  for (let i = 0; i < CFG.pedestrians; i++) spawn(i);

  // bangku di trotoar (tempat duduk)
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const bx = CFG.avenues[i % CFG.avenues.length] + 10.5;
    const bz = CFG.streets[Math.floor(i / 2) % CFG.streets.length] - 9;
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), benchMat);
    seat.position.y = 0.45; bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), benchMat);
    back.position.set(0, 0.85, -0.28); bench.add(back);
    bench.position.set(bx, 0, bz);
    bench.traverse((o) => { o.castShadow = true; });
    W.scene.add(bench);
  }

  function panicAt(x, z, radius = 22) {
    let n = 0;
    for (const p of list) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius && p.state !== 'panic') {
        p.state = 'panic'; p.panicT = 3 + W.rng() * 3;
        p.fleeFrom = { x, z };
        n++;
      }
    }
    return n;
  }

  function update(dt, t) {
    for (const p of list) {
      let targetSpeed = p.speed;
      let moving = true;
      if (p.state === 'panic') {
        p.panicT -= dt;
        targetSpeed = 5.2; // LARI
        const dx = p.pos.x - p.fleeFrom.x, dz = p.pos.z - p.fleeFrom.z;
        const d = Math.max(0.01, Math.hypot(dx, dz));
        const want = Math.atan2(dx / d, dz / d);
        p.heading += shortestAngle(want - p.heading) * Math.min(1, dt * 6);
        if (p.panicT <= 0) { p.state = 'walk'; p.target = randomSidewalkPoint(); }
      } else if (p.sitT > 0) {
        p.sitT -= dt; moving = false;
      } else {
        const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) { p.target = randomSidewalkPoint(); if (W.rng() < 0.1) p.sitT = 15 + W.rng() * 30; }
        else {
          const want = Math.atan2(dx, dz);
          p.heading += shortestAngle(want - p.heading) * Math.min(1, dt * 4);
        }
      }
      // bahaya di dekat: mobil ngebut / polisi mengejar -> panik
      if (p.state === 'walk' && W.playerCar) {
        const d = Math.hypot(p.pos.x - W.playerCar.pos.x, p.pos.z - W.playerCar.pos.z);
        if (d < 6 && Math.abs(W.playerCar.speed) > 12) panicAt(p.pos.x, p.pos.z, 10);
      }
      if (moving) {
        p.pos.x += Math.sin(p.heading) * targetSpeed * dt;
        p.pos.z += Math.cos(p.heading) * targetSpeed * dt;
        collideCircle(p.pos, 0.4, W.city.colliders);
        p.pos.x = Math.max(-205, Math.min(205, p.pos.x));
        p.pos.z = Math.max(-145, Math.min(146, p.pos.z));
      }
      // animasi artikulasi
      const swing = moving ? Math.sin(t * (p.state === 'panic' ? 11 : 6) + p.phase) * (p.state === 'panic' ? 0.85 : 0.55) : 0;
      p.legs[0].rotation.x = swing;
      p.legs[1].rotation.x = -swing;
      if (p.state === 'panic') {
        // lengan terangkat panik
        p.arms[0].rotation.x = -2.4 + Math.sin(t * 13 + p.phase) * 0.25;
        p.arms[1].rotation.x = -2.4 - Math.sin(t * 13 + p.phase) * 0.25;
      } else {
        p.arms[0].rotation.x = -swing * 0.7;
        p.arms[1].rotation.x = swing * 0.7;
      }
      p.torso.rotation.x = moving ? 0.06 : 0;
      p.g.rotation.y = p.heading;
      if (p.sitT > 0) { p.legs[0].rotation.x = -1.4; p.legs[1].rotation.x = -1.4; p.g.position.y = -0.32; }
      else p.g.position.y = 0;
    }
  }

  return { list, update, panicAt, spawn };
}
function shortestAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
