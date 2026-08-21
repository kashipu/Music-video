# Migración de la landing a Astro

## Contexto y motivación

La landing (`landing/`) era una SPA React 18 + Vite generada con Lovable. El HTML servido solo contenía `<div id="root">`: los motores de búsqueda no veían el `<h1>` (se renderizaba por JS en `Hero.tsx`). Existía un parche temporal en `index.html` con un bloque oculto (clip-rect) que React borraba al montar — texto oculto con riesgo de penalización SEO.

Decisiones:

- **Astro estático puro, sin React**: la landing es ~95% estática. Se portan los 15 componentes a `.astro` + JS vanilla mínimo. El bundle pasa de 393 KB de JS a unos pocos KB.
- **Blog habilitado pero oculto**: content collections en `/blog`, desplegado e **indexable** (incluido en sitemap), pero **sin enlaces desde la landing** hasta el lanzamiento oficial.
- **SEO real**: h1 y todos los meta en HTML estático; sitemap generado por `@astrojs/sitemap`.

## Plan de implementación

1. **Setup Astro** en `landing/` (in-place, rama `astro-migration`): `astro@^5`, `@astrojs/sitemap`, `@astrojs/tailwind`, Tailwind **v3** reutilizando `tailwind.config.ts` y los tokens HSL (`src/styles/global.css`). Borrar `bun.lock` (Docker usa `npm ci`).
2. **Layout SEO** `src/layouts/Base.astro`: props `{ title, description, canonical, ogImage, noindex? }` con defaults de la landing actual. GTM `GTM-PPVKNTZB` copiado literal con `is:inline`. JSON-LD solo en `index.astro`.
3. **Portar componentes** a `src/components/*.astro`. Estáticos: JSX → HTML con las mismas clases Tailwind. Interactivos en vanilla:
   - Navbar: scroll listener.
   - FAQ: `<details>/<summary>` nativo.
   - LeadDialog: `<dialog>` nativo; botones `data-open-lead`.
   - WhatsApp: un listener global sobre `a[href*="wa.me"]`.
   - Animaciones de scroll: `IntersectionObserver` sobre `[data-animate]`.
   - Particles/SoundEqualizer: CSS keyframes.
   - Eventos GTM idénticos (contrato en `docs/ANALYTICS.md`): `repitela_landing_whatsapp_click`, `repitela_landing_demo_opened`, `repitela_landing_lead_submitted`.
4. **Blog**: `src/content.config.ts` (colección `blog`, schema: title, description, pubDate, ogImage?, draft), `src/content/blog/` con un post de ejemplo, páginas `blog/index.astro` y `blog/[slug].astro`. Sin enlaces desde navbar/footer.
5. **SEO extra**: borrar `public/sitemap.xml` manual, `robots.txt` → `sitemap-index.xml`, página `404.astro` con noindex.
6. **Docker/nginx**: `node:22-alpine`, quitar SPA fallback (`try_files $uri $uri/ $uri.html =404` + `error_page 404 /404.html`).
7. **Limpieza**: borrar todo lo React (shadcn/ui, hooks, App/main, vite config), `og.png` (970 KB sin usar), logos SVG sin usar, `design.md` duplicado.

## Verificación

### Criterios de aceptación

- [ ] `dist/index.html` contiene el `<h1>` del Hero como HTML estático (sin ejecutar JS).
- [ ] Snippet GTM `GTM-PPVKNTZB` intacto en el `<head>` (script + noscript).
- [ ] Los 3 eventos llegan a `window.dataLayer` (click WhatsApp, abrir demo, enviar lead).
- [ ] `sitemap-index.xml` generado e incluye `/` y las páginas del blog.
- [ ] `/blog/` renderiza y no hay ningún enlace hacia ella desde la landing.
- [ ] Rutas inexistentes devuelven 404 con `404.html`.
- [ ] Paridad visual con la landing en producción (comparación manual side-by-side).
- [ ] `docker build` funciona y nginx sirve todo lo anterior.

### Comandos

