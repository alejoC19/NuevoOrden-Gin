import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createIngredient } from './botanicals.js';
import { createSea, createRidges } from './scenery.js';
import { cameraAt, DM_MIN } from './timeline.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const WORLD_H = 5.6; // alto visible del mundo en z = 0 con la cámara en el encuadre base
export const BOTTLE_H = 3.6; // alto de la botella en unidades de mundo
const FOV = 26;
const D0 = WORLD_H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/* Ubicación de los botánicos alrededor de la botella: [columna (-1 izq / +1 der), fila (-1..1), profundidad]. */
const SLOTS = {
  1: [[-1, 0.2, 0.6]],
  2: [[-1, 0.7, 0.7], [1, -0.45, -0.6]],
  3: [[-1, 0.78, 0.7], [1, 0.05, -0.6], [-1, -0.8, 0.7]],
  6: [[-1, 0.8, 0.7], [1, 0.95, -0.6], [-1, 0.0, -0.6], [1, 0.05, 0.8], [-1, -0.82, 0.7], [1, -0.9, -0.5]],
};
const BBOX_HALF = 0.905; // semiancho de la caja de la foto (1.8 / 2); el eje de la botella queda a +0.26 de su centro
const AXIS_SHIFT = 0.26;
const RADIUS = 0.38; // radio visual de cada racimo (antes de la escala de ajuste)

function shadowTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(128, 128, 2, 128, 128, 128);
  g.addColorStop(0, 'rgba(70,45,12,0.6)'); g.addColorStop(0.4, 'rgba(70,45,12,0.26)'); g.addColorStop(1, 'rgba(70,45,12,0)');
  c.scale(1, 0.25); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* La botella es la foto original sobre un relieve (profundidad deducida de su silueta de revolución).
   El relieve se compensa con la perspectiva: en reposo la imagen coincide píxel a píxel con la foto. */
