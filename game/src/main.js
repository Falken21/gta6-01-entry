// Costa Serena — main.js
// Boot, game loop, kamera sinematik third-person, state machine
// (title → playing → paused → game over → restart), dan mode screenshot
// deterministik ?shot=<scene>&seed=<n> untuk 4 screenshot.
// Rafi, mekanik kapal yang kakaknya berutang pada orang yang salah, harus
// menyelesaikan 5 misi melintasi kota pesisir Costa Serena.
import * as THREE from 'three';
import { CFG, clamp, lerp, makeRng } from './config.js';
import { buildTextures } from './textures.js';
import { buildCity, resolveColliders } from './city.js';
import { makeVehicle, driveVehicle } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { createPlayer, updatePlayerOnFoot, tryEnterVehicle, exitVehicle } from './player.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat, shoot, updateCombat } from './combat.js';
import { createMissions, updateMissions, maybeStartNextMission, startMission } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { createAudio } from './audio.js';
import { createWeather, updateWeather } from './weather.js';
import { loadSave, saveGameState } from './save.js';

const S = {
  scene: null, camera: null, renderer: null,
  now: 0, mode: 'title', timeOfDay: 17.4,
  vehicles: [], traffic: [], parked: [], peds: [], police: [],
  wanted: 0, player: null, playerVehicle: null,
  input: { forward: false, back: false, left: false, right: false, run: false, handbrake: false },
  danger: null, shot: null, seed: CFG.seed,
  camShake: 0, fovKick: 0,
};
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.getElementById('game-root').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 8, -14);
  S.renderer = renderer; S.scene = scene; S.camera = camera;
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function initInput() {
  const keymap = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (keymap[e.code] !== undefined) { S.input[keymap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyE') { if (S.mode === 'playing') (S.player.onFoot ? tryEnterVehicle(S) : exitVehicle(S)); }
    if (e.code === 'KeyF') { if (S.mode === 'playing') shoot(S, THREE); }
    if (e.code === 'KeyM') { S.audio.ensure(); S.audio.setMuted(!S.audio.muted); S.toast(S.audio.muted ? 'Suara mati (M untuk hidupkan)' : 'Suara hidup'); }
    if (e.code === 'Enter') {
      if (S.mode === 'title') startGame();
      else if (S.mode === 'playing' && S.missionState === 'idle' && !S.mission) startMission(S, S.missionIndex);
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (S.mode === 'playing') { S.mode = 'paused'; S.showScreen('pause'); }
      else if (S.mode === 'paused') { S.mode = 'playing'; S.showScreen(null); }
    }
    if (e.code === 'KeyR' && S.mode === 'over') restartGame();
  });
  window.addEventListener('keyup', (e) => {
    if (keymap[e.code] !== undefined) S.input[keymap[e.code]] = false;
  });
  // mouse: klik = tembak saat jalan kaki; drag = orbit kamera
  let dragging = false, lastX = 0, lastY = 0;
  S.renderer.domElement.addEventListener('mousedown', (e) => {
    S.audio.ensure();
    if (S.mode === 'playing' && S.player.onFoot) shoot(S, THREE);
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    S.player.camYaw -= (e.clientX - lastX) * 0.005;
    S.player.camPitch = clamp(S.player.camPitch + (e.clientY - lastY) * 0.003, 0.08, 1.1);
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  document.getElementById('btn-start').addEventListener('click', () => { S.audio.ensure(); S.audio.click(); startGame(); });
  document.getElementById('btn-resume').addEventListener('click', () => { S.mode = 'playing'; S.showScreen(null); });
  document.getElementById('btn-restart').addEventListener('click', () => restartGame());
  document.getElementById('btn-title').addEventListener('click', () => { S.mode = 'title'; S.showScreen('title'); });
}

function startGame() {
  S.mode = 'playing';
  S.showScreen(null);
  if (S.missionState === 'idle' && !S.mission && S.missionIndex === 0) startMission(S, 0);
  S.toast('Selamat datang di Costa Serena, Rafi. Ikuti penanda kuning!');
}

function restartGame() {
  const p = S.player;
  p.health = CFG.playerHealthMax;
  p.cash = Math.max(0, p.cash);
  if (p.vehicle) exitVehicle(S);
  p.x = S.spawns.player.x; p.z = S.spawns.player.z; p.angle = S.spawns.player.angle;
  p.mesh.visible = true;
  S.wanted = 0;
  S.mode = 'playing';
  S.showScreen(null);
  startMission(S, S.missionIndex);
}

S.gameOver = (msg) => {
  if (S.mode !== 'playing') return;
  S.mode = 'over';
  const t = document.getElementById('over-text');
  if (t) t.textContent = msg;
  S.showScreen('over');
  S.saveGame && S.saveGame();
};

S.setDanger = (x, z, radius, secs) => { S.danger = { x, z, radius, until: S.now + secs }; };
S.resolveColliders = (pos, r) => resolveColliders(S, pos, r);
S.onCollision = (strength) => {
  S.camShake = Math.min(0.6, S.camShake + strength / 40);
  if (S.mission) S.mission.hits = (S.mission.hits || 0) + 1;
  S.audio.collision(strength);
};
S.saveGame = () => saveGameState(S);

function updateCamera(dt) {
  const p = S.player;
  const v = S.playerVehicle;
  const target = v ? { x: v.x, z: v.z, angle: v.angle } : { x: p.x, z: p.z, angle: p.camYaw };
  // kamera mengikuti dari belakang: mobil memakai arah mobil, jalan kaki memakai orbit mouse
  const yaw = v ? v.angle + Math.PI : p.camYaw + Math.PI;
  const speed = v ? Math.abs(v.speed) : p.speed;
  const dist = v ? 10.5 : p.camDist;
  const height = v ? 4.2 : 3.4;
  const cx = target.x + Math.sin(yaw) * dist;
  const cz = target.z + Math.cos(yaw) * dist;
  const shakeX = (Math.random() - 0.5) * S.camShake;
  const shakeY = (Math.random() - 0.5) * S.camShake * 0.6;
  S.camShake = Math.max(0, S.camShake - dt * 1.4);
  const lookY = v ? 1.6 : 1.5;
  S.camera.position.x = lerp(S.camera.position.x, cx + shakeX, 1 - Math.exp(-6 * dt));
  S.camera.position.y = lerp(S.camera.position.y, height + shakeY, 1 - Math.exp(-6 * dt));
  S.camera.position.z = lerp(S.camera.position.z, cz + shakeX, 1 - Math.exp(-6 * dt));
  S.camera.lookAt(target.x, lookY, target.z);
  // FOV melebar sedikit dengan kecepatan — rasa laju
  const targetFov = 62 + clamp(speed / CFG.carMaxSpeed, 0, 1) * 9;
  if (Math.abs(S.camera.fov - targetFov) > 0.1) {
    S.camera.fov = lerp(S.camera.fov, targetFov, 1 - Math.exp(-3 * dt));
    S.camera.updateProjectionMatrix();
  }
  // arah pandang pemain jalan kaki mengikuti kamera
  if (!v) p.camYaw = ((p.camYaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function applyShotPreset() {
  const name = S.shot;
  const p = S.player;
  const takeCar = (kind, x, z, angle, colorHex) => {
    const v = makeVehicle(S, THREE, kind, x, z, angle, colorHex);
    p.onFoot = false; p.vehicle = v; v.isPlayer = true; S.playerVehicle = v;
    p.mesh.visible = false;
    return v;
  };
  if (name === 'chase') {
    S.timeOfDay = 17.0;
    // sport kuning cerah supaya terbaca di golden hour; di tengah jalan x=0
    takeCar('sport', 0, -20, 0, 0xffc020);
    S.playerVehicle.speed = 24;
    S.wanted = 3;
    // dua mobil polisi menghadang dari depan, mengarah ke pemain — terlihat di frame
    const p1 = makeVehicle(S, THREE, 'police', 5, 10, Math.PI);
    p1.speed = 22; p1.pursuitSide = 6;
    const p2 = makeVehicle(S, THREE, 'police', -5, 10, Math.PI);
    p2.speed = 20; p2.pursuitSide = -6;
    S.police.push(p1, p2);
    startMission(S, 0);
    S.camera.position.set(0, 5, -32);
  } else if (name === 'walk') {
    S.timeOfDay = 10.2;
    p.x = 6; p.z = 26; p.angle = Math.PI * 0.9; p.camYaw = Math.PI * 0.9;
    p.mesh.position.set(p.x, 0, p.z);
    S.camera.position.set(6, 4, 14);
  } else if (name === 'coast') {
    S.timeOfDay = 13.0;
    // tepat di jalan pesisir x=160 (bukan di pasir)
    takeCar('sedan', 160, 40, 0);
    S.playerVehicle.speed = 20;
    S.camera.position.set(160, 5, 29);
  } else if (name === 'night') {
    S.timeOfDay = 22.4;
    S.setWeather('rain');
    S.wet = 1; // jalan sudah basah sejak frame pertama
    // taksi kuning supaya mobil terbaca dalam gelap + hujan; di jalan z=160
    takeCar('taxi', 60, 160, Math.PI * 0.5);
    S.playerVehicle.speed = 16;
    S.wanted = 2;
    startMission(S, 3);
    S.camera.position.set(49, 5, 160);
  }
  S.mode = 'playing';
  S.showScreen(null);
  document.getElementById('hud').classList.remove('hidden');
}

function buildWorld() {
  const tex = buildTextures(THREE);
  buildCity(S, THREE, tex);
  spawnTraffic(S, THREE);
  spawnPedestrians(S, THREE, 26);
  createPlayer(S, THREE);
  createPolice(S);
  createCombat(S, THREE);
  createMissions(S, THREE);
  createHud(S);
  createAudio(S);
  createWeather(S, THREE);
  // mobil pemain di dekat spawn (parkir, bisa dicuri)
  const [cx, cz] = S.spawns.carRow[0];
  makeVehicle(S, THREE, 'sedan', cx, cz, Math.PI / 2).parked = true;
  makeVehicle(S, THREE, 'taxi', S.spawns.carRow[1][0], S.spawns.carRow[1][1], 0).parked = true;
  makeVehicle(S, THREE, 'pickup', S.spawns.carRow[2][0], S.spawns.carRow[2][1], Math.PI).parked = true;
  // pulihkan progres bila ada
  const save = loadSave();
  if (save) {
    S.player.cash = save.cash || 0;
    S.missionIndex = clamp(save.missionIndex || 0, 0, 4);
    if (S.audio) S.audio.setMuted(!!save.muted);
  }
}

let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  S.now += dt;
  const playing = S.mode === 'playing';
  if (playing || S.mode === 'title') {
    updateWeather(S, dt);
    updateTraffic(S, dt);
    updatePedestrians(S, dt);
  }
  if (playing) {
    if (S.player.onFoot) updatePlayerOnFoot(S, dt);
    else if (S.playerVehicle) driveVehicle(S, S.playerVehicle, dt, S.input);
    updatePolice(S, THREE, dt);
    updateCombat(S, dt);
    updateMissions(S, dt);
    maybeStartNextMission(S);
    const v = S.playerVehicle;
    S.audio.updateEngine(dt, v ? v.speed : 0, !!v);
    S.audio.updateRadio(dt, !!v);
    updateHud(S);
  }
  // status live untuk playtest otomatis (diperbarui tiap frame)
  window.__gameState = {
    mode: S.mode, wanted: Math.round(S.wanted * 10) / 10,
    mission: S.mission ? S.mission.name : null, cash: Math.floor(S.player.cash),
    onFoot: S.player.onFoot, speed: S.playerVehicle ? Math.round(Math.abs(S.playerVehicle.speed) * 3.6) : 0,
    health: Math.round(S.player.health), px: Math.round(S.player.x), pz: Math.round(S.player.z),
    errors: window.__errors,
  };
  updateCamera(dt);
  S.renderer.render(S.scene, S.camera);
  S.frames = (S.frames || 0) + 1;
  // siap screenshot setelah beberapa frame terrender (bukan S.now: di
  // software rendering tiap frame bisa lambat, dt dijepit 0.05/frame)
  if (!window.__shotReady && S.shot && S.frames >= 6) {
    window.__shotReady = true;
    window.__gameState = { mode: S.mode, wanted: S.wanted, mission: S.mission ? S.mission.name : null, cash: S.player.cash, errors: window.__errors };
  }
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    S.shot = shot;
    S.seed = parseInt(params.get('seed') || '7', 10) || 7;
  }
  initRenderer();
  initInput();
  buildWorld();
  if (S.shot) applyShotPreset();
  else S.showScreen('title');
  window.__gameState = { mode: S.mode, wanted: S.wanted, mission: S.mission ? S.mission.name : null, cash: S.player.cash, errors: window.__errors };
  requestAnimationFrame(loop);
}

boot();
