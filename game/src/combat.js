// Costa Serena — combat: melee punch and hitscan pistol. Shooting near people
// makes them flee; hitting a cop or a bystander raises the wanted level.
import * as THREE from 'three';
import { CFG, clamp, dist2D } from './config.js';

export function createCombat() {
  return {
    ammo: 48,
    punchCooldown: 0,
    shootCooldown: 0,
    update(dt) {
      this.punchCooldown = Math.max(0, this.punchCooldown - dt);
      this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    },
    // Melee: hits the nearest ped / police car within 2.2m in front.
    punch(player, peds, policeCars, onHit) {
      if (this.punchCooldown > 0 || !player.alive) return false;
      this.punchCooldown = 0.45;
      const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
      let hit = null, best = 2.4;
      for (const ped of peds.peds) {
        if (ped.state === 'down') continue;
        const dx = ped.pos.x - player.pos.x, dz = ped.pos.z - player.pos.z;
        const fwd = dx * fx + dz * fz;
        if (fwd > 0 && fwd < best && Math.abs(dx * fz - dz * fx) < 1.0) { hit = { kind: 'ped', ped }; best = fwd; }
      }
      if (hit) {
        hit.ped.health -= 40;
        if (hit.ped.health <= 0) { hit.ped.state = 'down'; hit.ped.model.group.rotation.x = -Math.PI / 2; hit.ped.model.group.position.y = 0.3; }
        else hit.ped.state = 'flee';
        onHit?.(hit);
        return true;
      }
      return false;
    },
    // Hitscan pistol from the camera through the crosshair point.
    shoot(player, camera, peds, policeCars, onShot) {
      if (this.shootCooldown > 0 || this.ammo <= 0 || !player.alive) return false;
      this.shootCooldown = 0.28;
      this.ammo -= 1;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = camera.position.clone();
      let hit = null, bestT = 120;
      const testSphere = (x, y, z, r, ref) => {
        const ox = x - origin.x, oy = y - origin.y, oz = z - origin.z;
        const t = ox * dir.x + oy * dir.y + oz * dir.z;
        if (t < 0 || t > bestT) return;
        const cx = origin.x + dir.x * t, cy = origin.y + dir.y * t, cz = origin.z + dir.z * t;
        if (Math.hypot(cx - x, cy - y, cz - z) < r) { bestT = t; hit = ref; }
      };
      for (const ped of peds.peds) {
        if (ped.state === 'down') continue;
        testSphere(ped.pos.x, 1.2, ped.pos.z, 0.8, { kind: 'ped', ped });
      }
      for (const c of policeCars) {
        testSphere(c.pos.x, 1.0, c.pos.z, 1.8, { kind: 'police', car: c });
      }
      if (hit) {
        if (hit.kind === 'ped') {
          hit.ped.health -= 50;
          if (hit.ped.health <= 0) { hit.ped.state = 'down'; hit.ped.model.group.rotation.x = -Math.PI / 2; hit.ped.model.group.position.y = 0.3; }
          else hit.ped.state = 'flee';
        } else {
          hit.car.damage = clamp(hit.car.damage + 0.15, 0, 1);
        }
      }
      onShot?.(hit, bestT);
      return true;
    },
  };
}
