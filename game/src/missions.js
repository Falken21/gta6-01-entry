// Costa Serena — story missions (5-chapter chain) + repeatable side activities.
// Rafi, a boat mechanic, owes the wrong people money through his brother Dimas.
// Each mission: setup -> objective marker -> timer/checkpoint logic -> reward.
import * as THREE from 'three';
import { CFG, clamp, dist2D } from './config.js';

const MISSION_DEFS = [
  {
    id: 'm1', name: 'Utang Kakak', cash: 150,
    brief: 'Dimas berutang pada orang yang salah. Temui Marco di marina — dia yang mengatur semuanya.',
    objective: 'Pergi ke marina (penanda kuning)',
    target: { x: 132, z: 104 },
  },
  {
    id: 'm2', name: 'Paket Kilat', cash: 250,
    brief: 'Marco: "Antar paket ini ke Plaza Serena sebelum 90 detik. Jangan tanya isinya."',
    objective: 'Antar paket ke Plaza Serena sebelum waktu habis',
    target: { x: -20, z: 0 }, timer: 90,
  },
  {
    id: 'm3', name: 'Lolos dari Razia', cash: 400,
    brief: 'Polisi mengendusmu. Hilangkan bintang wanted-mu — sembunyi sampai mereka pergi.',
    objective: 'Hilangkan semua bintang wanted',
    wanted: 3, timer: 150,
  },
  {
    id: 'm4', name: 'Balapan Pesisir', cash: 600,
    brief: 'Balapan liar di jalan pesisir. Lewati 5 gerbang secepat mungkin.',
    objective: 'Lewati semua gerbang balapan',
    race: [[140, -100], [140, -40], [140, 20], [140, 80], [132, 104]], timer: 150,
  },
  {
    id: 'm5', name: 'Pelarian Terakhir', cash: 1000,
    brief: 'Kerjaan terakhir: bawa perahu dari marina ke lepas pantai. Setelah ini, utang lunas.',
    objective: 'Naik perahu di marina, lalu ke lepas pantai',
    target: { x: 132, z: 104 }, boat: true,
  },
];

