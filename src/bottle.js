import * as THREE from 'three';
import { makeLabel, makeCitrusTexture } from './labels.js';

const V2 = THREE.Vector2;

/* Perfiles (radio, altura, radio-de-curva). Se giran con LatheGeometry. */
const SHAPES = {
  classic: {
    pts: [[0, 0.16], [0.42, 0.03, 0.12], [0.64, 0, 0.08], [0.64, 1.55, 0.34], [0.2, 2.35, 0.42], [0.19, 2.6, 0.05], [0.19, 2.98], [0.23, 3.02, 0.02], [0.23, 3.14, 0.02]],
    floor: 0.32, fill: 2.05, label: { y0: 0.42, y1: 1.34, r: 0.64 }, neck: 0.19, lip: 0.23, H: 3.14,
  },
  slim: {
    pts: [[0, 0.16], [0.34, 0.03, 0.1], [0.5, 0, 0.07], [0.5, 1.75, 0.34], [0.17, 2.95, 0.6], [0.16, 3.15, 0.08], [0.16, 3.55], [0.2, 3.6, 0.02], [0.2, 3.72, 0.02]],
    floor: 0.3, fill: 2.6, label: { y0: 0.45, y1: 1.38, r: 0.5 }, neck: 0.16, lip: 0.2, H: 3.72,
  },
  flask: {
    pts: [[0, 0.2], [0.5, 0.04, 0.15], [0.78, 0, 0.14], [0.78, 1.75, 0.46], [0.22, 2.55, 0.5], [0.2, 2.7, 0.08], [0.2, 2.9], [0.25, 2.95, 0.02], [0.25, 3.07, 0.02]],
    floor: 0.34, fill: 2.0, label: { y0: 0.4, y1: 1.3, r: 0.78 }, neck: 0.2, lip: 0.25, H: 3.07,
  },
  tall: {
    pts: [[0, 0.3], [0.4, 0.04, 0.12], [0.6, 0, 0.07], [0.6, 2.0, 0.12], [0.22, 2.5, 0.28], [0.2, 2.65, 0.05], [0.2, 3.02], [0.25, 3.06, 0.02], [0.25, 3.18, 0.02]],
    floor: 0.55, fill: 2.3, label: { y0: 0.6, y1: 1.7, r: 0.6 }, neck: 0.2, lip: 0.25, H: 3.18,
  },
};

function roundedPath(pts, segs = 12) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, rad = 0] = pts[i];
    if (i === 0 || i === pts.length - 1 || !rad) {
      out.push(new V2(x, y));
      continue;
    }
    const p = new V2(x, y);
    const d0 = new V2(pts[i - 1][0], pts[i - 1][1]).sub(p);
    const d1 = new V2(pts[i + 1][0], pts[i + 1][1]).sub(p);
    const a = p.clone().add(d0.clone().normalize().multiplyScalar(Math.min(rad, d0.length() * 0.5)));
    const b = p.clone().add(d1.clone().normalize().multiplyScalar(Math.min(rad, d1.length() * 0.5)));
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      out.push(new V2((1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * p.x + t * t * b.x, (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * p.y + t * t * b.y));
    }
  }
  return out;
}

