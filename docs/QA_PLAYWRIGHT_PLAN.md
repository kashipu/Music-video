# Plan de pruebas E2E con Playwright

Cubre los casos visuales/multi-vista que el script de API no puede tocar.
La pieza clave: **stubear `window.YT`** antes de que el Kiosk lo cargue para simular eventos del reproductor (ready, ended, error, paused) sin red real.

---

## 1. Setup

### 1.1 Instalación
```bash
cd frontend
npm install -D @playwright/test
npx playwright install chromium firefox webkit
```

### 1.2 Estructura
```
frontend/
├── tests-e2e/
│   ├── fixtures/
│   │   ├── ytStub.ts          # Stub del IFrame API de YouTube
│   │   ├── apiHelpers.ts      # Helpers para seed/reset DB vía API admin
│   │   └── auth.ts            # Login admin, registrar usuario, etc.
│   ├── customer/
│   │   ├── register.spec.ts
│   │   ├── submit.spec.ts
│   │   └── rate-limit.spec.ts
│   ├── admin/
│   │   ├── login.spec.ts
│   │   ├── queue-mgmt.spec.ts
│   │   ├── playback-controls.spec.ts
│   │   └── multi-tab-sync.spec.ts
│   ├── kiosk/
│   │   ├── fallback-flow.spec.ts
│   │   ├── skip-transitions.spec.ts
│   │   └── error-handling.spec.ts
│   └── multi-role/
│       └── fallback-queue-rules.spec.ts   # BR-12b: 3 ventanas a la vez
└── playwright.config.ts
```

### 1.3 Backend para los tests
- Antes de cada `describe`: `POST /api/test/reset` (endpoint nuevo, solo activo cuando `APP_ENV=test`) que limpia tablas y crea: venue `e2e-test`, admin, 5 metadatas pre-cacheadas, fallback playlist con 3 canciones falsas.
- Alternativa sin backend nuevo: el helper en TS hace los `INSERT`s directos vía `better-sqlite3` apuntando a `data/barqueue.db`.

### 1.4 YT Stub (la pieza crítica)
```ts
// fixtures/ytStub.ts
export const ytStubScript = `
  (function() {
    const handlers = { onReady: null, onStateChange: null, onError: null };
    let state = -1;
    window.__ytTest = {
      fire: (evtName, data) => {
        if (evtName === 'state') { state = data; handlers.onStateChange?.({ data }); }
        if (evtName === 'error') { handlers.onError?.({ data }); }
      },
      getState: () => state,
      getLoadedVideo: () => window.__ytTest._loaded,
    };
    window.YT = {
      Player: function(elemId, opts) {
        handlers.onReady = opts.events?.onReady;
        handlers.onStateChange = opts.events?.onStateChange;
        handlers.onError = opts.events?.onError;
        const player = {
          loadVideoById: (id) => { window.__ytTest._loaded = id; state = 1; handlers.onStateChange?.({ data: 1 }); },
          cueVideoById: (id) => { window.__ytTest._loaded = id; state = 5; handlers.onStateChange?.({ data: 5 }); },
          playVideo: () => { state = 1; handlers.onStateChange?.({ data: 1 }); },
          pauseVideo: () => { state = 2; handlers.onStateChange?.({ data: 2 }); },
          stopVideo: () => { state = 0; },
          getPlayerState: () => state,
          getCurrentTime: () => 30,
          getDuration: () => 200,
          seekTo: () => {}, setVolume: () => {}, mute: () => {}, unMute: () => {}, isMuted: () => false,
        };
        setTimeout(() => opts.events?.onReady?.(), 0);
        return player;
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5, UNSTARTED: -1 },
    };
    // Block the real iframe_api script so it doesn't override our stub
    const orig = document.createElement;
    document.createElement = function(tag) {
      const el = orig.call(document, tag);
      if (tag === 'script') {
        Object.defineProperty(el, 'src', {
          set(v) { if (v.includes('youtube.com/iframe_api')) return; this._src = v; },
          get() { return this._src; },
        });
      }
      return el;
    };
  })();
`;
```

Uso:
```ts
await page.addInitScript(ytStubScript);
await page.goto('/e2e-test/kiosk');
await page.click('text=INICIAR REPRODUCTOR');
// Disparar eventos:
await page.evaluate(() => window.__ytTest.fire('state', 0)); // ENDED
await page.evaluate(() => window.__ytTest.fire('error', 150)); // copyright
```

---

## 2. Mapeo BH → spec

