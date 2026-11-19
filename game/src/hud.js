// Costa Serena — hud.js
// HUD DOM: bintang wanted, kesehatan, cash, objektif + jarak, kecepatan,
// MINIMAP live (jalan, panah pemain, blip polisi, penanda misi), toast,
// layar judul / jeda / game over, crosshair, dan vignette damage.
import { CFG } from './config.js';

export function createHud(W) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="topbar">
      <div id="wanted"></div>
      <div id="cash">$${W.player.cash}</div>
    </div>
    <div id="objective"><div id="obj-main"></div><div id="obj-sub"></div><div id="obj-dist"></div></div>
    <div id="healthbar"><div id="healthfill"></div></div>
    <div id="speed"></div>
    <canvas id="minimap" width="180" height="180"></canvas>
    <div id="crosshair">+</div>
    <div id="toasts"></div>
    <div id="vignette"></div>
    <div id="hint">WASD jalan/nyetir · E masuk/keluar mobil · Klik tembak · N misi · R radio · M bisu · P jeda</div>
    <div id="screen-title" class="screen">
      <div class="title-kicker">KOTA PANTAI · OPEN WORLD · 3D</div>
      <h1>COSTA<br>SERENA</h1>
      <p class="tagline">Rafi, montir kapal yang utang kakaknya menumpuk. Satu kota, lima misi, dan polisi yang tak pernah tidur.</p>
      <button id="btn-play">▶ MULAI BERMAIN</button>
      <p class="controls">WASD bergerak &nbsp;·&nbsp; Mouse putar kamera &nbsp;·&nbsp; E curi mobil &nbsp;·&nbsp; Klik tembak &nbsp;·&nbsp; Spasi rem tangan</p>
    </div>
    <div id="screen-pause" class="screen hidden">
      <h2>JEDA</h2>
      <p>Tekan P untuk lanjut, atau R untuk mulai ulang.</p>
      <button id="btn-resume">▶ LANJUT</button>
      <button id="btn-restart1">↻ MULAI ULANG</button>
    </div>
    <div id="screen-over" class="screen hidden">
      <h2 id="over-title">GAME OVER</h2>
      <p id="over-reason"></p>
      <p id="over-stats"></p>
      <button id="btn-restart2">↻ MAIN LAGI</button>
    </div>`;
  const el = (id) => document.getElementById(id);
  const mapCtx = el('minimap').getContext('2d');

  function setObjective(main, sub = '') {
    el('obj-main').textContent = main;
    el('obj-sub').textContent = sub ? '★ ' + sub : '';
    el('obj-dist').textContent = '';
  }
  function setObjectiveDistance(d) {
    el('obj-dist').textContent = d != null ? `${Math.round(d)} m` : '';
  }
  function toast(msg, kind = 'info') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    el('toasts').appendChild(t);
    setTimeout(() => t.classList.add('fade'), 3600);
    setTimeout(() => t.remove(), 4400);
  }
  function update(dt) {
    // wanted
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < W.police.wanted ? '★' : '☆';
    el('wanted').textContent = stars;
    el('wanted').className = W.police.wanted > 0 ? 'hot' : '';
    el('cash').textContent = '$' + Math.round(W.player.cash);
    el('healthfill').style.width = Math.max(0, W.player.health) + '%';
    el('healthfill').style.background = W.player.health > 50 ? '#3fae5a' : W.player.health > 25 ? '#d8a03a' : '#c23a3a';
    const car = W.player.car;
    el('speed').textContent = car ? `${Math.round(Math.abs(car.speed) * 3.6)} km/j` : '';
    el('crosshair').style.display = (W.player.onFoot && W.state === 'playing') ? 'block' : 'none';
    el('vignette').style.opacity = W.player.health < 40 ? String((40 - W.player.health) / 40 * 0.7) : '0';
    drawMinimap();
  }
  function drawMinimap() {
    const c = mapCtx, S = 180, sc = S / 460;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(12,20,28,0.82)';
    c.fillRect(0, 0, S, S);
    const px = (x) => (x + 230) * sc, pz = (z) => (z + 230) * sc;
    // jalan
    c.strokeStyle = '#5a6068'; c.lineWidth = 4;
    for (const x of CFG.avenues) { c.beginPath(); c.moveTo(px(x), pz(-160)); c.lineTo(px(x), pz(160)); c.stroke(); }
    for (const z of CFG.streets) { c.beginPath(); c.moveTo(px(-220), pz(z)); c.lineTo(px(220), pz(z)); c.stroke(); }
    // laut
    c.fillStyle = '#1d6f7e'; c.fillRect(0, pz(150), S, S - pz(150));
    // objektif
    const obj = W.missions.objectivePos;
    if (obj) {
      c.fillStyle = '#ffd23a';
      c.beginPath(); c.arc(px(obj.x), pz(obj.z), 6, 0, 7); c.fill();
      c.strokeStyle = '#ffd23a'; c.lineWidth = 2;
      c.beginPath(); c.arc(px(obj.x), pz(obj.z), 10, 0, 7); c.stroke();
    }
    // polisi
    c.fillStyle = '#5a8cff';
    for (const cop of W.police.cops) {
      c.beginPath(); c.arc(px(cop.pos.x), pz(cop.pos.z), 4, 0, 7); c.fill();
    }
    // pemain
    const p = W.player.pos;
    c.save();
    c.translate(px(p.x), pz(p.z));
    c.rotate(W.player.onFoot ? W.player.heading : (W.player.car ? W.player.car.heading : 0));
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
  }
  function show(id) { el(id).classList.remove('hidden'); }
  function hide(id) { el(id).classList.add('hidden'); }
  function showTitle() { show('screen-title'); hide('screen-pause'); hide('screen-over'); }
  function showPause() { show('screen-pause'); }
  function hidePause() { hide('screen-pause'); }
  function showOver(reason, stats) {
    el('over-reason').textContent = reason;
    el('over-stats').textContent = stats;
    show('screen-over');
  }
  return {
    update, toast, setObjective, setObjectiveDistance,
    showTitle, showPause, hidePause, showOver, hide: (id) => hide(id), show: (id) => show(id),
  };
}
