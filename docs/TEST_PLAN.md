# Plan de Pruebas - Repitela Music Queue

## Flujos Criticos por Rol

### Usuario (Customer)

| # | Escenario | Pasos | Resultado Esperado | Estado |
|---|-----------|-------|--------------------|--------|
| U1 | Registro basico | 1. Ir a /:venue/registro 2. Ingresar telefono 3. Aceptar datos 4. Enviar | Redirige a /usuario, token emitido, sesion creada | |
| U2 | Registro con PIN | 1. Venue con PIN activo 2. Registrarse sin PIN | Error "Codigo PIN requerido" | |
| U3 | Registro con PIN correcto | 1. Ingresar PIN del dia 2. Registrarse | Registro exitoso | |
| U4 | Registro con PIN incorrecto | 1. Ingresar PIN erroneo | Error 403 "Codigo PIN incorrecto" | |
| U5 | Buscar cancion | 1. Escribir 2+ caracteres en buscador | Resultados de YouTube, videos bloqueados NO aparecen | |
| U6 | Seleccionar cancion | 1. Tocar resultado de busqueda | Modal de preview con titulo, thumbnail, duracion | |
| U7 | Confirmar cancion | 1. Tocar "Confirmar" en preview | Cancion en cola, posicion mostrada, slots restantes decrementan | |
| U8 | Cancion auto-reproduce | 1. Confirmar cancion en cola vacia | Cancion empieza a sonar de inmediato, banner "TU CANCION ESTA SONANDO" | |
| U9 | Rate limit excedido | 1. Confirmar N canciones (segun config venue) 2. Intentar otra | Error 429, countdown de tiempo restante visible | |
| U10 | Cancion termina de sonar | 1. Esperar que tu cancion termine | Notificacion "Tu cancion termino", slot liberado, puedes pedir otra | |
| U11 | Error de derechos en cancion | 1. Cancion con restricciones intenta sonar | Modal "No se pudo reproducir [titulo]", slot liberado, buscar filtrado | |
| U12 | Cancelar cancion pendiente | 1. Tocar X en cancion pendiente | Cancion removida de cola, slot NO se libera (ya fue consumido) | |
| U13 | Video duplicado | 1. Intentar agregar video que ya esta en cola | Error 409 "Esta cancion ya esta en la cola" | |
| U14 | Video bloqueado por busqueda | 1. Buscar video previamente bloqueado | Video NO aparece en resultados | |
| U15 | Video bloqueado por submit | 1. Pegar URL de video bloqueado | Error 400 "restricciones de derechos" | |
| U16 | Sesion expira por inactividad | 1. Registrarse 2. No hacer nada por 2h+ 3. Intentar accion | Redirige a registro, 401 | |
| U17 | Sesion expulsada por admin | 1. Admin expulsa mesa | Toast "sesion cerrada por admin", redirige a registro | |
| U18 | Notificacion de navegador | 1. Confirmar primera cancion 2. Aceptar permisos | Al sonar la cancion, notificacion del navegador aparece | |
| U19 | Reconexion WebSocket | 1. Poner app en background 2. Volver | Estado sincronizado (cola, canciones, now playing) | |
| U20 | Pegar link directo | 1. Modo "Pegar link" 2. Pegar URL de YouTube 3. Enviar | Preview de cancion mostrado | |
| U21 | Video muy largo | 1. Intentar video > limite de duracion | Error "supera el limite de X minutos" | |

### Admin

