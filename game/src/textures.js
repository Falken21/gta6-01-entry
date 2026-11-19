// Costa Serena — textures.js
// Procedural canvas textures only (no external assets): worn asphalt with lane
// markings, building facades with lit windows, pavements, sand, crosswalks.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './config.js';

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function asphaltTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(11);
    g.fillStyle = '#33343a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 40 + r() * 40;
      g.fillStyle = `rgb(${v | 0},${v | 0},${(v + 6) | 0})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(20,20,24,0.25)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 12 + r() * 30, 6 + r() * 14, r() * 3, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(15,15,18,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = '#d8c95a';
    for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
  }, 1, 8); // one centre dash across the road, dashed along its length
}

export function facadeTexture(base, litRatio, seed) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.08)'); grad.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 10, cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const lit = r() < litRatio;
      g.fillStyle = lit ? (r() < 0.7 ? '#ffd98a' : '#9fd4ff') : '#20242e';
      g.fillRect(x * cw + 5, y * ch + 6, cw - 10, ch - 12);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x * cw + 5, y * ch + 6, cw - 10, 3);
    }
  });
}

export function pavementTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(23);
    g.fillStyle = '#8d8578'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,55,45,0.6)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
    }
    for (let i = 0; i < 900; i++) {
      const v = 120 + r() * 40;
      g.fillStyle = `rgba(${v | 0},${(v - 8) | 0},${(v - 20) | 0},0.5)`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  }, 6, 6);
}

export function sandTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(31);
    g.fillStyle = '#d9c08a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      const v = 190 + r() * 50;
      g.fillStyle = `rgba(${v | 0},${(v - 25) | 0},${(v - 80) | 0},0.6)`;
      g.fillRect(r() * w, r() * h, 2, 1);
    }
  }, 10, 10);
}

export function crosswalkTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#33343a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e6da';
    for (let x = 8; x < w; x += 24) g.fillRect(x, 6, 12, h - 12);
  });
}

export function waterSparkleTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = mulberry32(47);
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const v = 90 + r() * 80;
      g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3, 0, 7); g.fill();
    }
  }, 6, 6);
}
