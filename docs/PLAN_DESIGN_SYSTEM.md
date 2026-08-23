# Plan: Sistema de diseño (lenguaje visual shadcn-vue + Atomic Design)

## Contexto

Hoy el frontend ya tiene la base correcta para un sistema de diseño: tokens vía CSS custom properties en `frontend/src/style.css` (`--primary`, `--bg`, `--text`, `--radius`, semánticos `--danger/--warning/--success`) para dark/light, y personalización por venue en runtime vía `composables/useTheme.js` (`applyVenueTheme`, `applyAccent`). Es, arquitectónicamente, el mismo mecanismo que usa [shadcn-vue](https://www.shadcn-vue.com/) (CSS vars + Tailwind consumiéndolas) — la diferencia es que acá faltan (1) un set de tokens más granular, (2) límites claros de qué puede personalizar un bar, y (3) una capa de componentes-primitivo reusable, por lo que las vistas grandes (`AdminDashboard.vue` 1655L, `Kiosk.vue` 1343L) terminan reimplementando UI a mano en vez de componerla.

Este plan **no adopta Tailwind ni Reka UI/Radix** — el usuario definió que accesibilidad no es la prioridad y que el peso del bundle/velocidad sí lo son. Shadcn-vue se usa solo como **referencia visual y de organización de tokens**, no como dependencia.

Este plan también absorbe y reemplaza la Parte B de `docs/PLAN_FRONTEND_GUARDRAILS.md` (roadmap de extracción de `AdminDashboard.vue`/`Kiosk.vue`) — construir la capa de primitivos y reusar ahí es la forma concreta de ejecutar esa Parte B, así que en vez de dos backlogs paralelos, la Fase 4 de este documento la reemplaza.

## Restricciones

- Todo el trabajo vive en rama (`frontend/design-system-shadcn` u otras derivadas) — nunca directo sobre `main` (push a `main` = deploy a producción en este proyecto).
- Sin dependencias nuevas de UI/CSS (nada de Tailwind, Reka UI, MUI, Vuetify). Los componentes se escriben a mano con `<style scoped>`, que Vite ya poda por componente — costo real ≈0 en bundle.
- No se toca el mecanismo de tokens en runtime de forma incompatible — `applyVenueTheme`/`applyAccent` deben seguir funcionando durante toda la migración (extender, no romper).
- Nada de este plan toca datos de producción — es solo frontend (tokens CSS, componentes Vue, refactor de vistas).

## Fase 1 — Ampliar el set de tokens (`frontend/src/style.css`)

Mapear el set actual al vocabulario más granular de shadcn, manteniendo los nombres donde ya existen para no romper `useTheme.js`:

| Actual | Shadcn (referencia) | Acción |
|---|---|---|
| `--bg` | `--background` | mantener `--bg`, agregar alias semántico si hace falta |
| `--bg-card` | `--card` | ya existe, mantener |
| `--text` | `--foreground` | mantener |
| `--primary` / `--primary-dark` / `--primary-soft` | `--primary` / `--primary-foreground` | mantener, agregar `--primary-foreground` (hoy es `--text-on-primary`, unificar nombre) |
| — | `--muted` / `--muted-foreground` | **nuevo** — para texto/fondos secundarios, hoy se resuelve ad hoc con `--text-muted` |
| — | `--accent` / `--accent-foreground` | **nuevo** — hover/estado activo, distinto del `--primary` de marca |
| `--danger` | `--destructive` / `--destructive-foreground` | mantener nombre actual (ya es consistente con el resto del código) |
| `--border` / `--border-soft` | `--border` | mantener |
| — | `--input` | **nuevo** — borde específico de campos de formulario (hoy reusan `--border`) |
| — | `--ring` | **nuevo** — color de foco (hoy no hay un anillo de foco consistente) |
| `--radius` / `--radius-sm` | `--radius` | mantener, agregar `--radius-lg` si se necesita para cards grandes |

No se eliminan tokens existentes — es una ampliación aditiva sobre `frontend/src/style.css`.

## Fase 2 — Theming con límites (`frontend/src/composables/useTheme.js`)

- Extender `applyVenueTheme`/`applyAccent` para cubrir el set ampliado (Fase 1), reusando las utilidades ya existentes (`adjustBrightness`, `adjustHue`, `getContrastText`, `hexToRgb`) — no reinventar cálculo de color.
- Definir explícitamente qué propiedades puede personalizar un bar (hoy: accent, bg, text, mode) vs. cuáles quedan fijas por el sistema (ej. `--destructive`, `--radius` — un bar no debería poder romper el semáforo de estados ni la geometría base). Esto es la parte de "límites" pedida: una lista corta y documentada de props personalizables, no cualquier CSS var.
- El JSON de config de tema por venue (ya existe, ver `applyVenueTheme(config)`) se extiende con las nuevas keys opcionales; retrocompatible con configs de venues existentes que no las traen (fallback a los valores default de `style.css`).

## Fase 3 — Atomic Design: capa de primitivos (`frontend/src/components/ui/` — nueva carpeta)

Nueva carpeta `components/ui/` para "átomos" reusables entre vistas, con sistema de variantes por props (equivalente a `cva` de shadcn pero sin la dependencia — un objeto de mapeo `variant -> clases` en cada componente). Set inicial, priorizado por lo que ya se reimplementa a mano en `AdminDashboard.vue`/`Kiosk.vue`:

- `Button.vue` — variantes `primary/secondary/danger/ghost`, tamaños `sm/md/lg`
- `Badge.vue` — variantes por color semántico
- `Card.vue` — contenedor base (`--bg-card`, `--radius`, `--border`)
- `Input.vue` / `Select.vue` — campos de formulario usando `--input`/`--ring`
- `Modal.vue` — usando `<dialog>` nativo (foco/escape gratis del navegador, sin librería)
- `Skeleton.vue` — loading state, reemplaza spinners ad hoc
- `Avatar.vue` — para logos de bar/usuarios

### Fase 3a — Kickoff: pantallas de login (primer caso real, arranca la Fase 3)

Referencia: [`login-02`](https://www.shadcn-vue.com/blocks/login) de shadcn-vue (registry real bajado de GitHub: `apps/v4/public/r/styles/new-york-v4/login-02.json`) — layout split-screen (form a la izquierda, panel a la derecha, oculto en mobile). Adaptado sin Tailwind/Reka UI, sin OAuth/signup (no aplican al modelo de auth de Repitela: cuentas admin las provisiona el super admin, no hay self-signup).

**Por qué ahora:** `AdminLogin.vue` (102L) y `SuperAdminLogin.vue` (85L) son casi idénticos (mismos campos usuario/password, mismo layout, misma lógica de error/loading) pero están totalmente duplicados — es el ejemplo más chico y de menor riesgo para probar el patrón atoms→moléculas→vistas del plan.

**Decisiones de diseño (ya confirmadas con el usuario):**
- Aplica a **ambas** pantallas (Admin y SuperAdmin) — mismo componente visual compartido, lógica de login/redirect distinta por vista.
- Panel derecho: **placeholder genérico sin imagen real** (Repitela no tiene banco de fotos de bares) — gradiente con tokens existentes (`--primary-soft`) + marca centrada, cero peso de red, reemplazable por foto real más adelante.
- Marca: reusar `frontend/src/assets/logo-color-positivo.svg` / `logo-color-negativo.svg` (ya existen en el repo, sin usar) — nada de librería de iconos nueva.
- Reusar clases globales ya definidas en `style.css` (`.btn`/`.btn-primary`/`.input-field`) en vez de escribir CSS nuevo para los átomos.

**Archivos:**
- Nuevo `components/ui/Button.vue` — wrapper de `.btn`/`.btn-{variant}`, prop `variant` (default `primary`)
- Nuevo `components/ui/Input.vue` — wrapper de `.input-field`, `v-model`
- Nuevo `components/AuthSplitLayout.vue` — shell split-screen (marca + slot de form + panel derecho), incluye el theme-toggle (hoy duplicado en ambas vistas)
- Nuevo `components/AuthLoginForm.vue` — formulario usuario/password compartido (title/subtitle/error/loading por props, `v-model:username`/`v-model:password`, emit `submit`), construido con los dos átomos
- Modificar `views/AdminLogin.vue` y `views/SuperAdminLogin.vue` — pasan a componer `AuthSplitLayout` + `AuthLoginForm`, conservan su propia lógica de auth/redirect
- Modificar `stores/auth.js` — agregar `superAdminLogin()` (mismo patrón que `adminLogin()` ya existente) para sacar el `fetch()` directo que hoy vive en `SuperAdminLogin.vue` (alineado con la regla de la Fase 1 de no hacer fetch directo en vistas)

Los componentes existentes en `components/` (`SongCard.vue`, `NowPlaying.vue`, `QueueList.vue`, etc.) son las "moléculas" — se migran para componerse a partir de estos átomos donde aplique, no se reescriben desde cero.

## Fase 4 — Reuso en las vistas grandes ("organismos", reemplaza Parte B de PLAN_FRONTEND_GUARDRAILS.md)

Con los átomos de la Fase 3 listos, extraer de `AdminDashboard.vue`/`Kiosk.vue` reusando tanto los átomos nuevos como las moléculas ya existentes (`NowPlaying.vue`, `QueueList.vue`, `SongCard.vue`) y el store `stores/queue.js` que hoy ninguna de las dos vistas usa. Orden sugerido (cada uno una Task independiente vía `/orquestador`):

**AdminDashboard.vue:**
1. Now-playing card → reusar `NowPlaying.vue` + `stores/queue.js` en vez del ref local
2. Queue list + drag&drop → reusar `QueueList.vue`/`SongCard.vue`, migrar a `stores/queue.js`
3. Banner/branding/QR → `components/AdminBrandingPanel.vue` (organismo nuevo, compuesto con átomos de Fase 3)
4. Analytics/tables → `components/AdminAnalyticsPanel.vue`
5. Búsqueda de YouTube → `components/AdminSongSearch.vue`
6. Limpieza: unificar los dos mecanismos de toast en uno, reemplazar `fetch()` inline restantes por el store

**Kiosk.vue:**
1. Progress bar/controles → `components/KioskControls.vue`
2. Banner/branding/QR overlay → evaluar si comparte componente con `AdminBrandingPanel.vue`
3. YouTube IFrame API (hoy 100% inline) → `composables/useYouTubePlayer.js`, mismo patrón que `useWebSocket.js`
4. Cluster de estado de reproducción (WS dispatcher + fallback + player state/error) → `composables/useKioskPlayback.js`, sin forzar más split — es una máquina de estados acoplada

## Alcance de esta sesión

Solo se crea la rama y se guarda este documento en `docs/PLAN_DESIGN_SYSTEM.md`, commiteado. No se implementa ninguna fase todavía — eso se hace en Tasks orquestadas por separado, una fase/paso a la vez.

## Verificación (al implementar cada fase)

- Fase 1-2: la app sigue arrancando sin errores de CSS, `applyVenueTheme` sigue aplicando temas de venues existentes sin cambios visuales no intencionados (regresión visual = bug).
- Fase 3: cada componente nuevo en `components/ui/` tiene uso real en al menos una vista antes de mergear (no componentes especulativos sin consumidor).
- Fase 4: por cada extracción, `npm run test` (Vitest) y los e2e de Playwright relevantes (`frontend/tests-e2e`) siguen pasando; revisar visualmente en dev server antes de dar por cerrada la Task.
