// Costa Serena — missions.js
// One job: the story chain and side work. Five missions for Rafi, the boat
// mechanic whose brother owes the wrong people money — deliveries, escapes,
// a taxi shift, a coastal race, a night boat job — plus repeatable taxi
// fares, street races and package pickups. Every mission carries a
// SECONDARY objective: hit it and the payout grows by a bonus.
import * as THREE from 'three';
import { CFG, clamp } from './config.js';

const MISSION_DEFS = [
  {
    id: 1, name: 'Pengiriman Pertama', giver: 'Dario',
    brief: 'Bawa paket Dario ke gudang selatan. Jangan sampai rusak.',
    secondary: 'Tanpa goresan: antar tanpa merusak mobil',
    stages: [
      { type: 'goto', label: 'Ambil paket di bengkel Dario', x: 30, z: 88 },
      { type: 'goto', label: 'Antar paket ke gudang selatan', x: -20, z: -176, timer: 150 },
    ],
  },
  {
    id: 2, name: 'Pelarian Marina', giver: 'Dario',
    brief: 'Polisi mengendus. Kabur dari kejaran dan sampai ke rumah aman.',
    secondary: 'Sampai dalam 90 detik',
    stages: [
      { type: 'escape', label: 'Kabur! Hilangkan kejaran polisi', x: 132, z: -132, wanted: 2 },
      { type: 'goto', label: 'Sampai ke rumah aman', x: 132, z: -132, timer: 120 },
    ],
  },
  {
    id: 3, name: 'Taksi Kilat', giver: 'Mira',
    brief: 'Mira butuh sopir pengganti. Antar dua penumpang tepat waktu.',
    secondary: 'Tanpa tabrakan selama shift',
    stages: [
      { type: 'goto', label: 'Jemput penumpang di alun-alun', x: 88, z: 44 },
      { type: 'goto', label: 'Antar ke hotel pantai', x: -176, z: 132, timer: 120 },
      { type: 'goto', label: 'Jemput penumpang kedua di stasiun', x: -44, z: -44 },
      { type: 'goto', label: 'Antar ke marina', x: -176, z: 44, timer: 120 },
    ],
  },
  {
    id: 4, name: 'Balapan Pesisir', giver: 'Kiko',
    brief: 'Kiko menantangmu balapan menyusuri pesisir. Lewati semua gerbang.',
    secondary: 'Kalahkan 75 detik',
    stages: [
      { type: 'race', label: 'Gerbang 1: ujung boulevard', x: -176, z: -176, timer: 75 },
      { type: 'race', label: 'Gerbang 2: tanjakan marina', x: -176, z: 176 },
      { type: 'race', label: 'Gerbang 3: garis finis alun-alun', x: 44, z: 44 },
    ],
  },
  {
    id: 5, name: 'Pekerjaan Terakhir', giver: 'Dario',
    brief: 'Malam ini, hujan. Bawa perahu ke dermaga utara dan selesaikan utang kakakmu.',
    secondary: 'Tanpa bintang wanted saat penyerahan',
    stages: [
      { type: 'goto', label: 'Temui Dario di dermaga marina', x: -196, z: 40, night: true },
      { type: 'goto', label: 'Antar muatan ke dermaga utara', x: -196, z: -176, timer: 180 },
    ],
  },
];

