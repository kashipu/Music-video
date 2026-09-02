# Auditoría de arquitectura — Índice y plan de ejecución

Auditoría realizada el 2026-09-02 sobre `claude/frontend-architecture-review-vn2ko9`.
Cubre las cuatro capas del sistema y la integración entre ellas. Este documento
es el índice y el plan: los hallazgos viven en los cinco documentos de abajo y
aquí solo se ordenan.

## Documentos

| Documento | Alcance | Hallazgos |
|---|---|---|
| [FRONTEND.md](FRONTEND.md) | `frontend/src/` (18.724 líneas) y su directiva | FE-1 … FE-7 |
| [BACKEND.md](BACKEND.md) | `backend/app/` (6.858 líneas), tests, stack | BE-1 … BE-8 |
| [DATABASE.md](DATABASE.md) | Esquema, 26 migraciones, uso desde el código | DB-1 … DB-8 |
| [SYSTEM.md](SYSTEM.md) | Topología, contratos, fronteras, operación | SYS-1 … SYS-7 |
| [INTEGRATION.md](INTEGRATION.md) | Comunicación entre capas, URLs, documentación de la API, estilo arquitectónico | INT-1 … INT-10 |

`BACKEND.md` cierra con la evaluación de stack (¿Python y FastAPI son lo
correcto?). `SYSTEM.md` cierra con los tres patrones que se repiten en las tres
capas. `INTEGRATION.md` cierra con la clasificación del estilo arquitectónico de
cada capa: ni MVC ni hexagonal, sino por capas técnicas.

---

## Cómo leer el orden

El plan se ordena por tres ejes distintos. No son sinónimos y a veces apuntan en
direcciones opuestas.

- **Prioridad (P0-P3):** cuánto daño evita o cuánto valor desbloquea. P0 es
  pérdida irreversible o bloqueo de todo lo demás.
- **Urgencia (U0-U3):** en qué ventana hay que hacerlo, con independencia de la
  prioridad. Algo puede ser P1 y U3 (importante pero puede esperar), o P2 y U0
  (menor pero se abarata muchísimo si se hace ya).
- **Dependencia:** qué fase debe estar terminada antes. Es el eje que manda: una
  fase P0 que depende de otra no puede adelantarse.

El orden de ejecución de la tabla resuelve los tres: respeta dependencias
primero, y dentro de lo que está desbloqueado ordena por prioridad y luego por
urgencia.

---

## Plan de ejecución

| # | Fase | Hallazgos | P | U | Depende de | Esfuerzo |
|---|---|---|---|---|---|---|
| F0 | Backups y restauración probada | SYS-1 | P0 | U0 | — | bajo |
| F1 | CI + rescate de la suite QA | BE-1, FE-5, SYS-2, SYS-3 | P0 | U0 | — | bajo |
| F2 | Cierre de fronteras y del espacio de nombres | SYS-5, BE-6, INT-7 | P0 | U0 | F1 | bajo |
| F3 | Transacciones, inyección de dependencias e integridad | BE-2, INT-10, DB-2, DB-3 | P0 | U1 | F1 | medio |
| F4 | Capa HTTP única en el frontend | FE-1, FE-2, FE-3, INT-2 | P1 | U1 | F1 | medio |
| F5 | Observabilidad, contrato tipado y versionado | BE-3, SYS-4, BE-7, INT-5, INT-9 | P1 | U2 | F1 | medio |
| F6 | Retención de PII y borrado | DB-5 | P1 | U2 | F0, F3 | medio |
| F7 | Superadmin: capa de servicios y estado operativo | BE-4, BE-5, INT-3, INT-6 | P2 | U2 | F3, F4, F5 | alto |
| F8 | Kiosco: modelo de fallo, composables y uso de eventos | SYS-6, FE-4, FE-6, FE-7, INT-1 | P2 | U3 | F4 | alto |
| F9 | Consolidación: staging, `paid_until` y limpieza de rutas | SYS-7, DB-7, INT-4, INT-8 | P2 | U3 | F1, F5 | medio |
| — | **Bloqueados por decisión de producto** | DB-1, DB-4, DB-6 | ver abajo | — | decisión | — |

Los hallazgos menores BE-8 y DB-8 (numeración de migraciones duplicada, columna
muerta, índice redundante, `docs/DATA_MODEL.md` desactualizado) no tienen fase
propia: se resuelven de paso en la fase que toque su archivo.

### Grafo de dependencias

