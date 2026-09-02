# Revisión de arquitectura — Backend

Revisado el 2026-09-02 sobre `claude/frontend-architecture-review-vn2ko9`.
Alcance: `backend/app/` (6.858 líneas), `backend/tests/`, `backend/Dockerfile`.

Conclusión corta: el backend está **mejor diseñado que el frontend** y con
decisiones deliberadas y justificadas. Las debilidades son de disciplina
(transacciones, observabilidad, verificación), no de diseño.

---

## Fortalezas

- Migraciones SQL versionadas, atómicas por archivo y con detección de drift por
  SHA-256 (`app/database.py:41-105`).
- PRAGMAs correctos: WAL, `foreign_keys=ON`, `busy_timeout=15000`,
  `synchronous=NORMAL` (`app/database.py:26-30`).
- Fail-fast si `APP_SECRET_KEY` es el valor por defecto en producción, con el
  vector de ataque documentado (`app/config.py:41-53`).
- CORS razonado: `allow_credentials` se apaga con wildcard, con el motivo
  escrito (`app/main.py:114-125`).
- `-w 1` justificado con medición real de pérdida de eventos
  (`backend/Dockerfile:11-19`).
- Locks asyncio por venue con el bug que previenen documentado
  (`app/services/playback_service.py:11-16`).
- Ledger de facturación event-sourced con idempotencia y transacciones reales
  (`app/services/billing_service.py`).

---

## Hallazgos

### BE-1 · Sin CI, y `main` es deploy directo a producción

**Severidad:** crítica · **Esfuerzo:** bajo

No existe `.github/`. 22 tests en todo el backend, y ninguno cubre el flujo
central: agregar canción → cola → reproducir → terminar → siguiente. Los que hay
son regresiones puntuales (Wompi, aislamiento por venue, tamaño de DB,
constraints de esquema).

`ruff` y `mypy` están en `requirements-dev.txt` y **nunca se ejecutan**: no hay
`pyproject.toml`, `mypy.ini`, `ruff.toml` ni `pytest.ini`. Herramientas
declaradas, disciplina ausente.

Esto multiplica el riesgo de todo lo demás en esta lista. Ver también SYS-3:
hay 1.257 líneas de pruebas de API en `scripts/` que nunca corren en CI.

### BE-2 · `db.commit()` no hace nada: ~45 llamadas dan falsa atomicidad

**Severidad:** crítica · **Esfuerzo:** medio

La conexión se abre con `isolation_level=None` (`app/database.py:24`), es decir
autocommit: cada statement se confirma solo y `commit()` es un no-op.
Verificado empíricamente:

```
otra conexión ve la fila antes de commit(): (1,)
in_transaction: False
```

Consecuencias medidas:

- `complete_onboarding` (`app/routers/admin.py:40`) hace dos `UPDATE` que **no
  son atómicos**: si el segundo falla, el admin queda marcado como onboarded con
  el venue sin datos.
- `queue_service.add_song` inserta en `queue_songs` y en `submission_log` por
  separado: si el segundo falla, la canción entra sin consumir cupo del rate
  limit.
- `delete_venue` son 10 `DELETE` sueltos (ver DB-3).

Solo `billing_service` (4 × `BEGIN IMMEDIATE`, líneas 34, 97, 137, 214) y
`admin_signup_service` (`BEGIN`, línea 60) lo hacen bien. La lección se aprendió
en billing y no se propagó.

**Propuesta:** helper `async with transaction(db)` que emita
`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`, aplicado a toda operación
multi-statement, con test de rollback.

### BE-3 · ~50 `except Exception` contra 8 líneas de logging

**Severidad:** alta · **Esfuerzo:** medio

`cleanup_old_data` tiene dos `except: pass` completos (`app/main.py:36-47`). No
hay middleware de excepciones, ni request-id, ni logs estructurados: el único
`add_middleware` del proyecto es CORS (`app/main.py:118`).

Cuando algo falle en un bar un viernes a las 11 pm, no hay forma de saber qué
pasó. Es la debilidad más cara en operación real y la más barata de arreglar.

**Propuesta:** middleware de excepciones con request-id y logging estructurado;
revisar los ~50 `except Exception`: los que traguen error de negocio pasan a
loguear, los que oculten bugs a propagar.

### BE-4 · La capa de servicios existe a medias: 126 sentencias SQL en routers

**Severidad:** alta · **Esfuerzo:** alto

Contra 133 en `services/`. Distribución:

| Router | Líneas | Sentencias SQL |
|---|---|---|
| `superadmin.py` | 995 | 58 |
| `admin.py` | 899 | 36 |
| `queue.py` | 338 | 7 |
| `auth.py` | 177 | 6 |
| `playback.py` | 221 | 5 |

`superadmin.py` es un dominio entero sin capa de servicio. Es el mismo hallazgo
que FE-2, en el mismo dominio: superadmin es la zona sin arquitectura del
sistema, en ambos lados.

