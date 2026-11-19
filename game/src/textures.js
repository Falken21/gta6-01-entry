// Costa Serena — textures.js
// Semua tekstur digambar prosedural di canvas (tanpa aset eksternal):
// aspal aus + marka, fasad gedung dengan jendela menyala, trotoar,
// pasir pantai, zebra cross, dan peta normal sederhana dari heightmap.
import * as THREE from '../vendor/three.module.min.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function dataTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// Peta normal kasar dari sebuah canvas grayscale (sobel sederhana).
function normalFrom(grayCanvas, strength = 1.6) {
  const w = grayCanvas.width, h = grayCanvas.height;
  const src = grayCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, x] = canvas(w, h);
  const out = x.createImageData(w, h);
  const at = (px, py) => src[((py + h) % h) * w * 4 + ((px + w) % w) * 4];
  for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
    const dx = (at(x2 + 1, y) - at(x2 - 1, y)) / 255 * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) / 255 * strength;
    const inv = 1 / Math.hypot(dx, dy, 1);
    const i = (y * w + x2) * 4;
    out.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
    out.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
    out.data[i + 2] = inv * 255;
    out.data[i + 3] = 255;
  }
  x.putImageData(out, 0, 0);
  return dataTex(c);
}

export function makeTextures(rng) {
  const T = {};
  // ---- aspal: gelap, bintik aus, retak halus, dua jalur ban lebih halus ----
  // Orientasi kanvas: sumbu-x kanvas = sepanjang jalan, sumbu-y = melintang.
  // Dua varian: V untuk jalan utara-selatan, H untuk jalan timur-barat.
  function asphaltCanvas(horizontal) {
    const [c, x] = canvas(512, 512);
    x.fillStyle = '#26272b'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const g = 28 + rng() * 38;
      x.fillStyle = `rgba(${g},${g},${g + 4},${0.25 + rng() * 0.4})`;
      x.fillRect(rng() * 512, rng() * 512, 1 + rng() * 2, 1 + rng() * 2);
    }
    // jalur ban (lebih gelap & halus) — memanjang sepanjang jalan
    const bands = horizontal ? [150, 362] : [150, 362];
    for (const b of bands) {
      const grd = horizontal
        ? x.createLinearGradient(0, b - 42, 0, b + 42)
        : x.createLinearGradient(b - 42, 0, b + 42, 0);
      grd.addColorStop(0, 'rgba(10,10,12,0)'); grd.addColorStop(0.5, 'rgba(10,10,12,0.55)');
      grd.addColorStop(1, 'rgba(10,10,12,0)');
      x.fillStyle = grd;
      if (horizontal) x.fillRect(0, b - 42, 512, 84); else x.fillRect(b - 42, 0, 84, 512);
    }
    // retak
    x.strokeStyle = 'rgba(10,10,12,0.7)'; x.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      x.beginPath();
      let px = rng() * 512, py = rng() * 512; x.moveTo(px, py);
      for (let s = 0; s < 6; s++) { px += (rng() - 0.5) * 60; py += (rng() - 0.5) * 60; x.lineTo(px, py); }
      x.stroke();
    }
    // garis tengah putus-putus (kuning pudar) + garis tepi putih — sepanjang jalan
    x.fillStyle = 'rgba(214,178,60,0.85)';
    if (horizontal) { for (let px = 0; px < 512; px += 64) x.fillRect(px, 252, 34, 8); }
    else { for (let py = 0; py < 512; py += 64) x.fillRect(252, py, 8, 34); }
    x.fillStyle = 'rgba(235,235,225,0.7)';
    if (horizontal) { x.fillRect(0, 18, 512, 5); x.fillRect(0, 489, 512, 5); }
    else { x.fillRect(18, 0, 5, 512); x.fillRect(489, 0, 5, 512); }
    return c;
  }
  {
    const cV = asphaltCanvas(false);
    T.asphalt = tex(cV);
    T.asphaltRough = dataTex(cV);
    T.asphaltNormal = normalFrom(cV, 1.1);
    const cH = asphaltCanvas(true);
    T.asphaltH = tex(cH);
    T.asphaltHRough = dataTex(cH);
    T.asphaltHNormal = normalFrom(cH, 1.1);
  }
  // ---- trotoar: ubin beton dengan sambungan + noda ----
  {
    const [c, x] = canvas(256, 256);
    x.fillStyle = '#8d877c'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) {
      const g = 120 + rng() * 50;
      x.fillStyle = `rgba(${g},${g - 4},${g - 12},0.3)`;
      x.fillRect(rng() * 256, rng() * 256, 2, 2);
    }
    x.strokeStyle = 'rgba(60,56,48,0.8)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke();
      x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke();
    }
    T.sidewalk = tex(c);
  }
  // ---- pasir pantai: butir + riak halus ----
  {
    const [c, x] = canvas(256, 256);
    x.fillStyle = '#d9c08a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) {
      const g = 190 + rng() * 60;
      x.fillStyle = `rgba(${g},${g - 25},${g - 90},${0.3 + rng() * 0.4})`;
      x.fillRect(rng() * 256, rng() * 256, 1.5, 1.5);
    }
    x.strokeStyle = 'rgba(160,130,80,0.25)'; x.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      x.beginPath();
      for (let px = 0; px <= 256; px += 16) x.lineTo(px, 30 + i * 28 + Math.sin(px * 0.05 + i) * 5);
      x.stroke();
    }
    T.sand = tex(c);
  }
  // ---- zebra cross ----
  {
    const [c, x] = canvas(256, 128);
    x.fillStyle = '#2b2c30'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = 'rgba(240,240,230,0.88)';
    for (let i = 0; i < 8; i++) x.fillRect(8 + i * 31, 8, 20, 112);
    T.crosswalk = tex(c);
  }
  // ---- fasad gedung: 3 varian warna, grid jendela + peta emisif malam ----
  const facadeDefs = [
    { base: '#c8a882', trim: '#8a6a48', lit: 0.42 },
    { base: '#9db3c4', trim: '#5d7a90', lit: 0.55 },
    { base: '#c47f6e', trim: '#8a4a3c', lit: 0.38 },
    { base: '#e8ddc8', trim: '#a89a7c', lit: 0.48 },
  ];
  T.facades = facadeDefs.map((d) => {
    const [c, x] = canvas(256, 512);
    x.fillStyle = d.base; x.fillRect(0, 0, 256, 512);
    // noda cuaca vertikal
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(70,60,45,${0.04 + rng() * 0.08})`;
      x.fillRect(rng() * 256, 0, 3 + rng() * 8, 60 + rng() * 300);
    }
    const [e, ex] = canvas(256, 512);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 512);
    const cols = 5, rows = 9, ww = 30, wh = 30, gx = 14, gy = 18;
    for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
      const px = gx + col * (ww + 12), py = gy + r * (wh + 20);
      const lit = rng() < d.lit;
      const warm = rng();
      x.fillStyle = '#20242c'; x.fillRect(px - 2, py - 2, ww + 4, wh + 4);
      x.fillStyle = lit ? (warm < 0.6 ? '#ffd489' : '#cfe4ff') : '#2c3542';
      x.fillRect(px, py, ww, wh);
      // tirai / pantulan diagonal
      x.fillStyle = 'rgba(255,255,255,0.14)';
      x.beginPath(); x.moveTo(px, py + wh); x.lineTo(px + ww, py); x.lineTo(px + ww, py + 10); x.lineTo(px + 10, py + wh); x.closePath(); x.fill();
      if (lit) { ex.fillStyle = warm < 0.6 ? '#ffca6a' : '#bcd8ff'; ex.fillRect(px, py, ww, wh); }
    }
    // lantai dasar: toko / pintu
    x.fillStyle = d.trim; x.fillRect(0, 470, 256, 42);
    x.fillStyle = 'rgba(20,22,28,0.9)'; x.fillRect(108, 472, 40, 40);
    return {
      map: tex(c), emissive: dataTex(e),
      rough: 0.85,
    };
  });
  // ---- air: normal map riak (di-scroll dua arah saat render) ----
  {
    const [c, x] = canvas(256, 256);
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      const r = 6 + rng() * 26, px = rng() * 256, py = rng() * 256;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    T.waterNormal = normalFrom(c, 2.2);
    T.waterNormal.repeat.set(6, 6);
  }
  // ---- blob shadow (lingkaran radial gelap) untuk kontak tanah ----
  {
    const [c, x] = canvas(128, 128);
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    T.blob = dataTex(c);
  }
  return T;
}