| # | Escenario | Pasos | Resultado Esperado | Estado |
|---|-----------|-------|--------------------|--------|
| A1 | Login admin | 1. Ir a /:venue/admin/login 2. Credenciales correctas | Dashboard carga con cola, mesas, controles | |
| A2 | Login admin incorrecto | 1. Password erroneo | Error 401 | |
| A3 | Ver cola en tiempo real | 1. Usuario agrega cancion | Cancion aparece en cola del admin automaticamente | |
| A4 | Skip cancion | 1. Tocar "Skip" en cancion actual | Siguiente cancion empieza, usuario notificado | |
| A5 | Remover cancion pendiente | 1. Tocar X en cancion pendiente | Cancion eliminada, posiciones ajustadas | |
| A6 | Play Now | 1. Tocar "Play Now" en cancion pendiente | Cancion actual saltada, la seleccionada empieza | |
| A7 | Reordenar cola (drag) | 1. Arrastrar cancion a nueva posicion | Posiciones actualizadas en tiempo real | |
| A8 | Expulsar mesa | 1. Tocar "Kick" en mesa activa | Sesion del usuario cerrada, canciones pendientes removidas | |
| A9 | Resetear limite de mesa | 1. Tocar "Reset" en mesa | Usuario puede pedir canciones de nuevo inmediatamente | |
| A10 | Ajustar volumen | 1. Mover slider de volumen | Kiosk cambia volumen en tiempo real | |
| A11 | Enviar mensaje banner | 1. Escribir texto en banner 2. Enviar | Texto aparece en Kiosk, desaparece despues de 3 min | |
| A12 | Mostrar QR | 1. Activar "Mostrar QR" | QR aparece en Kiosk | |
| A13 | PIN del dia | 1. Ver PIN 2. Regenerar | Nuevo PIN de 4 digitos generado | |
| A14 | Activar/desactivar PIN | 1. Toggle "Requerir PIN" | Siguiente registro requiere/no requiere PIN | |
| A15 | Pausar reproduccion | 1. Tocar Pausa | Kiosk pausa video actual, boton admin muestra "Reanudar" | |
| A16 | Reanudar reproduccion | 1. Tocar Play | Kiosk reanuda video, boton admin muestra "Pausar" | |
| A17 | Forzar fallback | 1. Tocar "Play Fallback Now" | Kiosk cambia a playlist de fallback | |
| A18 | Skip fallback con cola | 1. Fallback sonando + cancion en cola 2. Tocar "Skip" | Kiosk cambia inmediatamente a cancion de usuario, no espera fin de fallback | |
| A19 | Skip fallback sin cola | 1. Fallback sonando + cola vacia 2. Tocar "Skip" | Siguiente cancion de fallback suena | |
| A20 | Pausar fallback | 1. Tocar "Pausar Fallback" | Fallback se detiene, admin muestra tarjeta "PLAYLIST PAUSADA" con boton Reanudar, dashboard usuario limpia "now playing" | |
| A21 | Reanudar fallback pausado | 1. Fallback pausado 2. Tocar "Reanudar" en tarjeta pausada | Fallback reanuda, dashboard admin y usuario muestran cancion actual | |
| A22 | Agregar cancion como admin | 1. Buscar cancion 2. Agregar desde library/URL | Cancion en cola sin limite de rate | |
| A23 | Ver analytics | 1. Ir a tab Analytics 2. Seleccionar periodo | Graficas de canciones, usuarios, horas pico, top songs | |
| A24 | Error de video visible | 1. Video con error suena | Toast "Error de video: [titulo] (codigo X)" | |

### Kiosk (Pantalla del bar)

