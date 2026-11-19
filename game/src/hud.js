// Costa Serena — hud.js
// One job: everything the player reads. Wanted stars, health, cash, the
// mission objective with distance, speed while driving, prompts, toasts,
// and a live minimap (roads, player arrow, police blips, objective marker).
// Title, pause and game-over screens live here too.
import { CFG, clamp } from './config.js';

export function createHud(city) {
  const el = (id) => document.getElementById(id);
  const starsEl = el('stars'), healthFill = el('health-fill'), healthText = el('health-text');
  const cashEl = el('cash'), objEl = el('objective'), speedEl = el('speed');
  const promptEl = el('prompt'), toastEl = el('toast'), timeEl = el('clock');
  const map = el('minimap');
  const mapCtx = map.getContext('2d');
  const titleEl = el('title'), pauseEl = el('pause'), overEl = el('gameover');
  const overStats = el('over-stats');

  let toastTimer = 0;
  let lastToast = '';

  function showToast(text) {
    if (text === lastToast && toastTimer > 1) return;
    lastToast = text;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastTimer = 4;
  }
  function showPrompt(text) {
    if (!text) { promptEl.classList.remove('show'); return; }
    promptEl.textContent = text;
    promptEl.classList.add('show');
  }

  function drawMinimap(playerPos, playerHeading, playerCar, policeCars, objective, time) {
    const W = map.width, H = map.height;
    const scale = W / 480; // world +-240 maps onto the canvas
    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];
    mapCtx.clearRect(0, 0, W, H);
    // sea + sand on the west edge
    mapCtx.fillStyle = '#0e4a5e';
    mapCtx.fillRect(0, 0, toMap(-196, 0)[0], H);
    mapCtx.fillStyle = '#d9c08f';
    mapCtx.fillRect(toMap(-196, 0)[0], 0, toMap(-176, 0)[0] - toMap(-196, 0)[0], H);
    // blocks
    mapCtx.fillStyle = '#3a3f46';
    mapCtx.fillRect(0, 0, W, H);
    // roads
    mapCtx.strokeStyle = '#7d7466';
    mapCtx.lineWidth = 3;
    for (const r of city.roads) {
      mapCtx.beginPath();
      if (r.axis === 'x') {
        const [x1, y] = toMap(-220, r.line);
        const [x2] = toMap(220, r.line);
        mapCtx.moveTo(x1, y); mapCtx.lineTo(x2, y);
      } else {
        const [x, y1] = toMap(r.line, -220);
        const [, y2] = toMap(r.line, 220);
        mapCtx.moveTo(x, y1); mapCtx.lineTo(x, y2);
      }
      mapCtx.stroke();
    }
    // objective marker
    if (objective) {
      const [ox, oy] = toMap(objective.x, objective.z);
      mapCtx.fillStyle = '#ffc400';
      mapCtx.beginPath(); mapCtx.arc(ox, oy, 5, 0, Math.PI * 2); mapCtx.fill();
      mapCtx.strokeStyle = '#fff'; mapCtx.lineWidth = 1.5;
      mapCtx.beginPath(); mapCtx.arc(ox, oy, 8, 0, Math.PI * 2); mapCtx.stroke();
    }
    // police blips
    for (const c of policeCars) {
      const [px, py] = toMap(c.pos.x, c.pos.z);
      mapCtx.fillStyle = '#ff3344';
      mapCtx.beginPath(); mapCtx.arc(px, py, 3.5, 0, Math.PI * 2); mapCtx.fill();
    }
    // player arrow
    const [px, py] = toMap(playerPos.x, playerPos.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(-playerHeading + Math.PI);
    mapCtx.fillStyle = '#fff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 6); mapCtx.lineTo(-5, 6);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.strokeStyle = '#111'; mapCtx.lineWidth = 1; mapCtx.stroke();
    mapCtx.restore();
  }

  function update(dt, s) {
    // s: { wanted, health, cash, objective, objectiveDist, speed, inCar,
    //      hour, playerPos, heading, playerCar, policeCars, objectivePos }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove('show');
    }
    const stars = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 5 - s.wanted));
    starsEl.textContent = stars;
    starsEl.classList.toggle('hot', s.wanted > 0);
    healthFill.style.width = `${clamp(s.health, 0, 100)}%`;
    healthFill.classList.toggle('low', s.health < 30);
    healthText.textContent = `${Math.ceil(s.health)}`;
    cashEl.textContent = `$${s.cash.toLocaleString('en-US')}`;
    const dist = s.objectiveDist != null ? ` — ${Math.round(s.objectiveDist)} m` : '';
    objEl.textContent = s.objective + dist;
    if (s.inCar) {
      speedEl.classList.add('show');
      speedEl.textContent = `${Math.round(Math.abs(s.speed) * 3.6)} km/h`;
    } else {
      speedEl.classList.remove('show');
    }
    const hh = Math.floor(s.hour) % 24;
    const mm = Math.floor((s.hour % 1) * 60);
    timeEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    drawMinimap(s.playerPos, s.heading, s.playerCar, s.policeCars, s.objectivePos, s.hour);
  }

  function showTitle() { titleEl.classList.remove('hidden'); }
  function hideTitle() { titleEl.classList.add('hidden'); }
  function showPause(show) { pauseEl.classList.toggle('hidden', !show); }
  function showGameOver(cash, missionsDone) {
    overStats.textContent = `Uang: $${cash.toLocaleString('en-US')} · Misi selesai: ${missionsDone} / 5`;
    overEl.classList.remove('hidden');
  }
  function hideGameOver() { overEl.classList.add('hidden'); }

  return {
    update, showToast, showPrompt, showTitle, hideTitle,
    showPause, showGameOver, hideGameOver,
  };
}
