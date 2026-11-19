// Costa Serena — vehicles.js
// Multi-part car models (body, glass cabin, spinning + steering wheels, brake
// lights, headlight cones, damage smoke) + driving physics with weight:
// acceleration curve, braking, handbrake, speed-sensitive steering, body roll.
import * as THREE from '../vendor/three.module.min.js';
import { CAR, clamp, lerp } from './config.js';

const BODY_COLORS = [0xc0392b, 0x2e6fb0, 0xe0a030, 0x3a9e6a, 0x8e44ad, 0xd8d8d8, 0x22262c, 0x0f7a7a];
const KINDS = {
  sedan: { len: 4.4, wid: 1.9, h: 0.62, cab: 0.55 },
  hatch: { len: 3.9, wid: 1.8, h: 0.66, cab: 0.6 },
  taxi: { len: 4.4, wid: 1.9, h: 0.62, cab: 0.55, taxi: true },
  pickup: { len: 4.9, wid: 2.0, h: 0.72, cab: 0.5, bed: true },
  police: { len: 4.5, wid: 1.95, h: 0.62, cab: 0.55, police: true },
};

export function buildCarModel(kindName, colorHex) {
  const kind = KINDS[kindName] || KINDS.sedan;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: kind.police ? 0xf2f2f2 : colorHex, roughness: 0.32, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x18222e, roughness: 0.08, metalness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const L = kind.len, W = kind.wid;

  // lower body with rounded-ish profile: main slab + hood/trunk taper via two boxes
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, kind.h, L), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, kind.h * 0.7, L * 0.22), bodyMat);
  nose.position.set(0, 0.5, L * 0.42); nose.castShadow = true; g.add(nose);
  // glass cabin (not a flat box: inset + sloped look via scaled box)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, kind.cab, L * 0.48), glassMat);
  cab.position.set(0, 0.55 + kind.h / 2 + kind.cab / 2 - 0.06, -L * 0.05);
  cab.castShadow = true; g.add(cab);
  // roof panel over cabin
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.07, L * 0.42), bodyMat);
  roof.position.set(0, 0.55 + kind.h / 2 + kind.cab - 0.05, -L * 0.05); g.add(roof);
  if (kind.bed) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.3, L * 0.3), darkMat);
    bed.position.set(0, 0.95, -L * 0.32); g.add(bed);
  }
  if (kind.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xaa8800, emissiveIntensity: 0.5 }));
    sign.position.set(0, 1.62, -L * 0.05); g.add(sign);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.14, L * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  // wheels: spin + front steer
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [], steerWheels = [];
  for (const [wx, wz, front] of [[-W / 2, L * 0.32, true], [W / 2, L * 0.32, true], [-W / 2, -L * 0.32, false], [W / 2, -L * 0.32, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(wx, 0.36, wz);
    const wheel = new THREE.Mesh(wheelGeo, darkMat); wheel.castShadow = true; pivot.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.35 }));
    hub.geometry.rotateZ(Math.PI / 2); pivot.add(hub);
    g.add(pivot); wheels.push(wheel);
    if (front) steerWheels.push(pivot);
  }
  // headlights + taillights (emissive, real light pools at night via spotlights added by caller)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0xdd1111, emissiveIntensity: 0.4 });
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), headMat);
  headL.position.set(-W * 0.32, 0.62, L / 2 + 0.02); g.add(headL);
  const headR = headL.clone(); headR.position.x = W * 0.32; g.add(headR);
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.06), tailMat);
  tailL.position.set(-W * 0.32, 0.62, -L / 2 - 0.02); g.add(tailL);
  const tailR = tailL.clone(); tailR.position.x = W * 0.32; g.add(tailR);
  // police lightbar
  let lightbar = null, barRed = null, barBlue = null;
  if (kind.police) {
    lightbar = new THREE.Group();
    barRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 }));
    barRed.position.x = -0.28; lightbar.add(barRed);
    barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 }));
    barBlue.position.x = 0.28; lightbar.add(barBlue);
    lightbar.position.set(0, 1.66, -L * 0.05); g.add(lightbar);
    // black-and-white doors
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }));
    door.position.set(-W / 2 - 0.01, 0.6, 0); g.add(door);
  }
  // damage smoke emitter anchor
  const smokeAnchor = new THREE.Object3D(); smokeAnchor.position.set(0, 0.9, L * 0.3); g.add(smokeAnchor);
  return { group: g, wheels, steerWheels, tailMat, headMat, lightbar, barRed, barBlue, smokeAnchor, kind };
}