| # | Escenario | Pasos | Resultado Esperado | Estado |
|---|-----------|-------|--------------------|--------|
| K1 | Reproducir cancion de usuario | 1. Usuario confirma cancion | Video de YouTube se reproduce en pantalla | |
| K2 | Cancion termina | 1. Video llega al final | Siguiente cancion empieza, o fallback se activa | |
| K3 | Error de reproduccion | 1. Video tiene restricciones | Error reportado al backend, siguiente cancion/fallback empieza | |
| K4 | Fallback se activa | 1. Cola se vacia | Playlist de fallback empieza automaticamente | |
| K5 | Cancion de usuario espera fin de fallback | 1. Fallback sonando 2. Usuario confirma cancion | Fallback termina cancion actual COMPLETA, luego cancion de usuario empieza | |
| K6 | Admin skip durante fallback con cola | 1. Fallback sonando 2. Hay cancion en cola 3. Admin da Skip | Kiosk cambia INMEDIATAMENTE a la cancion de cola sin esperar | |
| K7 | Audio bloqueado por navegador | 1. Abrir Kiosk por primera vez | Overlay "ACTIVAR SONIDO" aparece, click lo desbloquea | |
| K8 | 3 errores consecutivos de fallback | 1. 3 canciones de fallback fallan | Fallback se detiene, pantalla en espera | |
| K9 | Admin cambia volumen | 1. Admin ajusta volumen | Volumen del video cambia en tiempo real | |
| K10 | Admin pausa | 1. Admin pausa reproduccion | Video se pausa en pantalla, boton en admin muestra estado Pausado | |
| K11 | Boton centrado visible al pausar | 1. Admin pausa o Kiosk toca Play/Pause | Boton grande Play aparece en centro de pantalla con pulso animado | |
| K12 | Boton centrado al tocar pantalla | 1. Tocar cualquier parte del video | Botones de control y boton centrado aparecen 5s, luego se ocultan | |
| K13 | Kiosk pausa sincroniza admin | 1. Tocar Play/Pause en la pantalla Kiosk | Admin panel refleja el estado pausa/play inmediatamente via WS | |
| K12 | Reconexion despues de desconexion | 1. Internet se cae 2. Vuelve | Kiosk sincroniza estado actual y reanuda | |

### Super Admin

| # | Escenario | Pasos | Resultado Esperado | Estado |
|---|-----------|-------|--------------------|--------|
| S1 | Crear venue | 1. Nombre, slug, admin, config de rate limit | Venue creado con admin asignado | |
| S2 | Configurar rate limit por venue | 1. Editar venue 2. Cambiar window_minutes y max_songs | Rate limit usa valores del venue, no globales | |
| S3 | Marcar pagado | 1. Tocar "Mark Paid" 2. Seleccionar periodo | paid_until extendido, venue activo | |
| S4 | Venue vencido se suspende | 1. paid_until < hoy - 5 dias 2. Usuario intenta registrarse | Auto-suspension, error "bar no disponible" | |
| S5 | Importar playlist | 1. Pegar URL de playlist de YouTube | Canciones importadas a fallback | |
| S6 | Subir logo | 1. Seleccionar archivo PNG/JPG | Logo actualizado, visible en landing y admin | |
| S7 | Eliminar venue | 1. Confirmar eliminacion | Venue y TODOS los datos relacionados eliminados | |

---

## Pruebas de Integracion (Flujos Completos)

### F1: Flujo completo de cancion exitosa
```
Usuario registra → Busca cancion → Selecciona → Confirma → Cola vacia, auto-reproduce
→ Kiosk reproduce → Cancion termina → Slot liberado → Usuario pide otra
```
**Verificar**: Cada paso funciona, WebSocket notifica en tiempo real, rate limit correcto

### F2: Flujo completo de cancion con error
```
Usuario confirma cancion → Kiosk intenta reproducir → YouTube error (derechos)
→ Backend marca como played + guarda en blocked_videos + libera slot
→ Usuario ve modal de error → Cierra modal → Busca otra cancion
→ Video bloqueado NO aparece en resultados → Selecciona otro → Confirma OK
```
**Verificar**: Slot liberado correctamente, video filtrado de busquedas, modal aparece

### F3: Flujo de rate limit con error
```
Usuario confirma 5 canciones → Rate limit alcanzado → 1 cancion tiene error
→ Slot liberado → Usuario puede pedir 1 cancion mas
```
**Verificar**: `songs_remaining` aumenta de 0 a 1 despues del error

### F4: Flujo de sesion y reconexion
```
Usuario registra → Entra al dashboard → Pone telefono en background 5 min
→ Vuelve → WebSocket reconecta → Estado sincronizado
→ 2h sin actividad → Siguiente accion da 401 → Redirige a registro
```
**Verificar**: Reconexion funciona, sesion expira correctamente

