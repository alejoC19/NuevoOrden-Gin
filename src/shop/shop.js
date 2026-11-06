import '../styles/base.css';
import '../styles/shop.css';
import { PRODUCTS, GINS, BOTANICALS, SHOP, BRAND } from '../shared/data.js';
import { money, initCursor, initReveals, fillContact } from '../shared/ui.js';
import * as cart from '../shared/cart.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

initCursor();
fillContact($('#fContact'));
$('#copy').textContent = `© ${new Date().getFullYear()} ${BRAND.full}`;
$('#perkShip').textContent = `En compras desde ${money(SHOP.freeShipFrom)}`;
$('#perkCuotas').textContent = `Hasta ${SHOP.installments} cuotas con tarjeta`;
$('#shipNote').innerHTML = `<b>Envío gratis</b> en compras desde ${money(SHOP.freeShipFrom)} · Pagá hasta en <b>${SHOP.installments} cuotas sin interés</b> · Coordinamos el pedido por WhatsApp`;

const wide = (p) => p.imgAspect > 0.8;
const cuotas = (p) => `${SHOP.installments} cuotas de ${money(p.price / SHOP.installments)} sin interés`;

/* ───────── catálogo ───────── */
$('#grid').innerHTML = PRODUCTS.map((p, i) => `
  <article class="card reveal" data-cat="${p.cat}" style="--d:${i * 90}ms">
    ${p.tag ? `<span class="badge">${p.tag}</span>` : ''}
    <a class="card-img ${wide(p) ? 'wide' : ''}" href="#/${p.id}" aria-label="Ver ficha de ${p.name}">
      <img src="${p.img}" alt="${p.name}" width="${Math.round(1000 * p.imgAspect)}" height="1000" loading="${i < 2 ? 'eager' : 'lazy'}" />
    </a>
    <div class="card-body">
      <h3>${p.name}</h3>
      <span class="sub">${p.sub}</span>
      <div class="pr">${money(p.price)}${p.was ? `<s>${money(p.was)}</s>` : ''}</div>
      <span class="cuotas">${cuotas(p)}</span>
      <div class="acts">
        <button class="btn btn-gold" data-add="${p.id}">Agregar</button>
        <a class="btn btn-line" href="#/${p.id}">Ver ficha</a>
      </div>
    </div>
  </article>`).join('');
initReveals();

$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#filters button').forEach((x) => x.classList.toggle('on', x === b));
  $$('.card').forEach((c) => c.classList.toggle('hide', b.dataset.f !== 'all' && c.dataset.cat !== b.dataset.f));
});

/* ───────── ficha individual (ruta #/id) ───────── */
const sheet = $('#sheet');
let variant = null, qty = 1;
function renderSheet(id) {
  const p = cart.product(id);
  if (!p) return closeSheet(true);
  const gin = GINS.find((g) => g.id === p.gin);
  const v = p.variants?.length ? (variant && p.variants.find((x) => x.id === variant)) || p.variants[0] : null;
  variant = v?.id ?? null;
  const price = v?.price ?? p.price;
  const bots = gin ? gin.botanicals.map((b) => BOTANICALS[b].name) : [];
  sheet.innerHTML = `
    <a class="sh-back" href="#catalogo" data-close>← Colección</a>
    <button class="sh-close" data-close aria-label="Cerrar ficha">✕</button>
    <div class="sh-wrap">
      <div class="sh-img ${wide(p) ? 'wide' : ''}"><img src="${p.img}" alt="${p.name}" /></div>
      <div class="sh-info">
        <p class="eyebrow">${gin ? gin.kind : 'Combo'}</p>
        <h2 class="display gold-text">${p.name}</h2>
        <p class="lead">${gin ? gin.lead : p.sub}</p>
        <div class="price-big">${money(price)}${p.was ? `<s>${money(p.was)}</s>` : ''}</div>
        <span class="cuotas">${cuotas({ price })}</span>
        <p class="desc">${p.long}</p>
        ${gin ? `<dl class="sh-facts">${gin.facts.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('')}</dl>
        <p class="eyebrow" style="margin-bottom:10px">Botánicos</p><div class="sh-bots">${bots.map((b) => `<span>${b}</span>`).join('')}</div>` : ''}
        ${p.variants?.length ? `<div class="variant">${p.variants.map((x) => `<button data-v="${x.id}" class="${x.id === variant ? 'on' : ''}">${x.label}</button>`).join('')}</div>` : ''}
        <div class="buy-row">
          <div class="qty"><button data-q="-1" aria-label="Menos">−</button><span id="shQty">${qty}</span><button data-q="1" aria-label="Más">+</button></div>
          <button class="btn btn-gold" id="shAdd" style="flex:1">Agregar al carrito</button>
        </div>
        <p class="small" style="margin-top:14px">Venta exclusiva a mayores de 18 años.</p>
      </div>
    </div>`;
  sheet.dataset.id = id;
}
function openSheet(id) {
  qty = 1; variant = null;
  renderSheet(id);
  sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
  sheet.scrollTop = 0;
  document.documentElement.style.overflow = 'hidden';
}
function closeSheet(silent) {
  sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
  document.documentElement.style.overflow = '';
  if (!silent && location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname + '#catalogo');
}
sheet.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { e.preventDefault(); closeSheet(); return; }
  const q = e.target.closest('[data-q]');
  if (q) { qty = Math.max(1, Math.min(20, qty + +q.dataset.q)); $('#shQty').textContent = qty; return; }
  const v = e.target.closest('[data-v]');
  if (v) { variant = v.dataset.v; renderSheet(sheet.dataset.id); return; }
  if (e.target.closest('#shAdd')) { cart.add(sheet.dataset.id, qty, variant || undefined); bump(); toast(`${cart.product(sheet.dataset.id).name} agregado ✓`); }
});
function route() {
  const m = location.hash.match(/^#\/([\w-]+)/);
  m ? openSheet(m[1]) : closeSheet(true);
}
addEventListener('hashchange', route);
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); openCart(false); } });

