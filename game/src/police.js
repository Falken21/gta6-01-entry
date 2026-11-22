// Costa Serena — police.js
// Sistem wanted 1–5 bintang: kejahatan menaikkan bintang, mobil polisi spawn
// di tepi kota dan mengejar dengan perilaku menabrak/menjepit, lampu strobo
// merah-biru memantul di jalan, dan sirene. Putus garis pandang + menjauh
// memulai cooldown — bersembunyi dan bintang perlahan turun.
import { CFG, clamp, dist2, makeRng } from './config.js';
import { makeVehicle, driveVehicle } from './vehicles.js';

export function createPolice(S) {
  S.wanted = 0;
  S.wantedHeat = 0; // 0..1, memanas saat terlihat polisi
  S.police = [];
  S.policeCooldown = 0;
  S.addWanted = (n, reason) => {
    if (S.mode !== 'playing') return;
    S.wanted = clamp(S.wanted + n, 0, CFG.wantedMax);
    if (n > 0) {
      S.wantedHeat = 1;
      S.policeCooldown = 0;
      S.toast && S.toast(reason ? `Wanted naik! ${reason}` : 'Wanted naik!');
      S.hudFlash && S.hudFlash();
    }
  };
}

export function updatePolice(S, THREE, dt) {
  const px = S.player.onFoot ? S.player.x : (S.playerVehicle ? S.playerVehicle.x : S.player.x);
  const pz = S.player.onFoot ? S.player.z : (S.playerVehicle ? S.playerVehicle.z : S.player.z);
  const rng = S._policeRng || (S._policeRng = makeRng(CFG.seed + 55));
  // jumlah polisi aktif mengikuti bintang
  const wantCount = S.wanted >= 1 ? Math.min(1 + Math.floor(S.wanted / 2), 4) : 0;
  while (S.police.length < wantCount) {
    const sp = S.spawns.police[S.police.length % S.spawns.police.length];
    const v = makeVehicle(S, THREE, 'police', sp[0] + rng.range(-10, 10), sp[1] + rng.range(-10, 10), 0);
    v.cruise = CFG.policeMaxSpeed;
    v.pursuitSide = (S.police.length % 2 === 0 ? 1 : -1) * 6;
    S.police.push(v);
  }
  while (S.police.length > wantCount) {
    const v = S.police[S.police.length - 1];
    if (v.isPlayer) break; // jangan hapus mobil polisi yang sedang dikemudikan pemain
    S.police.pop();
    S.scene.remove(v.mesh);
    const i = S.vehicles.indexOf(v);
    if (i >= 0) S.vehicles.splice(i, 1);
  }
  // cooldown: bila pemain jauh dari semua polisi, bintang turun perlahan
  let nearestD = 1e9;
  for (const v of S.police) nearestD = Math.min(nearestD, dist2(v.x, v.z, px, pz));
  if (S.wanted > 0 && nearestD > 70) {
    S.policeCooldown += dt;
    if (S.policeCooldown > 6) {
      S.wanted = Math.max(0, S.wanted - dt * 0.12);
      if (S.wanted < 0.5) { S.wanted = 0; S.toast && S.toast('Kamu berhasil bersembunyi — wanted hilang.'); }
    }
  } else {
    S.policeCooldown = 0;
  }
  // kejar: bidik titik di samping pemain (mengepung, bukan menumpuk di
  // satu titik) — offset mengecil saat dekat supaya tetap bisa menabrak
  const t = S.now * 6;
  for (const v of S.police) {
    const d = dist2(v.x, v.z, px, pz);
    const side = v.pursuitSide !== undefined ? v.pursuitSide : 0;
    const off = side * clamp(d / 25, 0.25, 1);
    const wantAngle = Math.atan2((px + off) - v.x, pz - v.z);
    let diff = wantAngle - v.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.angle += clamp(diff, -1.9 * dt, 1.9 * dt);
    const targetSpeed = d > 26 ? CFG.policeMaxSpeed : (d > 8 ? 22 : 12);
    v.speed += clamp(targetSpeed - v.speed, -14 * dt, 9 * dt);
    v.x += Math.sin(v.angle) * v.speed * dt;
    v.z += Math.cos(v.angle) * v.speed * dt;
    const probe = { x: v.x, z: v.z };
    S.resolveColliders(probe, 1.6);
    v.x = probe.x; v.z = probe.z;
    // menabrak pemain: damage + dorongan
    if (d < 3.2) {
      if (S.playerVehicle) {
        S.playerVehicle.speed *= 0.55;
        S.playerVehicle.damage = clamp(S.playerVehicle.damage + 0.08, 0, 1);
        S.onCollision && S.onCollision(8);
      } else if (S.player.health > 0) {
        S.player.health = Math.max(0, S.player.health - 18 * dt);
      }
      v.speed *= 0.5;
    }
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.angle;
    v.wheelSpin += (v.speed / 0.36) * dt;
    for (const w of v.mesh.userData.wheels) w.spin.rotation.y = v.wheelSpin;
    // strobo merah-biru bergantian
    const lb = v.mesh.userData.lightbar;
    if (lb) {
      const on = Math.sin(t) > 0;
      lb.red.emissiveIntensity = on ? 3 : 0.15;
      lb.blue.emissiveIntensity = on ? 0.15 : 3;
    }
  }
  // sirene mengikuti jarak polisi terdekat
  if (S.audio && S.audio.setSiren) S.audio.setSiren(S.police.length > 0 ? clamp(1 - nearestD / 120, 0.1, 1) : 0);
}
