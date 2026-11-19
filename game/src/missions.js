// Costa Serena — missions.js
// Rantai cerita 5 misi + pekerjaan sampingan (taksi, balap, paket kilat).
// Tiap misi: langkah checkpoint, timer, hadiah cash, dan OBJEKTIF SEKUNDER
// dengan bonus cash (paket kedua, kabur tanpa tabrakan, par time, peti,
// mobil utuh). Progres tersimpan antar sesi.
import * as THREE from '../vendor/three.module.min.js';
import { CFG, MISSIONS, SIDE_JOBS } from './config.js';

export function createMissions(W) {
  const state = {
    idx: W.save.data.missionIdx || 0,
    step: 0,
    active: false,
    timer: 0,
    secondaryDone: false,
    secondaryFailed: false,
    sideJob: null,          // {kind, from, to, timer, fare}
    cratesGot: 0,
    crashFree: true,
    startDamage: 0,
    raceStart: 0,
  };
  // penanda 3D: suar + panah melayang di checkpoint
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.55, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true), beaconMat);
  beacon.visible = false;
  W.scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  W.scene.add(ring);
  const crates = [];
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a5a28, roughness: 0.85 });

  function current() { return MISSIONS[state.idx] || null; }
  function currentStep() { const m = current(); return m ? m.steps[state.step] : null; }
  function stepPos(step) { return { x: step.at[0], z: step.at[1] }; }

  function startMission(i) {
    state.idx = i; state.step = 0; state.active = true;
    state.secondaryDone = false; state.secondaryFailed = false;
    state.cratesGot = 0; state.crashFree = true; state.startDamage = W.player.car ? W.player.car.damage : 0;
    const m = current();
    W.hud.toast(`MISI: ${m.title} — ${m.giver}`, 'info');
    W.hud.setObjective(m.steps[0].label, m.secondary ? m.secondary.label : '');
    W.audio.missionStart();
    updateBeacon();
  }
  function updateBeacon() {
    const step = currentStep();
    if (!state.active || !step || !step.at) { beacon.visible = false; ring.visible = false; return; }
    beacon.visible = true; ring.visible = true;
    beacon.position.set(step.at[0], 13, step.at[1]);
    ring.position.set(step.at[0], 0.1, step.at[1]);
  }
  function completeMission() {
    const m = current();
    let reward = m.reward;
    let bonus = 0;
    if (state.secondaryDone) bonus = m.secondary.reward;
    W.player.cash += reward + bonus;
    W.hud.toast(`MISI SELESAI: ${m.title} +$${reward}${bonus ? ` (bonus +$${bonus})` : ''}`, 'good');
    W.audio.missionDone();
    W.save.data.missionIdx = Math.min(MISSIONS.length - 1, state.idx + 1);
    W.save.data.cash = W.player.cash;
    W.save.write();
    state.active = false;
    beacon.visible = false; ring.visible = false;
    W.hud.setObjective('Misi selesai. Tekan N untuk misi berikutnya.', '');
    if (state.idx >= MISSIONS.length - 1) {
      W.hud.toast('CERITA TAMAT — Rafi bebas. Terima kasih sudah bermain!', 'good');
    }
  }
  function failMission(reason) {
    W.hud.toast(`MISI GAGAL: ${reason}`, 'bad');
    state.active = false;
    beacon.visible = false; ring.visible = false;
    W.hud.setObjective('Misi gagal. Tekan N untuk mengulang.', '');
  }
  function checkSecondary(step) {
    const m = current();
    if (!m || !m.secondary || state.secondaryDone) return;
    const s = m.secondary;
    if (s.noCrash && !state.crashFree) state.secondaryFailed = true;
    if (s.noDamage && W.player.car && W.player.car.damage > state.startDamage + 5) state.secondaryFailed = true;
  }
  function spawnCrates() {
    for (const c of crates) W.scene.remove(c.g);
    crates.length = 0;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), crateMat);
      g.position.set(-90 + i * 60 + (W.rng() - 0.5) * 20, 0.6, 185 + (W.rng() - 0.5) * 10);
      g.castShadow = true;
      W.scene.add(g);
      crates.push({ g, got: false });
    }
  }

  function update(dt, t) {
    // pekerjaan sampingan: taksi — penumpang menunggu di tepi jalan
    if (!state.sideJob && !state.active && W.rng() < dt * 0.02 && W.player.car) {
      startSideJob('taxi');
    }
    if (state.sideJob) updateSideJob(dt);
    if (!state.active) return;
    const m = current();
    const step = currentStep();
    if (!step) return;
    if (step.time && !state.timer) state.timer = step.time;
    if (state.timer) {
      state.timer -= dt;
      if (state.timer <= 0) { failMission('waktu habis'); return; }
    }
    // peti misi 4
    if (m.id === 'm4' && state.step === 1 && crates.length === 0) spawnCrates();
    for (const c of crates) {
      if (!c.got && Math.hypot(W.player.pos.x - c.g.position.x, W.player.pos.z - c.g.position.z) < 4) {
        c.got = true; c.g.visible = false;
        state.cratesGot++;
        W.hud.toast(`Peti ${state.cratesGot}/3 didapat!`, 'good');
        if (state.cratesGot >= 3) state.secondaryDone = true;
      }
    }
    const px = W.player.pos.x, pz = W.player.pos.z;
    if (step.kind === 'goto' || step.kind === 'race' || step.kind === 'boat') {
      const d = Math.hypot(px - step.at[0], pz - step.at[1]);
      W.hud.setObjectiveDistance(d);
      if (d < 5) {
        if (step.kind === 'boat' && state.step === 0) {
          // naik perahu: teleport ringan ke perahu & lanjut
          W.hud.toast('Naik perahu…', 'info');
        }
        if (m.id === 'm3' && state.step === 2 && state.raceStart) {
          const elapsed = t - state.raceStart;
          if (elapsed < 55) state.secondaryDone = true;
        }
        if (m.id === 'm3' && state.step === 0) state.raceStart = t;
        state.step++;
        checkSecondary(step);
        if (state.step >= m.steps.length) {
          if (m.secondary && m.secondary.noCrash && state.crashFree) state.secondaryDone = true;
          if (m.secondary && m.secondary.noDamage && W.player.car && W.player.car.damage <= state.startDamage + 5) state.secondaryDone = true;
          completeMission();
        } else {
          W.hud.setObjective(m.steps[state.step].label, m.secondary ? m.secondary.label : '');
          W.audio.checkpoint();
          updateBeacon();
        }
      }
    } else if (step.kind === 'escape') {
      if (step.heat && W.police.wanted < step.heat && !state.escArmed) {
        W.police.addHeat(step.heat, 'misi: ' + m.title);
        state.escArmed = true;
      }
      const hold = step.hold || 0;
      if (W.police.wanted === 0) {
        state.escapeT = (state.escapeT || 0) + dt;
        W.hud.setObjective(`Bersembunyi… ${Math.ceil(hold - (state.escapeT || 0))} dtk`, '');
        if ((state.escapeT || 0) >= hold) {
          state.step++;
          if (step.at) {
            // lanjut ke checkpoint akhir
            W.hud.setObjective(m.steps[state.step].label, '');
            updateBeacon();
          } else {
            if (m.secondary && m.secondary.noCrash && state.crashFree) state.secondaryDone = true;
            completeMission();
          }
        }
      } else { state.escapeT = 0; W.hud.setObjective(step.label, m.secondary ? m.secondary.label : ''); }
    }
    // animasi suar
    if (beacon.visible) {
      beacon.rotation.y += dt;
      beaconMat.opacity = 0.4 + Math.sin(t * 4) * 0.15;
      const s = 1 + Math.sin(t * 3) * 0.08;
      ring.scale.set(s, s, 1);
    }
  }

  function startSideJob(kind) {
    const px = W.player.pos.x, pz = W.player.pos.z;
    const ax = CFG.avenues[Math.floor(W.rng() * CFG.avenues.length)];
    const sz = CFG.streets[Math.floor(W.rng() * CFG.streets.length)];
    const dest = { x: ax + (W.rng() - 0.5) * 20, z: sz + (W.rng() - 0.5) * 20 };
    state.sideJob = { kind, to: dest, timer: 90 };
    W.hud.toast(`KERJA SAMPINGAN: ${SIDE_JOBS[kind].label} (+$${SIDE_JOBS[kind].reward})`, 'info');
    W.hud.setObjective(`${SIDE_JOBS[kind].label} — ke penanda kuning`, '');
    beacon.visible = true; ring.visible = true;
    beacon.position.set(dest.x, 13, dest.z);
    ring.position.set(dest.x, 0.1, dest.z);
  }
  function updateSideJob(dt) {
    const j = state.sideJob;
    j.timer -= dt;
    const d = Math.hypot(W.player.pos.x - j.to.x, W.player.pos.z - j.to.z);
    W.hud.setObjectiveDistance(d);
    if (d < 5) {
      W.player.cash += SIDE_JOBS[j.kind].reward;
      W.hud.toast(`Kerja sampingan selesai +$${SIDE_JOBS[j.kind].reward}`, 'good');
      state.sideJob = null;
      beacon.visible = false; ring.visible = false;
      if (!state.active) W.hud.setObjective('Tekan N untuk misi berikutnya.', '');
    } else if (j.timer <= 0) {
      W.hud.toast('Kerja sampingan dibatalkan (waktu habis).', 'bad');
      state.sideJob = null;
      beacon.visible = false; ring.visible = false;
    }
  }
  function nextMission() {
    if (state.active) return;
    const i = state.idx >= MISSIONS.length - 1 && W.save.data.missionIdx >= MISSIONS.length - 1
      ? MISSIONS.length - 1 : state.idx;
    startMission(i);
  }
  function onCrash() { state.crashFree = false; }

  return {
    state, current, currentStep, startMission, update, nextMission, onCrash,
    get objectivePos() {
      const s = currentStep();
      if (state.active && s && s.at) return { x: s.at[0], z: s.at[1] };
      if (state.sideJob) return state.sideJob.to;
      return null;
    },
  };
}
