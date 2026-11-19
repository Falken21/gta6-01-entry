// Costa Serena — police.js
// Sistem wanted 1–5 bintang: kejahatan menaikkan panas, mobil polisi spawn
// di tepi jalan dan mengejar dengan perilaku menabrak/menjepit; hilang dari
// pandangan memulai cooldown — sembunyi dan bintang menguras.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { createVehicle } from './vehicles.js';

export function createPolice(W) {
  const cops = [];
  let wanted = 0;
  let heat = 0;            // 0..5 pecahan
  let coolT = 0;
  let spawnT = 0;
  let bustT = 0;

  function addHeat(amount, reason) {
    if (W.state !== 'playing') return;
    heat = Math.min(CFG.wantedMax, heat + amount);
    const w = Math.floor(heat);
    if (w > wanted) {
      wanted = w;
      W.events.emit('wanted', { wanted, reason });
      W.hud.toast(`WANTED ★${wanted} — ${reason}`, 'bad');
    }
    coolT = CFG.coolDelay;
  }
  function spawnCop() {
    // spawn di jalan terdekat dari tepi pandangan pemain
    const px = W.player.pos.x, pz = W.player.pos.z;
    const ax = CFG.avenues[Math.floor(W.rng() * CFG.avenues.length)];
    const sz = CFG.streets[Math.floor(W.rng() * CFG.streets.length)];
    const edge = W.rng() < 0.5;
    // spawn 40–70 m dari pemain — selalu di dalam ambang hapus (300 m)
    const x = edge ? ax + (W.rng() - 0.5) * 10 : px + (W.rng() < 0.5 ? -1 : 1) * (40 + W.rng() * 30);
    const z = edge ? pz + (W.rng() < 0.5 ? -1 : 1) * (40 + W.rng() * 30) : sz + (W.rng() - 0.5) * 10;
    const cop = createVehicle(W, 'police', x, z, 0, { driver: 'police' });
    cop.ai = {
      waypoints: [{ x: px, z: pz }], idx: 0, speed: 20 + wanted * 2.4,
      chase: true,
    };
    // lightbar berkedip + pool cahaya merah/biru di jalan
    const poolR = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({
      color: 0xff2222, transparent: true, opacity: 0, depthWrite: false,
    }));
    poolR.rotation.x = -Math.PI / 2; poolR.position.y = 0.07;
    const poolB = poolR.clone();
    poolB.material = poolR.material.clone(); poolB.material.color.set(0x2244ff);
    cop.model.group.add(poolR); cop.model.group.add(poolB);
    cop.pools = { r: poolR, b: poolB };
    cops.push(cop);
    return cop;
  }
  function removeCop(cop) {
    const i = cops.indexOf(cop);
    if (i >= 0) cops.splice(i, 1);
    cop.dispose();
  }

  function update(dt, t) {
    wanted = Math.floor(heat);
    // cooldown saat tidak ada polisi yang dekat / melihat
    let nearest = Infinity;
    for (const c of cops) nearest = Math.min(nearest, Math.hypot(c.pos.x - W.player.pos.x, c.pos.z - W.player.pos.z));
    if (wanted > 0 && nearest > 55) {
      coolT -= dt;
      if (coolT <= 0) {
        heat = Math.max(0, heat - CFG.coolRate * dt);
        if (Math.floor(heat) < wanted) {
          wanted = Math.floor(heat);
          W.events.emit('wanted', { wanted, reason: 'bersembunyi' });
          if (wanted === 0) W.hud.toast('Kamu lolos dari kejaran.', 'good');
        }
      }
    } else coolT = CFG.coolDelay;

    // spawn sesuai bintang (maks 1 + wanted)
    const wantCount = wanted > 0 ? Math.min(3, 1 + Math.floor(wanted / 2)) : 0;
    spawnT -= dt;
    if (cops.length < wantCount && spawnT <= 0) { spawnCop(); spawnT = 2.5; }

    for (const cop of [...cops]) {
      // kejar posisi pemain (re-path tiap frame); paceAhead > 0 = jaga jarak
      // di depan pemain (untuk formasi kejaran yang terlihat di frame)
      const lead = cop.ai.paceAhead || 0;
      const hd = W.player.car ? W.player.car.heading : W.player.heading;
      cop.ai.waypoints[0] = {
        x: W.player.pos.x + Math.sin(hd) * lead,
        z: W.player.pos.z + Math.cos(hd) * lead,
      };
      cop.ai.speed = 20 + wanted * 2.4;
      cop.update(dt);
      // lightbar berkedip bergantian + pool cahaya
      const phase = Math.floor(t * 6) % 2 === 0;
      cop.model.barL.material.emissiveIntensity = phase ? 3.5 : 0.15;
      cop.model.barR.material.emissiveIntensity = phase ? 0.15 : 3.5;
      cop.pools.r.material.opacity = phase ? 0.28 : 0;
      cop.pools.b.material.opacity = phase ? 0 : 0.28;
      const d = Math.hypot(cop.pos.x - W.player.pos.x, cop.pos.z - W.player.pos.z);
      // tabrak pemain: dorong + damage saat di mobil, bust saat jalan kaki
      if (d < 3.4) {
        if (W.player.onFoot) {
          bustT += dt;
          if (bustT > 1.6) {
            W.events.emit('game-over', { reason: 'Ditangkap polisi.' });
            bustT = 0;
          }
        } else if (Math.abs(cop.speed) > 5) {
          W.player.damage(0.4);
          W.events.emit('crash', { speed: Math.abs(cop.speed) * 0.7 });
          cop.speed *= 0.4;
        }
      } else bustT = Math.max(0, bustT - dt * 2);
      // polisi yang tertinggal jauh dihapus (respawn dekat)
      if (d > 300) removeCop(cop);
    }
    // sirene menyala saat ada pengejaran
    if (W.audio) W.audio.setSiren(cops.length > 0 && wanted > 0);
  }

  return {
    get wanted() { return wanted; },
    get heat() { return heat; },
    cops, addHeat, update,
    clear() { for (const c of [...cops]) removeCop(c); heat = 0; wanted = 0; },
  };
}
