# Revisión de arquitectura — Base de datos

Revisado el 2026-09-02 sobre `claude/frontend-architecture-review-vn2ko9`.
Alcance: `backend/app/db/migrations/` (26 archivos, 425 líneas), esquema
resultante y su uso desde `services/` y `routers/`.

Conclusión corta: es **la capa mejor diseñada de las tres**. Las debilidades son
de modelo, no de rendimiento, y varias tocan la tenancy.

---

## Fortalezas

- Migraciones versionadas, atómicas por archivo y con detección de drift por
  SHA-256 (`app/database.py:41-105`).
- Índice único parcial que hace cumplir "sin duplicados en cola" **a nivel de
  motor**, no solo en Python
  (`001_initial_schema.sql:51`: `idx_queue_active_video`).
- Ledger de facturación event-sourced con idempotencia real
  (`021_venue_billing_history.sql`: `UNIQUE(source, provider_ref)` parcial) y un
  `CHECK` que ata `source = 'manual'` a `created_by_id IS NOT NULL`.
- `024_json_and_paid_until_checks.sql`: reconstruye tablas para agregar `CHECK`s
  preservando los datos legacy inválidos dentro de un JSON marcado en vez de
  perderlos, con `-- migrate: foreign_keys=off` como directiva declarativa.
- Índices bien elegidos y con propósito claro (22 en total).
- `docs/DATA_MODEL.md` es honesto: dice explícitamente que las FKs no declaran
  cascada.

---

## Hallazgos

### DB-1 · `blocked_videos` rompe el aislamiento entre bares

**Severidad:** alta · **Esfuerzo:** medio · **Requiere decisión de producto**

