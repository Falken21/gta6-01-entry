// Costa Serena — pedestrians: articulated low-poly walkers on the pavements,
// with routines (walk, wait at crossings, sit on benches) and flee behaviour.
import * as THREE from 'three';
import { CFG, makeRng, clamp, dist2D, resolveCircleAABB } from './config.js';

const SHIRTS = [0xd84a3a, 0x3a6fd8, 0xe8e2d0, 0x2a9d8f, 0xf4a261, 0x8d6b9e, 0x4a7a4f, 0xd8b13a];
const PANTS = [0x2e3440, 0x4a3f35, 0x3a5a7a, 0x5a5a5a, 0x6b4a3a];
const SKINS = [0xc98d64, 0x8a5a38, 0xe8b88a, 0x6b4226, 0xd8a075];

export function makePedModel(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng.next() * SHIRTS.length)], roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[Math.floor(rng.next() * PANTS.length)], roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(rng.next() * SKINS.length)], roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: rng.pick([0x1a1a1a, 0x4a2e1a, 0x8a8a8a, 0x2e1a0a]), roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.12; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.66; g.add(hair);
  const mkLimb = (mat, w, h) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    mesh.position.y = -h / 2; mesh.castShadow = true;
    pivot.add(mesh);
    return { pivot, mesh };
  };
  const armL = mkLimb(skin, 0.13, 0.55); armL.pivot.position.set(-0.33, 1.38, 0); g.add(armL.pivot);
  const armR = mkLimb(skin, 0.13, 0.55); armR.pivot.position.set(0.33, 1.38, 0); g.add(armR.pivot);
  const legL = mkLimb(pants, 0.16, 0.62); legL.pivot.position.set(-0.14, 0.82, 0); g.add(legL.pivot);
  const legR = mkLimb(pants, 0.16, 0.62); legR.pivot.position.set(0.14, 0.82, 0); g.add(legR.pivot);
  return { group: g, armL, armR, legL, legR, torso };
}

export function createPedestrians(scene, city, rng) {
  const peds = [];
  const R = CFG.roads;
  function sidewalkPoint() {
    // pick a road, then a point on its sidewalk
    if (rng.chance(0.5)) {
      const x = rng.pick(R.avenues) + (rng.chance(0.5) ? 1 : -1) * (R.width / 2 + 1.6);
      return { x, z: rng.range(-R.streets[R.streets.length - 1] - 5, R.streets[R.streets.length - 1] + 5) };
    }
    const z = rng.pick(R.streets) + (rng.chance(0.5) ? 1 : -1) * (R.width / 2 + 1.6);
    return { x: rng.range(-R.avenues[R.avenues.length - 1] - 5, R.avenues[R.avenues.length - 1] + 5), z };
  }
  for (let i = 0; i < CFG.peds.count; i++) {
    const p = sidewalkPoint();
    const model = makePedModel(rng);
    model.group.position.set(p.x, 0, p.z);
    scene.add(model.group);
    peds.push({
      model, pos: model.group.position,
      heading: rng.next() * Math.PI * 2,
      speed: 1.0 + rng.next() * 0.7,
      phase: rng.next() * 6,
      state: 'walk', // walk | wait | flee | down
      target: sidewalkPoint(),
      waitT: 0, fleeT: 0, health: 100,
    });
  }

  function fleeFrom(ped, x, z) {
    const d = dist2D(ped.pos.x, ped.pos.z, x, z);
    if (d < 14 && ped.state !== 'down') {
      ped.state = 'flee'; ped.fleeT = 2.5;
      ped.target = { x: ped.pos.x + (ped.pos.x - x) * 2, z: ped.pos.z + (ped.pos.z - z) * 2 };
    }
  }

  function update(dt, danger) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (danger) {
        for (const d of danger) fleeFrom(ped, d.x, d.z);
      }
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        if (ped.fleeT <= 0) { ped.state = 'walk'; ped.target = sidewalkPoint(); }
      }
      if (ped.state === 'wait') {
        ped.waitT -= dt;
        if (ped.waitT <= 0) { ped.state = 'walk'; ped.target = sidewalkPoint(); }
        ped.model.armL.pivot.rotation.x = 0; ped.model.armR.pivot.rotation.x = 0;
        ped.model.legL.pivot.rotation.x = 0; ped.model.legR.pivot.rotation.x = 0;
        continue;
      }
      const dx = ped.target.x - ped.pos.x, dz = ped.target.z - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        if (ped.state === 'flee') { ped.state = 'walk'; ped.target = sidewalkPoint(); }
        else if (rng.chance(0.25)) { ped.state = 'wait'; ped.waitT = 2 + rng.next() * 5; }
        else ped.target = sidewalkPoint();
        continue;
      }
      const want = Math.atan2(dx, dz);
      let dh = want - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
      const sp = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
      ped.pos.x += Math.sin(ped.heading) * sp * dt;
      ped.pos.z += Math.cos(ped.heading) * sp * dt;
      for (const box of city.colliders) {
        const res = resolveCircleAABB(ped.pos.x, ped.pos.z, 0.4, box);
        if (res) { ped.pos.x += res.x; ped.pos.z += res.z; ped.target = sidewalkPoint(); }
      }
      ped.pos.x = clamp(ped.pos.x, -CFG.world.halfX, CFG.world.beachX0 + 6);
      ped.pos.z = clamp(ped.pos.z, -CFG.world.halfZ, CFG.world.halfZ);
      // walk cycle: arms and legs swing in opposition
      ped.phase += dt * sp * 3.4;
      const s = Math.sin(ped.phase) * (ped.state === 'flee' ? 0.85 : 0.55);
      ped.model.legL.pivot.rotation.x = s;
      ped.model.legR.pivot.rotation.x = -s;
      ped.model.armL.pivot.rotation.x = -s * 0.8;
      ped.model.armR.pivot.rotation.x = s * 0.8;
      ped.model.group.rotation.y = ped.heading;
      ped.model.group.position.y = Math.abs(Math.sin(ped.phase)) * 0.04;
    }
  }

  return { peds, update, fleeFrom };
}
