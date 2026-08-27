# Directiva para agentes — Repitela.com

Aplica a todo agente que toque este repo (Codex, Antigravity, Claude u otros).
El Arquitecto planifica, revisa y registra en Linear; los agentes ejecutan.

## Antes de escribir código

1. Leé `docs/FRONTEND_ARCHITECTURE.md` (capas, naming, clean code, Storybook)
   y `docs/DESIGN_SYSTEM.md` si tocás UI o temas. Backend: `docs/API.md` y
   `docs/BUSINESS_RULES.md`.
2. Trabajá **solo** en la rama que te asignaron (`graficowm/wil-NNN-…`).
   Nunca en `main`: push a main = deploy directo a producción.
3. El alcance es la issue de Linear que te citaron. Si descubrís trabajo
   fuera de ese alcance, reportalo — no lo hagas.

## Reglas de código (resumen; el detalle está en la directiva)

- `fetch()` solo en `src/services/` y stores. Cero fetch nuevo en vistas o
  componentes.
- Techo de 300 líneas por `.vue`; a 500 el archivo está bloqueado.
- Tokens del tema, nunca hex en componentes. Textos en español con tildes.
- Componente nuevo = `.stories.js` al lado, mismo nombre.
- Extracciones en 3 pasos/commits: extraer sin borrar → conectar → limpiar.
- Sin dependencias nuevas sin OK explícito del usuario en Linear.

## Verificación obligatoria antes de reportar

```bash
cd frontend && npm test && npm run build
```

Si tocaste stories o componentes con story: `npm run build-storybook` **y**
abrir la story en el navegador con la consola visible — compilar no es
renderizar; hay 4 trampas conocidas que fallan en silencio con el build en
verde (`docs/DESIGN_SYSTEM.md` §6).

## Cómo reportar

- Resumen **breve en el chat/terminal**: qué cambió (archivos), qué
  verificaste (comando + resultado), qué queda pendiente.
- **Nunca** generes archivos `.md` de reporte ni documentación no pedida.
- Un solo reporte final con resultado explícito: succeeded o failed.
- Nunca hagas push, PR ni merge: eso lo decide el usuario.
