// Costa Serena — combat.js
// One job: fighting. Hitscan pistol with a tracer and muzzle flash, a
// melee shove, health, and the reactions a shot causes: peds panic, cops
// and the wanted system notice, cars take damage and smoke.
import * as THREE from 'three';
import { CFG, clamp } from './config.js';

export function createCombat(scene, camera) {
  const raycaster = new THREE.Raycaster();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);
  const flash = new THREE.PointLight(0xffc36b, 0, 9, 1.6);
  scene.add(flash);
  let cooldown = 0;
  let tracerTimer = 0;

  function shoot(origin, dir, targets, onHit) {
    // targets: [{ mesh-ish object3D, radius, pos, ref }] — raycast against
    // invisible hit spheres is cheaper and stabler than mesh raycasts.
    if (cooldown > 0) return null;
    cooldown = CFG.pistolCooldown;
    raycaster.set(origin, dir);
    raycaster.far = CFG.pistolRange;
    let best = null, bd = CFG.pistolRange;
    for (const t of targets) {
      const to = new THREE.Vector3().subVectors(t.pos, origin);
      const along = to.dot(dir);
      if (along < 0 || along > bd) continue;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp < t.radius) { best = t; bd = along; }
    }
    const end = origin.clone().addScaledVector(dir, bd);
    tracerGeo.setFromPoints([origin.clone(), end]);
    tracer.visible = true;
    tracerTimer = 0.07;
    flash.position.copy(origin).addScaledVector(dir, 1.2);
    flash.intensity = 26;
    if (best) onHit?.(best, end);
    return best;
  }

  function melee(origin, dir, targets, onHit) {
    let best = null, bd = 2.4;
    for (const t of targets) {
      const d = t.pos.distanceTo(origin);
      if (d < bd) { best = t; bd = d; }
    }
    if (best) onHit?.(best, best.pos);
    return best;
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (tracerTimer > 0) {
      tracerTimer -= dt;
      if (tracerTimer <= 0) tracer.visible = false;
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 220);
  }

  return { shoot, melee, update, get ready() { return cooldown <= 0; } };
}