### F5: Flujo de admin + usuario simultaneo
```
Admin abre dashboard → Usuario confirma cancion → Admin ve cancion en cola
→ Admin hace skip → Siguiente cancion empieza → Usuario afectado notificado
→ Admin expulsa mesa → Usuario redirigido a registro
```
**Verificar**: Eventos WebSocket llegan a ambos en tiempo real

### F6: Flujo de fallback
```
Ultima cancion de usuario termina → Cola vacia → Fallback se activa
→ Canciones de fallback suenan → Usuario confirma nueva cancion
→ Fallback termina cancion actual → Cancion de usuario empieza
→ Cola se vacia de nuevo → Fallback se reactiva
```
**Verificar**: Transicion suave entre fallback y canciones de usuario

### F7: Flujo de rate limit con config de venue
```
Super admin configura venue: window_minutes=10, max_songs=3
→ Usuario registra → Confirma 3 canciones → 4ta rechazada (429)
→ Countdown muestra ~10 minutos (no 20)
→ Despues de 10 min → Puede pedir mas
```
**Verificar**: Config del venue aplicada correctamente, no usa defaults globales

### F8: Fallback visible en dashboards

```
Cola vacia → Kiosk activa fallback → Kiosk llama /api/playback/fallback-playing
→ Backend guarda estado en memoria + broadcast now_playing_changed con is_fallback=true
→ Admin ve "Sonando: [titulo fallback]" en tarjeta now playing
→ Cliente ve "Sonando: [titulo fallback]" en su dashboard
→ Siguiente cancion de fallback empieza → Nuevo broadcast → Ambos dashboards actualizan
```

**Verificar**: Titulo de cancion de fallback correcto en ambas vistas, se actualiza con cada cancion

### F9: Admin skip durante fallback con cola pendiente

```
Fallback sonando → Usuario agrega cancion → Admin da "Skip" en panel
→ Backend: avanza cola (cancion → status=playing) + broadcast now_playing_changed (sets pendingUserSong en Kiosk)
→ Backend: broadcast fallback_skip (Kiosk llama handleFallbackSkip → encuentra pendingUserSong → switch inmediato)
→ Kiosk cambia a cancion de usuario sin esperar fin de cancion de fallback
→ Admin ve cancion de usuario como "now playing"
```

**Verificar**: Switch inmediato, canciones de cola NO desaparecen (bug anterior: anger-clicking vaciaba cola)

### F10: Usuario agrega cancion mientras fallback suena (sin skip)

```
Fallback sonando → Usuario agrega cancion → Cancion queda status='pending' en DB
→ Backend NO promueve a 'playing' (fallback activo) → Solo broadcast song_added
→ Admin ve cancion en cola como "pendiente" (posicion #1), NO como "sonando" ✓
→ Cliente ve cancion en "mis canciones" con posicion, NO como "sonando" ✓
→ Kiosk recibe song_added → guarda pendingUserSong {already_playing: false}
→ Cancion de fallback termina → startPendingUserSong() → llama /api/queue/start-playing
→ Backend promueve a 'playing', broadcast now_playing_changed
→ Admin y cliente ven cancion de usuario como "sonando"
```

**Verificar**: (1) Cancion NO aparece como "sonando" mientras fallback suena. (2) Si admin da Skip en cola mientras fallback suena, la cancion NO desaparece silenciosamente. (3) Cancion empieza correctamente cuando termina el fallback

### F11: Pausa/resume desde Kiosk sincroniza con admin

```
Kiosk reproduciendo → Tocar Play/Pause en pantalla de video
→ Kiosk llama /api/admin/playback/pause|resume con admin token
→ Backend actualiza config + broadcast playback_status_changed
→ Admin panel refleja estado pausa/play inmediatamente
→ Admin toca Resume → Kiosk reanuda
```

**Verificar**: Estado play/pause coherente entre Kiosk y admin sin importar quien lo cambio primero

### F12: Fallback pausado desde admin

