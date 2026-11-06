import './style.css';
import Lenis from 'lenis';
import gsap from 'gsap';
import { Stage } from './scene.js';
import { BRAND, BOTTLES, PRODUCTS, PROCESS, IG_URL, WA_NUMBER, FREE_SHIP_FROM, INSTALLMENTS } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const money = (n) => '$' + Math.round(n).toLocaleString('es-AR');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE = import.meta.env.BASE_URL;

/* ── enlaces ── */
document.title = `${BRAND.full} · Tienda oficial`;
$$('.logo').forEach((l) => (l.innerHTML = `<b>${BRAND.name.toUpperCase()}</b><em>GIN</em>`));
$$('.ld-word span').forEach((s, i) => (s.textContent = i ? 'GIN' : BRAND.name.toUpperCase()));
$('#copy').textContent = `© 2026 ${BRAND.full}`;
['igLink', 'igLink2', 'igBtn'].forEach((id) => { const a = $('#' + id); IG_URL ? (a.href = IG_URL) : (a.style.display = 'none'); });
WA_NUMBER ? ($('#waLink').href = `https://wa.me/${WA_NUMBER}`) : ($('#waLink').style.display = 'none');
$('#perkShip').textContent = `En compras desde ${money(FREE_SHIP_FROM)}`;
$('#perkCuotas').textContent = `Hasta ${INSTALLMENTS} cuotas con tarjeta`;
const announceMsg = `Envío gratis desde ${money(FREE_SHIP_FROM)} · ${INSTALLMENTS} cuotas sin interés · Retiro y envíos a todo el país`;
$('#announce .mq').innerHTML = Array(8).fill(`<span>${announceMsg}</span>`).join('');
$('#marquee .mq-t').innerHTML = Array(10).fill(`<span>${BRAND.name}</span><span>Gin de autor</span>`).join('');
$('#shipNote').innerHTML = `🚚 <b>Envío gratis</b> en compras desde ${money(FREE_SHIP_FROM)} · Pagá en <b>${INSTALLMENTS} cuotas sin interés</b> · Coordinamos por WhatsApp`;

/* ── fotos reales (public/photos/<id>.jpg|jpeg|png|webp) ── */
const photoCache = {};
function findPhoto(id) {
  if (photoCache[id]) return photoCache[id];
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  photoCache[id] = new Promise((res) => {
    const next = (i) => {
      if (i >= exts.length) return res(null);
      const img = new Image();
      const url = `${BASE}photos/${id}.${exts[i]}`;
      img.onload = () => (img.naturalWidth > 10 ? res(url) : next(i + 1));
      img.onerror = () => next(i + 1);
      img.src = url;
    };
    next(0);
  });
  return photoCache[id];
}

/* ── marcado dinámico ── */
const pin = $('#pin');
BOTTLES.forEach((b, i) => {
  const p = PRODUCTS.find((x) => x.id === b.id);
  const el = document.createElement('article');
  el.className = `chap ${i % 2 ? 'right' : 'left'}`;
  el.innerHTML = `
    <div class="no">${b.n}</div>
    <p class="kind">${b.kind}</p>
    <h3>${b.name}</h3>
    <p class="tag">${b.tagline}</p>
    <p class="d">${b.desc}</p>
    <div class="chips">${b.notes.map((n) => `<span>${n}</span>`).join('')}</div>
    <p class="serve"><b>Servir</b>${b.serve}</p>
    <div class="buy">
      <div class="price">${money(p.price)}</div>
      <button class="btn solid" data-add="${p.id}" data-cursor>Agregar al carrito</button>
    </div>
    <img class="ch-photo" alt="Foto real de ${BRAND.name} ${b.name}" />`;
  pin.appendChild(el);
  findPhoto(b.id).then((u) => {
    if (!u) return;
    const im = $('.ch-photo', el);
    im.src = u;
    im.classList.add('ok');
  });
});
const rail = document.createElement('div');
rail.className = 'rail';
BOTTLES.forEach((b, i) => (rail.innerHTML += `<button aria-label="${b.name}" data-go="${i}" data-cursor></button>`));
pin.appendChild(rail);
const chaps = $$('.chap', pin);
const railBtns = $$('button', rail);