const BOTTLE_VS = /* glsl */ `
  uniform sampler2D uDepthMap; uniform float uDepthW, uCam, uShift; varying vec2 vUv;
  void main(){
    vUv = uv;
    float z = texture2D(uDepthMap, uv).r * uDepthW;
    vec3 p = position;
    float k = (uCam - z) / uCam;
    p.x = (p.x + uShift) * k - uShift; // uShift: corrimiento de la caja de la foto respecto del eje óptico
    p.y *= k;
    p.z = z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const BOTTLE_FS = /* glsl */ `
  uniform sampler2D map; uniform float uOpacity, uSweep; varying vec2 vUv;
  void main(){
    vec4 t = texture2D(map, vUv);
    float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
    float band = smoothstep(0.16, 0.0, abs(vUv.x - uSweep)) * smoothstep(0.35, 0.85, lum);
    gl_FragColor = vec4(t.rgb + band * 0.12, t.a * uOpacity);
    #include <colorspace_fragment>
  }`;
const FLAT_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const REFL_FS = /* glsl */ `
  uniform sampler2D map; uniform float uOpacity; varying vec2 vUv;
  void main(){
    vec4 t = texture2D(map, vUv);
    float fade = smoothstep(0.5, 0.0, vUv.y);
    gl_FragColor = vec4(t.rgb, t.a * uOpacity * fade * 0.34);
    #include <colorspace_fragment>
  }`;

export class Stage {
  constructor(canvas, gins, { hiQ = true, reduce = false } = {}) {
    this.canvas = canvas; this.gins = gins; this.hiQ = hiQ; this.reduce = reduce;
    this.dprMax = hiQ ? 2 : 1.5;
    this.lost = false;
    this.mouse = new THREE.Vector2(); this.mouseS = new THREE.Vector2();
    this.frameAvg = 16; this.slowFrames = 0;
    this.zx = 0.5; this.zy = 0.5;
    this.zones = null; this.fits = []; this.heroFit = null; this.finaleFit = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
    this.camera.position.set(0, 0, D0);

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; });

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();
    const key = new THREE.DirectionalLight('#fff1d4', 1.1); key.position.set(-3, 4, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight('#ffe2a8', 0.6); rim.position.set(4, 2, -3); this.scene.add(rim);

    this.chapters = [];
    this.shadowTex = shadowTexture();
    this.buildDust();
    this._v = new THREE.Vector3(); this._box = new THREE.Box3();
  }

  /* ───── carga progresiva: una botella a la vez ───── */
  async load(onProgress) {
    const loader = new THREE.TextureLoader();
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    let done = 0;
    for (let i = 0; i < this.gins.length; i++) {
      const gin = this.gins[i];
      const [tex, depth] = await Promise.all([loader.loadAsync(gin.img), loader.loadAsync(gin.depth.map)]);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso; tex.minFilter = THREE.LinearMipmapLinearFilter;
      depth.colorSpace = THREE.NoColorSpace; depth.generateMipmaps = false; depth.minFilter = THREE.LinearFilter; depth.magFilter = THREE.LinearFilter;
      this.chapters.push(this.buildChapter(gin, tex, depth, i));
      onProgress?.(++done / this.gins.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    this.layout();
  }

  buildChapter(gin, tex, depthTex, i) {
    const group = new THREE.Group(); // origen = centro de la botella; se desplaza al cambiar de gin
    const rig = new THREE.Group(); // botella + reflejo + sombra (se escalan juntos)
    const wpp = BOTTLE_H / gin.depth.h; // unidades de mundo por píxel de la foto
    const w = gin.depth.w * wpp;
    const shiftX = -(gin.depth.axis - gin.depth.w / 2) * wpp; // el eje de la botella queda en el origen

    const geo = new THREE.PlaneGeometry(w, BOTTLE_H, this.hiQ ? 120 : 64, this.hiQ ? 240 : 128);
    geo.translate(shiftX, 0, 0);
    const uni = { map: { value: tex }, uDepthMap: { value: depthTex }, uDepthW: { value: gin.depth.zmax * wpp }, uCam: { value: D0 }, uShift: { value: AXIS_SHIFT }, uOpacity: { value: 1 }, uSweep: { value: 0 } };
    const bottle = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: BOTTLE_VS, fragmentShader: BOTTLE_FS, transparent: true, depthWrite: false }));
    bottle.renderOrder = 3; bottle.frustumCulled = false;

    const refl = new THREE.Mesh(new THREE.PlaneGeometry(w, BOTTLE_H), new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uOpacity: uni.uOpacity }, vertexShader: FLAT_VS, fragmentShader: REFL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    refl.scale.y = -1; refl.position.set(shiftX, -BOTTLE_H, -0.02); refl.renderOrder = 2;

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
    shadow.scale.set(w * 1.9, 0.62, 1); shadow.position.set(0, -BOTTLE_H / 2 + 0.02, -0.02); shadow.renderOrder = 1;
    rig.add(refl, shadow, bottle);

    // botánicos reales de la composición (si hay menos piezas que ranuras, se repite el modelo)
    const ids = gin.scene || gin.botanicals;
    const slots = SLOTS[ids.length] || SLOTS[3];
    const ing = new THREE.Group();
    const entries = ids.map((id, k) => {
      const g = createIngredient(gin.kinds[id], this.hiQ, 11 + i * 31 + k * 7);
      g.visible = false; ing.add(g);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
      sh.renderOrder = 1; sh.visible = false; ing.add(sh);
      return { id, k, g, sh, slot: slots[k], seed: k * 1.7 + i };
    });

    const scenery = gin.scenery === 'sea' ? createSea(this.hiQ) : gin.scenery === 'ridges' ? createRidges(this.hiQ) : null;
    if (scenery) { scenery.setPx?.(this.renderer.getPixelRatio()); group.add(scenery.group); }
    group.add(rig, ing);
    group.visible = false;
    this.scene.add(group);
    return { group, rig, bottle, refl, shadow, uni, entries, ing, scenery, w };
  }

  buildDust() {
    const N = this.hiQ ? 120 : 50;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, -1.5 + Math.random() * 3.5], i * 3); seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.dustU = { uTime: { value: 0 }, uPx: { value: 1 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.dustU, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `attribute float seed; uniform float uTime, uPx; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y + 4.0 + uTime*(0.05+seed*0.1), 8.0) - 4.0; p.x += sin(uTime*0.25 + seed*40.0)*0.25;
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = (2.0 + seed*4.0) * uPx * (9.0 / -mv.z);
          vA = (0.22 + 0.5*seed) * (0.55 + 0.45*sin(uTime*(0.8+seed*1.5) + seed*30.0)); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(0.86,0.64,0.2, smoothstep(0.5,0.0,d)*vA); }`,
    });
    this.dust = new THREE.Points(g, m); this.dust.renderOrder = 5; this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  /* ───── tamaño ───── */
  resize(w, h) {
    this.w = w; this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.dustU.uPx.value = dpr;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.chapters.forEach((c) => c.scenery?.setPx?.(dpr));
    this.layout();
  }

  /* ───── zonas visuales ─────
     `zones` (en px de pantalla) las calcula la página a partir del texto real:
       { hero, ch:[zona de cada gin], finale }  con  {x0,y0,x1,y1}
     Todo lo visual (botella, botánicos, escenografía) se ajusta para quedar DENTRO de su zona, a la
     máxima cercanía de cámara. El texto vive fuera de la zona: no puede haber superposición. */
  setZones(zones) { this.zones = zones; this.layout(); }

  fitFor(zone, K, dm) {
    const k = WORLD_H / this.h; // unidades de mundo por px (encuadre base)
    const SAFE = 28; // px de margen por la órbita de cámara y el paralaje
    const Zw = Math.max(40, zone.x1 - zone.x0 - SAFE) * k * dm, Zh = (zone.y1 - zone.y0) * k * dm, half = Zw / 2;
    const ingMin = 0.62;
    // la caja real de la foto es asimétrica (telar a la izquierda): ancho total 1.8·bs, centrada en la zona
    let bs = Math.min(1, (Zh * 0.9) / BOTTLE_H);
    let ingS = 1;
    if (K > 0) {
      bs = Math.min(bs, (half - 0.14 - ingMin * RADIUS * 2) / BBOX_HALF);
      ingS = clamp((half - 0.14 - BBOX_HALF * bs) / (RADIUS * 2), ingMin, 1.1);
    } else bs = Math.min(bs, half / BBOX_HALF);
    bs = Math.max(0.2, bs);
    const R = RADIUS * ingS;
    return {
      bs, ingS, R, half, Zw, Zh, D0, dmMin: dm,
      zoneW0: (zone.x1 - zone.x0 - SAFE) * k,
      colL: BBOX_HALF * bs + 0.14 + R, colR: BBOX_HALF * bs + 0.14 + R,
      rowA: Math.max(0.4, Zh / 2 - R * 1.3 - 0.3), // margen por perspectiva y deriva propia de cada racimo
      floorY: -BOTTLE_H * bs / 2,
      ripple: Math.max(0.8, half * 0.8),
      cx: (zone.x0 + zone.x1) / 2, cy: (zone.y0 + zone.y1) / 2,
    };
  }

  layout() {
    if (!this.w || !this.zones) return;
    const asp = this.w / this.h;
    this.asp = asp; this.Wv = WORLD_H * asp; this.wide = asp >= 1.0;
    const Z = this.zones;
    this.fits = this.gins.map((g, i) => this.fitFor(Z.ch[i], (g.scene || g.botanicals).length, DM_MIN * 0.96));
    this.heroFit = this.fitFor(Z.hero, 0, 1.0);
    this.finaleFit = this.fitFor(Z.finale, 0, 1.0);
    // finale: tres botellas juntas → ancho por botella
    const ff = this.finaleFit;
    ff.bs = Math.max(0.2, Math.min(ff.bs, ff.Zw / (3 * 1.5 + 0.7)));
  }

  govern(ms) {
    this.frameAvg = lerp(this.frameAvg, ms, 0.05);
    if (this.frameAvg > 26) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 90 && this.dprMax > 1) { this.dprMax = Math.max(1, this.dprMax - 0.5); this.slowFrames = 0; this.frameAvg = 16; this.resize(this.w, this.h); }
  }

  /* desplaza el punto principal de la cámara para que el origen quede en el centro de la zona activa */
  applyView(cxPx, cyPx) {
    const sx = (cxPx / this.w - 0.5) * 2, sy = (0.5 - cyPx / this.h) * 2;
    const e = this.camera.projectionMatrix.elements;
    e[8] = -sx; e[9] = -sy;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  /**
   * s: { mode:'story'|'finale', h, u, f, reveal:[], q, intro, t, mx, my, cam:{dm,az,el} }
   */
  render(s) {
    if (this.lost || !this.chapters.length || !this.fits.length) return;
    this.mouseS.x += (s.mx - this.mouseS.x) * 0.1;
    this.mouseS.y += (s.my - this.mouseS.y) * 0.1;
    this.dustU.uTime.value = s.t;
    this.camera.updateProjectionMatrix();
    s.mode === 'finale' ? this.applyFinale(s) : this.applyStory(s);
    this.renderer.render(this.scene, this.camera);
  }

  placeCamera(dm, az, el, mx, my) {
    const D = D0 * dm;
    const A = az + (this.reduce ? 0 : mx * 0.1), E = el + (this.reduce ? 0 : my * 0.035);
    this.camera.position.set(Math.sin(A) * Math.cos(E) * D, Math.sin(E) * D, Math.cos(A) * Math.cos(E) * D);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    return D;
  }

  applyStory(s) {
    const { h, f, reveal, t, intro } = s;
    const eh = ease(clamp(h));
    const N = this.chapters.length;
    const i0 = Math.min(Math.floor(f), N - 2), fr = f - i0;

    // cámara: en el hero se acerca; después sigue la coreografía de cada gin
    const heroPhase = h < 1;
    const dm = heroPhase ? lerp(1.1, 1.0, eh) : s.cam.dm;
    const az = heroPhase ? lerp(-0.05, 0, eh) : s.cam.az;
    const el = heroPhase ? 0.05 : s.cam.el;
    const D = this.placeCamera(dm, az, el, s.mx, s.my);

    // centro de la zona visual activa (interpolado entre gines y desde el hero)
    const Z = this.zones.ch;
    const cx = lerp(lerp(Z[i0].x0 + Z[i0].x1, Z[i0 + 1].x0 + Z[i0 + 1].x1, fr) / 2, (this.zones.hero.x0 + this.zones.hero.x1) / 2, 1 - eh);
    const cyCh = lerp((Z[i0].y0 + Z[i0].y1) / 2, (Z[i0 + 1].y0 + Z[i0 + 1].y1) / 2, fr);
    const cy = lerp(cyCh, (this.zones.hero.y0 + this.zones.hero.y1) / 2, 1 - eh);
    this.applyView(cx, cy);
    this.zx = cx / this.w; this.zy = cy / this.h;

    const SL = this.Wv * 0.8;
    const red = this.reduce;

    this.chapters.forEach((ch, i) => {
      const d = i - f, ad = Math.abs(d);
      ch.group.visible = ad < 1.05;
      if (!ch.group.visible) return;
      const fit = this.fits[i];
      const near = 1 - clamp(ad);
      const op = smooth(1.0, 0.25, ad) * (i === 0 ? intro : 1);
      const bs = (i === 0 ? lerp(this.heroFit.bs, fit.bs, eh) : fit.bs) * (0.92 + 0.08 * near);

      ch.group.position.set(d * SL, (i === 0 ? (1 - intro) * 0.7 : 0), 0);
      ch.group.rotation.set(0, -d * 0.3, 0);
      ch.rig.scale.setScalar(bs);
      ch.rig.position.set(AXIS_SHIFT * bs, red ? 0 : Math.sin(t * 0.8 + i * 1.3) * 0.03, 0); // centra la caja real de la foto en la zona
      ch.refl.visible = true;
      ch.uni.uOpacity.value = op;
      ch.shadow.material.opacity = op;
      ch.uni.uCam.value = D / bs;
      ch.uni.uSweep.value = red ? 0.5 : (((t * 0.07 + i * 0.3) % 1.6) - 0.3 + d * 0.4);

      // botánicos: aparecen de a uno, se mueven por su cuenta y se recogen al irse el gin
      const r = reveal[i] || 0, E = ch.entries.length;
      const gather = 1 - smooth(0.0, 0.12, ad); // solo existen cuando el gin ya llegó a su lugar
      ch.ing.visible = true;
      const floorY = fit.floorY;
      for (const e of ch.entries) {
        const a = clamp((r * E - e.k) / 0.92) * gather;
        e.g.visible = e.sh.visible = a > 0.002;
        if (!e.g.visible) continue;
        const p = easeOutCubic(a);
        const tx = e.slot[0] < 0 ? -fit.colL : fit.colR, ty = e.slot[1] * fit.rowA, tz = e.slot[2];
        const ox = 0, oy = 0.35 * fit.bs, oz = -0.2;
        // llegada en arco, desde el hombro de la botella
        const arc = Math.sin(Math.PI * p) * 0.35 * (e.slot[0] < 0 ? -1 : 1);
        const dr = e.g.userData.drift, dd = red ? 0 : a;
        e.g.position.set(
          lerp(ox, tx, p) + Math.sin(t * dr.f[0] + dr.p[0]) * dr.a[0] * dd,
          lerp(oy, ty, p) + arc * 0.6 + Math.sin(t * dr.f[1] + dr.p[1]) * dr.a[1] * dd,
          lerp(oz, tz, p) + Math.sin(t * dr.f[2] + dr.p[2]) * dr.a[2] * dd,
        );
        const sc = (fit.R / e.g.userData.radius) * Math.max(0.0001, easeOutBack(a));
        e.g.scale.setScalar(sc);
        const sp = e.g.userData.spin, tt = red ? 0 : t;
        if (e.g.userData.flat) e.g.rotation.set(0.25 * Math.sin(tt * 0.35 + e.seed), 0.55 * Math.sin(tt * 0.28 + e.seed * 2) + (1 - a) * 2.5, 0.2 * Math.sin(tt * 0.3 + e.seed * 3)); // hojas y cintas: giran poco, mostrando siempre su cara
        else e.g.rotation.set(sp.x * tt + e.seed, sp.y * tt + (1 - a) * 4, sp.z * tt);
        // sombra suave sobre el piso, coherente con la altura
        const hgt = clamp((e.g.position.y - floorY) / 3.5);
        e.sh.position.set(e.g.position.x, floorY + 0.012, e.g.position.z);
        e.sh.scale.set(fit.R * 2.6 * (1 + hgt * 0.4), fit.R * 0.6, 1);
        e.sh.material.opacity = 0.34 * a * (1 - hgt * 0.7);
      }

      ch.scenery?.update(t, op * (0.3 + 0.7 * smooth(0.0, 0.3, r)) * gather, fit, red);
    });
  }

  applyFinale(s) {
    const { q, t } = s;
    const ff = this.finaleFit, Zf = this.zones.finale;
    const dm = lerp(1.12, 1.0, ease(q));
    const az = this.reduce ? 0 : Math.sin(t * 0.22) * 0.07;
    const D = this.placeCamera(dm, az, 0.06, s.mx, s.my);
    this.applyView((Zf.x0 + Zf.x1) / 2, (Zf.y0 + Zf.y1) / 2);
    this.zx = 0.5; this.zy = (Zf.y0 + Zf.y1) / 2 / this.h;
    const gap = 1.5 * ff.bs + 0.1;
    this.chapters.forEach((ch, i) => {
      ch.group.visible = true; ch.ing.visible = false; ch.scenery && (ch.scenery.group.visible = false);
      ch.entries.forEach((e) => { e.g.visible = e.sh.visible = false; });
      const e = ease(clamp(q * 1.7 - i * 0.2));
      const mid = i === 1, bs = ff.bs * (mid ? 1.06 : 1);
      ch.group.position.set((i - 1) * gap, -(1 - e) * 0.9 + (this.reduce ? 0 : Math.sin(t * 0.8 + i * 1.3) * 0.03), mid ? 0.3 : 0);
      ch.group.rotation.set(0, (i - 1) * -0.2, 0); // las laterales se giran un poco hacia el centro: se ve el relieve
      ch.rig.scale.setScalar(bs); ch.rig.position.set(AXIS_SHIFT * bs, 0, 0);
      ch.refl.visible = false; // en el cierre el título ocupa ese espacio: sin reflejo para que se lea limpio
      ch.uni.uOpacity.value = e;
      ch.shadow.material.opacity = e;
      ch.uni.uCam.value = D / bs;
      ch.uni.uSweep.value = this.reduce ? 0.5 : (((t * 0.07 + i * 0.3) % 1.6) - 0.3);
    });
  }

  /* diagnóstico: error (px) entre la foto con relieve y la foto plana, en pose de reposo (cámara de frente).
     Si el relieve deformara la imagen, el error sería grande. */
  reliefError(i) {
    const ch = this.chapters[i], g = this.gins[i];
    this.camera.updateProjectionMatrix();
    const D = this.placeCamera(1, 0, 0, 0, 0);
    this.applyView(this.w / 2, this.h / 2);
    const keepP = ch.group.position.clone(), keepR = ch.group.rotation.clone(), keepS = ch.rig.scale.x, keepRp = ch.rig.position.clone();
    ch.group.position.set(0, 0, 0); ch.group.rotation.set(0, 0, 0); // pose de reposo: gin activo, centrado
    if (keepS < 0.05) ch.rig.scale.setScalar(this.fits[i].bs);
    ch.group.updateMatrixWorld(true);
    const img = ch.uni.uDepthMap.value.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d'); c.drawImage(img, 0, 0); const dm = c.getImageData(0, 0, cv.width, cv.height).data;
    const geo = ch.bottle.geometry, pos = geo.attributes.position, uv = geo.attributes.uv;
    const bs = ch.rig.scale.x, uCam = D / bs, v = new THREE.Vector3(), q = new THREE.Vector3();
    let max = 0, sum = 0, n = 0;
    for (let k = 0; k < pos.count; k += 29) {
      const px = Math.min(img.width - 1, Math.round(uv.getX(k) * (img.width - 1))), py = Math.min(img.height - 1, Math.round((1 - uv.getY(k)) * (img.height - 1)));
      const z = dm[(py * img.width + px) * 4] / 255 * ch.uni.uDepthW.value, kk = (uCam - z) / uCam;
      v.set((pos.getX(k) + AXIS_SHIFT) * kk - AXIS_SHIFT, pos.getY(k) * kk, z).applyMatrix4(ch.bottle.matrixWorld).project(this.camera);
      q.set(pos.getX(k), pos.getY(k), 0).applyMatrix4(ch.bottle.matrixWorld).project(this.camera);
      const e = Math.hypot((v.x - q.x) * this.w / 2, (v.y - q.y) * this.h / 2);
      max = Math.max(max, e); sum += e; n++;
    }
    const w = ch.bottle.geometry.parameters.width, h = ch.bottle.geometry.parameters.height;
    ch.group.position.copy(keepP); ch.group.rotation.copy(keepR); ch.rig.scale.setScalar(keepS); ch.rig.position.copy(keepRp);
    return { maxPx: +max.toFixed(3), meanPx: +(sum / n).toFixed(3), meshAspect: +(w / h).toFixed(5), photoAspect: +(g.depth.w / g.depth.h).toFixed(5), samples: n };
  }

  /* diagnóstico: rectángulos en pantalla (px) de lo que está visible en la escena */
  screenRects() {
    const out = [], v = this._v, box = this._box, cam = this.camera;
    const proj = (b) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam);
        const px = (v.x + 1) / 2 * this.w, py = (1 - v.y) / 2 * this.h;
        x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
      }
      return { x0, y0, x1, y1 };
    };
    this.scene.updateMatrixWorld(true);
    this.chapters.forEach((ch, i) => {
      if (!ch.group.visible) return;
      if (ch.uni.uOpacity.value > 0.1) { box.setFromObject(ch.bottle); out.push({ kind: 'botella', chapter: i, ...proj(box) }); }
      ch.entries.forEach((e) => { if (e.g.visible) { box.setFromObject(e.g); out.push({ kind: 'botanico', chapter: i, id: e.id, scale: e.g.scale.x, ...proj(box) }); } });
      if (ch.scenery?.group.visible) ch.scenery.group.children.forEach((m) => { if (m.isMesh && m.visible && (m.material.opacity === undefined || m.material.opacity > 0.02 || m.material.uniforms)) { box.setFromObject(m); out.push({ kind: 'escenografia', chapter: i, ...proj(box) }); } });
    });
    return out;
  }

  dispose() { this.renderer.dispose(); }
}
