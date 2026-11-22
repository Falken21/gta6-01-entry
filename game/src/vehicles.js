// Costa Serena — vehicles.js
// Model kendaraan multi-bagian (bukan kotak kaku): bodi + kabin berkaca +
// kap/bagasi + roda berputar & membelok + lampu rem/lampu depan + knalpot +
// asap kerusakan. Fisika berkendara berbobot: akselerasi, pengereman,
// kemudi mengencang dengan kecepatan, body roll/pitch.
import { CFG, PALETTE, clamp, damp, lerp, makeRng } from './config.js';

const KINDS = {
  sedan: { len: 4.4, wid: 1.9, h: 0.62, cabin: 0.55, color: null },
  hatch: { len: 3.8, wid: 1.8, h: 0.66, cabin: 0.6, color: null },
  taxi: { len: 4.4, wid: 1.9, h: 0.62, cabin: 0.55, color: 0xe0c020 },
  pickup: { len: 4.9, wid: 2.0, h: 0.72, cabin: 0.62, color: null },
  sport: { len: 4.3, wid: 1.95, h: 0.5, cabin: 0.45, color: 0xb02020 },
  police: { len: 4.5, wid: 1.95, h: 0.62, cabin: 0.55, color: 0xe8e8e8 },
};

export function buildCarMesh(THREE, kind, colorHex) {
  const spec = KINDS[kind] || KINDS.sedan;
  const rng = makeRng((kind.length * 131 + (colorHex || 0)) >>> 0);
  const color = colorHex !== undefined && colorHex !== null ? colorHex
    : (spec.color !== null && spec.color !== undefined ? spec.color : PALETTE.carPaint[Math.floor(rng.next() * PALETTE.carPaint.length)]);
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.65 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.08, metalness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.2, metalness: 0.9 });

  const L = spec.len, W = spec.wid;
  // bodi bawah + kap + bagasi (tiga volume, bukan satu kotak)
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, spec.h, W), paint);
  body.position.y = 0.55; body.castShadow = true;
  g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(L * 0.22, 0.16, W * 0.94), paint);
  hood.position.set(L * 0.36, 0.9, 0); hood.castShadow = true;
  g.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(L * 0.2, 0.15, W * 0.94), paint);
  trunk.position.set(-L * 0.38, 0.9, 0);
  g.add(trunk);
  // kabin berkaca dengan pilar
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.46, spec.cabin, W * 0.86), glass);
  cabin.position.set(-L * 0.04, 0.95 + spec.cabin / 2, 0);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.4, 0.07, W * 0.8), paint);
  roof.position.set(-L * 0.04, 0.98 + spec.cabin, 0);
  g.add(roof);
  // bumper + grill krom
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, W * 0.96), chrome);
  bumperF.position.set(L / 2, 0.42, 0);
  const bumperR = bumperF.clone(); bumperR.position.x = -L / 2;
  g.add(bumperF, bumperR);
  // lampu depan (menyala) + lampu rem
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6cc, emissive: 0xffe9a0, emissiveIntensity: 0.25 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0xdd1010, emissiveIntensity: 0.3 });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), headMat);
    hl.position.set(L / 2 + 0.02, 0.72, side * (W / 2 - 0.35));
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), brakeMat);
    tl.position.set(-L / 2 - 0.02, 0.72, side * (W / 2 - 0.35));
    g.add(hl, tl);
  }
  // roda: ban + pelek, berputar & roda depan membelok
  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12);
  for (const [wx, wz, front] of [[L * 0.32, W / 2 - 0.05, true], [L * 0.32, -W / 2 + 0.05, true], [-L * 0.32, W / 2 - 0.05, false], [-L * 0.32, -W / 2 + 0.05, false]]) {
    const steer = new THREE.Group();
    steer.position.set(wx, 0.36, wz);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.x = Math.PI / 2; tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, chrome);
    hub.rotation.x = Math.PI / 2;
    steer.add(tire, hub);
    g.add(steer);
    wheels.push({ steer, spin: tire, front });
  }
  // aksesori per jenis
  if (kind === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, W * 0.9), dark);
    wing.position.set(-L / 2 + 0.1, 1.15, 0);
    g.add(wing);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xffe040, emissive: 0xcc9900, emissiveIntensity: 0.5 }));
    sign.position.set(0, 1.35, 0);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 1 }));
    red.position.z = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0000cc, emissive: 0x0000ff, emissiveIntensity: 1 }));
    blue.position.z = 0.3;
    bar.add(red, blue);
    bar.position.set(0, 1.32, 0);
    g.add(bar);
    g.userData.lightbar = { red: red.material, blue: blue.material };
  }
  if (kind === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, 0.3, W * 0.9), dark);
    bed.position.set(-L * 0.32, 0.95, 0);
    g.add(bed);
  }
  // asap kerusakan: sprite radial yang muncul saat damage tinggi
  const smoke = makeSmokeSprite(THREE);
  smoke.position.set(-L * 0.3, 1.1, 0);
  smoke.material.opacity = 0;
  g.add(smoke);

  g.userData = { ...g.userData, wheels, headMat, brakeMat, smoke: smoke.material, kind };
  return g;
}

