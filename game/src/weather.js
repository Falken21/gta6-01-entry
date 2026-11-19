// Costa Serena — weather.js
// One job: the sky and the day. A moving sun drives the light story —
// golden-hour start, long shadows, dusk windows and streetlights, night
// headlights — plus weather states (clear, golden hour, rain with a
// wet-road sheen and falling rain particles).
import * as THREE from 'three';
import { CFG, clamp, lerp, mulberry32 } from './config.js';

export function createWeather(scene, city, seed = CFG.seed) {
  const rng = mulberry32(seed + 505);
  const sun = new THREE.DirectionalLight(0xffb36b, 2.6);
  sun.position.set(120, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -240; sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240; sun.shadow.camera.bottom = -240;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x8a7a5c, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(amb);

  // Gradient sky dome + drifting clouds.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x3f6ea6) },
      mid: { value: new THREE.Color(0xff9e57) },
      bot: { value: new THREE.Color(0xffe0b0) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), skyMat);
  scene.add(sky);

  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + rng() * 8, 8, 6), cloudMat);
      puff.position.set(j * 8 - 12 + rng() * 4, rng() * 2, rng() * 6 - 3);
      puff.scale.y = 0.45;
      cl.add(puff);
    }
    cl.position.set(rng() * 600 - 300, 90 + rng() * 50, rng() * 600 - 300);
    scene.add(cl);
    clouds.push(cl);
  }

  // Rain: a points cloud that falls and recycles above the player.
  const RAIN_N = 1400;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (rng() - 0.5) * 120;
    rainPos[i * 3 + 1] = rng() * 40;
    rainPos[i * 3 + 2] = (rng() - 0.5) * 120;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0xaac4d8, size: 0.28, transparent: true, opacity: 0 });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  scene.add(rain);

  const state = {
    hour: CFG.startHour,
    rain: 0,            // 0 dry .. 1 pouring
    rainTarget: 0,
    weather: 'golden',  // golden | clear | rain
    nightFactor: 0,     // 0 day .. 1 night
  };

  const cTop = new THREE.Color(), cMid = new THREE.Color(), cBot = new THREE.Color();
  const cFog = new THREE.Color(), cSun = new THREE.Color();

  function skyFor(hour) {
    // Keyframes through the day: night, dawn, day, golden, dusk, night.
    const stops = [
      [0, 0x0a1226, 0x0a1226, 0x131c33, 0x0c1424, 0x5a6f9e, 0.15],
      [5.5, 0x0a1226, 0x1c2a4a, 0x2c3e63, 0x141c30, 0x5a6f9e, 0.2],
      [7, 0x6f9ac8, 0xe8a06a, 0xffd9a0, 0xc9a06a, 0xffb36b, 1.6],
      [10, 0x4f8ac2, 0x7fb4dd, 0xcfe6f2, 0xa8c6de, 0xfff2d8, 2.8],
      [16, 0x4a86c0, 0x7fb4dd, 0xd8ecf5, 0xa8c6de, 0xfff2d8, 2.8],
      [17.5, 0x3f6ea6, 0xff9e57, 0xffe0b0, 0xe8a06a, 0xffb36b, 2.4],
      [19, 0x2c3e63, 0x8a5a7a, 0xe88a5a, 0x8a6a7a, 0xff8a4a, 1.0],
      [20.5, 0x0a1226, 0x131c33, 0x2c3e63, 0x0c1424, 0x5a6f9e, 0.25],
      [24, 0x0a1226, 0x0a1226, 0x131c33, 0x0c1424, 0x5a6f9e, 0.15],
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (hour >= stops[i][0] && hour <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const t = clamp((hour - a[0]) / Math.max(0.001, b[0] - a[0]), 0, 1);
    const s = t * t * (3 - 2 * t);
    cTop.setHex(a[1]).lerp(new THREE.Color(b[1]), s);
    cMid.setHex(a[2]).lerp(new THREE.Color(b[2]), s);
    cBot.setHex(a[3]).lerp(new THREE.Color(b[3]), s);
    cFog.setHex(a[4]).lerp(new THREE.Color(b[4]), s);
    cSun.setHex(a[5]).lerp(new THREE.Color(b[5]), s);
    return { sunI: lerp(a[6], b[6], s) };
  }

  function setRain(amount) {
    state.rainTarget = clamp(amount, 0, 1);
    state.weather = amount > 0.5 ? 'rain' : (state.hour > 16.5 && state.hour < 19 ? 'golden' : 'clear');
  }

  function update(dt, focus) {
    state.hour += dt * (24 / CFG.dayLengthSec);
    if (state.hour >= 24) state.hour -= 24;
    const { sunI } = skyFor(state.hour);
    // sun position from the hour: east at dawn, overhead at noon, west at dusk
    const ang = ((state.hour - 6) / 12) * Math.PI;
    const el = Math.sin(ang);
    sun.position.set(Math.cos(ang) * 260, Math.max(12, el * 260), 120);
    sun.intensity = sunI * (state.rain > 0.3 ? 0.4 : 1);
    sun.color.copy(cSun);
    skyMat.uniforms.top.value.copy(cTop);
    skyMat.uniforms.mid.value.copy(cMid);
    skyMat.uniforms.bot.value.copy(cBot);
    scene.fog = scene.fog || new THREE.Fog(0xa8c6de, 120, 620);
    scene.fog.color.copy(cFog);
    scene.fog.near = state.rain > 0.3 ? 60 : 120;
    scene.fog.far = state.rain > 0.3 ? 380 : 640;
    hemi.intensity = 0.35 + sunI * 0.25;
    // night factor: dark between 20:00 and 05:30
    const h = state.hour;
    const night = h >= 20 || h < 5.5 ? 1 : (h >= 19 ? (h - 19) : (h >= 5 ? (5.5 - h) / 0.5 : 0));
    state.nightFactor = clamp(night, 0, 1);
    city.setNight(state.nightFactor);
    // clouds drift
    for (const cl of clouds) {
      cl.position.x += dt * 1.5;
      if (cl.position.x > 320) cl.position.x = -320;
    }
    // rain
    state.rain = lerp(state.rain, state.rainTarget, Math.min(1, dt * 0.5));
    rain.visible = state.rain > 0.03;
    if (rain.visible) {
      rainMat.opacity = state.rain * 0.55;
      rain.position.set(focus.x, 0, focus.z);
      const pos = rainGeo.attributes.position;
      for (let i = 0; i < RAIN_N; i++) {
        let y = pos.getY(i) - dt * 26;
        if (y < 0) y = 38 + Math.random() * 4;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    // wet-road sheen: darken + gloss the water plane's neighbours via fog only;
    // the marina water sparkles faster in rain.
    city.waterMat.map.offset.y += dt * (0.008 + state.rain * 0.02);
    city.waterMat.map.offset.x += dt * 0.004;
  }

  function setHour(h) { state.hour = ((h % 24) + 24) % 24; }

  return { state, update, setRain, setHour, sun };
}
