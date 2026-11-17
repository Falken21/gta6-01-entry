// Costa Serena — procedural city: road grid, buildings, palms, streetlights,
// marina, beach and animated sea. Also owns the road graph traffic drives on.
import * as THREE from 'three';
import { CFG, makeRng, clamp, lerp } from './config.js';
import { asphaltTexture, sidewalkTexture, sandTexture, grassTexture, facadeTextures, zebraTexture, radialGlowTexture } from './textures.js';

const PALETTE = ['#e8d9b0', '#d9a06b', '#c97e6b', '#a8b8c4', '#e0cfa0', '#b98a7a', '#8fa3b0', '#e6b877'];

export function buildCity(scene, rng) {
  const R = CFG.roads, W = CFG.world;
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const colliders = [];
  const nodes = new Map(); // "x,z" -> {x,z}
  const adjacency = new Map();
  const key = (x, z) => `${x},${z}`;
  for (const x of R.avenues) for (const z of R.streets) {
    nodes.set(key(x, z), { x, z });
    adjacency.set(key(x, z), []);
  }
  const link = (a, b) => { adjacency.get(a).push(b); adjacency.get(b).push(a); };
  for (let i = 0; i < R.avenues.length; i++) for (let j = 0; j < R.streets.length - 1; j++)
    link(key(R.avenues[i], R.streets[j]), key(R.avenues[i], R.streets[j + 1]));
  for (let i = 0; i < R.avenues.length - 1; i++) for (let j = 0; j < R.streets.length; j++)
    link(key(R.avenues[i], R.streets[j]), key(R.avenues[i + 1], R.streets[j]));

  // --- ground base (grass/plaza green under everything) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W.halfX * 2 + 80, W.halfZ * 2 + 80),
    new THREE.MeshStandardMaterial({ map: grassTexture(rng), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(10, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // --- roads: asphalt strips + sidewalks ---
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTexture(rng), roughness: 0.94 });
  const asphaltWet = asphalt.clone(); asphaltWet.color.set(0x8a8f96);
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(rng), roughness: 1 });
  const roadMeshes = [];
  function roadStrip(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true;
    group.add(m); roadMeshes.push(m);
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(w + R.sidewalk * 2, d + R.sidewalk * 2), sidewalkMat);
    sw.rotation.x = -Math.PI / 2; sw.position.set(x, 0.005, z); sw.receiveShadow = true;
    group.add(sw);
  }
  for (const x of R.avenues) roadStrip(x, 0, R.width, W.halfZ * 2 + 20);
  for (const z of R.streets) roadStrip(0, z, W.halfX * 2 + 20, R.width);
  // zebra crossings at every intersection
  const zebraMat = new THREE.MeshStandardMaterial({ map: zebraTexture(), roughness: 0.9 });
  for (const x of R.avenues) for (const z of R.streets) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R.width + 1, 4), zebraMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z + R.width / 2 + 1);
    group.add(m);
  }

  // --- buildings: one or two per block, facades with lit windows ---
  const facadeMats = [];
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1 });
  for (let ai = 0; ai < R.avenues.length - 1; ai++) {
    for (let si = 0; si < R.streets.length - 1; si++) {
      const x0 = R.avenues[ai] + R.width / 2 + R.sidewalk + 2;
      const x1 = R.avenues[ai + 1] - R.width / 2 - R.sidewalk - 2;
      const z0 = R.streets[si] + R.width / 2 + R.sidewalk + 2;
      const z1 = R.streets[si + 1] - R.width / 2 - R.sidewalk - 2;
      if (x1 - x0 < 8 || z1 - z0 < 8) continue;
      // marina quarter: leave the SE blocks open for docks
      if (R.avenues[ai] >= 100 && R.streets[si] >= 80) continue;
      const nB = rng.chance(0.6) ? 2 : 1;
      for (let b = 0; b < nB; b++) {
        const w = (x1 - x0) / nB - 4;
        const d = (z1 - z0) * (0.55 + rng.next() * 0.3);
        const cx = x0 + (b + 0.5) * ((x1 - x0) / nB);
        const cz = z0 + (z1 - z0) / 2 + (rng.next() - 0.5) * 4;
        const floors = 2 + rng.int(0, 8);
        const h = floors * 3.4 + 1.5;
        const { map, emissive } = facadeTextures(rng, rng.pick(PALETTE), floors, Math.max(2, Math.round(w / 4)));
        const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 });
        facadeMats.push(mat);
        const mesh = new THREE.Mesh(buildingGeo, [mat, mat, roofMat, roofMat, mat, mat]);
        mesh.scale.set(w, h, d);
        mesh.position.set(cx, h / 2, cz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        // rooftop AC box on tall buildings
        if (floors > 5) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 2), roofMat);
          ac.position.set(cx + w * 0.2, h + 0.6, cz); ac.castShadow = true;
          group.add(ac);
        }
      }
    }
  }

  // --- palms along the beachfront avenue and plaza ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a34, roughness: 1, side: THREE.DoubleSide });
  const palms = [];
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 5.5 * s, 6), trunkMat);
    trunk.position.y = 2.75 * s; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * s, 0.6 * s), leafMat);
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.0 * s, 5.6 * s, Math.sin(a) * 1.0 * s);
      leaf.rotation.set(0.5, -a + Math.PI / 2, 0, 'YXZ');
      leaf.rotation.x = -0.95; leaf.rotation.y = -a;
      leaf.castShadow = true; g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g); palms.push(g);
    return g;
  }
  for (let z = -120; z <= 120; z += 20) { palm(146, z, 1 + rng.next() * 0.3); palm(134, z + 10, 0.9); }
  for (let i = 0; i < 14; i++) palm(rng.range(-130, 130), rng.range(-110, 110), 0.8 + rng.next() * 0.5);

  // --- streetlights at intersections + light pools ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 0 });
  const poolMat = new THREE.MeshBasicMaterial({ map: radialGlowTexture(), color: 0xffc86a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const streetlights = [];
  for (const x of R.avenues) for (const z of R.streets) {
    if (rng.chance(0.35)) continue;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), poleMat);
    pole.position.y = 3.2; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), poleMat);
    arm.position.set(0.85, 6.3, 0); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat);
    lamp.position.set(1.7, 6.2, 0); g.add(lamp);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), poolMat.clone());
    pool.rotation.x = -Math.PI / 2; pool.position.set(1.7, 0.06, 0); g.add(pool);
    g.position.set(x + R.width / 2 + 1.2, 0, z + R.width / 2 + 1.2);
    group.add(g);
    streetlights.push({ lamp: lampMat, pool: pool.material });
  }

  // --- beach + sea (east edge) ---
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(24, W.halfZ * 2 + 60),
    new THREE.MeshStandardMaterial({ map: sandTexture(rng), roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(W.beachX0 + 8, 0.03, 0); sand.receiveShadow = true;
  group.add(sand);

  const waterUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x1a6f8a) }, uSun: { value: new THREE.Color(0xffc27a) } };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(220, W.halfZ * 2 + 260, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: false,
      vertexShader: `uniform float uTime; varying vec2 vUv; varying float vWave;
        void main(){ vUv=uv; vec3 p=position;
          float w = sin(p.x*0.18+uTime*1.3)*0.35 + cos(p.y*0.22+uTime*0.9)*0.3;
          p.z += w; vWave=w; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uSun; uniform float uTime; varying vec2 vUv; varying float vWave;
        void main(){
          float sparkle = pow(max(0.0, sin(vUv.x*220.0+uTime*2.0)*sin(vUv.y*180.0-uTime*1.6)), 6.0);
          float shore = smoothstep(0.0, 0.06, vUv.x);
          vec3 col = mix(uColor*0.55, uColor, shore);
          col += uSun * sparkle * 0.9;
          col += vec3(0.06)*vWave;
          gl_FragColor = vec4(col, 1.0); }`,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(W.seaX + 110, 0.15, 0);
  group.add(water);

  // --- marina: docks + bobbing boats (SE corner) ---
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6b4e2e, roughness: 1 });
  const boats = [];
  function boat(x, z, color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 6.5), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    hull.position.y = 0.4; hull.castShadow = true; g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 2.4), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.6 }));
    cabin.position.set(0, 1.2, -0.6); cabin.castShadow = true; g.add(cabin);
    g.position.set(x, 0.1, z);
    group.add(g); boats.push(g);
    return g;
  }
  for (let i = 0; i < 3; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 34), dockMat);
    dock.position.set(128 + i * 10, 0.2, 104); dock.castShadow = true; dock.receiveShadow = true;
    group.add(dock);
    boat(124 + i * 10, 96 + (i % 2) * 14, [0xd84a3a, 0x3a6fd8, 0xe8e2d0][i]);
    boat(132 + i * 10, 110 - (i % 2) * 10, [0x2a9d8f, 0xf4a261, 0x8d6b9e][i]);
  }
  // marina water inlet
  const marinaWater = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 46),
    new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; p.z += sin(p.x*0.3+uTime*1.5)*0.15; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
        void main(){ float sp = pow(max(0.0, sin(vUv.x*160.0+uTime*2.0)*sin(vUv.y*140.0-uTime)), 8.0);
          gl_FragColor = vec4(uColor + vec3(sp*0.5), 1.0); }`,
    })
  );
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(140, 0.12, 104);
  group.add(marinaWater);

  // --- plaza fountain near downtown ---
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.8, 20), new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 }));
  fountain.position.set(-20, 0.4, 0); fountain.castShadow = true; fountain.receiveShadow = true;
  group.add(fountain);
  const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.15, 20), new THREE.MeshStandardMaterial({ color: 0x2a7a9e, roughness: 0.15, metalness: 0.3 }));
  fountainWater.position.set(-20, 0.85, 0);
  group.add(fountainWater);
  const fountainJet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x9fd8ee, roughness: 0.2, transparent: true, opacity: 0.75 }));
  fountainJet.position.set(-20, 1.6, 0);
  group.add(fountainJet);
  colliders.push({ minX: -23.8, maxX: -16.2, minZ: -3.8, maxZ: 3.8 });

  return {
    group, colliders, nodes, adjacency, roadMeshes, asphalt, asphaltWet,
    facadeMats, streetlights, boats, waterUniforms,
    update(dt, hour, rain, t) {
      waterUniforms.uTime.value = t;
      const night = hour < 6 || hour >= 19.5 ? 1 : hour >= 18 ? (hour - 18) / 1.5 : hour < 7 ? 1 - (hour - 6) : 0;
      const glow = clamp(night, 0, 1);
      for (const m of facadeMats) m.emissiveIntensity = glow * 1.4;
      lampMat.emissiveIntensity = glow * 2.2;
      for (const s of streetlights) s.pool.opacity = glow * (rain > 0.3 ? 0.28 : 0.4);
      for (let i = 0; i < boats.length; i++) {
        boats[i].position.y = 0.1 + Math.sin(t * 0.9 + i * 1.7) * 0.12;
        boats[i].rotation.z = Math.sin(t * 0.7 + i) * 0.03;
        boats[i].rotation.x = Math.cos(t * 0.6 + i * 2.1) * 0.02;
      }
      for (const m of roadMeshes) m.material = rain > 0.3 ? asphaltWet : asphalt;
    },
  };
}

export function randomRoadPoint(rng, city) {
  const xs = CFG.roads.avenues, zs = CFG.roads.streets;
  return { x: rng.pick(xs), z: rng.pick(zs) };
}