| BH | Spec file | Cómo se prueba con Playwright |
|----|-----------|-------------------------------|
| **BH-01** sync título fallback | `multi-role/fallback-queue-rules` | Abrir 3 contextos (admin, kiosk, customer) → kiosk dispara `playFallback` → assert mismo título en los 3 |
| **BH-02** skip fallback con cola pendiente | `kiosk/skip-transitions` | Stub kiosk reproduciendo fallback → API agregar canción → admin click "Siguiente" → assert kiosk llama `loadVideoById` con el yt de usuario |
| **BH-03** skip fallback sin cola | `kiosk/skip-transitions` | Stub fallback sonando, cola vacía → admin "Siguiente" → assert kiosk llama `loadVideoById` con otra canción del fallback |
| **BH-04** skip vacía cola → fallback | `kiosk/skip-transitions` | Stub canción usuario sonando + cola vacía → admin "Siguiente" → assert kiosk inicia fallback |
| **BH-05** fin natural durante fallback | `kiosk/fallback-flow` | Stub fallback sonando → API confirmar canción → `__ytTest.fire('state', 0)` (ENDED) → assert kiosk llama `loadVideoById` con yt de usuario |
| **BH-06** pausa/resume coherente | `admin/playback-controls` | Stub kiosk → admin click "Pausar" → assert kiosk player.pauseVideo se llamó (state=2) y admin muestra "Reanudar" |
| **BH-07** botones transversales (5 estados) | `multi-role/fallback-queue-rules` | Loop de los 5 estados, en cada uno disparar Siguiente/Pausa y assert efecto |
| **BH-10** auto-play primera canción | `customer/submit` | Customer confirma con cola vacía → assert banner "TU CANCION ESTA SONANDO" + kiosk `loadVideoById` |
| **BH-15** reorden DnD respeta FIFO | `admin/queue-mgmt` | 4 canciones → drag de la 4 a posición 1 → terminar canción actual → assert orden correcto |
| **BH-17** kicked redirige a registro | `admin/queue-mgmt` | Admin click "Kick" en mesa → customer recibe `session_kicked` → assert URL = `/registro` |
| **BH-18** PIN diario | `customer/register` | Activar PIN → registrar sin/con PIN → assert respuestas |
| **BH-20** 3 errores fallback se detiene | `kiosk/error-handling` | Stub fallback → fire `error 150` x3 → assert kiosk muestra estado "esperando" |
| **BH-21** reconexión WS | `multi-role/...` | Abrir kiosk → cerrar WS server-side / `page.context().setOffline(true)` → reabrir → assert `syncNowPlaying` se llamó |
| **BH-22** sesión expirada | `customer/...` | Manipular `localStorage` token a uno expirado → intentar acción → assert redirect a `/registro` |
| **BH-23/24** pausar/reanudar fallback | `admin/playback-controls` | Mismas mecánicas, asserts en customer dashboard también (limpiar nowPlaying) |
| **BH-25** volumen sincronizado entre admins | `admin/multi-tab-sync` | 2 contextos admin → mover slider en uno → assert el otro recibió WS y actualizó UI |
| **BH-26** banner desaparece a 3 min | `admin/playback-controls` | `page.clock.fastForward('3:01')` (Playwright 1.45+) → assert banner ya no se ve |
| **BH-28** concurrencia de 3 usuarios | `customer/submit` | 3 contextos paralelos confirmando → assert posiciones únicas (cubre el bug que ya encontramos) |
| **BH-29** doble click confirm | `customer/submit` | Click x2 muy rápido → assert solo 1 entrada en cola |
| **BH-30** thumbnails con DNS bloqueado | `customer/...` | `page.route('**/*ytimg.com/**', r => r.abort())` → assert hay placeholder/onerror |

---

## 3. Casos representativos (ejemplos de specs)

### 3.1 `kiosk/skip-transitions.spec.ts` — BH-02 (la más crítica)
```ts
test('admin skip durante fallback con cola pendiente cambia inmediatamente', async ({ browser }) => {
  await resetDb();
  await seedFallbackPlaylist(['fb1', 'fb2', 'fb3']);

  const adminCtx = await browser.newContext();
  const kioskCtx = await browser.newContext();

  const adminPage = await adminCtx.newPage();
  const kioskPage = await kioskCtx.newPage();
  await kioskPage.addInitScript(ytStubScript);

  // 1. Login admin + abrir kiosk
  await loginAdmin(adminPage, 'e2e-test');
  await kioskPage.goto('/e2e-test/kiosk');
  await kioskPage.click('text=INICIAR REPRODUCTOR');
  await kioskPage.waitForFunction(() => window.__ytTest?.getLoadedVideo()?.startsWith('fb'));

  // 2. Customer (vía API) agrega canción
  const userToken = await registerUser('3000000001');
  await confirmSong(userToken, 'usr1');

  // 3. Admin click "Siguiente"
  await adminPage.click('button:has-text("Siguiente")');

  // 4. Kiosk debe haber cambiado a la canción del usuario
  await expect.poll(
    () => kioskPage.evaluate(() => window.__ytTest.getLoadedVideo()),
    { timeout: 3000 }
  ).toBe('usr1');
});
```

