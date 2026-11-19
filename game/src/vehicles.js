// Costa Serena — vehicles.js
// Model mobil prosedural multi-bagian (bodi, kabin berkaca, roda berputar &
// membelok, lampu rem, lampu depan, asap kerusakan) + fisika berkendara
// arcade berbobot: akselerasi, pengereman, body roll/pitch, grip.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { collideCircle } from './city.js';

export const CAR_TYPES = {
  sedan:   { w: 1.9, l: 4.6, h: 0.62, cabin: 0.55, color: 0x8a2f2a, accel: 1.0, top: 42 },
  hatch:   { w: 1.8, l: 3.9, h: 0.66, cabin: 0.6,  color: 0x2a6ea8, accel: 1.05, top: 40 },
  taxi:    { w: 1.9, l: 4.5, h: 0.62, cabin: 0.55, color: 0xe8b93a, accel: 1.0, top: 41 },
  pickup:  { w: 2.0, l: 5.0, h: 0.75, cabin: 0.5,  color: 0x4a5a3a, accel: 0.9, top: 39 },
  sport:   { w: 1.95, l: 4.4, h: 0.5, cabin: 0.42, color: 0xc23a6e, accel: 1.2, top: 48 },
  police:  { w: 1.95, l: 4.7, h: 0.62, cabin: 0.55, color: 0x1c1e24, accel: 1.15, top: 46 },
  van:     { w: 2.0, l: 5.2, h: 1.1, cabin: 0.9,   color: 0xd8d2c4, accel: 0.85, top: 36 },
};

const paintMats = new Map();
function paint(color) {
  if (!paintMats.has(color)) {
    paintMats.set(color, new THREE.MeshStandardMaterial({
      color, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.1,
    }));
  }
  return paintMats.get(color);
}
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x10161f, metalness: 0.1, roughness: 0.06, envMapIntensity: 1.8,
});
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.3 });
const lightOff = new THREE.MeshStandardMaterial({ color: 0x3a1512, emissive: 0x550000, emissiveIntensity: 0.15 });
const lightOn = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff1a1a, emissiveIntensity: 2.2 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.4 });
const headMatOn = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 2.4 });

