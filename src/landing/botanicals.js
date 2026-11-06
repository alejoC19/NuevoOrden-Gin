import * as THREE from 'three';

/* ───────────── ruido procedural (determinista) ───────────── */
const h3 = (x, y, z) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), fx), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), fx), fy),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), fx), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), fx), fy),
    fz,
  );
}
function fbm(x, y, z, oct = 4) {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2; a *= 0.5; }
  return s / 0.9375;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/* textura de color + relieve a partir de ruido fbm (se repite sin costuras en u) */
function procTexture({ size, base, hi, scale = 6, stretch = [1, 1], contrast = 1, oct = 4, seed = 0 }) {
  const cv = document.createElement('canvas'), bv = document.createElement('canvas');
  cv.width = cv.height = bv.width = bv.height = size;
  const cc = cv.getContext('2d'), bc = bv.getContext('2d');
  const ci = cc.createImageData(size, size), bi = bc.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const ang = u * Math.PI * 2; // sin costura horizontal
      const n = Math.pow(Math.min(1, Math.max(0, fbm(Math.cos(ang) * scale * stretch[0] + seed, v * scale * stretch[1], Math.sin(ang) * scale * stretch[0] + seed, oct))), contrast);
      const i = (y * size + x) * 4;
      ci.data[i] = base[0] + (hi[0] - base[0]) * n;
      ci.data[i + 1] = base[1] + (hi[1] - base[1]) * n;
      ci.data[i + 2] = base[2] + (hi[2] - base[2]) * n;
      ci.data[i + 3] = 255;
      const b = 90 + n * 150;
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = b; bi.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0); bc.putImageData(bi, 0, 0);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping; map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bv); bump.wrapS = THREE.RepeatWrapping;
  return { map, bump };
}

/* hoja con nervaduras */
function leafTexture(size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, size); g.addColorStop(0, '#6fa254'); g.addColorStop(1, '#3f6e33');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  c.strokeStyle = 'rgba(210,235,170,.55)'; c.lineWidth = size / 64;
  c.beginPath(); c.moveTo(size / 2, 0); c.lineTo(size / 2, size); c.stroke();
  c.lineWidth = size / 110;
  for (let i = 1; i < 8; i++) { const y = (i / 8) * size; c.beginPath(); c.moveTo(size / 2, y); c.lineTo(size * 0.1, y - size * 0.16); c.moveTo(size / 2, y); c.lineTo(size * 0.9, y - size * 0.16); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ───────────── materiales (cacheados por calidad) ───────────── */
const cache = new Map();
function material(kind, hiQ) {
  const key = kind + (hiQ ? 'H' : 'L');
  if (cache.has(key)) return cache.get(key);
  const size = hiQ ? 256 : 128;
  const P = (o) => procTexture({ size, ...o });
  let m;
  switch (kind) {
    case 'juniper': { const t = P({ base: [20, 22, 50], hi: [92, 100, 148], scale: 5, contrast: 2.2, seed: 1 }); m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.25, sheenColor: new THREE.Color('#8f9ac8') }); break; }
    case 'coriander': { const t = P({ base: [138, 94, 42], hi: [190, 142, 80], scale: 6, stretch: [1, 2.5], seed: 2 }); m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2, roughness: 0.72 }); break; }
    case 'cardamom': { const t = P({ base: [112, 116, 52], hi: [172, 170, 100], scale: 3, stretch: [1, 8], seed: 3 }); m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 3, roughness: 0.78 }); break; }
    case 'allspice': { const t = P({ base: [74, 46, 28], hi: [128, 88, 54], scale: 11, seed: 4 }); m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 3, roughness: 0.9 }); break; }
    case 'angelica': { const t = P({ base: [160, 128, 80], hi: [208, 180, 128], scale: 4, stretch: [1, 9], seed: 5 }); m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 4, roughness: 0.88 }); break; }
    case 'grains': { const t = P({ base: [52, 22, 12], hi: [112, 52, 28], scale: 8, seed: 6 }); m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.5, flatShading: true }); break; }
    case 'lemon': { const t = P({ base: [246, 206, 52], hi: [255, 236, 128], scale: 20, oct: 3, seed: 7 }); m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2.2, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45, side: THREE.DoubleSide }); break; }
    case 'seaweed': { const t = P({ base: [34, 60, 34], hi: [116, 154, 66], scale: 3, stretch: [1, 6], seed: 8 }); m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.4, roughness: 0.42, sheen: 0.8, sheenColor: new THREE.Color('#b6cf78'), side: THREE.DoubleSide }); break; }
    case 'calafate': { const t = P({ base: [30, 24, 70], hi: [118, 102, 172], scale: 7, contrast: 2.0, seed: 9 }); m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.8, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color('#b9a8e0') }); break; }
    case 'leaf': { const map = leafTexture(hiQ ? 256 : 128); m = new THREE.MeshStandardMaterial({ map, roughness: 0.5, side: THREE.DoubleSide, color: '#bcd6a0' }); break; }
    case 'dark': m = new THREE.MeshStandardMaterial({ color: '#171a3a', roughness: 0.6 }); break;
    default: m = new THREE.MeshStandardMaterial({ color: '#ccc' });
  }
  cache.set(key, m);
  return m;
}

