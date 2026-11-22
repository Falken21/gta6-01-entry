// Costa Serena — weather.js
// Siklus hari (matahari bergerak, langit berubah, lampu + jendela menyala
// saat senja) + cuaca: cerah, golden hour, dan HUJAN dengan partikel hujan
// 3D yang jatuh miring tertiup angin, percikan, dan jalan basah yang
// memantulkan cahaya (kilau via lapisan glossy + roughness rendah) — bukan
// sekadar overlay.
import { CFG, clamp, lerp, makeRng } from './config.js';

export function createWeather(S, THREE) {
  const rng = makeRng(CFG.seed + 71);
  S.timeOfDay = 17.4; // mulai golden hour
  S.weather = 'clear';
  S.wet = 0;
  S.rainRate = 0;

  // matahari + cahaya sekitar
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0004;
  S.scene.add(sun);
  S.sun = sun;
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.75);
  S.scene.add(hemi);
  S.hemi = hemi;
  // kabut jarak dibuat sekali di sini (bukan per frame) dan warnanya
  // diperbarui di updateWeather.
  S.scene.fog = new THREE.Fog(0xc8d4e0, 190, 620);

  // langit bergradasi: kubah besar dengan shader vertikal sederhana
  const skyGeo = new THREE.SphereGeometry(700, 24, 14);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3a6ab0) }, mid: { value: new THREE.Color(0xffb36b) }, bot: { value: new THREE.Color(0xf7d9a0) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  S.scene.add(sky);
  S.skyMat = skyMat;

  // awan: gumpalan sprite lembut yang melayang
  S.clouds = [];
  const cloudTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const x = 20 + rng.next() * 88, y = 22 + rng.next() * 22, r = 10 + rng.next() * 16;
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  })();
  for (let i = 0; i < 9; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false }));
    spr.position.set(rng.range(-320, 320), rng.range(90, 150), rng.range(-320, 320));
    spr.scale.set(rng.range(90, 170), rng.range(26, 44), 1);
    S.scene.add(spr);
    S.clouds.push({ spr, speed: rng.range(1.2, 3) });
  }

  // hujan: 1400 titik yang jatuh di kotak sekitar kamera + angin
  const RAIN_N = 1400;
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = rng.range(-45, 45);
    rainPos[i * 3 + 1] = rng.range(0, 42);
    rainPos[i * 3 + 2] = rng.range(-45, 45);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xbdd8ea, size: 0.5, transparent: true, opacity: 0,
    sizeAttenuation: true, depthWrite: false,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  rain.frustumCulled = false;
  S.scene.add(rain);
  S.rain = { points: rain, mat: rainMat, geo: rainGeo, n: RAIN_N, vel: new Float32Array(RAIN_N) };
  for (let i = 0; i < RAIN_N; i++) S.rain.vel[i] = rng.range(22, 34);

  S.setWeather = (w) => {
    S.weather = w;
    S.rainRate = w === 'rain' ? 1 : 0;
    S.rain.points.visible = w === 'rain';
  };
}

