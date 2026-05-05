# Reglas de Negocio - BarQueue

Este documento es la fuente de verdad para todas las reglas de dominio de la aplicación. Cada regla tiene un identificador único para trazabilidad.

---

## Registro y Autenticación

### BR-01: Registro de usuario vía QR

El usuario accede al sistema escaneando un código QR ubicado en su mesa. El QR contiene la URL del venue y el número de mesa pre-cargado.

- **Datos requeridos:** número de celular, número de mesa (pre-llenado del QR)
- **Consentimiento obligatorio:** el usuario debe aceptar el uso de sus datos antes de continuar
- **Sin consentimiento, no hay acceso** al sistema

### BR-02: Sesión de usuario

- La sesión del cliente se genera al completar el registro
- Se materializa como un JWT con expiración de **24 horas**
- Un usuario puede tener una sola sesión activa por venue a la vez
- El token incluye: `user_id`, `phone`, `venue_id`, `table_number`, `exp`

### BR-03: Autenticación de administrador

- Los administradores usan **username y password** (separado del flujo de cliente)
- Contraseñas almacenadas con **bcrypt**
- Sesiones de admin expiran después de **8 horas**
- Un admin está asociado a uno o más venues

---

## Cola de Canciones

### BR-04: Orden FIFO

Las canciones se reproducen estrictamente en **orden de llegada** (First In, First Out).

- Cada canción recibe un `position` = `MAX(position) + 1` al ser confirmada
- El admin puede alterar el orden manualmente (ver BR-09)

### BR-05: Rate limiting por usuario

Un usuario puede encolar un **máximo de 5 canciones en cualquier ventana de 30 minutos** (rolling window).

- Se cuenta por registros en `submission_log` donde `submitted_at > NOW() - 30 minutos`
- El conteo es **por venue** (si el usuario está en otro bar, es independiente)
- El frontend muestra cuántas canciones restantes tiene el usuario
- Si se alcanza el límite, se retorna error con el tiempo restante hasta poder encolar de nuevo

### BR-06: Validación de URL de YouTube

Solo se aceptan URLs de YouTube válidas:

- Formatos aceptados:
  - `https://www.youtube.com/watch?v=VIDEO_ID`
  - `https://youtu.be/VIDEO_ID`
  - `https://youtube.com/watch?v=VIDEO_ID`
  - `https://m.youtube.com/watch?v=VIDEO_ID`
- Se extrae el `VIDEO_ID` (11 caracteres alfanuméricos + guiones)
- Se verifica contra **YouTube Data API v3** que:
  - El video existe
  - Es embebible (`embeddable: true`)
  - No es privado
- Si la validación falla, se informa al usuario con un mensaje descriptivo

### BR-07: Flujo de confirmación en dos pasos

1. **Paso 1 - Preview:** el usuario envía la URL, el servidor retorna metadata (título, thumbnail, duración)
2. **Paso 2 - Confirmación:** el usuario revisa el preview y confirma explícitamente

Esto previene encolar canciones equivocadas por error de copy-paste.

### BR-08: Deduplicación en cola activa

El mismo `youtube_id` **no puede aparecer más de una vez** en la cola activa (status = `pending` o `playing`).

- Si alguien intenta encolar un video que ya está en cola, se retorna error: "Esta canción ya está en la cola"
- Una canción que ya fue reproducida (`played`) sí puede volver a encolarse

### BR-09: Límite de duración (configurable)

- Duración máxima configurable por venue (default: **10 minutos**)
- Si el video excede el límite, se rechaza con mensaje: "La canción supera el límite de X minutos"
- El admin puede modificar este límite desde la configuración del venue

---

## Administración

### BR-10: Control total del administrador

El administrador tiene control absoluto sobre la cola sin restricciones:

| Acción | Descripción |
|--------|-------------|
| **Saltar (skip)** | Avanza a la siguiente canción inmediatamente |
| **Remover** | Elimina una canción de la cola (status → `removed`) |
| **Reordenar** | Cambia la posición de una canción en la cola (drag & drop) |
| **Pausar/Reanudar** | Controla la reproducción en el kiosco |
| **Agregar canciones** | El admin puede encolar canciones propias sin rate limit |

