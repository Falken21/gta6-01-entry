// Costa Serena — combat.js
// Tembakan hitscan sederhana + kesehatan. Tembakan dan tabrakan membuat
// pejalan kaki panik dan menaikkan wanted; polisi yang ditembak rusak.
import * as THREE from '../vendor/three.module.min.js';

export function createCombat(W) {
  const ray = new THREE.Raycaster();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  let tracer = null;
  let tracerT = 0;
  let cooldown = 0;
  let ammo = Infinity;

  function shoot() {
    if (W.state !== 'playing' || cooldown > 0 || !W.player.onFoot) return;
    cooldown = 0.28;
    // Bidik dari bahu Rafi, nyaris horizontal (bukan dari kamera yang
    // menukik ke arah pemain — sinar itu akan menembus tanah sebelum
    // mencapai pejalan kaki di depan).
    const from = W.player.pos.clone();
    from.y = 1.5;
    const dir = new THREE.Vector3();
    W.camera.getWorldDirection(dir);
    dir.y = -0.06; // sedikit menunduk
    dir.normalize();
    ray.set(from, dir);
    ray.far = 90;
    // pastikan matrix dunia mutakhir (pejalan kaki baru saja berpindah)
    W.scene.updateMatrixWorld(true);
    // target: pejalan kaki dulu, lalu mobil polisi, lalu gedung
    let hit = null, hitObj = null;
    const pedMeshes = [];
    for (const p of W.pedestrians.list) {
      p.g.traverse((o) => { if (o.isMesh) { o.userData.ped = p; pedMeshes.push(o); } });
    }
    const hits = ray.intersectObjects(pedMeshes, false);
    if (hits.length) { hit = hits[0]; hitObj = { kind: 'ped', ped: hit.object.userData.ped }; }
    else {
      const carMeshes = [];
      for (const c of W.police.cops) c.model.group.traverse((o) => { if (o.isMesh) { o.userData.cop = c; carMeshes.push(o); } });
      const ch = ray.intersectObjects(carMeshes, false);
      if (ch.length) { hit = ch[0]; hitObj = { kind: 'cop', cop: ch[0].object.userData.cop }; }
    }
    const end = hit ? hit.point : from.clone().add(dir.multiplyScalar(80));
    // garis tracer singkat
    if (tracer) W.scene.remove(tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([from, end]);
    tracer = new THREE.Line(geo, tracerMat);
    W.scene.add(tracer);
    tracerT = 0.08;
    W.audio.gunshot();
    W.events.emit('shot', {});
    if (hitObj) {
      if (hitObj.kind === 'ped') {
        W.pedestrians.panicAt(hitObj.ped.pos.x, hitObj.ped.pos.z, 26);
        W.police.addHeat(1, 'penembakan terlihat');
      } else if (hitObj.kind === 'cop') {
        hitObj.cop.damage = (hitObj.cop.damage || 0) + 22;
        if (hitObj.cop.damage > 60) {
          W.police.addHeat(1, 'mobil polisi dihancurkan');
          // polisi keluar & kabur: hapus mobilnya
          const idx = W.police.cops.indexOf(hitObj.cop);
          if (idx >= 0) { W.police.cops.splice(idx, 1); hitObj.cop.dispose(); }
        }
      }
    } else {
      // tembakan ke udara tetap mengagetkan pejalan kaki di dekat garis tembak
      W.pedestrians.panicAt(end.x, end.z, 12);
    }
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (tracer) {
      tracerT -= dt;
      tracerMat.opacity = Math.max(0, tracerT / 0.08) * 0.9;
      if (tracerT <= 0) { W.scene.remove(tracer); tracer = null; }
    }
  }
  return { shoot, update, get ammo() { return ammo; } };
}