/* ───────────── geometrías ───────────── */
const geoCache = new Map();
const memo = (k, fn) => (geoCache.has(k) ? geoCache.get(k) : (geoCache.set(k, fn()), geoCache.get(k)));

function roughSphere(r, ws, hs, amp, freq, seed, ridges = 0, ridgeAmp = 0) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * freq + seed, v.y * freq, v.z * freq, 3) - 0.5;
    let k = 1 + n * amp;
    if (ridges) k *= 1 + ridgeAmp * Math.cos(Math.atan2(v.z, v.x) * ridges) * Math.sqrt(Math.max(0, 1 - (v.y / r) ** 2));
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/* ───────────── constructores de cada ingrediente ───────────── */
function scatter(R, n, seed, minD = 0.12) {
  const r = rng(seed), pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < 400) {
    const p = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (p.length() > 1) continue;
    p.multiplyScalar(R);
    if (pts.every((q) => q.distanceTo(p) > minD)) pts.push(p);
  }
  return pts;
}
const randRot = (o, r) => o.rotation.set(r() * 6.28, r() * 6.28, r() * 6.28);

const BUILD = {
  juniper(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const geo = memo('jun' + hiQ, () => { const x = roughSphere(0.105, hiQ ? 28 : 16, hiQ ? 20 : 12, 0.07, 9, 1); return x; });
    const crown = memo('junc', () => new THREE.TorusGeometry(0.028, 0.009, 6, 14));
    for (const p of scatter(0.3, hiQ ? 7 : 5, seed, 0.2)) {
      const m = new THREE.Mesh(geo, material('juniper', hiQ)); m.position.copy(p); randRot(m, r);
      const c = new THREE.Mesh(crown, material('dark', hiQ)); c.position.set(0, 0.1, 0); c.rotation.x = Math.PI / 2; m.add(c);
      g.add(m);
    }
    return g;
  },
  coriander(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const geo = memo('cor' + hiQ, () => roughSphere(0.085, hiQ ? 24 : 14, hiQ ? 16 : 10, 0.05, 6, 2, 8, 0.075));
    for (const p of scatter(0.3, hiQ ? 12 : 8, seed, 0.13)) { const m = new THREE.Mesh(geo, material('coriander', hiQ)); m.position.copy(p); randRot(m, r); g.add(m); }
    return g;
  },
  cardamom(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const geo = memo('car' + hiQ, () => {
      const s = new THREE.SphereGeometry(1, hiQ ? 36 : 20, hiQ ? 22 : 12);
      const p = s.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const ang = Math.atan2(v.z, v.x), e = 1 + 0.16 * Math.cos(ang * 3);
        p.setXYZ(i, v.x * 0.085 * e, v.y * 0.27, v.z * 0.085 * e);
      }
      s.rotateZ(Math.PI / 2); s.computeVertexNormals(); return s;
    });
    [[-0.12, 0.1, 0.05], [0.1, -0.1, -0.05], [0.0, 0.26, -0.1]].slice(0, hiQ ? 3 : 2).forEach((pos) => {
      const m = new THREE.Mesh(geo, material('cardamom', hiQ)); m.position.set(...pos); m.rotation.set(r() * 1.5, r() * 6.28, r() * 1.5); g.add(m);
    });
    return g;
  },
  allspice(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const geo = memo('all' + hiQ, () => roughSphere(0.095, hiQ ? 26 : 14, hiQ ? 18 : 10, 0.16, 12, 4));
    const ring = memo('allr', () => new THREE.TorusGeometry(0.03, 0.012, 6, 12));
    for (const p of scatter(0.3, hiQ ? 8 : 6, seed, 0.17)) {
      const m = new THREE.Mesh(geo, material('allspice', hiQ)); m.position.copy(p); randRot(m, r);
      const c = new THREE.Mesh(ring, material('allspice', hiQ)); c.position.set(0, 0.095, 0); c.rotation.x = Math.PI / 2; m.add(c);
      g.add(m);
    }
    return g;
  },
  angelica(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const mk = (s) => memo('ang' + hiQ + s, () => {
      const c = new THREE.CylinderGeometry(0.052, 0.03, 0.62, hiQ ? 16 : 10, hiQ ? 18 : 10);
      const p = c.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = (fbm(v.x * 14 + s, v.y * 9, v.z * 14, 3) - 0.5) * 0.5;
        const k = 1 + n + 0.1 * Math.sin(v.y * 40 + s);
        p.setXYZ(i, v.x * k + Math.sin(v.y * 5 + s) * 0.05, v.y, v.z * k);
      }
      c.computeVertexNormals(); return c;
    });
    [[0, 0, 0, 1], [0.1, -0.06, 0.1, 2], [-0.1, 0.08, -0.08, 3]].slice(0, hiQ ? 3 : 2).forEach(([x, y, z, s]) => {
      const m = new THREE.Mesh(mk(s), material('angelica', hiQ)); m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 6, r() * 3); g.add(m);
    });
    return g;
  },
  grains(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const geo = memo('gra' + hiQ, () => {
      const s = new THREE.IcosahedronGeometry(0.05, 1); const p = s.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 0.78 + h3(Math.round(p.getX(i) * 400), Math.round(p.getY(i) * 400), Math.round(p.getZ(i) * 400)) * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k); }
      s.computeVertexNormals(); return s;
    });
    for (const p of scatter(0.3, hiQ ? 18 : 11, seed, 0.1)) { const m = new THREE.Mesh(geo, material('grains', hiQ)); m.position.copy(p); randRot(m, r); m.scale.setScalar(0.85 + r() * 0.5); g.add(m); }
    return g;
  },
  lemon(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const mk = (turns, R, H, W, s) => memo('lem' + hiQ + s, () => {
      const N = hiQ ? 90 : 48, pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, a = t * Math.PI * 2 * turns, rad = R * (1 - 0.25 * t);
        const c = new THREE.Vector3(Math.cos(a) * rad, t * H - H / 2, Math.sin(a) * rad);
        const tan = new THREE.Vector3(-Math.sin(a) * rad, H / (Math.PI * 2 * turns), Math.cos(a) * rad).normalize();
        const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const bin = new THREE.Vector3().crossVectors(tan, out).normalize();
        const w = W * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.1)));
        for (const sgn of [-1, 1]) { const q = c.clone().addScaledVector(bin, sgn * w / 2).addScaledVector(out, sgn * 0.01 * Math.sin(t * 20)); pos.push(q.x, q.y, q.z); uv.push(t * 3, sgn > 0 ? 1 : 0); }
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      gg.setIndex(idx); gg.computeVertexNormals(); return gg;
    });
    [[1.15, 0.15, 0.5, 0.2, 'a', [0, 0, 0]], [0.9, 0.12, 0.36, 0.17, 'b', [0.16, -0.1, 0.1]]].slice(0, hiQ ? 2 : 1).forEach(([t, R, H, W, s, p]) => {
      const m = new THREE.Mesh(mk(t, R, H, W, s), material('lemon', hiQ)); m.position.set(...p); m.rotation.set(r() * 1.2, r() * 6, r() * 1.2); g.add(m);
    });
    return g;
  },
  seaweed(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const mk = (s, L) => memo('sea' + hiQ + s, () => {
      const p = new THREE.PlaneGeometry(0.34, L, hiQ ? 8 : 4, hiQ ? 40 : 22), a = p.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i), y = a.getY(i), t = (y + L / 2) / L;
        const taper = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.08));
        a.setXYZ(i, x * taper + Math.sin(y * 3.2 + s) * 0.13 * t, y, Math.cos(y * 2.6 + s) * 0.1 + Math.sin(y * 16 + x * 40 + s) * 0.014);
      }
      p.computeVertexNormals(); return p;
    });
    [[1, 1.15, 0, 0], [2, 0.9, 0.2, 0.05], [3, 1.0, -0.2, -0.06]].slice(0, hiQ ? 3 : 2).forEach(([s, L, x, z]) => {
      const m = new THREE.Mesh(mk(s, L), material('seaweed', hiQ)); m.position.set(x, 0, z); m.rotation.set((r() - 0.5) * 0.3, (r() - 0.5) * 0.9, (r() - 0.5) * 0.3); g.add(m);
    });
    return g;
  },
  calafate(hiQ, seed) {
    const g = new THREE.Group(), r = rng(seed);
    const geo = memo('cal' + hiQ, () => roughSphere(0.085, hiQ ? 28 : 16, hiQ ? 20 : 12, 0.04, 8, 9));
    const crown = memo('calc', () => new THREE.TorusGeometry(0.024, 0.008, 6, 5));
    for (const p of scatter(0.28, hiQ ? 9 : 6, seed, 0.17)) {
      const m = new THREE.Mesh(geo, material('calafate', hiQ)); m.position.copy(p); randRot(m, r);
      const c = new THREE.Mesh(crown, material('dark', hiQ)); c.position.set(0, 0.082, 0); c.rotation.x = Math.PI / 2; m.add(c);
      g.add(m);
    }
    // hojas pequeñas y coriáceas del calafate, con la punta espinosa
    const leaf = memo('leaf' + hiQ, () => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.09, 0.03, 0.1, 0.18, 0.05, 0.25); s.lineTo(0.02, 0.3); s.lineTo(0, 0.26); s.lineTo(-0.02, 0.3); s.lineTo(-0.05, 0.25); s.bezierCurveTo(-0.1, 0.18, -0.09, 0.03, 0, 0);
      const l = new THREE.ShapeGeometry(s, 10); const p = l.attributes.position, uv = l.attributes.uv;
      for (let i = 0; i < p.count; i++) { uv.setXY(i, p.getX(i) / 0.2 + 0.5, p.getY(i) / 0.3); p.setZ(i, p.getX(i) ** 2 * 3.5 + p.getY(i) * 0.1); }
      l.computeVertexNormals(); return l;
    });
    for (let i = 0; i < (hiQ ? 6 : 4); i++) {
      const m = new THREE.Mesh(leaf, material('leaf', hiQ)); m.position.set((r() - 0.5) * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.4); m.rotation.set(r() * 3, r() * 6, r() * 3); m.scale.setScalar(0.9 + r() * 0.5); g.add(m);
    }
    return g;
  },
};

/** Crea un botánico listo para la escena: centrado en su caja y con su radio medido (userData.radius). */
export function createIngredient(kind, hiQ, seed = 1) {
  const inner = (BUILD[kind] || BUILD.juniper)(hiQ, seed);
  const box = new THREE.Box3().setFromObject(inner), c = box.getCenter(new THREE.Vector3());
  inner.position.sub(c);
  const g = new THREE.Group();
  g.add(inner);
  g.userData.radius = Math.max(0.05, box.getSize(new THREE.Vector3()).length() / 2);
  g.userData.flat = kind === 'seaweed' || kind === 'lemon';
  const r = rng(seed * 7 + 3);
  g.userData.spin = new THREE.Vector3((r() - 0.5) * 0.5, 0.2 + r() * 0.3, (r() - 0.5) * 0.3);
  g.userData.drift = { f: [0.5 + r() * 0.5, 0.4 + r() * 0.5, 0.35 + r() * 0.4], p: [r() * 6.28, r() * 6.28, r() * 6.28], a: [0.05 + r() * 0.04, 0.06 + r() * 0.05, 0.05 + r() * 0.04] };
  return g;
}
