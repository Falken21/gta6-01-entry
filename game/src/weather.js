// Costa Serena — weather.js
// Day cycle (moving sun, gradient sky, streetlights at night) + weather
// states. Rain is REAL 3D: falling streak particles + splash rings + wet-road
// sheen (roughness drop in city.setWet) — never a screen overlay.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp } from './config.js';

export class Weather {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.timeOfDay = 17.4; // golden hour start
    this.rain = 0; // 0..1 intensity
    this.raining = false;
    // sky dome: big gradient sphere (shader-free, vertex-coloured)
    const skyGeo = new THREE.SphereGeometry(700, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
    this.sky = new THREE.Mesh(skyGeo, skyMat); scene.add(this.sky);
    // sun + hemisphere light
    this.sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 700; this.sun.shadow.bias = -0.0004;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.7);
    scene.add(this.hemi);
    this.scene.fog = new THREE.Fog(0xd8b98a, 180, 620);
    // clouds: soft billboard puffs drifting
    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false });
    for (let i = 0; i < 14; i++) {
      const cl = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(8 + Math.random() * 10, 8, 6), cloudMat);
        s.position.set(j * 10 - 15, Math.random() * 3, Math.random() * 6 - 3);
        s.scale.y = 0.45; cl.add(s);
      }
      cl.position.set((Math.random() - 0.5) * 600, 120 + Math.random() * 60, (Math.random() - 0.5) * 600);
      scene.add(cl); this.clouds.push(cl);
    }
    // rain: 3D streaks (LineSegments) + splash rings on the ground
    const N = 900;
    const pos = new Float32Array(N * 6);
    this.rainPos = pos; this.rainN = N;
    this.rainVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 220, y = Math.random() * 60, z = (Math.random() - 0.5) * 220;
      pos.set([x, y, z, x, y - 1.6, z], i * 6);
      this.rainVel[i] = 28 + Math.random() * 14;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainLines = new THREE.LineSegments(rainGeo,
      new THREE.LineBasicMaterial({ color: 0xaac4d8, transparent: true, opacity: 0 }));
    this.rainLines.frustumCulled = false; scene.add(this.rainLines);
    // splash rings
    this.splashes = [];
    const splashGeo = new THREE.RingGeometry(0.1, 0.5, 12);
    const splashMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(splashGeo, splashMat.clone());
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m);
      this.splashes.push({ mesh: m, life: 0 });
    }
    this.splashTimer = 0;
  }
  setRain(v) {
    this.raining = v > 0.05; this.rain = clamp(v, 0, 1);
    this.rainLines.material.opacity = this.rain * 0.55;
    this.city.setWet(this.rain > 0.25);
  }
  setTimeOfDay(h) { this.timeOfDay = h; }
  isNight() { return this.timeOfDay < 6.2 || this.timeOfDay > 19.2; }
  update(dt, t, focus) {
    // sun angle from time of day
    const ang = ((this.timeOfDay - 6) / 12) * Math.PI; // 6h sunrise -> 18h sunset
    const sunEl = Math.sin(ang), sunAz = Math.cos(ang);
    this.sun.position.set(sunAz * 300, Math.max(sunEl, 0.06) * 320, 120);
    const golden = clamp(1 - Math.abs(this.timeOfDay - 17.5) / 3, 0, 1);
    const night = this.isNight();
    // sky colour: gradient via material colour (top) approximated by fog + clear colour
    const warm = new THREE.Color(0xff9a4d), noon = new THREE.Color(0x87b5e0), dusk = new THREE.Color(0x2a3550);
    let skyCol;
    if (night) skyCol = dusk;
    else skyCol = noon.clone().lerp(warm, golden * 0.85);
    if (this.raining) skyCol.lerp(new THREE.Color(0x5a6672), this.rain * 0.7);
    this.scene.background = skyCol;
    this.scene.fog.color.copy(skyCol);
    this.sky.material.color.copy(skyCol).multiplyScalar(0.92);
    this.sun.color.set(night ? 0x8fa8d8 : (golden > 0.5 ? 0xffb060 : 0xfff2d8));
    this.sun.intensity = night ? 0.25 : lerp(2.6, 1.6, golden) * (1 - this.rain * 0.5);
    this.hemi.intensity = night ? 0.25 : 0.7;
    this.city.setNight(night);
    // clouds drift
    for (const c of this.clouds) { c.position.x += dt * 1.2; if (c.position.x > 340) c.position.x = -340; }
    // rain falls around the focus point
    if (this.raining) {
      const pos = this.rainPos;
      for (let i = 0; i < this.rainN; i++) {
        let y = pos[i * 6 + 1] - this.rainVel[i] * dt;
        if (y < 0) {
          y = 45 + Math.random() * 15;
          pos[i * 6] = focus.x + (Math.random() - 0.5) * 220;
          pos[i * 6 + 2] = focus.z + (Math.random() - 0.5) * 220;
        }
        pos[i * 6 + 1] = y; pos[i * 6 + 4] = y - 1.6;
        pos[i * 6 + 3] = pos[i * 6]; pos[i * 6 + 5] = pos[i * 6 + 2];
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
      // splash rings spawn under random streaks
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) {
        this.splashTimer = 0.05;
        const s = this.splashes.find((x) => x.life <= 0);
        if (s) {
          s.life = 0.35;
          s.mesh.position.set(focus.x + (Math.random() - 0.5) * 90, 0.06, focus.z + (Math.random() - 0.5) * 90);
          s.mesh.visible = true;
        }
      }
    }
    for (const s of this.splashes) {
      if (s.life > 0) {
        s.life -= dt;
        const k = 1 - s.life / 0.35;
        s.mesh.scale.setScalar(0.4 + k * 1.6);
        s.mesh.material.opacity = 0.5 * (1 - k);
        if (s.life <= 0) s.mesh.visible = false;
      }
    }
  }
}
