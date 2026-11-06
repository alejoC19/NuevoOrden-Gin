import * as THREE from 'three';

const TAU = Math.PI * 2;
export const DISPLAY = '"Rye", "Playfair Display", Georgia, serif';

/* palabras gigantes que se ven detrás (y refractadas en) la botella */
export function makeWordTexture(text, color, { w = 2048, h = 512 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = h * 0.78;
  ctx.font = `400 ${size}px ${DISPLAY}`;
  const mw = ctx.measureText(text).width;
  if (mw > w * 0.94) { size *= (w * 0.94) / mw; ctx.font = `400 ${size}px ${DISPLAY}`; }
  ctx.lineJoin = 'round';
  ctx.fillStyle = color; ctx.globalAlpha = 0.12;
  ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, h * 0.009);
  ctx.strokeText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

/* rodaja de cítrico para los botánicos */
export function makeCitrusTexture(rind = '#ffd23a', flesh = '#fff08a') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.translate(128, 128);
  c.fillStyle = rind; c.beginPath(); c.arc(0, 0, 126, 0, TAU); c.fill();
  c.fillStyle = '#fff7d6'; c.beginPath(); c.arc(0, 0, 112, 0, TAU); c.fill();
  c.fillStyle = flesh;
  for (let i = 0; i < 10; i++) {
    c.save(); c.rotate((i / 10) * TAU);
    c.beginPath(); c.moveTo(6, 0); c.quadraticCurveTo(60, -28, 104, -8); c.lineTo(104, 8); c.quadraticCurveTo(60, 28, 6, 0); c.fill();
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