export function makeCarModel(type, colorOverride) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  const color = colorOverride ?? def.color;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  // bodi bawah + kap + bagasi (tiga volume = siluet tidak kaku)
  const lower = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.l), paint(color));
  lower.position.y = 0.55; lower.castShadow = true; body.add(lower);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.92, 0.22, def.l * 0.24), paint(color));
  hood.position.set(0, 0.92, def.l * 0.36); hood.castShadow = true; body.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.92, 0.2, def.l * 0.2), paint(color));
  trunk.position.set(0, 0.9, -def.l * 0.38); trunk.castShadow = true; body.add(trunk);
  // kabin berkaca dengan pilar
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.86, def.cabin, def.l * 0.46), glassMat);
  cabin.position.set(0, 0.95 + def.cabin / 2, -def.l * 0.04); cabin.castShadow = true; body.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.88, 0.08, def.l * 0.44), paint(color));
  roof.position.set(0, 0.98 + def.cabin, -def.l * 0.04); roof.castShadow = true; body.add(roof);
  // bumper + grille
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.98, 0.22, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5, metalness: 0.4 }));
  bumperF.position.set(0, 0.38, def.l / 2); body.add(bumperF);
  const bumperR = bumperF.clone(); bumperR.position.z = -def.l / 2; body.add(bumperR);
  // lampu rem & lampu depan
  const brakeL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), lightOff.clone());
  brakeL.position.set(-def.w / 2 + 0.3, 0.78, -def.l / 2 - 0.02); body.add(brakeL);
  const brakeR = brakeL.clone(); brakeR.position.x = def.w / 2 - 0.3; body.add(brakeR);
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.06), headMat.clone());
  headL.position.set(-def.w / 2 + 0.3, 0.74, def.l / 2 + 0.02); body.add(headL);
  const headR = headL.clone(); headR.position.x = def.w / 2 - 0.3; body.add(headR);
  // lampu depan: kerucut cahaya (mesh transparan, menyala saat malam)
  const coneGeo = new THREE.ConeGeometry(1.5, 7, 12, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const coneL = new THREE.Mesh(coneGeo, coneMat);
  coneL.rotation.x = Math.PI / 2; coneL.position.set(-0.6, 0.6, def.l / 2 + 3.5); body.add(coneL);
  const coneR = coneL.clone(); coneR.position.x = 0.6; body.add(coneR);
  // taksi: papan atap; polisi: lightbar
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc832, emissiveIntensity: 1.2 }));
    sign.position.set(0, 1.06 + def.cabin, -def.l * 0.04); body.add(sign);
  }
  let barL = null, barR = null;
  if (type === 'police') {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.3), barMat);
    bar.position.set(0, 1.06 + def.cabin, -def.l * 0.04); body.add(bar);
    barL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 0.2 }));
    barL.position.set(-0.28, 1.06 + def.cabin, -def.l * 0.04); body.add(barL);
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2244ff, emissiveIntensity: 0.2 }));
    barR.position.set(0.28, 1.06 + def.cabin, -def.l * 0.04); body.add(barR);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.9, 0.3, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
    badge.position.set(0, 0.62, def.l / 2 + 0.01); body.add(badge);
  }
  // roda: berputar (rotasi x) & depan membelok (rotasi y via pivot)
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const positions = [
    [-def.w / 2 + 0.08, def.l * 0.32, true], [def.w / 2 - 0.08, def.l * 0.32, true],
    [-def.w / 2 + 0.08, -def.l * 0.32, false], [def.w / 2 - 0.08, -def.l * 0.32, false],
  ];
  for (const [wx, wz, front] of positions) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10), rimMat);
    rim.rotation.z = Math.PI / 2;
    pivot.add(tyre); pivot.add(rim);
    g.add(pivot);
    wheels.push({ pivot, tyre, front });
  }
  // asap kerusakan (sprite abu-abu, muncul saat damage tinggi)
  const smokeMat = new THREE.SpriteMaterial({ color: 0x555555, transparent: true, opacity: 0, depthWrite: false });
  const smoke = new THREE.Sprite(smokeMat);
  smoke.scale.set(1.6, 1.6, 1); smoke.position.set(0, 1.2, def.l * 0.3);
  g.add(smoke);
  // blob shadow kontak
  return {
    group: g, body, wheels, brakeL, brakeR, headL, headR, coneMat,
    barL, barR, smoke, smokeMat, def, type,
  };
}

// ---- kendaraan dinamis ----
export function createVehicle(W, type, x, z, heading, opts = {}) {
  const model = makeCarModel(type, opts.color);
  model.group.position.set(x, 0, z);
  model.group.rotation.y = heading;
  W.scene.add(model.group);
  const v = {
    model, type, def: model.def,
    pos: model.group.position,
    heading, speed: 0, steer: 0,
    damage: opts.damage || 0,
    driver: opts.driver || null,      // 'player' | 'traffic' | 'police' | 'parked' | null
    stolen: false,
    brakeLight: false, headlights: false,
    ai: opts.ai || null,              // {waypoints, idx, speed}
    update(dt, input) { updateVehicle(W, v, dt, input); },
    dispose() { W.scene.remove(model.group); },
  };
  return v;
}

