// Costa Serena — config.js
// Satu sumber kebenaran untuk tuning, seed, dan definisi misi.
// Semua keacakan gameplay mengalir lewat rng() yang di-seed, supaya
// mode screenshot dan replay selalu deterministik.
import * as THREE from '../vendor/three.module.min.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CFG = {
  seed: 20261119,
  // ---- world geometry (metres) ----
  block: 60,            // ukuran blok kota
  roadW: 14,            // lebar jalan
  avenues: [-180, -120, -60, 0, 60, 120, 180],   // jalan utara-selatan (sumbu z)
  streets: [-120, -60, 0, 60, 120],              // jalan timur-barat (sumbu x)
  cityMinX: -210, cityMaxX: 210,
  cityMinZ: -150, cityMaxZ: 150,
  beachZ: 150,          // garis pantai
  waterZ: 168,          // awal air
  worldFar: 520,
  // ---- player ----
  walkSpeed: 5.2,
  runSpeed: 9.5,
  playerRadius: 0.55,
  playerHealth: 100,
  // ---- driving ----
  carAccel: 16, carBrake: 34, carMaxSpeed: 42, carMaxReverse: 12,
  steerMax: 0.55, grip: 6.5, handbrakeGrip: 1.6,
  // ---- wanted ----
  wantedMax: 5,
  heatTheftSeen: 1, heatCollision: 0.35, heatShoot: 1, heatPedHit: 0.5,
  heatMission: 1, coolDelay: 7, coolRate: 0.22,
  // ---- economy ----
  startCash: 120,
  // ---- traffic / peds ----
  trafficCars: 14, parkedCars: 10, pedestrians: 26,
  // ---- weather ----
  dayLength: 300,       // detik satu siklus siang penuh (mode bebas)
  rainChance: 0.22,
  // ---- audio ----
  radioDefault: true,
};

export const MISSIONS = [
  {
    id: 'm1', title: 'Paket Pertama', giver: 'Darto',
    brief: 'Antar paket ke gudang pelabuhan sebelum waktu habis. Jangan sampai rusak.',
    steps: [
      { kind: 'goto', label: 'Ambil paket di bengkel Rafi', at: [9, -102] },
      { kind: 'goto', label: 'Antar ke gudang pelabuhan', at: [-171, 102], time: 150 },
    ],
    secondary: { label: 'Bonus: antar paket kedua di jalan (+$150)', at: [111, -42], reward: 150 },
    reward: 400, heat: 0,
  },
  {
    id: 'm2', title: 'Mata-Mata Pelabuhan', giver: 'Darto',
    brief: 'Polisi mengendus. Kabur dari kejaran sampai bintang padam.',
    steps: [
      { kind: 'goto', label: 'Temui informan di gang marina', at: [-51, 132] },
      { kind: 'escape', label: 'Hilang dari kejaran polisi', heat: 2, hold: 25 },
    ],
    secondary: { label: 'Bonus: kabur tanpa menabrak apa pun (+$200)', reward: 200, noCrash: true },
    reward: 550, heat: 2,
  },
  {
    id: 'm3', title: 'Balapan Pantai', giver: 'Luna',
    brief: 'Balapan melawan waktu di jalan pesisir. Tiga gerbang, satu garis finis.',
    steps: [
      { kind: 'race', label: 'Lewati gerbang 1', at: [-150, 138] },
      { kind: 'race', label: 'Lewati gerbang 2', at: [0, 138] },
      { kind: 'race', label: 'Finis di mercusuar', at: [180, 138], time: 75 },
    ],
    secondary: { label: 'Bonus: finis di bawah 55 detik (+$250)', reward: 250, parTime: 55 },
    reward: 700, heat: 0,
  },
  {
    id: 'm4', title: 'Kerja Kapal', giver: 'Kapten Mora',
    brief: 'Bawa perahu dari marina ke dermaga utara. Peti mengapung di jalur.',
    steps: [
      { kind: 'goto', label: 'Naik ke perahu di marina', at: [3, 158] },
      { kind: 'boat', label: 'Bawa perahu ke dermaga utara', at: [-60, 166] },
    ],
    secondary: { label: 'Bonus: kumpulkan 3 peti mengapung (+$180)', reward: 180, crates: 3 },
    reward: 800, heat: 1,
  },
  {
    id: 'm5', title: 'Pelarian Terakhir', giver: 'Rafi',
    brief: 'Utang lunas malam ini. Tembus blokade ke gerbang utara — hidup atau mati.',
    steps: [
      { kind: 'goto', label: 'Ambil tas uang di atap parkir', at: [171, -102] },
      { kind: 'escape', label: 'Tembus ke gerbang utara', at: [0, -138], heat: 4, hold: 0 },
    ],
    secondary: { label: 'Bonus: sampai dengan mobil utuh (+$300)', reward: 300, noDamage: true },
    reward: 1500, heat: 4,
  },
];

export const SIDE_JOBS = {
  taxi: { label: 'Taksi: antar penumpang', reward: 120 },
  race: { label: 'Balap jalanan (time trial)', reward: 180 },
  pickup: { label: 'Paket kilat', reward: 90 },
};

export const PALETTE = {
  skyDay: new THREE.Color(0x7fb4d8),
  skyGolden: new THREE.Color(0xf2a35e),
  skyNight: new THREE.Color(0x0d1b2e),
  fogDay: new THREE.Color(0xa8c6d8),
  sunDay: new THREE.Color(0xfff2d8),
  sunGolden: new THREE.Color(0xffb066),
  asphalt: 0x2e2f33,
  sidewalk: 0x8f8a80,
  sand: 0xd9c08a,
  water: 0x1d6f7e,
};
