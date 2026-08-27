# Directiva de arquitectura frontend — Repitela.com

Reglas para que el frontend crezca sin repetir los monolitos que ya tenemos
(`AdminDashboard.vue` 1.520 líneas / 32 `fetch()`, `Kiosk.vue` 1.344 / 11,
`VenueBillingPanel.vue` 1.197). Aplica a todo código nuevo y a todo archivo
que se toque. La deuda existente está en Linear (WIL-140, WIL-141, WIL-76,
WIL-82, WIL-176–180); esta directiva evita generar más.

## Capas y qué va en cada una

| Capa | Carpeta | Responsabilidad | Prohibido |
|---|---|---|---|
| Vistas | `src/views/` | Orquestar una ruta: componer componentes, leer route params, disparar cargas | Lógica de negocio, `fetch()`, CSS extenso |
| Componentes de feature | `src/components/` | UI de un dominio (cola, billing, auth) con sus estados | `fetch()` nuevo, conocer rutas de otras features |
| Primitivos UI | `src/components/ui/` | Button, Input, Badge… sin negocio: props + slots + tokens del tema | Importar stores, hablar con la API, colores hardcodeados |
| Composables | `src/composables/` | Lógica reusable con estado local (`useTheme`, `useToast`) | Estado global compartido entre rutas (eso es un store) |
| Stores Pinia | `src/stores/` | Estado compartido por 2+ rutas o que sobrevive navegación | Estado que solo usa una vista |
| Servicios API | `src/services/` | **Único lugar con `fetch()`**: un módulo por dominio (`auth.js`, `queue.js`, `billing.js`…) con base URL, headers y errores en un solo sitio | Tocar el DOM, importar componentes |
| Utils | `src/utils/` | Funciones puras sin estado | — |

`src/services/` aún no existe: se crea con el primer código que lo necesite
(WIL-140 es la migración de lo viejo). Hasta entonces la regla es de frontera:
**ningún `fetch()` nuevo en vistas ni componentes.**

## Reglas duras

1. **Sin `fetch()` fuera de `src/services/` y los stores.** Un endpoint nuevo
   = una función en el servicio de su dominio. Los stores llaman servicios,
   los componentes llaman stores o servicios, las vistas componen.
2. **Techo de tamaño: 300 líneas por `.vue`.** Al superarlo en un archivo que
   estás tocando, extraé la sección que tocás como componente. 500 líneas es
   bloqueo: no se agrega nada a ese archivo sin extraer primero.
3. **Estado local por defecto.** Un store Pinia solo cuando 2+ rutas comparten
   el dato. Un composable solo cuando 2+ componentes repiten la lógica.
4. **Todo componente nuevo nace con su story** (`.stories.js` al lado) y usa
   tokens del tema, nunca colores literales. Ver
   [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — incluye las trampas de Storybook
   que compilan en verde y fallan en runtime.
5. **Extracción sin riesgo (patrón probado en WIL-178/179/180):** extraer el
   componente sin borrar el original → conectarlo detrás de la vista →
   verificar en Storybook y en la app → borrar el inline. Nunca los tres
   pasos en un mismo commit.
6. **Regla boy-scout acotada:** al tocar un monolito, extraé solo lo que tu
   cambio toca. No refactors drive-by del archivo entero.

## Definición de "listo" para UI

- Story en Storybook renderizando sin errores de consola (compilar no es
  renderizar: `build-storybook` verde no prueba nada).
- Funciona en los 12 temas — la story `TodosLosTemas` los muestra agrupados.
- Verificado a ~375px si la ruta se usa en móvil (cliente y admin lo son).

## Qué NO hacemos (hoy)

- TypeScript, librerías de UI externas, axios: no. `fetch` nativo envuelto en
  `services/` alcanza.
- Micro-frontends, monorepo tooling, barrel files `index.js`: no hay escala
  que lo justifique.
