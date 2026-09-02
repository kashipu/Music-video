# Revisión de arquitectura — Sistema

Revisado el 2026-09-02 sobre `claude/frontend-architecture-review-vn2ko9`.
Alcance: topología de despliegue, contratos entre artefactos, fronteras de
confianza, operación y documentación. Lo transversal que no cubren
`FRONTEND.md`, `BACKEND.md` ni `DATABASE.md`.

Conclusión corta: la arquitectura está **bien diseñada y, sobre todo, bien
razonada**. Las debilidades que quedan no son de diseño: son de *enforcement*.

---

## Fortalezas

- ADRs reales, con decisiones cerradas y justificadas
  (`docs/ARCHITECTURE.md` §5). ADR-002 descarta `yt-dlp` por ToS de YouTube y
  deja constancia de que no está en `requirements.txt`.
- **Techo de escala medido, no estimado** (`docs/CAPACITY.md`):
  `scripts/load_test.py` replica el comportamiento real del frontend (1500 WS +
  154 req/s) contra la imagen de producción limitada a 2 vCPU / 1 GB. El cuello
  real —`worker_connections` de nginx, 1024 → 8192— se encontró, se arregló y se
  volvió a medir. p95 de 22 ms, 0 errores.
- Ruta de escalado horizontal escrita y correcta, con la instrucción explícita
  de **no subir `-w`** (`docs/ARCHITECTURE.md` §4.1).
- Riesgo de backups documentado como PENDIENTE abierto, no escondido
  (`docs/DEPLOYMENT.md` §Backups).
- Separación landing (Astro estático) / app (SPA Vue) / API bien trazada: quien
  entra a la landing no descarga el bundle de la app.
- Contrato de eventos WebSocket documentado en tabla numerada
  (`docs/API.md`).
- Cacheo de nginx razonado por tipo de recurso, con el motivo escrito
  (`frontend/nginx.conf`).

---

## Hallazgos

### SYS-1 · Sin backups: el ledger de facturación vive en un archivo sin copia

