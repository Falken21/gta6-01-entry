// Costa Serena — procedural canvas textures. No external assets: every surface
// is painted in code (asphalt wear, lit-window facades, sand, zebra crossings).
import { makeCanvas, canvasTexture, makeRng } from './config.js';

function noiseSpeckle(ctx, w, h, rng, n, alpha, light) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${(rng.next() * alpha).toFixed(3)})`;
    ctx.fillRect(rng.next() * w, rng.next() * h, 1 + rng.next() * 2, 1 + rng.next() * 2);
  }
}

export function asphaltTexture(rng) {
  const c = makeCanvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#484b50'; x.fillRect(0, 0, 256, 256);
  noiseSpeckle(x, 256, 256, rng, 2600, 0.16, false);
  noiseSpeckle(x, 256, 256, rng, 900, 0.10, true);
  // wear patches / repairs
  for (let i = 0; i < 7; i++) {
    x.fillStyle = `rgba(20,20,22,${0.10 + rng.next() * 0.12})`;
    x.beginPath();
    x.ellipse(rng.next() * 256, rng.next() * 256, 20 + rng.next() * 40, 12 + rng.next() * 24, rng.next() * 3, 0, 7);
    x.fill();
  }
  // cracks
  x.strokeStyle = 'rgba(12,12,14,0.55)'; x.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    x.beginPath();
    let px = rng.next() * 256, py = rng.next() * 256;
    x.moveTo(px, py);
    for (let s = 0; s < 5; s++) { px += (rng.next() - 0.5) * 36; py += (rng.next() - 0.5) * 36; x.lineTo(px, py); }
    x.stroke();
  }
  // centre dashed line (drawn along the tile edge so it repeats down the road)
  x.fillStyle = '#d8c95a';
  x.fillRect(124, 0, 8, 70); x.fillRect(124, 128, 8, 70);
  return canvasTexture(c, 1, 6);
}

export function sidewalkTexture(rng) {
  const c = makeCanvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#8d8578'; x.fillRect(0, 0, 256, 256);
  noiseSpeckle(x, 256, 256, rng, 1800, 0.12, false);
  x.strokeStyle = 'rgba(60,54,46,0.7)'; x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke();
    x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke();
  }
  return canvasTexture(c, 1, 1);
}

export function sandTexture(rng) {
  const c = makeCanvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#d9c28f'; x.fillRect(0, 0, 256, 256);
  noiseSpeckle(x, 256, 256, rng, 3200, 0.14, false);
  noiseSpeckle(x, 256, 256, rng, 1200, 0.10, true);
  x.fillStyle = 'rgba(190,160,110,0.35)';
  for (let i = 0; i < 12; i++) { x.beginPath(); x.ellipse(rng.next() * 256, rng.next() * 256, 14 + rng.next() * 30, 6 + rng.next() * 10, rng.next() * 3, 0, 7); x.fill(); }
  return canvasTexture(c, 8, 8);
}

export function grassTexture(rng) {
  const c = makeCanvas(128, 128), x = c.getContext('2d');
  x.fillStyle = '#5d7a3a'; x.fillRect(0, 0, 128, 128);
  noiseSpeckle(x, 128, 128, rng, 1400, 0.25, false);
  noiseSpeckle(x, 128, 128, rng, 700, 0.18, true);
  return canvasTexture(c, 6, 6);
}

// Facade: window grid on a coloured wall. Returns {map, emissive} — the emissive
// canvas has only the windows, so at night they glow while the wall stays dark.
export function facadeTextures(rng, base, floors, cols) {
  const W = 128, H = 256;
  const map = makeCanvas(W, H), mx = map.getContext('2d');
  const emi = makeCanvas(W, H), ex = emi.getContext('2d');
  mx.fillStyle = base; mx.fillRect(0, 0, W, H);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  noiseSpeckle(mx, W, H, rng, 500, 0.10, false);
  // ground-floor shop band
  mx.fillStyle = 'rgba(20,18,16,0.85)'; mx.fillRect(0, H - 26, W, 26);
  ex.fillStyle = '#ffb45e'; ex.fillRect(4, H - 22, W - 8, 18);
  const cw = W / cols, ch = (H - 30) / floors;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const wx = 6 + col * cw, wy = 8 + f * ch, ww = cw - 12, wh = ch - 14;
      const lit = rng.chance(0.55);
      mx.fillStyle = lit ? '#ffe6a8' : '#20242c';
      mx.fillRect(wx, wy, ww, wh);
      mx.strokeStyle = 'rgba(0,0,0,0.5)'; mx.lineWidth = 2; mx.strokeRect(wx, wy, ww, wh);
      if (lit) {
        ex.fillStyle = rng.pick(['#ffd27a', '#ffb45e', '#fff2c0', '#9fd8ff']);
        ex.fillRect(wx, wy, ww, wh);
      }
    }
  }
  return { map: canvasTexture(map), emissive: canvasTexture(emi) };
}

export function zebraTexture() {
  const c = makeCanvas(128, 64), x = c.getContext('2d');
  x.fillStyle = '#33363b'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#e8e6da';
  for (let i = 0; i < 6; i++) x.fillRect(6 + i * 21, 4, 12, 56);
  return canvasTexture(c, 1, 1);
}

export function radialGlowTexture() {
  const c = makeCanvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return canvasTexture(c);
}

export function smokeTexture(rng) {
  const c = makeCanvas(64, 64), x = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const r = 8 + rng.next() * 18;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, r);
    g.addColorStop(0, 'rgba(200,200,200,0.35)');
    g.addColorStop(1, 'rgba(200,200,200,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(32 + (rng.next() - 0.5) * 20, 32 + (rng.next() - 0.5) * 20, r, 0, 7); x.fill();
  }
  return canvasTexture(c);
}
