// Costa Serena — main.js
// Boot, title screen, game loop, pause, game-over/restart, deterministic
// screenshot mode (?shot=<scene>&seed=<n>), and all system wiring.
import * as THREE from '../vendor/three.module.min.js';
import { SEED, WORLD, MISSIONS, SHOT_SCENES, mulberry32, clamp, lerp } from './config.js';
import { City } from './city.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { Weather } from './weather.js';
import { Save } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED_PARAM = parseInt(params.get('seed') || String(SEED), 10) || SEED;

let renderer, scene, camera, clock;
let city, traffic, pedestrians, player, police, combat, missions, hud, audio, weather, save;
let keys = {};
let state = 'title'; // title | playing | paused | gameover | shot
let myCar = null;
let camPos = new THREE.Vector3(0, 8, 20), camLook = new THREE.Vector3();
let crashCooldown = 0, sirenTimer = 0, shotTimer = 0;
let shotDone = false;

function buildWorld() {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('app').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff9a4d);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
  clock = new THREE.Clock();

  save = new Save();
  city = new City(scene);
  traffic = new Traffic(scene, city);
  pedestrians = new Pedestrians(scene, city);
  player = new Player(scene, city);
  police = new Police(scene, city);
  audio = new AudioSys();
  weather = new Weather(scene, city);
  missions = new Missions(save, onMissionEvent);
  hud = new HUD();
  combat = new Combat(scene, city, pedestrians, police, audio);
  police.onCrime = (level, reason) => {
    hud.toast(`Wanted naik: ${'★'.repeat(level)} — ${reason}`);
    pedestrians.scare(player.x, player.z, 26);
  };
  traffic.setNight(false);

  // Rafi starts next to a parked car on the boulevard
  player.x = 10; player.z = 10;
  hud.toast('Costa Serena — tekan ENTER untuk mulai. WASD jalan, E curi mobil, M misi, F tembak.', 6);
  bindInput();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function onMissionEvent(type, payload) {
  if (type === 'mission-start') hud.toast(`Misi ${payload.id}: ${payload.name} — ${payload.brief} Sekunder: ${payload.secondary}`);
  if (type === 'mission-complete') {
    audio.cash();
    hud.toast(`Misi selesai! +$${payload.reward}${payload.bonus ? ` + bonus $${payload.bonus} (${payload.bonusWhy})` : ''} — Kas $${payload.cash}`);
    if (payload.next >= MISSIONS.length) hud.toast('Semua misi selesai! Rafi bebas. Terima kasih sudah bermain Costa Serena.', 6);
  }
  if (type === 'mission-failed') hud.toast(`Misi gagal: ${payload.name} — tekan M untuk coba lagi.`);
  if (type === 'side-complete') { audio.cash(); hud.toast(`Kegiatan selesai: +$${payload.reward}`); }
  if (type === 'side-start') hud.toast(`${payload.name} — sampai tujuan sebelum waktu habis!`);
}

function bindInput() {
  addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Enter' && state === 'title') startGame();
    if (e.key === 'Enter' && state === 'gameover') restart();
    if ((e.key === 'p' || e.key === 'Escape') && (state === 'playing' || state === 'paused')) togglePause();
    if (e.key === 'm' || e.key === 'M') {
      if (state === 'playing') {
        if (!missions.active && !missions.done) missions.start();
        else if (missions.done) hud.toast('Semua misi cerita selesai — coba kegiatan sampingan: tekan 1 taksi, 2 balapan, 3 paket.');
        else hud.toast('Misi sedang berjalan — ikuti penanda kuning di minimap.');
      }
      audio.ensure();
    }
    if (e.key === '1' && state === 'playing') missions.startSide('taxi');
    if (e.key === '2' && state === 'playing') missions.startSide('race');
    if (e.key === '3' && state === 'playing') missions.startSide('package');
    if (e.key === 'e' || e.key === 'E') tryEnterExitCar();
    if (e.key === 'f' || e.key === 'F') tryShoot();
    if (e.key === 'r' || e.key === 'R') {
      if (myCar) hud.toast('Radio: ' + audio.radioNextStation());
    }
    if (e.key === 'n' || e.key === 'N') { audio.ensure(); hud.toast(audio.toggleMute() ? 'Suara dimatikan (M untuk bunyi lagi: tekan N)' : 'Suara menyala'); }
    if (e.key === ' ') { e.preventDefault(); if (state === 'playing') combat.melee({ x: player.x, z: player.z }); }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  addEventListener('mousedown', (e) => {
    audio.ensure();
    if (state === 'title') startGame();
    else if (e.button === 0 && state === 'playing') tryShoot();
  });
  addEventListener('mousemove', (e) => {
    if (state !== 'playing' || myCar) return;
    if (e.buttons === 1 || e.movementX) { player.camYaw -= e.movementX * 0.003; player.camPitch = clamp(player.camPitch + e.movementY * 0.002, 0.12, 1.1); }
  });
  document.getElementById('title').addEventListener('click', () => { audio.ensure(); startGame(); });
  document.getElementById('pause').addEventListener('click', () => togglePause());
  document.getElementById('gameover').addEventListener('click', () => restart());
}

