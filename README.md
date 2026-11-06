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

## Cómo se hizo el 3D (y por qué)
**Botellas.** De cada botella existe una sola foto frontal. Modelarlas en Blender obligaría a inventar la parte trasera,
la forma exacta y el telar, y la etiqueta dejaría de ser la original. Por eso la botella es **la foto original sobre un
relieve** (`public/product/*-depth.png`): la profundidad se deduce de la propia silueta (las botellas son cuerpos de
revolución) y el telar queda como una lámina por delante del vidrio. La malla se compensa con la perspectiva
(`BOTTLE_VS` en `src/landing/stage.js`): en reposo la imagen coincide con la foto con **error < 0,2 px** y la relación
de aspecto es exacta; al orbitar la cámara aparece paralaje real. No hay texturas recompuestas ni etiquetas redibujadas.

**Botánicos y escenografía.** Sí son 3D real, con geometría y materiales PBR (`src/landing/botanicals.js`,
`src/landing/scenery.js`): enebro, cilantro, cardamomo, pimienta de Jamaica, angélica y granos del paraíso (Pampa);
cáscara de limón y algas + ondas, rocío y cantos rodados (Cítrico & Mar); calafate con sus hojas + cordillera en capas y
nieve fina (Gin de los Andes).

**Evaluación de herramientas**
| Herramienta | Decisión |
|---|---|
| Blender + GLB | Útil cuando existan archivos 3D originales del envase o un escaneo. Con una sola foto frontal no se puede reconstruir fielmente. El pipeline está listo para cargar `.glb` (ver abajo). |
| React Three Fiber | No suma resultado visual y sí peso y complejidad (React + drei). La escena es un único canvas imperativo, más fácil de mantener estable. |
| GSAP ScrollTrigger | Innecesario: el recorrido es una función continua del scroll (`timeline.js`) con Lenis. Una segunda fuente de verdad del scroll es justo lo que genera parpadeos. |

## Arquitectura del scroll
- `timeline.js`: scroll → gin activo, botánicos revelados y **coreografía de cámara** (aparece la botella → la cámara se
  acerca → los botánicos entran uno a uno → composición → la cámara se aleja → transición al siguiente gin).
- **Zonas visuales** (`computeZones` en `main.js` + `fitFor` en `stage.js`): se miden las cajas reales del texto y todo
  lo 3D se ajusta para vivir en el espacio libre. Botella, botánicos y escenografía no pueden pisar el texto en ningún
  tamaño de pantalla. Los botánicos solo existen cuando el gin ya llegó a su lugar.
- Un solo canvas y un solo loop; se dibuja solo cuando se ve. Calidad adaptable (`hiQ`, DPR, degradación por FPS).
- Accesibilidad: `prefers-reduced-motion` y composición estática sin WebGL.

## Verificación automática
Con `/?debug` queda expuesto `window.__ag`: `stage.screenRects()` (cajas en pantalla de botella, botánicos y
escenografía) y `stage.reliefError(i)`. El test recorre el scroll y mide los solapes contra los textos.

## Qué editar
- `src/shared/data.js`: textos, gines, botánicos, productos, precios, contacto (`CONTACT.instagram` / `CONTACT.whatsapp`).
  Lo marcado `confirmar: true` salió de las maquetas y hay que validarlo con la marca.
- Si `CONTACT.*` está vacío, el enlace no se muestra.

## Material que haría falta para el máximo realismo
0. Archivos 3D originales del envase (`.blend`, `.glb`, `.fbx`), si existen: reemplazan al relieve.
1. Fotos de producto en alta resolución (≥ 3000 px de alto), fondo neutro, luz de estudio, de frente y 3/4.
2. Archivos de etiqueta originales en vector o 600 dpi (las fotos actuales tienen textos pequeños ilegibles).
3. Idealmente un escaneo/fotogrametría de cada botella o un modelo `.glb` (Blender) para rotación real 360°.
4. Fotografías de los botánicos reales sobre fondo neutro (para reemplazar los modelos procedurales).
