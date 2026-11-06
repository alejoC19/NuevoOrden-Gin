import { PRODUCTS, SHOP, CONTACT, LEGAL } from './data.js';
import { money } from './ui.js';

const KEY = 'argentino-cart-v1';
let lines = [];
const subs = new Set();
try { lines = JSON.parse(localStorage.getItem(KEY) || '[]').filter((l) => PRODUCTS.some((p) => p.id === l.id)); } catch { lines = []; }

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* modo privado */ } subs.forEach((f) => f()); };
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

export const product = (id) => PRODUCTS.find((p) => p.id === id);
export const unitPrice = (l) => { const p = product(l.id); const v = p.variants?.find((x) => x.id === l.variant); return v?.price ?? p.price; };
export const lineKey = (l) => l.id + (l.variant ? '|' + l.variant : '');
export const getLines = () => lines;
export const count = () => lines.reduce((s, l) => s + l.q, 0);
export const total = () => lines.reduce((s, l) => s + unitPrice(l) * l.q, 0);

export function add(id, q = 1, variant) {
  const l = lines.find((x) => x.id === id && x.variant === variant);
  l ? (l.q += q) : lines.push({ id, q, variant });
  save();
}
export function setQty(key, q) {
  const l = lines.find((x) => lineKey(x) === key);
  if (!l) return;
  l.q = q;
  if (l.q <= 0) lines = lines.filter((x) => x !== l);
  save();
}
export const remove = (key) => { lines = lines.filter((x) => lineKey(x) !== key); save(); };

export function whatsappUrl() {
  const rows = lines.map((l) => {
    const p = product(l.id);
    const v = p.variants?.find((x) => x.id === l.variant);
    return `• ${l.q} × ${p.name}${v ? ` (${v.label})` : ''} — ${money(unitPrice(l) * l.q)}`;
  }).join('\n');
  const msg = `Hola! Quiero hacer este pedido:\n\n${rows}\n\nTotal: ${money(total())}\n\nDeclaro ser mayor de 18 años. ¿Cómo seguimos con el pago y el envío?`;
  return `https://wa.me/${CONTACT.whatsapp || ''}?text=${encodeURIComponent(msg)}`;
}
export const freeShip = () => ({ left: Math.max(0, SHOP.freeShipFrom - total()), pct: Math.min(1, total() / SHOP.freeShipFrom) });
export { LEGAL };
