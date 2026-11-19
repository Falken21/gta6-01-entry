// Costa Serena — main.js
// One job: boot the game and run the loop. Renderer, input, state machine
// (title / playing / paused / game over), crime wiring, and the
// deterministic screenshot mode (?shot=<scene>&seed=<n>).
import * as THREE from 'three';
import { CFG, clamp, mulberry32 } from './config.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createWeather } from './weather.js';
import { loadSave, storeSave } from './save.js';
import { createCar, CAR_TYPES } from './vehicles.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || String(CFG.seed), 10) || CFG.seed;
const rng = mulberry32(SEED);

// ---- Renderer ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fb4dd);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(40, 30, 80);

// ---- World ----------------------------------------------------------------
const city = buildCity(scene, SEED);
const traffic = createTraffic(scene, city, SEED);
const peds = createPedestrians(scene, city, SEED);
const police = createPolice(scene, city, SEED);
const weather = createWeather(scene, city, SEED);
const missions = createMissions(scene, city);
const hud = createHud(city);
const audio = createAudio();
const combat = createCombat(scene, camera);
const player = createPlayer(scene, city.spawn, SEED);
const save = loadSave();
missions.state.cash = save.cash;
missions.state.unlocked = save.unlocked;
missions.state.completed = [...save.completed];
if (save.muted) audio.toggleMute();
if (!save.radio) audio.toggleRadio();

// ---- Game state ------------------------------------------------------------
const game = {
  state: 'title',        // title | playing | paused | gameover
  time: 0,
  crashCount: 0,
  danger: null,
  frozen: false,
  frames: 0,
  kills: 0,
};
let lastCash = missions.state.cash;

function persist() {
  storeSave({
    cash: missions.state.cash,
    unlocked: missions.state.unlocked,
    completed: missions.state.completed,
    bestTimes: save.bestTimes,
    muted: audio.muted,
    radio: audio.radioOn,
  });
}

function toastMission() {
  if (missions.state.message) {
    hud.showToast(missions.state.message);
    missions.state.message = '';
  }
}

// ---- Input -----------------------------------------------------------------
const keys = {};
let dragging = false, lastX = 0, lastY = 0, moved = 0;
addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  audio.unlock();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // Pause toggles from either state — it must be reachable while paused.
    if (game.state === 'playing' || game.state === 'paused') togglePause();
    return;
  }
  if (game.state !== 'playing') return;
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'KeyM') startNextMission();
  if (e.code === 'KeyT') missions.startTaxiFare(ctx());
  if (e.code === 'KeyU') missions.startPackage(ctx());
  if (e.code === 'KeyN') { const m = audio.toggleMute(); hud.showToast(m ? 'Suara mati' : 'Suara hidup'); persist(); }
  if (e.code === 'KeyR') { const r = audio.toggleRadio(); hud.showToast(r ? 'Radio: nyala' : 'Radio: mati'); persist(); }
  if (e.code === 'KeyF') shoot();
  if (e.code === 'KeyV') melee();
  if (e.code === 'Digit1') player.armed = false;
  if (e.code === 'Digit2') { player.armed = true; hud.showToast('Pistol siap — klik atau F untuk menembak'); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', (e) => {
  dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
  audio.unlock();
});
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  player.camYaw -= dx * 0.005;
  player.camPitch = clamp(player.camPitch + dy * 0.003, 0.08, 1.1);
});
addEventListener('pointerup', () => {
  if (dragging && moved < 6 && game.state === 'playing' && player.armed && !player.inCar) shoot();
  dragging = false;
});
canvas.addEventListener('wheel', (e) => {
  player.camDist = clamp(player.camDist + e.deltaY * 0.01, 4.5, 13);
}, { passive: true });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Context passed to systems ----------------------------------------------
function ctx() {
  return {
    time: game.time,
    player, playerCar: player.inCar, police, city,
    crashCount: game.crashCount,
    onCash: () => { persist(); },
    setNightMission: () => { weather.setHour(21.5); weather.setRain(0.8); },
  };
}