$('#steps').innerHTML = PROCESS.map((s, i) => `<div class="step rv"><i>0${i + 1}</i><h4>${s.t}</h4><p>${s.d}</p></div>`).join('');

// manifiesto: palabra por palabra
const manEl = $('#manText');
manEl.innerHTML = manEl.textContent.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
const manWords = $$('.w', manEl);

/* ── carrito ── */
let cart = [];
try { cart = JSON.parse(localStorage.getItem('no-cart') || '[]'); } catch {}
const renders = {}; // id → imagen (render 3D o foto)
const save = () => { try { localStorage.setItem('no-cart', JSON.stringify(cart)); } catch {} };
const prod = (id) => PRODUCTS.find((p) => p.id === id);
const total = () => cart.reduce((s, l) => s + prod(l.id).price * l.q, 0);

function renderCart() {
  const n = cart.reduce((s, l) => s + l.q, 0);
  $('#cartCount').textContent = n;
  const list = $('#drList');
  list.innerHTML = cart.length
    ? cart.map((l) => {
        const p = prod(l.id);
        return `<div class="li"><img src="${renders[l.id] || ''}" alt="" /><div><h4>${p.name}</h4><small>${p.sub}</small><div class="qty"><button data-dec="${l.id}" aria-label="Menos">−</button><span>${l.q}</span><button data-inc="${l.id}" aria-label="Más">+</button></div><button class="rm" data-rm="${l.id}">Quitar</button></div><b>${money(p.price * l.q)}</b></div>`;
      }).join('')
    : `<div class="empty">Tu carrito está vacío.<br/>Elegí una botella y empezá tu pedido.</div>`;
  const t = total();
  $('#drSub').textContent = money(t);
  $('#drCuotas').textContent = t ? `o ${INSTALLMENTS} cuotas de ${money(t / INSTALLMENTS)} sin interés` : '';
  const left = FREE_SHIP_FROM - t;
  $('#shipTxt').innerHTML = left > 0 ? `Te faltan <b>${money(left)}</b> para el envío gratis` : '🎉 <b>¡Tenés envío gratis!</b>';
  $('#shipBar').style.width = clamp(t / FREE_SHIP_FROM) * 100 + '%';
  $('#checkout').disabled = !cart.length;
  $('#checkout').style.opacity = cart.length ? 1 : 0.4;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
function add(id) {
  const l = cart.find((x) => x.id === id);
  l ? l.q++ : cart.push({ id, q: 1 });
  save(); renderCart();
  const b = $('#cartBtn');
  b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  toast(`${prod(id).name} agregado ✓`);
}
const openCart = (o = true) => {
  document.body.classList.toggle('cart-open', o);
  $('#drawer').setAttribute('aria-hidden', String(!o));
  o ? lenis?.stop() : lenis?.start();
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-add],[data-inc],[data-dec],[data-rm],[data-go],[data-wa],a[href^="#"]');
  if (!t) return;
  if (t.dataset.add) add(t.dataset.add);
  else if (t.dataset.inc) { cart.find((l) => l.id === t.dataset.inc).q++; save(); renderCart(); }
  else if (t.dataset.dec) { const l = cart.find((x) => x.id === t.dataset.dec); l.q--; if (l.q <= 0) cart = cart.filter((x) => x !== l); save(); renderCart(); }
  else if (t.dataset.rm) { cart = cart.filter((l) => l.id !== t.dataset.rm); save(); renderCart(); }
  else if (t.dataset.go) { lenis.scrollTo(L.bottles + (L.bottlesH - innerHeight) * (+t.dataset.go / 3), { duration: 2 }); }
  else if (t.dataset.wa) { const p = prod(t.dataset.wa); window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola! Quiero comprar: 1 x ${p.name} (${money(p.price)})`)}`, '_blank'); }
  else if (t.matches('a[href^="#"]')) {
    const target = $(t.getAttribute('href'));
    if (target) { e.preventDefault(); lenis ? lenis.scrollTo(t.getAttribute('href') === '#top' ? 0 : target, { duration: 2.2, offset: 0 }) : target.scrollIntoView(); }
  }
});
$('#cartBtn').onclick = () => openCart(true);
$('#cartClose').onclick = $('#scrim').onclick = () => openCart(false);
addEventListener('keydown', (e) => e.key === 'Escape' && openCart(false));
$('#checkout').onclick = () => {
  const lines = cart.map((l) => `• ${l.q} x ${prod(l.id).name} — ${money(prod(l.id).price * l.q)}`).join('\n');
  const msg = `Hola! Quiero hacer este pedido:\n\n${lines}\n\nTotal: ${money(total())}\n\n¿Cómo seguimos con el pago y el envío?`;
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
};
$('#news').onsubmit = (e) => { e.preventDefault(); $('#newsMsg').textContent = '¡Listo! Te sumamos a la lista.'; e.target.reset(); };
renderCart();

