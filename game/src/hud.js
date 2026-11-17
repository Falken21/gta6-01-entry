// Costa Serena — HUD: wanted stars, health, cash, objective + distance, speed,
// and a live minimap (canvas: roads, player arrow, police blips, objective).
import { CFG, clamp, dist2D } from './config.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    stars: $('hud-stars'), health: $('hud-health-fill'), healthText: $('hud-health-text'),
    cash: $('hud-cash'), objective: $('hud-objective'), objDist: $('hud-obj-dist'),
    speed: $('hud-speed'), timer: $('hud-timer'), flash: $('hud-flash'),
    banner: $('hud-banner'), bannerTitle: $('hud-banner-title'), bannerSub: $('hud-banner-sub'),
    minimap: $('minimap'), crosshair: $('crosshair'),
    toast: $('hud-toast'),
  };
  const mm = el.minimap.getContext('2d');
  let flashT = 0, toastT = 0;

  function flash(text) {
    el.flash.textContent = text;
    el.flash.style.opacity = '1';
    flashT = 1.6;
  }
  function toast(text) {
    el.toast.textContent = text;
    el.toast.style.opacity = '1';
    toastT = 2.2;
  }

  function drawMinimap(G) {
    const S = 168, c = mm;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(8,12,18,0.82)';
    c.fillRect(0, 0, S, S);
    const W = CFG.world;
    const toX = (x) => ((x + W.halfX + 10) / (W.halfX * 2 + 20)) * S;
    const toZ = (z) => ((z + W.halfZ + 10) / (W.halfZ * 2 + 20)) * S;
    // sea
    c.fillStyle = '#164e63';
    c.fillRect(toX(W.beachX0), 0, S - toX(W.beachX0), S);
    // roads
    c.strokeStyle = '#5a6068'; c.lineWidth = 4; c.lineCap = 'round';
    for (const x of CFG.roads.avenues) { c.beginPath(); c.moveTo(toX(x), 0); c.lineTo(toX(x), S); c.stroke(); }
    for (const z of CFG.roads.streets) { c.beginPath(); c.moveTo(0, toZ(z)); c.lineTo(S, toZ(z)); c.stroke(); }
    // objective marker
    const obj = G.missions.objectivePos();
    if (obj) {
      c.fillStyle = '#ffd21a';
      c.beginPath(); c.arc(toX(obj.x), toZ(obj.z), 5, 0, 7); c.fill();
      c.strokeStyle = '#ffd21a'; c.lineWidth = 2;
      c.beginPath(); c.arc(toX(obj.x), toZ(obj.z), 8 + Math.sin(performance.now() / 300) * 2, 0, 7); c.stroke();
    }
    // police blips
    c.fillStyle = '#ff3b30';
    for (const pc of G.police.cars) {
      c.beginPath(); c.arc(toX(pc.pos.x), toZ(pc.pos.z), 3.5, 0, 7); c.fill();
    }
    // player arrow
    const px = G.player.car ? G.player.car.pos.x : G.player.pos.x;
    const pz = G.player.car ? G.player.car.pos.z : G.player.pos.z;
    const heading = G.player.car ? G.player.car.heading : G.player.heading;
    c.save();
    c.translate(toX(px), toZ(pz));
    c.rotate(-heading + Math.PI); // map north = -z up... arrow points along heading
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
  }

  function update(dt, G) {
    // stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.police.wanted ? '★' : '☆';
    el.stars.textContent = stars;
    el.stars.style.color = G.police.wanted > 0 ? '#ffd21a' : '#9aa4b0';
    // health
    const hp = clamp(G.player.health, 0, 100);
    el.health.style.width = `${hp}%`;
    el.health.style.background = hp > 50 ? '#37c978' : hp > 25 ? '#f5a623' : '#e5484d';
    el.healthText.textContent = `${Math.round(hp)}`;
    el.cash.textContent = `$${Math.floor(G.player.cash)}`;
    // objective
    const m = G.missions.current();
    if (m && G.missions.state === 'active') {
      el.objective.textContent = m.objective;
      const obj = G.missions.objectivePos();
      const px = G.player.car ? G.player.car.pos.x : G.player.pos.x;
      const pz = G.player.car ? G.player.car.pos.z : G.player.pos.z;
      el.objDist.textContent = obj ? `${Math.round(dist2D(px, pz, obj.x, obj.z))}m` : '';
      el.timer.textContent = m.timer ? `⏱ ${Math.max(0, Math.ceil(G.missions.timer))}s` : (m.race ? `Gerbang ${G.missions.raceStep}/${G.missions.raceTotal}` : '');
    } else if (m) {
      el.objective.textContent = `Misi berikutnya: ${m.name} — tekan N untuk mulai`;
      el.objDist.textContent = '';
      el.timer.textContent = '';
    } else {
      el.objective.textContent = 'Cerita selesai — jelajahi Costa Serena bebas.';
      el.objDist.textContent = '';
      el.timer.textContent = '';
    }
    // speed
    const sp = G.player.car ? Math.abs(G.player.car.speed) * 3.6 : Math.abs(G.player.speed) * 3.6;
    el.speed.textContent = G.player.car ? `${Math.round(sp)} km/h` : '';
    // banner
    const b = G.missions.banner;
    if (b && b.t > 0) {
      el.banner.style.opacity = '1';
      el.bannerTitle.textContent = b.text;
      el.bannerSub.textContent = b.sub;
    } else {
      el.banner.style.opacity = '0';
    }
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) el.flash.style.opacity = '0'; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.style.opacity = '0'; }
    drawMinimap(G);
  }

  return { update, flash, toast, el };
}
