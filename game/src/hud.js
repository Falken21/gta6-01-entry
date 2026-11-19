// Costa Serena — hud.js
// HUD: wanted stars, health bar, cash, mission objective + distance, speed
// while driving, and a live minimap (canvas: roads, player arrow, police
// blips, objective marker). Title / pause / game-over overlays live here too.
export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.starsEl = document.getElementById('stars');
    this.healthEl = document.getElementById('health-fill');
    this.cashEl = document.getElementById('cash');
    this.objEl = document.getElementById('objective');
    this.speedEl = document.getElementById('speed');
    this.msgEl = document.getElementById('toast');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.msgTimer = 0;
  }
  toast(text, secs = 3) { this.msgEl.textContent = text; this.msgEl.style.opacity = 1; this.msgTimer = secs; }
  update(dt, s) {
    // s: {stars, health, cash, objective{text,dist,time}, speedKmh, player, police, target}
    this.starsEl.textContent = '★'.repeat(s.stars) + '☆'.repeat(Math.max(0, 5 - s.stars));
    this.starsEl.className = s.stars >= 3 ? 'stars hot' : 'stars';
    this.healthEl.style.width = Math.max(0, s.health) + '%';
    this.cashEl.textContent = '$' + s.cash.toLocaleString('en-US');
    if (s.objective) {
      this.objEl.innerHTML = `<b>${s.objective.name}</b> — ${s.objective.label} · ${Math.round(s.objective.dist)}m · ${Math.ceil(s.objective.timeLeft)}s`;
    } else {
      this.objEl.innerHTML = 'Tekan <b>M</b> untuk misi berikutnya · <b>E</b> curi mobil · <b>F</b> tembak';
    }
    this.speedEl.textContent = s.speedKmh > 1 ? Math.round(s.speedKmh) + ' km/h' : '';
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) this.msgEl.style.opacity = 0; }
    this.drawMinimap(s);
  }
  drawMinimap(s) {
    const c = this.mapCtx, S = 150, scale = S / 560;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(12,18,26,0.85)'; c.fillRect(0, 0, S, S);
    // roads
    c.strokeStyle = '#5a6068'; c.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      const p = S / 2 + i * 60 * scale;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, S); c.stroke();
      c.beginPath(); c.moveTo(0, p); c.lineTo(S, p); c.stroke();
    }
    // beach + water
    c.fillStyle = '#d9c08a'; c.fillRect(0, S - 18, S, 18);
    c.fillStyle = '#1d6f8e'; c.fillRect(0, 8, 22, 40);
    // objective marker
    if (s.target) {
      const tx = S / 2 + s.target.x * scale, ty = S / 2 + s.target.z * scale;
      c.fillStyle = '#ffd23e'; c.beginPath(); c.arc(tx, ty, 5, 0, 7); c.fill();
      c.strokeStyle = '#ffd23e'; c.beginPath(); c.arc(tx, ty, 9, 0, 7); c.stroke();
    }
    // police blips
    c.fillStyle = '#3a86ff';
    for (const p of (s.police || [])) {
      c.beginPath(); c.arc(S / 2 + p.x * scale, S / 2 + p.z * scale, 3, 0, 7); c.fill();
    }
    // player arrow
    const px = S / 2 + s.player.x * scale, py = S / 2 + s.player.z * scale;
    c.save(); c.translate(px, py); c.rotate(s.player.heading || 0);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
  }
  showOverlay(id, html) {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = html; el.style.display = 'flex'; }
  }
  hideOverlay(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
}