function liquidMaterial(v) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uBottom: { value: new THREE.Color(v.liquid[0]) },
      uTop: { value: new THREE.Color(v.liquid[1]) },
      uGlow: { value: new THREE.Color(v.accent) },
      uTime: { value: 0 },
      uH: { value: 3 },
      uBoost: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vV = normalize(-mv.xyz); vY = position.y; vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBottom, uTop, uGlow; uniform float uTime, uH, uBoost;
      varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      void main(){
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(1.0 - ndv, 2.2);
        vec3 c = mix(uBottom, uTop, smoothstep(0.0, uH, vY));
        c *= 0.35 + 0.65 * pow(ndv, 0.6);
        c += uGlow * fres * 0.9;
        float caus = sin(vP.x*9.0 + uTime*0.9) * sin(vP.y*7.0 - uTime*0.7) * sin(vP.z*9.0 + uTime*0.5);
        c += uGlow * 0.05 * (caus * 0.5 + 0.5);
        gl_FragColor = vec4(c * uBoost, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return m;
}

function corkTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#b98d5c'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    c.fillStyle = `rgba(${60 + Math.random() * 60},${30 + Math.random() * 40},10,${Math.random() * 0.35})`;
    c.beginPath(); c.arc(Math.random() * 128, Math.random() * 128, Math.random() * 3 + 0.5, 0, 7); c.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const CORK = corkTexture();

export function createBottle(v) {
  const S = SHAPES[v.shape];
  const root = new THREE.Group();
  const body = new THREE.Group(); // origen = base de la botella
  body.position.y = -S.H / 2;
  root.add(body);

  /* ── vidrio (pared exterior + interior para refracción real) ── */
  const outer = roundedPath(S.pts);
  const t = 0.05;
  const inner = outer
    .map((p) => new V2(Math.max(p.x - t, 0), Math.max(p.y, S.floor)))
    .filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 1e-4);
  inner[0] = new V2(0, S.floor);
  const path = [...outer, ...[...inner].reverse()];
  const glassGeo = new THREE.LatheGeometry(path, 96);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(v.glass),
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    ior: 1.5,
    thickness: v.shape === 'tall' ? 2.2 : 1.1,
    attenuationColor: new THREE.Color(v.glass),
    attenuationDistance: v.shape === 'tall' ? 0.55 : 6,
    specularIntensity: 1,
    envMapIntensity: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    dispersion: 0.12,
    side: THREE.DoubleSide,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  body.add(glass);

  /* ── líquido ── */
  const liqPts = inner.filter((p) => p.y <= S.fill).map((p) => new V2(Math.max(p.x - 0.006, 0), p.y));
  liqPts.push(new V2(liqPts[liqPts.length - 1].x, S.fill));
  liqPts.push(new V2(0, S.fill));
  const liqMat = liquidMaterial(v);
  liqMat.uniforms.uH.value = S.fill;
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liqPts, 64), liqMat);
  body.add(liquid);

  /* ── etiqueta ── */
  const theta = 2.15;
  const lh = S.label.y1 - S.label.y0;
  const aspect = (S.label.r * theta) / lh;
  const tx = makeLabel(v, aspect);
  const labelMat = new THREE.MeshPhysicalMaterial({
    map: tx.map, metalnessMap: tx.metalnessMap, roughnessMap: tx.roughnessMap,
    metalness: 1, roughness: 1, side: THREE.DoubleSide, envMapIntensity: 1.2,
    clearcoat: 0.3, clearcoatRoughness: 0.5,
  });
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(S.label.r + 0.012, S.label.r + 0.012, lh, 64, 1, true, -theta / 2, theta),
    labelMat,
  );
  label.position.y = S.label.y0 + lh / 2;
  body.add(label);

  /* ── lacre de cera con gotas ── */
  const waxH = 0.62;
  const waxGeo = new THREE.CylinderGeometry(S.lip + 0.03, S.lip + 0.035, waxH, 64, 14, true);
  const wp = waxGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const y = wp.getY(i);
    const k = THREE.MathUtils.smoothstep(-y, waxH * 0.1, waxH * 0.5); // 0 arriba → 1 abajo
    const ang = Math.atan2(wp.getZ(i), wp.getX(i));
    const drip = Math.pow(Math.max(0, Math.sin(ang * 4 + 1.3)), 2) * 0.2 + Math.pow(Math.max(0, Math.sin(ang * 9 + 0.4)), 3) * 0.1 + 0.03;
    wp.setY(i, y - k * k * drip * 1.8);
  }
  waxGeo.computeVertexNormals();
  const wax = new THREE.Mesh(
    waxGeo,
    new THREE.MeshPhysicalMaterial({ color: v.wax, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
  );
  wax.position.y = S.H - waxH / 2 + 0.05;
  body.add(wax);

  /* ── tapón ── */
  const stopper = new THREE.Group();
  const shank = new THREE.Mesh(
    new THREE.CylinderGeometry(S.neck * 0.92, S.neck * 0.92, 0.5, 32),
    new THREE.MeshStandardMaterial({ map: CORK, roughness: 0.9 }),
  );
  shank.position.y = S.H - 0.05;
  const headProfile = [[0, 0], [0.24, 0], [0.27, 0.02], [0.28, 0.06], [0.28, 0.27], [0.26, 0.31], [0.2, 0.335], [0, 0.34]].map(([x, y]) => new V2(x, y));
  const head = new THREE.Mesh(
    new THREE.LatheGeometry(headProfile, 64),
    new THREE.MeshPhysicalMaterial({ color: v.cap, metalness: v.capMetal, roughness: v.capMetal > 0.5 ? 0.22 : 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.4 }),
  );
  head.position.y = S.H + 0.1;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.275, 0.011, 12, 64),
    new THREE.MeshStandardMaterial({ color: v.label.foil, metalness: 1, roughness: 0.25 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = S.H + 0.15;
  stopper.add(shank, head, ring);
  body.add(stopper);

  /* ── pedestal ── */
  const podR = Math.max(S.label.r, 0.64) + 0.3;
  const pod = new THREE.Mesh(
    new THREE.CylinderGeometry(podR, podR + 0.1, 0.36, 96),
    new THREE.MeshPhysicalMaterial({ color: '#0a0a0c', metalness: 0.9, roughness: 0.18, clearcoat: 1, envMapIntensity: 1.1 }),
  );
  pod.position.y = -S.H / 2 - 0.18;
  const podRing = new THREE.Mesh(
    new THREE.TorusGeometry(podR + 0.005, 0.014, 12, 128),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(v.accent).multiplyScalar(2.2) }),
  );
  podRing.rotation.x = Math.PI / 2;
  podRing.position.y = -S.H / 2;
  root.add(pod, podRing);

  /* ── botánicos orbitando ── */
  const bot = createBotanicals(v);
  root.add(bot.mesh);

  return {
    root, stopper, liqMat, podRing, bot, H: S.H, glassMat,
    dispose() {},
  };
}

