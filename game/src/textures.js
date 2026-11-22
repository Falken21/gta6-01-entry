// Costa Serena — textures.js
// Semua tekstur dibuat prosedural di canvas (tanpa aset eksternal): aspal aus,
// fasad gedung dengan jendela menyala, trotoar, pasir, dan air. Tekstur, bukan
// warna datar, yang membawa realisme — sesuai Lane D image-craft.
import { CFG, makeRng } from './config.js';

function canvasTexture(THREE, size, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(ctx, size, rng, n, colors, aMin, aMax, sMax) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = aMin + rng.next() * (aMax - aMin);
    ctx.fillStyle = colors[Math.floor(rng.next() * colors.length)];
    const s = 1 + rng.next() * sMax;
    ctx.fillRect(rng.next() * size, rng.next() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

export function buildTextures(THREE) {
  const rng = makeRng(CFG.seed + 77);

  // Aspal aus: dasar gelap + bintik keausan + retakan halus + marka pudar.
  const asphalt = canvasTexture(THREE, 512, (ctx, s) => {
    ctx.fillStyle = '#33343a'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 5200, ['#2a2b30', '#3d3e45', '#45464d', '#232428'], 0.12, 0.5, 3);
    ctx.strokeStyle = 'rgba(20,20,22,0.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      let x = rng.next() * s, y = rng.next() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += rng.range(-26, 26); y += rng.range(-26, 26); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // marka jalan pudar di tengah (dipakai berulang di jalur lurus)
    ctx.fillStyle = 'rgba(230,220,170,0.75)';
    for (let y = 0; y < s; y += 64) ctx.fillRect(s / 2 - 4, y + 8, 8, 34);
  }, 8, 8);

  // Trotoar: ubin beton dengan nat dan noda.
  const sidewalk = canvasTexture(THREE, 512, (ctx, s) => {
    ctx.fillStyle = '#8f8a7c'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 2600, ['#7d786c', '#9d9787', '#6e695e'], 0.15, 0.45, 3);
    ctx.strokeStyle = 'rgba(60,58,50,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo((i * s) / 4, 0); ctx.lineTo((i * s) / 4, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * s) / 4); ctx.lineTo(s, (i * s) / 4); ctx.stroke();
    }
  }, 10, 10);

  // Pasir pantai: butiran hangat + garis ombak tipis.
  const sand = canvasTexture(THREE, 512, (ctx, s) => {
    ctx.fillStyle = '#d9c08a'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 6000, ['#c8a86a', '#e8d5a0', '#b89a5e', '#efe0b0'], 0.15, 0.5, 2);
    ctx.strokeStyle = 'rgba(255,250,230,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(0, rng.next() * s);
      ctx.bezierCurveTo(s * 0.3, rng.next() * s, s * 0.7, rng.next() * s, s, rng.next() * s);
      ctx.stroke();
    }
  }, 6, 6);

  // Fasad gedung: grid jendela + variasi lantai; peta emissive terpisah
  // (jendela menyala hangat saat malam) dibuat dari seed yang sama.
  function facadePair(base, litRatio) {
    const lit = [];
    const color = canvasTexture(THREE, 256, (ctx, s) => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, rng, 700, ['rgba(0,0,0,0.18)', 'rgba(255,255,255,0.10)'], 0.2, 0.6, 2);
      const cols = 6, rows = 10, ww = s / cols, hh = s / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const isLit = rng.next() < litRatio;
          lit.push(isLit);
          ctx.fillStyle = isLit ? '#ffd88a' : '#20242c';
          ctx.fillRect(c * ww + 5, r * hh + 6, ww - 10, hh - 12);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
          ctx.strokeRect(c * ww + 5, r * hh + 6, ww - 10, hh - 12);
        }
      }
    });
    const emissive = canvasTexture(THREE, 256, (ctx, s) => {
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, s, s);
      const cols = 6, rows = 10, ww = s / cols, hh = s / rows;
      let k = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (lit[k++]) { ctx.fillStyle = '#ffbe55'; ctx.fillRect(c * ww + 5, r * hh + 6, ww - 10, hh - 12); }
        }
      }
    });
    return { color, emissive };
  }
  const facades = [
    facadePair('#c9a06a', 0.34), facadePair('#9fb4c0', 0.30),
    facadePair('#b98a7a', 0.36), facadePair('#d8cdb4', 0.28),
    facadePair('#7e9aa8', 0.32), facadePair('#a88f6d', 0.30),
  ];

  // Air marina: dasar biru-hijau dengan kilau gelombang halus.
  const water = canvasTexture(THREE, 256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#2a8ab0'); g.addColorStop(0.5, '#1d6f8e'); g.addColorStop(1, '#0e4a66');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const y = rng.next() * s, x = rng.next() * s, w = 12 + rng.next() * 30;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y - 4, x + w, y); ctx.stroke();
    }
  }, 6, 6);

  // Zebra cross: dipakai sebagai strip di persimpangan.
  const crosswalk = canvasTexture(THREE, 256, (ctx, s) => {
    ctx.fillStyle = '#33343a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(235,232,215,0.9)';
    for (let i = 0; i < 6; i++) ctx.fillRect(8 + i * 42, 10, 22, s - 20);
  });

  return { asphalt, sidewalk, sand, water, crosswalk, facades };
}
