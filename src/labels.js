import * as THREE from 'three';
import { BRAND } from './data.js';

const TAU = Math.PI * 2;
export const DISPLAY = '"Bodoni Moda", "Playfair Display", Georgia, serif';

function spaced(ctx, text, x, y, spacing) {
  const chars = [...text];
  const w = chars.map((c) => ctx.measureText(c).width);
  const total = w.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += w[i] + spacing;
  });
}

/* ── emblemas ───────────────────────────────────────────── */
function emblem(ctx, kind, cx, cy, R) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = R * 0.028;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.92, 0, TAU);
  ctx.stroke();
  if (kind === 'sun') {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const long = i % 2 === 0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.46, Math.sin(a) * R * 0.46);
      ctx.lineTo(Math.cos(a) * R * (long ? 0.86 : 0.7), Math.sin(a) * R * (long ? 0.86 : 0.7));
      ctx.stroke();
    }
    for (const [x, y] of [[0, -0.12], [-0.13, 0.1], [0.13, 0.1]]) {
      ctx.beginPath();
      ctx.arc(x * R, y * R, R * 0.12, 0, TAU);
      ctx.fill();
    }
  } else if (kind === 'citrus') {
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.74, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.06, Math.sin(a) * R * 0.06);
      ctx.lineTo(Math.cos(a) * R * 0.74, Math.sin(a) * R * 0.74);
      ctx.stroke();
      const b = a + TAU / 20;
      ctx.beginPath();
      ctx.ellipse(Math.cos(b) * R * 0.42, Math.sin(b) * R * 0.42, R * 0.07, R * 0.03, b, 0, TAU);
      ctx.fill();
    }
  } else if (kind === 'rose') {
    for (let k = 0; k < 4; k++) {
      const n = 5 + k;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + k * 0.4;
        const r = R * (0.2 + k * 0.17);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.62, r * 0.36, a, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.07, 0, TAU);
    ctx.fill();
  } else if (kind === 'moon') {
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.58, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(R * 0.24, -R * 0.1, R * 0.5, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3;
      const rr = R * (i % 2 ? 0.78 : 0.68);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.025, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Dibuja la etiqueta en 3 pasadas (color / metalness / roughness)
 * para tener papel mate + hoja metálica real.
 */
export function makeLabel(v, aspect) {
  const W = 1536;
  const H = Math.round(W / aspect);
  const out = {};
  for (const mode of ['color', 'metal', 'rough']) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const kindCol = {
      color: { paper: v.label.bg, foil: v.label.foil, ink: v.label.ink },
      metal: { paper: '#000', foil: '#fff', ink: '#000' },
      rough: { paper: '#c8c8c8', foil: '#3a3a3a', ink: '#c8c8c8' },
    }[mode];
    const set = (k) => {
      ctx.fillStyle = ctx.strokeStyle = kindCol[k];
    };
    set('paper');
    ctx.fillRect(0, 0, W, H);
    if (mode === 'color') {
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
        ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      }
    }
    // marco doble
    set('foil');
    ctx.lineWidth = 5;
    const m = H * 0.045;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    ctx.lineWidth = 2;
    ctx.strokeRect(m * 1.7, m * 1.7, W - m * 3.4, H - m * 3.4);

    const cx = W / 2;
    // marca
    set('foil');
    ctx.font = `700 ${H * 0.085}px ${DISPLAY}`;
    ctx.textBaseline = 'alphabetic';
    spaced(ctx, BRAND.name.toUpperCase(), cx, H * 0.2, H * 0.03);
    ctx.font = `500 ${H * 0.04}px ${DISPLAY}`;
    spaced(ctx, 'G  I  N  ·  D  E  S  T  I  L  A  D  O  ·  A  R  T  E  S  A  N  A  L', cx, H * 0.255, 4);

    // emblema
    set('foil');
    emblem(ctx, v.emblem, cx, H * 0.47, H * 0.155);

    // nombre
    set('ink');
    ctx.font = `italic 700 ${H * 0.15}px ${DISPLAY}`;
    spaced(ctx, v.name, cx, H * 0.75, 2);

    // pie
    set('foil');
    ctx.font = `600 ${H * 0.04}px ${DISPLAY}`;
    spaced(ctx, `${v.kind.toUpperCase()}   ·   ${v.abv}% VOL   ·   ${v.ml} ML`, cx, H * 0.84, 5);
    ctx.font = `500 ${H * 0.032}px ${DISPLAY}`;
    spaced(ctx, 'LOTE Nº 001  ·  PEQUEÑA PRODUCCIÓN', cx, H * 0.9, 4);

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 16;
    tex.colorSpace = mode === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    out[mode] = tex;
  }
  return { map: out.color, metalnessMap: out.metal, roughnessMap: out.rough };
}

/* ── texturas de fondo gigante (palabras 3D detrás de la botella) ── */
export function makeWordTexture(text, color, { w = 2048, h = 512, outline = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = h * 0.78;
  ctx.font = `800 ${size}px ${DISPLAY}`;
  const mw = ctx.measureText(text).width;
  if (mw > w * 0.94) {
    size *= (w * 0.94) / mw;
    ctx.font = `800 ${size}px ${DISPLAY}`;
  }
  ctx.lineJoin = 'round';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.1;
  ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  ctx.globalAlpha = 1;
  if (outline) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, h * 0.008);
    ctx.strokeText(text, w / 2, h / 2 + size * 0.04);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ── rodaja de cítrico para los botánicos ── */
export function makeCitrusTexture(rind = '#ff9d1c', flesh = '#ffc94d') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.translate(128, 128);
  c.fillStyle = rind;
  c.beginPath();
  c.arc(0, 0, 126, 0, TAU);
  c.fill();
  c.fillStyle = '#fff3d6';
  c.beginPath();
  c.arc(0, 0, 112, 0, TAU);
  c.fill();
  c.fillStyle = flesh;
  for (let i = 0; i < 10; i++) {
    c.save();
    c.rotate((i / 10) * TAU);
    c.beginPath();
    c.moveTo(6, 0);
    c.quadraticCurveTo(60, -28, 104, -8);
    c.lineTo(104, 8);
    c.quadraticCurveTo(60, 28, 6, 0);
    c.fill();
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
