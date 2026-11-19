// Costa Serena — main.js
// Boot: renderer sinematik (ACES, bayangan PCFSoft, PMREM env prosedural),
// loop game, input, mesin state (judul → main → jeda → game over),
// dan mode screenshot deterministik ?shot=<scene>&seed=<n>.
import * as THREE from '../vendor/three.module.min.js';
import { CFG, mulberry32 } from './config.js';
import { makeTextures } from './textures.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createVehicle } from './vehicles.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createWeather } from './weather.js';
import { createSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || String(CFG.seed), 10);

// ---- event bus kecil ----
function makeEvents() {
  const h = {};
  return {
    on(name, fn) { (h[name] = h[name] || []).push(fn); },
    emit(name, data) { for (const fn of h[name] || []) { try { fn(data); } catch (e) { console.error(e); } } },
  };
}

const W = {
  rng: mulberry32(SEED),
  time: 0,
  state: 'title',           // title | playing | paused | over
  events: makeEvents(),
  playerCar: null,
  shotReady: false,
  errors: [],
};
window.addEventListener('error', (e) => W.errors.push(String(e.message)));

// ---- renderer ----
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('game').appendChild(renderer.domElement);
W.renderer = renderer;

const scene = new THREE.Scene();
W.scene = scene;
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1400);
camera.position.set(18, 6, -80);
W.camera = camera;

// ---- environment map prosedural (langit + matahari + pantulan tanah) ----
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const grad = new THREE.Mesh(
    new THREE.SphereGeometry(50, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9fc4de, side: THREE.BackSide }),
  );
  envScene.add(grad);
  const sunCard = new THREE.Mesh(new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
  sunCard.position.set(20, 28, -30);
  sunCard.lookAt(0, 0, 0);
  envScene.add(sunCard);
  const groundCard = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
    new THREE.MeshBasicMaterial({ color: 0x8a7a5a }));
  groundCard.rotation.x = -Math.PI / 2; groundCard.position.y = -12;
  envScene.add(groundCard);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
}

// ---- sistem ----
W.textures = makeTextures(W.rng);
W.save = createSave();
W.city = buildCity(W);
W.traffic = createTraffic(W);
W.pedestrians = createPedestrians(W);
W.player = createPlayer(W);
W.player.cash = W.save.data.cash ?? CFG.startCash;
W.police = createPolice(W);
W.combat = createCombat(W);
W.missions = createMissions(W);
W.hud = createHud(W);
W.audio = createAudio(W);
W.weather = createWeather(W);

// ---- event game ----
let shakeT = 0;
W.events.on('crash', (d) => {
  W.audio.crash(Math.min(1, (d.speed || 10) / 30));
  shakeT = Math.min(0.5, 0.25 + (d.speed || 0) * 0.008);
  W.missions.onCrash();
  if (W.state === 'playing') W.police.addHeat(0.15, 'tabrakan');
});
W.events.on('car-stolen', () => {
  // saksi: polisi dekat atau pejalan kaki dekat -> wanted naik
  let seen = false;
  for (const c of W.police.cops) if (Math.hypot(c.pos.x - W.player.pos.x, c.pos.z - W.player.pos.z) < 70) seen = true;
  for (const p of W.pedestrians.list) if (Math.hypot(p.pos.x - W.player.pos.x, p.pos.z - W.player.pos.z) < 14) seen = true;
  if (seen) W.police.addHeat(CFG.heatTheftSeen, 'pencurian mobil terlihat');
  W.pedestrians.panicAt(W.player.pos.x, W.player.pos.z, 14);
  W.audio.checkpoint();
});
W.events.on('player-hurt', () => { shakeT = Math.max(shakeT, 0.3); });
W.events.on('game-over', (d) => {
  if (W.state !== 'playing') return;
  W.state = 'over';
  W.audio.setSiren(false);
  W.hud.showOver(d.reason || 'Game over.',
    `Cash: $${Math.round(W.player.cash)} · Misi: ${W.missions.state.idx + 1}/5 · Wanted: ★${W.police.wanted}`);
});
W.events.on('shot', () => { shakeT = Math.max(shakeT, 0.06); });

