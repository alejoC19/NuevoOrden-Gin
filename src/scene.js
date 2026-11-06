import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createBottle } from './bottle.js';
import { makeWordTexture, DISPLAY } from './labels.js';
import { BRAND } from './data.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;
const SP = 4; // separación entre botellas

export class Stage {
  constructor(canvas, bottles) {
    this.canvas = canvas;
    this.data = bottles;
    this.mouse = new THREE.Vector2();
    this.mouseS = new THREE.Vector2();
    this.state = { f: 0, phase: 'hero' };
    this.intro = { v: 0 };
    this.snapshotMode = false;

    const low = matchMedia('(max-width: 768px)').matches;
    this.low = low;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050607');
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

    this.buildEnvironment();
    this.buildBackdrop();
    this.buildBottles();
    this.buildParticles();
    this.buildComposer();
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    });
  }

  /* ── estudio de luces (softboxes → PMREM) ── */
  buildEnvironment() {
    const env = new THREE.Scene();
    const box = (w, h, d, x, y, z, i, col = '#ffffff') => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(i) }));
      m.position.set(x, y, z);
      env.add(m);
    };
    env.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: '#0a0b0e', side: THREE.BackSide })));
    box(14, 0.4, 8, 0, 9, 2, 7);
    box(0.4, 14, 5, -9, 1, 1, 5, '#ffe9cf');
    box(0.4, 14, 5, 9, 1, 1, 6, '#dbe9ff');
    box(0.3, 12, 3, -4, 1, -9, 5);
    box(0.3, 12, 3, 4, 1, -9, 4);
    box(12, 0.3, 6, 0, -7, 2, 1.2);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(env, 0.025).texture;
    pm.dispose();
  }

  /* ── fondo único: glows + palabras gigantes (se refractan en el vidrio) ── */
  buildBackdrop() {
    const D = this.data;
    const words = D.map((b) => makeWordTexture(b.word, b.accent));
    this.heroTexOne = this.makeHeroTexture(false);
    this.heroTexTwo = this.makeHeroTexture(true);
    const u = {
      uBg: { value: new THREE.Color('#050607') },
      uHero: { value: this.heroTexOne },
      uHeroOp: { value: 0 },
      uHeroRect: { value: new THREE.Vector4(-6.4, -1.3, 12.8, 3.2) },
      uW0: { value: words[0] }, uW1: { value: words[1] ?? words[0] }, uW2: { value: words[2] ?? words[0] }, uW3: { value: words[3] ?? words[0] },
      uWOp: { value: new THREE.Vector4() },
      uGlow: { value: Array.from({ length: 4 }, (_, i) => new THREE.Vector4(i * SP, 0.2, 0, 3.4)) },
      uCol: { value: Array.from({ length: 4 }, (_, i) => new THREE.Color(D[Math.min(i, D.length - 1)].accent)) },
      uTime: { value: 0 },
    };
    this.bd = u;
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        varying vec2 vW;
        void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xy; gl_Position = projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBg; uniform sampler2D uHero, uW0, uW1, uW2, uW3; uniform vec4 uHeroRect, uWOp; uniform vec4 uGlow[4]; uniform vec3 uCol[4]; uniform float uHeroOp, uTime;
        varying vec2 vW;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        vec4 tex(sampler2D t, vec4 r, vec2 w){ vec2 uv = (w - r.xy)/r.zw; if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) return vec4(0.); return texture2D(t, uv); }
        void main(){
          vec3 col = uBg;
          for(int i=0;i<4;i++){
            vec2 d = (vW - uGlow[i].xy) * vec2(1.0, 1.1);
            float g = exp(-dot(d,d) / (uGlow[i].w*uGlow[i].w));
            col += uCol[i] * g * uGlow[i].z;
          }
          float yy = 0.2 - 2.0;
          vec4 w0 = tex(uW0, vec4(0.0-8.0, yy, 16.0, 4.0), vW);
          vec4 w1 = tex(uW1, vec4(4.0-8.0, yy, 16.0, 4.0), vW);
          vec4 w2 = tex(uW2, vec4(8.0-8.0, yy, 16.0, 4.0), vW);
          vec4 w3 = tex(uW3, vec4(12.0-8.0, yy, 16.0, 4.0), vW);
          col = mix(col, w0.rgb * 1.6, w0.a * uWOp.x);
          col = mix(col, w1.rgb * 1.6, w1.a * uWOp.y);
          col = mix(col, w2.rgb * 1.6, w2.a * uWOp.z);
          col = mix(col, w3.rgb * 1.6, w3.a * uWOp.w);
          vec4 h = tex(uHero, uHeroRect, vW);
          col = mix(col, h.rgb * 1.5, h.a * uHeroOp);
          col += (hash(vW*40.0 + uTime) - 0.5) * 0.012;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(46, 22), mat);
    this.backdrop.position.set(6, 0, -3.2);
    this.scene.add(this.backdrop);
  }

  makeHeroTexture(two) {
    const cv = document.createElement('canvas');
    const w = two ? 2048 : 4096, h = two ? 2048 : 1024;
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const draw = (txt, y, size) => {
      c.font = `400 ${size}px ${DISPLAY}`;
      const mw = c.measureText(txt).width;
      if (mw > w * 0.94) { size *= (w * 0.94) / mw; c.font = `400 ${size}px ${DISPLAY}`; }
      const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      g.addColorStop(0, '#fff3cf'); g.addColorStop(0.55, '#e6c378'); g.addColorStop(1, '#8c6a2a');
      c.globalAlpha = 0.16; c.fillStyle = g; c.fillText(txt, w / 2, y);
      c.globalAlpha = 1; c.strokeStyle = g; c.lineWidth = size * 0.012; c.strokeText(txt, w / 2, y);
    };
    const words = BRAND.hero.split(' ');
    if (two && words.length > 1) { draw(words[0], h * 0.28, h * 0.4); draw(words.slice(1).join(' '), h * 0.72, h * 0.4); }
    else draw(BRAND.hero, h / 2, h * 0.86);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  buildBottles() {
    this.items = this.data.map((v, i) => {
      const b = createBottle(v);
      b.root.position.x = i * SP;
      this.scene.add(b.root);
      return b;
    });
  }

  buildParticles() {
    const N = this.low ? 350 : 900;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos.set([Math.random() * 26 - 6, Math.random() * 12 - 6, Math.random() * 9 - 5.5], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.pu = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#e6c378') }, uPx: { value: this.renderer.getPixelRatio() } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.pu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + 6.0 + uTime*(0.08 + seed*0.18), 12.0) - 6.0;
          p.x += sin(uTime*0.3 + seed*30.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = (1.2 + seed*3.2) * uPx * (9.0 / -mv.z);
          vA = 0.25 + seed*0.6;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(uColor, a*vA); }`,
    });
    this.particles = new THREE.Points(g, m);
    this.scene.add(this.particles);
  }

  buildComposer() {
    const size = this.renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.low ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.7, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    if (this.snapshotMode) return;
    const w = innerWidth, h = innerHeight;
    this.aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    const two = this.aspect < 0.9;
    if (this.bd) {
      this.bd.uHero.value = two ? this.heroTexTwo : this.heroTexOne;
      this.bd.uHeroRect.value.set(...(two ? [-2.6, -2.3, 5.2, 5.2] : [-6.4, -1.3, 12.8, 3.2]));
    }
  }

  setLayout(l) { this.layout = l; }

  fitDist(width) {
    return width / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.aspect);
  }

  /* pose de cámara en la sección de variedades */
  varPose(f) {
    const wide = this.aspect > 1.0;
    const sx = wide ? 1.9 * Math.min(1, this.aspect / 1.5) : 0;
    const sy = wide ? 0 : -1.15;
    return { tx: f * SP - sx * Math.cos(Math.PI * f), ty: sy, dist: wide ? 11.2 : Math.max(12, this.fitDist(3.8)), az: Math.sin(Math.PI * f) * 0.18, el: 0.06 };
  }
  lerpPose(a, b, t) {
    return { tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t), dist: lerp(a.dist, b.dist, t), az: lerp(a.az, b.az, t), el: lerp(a.el, b.el, t) };
  }

  update(scroll, time, dt) {
    const L = this.layout;
    if (!L) return;
    const vh = innerHeight;
    const asp = this.aspect;
    const wide = asp > 1.0;
    const intro = ease(this.intro.v);
    const N = this.data.length, F = N - 1;

    // progreso por tramo
    const h = clamp(scroll / L.manifesto);
    const m = clamp((scroll - L.manifesto) / (L.bottles - L.manifesto));
    const bRange = Math.max(1, L.bottlesH - vh);
    const f = clamp((scroll - L.bottles) / bRange) * F;
    const procEnd = L.process - vh + vh * 1.1;
    const u = clamp((scroll - (L.process - vh)) / (vh * 1.1));
    const q = clamp((scroll - (L.finale - vh * 0.4)) / Math.max(1, L.finaleH - vh * 0.6));

    const heroStart = { tx: 0, ty: wide ? 0 : -0.4, dist: wide ? 14.5 : Math.max(14, this.fitDist(4.8)), az: 0, el: 0.05 };
    const heroEnd = { tx: 0, ty: wide ? 0 : -0.4, dist: wide ? 11.2 : Math.max(12, this.fitDist(3.8)), az: 0, el: 0.05 };
    const processP = { tx: (F / 2) * SP, ty: 0.5, dist: this.fitDist(15), az: 0, el: 0.1 };
    const finaleP = { tx: (F / 2) * SP, ty: wide ? 0.9 : 1.6, dist: this.fitDist(wide ? 12.5 : 12.8), az: 0, el: 0.04 };

    let pose, phase;
    if (scroll < L.manifesto) { pose = this.lerpPose(heroStart, heroEnd, ease(h)); phase = 'hero'; }
    else if (scroll < L.bottles) { pose = this.lerpPose(heroEnd, this.varPose(0), ease(m)); phase = 'manifesto'; }
    else if (scroll < L.bottles + bRange) { pose = this.varPose(f); phase = 'vars'; }
    else if (u < 1 || scroll < L.finale - vh * 0.4) { pose = this.lerpPose(this.varPose(F), processP, ease(u)); phase = 'process'; }
    else { pose = processP; phase = 'process'; }
    if (q > 0) { pose = this.lerpPose(processP, finaleP, ease(q)); phase = 'finale'; }
    if (scroll >= L.gallery && scroll < L.finale - vh * 0.4) phase = 'gallery';
    this.state.f = f; this.state.phase = phase; this.state.q = q;

    // intro de la cámara
    const introPose = { dist: pose.dist * lerp(1.35, 1, intro) };

    // ratón (parallax)
    this.mouseS.lerp(this.mouse, 1 - Math.pow(0.001, dt));
    const az = pose.az + this.mouseS.x * 0.09;
    const el = pose.el + this.mouseS.y * 0.04;
    const d = introPose.dist;
    this.camera.position.set(pose.tx + Math.sin(az) * d, pose.ty + Math.sin(el) * d + 0.2, Math.cos(az) * Math.cos(el) * d);
    this.camera.lookAt(pose.tx, pose.ty, 0);

    // fondo / acento global
    const bg = new THREE.Color(), accent = new THREE.Color();
    const fi = clamp(f, 0, F), i0 = Math.floor(Math.min(fi, F - 0.001)), tf = fi - i0;
    const bgA = new THREE.Color(this.data[i0].bg), bgB = new THREE.Color(this.data[i0 + 1].bg);
    const acA = new THREE.Color(this.data[i0].accent), acB = new THREE.Color(this.data[i0 + 1].accent);
    bg.copy(bgA).lerp(bgB, tf); accent.copy(acA).lerp(acB, tf);
    const calm = new THREE.Color('#07070a');
    if (phase === 'hero' || phase === 'manifesto') { bg.set(this.data[0].bg); accent.set(this.data[0].accent); }
    if (phase === 'process' || phase === 'gallery' || phase === 'finale') {
      const k = phase === 'process' ? ease(u) : 1;
      bg.lerp(calm, k); accent.lerp(new THREE.Color('#e6c378'), k);
    }
    this.scene.background.copy(bg);
    this.bd.uBg.value.copy(bg);
    this.pu.uColor.value.copy(accent);
    this.accent = accent; this.bgc = bg;

    // palabras / título hero
    const heroOp = intro * (1 - ease(clamp(m * 1.4)));
    this.bd.uHeroOp.value = phase === 'hero' ? intro : phase === 'manifesto' ? heroOp : 0;
    const wop = [0, 0, 0, 0];
    this.data.forEach((_, i) => {
      let o = 0;
      if (phase === 'vars') o = clamp(1 - Math.abs(f - i) * 1.35);
      else if (phase === 'manifesto') o = i === 0 ? ease(clamp((m - 0.55) * 2.2)) : 0;
      else if (phase === 'process' && i === F) o = 1 - ease(u);
      wop[i] = o * 0.5;
    });
    this.bd.uWOp.value.set(...wop);
    this.bd.uTime.value = time;
    this.pu.uTime.value = time;

    // botellas
    const waveQ = (i) => ease(clamp(q * 1.7 - i * 0.14));
    this.items.forEach((b, i) => {
      const a = phase === 'vars' ? clamp(1 - Math.abs(f - i)) : phase === 'hero' || phase === 'manifesto' ? (i === 0 ? 1 : 0.0) : phase === 'process' && u < 1 ? lerp(i === F ? 1 : 0, 1, ease(u)) : 1;
      let rot, pop = 0, sc = 1;
      if (phase === 'hero') rot = ease(h) * TAU;
      else if (phase === 'manifesto') { rot = i === 0 ? Math.sin(Math.PI * m) * 0.55 : -2.2; pop = i === 0 ? Math.sin(Math.PI * Math.min(1, m * 1.15)) * 1.0 : 0; }
      else if (phase === 'vars') { rot = clamp(-(f - i) * 2.2, -2.2, 2.2); sc = lerp(0.82, 1, a); }
      else if (phase === 'process') { const r0 = clamp(-(F - i) * 2.2, -2.2, 2.2); rot = lerp(r0, 0, ease(u)); sc = lerp(0.82, 1, ease(u) * (i === F ? 0 : 1) + (i === F ? 1 : 0)); }
      else if (phase === 'gallery') { rot = Math.sin(time * 0.4 + i) * 0.35; }
      else { rot = waveQ(i) * TAU; pop = Math.sin(Math.PI * waveQ(i)) * 0.9; }
      // hero: la botella 0 entra desde arriba girando
      let yOff = Math.sin(time * 0.8 + i * 1.3) * 0.06;
      if (i === 0) { yOff += (1 - intro) * 5; rot += (1 - intro) * 2.4; }
      else if (phase === 'hero' || phase === 'manifesto') { sc = 0.82; }
      b.root.position.y = yOff;
      b.root.rotation.y = rot + (phase === 'hero' || phase === 'vars' || phase === 'finale' ? Math.sin(time * 0.35 + i) * 0.06 : 0);
      b.root.scale.setScalar(phase === 'vars' ? Math.max(0.001, sc * clamp(a * 3)) : sc);
      b.root.visible = (phase === 'hero' || phase === 'manifesto') ? i === 0 : phase === 'vars' ? Math.abs(f - i) < 0.995 : true;
      b.stopper.position.y = pop;
      b.stopper.rotation.y = pop * 3.0;
      b.liqMat.uniforms.uTime.value = time;
      b.sway?.(time);
      const glowI = (i === 0 && (phase === 'hero' || phase === 'manifesto') ? intro : a) * 1.0;
      b.liqMat.uniforms.uBoost.value = 0.75 + glowI * 0.4;
      b.podRing.material.color.set(this.data[i].accent).multiplyScalar(0.4 + 2 * glowI);
      b.bot.update(time, (i === 0 && (phase === 'hero' || phase === 'manifesto') ? intro : a) * (phase === 'process' && u > 0.5 ? 0.0 + (1 - ease(u)) : 1));
      this.bd.uGlow.value[i].z = 0.32 * glowI;
    });
    this.bd.uGlow.value.forEach((g, i) => { g.w = phase === 'process' || phase === 'finale' || phase === 'gallery' ? 2.2 : 2.8; });

    // el bloom respira con la sección
    this.bloom.strength = 0.24 + (phase === 'finale' ? 0.12 : 0);

    // opacidad del canvas durante la galería (para que lea el DOM)
    this.canvas.style.opacity = '1';
    this.composer.render(dt);
  }

  /* ── renders de producto (reemplazo de fotos reales) ── */
  snapshot(indices, w = 900, h = 1125) {
    this.snapshotMode = true;
    const r = this.renderer;
    const prevSize = r.getSize(new THREE.Vector2());
    const prevPR = r.getPixelRatio();
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    const saved = this.items.map((b) => ({ x: b.root.position.x, v: b.root.visible, ry: b.root.rotation.y, s: b.root.scale.x, y: b.root.position.y }));
    const n = indices.length;
    const gap = 2.25;
    this.items.forEach((b, i) => {
      const k = indices.indexOf(i);
      b.root.visible = k >= 0;
      if (k >= 0) {
        b.root.position.set((k - (n - 1) / 2) * gap, 0, k % 2 ? -0.3 : 0);
        b.root.rotation.y = n === 1 ? -0.35 : (k - (n - 1) / 2) * -0.25;
        b.root.scale.setScalar(1);
        b.stopper.position.y = 0;
        b.bot.update(1.7 + k, 1);
        b.liqMat.uniforms.uBoost.value = 1.15;
        b.podRing.material.color.set(this.data[i].accent).multiplyScalar(2.4);
      }
    });
    const main = this.data[indices[0]];
    const bg = new THREE.Color(main.bg).lerp(new THREE.Color('#000'), 0.1);
    const spanW = Math.max(3.4, (n - 1) * gap + 3.2);
    const dist = Math.max(11.5, spanW / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * (w / h)));
    cam.position.set(0, 0.4, dist);
    cam.lookAt(0, -0.05, 0);
    this.backdrop.position.x = 0;
    this.bd.uBg.value.copy(bg); this.scene.background.copy(bg);
    this.bd.uHeroOp.value = 0; this.bd.uWOp.value.set(0, 0, 0, 0);
    this.bd.uGlow.value.forEach((g, i) => { const k = indices.indexOf(i); g.set((k >= 0 ? (k - (n - 1) / 2) * gap : 0), 0.1, k >= 0 ? 0.6 : 0, 3.2); });
    this.particles.visible = false;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const comp = new EffectComposer(r, rt);
    comp.setPixelRatio(1); comp.setSize(w, h);
    comp.addPass(new RenderPass(this.scene, cam));
    comp.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.7, 0.9));
    comp.addPass(new OutputPass());
    comp.render(0.016);
    const url = this.canvas.toDataURL('image/jpeg', 0.9);
    comp.dispose(); rt.dispose();
    // restaurar
    this.backdrop.position.x = 6;
    this.items.forEach((b, i) => { b.root.position.set(saved[i].x, saved[i].y, 0); b.root.visible = saved[i].v; b.root.rotation.y = saved[i].ry; b.root.scale.setScalar(saved[i].s); });
    this.particles.visible = true;
    r.setPixelRatio(prevPR);
    this.snapshotMode = false;
    r.setSize(prevSize.x, prevSize.y, false);
    this.resize();
    return url;
  }
}
