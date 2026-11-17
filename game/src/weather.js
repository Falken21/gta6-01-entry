// Costa Serena — day cycle + weather: moving sun, sky/fog colour grading,
// streetlight and window glow at dusk, rain with wet-road sheen and streaks.
import * as THREE from 'three';
import { CFG, clamp, lerp } from './config.js';

export function createWeather(scene, rng) {
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.7);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);

  // rain streaks (Points, recycled)
  const RAIN_N = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (rng.next() - 0.5) * 120;
    rainPos[i * 3 + 1] = rng.next() * 40;
    rainPos[i * 3 + 2] = (rng.next() - 0.5) * 120;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaac4d8, size: 0.35, transparent: true, opacity: 0 }));
  rain.visible = false;
  scene.add(rain);

  let hour = CFG.day.startHour;
  let rainAmt = 0; // 0..1
  let rainTarget = 0;
  let rainTimer = 40 + rng.next() * 60;

  const SKY = {
    day: new THREE.Color(0x87b5d9), golden: new THREE.Color(0xf2a35e),
    dusk: new THREE.Color(0x5a4a72), night: new THREE.Color(0x0e1626),
  };
  const FOG = { day: new THREE.Color(0xa8c4d8), golden: new THREE.Color(0xe8a06a), night: new THREE.Color(0x0a101c) };

  function skyColor(h) {
    // h in 0..24; returns {sky, fog, sunColor, sunI, hemiI}
    const c = new THREE.Color();
    if (h >= 6 && h < 16) { c.copy(SKY.day); }
    else if (h >= 16 && h < 18.5) { c.copy(SKY.day).lerp(SKY.golden, (h - 16) / 2.5); }
    else if (h >= 18.5 && h < 20) { c.copy(SKY.golden).lerp(SKY.dusk, (h - 18.5) / 1.5); }
    else if (h >= 20 || h < 5) { c.copy(SKY.night); }
    else { c.copy(SKY.night).lerp(SKY.day, (h - 5) / 1); }
    return c;
  }

  function update(dt, focus) {
    hour += (dt / CFG.day.dayLengthSec) * 24;
    if (hour >= 24) hour -= 24;
    // weather state machine: dry spells and rain spells
    rainTimer -= dt;
    if (rainTimer <= 0) {
      rainTarget = rainTarget > 0.5 ? 0 : 1;
      rainTimer = rainTarget > 0.5 ? 25 + rng.next() * 40 : 50 + rng.next() * 90;
    }
    rainAmt = clamp(rainAmt + (rainTarget - rainAmt) * dt * 0.4, 0, 1);

    const sunAngle = ((hour - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
    const sunElev = Math.sin(sunAngle);
    const sunDir = new THREE.Vector3(Math.cos(sunAngle) * 0.6, Math.max(0.06, sunElev), 0.45).normalize();
    const fx = focus ? focus.x : 0, fz = focus ? focus.z : 0;
    sun.position.set(fx + sunDir.x * 220, sunDir.y * 220, fz + sunDir.z * 220);
    sun.target.position.set(fx, 0, fz);
    const dayFactor = clamp(sunElev * 1.4 + 0.45, 0.3, 1);
    const warm = hour >= 16 && hour < 19.5;
    sun.color.setHex(warm ? 0xffb066 : 0xfff2dd);
    sun.intensity = 3.0 * dayFactor * (rainAmt > 0.5 ? 0.5 : 1);
    hemi.intensity = 0.9 * dayFactor + 0.18;
    amb.intensity = 0.3 * dayFactor + 0.1;

    const sky = skyColor(hour);
    scene.background = sky;
    scene.fog = scene.fog || new THREE.Fog(0xa8c4d8, 120, 420);
    scene.fog.color.copy(sky).lerp(FOG.night, rainAmt * 0.3);
    scene.fog.near = 120 - rainAmt * 40;
    scene.fog.far = 420 - rainAmt * 180;

    // rain follows the focus point
    rain.visible = rainAmt > 0.05;
    rain.material.opacity = rainAmt * 0.55;
    if (rain.visible) {
      rain.position.set(fx, 0, fz);
      const pos = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_N; i++) {
        pos[i * 3 + 1] -= dt * 26;
        if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 38;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    return { hour, rainAmt, night: hour < 6 || hour >= 19 };
  }

  return {
    sun, hemi,
    get hour() { return hour; },
    get rain() { return rainAmt; },
    setHour(h) { hour = h; },
    setRain(v) { rainTarget = v; rainAmt = v; },
    update,
  };
}
