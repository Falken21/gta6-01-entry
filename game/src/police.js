// Costa Serena — police.js
// Wanted stars 1–5: crimes raise them, police cars spawn at the edges and
// pursue with ramming behaviour; breaking line of sight starts a cooldown,
// then stars drain. Heat also rises when a mission demands it.
import { Car } from './vehicles.js';
import { WANTED, clamp } from './config.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.stars = 0; this.heat = 0; // heat 0..5 fractional
    this.cars = [];
    this.cooldown = 0; this.spawnTimer = 0;
    this.onCrime = null; // callback(level, reason)
  }
  get level() { return Math.round(this.heat); }
  addCrime(amount, reason) {
    this.heat = clamp(this.heat + amount, 0, WANTED.maxStars);
    this.stars = this.level;
    this.cooldown = WANTED.decayDelay;
    if (this.onCrime) this.onCrime(this.level, reason);
  }
  setLevel(n) { this.heat = n; this.stars = n; this.cooldown = WANTED.decayDelay; }
  spawnCar(x, z) {
    const car = new Car(this.scene, 'police', 0xf2f2f2, x, z, 0);
    car.isPolice = true;
    this.cars.push(car);
    return car;
  }
  update(dt, t, targetPos, targetSpeed, losBlocked) {
    this.stars = this.level;
    const want = Math.min(this.level, 4);
    // spawn / despawn to match wanted level
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const a = Math.random() * Math.PI * 2;
      this.spawnCar(targetPos.x + Math.sin(a) * 70, targetPos.z + Math.cos(a) * 70);
    }
    if (this.cars.length > want) {
      const c = this.cars.pop(); c.dispose();
    }
    // cooldown: hide (line of sight blocked) and stars drain
    if (this.level > 0) {
      if (losBlocked) this.cooldown -= dt; else this.cooldown = WANTED.decayDelay;
      if (this.cooldown <= 0) this.heat = Math.max(0, this.heat - WANTED.decayRate * dt);
    }
    // pursuit: steer toward target, ram when close
    for (const car of this.cars) {
      const dx = targetPos.x - car.group.position.x, dz = targetPos.z - car.group.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.4, -1, 1);
      const throttle = d > 6 ? 1 : 0.6;
      car.update(dt, { throttle, steer, brake: d < 3.5 }, t);
      // ramming contact slows the target car (handled by main via distance check)
      car.ramDist = d;
    }
  }
  clear() {
    for (const c of this.cars) c.dispose();
    this.cars = []; this.heat = 0; this.stars = 0;
  }
  setNight(n) { for (const c of this.cars) c.setNight(n); }
}