```mermaid
graph TD
    F0[F0 · Backups] --> F6[F6 · PII y retención]
    F1[F1 · CI + suite QA] --> F2[F2 · Fronteras de confianza]
    F1 --> F3[F3 · Transacciones e integridad]
    F1 --> F4[F4 · Capa HTTP frontend]
    F1 --> F5[F5 · Observabilidad y contrato]
    F1 --> F9[F9 · Staging y paid_until]
    F3 --> F6
    F3 --> F7[F7 · Superadmin]
    F4 --> F7
    F5 --> F7
    F5 --> F9
    F4 --> F8[F8 · Kiosco y composables]
```

F0 y F1 no dependen de nada y se pueden hacer en paralelo. Todo lo demás cuelga
de F1.

---

## Detalle por fase

### F0 · Backups y restauración probada — P0 / U0

**Cubre:** [SYS-1](SYSTEM.md#sys-1--sin-backups-el-ledger-de-facturación-vive-en-un-archivo-sin-copia)

Tarea programada con `VACUUM INTO` (consistente con WAL), transferencia a
almacenamiento externo, política de retención y **una restauración probada**.
Actualizar `docs/DEPLOYMENT.md` §Backups quitando el bloque PENDIENTE.

Va primero porque todo lo demás asume que los datos existen, y porque es el
único riesgo del sistema que no se puede deshacer.

**Decisión requerida:** destino de la copia externa (S3, Backblaze, `rsync` a
otro servidor).

### F1 · CI + rescate de la suite QA — P0 / U0

**Cubre:** [BE-1](BACKEND.md#be-1--sin-ci-y-main-es-deploy-directo-a-producción),
[FE-5](FRONTEND.md#fe-5--la-pirámide-de-tests-está-invertida),
[SYS-2](SYSTEM.md#sys-2--el-proyecto-usa-documentación-donde-debería-usar-verificación),
[SYS-3](SYSTEM.md#sys-3--el-esfuerzo-de-testing-ya-existe-pero-está-fuera-del-circuito)

1. `backend/pyproject.toml` con `ruff`, `mypy` y `pytest` configurados.
2. Workflow de GitHub Actions: backend (pytest, ruff, mypy) y frontend
   (`npm test`, `npm run build`) en cada PR.
3. Portar `scripts/qa_bug_hunt.py` (601 líneas) a pytest con `ASGITransport`,
   siguiendo `backend/tests/test_wompi_webhook.py:15-17`.
4. Corregir la pirámide del frontend (FE-5): primeros tests de stores, services
   y guards del router, hoy sin cobertura. Los tests de composables llegan con
   F8, cuando estén partidos.

Es la fase de mayor palanca: convierte tres directivas escritas en reglas que
fallan el build, y multiplica la cobertura sin escribir tests nuevos.

### F2 · Cierre de fronteras y del espacio de nombres — P0 / U0

**Cubre:** [SYS-5](SYSTEM.md#sys-5--el-kiosco-no-tiene-frontera-de-confianza),
[BE-6](BACKEND.md#be-6--apisuperadminlogin-no-tiene-rate-limiting),
[INT-7](INTEGRATION.md#int-7--el-espacio-de-nombres-de-la-raíz-está-comprometido-y-no-hay-slugs-reservados)

Exigir token en `/api/playback/finished` y `/error` (el kiosco ya lo manda:
cambio de una línea por endpoint). Token de kiosco para `/fallback-playing`.
`Depends(limit_auth_attempts)` en `/api/superadmin/login` y evicción de claves
en `_attempts`. Lista de slugs reservados en `_slugify()` y en `create_venue`.

Esfuerzo bajo, severidad alta: es la mejor relación de todo el plan. INT-7 entra
aquí por urgencia, no por parentesco: el slug va impreso en los QR de las mesas,
así que **cada bar que se registra con un slug conflictivo encarece la
corrección**. La reforma estructural de las URLs de bar (prefijo o subdominio)
queda para F9.

**Decisión requerida:** ¿hay kioscos en producción con versión cacheada que
dependan de la vía anónima?

### F3 · Transacciones, inyección de dependencias e integridad — P0 / U1

**Cubre:** [BE-2](BACKEND.md#be-2--dbcommit-no-hace-nada-45-llamadas-dan-falsa-atomicidad),
[INT-10](INTEGRATION.md#int-10--cero-inyección-de-dependencias-dependsget_db-no-se-usa-nunca),
[DB-2](DATABASE.md#db-2--la-cola-no-tiene-garantía-de-orden),
[DB-3](DATABASE.md#db-3--el-borrado-de-venue-son-10-delete-sueltos-sin-transacción)

Helper `async with transaction(db)` con `BEGIN IMMEDIATE` / `COMMIT` /
`ROLLBACK`, aplicado a `complete_onboarding`, `add_song`, `reorder_song` y
`delete_venue`. Índice `UNIQUE(venue_id, position) WHERE status = 'pending'`.
`ON DELETE CASCADE` en las FKs hacia `venues` (reconstrucción de tablas, patrón
de `024`) y `delete_venue` reducido a un solo `DELETE`.

INT-10 va en la misma fase porque es el mismo cambio: el helper de transacciones
necesita que la conexión viaje explícita, así que es el momento natural para
pasar de `get_db()` global a `Depends(get_db)` y parámetro en los servicios. El
beneficio inmediato es de testing: elimina el `monkeypatch` por servicio que hoy
cada archivo de tests reinventa.

Depende de F1: sin tests que corran solos, tocar transacciones es riesgo puro.

### F4 · Capa HTTP única en el frontend — P1 / U1

**Cubre:** [FE-1](FRONTEND.md#fe-1--no-existe-una-capa-http-existen-cinco),
[FE-2](FRONTEND.md#fe-2--25-fetch-en-vistas-y-componentes),
[FE-3](FRONTEND.md#fe-3--el-token-de-superadmin-no-tiene-dueño),
[INT-2](INTEGRATION.md#int-2--cuatro-endpoints-tienen-dos-clientes-con-contratos-incompatibles)

`src/services/http.js` con base URL, timeout/abort, contrato de error único e
interceptor 401. Migrar los cinco `request()`. Crear `services/superadmin.js` y
`services/adminAccount.js` y mover los 25 `fetch()`. Token de superadmin al
store, borrar las 6 copias de `headers()`. Los cuatro endpoints con cliente
duplicado (INT-2) quedan con una sola definición.

**Decisión requerida:** contrato de error único — `{ok, data, error}` o
excepciones. Hoy conviven ambos y hay que elegir uno.

### F5 · Observabilidad, contrato tipado y versionado — P1 / U2

**Cubre:** [BE-3](BACKEND.md#be-3--50-except-exception-contra-8-líneas-de-logging),
[SYS-4](SYSTEM.md#sys-4--el-contrato-entre-los-tres-artefactos-solo-existe-en-prosa),
[BE-7](BACKEND.md#be-7--acceso-a-filas-por-índice-posicional),
[INT-5](INTEGRATION.md#int-5--la-api-no-tiene-versionado),
[INT-9](INTEGRATION.md#int-9--132-enlaces-rotos-en-la-documentación)

Middleware de excepciones con request-id y logging estructurado; revisión de los
~50 `except Exception`. `response_model` en los endpoints que consume el
frontend, empezando por dashboard y kiosco. Acceso a filas por nombre en los
`SELECT` anchos. Prefijo `/api/v1/` con `/api/` como alias durante la
convivencia. Reemplazo de los 132 enlaces `file:///Users/...` por rutas
relativas.

Las primeras atacan la misma raíz: hoy un cambio puede alterar la respuesta de
la API sin que nada falle ni quede registrado. El versionado entra aquí porque
es **habilitador**: INT-3, INT-4 e INT-6 son cambios incompatibles que sin él no
se pueden desplegar sin romper kioscos que llevan semanas sin recargar.

Con `response_model`, `docs/API.md` deja de ser el contrato —hoy lo es, y está
completo al 100 %— y pasa a ser la guía narrativa sobre un OpenAPI generado.

### F6 · Retención de PII y borrado — P1 / U2

**Cubre:** [DB-5](DATABASE.md#db-5--pii-sin-modelo-de-retención-ni-ruta-de-borrado)

Ruta de borrado de usuario (anonimizar `play_history` conservando el agregado,
borrar `users`) y política de retención explícita para usuarios inactivos.
Alineado con la política de privacidad ya publicada y con la Ley 1581 de 2012.

Depende de F0 (no se borra en masa sin copia) y de F3 (el borrado debe ser
atómico).

### F7 · Superadmin: capa de servicios y estado operativo — P2 / U2

**Cubre:** [BE-4](BACKEND.md#be-4--la-capa-de-servicios-existe-a-medias-126-sentencias-sql-en-routers),
[BE-5](BACKEND.md#be-5--venuesconfig-es-un-blob-json-usado-como-estado-mutable-compartido),
[INT-3](INTEGRATION.md#int-3--la-tenancy-se-expresa-de-tres-formas-distintas-en-la-misma-api),
[INT-6](INTEGRATION.md#int-6--apiadmin-mezcla-autenticación-pública-y-operación-autenticada)

`services/superadmin_service.py` y `services/venue_service.py`; mover las 126
sentencias SQL fuera de los routers. Migrar el estado operativo (`volume`,
`banner_text`, `show_qr`, `qr_size`, `show_brand`, `playback_status`) de
`config` JSON a columnas propias, eliminando las 6 copias del
read-modify-write.

Con la capa de servicios en su sitio se aprovecha para unificar la expresión de
tenancy (INT-3) y separar `/api/admin` en autenticación y operación (INT-6),
ambos sobre `/api/v1/` y dejando `/api/` como alias.

Se hace tarde a propósito: con CI, transacciones, capa HTTP, contrato tipado y
versionado detrás, es refactor rutinario en vez de cirugía.

### F8 · Kiosco: modelo de fallo, composables y uso de eventos — P2 / U3

**Cubre:** [SYS-6](SYSTEM.md#sys-6--falta-un-modelo-de-fallo-del-kiosco),
[FE-4](FRONTEND.md#fe-4--useadmindashboardjs-es-la-vista-disfrazada-de-composable),
[FE-6](FRONTEND.md#fe-6--kioskvue-tiene-la-dependencia-invertida),
[FE-7](FRONTEND.md#fe-7--estado-de-servidor-sin-disciplina-de-caché),
[INT-1](INTEGRATION.md#int-1--los-eventos-websocket-traen-los-datos-y-el-frontend-los-descarta)

Heartbeat del kiosco con TTL para que el backend detecte su ausencia y libere la
canción trabada. Invertir el acoplamiento de `useKioskPlayback` (emite
intenciones, la vista ejecuta). Partir `useAdminDashboard` en cuatro composables
con sus tests. Refetch con dedupe y cancelación, y aplicar el payload de los 7
eventos que hoy solo disparan refetch (INT-1); el polling queda como red de
seguridad cuando `wsConnected` es `false`.

### F9 · Consolidación: staging, `paid_until` y limpieza de rutas — P2 / U3

**Cubre:** [SYS-7](SYSTEM.md#sys-7--push-a-main-es-deploy-a-producción-sin-staging),
[DB-7](DATABASE.md#db-7--venuespaid_until-es-caché-derivada-del-ledger-mantenida-a-mano),
[INT-4](INTEGRATION.md#int-4--seis-post-mandan-el-estado-por-query-string-en-vez-de-body),
[INT-8](INTEGRATION.md#int-8--mezcla-de-idiomas-e-identificadores-en-las-rutas-del-frontend)

Entorno de pre-producción antes de `main`. `recompute_paid_until(venue_id)`
derivada del ledger, con test de invariante. Los seis POST con estado en query
string pasan a body con modelo Pydantic (INT-4), ya sobre `/api/v1/`.
Normalización de idioma e identificador en las rutas del frontend (INT-8), con
redirecciones desde las viejas; aquí cabe también la reforma estructural del
espacio de nombres de bar que F2 dejó pendiente (prefijo `/b/{slug}` o
subdominio).

---

## Bloqueados por decisión de producto

No están en la tabla de ejecución porque no dependen de otra fase sino de una
respuesta. Dos de ellos son P1: **la decisión es el trabajo pendiente, no el
código.**

| Hallazgo | P | Decisión requerida |
|---|---|---|
| [DB-1](DATABASE.md#db-1--blocked_videos-rompe-el-aislamiento-entre-bares) | P1 | ¿El bloqueo de un video es por bar o global? Hoy el código dice una cosa y el índice otra, y un bar bloquea para toda la plataforma. |
| [DB-4](DATABASE.md#db-4--no-existe-el-concepto-de-zona-horaria) | P1 | ¿Habrá bares fuera de Colombia en los próximos meses? Si no, basta con corregir el KPI "hoy" del panel superadmin y baja a P3. |
| [DB-6](DATABASE.md#db-6--los-metadatos-de-canción-viven-en-tres-tablas) | P2 | Cuando un video cambia de título en YouTube, ¿el historial debe mostrar el título de entonces o el actual? Eso decide si la duplicación es bug o decisión. |

---

## Resumen ejecutivo

Las tres capas están bien diseñadas y muy bien documentadas —la API tiene sus 86
endpoints documentados uno por uno, con cuerpo, respuesta, errores y eventos
WebSocket—. El problema no es el diseño: es que **nada obliga a cumplirlo**. La
misma causa produce las 25 violaciones de la directiva en el frontend, las 126
sentencias SQL en los routers del backend y la documentación de datos
desactualizada.

Sobre el estilo arquitectónico: ambas capas usan arquitectura por capas
técnicas, no MVC ni hexagonal, y la recomendación es **no migrar a hexagonal**
—sería sobreingeniería para este dominio— sino tomar de ella lo único que aquí
paga: invertir la dependencia de la base de datos (INT-10). El detalle está en
[INTEGRATION.md](INTEGRATION.md#estilo-arquitectónico-ni-mvc-ni-hexagonal).

Por eso el plan empieza por F0 y F1: la copia de seguridad que hoy no existe, y
el circuito de verificación que convierte 4.398 líneas de documentación en
reglas que fallan el build. Con esas dos fases hechas, el resto del plan pasa de
ser cirugía a ser mantenimiento.
