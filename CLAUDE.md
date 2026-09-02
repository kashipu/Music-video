# Repítela

Rocola colaborativa para bares: el cliente escanea el QR de su mesa, pide
canciones de YouTube desde el móvil, y una pantalla en el local las reproduce en
cola. El bar paga suscripción mensual.

## Estándar

Reglas globales: `~/.agents/AGENTS.md` (Claude, Codex y Antigravity leen el mismo archivo).
Estándar de especificación y arquitectura: `~/.agents/skills/spec-driven/`.
Modos de trabajo: `~/.agents/skills/spec-driven/MODES.md` (`/project <frase>` en Claude).
Ejecución (Linear → rama → PR → deploy): `~/.agents/skills/project-workflow-orchestration/`.

Aquí solo va lo propio de este proyecto. Nunca repitas lo que ya dicen esos archivos.

Aplica Ponytail: la solución más pequeña que funcione.

## Antes de escribir código

1. Lee `docs/features.md` — ¿ya existe algo parecido? Mejóralo antes de crear.
2. Lee `RULES.md` — cómo se escribe código aquí.
3. Feature nueva → `specs/<slug>.md` aprobada antes de la primera línea.
4. **Nunca trabajes en `main`: push a `main` es deploy directo a producción.**

## Mapa

Este repo **no** usa `src/features/`. Son tres artefactos con capas técnicas:

| Dónde | Qué |
|---|---|
| `frontend/src/` | Vue 3 SPA. `views/` → `components/` → `composables/` → `services/` → `stores/` |
| `backend/app/` | FastAPI. `routers/` → `services/` → `db/`. Migraciones en `db/migrations/` |
| `landing/` | Astro. Sitio público, independiente del resto |
| `docs/` | 19 documentos. `API.md` es el catálogo de los 86 endpoints |
| `docs/reviews/` | Auditoría de arquitectura 2026-09: 50 hallazgos en 12 fases. **Empieza por `INDEX.md`** |
| `docs/decisions/` | Decisiones vigentes y su costo de salida |
| `specs/` | Una por feature nueva |

## Comandos

```bash
cd frontend && npm install && npm run dev      # SPA en :5173
cd frontend && npm test && npm run build       # verificación obligatoria
cd frontend && npm run storybook               # :6006

docker compose up --build                      # stack completo
```

Los tests de backend corren **en Docker**, no con el Python local (3.9 en la
máquina vs 3.11 del proyecto), y siempre con `timeout`: una conexión aiosqlite
sin cerrar cuelga a pytest con todo en verde.

## No tocar

- **Migraciones ya aplicadas.** El runner guarda su SHA-256 y tumba el arranque
  si cambian (`Migration drift detected`). Una migración nueva, nunca editar una vieja.
- `frontend/src/assets/` — logos de marca. Se consumen vía `RepitelaLogo.vue`.
- Secretos: solo por entorno. `.env` está en `.gitignore` y así se queda.

## Cómo reportar (Codex, Antigravity, Claude)

- Resumen **breve en el chat o terminal**: qué cambió (archivos), qué verificaste
  (comando + resultado), qué queda pendiente.
- **Nunca** generes archivos `.md` de reporte ni documentación no pedida.
- Un solo reporte final, con resultado explícito: succeeded o failed.
- Nunca hagas push, PR ni merge: eso lo decide el usuario.
- El alcance es la issue de Linear que te citaron. Si encuentras trabajo fuera de
  ese alcance, repórtalo — no lo hagas.

## Contexto operativo

Un solo servidor de 2 vCPU / 1 GB en Dokploy, compartido con otros proyectos.
La base es **SQLite en un volumen Docker**, con copia diaria a Cloudflare R2.
El build corre en esa misma máquina mientras atiende a los bares: no lances
deploys en horario nocturno.

`st.repitela.com` es staging (rama `staging`, sin auto-deploy).