/* ── cursor ── */
const cur = $('.cursor');
let cx = 0, cy = 0, tx = 0, ty = 0;
addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
document.addEventListener('pointerover', (e) => cur.classList.toggle('hover', !!e.target.closest('[data-cursor],a,button')));

/* ── scroll suave ── */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ── medidas ── */
let L = { manifesto: 1, bottles: 2, bottlesH: 1, process: 3, gallery: 4, finale: 5, finaleH: 1 };
const topOf = (el) => el.getBoundingClientRect().top + scrollY;
function measure() {
  L = {
    manifesto: topOf($('#manifesto')),
    bottles: topOf($('#bottles')),
    bottlesH: $('#bottles').offsetHeight,
    process: topOf($('#process')),
    gallery: topOf($('#tienda')),
    finale: topOf($('#finale')),
    finaleH: $('#finale').offsetHeight,
  };
  stage?.setLayout(L);
}
addEventListener('resize', measure);

/* ── arranque ── */
let stage = null;
const ldBar = $('.ld-bar i'), ldPct = $('.ld-pct');
const prog = (p) => { ldBar.style.width = p + '%'; ldPct.textContent = Math.round(p); };

async function boot() {
  prog(8);
  await Promise.race([
    Promise.all([
      document.fonts.load('800 80px "Bodoni Moda"'), document.fonts.load('italic 700 80px "Bodoni Moda"'),
      document.fonts.load('600 40px "Bodoni Moda"'), document.fonts.load('500 16px "Space Grotesk"'),
    ]),
    new Promise((r) => setTimeout(r, 3500)),
  ]).catch(() => {});
  prog(30);
  await new Promise((r) => requestAnimationFrame(r));
  try {
    stage = new Stage($('#gl'), BOTTLES);
  } catch (err) {
    console.warn('WebGL no disponible', err);
    document.body.classList.add('no-webgl');
  }
  prog(55);
  // imágenes de producto: foto real si existe, si no un render 3D de la botella
  for (const p of PRODUCTS) {
    const real = await findPhoto(p.id);
    let shot = null;
    if (stage) { await new Promise((r) => requestAnimationFrame(r)); shot = stage.snapshot(p.shot); }
    renders[p.id] = real || shot || '';
    p.imgA = real || shot; p.imgB = real && shot ? shot : null;
    prog(55 + (PRODUCTS.indexOf(p) + 1) * (40 / PRODUCTS.length));
  }
  buildGrid();
  renderCart();
  measure();
  stage?.setLayout(L);
  prog(100);
  await new Promise((r) => setTimeout(r, 500));
  $('#loader').classList.add('done');
  document.body.dataset.ready = '1';
  // intro
  if (stage) gsap.to(stage.intro, { v: 1, duration: reduce ? 0.01 : 2.8, ease: 'power2.out', delay: 0.5 });
  gsap.to('.hero-fade', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'power3.out', delay: 1.2 });
}

