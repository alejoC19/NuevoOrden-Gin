// ═════════════════════════════════════════════════════════════
//  CONTENIDO DEL SITIO · todo se edita acá
//
//  Regla: solo se afirma lo que figura en las fotos/etiquetas de la
//  marca. Lo que está marcado con `confirmar: true` salió de las
//  maquetas y hay que validarlo con la marca antes de publicar.
// ═════════════════════════════════════════════════════════════

export const BRAND = { name: 'Argentino', full: 'Argentino Gin', kind: 'Gin de autor' };

// Contacto: si queda vacío, el enlace no se muestra.
export const CONTACT = {
  instagram: '', // ej: 'https://www.instagram.com/usuario/'
  whatsapp: '', // ej: '5491155551234' (código país + área + número)
};

// Tienda: valores de ejemplo, reemplazar por los reales.
export const SHOP = { freeShipFrom: 60000, installments: 3 };

/* ── Botánicos ────────────────────────────────────────────────
   `kind` = qué modelo 3D se usa en la escena. */
export const BOTANICALS = {
  enebro: { name: 'Enebro', kind: 'juniper', photo: '/photos/botanicos/enebro.jpg', desc: 'La baya que define al gin: resinosa, fresca, con aroma a pino.' },
  cilantro: { name: 'Cilantro en grano', kind: 'coriander', photo: '/photos/botanicos/cilantro.jpg', desc: 'La semilla del cilantro suma notas cítricas y especiadas.' },
  cardamomo: { name: 'Cardamomo', kind: 'cardamom', photo: '/photos/botanicos/cardamomo.jpg', desc: 'Vaina aromática, dulce y floral, con un fondo cálido.' },
  pimienta: { name: 'Pimienta de Jamaica', kind: 'allspice', photo: '/photos/botanicos/pimienta.jpg', desc: 'Baya especiada con recuerdos de clavo, canela y nuez moscada.' },
  angelica: { name: 'Raíz de angélica', kind: 'angelica', photo: '/photos/botanicos/angelica.jpg', desc: 'Raíz terrosa y herbal que une y sostiene el resto de los aromas.' },
  granos: { name: 'Granos del paraíso', kind: 'grains', photo: '/photos/botanicos/granos.jpg', desc: 'Semillas picantes y florales, de la familia del jengibre.' },
  limon: { name: 'Cáscara de limón', kind: 'lemon', photo: null, icon: 'lemon', desc: 'Aporta los aceites cítricos que dan brillo y frescura.', confirmar: true },
  algas: { name: 'Algas', kind: 'seaweed', photo: null, icon: 'wave', desc: 'Un guiño al mar del sur: notas salinas y vegetales.', confirmar: true },
  calafate: { name: 'Calafate', kind: 'calafate', photo: null, icon: 'berry', desc: 'Baya patagónica de azul profundo, casi violeta. Dice la tradición que quien come calafate vuelve a la Patagonia.' },
};

/* ── Los tres gines ───────────────────────────────────────────
   `tint`: colores de fondo de la escena cuando el gin es protagonista. */
export const GINS = [
  {
    id: 'pampa',
    name: 'Pampa',
    kind: 'Gin Artesanal',
    lead: 'The spirit of the Pampa.',
    desc: 'Gin artesanal de autor, destilado y embotellado en la Patagonia. En la etiqueta, un jinete cruza la llanura al atardecer: el espíritu de la Pampa en una botella.',
    facts: [['Graduación', '40% vol.'], ['Contenido', '750 ml'], ['Origen', 'Patagonia, Argentina']],
    img: '/product/pampa.webp',
    imgAspect: 551 / 1100,
    depth: { map: '/product/pampa-depth.png', axis: 355.2, zmax: 183.8, w: 551, h: 1100 }, // relieve deducido de la silueta de la foto
    tint: { a: [253, 248, 238], b: [240, 224, 184], glow: [233, 200, 118] },
    botanicals: ['enebro', 'cilantro', 'cardamomo', 'pimienta', 'angelica', 'granos'],
    accent: '#b8892f',
  },
  {
    id: 'mar',
    name: 'Cítrico & Mar',
    kind: 'Gin Cítrico',
    lead: 'El sur, la costa y el viento.',
    desc: 'Un gin cítrico con el mar de la Patagonia como paisaje. En la etiqueta, una costa abierta y un lobo marino frente al agua.',
    facts: [['Estilo', 'Cítrico'], ['Origen', 'Patagonia, Argentina']],
    img: '/product/mar.webp',
    imgAspect: 551 / 1100,
    depth: { map: '/product/mar-depth.png', axis: 353.5, zmax: 184.5, w: 551, h: 1100 },
    tint: { a: [248, 250, 243], b: [222, 233, 214], glow: [150, 205, 185] },
    botanicals: ['limon', 'algas'],
    scene: ['limon', 'algas', 'limon'], // piezas que se dibujan en la escena 3D (se repiten para dar volumen)
    scenery: 'sea', // elementos 3D asociados al mar
    accent: '#3f8f7e',
  },
  {
    id: 'andes',
    name: 'Gin de los Andes',
    kind: 'Gin de Frutos Azules',
    lead: 'La cordillera en la copa.',
    desc: 'Un gin que mira hacia la montaña. En la etiqueta, la cordillera nevada y un racimo de calafate con sus hojas.',
    facts: [['Estilo', 'Frutos azules'], ['Origen', 'Patagonia, Argentina']],
    img: '/product/andes.webp',
    imgAspect: 554 / 1100,
    depth: { map: '/product/andes-depth.png', axis: 353.5, zmax: 188.5, w: 554, h: 1100 },
    tint: { a: [250, 246, 249], b: [234, 222, 234], glow: [190, 160, 205] },
    botanicals: ['calafate'],
    scene: ['calafate', 'calafate', 'calafate'],
    scenery: 'ridges',
    accent: '#7b5a96',
  },
];

