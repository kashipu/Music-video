# Reglas — Repítela

Solo lo propio de este proyecto. Lo general está en la skill `spec-driven`.
Regla ausente aquí = vale el default de la skill.

El detalle largo del frontend vive en [`docs/arquitectura-frontend.md`](docs/arquitectura-frontend.md)
(capas, naming, Storybook) y [`docs/sistema-de-diseno.md`](docs/sistema-de-diseno.md)
(temas y logo). Este archivo es el resumen vinculante; no lo dupliques.

## Stack

| | |
|---|---|
| Frontend | Vue 3 (Options-less `<script setup>`) + Pinia + vue-router, Vite. **Sin TypeScript** |
| CSS | `<style scoped>` por componente + tokens en `:root`. Sin utility-first, sin BEM |
| Backend | FastAPI + Pydantic v2, async |
| Base de datos | SQLite vía aiosqlite. **SQL a mano, sin ORM** |
| Validación | Pydantic en el borde HTTP |

## Frontend

- `fetch()` **solo** en `src/services/` y stores. Cero `fetch` nuevo en vistas o componentes.
- Techo de **300 líneas** por `.vue`; a **500** el archivo está bloqueado.
- Componente nuevo = `.stories.js` al lado, mismo nombre. Y test unitario.
- Tokens del tema, nunca hex literal en componentes.
- Toda vista con datos maneja cargando / error / vacío.
- Extracciones en **3 pasos, 3 commits**: extraer sin borrar → conectar → limpiar.

## Backend

- Router parsea y responde. Servicio tiene las reglas. `db/` toca la base.
- Validar todo lo que entra, en el borde. Adentro se confía.
- Una migración nueva por cambio de esquema. Nunca editar una aplicada.

## Siempre

- **Español con tildes** en textos de UI, nombres de rutas y mensajes. Los
  identificadores de código en inglés.
- Un bug arreglado deja una prueba que falla sin el arreglo.
- Secretos por entorno. Nunca en el repo.
- Sin dependencias nuevas sin OK explícito en Linear.
- Verificación antes de reportar: `cd frontend && npm test && npm run build`.
  Si tocaste stories, además `npm run build-storybook` **y abrir la story en el
  navegador con la consola visible** — compilar no es renderizar.

## Excepciones vigentes

Dónde el código se aparta de lo anterior. No son permisos: son deuda con dueño.

| Regla | Realidad hoy | Dónde se cierra |
|---|---|---|
| `fetch` solo en `services/` | **37 llamadas en 20 archivos** fuera de `services/` | F4 de [`docs/reviews/INDEX.md`](docs/reviews/INDEX.md) |
| Techo de 300 líneas | 7 `.vue` lo superan; `SuperAdminUsers.vue` (716) y `Kiosk.vue` (702) pasan el bloqueo de 500 | F8 |
| Router no escribe SQL | **139 `execute()`** repartidos entre routers y servicios | F7 |
| Contrato de error único | Conviven `{ok, data, error}` y excepciones | F4 — **decisión pendiente** |

La regla vale para **código nuevo**. Lo viejo se alinea al pasar, cuando toques
el archivo por otra razón — nunca en un PR de "alinear todo".
