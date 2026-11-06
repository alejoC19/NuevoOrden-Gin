import { CONTACT } from './data.js';

export const money = (n) => '$' + Math.round(n).toLocaleString('es-AR');
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Cursor propio: sigue al puntero al instante (sin interpolación en JS). */
export function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const el = document.querySelector('.cursor');
  if (!el) return;
  const ring = el.querySelector('b'), dot = el.querySelector('i');
  document.body.classList.add('has-cursor');
  addEventListener('pointermove', (e) => {
    const t = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
    dot.style.transform = t; ring.style.transform = t;
    el.classList.add('on');
  }, { passive: true });
  document.addEventListener('pointerover', (e) => el.classList.toggle('hover', !!e.target.closest('a, button, input, label, [data-cursor]')));
  document.addEventListener('pointerleave', () => el.classList.remove('on'));
}

/** Aparición suave de bloques (un único observer, se libera al revelar). */
export function initReveals(root = document) {
  const els = [...root.querySelectorAll('.reveal:not(.in)')];
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  // seguro: si por cualquier motivo el observador no marca algo que ya está en pantalla, se revela igual
  const safety = () => els.forEach((el) => { if (el.classList.contains('in')) return; const r = el.getBoundingClientRect(); if (r.top < innerHeight * 0.92 && r.bottom > 0) el.classList.add('in'); });
  setInterval(safety, 700);
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => io.observe(el));
}

/** Enlaces de contacto del footer (solo los que están configurados). */
export function fillContact(box) {
  if (!box) return;
  if (CONTACT.instagram) box.insertAdjacentHTML('beforeend', `<a href="${CONTACT.instagram}" target="_blank" rel="noopener">Instagram</a>`);
  if (CONTACT.whatsapp) box.insertAdjacentHTML('beforeend', `<a href="https://wa.me/${CONTACT.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (!box.querySelector('a')) box.insertAdjacentHTML('beforeend', '<p>Consultas y pedidos desde la <a href="/tienda" style="display:inline;text-decoration:underline">tienda</a>.</p>');
}

export const ICONS = {
  lemon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="8" ry="6" transform="rotate(-30 12 12)"/><path d="M5 17l-2 2M19 7l2-2"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 9c3-3 5 3 8 0s5 3 8 0 3 0 4-1M2 15c3-3 5 3 8 0s5 3 8 0 3 0 4-1"/></svg>',
  berry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="14" r="5"/><circle cx="16" cy="11" r="4"/><path d="M12 5c1-2 3-2 4-1"/></svg>',
};

/** Menú principal para celular: botón + panel a pantalla completa con los mismos enlaces del encabezado. */
export function initMenu() {
  const nav = document.querySelector('.nav');
  if (!nav || nav.querySelector('.menu-btn')) return;
  const links = [...nav.querySelectorAll('.nav-links a')];
  const home = location.pathname.replace(/\/$/, '') === '' || location.pathname === '/index.html';
  const items = [{ href: home ? '#top' : '/', t: 'Inicio' }, ...links.map((a) => ({ href: a.getAttribute('href'), t: a.textContent.trim() }))];
  const menu = document.createElement('div');
  menu.className = 'menu'; menu.id = 'menu'; menu.setAttribute('aria-hidden', 'true');
  menu.innerHTML = `<nav class="menu-in" aria-label="Menú principal">${items.map((x, i) => `<a href="${x.href}" style="--i:${i}"><i>0${i + 1}</i>${x.t}</a>`).join('')}</nav>`;
  document.body.appendChild(menu);
  const btn = document.createElement('button');
  btn.className = 'menu-btn'; btn.setAttribute('aria-label', 'Abrir menú'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span></span><span></span>';
  nav.appendChild(btn);
  const set = (o) => { document.body.classList.toggle('menu-open', o); menu.setAttribute('aria-hidden', String(!o)); btn.setAttribute('aria-expanded', String(o)); btn.setAttribute('aria-label', o ? 'Cerrar menú' : 'Abrir menú'); };
  btn.addEventListener('click', () => set(!document.body.classList.contains('menu-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
}