### BR-11: Visibilidad del administrador

El admin tiene acceso a:
- Cola actual con detalle completo (usuario, mesa, hora de envío)
- Historial de todas las canciones pedidas
- Estadísticas y analytics (ver BR-15)

---

## Reproducción

### BR-12: Comportamiento con cola vacía

Cuando no hay canciones pendientes en la cola, el sistema actúa según la configuración del venue:

| Modo | Comportamiento |
|------|----------------|
| `playlist` | Reproduce canciones de una **playlist de respaldo** configurada por el admin |
| `youtube_recommendations` | Deja correr las **recomendaciones automáticas** de YouTube basadas en el historial |

- El modo se configura en `venues.fallback_mode`
- La playlist de respaldo se almacena en la tabla `fallback_songs` (importada desde una playlist de YouTube)

### BR-12a: Selección aleatoria en playlist de respaldo

La playlist de respaldo reproduce canciones en **orden aleatorio**, no secuencial:

- Al iniciar el ciclo de respaldo (o al reiniciarlo después de reproducir todas las canciones), se elige una canción **al azar** entre las no reproducidas
- Se mantiene un registro de canciones ya reproducidas en el ciclo actual para evitar repeticiones inmediatas
- Cuando todas las canciones del ciclo fueron reproducidas, el registro se reinicia y se vuelve a seleccionar aleatoriamente

### BR-12b: Transición de respaldo a cola de usuario

Cuando un usuario encola una canción **mientras suena la lista de respaldo**:

- **Flujo normal (fin natural):** el kiosco espera a que termine la canción de respaldo actual. Al terminar, cambia automáticamente a la canción del usuario.
- **Excepción — admin salta la canción:** si el admin presiona "siguiente" mientras suena el respaldo, el sistema verifica la cola:
  1. Si hay canción de usuario pendiente (ya notificada vía WebSocket) → cambia inmediatamente a esa canción
  2. Si hay canciones en cola según el backend → cambia inmediatamente a la primera en cola
  3. Si la cola está vacía → reproduce una canción aleatoria del respaldo

Esta regla garantiza que la música no se interrumpa bruscamente para los clientes en el bar, pero le da al admin control total para adelantar el turno cuando lo considere oportuno.

### BR-13: Avance automático

- Cuando una canción termina, el kiosco notifica al backend (`POST /api/playback/finished`)
- El backend marca la canción como `played` y avanza a la siguiente
- Se emite un broadcast WebSocket a todos los clientes conectados

### BR-13a: Contrato de respuesta de skip / finished / error (CRÍTICO)

Los tres endpoints que mutan `queue_songs.status` deben honrar este contrato sin excepción:

| Estado al entrar | Respuesta esperada (`next_song` / `now_playing`) |
|------------------|--------------------------------------------------|
| Cola con N pendientes (N ≥ 1) | la 1ra canción pendiente, ahora promovida a `playing` |
| Cola vacía + fallback configurado | `null` con `fallback_active: true` |
| Cola vacía sin fallback | `null` con `fallback_active: true`, `fallback_songs: []` |

**Invariante:** si la BD efectivamente promovió una canción a `playing`, la respuesta HTTP **debe** reflejarlo. Una respuesta `null` cuando la BD tiene una canción `playing` rompe la coherencia y hace que el Kiosk active la playlist de respaldo indebidamente (regresión histórica documentada en BH-31).

**Operaciones atómicas:** los tres endpoints adquieren `_playback_lock` para serializar `marcar played` + `advance` + `commit`, garantizando que doble click o `kiosk-finished` simultáneo a `admin-skip` no:
- Promuevan dos canciones a `playing` simultáneamente
- Pierdan canciones (marcadas `played` sin avanzar)
- Liberen rate-limit slots dos veces

**Idempotencia:** los `UPDATE` usan `WHERE status='playing'` (o `'pending'`) condicional. Un segundo skip que llega después de que otro coroutine ya avanzó es un no-op silencioso, no un error.