export class Car {
  constructor(scene, kindName, colorHex, x, z, heading) {
    this.kindName = kindName;
    this.model = buildCarModel(kindName, colorHex);
    this.group = this.model.group;
    this.group.position.set(x, 0, z); this.group.rotation.y = heading;
    scene.add(this.group);
    this.scene = scene;
    this.speed = 0; this.heading = heading; this.steer = 0;
    this.health = 100; this.driven = false; this.driver = null;
    this.smoke = null; this.smokeTimer = 0;
    this.headlight = new THREE.SpotLight(0xfff0c0, 0, 40, 0.5, 0.5, 1.2);
    this.headlight.position.set(0, 0.8, 2);
    this.group.add(this.headlight); this.group.add(this.headlight.target);
    this.headlight.target.position.set(0, 0, 14);
    // red/blue ground pools for police
    this.pool = null;
    if (kindName === 'police') {
      this.pool = new THREE.PointLight(0xff2222, 0, 12, 1.5);
      this.pool.position.set(0, 1.2, 0); this.group.add(this.pool);
    }
  }
  setNight(night) { this.headlight.intensity = night ? 60 : 0; }
  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health < 55 && !this.smoke) {
      const mat = new THREE.SpriteMaterial({ color: 0x666666, transparent: true, opacity: 0.55, depthWrite: false });
      this.smoke = new THREE.Sprite(mat); this.smoke.scale.set(1.4, 1.4, 1);
      this.model.smokeAnchor.add(this.smoke);
    }
  }
  update(dt, input, t) {
    // input: {throttle:-1..1, steer:-1..1, brake, handbrake}
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (input) {
      const targetSteer = clamp(input.steer || 0, -1, 1) * CAR.steerMax * (1 - Math.min(Math.abs(this.speed) / CAR.maxSpeed, 0.75) * 0.6);
      this.steer = lerp(this.steer, targetSteer, 1 - Math.exp(-8 * dt));
      if (input.throttle > 0) this.speed += CAR.accel * input.throttle * dt * (1 - Math.abs(this.speed) / (CAR.maxSpeed * 1.15));
      else if (input.throttle < 0) this.speed += (this.speed > 0.5 ? -CAR.brake : CAR.reverse) * dt * -input.throttle * -1 * (this.speed > 0.5 ? 1 : 1);
      if (input.brake) this.speed = lerp(this.speed, 0, 1 - Math.exp(-6 * dt));
      if (input.handbrake) this.speed = lerp(this.speed, 0, 1 - Math.exp(-3 * dt));
      // drag + rolling resistance
      this.speed -= this.speed * 0.35 * dt;
      if (Math.abs(this.speed) < 0.05 && !input.throttle) this.speed = 0;
      this.speed = clamp(this.speed, -12, CAR.maxSpeed);
      this.heading += this.steer * (this.speed / 3.2) * dt * (input.handbrake ? 1.6 : 1);
    }
    this.group.position.addScaledVector(fwd, this.speed * dt);
    this.group.rotation.y = this.heading;
    // body roll / pitch with weight
    const roll = -this.steer * Math.min(Math.abs(this.speed) / 20, 1) * 0.06;
    const pitch = clamp(-this.speed * 0.002, -0.03, 0.03);
    this.group.rotation.z = lerp(this.group.rotation.z, roll, 0.2);
    this.group.rotation.x = lerp(this.group.rotation.x, pitch, 0.2);
    // wheels spin + steer visually
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.model.wheels) w.rotation.x += spin;
    for (const s of this.model.steerWheels) s.rotation.y = this.steer * 1.4;
    // brake lights flare
    this.model.tailMat.emissiveIntensity = (input && (input.brake || input.throttle < 0)) ? 2.4 : 0.4;
    // police lightbar flash + ground pool alternation
    if (this.model.lightbar) {
      const on = Math.floor(t * 6) % 2 === 0;
      this.model.barRed.material.emissiveIntensity = on ? 3 : 0.2;
      this.model.barBlue.material.emissiveIntensity = on ? 0.2 : 3;
      if (this.pool) { this.pool.color.set(on ? 0xff2222 : 0x2244ff); this.pool.intensity = 10; }
    }
    if (this.smoke) {
      this.smokeTimer += dt;
      this.smoke.position.y = 0.4 + Math.sin(this.smokeTimer * 5) * 0.25;
      this.smoke.material.opacity = 0.35 + Math.sin(this.smokeTimer * 7) * 0.15;
      this.smoke.scale.setScalar(1.2 + (this.smokeTimer % 1) * 0.8);
    }
  }
  dispose() { this.scene.remove(this.group); }
}