/* ── Experiencia ─────────────────────────────────────────── */
export const GINTONIC_STEPS = [
  { t: 'Hielo y gin', d: 'Una copa balón bien fría, hielo abundante y 50 ml de tu Argentino.' },
  { t: 'Tónica', d: 'Servida despacio y por el borde, para conservar toda la burbuja.' },
  { t: 'Cítrico y botánicos', d: 'Una cáscara de limón y unos granos de botánicos espolvoreados por encima.' },
];
export const SERVES = [
  { gin: 'Pampa', c: '#b8892f', t: 'Gin tonic clásico', d: 'Tónica, cáscara de limón y un toque de especias por encima.' },
  { gin: 'Cítrico & Mar', c: '#3f8f7e', t: 'Gin tonic cítrico', d: 'Tónica suave y una rodaja de limón bien fresca.' },
  { gin: 'Gin de los Andes', c: '#7b5a96', t: 'Gin tonic de frutos azules', d: 'Tónica y unos frutos de calafate, con hielo grande.' },
];

/* ── Tienda · precios de ejemplo ─────────────────────────── */
export const PRODUCTS = [
  {
    id: 'pampa', cat: 'gin', name: 'Argentino Pampa', sub: 'Gin Artesanal · 750 ml · 40%', price: 24000,
    img: '/product/pampa.webp', imgAspect: 551 / 1100, gin: 'pampa', tag: 'Más vendido',
    long: 'Gin artesanal de autor, destilado y embotellado en la Patagonia. Con enebro, cilantro en grano, cardamomo, pimienta de Jamaica, raíz de angélica y granos del paraíso.',
  },
  {
    id: 'mar', cat: 'gin', name: 'Argentino Cítrico & Mar', sub: 'Gin Cítrico · 750 ml', price: 24000,
    img: '/product/mar.webp', imgAspect: 551 / 1100, gin: 'mar',
    long: 'Gin cítrico con la costa patagónica como paisaje. Pensado para un gin tonic fresco, con cáscara de limón.',
  },
  {
    id: 'andes', cat: 'gin', name: 'Argentino de los Andes', sub: 'Gin de Frutos Azules · 750 ml', price: 26000,
    img: '/product/andes.webp', imgAspect: 554 / 1100, gin: 'andes', tag: 'Novedad',
    long: 'Gin de frutos azules inspirado en la cordillera. Para disfrutar con tónica y unos frutos de calafate.',
  },
  {
    id: 'trio', cat: 'combo', name: 'Trío Argentino', sub: 'Pampa + Cítrico & Mar + Andes', price: 69000, was: 74000,
    img: '/product/trio.webp', imgAspect: 1712 / 1039, tag: 'Colección',
    long: 'Las tres botellas de la colección juntas: Pampa, Cítrico & Mar y Gin de los Andes.',
  },
];

/* ── Texto legal ─────────────────────────────────────────── */
export const LEGAL = {
  age: 'Venta exclusiva a mayores de 18 años.',
  health: 'Beber con moderación. El exceso de alcohol es perjudicial para la salud.',
};
