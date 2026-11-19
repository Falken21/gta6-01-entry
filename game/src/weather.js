// Costa Serena — weather.js
// Siklus hari (matahari bergerak, langit berubah, lampu & jendela menyala
// saat senja) + cuaca (cerah / golden hour / hujan). Hujan adalah partikel
// 3D di sekitar kamera dengan percikan di tanah — BUKAN overlay. Jalan
// basah: roughness turun, pantulan naik, genangan muncul (refleksi jalan).
import * as THREE from '../vendor/three.module.min.js';
import { CFG, PALETTE } from './config.js';

export function createWeather(W) {
  const scene = W.scene;
  // langit bergradasi: kubah besar dengan shader sederhana
  const skyGeo = new THREE.SphereGeometry(700, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x4a7fb5) },
      mid: { value: new THREE.Color(0x9fc4de) },
      bot: { value: new THREE.Color(0xe8c9a0) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top, mid, bot;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // awan: gumpalan sprite lembut yang melayang (tekstur blob radial = tepi halus)
  const cloudMat = new THREE.SpriteMaterial({
    map: W.textures.blob, color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false,
  });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(cloudMat.clone());
    s.scale.set(90 + W.rng() * 90, 22 + W.rng() * 18, 1);
    s.position.set((W.rng() - 0.5) * 900, 120 + W.rng() * 70, (W.rng() - 0.5) * 700);
    s.material.opacity = 0.35 + W.rng() * 0.35;
    scene.add(s);
    clouds.push({ s, speed: 1 + W.rng() * 2 });
  }

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ea, 0x8a7a5a, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xa8c6d8, 120, 620);

  // ---- hujan: 1400 titik 3D di sekitar kamera, jatuh dengan angin ----
  const RAIN_N = 1400;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 3);
  const rainSeed = new Float32Array(RAIN_N);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (W.rng() - 0.5) * 90;
    rainPos[i * 3 + 1] = W.rng() * 40;
    rainPos[i * 3 + 2] = (W.rng() - 0.5) * 90;
    rainSeed[i] = W.rng();
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xaac4d4, size: 0.32, transparent: true, opacity: 0, depthWrite: false,
    sizeAttenuation: true, map: W.textures.blob, alphaTest: 0.01,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  scene.add(rain);
  // percikan: cincin kecil di tanah saat tetes menyentuh
  const splashGeo = new THREE.RingGeometry(0.08, 0.3, 10);
  const splashMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const splashes = [];
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(splashGeo, splashMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    splashes.push({ m, t: 1 });
  }

  let timeOfDay = 0.32;       // 0..1 ; mulai golden hour sore
  let weatherState = 'golden'; // clear | golden | rain
  let rainAmount = 0;          // 0..1 transisi
  let nextChange = 45 + W.rng() * 60;
  let autoCycle = true;

  function setTime(t) { timeOfDay = ((t % 1) + 1) % 1; }
  function setWeather(state) {
    weatherState = state;
    if (state === 'rain') { rain.visible = true; }
    else if (rainAmount <= 0) rain.visible = false;
  }
  function nightFactor() {
    // 0 = tengah hari, 0.5 = senja, 1 = tengah malam (dari elevasi matahari)
    const sunEl = Math.sin((timeOfDay - 0.25) * Math.PI * 2);
    return Math.max(0, Math.min(1, 0.5 - sunEl * 1.1));
  }
  function applyLighting() {
    const night = nightFactor();
    const golden = weatherState === 'golden' ? 1 : 0;
    const sunCol = new THREE.Color().lerpColors(PALETTE.sunDay, PALETTE.sunGolden, golden);
    sun.color.copy(sunCol).lerp(new THREE.Color(0x24344e), night * 0.85);
    sun.intensity = 2.6 * (1 - night * 0.92) * (weatherState === 'rain' ? 0.55 : 1);
    const ang = timeOfDay * Math.PI * 2 - Math.PI / 2;
    const el = Math.sin(ang) * 0.9 + 0.12;
    sun.position.set(Math.cos(ang) * 220, Math.max(18, el * 220), 120);
    sun.target.position.set(W.player.pos.x, 0, W.player.pos.z);
    // bayangan mengikuti pemain
    sun.shadow.camera.left = W.player.pos.x - 160; sun.shadow.camera.right = W.player.pos.x + 160;
    sun.shadow.camera.top = W.player.pos.z + 160; sun.shadow.camera.bottom = W.player.pos.z - 160;
    hemi.intensity = 0.9 * (1 - night * 0.75);
    hemi.color.lerpColors(new THREE.Color(0xbfd9ea), new THREE.Color(0x2a3a55), night);
    // langit
    const top = new THREE.Color().lerpColors(new THREE.Color(0x4a7fb5), new THREE.Color(0x0a1626), night);
    const mid = new THREE.Color().lerpColors(new THREE.Color(0x9fc4de), new THREE.Color(0x1a2c44), night);
    const bot = new THREE.Color().lerpColors(new THREE.Color(0xe8c9a0), new THREE.Color(0x0d1b2e), night);
    if (golden) { mid.lerp(new THREE.Color(0xf2a35e), 0.45); bot.lerp(new THREE.Color(0xffc98a), 0.5); }
    if (weatherState === 'rain') { top.multiplyScalar(0.55); mid.multiplyScalar(0.6); bot.multiplyScalar(0.6); }
    skyMat.uniforms.top.value.copy(top);
    skyMat.uniforms.mid.value.copy(mid);
    skyMat.uniforms.bot.value.copy(bot);
    scene.fog.color.copy(mid);
    scene.fog.near = weatherState === 'rain' ? 60 : 120;
    scene.fog.far = weatherState === 'rain' ? 380 : 620;
    // jendela & lampu jalan menyala saat gelap
    const glow = Math.min(1, night * 2 + (weatherState === 'rain' ? 0.35 : 0));
    for (const m of W.city.facadeMats) m.emissiveIntensity = glow * 0.9;
    W.city.lampMat.emissiveIntensity = glow * 2.4;
    W.city.poolMat.opacity = glow * 0.35;
    // jalan basah: refleksi (kedua orientasi jalan)
    const wet = rainAmount;
    for (const rm of [W.city.roadMat, W.city.roadMatH]) {
      if (!rm) continue;
      rm.roughness = 0.92 - wet * 0.62;
      rm.envMapIntensity = 0.35 + wet * 1.4;
    }
    W.city.puddleMat.opacity = wet * 0.85;
  }

  function update(dt, t) {
    if (autoCycle) {
      timeOfDay += dt / CFG.dayLength;
      if (timeOfDay >= 1) timeOfDay -= 1;
      nextChange -= dt;
      if (nextChange <= 0) {
        nextChange = 60 + W.rng() * 90;
        const roll = W.rng();
        setWeather(roll < CFG.rainChance ? 'rain' : (timeOfDay > 0.28 && timeOfDay < 0.42 ? 'golden' : 'clear'));
      }
    }
    // transisi hujan
    const target = weatherState === 'rain' ? 1 : 0;
    rainAmount += (target - rainAmount) * Math.min(1, dt * 0.5);
    rainMat.opacity = rainAmount * 0.75;
    rain.visible = rainAmount > 0.02;
    if (rain.visible) {
      const cx = W.camera.position.x, cz = W.camera.position.z;
      const pos = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_N; i++) {
        let y = pos[i * 3 + 1] - dt * (26 + rainSeed[i] * 10);
        let x = pos[i * 3] + dt * 3.5; // angin
        if (y < 0) {
          y = 30 + W.rng() * 12;
          x = cx + (W.rng() - 0.5) * 90;
          pos[i * 3 + 2] = cz + (W.rng() - 0.5) * 90;
          // percikan di tanah
          const sp = splashes[Math.floor(W.rng() * splashes.length)];
          sp.m.position.set(pos[i * 3], 0.06, pos[i * 3 + 2]);
          sp.m.visible = true; sp.t = 0;
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y;
        // bungkus di sekitar kamera
        if (pos[i * 3] - cx > 45) pos[i * 3] -= 90;
        if (pos[i * 3] - cx < -45) pos[i * 3] += 90;
        if (pos[i * 3 + 2] - cz > 45) pos[i * 3 + 2] -= 90;
        if (pos[i * 3 + 2] - cz < -45) pos[i * 3 + 2] += 90;
      }
      rainGeo.attributes.position.needsUpdate = true;
      for (const sp of splashes) {
        if (!sp.m.visible) continue;
        sp.t += dt * 4;
        if (sp.t >= 1) { sp.m.visible = false; continue; }
        const s = 0.4 + sp.t * 2.2;
        sp.m.scale.set(s, s, 1);
        sp.m.material.opacity = 0.6 * (1 - sp.t);
      }
    }
    for (const c of clouds) {
      c.s.position.x += c.speed * dt;
      if (c.s.position.x > 480) c.s.position.x = -480;
    }
    applyLighting();
  }

  return {
    update, setTime, setWeather, nightFactor,
    get timeOfDay() { return timeOfDay; },
    get weather() { return weatherState; },
    get rainAmount() { return rainAmount; },
    set auto(v) { autoCycle = v; },
  };
}
