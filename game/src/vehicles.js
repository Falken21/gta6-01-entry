// Costa Serena — procedural cars (sedan, taxi, pickup, police) and arcade
// driving physics with weight: acceleration curve, braking, handbrake,
// speed-sensitive steering, body roll/pitch, damage smoke.
import * as THREE from 'three';
import { CFG, clamp, lerp, damp, angDiff, resolveCircleAABB, makeRng } from './config.js';
import { smokeTexture } from './textures.js';

const CAR_COLORS = [0xc23b2e, 0x2e5fa3, 0xd8d3c8, 0x3a3f45, 0x7a8a99, 0x4a7a4f, 0xb0703a, 0x8a2f5e];

export function makeCarModel(type, colorHex, rng) {
  const g = new THREE.Group();
  g.name = `car-${type}`;
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x10161f, roughness: 0.15, metalness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.8 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.2, metalness: 0.9 });

  const L = type === 'pickup' ? 4.9 : 4.4, Wd = 1.9, bodyH = 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(Wd, bodyH, L), bodyMat);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  // cabin or pickup bed
  if (type === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.2, 0.35, 2.0), trimMat);
    bed.position.set(0, 1.0, -1.3); g.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.16, 0.62, 1.7), glassMat);
    cab.position.set(0, 1.2, 0.9); cab.castShadow = true; g.add(cab);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.24, 0.58, L * 0.48), glassMat);
    cabin.position.set(0, 1.18, -0.2); cabin.castShadow = true; g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.3, 0.08, L * 0.42), bodyMat);
    roof.position.set(0, 1.5, -0.2); roof.castShadow = true; g.add(roof);
  }
  // bumpers + grille + headlights + taillights
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.22, 0.18), chromeMat);
  bumperF.position.set(0, 0.42, L / 2); g.add(bumperF);
  const bumperR = bumperF.clone(); bumperR.position.z = -L / 2; g.add(bumperR);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0 });
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat);
  headL.position.set(-0.62, 0.72, L / 2 + 0.02); g.add(headL);
  const headR = headL.clone(); headR.position.x = 0.62; g.add(headR);
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x7a0e0e, emissive: 0xff1a1a, emissiveIntensity: 0 });
  const brakeL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), brakeMat);
  brakeL.position.set(-0.62, 0.72, -L / 2 - 0.02); g.add(brakeL);
  const brakeR = brakeL.clone(); brakeR.position.x = 0.62; g.add(brakeR);
  // headlight cones (visible at night)
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const cones = [];
  for (const sx of [-0.62, 0.62]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 5, 12, 1, true), coneMat.clone());
    cone.rotation.x = -Math.PI / 2 - 0.12;
    cone.position.set(sx, 0.6, L / 2 + 2.4);
    g.add(cone); cones.push(cone);
  }
  // wheels: spin + front steer
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const wheels = {};
  for (const [name, wx, wz] of [['fl', -0.82, L / 2 - 0.85], ['fr', 0.82, L / 2 - 0.85], ['rl', -0.82, -L / 2 + 0.85], ['rr', 0.82, -L / 2 + 0.85]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const tire = new THREE.Mesh(wheelGeo, trimMat);
    tire.castShadow = true; pivot.add(tire);
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    pivot.add(hub);
    g.add(pivot);
    wheels[name] = { pivot, tire };
  }
  // type extras
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0xffc81a, emissive: 0xcc9900, emissiveIntensity: 0.4 }));
    sign.position.set(0, 1.62, -0.2); g.add(sign);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(Wd + 0.02, 0.14, L * 0.5), new THREE.MeshStandardMaterial({ color: 0x141414 }));
    stripe.position.set(0, 0.62, 0); g.add(stripe);
  }
  if (type === 'police') {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4), barMat);
    bar.position.set(0, 1.58, -0.2); g.add(bar);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 0 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0000aa, emissive: 0x2233ff, emissiveIntensity: 0 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.38), redMat);
    red.position.set(-0.28, 1.66, -0.2); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.38), blueMat);
    blue.position.set(0.28, 1.66, -0.2); g.add(blue);
    g.userData.lightbar = { redMat, blueMat };
    // door decal band
    const band = new THREE.Mesh(new THREE.BoxGeometry(Wd + 0.02, 0.3, L * 0.55), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    band.position.set(0, 0.66, 0); g.add(band);
  }
  // damage smoke emitter (sprite pool, filled by update)
  const smokeTex = smokeTexture(rng || makeRng(7));
  const smokeMat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false });
  const smoke = new THREE.Sprite(smokeMat);
  smoke.scale.set(1.4, 1.4, 1);
  smoke.position.set(0, 1.2, L / 2 - 0.4);
  g.add(smoke);

  return {
    group: g, wheels, brakeMat, headMat, cones, smoke, smokeMat,
    length: L, width: Wd,
    setNight(on) {
      headMat.emissiveIntensity = on ? 1.6 : 0;
      for (const c of cones) c.material.opacity = on ? 0.13 : 0;
    },
    setBrake(on) { brakeMat.emissiveIntensity = on ? 2.4 : 0; },
  };
}