```
Fallback sonando → Admin toca "Pausar Fallback"
→ Backend limpia cache fallback_now_playing + broadcast fallback_status_changed {paused: true}
→ Kiosk detiene reproduccion, limpia estado
→ Admin muestra tarjeta "PLAYLIST PAUSADA" con boton "Reanudar" (no "Sin reproduccion")
→ Dashboard cliente limpia "now playing" de fallback (no muestra cancion obsoleta)
→ Admin toca "Reanudar" → Fallback reanuda desde nueva cancion aleatoria
```

**Verificar**: Ninguna vista muestra estado inconsistente durante la pausa

### F13: Logica unificada de fallback y cola (regla de negocio principal)

```
CASO A — Sin canciones de usuarios:
  Cola vacia → Fallback activo → Canciones de fallback suenan en loop aleatorio
  Admin "Siguiente" → Siguiente cancion del fallback suena inmediatamente
  Admin "Pausar" → Fallback se pausa (musica se detiene, mantiene estado)
  Admin "Reanudar" → Fallback reanuda

CASO B — Usuario agrega cancion mientras fallback suena:
  Fallback sonando → Usuario agrega cancion → Cancion queda 'pending' en DB
  Admin ve "1 cancion en cola" en la tarjeta del fallback
  Cancion de fallback termina naturalmente → Kiosk inicia cancion del usuario automaticamente
  Cancion del usuario termina → Cola vacia → Fallback se reactiva automaticamente

CASO C — Admin da "Siguiente" mientras fallback + cola pendiente:
  Fallback sonando + cancion de usuario en cola
  Admin toca "Siguiente" → Kiosk cambia INMEDIATAMENTE a cancion del usuario
  (No espera a que termine la cancion del fallback actual)
  Cancion del usuario termina → Cola vacia → Fallback se reactiva

CASO D — Play/Pause universal:
  Fallback sonando → Admin toca "Pausar" → Fallback se pausa (mismo boton que para canciones)
  Cancion de usuario sonando → Admin toca "Pausar" → Cancion se pausa
  Kiosk toca Play/Pause en pantalla → Admin refleja el estado en tiempo real
  Estado siempre coherente entre Kiosk y admin panel
```

**Verificar**:
- (B) La cancion del usuario NO aparece como "sonando" mientras el fallback sigue activo
- (B) Si admin da "Siguiente" con cola pendiente, la cancion NO desaparece sin sonar
- (C) El cambio es inmediato, sin esperar fin de cancion de fallback
- (D) Un solo boton Pausar/Reanudar controla todo, sin controles separados por tipo

---

## Pruebas de Error y Resiliencia

| # | Escenario | Que probar | Resultado esperado |
|---|-----------|------------|--------------------|
| E1 | Backend reinicia durante reproduccion | Kiosk pierde WS, reconecta | Kiosk sincroniza estado, continua reproduccion |
| E2 | Multiples usuarios simultaneos | 3+ usuarios confirman al mismo tiempo | Todas las canciones se encolan, posiciones correctas |
| E3 | Admin y usuario confirman al mismo tiempo | Operaciones concurrentes de escritura | Sin errores 500, datos consistentes |
| E4 | Video eliminado de YouTube despues de encolar | Video se intenta reproducir | Error detectado, siguiente cancion avanza |
| E5 | Red lenta del usuario | Latencia alta en requests | Timeouts manejados, no hay estado inconsistente |
| E6 | Doble click en confirmar | Usuario toca 2 veces rapido | Solo 1 cancion encolada (duplicate check) |

---

## Configuracion para Pruebas

### Config del venue recomendada para testing rapido
```json
{
  "window_minutes": 5,
  "max_songs_per_window": 3,
  "max_duration_sec": 300
}
```

### Videos de prueba sugeridos
- **Video que funciona**: Cualquier video musical popular con embedding habilitado
- **Video bloqueado**: Buscar videos de Vevo/UMG que suelen tener restricciones regionales
- **Video largo**: Cualquier video > 5 minutos (para probar limite de duracion)
- **Video eliminado**: Un youtube_id que ya no existe (ej: `dQw4w9WgXcQ1234`)
