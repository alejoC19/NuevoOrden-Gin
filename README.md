# Gin · Tienda 3D

Vite + Three.js (botellas 3D reales, vidrio con refracción) + GSAP + Lenis (scroll suave).

```bash
npm install
npm run dev      # desarrollo
npm run build    # producción → dist/
```

## Qué editar
- `src/data.js`: **nombre de la marca (`BRAND`)**, nombres, textos, notas, precios (ARS), número de WhatsApp (`WA_NUMBER`), envío gratis y cuotas. **Los textos y precios actuales son de ejemplo.**
- `public/photos/<id>.jpg` (`clasico`, `citrico`, `rosa`, `noche`, `duo`, `coleccion`; también .png/.webp): fotos reales. Si existen se usan en la tienda y en cada capítulo; si no, se usa un render 3D de la botella.

## Compra
Carrito con envío gratis/cuotas; "Finalizar pedido" arma el mensaje y abre WhatsApp. El newsletter aún no guarda emails (falta backend).