// ---- Actions ----------------------------------------------------------------
function tryEnterExitCar() {
  if (player.inCar) {
    player.exitCar();
    hud.showToast('Keluar dari mobil');
    return;
  }
  const car = traffic.nearestParked(player.pos.x, player.pos.z, 5);
  if (!car) return;
  const wasOccupied = car.occupied;
  car.occupied = false;
  player.enterCar(car);
  audio.click();
  if (wasOccupied) {
    game.danger = { x: car.pos.x, z: car.pos.z, radius: 26, kind: 'theft' };
    hud.showToast('Pengemudi kabur! Mobil ini milikmu sekarang.');
  }
  // Stealing seen by a witness or the police is a crime.
  const witness = peds.nearest(car.pos.x, car.pos.z, 16);
  if (witness || police.stars() > 0) {
    police.addCrime(1, car.pos.x, car.pos.z);
    hud.showToast('Ada yang melihatmu mencuri mobil! ★');
  }
}

function startNextMission() {
  if (missions.state.active) { hud.showToast('Selesaikan misi yang sedang berjalan dulu.'); return; }
  const idx = missions.state.unlocked;
  if (idx > missions.defs.length) { hud.showToast('Semua misi sudah selesai. Nikmati kotanya!'); return; }
  if (missions.startMission(idx, ctx())) {
    audio.pickup();
    toastMission();
  }
}

function shootTargets() {
  const list = [];
  for (const p of peds.peds) {
    if (p.state !== 'down') list.push({ pos: p.pos, radius: 0.9, ref: p, kind: 'ped' });
  }
  for (const c of traffic.allCars()) {
    if (c.driver !== 'player') list.push({ pos: c.pos, radius: 2.2, ref: c, kind: 'car' });
  }
  for (const c of police.cars) list.push({ pos: c.pos, radius: 2.2, ref: c, kind: 'cop' });
  return list;
}

function shoot() {
  if (player.inCar || !player.armed) return;
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const hit = combat.shoot(origin, dir, shootTargets(), (t) => {
    if (t.kind === 'ped') {
      const died = t.ref.hit(CFG.pistolDamage, player.pos.x, player.pos.z);
      if (died) { game.kills++; police.addCrime(1, t.pos.x, t.pos.z); }
      else police.addCrime(0.5, t.pos.x, t.pos.z);
    } else if (t.kind === 'cop') {
      t.ref.damage = Math.min(1, t.ref.damage + 0.25);
      police.addCrime(2, t.pos.x, t.pos.z);
      if (t.ref.damage >= 1) { t.ref.speed = 0; hud.showToast('Mobil polisi lumpuh!'); }
    } else if (t.kind === 'car') {
      t.ref.damage = Math.min(1, t.ref.damage + 0.2);
      police.addCrime(0.5, t.pos.x, t.pos.z);
    }
  });
  // Every shot is loud: peds panic and the law notices, hit or miss.
  audio.gunshot();
  game.danger = { x: player.pos.x, z: player.pos.z, radius: 30, kind: 'gunshot' };
  if (!hit) police.addCrime(0.25, player.pos.x, player.pos.z);
}

function melee() {
  if (player.inCar) return;
  const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  combat.melee(player.pos, dir, shootTargets(), (t) => {
    if (t.kind === 'ped') {
      const died = t.ref.hit(50, player.pos.x, player.pos.z);
      if (died) { game.kills++; police.addCrime(1, t.pos.x, t.pos.z); }
    }
  });
  audio.crash(0.2);
}

function togglePause() {
  if (game.state === 'playing') { game.state = 'paused'; hud.showPause(true); }
  else if (game.state === 'paused') { game.state = 'playing'; hud.showPause(false); }
}

function startGame() {
  audio.unlock();
  hud.hideTitle();
  hud.hideGameOver();
  game.state = 'playing';
  if (!missions.state.active && missions.state.unlocked === 1 && missions.state.completed.length === 0) {
    hud.showToast('Selamat datang di Costa Serena. Tekan M untuk misi pertama, E untuk mencuri mobil.');
  }
}