/* ── botánicos instanciados ── */
function createBotanicals(v) {
  const N = 14;
  let geo, mat;
  switch (v.botanical) {
    case 'citrus': {
      geo = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 40);
      const tex = makeCitrusTexture('#ff9d1c', '#ffc94d');
      const rind = new THREE.MeshStandardMaterial({ color: '#ff9d1c', roughness: 0.6 });
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissive: new THREE.Color('#ff9d1c'), emissiveIntensity: 0.15, emissiveMap: tex });
      mat = [rind, face, face];
      break;
    }
    case 'petals': {
      geo = new THREE.PlaneGeometry(0.28, 0.2, 6, 4);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) ** 2) * 2.6 + (p.getY(i) ** 2) * 1.2);
      geo.computeVertexNormals();
      mat = new THREE.MeshPhysicalMaterial({ color: '#ff6b9e', roughness: 0.45, side: THREE.DoubleSide, sheen: 1, sheenColor: new THREE.Color('#ffd0e1'), emissive: new THREE.Color('#ff3c80'), emissiveIntensity: 0.15 });
      break;
    }
    case 'stars': {
      geo = new THREE.OctahedronGeometry(0.1, 0);
      geo.scale(1, 1.9, 0.35);
      mat = new THREE.MeshStandardMaterial({ color: '#c9ccff', emissive: new THREE.Color('#8f9aff'), emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 });
      break;
    }
    default: {
      geo = new THREE.SphereGeometry(0.05, 20, 14);
      mat = new THREE.MeshPhysicalMaterial({ color: '#4650a0', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, emissive: new THREE.Color('#1d2266'), emissiveIntensity: 0.15 });
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  const items = Array.from({ length: N }, (_, i) => ({
    r: 1.5 + Math.random() * 1.3,
    a0: Math.random() * Math.PI * 2,
    sp: (0.12 + Math.random() * 0.22) * (i % 2 ? 1 : -1),
    y: -1.5 + Math.random() * 3.2,
    bob: Math.random() * 6,
    s: 0.7 + Math.random() * 0.9,
    ax: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    spin: 0.3 + Math.random() * 0.9,
  }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    mesh,
    update(t, a) {
      mesh.visible = a > 0.01;
      if (!mesh.visible) return;
      items.forEach((it, i) => {
        const ang = it.a0 + t * it.sp;
        p.set(Math.cos(ang) * it.r, it.y + Math.sin(t * 0.7 + it.bob) * 0.12, Math.sin(ang) * it.r - 0.2);
        q.setFromAxisAngle(it.ax, t * it.spin + it.bob);
        const sc = it.s * a;
        s.set(sc, sc, sc);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
