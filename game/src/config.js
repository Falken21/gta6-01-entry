// Costa Serena — config.js
// Single source of tuning constants. Fixed seed keeps screenshot mode deterministic.
export const SEED = 20261119;
export const WORLD = {
  block: 46, road: 14, halfGrid: 3, // 7x7 blocks centred on origin
  groundSize: 560, beachZ: 210, marinaX: -190,
};
export const PLAYER = { walk: 4.2, run: 8.5, accel: 26, turn: 2.6, radius: 0.55, health: 100 };
export const CAR = { accel: 17, brake: 30, reverse: 9, maxSpeed: 38, steerMax: 0.55, grip: 0.92 };
export const WANTED = { decayDelay: 6, decayRate: 0.25, maxStars: 5 };
export const MISSIONS = [
  { id: 1, name: 'Antar Paket Marina', brief: 'Bawa paket ke dermaga marina sebelum waktu habis.', reward: 250, time: 150, secondary: 'Tanpa tabrakan: bonus $100', secondaryReward: 100 },
  { id: 2, name: 'Taksi Tengah Malam', brief: 'Antar 2 penumpang ke hotel Riviera.', reward: 320, time: 200, secondary: 'Antar keduanya tanpa kerusakan berat: bonus $120', secondaryReward: 120 },
  { id: 3, name: 'Balapan Pesisir', brief: 'Lewati 5 checkpoint di jalan pesisir.', reward: 450, time: 180, secondary: 'Selesaikan di bawah 90 detik: bonus $200', secondaryReward: 200 },
  { id: 4, name: 'Utang Kakak', brief: 'Ambil tas uang di gudang, hindari polisi.', reward: 600, time: 220, secondary: 'Wanted tetap 0: bonus $250', secondaryReward: 250 },
  { id: 5, name: 'Pelarian Terakhir', brief: 'Kabur ke kapal di marina dengan wanted 3.', reward: 900, time: 240, secondary: 'Sampai dengan mobil utuh (>60%): bonus $300', secondaryReward: 300 },
];
export const SHOT_SCENES = ['chase', 'walk', 'coast', 'night'];
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
