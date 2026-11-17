// Costa Serena — boot, game loop, camera, input, states and screenshot mode.
// Third-person open-world crime game: Rafi the boat mechanic vs. the city.
import * as THREE from 'three';
import { CFG, makeRng, clamp, damp, lerp, dist2D } from './config.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer, updatePlayer, nearestCar, enterCar, exitCar } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createWeather } from './weather.js';
import { loadSave, writeSave } from './save.js';
import { createCar, updateCar } from './vehicles.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // chase | walk | coast | night
const SEED = parseInt(params.get('seed') || '', 10);
const AUTO = params.has('auto') || !!SHOT;
const GOD = params.has('god');

const rng = makeRng(Number.isFinite(SEED) ? SEED : CFG.seed);
const save = loadSave();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0xa8c4d8, 120, 420);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

const city = buildCity(scene, rng);
const traffic = createTraffic(scene, city, rng);
const peds = createPedestrians(scene, city, rng);
const weather = createWeather(scene, rng);
const audio = createAudio();
const hud = createHud();
const police = createPolice(scene, city, rng);
const combat = createCombat();
const missions = createMissions(scene, save);
const player = createPlayer(scene, rng, { x: -20, z: -30 });
player.cash = save.cash;
if (save.muted) audio.toggleMute();

const G = {
  scene, camera, renderer, city, traffic, peds, weather, audio, hud, police, combat, missions, player,
  state: 'title', // title | playing | paused | gameover | complete
  camYaw: Math.PI, camPitch: 0.32, camDist: 8.5,
  shake: 0, time: 0, frozen: false,
  gameOverReason: '', cinematic: null,
  flags: {},
  onMissionDone(m) {
    audio.success();
    save.mission = missions.index;
    save.cash = player.cash;
    writeSave(save);
    if (m.id === 'm5') {
      G.cinematic = { t: 5, boat: city.boats[0] };
      G.state = 'complete';
      showScreen('complete');
    }
    if (missions.index >= missions.defs.length) { /* story done, free roam */ }
  },
};
window.__game = G;

// ---- DOM screens ----
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  gameover: document.getElementById('screen-gameover'),
  complete: document.getElementById('screen-complete'),
};
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  document.getElementById('hud').classList.toggle('hidden', name === 'title');
}
function startGame(fresh) {
  audio.ensure();
  audio.click();
  if (fresh) {
    missions.reset(rng);
    player.cash = 0; player.health = CFG.player.health;
    save.mission = 0; save.cash = 0; writeSave(save);
    player.pos.set(-20, 0, -30); player.heading = 0;
    police.clearAll(scene);
  }
  G.state = 'playing';
  showScreen(null);
  hud.toast('WASD jalan • E masuk mobil • N mulai misi • M bisu');
}
document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-new').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => { G.state = 'playing'; showScreen(null); audio.click(); });
document.getElementById('btn-restart').addEventListener('click', () => { hideGameOver(); startGame(true); });
document.getElementById('btn-title').addEventListener('click', () => { G.state = 'title'; showScreen('title'); });
document.getElementById('btn-again').addEventListener('click', () => { hideGameOver(); startGame(true); });
document.getElementById('btn-continue').addEventListener('click', () => { G.state = 'playing'; showScreen(null); });
function hideGameOver() { screens.gameover.classList.add('hidden'); }

function gameOver(reason) {
  if (G.state !== 'playing') return;
  G.state = 'gameover';
  G.gameOverReason = reason;
  document.getElementById('gameover-title').textContent = reason === 'busted' ? 'TERTANGKAP!' : 'RAFI TUMBANG';
  document.getElementById('gameover-sub').textContent = reason === 'busted'
    ? 'Polisi menangkapmu di jalan. Costa Serena tidak memberi ampun.'
    : 'Rafi tidak selamat. Coba lagi — kota ini masih menunggumu.';
  audio.fail();
  showScreen('gameover');
}

