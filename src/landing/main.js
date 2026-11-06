import '../styles/base.css';
import '../styles/landing.css';
import Lenis from 'lenis';
import { BRAND, GINS, BOTANICALS, GINTONIC_STEPS, SERVES } from '../shared/data.js';
import { initCursor, initReveals, fillContact, clamp, ICONS } from '../shared/ui.js';
import { Stage } from './stage.js';
import { story, GO_U } from './timeline.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 860px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const hiQ = !isMobile && !lowEnd;

/* ───────── contenido ───────── */
const pin = $('#pin');
pin.innerHTML = GINS.map((g, i) => `
  <article class="panel" data-i="${i}" aria-label="${g.name}">
    <p class="no">0${i + 1} / 03 &nbsp;·&nbsp; ${g.kind}</p>
    <h2 class="display gold-text">${g.name}</h2>
    <p class="lead">${g.lead}</p>
    <p class="desc">${g.desc}</p>
    <dl class="facts">${g.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="bots-h">Botánicos</p>
    <ul class="bots">${g.botanicals.map((id) => {
      const b = BOTANICALS[id];
      const th = b.photo ? `<span class="th" style="background-image:url(${b.photo})"></span>` : `<span class="th">${ICONS[b.icon]}</span>`;
      return `<li data-b="${id}">${th}<div><b>${b.name}</b><small>${b.desc}</small></div></li>`;
    }).join('')}</ul>
    <p class="bot-desc" aria-live="polite"></p>
    <img class="fb" src="${g.img}" alt="Botella de Argentino Gin ${g.name}" width="${Math.round(1100 * g.imgAspect)}" height="1100" loading="lazy" />
  </article>`).join('');
const panels = $$('.panel', pin);

$('#steps').innerHTML = GINTONIC_STEPS.map((s, i) => `<li class="reveal" style="--d:${i * 110}ms"><div><h4>${s.t}</h4><p>${s.d}</p></div></li>`).join('');
$('#serves').innerHTML = SERVES.map((s, i) => `<article class="serve reveal" style="--c:${s.c};--d:${i * 110}ms"><small>${s.gin}</small><h4>${s.t}</h4><p>${s.d}</p></article>`).join('');
fillContact($('#fContact'));
$('#copy').textContent = `© ${new Date().getFullYear()} ${BRAND.full}`;
initCursor();
initReveals();

/* ───────── medidas (cacheadas; solo se actualizan si cambian de verdad) ───────── */
const el = { hero: $('#top'), gins: $('#gins'), origen: $('#origen'), exp: $('#experiencia'), cierre: $('#cierre'), pin };
let L = null;
function measure() {
  const top = (e) => e.getBoundingClientRect().top + window.scrollY;
  const n = {
    heroH: el.hero.offsetHeight, ginsTop: top(el.gins), ginsH: el.gins.offsetHeight, pinH: pin.offsetHeight || innerHeight,
    origenTop: top(el.origen), expTop: top(el.exp), cierreTop: top(el.cierre), cierreH: el.cierre.offsetHeight, vh: innerHeight,
  };
  if (!L || Object.keys(n).some((k) => Math.abs(n[k] - L[k]) > 1.5)) L = n;
}
let measureT;
const remeasure = () => { clearTimeout(measureT); measureT = setTimeout(measure, 120); };
measure();

/* ───────── escena 3D (un único canvas para toda la landing) ───────── */
let stage = null;
const kinds = Object.fromEntries(Object.entries(BOTANICALS).map(([k, v]) => [k, v.kind]));
const cfg = GINS.map((g) => ({ ...g, kinds }));
let lastSize = { w: 0, h: 0 };

/* ───────── scroll ───────── */
const lenis = reduce ? null : new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true });
const scrollY = () => (lenis ? lenis.scroll : window.scrollY);
const goTo = (target, opts = {}) => (lenis ? lenis.scrollTo(target, { duration: 2, ...opts }) : window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }));

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { e.preventDefault(); goTo(L.ginsTop + (L.ginsH - L.pinH) * GO_U[+go.dataset.go]); return; }
  const a = e.target.closest('a[href^="#"]');
  if (a && a.getAttribute('href').length > 1) {
    const t = $(a.getAttribute('href'));
    if (t) { e.preventDefault(); goTo(a.getAttribute('href') === '#top' ? 0 : a.getAttribute('href') === '#gins' ? L.ginsTop : t); }
  } else if (a) { e.preventDefault(); goTo(0); }
});

