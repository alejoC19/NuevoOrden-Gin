import * as THREE from 'three';
import { makeCitrusTexture } from './labels.js';
import { weaveTexture, bandTexture, woodTexture, sealTexture } from './textures.js';

const V2 = THREE.Vector2;
const BASE = import.meta.env.BASE_URL;

/* Perfil de la botella Argentino: cuerpo cilíndrico, hombro redondo y cuello corto */
const PTS = [[0, 0.18], [0.45, 0.03, 0.14], [0.62, 0, 0.08], [0.62, 2.3, 0.62], [0.235, 3.28, 0.5], [0.235, 3.7], [0.27, 3.74, 0.02], [0.27, 3.84]];
const GLASS_H = 3.84; // altura del vidrio
const H = 4.2; // altura total con tapón
const FLOOR = 0.36;
const FILL = 3.42;
const BODY_R = 0.62;

function roundedPath(pts, segs = 14) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, rad = 0] = pts[i];
    if (i === 0 || i === pts.length - 1 || !rad) { out.push(new V2(x, y)); continue; }
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
const OUTER = roundedPath(PTS);

/* radio del vidrio a una altura dada (para pegar telar y fajas a la superficie) */
function rGlass(y) {
  for (let i = 0; i < OUTER.length - 1; i++) {
    const a = OUTER[i], b = OUTER[i + 1];
    if (a.y < 0.3 && b.y < 0.3) continue;
    if (b.y > a.y + 1e-6 && y >= a.y && y <= b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
  }
  return BODY_R;
}
const rFull = (y) => (y >= GLASS_H - 0.03 && y <= H ? 0.31 : rGlass(Math.min(y, GLASS_H)));

/* tira que se envuelve sobre la superficie (faja de papel / telar) */
function wrapStrip(rAt, yTop, yBot, a0, width, off = 0.02, flare = 0, ny = 80, nx = 10) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) {
    const v = j / ny;
    const y = yTop + (yBot - yTop) * v;
    const r = rAt(y) + off + flare * v * v;
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const a = a0 + (u - 0.5) * (width / r);
      pos.push(Math.sin(a) * r, y + Math.sin(u * 3.0 + v * 6.0) * 0.004 * v, Math.cos(a) * r);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function liquidMaterial(v) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBottom: { value: new THREE.Color(v.liquid[0]) },
      uTop: { value: new THREE.Color(v.liquid[1]) },
      uGlow: { value: new THREE.Color(v.accent) },
      uTime: { value: 0 },
      uH: { value: FILL },
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
        float fres = pow(1.0 - ndv, 2.4);
        vec3 c = mix(uBottom, uTop, smoothstep(0.0, uH, vY));
        c *= 0.45 + 0.55 * pow(ndv, 0.55);
        c += uGlow * fres * 0.55;
        float caus = sin(vP.x*9.0 + uTime*0.9) * sin(vP.y*7.0 - uTime*0.7) * sin(vP.z*9.0 + uTime*0.5);
        c += uGlow * 0.04 * (caus * 0.5 + 0.5);
        gl_FragColor = vec4(c * uBoost, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

const loader = new THREE.TextureLoader();
const WOOD = woodTexture('#5a3820');
const SEAL = sealTexture();

export function createBottle(v) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -H / 2;
  root.add(body);

  /* ── vidrio (pared exterior + interior) ── */
  const t = 0.06;
  const inner = OUTER.map((p) => new V2(Math.max(p.x - t, 0), Math.max(p.y, FLOOR))).filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 1e-4);
  inner[0] = new V2(0, FLOOR);
  const glassGeo = new THREE.LatheGeometry([...OUTER, ...[...inner].reverse()], 96);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(v.glass.color),
    roughness: 0.035, metalness: 0, transmission: 1, ior: 1.5, thickness: 1.4,
    attenuationColor: new THREE.Color(v.glass.att), attenuationDistance: v.glass.dist,
    specularIntensity: 1, envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: 0.03,
    dispersion: 0.08, side: THREE.DoubleSide,
  });
  body.add(new THREE.Mesh(glassGeo, glassMat));

  /* ── líquido ── */
  const liq = inner.filter((p) => p.y <= FILL).map((p) => new V2(Math.max(p.x - 0.006, 0), p.y));
  liq.push(new V2(liq[liq.length - 1].x, FILL), new V2(0, FILL));
  const liqMat = liquidMaterial(v);
  body.add(new THREE.Mesh(new THREE.LatheGeometry(liq, 64), liqMat));

  /* ── etiqueta real (textura = arte de la botella) ── */
  const lh = 1.3;
  const lw = v.labelAspect * lh;
  const theta = lw / BODY_R;
  const labelMat = new THREE.MeshPhysicalMaterial({ color: '#e9ddc0', roughness: 0.82, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R + 0.012, BODY_R + 0.012, lh, 64, 1, true, -theta / 2, theta), labelMat);
  label.position.y = 0.3 + lh / 2;
  body.add(label);
  const ready = loader.loadAsync(BASE + v.label).then((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    labelMat.map = tex; labelMat.emissiveMap = tex; labelMat.emissive = new THREE.Color('#ffffff'); labelMat.emissiveIntensity = 0.32;
    labelMat.color.set('#ffffff'); labelMat.needsUpdate = true;
  }).catch(() => {});

  /* ── faja de papel en el cuello ── */
  const bandTex = bandTexture(v.ink);
  bandTex.repeat.set(1, 1);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.245, 0.245, 0.4, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.85 }),
  );
  band.position.y = 3.5;
  bandTex.repeat.set(2, 1);
  body.add(band);

  /* ── tapón de madera + tira + sello ARG ── */
  const stopper = new THREE.Group();
  const prof = [[0, 0], [0.28, 0], [0.31, 0.03], [0.31, 0.33], [0.29, 0.36], [0, 0.37]].map(([x, y]) => new V2(x, y));
  WOOD.repeat.set(2, 1);
  const cork = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshPhysicalMaterial({ map: WOOD, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.4 }));
  cork.position.y = GLASS_H - 0.02;
  const stripTex = bandTexture(v.ink);
  stripTex.repeat.set(1, 1);
  const strip = new THREE.Mesh(
    wrapStrip(rFull, H - 0.005, 3.45, 0, 0.17, 0.014, 0, 40, 4),
    new THREE.MeshStandardMaterial({ color: '#e6d8b8', roughness: 0.9, side: THREE.DoubleSide }),
  );
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 40), [
    new THREE.MeshPhysicalMaterial({ color: '#3a2214', roughness: 0.4, clearcoat: 0.8 }),
    new THREE.MeshPhysicalMaterial({ map: SEAL, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.3 }),
    new THREE.MeshPhysicalMaterial({ color: '#3a2214', roughness: 0.5 }),
  ]);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, GLASS_H - 0.02, 0.325);
  stopper.add(cork, strip, seal);
  body.add(stopper);

  /* ── telar colgando del cuello ── */
  const wTex = weaveTexture(v.weave);
  const len = 2.5, wid = 0.46;
  wTex.repeat.set(1, len / wid / 4);
  const ribbonGeo = wrapStrip(rGlass, 3.52, 3.52 - len, -1.25, wid, 0.028, 0.32, 90, 12);
  const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.6 }));
  const ribbonPivot = new THREE.Group();
  ribbonPivot.position.set(0, 3.52, 0);
  ribbon.position.y = -3.52;
  ribbonPivot.add(ribbon);
  body.add(ribbonPivot);

  /* ── base de madera + posavasos de cuero ── */
  const podR = 1.0;
  const woodTop = WOOD.clone();
  woodTop.repeat.set(3, 1);
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(podR + 0.15, podR + 0.2, 0.34, 96), new THREE.MeshPhysicalMaterial({ map: woodTop, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3, color: '#b89070' }));
  pod.position.y = -H / 2 - 0.2;
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.04, 64), new THREE.MeshStandardMaterial({ color: '#7a3f22', roughness: 0.6 }));
  coaster.position.y = -H / 2 + 0.01;
  const podRing = new THREE.Mesh(new THREE.TorusGeometry(podR + 0.16, 0.012, 12, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(v.accent).multiplyScalar(1.6) }));
  podRing.rotation.x = Math.PI / 2;
  podRing.position.y = -H / 2 - 0.03;
  root.add(pod, coaster, podRing);

  /* ── botánicos orbitando ── */
  const bot = createBotanicals(v);
  root.add(bot.mesh);

  return {
    root, stopper, liqMat, podRing, bot, H, glassMat, ready,
    sway(time) { ribbonPivot.rotation.z = Math.sin(time * 0.9) * 0.025; ribbonPivot.rotation.x = Math.sin(time * 0.7 + 1) * 0.015; },
  };
}

/* ── botánicos instanciados ── */
function createBotanicals(v) {
  const N = 14;
  const { type, color } = v.botanical;
  let geo, mat;
  if (type === 'citrus') {
    geo = new THREE.CylinderGeometry(0.17, 0.17, 0.03, 40);
    const tex = makeCitrusTexture(color, '#fff08a');
    const rind = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissive: new THREE.Color(color), emissiveIntensity: 0.15, emissiveMap: tex });
    mat = [rind, face, face];
  } else {
    geo = new THREE.SphereGeometry(type === 'blue' ? 0.07 : 0.055, 20, 14);
    mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, emissive: new THREE.Color(color), emissiveIntensity: 0.12 });
  }
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  const items = Array.from({ length: N }, (_, i) => ({
    r: 1.6 + Math.random() * 1.3, a0: Math.random() * Math.PI * 2,
    sp: (0.12 + Math.random() * 0.22) * (i % 2 ? 1 : -1),
    y: -1.7 + Math.random() * 3.6, bob: Math.random() * 6, s: 0.7 + Math.random() * 0.9,
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
