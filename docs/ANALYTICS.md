# Plan de Medicion - Repitela Analytics

## Resumen

Repitela usa Google Tag Manager (GTM-PPVKNTZB) para enviar eventos a GA4. Los eventos se pushean al `dataLayer` desde el frontend y GTM los captura y envia a Google Analytics.

## Eventos Implementados

### Eventos de Usuario

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_user_registered` | QRLanding - registro exitoso (usuario nuevo) | `venue_slug` |
| `repitela_user_returned` | QRLanding - registro exitoso (usuario existente) | `venue_slug` |
| `repitela_session_started` | QRLanding - despues de registro | `venue_slug` |
| `repitela_session_kicked` | CustomerDashboard - admin expulsa al usuario | `venue_slug` |

### Eventos de Producto (Canciones)

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_song_searched` | SongSubmit - busqueda completada | `search_query`, `results_count` |
| `repitela_song_submitted` | SongSubmit - cancion seleccionada para preview | `youtube_id`, `song_title` |
| `repitela_song_confirmed` | CustomerDashboard - cancion confirmada a la cola | `youtube_id`, `song_title`, `queue_position` |
| `repitela_song_cancelled` | CustomerDashboard - usuario cancela su cancion | `song_id` |

### Eventos de Reproduccion

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_song_played` | Kiosk - video empieza a reproducirse | `youtube_id`, `song_title`, `is_fallback` |
| `repitela_song_ended` | Kiosk - video termina naturalmente | `youtube_id`, `song_title` |
| `repitela_song_error` | Kiosk - error de YouTube (bloqueado/removido) | `youtube_id`, `error_code` |
| `repitela_fallback_activated` | Kiosk - playlist de respaldo se activa | `venue_slug` |

### Eventos de Admin

| Evento | Donde se dispara | Parametros |
|--------|-----------------|------------|
| `repitela_admin_action` | AdminDashboard - cualquier accion admin | `admin_action`, + detalles |

Valores de `admin_action`:
- `start_playback` - iniciar reproduccion
- `skip_song` - saltar cancion
- `pause_playback` - pausar
- `resume_playback` - reanudar
- `skip_fallback` - saltar cancion de playlist
- `play_now` - reproducir cancion especifica (+ `song_id`)
- `clear_queue` - vaciar cola (+ `songs_cleared`)
- `remove_song` - quitar cancion (+ `song_id`)
- `kick_table` - expulsar usuario (+ `table_number`)
- `reset_limit` - resetear limite (+ `table_number`)

## Arquitectura

```
Frontend (Vue)
  |
  | window.dataLayer.push({ event: 'repitela_xxx', ... })
  v
Google Tag Manager (GTM-PPVKNTZB)
  |
  | Triggers: Custom Event → Tag GA4
  v
Google Analytics 4 (GA4)
  |
  v
Reportes / Explorations
```

### Archivo fuente
- Helper: `frontend/src/utils/analytics.js`
- Todas las funciones de tracking son wrappers de `dataLayer.push()`

## Configuracion en GTM

### Importar contenedor
El archivo `docs/gtm-container.json` contiene la configuracion completa lista para importar en GTM:
1. Ir a GTM > Admin > Importar contenedor
2. Seleccionar `gtm-container.json`
3. Elegir "Combinar" > "Renombrar etiquetas, activadores y variables en conflicto"
4. Revisar y publicar

### Que incluye el contenedor
- 9 variables de capa de datos
- 13 triggers (uno por evento)
- 13 tags de GA4 (uno por trigger)

### Configuracion manual (si no se importa)

#### Variables (capa de datos)
| Variable | Clave |
|----------|-------|
| dlv - venue_slug | venue_slug |
| dlv - youtube_id | youtube_id |
| dlv - song_title | song_title |
| dlv - queue_position | queue_position |
| dlv - search_query | search_query |
| dlv - results_count | results_count |
| dlv - error_code | error_code |
| dlv - is_fallback | is_fallback |
| dlv - admin_action | admin_action |
| dlv - song_id | song_id |
| dlv - table_number | table_number |
| dlv - songs_cleared | songs_cleared |

#### Triggers (evento personalizado)
Un trigger por cada evento `repitela_*` listado arriba.

#### Tags (GA4 Event)
Un tag por cada trigger. Measurement ID de GA4 como constante. Parametros mapeados desde las variables.

## Configuracion en GA4

### Dimensiones personalizadas
En GA4 > Admin > Definiciones personalizadas, registrar:

| Nombre | Ambito | Parametro |
|--------|--------|-----------|
| Venue | Evento | venue_slug |
| YouTube ID | Evento | youtube_id |
| Titulo cancion | Evento | song_title |
| Accion admin | Evento | admin_action |
| Busqueda | Evento | search_query |
| Codigo error | Evento | error_code |
| Posicion cola | Evento | queue_position |

### Metricas derivadas (en Explorations)
- **Tasa de conversion**: `song_confirmed / session_started`
- **Tasa de busqueda**: `song_searched / session_started`
- **Canciones por sesion**: `song_confirmed / session_started`
- **Tasa de error**: `song_error / song_played`
- **Tasa de fallback**: `fallback_activated / song_ended`
- **Usuarios nuevos vs recurrentes**: `user_registered vs user_returned`

## Verificacion

1. Abrir GTM en modo Preview
2. Abrir la app en otra pestana
3. Registrarse como usuario, buscar cancion, confirmar
4. Verificar que los eventos aparecen en el panel de debug de GTM
5. Verificar en GA4 > Tiempo real que los eventos llegan