export function updateWeather(S, dt) {
  // waktu berjalan lambat (1 jam game ~ 4 menit nyata) kecuali mode shot
  if (!S.shot) S.timeOfDay = (S.timeOfDay + dt * 0.0042) % 24;
  const t = S.timeOfDay;
  const dayF = clamp(Math.sin(((t - 6) / 12) * Math.PI), 0, 1); // 0 malam, 1 siang
  const golden = clamp(1 - Math.abs(t - 17.6) / 2.2, 0, 1); // golden hour sore
  const dusk = t > 18.2 || t < 6.4;

  // posisi + warna matahari
  const sunAngle = ((t - 6) / 12) * Math.PI;
  const sunDir = {
    x: Math.cos(sunAngle) * 0.8,
    y: Math.max(0.06, Math.sin(sunAngle)),
    z: 0.45,
  };
  S.sun.position.set(sunDir.x * 260, sunDir.y * 260, sunDir.z * 260);
  S.sun.intensity = 0.8 + dayF * 2.0;
  S.sun.color.setHSL(0.09 - golden * 0.03, 0.75, 0.62 + dayF * 0.08);
  S.hemi.intensity = 0.35 + dayF * 0.5;
  // langit bergradasi mengikuti waktu
  const u = S.skyMat.uniforms;
  if (t > 18.5 || t < 5.5) { // malam
    u.top.value.setHex(0x0a1230); u.mid.value.setHex(0x1a2a52); u.bot.value.setHex(0x2a2a3a);
  } else if (golden > 0.4) { // golden hour
    u.top.value.setHex(0x3a6ab0); u.mid.value.setHex(0xff9a4d); u.bot.value.setHex(0xffd9a0);
  } else if (dayF > 0.6) { // siang
    u.top.value.setHex(0x2f6fd0); u.mid.value.setHex(0x7fb8e8); u.bot.value.setHex(0xcfe8f5);
  } else { // pagi/senja
    u.top.value.setHex(0x4a6aa8); u.mid.value.setHex(0xe89a6a); u.bot.value.setHex(0xf7d9a0);
  }
  // kabut jarak: hanya warnanya yang mengikuti langit (objeknya dibuat
  // sekali di createWeather agar tidak ada alokasi per frame)
  if (S.scene.fog) {
    S.scene.fog.color.copy(u.mid.value).lerp(u.bot.value, 0.5);
    if (t > 18.5 || t < 5.5) S.scene.fog.color.setHex(0x0e1424);
  }

  // jendela + lampu jalan menyala saat gelap
  const nightF = dusk ? 1 : clamp((18.2 - t) / 1.2, 0, 1) * (t > 12 ? 1 : 0) + (t < 6.4 ? 1 : 0);
  const glow = clamp(nightF, 0, 1);
  for (const m of S.buildingMats) m.emissiveIntensity = glow * 0.9;
  if (S.lampHeadMat) S.lampHeadMat.emissiveIntensity = glow * 1.6;
  for (const pl of S.lampLights) pl.intensity = glow * 60;

  // hujan + jalan basah
  const targetWet = S.weather === 'rain' ? 1 : 0;
  S.wet = lerp(S.wet, targetWet, dt * 0.6);
  S.rain.mat.opacity = S.wet * 0.85;
  S.rain.points.visible = S.wet > 0.03;
  if (S.rain.points.visible) {
    const cx = S.camera.position.x, cz = S.camera.position.z;
    const pos = S.rain.geo.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < S.rain.n; i++) {
      arr[i * 3 + 1] -= S.rain.vel[i] * dt;
      arr[i * 3] += 4.5 * dt; // angin
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 38 + Math.random() * 4;
        arr[i * 3] = cx + (Math.random() - 0.5) * 90;
        arr[i * 3 + 2] = cz + (Math.random() - 0.5) * 90;
      }
    }
    pos.needsUpdate = true;
    S.rain.points.position.set(0, 0, 0);
  }
  // kilau jalan basah: lapisan glossy muncul + aspal jadi reflektif
  if (S.wetPlane) S.wetPlane.material.opacity = S.wet * 0.42;
  if (S.groundMat) S.groundMat.roughness = lerp(0.94, 0.45, S.wet);
  // air marina beranimasi: offset tekstur + kilau
  if (S.waterMat && S.waterMat.map) {
    S.waterMat.map.offset.x += dt * 0.008;
    S.waterMat.map.offset.y += dt * 0.005;
  }
  // palem bergoyang + perahu bobbing
  for (const p of S.palms) {
    p.crown.rotation.z = Math.sin(S.now * 0.9 + p.phase) * 0.09;
    p.crown.rotation.x = Math.cos(S.now * 0.7 + p.phase) * 0.06;
  }
  for (const b of S.boats) {
    b.group.position.y = Math.sin(S.now * 0.8 + b.phase) * 0.18;
    b.group.rotation.z = Math.sin(S.now * 0.6 + b.phase) * 0.02;
  }
  for (const c of S.clouds) {
    c.spr.position.x += c.speed * dt;
    if (c.spr.position.x > 360) c.spr.position.x = -360;
  }
}
