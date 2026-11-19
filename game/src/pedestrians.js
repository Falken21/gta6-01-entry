// Costa Serena — pedestrians.js
// One job: people on the pavements. Articulated low-poly figures (swinging
// arms and legs, adult proportions, varied clothes) who walk routines,
// wait at crossings, sit on benches — and PANIC: gunshots, collisions and
// police chases nearby make them scream and run, arms up, away from danger.
import * as THREE from 'three';
import { CFG, clamp, mulberry32, pick, range } from './config.js';

const SKIN = [0xc98d64, 0x8a5a3b, 0xe8b88a, 0x6b4226, 0xd9a077];
const SHIRTS = [0xd9552d, 0x2e6f8e, 0xd9a441, 0x4a7d5c, 0x8e4a6b, 0xe8e4da, 0x3a3f4a, 0x7fa08e];
const PANTS = [0x2b3440, 0x4a3a2c, 0x5a5f6b, 0x1f2a33, 0x6b5a44];

function makePerson(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: pick(rng, SKIN), roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: pick(rng, PANTS), roughness: 0.9 });
  const h = range(rng, 1.62, 1.88);
  const s = h / 1.75;
  // legs
  const legGeo = new THREE.BoxGeometry(0.16 * s, 0.78 * s, 0.18 * s);
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.11 * s, 0.39 * s, 0);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.11 * s, 0.39 * s, 0);
  legL.geometry = legGeo.clone(); legR.geometry = legGeo.clone();
  legL.geometry.translate(0, -0.39 * s, 0); legR.geometry.translate(0, -0.39 * s, 0);
  legL.position.y = 0.78 * s; legR.position.y = 0.78 * s;
  legL.castShadow = true; legR.castShadow = true;
  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46 * s, 0.58 * s, 0.26 * s), shirt);
  torso.position.y = 0.78 * s + 0.29 * s;
  torso.castShadow = true;
  // arms
  const armGeo = new THREE.BoxGeometry(0.12 * s, 0.56 * s, 0.14 * s);
  armGeo.translate(0, -0.28 * s, 0);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.29 * s, 0.78 * s + 0.52 * s, 0);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.29 * s, 0.78 * s + 0.52 * s, 0);
  armL.castShadow = true; armR.castShadow = true;
  // head + hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 10, 8), skin);
  head.position.y = 0.78 * s + 0.58 * s + 0.14 * s;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: pick(rng, [0x1a1a1a, 0x4a2c14, 0x8a6b3a, 0xd9d9d9, 0x2c2c2c]), roughness: 1 }));
  hair.position.copy(head.position);
  hair.position.y += 0.02;
  g.add(legL, legR, torso, armL, armR, head, hair);
  g.userData = { legL, legR, armL, armR, head, height: h };
  return g;
}

