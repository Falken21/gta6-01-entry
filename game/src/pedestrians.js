// Costa Serena — pedestrians.js
// Articulated adult-proportioned walkers on pavements with simple routines.
// They sit on benches, wait at crossings — and PANIC: sprint away from gunfire,
// collisions and police chases (Gemini critique fix).
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, mulberry32, clamp } from './config.js';

const SHIRTS = [0xd95f4b, 0x4b7ad9, 0x53a86b, 0xe0c060, 0x9b59b6, 0xe8e8e8, 0x333a44, 0xc97ba0];
const SKINS = [0xe8b88a, 0xc98e5f, 0x8a5a34, 0xf0c8a0];

export function buildPedestrian(seed) {
  const r = mulberry32(seed);
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(r() * SHIRTS.length)], roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(r() * SKINS.length)], roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: [0x2c3e50, 0x5a4632, 0x444444][Math.floor(r() * 3)], roughness: 0.95 });
  // adult proportions: legs ~0.85, torso ~0.62, head ~0.24
  const legL = new THREE.Group(); legL.position.set(-0.13, 0.85, 0);
  const legR = new THREE.Group(); legR.position.set(0.13, 0.85, 0);
  for (const leg of [legL, legR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.18), pants);
    m.position.y = -0.42; m.castShadow = true; leg.add(m); g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.16; torso.castShadow = true; g.add(torso);
  const armL = new THREE.Group(); armL.position.set(-0.33, 1.42, 0);
  const armR = new THREE.Group(); armR.position.set(0.33, 1.42, 0);
  for (const arm of [armL, armR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), shirt);
    m.position.y = -0.3; m.castShadow = true; arm.add(m); g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin);
  head.position.y = 1.66; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, 1.4),
    new THREE.MeshStandardMaterial({ color: [0x1a1a1a, 0x4a2f18, 0x777777][Math.floor(r() * 3)], roughness: 1 }));
  hair.position.y = 1.69; g.add(hair);
  return { group: g, legL, legR, armL, armR };
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene; this.city = city; this.list = [];
    const r = mulberry32(303);
    const pitch = WORLD.block + WORLD.road;
    for (let i = 0; i < 34; i++) {
      const lane = (Math.floor(r() * 7) - 3) * pitch;
      const along = (r() - 0.5) * 360;
      const x = r() < 0.5 ? along : lane + 9.5;
      const z = r() < 0.5 ? lane + 9.5 : along;
      if (z > 200) continue;
      const p = buildPedestrian(400 + i);
      p.group.position.set(x, 0, z);
      scene.add(p.group);
      this.list.push({
        ...p, x, z, heading: r() * Math.PI * 2, speed: 0.9 + r() * 0.7,
        state: 'walk', panic: 0, phase: r() * 6.28, wait: 0, axis: r() < 0.5 ? 'x' : 'z',
      });
    }
  }
  // danger event: gunfire / crash / chase at (x,z) -> nearby walkers panic
  scare(x, z, radius = 22) {
    for (const p of this.list) {
      const d = Math.hypot(p.group.position.x - x, p.group.position.z - z);
      if (d < radius) {
        p.panic = 3 + Math.random() * 3; p.state = 'panic';
        p.heading = Math.atan2(p.group.position.x - x, p.group.position.z - z);
      }
    }
  }
  update(dt, t) {
    const pitch = WORLD.block + WORLD.road;
    for (const p of this.list) {
      let speed = p.speed;
      if (p.state === 'panic') {
        p.panic -= dt; speed = 5.2; // sprint away
        if (p.panic <= 0) p.state = 'walk';
      } else if (p.wait > 0) { p.wait -= dt; speed = 0; }
      else if (Math.random() < dt * 0.02) p.wait = 1 + Math.random() * 3;
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      // stay on pavement lanes: bounce at block edges
      if (Math.abs(p.x) > 250 || Math.abs(p.z) > 250) p.heading += Math.PI;
      const hit = this.city.collide(p.x, p.z, 0.5);
      if (hit) { p.heading += Math.PI / 2; p.x -= Math.sin(p.heading) * speed * dt * 2; p.z -= Math.cos(p.heading) * speed * dt * 2; }
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.heading;
      // articulated walk swing (arms + legs counter-swing; faster when panicking)
      const swing = Math.sin(t * (p.state === 'panic' ? 11 : 5) + p.phase) * (p.state === 'panic' ? 0.85 : 0.5);
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
      p.armL.rotation.x = -swing * 0.8; p.armR.rotation.x = swing * 0.8;
      if (p.state === 'panic') { p.armL.rotation.x = -1.2; p.armR.rotation.x = -1.2; }
    }
  }
}
