// ─────────────────────────────────────────────────────────────
//  EDITA AQUÍ: nombres, textos y colores de cada botella.
//  Las fotos reales se sueltan en /public/photos/<id>.jpg
//  (también .jpeg .png .webp). Si no existe, el sitio usa un
//  render 3D de la botella como reemplazo.
// ─────────────────────────────────────────────────────────────
// MARCA (placeholder): cambia el nombre aca y se actualiza todo el sitio
export const BRAND = { name: 'Ébano', full: 'Ébano Gin', hero: 'ÉBANO GIN' };
// Redes y contacto: dejalos vacios para ocultarlos
export const IG_URL = '';
export const IG_HANDLE = '';
// Número de WhatsApp donde llegan los pedidos (código país + área + número, sin + ni espacios)
export const WA_NUMBER = ''; // ej: '5491155551234'
export const FREE_SHIP_FROM = 60000; // ARS · envío gratis a partir de
export const INSTALLMENTS = 3; // cuotas sin interés que se muestran

export const BOTTLES = [
  {
    id: 'clasico',
    n: '01',
    name: 'Clásico',
    kind: 'London Dry Gin',
    tagline: 'El que rompió el molde.',
    desc:
      'Enebro firme, cítricos limpios y un final seco que no pide permiso. La base de toda la colección: simple, directo y imposible de olvidar.',
    notes: ['Enebro', 'Cilantro', 'Cáscara de limón'],
    serve: 'Gin & tonic · rodaja de limón · mucho hielo',
    abv: 43,
    ml: 700,
    shape: 'classic',
    emblem: 'sun',
    accent: '#e6c378',
    bg: '#06090b',
    glass: '#e4f3ee',
    liquid: ['#7fb9b4', '#e6fbf6'],
    label: { bg: '#0d0f12', foil: '#d8b26a', ink: '#f2e8d2' },
    cap: '#0b0b0c',
    capMetal: 0.2,
    wax: '#7d1a28',
    botanical: 'berries',
  },
  {
    id: 'citrico',
    n: '02',
    name: 'Cítrico',
    kind: 'Citrus Gin',
    tagline: 'Luz líquida.',
    desc:
      'Pomelo, naranja amarga y lima exprimidos sobre el enebro. Brillante, jugoso, con una acidez que despierta todo lo demás.',
    notes: ['Pomelo', 'Naranja amarga', 'Lima'],
    serve: 'Tónica suave · gajo de pomelo · romero',
    abv: 40,
    ml: 700,
    shape: 'slim',
    emblem: 'citrus',
    accent: '#ffb23e',
    bg: '#0d0a03',
    glass: '#fff6dc',
    liquid: ['#d99a1c', '#fff0a8'],
    label: { bg: '#f1e3bd', foil: '#a8620a', ink: '#2a1a05' },
    cap: '#e8a21f',
    capMetal: 0.7,
    wax: '#2a1a05',
    botanical: 'citrus',
  },
  {
    id: 'rosa',
    n: '03',
    name: 'Rosa',
    kind: 'Pink Gin',
    tagline: 'Dulce no. Peligrosa sí.',
    desc:
      'Pétalos de rosa, frutos rojos y un toque de pimienta rosa. Floral, elegante y con un fondo que muerde.',
    notes: ['Rosa', 'Frutos rojos', 'Pimienta rosa'],
    serve: 'Tónica de frutos rojos · pétalos · hielo grande',
    abv: 40,
    ml: 700,
    shape: 'flask',
    emblem: 'rose',
    accent: '#ff6b9e',
    bg: '#12060c',
    glass: '#ffe9f1',
    liquid: ['#e0487f', '#ffc4d9'],
    label: { bg: '#2a0b19', foil: '#f3b6c9', ink: '#ffe9f1' },
    cap: '#f3b6c9',
    capMetal: 0.9,
    wax: '#f3b6c9',
    botanical: 'petals',
  },
  {
    id: 'noche',
    n: '04',
    name: 'Noche',
    kind: 'Reserva Oscura',
    tagline: 'Para después de medianoche.',
    desc:
      'Enebro ahumado, cacao y vainilla en vidrio oscuro. Profundo, sedoso y pensado para tomarse despacio, sin hielo o con uno solo.',
    notes: ['Enebro ahumado', 'Cacao', 'Vainilla'],
    serve: 'Solo o con un cubo grande · twist de naranja',
    abv: 46,
    ml: 700,
    shape: 'tall',
    emblem: 'moon',
    accent: '#7f8cff',
    bg: '#04051a',
    glass: '#1a2260',
    liquid: ['#2a2f8f', '#7d86ff'],
    label: { bg: '#080a24', foil: '#c9ccff', ink: '#e6e8ff' },
    cap: '#c9ccff',
    capMetal: 1,
    wax: '#080a24',
    botanical: 'stars',
  },
];

export const PROCESS = [
  { t: 'Botánicos', d: 'Cada ingrediente se elige a mano. Nada entra por casualidad.' },
  { t: 'Destilación', d: 'Lotes pequeños, paciencia y buen oído para cortar en el punto exacto.' },
  { t: 'Reposo', d: 'Los aromas se asientan hasta encontrar su lugar en el vaso.' },
  { t: 'Botella', d: 'Vidrio, lacre y etiqueta. Lista para abrir el próximo capítulo.' },
];

// ─────────────────────────────────────────────────────────────
//  TIENDA · precios en ARS (PLACEHOLDERS: cambialos por los reales)
//  shot = qué botellas aparecen en el render si no hay foto real
//  Foto real → /public/photos/<id>.jpg
// ─────────────────────────────────────────────────────────────
export const PRODUCTS = [
  { id: 'clasico', cat: 'gin', name: `${BRAND.name} Clásico`, sub: 'London Dry · 700 ml · 43%', price: 22000, shot: [0], bottle: 0, tag: 'Más vendido' },
  { id: 'citrico', cat: 'gin', name: `${BRAND.name} Cítrico`, sub: 'Citrus Gin · 700 ml · 40%', price: 23500, shot: [1], bottle: 1 },
  { id: 'rosa', cat: 'gin', name: `${BRAND.name} Rosa`, sub: 'Pink Gin · 700 ml · 40%', price: 23500, shot: [2], bottle: 2, tag: 'Novedad' },
  { id: 'noche', cat: 'gin', name: `${BRAND.name} Noche`, sub: 'Reserva Oscura · 700 ml · 46%', price: 29000, shot: [3], bottle: 3, tag: 'Edición limitada' },
  { id: 'duo', cat: 'combo', name: 'Dúo Clásico + Cítrico', sub: '2 botellas · 700 ml c/u', price: 42000, was: 45500, shot: [0, 1], tag: 'Combo' },
  { id: 'coleccion', cat: 'combo', name: 'Colección Completa', sub: 'Las 4 botellas · caja regalo', price: 89000, was: 98000, shot: [0, 1, 2, 3], tag: 'Regalo' },
];
