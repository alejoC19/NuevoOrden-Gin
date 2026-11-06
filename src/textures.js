import * as THREE from 'three';

const mk = (cv, srgb = true) => {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
};

/* Telar andino: rombos y guardas (se repite cada 256 px en vertical) */
export function weaveTexture([c0, c1, c2], w = 256, h = 1024) {
  const [cv, c] = canvas(w, h);
  c.fillStyle = c0; c.fillRect(0, 0, w, h);
  for (let y0 = 0; y0 < h; y0 += 256) {
    // guardas
    c.fillStyle = c1; c.fillRect(0, y0 + 6, w, 8); c.fillRect(0, y0 + 242, w, 8);
    c.fillStyle = c2; c.fillRect(0, y0 + 18, w, 4); c.fillRect(0, y0 + 234, w, 4);
    // rombos grandes
    for (let k = 0; k < 2; k++) {
      const cx = 64 + k * 128, cy = y0 + 128;
      for (const [r, col] of [[56, c1], [40, c0], [26, c2], [10, c1]]) {
        c.fillStyle = col;
        c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath(); c.fill();
      }
    }
    // triángulos chicos
    c.fillStyle = c2;
    for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, y0 + 40); c.lineTo(x + 16, y0 + 62); c.lineTo(x + 32, y0 + 40); c.fill(); c.beginPath(); c.moveTo(x, y0 + 216); c.lineTo(x + 16, y0 + 194); c.lineTo(x + 32, y0 + 216); c.fill(); }
  }
  // bordes
  c.fillStyle = c1; c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h);
  c.fillStyle = c2; c.fillRect(12, 0, 4, h); c.fillRect(w - 16, 0, 4, h);
  // trama
  for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.07})`; c.fillRect(0, y, w, 1); }
  for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  return mk(cv);
}

/* Faja de papel del cuello con guarda andina */
export function bandTexture(ink = '#5b3a1e') {
  const [cv, c] = canvas(512, 128);
  c.fillStyle = '#e8dbbd'; c.fillRect(0, 0, 512, 128);
  c.fillStyle = ink;
  c.fillRect(0, 8, 512, 5); c.fillRect(0, 115, 512, 5);
  for (let x = 0; x < 512; x += 32) {
    c.beginPath(); c.moveTo(x, 20); c.lineTo(x + 16, 46); c.lineTo(x + 32, 20); c.fill();
    c.beginPath(); c.moveTo(x, 108); c.lineTo(x + 16, 82); c.lineTo(x + 32, 108); c.fill();
    c.beginPath(); c.moveTo(x + 16, 54); c.lineTo(x + 28, 64); c.lineTo(x + 16, 74); c.lineTo(x + 4, 64); c.closePath(); c.fill();
  }
  for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(80,50,20,${Math.random() * 0.08})`; c.fillRect(Math.random() * 512, Math.random() * 128, 2, 2); }
  return mk(cv);
}

export function woodTexture(base = '#5a3820') {
  const [cv, c] = canvas(256, 256);
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    c.strokeStyle = Math.random() > 0.5 ? `rgba(20,8,0,${Math.random() * 0.25})` : `rgba(255,210,150,${Math.random() * 0.1})`;
    c.lineWidth = Math.random() * 2 + 0.4;
    const y = Math.random() * 256;
    c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(80, y + (Math.random() - 0.5) * 10, 170, y + (Math.random() - 0.5) * 10, 256, y + (Math.random() - 0.5) * 6); c.stroke();
  }
  return mk(cv);
}

/* Sello de lacre "ARG" */
export function sealTexture() {
  const [cv, c] = canvas(256, 256);
  const g = c.createRadialGradient(110, 100, 10, 128, 128, 128);
  g.addColorStop(0, '#5a3822'); g.addColorStop(1, '#2a170c');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#7d5a3e'; c.lineWidth = 7;
  c.beginPath(); c.arc(128, 128, 104, 0, 7); c.stroke();
  c.lineWidth = 2; c.beginPath(); c.arc(128, 128, 92, 0, 7); c.stroke();
  c.fillStyle = '#8a6444'; c.font = '700 84px Rye, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('ARG', 128, 136);
  return mk(cv);
}