export function createPedestrians(scene, city, seed = CFG.seed) {
  const rng = mulberry32(seed + 202);
  const peds = [];
  const P = CFG.blockPitch;

  function randomSidewalkPos() {
    // Pick a road, stand on its pavement (7.5 m from the centre line).
    const road = city.roads[Math.floor(rng() * city.roads.length)];
    const t = range(rng, -200, 200);
    const off = (rng() < 0.5 ? -1 : 1) * 7.6;
    if (road.axis === 'x') return { x: t, z: road.line + off };
    return { x: road.line + off, z: t };
  }

  for (let i = 0; i < 26; i++) {
    const p = randomSidewalkPos();
    const model = makePerson(rng);
    model.position.set(p.x, 0, p.z);
    scene.add(model);
    peds.push({
      model,
      pos: model.position,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 0.9, 1.6),
      walkPhase: rng() * Math.PI * 2,
      state: 'walk',       // walk | wait | sit | panic | flee | down
      stateTimer: range(rng, 4, 14),
      panicTimer: 0,
      health: 100,
      target: randomSidewalkPos(),
      update(dt, danger) {
        // danger: {x, z, radius, kind} or null — gunfire, crashes, chases.
        if (this.state !== 'down' && danger) {
          const d = Math.hypot(this.pos.x - danger.x, this.pos.z - danger.z);
          if (d < danger.radius) {
            if (this.state !== 'panic') {
              this.state = 'panic';
              this.panicTimer = range(rng, 2.5, 5);
              this.fleeX = this.pos.x + (this.pos.x - danger.x) / (d || 1) * 30;
              this.fleeZ = this.pos.z + (this.pos.z - danger.z) / (d || 1) * 30;
            }
          }
        }
        let moveSpeed = 0;
        if (this.state === 'panic') {
          this.panicTimer -= dt;
          const dx = this.fleeX - this.pos.x, dz = this.fleeZ - this.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          this.heading = Math.atan2(dx, dz);
          moveSpeed = 4.6;
          this.pos.x += (dx / d) * moveSpeed * dt;
          this.pos.z += (dz / d) * moveSpeed * dt;
          if (this.panicTimer <= 0 || d < 1.5) { this.state = 'walk'; this.stateTimer = range(rng, 5, 12); }
        } else if (this.state === 'walk') {
          const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.2) {
            this.state = rng() < 0.3 ? 'wait' : 'walk';
            this.stateTimer = range(rng, 3, 9);
            if (this.state === 'walk') this.target = randomSidewalkPos();
          } else {
            this.heading = Math.atan2(dx, dz);
            moveSpeed = this.speed;
            this.pos.x += (dx / d) * moveSpeed * dt;
            this.pos.z += (dz / d) * moveSpeed * dt;
          }
        } else if (this.state === 'wait') {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) { this.state = 'walk'; this.target = randomSidewalkPos(); }
        }
        // keep inside the city
        this.pos.x = clamp(this.pos.x, -CFG.worldHalf, CFG.worldHalf);
        this.pos.z = clamp(this.pos.z, -CFG.worldHalf, CFG.worldHalf);
        // animate: legs + arms swing; panic throws arms up
        const u = this.model.userData;
        this.walkPhase += dt * (2 + moveSpeed * 2.4);
        const swing = Math.sin(this.walkPhase) * clamp(moveSpeed / 2, 0, 1) * 0.7;
        u.legL.rotation.x = swing;
        u.legR.rotation.x = -swing;
        if (this.state === 'panic') {
          u.armL.rotation.x = -2.4 + Math.sin(this.walkPhase * 2) * 0.3;
          u.armR.rotation.x = -2.4 - Math.sin(this.walkPhase * 2) * 0.3;
          u.armL.rotation.z = 0.5; u.armR.rotation.z = -0.5;
        } else {
          u.armL.rotation.x = -swing * 0.8;
          u.armR.rotation.x = swing * 0.8;
          u.armL.rotation.z = 0.12; u.armR.rotation.z = -0.12;
        }
        this.model.rotation.y = this.heading;
        this.model.position.y = this.state === 'down' ? -0.2 : Math.abs(Math.sin(this.walkPhase)) * 0.03 * clamp(moveSpeed, 0, 1);
      },
      hit(dmg, fromX, fromZ) {
        this.health -= dmg;
        if (this.health <= 0) {
          this.state = 'down';
          this.model.rotation.x = -Math.PI / 2;
          this.model.position.y = 0.15;
          return true;
        }
        // A wound sends them running too.
        this.state = 'panic';
        this.panicTimer = 4;
        const d = Math.hypot(this.pos.x - fromX, this.pos.z - fromZ) || 1;
        this.fleeX = this.pos.x + (this.pos.x - fromX) / d * 30;
        this.fleeZ = this.pos.z + (this.pos.z - fromZ) / d * 30;
        return false;
      },
      revive() {
        this.health = 100; this.state = 'walk';
        this.model.rotation.x = 0;
        this.target = randomSidewalkPos();
      },
    });
  }

  function nearest(x, z, maxDist = 3) {
    let best = null, bd = maxDist;
    for (const p of peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  return { peds, nearest };
}