La tabla tiene `venue_id` (`010_blocked_videos.sql:6`) pero el índice es global:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_youtube ON blocked_videos(youtube_id);
```

Cuando un video falla en un bar queda bloqueado **para toda la plataforma**, y
el segundo bar que intente bloquearlo choca contra el índice. La columna
`venue_id` es decorativa. Es una contradicción dentro de una sola tabla, en el
único lugar donde el aislamiento multi-tenant se rompe por diseño.

**Decisión pendiente:** ¿el bloqueo debe ser por bar o global? El código dice
una cosa y el índice otra.

### DB-2 · La cola no tiene garantía de orden

**Severidad:** alta · **Esfuerzo:** medio

`queue_songs.position INTEGER NOT NULL` (`001_initial_schema.sql:43`), sin
`UNIQUE(venue_id, position)` ni siquiera parcial.

`reorder_song` (`app/services/playback_service.py:466-494`) hace tres `UPDATE`
—desplazar el bloque, luego fijar la canción— y, por BE-2, no hay transacción.
Si el proceso muere en el medio quedan dos canciones en la misma posición y
nada en el motor lo impide.

Además `position = 0` se usa como convención para la canción sonando
(`playback_service.py:357`) sin que el esquema lo declare.

El objeto central del producto es el único sin invariante de integridad.

**Propuesta:** `UNIQUE(venue_id, position) WHERE status = 'pending'` más
transacción en `reorder_song` y `add_song`.

### DB-3 · El borrado de venue son 10 `DELETE` sueltos, sin transacción

**Severidad:** alta · **Esfuerzo:** medio

`app/routers/superadmin.py:386-403`. La operación más destructiva del sistema no
es atómica: si falla en el medio queda un bar a medio borrar con admins,
sesiones y analytics huérfanos, sin forma de reintentar limpio.

Peor: convive con dos mecanismos. Solo 2 de ~14 FKs declaran `ON DELETE CASCADE`
(`021_venue_billing_history.sql:3`, `023_billing_adjustment.sql:7`), y por eso
esas tablas no aparecen en la lista manual. Cualquier tabla hija nueva que
alguien olvide sumar a esa lista deja el borrado roto con un 500 permanente.

**Propuesta:** `ON DELETE CASCADE` en las FKs hacia `venues` (reconstrucción de
tablas, patrón ya probado en `024`) y reducir el endpoint a un solo
`DELETE FROM venues` dentro de transacción.

### DB-4 · No existe el concepto de zona horaria

**Severidad:** media · **Esfuerzo:** alto · **Requiere decisión de producto**

No hay `venues.timezone` en ninguna parte, y `date.today()`
(`app/services/auth_service.py:222,250`) corre con la hora del contenedor:
`python:3.11-slim` sin `TZ`, es decir UTC. El PIN diario y el vencimiento de
`paid_until` rotan a las 19:00 hora Colombia.

Siendo preciso: con UTC-5 eso **hoy no parte la noche** (de las 19:00 del viernes
a las 08:00 UTC del sábado es un solo día UTC), así que funciona por casualidad
del offset. Pero:

- El KPI "hoy" del panel superadmin usa `datetime('now', 'start of day')`
  (`app/routers/superadmin.py:227`) y cuenta desde las 19:00 locales: toda la
  tarde aparece como ayer.
- Un bar en España o México partiría la noche a la mitad.

Es una decisión que nunca se tomó, no una que se tomó bien.

**Decisión pendiente:** ¿habrá bares fuera de Colombia en los próximos meses? Si
no, basta con corregir el KPI y esto baja de prioridad.

### DB-5 · PII sin modelo de retención ni ruta de borrado

**Severidad:** alta · **Esfuerzo:** medio · **Consecuencia legal**

`users.phone` es texto plano, `UNIQUE` **global** —el mismo registro de persona
se comparte entre bares, cruzando el límite de tenancy
(`001_initial_schema.sql:14`)— y se conserva indefinidamente.

`cleanup_old_data` (`app/main.py:25-47`) borra cola y `submission_log` a 7 días
y `analytics_events` a 180, pero nunca toca `users` ni `play_history`, que lleva
`user_id` y por tanto es historial nominal permanente.

Hay `data_consent` registrado y política de privacidad publicada en el frontend,
pero `grep "DELETE FROM users"` no devuelve **nada**: no existe forma de honrar
una revocación. La Ley 1581 de 2012 (Habeas Data) da derecho de supresión.

Es la única debilidad de esta lista con consecuencia legal.

### DB-6 · Los metadatos de canción viven en tres tablas

**Severidad:** media · **Esfuerzo:** alto · **Requiere decisión de producto**

`song_metadata` es la canónica (PK `youtube_id`), pero `queue_songs` copia
`title`, `thumbnail_url` y `duration_sec`, y `play_history` copia además
`artist` y `genre`.

Divergen en la práctica: existe `app/db/update_titles.py` precisamente para
reparar títulos rotos, y no repara las tres. Analytics saca "top artists" de
`song_metadata` (`analytics_service.py:137`) y "top songs" de `play_history`:
dos fuentes que pueden contradecirse en el mismo dashboard.

**Decisión pendiente:** cuando un video cambia de título en YouTube, ¿el
historial del bar debe mostrar el título de entonces o el actual? Eso decide si
la duplicación es un bug o una decisión.

### DB-7 · `venues.paid_until` es caché derivada del ledger, mantenida a mano

**Severidad:** media · **Esfuerzo:** medio

El ledger de `021` es lo mejor del esquema, pero `paid_until` se actualiza en
cuatro rutas distintas de `billing_service` y no existe función que lo recompute
desde los eventos ni test de invariante.

La lógica de `void_event` (`billing_service.py:134-194`) es cuidadosa —revierte
a `period_start`, desactiva si cae fuera de gracia, con WIL-119 citado— pero es
corrección puntual, no derivación garantizada. Si se desincroniza, no hay cómo
detectarlo.

**Propuesta:** `recompute_paid_until(venue_id)` derivada del ledger, más test de
invariante.

### DB-8 · Menor

- `queue_songs` guarda `user_id` y `venue_id` además de `session_id`; la sesión
  ya determina ambos y nada impide que diverjan.
- `venues.fallback_playlist` es columna muerta desde que `003` creó la tabla
  `fallback_songs`.
- `idx_users_phone` (`001_initial_schema.sql:20`) duplica el índice implícito
  que ya crea `phone TEXT UNIQUE`.
- `docs/DATA_MODEL.md` está desactualizado: lista hasta `023` y le faltan tres
  archivos, incluidos los de numeración duplicada.