function gameOver() {
  game.state = 'gameover';
  missions.failMission('Rafi tumbang');
  hud.showGameOver(missions.state.cash, missions.state.completed.length);
  persist();
}

function restart() {
  player.reset(city.spawn);
  police.clearAll();
  missions.state.active = null;
  missions.hideBeacon();
  hud.hideGameOver();
  game.state = 'playing';
}

// Buttons
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('restart-btn').addEventListener('click', restart);
document.getElementById('over-restart-btn').addEventListener('click', restart);
document.getElementById('over-title-btn').addEventListener('click', () => {
  hud.hideGameOver();
  hud.showTitle();
  game.state = 'title';
});

// ---- Player car crash + ped collision ----------------------------------------
function wireCar(car) {
  car.onCrash = (speed) => {
    audio.crash(speed / 30);
    player.addShake(clamp(speed / 40, 0.1, 0.6));
    game.crashCount++;
    game.danger = { x: car.pos.x, z: car.pos.z, radius: 22, kind: 'crash' };
  };
}

// ---- Deterministic screenshot scenes ------------------------------------------
function setupShot(sceneName) {
  hud.hideTitle();
  game.state = 'playing';
  player.armed = true;
  const mkCar = (type, x, z, heading, colourOverride) => {
    const colour = colourOverride ?? CAR_TYPES[type].colours[0];
    const car = createCar(scene, type, x, z, heading, colour, rng);
    wireCar(car);
    return car;
  };
  if (sceneName === 'chase') {
    weather.setHour(17.6);
    weather.setRain(0);
    const car = mkCar('sport', 0, 44, Math.PI / 2, 0xe02030);
    car.speed = 24;
    player.enterCar(car);
    police.wanted = 3;
    missions.startMission(2, ctx());
    missions.state.active.stage = 1;
    missions.state.active.timer = 120;
    // a few traffic cars ahead for depth (far enough that the hero car,
    // accelerating through the settle frames, cannot reach them)
    const t1 = mkCar('sedan', 100, 44, Math.PI / 2); t1.speed = 10;
    const t2 = mkCar('taxi', 140, 40.9, Math.PI / 2); t2.speed = 11;
  } else if (sceneName === 'walk') {
    weather.setHour(10.2);
    weather.setRain(0);
    player.pos.set(44, 0, 44);
    player.heading = Math.PI * 0.75;
    player.camYaw = player.heading + Math.PI;
    // gather pedestrians around the boulevard for a living street
    peds.peds.slice(0, 8).forEach((p, i) => {
      p.pos.set(44 + (i % 4) * 5 - 8, 0, 44 + Math.floor(i / 4) * 6 - 4);
      p.target = { x: 44 + (i % 4) * 5 - 8, z: 44 + 20 };
    });
    const c1 = mkCar('sedan', 30, 50.9, 0); c1.speed = 8;
    const c2 = mkCar('hatch', 58, 37.1, Math.PI); c2.speed = 8;
  } else if (sceneName === 'coast') {
    weather.setHour(13.0);
    weather.setRain(0);
    const car = mkCar('sedan', -176, -40, 0);
    car.speed = 22;
    player.enterCar(car);
    const t1 = mkCar('pickup', -176, 90, 0); t1.speed = 12;
  } else if (sceneName === 'night') {
    weather.setHour(21.6);
    weather.setRain(0.85);
    // On the coastal road heading north, toward the marina — the road runs
    // north-south here, so heading 0 keeps the car on the road.
    const car = mkCar('sedan', -176, 20, 0);
    car.speed = 14;
    player.enterCar(car);
    police.wanted = 1;
    missions.startMission(5, ctx());
    missions.state.active.stage = 1;
    missions.state.active.timer = 180;
  }
}