### BR-13b: Skip durante fallback con cola pendiente (BR-12b reforzado)

Cuando admin hace skip mientras suena la playlist de respaldo y hay canciones de usuarios pendientes, **el sistema debe**:

1. Promover la 1ra canción pendiente a `playing` en BD (atómico, `_playback_lock`)
2. Limpiar la caché `_fallback_now_playing`
3. Emitir `now_playing_changed` con la nueva canción de usuario (no `is_fallback`)
4. Emitir `fallback_skip` para que el Kiosk corte el video del fallback inmediatamente
5. Emitir `your_song_playing` al dueño de la canción promovida

El Kiosk recibe ambos eventos en orden y hace `loadVideoById(canción_usuario)` sin esperar a que termine el video del fallback. **Ninguna canción de la cola se pierde** — si `now_playing_changed` llega primero pero el `fallback_skip` falla, el Kiosk seguirá esperando al fin natural del fallback y arrancará la canción al terminar (mecanismo `pendingUserSong`).

---

## Notificaciones

### BR-14: Notificación "Tu canción está sonando"

Cuando la canción de un usuario comienza a reproducirse, se le envía una **notificación en tiempo real**.

- Se envía vía WebSocket un evento **dirigido al usuario** (no broadcast general): `your_song_playing`
- El frontend muestra una notificación prominente (toast/modal) con:
  - Título de la canción
  - Mensaje: "Tu canción está sonando ahora"
- Si el usuario tiene la app en segundo plano:
  - Se usa la **Notification API** del navegador (requiere permiso previo)
  - Al hacer click en la notificación, se abre/enfoca la app
- El permiso de notificaciones se solicita al registrarse (después del primer envío de canción)

### BR-15: Historial reciente del usuario (anti-repetición)

El sistema muestra al usuario las canciones que ya pidió en las **últimas 2 horas** para evitar repeticiones.

- Se consulta `submission_log` + `queue_songs` del usuario en el venue actual, donde `added_at > NOW() - 2 horas`
- Se muestra en el dashboard como sección **"Ya pediste"** con las canciones recientes
- Si el usuario intenta encolar una canción que ya pidió en las últimas 2 horas:
  - Se muestra advertencia: "Ya pediste esta canción hace X minutos. ¿Seguro que quieres repetirla?"
  - El usuario puede confirmar (no se bloquea, solo se advierte)
- La ventana de 2 horas es **configurable por venue** en `venues.config` (`repeat_warning_hours`)
- Esto es independiente de la regla de deduplicación BR-08 (que bloquea duplicados en cola activa)

---

## Usuarios y Datos

### BR-16: Asociación usuario-mesa

- Cada sesión registra el **número de mesa** del usuario
- Esto permite:
  - Trazabilidad de quién pidió qué desde dónde
  - Analytics por ubicación dentro del bar
  - Potencial integración futura con sistema de mesas/meseros

### BR-17: Data Mining y Analytics

El sistema recopila datos para análisis (con consentimiento del usuario):

| Métrica | Descripción |
|---------|-------------|
| **Canciones populares** | Ranking por venue, día, semana, mes |
| **Horas pico** | Momentos de mayor actividad de pedidos |
| **Co-ocurrencia** | Qué canciones se piden juntas en la misma sesión |
| **Preferencias por mesa** | Patrones de gusto por ubicación |
| **Artistas/géneros trending** | Tendencias basadas en metadata de YouTube |
| **Recomendaciones** | "A quienes les gustó X también pidieron Y" |

- Los datos se almacenan en `play_history` y `song_metadata`
- Solo se recopilan de usuarios que dieron consentimiento (`data_consent = true`)

---

## Códigos QR

### BR-18: Generación de QR por mesa

- Cada mesa del bar tiene un código QR único
- Formato de la URL: `https://{domain}/{venue_slug}?mesa={table_number}`
- Los QR son generados por el admin desde el panel de administración
- El número de mesa se pre-llena automáticamente en el formulario de registro

---

## Awareness y Feedback (qué debe saber cada actor)