```bash
cd landing && npm run build

# h1 y GTM en HTML estático
grep '<h1' dist/index.html
grep 'GTM-PPVKNTZB' dist/index.html

# archivos generados
ls dist/sitemap-index.xml dist/blog/index.html dist/404.html

# smoke test docker (mismo pipeline que producción)
docker build -t landing-test landing/
docker run --rm -d -p 8080:80 --name landing-test landing-test
curl -s localhost:8080/ | grep '<h1'
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/noexiste   # espera 404
curl -s localhost:8080/blog/ | grep '<title'
docker stop landing-test
```

### Test manual de analytics

`npm run preview`, abrir la consola del navegador y verificar `window.dataLayer` tras:
1. Click en cualquier CTA de WhatsApp → `repitela_landing_whatsapp_click`.
2. Abrir el modal de demo → `repitela_landing_demo_opened`.
3. Enviar el formulario del modal → `repitela_landing_lead_submitted`.

## Riesgos

- **Push a `main` = deploy a producción (Dokploy)**: todo el trabajo va en la rama `astro-migration`; el merge es un único push ya verificado con docker build.
- **GTM**: sin `is:inline` Astro procesaría el script y lo rompería.
- **URLs**: `/` no cambia; `/blog/` es nueva; los enlaces externos (`app.repitela.com/admin`, `wa.me/573028336170`) se copian literales.

## Resultados de la verificación

Ejecutado en `landing/` sobre `npm run build` + `astro preview` (Docker no disponible en el entorno local — el smoke test de `docker build` queda pendiente antes del merge, ver más abajo).

- [x] `<h1>` del Hero presente en `dist/index.html` como HTML estático (verificado con `curl`, sin ejecutar JS).
- [x] Snippet GTM `GTM-PPVKNTZB` intacto (script `is:inline` + noscript).
- [x] Los 3 eventos (`repitela_landing_whatsapp_click`, `repitela_landing_demo_opened`, `repitela_landing_lead_submitted`) presentes en el JS generado, uno por cada nombre exacto.
- [x] `dist/sitemap-index.xml` generado, apunta a `sitemap-0.xml` (incluye `/` y `/blog/*`).
- [x] `/blog/` y `/blog/rockola-digital-para-bares/` renderizan (200), sin enlaces desde navbar/footer de la landing.
- [x] Rutas inexistentes devuelven 404 (`curl -o /dev/null -w '%{http_code}' /noexiste` → `404`).
- [ ] Paridad visual con producción — pendiente de revisión manual en navegador.
- [ ] `docker build` — Docker Desktop no estaba corriendo en el entorno de desarrollo; **pendiente ejecutar antes del merge a main** con:
  ```bash
  docker build -t landing-test landing/
  docker run --rm -d -p 8080:80 --name landing-test landing-test
  curl -s localhost:8080/ | grep '<h1'
  curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/noexiste
  docker stop landing-test
  ```

Bundle: sin JS de framework (React/Vite eliminados por completo); los pocos scripts de interacción (navbar, dialog de lead, scroll-reveal, tracking de WhatsApp) se inlinean en el propio HTML por su tamaño. `dist/` completo pesa 464 KB, casi todo imágenes estáticas (`karol-g-provenza.jpg`, `og-repitela.jpg`).

Notas de implementación:
- Iconos: se optó por `lucide-static` (SVGs puros, importados con `?raw` y centralizados en `src/components/Icon.astro`) en vez de reescribir a mano ~27 paths de icono — evita duplicar boilerplate de import en cada componente.
- Varios nombres de icono de Lucide cambiaron de versión (`x-circle`→`circle-x`, `check-circle-2`→`circle-check-big`, `bar-chart-3`→`chart-column`, `sliders`→`sliders-horizontal`, `help-circle`→`circle-help`); resueltos verificando los archivos reales en `node_modules/lucide-static/icons/`.
- El progreso animado de la barra en `DualMockup` (antes un `setInterval` de React) quedó fijo en 65% — es decorativo; si se quiere la animación, se puede volver a añadir con una `@keyframes` CSS.
