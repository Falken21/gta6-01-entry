// Costa Serena — city.js
// Kota prosedural: grid jalan + garis pantai melengkung, blok gedung dengan
// fasad bertekstur, palem, lampu jalan, marina dengan perahu, pantai & laut.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildCity(W) {
  const { scene, rng, textures: T } = W;
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const group = new THREE.Group();
  scene.add(group);
  const city = { group, colliders, palms: [], boats: [], lamps: [], waterMat: null, puddles: [], update: null };

  // ---- tanah dasar (rumput kering / tanah kota) ----
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x7a7d5e, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 60);
  ground.receiveShadow = true;
  group.add(ground);

  // ---- jalan: strip aspal sepanjang avenue & street ----
  // Satu tile tekstur = ±28 m jalan, supaya marka & aus terbaca (bukan regang).
  T.asphaltH.repeat.set(16, 1);
  T.asphaltHRough.repeat.set(16, 1);
  T.asphaltHNormal.repeat.set(16, 1);
  T.asphalt.repeat.set(1, 11);
  T.asphaltRough.repeat.set(1, 11);
  T.asphaltNormal.repeat.set(1, 11);
  const roadMatH = new THREE.MeshStandardMaterial({
    map: T.asphaltH, roughnessMap: T.asphaltHRough, normalMap: T.asphaltHNormal,
    roughness: 0.92, metalness: 0.0, envMapIntensity: 0.35,
  });
  const roadMat = new THREE.MeshStandardMaterial({
    map: T.asphalt, roughnessMap: T.asphaltRough, normalMap: T.asphaltNormal,
    roughness: 0.92, metalness: 0.0, envMapIntensity: 0.35,
  });
  city.roadMat = roadMat;
  city.roadMatH = roadMatH;
  const roadGeoH = new THREE.PlaneGeometry(CFG.cityMaxX - CFG.cityMinX + 40, CFG.roadW);
  const roadGeoV = new THREE.PlaneGeometry(CFG.roadW, CFG.cityMaxZ - CFG.cityMinZ + 40);
  for (const z of CFG.streets) {
    const m = new THREE.Mesh(roadGeoH, roadMatH);
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, z);
    m.receiveShadow = true; group.add(m);
  }
  for (const x of CFG.avenues) {
    const m = new THREE.Mesh(roadGeoV, roadMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, 0);
    m.receiveShadow = true; group.add(m);
  }
  // trotoar: strip di sisi jalan (tile ubin ±3,6 m)
  const walkMatH = new THREE.MeshStandardMaterial({ map: T.sidewalk.clone(), roughness: 0.95 });
  walkMatH.map.repeat.set(32, 1); walkMatH.map.needsUpdate = true;
  const walkMatV = new THREE.MeshStandardMaterial({ map: T.sidewalk.clone(), roughness: 0.95 });
  walkMatV.map.repeat.set(1, 21); walkMatV.map.needsUpdate = true;
  const walkMat = walkMatH;
  const walkGeoH = new THREE.PlaneGeometry(CFG.cityMaxX - CFG.cityMinX + 40, 4);
  const walkGeoV = new THREE.PlaneGeometry(4, CFG.cityMaxZ - CFG.cityMinZ + 40);
  for (const z of CFG.streets) for (const dz of [-9, 9]) {
    const m = new THREE.Mesh(walkGeoH, walkMatH);
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.03, z + dz);
    m.receiveShadow = true; group.add(m);
  }
  for (const x of CFG.avenues) for (const dx of [-9, 9]) {
    const m = new THREE.Mesh(walkGeoV, walkMatV);
    m.rotation.x = -Math.PI / 2; m.position.set(x + dx, 0.03, 0);
    m.receiveShadow = true; group.add(m);
  }
  // boulevard pesisir (jalan pantai timur-barat di z=138, untuk balapan & shot coast)
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CFG.cityMaxX - CFG.cityMinX + 40, CFG.roadW), roadMatH);
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, 138);
    m.receiveShadow = true; group.add(m);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(CFG.cityMaxX - CFG.cityMinX + 40, 4), walkMat);
    w.rotation.x = -Math.PI / 2; w.position.set(0, 0.03, 129);
    w.receiveShadow = true; group.add(w);
  }
  // zebra cross di tiap persimpangan utama
  const crossMat = new THREE.MeshStandardMaterial({ map: T.crosswalk, roughness: 0.9 });
  for (const x of CFG.avenues) for (const z of CFG.streets) {
    if (Math.abs(x) > 150 || Math.abs(z) > 90) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), crossMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2;
    m.position.set(x, 0.04, z - 9); m.receiveShadow = true; group.add(m);
  }

  // ---- gedung per blok ----
  const facadeMats = T.facades.map((f) => new THREE.MeshStandardMaterial({
    map: f.map, emissiveMap: f.emissive, emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.0, roughness: f.rough,
  }));
  city.facadeMats = facadeMats;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 1 });
  const blocks = [];
  for (let ai = 0; ai < CFG.avenues.length - 1; ai++) {
    for (let si = 0; si < CFG.streets.length - 1; si++) {
      const x0 = CFG.avenues[ai] + 11, x1 = CFG.avenues[ai + 1] - 11;
      const z0 = CFG.streets[si] + 11, z1 = CFG.streets[si + 1] - 11;
      blocks.push({ x0, x1, z0, z1 });
    }
  }
  for (const b of blocks) {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const w = 14 + rng() * 16, d = 12 + rng() * 14;
      const cx = b.x0 + w / 2 + rng() * Math.max(1, (b.x1 - b.x0) - w);
      const cz = b.z0 + d / 2 + rng() * Math.max(1, (b.z1 - b.z0) - d);
      const h = 10 + rng() * rng() * 42;   // sebagian menara tinggi
      const mat = facadeMats[Math.floor(rng() * facadeMats.length)];
      const bld = box(w, h, d, mat);
      bld.position.set(cx, h / 2, cz);
      group.add(bld);
      const roof = box(w + 0.6, 0.5, d + 0.6, roofMat);
      roof.position.set(cx, h + 0.25, cz);
      group.add(roof);
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    }
    // palem di sudut blok
    if (rng() < 0.7) {
      const px = b.x0 + 4 + rng() * 6, pz = b.z0 + 4 + rng() * 6;
      city.palms.push(makePalm(px, pz, rng, group));
    }
  }

  // ---- palem di boulevard pantai (di tepi selatan jalan, bukan di tengah jalan) ----
  for (let x = -190; x <= 190; x += 16) {
    if (rng() < 0.85) city.palms.push(makePalm(x + (rng() - 0.5) * 4, 147.5 + (rng() - 0.5) * 2, rng, group));
    if (rng() < 0.5) city.palms.push(makePalm(x + (rng() - 0.5) * 4, -141 + (rng() - 0.5) * 3, rng, group));
  }

  // ---- lampu jalan di persimpangan ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.7 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0 });
  city.lampMat = lampMat;
  const poolMat = new THREE.MeshBasicMaterial({
    map: T.blob, color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false,
  });
  city.poolMat = poolMat;
  for (const x of CFG.avenues) for (const z of CFG.streets) {
    if ((Math.abs(x) + Math.abs(z)) % 120 !== 0) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), poleMat);
    pole.position.set(x + 8, 3.5, z + 8); pole.castShadow = true; group.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampMat);
    head.position.set(x + 8, 7.1, z + 8); group.add(head);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x + 8, 0.06, z + 8); group.add(pool);
    city.lamps.push({ x: x + 8, z: z + 8 });
  }

  // ---- pantai + laut ----
  T.sand.repeat.set(10, 1);
  const sandMat = new THREE.MeshStandardMaterial({ map: T.sand, roughness: 1 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(460, 26), sandMat);
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.04, 158);
  sand.receiveShadow = true; group.add(sand);
  const waterMat = new THREE.MeshStandardMaterial({
    color: CFG.water, roughness: 0.12, metalness: 0.1,
    normalMap: T.waterNormal, envMapIntensity: 1.2, transparent: true, opacity: 0.94,
  });
  city.waterMat = waterMat;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 340), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.1, 168 + 170);
  group.add(water);

  // ---- marina: dermaga + perahu bergoyang ----
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
  for (const px of [-60, 0, 60]) {
    const pier = box(6, 0.8, 26, pierMat);
    pier.position.set(px, 0.4, 162); group.add(pier);
  }
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.4, metalness: 0.2 });
  const hullMat2 = new THREE.MeshStandardMaterial({ color: 0x3a6ea8, roughness: 0.4, metalness: 0.2 });
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = box(3.2, 1.1, 8, i % 2 ? hullMat2 : hullMat);
    hull.position.y = 0.6; boat.add(hull);
    const cabin = box(2, 1, 3.4, new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.35 }));
    cabin.position.set(0, 1.6, -0.6); boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 6), poleMat);
    mast.position.set(0, 4, 0.5); boat.add(mast);
    boat.position.set(-84 + i * 34 + (rng() - 0.5) * 6, 0.15, 176 + (rng() - 0.5) * 8);
    boat.rotation.y = (rng() - 0.5) * 0.3;
    boat.traverse((o) => { o.castShadow = true; });
    group.add(boat);
    city.boats.push({ g: boat, phase: rng() * 6.28, baseY: 0.15 });
  }

  // ---- genangan (puddle) untuk jalan basah — muncul saat hujan ----
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x9db8c4, roughness: 0.05, metalness: 0.55, envMapIntensity: 1.6,
    transparent: true, opacity: 0,
  });
  city.puddleMat = puddleMat;
  for (let i = 0; i < 26; i++) {
    const road = rng() < 0.5;
    const px = road ? CFG.avenues[Math.floor(rng() * CFG.avenues.length)] + (rng() - 0.5) * 8
      : (rng() - 0.5) * 380;
    const pz = road ? (rng() - 0.5) * 260
      : CFG.streets[Math.floor(rng() * CFG.streets.length)] + (rng() - 0.5) * 8;
    const p = new THREE.Mesh(new THREE.CircleGeometry(2.5 + rng() * 4, 18), puddleMat);
    p.rotation.x = -Math.PI / 2; p.position.set(px, 0.05, pz);
    group.add(p);
    city.puddles.push(p);
  }

  // ---- update per-frame: palem bergoyang, perahu bobbing, air bergerak ----
  city.update = (dt, t) => {
    for (const p of city.palms) {
      p.top.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.07;
      p.top.rotation.x = Math.cos(t * 0.7 + p.phase) * 0.05;
    }
    for (const b of city.boats) {
      b.g.position.y = b.baseY + Math.sin(t * 0.8 + b.phase) * 0.12;
      b.g.rotation.z = Math.sin(t * 0.6 + b.phase) * 0.03;
      b.g.rotation.x = Math.cos(t * 0.5 + b.phase) * 0.02;
    }
    if (city.waterMat) {
      city.waterMat.normalMap.offset.x = t * 0.008;
      city.waterMat.normalMap.offset.y = t * 0.005;
    }
  };
  return city;
}

