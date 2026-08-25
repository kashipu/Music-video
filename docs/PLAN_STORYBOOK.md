# Plan — Storybook para el sistema de diseño (WIL-158)

**Issue:** [WIL-158](https://linear.app/william-moreno/issue/WIL-158/montar-storybook-para-documentar-el-sistema-de-diseno-y-los) · Backlog · Low · hito 4 "Poder mover el código sin miedo"
**Relacionadas:** WIL-156 (temas normalizados — ya mergeada) · WIL-83 (primitivos nuevos — pendiente)
**Alcance:** solo `frontend/`. Aditivo: no se toca ni un archivo de `src/`.

## Reparto (sub-issues de WIL-158)

| Issue | Fases | Agente | Depende de |
|---|---|---|---|
| [WIL-167](https://linear.app/william-moreno/issue/WIL-167) — Storybook base: instalación, temas globales y scripts | 1, 2, 5 | **Codex** `gpt-5.6-terra` `[MEDIA]` | — |
| [WIL-168](https://linear.app/william-moreno/issue/WIL-168) — Stories de los primitivos de UI existentes | 3 | **Codex** `gpt-5.6-terra` `[MEDIA]` | WIL-167 |
| [WIL-169](https://linear.app/william-moreno/issue/WIL-169) — Foundations + auditoría de tokens en los 12 temas | 4 | **Antigravity** Gemini 3.7 Flash `[MEDIA]` | WIL-167 (solo la página; la auditoría arranca antes) |

La **auditoría** de WIL-169 se separó del resto porque no necesita Storybook levantado — se hace leyendo los 12 CSS — así que corre en paralelo con WIL-167 en vez de esperarla.

---

## 0. Estado real del repo (verificado)

| Cosa | Estado |
|---|---|
| Stack | Vue 3.5 + Vite 6, sin TypeScript |
| Primitivos en `src/components/ui/` | `Button.vue` (prop `variant`), `Input.vue` (`modelValue`), `Badge.vue` (`variant`), `ConfirmModal.vue` (sin props, se maneja por `useConfirmModal`) |
| Otros candidatos | `VenueLogo.vue`, `SongCard.vue`, `ToastContainer.vue` |
| Temas | 12 archivos en `src/themes/`, importados uno a uno en `main.js` |
| Cómo se aplica un tema | `data-theme="dark\|light"` + `data-venue-theme="<tokens>"` en `<html>` (ver `composables/useTheme.js`) |
| Catálogo de temas | `src/constants/themePresets.js` → `THEME_PRESETS` (id, name, tokens, mode) |
| Tokens fijos | `src/style.css` (`--radius*`, `--kiosk-*`, fuentes, reset) |
| Tests | Vitest (unit, excluye `tests-e2e/`) + Playwright e2e |
| CI | No hay `.github/workflows` — nada que romper, nada que aprovechar |

Consecuencia: WIL-156 ya está hecha, así que **la dependencia está desbloqueada**. WIL-83 no bloquea: se escriben stories de lo que existe hoy y se agregan las nuevas cuando aterricen.

---

## Fase 1 — Instalación (30 min) · WIL-167 · Codex

```bash
cd frontend
npx storybook@latest init --builder vite
```

Decisiones tomadas de antemano para no improvisar durante el init:

- **Versión: `@latest` (Storybook 9), no la 8** que menciona el issue. Storybook 9 soporta Vue 3 + Vite 6 nativamente y trae a11y, docs y controls en el core (menos addons que instalar y mantener). El issue se escribió antes; se actualiza al cerrarlo.
- **Quitar `@storybook/addon-vitest` si el init lo agrega.** El proyecto ya tiene Vitest configurado dentro de `vite.config.js` con `exclude: ['tests-e2e/**']` y un Playwright aparte; el addon mete su propio workspace de Vitest + navegador y es exactamente el tipo de complejidad que no necesitamos para un catálogo visual. Se puede sumar después si alguna vez queremos interaction tests.
- **No instalar addon de temas** (`@storybook/addon-themes`). El decorator son 6 líneas y ya tenemos `THEME_PRESETS`; un addon para eso es dependencia de más.
- `.storybook/` va commiteado; `storybook-static/` va al `.gitignore` raíz.

**Verificación:** `npm run storybook` levanta con el ejemplo por defecto.

---

## Fase 2 — Estilos globales y toolbar de temas (1 h) · WIL-167 · Codex

Todo vive en **`.storybook/preview.js`**, un solo archivo:

```js
import '../src/style.css'
// Los 12 temas de una: el orden alfabético de glob deja default.css primero,
// que es justo lo que main.js necesita (los temas por bar le ganan al default).
import.meta.glob('../src/themes/*.css', { eager: true })
import { THEME_PRESETS } from '../src/constants/themePresets.js'

export const globalTypes = {
  venueTheme: {
    description: 'Tema del bar',
    defaultValue: 'default',
    toolbar: {
      icon: 'paintbrush',
      items: [
        { value: 'default', title: 'Repítela (default)' },
        ...THEME_PRESETS.map((p) => ({ value: p.tokens, title: p.name })),
      ],
      dynamicTitle: true,
    },
  },
  mode: {
    description: 'Claro / oscuro',
    defaultValue: 'dark',
    toolbar: { icon: 'circlehollow', items: ['dark', 'light'], dynamicTitle: true },
  },
}

export const decorators = [
  (story, ctx) => {
    const el = document.documentElement
    el.setAttribute('data-theme', ctx.globals.mode)
    if (ctx.globals.venueTheme === 'default') el.removeAttribute('data-venue-theme')
    else el.setAttribute('data-venue-theme', ctx.globals.venueTheme)
    return { template: '<story />' }
  },
]

export const parameters = {
  backgrounds: { disable: true }, // el fondo lo pone el tema, no Storybook
}
```

Notas:

- Se lee `THEME_PRESETS` en vez de re-listar los 12 temas → si mañana se agrega uno, el toolbar lo hereda gratis.
- El decorator toca `document.documentElement` igual que `useTheme.js`, así que lo que se ve en Storybook es literalmente lo que se ve en la app.
- **No** se importa `useTheme()` (escribe `localStorage` y pelearía con el toolbar).
- Falta pintar el fondo del canvas: `.storybook/preview-head.html` con `<style>body{background:var(--color-background);color:var(--color-text)}</style>`.

**Verificación:** un `Button` cambia de color al mover el toolbar entre `default`, `purple-night` y `gold-light`.

---

## Fase 3 — Stories de los primitivos que ya existen (2 h) · WIL-168 · Codex

Convención: `src/components/ui/<Comp>.stories.js`, junto al componente (no una carpeta `stories/` paralela que se desincroniza).

| Story | Contenido |
|---|---|
| `Button.stories.js` | Un `argTypes.variant` como select + una story `AllVariants` que renderiza todas en fila. Las variantes reales salen de leer el `<style>` de `Button.vue` en el momento de escribirla — no inventarlas. |
| `Input.stories.js` | Default, con valor, disabled, con placeholder largo (overflow). |
| `Badge.stories.js` | Igual que Button: todas las variantes en una grilla. |
| `ConfirmModal.stories.js` | Caso especial: no tiene props. La story renderiza `<ConfirmModal />` + un botón que llama `confirm({...})` de `useConfirmModal`, así se documenta el uso real. |
| `VenueLogo.stories.js` | Con logo, sin logo (fallback), en claro y oscuro — es el componente que WIL-157 tocó por la inversión en login. |

Regla: **una story = un estado que alguien va a mirar**. Nada de generar la matriz completa de props.

**Verificación:** las 5 stories se ven bien en `dark/default` y en `light/gold-light`.

---

## Fase 4 — Página de foundations (1 h) · WIL-169 · Antigravity

`src/foundations.stories.js` — una sola story que renderiza tres grillas leyendo `var(--token)`:

- **Color:** `--color-background`, `--color-surface`, `--color-surface-elevated`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-primary-foreground`, `--color-secondary`, `--color-accent`, `--color-link`, estados (`success`/`warning`/`danger`).
- **Radios:** `--radius-sm`, `--radius`, `--radius-lg`.
- **Tipografía:** las escalas que use hoy `style.css`.

La lista de tokens es un array literal en el archivo (~20 nombres). Se descarta enumerar las custom properties en runtime: no es fiable entre navegadores y no vale una utilidad propia para una página de docs.

Valor real de esta página: se cambia el tema en el toolbar y se ven los 12 temas lado a lado sobre los mismos tokens — es el chequeo visual que hoy no existe.

**Verificación:** ningún swatch aparece transparente/negro en ninguno de los 12 temas (eso delataría un token faltante en algún tema).

---

## Fase 5 — Scripts y cierre (30 min) · WIL-167 · Codex

```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

- `storybook-static/` al `.gitignore`.
- Una línea en `docs/CONTRIBUTING.md`: cómo levantarlo y dónde van las stories.
- Actualizar WIL-158 (versión 9 en vez de 8, addon-vitest descartado) y cerrarla.

**Publicación: fuera de alcance.** Ni Chromatic ni un servicio extra en Dokploy — el server es de 2 vCPU compartido y esto es DX interna. Se agrega el día que alguien de fuera del repo necesite ver el catálogo.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El init de Storybook toca `vite.config.js` o `package.json` de más | Revisar el diff del init antes de commitear; el init es el único paso que escribe fuera de `.storybook/` |
| `@storybook/addon-vitest` rompe `npm test` | Se desinstala en Fase 1; correr `npm test` como check después del init |
| Las fuentes (`@font-face` con `url('./assets/...')`) no cargan en Storybook | Se resuelven porque `preview.js` importa `style.css` por ruta relativa y Vite reescribe las URLs; si falla, `staticDirs: ['../public']` en `main.js` |
| WIL-83 agrega primitivos y las stories quedan cortas | No es riesgo: WIL-83 incluye escribir la story de cada primitivo nuevo. Agregar esa línea a su aceptación. |

## Esfuerzo

~5 h en total. Fases 1-3 son el mínimo entregable si hay que cortar (Storybook levanta y los primitivos están documentados); 4 y 5 son el acabado.

Todo va sobre la rama `graficowm/wil-158-montar-storybook` y sale como **un solo PR** contra `main` — las tres sub-issues son reparto de trabajo entre agentes, no tres PRs. Nada se mergea a `main` sin verificación humana.

## Ampliación de la auditoría (WIL-169)

Además de la página, agy reporta por tema: tokens definidos en `default.css` que faltan en ese tema, nombres de token inconsistentes entre temas, y contrastes bajo AA 4.5:1 (`--color-text` y `--color-text-muted` sobre `--color-background`/`--color-surface`; `--color-primary-foreground` sobre `--color-primary`). Los hallazgos **no se arreglan ahí**: cada arreglo sale como issue aparte, para no mezclar una tarea de documentación con cambios de tema.