/* ───────── estado mutable (sin asignaciones por frame) ───────── */
const mouse = { x: 0, y: 0 };
addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = -((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
const root = document.documentElement.style;
const bgNow = { a: [253, 248, 238], b: [240, 224, 184], g: [233, 200, 118], gx: 68 };
let lastBgKey = '';
const progItems = $$('#progress li');
const navEl = $('#nav'), navShop = $('#navShop'), pbar = $('#pbar');
const heroCopy = $('.hero-copy'), heroMark = $('.hero-mark'), cue = $('.cue');
const finCopy = $('.f-copy');
const parallax = $$('[data-parallax]');
const inView = new Set();
const pio = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? inView.add(e.target) : inView.delete(e.target))), { rootMargin: '10% 0px' });
parallax.forEach((p) => pio.observe(p));
const panelState = GINS.map(() => ({ key: '', swap: 0 }));
let progKey = '', introStart = 0, introDone = false, ready = false;
const introV = { v: 0 };
const mix3 = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
const stageState = { mode: 'story', h: 0, f: 0, reveal: [0, 0, 0], q: 0, intro: 0, t: 0, mx: 0, my: 0 };

function updateBg(f, mode, screenX) {
  let A, B, G;
  if (mode === 'finale') { A = [253, 248, 238]; B = [239, 220, 176]; G = [233, 200, 118]; }
  else {
    const i0 = Math.min(Math.floor(f), GINS.length - 2), t = f - i0;
    const a = GINS[i0].tint, b = GINS[i0 + 1].tint;
    A = mix3(a.a, b.a, t); B = mix3(a.b, b.b, t); G = mix3(a.glow, b.glow, t);
  }
  const gx = 50 + screenX * 100;
  const key = `${A.map(Math.round)}|${B.map(Math.round)}|${G.map(Math.round)}|${Math.round(gx * 2)}`;
  if (key === lastBgKey) return;
  lastBgKey = key;
  root.setProperty('--bg-a', `rgb(${A.map(Math.round)})`);
  root.setProperty('--bg-b', `rgb(${B.map(Math.round)})`);
  root.setProperty('--glow', G.map(Math.round).join(','));
  root.setProperty('--gx', gx.toFixed(1) + '%');
}

