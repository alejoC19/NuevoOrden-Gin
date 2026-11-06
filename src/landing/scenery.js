import * as THREE from 'three';

/* Escenografía 3D propia de cada gin. Toda queda dentro de la "zona visual" del capítulo
   (nunca invade la columna de texto) y es sutil: acompaña a la botella, no compite con ella. */

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

function dust({ n, color, size, alpha }) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([hash(i * 3.1) - 0.5, hash(i * 5.7), hash(i * 9.3) - 0.5], i * 3); seed[i] = hash(i * 1.7 + 4); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const u = { uTime: { value: 0 }, uBox: { value: new THREE.Vector3(2, 2, 1) }, uAlpha: { value: 0 }, uPx: { value: 1 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uRise: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `attribute float seed; uniform float uTime, uPx, uSize, uRise; uniform vec3 uBox; varying float vA;
      void main(){ vec3 p = position * uBox; float k = fract(position.y + uTime*0.03*(0.4+seed)*uRise); p.y = (k - 0.5) * uBox.y; p.x += sin(uTime*0.4 + seed*30.0) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_PointSize = (1.5 + seed*3.0) * uSize * uPx * (9.0 / -mv.z);
        vA = (0.35 + 0.65*seed) * (0.5 + 0.5*sin(uTime*(0.7+seed) + seed*20.0)) * smoothstep(0.0,0.15,k) * smoothstep(1.0,0.8,k); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uAlpha; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(uColor, smoothstep(0.5,0.0,d) * vA * uAlpha); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 4;
  return { points: p, u, alpha: alpha };
}

/* ───────── CÍTRICO & MAR: ondas en el piso, rocío de mar y cantos rodados de la costa ───────── */
export function createSea(hiQ) {
  const group = new THREE.Group();
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, hiQ ? 128 : 64), new THREE.MeshBasicMaterial({ color: '#4fa996', transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 1; group.add(m); return m;
  });
  const spray = dust({ n: hiQ ? 46 : 22, color: '#7cc7b8', size: 1.1, alpha: 0.7 });
  group.add(spray.points);

  // cantos rodados: elipsoides lisos y húmedos, con relieve suave
  const pebbleGeo = (seed) => {
    const g = new THREE.SphereGeometry(1, hiQ ? 28 : 16, hiQ ? 18 : 10), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (noise1(x * 2.2 + y * 1.7 + z * 2.9 + seed) - 0.5) * 0.32;
      p.setXYZ(i, x * n * 1.0, y * n * 0.6, z * n * 0.82);
    }
    g.computeVertexNormals(); return g;
  };
  const mats = ['#9a9a8e', '#a8a091', '#8d9690'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 }));
  const pebbles = [[-0.85, 0.9, 0.1, 1], [0.75, 0.75, 0.07, 2], [1.0, -0.25, 0.12, 3], [-1.1, -0.45, 0.06, 4]].map(([fx, z, s, sd], i) => {
    const m = new THREE.Mesh(pebbleGeo(sd), mats[i % 3]); m.userData = { fx, z, s, rot: sd * 1.3 }; group.add(m); return m;
  });

  return {
    group,
    update(t, a, fit, reduce) {
      group.visible = a > 0.01;
      if (!group.visible) return;
      rings.forEach((r, k) => {
        const ph = reduce ? 0.5 : (t * 0.16 + k / 3) % 1;
        const rad = lerp(0.5, fit.ripple, ph);
        r.position.y = fit.floorY + 0.012;
        r.scale.set(rad, rad, rad);
        r.material.opacity = Math.pow(1 - ph, 1.6) * smooth(0, 0.12, ph) * 0.5 * a;
      });
      spray.u.uTime.value = t; spray.u.uAlpha.value = spray.alpha * a;
      spray.u.uBox.value.set(fit.colR * 1.8, 2.2 * fit.bs, 1.2); spray.points.position.set(0, fit.floorY + 1.0 * fit.bs, 0.2);
      pebbles.forEach((m) => {
        const { fx, z, s, rot } = m.userData;
        const sc = s * fit.bs * 1.3 * smooth(0, 0.8, a);
        m.scale.setScalar(Math.max(1e-4, sc));
        m.position.set(fx * (fx < 0 ? fit.colL : fit.colR) * 0.78, fit.floorY + sc * 0.58, z);
        m.rotation.y = rot;
      });
    },
    setPx(px) { spray.u.uPx.value = px; },
  };
}

/* ───────── GIN DE LOS ANDES: cordillera en capas (como un telón de profundidad) y nieve fina ───────── */
function ridgeTexture(seed, c0, c1) {
  const W = 1024, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const top = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const n = noise1(u * 4 + seed) * 0.55 + noise1(u * 11 + seed * 3) * 0.3 + noise1(u * 27 + seed * 7) * 0.15;
    const peak = Math.pow(Math.sin(Math.PI * u), 0.6); // más alto al centro, se apaga hacia los bordes
    top[x] = H * (0.92 - (0.2 + 0.62 * n) * (0.35 + 0.65 * peak));
  }
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x < W; x++) c.lineTo(x, top[x]);
  c.lineTo(W, H); c.closePath(); c.fill();
  // nieve en las cumbres
  c.globalCompositeOperation = 'source-atop';
  for (let x = 0; x < W; x++) { const a = 0.55 * (1 - Math.min(1, (H - top[x]) / (H * 0.9))); c.fillStyle = `rgba(255,255,255,${0.9 * Math.max(0, a)})`; c.fillRect(x, top[x], 1, 16 + noise1(x * 0.08 + seed) * 22); }
  c.globalCompositeOperation = 'destination-in';
  const f = c.createLinearGradient(0, 0, 0, H); f.addColorStop(0, '#000'); f.addColorStop(0.55, '#000'); f.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = f; c.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createRidges(hiQ) {
  const group = new THREE.Group();
  const layers = [
    { z: -2.6, c0: '#d9cfe9', c1: '#efe9f6', op: 0.8, h: 2.3 },
    { z: -3.8, c0: '#c8b9de', c1: '#e8def1', op: 0.85, h: 2.0 },
    { z: -5.0, c0: '#b7a4d2', c1: '#e1d4ee', op: 0.85, h: 1.7 },
  ].map((L, i) => {
    const u = { map: { value: ridgeTexture(i * 2.3 + 1, L.c0, L.c1) }, uOpacity: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; uniform float uOpacity; varying vec2 vUv;
        void main(){
          vec4 t = texture2D(map, vUv);
          float e = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
          gl_FragColor = vec4(t.rgb, t.a * e * uOpacity);
          #include <colorspace_fragment>
        }`,
    }));
    m.renderOrder = 0; m.userData = L; m.userData.u = u; group.add(m); return m;
  });
  const snow = dust({ n: hiQ ? 60 : 28, color: '#b9a8d6', size: 1.0, alpha: 0.75 });
  snow.u.uRise.value = -1; // la nieve cae
  group.add(snow.points);

  return {
    group,
    update(t, a, fit, reduce) {
      group.visible = a > 0.01;
      if (!group.visible) return;
      layers.forEach((m) => {
        const L = m.userData;
        // ancho exacto de la zona visual a esa profundidad (para no invadir el texto)
        // se descuenta el desplazamiento por paralaje de la órbita de cámara (hasta ~0.14 rad)
        const w = Math.max(1.2, fit.zoneW0 * (fit.D0 * fit.dmMin + Math.abs(L.z)) / fit.D0 * 0.94 - 2 * Math.abs(L.z) * 0.15);
        const h = L.h * Math.max(0.55, fit.bs) * (1 + Math.abs(L.z) / fit.D0 * 0.4);
        m.scale.set(w, h, 1);
        m.position.set(0, fit.floorY + h / 2 - 0.05, L.z);
        L.u.uOpacity.value = L.op * a;
      });
      snow.u.uTime.value = reduce ? 0 : t; snow.u.uAlpha.value = snow.alpha * a;
      snow.u.uBox.value.set(fit.zoneW0 * 0.85, 3.4 * fit.bs, 1.6); snow.points.position.set(0, fit.floorY + 1.7 * fit.bs, -0.4);
    },
    setPx(px) { snow.u.uPx.value = px; },
  };
}