function startGame() {
  audio.ensure(); audio.click();
  state = 'playing';
  hud.hideOverlay('title'); hud.hideOverlay('pause'); hud.hideOverlay('gameover');
  if (!missions.active && !missions.done) missions.start();
  hud.toast('Misi 1: antar paket ke marina! Ikuti penanda kuning.', 4);
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    hud.showOverlay('pause', '<h1>JEDA</h1><p>Tekan P / Esc atau klik untuk lanjut.</p><p>WASD gerak · Shift lari · E masuk/keluar mobil · F tembak · Spasi pukul · R ganti radio · N bisu</p>');
  } else if (state === 'paused') {
    state = 'playing'; hud.hideOverlay('pause');
  }
}

function restart() {
  location.reload();
}

function tryEnterExitCar() {
  if (state !== 'playing') return;
  audio.ensure();
  if (myCar) {
    // exit: step out beside the car
    const c = myCar; myCar = null; player.inCar = null;
    player.x = c.group.position.x + Math.cos(c.heading) * 3;
    player.z = c.group.position.z - Math.sin(c.heading) * 3;
    player.group.position.set(player.x, 0, player.z);
    audio.radioToggle(false);
    return;
  }
  const car = traffic.nearestStealable(player.x, player.z, 4.5);
  if (!car) { hud.toast('Tidak ada mobil di dekatmu.'); return; }
  // steal: driver flees, wanted rises if police nearby / witnessed
  const wasParked = traffic.parked.includes(car);
  if (!wasParked) {
    const idx = traffic.cars.indexOf(car);
    if (idx >= 0) traffic.cars.splice(idx, 1);
    pedestrians.scare(car.group.position.x, car.group.position.z, 14);
    police.addCrime(1, 'pencurian mobil terlihat');
  }
  const pi = traffic.parked.indexOf(car);
  if (pi >= 0) traffic.parked.splice(pi, 1);
  myCar = car; player.inCar = car; car.driven = true;
  audio.click(); audio.radioToggle(true);
  hud.toast(wasParked ? 'Mobil diambil. WASD menyetir, Spasi rem tangan.' : 'Mobil dicuri! Polisi mengejarmu!');
}

function tryShoot() {
  if (state !== 'playing' || myCar) return;
  audio.ensure();
  const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const origin = new THREE.Vector3(player.x, 1.4, player.z);
  combat.shoot(origin, dir, { x: player.x, z: player.z });
}

