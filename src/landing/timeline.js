/* Mapa del recorrido de "Los gines": u (0..1 sobre la escena fija) → qué gin es protagonista,
   cuánto de sus botánicos se reveló y dónde está la cámara. Todo continuo: sin estados que puedan parpadear. */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const win = (u, a, b) => clamp((u - a) / (b - a));

export const T = { t1: [0.405, 0.5], t2: [0.705, 0.795] };
export const REVEAL = [[0.07, 0.37], [0.585, 0.69], [0.885, 0.97]];
export const GO_U = [0.39, 0.64, 0.93];

export function story(u) {
  const f = ease(win(u, ...T.t1)) + ease(win(u, ...T.t2));
  return { f, reveal: REVEAL.map(([a, b]) => win(u, a, b)) };
}

/* Coreografía de cámara por producto:
   1 aparece la botella · 2 la cámara se aproxima · 3-4 los ingredientes aparecen y se mueven por separado
   5 se presenta la composición · 6 la cámara se aleja · 7 transición al siguiente gin.
   dm = distancia relativa (1 = encuadre base, <1 más cerca) · az/el = órbita suave en radianes. */
const KEYS = [
  [0.0, 1.0, 0.0, 0.05],
  [0.045, 0.9, 0.1, 0.07],
  [0.2, 0.92, -0.03, 0.09],
  [0.36, 0.95, -0.13, 0.07],
  [0.405, 1.08, -0.06, 0.06],
  [0.4525, 1.13, 0.0, 0.05],
  [0.5, 1.08, 0.07, 0.06],
  [0.565, 0.9, 0.12, 0.07],
  [0.64, 0.93, -0.02, 0.09],
  [0.7, 0.96, -0.12, 0.07],
  [0.74, 1.1, -0.05, 0.06],
  [0.75, 1.13, 0.0, 0.05],
  [0.8, 1.08, 0.07, 0.06],
  [0.865, 0.9, 0.12, 0.07],
  [0.95, 0.94, -0.02, 0.09],
  [1.0, 0.96, -0.08, 0.08],
];
export const DM_MIN = 0.9; // cercanía máxima: las composiciones se ajustan a este encuadre

export function cameraAt(u) {
  u = clamp(u);
  let i = 0;
  while (i < KEYS.length - 2 && u > KEYS[i + 1][0]) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const t = clamp((u - k1[0]) / (k2[0] - k1[0]));
  const out = [0, 0, 0];
  for (let c = 1; c <= 3; c++) {
    // Hermite con tangentes de diferencias finitas: movimiento continuo, sin arranques bruscos
    const m1 = (k2[c] - k0[c]) / (k2[0] - k0[0]) * (k2[0] - k1[0]);
    const m2 = (k3[c] - k1[c]) / (k3[0] - k1[0]) * (k2[0] - k1[0]);
    const t2 = t * t, t3 = t2 * t;
    out[c - 1] = (2 * t3 - 3 * t2 + 1) * k1[c] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * k2[c] + (t3 - t2) * m2;
  }
  return { dm: out[0], az: out[1], el: out[2] };
}
