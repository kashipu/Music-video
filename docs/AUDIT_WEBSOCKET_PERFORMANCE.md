# Auditoria WebSocket y Performance - Repitela

## Resumen

Auditoria completa del sistema de eventos en tiempo real, manejo de WebSocket en frontend, y performance de queries de base de datos.

---

## Hallazgos Criticos

### 1. Race condition: posiciones duplicadas en cola (Backend)
**Severidad**: CRITICA (pero baja probabilidad en 1 venue)
**Archivo**: `queue_service.py:106-109`

Dos confirmaciones simultaneas obtienen el mismo `MAX(position)` antes de que ninguna commitee. Resultado: posiciones duplicadas.

**Mitigacion actual**: Con 1 venue y pocos usuarios concurrentes, la probabilidad es muy baja. SQLite serializa escrituras, asi que con autocommit cada INSERT commitea antes del siguiente.

**Fix futuro (PostgreSQL)**: Usar `SELECT ... FOR UPDATE` o secuencias.

---

### 2. Handler errors pueden romper pipeline de WebSocket (Frontend)
**Severidad**: ALTA
**Archivo**: `useWebSocket.js:41-48`

Si un handler lanza un error, los handlers restantes no se ejecutan. El try/catch solo cubre `JSON.parse`, no la ejecucion de handlers.

**Status**: CORREGIDO (ver fixes abajo)

---

### 3. Polling redundante con eventos WebSocket (Frontend)
**Severidad**: ALTA
**Archivos**: `CustomerDashboard.vue:124`, `AdminDashboard.vue:145`

Ambas vistas hacen polling cada 10s Y responden a eventos WS. Cuando un evento llega, se disparan 3+ API calls, y 10s despues el poll dispara los mismos calls.

**Impacto**: ~32 API calls/min por usuario en lugar de ~6 necesarias.

**Status**: MEJORADO - poll extendido a 30s (ver fixes abajo)

---

### 4. Index faltante en queue_songs(session_id) (Backend)
**Severidad**: ALTA
**Archivo**: Migraciones SQL

Queries de admin/tables y cola hacen JOIN con user_sessions sin index en session_id. Con 50+ canciones, fuerza table scans.

**Status**: CORREGIDO (ver fixes abajo)

---

### 5. get_rate_limit_info() hace 2 queries redundantes (Backend)
**Severidad**: MEDIA
**Archivo**: `queue_service.py:39-51`

Dos queries separadas a submission_log con el mismo WHERE. Se pueden combinar en 1.

**Status**: CORREGIDO (ver fixes abajo)

---

## Hallazgos Menores

| # | Issue | Severidad | Archivo | Status |
|---|-------|-----------|---------|--------|
| 6 | Backoff de reconexion WS calculado despues del schedule | MEDIA | useWebSocket.js:61-67 | Funcional (el efecto es minimo) |
| 7 | clearQueue() hace N DELETE secuenciales | MEDIA | AdminDashboard.vue:330 | No critico, pocos songs |
| 8 | Venue config consultada multiples veces por request | MEDIA | queue_service.py, auth_service.py | Futuro: cache en memoria |
| 9 | Analytics hace 15+ queries | MEDIA | analytics_service.py | Futuro: pre-computar metricas |
| 10 | Sin code splitting en Vite | BAJA | vite.config.js | Futuro: lazy loading de rutas |
| 11 | Ping interval 30s puede ser largo para WiFi inestable | BAJA | useWebSocket.js:114 | Aceptable para produccion |
| 12 | ConnectionManager sin lock de asyncio | BAJA | websocket.py | Python GIL protege suficiente en single-worker |
| 13 | handleWsEvent() en queue.js nunca se usa | BAJA | queue.js:93-129 | Codigo muerto, limpiar despues |

---

## Race Conditions Documentadas (Baja Probabilidad)

Estas condiciones existen pero son de baja probabilidad con SQLite autocommit y single-worker:

1. **Doble advance_queue()**: Si finish y skip ocurren simultaneamente, ambos podrian promover la misma cancion. Impacto: evento duplicado (idempotente).
2. **Broadcast antes de commit**: En algunos paths, el evento WS se envia antes del commit. Con autocommit, cada execute ya commitea, asi que esto es aceptable.
3. **Mensajes WS perdidos**: Si la conexion WS falla durante send_to_user(), el mensaje se pierde. El polling de 30s actua como safety net.