export function createMissions(scene, save) {
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const markerGeo = new THREE.CylinderGeometry(2.2, 2.2, 5, 20, 1, true);
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.visible = false;
  scene.add(marker);
  const ringGeo = new THREE.RingGeometry(1.8, 2.6, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.visible = false;
  scene.add(ring);

  // side pickups (glowing parcels, +$50)
  const pickups = [];
  const pickupMat = new THREE.MeshStandardMaterial({ color: 0xffd21a, emissive: 0xaa7700, emissiveIntensity: 0.8 });
  const pickupGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  function spawnPickup(rng) {
    const x = CFG.roads.avenues[Math.floor(rng.next() * CFG.roads.avenues.length)] + 7;
    const z = CFG.roads.streets[Math.floor(rng.next() * CFG.roads.streets.length)] + 7;
    const m = new THREE.Mesh(pickupGeo, pickupMat);
    m.position.set(x, 0.6, z); m.castShadow = true;
    scene.add(m);
    pickups.push({ mesh: m, x, z, t: 0 });
  }

  let idx = save.mission ?? 0; // index of the current mission
  let state = 'idle'; // idle | active | done | failed
  let timer = 0;
  let raceStep = 0;
  let boatMode = false;
  let banner = null; // {text, sub, t} shown by HUD

  function current() { return MISSION_DEFS[idx] ?? null; }

  function setMarker(x, z) {
    marker.position.set(x, 3, z);
    ring.position.set(x, 0.08, z);
    marker.visible = true; ring.visible = true;
  }
  function hideMarker() { marker.visible = false; ring.visible = false; }

  function start(rng) {
    const m = current();
    if (!m) { state = 'done'; return null; }
    state = 'active';
    timer = m.timer ?? 0;
    raceStep = 0;
    boatMode = false;
    if (m.race) setMarker(m.race[0][0], m.race[0][1]);
    else if (m.target) setMarker(m.target.x, m.target.z);
    banner = { text: m.name, sub: m.brief, t: 6 };
    return m;
  }

  function complete(player, onDone) {
    const m = current();
    if (!m) return;
    player.cash += m.cash;
    idx += 1;
    state = 'done';
    hideMarker();
    banner = { text: `Misi selesai: ${m.name}`, sub: `+$${m.cash} — ${idx >= MISSION_DEFS.length ? 'Cerita tamat. Costa Serena milikmu.' : 'Misi berikutnya tersedia.'}`, t: 6 };
    onDone?.(m);
  }

  function fail(reason) {
    state = 'failed';
    hideMarker();
    banner = { text: 'Misi gagal', sub: reason, t: 5 };
  }

  function update(dt, G, rng) {
    marker.rotation.y += dt * 1.2;
    ring.rotation.z += dt * 0.8;
    if (banner) banner.t -= dt;
    for (const p of pickups) {
      p.t += dt;
      p.mesh.rotation.y += dt;
      p.mesh.position.y = 0.6 + Math.sin(p.t * 2.5) * 0.15;
    }
    // pickup collection
    const px = G.player.car ? G.player.car.pos.x : G.player.pos.x;
    const pz = G.player.car ? G.player.car.pos.z : G.player.pos.z;
    for (let i = pickups.length - 1; i >= 0; i--) {
      if (dist2D(px, pz, pickups[i].x, pickups[i].z) < 2.6) {
        G.player.cash += 50;
        scene.remove(pickups[i].mesh);
        pickups.splice(i, 1);
        G.hud?.flash(`+$50 paket`);
        spawnPickup(rng);
      }
    }
    if (state !== 'active') return;
    const m = current();
    if (!m) return;
    if (m.timer) {
      timer -= dt;
      if (timer <= 0) { fail('Waktu habis.'); return; }
    }
    if (m.race) {
      const [tx, tz] = m.race[raceStep];
      if (dist2D(px, pz, tx, tz) < 6) {
        raceStep += 1;
        if (raceStep >= m.race.length) { complete(G.player, G.onMissionDone); return; }
        setMarker(m.race[raceStep][0], m.race[raceStep][1]);
        G.hud?.flash(`Gerbang ${raceStep}/${m.race.length}`);
      }
      return;
    }
    if (m.wanted) {
      if (G.police.wanted === 0) { complete(G.player, G.onMissionDone); }
      return;
    }
    if (m.boat) {
      if (!boatMode) {
        if (dist2D(px, pz, m.target.x, m.target.z) < 6) {
          boatMode = true;
          banner = { text: 'Naik perahu!', sub: 'Turun dari mobil dan tekan E di samping perahu.', t: 5 };
          hideMarker();
          G.hud?.flash('Perahu siap');
        }
      }
      return;
    }
    if (m.target && dist2D(px, pz, m.target.x, m.target.z) < 6) {
      complete(G.player, G.onMissionDone);
    }
  }

  function reset(rng) {
    idx = 0; state = 'idle'; timer = 0; raceStep = 0; boatMode = false;
    hideMarker();
    for (const p of pickups) scene.remove(p.mesh);
    pickups.length = 0;
    for (let i = 0; i < 4; i++) spawnPickup(rng);
  }

  return {
    defs: MISSION_DEFS,
    pickups, spawnPickup,
    get index() { return idx; },
    get state() { return state; },
    get timer() { return timer; },
    get banner() { return banner; },
    get raceStep() { return raceStep; },
    get raceTotal() { const m = current(); return m?.race ? m.race.length : 0; },
    get boatMode() { return boatMode; },
    board(player, onDone) {
      if (!boatMode || current()?.id !== 'm5') return false;
      complete(player, onDone);
      return true;
    },
    current, start, complete, fail, update, reset,
    objectivePos() {
      if (!marker.visible) return null;
      return { x: marker.position.x, z: marker.position.z };
    },
  };
}
