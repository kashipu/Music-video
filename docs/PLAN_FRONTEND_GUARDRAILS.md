# Plan: Guardrails contra monolitos en el frontend

## Contexto

`views/AdminDashboard.vue` (1655L) y `views/Kiosk.vue` (1343L) crecieron sin ningún control mecánico: no hay config de ESLint funcional (`eslint` está en `package.json` pero no existe `eslint.config.js`/`.eslintrc*`, así que `npm run lint` es un no-op con ESLint 9), no hay CI en el repo (`.github/workflows/` no existe), y `docs/CONTRIBUTING.md` documenta convenciones de estilo pero nunca dice *cuándo* extraer un componente/composable. Como resultado, ambas vistas reimplementan lógica que ya existe en `components/NowPlaying.vue`, `QueueList.vue`, `SongCard.vue` y en el store `stores/queue.js`, en vez de reusarla.

El objetivo es doble: (1) instalar guardrails baratos y mecánicos para que esto no se repita en vistas nuevas o en trabajo futuro delegado a Codex, y (2) dejar un backlog concreto y ordenado para achicar los dos monolitos existentes.

## Restricciones

- Todo el trabajo de este plan vive en rama (`frontend/anti-monolith-guardrails` u otras derivadas de ella) — nunca directo sobre `main`, ya que en este proyecto push a `main` dispara deploy a producción (server de 2 vCPU compartido, DB sin backups).
- Nada de este plan toca datos de producción: la Parte A son solo archivos de configuración/CI/documentación; la Parte B es reestructuración de código frontend sin migraciones ni scripts que lean/escriban la base de datos de producción.

## Parte A — Guardrails (aún no implementado)

**A1. `frontend/eslint.config.js` (nuevo) + agregar `eslint-plugin-vue` a devDependencies**

No existe config de ESLint hoy — hay que crearla desde cero (flat config, ESLint 9). Reglas elegidas por el problema real encontrado (duplicación + fetch directo), no por conteo de líneas a ciegas:

- `no-restricted-syntax` prohibe `fetch()` directo en `views/**/*.vue` y `components/**/*.vue` (mensaje: usar un store o composable). Exime `stores/**` y `composables/**` (ahí es donde ya vive `safeFetch` de `useToast.js`). Para `AdminDashboard.vue` y `Kiosk.vue` esta regla se degrada a `warn` explícitamente por nombre de archivo (excepción nombrada, no carve-out de carpeta) — van a disparar de inmediato por la deuda existente; no bloquear CI por eso hoy.
- `max-lines` con umbral 300, severidad `warn`, con `overrides` que la limitan a `components/**/*.vue` y `composables/**/*.js` — **no** aplica a `views/**`. Un cap parejo repo-wide rompería el build el día uno contra los 1655L/1343L existentes; en cambio protege el patrón que ya funciona bien (componentes/composables chicos). `SongSubmit.vue` (301L) queda justo arriba del umbral — sirve de prueba de que la regla está viva.
- El límite de tamaño para `views/*.vue` se aplica de forma procesal (regla A4 para Codex), no mecánica — decidir si una vista ya es demasiado grande necesita criterio, no un lint.

**A2. `.github/workflows/frontend-lint.yml` (nuevo)**

CI mínimo — el repo no tiene ninguno hoy. Un solo job: checkout, setup-node 20 con cache de `frontend/package-lock.json`, `npm ci`, `npx eslint . --ext .vue,.js` (sin `--fix`, para no auto-commitear cambios en CI). Trigger solo en PRs que tocan `frontend/**`.

**A3. `docs/CONTRIBUTING.md`** — insertar después de la línea 193 (fin del bloque "Frontend (Vue.js)", antes del `---` de la línea 195), un subbloque "Cuándo extraer un componente o composable" citando `useWebSocket.js` (composable con estado+lógica propia) y `SongCard.vue` (componente chico, solo props/emit) como referencia, más la regla explícita de revisar `components/`/`composables/`/`stores/` antes de escribir lógica nueva en `AdminDashboard.vue`, `Kiosk.vue` o `SuperAdminVenueDetail.vue`, y de no usar `fetch()` directo (enforced por A1).

**A4. `~/.claude/commands/orquestador.md`** — agregar a `## Reglas`: toda Task que toque `frontend/src/views/*.vue` debe incluir en su spec (1) revisar `components/`, `composables/`, `stores/` por lógica reusable antes de escribir código nuevo, y (2) para las tres vistas más grandes, no agregar lógica inline neta sin extraerla.

## Parte B — Roadmap de los dos monolitos (backlog; Tasks orquestadas)

**AdminDashboard.vue**, en orden (cada una una Task independiente):
1. `[MEDIA]` Reemplazar la now-playing card hecha a mano por `components/NowPlaying.vue`, conectada a `stores/queue.js` en vez del ref local `nowPlaying`.
2. `[MEDIA]` Reemplazar la lista de cola + drag&drop por `components/QueueList.vue`/`SongCard.vue`, migrando `queue`/`played` a `stores/queue.js`.
3. `[MEDIA]` Extraer banner/branding/QR a `components/AdminBrandingPanel.vue` (ya identificado como autocontenido).
4. `[MEDIA]` Extraer analytics/tables a `components/AdminAnalyticsPanel.vue` — la Task debe primero confirmar aislamiento real antes de extraer.
5. `[MEDIA]` Extraer búsqueda de YouTube a `components/AdminSongSearch.vue`.
6. `[COMPLEJA]` Limpieza transversal: reemplazar los `fetch()` inline restantes por el store, y colapsar los dos mecanismos de toast (`adminToast` local + `useToast()`) en uno solo. Al final, después de que 1-5 ya redujeron el archivo.

**Kiosk.vue**, en orden:
1. `[MEDIA]` Extraer progress bar/controles a `components/KioskControls.vue` (bajo acoplamiento confirmado).
2. `[MEDIA]` Extraer banner/branding/QR overlay a `components/KioskBranding.vue` — evaluar si puede ser el mismo componente que `AdminBrandingPanel.vue` del punto A3 de arriba.
3. `[MEDIA]` Envolver la YouTube IFrame API (hoy 100% inline) en `composables/useYouTubePlayer.js`, espejando el patrón de `useWebSocket.js`. Movimiento mecánico, sin cambio de comportamiento.
4. `[COMPLEJA]` Consolidar el cluster WS-dispatcher / `syncNowPlaying` / fallback / `onPlayerStateChange` / `onPlayerError` (y sus refs compartidos) en un único `composables/useKioskPlayback.js`, usando `useYouTubePlayer` (paso 3) y `useWebSocket` existente. No forzar más split — es una sola máquina de estados acoplada, partirla artificialmente solo mueve el acoplamiento. Último paso.

## Verificación (al implementar Parte A/B)

- `cd frontend && npm install` (trae `eslint-plugin-vue`), luego `npm run lint` — debe correr sin crashear, marcar `warn` en `SongSubmit.vue` (>300L) y en los `fetch()` de `AdminDashboard.vue`/`Kiosk.vue`, sin errores nuevos que rompan el comando.
- Abrir un PR de prueba que toque `frontend/**` y confirmar que `frontend-lint.yml` se dispara y corre en GitHub Actions.
- Revisar que `docs/CONTRIBUTING.md` y `~/.claude/commands/orquestador.md` quedaron legibles y consistentes con el resto del documento.
