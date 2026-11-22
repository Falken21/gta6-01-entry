// Costa Serena — city.js
// Kota prosedural: grid jalan + kurva pesisir, blok gedung berfasad, palem,
// lampu jalan, marina dengan perahu, dan pantai. Menyediakan collider gedung
// (AABB) untuk pejalan kaki, kendaraan, dan kamera.
import { CFG, PALETTE, makeRng, clamp } from './config.js';

function groundCanvas(rng) {
  // Peta tanah 2048px = 420m dunia; jalan grid tiap 40m, pantai di timur (x>150).
  const S = 2048, W = 420, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  const toPx = (v) => ((v + W / 2) / W) * S;
  // dasar trotoar
  ctx.fillStyle = '#8f8a7c'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    ctx.globalAlpha = 0.1 + rng.next() * 0.25;
    ctx.fillStyle = rng.pick(['#7d786c', '#9d9787', '#6e695e']);
    ctx.fillRect(rng.next() * S, rng.next() * S, 2 + rng.next() * 4, 2 + rng.next() * 4);
  }
  ctx.globalAlpha = 1;
  // blok rumput/taman di dalam blok kota
  for (let gx = -160; gx <= 120; gx += 40) {
    for (let gz = -160; gz <= 160; gz += 40) {
      if (rng.chance(0.22)) {
        ctx.fillStyle = '#5d7a44';
        ctx.fillRect(toPx(gx + 8), toPx(gz + 8), toPx(24) - toPx(0), toPx(24) - toPx(0));
      }
    }
  }
  // pantai pasir timur
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(toPx(150), 0, S - toPx(150), S);
  for (let i = 0; i < 2500; i++) {
    ctx.globalAlpha = 0.15 + rng.next() * 0.3;
    ctx.fillStyle = rng.pick(['#c8a86a', '#e8d5a0', '#b89a5e']);
    ctx.fillRect(toPx(150) + rng.next() * (S - toPx(150)), rng.next() * S, 2, 2);
  }
  ctx.globalAlpha = 1;
  // jalan: strip aspal + marka tengah putus-putus + zebra di persimpangan
  const roads = [];
  for (let v = -160; v <= 160; v += CFG.roadGap) roads.push(v);
  ctx.fillStyle = '#2e2f33';
  for (const v of roads) {
    ctx.fillRect(0, toPx(v - CFG.roadHalfWidth), S, toPx(2 * CFG.roadHalfWidth) - toPx(0));
    ctx.fillRect(toPx(v - CFG.roadHalfWidth), 0, toPx(2 * CFG.roadHalfWidth) - toPx(0), S);
  }
  ctx.fillStyle = 'rgba(230,220,170,0.8)';
  for (const v of roads) {
    for (let u = -200; u < 200; u += 16) {
      if (Math.abs(u - v) < 12) continue; // jeda di persimpangan
      ctx.fillRect(toPx(u), toPx(v) - 2, toPx(6) - toPx(0), 4);
      ctx.fillRect(toPx(v) - 2, toPx(u), 4, toPx(6) - toPx(0));
    }
    // zebra di tiap persimpangan
    for (const w of roads) {
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(toPx(w - 8 + k * 3.2), toPx(v - CFG.roadHalfWidth) + 4, toPx(1.6) - toPx(0), 8);
        ctx.fillRect(toPx(w - 8 + k * 3.2), toPx(v + CFG.roadHalfWidth) - 12, toPx(1.6) - toPx(0), 8);
      }
    }
  }
  // garis tepi jalan
  ctx.strokeStyle = 'rgba(220,220,210,0.55)'; ctx.lineWidth = 3;
  for (const v of roads) {
    ctx.beginPath(); ctx.moveTo(0, toPx(v - CFG.roadHalfWidth) + 2); ctx.lineTo(S, toPx(v - CFG.roadHalfWidth) + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toPx(v + CFG.roadHalfWidth) - 2); ctx.lineTo(S, toPx(v + CFG.roadHalfWidth) - 2); ctx.stroke();
  }
  return c;
}