**Severidad original:** crítica · **Estado: RESUELTO PARCIALMENTE (2026-09-02)** —
copia diaria del volumen a Cloudflare R2, verificada. Falta la restauración de
prueba. Detalle y limitaciones en [OPS-1](DEPLOY.md#ops-1--backups-a-r2--resuelto-parcialmente-2026-09-02).

`docs/DEPLOYMENT.md` lo dice con todas las letras: no hay tarea en Compose ni en
`scripts/`, ni Litestream, ni `sqlite3 .backup`, ni `VACUUM INTO`, y el volumen
`sqlite_data` (`docker-compose.yml:66-68`) "no constituye una copia
recuperable".

Está bien que esté documentado —es un riesgo registrado, no un descuido— pero
sigue siendo el riesgo existencial del proyecto: si se pierde el volumen se
pierden los bares, los usuarios y **la prueba de quién pagó**. Todo lo demás en
estas cuatro revisiones es recuperable; esto no.

**Lo hecho:** schedule diario con `Connection.backup()` + `integrity_check` (ya
existía) y Volume Backup a R2 con retención de 14 (2026-09-02).

**Lo que falta para cerrarlo:** la **restauración probada**. Y queda un RPO de
24 horas: un fallo de madrugada pierde la noche de mayor facturación.

### SYS-2 · El proyecto usa documentación donde debería usar verificación

**Severidad:** crítica · **Esfuerzo:** bajo · **Causa raíz**

Es el hallazgo de fondo, y explica los tres reviews anteriores.

| | Cantidad |
|---|---|
| Líneas de documentación (`docs/*.md`) | 4.398 |
| Tests de backend | 22 |
| Tests de frontend (todos de presentación) | 106 |

Cuando una regla vive en un `.md` y no en un linter, un test o un `CHECK`, se
rompe en silencio. Comprobado tres veces:

- 25 `fetch()` prohibidos por `docs/FRONTEND_ARCHITECTURE.md` §4.1 (ver FE-2).
- 126 sentencias SQL en routers, que la misma directiva prohíbe (ver BE-4).
- `docs/DATA_MODEL.md` desactualizado en tres migraciones (ver DB-8).

La documentación es excelente, y **por eso mismo es engañosa**: da la sensación
de arquitectura aplicada cuando lo que hay es arquitectura descrita.

### SYS-3 · El esfuerzo de testing ya existe, pero está fuera del circuito

**Severidad:** alta · **Esfuerzo:** medio · **Mayor palanca del sistema**

| Archivo | Líneas |
|---|---|
| `scripts/qa_bug_hunt.py` | 601 |
| `scripts/verify_p0_bugs.py` | 391 |
| `scripts/load_test.py` | 148 |
| `scripts/repro_bug_skip_queue.py` | 117 |
| **Total** | **1.257** |

Contra 22 tests en `backend/tests/`. Los tests **están escritos**. Se ejecutan a
mano, contra un `localhost` vivo, y nunca en CI.

No hay que escribir la suite: hay que enchufarla. Portar `qa_bug_hunt.py` a
pytest con `ASGITransport` —el patrón que ya usan en
`backend/tests/test_wompi_webhook.py:15-17`— multiplica la cobertura sin
inventar nada.

### SYS-4 · El contrato entre los tres artefactos solo existe en prosa

**Severidad:** alta · **Esfuerzo:** medio

**Cero `response_model`** en los 9 routers. Los requests se validan con Pydantic;
las respuestas son diccionarios armados a mano. El OpenAPI que FastAPI genera
está vacío del lado de las respuestas: la principal ventaja del framework está
sin usar.

El único contrato son 318 líneas de `docs/API.md` mantenidas a mano. Sumado a
BE-7 (acceso posicional a filas), reordenar un `SELECT` cambia el JSON de la API
**sin que nada falle en ningún lado**.

Tres artefactos que se despliegan por separado y no tienen interfaz verificable
entre ellos.

### SYS-5 · El kiosco no tiene frontera de confianza

**Severidad:** alta · **Esfuerzo:** bajo

Tres endpoints aceptan peticiones anónimas resolviendo el bar por slug:

| Endpoint | Archivo | Auth |
|---|---|---|
| `POST /api/playback/fallback-playing` | `app/routers/playback.py:23` | Ninguna |
| `POST /api/playback/finished` | `app/routers/playback.py:47` | Opcional |
| `POST /api/playback/error` | `app/routers/playback.py:102` | Opcional |

El slug es **público**: está en la URL del QR que cuelga en cada mesa. Cualquiera
puede saltar la canción de cualquier bar en bucle, o emitir un
`now_playing_changed` con un título arbitrario que se muestra en el televisor del
local.

Verificado el otro lado: el kiosco **ya envía** el token de admin en `/finished`
y `/error` (`frontend/src/services/kiosk.js:40-51`), así que la vía anónima es un
"backward compat" que hoy nadie usa. Se cierra sin romper nada.
`fallback-playing` sí necesita un cambio pequeño en el frontend.

**Decisión pendiente:** ¿hay algún kiosco viejo en producción con una versión
cacheada que todavía dependa de la vía anónima?

### SYS-6 · Falta un modelo de fallo del kiosco

**Severidad:** media · **Esfuerzo:** medio

El navegador del bar es el reproductor real y el backend no puede verificar su
estado. Hay tres fuentes de verdad para un mismo hecho:

1. `_fallback_now_playing` en memoria del proceso
   (`app/services/playback_service.py:9`).
2. `queue_songs.status = 'playing'` en la base.
3. El reproductor de YouTube en el navegador del kiosco.

Si el kiosco se cierra, se queda sin batería o pierde la red, la base sigue
diciendo `playing` **indefinidamente**: no hay heartbeat, ni TTL, ni detección de
ausencia. La cola queda bloqueada y el admin no tiene señal de por qué.

La reconexión del lado cliente está muy bien resuelta (`visibilitychange`,
backoff, refetch en `useWebSocket.js`); lo que falta es que el servidor note que
el kiosco ya no está.

### SYS-7 · Push a `main` es deploy a producción, sin staging

**Severidad:** media · **Esfuerzo:** medio

`docs/DEPLOYMENT.md` §Operación, paso 3: Dokploy construye los tres servicios y
redespliega producción. Con las migraciones auto-ejecutándose al arrancar
(`app/database.py:31`) y sin backups (SYS-1), una migración mala en `main` toca
producción sin red.

Las migraciones son atómicas por archivo —eso protege el archivo—, pero no
protegen el deploy.

---

## Lo que se repite en las tres capas

Tres hallazgos aparecieron idénticos en frontend, backend y base de datos. No
son tres problemas: son uno, tres veces.

| Patrón | Frontend | Backend | Base de datos |
|---|---|---|---|
| **Superadmin es la zona sin arquitectura** | FE-2, FE-3 (25 `fetch()`, token sin dueño) | BE-4 (995 líneas, 58 SQL, sin servicio) | DB-3 (`delete_venue`: 10 `DELETE` sueltos) |
| **No hay transacciones** | — | BE-2 (`commit()` no-op) | DB-2, DB-3 (cola y borrado) |
| **Sin CI, las directivas escritas se degradan solas** | FE-2 (25 violaciones) | BE-1, BE-4 (126 SQL en routers) | DB-8 (doc desactualizada) |
