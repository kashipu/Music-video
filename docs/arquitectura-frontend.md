# Directiva de arquitectura y operación frontend — Repitela.com

> **Índice:** [[README]] · **Autoridad sobre:** las capas y convenciones del frontend · **Últ. cambio:** 2026-08-27
> Si esta página contradice al código, gana el código y esta página tiene un bug.

Reglas para que el frontend crezca sin repetir los monolitos que ya tenemos
(`AdminDashboard.vue` 1.520 líneas / 32 `fetch()`, `Kiosk.vue` 1.344 / 11,
`VenueBillingPanel.vue` 1.197). Aplica a todo código nuevo y a todo archivo
que se toque. La deuda existente está en Linear (WIL-140, WIL-141, WIL-76,
WIL-82, WIL-176–180); esta directiva evita generar más.

Escrita para que la ejecuten **agentes** (ver `AGENTS.md` en la raíz): cada
regla es verificable con un grep o un número, no una aspiración.

## 1. Capas y articulación

| Capa | Carpeta | Responsabilidad | Prohibido |
|---|---|---|---|
| Vistas | `src/views/` | Orquestar una ruta: componer componentes, leer route params, disparar cargas | Lógica de negocio, `fetch()`, CSS extenso |
| Componentes de feature | `src/components/` | UI de un dominio (cola, billing, auth) con sus estados | `fetch()` nuevo, conocer rutas de otras features |
| Primitivos UI | `src/components/ui/` | Button, Input, Badge… sin negocio: props + slots + tokens del tema | Importar stores, hablar con la API, colores hardcodeados |
| Composables | `src/composables/` | Lógica reusable con estado local (`useTheme`, `useToast`) | Estado global compartido entre rutas (eso es un store) |
| Stores Pinia | `src/stores/` | Estado compartido por 2+ rutas o que sobrevive navegación | Estado que solo usa una vista |
| Servicios API | `src/services/` | **Único lugar con `fetch()`**: un módulo por dominio (`auth.js`, `queue.js`, `billing.js`…) con base URL, headers y errores en un solo sitio | Tocar el DOM, importar componentes |
| Utils | `src/utils/` | Funciones puras sin estado | — |
| Constantes | `src/constants/` | Datos estáticos compartidos (`themePresets.js`) | Lógica |

La dirección de dependencia es una sola: **vistas → componentes → primitivos**
y **vistas/componentes → stores → services**. Nada importa hacia arriba.

`src/services/` aún no existe: se crea con el primer código que lo necesite
(WIL-140 es la migración de lo viejo). Hasta entonces la regla es de frontera:
**ningún `fetch()` nuevo en vistas ni componentes.**

## 2. Qué es un componente — y qué no

Extraer un componente cuando se cumple **al menos una**:

- El mismo bloque de template/CSS aparece en **2+ archivos** (así nacieron
  `ThemeToggle`, `BackButton`, `FormError`).
- Es una sección con **estado y ciclo propios** dentro de una vista grande:
  carga sus datos, tiene sus estados vacío/error/cargando (así nació
  `NowPlaying`).
- Es un **primitivo de diseño** que debe verse igual en toda la app (Button,
  Input, Badge, Modal).

**No** es un componente:

- Un bloque usado una sola vez sin estado propio: extraerlo solo agrega un
  archivo y un salto de lectura. Se extrae cuando aparezca el segundo uso.
- Un "wrapper" que solo renombra props de otro componente sin aportar nada.
- Una función de lógica sin template: eso es un composable o un util.
- Media vista partida por tamaño sin frontera real: partir por dominio
  (header, sidebar, panel), no por número de líneas.

Regla de interfaz: los props bajan datos, los **eventos suben acciones**
(`emit`), los **slots** ceden el control del contenido. Un componente que
recibe una función callback por prop casi siempre debía emitir un evento.

## 3. Convenciones de nombres

| Cosa | Convención | Ejemplo |
|---|---|---|
| Componente `.vue` | PascalCase, 2+ palabras, prefijo de dominio | `VenueBillingPanel.vue`, `AdminHeader.vue` |
| Primitivo en `ui/` | PascalCase, nombre genérico sin dominio | `Button.vue`, `PasswordInput.vue` |
| Vista | PascalCase terminando en el sustantivo de la ruta | `AdminDashboard.vue`, `Kiosk.vue` |
| Composable | `use` + PascalCase, archivo camelCase | `useTheme.js` |
| Store | sustantivo singular camelCase | `auth.js`, `queue.js` |
| Servicio API | dominio camelCase en `services/` | `billing.js` |
| Story | junto al componente, mismo nombre | `Button.stories.js` |
| Test unitario | junto al archivo, `.spec.js` | `useTheme.spec.js` |
| Assets | kebab-case descriptivo | `logo-color-negativo.svg` |
| Rama git | `graficowm/wil-NNN-descripcion` (la genera Linear) | `graficowm/wil-185-directiva-...` |
| Commit | Conventional Commits en español, con WIL-NNN cuando aplique | `fix(storybook): …` |

Nada de carpetas por componente, ni `index.js` barrel, ni sufijos
`Component`/`View` redundantes.

