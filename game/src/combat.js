// Costa Serena — combat.js
// Tembakan hitscan sederhana + kesehatan. Tembakan membuat pejalan kaki di
// sekitar panik dan lari, menaikkan wanted bila terdengar, dan memberi umpan
// balik visual (kilat moncong + tracer) serta suara.
import { CFG, clamp, dist2 } from './config.js';

export function createCombat(S, THREE) {
  S.combat = { cooldown: 0, shots: 0, muzzle: null };
  const geo = new THREE.SphereGeometry(0.16, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 });
  const flash = new THREE.Mesh(geo, mat);
  S.scene.add(flash);
  S.combat.muzzle = flash;
  // garis tracer tipis
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(tGeo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
  S.scene.add(tracer);
  S.combat.tracer = tracer;
}

export function shoot(S, THREE) {
  const c = S.combat;
  if (!c || c.cooldown > 0 || S.mode !== 'playing' || !S.player.onFoot) return false;
  c.cooldown = 0.28;
  c.shots++;
  const p = S.player;
  const ox = p.x, oz = p.z, oy = 1.45;
  const dx = Math.sin(p.angle), dz = Math.cos(p.angle);
  // cari sasaran terdekat dalam kerucut depan 60m
  let best = null, bestD = 60;
  const consider = (x, z, obj) => {
    const rx = x - ox, rz = z - oz;
    const along = rx * dx + rz * dz;
    if (along < 1 || along > bestD) return;
    const side = Math.abs(rx * dz - rz * dx);
    if (side < 1.6) { bestD = along; best = obj; }
  };
  for (const ped of S.peds) consider(ped.x, ped.z, { type: 'ped', ref: ped });
  for (const v of S.police) consider(v.x, v.z, { type: 'police', ref: v });
  for (const v of S.traffic) consider(v.x, v.z, { type: 'car', ref: v });
  const hx = ox + dx * bestD, hz = oz + dz * bestD;
  // kilat + tracer singkat
  c.muzzle.position.set(ox + dx * 0.7, oy, oz + dz * 0.7);
  c.muzzle.material.opacity = 1;
  const pos = c.tracer.geometry.attributes.position;
  pos.setXYZ(0, ox + dx * 0.7, oy, oz + dz * 0.7);
  pos.setXYZ(1, hx, 1.0, hz);
  pos.needsUpdate = true;
  c.tracer.material.opacity = 0.9;
  S.audio && S.audio.gunshot && S.audio.gunshot();
  S.setDanger && S.setDanger(ox, oz, 26, 4); // semua pejalan kaki di sekitar panik
  S.addWanted && S.addWanted(1, 'tembakan terdengar');
  if (best) {
    if (best.type === 'ped') {
      best.ref.panic = 1;
      S.toast && S.toast('Warga ketakutan dan berlarian!');
    } else if (best.type === 'police') {
      best.ref.damage = clamp(best.ref.damage + 0.25, 0, 1);
      best.ref.speed *= 0.6;
      S.addWanted && S.addWanted(1, 'menembak polisi');
    } else {
      best.ref.damage = clamp(best.ref.damage + 0.2, 0, 1);
      S.toast && S.toast('Mobil itu rusak tertembak.');
    }
  }
  return true;
}

export function updateCombat(S, dt) {
  const c = S.combat;
  if (!c) return;
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.muzzle) c.muzzle.material.opacity = Math.max(0, c.muzzle.material.opacity - dt * 6);
  if (c.tracer) c.tracer.material.opacity = Math.max(0, c.tracer.material.opacity - dt * 5);
  // regenerasi kesehatan perlahan saat tidak bertarung
  if (S.player.health > 0 && S.player.health < CFG.playerHealthMax && S.wanted < 1) {
    S.player.health = Math.min(CFG.playerHealthMax, S.player.health + 2 * dt);
  }
  if (S.player.health <= 0 && S.mode === 'playing') {
    S.gameOver && S.gameOver('Rafi tumbang di jalanan Costa Serena.');
  }
}