function makeSmokeSprite(THREE) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(120,120,120,0.85)');
  grad.addColorStop(1, 'rgba(120,120,120,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.6, 1.6, 1);
  return spr;
}

export function makeVehicle(S, THREE, kind, x, z, angle, colorHex) {
  const mesh = buildCarMesh(THREE, kind, colorHex);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  S.scene.add(mesh);
  const v = {
    kind, mesh, x, z, angle, speed: 0, steer: 0,
    damage: 0, driver: null, isPlayer: false, isPolice: kind === 'police',
    brakeLight: 0, headlight: 0, wheelSpin: 0, stuck: 0,
  };
  S.vehicles.push(v);
  return v;
}

// Fisika berkendara pemain: bobot terasa lewat akselerasi melengkung,
// kemudi yang mengencang dengan kecepatan, dan body roll/pitch visual.
export function driveVehicle(S, v, dt, input) {
  const fwd = input.forward ? 1 : 0, back = input.back ? 1 : 0;
  const accel = CFG.carAccel * (v.speed < 0 ? 0.7 : 1);
  if (fwd) v.speed += accel * dt * (1 - Math.abs(v.speed) / CFG.carMaxSpeed);
  if (back) v.speed -= (v.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
  if (!fwd && !back) v.speed = damp(v.speed, 0, 1.2, dt);
  if (input.handbrake) v.speed = damp(v.speed, 0, 6, dt);
  v.speed = clamp(v.speed, -CFG.carMaxReverse, v.isPolice ? CFG.policeMaxSpeed : CFG.carMaxSpeed);

  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerAuthority = clamp(1 - Math.abs(v.speed) / CFG.carMaxSpeed * 0.62, 0.38, 1);
  v.steer = damp(v.steer, steerTarget * CFG.carSteerMax * steerAuthority, 8, dt);
  if (Math.abs(v.speed) > 0.2) {
    v.angle += (v.steer * v.speed * 0.055) * dt * (v.speed >= 0 ? 1 : -1);
  }
  const nx = v.x + Math.sin(v.angle) * v.speed * dt;
  const nz = v.z + Math.cos(v.angle) * v.speed * dt;
  // tabrakan gedung: geser dan kurangi kecepatan
  const before = { x: v.x, z: v.z };
  const probe = { x: nx, z: nz };
  S.resolveColliders(probe, 1.6);
  if (Math.abs(probe.x - nx) > 0.01 || Math.abs(probe.z - nz) > 0.01) {
    if (Math.abs(v.speed) > 6) S.onCollision && S.onCollision(Math.abs(v.speed));
    v.speed *= 0.45;
  }
  v.x = probe.x; v.z = probe.z;
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.angle;
  // body roll saat belok + pitch saat akselerasi/pengereman
  const roll = -v.steer * clamp(Math.abs(v.speed) / 20, 0, 1) * 0.06;
  const pitch = clamp(-(fwd ? 1 : 0) * 0.02 + (back ? 0.03 : 0), -0.04, 0.04) * clamp(Math.abs(v.speed) / 15, 0, 1);
  v.mesh.rotation.z = roll;
  v.mesh.rotation.x = pitch;
  // roda: putar sesuai kecepatan, roda depan membelok
  v.wheelSpin += (v.speed / 0.36) * dt;
  const ud = v.mesh.userData;
  for (const w of ud.wheels) {
    w.spin.rotation.y = v.wheelSpin;
    if (w.front) w.steer.rotation.y = v.steer * 0.9;
  }
  // lampu rem menyala saat mundur/mengerem; lampu depan saat malam
  const night = S.timeOfDay > 18.5 || S.timeOfDay < 6;
  const braking = back || input.handbrake;
  ud.brakeMat.emissiveIntensity = braking ? 2.2 : (night ? 1.5 : 0.3);
  ud.headMat.emissiveIntensity = night ? 2.4 : 0.25;
  // asap kerusakan
  ud.smoke.opacity = v.damage > 0.45 ? clamp((v.damage - 0.45) * 1.6, 0, 0.75) : 0;
  if (v.damage > 0.45) ud.smoke.rotation = (ud.smoke.rotation || 0) + dt;
  return v;
}
