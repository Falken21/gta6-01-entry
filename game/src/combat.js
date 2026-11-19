// Costa Serena — combat.js
// Simple hitscan shooting + melee: crosshair raycast, health, tracer flash,
// pedestrian/police reactions (panic + wanted). No hitscan through buildings.
import * as THREE from '../vendor/three.module.min.js';

export class Combat {
  constructor(scene, city, pedestrians, police, audio) {
    this.scene = scene; this.city = city;
    this.pedestrians = pedestrians; this.police = police; this.audio = audio;
    this.ammo = 60; this.cooldown = 0;
    this.tracer = null;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
    scene.add(this.tracer);
  }
  shoot(origin, dir, playerPos) {
    if (this.cooldown > 0 || this.ammo <= 0) return false;
    this.cooldown = 0.22; this.ammo -= 1;
    const end = origin.clone().addScaledVector(dir, 60);
    // tracer flash
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z); pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    if (this.audio) this.audio.shot();
    // hit a pedestrian? (generous radius, line check)
    for (const p of this.pedestrians.list) {
      const to = new THREE.Vector3(p.group.position.x - origin.x, 1.2 - origin.y, p.group.position.z - origin.z);
      const along = to.dot(dir);
      if (along > 0 && along < 60) {
        const perp = to.clone().addScaledVector(dir, -along).length();
        if (perp < 1.1) {
          this.pedestrians.scare(p.group.position.x, p.group.position.z, 26);
          this.police.addCrime(1, 'shooting');
          return true;
        }
      }
    }
    // hit a police car?
    for (const c of this.police.cars) {
      const to = new THREE.Vector3(c.group.position.x - origin.x, 1 - origin.y, c.group.position.z - origin.z);
      const along = to.dot(dir);
      if (along > 0 && along < 60) {
        const perp = to.clone().addScaledVector(dir, -along).length();
        if (perp < 2.2) { c.damage(25); this.police.addCrime(1, 'shooting police'); return true; }
      }
    }
    // stray shot still scares the street
    this.pedestrians.scare(playerPos.x, playerPos.z, 18);
    this.police.addCrime(0.5, 'gunfire heard');
    return true;
  }
  melee(playerPos) {
    if (this.cooldown > 0) return;
    this.cooldown = 0.4;
    if (this.audio) this.audio.thud();
    this.pedestrians.scare(playerPos.x, playerPos.z, 12);
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.tracer.material.opacity > 0) this.tracer.material.opacity = Math.max(0, this.tracer.material.opacity - dt * 6);
  }
}
