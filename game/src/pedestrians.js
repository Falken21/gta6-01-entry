// Costa Serena — pedestrians.js
// Pejalan kaki terartikulasi berproporsi dewasa realistis: torso, kepala,
// lengan dan kaki berayun saat berjalan, variasi warna pakaian/kulit/tinggi.
// Mereka berjalan di trotoar, menunggu di penyeberangan, duduk di bangku —
// dan PANIK/LARI saat ada tembakan, tabrakan, atau kejaran polisi di dekatnya.
import { CFG, PALETTE, makeRng, clamp, dist2 } from './config.js';

export function buildPedestrianMesh(THREE, rng) {
  const h = rng.range(1.62, 1.88);
  const scale = h / 1.75;
  const skin = PALETTE.skin[Math.floor(rng.next() * PALETTE.skin.length)];
  const shirt = PALETTE.shirt[Math.floor(rng.next() * PALETTE.shirt.length)];
  const pants = rng.pick([0x2a3444, 0x3a3a3a, 0x5a4a3a, 0x2e4a3a, 0x6a6a72]);
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: rng.pick([0x1a1210, 0x3a2a18, 0x777777, 0x8a6a3a]), roughness: 1 });
  // torso (jaket/kemeja) + kepala + rambut
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), shirtMat);
  torso.position.y = 1.12; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMat);
  head.position.y = 1.56; head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.58;
  g.add(torso, head, hair);
  // lengan berporos di bahu, kaki berporos di pinggul (ayunan jalan)
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.27, 1.38, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.58, 0.11), shirtMat);
    arm.position.y = -0.29; arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skinMat);
    hand.position.y = -0.58;
    armPivot.add(arm, hand);
    g.add(armPivot);
    arms.push(armPivot);
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.12, 0.84, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.15), pantsMat);
    leg.position.y = -0.4; leg.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    shoe.position.set(0, -0.8, 0.05);
    legPivot.add(leg, shoe);
    g.add(legPivot);
    legs.push(legPivot);
  }
  g.scale.setScalar(scale);
  g.userData = { arms, legs, phase: rng.next() * 6 };
  return g;
}

export function spawnPedestrians(S, THREE, n) {
  const rng = makeRng(CFG.seed + 33);
  S.peds = [];
  for (let i = 0; i < n; i++) {
    const mesh = buildPedestrianMesh(THREE, rng);
    const road = -160 + Math.floor(rng.next() * 9) * CFG.roadGap;
    const along = rng.range(-160, 160);
    const side = rng.chance(0.5) ? 1 : -1;
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : road + side * 7.2;
    const z = horizontal ? road + side * 7.2 : along;
    mesh.position.set(x, 0, z);
    S.scene.add(mesh);
    S.peds.push({
      mesh, x, z,
      angle: rng.next() * Math.PI * 2,
      speed: 0, state: 'walk',
      walkSpeed: rng.range(1.1, 1.7),
      targetX: x, targetZ: z,
      panic: 0, phase: rng.next() * 6,
      horizontal, road, side,
    });
  }
}

export function updatePedestrians(S, dt) {
  const danger = S.danger; // {x, z, radius, until} atau null
  for (const p of S.peds) {
    // --- reaksi bahaya: lari menjauh, lengan terangkat panik ---
    let fleeing = false;
    if (danger && S.now < danger.until) {
      const d = dist2(p.x, p.z, danger.x, danger.z);
      if (d < danger.radius) {
        fleeing = true;
        p.panic = 1;
        const away = Math.atan2(p.x - danger.x, p.z - danger.z);
        p.angle = away;
        p.speed = CFG.pedRunSpeed;
        p.x += Math.sin(away) * p.speed * dt;
        p.z += Math.cos(away) * p.speed * dt;
      }
    }
    if (!fleeing) {
      p.panic = Math.max(0, p.panic - dt * 0.4);
      // berjalan menuju target trotoar; sampai -> pilih target baru
      const d = dist2(p.x, p.z, p.targetX, p.targetZ);
      if (d < 1.5) {
        const along = p.horizontal ? p.x + (Math.random() < 0.5 ? -1 : 1) * 30 : p.z + (Math.random() < 0.5 ? -1 : 1) * 30;
        if (p.horizontal) { p.targetX = clamp(along, -165, 165); p.targetZ = p.road + p.side * 7.2; }
        else { p.targetZ = clamp(along, -165, 165); p.targetX = p.road + p.side * 7.2; }
      }
      const want = Math.atan2(p.targetX - p.x, p.targetZ - p.z);
      let diff = want - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      p.speed = p.walkSpeed;
      p.x += Math.sin(p.angle) * p.speed * dt;
      p.z += Math.cos(p.angle) * p.speed * dt;
    }
    // collider gedung (jangan menembus dinding)
    const probe = { x: p.x, z: p.z };
    S.resolveColliders(probe, 0.5);
    p.x = probe.x; p.z = probe.z;
    p.x = clamp(p.x, -CFG.worldHalf, CFG.worldHalf);
    p.z = clamp(p.z, -CFG.worldHalf, CFG.worldHalf);
    // --- animasi: ayunan lengan/kaki; panik = lengan ke atas + langkah cepat ---
    p.phase += dt * (fleeing ? 11 : 6) * (p.speed / CFG.pedWalkSpeed);
    const swing = Math.sin(p.phase) * (fleeing ? 0.9 : 0.55);
    const ud = p.mesh.userData;
    ud.legs[0].rotation.x = swing;
    ud.legs[1].rotation.x = -swing;
    if (p.panic > 0.3) {
      ud.arms[0].rotation.x = -2.4 * p.panic + Math.sin(p.phase) * 0.2;
      ud.arms[1].rotation.x = -2.4 * p.panic - Math.sin(p.phase) * 0.2;
      ud.arms[0].rotation.z = 0.5; ud.arms[1].rotation.z = -0.5;
    } else {
      ud.arms[0].rotation.x = -swing * 0.8;
      ud.arms[1].rotation.x = swing * 0.8;
      ud.arms[0].rotation.z = 0.12; ud.arms[1].rotation.z = -0.12;
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.angle;
  }
}
