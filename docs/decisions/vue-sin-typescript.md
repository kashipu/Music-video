# Vue 3 sin TypeScript

**Estado:** vigente · **Registrada el:** 2026-09-02

## Qué se decidió

Frontend en Vue 3 con `<script setup>`, Pinia y vue-router, sobre Vite. En
JavaScript plano: no hay `tsconfig.json` ni `.ts` en `frontend/src/`.

## Por qué, de verdad

No consta una decisión explícita. El proyecto arrancó así y creció así.

## Qué obliga

- **El contrato con el backend solo existe en prosa.** `docs/API.md` documenta
  los 86 endpoints uno por uno, pero nada verifica que la respuesta real
  coincida. Un cambio en el backend puede romper el frontend sin que falle un
  build ni quede registrado (SYS-4).
- Los errores de forma aparecen en runtime, en el navegador del bar.

## Costo de salida

**Medio y gradual.** Vue soporta JS y TS conviviendo, así que se puede adoptar
archivo por archivo. Lo que de verdad cierra la brecha no es TypeScript sino
`response_model` de Pydantic en el backend + OpenAPI generado (F5): con eso el
contrato deja de ser prosa aunque el frontend siga en JS.

**Recomendación:** hacer F5 antes de plantearse TypeScript. Resuelve el 80 % del
problema real por mucho menos.
