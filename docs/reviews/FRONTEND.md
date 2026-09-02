# Revisión de arquitectura — Frontend

Revisado el 2026-09-02 sobre `claude/frontend-architecture-review-vn2ko9`.
Alcance: `frontend/src/` (18.724 líneas), directiva `docs/FRONTEND_ARCHITECTURE.md`.

Conclusión corta: la arquitectura está **bien pensada en el papel y a medio
aplicar en el código**. La directiva es sólida; la mitad de la app no la cumple,
y las partes que sí la cumplen lo hacen en la capa barata (presentación), no en
la cara (lógica y datos).

---

## Fortalezas

- Design system propio con tokens de tema y 12 temas en CSS (`src/themes/`).
- 49 componentes con `.stories.js` y `.spec.js` al lado, según convención.
- Code-splitting completo por ruta: todas las vistas son `import()` dinámico
  (`src/router/index.js`).
- Dependencias de producción mínimas: `vue`, `pinia`, `vue-router`.
- WebSocket con reconexión exponencial, `visibilitychange` y refetch al
  reconectar (`src/composables/useWebSocket.js`).
- Decisión documentada de no precachear el HTML en el PWA, con el motivo
  escrito (`frontend/vite.config.js:10-18`).

---

## Hallazgos

### FE-1 · No existe una capa HTTP: existen cinco

**Severidad:** alta · **Esfuerzo:** medio

Cada servicio define su propio `request()` con contratos de error incompatibles:

| Archivo | Línea | Contrato de error |
|---|---|---|
| `src/services/admin.js` | 3 | Devuelve `{ error: true, status, message }` |
| `src/services/superadmin.js` | 3 | Lanza excepción |
| `src/services/auth.js` | 3 | Devuelve el `Response` crudo |
| `src/services/billing.js` | 3 | Lanza excepción, devuelve `Response` |
| `src/services/kiosk.js` | 3 | Devuelve `null` |

Consecuencias:

- No hay un solo lugar donde manejar el 401. Solo 2 de ~30 call sites detectan
  sesión expirada (`src/views/CustomerDashboard.vue:115`,
  `src/views/SuperAdminUsers.vue:107`); en el resto un token vencido se ve como
  "no cargó nada".
- Ninguna petición tiene timeout ni `AbortController`: si el backend cuelga, el
  spinner queda infinito.

**Propuesta:** `src/services/http.js` con base URL, timeout/abort, un contrato de
error único e interceptor 401 → logout + redirect. Migrar los cinco `request()`
sin cambiar las firmas públicas de los servicios.

### FE-2 · 25 `fetch()` en vistas y componentes

**Severidad:** alta · **Esfuerzo:** medio

La regla 1 de `docs/FRONTEND_ARCHITECTURE.md` §4 prohíbe `fetch()` fuera de
`src/services/` y los stores. Hay 25 violaciones.

Dominio superadmin completo: `SuperAdminPanel.vue:60`, `SuperAdminUsers.vue`
(106, 134, 190, 221), `SuperAdminSales.vue` (51, 69, 82),
`SuperAdminVenueDetail.vue:21`, `SuperAdminCreateVenue.vue:84`,
`venue/SuperAdminVenueOverview.vue:34`.

Vistas admin: `AdminSignup.vue` (91, 125, 182), `AdminSubscription.vue` (81, 99),
`AdminOnboarding.vue:77`, `AdminLogin.vue` (35, 75), `ResetPassword.vue:29`,
`ForgotPassword.vue:19`, `VerifyEmail.vue:17`, `QRLanding.vue:43`.

Componentes (prohibido incluso para vistas): `SubscriptionGate.vue:95`,
`SongSubmit.vue:69`.

No es deuda estética: es la razón por la que FE-1 no se puede arreglar en un
solo sitio.

**Propuesta:** crear `services/superadmin.js` completo y
`services/adminAccount.js` (signup, onboarding, password, verify), y mover las
25 llamadas.

### FE-3 · El token de superadmin no tiene dueño

**Severidad:** alta · **Esfuerzo:** bajo