// ---- input ----
const keys = {};
let mouseDown = false, lastX = 0, lastY = 0;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyM') { const m = audio.toggleMute(); save.muted = m; writeSave(save); hud.toast(m ? 'Suara mati' : 'Suara hidup'); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (G.state === 'playing') { G.state = 'paused'; showScreen('pause'); }
    else if (G.state === 'paused') { G.state = 'playing'; showScreen(null); }
  }
  if (G.state !== 'playing') return;
  if (e.code === 'KeyE') onInteract();
  if (e.code === 'KeyN') {
    if (missions.state === 'idle' || missions.state === 'failed' || missions.state === 'done') {
      const m = missions.start(rng);
      if (m) {
        if (m.wanted) police.setWanted(m.wanted, 'mission');
        audio.click();
        hud.toast(`Misi dimulai: ${m.name}`);
      }
    }
  }
  if (e.code === 'KeyF') {
    if (combat.punch(player, peds, police.cars, (hit) => {
      audio.punch();
      if (hit.kind === 'ped') police.addWanted(1, 'assault');
    })) { /* punched */ }
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('mousedown', (e) => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; audio.ensure(); });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  G.camYaw -= (e.clientX - lastX) * 0.005;
  G.camPitch = clamp(G.camPitch + (e.clientY - lastY) * 0.004, 0.05, 1.1);
  lastX = e.clientX; lastY = e.clientY;
});
renderer.domElement.addEventListener('click', () => {
  audio.ensure();
  if (G.state !== 'playing' || player.car || G.frozen) return;
  if (combat.shoot(player, camera, peds, police.cars, (hit) => {
    audio.shot();
    if (hit?.kind === 'police') police.addWanted(1, 'shot-cop');
    else if (hit?.kind === 'ped') police.addWanted(1, 'shot-ped');
    else if (hit) police.addWanted(0, '');
    // gunfire noise draws attention
    if (!hit) police.addWanted(0, '');
    for (const ped of peds.peds) peds.fleeFrom(ped, player.pos.x, player.pos.z);
  })) { /* shot fired */ }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function onInteract() {
  // board boat (mission 5 phase B)
  if (missions.boatMode && !player.car && dist2D(player.pos.x, player.pos.z, 132, 104) < 6) {
    if (missions.board(player, G.onMissionDone)) { hud.flash('Perahu berlayar!'); return; }
  }
  if (player.car) {
    exitCar(player);
    audio.click();
    return;
  }
  const car = nearestCar(player, [...traffic.cars, ...traffic.parked, ...police.cars]);
  if (car) {
    const wasPolice = car.driver === 'police';
    if (car.driver === 'traffic') {
      // driver bails out
      for (const ped of peds.peds) peds.fleeFrom(ped, car.pos.x, car.pos.z);
    }
    enterCar(player, car);
    audio.click();
    if (wasPolice || car.type === 'police') police.addWanted(2, 'stole-police-car');
    else police.addWanted(1, 'car-theft');
    hud.flash('Mobil dicuri!');
  }
}

// ---- camera ----
function updateCamera(dt) {
  const target = player.car ? player.car.pos : player.pos;
  const tx = target.x, tz = target.z;
  const ty = player.car ? 1.6 : 1.5;
  const dist = player.car ? 10.5 : 8.5;
  const cx = tx - Math.sin(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cz = tz - Math.cos(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cy = ty + Math.sin(G.camPitch) * dist;
  // keep the camera out of buildings: clamp inside AABBs by pulling closer
  let px = cx, pz = cz, py = Math.max(cy, 0.7);
  for (const box of city.colliders) {
    if (px > box.minX && px < box.maxX && pz > box.minZ && pz < box.maxZ && py < 30) {
      px = tx - Math.sin(G.camYaw) * 3; pz = tz - Math.cos(G.camYaw) * 3; py = Math.max(py, 2.2);
      break;
    }
  }
  camera.position.set(
    damp(camera.position.x, px, 12, dt) + (G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0),
    damp(camera.position.y, py, 12, dt) + (G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0),
    damp(camera.position.z, pz, 12, dt) + (G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0),
  );
  camera.lookAt(tx, ty, tz);
  // FOV widens with speed, shake decays
  const speed = player.car ? Math.abs(player.car.speed) : Math.abs(player.speed);
  const targetFov = 62 + clamp(speed / CFG.car.maxSpeed, 0, 1) * 12;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov = damp(camera.fov, targetFov, 4, dt);
    camera.updateProjectionMatrix();
  }
  G.shake = Math.max(0, G.shake - dt * 2.2);
}

// ---- per-frame update ----
function frame(dt) {
  G.time += dt;
  const focus = player.car ? player.car.pos : player.pos;
  const w = weather.update(dt, focus);
  city.update(dt, w.hour, w.rain, G.time);
  if (G.state === 'playing' && !G.frozen) {
    // player / driving
    const input = {
      f: !!keys.KeyW || !!keys.ArrowUp,
      b: !!keys.KeyS || !!keys.ArrowDown,
      l: !!keys.KeyA || !!keys.ArrowLeft,
      r: !!keys.KeyD || !!keys.ArrowRight,
      run: !!keys.ShiftLeft || !!keys.ShiftRight,
    };
    if (player.car) {
      const car = player.car;
      const throttle = input.f ? 1 : input.b ? -1 : 0;
      const steer = (input.l ? -1 : 0) + (input.r ? 1 : 0);
      const handbrake = !!keys.Space;
      const res = updateCar(car, { throttle, steer, handbrake }, dt, city.colliders, (s) => {
        audio.thud(s);
        G.shake = clamp(s * 0.03, 0, 0.6);
        if (s > 14 && !GOD) {
          player.health -= (s - 14) * 1.2;
          if (player.health <= 0) gameOver('wrecked');
        }
      });
      audio.engine(clamp(Math.abs(car.speed) / CFG.car.maxSpeed, 0, 1), true);
      // hitting a pedestrian while driving
      for (const ped of peds.peds) {
        if (ped.state === 'down') continue;
        if (dist2D(car.pos.x, car.pos.z, ped.pos.x, ped.pos.z) < 1.6 && Math.abs(car.speed) > 3) {
          ped.health = 0; ped.state = 'down';
          ped.model.group.rotation.x = -Math.PI / 2; ped.model.group.position.y = 0.3;
          police.addWanted(1, 'hit-ped');
          audio.thud(8);
          G.shake = 0.4;
        }
      }
    } else {
      updatePlayer(player, input, G.camYaw, dt, city, [...traffic.cars, ...traffic.parked], null, null);
      audio.engine(0, false);
      // on foot vs moving cars: run over
      for (const c of [...traffic.cars, ...police.cars]) {
        if (dist2D(c.pos.x, c.pos.z, player.pos.x, player.pos.z) < 1.8 && Math.abs(c.speed) > 5 && !GOD) {
          player.health -= 25;
          G.shake = 0.5;
          audio.thud(10);
          if (player.health <= 0) gameOver('wrecked');
        }
      }
    }
    // traffic + peds + police + combat + missions
    traffic.update(dt, player.car, police.cars);
    const danger = [];
    if (player.car && Math.abs(player.car.speed) > 6) danger.push({ x: player.car.pos.x, z: player.car.pos.z });
    for (const pc of police.cars) danger.push({ x: pc.pos.x, z: pc.pos.z });
    peds.update(dt, danger);
    police.update(dt, player, player.car, city,
      () => gameOver('busted'),
      (s) => { audio.thud(s); G.shake = Math.max(G.shake, clamp(s * 0.02, 0, 0.4)); });
    combat.update(dt);
    missions.update(dt, G, rng);
    // audio: siren distance
    let nearestPolice = 999;
    for (const pc of police.cars) nearestPolice = Math.min(nearestPolice, dist2D(pc.pos.x, pc.pos.z, focus.x, focus.z));
    audio.siren(police.sirenOn, nearestPolice);
    // car night lights
    const night = w.night;
    for (const c of [...traffic.cars, ...traffic.parked, ...police.cars]) c.model.setNight(night);
    if (player.car) player.car.model.setNight(night);
    // health regen (slow, out of combat)
    if (police.wanted === 0 && player.health > 0) player.health = Math.min(100, player.health + dt * 1.5);
    hud.update(dt, G);
  } else if (G.state === 'title') {
    // slow cinematic orbit over the city behind the title
    G.camYaw += dt * 0.03;
    camera.position.set(Math.sin(G.camYaw) * 120, 55, Math.cos(G.camYaw) * 120);
    camera.lookAt(0, 0, 20);
    traffic.update(dt, null, []);
    peds.update(dt, null);
    city.update(dt, w.hour, w.rain, G.time);
  }
  if (G.cinematic) {
    G.cinematic.t -= dt;
    const b = G.cinematic.boat;
    if (b) { b.position.x += dt * 6; b.position.z = 104; camera.lookAt(b.position.x, 2, b.position.z); }
    if (G.cinematic.t <= 0) G.cinematic = null;
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

// ---- deterministic screenshot scenes ----
function setupShot() {
  const cfg = CFG.shots[SHOT] || CFG.shots.chase;
  weather.setHour(cfg.hour);
  weather.setRain(cfg.rain);
  weather.update(0, { x: 0, z: 0 });
  G.state = 'playing';
  G.frozen = true;
  showScreen(null);
  document.getElementById('hud').classList.remove('hidden');
  const putCar = (x, z, heading, type = 'sedan') => {
    const car = createCar(type, x, z, heading, rng);
    car.driver = 'player';
    scene.add(car.model.group);
    return car;
  };
  if (SHOT === 'chase') {
    const car = putCar(140, -30, 0);
    enterCar(player, car);
    car.speed = 22;
    police.setWanted(3, 'shot');
    police.update(0.016, player, car, city, null, null);
    // two police cars close behind
    const p1 = createCar('police', 140, -52, 0, rng); p1.driver = 'police'; scene.add(p1.model.group); police.cars.push(p1);
    const p2 = createCar('police', 136, -58, 0.2, rng); p2.driver = 'police'; scene.add(p2.model.group); police.cars.push(p2);
    for (const pc of police.cars) pc.model.setNight(false);
    player.pos.set(140, 0, -30);
    G.camYaw = Math.PI; G.camPitch = 0.22;
    camera.position.set(140, 4.5, -52);
    missions.start(rng);
    hud.update(0.016, G);
  } else if (SHOT === 'walk') {
    player.pos.set(-20, 0, 8);
    player.heading = Math.PI * 0.9;
    player.model.group.position.set(-20, 0, 8);
    G.camYaw = Math.PI * 0.15; G.camPitch = 0.3;
    camera.position.set(-20, 5, -6);
    missions.start(rng);
    hud.update(0.016, G);
  } else if (SHOT === 'coast') {
    const car = putCar(140, 40, 0);
    enterCar(player, car);
    car.speed = 26;
    player.pos.set(140, 0, 40);
    G.camYaw = Math.PI; G.camPitch = 0.2;
    camera.position.set(140, 4.5, 18);
    missions.start(rng);
    hud.update(0.016, G);
  } else if (SHOT === 'night') {
    const car = putCar(132, 90, Math.PI / 2);
    enterCar(player, car);
    car.speed = 12;
    police.setWanted(2, 'shot');
    const p1 = createCar('police', 118, 90, Math.PI / 2, rng); p1.driver = 'police'; scene.add(p1.model.group); police.cars.push(p1);
    for (const pc of police.cars) pc.model.setNight(true);
    player.pos.set(132, 0, 90);
    G.camYaw = Math.PI * 0.5; G.camPitch = 0.24;
    camera.position.set(118, 4.5, 78);
    missions.start(rng);
    hud.update(0.016, G);
  }
  // one warm-up frame so shadows/water settle, then signal readiness
  frame(0.016);
  frame(0.016);
  window.__shotReady = true;
}

// ---- main loop ----
let last = performance.now();
function loop(now) {
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  try { frame(dt); } catch (err) { console.error(err); window.__gameError = String(err?.message || err); }
  requestAnimationFrame(loop);
}

if (SHOT) {
  setupShot();
  // keep rendering (water shimmer, light flicker) without advancing gameplay
  requestAnimationFrame(loop);
} else {
  showScreen('title');
  document.getElementById('title-continue').textContent =
    save.mission > 0 || save.cash > 0 ? `Lanjutkan — Misi ${save.mission + 1} • $${save.cash}` : 'Mulai Cerita Rafi';
  document.getElementById('btn-start').textContent = save.mission > 0 || save.cash > 0 ? 'Lanjutkan' : 'Mulai';
  requestAnimationFrame(loop);
}
window.__ready = true;