export function createCar(type, x, z, heading, rng, colorHex) {
  const color = colorHex ?? (type === 'taxi' ? 0xf5c518 : type === 'police' ? 0xe8e8e8 : CAR_COLORS[Math.floor((rng || makeRng(1)).next() * CAR_COLORS.length)]);
  const model = makeCarModel(type, color, rng);
  model.group.position.set(x, 0, z);
  model.group.rotation.y = heading;
  return {
    type, model, pos: model.group.position, heading,
    speed: 0, steer: 0, damage: 0, // 0..1
    radius: 1.35, driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    smokeT: 0,
  };
}

// Arcade driving: input {throttle:-1..1, steer:-1..1, handbrake:bool}.
// Returns {crashed:boolean, crashSpeed:number}.
export function updateCar(car, input, dt, colliders, onCrash) {
  const C = CFG.car;
  const prevSpeed = car.speed;
  if (input.throttle > 0) car.speed += C.accel * input.throttle * dt * (1 - Math.max(0, car.speed) / (C.maxSpeed * 1.25));
  else if (input.throttle < 0) {
    if (car.speed > 0.5) car.speed -= C.brake * dt;
    else car.speed += C.reverseAccel * input.throttle * dt;
  }
  if (input.handbrake) car.speed = damp(car.speed, 0, 3.2, dt);
  car.speed -= car.speed * C.drag * dt * 0.15;
  car.speed = clamp(car.speed, -C.maxReverse, C.maxSpeed);
  // steering tightens at low speed, loosens at high speed
  const steerTarget = input.steer * (0.62 / (1 + Math.abs(car.speed) * 0.045));
  car.steer = damp(car.steer, steerTarget, 8, dt);
  const turnRate = car.steer * clamp(Math.abs(car.speed) / 6, 0, 1) * (car.speed >= 0 ? 1 : -1) * C.grip;
  car.heading += turnRate * dt * (input.handbrake ? 1.5 : 1);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  // building collision: push out + lose speed
  let crashed = false, crashSpeed = 0;
  for (const box of colliders) {
    const res = resolveCircleAABB(car.pos.x, car.pos.z, car.radius, box);
    if (res) {
      car.pos.x += res.x; car.pos.z += res.z;
      crashSpeed = Math.abs(car.speed);
      if (crashSpeed > 3) { crashed = true; car.damage = clamp(car.damage + crashSpeed * 0.008, 0, 1); }
      car.speed *= 0.35;
    }
  }
  // world bounds: sea wall / city edge
  car.pos.x = clamp(car.pos.x, -CFG.world.halfX - 6, CFG.world.beachX0 + 2);
  car.pos.z = clamp(car.pos.z, -CFG.world.halfZ - 6, CFG.world.halfZ + 6);
  if (crashed && onCrash) onCrash(crashSpeed);
  // visuals: body roll/pitch, wheel spin + steer, brake lights
  const m = car.model;
  m.group.position.set(car.pos.x, 0, car.pos.z);
  m.group.rotation.y = car.heading;
  const roll = -car.steer * clamp(Math.abs(car.speed) / C.maxSpeed, 0, 1) * 0.06;
  const pitch = clamp((prevSpeed - car.speed) / dt, -20, 20) * -0.0016;
  m.group.rotation.z = damp(m.group.rotation.z, roll, 6, dt);
  m.group.rotation.x = damp(m.group.rotation.x, pitch, 6, dt);
  const spin = (car.speed * dt) / 0.36;
  for (const k of ['fl', 'fr', 'rl', 'rr']) m.wheels[k].tire.rotation.x += spin;
  m.wheels.fl.pivot.rotation.y = car.steer * 1.6;
  m.wheels.fr.pivot.rotation.y = car.steer * 1.6;
  m.setBrake(input.throttle < 0 || input.handbrake);
  // damage smoke
  if (car.damage > 0.45) {
    car.smokeT += dt;
    const s = 1 + Math.sin(car.smokeT * 9) * 0.3;
    m.smoke.scale.set(1.3 * s, 1.3 * s, 1);
    m.smokeMat.opacity = clamp((car.damage - 0.45) * 1.4, 0, 0.75);
    m.smoke.position.y = 1.2 + Math.sin(car.smokeT * 5) * 0.15;
  } else {
    m.smokeMat.opacity = 0;
  }
  return { crashed, crashSpeed };
}