/* ───────── carrito ───────── */
const body = document.body;
function openCart(o = true) { body.classList.toggle('cart-open', o); $('#drawer').setAttribute('aria-hidden', String(!o)); }
function bump() { const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

function renderCart() {
  $('#cartCount').textContent = cart.count();
  const lines = cart.getLines();
  $('#drList').innerHTML = lines.length
    ? lines.map((l) => {
      const p = cart.product(l.id), k = cart.lineKey(l), v = p.variants?.find((x) => x.id === l.variant);
      return `<div class="li"><div class="thumb"><img src="${p.img}" alt="" /></div>
        <div><h4>${p.name}</h4><small>${v ? v.label : p.sub}</small>
          <div class="qty"><button data-dec="${k}" aria-label="Menos">−</button><span>${l.q}</span><button data-inc="${k}" aria-label="Más">+</button></div>
          <button class="rm" data-rm="${k}">Quitar</button></div>
        <b>${money(cart.unitPrice(l) * l.q)}</b></div>`;
    }).join('')
    : '<div class="empty">Tu carrito está vacío.<br />Elegí un gin de la colección.</div>';
  const t = cart.total(), fs = cart.freeShip();
  $('#drSub').textContent = money(t);
  $('#drCuotas').textContent = t ? `o ${SHOP.installments} cuotas de ${money(t / SHOP.installments)} sin interés` : '';
  $('#shipTxt').innerHTML = fs.left > 0 ? `Te faltan <b>${money(fs.left)}</b> para el envío gratis` : '<b>¡Tenés envío gratis!</b>';
  $('#shipBar').style.width = fs.pct * 100 + '%';
  $('#checkout').disabled = !lines.length || !$('#ageOk').checked;
}
cart.subscribe(renderCart);
$('#ageOk').addEventListener('change', renderCart);
$('#cartBtn').onclick = () => openCart(true);
$('#cartClose').onclick = $('#scrim').onclick = () => openCart(false);
$('#checkout').onclick = () => window.open(cart.whatsappUrl(), '_blank', 'noopener');
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-add],[data-inc],[data-dec],[data-rm]');
  if (!t) return;
  if (t.dataset.add) { cart.add(t.dataset.add); bump(); toast(`${cart.product(t.dataset.add).name} agregado ✓`); }
  else if (t.dataset.inc) { const l = cart.getLines().find((x) => cart.lineKey(x) === t.dataset.inc); cart.setQty(t.dataset.inc, l.q + 1); }
  else if (t.dataset.dec) { const l = cart.getLines().find((x) => cart.lineKey(x) === t.dataset.dec); cart.setQty(t.dataset.dec, l.q - 1); }
  else if (t.dataset.rm) cart.remove(t.dataset.rm);
});

renderCart();
route();