export function buildCity(S, THREE, tex) {
  const rng = makeRng(CFG.seed + 5);
  const scene = S.scene;
  S.colliders = [];
  S.palms = [];
  S.boats = [];
  S.buildingMats = [];
  S.lampLights = [];

  // --- tanah ---
  const groundTex = new THREE.CanvasTexture(groundCanvas(rng));
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 8;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.94, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  S.groundMat = ground.material;

  // --- lapisan kilau jalan basah (muncul saat hujan; refleksi semu) ---
  const wet = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({
      color: 0x11131c, roughness: 0.12, metalness: 0.85,
      transparent: true, opacity: 0,
    })
  );
  wet.rotation.x = -Math.PI / 2;
  wet.position.y = 0.02;
  wet.receiveShadow = false;
  scene.add(wet);
  S.wetPlane = wet;

  // --- laut + pantai ---
  const waterMat = new THREE.MeshStandardMaterial({
    map: tex.water, roughness: 0.18, metalness: 0.55,
    color: 0x9fd4e8, transparent: true, opacity: 0.96,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 420), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(210 + 40, 0.05, 0);
  scene.add(sea);
  S.waterMat = waterMat;
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(45, 420),
    new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(187.5, 0.03, 0); // 165..210: jalan pesisir x=160 tetap aspal
  sand.receiveShadow = true;
  scene.add(sand);

  // --- gedung: blok di antara jalan, fasad bertekstur + jendela emissive ---
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.95 });
  for (let gx = -160; gx <= 120; gx += CFG.roadGap) {
    for (let gz = -160; gz <= 160; gz += CFG.roadGap) {
      if (rng.chance(0.18)) continue; // taman / lahan kosong
      const cx = gx + 20, cz = gz + 20;
      const w = rng.range(16, 26), d = rng.range(16, 26);
      const h = rng.chance(0.22) ? rng.range(34, 58) : rng.range(11, 30);
      const f = tex.facades[Math.floor(rng.next() * tex.facades.length)];
      const mat = new THREE.MeshStandardMaterial({
        map: f.color, emissiveMap: f.emissive, emissive: 0xffbe55,
        emissiveIntensity: 0, roughness: 0.85, metalness: 0.05,
      });
      mat.map = f.color.clone();
      mat.map.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
      mat.map.needsUpdate = true;
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      S.buildingMats.push(mat);
      // atap: unit AC + parapet tipis
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(w * 0.7, 1.2, d * 0.5);
      roof.position.set(cx, h + 0.6, cz);
      scene.add(roof);
      S.colliders.push({ x: cx, z: cz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
    }
  }

  // --- palem bergoyang di boulevard pantai + tepi jalan ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmLeaf, roughness: 0.9, side: THREE.DoubleSide });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 7, 7), trunkMat);
    trunk.position.y = 3.5; trunk.castShadow = true;
    g.add(trunk);
    const crown = new THREE.Group();
    crown.position.y = 7;
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.8), leafMat);
      const a = (i / 9) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.2, 0.15, Math.sin(a) * 1.2);
      leaf.rotation.order = 'YXZ';
      leaf.rotation.y = -a;
      leaf.rotation.x = 0.95; // menjuntai ke bawah seperti palem asli
      crown.add(leaf);
    }
    g.add(crown);
    g.position.set(x, 0, z);
    scene.add(g);
    S.palms.push({ group: g, crown, phase: rng.next() * 6 });
    S.colliders.push({ x, z, hx: 0.5, hz: 0.5 });
  }
  for (let z = -180; z <= 180; z += 24) { palm(146, z + rng.range(-4, 4)); if (rng.chance(0.6)) palm(-146, z); }
  for (let x = -120; x <= 120; x += 48) { if (rng.chance(0.5)) palm(x, 126); }

  // --- lampu jalan (tiang + kepala menyala; 6 titik cahaya nyata saat malam) ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0 });
  S.lampHeadMat = headMat;
  let lightCount = 0;
  for (let x = -160; x <= 140; x += 80) {
    for (let z = -160; z <= 160; z += 80) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6), poleMat);
      pole.position.y = 3.25; pole.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
      arm.position.set(0.8, 6.4, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3), headMat);
      head.position.set(1.5, 6.35, 0);
      g.add(pole, arm, head);
      g.position.set(x + 6.5, 0, z + 6.5);
      scene.add(g);
      if (lightCount < 6) {
        const pl = new THREE.PointLight(0xffd9a0, 0, 34, 1.6);
        pl.position.set(x + 8, 6.2, z + 6.5);
        scene.add(pl);
        S.lampLights.push(pl);
        lightCount++;
      }
    }
  }

  // --- marina selatan: dermaga kayu + perahu bobbing ---
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 5), woodMat);
  pier.position.set(120, 0.4, 196);
  pier.castShadow = true; pier.receiveShadow = true;
  scene.add(pier);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5, metalness: 0.2 });
  const hullMat2 = new THREE.MeshStandardMaterial({ color: 0x205080, roughness: 0.5, metalness: 0.2 });
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 2.4), i % 2 ? hullMat2 : hullMat);
    hull.position.y = 0.4; hull.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    cabin.position.set(-0.6, 1.4, 0);
    boat.add(hull, cabin);
    boat.position.set(96 + i * 11, 0, 196 + (i % 2 ? 8 : -8));
    boat.rotation.y = rng.range(-0.15, 0.15);
    scene.add(boat);
    S.boats.push({ group: boat, phase: rng.next() * 6 });
  }

  // --- batas dunia: pagar pembatas tak terlihat (collider logis di main) ---
  S.spawns = {
    player: { x: 0, z: 20, angle: Math.PI },
    carRow: [[-8, 26], [8, 34], [-24, -6], [30, -30], [150, 60], [120, -80]],
    police: [[-120, -120], [120, 120], [-120, 120]],
  };
  return S;
}

// Tabrakan lingkaran vs AABB gedung/palem; kembalikan posisi yang sudah dikoreksi.
export function resolveColliders(S, pos, radius) {
  for (const c of S.colliders) {
    const nx = clamp(pos.x, c.x - c.hx, c.x + c.hx);
    const nz = clamp(pos.z, c.z - c.hz, c.z + c.hz);
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        pos.x += radius; // tepat di dalam: dorong keluar
      }
    }
  }
  pos.x = clamp(pos.x, -CFG.worldHalf, CFG.worldHalf);
  pos.z = clamp(pos.z, -CFG.worldHalf, CFG.worldHalf);
}
