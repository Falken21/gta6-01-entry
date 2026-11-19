// Costa Serena — city.js
// Procedural city: road grid, blocks with textured facades and lit windows,
// palms, streetlights, marina with animated water + bobbing boats, beach.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, mulberry32, clamp } from './config.js';
import { asphaltTexture, facadeTexture, pavementTexture, sandTexture, crosswalkTexture, waterSparkleTexture } from './textures.js';

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {x,z,hx,hz}
    this.palms = [];
    this.streetlights = [];
    this.boats = [];
    this.water = null;
    this.roads = [];
    this.build(scene);
  }

  build(scene) {
    const r = mulberry32(101);
    const asphalt = asphaltTexture(), pave = pavementTexture(), sand = sandTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize),
      new THREE.MeshStandardMaterial({ map: pave, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // Roads: grid strips with worn asphalt
    const pitch = WORLD.block + WORLD.road;
    // Two road materials from one texture: the centre dash must run ALONG each
    // road, so the horizontal strips use a 90-degree-rotated copy.
    const roadMatV = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.85 });
    const asphaltH = asphalt.clone(); asphaltH.needsUpdate = true;
    asphaltH.center.set(0.5, 0.5); asphaltH.rotation = Math.PI / 2;
    const roadMatH = new THREE.MeshStandardMaterial({ map: asphaltH, roughness: 0.85 });
    this.roadMats = [roadMatV, roadMatH];
    for (let i = -WORLD.halfGrid; i <= WORLD.halfGrid; i++) {
      for (const vertical of [true, false]) {
        const geo = new THREE.PlaneGeometry(vertical ? WORLD.road : WORLD.groundSize, vertical ? WORLD.groundSize : WORLD.road);
        const m = new THREE.Mesh(geo, vertical ? roadMatV : roadMatH);
        m.rotation.x = -Math.PI / 2;
        m.position.set(vertical ? i * pitch : 0, 0.02, vertical ? 0 : i * pitch);
        m.receiveShadow = true; scene.add(m);
      }
    }
    // road centre lines along each axis
    this.roads = [];
    for (let i = -WORLD.halfGrid; i <= WORLD.halfGrid; i++) {
      this.roads.push({ axis: 'x', at: i * pitch });
      this.roads.push({ axis: 'z', at: i * pitch });
    }
    // crosswalks at junctions
    const cwTex = crosswalkTexture();
    const cwMat = new THREE.MeshStandardMaterial({ map: cwTex, roughness: 0.9 });
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), cwMat);
      m.rotation.x = -Math.PI / 2; m.position.set(i * pitch, 0.04, j * pitch + 9);
      scene.add(m);
    }

    // Buildings per block. Blocks sit BETWEEN roads: centres offset by half a
    // pitch from the road lines, so facades never jut into a driving lane.
    const palettes = ['#c9a37e', '#b98d6e', '#d8c9a8', '#9fb4c0', '#c07a5a', '#8fa98f', '#b5a6c8'];
    for (let bx = -WORLD.halfGrid; bx <= WORLD.halfGrid; bx++) {
      for (let bz = -WORLD.halfGrid; bz <= WORLD.halfGrid; bz++) {
        const cx = bx * pitch + pitch / 2, cz = bz * pitch + pitch / 2;
        if (cz > WORLD.beachZ - 40) continue; // beach strip
        if (bx <= -2 && bz <= -2) continue; // marina quarter
        const n = 1 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const w = 14 + r() * 16, d = 14 + r() * 16, hgt = 10 + r() * r() * 42;
          // keep facades clear of the road strips: |offset| + half-size <= 16
          const ox = (r() - 0.5) * (WORLD.block - w - 14), oz = (r() - 0.5) * (WORLD.block - d - 14);
          const mat = new THREE.MeshStandardMaterial({
            map: facadeTexture(palettes[Math.floor(r() * palettes.length)], 0.35, 200 + bx * 17 + bz * 31 + k),
            roughness: 0.85, metalness: 0.05,
          });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
          b.position.set(cx + ox, hgt / 2, cz + oz);
          b.castShadow = true; b.receiveShadow = true; scene.add(b);
          // roof trim + parapet
          const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.6, d + 0.8),
            new THREE.MeshStandardMaterial({ color: 0x6b5d4f, roughness: 0.9 }));
          trim.position.set(cx + ox, hgt + 0.3, cz + oz); scene.add(trim);
          this.colliders.push({ x: cx + ox, z: cz + oz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
        }
      }
    }

    // Palms along boulevards (swaying trunks, animated in update)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9, side: THREE.DoubleSide });
    for (let i = 0; i < 90; i++) {
      const along = (r() - 0.5) * 380, lane = (Math.floor(r() * 7) - 3) * pitch;
      const x = r() < 0.5 ? along : lane + 9, z = r() < 0.5 ? lane + 9 : along;
      if (z > WORLD.beachZ - 30) continue;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 6.5, 6), trunkMat);
      trunk.position.y = 3.25; trunk.castShadow = true; g.add(trunk);
      for (let f = 0; f < 7; f++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), leafMat);
        const a = (f / 7) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.5, 6.6, Math.sin(a) * 1.5);
        leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5 - 0.4);
        g.add(leaf);
      }
      g.position.set(x, 0, z); scene.add(g);
      this.palms.push({ group: g, phase: r() * 6.28 });
    }

    // Streetlights
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.6, metalness: 0.6 });
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      if ((i + j) % 2) continue;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), poleMat);
      pole.position.y = 3.5; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), poleMat);
      arm.position.set(0.7, 6.9, 0); g.add(arm);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffc860, emissiveIntensity: 0.4 }));
      lamp.position.set(1.4, 6.85, 0); g.add(lamp);
      const light = new THREE.PointLight(0xffc860, 0, 26, 1.8);
      light.position.set(1.4, 6.7, 0); g.add(light);
      g.position.set(i * pitch + 8.5, 0, j * pitch + 8.5); scene.add(g);
      this.streetlights.push({ group: g, light, lamp });
    }

    // Beach + animated marina water
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(560, 90),
      new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
    beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.03, WORLD.beachZ + 30);
    beach.receiveShadow = true; scene.add(beach);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1d6f8e, roughness: 0.18, metalness: 0.55,
      bumpMap: waterSparkleTexture(), bumpScale: 0.6,
      transparent: true, opacity: 0.92,
    });
    this.waterMat = waterMat;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set(WORLD.marinaX, 0.15, -150);
    scene.add(water); this.water = water;
    // shore gradient strip
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(150, 18),
      new THREE.MeshStandardMaterial({ color: 0x7fc4c9, roughness: 0.4, transparent: true, opacity: 0.7 }));
    shore.rotation.x = -Math.PI / 2; shore.position.set(WORLD.marinaX, 0.12, -72); scene.add(shore);

    // Marina boats bobbing
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 8), hullMat);
      hull.position.y = 0.5; boat.add(hull);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3),
        new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.4 }));
      cab.position.set(0, 1.5, -0.5); boat.add(cab);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), poleMat);
      mast.position.y = 4; boat.add(mast);
      boat.position.set(WORLD.marinaX - 55 + (i % 4) * 32, 0.2, -120 - Math.floor(i / 4) * 45);
      boat.rotation.y = (r() - 0.5) * 0.3; scene.add(boat);
      this.boats.push({ group: boat, phase: r() * 6.28 });
    }
    // marina pier
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 90),
      new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.95 }));
    pier.position.set(WORLD.marinaX + 40, 0.35, -140); pier.castShadow = true; scene.add(pier);
  }

  collide(x, z, radius) {
    for (const c of this.colliders) {
      if (Math.abs(x - c.x) < c.hx + radius && Math.abs(z - c.z) < c.hz + radius) return c;
    }
    return null;
  }

  setWet(wet) {
    // Real wet-road effect: asphalt gets glossy + darker, not an overlay.
    for (const m of (this.roadMats || [])) { m.roughness = wet ? 0.22 : 0.85; m.color.set(wet ? 0x777788 : 0xffffff); }
  }
  setNight(night) {
    for (const s of this.streetlights) {
      s.light.intensity = night ? 14 : 0;
      s.lamp.material.emissiveIntensity = night ? 2.2 : 0.4;
    }
  }
  update(t, dt) {
    for (const p of this.palms) p.group.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.045;
    for (const b of this.boats) {
      b.group.position.y = 0.2 + Math.sin(t * 0.8 + b.phase) * 0.18;
      b.group.rotation.z = Math.sin(t * 0.6 + b.phase) * 0.03;
    }
    if (this.waterMat && this.waterMat.bumpMap) {
      this.waterMat.bumpMap.offset.x = t * 0.01; this.waterMat.bumpMap.offset.y = t * 0.013;
    }
  }
}