### BR-19: Estado unificado del reproductor visible al admin

El admin ve **un solo badge** que resume el estado del sistema, en orden de prioridad:

1. `SIN CONEXIÓN` — WebSocket caído (los datos pueden ser viejos)
2. `PAUSADO` — `playback_status='paused'` en venue config
3. `SONANDO USUARIO` — hay canción de usuario en `playing`
4. `SONANDO PLAYLIST` — fallback activo, canción cacheada en memoria
5. `PLAYLIST PAUSADA` — fallback configurado pero `fallback_status_changed.paused=true`
6. `LISTA PARA EMPEZAR` — cola con pendientes pero nada en `playing` (admin debe iniciar)
7. `SIN COLA — ESPERANDO PLAYLIST` — fallback configurado, esperando primera canción
8. `SIN REPRODUCCIÓN` — sin cola, sin fallback (estado vacío)

**Razón:** antes había 3 pills semi-redundantes (`EN VIVO/PAUSADO`, `PLAYLIST SONANDO`, contadores) que daban estados ambiguos. El badge único garantiza que el admin nunca duda qué está ocurriendo.

### BR-20: Notificación al usuario cuando su canción avanza en la cola

Cuando una canción del usuario cambia de posición en la cola (por avance natural de FIFO o por skip del admin), el cliente recibe feedback proactivo:

| Transición | Notificación | Tipo | Duración |
|------------|--------------|------|----------|
| Posición #N → #1 (queda como siguiente) | `🎵 Tu canción es la siguiente: "X"` | success | 6s |
| Posición #N → #M con M < N (no #1) | `Subiste a #M: "X"` | info | 3.5s |
| Empieza a sonar la canción del usuario | `🎵 X` + browser notification | success | 7s |
| Slot liberado (canción terminó/falló) | `Slot liberado — puedes pedir otra` | info | 4s |

- La notificación de "eres el siguiente" se emite **una sola vez** por canción (set `notifiedNextUp`).
- No se notifica cuando la canción **baja** de posición (ej. admin reordena hacia abajo) — feedback negativo no aporta y puede confundir.
- Las notificaciones son toasts visuales del cliente, no eventos WS dedicados; se infieren del polling/refresh de `mySongs`.

### BR-21: Feedback al admin en cada acción

Toda acción del admin que muta estado (skip, pause, kick, reset, agregar, eliminar, reordenar, banner, QR, volumen) **debe**:

1. Mostrar **loading state** en el botón mientras la petición está pendiente
2. Mostrar **toast verde de éxito** con mensaje específico al recibir 2xx
3. Mostrar **toast rojo de error** con el `detail` del backend al recibir 4xx/5xx, o `"error de red"` si la petición falla
4. **Revertir UI optimista** (estado local cambiado antes de la petición) cuando la respuesta falla
5. Acciones destructivas (`kick`, `clear queue`) **deben pedir confirmación** explícita antes de ejecutar

**Razón:** un admin que clica "Siguiente" y no recibe feedback no sabe si su acción tuvo efecto, si la red falló, o si el backend devolvió error. La regla anterior (loading + revert silencioso) escondía fallas.

### BR-22: Awareness de conexión WebSocket

Cada vista (admin, customer, kiosk) **debe** indicar visualmente cuando el WebSocket está desconectado, porque los datos en pantalla pueden estar desactualizados:

| Vista | Indicador | Comportamiento |
|-------|-----------|----------------|
| Admin | Pill "Conectado/Reconectando…" en barra de stats + toast en transiciones | Visible siempre |
| Customer | Banner rojo sticky "Sin conexión — reintentando…" | Solo aparece tras 2s desconectado (evita flicker) |
| Kiosk | Sin indicador visible (pantalla pública) | Polling de 10s recupera estado al reconectar |

- Reconexión usa backoff exponencial (1s → 1.5x → max 15s)
- Al reconectar, **toda vista re-fetcha estado completo** (`onReconnect` handler) porque los eventos perdidos durante el corte no se reenvían
- `visibilitychange`: al volver de background (iOS Safari mata WS) se fuerza reconexión + ping