// ---- input ----
const input = {
  forward: false, back: false, left: false, right: false,
  run: false, handbrake: false,
};
const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'handbrake',
};
addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyE' && W.state === 'playing') toggleCar();
  if (e.code === 'KeyN' && W.state === 'playing') W.missions.nextMission();
  if (e.code === 'KeyM') { W.audio.ensure(); const m = !W.audio.muted; W.audio.setMuted(m); W.save.data.muted = m; W.save.write(); W.hud.toast(m ? 'Suara bisu.' : 'Suara hidup.'); }
  if (e.code === 'KeyR' && W.state === 'playing') { const on = W.audio.toggleRadio(); W.hud.toast(on ? 'Radio: NYALA' : 'Radio: MATI'); }
  if (e.code === 'KeyP') togglePause();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false; });
let dragging = false, lastX = 0, lastY = 0, moved = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; moved = 0; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  W.player.camYaw -= dx * 0.005;
  W.player.camPitch = Math.max(0.05, Math.min(1.1, W.player.camPitch + dy * 0.004));
});
addEventListener('pointerup', (e) => {
  if (dragging && moved < 6 && W.state === 'playing' && W.player.onFoot) W.combat.shoot();
  dragging = false;
});
function toggleCar() {
  if (W.player.onFoot) {
    const car = W.traffic.nearestStealable(W.player.pos.x, W.player.pos.z, 4.5);
    if (car) W.player.enterCar(car);
    else W.hud.toast('Tidak ada mobil di dekatmu.', 'info');
  } else W.player.exitCar();
}
function togglePause() {
  if (W.state === 'playing') { W.state = 'paused'; W.hud.showPause(); }
  else if (W.state === 'paused') { W.state = 'playing'; W.hud.hidePause(); }
}
function startGame() {
  W.audio.ensure();
  if (W.save.data.muted) W.audio.setMuted(true);
  W.state = 'playing';
  document.getElementById('screen-title').classList.add('hidden');
  W.hud.setObjective('Tekan N untuk memulai misi pertama.', 'Jelajahi Costa Serena — curi mobil, cari uang.');
  W.hud.toast('Selamat datang di Costa Serena.', 'info');
}
document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);
function restart() {
  W.player.health = CFG.playerHealth;
  W.player.pos.set(0, 0, -102);
  W.player.heading = 0.4;
  if (W.player.car) { W.player.car.driver = 'parked'; W.player.car = null; W.playerCar = null; }
  W.player.group.visible = true;
  W.player.onFoot = true;
  W.police.clear();
  W.state = 'playing';
  document.getElementById('screen-over').classList.add('hidden');
  document.getElementById('screen-pause').classList.add('hidden');
  W.hud.setObjective('Tekan N untuk memulai misi.', '');
}
document.getElementById('btn-restart1').addEventListener('click', restart);
document.getElementById('btn-restart2').addEventListener('click', restart);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- update ----
const clock = new THREE.Clock();
function step(dt) {
  W.time += dt;
  W.weather.update(dt, W.time);
  W.city.update(dt, W.time);
  W.traffic.update(dt);
  W.pedestrians.update(dt, W.time);
  if (W.state === 'playing') {
    if (W.player.onFoot) W.player.update(dt, input, W.time);
    else if (W.player.car) {
      // mode screenshot: mobil tetap melaju supaya shot tidak diam (0 km/j)
      const driveInput = SHOT
        ? { forward: true, back: false, left: false, right: false, run: false, handbrake: false }
        : input;
      W.player.car.update(dt, driveInput);
      // mode screenshot: tahan kecepatan jelajah supaya tidak lari ke top speed
      if (SHOT && W.shotCruise) W.player.car.speed = Math.min(W.player.car.speed, W.shotCruise);
      // sinkron: posisi pemain = posisi mobil saat menyetir (polisi, misi,
      // minimap & jarak semuanya membaca W.player.pos)
      W.player.group.position.set(W.player.car.pos.x, 0, W.player.car.pos.z);
    }
    W.police.update(dt, W.time);
    W.combat.update(dt);
    W.missions.update(dt, W.time);
    W.audio.update(dt);
  }
  W.player.updateCamera(dt);
  if (shakeT > 0) {
    shakeT -= dt;
    camera.position.x += (Math.random() - 0.5) * shakeT * 0.5;
    camera.position.y += (Math.random() - 0.5) * shakeT * 0.5;
  }
  W.hud.update(dt);
}

