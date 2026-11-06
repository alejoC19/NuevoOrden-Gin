# Argentino Gin · Tienda 3D

Vite + Three.js (botellas 3D reales, vidrio con refracción) + GSAP + Lenis (scroll suave).

```bash
npm install
npm run dev      # desarrollo
npm run build    # producción → dist/
```

## Qué editar
- `src/data.js`: **nombre de la marca (`BRAND`)**, nombres, textos, notas, precios (ARS), número de WhatsApp (`WA_NUMBER`), envío gratis y cuotas. **Los textos y precios actuales son de ejemplo.**
- `public/labels/*.jpg`: arte de la etiqueta de cada botella (se usa como textura en el modelo 3D).
- `public/photos/<id>.jpg` (`pampa`, `mar`, `andes`, `trio`): fotos de producto. Si falta una, se usa un render 3D.
- `public/photos/botanicos/`, `vida-*.jpg`, `mate.jpg`: fotos de las secciones.

## Compra
Carrito con envío gratis/cuotas; "Finalizar pedido" arma el mensaje y abre WhatsApp. El newsletter aún no guarda emails (falta backend).