function carCollisions(dt) {
  if (!myCar) return;
  crashCooldown -= dt;
  const p = myCar.group.position;
  const hit = city.collide(p.x, p.z, 2.2);
  if (hit) {
    // push back out of the building, bleed speed, damage
    myCar.speed *= -0.35;
    myCar.group.position.x -= Math.sin(myCar.heading) * 1.2;
    myCar.group.position.z -= Math.cos(myCar.heading) * 1.2;
    if (crashCooldown <= 0) {
      crashCooldown = 0.8; myCar.damage(8); missions.noteCollision();
      audio.crash(); pedestrians.scare(p.x, p.z, 20);
      police.addCrime(0.5, 'tabrakan');
      shake(0.35);
    }
  }
  // ram into traffic / police
  for (const other of [...traffic.cars, ...police.cars]) {
    const d = Math.hypot(other.group.position.x - p.x, other.group.position.z - p.z);
    if (d < 3.4 && crashCooldown <= 0) {
      crashCooldown = 0.8; myCar.damage(6); other.damage(10);
      myCar.speed *= 0.5; audio.crash(); missions.noteCollision();
      pedestrians.scare(p.x, p.z, 22);
      if (other.isPolice) police.addCrime(1, 'menabrak polisi');
      shake(0.4);
    }
  }
  // police ramming the player
  for (const pc of police.cars) {
    if (pc.ramDist !== undefined && pc.ramDist < 3.2 && crashCooldown <= 0) {
      crashCooldown = 1; myCar.damage(5); audio.crash(); shake(0.3);
    }
  }
  if (p.x > 268 || p.x < -268 || p.z > 268 || p.z < -268) {
    myCar.speed *= 0.9;
    myCar.group.position.x = clamp(p.x, -268, 268);
    myCar.group.position.z = clamp(p.z, -268, 268);
  }
}

let shakeAmt = 0;
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

