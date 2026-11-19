// Costa Serena — player.js
// On-foot third-person controller: walk/run, orbit camera with collision
// (pulled in by buildings), entering/exiting cars (E).
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER, clamp, lerp } from './config.js';
import { buildPedestrian } from './pedestrians.js';

export class Player {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    const p = buildPedestrian(7);
    // Rafi: teal shirt, dark jeans — consistent lead character
    p.group.children.forEach(() => {});
    this.model = p;
    this.group = p.group;
    this.group.position.set(10, 0, 10);
    scene.add(this.group);
    this.x = 10; this.z = 10; this.heading = 0;
    this.vel = new THREE.Vector3();
    this.camYaw = 0; this.camPitch = 0.42; this.camDist = 7;
    this.health = PLAYER.health;
    this.inCar = null; this.walkPhase = 0;
  }
  get pos() { return { x: this.x, z: this.z }; }
  update(dt, keys, t) {
    if (this.inCar) return;
    const run = keys['shift'] ? PLAYER.run : PLAYER.walk;
    let fx = 0, fz = 0;
    if (keys['w'] || keys['arrowup']) fz -= 1;
    if (keys['s'] || keys['arrowdown']) fz += 1;
    if (keys['a'] || keys['arrowleft']) fx -= 1;
    if (keys['d'] || keys['arrowright']) fx += 1;
    const moving = fx !== 0 || fz !== 0;
    if (moving) {
      // move relative to camera yaw
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const dx = (fx * cos - fz * sin), dz = (fx * sin + fz * cos);
      const len = Math.hypot(dx, dz) || 1;
      const tx = this.x + (dx / len) * run * dt, tz = this.z + (dz / len) * run * dt;
      const hit = this.city.collide(tx, tz, PLAYER.radius);
      if (!hit) { this.x = tx; this.z = tz; }
      else { // slide along the wall instead of sticking
        if (!this.city.collide(tx, this.z, PLAYER.radius)) this.x = tx;
        else if (!this.city.collide(this.x, tz, PLAYER.radius)) this.z = tz;
      }
      this.x = clamp(this.x, -265, 265); this.z = clamp(this.z, -265, 265);
      this.heading = Math.atan2(dx, dz);
      this.walkPhase += dt * run * 1.6;
    }
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.model.legL.rotation.x = swing; this.model.legR.rotation.x = -swing;
    this.model.armL.rotation.x = -swing * 0.8; this.model.armR.rotation.x = swing * 0.8;
  }
  // third-person camera: orbit, pitch, pulled in when a building blocks the ray
  cameraTarget(out) {
    const cx = this.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = 2.2 + Math.sin(this.camPitch) * this.camDist;
    // shrink distance if a building sits between camera and player
    let dist = this.camDist;
    for (let f = 0.3; f <= 1; f += 0.1) {
      const px = lerp(this.x, cx, f), pz = lerp(this.z, cz, f);
      if (this.city.collide(px, pz, 0.4)) { dist = this.camDist * f * 0.85; break; }
    }
    out.set(
      this.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist,
      2.2 + Math.sin(this.camPitch) * dist,
      this.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist);
    return out;
  }
  lookAt() { return new THREE.Vector3(this.x, 1.6, this.z); }
}
