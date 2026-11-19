// Costa Serena — vehicles.js
// One job: car models and arcade driving physics with weight — acceleration
// curves, braking, handbrake, body roll/pitch, steering wheels, brake lights,
// headlights at night, damage smoke. Any parked or stopped car can be stolen.
import * as THREE from 'three';
import { CFG, clamp, lerp, mulberry32, pick, range } from './config.js';

export const CAR_TYPES = {
  sedan:  { len: 4.4, wid: 1.9, hgt: 0.72, top: 33, accel: 12, colours: [0x8a1f1f, 0x1f3a5f, 0x2e2e33, 0xcfc8b8, 0x3a5f3a] },
  hatch:  { len: 3.8, wid: 1.8, hgt: 0.7,  top: 30, accel: 13, colours: [0xd9a441, 0x7fa08e, 0xc4552d, 0x9fb4c0, 0xe8e4da] },
  taxi:   { len: 4.4, wid: 1.9, hgt: 0.72, top: 32, accel: 12, colours: [0xe8b400] },
  pickup: { len: 4.9, wid: 2.0, hgt: 0.85, top: 31, accel: 11, colours: [0x5a3a2a, 0x2f4a3a, 0x6b6f75] },
  police: { len: 4.5, wid: 1.95, hgt: 0.72, top: 36, accel: 14, colours: [0x1c1f24] },
  sport:  { len: 4.3, wid: 1.95, hgt: 0.62, top: 38, accel: 16, colours: [0xb01030, 0x10243a, 0xd9a441] },
};

const glassMat = new THREE.MeshStandardMaterial({ color: 0x18222c, roughness: 0.12, metalness: 0.7 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.35, metalness: 0.8 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.2, metalness: 0.9 });

// Build a multi-part car: body, cabin with glass, bumpers, wheels that steer
// and spin, brake lights, headlights, light bar for police.
export function makeCarModel(type, colour, rng = mulberry32(1)) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const group = new THREE.Group();
  group.name = `car-${type}`;
  const paint = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.32, metalness: 0.55 });
  const L = spec.len, W = spec.wid, H = spec.hgt;

  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), paint);
  body.position.y = 0.55 + H / 2;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  // hood / boot shaping: a lower nose and tail lip
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, H * 0.55, W * 0.94), paint);
  nose.position.set(L / 2 + 0.1, 0.55 + H * 0.32, 0);
  nose.castShadow = true;
  group.add(nose);
  // cabin with glasshouse
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.48, 0.55, W * 0.82), glassMat);
  cabin.position.set(-L * 0.04, 0.55 + H + 0.24, 0);
  cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.08, W * 0.86), paint);
  roof.position.set(-L * 0.04, 0.55 + H + 0.55, 0);
  roof.castShadow = true;
  group.add(roof);
  // bumpers + grille
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  for (const sx of [L / 2 + 0.32, -L / 2 - 0.32]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, W * 0.96), bumperMat);
    b.position.set(sx, 0.42, 0);
    group.add(b);
  }
  // headlights (emissive; weather turns them up at night) + brake lights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6cf, emissive: 0xffe9a0, emissiveIntensity: 0.25 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x7a0d0d, emissive: 0xff1a1a, emissiveIntensity: 0.15 });
  for (const sz of [-W / 2 + 0.32, W / 2 - 0.32]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.42), headMat);
    hl.position.set(L / 2 + 0.36, 0.78, sz);
    group.add(hl);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.42), brakeMat);
    bl.position.set(-L / 2 - 0.36, 0.78, sz);
    group.add(bl);
  }
  // headlight cones at night (cheap fake: two translucent cones)
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const cones = [];
  for (const sz of [-0.55, 0.55]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 12, 1, true), coneMat);
    cone.rotation.z = -Math.PI / 2 - 0.18;
    cone.position.set(L / 2 + 3.6, 0.7, sz);
    group.add(cone);
    cones.push(cone.material);
  }
  // taxi sign / police light bar
  let lightBar = null;
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc400, emissiveIntensity: 0.8 }));
    sign.position.set(-L * 0.04, 0.55 + H + 0.62, 0);
    group.add(sign);
  }
  if (type === 'police') {
    lightBar = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    bar.position.y = 0.55 + H + 0.62;
    lightBar.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 1 }));
    red.position.set(0, 0.55 + H + 0.66, -0.32);
    lightBar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x0000aa, emissive: 0x2244ff, emissiveIntensity: 1 }));
    blue.position.set(0, 0.55 + H + 0.66, 0.32);
    lightBar.add(blue);
    lightBar.userData = { red: red.material, blue: blue.material };
    group.add(lightBar);
    // police livery stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.99, 0.2, W + 0.02),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 }));
    stripe.position.y = 0.85;
    group.add(stripe);
  }
  // wheels: steer the fronts, spin all four
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  hubGeo.rotateX(Math.PI / 2);
  for (const [wx, wz, front] of [
    [L / 2 - 0.75, -W / 2 + 0.12, true], [L / 2 - 0.75, W / 2 - 0.12, true],
    [-L / 2 + 0.75, -W / 2 + 0.12, false], [-L / 2 + 0.75, W / 2 - 0.12, false],
  ]) {
    const steer = new THREE.Group();
    steer.position.set(wx, 0.36, wz);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    steer.add(tyre); steer.add(hub);
    group.add(steer);
    wheels.push({ steer, tyre, front });
  }
  group.userData = { spec, wheels, headMat, brakeMat, cones, lightBar, body };
  return group;
}

