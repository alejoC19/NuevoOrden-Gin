# Argentino Gin · sitio de marca + tienda

Dos páginas independientes (Vite, multi-página):

| Ruta | Qué es |
|---|---|
| `/` | Landing narrativa: hero → Pampa → Cítrico & Mar → Gin de los Andes → Historia → Experiencia → cierre con las 3 botellas |
| `/tienda` | Tienda: catálogo, filtros, fichas (`#/pampa`), carrito, pedido por WhatsApp |

```bash
npm install
npm run dev       # desarrollo
npm run build     # producción → dist/
```

## Decisiones técnicas
- **Botellas = fotografías reales recortadas** (`public/product/*.webp`, con transparencia), no modelos 3D inventados.
  Se dibujan como planos en **un único canvas WebGL** (Three.js) con profundidad, sombra de contacto, reflejo de piso y
  un brillo de estudio. Así se conserva la etiqueta y el vidrio reales.
- **Botánicos = 3D procedural** (`src/landing/botanicals.js`): enebro, cilantro, cardamomo, pimienta de Jamaica, angélica,
  granos del paraíso, cáscara de limón, algas y arándanos. Aparecen en secuencia con el scroll y se recogen hacia la botella.
- **Un solo canvas, un solo loop** (`requestAnimationFrame` + Lenis). Todo es función continua del scroll
  (`src/landing/timeline.js`), sin máquina de estados. Se dibuja solo cuando se ve; las secciones opacas la tapan.
- **Rendimiento:** sin vidrio por transmisión ni postproceso; sin objetos nuevos por frame; calidad adaptable
  (`hiQ`, DPR máximo, degradación automática si bajan los FPS); pérdida de contexto WebGL contemplada.
- **Accesibilidad:** `prefers-reduced-motion` (sin scroll suave ni movimiento idle), composición estática si no hay WebGL.

## Qué editar
- `src/shared/data.js`: textos, gines, botánicos, productos, precios, contacto (`CONTACT.instagram` / `CONTACT.whatsapp`).
  Lo marcado `confirmar: true` salió de las maquetas y hay que validarlo con la marca.
- Si `CONTACT.*` está vacío, el enlace no se muestra.

## Material que haría falta para el máximo realismo
1. Fotos de producto en alta resolución (≥ 3000 px de alto), fondo neutro, luz de estudio, de frente y 3/4.
2. Archivos de etiqueta originales en vector o 600 dpi (las fotos actuales tienen textos pequeños ilegibles).
3. Idealmente un escaneo/fotogrametría de cada botella o un modelo `.glb` (Blender) para rotación real 360°.
4. Fotografías de los botánicos reales sobre fondo neutro (para reemplazar los modelos procedurales).