### 3.2 `multi-role/fallback-queue-rules.spec.ts` — BH-01 sync título
```ts
test('título del fallback igual en admin/kiosk/customer', async ({ browser }) => {
  await resetDb();
  await seedFallbackPlaylist([{ id: 'fb1', title: 'Fallback Track One' }]);

  const [adminCtx, kioskCtx, custCtx] = await Promise.all([
    browser.newContext(), browser.newContext(), browser.newContext(),
  ]);
  const adminP = await adminCtx.newPage();
  const kioskP = await kioskCtx.newPage();
  const custP = await custCtx.newPage();
  await kioskP.addInitScript(ytStubScript);

  await Promise.all([
    loginAdmin(adminP, 'e2e-test'),
    registerCustomerInBrowser(custP, 'e2e-test', '3000000099'),
  ]);

  await kioskP.goto('/e2e-test/kiosk');
  await kioskP.click('text=INICIAR REPRODUCTOR');

  // Esperar a que el fallback dispare y el backend reciba /api/playback/fallback-playing
  await kioskP.waitForFunction(() => window.__ytTest?.getLoadedVideo() === 'fb1');

  // Las 3 vistas deben mostrar el mismo título
  await expect(adminP.locator('.np-title')).toHaveText('Fallback Track One');
  await expect(custP.locator('.np-title')).toHaveText('Fallback Track One');
  await expect(kioskP.locator('.bottom-title')).toHaveText('Fallback Track One');
});
```

### 3.3 `customer/submit.spec.ts` — BH-28 race de posiciones
```ts
test('3 usuarios confirmando en paralelo no duplican posición', async ({ browser }) => {
  await resetDb();
  const ctxs = await Promise.all([1,2,3].map(() => browser.newContext()));
  const tokens = await Promise.all(ctxs.map((_, i) => registerUser(`30000010${i}`)));

  // Confirm en paralelo — replica BH-28 que falló en API
  await Promise.all(tokens.map((tok, i) => confirmSong(tok, `vid${i}`)));

  const positions = await getQueuePositions();
  expect(new Set(positions).size).toBe(positions.length);
  expect(positions).toEqual([...positions].sort((a,b) => a-b));
});
```

### 3.4 `admin/multi-tab-sync.spec.ts` — BH-25 volumen
```ts
test('volumen sincroniza entre dos tabs admin', async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  await Promise.all([loginAdmin(p1, 'e2e-test'), loginAdmin(p2, 'e2e-test')]);

  await p1.fill('input[type="range"]', '40');
  await p1.dispatchEvent('input[type="range"]', 'change');

  await expect.poll(() => p2.inputValue('input[type="range"]')).toBe('40');
});
```

---

## 4. Lo que **no** se puede aún con Playwright (deja para manual / video-record)

- **Audio real bloqueado por autoplay policy** — el navegador headless suele permitir autoplay, así que el overlay "ACTIVAR SONIDO" no se dispara igual que en producción.
- **Calidad de transición visual** del cambio de canción (no se ve el iframe real).
- **Notification API** del navegador — Playwright no tiene API para verificar la notificación nativa, solo se puede asertar que se llamó `new Notification(...)`.

---

## 5. Configuración recomendada

```ts
// playwright.config.ts
export default {
  testDir: './tests-e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // mobile customer
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    { command: 'cd ../backend && APP_ENV=test uvicorn app.main:app --port 8001', url: 'http://localhost:8001/api/health' },
    { command: 'VITE_API_URL=http://localhost:8001 npm run dev -- --port 5174', url: 'http://localhost:5174' },
  ],
};
```

Backend en puerto 8001 + frontend en 5174 para no chocar con el dev server normal.

---

## 6. Costo estimado de implementación

| Pieza | Esfuerzo |
|-------|----------|
| Setup base (config + ytStub + helpers DB) | 2-3h |
| Specs P0 (BH-01..07, BH-10) | 4-5h |
| Specs P1 (BH-15, 17, 18, 20-25) | 3-4h |
| Specs P2 (BH-28..30) | 1-2h |
| **Total inicial** | **~12h** |

Si quieres arrancar pequeño: **lo mínimo viable** es `setup base + BH-01 + BH-02`, eso valida que el stub funciona y cubre los 2 bugs visuales más severos (los del último commit `8ed8988`).
