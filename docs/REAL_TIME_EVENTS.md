# Eventos en Tiempo Real — BarQueue

## Arquitectura

```
Backend (FastAPI)
  |
  |-- WebSocket broadcast (instantaneo)
  |     |-- broadcast(venue_id, msg)     → todos los clientes del venue
  |     |-- send_to_user(venue_id, uid)  → usuario especifico
  |
  |-- Polling (safety net, 10s)
        |-- Kiosk: /api/playback/now-playing
        |-- Customer: /api/auth/session + queue + my-songs + remaining-slots
        |-- Admin: /api/admin/queue + /api/admin/tables
```

## Inventario de Eventos

| Evento | Tipo | Disparado por | Datos |
|--------|------|---------------|-------|
| `song_added` | broadcast | queue/confirm, admin/add | `{id, youtube_id, title, position, added_by}` |
| `song_removed` | broadcast | admin/remove, user/cancel, admin/kick | `{id, removed_by}` |
| `now_playing_changed` | broadcast | playback/finished, admin/skip, admin/play-now, auto-start | `{song}` o `{song: null, fallback_active, fallback_songs}` |
| `your_song_playing` | send_to_user | playback/finished, admin/skip, auto-start | `{song, message}` |
| `queue_reordered` | broadcast | admin/reorder | `{queue: [{id, position}]}` |
| `playback_status_changed` | broadcast | admin/pause, admin/resume | `{status: "paused"\|"playing"}` |
| `fallback_status_changed` | broadcast | admin/fallback-status | `{paused: bool}` |
| `fallback_play_now` | broadcast | admin/fallback-play | `{fallback_songs}` |
| `volume_changed` | broadcast | admin/volume | `{volume}` |
| `table_registered` | broadcast | auth/register | `{table_number, user_name}` |
| `session_kicked` | send_to_user | admin/kick | `{message}` |
| `rate_limit_reset` | send_to_user | admin/reset-limit, playback/finished | `{message}` |
| `banner_changed` | broadcast | admin/banner | `{banner_text}` |

## Acciones y sus Efectos en Cada Vista

### Usuario pone una cancion

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Confirma cancion | INSERT queue_songs | `song_added` | fetchQueuePreview | refreshAll | fetchQueue + fetchTables |
| Si cola estaba vacia | UPDATE status=playing | `now_playing_changed` | loadVideo | refreshAll | fetchQueue + fetchTables |
| Si es su cancion | — | `your_song_playing` | — | toast + notificacion | — |

### Cancion termina de sonar

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Kiosk POST /finished | UPDATE played, advance queue | `now_playing_changed` | usa response HTTP directo | refreshAll (now playing banner) | fetchQueue + fetchTables |
| Siguiente cancion | UPDATE status=playing | `your_song_playing` | — | toast al dueño | — |
| Usuario cuya cancion termino | — | `rate_limit_reset` | — | fetchRemainingSlots + toast | — |
| Si no hay siguiente | — | `now_playing_changed` (song:null) | playFallback | refreshAll | fetchQueue |

### Admin pausa/resume

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Pause | SET config.playback_status | `playback_status_changed` | pauseVideo + enforcePlaybackStatus | — | update local |
| Resume | SET config.playback_status | `playback_status_changed` | playVideo + enforcePlaybackStatus | — | update local |

### Admin salta cancion

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Skip | UPDATE played, advance | `rate_limit_reset` al dueño de la saltada | — | fetchRemainingSlots | — |
| — | — | `now_playing_changed` | loadVideo | refreshAll | fetchQueue + fetchTables |
| Si hay siguiente | UPDATE playing | `your_song_playing` | — | toast al dueño | — |
| Si cola vacia | — | `now_playing_changed` (fallback) | playFallback | refreshAll | fetchQueue |

### Admin reproduce cancion inmediatamente (play-now)

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Play now | UPDATE anterior=played | `rate_limit_reset` al dueño de la anterior | — | fetchRemainingSlots | — |
| — | UPDATE nueva=playing | `now_playing_changed` | loadVideo | refreshAll | fetchQueue + fetchTables |
| — | — | `your_song_playing` | — | toast al dueño | — |

### Admin expulsa usuario

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Kick | END session, REMOVE songs | `session_kicked` | — | logout + redirect registro | — |
| — | — | `song_removed` | fetchQueuePreview | refreshAll | fetchQueue + fetchTables |

### Admin resetea limite

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Reset | DELETE submission_log | `rate_limit_reset` | — | fetchRemainingSlots + toast | toast local |

### Admin reordena cola

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Drag & drop | UPDATE positions | `queue_reordered` | fetchQueuePreview | fetchQueue + fetchMySongs | skip propio, fetchQueue |

### Admin cambia volumen

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Slider | — | `volume_changed` | setVolume() | — | — |

### Usuario se registra

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Register | INSERT user + session | `table_registered` | — | — | fetchTables |

### Usuario cancela su cancion

| Paso | Backend | WS Event | Kiosk | Customer | Admin |
|------|---------|----------|-------|----------|-------|
| Cancel | UPDATE status=removed | `song_removed` | fetchQueuePreview | refreshAll | fetchQueue + fetchTables |

## Polling (Safety Net)

Cada vista tiene un polling que cubre eventos perdidos:

| Vista | Intervalo | Que sincroniza |
|-------|-----------|----------------|
| Kiosk | 10s | now_playing + playback_status via syncNowPlaying() |
| Customer | 10s | session + queue + my_songs + rate_limits via syncAll() |
| Admin | 10s | queue + tables via fetchQueue() + fetchTables() |

## WebSocket Reconexion

- Backoff exponencial: 1s → 1.5s → 2.25s → ... → max 15s
- Al reconectar: cada vista re-fetcha todo (onReconnect handler)
- visibilitychange: reconecta al volver de background (iOS Safari fix)
- Ping cada 30s para mantener conexion viva

## Reglas de localStorage

| Evento | Accion |
|--------|--------|
| Logout manual | Limpia bq_token, bq_user, bq_session |
| Expulsion (kick) | Limpia todo + redirect a registro |
| Sesion expirada (poll detecta null) | Limpia todo + redirect |
| Refresh de pagina | NO limpia — mantiene sesion |
| Background/foreground | NO limpia — reconecta WS |
