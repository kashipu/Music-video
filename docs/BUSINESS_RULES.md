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
| `playlist` | Reproduce canciones de una **playlist por defecto** configurada por el admin |
| `youtube_recommendations` | Deja correr las **recomendaciones automáticas** de YouTube basadas en el historial |

- El modo se configura en `venues.fallback_mode`
- La playlist por defecto se almacena en `venues.fallback_playlist` (array JSON de youtube_ids)
- Cuando un usuario encola una nueva canción, la reproducción de fallback se interrumpe y la cola toma prioridad

### BR-13: Avance automático

- Cuando una canción termina, el kiosco notifica al backend (`POST /api/playback/finished`)
- El backend marca la canción como `played` y avanza a la siguiente
- Se emite un broadcast WebSocket a todos los clientes conectados

---

## Usuarios y Datos

### BR-14: Asociación usuario-mesa

- Cada sesión registra el **número de mesa** del usuario
- Esto permite:
  - Trazabilidad de quién pidió qué desde dónde
  - Analytics por ubicación dentro del bar
  - Potencial integración futura con sistema de mesas/meseros

### BR-15: Data Mining y Analytics

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

### BR-16: Generación de QR por mesa

- Cada mesa del bar tiene un código QR único
- Formato de la URL: `https://{domain}/{venue_slug}?mesa={table_number}`
- Los QR son generados por el admin desde el panel de administración
- El número de mesa se pre-llena automáticamente en el formulario de registro
