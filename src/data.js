// ─────────────────────────────────────────────────────────────
//  EDITÁ ACÁ: textos, precios, contacto.
//  Imágenes reales: /public/photos/<id>.jpg · etiquetas: /public/labels/
// ─────────────────────────────────────────────────────────────
export const BRAND = { name: 'Argentino', full: 'Argentino Gin', hero: 'ARGENTINO' };

// Redes y contacto: dejalos vacíos para ocultarlos
export const IG_URL = '';
export const WA_NUMBER = ''; // ej: '5491155551234' (código país + área + número)
export const FREE_SHIP_FROM = 60000; // ARS · envío gratis desde
export const INSTALLMENTS = 3; // cuotas sin interés que se muestran

export const BOTTLES = [
  {
    id: 'pampa',
    n: '01',
    name: 'Pampa',
    word: 'PAMPA',
    kind: 'Gin Artesanal',
    tagline: 'The spirit of the Pampa.',
    desc:
      'Enebro, cilantro y especias en una receta pensada para el galope. Destilado y embotellado en la Patagonia: carácter firme, final largo y aire de campo abierto.',
    notes: ['Enebro', 'Cilantro en grano', 'Pimienta de Jamaica'],
    serve: 'Gin tonic · twist de limón · hielo grande',
    abv: 40, ml: 750,
    label: 'labels/pampa.jpg', labelAspect: 420 / 628,
    accent: '#e0a24a', bg: '#130b05',
    glass: { color: '#fff0d6', att: '#d9a24e', dist: 1.6 },
    liquid: ['#a8641c', '#f0b45a'],
    weave: ['#3a2418', '#e8d6b0', '#8a4a26'],
    ink: '#5b3a1e', botanical: { type: 'berries', color: '#2c3270' },
  },
  {
    id: 'mar',
    n: '02',
    name: 'Cítrico & Mar',
    word: 'MAR',
    kind: 'Gin Cítrico',
    tagline: 'Sal, limón y viento del sur.',
    desc:
      'Limón y pomelo con un toque de algas patagónicas. Fresco, brillante y salino, como una costa abierta al atardecer.',
    notes: ['Limón', 'Pomelo', 'Algas patagónicas'],
    serve: 'Tónica suave · rodaja de limón · pomelo',
    abv: 40, ml: 750,
    label: 'labels/mar.jpg', labelAspect: 187 / 282,
    accent: '#62b8a4', bg: '#06100e',
    glass: { color: '#f7f3c4', att: '#d8d070', dist: 2.6 },
    liquid: ['#cfc25a', '#f4efb4'],
    weave: ['#1f6f66', '#dcd3b0', '#3f9a8e'],
    ink: '#2f6b60', botanical: { type: 'citrus', color: '#ffd23a' },
  },
  {
    id: 'andes',
    n: '03',
    name: 'Gin de los Andes',
    word: 'ANDES',
    kind: 'Gin de Frutos Azules',
    tagline: 'Montaña, arándano y frío puro.',
    desc:
      'Arándanos de montaña sobre una base de enebro. Profundo, frutal y sedoso, con el color de un atardecer en la cordillera.',
    notes: ['Arándano', 'Enebro', 'Pimienta'],
    serve: 'Tónica de frutos rojos · arándanos · mucho hielo',
    abv: 40, ml: 750,
    label: 'labels/andes.jpg', labelAspect: 194 / 290,
    accent: '#b184cc', bg: '#0e0714',
    glass: { color: '#dcb8e8', att: '#6a2a80', dist: 1.0 },
    liquid: ['#4a1c55', '#a45aa8'],
    weave: ['#3a2342', '#c4b4cc', '#7b57a0'],
    ink: '#5a3a70', botanical: { type: 'blue', color: '#4a3a8c' },
  },
];

export const PRODUCTS = [
  { id: 'pampa', cat: 'gin', name: 'Argentino Pampa', sub: 'Gin Artesanal · 750 ml · 40%', price: 24000, shot: [0], bottle: 0, tag: 'Más vendido' },
  { id: 'mar', cat: 'gin', name: 'Argentino Cítrico & Mar', sub: 'Gin Cítrico · 750 ml · 40%', price: 24000, shot: [1], bottle: 1 },
  { id: 'andes', cat: 'gin', name: 'Argentino de los Andes', sub: 'Gin de Frutos Azules · 750 ml · 40%', price: 26000, shot: [2], bottle: 2, tag: 'Novedad' },
  { id: 'trio', cat: 'combo', name: 'Trío Argentino', sub: 'Pampa + Mar + Andes · 3 × 750 ml', price: 69000, was: 74000, shot: [0, 1, 2], bottle: 0, tag: 'Combo' },
];

export const BOTANICALS = [
  { id: 'enebro', n: 'Enebro', d: 'La baya resinosa y fresca que define al gin.' },
  { id: 'cilantro', n: 'Cilantro en grano', d: 'Cítrico y especiado: suma frescura y cuerpo.' },
  { id: 'cardamomo', n: 'Cardamomo', d: 'Verde, dulce y floral, con un fondo cálido.' },
  { id: 'pimienta', n: 'Pimienta de Jamaica', d: 'Notas de clavo y canela para el final.' },
  { id: 'angelica', n: 'Raíz de angélica', d: 'Terrosa: une y alarga todos los aromas.' },
  { id: 'granos', n: 'Granos del paraíso', d: 'Picantes y florales, profundos en boca.' },
];

export const RECIPES = [
  { t: 'Gin Tonic Pampa', c: '#e0a24a', i: ['50 ml Argentino Pampa', 'Tónica premium', 'Twist de limón', 'Cilantro en grano'], d: 'El clásico, con aire de campo.' },
  { t: 'Cítrico & Mar', c: '#62b8a4', i: ['50 ml Cítrico & Mar', 'Tónica suave', 'Rodaja de limón', 'Pomelo'], d: 'Fresco como una costa abierta.' },
  { t: 'Andes Berry', c: '#b184cc', i: ['50 ml Gin de los Andes', 'Tónica de frutos rojos', 'Arándanos', 'Hielo grande'], d: 'Profundo, frutal y de montaña.' },
];

export const STORY = [
  { t: 'Patagonia', d: 'Donde se destila y se embotella: viento, estepa y agua fría.' },
  { t: 'Pampa', d: 'El horizonte llano y el galope que inspiraron la primera receta.' },
  { t: 'Andes', d: 'Frutos azules y aire de montaña en el vidrio más oscuro.' },
];
