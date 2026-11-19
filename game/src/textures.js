// Costa Serena — textures.js
// One job: every texture is painted in code on canvases (no external assets).
// Asphalt with wear and lane paint, lit-window facades, pavements, sand,
// crosswalks, water sparkle and palm bark. Each maker takes the seeded RNG
// so the same seed paints the same city.
import * as THREE from 'three';
import { mulberry32, range } from './config.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function speckle(ctx, rng, w, h, n, colours, sizeMax) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colours[Math.floor(rng() * colours.length)];
    ctx.globalAlpha = 0.05 + rng() * 0.22;
    const s = 1 + rng() * sizeMax;
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

// Worn asphalt: dark grey base, aggregate speckle, faint cracks, oil stains.
export function asphaltTexture(seed) {
  const rng = mulberry32(seed);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#33363b'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, rng, 256, 256, 2600, ['#45484e', '#2a2d31', '#3d4046', '#55585e'], 3);
  // cracks
  ctx.strokeStyle = 'rgba(18,18,20,0.55)'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = rng() * 256, y = rng() * 256;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += (rng() - 0.5) * 46; y += (rng() - 0.5) * 46; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // oil stains
  for (let i = 0; i < 5; i++) {
    const g = ctx.createRadialGradient(rng() * 256, rng() * 256, 2, rng() * 256, rng() * 256, 26 + rng() * 22);
    g.addColorStop(0, 'rgba(10,10,12,0.35)'); g.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  }
  return tex(c, 6, 6);
}

// Road strip: asphalt with a centre dashed line and edge lines, tiled along
// the road. `horizontal` draws the dashes along the canvas X axis (for
// roads running east-west); the default runs them along Y (north-south).
export function roadStripTexture(seed, horizontal = false) {
  const rng = mulberry32(seed + 7);
  const W = horizontal ? 512 : 128, H = horizontal ? 128 : 512;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#33363b'; ctx.fillRect(0, 0, W, H);
  speckle(ctx, rng, W, H, 1400, ['#45484e', '#2a2d31', '#3d4046'], 3);
  ctx.fillStyle = '#e8e4d2';
  if (horizontal) {
    ctx.fillRect(0, 4, W, 3); ctx.fillRect(0, H - 7, W, 3);
    for (let x = 0; x < W; x += 64) {
      ctx.globalAlpha = 0.75 + rng() * 0.25;
      ctx.fillRect(x + 6, H / 2 - 3, 34, 6);
    }
  } else {
    ctx.fillRect(4, 0, 3, H); ctx.fillRect(W - 7, 0, 3, H);
    for (let y = 0; y < H; y += 64) {
      ctx.globalAlpha = 0.75 + rng() * 0.25;
      ctx.fillRect(W / 2 - 3, y + 6, 6, 34);
    }
  }
  ctx.globalAlpha = 1;
  return tex(c);
}

// Zebra crossing strip.
export function crosswalkTexture() {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#33363b'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#ddd8c4';
  for (let x = 8; x < 128; x += 20) ctx.fillRect(x, 6, 11, 116);
  return tex(c);
}

// Pavement: warm concrete slabs with joints and stains.
export function pavementTexture(seed) {
  const rng = mulberry32(seed + 21);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#8d8578'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, rng, 256, 256, 1500, ['#9a9184', '#7d7466', '#a39a8b'], 3);
  ctx.strokeStyle = 'rgba(60,54,46,0.5)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
  }
  return tex(c, 8, 8);
}

// Beach sand with fine grain and soft ripples.
export function sandTexture(seed) {
  const rng = mulberry32(seed + 33);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#d9c08f'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, rng, 256, 256, 2400, ['#c9ab72', '#e8d3a4', '#b89a63'], 2);
  ctx.strokeStyle = 'rgba(180,150,100,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const y = rng() * 256;
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) ctx.lineTo(x, y + Math.sin(x / 40 + i) * 6);
    ctx.stroke();
  }
  return tex(c, 10, 10);
}

// Building facade: coloured plaster/concrete, a window grid, shop awnings on
// the ground floor for some variants. Returns { map, emissive } — the
// emissive map lights the windows at night through material.emissiveIntensity.
export function facadeTexture(seed, base, accent) {
  const rng = mulberry32(seed);
  const W = 256, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  speckle(ctx, rng, W, H, 900, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.10)'], 4);
  // floor bands
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let y = 0; y < H; y += 64) ctx.fillRect(0, y, W, 3);
  // windows
  const cols = 4 + Math.floor(rng() * 3);
  const rows = 6 + Math.floor(rng() * 3);
  const lit = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 14 + col * ((W - 28) / cols);
      const y = 18 + r * ((H - 40) / rows);
      const w = (W - 28) / cols - 10, h = (H - 40) / rows - 14;
      const isLit = rng() < 0.55;
      lit.push({ x, y, w, h, isLit, warm: rng() < 0.75 });
      ctx.fillStyle = '#20242c';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = isLit ? (rng() < 0.75 ? '#ffd98a' : '#cfe4ff') : '#2e3742';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, w, 3);
    }
  }
  // ground-floor shopfront / awning
  if (rng() < 0.6) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, H - 58, W, 14);
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(10, H - 44, W - 20, 44);
    ctx.fillStyle = '#ffd98a';
    for (let x = 20; x < W - 20; x += 26) ctx.fillRect(x, H - 38, 16, 30);
  }
  const map = tex(c);
  // Emissive map: only lit windows glow.
  const [ec, ectx] = canvas(W, H);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  for (const win of lit) {
    if (!win.isLit) continue;
    ectx.fillStyle = win.warm ? '#ffca6a' : '#9fc4ff';
    ectx.fillRect(win.x, win.y, win.w, win.h);
  }
  const emissive = tex(ec);
  return { map, emissive };
}

// Water: deep teal with moving sparkle flecks; the city animates its offset.
export function waterTexture(seed) {
  const rng = mulberry32(seed + 55);
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#0e4a5e'); g.addColorStop(0.5, '#14617a'); g.addColorStop(1, '#0b3d50');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(190,235,255,0.35)' : 'rgba(255,255,255,0.22)';
    const s = 1 + rng() * 4;
    ctx.fillRect(rng() * 256, rng() * 256, s, 1);
  }
  const t = tex(c, 8, 8);
  return t;
}

// Palm bark: vertical fibrous streaks.
export function barkTexture(seed) {
  const rng = mulberry32(seed + 71);
  const [c, ctx] = canvas(64, 256);
  ctx.fillStyle = '#6d5136'; ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = rng() < 0.5 ? 'rgba(40,26,14,0.5)' : 'rgba(150,115,80,0.45)';
    ctx.lineWidth = 1 + rng() * 2;
    const x = rng() * 64;
    ctx.beginPath(); ctx.moveTo(x, rng() * 256); ctx.lineTo(x + (rng() - 0.5) * 8, rng() * 256); ctx.stroke();
  }
  return tex(c);
}
