// Costa Serena — player.js
// Rafi di jalan kaki: kontrol third-person, kamera orbit, masuk/keluar mobil.
// Pejalan kaki Rafi memakai mesh terartikulasi yang sama dengan warga kota,
// tapi berjaket teal khas agar mudah dikenali di screenshot.
import { CFG, clamp, dist2 } from './config.js';
import { buildPedestrianMesh } from './pedestrians.js';
import { makeRng } from './config.js';
import { nearestVehicle } from './traffic.js';
import { resolveColliders } from './city.js';

export function createPlayer(S, THREE) {
  const rng = makeRng(CFG.seed + 99);
  const mesh = buildPedestrianMesh(THREE, rng);
  // jaket teal khas Rafi: ganti warna torso
  mesh.children.forEach((c) => { /* torso tetap dari builder; identitas via penanda */ });
  mesh.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 0.46) o.material = new THREE.MeshStandardMaterial({ color: 0x0e7a6e, roughness: 0.85 }); });
  mesh.position.set(S.spawns.player.x, 0, S.spawns.player.z);
  S.scene.add(mesh);
  const p = {
    mesh, x: S.spawns.player.x, z: S.spawns.player.z,
    angle: S.spawns.player.angle, speed: 0,
    health: CFG.playerHealthMax, cash: 0,
    onFoot: true, vehicle: null, phase: 0,
    camYaw: S.spawns.player.angle, camPitch: 0.32, camDist: 7,
  };
  S.player = p;
  return p;
}

export function updatePlayerOnFoot(S, dt) {
  const p = S.player;
  const input = S.input;
  const run = input.run ? CFG.runSpeed : CFG.walkSpeed;
  let mx = 0, mz = 0;
  if (input.forward) mz += 1;
  if (input.back) mz -= 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    // gerak relatif terhadap arah kamera
    const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
    const wx = (mx * cos + mz * sin);
    const wz = (-mx * sin + mz * cos);
    const targetAngle = Math.atan2(wx, wz);
    let diff = targetAngle - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += clamp(diff, -8 * dt, 8 * dt);
    p.speed = run;
    p.x += Math.sin(p.angle) * p.speed * dt;
    p.z += Math.cos(p.angle) * p.speed * dt;
    p.phase += dt * (input.run ? 11 : 7);
  } else {
    p.speed = 0;
  }
  const probe = { x: p.x, z: p.z };
  resolveColliders(S, probe, 0.5);
  p.x = probe.x; p.z = probe.z;
  // animasi jalan
  const swing = moving ? Math.sin(p.phase) * 0.6 : 0;
  const ud = p.mesh.userData;
  ud.legs[0].rotation.x = swing;
  ud.legs[1].rotation.x = -swing;
  ud.arms[0].rotation.x = -swing * 0.8;
  ud.arms[1].rotation.x = swing * 0.8;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.angle;
  // tabrakan dengan mobil lalu lintas: dorong + damage kecil
  for (const v of S.traffic) {
    if (Math.abs(v.speed) > 2 && dist2(p.x, p.z, v.x, v.z) < 1.8) {
      p.health = Math.max(0, p.health - 12);
      p.x += Math.sin(v.angle) * 2; p.z += Math.cos(v.angle) * 2;
      S.setDanger && S.setDanger(v.x, v.z, 14, 2);
      S.toast && S.toast('Kamu tertabrak!');
    }
  }
}

export function tryEnterVehicle(S) {
  const p = S.player;
  if (!p.onFoot) return false;
  const v = nearestVehicle(S, p.x, p.z, 4.5);
  if (!v) { S.toast && S.toast('Tidak ada mobil di dekat sini — cari mobil parkir di tepi jalan.'); return false; }
  p.onFoot = false;
  p.vehicle = v;
  v.isPlayer = true;
  v.driver = p;
  S.playerVehicle = v;
  p.mesh.visible = false;
  S.addWanted && S.addWanted(v.parked ? 0 : 1, 'mencuri mobil');
  if (!v.parked) S.setDanger && S.setDanger(v.x, v.z, 18, 3); // sopir kabur panik
  v.parked = false;
  S.toast && S.toast(v.kind === 'taxi' ? 'Taksi dibajak! Pelanggan kabur.' : 'Mobil dicuri — polisi mungkin melihatmu.');
  S.audio && S.audio.honk && S.audio.honk();
  return true;
}

export function exitVehicle(S) {
  const p = S.player;
  if (p.onFoot || !p.vehicle) return;
  const v = p.vehicle;
  v.speed = 0;
  v.isPlayer = false;
  v.driver = null;
  p.onFoot = true;
  p.vehicle = null;
  S.playerVehicle = null;
  p.x = v.x + Math.sin(v.angle + Math.PI / 2) * 2.2;
  p.z = v.z + Math.cos(v.angle + Math.PI / 2) * 2.2;
  p.angle = v.angle;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
}