// ---- Main loop ------------------------------------------------------------------
const clock = new THREE.Clock();
let attractAngle = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.frames++;
  if (game.state === 'title' && !SHOT) {
    attractAngle += dt * 0.05;
    camera.position.set(Math.sin(attractAngle) * 130, 55, Math.cos(attractAngle) * 130);
    camera.lookAt(0, 8, 0);
    weather.update(dt, { x: 0, z: 0 });
    traffic.update(dt);
    for (const p of peds.peds) p.update(dt, null);
    renderer.render(scene, camera);
    return;
  }
  if (game.state === 'paused' || game.state === 'gameover') {
    renderer.render(scene, camera);
    return;
  }
  if (game.frozen) {
    renderer.render(scene, camera);
    return;
  }
  game.time += dt;
  const c = ctx();

  // input → player
  const input = {
    forward: !!keys['KeyW'] || !!keys['ArrowUp'],
    back: !!keys['KeyS'] || !!keys['ArrowDown'],
    left: !!keys['KeyA'] || !!keys['ArrowLeft'],
    right: !!keys['KeyD'] || !!keys['ArrowRight'],
    run: !!keys['ShiftLeft'] || !!keys['ShiftRight'],
  };
  player.update(dt, input, city.colliders, camera);

  // driving input (in shot mode the car keeps its foot down, so the frozen
  // frame shows a chase/drive at speed instead of a car rolling to a stop)
  if (player.inCar) {
    const car = player.inCar;
    const throttle = SHOT ? 1 : (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) + (keys['KeyS'] || keys['ArrowDown'] ? -1 : 0);
    const steer = (keys['KeyA'] || keys['ArrowLeft'] ? -1 : 0) + (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
    const handbrake = !!keys['Space'];
    car.update(dt, { throttle, steer, handbrake }, city.colliders);
    // car-vs-car bumps with traffic + police
    for (const other of [...traffic.allCars(), ...police.cars]) {
      if (other === car) continue;
      const d = Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) / 2;
        const nx = (car.pos.x - other.pos.x) / d, nz = (car.pos.z - other.pos.z) / d;
        car.pos.x += nx * push; car.pos.z += nz * push;
        if (other.driver !== 'police' && other.driver !== 'player') {
          other.pos.x -= nx * push; other.pos.z -= nz * push;
        }
        if (Math.abs(car.speed) > 5) {
          car.damage = Math.min(1, car.damage + 0.03);
          other.damage = Math.min(1, (other.damage || 0) + 0.03);
          audio.crash(0.4);
          player.addShake(0.35);
          game.crashCount++;
          game.danger = { x: car.pos.x, z: car.pos.z, radius: 22, kind: 'crash' };
        }
        car.speed *= 0.85;
      }
    }
    // running over pedestrians
    for (const p of peds.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
      if (d < 2.1 && Math.abs(car.speed) > 3) {
        const died = p.hit(100, car.pos.x, car.pos.z);
        if (died) { police.addCrime(1, p.pos.x, p.pos.z); hud.showToast('Kamu menabrak pejalan kaki! ★'); }
        car.speed *= 0.7;
        player.addShake(0.3);
        game.danger = { x: car.pos.x, z: car.pos.z, radius: 26, kind: 'crash' };
      }
    }
  }

  traffic.update(dt, player.inCar, police.cars);
  for (const p of peds.peds) p.update(dt, game.danger);
  game.danger = null;
  police.update(dt, player, player.inCar, (strength) => {
    if (player.inCar) {
      player.inCar.damage = Math.min(1, player.inCar.damage + 0.02);
      player.addShake(0.3);
    } else if (player.damage(strength * 4)) {
      gameOver();
    }
  });
  // Chase shot: pin the pursuit alongside the player's car two frames
  // before the freeze, so the police are in the frame without blocking it.
  if (SHOT === 'chase' && game.frames === 58 && player.inCar) {
    police.cars.forEach((c, i) => {
      c.pos.set(player.inCar.pos.x - 9 - i * 3, 0, player.inCar.pos.z + (i % 2 ? 6.5 : -6.5));
      c.heading = Math.PI / 2;
      c.speed = 30;
    });
  }
  missions.update(dt, c);
  missions.updateSide(dt, c);
  toastMission();
  if (missions.state.cash !== lastCash) { lastCash = missions.state.cash; persist(); }
  weather.update(dt, player.inCar ? player.inCar.pos : player.pos);
  combat.update(dt);
  audio.update(dt, {
    inCar: !!player.inCar,
    speed: player.inCar ? player.inCar.speed : 0,
    topSpeed: CFG.carTopSpeed,
    wanted: police.stars(),
  });
  // palms sway, boats bob
  for (const palm of city.palms) {
    palm.userData.crown.rotation.z = Math.sin(game.time * 0.9 + palm.userData.phase) * 0.05;
  }
  for (const boat of city.boats) {
    boat.position.y = Math.sin(game.time * 0.7 + boat.userData.phase) * 0.14;
    boat.rotation.z = Math.sin(game.time * 0.5 + boat.userData.phase) * 0.02;
  }
  // night headlights for the player's car + traffic near the player
  const night = weather.state.nightFactor > 0.4;
  if (player.inCar) player.inCar.setNightLights(night);
  // HUD
  const target = missions.currentTarget()
    || (missions.state.side ? (missions.state.side.stage === 0 ? missions.state.side.pickup : missions.state.side.drop) : null);
  const focusPos = player.inCar ? player.inCar.pos : player.pos;
  hud.update(dt, {
    wanted: police.stars(),
    health: player.health,
    cash: missions.state.cash,
    objective: missions.objectiveText(),
    objectiveDist: target ? Math.hypot(focusPos.x - target.x, focusPos.z - target.z) : null,
    speed: player.inCar ? player.inCar.speed : 0,
    inCar: !!player.inCar,
    hour: weather.state.hour,
    playerPos: focusPos,
    heading: player.inCar ? player.inCar.heading : player.heading,
    playerCar: player.inCar,
    policeCars: police.cars,
    objectivePos: target,
  });
  // prompts
  if (!player.inCar) {
    const near = traffic.nearestParked(player.pos.x, player.pos.z, 5);
    hud.showPrompt(near ? 'Tekan E untuk mencuri mobil' : '');
  } else {
    hud.showPrompt('E — keluar  ·  Spasi — rem tangan  ·  2 — pistol  ·  M — misi');
  }
  // health regen out of combat, slowly
  if (police.stars() === 0 && player.health > 0 && player.health < CFG.playerHealth) {
    player.heal(dt * 1.5);
  }
  // car destroyed → on foot, badly hurt
  if (player.inCar && player.inCar.damage >= 1) {
    hud.showToast('Mobilmu hancur!');
    player.exitCar();
    player.damage(25);
  }
  if (player.health <= 0 && game.state === 'playing') gameOver();

  renderer.render(scene, camera);

  // ---- screenshot freeze -------------------------------------------------------
  if (SHOT && game.frames >= CFG.shotFrames && !game.frozen) {
    game.frozen = true;
    window.__shotReady = true;
  }
}

// wire crashes for every car at boot
for (const car of traffic.allCars()) wireCar(car);
for (const car of traffic.cars) wireCar(car);

if (SHOT) {
  setupShot(SHOT);
  // police cars for the chase shot are spawned by the wanted level; give the
  // loop a few frames to create them, then pin them behind the player.
  hud.hideTitle();
} else {
  hud.showTitle();
}

animate();
window.__gameReady = true;

// ---- Debug hooks for the scripted playtest (never used by the game) -----------
window.__costa = {
  game, player, police, missions, traffic, peds, city, weather,
  start: startGame,
  state: () => game.state,
  teleport(x, z) { player.pos.set(x, 0, z); if (player.inCar) { player.inCar.pos.set(x, 0, z); } },
  setWanted(n) { police.wanted = n; },
  giveCar(type = 'sedan') {
    const colour = CAR_TYPES[type].colours[0];
    const car = createCar(scene, type, player.pos.x + 3, player.pos.z, 0, colour, rng);
    wireCar(car);
    player.enterCar(car);
    return car;
  },
  damage(n) { return player.damage(n); },
  shoot,
  startMission: (i) => missions.startMission(i, ctx()),
};
