/* Mapa del recorrido de "Los gines": u (0..1 sobre la escena fija) → qué gin es protagonista
   y cuánto de sus botánicos se reveló. Todo continuo: sin estados que puedan parpadear. */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const win = (u, a, b) => clamp((u - a) / (b - a));

// fracciones del recorrido (Pampa 6 botánicos → transición → Mar → transición → Andes)
export const T = { t1: [0.405, 0.5], t2: [0.705, 0.795] };
export const REVEAL = [[0.03, 0.385], [0.545, 0.69], [0.84, 0.98]];
export const GO_U = [0.39, 0.64, 0.93];

export function story(u) {
  const f = ease(win(u, ...T.t1)) + ease(win(u, ...T.t2));
  return { f, reveal: REVEAL.map(([a, b]) => win(u, a, b)) };
}
