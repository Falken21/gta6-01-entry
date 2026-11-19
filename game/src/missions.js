// Costa Serena — missions.js
// Story chain (5 missions) + repeatable side activities (taxi fares, street
// races, package pickups). Checkpoints, timers, cash rewards, and a SECONDARY
// objective with bonus cash on every mission (Gemini critique fix).
// Progress + cash persist via save.js.
import { MISSIONS, dist2d } from './config.js';

const SPOTS = {
  marina: { x: -150, z: -140, label: 'Dermaga Marina' },
  hotel: { x: 60, z: -60, label: 'Hotel Riviera' },
  beach: { x: 40, z: 235, label: 'Pantai Serena' },
  warehouse: { x: -120, z: 120, label: 'Gudang Tua' },
  plaza: { x: 0, z: 0, label: 'Plaza Serena' },
  pier: { x: -150, z: -100, label: 'Kapal Pelarian' },
};

export class Missions {
  constructor(save, onEvent) {
    this.save = save; this.onEvent = onEvent; // (type, payload)
    this.index = save.data.missionIndex || 0;
    this.active = null; this.side = null;
    this.cash = save.data.cash || 0;
    this.marker = null;
  }
  get current() { return MISSIONS[Math.min(this.index, MISSIONS.length - 1)]; }
  get done() { return this.index >= MISSIONS.length; }
  start() {
    if (this.done) return null;
    const m = this.current;
    const targets = [SPOTS.marina, SPOTS.hotel, SPOTS.beach, SPOTS.warehouse, SPOTS.pier];
    this.active = {
      ...m, timeLeft: m.time, target: targets[m.id - 1],
      collisions: 0, elapsed: 0, maxWanted: 0, startHealth: 100,
    };
    if (this.onEvent) this.onEvent('mission-start', this.active);
    return this.active;
  }
  // side activities (repeatable, small cash)
  startSide(kind) {
    const defs = {
      taxi: { name: 'Taksi: antar penumpang', reward: 80, time: 90, target: SPOTS.hotel },
      race: { name: 'Balapan jalanan', reward: 150, time: 100, target: SPOTS.beach },
      package: { name: 'Paket kilat', reward: 60, time: 75, target: SPOTS.plaza },
    };
    this.side = { ...defs[kind], kind, timeLeft: defs[kind].time, elapsed: 0 };
    if (this.onEvent) this.onEvent('side-start', this.side);
    return this.side;
  }
  noteCollision() { if (this.active) this.active.collisions++; }
  update(dt, playerPos, wantedLevel, carHealth) {
    const tick = (job) => {
      if (!job) return null;
      job.timeLeft -= dt; job.elapsed += dt;
      if (job.maxWanted !== undefined) job.maxWanted = Math.max(job.maxWanted, wantedLevel);
      const d = dist2d(playerPos.x, playerPos.z, job.target.x, job.target.z);
      if (d < 7) return 'complete';
      if (job.timeLeft <= 0) return 'failed';
      return null;
    };
    let r = tick(this.active);
    if (r) {
      const job = this.active; this.active = null;
      if (r === 'complete') this.complete(job, playerPos);
      else if (this.onEvent) this.onEvent('mission-failed', job);
      return r;
    }
    r = tick(this.side);
    if (r) {
      const job = this.side; this.side = null;
      if (r === 'complete') {
        this.cash += job.reward; this.save.data.cash = this.cash; this.save.write();
        if (this.onEvent) this.onEvent('side-complete', job);
      } else if (this.onEvent) this.onEvent('side-failed', job);
      return r;
    }
    return null;
  }
  complete(job, playerPos) {
    let bonus = 0, bonusWhy = '';
    // secondary objective per mission
    if (job.id === 1 && job.collisions === 0) { bonus = job.secondaryReward; bonusWhy = job.secondary; }
    if (job.id === 2 && job.elapsed < job.time) { bonus = job.secondaryReward; bonusWhy = job.secondary; }
    if (job.id === 3 && job.elapsed <= 90) { bonus = job.secondaryReward; bonusWhy = job.secondary; }
    if (job.id === 4 && (job.maxWanted || 0) === 0) { bonus = job.secondaryReward; bonusWhy = job.secondary; }
    if (job.id === 5 && job.startHealth >= 60) { bonus = job.secondaryReward; bonusWhy = job.secondary; }
    this.cash += job.reward + bonus;
    this.index = Math.min(this.index + 1, MISSIONS.length);
    this.save.data.cash = this.cash; this.save.data.missionIndex = this.index; this.save.write();
    if (this.onEvent) this.onEvent('mission-complete', { ...job, bonus, bonusWhy, cash: this.cash, next: this.index });
  }
  distanceToTarget(playerPos) {
    const job = this.active || this.side;
    if (!job) return null;
    return { dist: dist2d(playerPos.x, playerPos.z, job.target.x, job.target.z), label: job.target.label, name: job.name, timeLeft: job.timeLeft };
  }
}