function updateCamera(dt, t) {
  const target = myCar ? myCar.group.position : player.lookAt();
  let desired, look;
  if (myCar) {
    const h = myCar.heading;
    const back = 11 + Math.abs(myCar.speed) * 0.12;
    desired = new THREE.Vector3(
      myCar.group.position.x - Math.sin(h) * back,
      5.2 + Math.abs(myCar.speed) * 0.04,
      myCar.group.position.z - Math.cos(h) * back);
    look = new THREE.Vector3(myCar.group.position.x + Math.sin(h) * 8, 1.8, myCar.group.position.z + Math.cos(h) * 8);
    const fovT = 62 + clamp(Math.abs(myCar.speed) / 38, 0, 1) * 10;
    camera.fov = lerp(camera.fov, fovT, 1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();
  } else {
    desired = player.cameraTarget(new THREE.Vector3());
    look = player.lookAt();
  }
  // lag behind acceleration + shake on collisions
  camPos.lerp(desired, 1 - Math.exp(-6 * dt));
  camLook.lerp(look, 1 - Math.exp(-8 * dt));
  const sh = shakeAmt;
  camera.position.set(
    camPos.x + (Math.random() - 0.5) * sh,
    Math.max(1.2, camPos.y + (Math.random() - 0.5) * sh),
    camPos.z + (Math.random() - 0.5) * sh);
  camera.lookAt(camLook);
  shakeAmt = Math.max(0, shakeAmt - dt * 1.4);
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (state === 'shot') { renderShot(t); return; }
  if (state !== 'playing') { renderer.render(scene, camera); return; }
  // input -> car
  let carInput = null;
  if (myCar) {
    carInput = {
      throttle: (keys['w'] || keys['arrowup'] ? 1 : 0) + (keys['s'] || keys['arrowdown'] ? -1 : 0),
      steer: (keys['a'] || keys['arrowleft'] ? -1 : 0) + (keys['d'] || keys['arrowright'] ? 1 : 0),
      brake: !!keys['s'] && myCar.speed > 1,
      handbrake: !!keys[' '],
    };
    // steering follows camera-relative? No — car-relative, standard.
    myCar.update(dt, carInput, t);
    carCollisions(dt);
    audio.setEngine(clamp(Math.abs(myCar.speed) / 38, 0, 1), true);
    audio.radioUpdate(true);
    player.x = myCar.group.position.x; player.z = myCar.group.position.z;
  } else {
    player.update(dt, keys, t);
    audio.setEngine(0, false);
  }
  // day cycle drifts slowly; rain comes and goes
  weather.setTimeOfDay(17.4 + t * 0.002);
  if (Math.sin(t * 0.05) > 0.86 && !weather.raining) weather.setRain(0.7);
  if (Math.sin(t * 0.05) < 0.4 && weather.raining) weather.setRain(0);
  const focus = myCar ? myCar.group.position : player.group.position;
  weather.update(dt, t, focus);
  city.update(t, dt);
  traffic.update(dt, t, myCar, police.cars);
  pedestrians.update(dt, t);
  combat.update(dt);
  // line of sight: police lose you behind buildings
  const losBlocked = !!city.collide((player.x + focus.x) / 2, (player.z + focus.z) / 2, 1);
  police.update(dt, t, { x: player.x, z: player.z }, myCar ? Math.abs(myCar.speed) : 0, losBlocked && police.level > 0);
  // mission 5 forces wanted 3
  if (missions.active && missions.active.id === 5 && police.level < 3) police.setLevel(3);
  const job = missions.distanceToTarget({ x: player.x, z: player.z });
  const res = missions.update(dt, { x: player.x, z: player.z }, police.level, myCar ? myCar.health : 100);
  if (res === 'complete' && missions.active) { /* handled in event */ }
  // siren ambience while wanted
  sirenTimer -= dt;
  if (police.level > 0 && sirenTimer <= 0) { sirenTimer = 0.9; audio.sirenTick(true); }
  // health / game over
  if (myCar && myCar.health <= 0) {
    state = 'gameover';
    hud.showOverlay('gameover', '<h1>MOBIL HANCUR</h1><p>Rafi selamat, tapi mobilnya ringsek. Klik atau tekan Enter untuk mulai lagi.</p>');
  }
  if (player.health <= 0) {
    state = 'gameover';
    hud.showOverlay('gameover', '<h1>GAME OVER</h1><p>Rafi tumbang. Klik atau tekan Enter untuk coba lagi.</p>');
  }
  traffic.setNight(weather.isNight());
  police.setNight(weather.isNight());
  hud.update(dt, {
    stars: police.level, health: myCar ? myCar.health : player.health,
    cash: missions.cash, objective: job, speedKmh: myCar ? Math.abs(myCar.speed) * 3.6 : 0,
    player: { x: player.x, z: player.z, heading: myCar ? myCar.heading : player.heading },
    police: police.cars.map((c) => ({ x: c.group.position.x, z: c.group.position.z })),
    target: job ? { x: missions.active?.target.x ?? missions.side?.target.x ?? 0, z: missions.active?.target.z ?? missions.side?.target.z ?? 0 } : null,
  });
  updateCamera(dt, t);
  renderer.render(scene, camera);
}

// ---- deterministic screenshot mode ----
function setupShot() {
  state = 'shot';
  hud.hideOverlay('title');
  hud.msgTimer = 0; hud.msgEl.style.opacity = 0; // no toast in frozen shots
  const r = mulberry32(SEED_PARAM);
  // compose the scene per shot — cameras use the same chase-cam math as gameplay
  // (behind the subject, on the open road) so no building blocks the frame.
  if (SHOT === 'chase') {
    weather.setTimeOfDay(17.5); weather.setRain(0);
    const car = traffic.parked[0] || traffic.cars[0];
    myCar = car; player.inCar = car; car.driven = true; car.speed = 22;
    car.group.position.set(0, 0, 60); car.heading = 0; car.group.rotation.y = 0;
    player.x = 0; player.z = 60;
    police.setLevel(3);
    police.spawnCar(-4, 48); police.spawnCar(5, 44);
    for (const pc of police.cars) { pc.group.position.y = 0; }
    missions.cash = 1250; missions.active = { ...MISSIONS[0], timeLeft: 118, target: { x: -150, z: -140, label: 'Dermaga Marina' } };
    camera.position.set(0, 5.2, 49); camera.lookAt(0, 1.8, 68);
  } else if (SHOT === 'walk') {
    weather.setTimeOfDay(10.5); weather.setRain(0);
    player.x = 0; player.z = 30; player.heading = 0; player.camYaw = 0; player.camPitch = 0.42;
    player.group.position.set(0, 0, 30); player.group.rotation.y = 0;
    missions.cash = 320; missions.active = { ...MISSIONS[0], timeLeft: 142, target: { x: -150, z: -140, label: 'Dermaga Marina' } };
    camera.position.copy(player.cameraTarget(new THREE.Vector3()));
    camera.lookAt(player.lookAt());
  } else if (SHOT === 'coast') {
    weather.setTimeOfDay(13.5); weather.setRain(0);
    const car = traffic.parked[1] || traffic.cars[0];
    myCar = car; player.inCar = car; car.speed = 26;
    car.group.position.set(60, 0, 180); car.heading = Math.PI / 2; car.group.rotation.y = Math.PI / 2;
    player.x = 60; player.z = 180;
    missions.cash = 640;
    camera.position.set(49, 5.2, 180); camera.lookAt(68, 1.8, 180);
  } else if (SHOT === 'night') {
    weather.setTimeOfDay(21.2); weather.setRain(0.85);
    const car = traffic.parked[2] || traffic.cars[0];
    myCar = car; player.inCar = car; car.speed = 18;
    car.group.position.set(0, 0, -60); car.heading = Math.PI; car.group.rotation.y = Math.PI;
    player.x = 0; player.z = -60;
    police.setLevel(2); police.spawnCar(-4, -48);
    missions.cash = 980; missions.active = { ...MISSIONS[3], timeLeft: 96, target: { x: -120, z: 120, label: 'Gudang Tua' } };
    camera.position.set(0, 5.2, -49); camera.lookAt(0, 1.8, -68);
  }
  weather.update(0.016, 1, { x: player.x, z: player.z });
  city.update(1, 0.016);
  traffic.setNight(weather.isNight());
  police.setNight(weather.isNight());
  // warm the renderer, then freeze one frame
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  const job = missions.distanceToTarget({ x: player.x, z: player.z });
  hud.update(0.016, {
    stars: police.level, health: myCar ? myCar.health : player.health,
    cash: missions.cash, objective: job, speedKmh: myCar ? Math.abs(myCar.speed) * 3.6 : 0,
    player: { x: player.x, z: player.z, heading: myCar ? myCar.heading : player.heading },
    police: police.cars.map((c) => ({ x: c.group.position.x, z: c.group.position.z })),
    target: job ? { x: missions.active?.target.x ?? 0, z: missions.active?.target.z ?? 0 } : null,
  });
  document.title = 'SHOT-READY';
}

function renderShot(t) {
  if (shotDone) return;
  shotDone = true;
  weather.update(0.016, 1.2, { x: player.x, z: player.z });
  renderer.render(scene, camera);
  document.title = 'SHOT-READY';
}

// Playwright / automation hook (read-only state + actions)
window.__CS = {
  get state() { return state; },
  get stars() { return police ? police.level : 0; },
  get cash() { return missions ? missions.cash : 0; },
  get mission() { return missions ? missions.active : null; },
  get inCar() { return !!myCar; },
  get speed() { return myCar ? Math.abs(myCar.speed) : 0; },
  get playerPos() { return player ? { x: player.x, z: player.z } : null; },
  start: () => startGame(),
  press: (k) => { keys[k] = true; setTimeout(() => { keys[k] = false; }, 120); },
  keyDown: (k) => { keys[k] = true; },
  keyUp: (k) => { keys[k] = false; },
  enterCar: () => tryEnterExitCar(),
  findCar: () => {
    const c = traffic.nearestStealable(player.x, player.z, 9999);
    return c ? { x: c.group.position.x, z: c.group.position.z } : null;
  },
  startMission: () => missions.start(),
  teleport: (x, z) => {
    if (myCar) { myCar.group.position.set(x, 0, z); player.x = x; player.z = z; }
    else { player.x = x; player.z = z; player.group.position.set(x, 0, z); }
  },
};

buildWorld();
if (SHOT && SHOT_SCENES.includes(SHOT)) setupShot();
else hud.showOverlay('title', `<h1>COSTA SERENA</h1><p>Kota pesisir yang hidup. Rafi, montir kapal, harus melunasi utang kakaknya — satu misi demi satu misi.</p><p><b>ENTER / klik</b> untuk mulai · WASD jalan &amp; menyetir · <b>E</b> curi mobil · <b>F</b> tembak · <b>M</b> misi · <b>1/2/3</b> kegiatan sampingan · <b>R</b> radio · <b>P</b> jeda</p><p class="small">Kas awal $${save.data.cash} · Misi ${Math.min(save.data.missionIndex + 1, 5)}/5 · Rekor kas $${save.data.bestCash}</p>`);
tick();