### BE-5 · `venues.config` es un blob JSON usado como estado mutable compartido

**Severidad:** alta · **Esfuerzo:** medio

Seis copias del patrón leer-JSON → mutar-dict → reescribir-columna, sin
transacción y con `except: pass` en el parseo: `app/routers/admin.py` líneas
644, 671, 707, 897; `app/routers/superadmin.py:379`;
`app/services/playback_service.py:451`.

El frontend debouncea el volumen a 150 ms; si el admin mueve el slider y activa
el banner casi a la vez, hay puntos de `await` entre el `SELECT` y el `UPDATE`:
la segunda escritura pisa el campo de la primera sin error visible.

Volumen, banner, `show_qr`, `qr_size`, `show_brand` y `playback_status` son
estado operativo, no configuración: merecen columnas propias.

### BE-6 · `/api/superadmin/login` no tiene rate limiting

**Severidad:** alta · **Esfuerzo:** bajo

Los siete endpoints de `admin_auth.py` usan `Depends(limit_auth_attempts)`
(líneas 103, 128, 150, 159, 165, 174). El login de superadmin
(`app/routers/superadmin.py:149`) —el de mayor privilegio, el que da acceso a
todos los bares— no lo usa.

Además `_attempts` (`app/routers/admin_auth.py:15`) es un `defaultdict` que
nunca evicta claves: una IP vista una vez queda en memoria para siempre.

### BE-7 · Acceso a filas por índice posicional

**Severidad:** media · **Esfuerzo:** medio

`app/database.py:25` configura `_db.row_factory = aiosqlite.Row`, pero el código
lee `r[0]`, `r[1]`… hasta `r[17]` (`app/routers/superadmin.py:261-277`).

Agregar una columna al medio de un `SELECT` desplaza todo y corrompe el JSON de
respuesta **sin lanzar ninguna excepción**. Combinado con SYS-4 (sin
`response_model`), no hay nada que lo detecte.

### BE-8 · Menor

- Colisión de números de migración: dos `022_`, dos `024_`. El orden es
  determinista por `sorted()`, pero anula la intención de la numeración.
- `import json` dentro del cuerpo de funciones en seis endpoints.
- 3 `except:` desnudos (`app/main.py` ×3 según conteo por archivo).

---

## Verificado y descartado

- **N+1 en `list_venues`:** no lo es. `compute_payment_status` recibe
  `grace_period_days` precalculado precisamente para evitar la consulta por fila
  (`app/routers/superadmin.py:258`). Bien resuelto.

---

## Elección de stack: ¿Python y FastAPI son lo correcto?

Sí, y el cuello de botella no es el lenguaje. La evidencia está en el propio
código: los tres límites duros del sistema —un solo worker porque el
`ConnectionManager` vive en memoria, una única conexión SQLite compartida, y
cero observabilidad— **no los resuelve ningún cambio de lenguaje**. Migrar a Go
o Rust dejaría los tres intactos y agregaría meses de reescritura.

Oportunidades reales, en orden de valor:

**Redis pub/sub para el broadcast.** El mayor salto disponible, y ya está
identificado como el paso correcto en `backend/Dockerfile:15-16` y en
`docs/arquitectura.md` §4.1. Quita el techo de un worker sin tocar el lenguaje,
y de paso da un lugar para el rate limit compartido y `_attempts` (BE-6).

**Postgres cuando aparezca el disparador.** Es una decisión de datos, no de
lenguaje, y pesa más que cualquier framework. SQLite con un proceso es correcto
a escala de bar, y ya existe la alerta de 400 MB. Disparador: superar ~15-20
bares activos concurrentes, o que salte la alerta de tamaño. Aporta
`LISTEN/NOTIFY`, transacciones sin la trampa de BE-2 y escritura concurrente.

**Elixir/Phoenix es el único stack que daría un salto cualitativo en este
dominio**: PubSub distribuido, Presence y un proceso supervisado por bar
resuelven de fábrica lo que aquí está hecho a mano con locks asyncio y un dict
en memoria. Pero eso rinde a partir de decenas de miles de sockets simultáneos.
A escala de bares, un worker asyncio va sobrado (ver `docs/capacidad.md`: 1500 WS
con p95 de 22 ms y el worker al 5-20 % de un core). El costo de reescritura no
se justifica hoy.

**Descartados:** Go (mejor throughput y memoria, pero se pierde Pydantic —que
aquí hace trabajo real— sin atacar ningún problema existente). Node/TypeScript
(el único argumento sería compartir tipos con el frontend, y el frontend no usa
TypeScript: ganancia cero). Rust (no, para este problema).

**Lo que sí vale dentro de Python:** activar `ruff` + `mypy` en CI (BE-1), usar
`Row` por nombre en vez de índices (BE-7), un `Depends` de transacción (BE-2), y
logging estructurado con request-id (BE-3).

Resumen: no cambiar de lenguaje. Cambiar de disciplina, agregar Redis, y dejar
escrito el disparador de Postgres.