function setBotanicals(i, g, r) {
  const E = (g.scene || g.botanicals).length;
  const ids = g.scene || g.botanicals;
  const n = r <= 0 ? 0 : Math.min(E, Math.ceil(r * E - 1e-4));
  const seen = new Set(ids.slice(0, n));
  const active = n ? ids[n - 1] : '';
  const key = [...seen].join(',') + '|' + active;
  const st = panelState[i];
  if (st.key === key) return;
  st.key = key;
  const p = panels[i];
  $$('.bots li', p).forEach((li) => { li.classList.toggle('seen', seen.has(li.dataset.b)); li.classList.toggle('active', li.dataset.b === active); });
  const d = $('.bot-desc', p);
  d.classList.add('swap');
  clearTimeout(st.swap);
  st.swap = setTimeout(() => {
    const b = active ? BOTANICALS[active] : null;
    d.innerHTML = b ? `<strong>${b.name}.</strong> ${b.desc}` : 'Seguí bajando: sus botánicos van apareciendo uno a uno.';
    d.classList.remove('swap');
  }, 160);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  lenis?.raf(now);
  const y = scrollY();
  const t = now / 1000;
  if (!L) return;

  // ── navegación y progreso ──
  navEl.classList.toggle('scrolled', y > 40);
  const range = Math.max(1, L.ginsH - L.pinH);
  const u = clamp((y - L.ginsTop) / range);
  navShop.classList.toggle('show', y >= L.ginsTop + range * 0.93);
  pbar.style.setProperty('--p', clamp(y / Math.max(1, document.documentElement.scrollHeight - L.vh)).toFixed(4));

  const { f, reveal } = story(u);
  const h = clamp(y / Math.max(1, L.heroH));
  const finaleQ = clamp((y - (L.cierreTop - L.vh * 0.75)) / (L.vh * 0.85));

  // ── paneles de texto ──
  panels.forEach((p, i) => {
    const d = f - i;
    const o = clamp(1 - Math.abs(d) * 2.6);
    p.style.setProperty('--o', o.toFixed(3));
    p.style.setProperty('--dy', (d * -46).toFixed(1) + 'px');
    p.classList.toggle('live', o > 0.5);
    setBotanicals(i, GINS[i], reveal[i]);
  });
  const inGins = y < L.origenTop + 4;
  const hf = clamp(1 - h * 1.7);
  heroCopy.style.opacity = hf.toFixed(3);
  heroCopy.style.transform = `translate3d(0,${(-h * 60).toFixed(1)}px,0)`;
  heroMark.style.opacity = hf.toFixed(3);
  if (cue) cue.style.opacity = clamp(1 - h * 4).toFixed(3);
  finCopy.style.setProperty('--fo', clamp((finaleQ - 0.72) / 0.28).toFixed(3));

  // ── progreso de la historia (indicador lateral) ──
  let cur = 'top';
  if (y >= L.cierreTop - L.vh * 0.5) cur = 'cierre';
  else if (y >= L.expTop - L.vh * 0.5) cur = 'experiencia';
  else if (y >= L.origenTop - L.vh * 0.5) cur = 'origen';
  else if (y >= L.ginsTop - L.vh * 0.2) cur = GINS[Math.round(f)].id;
  if (cur !== progKey) { progKey = cur; progItems.forEach((li) => li.classList.toggle('on', li.dataset.s === cur)); }

  // ── imágenes con parallax suave (solo las visibles) ──
  inView.forEach((img) => {
    const r = img.parentElement.getBoundingClientRect();
    const k = (r.top + r.height / 2 - L.vh / 2) / L.vh;
    img.style.transform = `translate3d(0,${(-k * 7).toFixed(2)}%,0)`;
  });

  // ── escena 3D: solo se dibuja cuando se ve ──
  if (!stage || !ready) return;
  const cierreEnd = L.cierreTop + L.cierreH;
  const finaleActive = y >= L.cierreTop - L.vh - 40 && y <= cierreEnd + 4;
  if (!inGins && !finaleActive) return; // las secciones opacas la tapan: la GPU descansa

  if (introStart && !introDone) {
    const p = clamp((now - introStart) / 2200);
    introV.v = reduce ? 1 : 1 - Math.pow(1 - p, 3);
    if (p >= 1) introDone = true;
  }
  const s = stageState;
  s.mode = inGins ? 'story' : 'finale';
  s.h = h; s.f = f; s.reveal = reveal; s.q = finaleQ; s.intro = introV.v; s.t = t; s.mx = mouse.x; s.my = mouse.y;
  const t0 = performance.now();
  stage.render(s);
  stage.govern(performance.now() - t0 + 8);
  updateBg(f, s.mode, s.mode === 'story' ? stage.cx / stage.Wv : 0);
}

/* ───────── arranque ───────── */
const ldBar = $('.ld-bar i');
async function boot() {
  const fonts = Promise.race([
    Promise.all([document.fonts.load('40px "Rye"'), document.fonts.load('italic 20px "IM Fell English"'), document.fonts.load('500 16px "Barlow"')]),
    new Promise((r) => setTimeout(r, 3500)),
  ]).catch(() => {});
  ldBar.style.width = '12%';
  try {
    stage = new Stage($('#gl'), cfg, { hiQ, reduce });
    const sz = () => { const w = innerWidth, hh = innerHeight; stage.resize(w, hh); lastSize = { w, h: hh }; };
    sz();
    await Promise.all([stage.load((p) => (ldBar.style.width = 12 + p * 80 + '%')), fonts]);
  } catch (err) {
    console.warn('WebGL no disponible, se usa la composición estática.', err);
    stage = null;
    document.body.classList.add('no-gl');
    await fonts;
  }
  ldBar.style.width = '100%';
  measure();
  ready = !!stage;
  if (stage) { stage.cx = 0; }
  requestAnimationFrame(() => {
    document.body.classList.add('ready');
    $('#loader').classList.add('done');
    introStart = performance.now() + 250;
    if (!stage) introV.v = 1;
  });
}

addEventListener('resize', () => {
  // en móviles la barra del navegador cambia el alto: se ignoran variaciones chicas
  const w = innerWidth, hh = innerHeight;
  const bigChange = Math.abs(w - lastSize.w) > 2 || Math.abs(hh - lastSize.h) > 140;
  if (stage && bigChange) { stage.resize(w, hh); lastSize = { w, h: hh }; }
  remeasure();
});
addEventListener('load', remeasure);
document.fonts?.ready.then(remeasure);
document.addEventListener('visibilitychange', () => { if (!document.hidden) remeasure(); });

requestAnimationFrame(frame);
boot();