function buildGrid() {
  $('#grid').innerHTML = PRODUCTS.map((p) => `
    <article class="card rv" data-cat="${p.cat}" style="--c:${BOTTLES[p.bottle]?.accent || '#e6c378'}">
      ${p.tag ? `<span class="badge">${p.tag}</span>` : ''}
      <span class="ship-b">Envío gratis*</span>
      <div class="ph ${p.imgB ? 'two' : ''}">
        <img class="a" src="${p.imgA || ''}" alt="${p.name}" loading="lazy" />
        ${p.imgB ? `<img class="b" src="${p.imgB}" alt="" loading="lazy" />` : ''}
      </div>
      <div class="info">
        <h3>${p.name}</h3>
        <span class="sub">${p.sub}</span>
        <div class="pr"><b>${money(p.price)}</b>${p.was ? `<s>${money(p.was)}</s>` : ''}</div>
        <span class="cuo">${INSTALLMENTS} cuotas de ${money(p.price / INSTALLMENTS)} sin interés</span>
        <div class="acts">
          <button class="btn solid" data-add="${p.id}" data-cursor>Agregar</button>
          <button class="btn ghost wa" data-wa="${p.id}" data-cursor aria-label="Comprar por WhatsApp">WhatsApp</button>
        </div>
      </div>
    </article>`).join('');
  // tilt
  $$('.card').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateY(-4px)`;
    });
    c.addEventListener('pointerleave', () => (c.style.transform = ''));
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 });
  $$('.rv').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 90 + 'ms'; io.observe(el); });
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#filters button').forEach((x) => x.classList.toggle('on', x === b));
  $$('.card').forEach((c) => c.classList.toggle('hide', b.dataset.f !== 'all' && c.dataset.cat !== b.dataset.f));
});

/* ── loop principal ── */
let last = performance.now();
let mqX = 0, mqY = 0;
gsap.ticker.add(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const y = lenis ? lenis.scroll : scrollY;
  const vel = lenis ? lenis.velocity : 0;

  cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
  cur.style.transform = `translate(${cx}px,${cy}px)`;

  if (stage) {
    stage.update(y, t, dt);
    const { f, phase, q } = stage.state;
    // acento global para el DOM
    if (stage.accent) document.documentElement.style.setProperty('--accent', '#' + stage.accent.getHexString());
    // capítulos
    chaps.forEach((c, i) => {
      const d = f - i;
      const o = phase === 'vars' || phase === 'manifesto' || phase === 'process' ? clamp(1 - Math.abs(d) * 2.4) : 0;
      const vis = (phase === 'vars') ? o : (phase === 'process' && i === 3) ? o * (1 - clamp((y - (L.bottles + L.bottlesH - innerHeight)) / (innerHeight * 0.5))) : 0;
      c.style.setProperty('--o', vis.toFixed(3));
      c.style.setProperty('--dy', (d * -70).toFixed(1) + 'px');
      c.classList.toggle('on', vis > 0.5);
    });
    railBtns.forEach((b, i) => b.classList.toggle('on', Math.round(f) === i));
    rail.style.opacity = phase === 'vars' ? 1 : 0;
    $('#finale').style.setProperty('--fin', clamp((q - 0.5) / 0.35).toFixed(3));
  }

  // manifiesto
  const mp = clamp((y - L.manifesto) / Math.max(1, L.bottles - L.manifesto - innerHeight));
  const n = Math.floor(mp * 1.15 * manWords.length);
  manWords.forEach((w, i) => w.classList.toggle('on', i < n));

  // marquees (reaccionan a la velocidad del scroll)
  mqX -= 0.5 + Math.abs(vel) * 0.35;
  const mt = $('.mq-t');
  const mw = mt.scrollWidth / 2;
  mt.style.transform = `translateX(${(mqX % mw) - mw * 0}px) skewX(${clamp(-vel * 0.4, -8, 8)}deg)`;
  mqY -= 0.6;
  const ma = $('#announce .mq');
  ma.style.transform = `translateX(${mqY % (ma.scrollWidth / 8)}px)`;
});

boot();
