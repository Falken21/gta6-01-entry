// Costa Serena — hud.js
// HUD: bintang wanted, bar kesehatan, cash, objektif + jarak, kecepatan saat
// menyetir, dan MINIMAP hidup (jalan, panah pemain, titik polisi, penanda misi).
// Juga layar judul/jeda/game-over dan toast pesan.
import { CFG, clamp, dist2 } from './config.js';

export function createHud(S) {
  const $ = (id) => document.getElementById(id);
  S.hud = {
    stars: $('hud-stars'), health: $('hud-health-fill'), healthWrap: $('hud-health'),
    cash: $('hud-cash'), objective: $('hud-objective'), speed: $('hud-speed'),
    toast: $('hud-toast'), minimap: $('hud-minimap'),
    title: $('screen-title'), pause: $('screen-pause'), over: $('screen-over'),
    overText: $('over-text'), missionName: $('hud-mission-name'),
  };
  const mm = S.hud.minimap;
  S.minimapCtx = mm ? mm.getContext('2d') : null;
  S.toast = (msg) => {
    const t = S.hud.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(S._toastTimer);
    S._toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  };
  S.hudFlash = () => {
    const el = S.hud.stars;
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  };
  S.showScreen = (which) => {
    for (const k of ['title', 'pause', 'over']) {
      const el = S.hud[k];
      if (el) el.classList.toggle('hidden', k !== which);
    }
    const hudEl = document.getElementById('hud');
    if (hudEl) hudEl.classList.toggle('hidden', which === 'title');
  };
}

export function updateHud(S) {
  const h = S.hud;
  if (!h || !h.stars) return;
  // bintang wanted
  const w = Math.round(S.wanted || 0);
  let stars = '';
  for (let i = 0; i < CFG.wantedMax; i++) stars += i < w ? '★' : '☆';
  if (h.stars.textContent !== stars) h.stars.textContent = stars;
  h.stars.classList.toggle('hot', w >= 3);
  // kesehatan + cash
  const hp = clamp(S.player.health / CFG.playerHealthMax, 0, 1);
  h.health.style.width = `${Math.round(hp * 100)}%`;
  h.health.style.background = hp > 0.5 ? '#3fae5a' : hp > 0.25 ? '#e0a020' : '#d83a2a';
  h.cash.textContent = `$${Math.floor(S.player.cash).toLocaleString('en-US')}`;
  // misi + jarak
  if (S.mission) {
    const px = S.player.onFoot ? S.player.x : (S.playerVehicle ? S.playerVehicle.x : S.player.x);
    const pz = S.player.onFoot ? S.player.z : (S.playerVehicle ? S.playerVehicle.z : S.player.z);
    const d = Math.round(dist2(px, pz, S.mission.target.x, S.mission.target.z));
    h.missionName.textContent = S.mission.name;
    let obj = `${S.mission.text} — ${d}m`;
    if (S.mission.secondary) obj += ` · Sekunder: ${S.mission.secondary} (+$${S.mission.bonus})`;
    if (S.mission.timer) obj += ` · ⏱ ${Math.max(0, Math.ceil(S.mission.timer - S.mission.elapsed))}s`;
    h.objective.textContent = obj;
  } else if (S.missionState === 'done') {
    h.missionName.textContent = 'Costa Serena — Bebas';
    h.objective.textContent = 'Semua misi selesai! Jelajahi kota, cari mobil, atau mulai lagi.';
  } else {
    h.missionName.textContent = 'Costa Serena';
    h.objective.textContent = 'Tekan ENTER untuk memulai misi pertama.';
  }
  // kecepatan
  const v = S.playerVehicle;
  h.speed.textContent = v ? `${Math.round(Math.abs(v.speed) * 3.6)} km/h` : '';
  // --- minimap ---
  const ctx = S.minimapCtx;
  if (ctx) {
    const W = 150, half = CFG.worldHalf;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(16,20,26,0.85)';
    ctx.fillRect(0, 0, W, W);
    const toM = (x) => ((x + half) / (half * 2)) * W;
    // jalan
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 3;
    for (let r = -160; r <= 160; r += CFG.roadGap) {
      ctx.beginPath(); ctx.moveTo(0, toM(r)); ctx.lineTo(W, toM(r)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toM(r), 0); ctx.lineTo(toM(r), W); ctx.stroke();
    }
    // pantai + laut
    ctx.fillStyle = '#c9a86a'; ctx.fillRect(toM(150), 0, W - toM(150), W);
    ctx.fillStyle = '#1d6f8e'; ctx.fillRect(toM(190), 0, W - toM(190), W);
    // penanda misi
    if (S.mission) {
      ctx.fillStyle = '#ffc020';
      ctx.beginPath(); ctx.arc(toM(S.mission.target.x), toM(S.mission.target.z), 5, 0, 7); ctx.fill();
    }
    // lalu lintas (putih), polisi (merah)
    ctx.fillStyle = '#d8d8d8';
    for (const t of S.traffic || []) ctx.fillRect(toM(t.x) - 1.5, toM(t.z) - 1.5, 3, 3);
    ctx.fillStyle = '#ff2a2a';
    for (const p of S.police || []) {
      ctx.beginPath(); ctx.arc(toM(p.x), toM(p.z), 3.5, 0, 7); ctx.fill();
    }
    // pemain: panah kuning berarah
    const px = S.player.onFoot ? S.player.x : (S.playerVehicle ? S.playerVehicle.x : S.player.x);
    const pz = S.player.onFoot ? S.player.z : (S.playerVehicle ? S.playerVehicle.z : S.player.z);
    const ang = S.player.onFoot ? S.player.angle : (S.playerVehicle ? S.playerVehicle.angle : S.player.angle);
    ctx.save();
    ctx.translate(toM(px), toM(pz));
    ctx.rotate(Math.atan2(Math.sin(ang), -Math.cos(ang)) + Math.PI / 2);
    ctx.fillStyle = '#ffe040';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