`superAdminLogin()` guarda el token en `localStorage` pero **no en el store**
(`src/stores/auth.js:110`), a diferencia de `token` y `adminToken`, que sí son
`ref` reactivos.

Resultado: 16 lecturas directas de `bq_super_token` repartidas en vistas,
componentes, servicios y el guard del router (`src/router/index.js:156`), con
`function headers()` copiada literalmente en 6 archivos
(`SuperAdminCreateVenue.vue:34`, `SuperAdminUsers.vue:48`,
`SuperAdminPanel.vue:15`, `SuperAdminVenueDetail.vue:16`,
`venue/SuperAdminVenueOverview.vue:23`, `SuperAdminSales.vue:28`).

Tres mecanismos de auth conviven, y el de superadmin no es reactivo: si expira,
nada en la UI se entera.

**Propuesta:** mover el token al store como `ref`, exponer `superHeaders()`,
borrar las 6 copias.

### FE-4 · `useAdminDashboard.js` es la vista disfrazada de composable

**Severidad:** media · **Esfuerzo:** alto

750 líneas que devuelven ~100 claves. `AdminDashboard.vue` las destructura todas
y las vuelve a bajar como props: `AdminMusicPanel` recibe 25 props y 22 emits.

Mezcla estado de servidor, 20 flags de loading, drag & drop, generación de QR
por canvas y `window.open` para imprimir. Es el archivo con más lógica de
negocio del frontend y **no tiene un solo test**.

El techo de 300 líneas de la directiva (§4.2) aplica a `.vue`, así que el
monolito migró al `.js` y quedó fuera de la regla.

**Propuesta:** partir en `useAdminQueue`, `useAdminPlayback`,
`useAdminBranding`, `useAdminTables`, más un `utils/venueQr.js` para canvas e
impresión. Cada uno con su `.spec.js`.

### FE-5 · La pirámide de tests está invertida

**Severidad:** media · **Esfuerzo:** medio

106 tests unitarios, todos de componentes de presentación. Sin tests de: stores,
services, `useAdminDashboard` (750 líneas), `useKioskPlayback` (221),
`useWebSocket` (132), ni guards del router. El único `.spec.js` fuera de
componentes es `useTheme.spec.js`.

Se testea lo que casi no rompe y no se testea lo que rompe en producción. La
calidad de los tests existentes es buena (`AdminQueueCard.spec.js` verifica
emits y formato de duración); el problema es de cobertura estructural.

### FE-6 · `Kiosk.vue` tiene la dependencia invertida

**Severidad:** media · **Esfuerzo:** medio

702 líneas, sobre el umbral de 500 que la directiva declara "bloqueado" (§4.2).

La vista pasa cinco callbacks al composable —`loadVideo`, `triggerOverlay`,
`enforcePlaybackStatus`, `applyVolume`, `preloadNextSong`
(`src/views/Kiosk.vue:38-53`)—, así que `useKioskPlayback` no puede existir ni
testearse sin la vista. Es una dependencia circular vista → composable → vista.
La directiva ya dice (§2) que un callback por prop casi siempre debía ser un
evento.

**Propuesta:** el composable emite intenciones; la vista las ejecuta contra el
reproductor de YouTube.

### FE-7 · Estado de servidor sin disciplina de caché

**Severidad:** media · **Esfuerzo:** medio

`fetchQueue()` llama a `fetchPlayed()` dentro; hay polling cada 30 s **además**
del WebSocket; y cada evento WS dispara un refetch del conjunto completo
(`useAdminDashboard.js:156-192`).

Sin dedupe ni cancelación, un burst de eventos dispara peticiones solapadas cuyo
orden de llegada decide el estado final. Es la clase de bug que solo aparece con
el bar lleno.

**Propuesta:** refetch con dedupe y cancelación por clave; el polling de 30 s
queda solo como red de seguridad cuando `wsConnected` es `false`.

---

## Menor

- `src/main.js` importa los 12 temas CSS siempre; los 11 que no aplican son peso
  muerto en cada carga.