// One drivable car: model + physics state. `driver` is 'player' | 'traffic'
// | 'police' | 'parked' | null.
export function createCar(scene, type, x, z, heading, colour, rng) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const model = makeCarModel(type, colour, rng);
  model.position.set(x, 0, z);
  // The model is built nose-forward along +X; rotation.y = heading - PI/2
  // maps that nose onto the physics forward (sin h, cos h).
  model.rotation.y = heading - Math.PI / 2;
  scene.add(model);
  const car = {
    type, spec, model,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    damage: 0,          // 0..1; smoke past 0.55, dead past 1
    driver: null,
    wanted: false,
    brakeLight: 0,
    smokeTimer: 0,
    smoke: null,
    update(dt, input, colliders) {
      // input: { throttle: -1..1, steer: -1..1, handbrake: bool }
      const top = spec.top;
      if (input.throttle > 0) this.speed += spec.accel * input.throttle * dt;
      else if (input.throttle < 0) {
        if (this.speed > 0.5) this.speed -= CFG.carBrake * dt;
        else this.speed = Math.max(this.speed - spec.accel * 0.6 * dt, -CFG.carReverseTop);
      }
      if (input.handbrake) this.speed *= Math.max(0, 1 - 3.2 * dt);
      // drag + rolling resistance
      this.speed -= this.speed * 0.55 * dt;
      this.speed = clamp(this.speed, -CFG.carReverseTop, top);
      const steerTarget = input.steer * clamp(Math.abs(this.speed) / 6, 0, 1) * 0.55;
      this.steer = lerp(this.steer, steerTarget, Math.min(1, dt * 8));
      const turn = this.steer * CFG.carGrip * (this.speed / top) * (this.speed >= 0 ? 1 : -1);
      this.heading += turn * dt * (Math.abs(this.speed) > 0.2 ? 1 : 0);
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      this.pos.x += fx * this.speed * dt;
      this.pos.z += fz * this.speed * dt;
      // world bounds
      this.pos.x = clamp(this.pos.x, -CFG.worldHalf - 20, CFG.worldHalf);
      this.pos.z = clamp(this.pos.z, -CFG.worldHalf, CFG.worldHalf);
      // building collision: circle vs AABB, push out, lose speed, take damage
      for (const c of colliders) {
        const nx = clamp(this.pos.x, c.minX, c.maxX);
        const nz = clamp(this.pos.z, c.minZ, c.maxZ);
        const dx = this.pos.x - nx, dz = this.pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < CFG.carRadius * CFG.carRadius) {
          const d = Math.sqrt(d2) || 0.01;
          const push = CFG.carRadius - d;
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
          if (Math.abs(this.speed) > 4) {
            this.damage = Math.min(1, this.damage + Math.abs(this.speed) * 0.008);
            this.onCrash?.(Math.abs(this.speed));
          }
          this.speed *= -0.25;
        }
      }
      // body roll + pitch for weight
      const u = this.model.userData;
      this.model.position.copy(this.pos);
      this.model.rotation.y = this.heading - Math.PI / 2;
      this.model.rotation.z = -this.steer * 0.06 * clamp(Math.abs(this.speed) / 10, 0, 1);
      this.model.rotation.x = clamp(-input.throttle * 0.02 * (this.speed > 1 ? 1 : 0), -0.03, 0.03)
        + (input.throttle < 0 && this.speed > 1 ? 0.03 : 0);
      // wheels: steer fronts, spin by speed
      const spin = (this.speed * dt) / 0.36;
      for (const w of u.wheels) {
        if (w.front) w.steer.rotation.y = this.steer * 0.9;
        w.tyre.rotation.z -= spin;
      }
      // brake lights
      const braking = input.throttle < 0 && this.speed > 0.5;
      u.brakeMat.emissiveIntensity = braking ? 2.4 : 0.15;
      this.brakeLight = braking ? 1 : 0;
      // damage smoke
      if (this.damage > 0.55 && !this.smoke) {
        this.smoke = makeSmoke(scene);
      }
      if (this.smoke) {
        this.smokeTimer -= dt;
        this.smoke.position.set(this.pos.x, 1.6, this.pos.z);
        this.smoke.material.opacity = 0.25 + 0.35 * Math.abs(Math.sin(performance.now() * 0.004));
        this.smoke.scale.setScalar(1 + this.damage * 0.8);
      }
    },
    setNightLights(on) {
      const u = this.model.userData;
      u.headMat.emissiveIntensity = on ? 2.6 : 0.25;
      for (const c of u.cones) c.opacity = on ? 0.10 : 0;
    },
    destroy() {
      scene.remove(this.model);
      if (this.smoke) scene.remove(this.smoke);
    },
  };
  return car;
}

function makeSmoke(scene) {
  const geo = new THREE.SphereGeometry(0.9, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  scene.add(m);
  return m;
}