function updateVehicle(W, v, dt, input) {
  const def = v.def;
  if (v.driver === 'player' && input) {
    const fwd = input.forward ? 1 : 0, back = input.back ? 1 : 0;
    const targetSteer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    v.steer += (targetSteer * CFG.steerMax - v.steer) * Math.min(1, dt * 8);
    const accel = fwd ? CFG.carAccel * def.accel : 0;
    const brake = back ? CFG.carBrake : 0;
    if (fwd) v.speed += accel * dt;
    if (back) {
      if (v.speed > 0.5) v.speed -= brake * dt;
      else v.speed -= CFG.carAccel * 0.5 * dt;
    }
    if (!fwd && !back) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 8 * dt);
    if (input.handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 26 * dt);
    const maxF = def.top, maxR = CFG.carMaxReverse;
    v.speed = Math.max(-maxR, Math.min(maxF, v.speed));
    const grip = input.handbrake ? CFG.handbrakeGrip : CFG.grip;
    v.heading += (v.steer * (v.speed / 9)) * dt * (v.speed >= 0 ? 1 : -1) * (grip / CFG.grip);
    v.brakeLight = back || input.handbrake;
  } else if (v.ai) {
    // AI: kejar waypoint, rem bila mobil di depan terlalu dekat
    const wp = v.ai.waypoints[v.ai.idx];
    const dx = wp.x - v.pos.x, dz = wp.z - v.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) v.ai.idx = (v.ai.idx + 1) % v.ai.waypoints.length;
    const want = Math.atan2(dx, dz);
    let dh = want - v.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    v.steer += (Math.max(-CFG.steerMax, Math.min(CFG.steerMax, dh * 1.4)) - v.steer) * Math.min(1, dt * 5);
    const slow = v.ai.slowFor ? 0.45 : 1;
    const target = v.ai.speed * slow;
    v.speed += (target - v.speed) * Math.min(1, dt * 1.6);
    v.heading += (v.steer * (v.speed / 9)) * dt;
    v.brakeLight = slow < 1;
  }
  // gerak + tabrakan gedung
  const nx = v.pos.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.pos.z + Math.cos(v.heading) * v.speed * dt;
  const oldX = v.pos.x, oldZ = v.pos.z;
  v.pos.x = nx; v.pos.z = nz;
  const hit = collideCircle(v.pos, 1.5, W.city.colliders);
  if (hit) {
    if (Math.abs(v.speed) > 6 && v.driver === 'player') {
      W.events.emit('crash', { speed: Math.abs(v.speed) });
      v.damage += Math.abs(v.speed) * 0.6;
    }
    v.speed *= 0.35;
    v.pos.x = oldX; v.pos.z = oldZ;
    collideCircle(v.pos, 1.5, W.city.colliders);
  }
  // batas dunia
  v.pos.x = Math.max(-260, Math.min(260, v.pos.x));
  v.pos.z = Math.max(-190, Math.min(200, v.pos.z));
  // visual: body roll/pitch, roda, lampu
  v.model.group.rotation.y = v.heading;
  const roll = -v.steer * Math.min(1, Math.abs(v.speed) / 30) * 0.06;
  const pitch = (v.driver === 'player' && input && input.back ? 0.03 : 0) - Math.min(0.04, Math.abs(v.speed) * 0.0006);
  v.model.body.rotation.z = roll;
  v.model.body.rotation.x = pitch;
  for (const w of v.model.wheels) {
    w.tyre.rotation.x += (v.speed * dt) / 0.36;
    if (w.front) w.pivot.rotation.y = v.steer * 0.9;
  }
  const braking = v.brakeLight;
  v.model.brakeL.material.emissiveIntensity = braking ? 2.2 : 0.15;
  v.model.brakeR.material.emissiveIntensity = braking ? 2.2 : 0.15;
  const night = W.weather ? W.weather.nightFactor() : 0;
  const heads = v.headlights || night > 0.5;
  v.model.headL.material.emissiveIntensity = heads ? 2.4 : 0.4;
  v.model.headR.material.emissiveIntensity = heads ? 2.4 : 0.4;
  v.model.coneMat.opacity = heads ? 0.07 : 0;
  // asap kerusakan
  const dmg = Math.min(1, v.damage / 60);
  v.model.smokeMat.opacity = dmg > 0.25 ? (dmg - 0.2) * 0.7 : 0;
  if (v.model.smokeMat.opacity > 0) {
    v.model.smoke.position.y = 1.2 + Math.sin(W.time * 7) * 0.15;
    v.model.smoke.scale.setScalar(1.4 + dmg * 1.6 + Math.sin(W.time * 9) * 0.2);
  }
}