## 4. Clean code — reglas duras

1. **Sin `fetch()` fuera de `src/services/` y los stores.** Un endpoint nuevo
   = una función en el servicio de su dominio. Los stores llaman servicios,
   los componentes llaman stores o servicios, las vistas componen.
2. **Techo de tamaño: 300 líneas por `.vue`.** Al superarlo en un archivo que
   estás tocando, extraé la sección que tocás. 500 líneas es bloqueo: no se
   agrega nada a ese archivo sin extraer primero.
3. **Estado local por defecto.** Store Pinia solo cuando 2+ rutas comparten el
   dato. Composable solo cuando 2+ componentes repiten la lógica.
4. **Tokens del tema, nunca colores literales** en componentes. Un hex solo
   puede vivir en `src/themes/*.css`. Ver [DESIGN_SYSTEM.md](sistema-de-diseno.md).
5. **Comentarios solo para lo que el código no puede decir** (por qué, no
   qué). Textos visibles en español **con tildes** — ya perdimos una tarde
   por tildes borradas.
6. **Extracción sin riesgo (patrón probado en WIL-178/179/180):** extraer el
   componente sin borrar el original → conectarlo detrás de la vista →
   verificar en Storybook y en la app → borrar el inline. Nunca los tres
   pasos en un mismo commit.
7. **Regla boy-scout acotada:** al tocar un monolito, extraé solo lo que tu
   cambio toca. No refactors drive-by del archivo entero.
8. Sin TypeScript: props con `defineProps` y JSDoc donde el tipo no sea obvio.

## 5. Política de librerías

- **Escalera antes de instalar:** ¿lo hace el navegador (CSS, `<dialog>`,
  `<input type>`)? ¿lo hace Vue/Pinia/vue-router que ya están? ¿son <30 líneas
  propias? Solo si todo eso falla se propone una dependencia.
- Instalar una librería requiere **OK explícito del usuario** en la issue de
  Linear, con alternativa descartada y costo (KB, mantenimiento) anotados.
- Prohibido de plano: axios (fetch + `services/` alcanza), librerías de UI
  (el design system es propio), lodash/moment (nativo alcanza).

## 6. Cómo documentar en Storybook

- Todo componente nuevo **nace con su `.stories.js` al lado**. Sin story no
  hay "listo".
- Una story por **estado significativo** (default, error, vacío, cargando,
  deshabilitado), no por combinación de props.
- Título = ruta de la carpeta: `Components/VenueLogo`, `UI/Button`,
  `Templates/PanelDelBar`.
- Componentes full-bleed (headers, layouts, templates) llevan
  `parameters: { layout: 'fullscreen' }` — sin eso Storybook mete un padding
  `.sb-main-padded` que falsea el diseño.
- El tema y el modo los maneja el toolbar global (decorator en
  `.storybook/preview.js`); las stories **no** setean `data-theme` a mano,
  salvo las que muestran los 12 temas a la vez (patrón de `TodosLosTemas`).
- Comentarios en la story para decisiones no obvias (p. ej. por qué
  "negativo" = fondo oscuro en las variantes del logo).
- **Compilar no es renderizar**: `build-storybook` verde no prueba nada.
  Verificación real = abrir la story y mirar la consola. Las 4 trampas
  conocidas (APIs que fallan en silencio) están en
  [DESIGN_SYSTEM.md](sistema-de-diseno.md) §6.

## 7. Cómo registrar el trabajo en Linear

- **Buscar antes de crear** (`list_issues` con palabras clave): los
  duplicados cuestan más que la búsqueda.
- Una issue = un resultado verificable. Formato: **Qué pasa / Dónde
  (archivo:línea) / Por qué importa / Criterio de aceptación.**
- El estado refleja la realidad: In Progress al empezar, In Review con la
  rama lista, Done **solo tras merge**. Un check fallido o QA pendiente
  mantiene la issue fuera de Done.
- La rama se crea con el `gitBranchName` que genera Linear (`wil-NNN-…`);
  los commits mencionan la issue cuando cierran algo.
- Los hallazgos de QA se comentan **en la issue**, mapeando hallazgo → fix →
  commit. Las decisiones viven en Linear o el PR, no solo en el chat.
- Trabajo grande se parte en sub-issues con `blockedBy` cuando el orden
  importa (patrón WIL-178→179→180).

## 8. Definición de "listo" para UI

- Story en Storybook renderizando **sin errores de consola**.
- Funciona en los 12 temas — la story `TodosLosTemas` los muestra agrupados.
- Verificado a ~375px si la ruta se usa en móvil (cliente y admin lo son).
- `npm test` y `npm run build` en verde (necesario, nunca suficiente).
- Issue de Linear actualizada con evidencia.

## 9. Qué NO hacemos (hoy)

- TypeScript, librerías de UI externas, axios: no. `fetch` nativo envuelto en
  `services/` alcanza.
- Micro-frontends, monorepo tooling, barrel files `index.js`: no hay escala
  que lo justifique.
- CI todavía no existe: la verificación es local y humana. No asumir que
  "algo lo atajará".
