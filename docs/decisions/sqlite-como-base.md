# SQLite como base de datos

**Estado:** vigente · **Fecha real de la decisión:** desconocida, presente desde
`001_initial_schema.sql` · **Registrada el:** 2026-09-02

## Qué se decidió

Toda la persistencia en un archivo SQLite (`/data/barqueue.db`), accedido con
`aiosqlite`, en un volumen Docker nombrado.

## Por qué, de verdad

No hay evidencia de que se comparara con nada. Estaba desde el primer commit y
nunca se cuestionó. La razón honesta es **arranque rápido y despliegue de un solo
contenedor**, y hasta hoy ha sido suficiente: 8 bares, ~3.200 reproducciones.

## Qué obliga

- **Un solo worker.** SQLite en WAL tolera lectores concurrentes, pero el diseño
  actual asume un proceso. Eso convierte al worker en el techo de escala del
  sistema entero: el mismo hilo sirve la API, el broadcast de WebSocket y los logos.
- **Sin segundo servidor.** El archivo vive en un volumen de una máquina.
- **Backups por copia de archivo**, no por dump transaccional. Ver
  [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md) §Backups.
- **Techo práctico de ~500 MB**, con alerta por correo al 400 MB
  (`DB_SIZE_ALERT_THRESHOLD_BYTES`).

## Consecuencia no obvia

`blocked_videos` bloquea un video **para toda la plataforma**, no por bar: el
código dice una cosa y el índice otra. Es un bug de aislamiento entre inquilinos
que sigue abierto esperando decisión de producto (DB-1).

Tampoco existe el concepto de zona horaria: todo asume Colombia (DB-4).

## Costo de salida

**Alto.** Migrar a Postgres toca las **139 sentencias SQL escritas a mano**
repartidas por routers y servicios — no hay ORM que abstraiga el dialecto. Ver
[[sql-a-mano-sin-orm]].

Se paga cuando: la base pase de ~500 MB, o haga falta un segundo servidor, o el
worker único deje de dar abasto. Ninguna de las tres ha pasado.