// ---- mode screenshot deterministik ----
function setupShot(sceneName) {
  W.weather.auto = false;
  W.state = 'playing';
  document.getElementById('screen-title').classList.add('hidden');
  const putCar = (type, x, z, heading, speed) => {
    const car = createVehicle(W, type, x, z, heading, { driver: 'player' });
    car.speed = speed;
    W.player.enterCar(car);
    W.player.car = car;
    return car;
  };
  let simSteps = 180;
  if (sceneName === 'chase') {
    // kejaran polisi golden hour (matahari terbenam) + HUD lengkap
    W.weather.setTime(0.72); W.weather.setWeather('golden');
    W.shotCruise = 26;
    const car = putCar('sport', -40, 138, Math.PI / 2, 26);
    car.pos.set(-40, 0, 138);
    W.police.addHeat(2, 'shot');
    W.missions.startMission(1); // misi 2: kabur dari polisi
    W.hud.setObjective('Hilang dari kejaran polisi', '★ Bonus: kabur tanpa menabrak apa pun (+$200)');
    W.player.cash = 2450;
    W.player.health = 82;
    // biarkan polisi spawn, lalu susun komposisi: satu menghadang dari depan,
    // satu mengejar dari belakang-samping — keduanya masuk frame.
    for (let i = 0; i < 40; i++) step(1 / 60);
    const fwd = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
    const cops = W.police.cops;
    if (cops[0]) {
      // formasi kejaran: polisi memimpin 30 m di depan, tetap terlihat di frame
      cops[0].ai.paceAhead = 30;
      cops[0].pos.set(car.pos.x + fwd.x * 30, 0, car.pos.z + fwd.z * 30 - 3);
      cops[0].heading = car.heading;
      cops[0].speed = 26;
    }
    if (cops[1]) {
      cops[1].pos.set(car.pos.x - fwd.x * 13 + 5, 0, car.pos.z - fwd.z * 13);
      cops[1].heading = car.heading;
      cops[1].speed = 24;
    }
    simSteps = 40;
  } else if (sceneName === 'walk') {
    // jalan kaki pusat kota
    W.weather.setTime(0.3); W.weather.setWeather('golden');
    W.player.pos.set(9, 0, -8);
    W.player.heading = 2.4; W.player.camYaw = 2.4;
    W.player.cash = 120;
    W.hud.setObjective('Tekan N untuk memulai misi pertama.', 'Jelajahi Costa Serena — curi mobil, cari uang.');
  } else if (sceneName === 'coast') {
    // menyetir pesisir siang (matahari tinggi)
    W.weather.setTime(0.45); W.weather.setWeather('clear');
    W.shotCruise = 22;
    putCar('sedan', -120, 138, Math.PI / 2, 24);
    W.player.cash = 640;
    W.hud.setObjective('Balapan Pantai — lewati gerbang 1', '★ Bonus: finis di bawah 55 detik (+$250)');
    W.missions.state.active = false;
  } else if (sceneName === 'night') {
    // misi malam / hujan di marina — mobil di boulevard pesisir dekat marina
    W.weather.setTime(0.92); W.weather.setWeather('rain');
    W.shotCruise = 14;
    putCar('pickup', -30, 138, Math.PI / 2, 14);
    W.police.addHeat(1, 'shot');
    W.missions.startMission(3); // misi 4: kerja kapal
    W.hud.setObjective('Naik ke perahu di marina', '★ Bonus: kumpulkan 3 peti mengapung (+$180)');
    W.player.cash = 1980;
    W.player.health = 64;
    simSteps = 120;
  }
  // jalankan simulasi deterministik supaya dunia "hidup"
  for (let i = 0; i < simSteps; i++) step(1 / 60);
  // paksa render satu frame penuh lalu bekukan
  renderer.render(scene, camera);
  W.shotReady = true;
}

if (SHOT) {
  setupShot(SHOT);
} else {
  W.hud.showTitle();
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (!SHOT) step(dt);
  renderer.render(scene, camera);
}
loop();

// debug / test hooks
window.__costa = {
  W, input,
  get state() { return W.state; },
  get shotReady() { return W.shotReady; },
  get errors() { return W.errors; },
  startGame, restart, toggleCar,
  get wanted() { return W.police.wanted; },
  get cash() { return W.player.cash; },
  get health() { return W.player.health; },
  get missionIdx() { return W.missions.state.idx; },
  get missionActive() { return W.missions.state.active; },
};
