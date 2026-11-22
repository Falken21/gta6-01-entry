// Costa Serena — missions.js
// Rantai cerita 5 misi Rafi + aktivitas sampingan yang bisa diulang (taksi,
// balap pantai, antar paket). Tiap misi punya objektif utama, penanda suar
// 3D, timer opsional, dan OBJEKTIF SEKUNDER dengan bonus cash: selesaikan
// tanpa kerusakan / di bawah waktu target.
import { CFG, clamp, dist2, makeRng } from './config.js';

const MISSIONS = [
  { id: 1, name: 'Misi 1 — Paket untuk Marina', text: 'Antar paket ke dermaga marina selatan. Curi mobil dulu bila perlu.', target: { x: 120, z: 190 }, radius: 9, reward: 400, secondary: 'Tanpa tabrakan', bonus: 150 },
  { id: 2, name: 'Misi 2 — Kabur dari Polisi', text: 'Polisi mengejarmu! Capai tempat persembunyian di barat kota.', target: { x: -150, z: -140 }, radius: 10, reward: 650, secondary: 'Lolos dengan wanted 3+', bonus: 200 },
  { id: 3, name: 'Misi 3 — Taksi Kilat', text: 'Antar 2 penumpang taksi sebelum waktu habis. Penumpang menunggu di halte.', target: { x: 40, z: -80 }, radius: 8, reward: 500, secondary: 'Di bawah 90 detik', bonus: 150, timer: 150 },
  { id: 4, name: 'Misi 4 — Balap Pantai', text: 'Balap menyusuri jalan pantai timur sampai garis finis.', target: { x: 150, z: -160 }, radius: 10, reward: 800, secondary: 'Di bawah 75 detik', bonus: 250, timer: 120 },
  { id: 5, name: 'Misi 5 — Pelarian Terakhir', text: 'Bawa perahu? Tidak — bawa mobil ke marina dan kabur dari kejaran terakhir.', target: { x: 96, z: 196 }, radius: 9, reward: 1500, secondary: 'Tanpa kerusakan mobil', bonus: 400 },
];

export function createMissions(S, THREE) {
  S.missions = MISSIONS;
  S.missionIndex = 0;
  S.mission = null;
  S.missionState = 'idle'; // idle | active | done
  S.side = { taxiDone: 0, racesWon: 0, packages: 0 };
  // penanda suar: silinder cahaya + cincin di tanah
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc020, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 42, 20, 1, true), beaconMat);
  beacon.visible = false;
  S.scene.add(beacon);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.5, 7, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc020, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  S.scene.add(ring);
  S.missionBeacon = beacon;
  S.missionRing = ring;
  S.startMission = (i) => startMission(S, i);
}

export function startMission(S, i) {
  const m = MISSIONS[i];
  if (!m) { S.missionState = 'done'; S.toast && S.toast('Semua misi selesai! Costa Serena milikmu, Rafi.'); return; }
  S.missionIndex = i;
  S.mission = { ...m, elapsed: 0, hits: 0, startedWanted: S.wanted };
  S.missionState = 'active';
  S.missionBeacon.visible = true;
  S.missionBeacon.position.set(m.target.x, 21, m.target.z);
  S.missionRing.visible = true;
  S.missionRing.position.set(m.target.x, 0.06, m.target.z);
  S.toast && S.toast(`${m.name}: ${m.text}`);
  if (i === 1) S.addWanted && S.addWanted(2, 'misi 2 dimulai');
  if (i === 4) S.addWanted && S.addWanted(2, 'pelarian terakhir');
}

export function updateMissions(S, dt) {
  if (S.missionState !== 'active' || !S.mission) return;
  const m = S.mission;
  m.elapsed += dt;
  const px = S.player.onFoot ? S.player.x : (S.playerVehicle ? S.playerVehicle.x : S.player.x);
  const pz = S.player.onFoot ? S.player.z : (S.playerVehicle ? S.playerVehicle.z : S.player.z);
  // denyut penanda
  const pulse = 0.5 + Math.sin(S.now * 4) * 0.3;
  S.missionBeacon.material.opacity = 0.22 + pulse * 0.2;
  S.missionRing.scale.setScalar(1 + Math.sin(S.now * 3) * 0.08);
  // misi 3: penumpang kedua muncul setelah sampai di halte pertama
  if (m.id === 3 && !m.stage2 && dist2(px, pz, m.target.x, m.target.z) < m.radius) {
    m.stage2 = true;
    m.target = { x: -120, z: 80 };
    m.radius = 8;
    S.missionBeacon.position.set(m.target.x, 21, m.target.z);
    S.missionRing.position.set(m.target.x, 0.06, m.target.z);
    S.toast && S.toast('Penumpang pertama diantar! Jemput penumpang kedua di barat kota.');
    return;
  }
  if (m.timer && m.elapsed > m.timer) {
    S.toast && S.toast('Waktu habis! Misi diulang dari awal.');
    startMission(S, S.missionIndex);
    return;
  }
  if (dist2(px, pz, m.target.x, m.target.z) < m.radius) completeMission(S);
}

function completeMission(S) {
  const m = S.mission;
  let bonus = 0, bonusText = '';
  // objektif sekunder + bonus cash
  if (m.id === 1 && m.hits === 0) { bonus = m.bonus; bonusText = 'Bonus tanpa tabrakan!'; }
  if (m.id === 2 && S.wanted >= 3) { bonus = m.bonus; bonusText = 'Bonus lolos dari kejaran besar!'; }
  if (m.id === 3 && m.elapsed < 90) { bonus = m.bonus; bonusText = 'Bonus taksi kilat!'; }
  if (m.id === 4 && m.elapsed < 75) { bonus = m.bonus; bonusText = 'Bonus balap pantai!'; }
  if (m.id === 5 && (!S.playerVehicle || S.playerVehicle.damage < 0.3)) { bonus = m.bonus; bonusText = 'Bonus mobil mulus!'; }
  const total = m.reward + bonus;
  S.player.cash += total;
  S.toast && S.toast(`Misi selesai! +$${total}${bonus ? ` (${bonusText} +$${bonus})` : ''}`);
  S.audio && S.audio.cash && S.audio.cash();
  S.missionBeacon.visible = false;
  S.missionRing.visible = false;
  S.missionState = 'idle';
  S.mission = null;
  S.saveGame && S.saveGame();
  // misi berikutnya otomatis dimulai setelah jeda singkat
  S._nextMissionAt = S.now + 2.5;
}

export function maybeStartNextMission(S) {
  if (S.missionState === 'idle' && S._nextMissionAt && S.now >= S._nextMissionAt) {
    S._nextMissionAt = 0;
    startMission(S, S.missionIndex + 1);
  }
}
