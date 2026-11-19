// Costa Serena — city.js
// One job: the procedural city. Road grid + coastal curve, blocks of
// buildings with lit-window facades, palms, streetlights, marina, beach.
// Exports the colliders and the road network the other systems drive on.
import * as THREE from 'three';
import { CFG, clamp, mulberry32, pick, range } from './config.js';
import {
  asphaltTexture, roadStripTexture, crosswalkTexture, pavementTexture,
  sandTexture, facadeTexture, waterTexture, barkTexture,
} from './textures.js';

const PALETTE = ['#d8b48a', '#c9a37e', '#e6d3b3', '#b98d6e', '#9fb4c0', '#d9c9a8', '#c47f6a', '#7fa08e'];
const ACCENTS = ['#2e6f8e', '#c4552d', '#d9a441', '#4a7d5c', '#8e4a6b'];

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildCity(scene, seed = CFG.seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const colliders = [];
  const roads = [];
  const junctions = [];
  const palms = [];
  const boats = [];
  const lampPools = [];
  const facadeMats = [];
  const P = CFG.blockPitch, H = CFG.gridHalf, RW = CFG.roadWidth;

  // ---- Ground: city slab, sand strip, sea -------------------------------
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ map: pavementTexture(seed), roughness: 0.95, metalness: 0.0 }),
  );
  slab.rotation.x = -Math.PI / 2; slab.position.set(0, 0, 0);
  slab.receiveShadow = true;
  group.add(slab);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 470),
    new THREE.MeshStandardMaterial({ map: sandTexture(seed), roughness: 1.0 }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(-212, 0.01, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTexture(seed), roughness: 0.25, metalness: 0.55,
    transparent: true, opacity: 0.94,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(150, 480), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(-272, 0.02, 0);
  water.receiveShadow = true;
  group.add(water);

  // ---- Roads ------------------------------------------------------------
  const stripTexX = roadStripTexture(seed, true);   // dashes along X
  const stripTexZ = roadStripTexture(seed, false);  // dashes along Z
  const crossTex = crosswalkTexture();
  const crossMat = new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.9 });
  for (let i = -H; i <= H; i++) {
    const line = i * P;
    // along X
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(460, RW),
      new THREE.MeshStandardMaterial({ map: stripTexX.clone(), roughness: 0.92 }));
    rx.material.map.repeat.set(14, 1);
    rx.material.map.needsUpdate = true;
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(0, 0.02, line);
    rx.receiveShadow = true;
    group.add(rx);
    roads.push({ axis: 'x', line, from: -220, to: 220 });
    // along Z
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(RW, 460),
      new THREE.MeshStandardMaterial({ map: stripTexZ.clone(), roughness: 0.92 }));
    rz.material.map.repeat.set(1, 14);
    rz.material.map.needsUpdate = true;
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(line, 0.021, 0);
    rz.receiveShadow = true;
    group.add(rz);
    roads.push({ axis: 'z', line, from: -220, to: 220 });
  }
  // Crosswalks at every junction.
  for (let i = -H; i <= H; i++) {
    for (let j = -H; j <= H; j++) {
      junctions.push({ x: i * P, z: j * P });
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(RW + 2, 5), crossMat);
      cw.rotation.x = -Math.PI / 2;
      cw.position.set(i * P, 0.03, j * P + RW / 2 + 1.5);
      cw.receiveShadow = true;
      group.add(cw);
    }
  }

  // ---- Blocks: buildings, parks, parking --------------------------------
  const barkTex = barkTexture(seed);
  const trunkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9, side: THREE.DoubleSide });
  const frondMat2 = new THREE.MeshStandardMaterial({ color: 0x5a9a44, roughness: 0.9, side: THREE.DoubleSide });

  function makePalm(x, z, scale = 1) {
    const palm = new THREE.Group();
    const h = 6.5 * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.26 * scale, h, 7), trunkMat);
    trunk.position.y = h / 2; trunk.castShadow = true;
    palm.add(trunk);
    const crown = new THREE.Group();
    crown.position.y = h;
    for (let i = 0; i < 8; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55 * scale, 3.4 * scale, 4), i % 2 ? frondMat : frondMat2);
      frond.rotation.z = Math.PI / 2 - 0.55;
      frond.rotation.y = (i / 8) * Math.PI * 2;
      frond.position.y = 0.4;
      frond.castShadow = true;
      crown.add(frond);
    }
    palm.add(crown);
    palm.position.set(x, 0, z);
    palm.userData = { crown, phase: rng() * Math.PI * 2 };
    group.add(palm);
    palms.push(palm);
    return palm;
  }

  function makeBuilding(cx, cz, w, d, hgt, base, accent) {
    const { map, emissive } = facadeTexture(Math.floor(rng() * 1e9), base, accent);
    const mat = new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0,
      roughness: 0.85, metalness: 0.05,
    });
    facadeMats.push(mat);
    const b = box(w, hgt, d, mat, cx, hgt / 2, cz, group);
    // roof cap + AC boxes
    box(w + 0.6, 0.5, d + 0.6, new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1 }), cx, hgt + 0.25, cz, group);
    if (rng() < 0.5) box(2, 1.2, 2, new THREE.MeshStandardMaterial({ color: 0x6a655c, roughness: 1 }), cx + w * 0.2, hgt + 1, cz, group);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return b;
  }

  for (let i = -H; i < H; i++) {
    for (let j = -H; j < H; j++) {
      const bx = i * P + P / 2, bz = j * P + P / 2;
      const distCentre = Math.max(Math.abs(bx), Math.abs(bz));
      const r = rng();
      if (r < 0.12) {
        // Park: lawn, palms, benches.
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(30, 30),
          new THREE.MeshStandardMaterial({ color: 0x5d8a4a, roughness: 1 }),
        );
        lawn.rotation.x = -Math.PI / 2; lawn.position.set(bx, 0.015, bz);
        lawn.receiveShadow = true;
        group.add(lawn);
        for (let k = 0; k < 4; k++) makePalm(bx + range(rng, -12, 12), bz + range(rng, -12, 12), range(rng, 0.8, 1.2));
        box(4, 0.5, 1.2, new THREE.MeshStandardMaterial({ color: 0x7a5c38, roughness: 1 }), bx, 0.25, bz + 8, group);
        continue;
      }
      if (r < 0.2) {
        // Open parking lot with a few parked cars (spawned by traffic.js).
        continue;
      }
      // Buildings: 1 tall slab or 2-4 smaller ones.
      const tall = distCentre < 90 && rng() < 0.55;
      if (tall) {
        const hgt = range(rng, 26, 46);
        makeBuilding(bx, bz, range(rng, 20, 26), range(rng, 20, 26), hgt,
          pick(rng, PALETTE), pick(rng, ACCENTS));
      } else {
        const n = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const w = range(rng, 9, 14), d = range(rng, 9, 14);
          const ox = (k % 2 === 0 ? -8 : 8) + range(rng, -2, 2);
          const oz = (k < 2 ? -8 : 8) + range(rng, -2, 2);
          makeBuilding(bx + ox, bz + oz, w, d, range(rng, 7, 18),
            pick(rng, PALETTE), pick(rng, ACCENTS));
        }
      }
      // Palms on the block corners.
      if (rng() < 0.7) makePalm(bx - 15, bz - 15, range(rng, 0.85, 1.15));
      if (rng() < 0.5) makePalm(bx + 15, bz + 15, range(rng, 0.85, 1.15));
    }
  }

  // ---- Boulevard palms + streetlights -----------------------------------
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0 });
  const poolMatBase = new THREE.MeshBasicMaterial({
    color: 0xffdf8a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = -H; i <= H; i++) {
    for (let j = -3; j <= 3; j += 2) {
      const x = i * P + 8, z = j * P;
      if (rng() < 0.45) makePalm(x, z - 9, 1);
      // streetlight on alternating corners
      if ((i + j) % 2 === 0) {
        const pole = new THREE.Group();
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), poleMat);
        p.position.y = 3.2; p.castShadow = true;
        pole.add(p);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), poleMat);
        arm.position.set(-0.8, 6.3, 0);
        pole.add(arm);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), lampMat);
        head.position.set(-1.6, 6.25, 0);
        pole.add(head);
        pole.position.set(x + 1.5, 0, z + 7.5);
        group.add(pole);
        const pool = new THREE.Mesh(
          new THREE.CircleGeometry(5.5, 20),
          poolMatBase.clone(),
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(x - 0.2, 0.04, z + 7.5);
        group.add(pool);
        lampPools.push(pool.material);
      }
    }
  }

  // ---- Marina: pier + bobbing boats --------------------------------------
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 1 });
  const pier = box(34, 0.8, 5, pierMat, -212, 0.4, 40, group);
  pier.receiveShadow = true;
  const boatHull = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.4, metalness: 0.2 });
  const boatHull2 = new THREE.MeshStandardMaterial({ color: 0x2e6f8e, roughness: 0.4, metalness: 0.2 });
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 2.6), i % 2 ? boatHull : boatHull2);
    hull.position.y = 0.7; hull.castShadow = true;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 }));
    cabin.position.set(-0.5, 2, 0); cabin.castShadow = true;
    boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), poleMat);
    mast.position.set(1.6, 3.5, 0);
    boat.add(mast);
    boat.position.set(-222 - rng() * 26, 0, -60 + i * 26 + range(rng, -6, 6));
    boat.rotation.y = range(rng, -0.2, 0.2);
    boat.userData = { phase: rng() * Math.PI * 2, baseY: 0 };
    group.add(boat);
    boats.push(boat);
  }

  // ---- Beach props: umbrellas --------------------------------------------
  for (let i = 0; i < 5; i++) {
    const ux = -200 - rng() * 8, uz = -140 + i * 70 + range(rng, -10, 10);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), poleMat);
    pole.position.set(ux, 1.2, uz);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: pick(rng, [0xd9552d, 0x2e6f8e, 0xd9a441]), roughness: 0.9 }));
    top.position.set(ux, 2.7, uz); top.castShadow = true;
    group.add(top);
  }

  // ---- Helpers -------------------------------------------------------------
  function randomRoadPos() {
    const road = roads[Math.floor(rng() * roads.length)];
    const t = range(rng, road.from + 12, road.to - 12);
    if (road.axis === 'x') return { x: t, z: road.line, heading: rng() < 0.5 ? 0 : Math.PI };
    return { x: road.line, z: t, heading: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  function nearestRoad(x, z) {
    // Snap to the closest road centre line.
    let best = null, bd = 1e9;
    for (const road of roads) {
      const d = road.axis === 'x' ? Math.abs(z - road.line) : Math.abs(x - road.line);
      if (d < bd) { bd = d; best = road; }
    }
    if (best.axis === 'x') return { x: clamp(x, -220, 220), z: best.line };
    return { x: best.line, z: clamp(z, -220, 220) };
  }

  function setNight(f) {
    // f: 0 = day, 1 = full night. Windows glow, lamp pools fade in.
    for (const m of facadeMats) m.emissiveIntensity = f * 1.6;
    lampMat.emissiveIntensity = f * 2.2;
    for (const p of lampPools) p.opacity = f * 0.28;
  }

  return {
    group, colliders, roads, junctions, palms, boats, water, waterMat,
    randomRoadPos, nearestRoad, setNight,
    spawn: { x: 8, z: 88, heading: Math.PI / 2 },
    marina: { x: -212, z: 40 },
    beach: { x: -205, z: 0 },
  };
}
