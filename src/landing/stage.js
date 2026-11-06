import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createIngredient } from './botanicals.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const WORLD_H = 5.6; // alto visible del mundo en z = 0
const BOTTLE_H = 3.6; // alto de la botella en unidades de mundo
const FOV = 26;

/* posiciones (x, y, z) de los botánicos alrededor de la botella, según cuántos hay */
const SLOTS = {
  1: [[-1.7, 0.6, 0.9]],
  2: [[-1.7, 0.9, 0.9], [1.7, -0.5, -0.7]],
  3: [[-1.7, 1.0, 0.9], [1.75, 0.4, -0.7], [-1.5, -1.2, 0.8]],
  6: [[-1.75, 1.2, 0.9], [1.7, 1.5, -0.7], [-1.85, -0.1, -0.8], [1.85, 0.1, 1.0], [-1.5, -1.35, 0.8], [1.6, -1.25, -0.6]],
};

/* sombra de contacto: elipse suave */
function shadowTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(128, 128, 2, 128, 128, 128);
  g.addColorStop(0, 'rgba(70,45,12,0.6)'); g.addColorStop(0.4, 'rgba(70,45,12,0.26)'); g.addColorStop(1, 'rgba(70,45,12,0)');
  c.scale(1, 0.25); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const BOTTLE_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const BOTTLE_FS = /* glsl */ `
  uniform sampler2D map; uniform float uOpacity, uSweep; varying vec2 vUv;
  void main(){
    vec4 t = texture2D(map, vUv);
    float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
    // brillo de estudio que recorre el vidrio (solo sobre zonas claras)
    float band = smoothstep(0.16, 0.0, abs(vUv.x - uSweep)) * smoothstep(0.35, 0.85, lum);
    vec3 c = t.rgb + band * 0.14;
    gl_FragColor = vec4(c, t.a * uOpacity);
    #include <colorspace_fragment>
  }`;
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
    this.canvas = canvas;
    this.gins = gins;
    this.hiQ = hiQ;
    this.reduce = reduce;
    this.dprMax = hiQ ? 2 : 1.5;
    this.lost = false;
    this.mouse = new THREE.Vector2();
    this.mouseS = new THREE.Vector2();
    this.frameAvg = 16;
    this.slowFrames = 0;
    this.cx = 0;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    this.camera.position.set(0, 0, WORLD_H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; });

    // entorno de estudio claro (luz suave y reflejos coherentes para los botánicos)
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();
    const key = new THREE.DirectionalLight('#fff1d4', 1.1); key.position.set(-3, 4, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight('#ffe2a8', 0.6); rim.position.set(4, 2, -3); this.scene.add(rim);

    this.chapters = [];
    this.shadowTex = shadowTexture();
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this.buildDust();
  }

  /* carga la textura de cada botella y arma su "estudio" */
  async load(onProgress) {
    const loader = new THREE.TextureLoader();
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    let done = 0;
    for (let i = 0; i < this.gins.length; i++) {
      const gin = this.gins[i];
      const tex = await loader.loadAsync(gin.img);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
      this.chapters.push(this.buildChapter(gin, tex, i));
      onProgress?.(++done / this.gins.length);
      await new Promise((r) => setTimeout(r, 0)); // cede el hilo: el loader sigue animado
    }
    this.layout();
  }

  buildChapter(gin, tex, i) {
    const group = new THREE.Group();
    const w = BOTTLE_H * gin.imgAspect;

    const uni = { map: { value: tex }, uOpacity: { value: 1 }, uSweep: { value: 0 } };
    const bottle = new THREE.Mesh(this.planeGeo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: BOTTLE_VS, fragmentShader: BOTTLE_FS, transparent: true, depthWrite: false }));
    bottle.scale.set(w, BOTTLE_H, 1); bottle.renderOrder = 3;

    const refl = new THREE.Mesh(this.planeGeo, new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uOpacity: uni.uOpacity }, vertexShader: BOTTLE_VS, fragmentShader: REFL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    refl.scale.set(w, -BOTTLE_H, 1); refl.position.y = -BOTTLE_H; refl.renderOrder = 2;

    const shadow = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
    shadow.scale.set(w * 2.1, 0.62, 1); shadow.position.set(0, -BOTTLE_H / 2 + 0.02, -0.02); shadow.renderOrder = 1;

    group.add(refl, shadow, bottle);

    // botánicos de este gin (si hay menos piezas que ranuras, se repite el modelo)
    const ids = gin.scene || gin.botanicals;
    const slots = SLOTS[ids.length] || SLOTS[3];
    const ingredients = new THREE.Group();
    const entries = ids.map((id, k) => {
      const kind = gin.kinds[id];
      const g = createIngredient(kind, this.hiQ, 11 + i * 31 + k * 7);
      g.visible = false;
      ingredients.add(g);
      return { id, k, g, slot: new THREE.Vector3(...slots[k]), seed: k * 1.7 + i };
    });
    group.add(ingredients);
    group.visible = false;
    this.scene.add(group);
    return { group, bottle, uni, entries, ingredients, w };
  }

  /* polvo dorado en suspensión */
  buildDust() {
    const N = this.hiQ ? 140 : 60;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, -1.5 + Math.random() * 3.5], i * 3); seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.dustU = { uTime: { value: 0 }, uPx: { value: 1 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.dustU, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `attribute float seed; uniform float uTime, uPx; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y + 4.0 + uTime*(0.05+seed*0.1), 8.0) - 4.0; p.x += sin(uTime*0.25 + seed*40.0)*0.25;
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = (2.0 + seed*4.5) * uPx * (9.0 / -mv.z);
          vA = (0.25 + 0.55*seed) * (0.55 + 0.45*sin(uTime*(0.8+seed*1.5) + seed*30.0)); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(0.86,0.64,0.2, smoothstep(0.5,0.0,d)*vA); }`,
    });
    this.dust = new THREE.Points(g, m); this.dust.renderOrder = 4; this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  /* ── tamaño y composición según el dispositivo ── */
  resize(w, h) {
    this.w = w; this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.dustU.uPx.value = dpr;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.layout();
  }

  layout() {
    if (!this.w) return;
    const asp = this.w / this.h;
    this.asp = asp;
    this.Wv = WORLD_H * asp;
    this.wide = asp >= 1.0;
    this.shiftX = this.wide ? 0.215 * this.Wv : 0;
    this.heroX = this.wide ? 0.17 * this.Wv : 0;
    // móvil / vertical: la botella ocupa el 40% superior y el texto el resto
    this.baseY = this.wide ? 0.05 : 1.45;
    this.heroY = this.wide ? 0.05 : -0.95;
    this.bScale = this.wide ? 1 : 0.5;
    this.heroMul = this.wide ? 1.08 : 1.3;
    this.slotSX = this.wide ? Math.min(1, this.Wv / 9.5) : (this.Wv * 0.47) / 1.9;
    this.slotSY = this.wide ? 1 : 0.5;
    this.ingScale = this.wide ? 1.3 : 0.72;
  }

  /* degrada la calidad si el dispositivo no llega a ~40 fps sostenidos */
  govern(ms) {
    this.frameAvg = lerp(this.frameAvg, ms, 0.05);
    if (this.frameAvg > 26) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 90 && this.dprMax > 1) {
      this.dprMax = Math.max(1, this.dprMax - 0.5); this.slowFrames = 0; this.frameAvg = 16;
      this.resize(this.w, this.h);
    }
  }

  /**
   * s: { mode:'story'|'finale', h, f, reveal:[], q, intro, t, mx, my }
   * Todo es función continua del scroll (sin estados intermedios que puedan parpadear).
   */
  render(s) {
    if (this.lost || !this.chapters.length) return;
    this.mouseS.x += (s.mx - this.mouseS.x) * 0.12;
    this.mouseS.y += (s.my - this.mouseS.y) * 0.12;
    this.dustU.uTime.value = s.t;
    this.camera.position.x = this.reduce ? 0 : this.mouseS.x * 0.18;
    this.camera.position.y = this.reduce ? 0 : this.mouseS.y * 0.08;
    this.camera.lookAt(0, 0, 0);
    s.mode === 'finale' ? this.applyFinale(s) : this.applyStory(s);
    this.renderer.render(this.scene, this.camera);
  }

  applyStory(s) {
    const { h, f, reveal, t, intro } = s;
    const eh = ease(clamp(h));
    const Wv = this.Wv, SL = Wv * 0.9; // distancia entre gines: en reposo el vecino queda fuera de cuadro
    const centerX = this.wide ? -this.shiftX * Math.cos(Math.PI * f) : 0;
    const cx = centerX + (this.heroX - (this.wide ? -this.shiftX : 0)) * (1 - eh);
    this.cx = cx;
    const mxr = this.reduce ? 0 : this.mouseS.x, myr = this.reduce ? 0 : this.mouseS.y;

    this.chapters.forEach((ch, i) => {
      const d = i - f, ad = Math.abs(d);
      ch.group.visible = ad < 1.3;
      if (!ch.group.visible) return;
      const near = 1 - clamp(ad);
      const op = smooth(1.0, 0.2, ad) * (i === 0 ? intro : 1);
      const hero = i === 0 ? 1 - eh : 0;
      const bob = this.reduce ? 0 : Math.sin(t * 0.8 + i * 1.3) * 0.035;

      const by = i === 0 ? lerp(this.heroY, this.baseY, eh) : this.baseY;
      ch.group.position.set(d * SL + cx, by + bob + (i === 0 ? (1 - intro) * 0.7 : 0), 0);
      ch.group.scale.setScalar(this.bScale * (0.9 + 0.1 * near) * (1 + (this.heroMul - 1) * hero));
      ch.group.rotation.set(-myr * 0.04, -d * 0.5 + mxr * 0.1, 0);
      ch.uni.uOpacity.value = op;
      ch.uni.uSweep.value = this.reduce ? 0.5 : (((t * 0.07 + i * 0.3) % 1.6) - 0.3 + d * 0.4);

      // botánicos: aparecen en secuencia y se recogen hacia la botella cuando el gin se retira
      const r = reveal[i] || 0, E = ch.entries.length;
      const gather = 1 - smooth(0.05, 0.42, ad);
      ch.ingredients.visible = true;
      for (const e of ch.entries) {
        const a = clamp((r * E - e.k) / 0.9) * gather;
        e.g.visible = a > 0.002;
        if (!e.g.visible) continue;
        const p = easeOutCubic(a);
        e.g.position.set(
          lerp(0, e.slot.x * this.slotSX, p),
          lerp(0, e.slot.y * this.slotSY, p) + (this.reduce ? 0 : Math.sin(t * 0.9 + e.seed) * 0.07 * a),
          lerp(-0.1, e.slot.z, p),
        );
        e.g.scale.setScalar(this.ingScale * (e.g.userData.size || 1) * Math.max(0.0001, easeOutBack(a)));
        const sp = e.g.userData.spin, tt = this.reduce ? 0 : t;
        e.g.rotation.set(sp.x * tt + e.seed, sp.y * tt + (1 - a) * 4, sp.z * tt);
      }
    });
  }

  applyFinale(s) {
    const { q, t } = s;
    const Wv = this.Wv;
    const fs = this.wide ? clamp(Wv / 16, 0.62, 0.74) : 0.44;
    const gap = this.wide ? Math.min(2.7, Wv * 0.23) : Wv * 0.31;
    const baseY = this.wide ? 0.95 : 1.5;
    const mxr = this.reduce ? 0 : this.mouseS.x;
    this.chapters.forEach((ch, i) => {
      ch.group.visible = true;
      ch.ingredients.visible = false;
      const e = ease(clamp(q * 1.7 - i * 0.2));
      const mid = i === 1;
      ch.group.position.set((i - 1) * gap, baseY - (1 - e) * 1.0 + (this.reduce ? 0 : Math.sin(t * 0.8 + i * 1.3) * 0.03), mid ? 0.3 : 0);
      ch.group.scale.setScalar(fs * (mid ? 1.07 : 1));
      ch.group.rotation.set(0, (i - 1) * -0.16 + mxr * 0.08, 0);
      ch.uni.uOpacity.value = e;
      ch.uni.uSweep.value = this.reduce ? 0.5 : (((t * 0.07 + i * 0.3) % 1.6) - 0.3);
    });
  }

  dispose() {
    this.renderer.dispose();
  }
}