function makePalm(x, z, rng, group) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e5136, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 7 + rng() * 2, 7), trunkMat);
  trunk.position.y = 3.5; trunk.castShadow = true; g.add(trunk);
  const top = new THREE.Group();
  top.position.y = 7 + rng();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.85, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4), leafMat);
    leaf.position.y = 0.4;
    leaf.rotation.x = -0.9 - rng() * 0.3;
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 7) * Math.PI * 2;
    pivot.add(leaf);
    leaf.position.set(0, 0.9, 1.2);
    leaf.rotation.x = -0.7;
    top.add(pivot);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x7a5a28, roughness: 0.9 }));
  nuts.position.y = -0.2; top.add(nuts);
  top.traverse((o) => { o.castShadow = true; });
  g.add(top);
  g.position.set(x, 0, z);
  group.add(g);
  return { g, top, phase: rng() * 6.28 };
}

// Util: tabrak AABB — dorong lingkaran keluar dari kotak.
export function collideCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
        return true;
      }
      pos.x = c.maxX + radius;
      return true;
    }
  }
  return false;
}
export function onRoad(x, z) {
  for (const ax of CFG.avenues) if (Math.abs(x - ax) < CFG.roadW / 2 + 2) return true;
  for (const sz of CFG.streets) if (Math.abs(z - sz) < CFG.roadW / 2 + 2) return true;
  return false;
}