export function createMissions(scene, city) {
  // Objective beacon: a glowing pillar the player can see across the city.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc400, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc400, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.4, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const state = {
    unlocked: 1,          // highest mission available (1-based)
    active: null,         // { def, stage, timer, startDamage, startTime, secondaryOk }
    cash: 0,
    completed: [],
    side: null,           // repeatable side job
    message: '',
  };

  function startMission(idx, ctx) {
    const def = MISSION_DEFS[idx - 1];
    if (!def) return false;
    state.active = {
      def, stage: 0, timer: def.stages[0].timer || 0,
      startDamage: ctx.playerCar ? ctx.playerCar.damage : 0,
      startTime: ctx.time,
      secondaryOk: true,
      elapsed: 0,
    };
    if (def.stages[0].wanted) ctx.police.wanted = Math.max(ctx.police.wanted, def.stages[0].wanted);
    placeBeacon(def.stages[0]);
    state.message = `Misi ${def.id}: ${def.name} — ${def.brief}`;
    return true;
  }

  function placeBeacon(stage) {
    beacon.position.set(stage.x, 15, stage.z);
    ring.position.set(stage.x, 0.06, stage.z);
    beacon.visible = true;
    ring.visible = true;
  }
  function hideBeacon() { beacon.visible = false; ring.visible = false; }

  function currentTarget() {
    if (!state.active) return null;
    const st = state.active.def.stages[state.active.stage];
    return st ? { x: st.x, z: st.z, label: st.label } : null;
  }

  function completeMission(ctx) {
    const a = state.active;
    const base = CFG.missionCash[a.def.id - 1];
    let bonus = 0;
    if (a.secondaryOk) bonus = CFG.secondaryBonus[a.def.id - 1];
    state.cash += base + bonus;
    state.completed.push(a.def.id);
    state.unlocked = Math.min(MISSION_DEFS.length, Math.max(state.unlocked, a.def.id + 1));
    state.message = bonus > 0
      ? `Misi selesai! +$${base} + bonus objektif sekunder $${bonus}`
      : `Misi selesai! +$${base}`;
    ctx.onCash?.(state.cash);
    state.active = null;
    hideBeacon();
  }

  function failMission(reason) {
    state.message = `Misi gagal: ${reason}`;
    state.active = null;
    hideBeacon();
  }

  function update(dt, ctx) {
    // beacon pulse
    if (beacon.visible) {
      beaconMat.opacity = 0.35 + 0.2 * Math.sin(ctx.time * 3);
      ring.scale.setScalar(1 + 0.12 * Math.sin(ctx.time * 3));
    }
    const a = state.active;
    if (!a) return;
    a.elapsed += dt;
    const stage = a.def.stages[a.stage];
    // secondary-objective watchers
    if (a.def.id === 1 && ctx.playerCar && ctx.playerCar.damage > a.startDamage + 0.05) a.secondaryOk = false;
    if (a.def.id === 2 && a.elapsed > 90 && a.stage === 1) a.secondaryOk = false;
    if (a.def.id === 3 && ctx.crashCount > 0) a.secondaryOk = false;
    if (a.def.id === 4 && a.elapsed > 75) a.secondaryOk = false;
    if (a.def.id === 5 && ctx.police.stars() > 0) a.secondaryOk = false;
    if (stage.timer) {
      a.timer -= dt;
      if (a.timer <= 0) { failMission('waktu habis'); return; }
    }
    const px = ctx.playerCar ? ctx.playerCar.pos.x : ctx.player.pos.x;
    const pz = ctx.playerCar ? ctx.playerCar.pos.z : ctx.player.pos.z;
    const dist = Math.hypot(px - stage.x, pz - stage.z);
    if (stage.type === 'escape') {
      // escape stage completes when wanted drops to zero
      if (ctx.police.stars() === 0) {
        a.stage++;
        if (a.stage >= a.def.stages.length) { completeMission(ctx); return; }
        const next = a.def.stages[a.stage];
        a.timer = next.timer || 0;
        placeBeacon(next);
        state.message = next.label;
      }
      return;
    }
    if (dist < 6) {
      a.stage++;
      if (a.stage >= a.def.stages.length) { completeMission(ctx); return; }
      const next = a.def.stages[a.stage];
      a.timer = next.timer || 0;
      placeBeacon(next);
      state.message = next.label;
      if (next.night) ctx.setNightMission?.();
    }
  }

  // ---- Side activities -----------------------------------------------------
  function startTaxiFare(ctx) {
    if (state.active || state.side) return false;
    const spots = [
      { x: 88, z: 44 }, { x: -44, z: -44 }, { x: 132, z: 88 },
      { x: -88, z: 132 }, { x: 44, z: -132 }, { x: -132, z: -88 },
    ];
    const pick = spots[Math.floor(Math.random() * spots.length)];
    const drop = spots[Math.floor(Math.random() * spots.length)];
    state.side = { kind: 'taxi', stage: 0, pickup: pick, drop, timer: 100, reward: 120 };
    placeBeacon({ x: pick.x, z: pick.z });
    state.message = 'Penumpang menunggu — jemput dia!';
    return true;
  }
  function startPackage(ctx) {
    if (state.active || state.side) return false;
    const spots = [
      { x: -88, z: 88 }, { x: 132, z: -44 }, { x: -44, z: 176 }, { x: 176, z: -88 },
    ];
    const p = spots[Math.floor(Math.random() * spots.length)];
    state.side = { kind: 'package', stage: 0, pickup: p, drop: null, timer: 90, reward: 90 };
    placeBeacon({ x: p.x, z: p.z });
    state.message = 'Paket menunggu diambil.';
    return true;
  }
  function updateSide(dt, ctx) {
    const s = state.side;
    if (!s) return;
    s.timer -= dt;
    if (s.timer <= 0) { state.message = 'Pekerjaan sampingan gagal: waktu habis.'; state.side = null; hideBeacon(); return; }
    const px = ctx.playerCar ? ctx.playerCar.pos.x : ctx.player.pos.x;
    const pz = ctx.playerCar ? ctx.playerCar.pos.z : ctx.player.pos.z;
    const target = s.stage === 0 ? s.pickup : s.drop;
    if (!target) return;
    if (Math.hypot(px - target.x, pz - target.z) < 6) {
      if (s.kind === 'taxi' && s.stage === 0) {
        s.stage = 1; s.timer = 110;
        placeBeacon({ x: s.drop.x, z: s.drop.z });
        state.message = 'Penumpang naik. Antar ke tujuan!';
      } else {
        state.cash += s.reward;
        state.message = `Pekerjaan selesai! +$${s.reward}`;
        ctx.onCash?.(state.cash);
        state.side = null;
        hideBeacon();
      }
    }
  }

  function objectiveText() {
    if (state.active) {
      const a = state.active;
      const st = a.def.stages[a.stage];
      const timer = st.timer ? ` — ${Math.ceil(a.timer)} dtk` : '';
      const sec = a.secondaryOk ? ` ★ Sekunder: ${a.def.secondary}` : '';
      return `${a.def.name}: ${st.label}${timer}${sec}`;
    }
    if (state.side) {
      const s = state.side;
      const t = s.stage === 0 ? s.pickup : s.drop;
      return `${s.kind === 'taxi' ? 'Taksi' : 'Paket'}: ${s.stage === 0 ? 'jemput' : 'antar'} (${Math.ceil(s.timer)} dtk)`;
    }
    const next = MISSION_DEFS[state.unlocked - 1];
    if (!next) return 'Semua misi selesai! Jelajahi kota — taksi (T) & paket (P) tersedia.';
    return `Misi ${next.id} tersedia: ${next.name} — tekan M untuk mulai`;
  }

  return {
    state, defs: MISSION_DEFS, startMission, completeMission, failMission,
    update, updateSide, currentTarget, objectiveText, startTaxiFare, startPackage,
    hideBeacon,
  };
}
